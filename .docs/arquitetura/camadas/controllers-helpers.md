# Camadas `controllers/` e `helpers/`

## Controllers — a sequência fixa

[src/controllers/](../../../src/controllers/) tem duas classes, cada uma com um único método estático `enviar(opts)`, e as duas têm praticamente o mesmo corpo:

```js
static async enviar(opts) {
  const data = XHelper.montarRequest(opts)
  const retornoSefaz = await XHelper.enviarConsulta(data, opts) // .enviarEvento na recepção
  const json = await XHelper.montarResponse(retornoSefaz.data, opts.documento)
  return RetornoHelper.montarRetorno({ json, data, retornoSefaz })
}
```

O controller não decide nada: ele fixa a ordem e o formato do retorno. Toda variação entre os dois serviços está no helper. Se um passo novo aparecer (retry, cache, log), é aqui que ele entraria — e isso mudaria o contrato dos dois serviços de uma vez.

Diferença única entre os dois: `DistribuicaoHelper.montarResponse` é **assíncrono** (precisa de gunzip nos `docZip`), `RecepcaoHelper.montarResponse` é síncrono. Por isso o `await` acima é obrigatório na distribuição — sem ele, `json` seria a Promise, não a resposta — e o [recepcaoEvento-controller.js](../../../src/controllers/recepcaoEvento-controller.js) o dispensa. Escrevê-lo nos dois é inofensivo: `await` sobre valor não-Promise resolve para ele mesmo.

O JSDoc de `enviar` em cada controller descreve o shape completo do retorno — é o que aparece no `dist/index.d.ts` como tipo de retorno dos métodos públicos.

## Helpers — a orquestração

Cada helper de serviço tem os mesmos três métodos:

| Método                            | Faz                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `montarRequest`                   | `opts` → schema → XML → (assinatura, só na recepção) → envelope SOAP                                     |
| `enviarConsulta` / `enviarEvento` | Endpoint por `documento.endpoints[tpAmb]` (distribuição) ou `RECEPCAO[tpAmb]`; `POST` via `SefazService` |
| `montarResponse`                  | XML da SEFAZ → JSON normalizado                                                                          |

### `montarResponse` — o padrão de leitura defensiva

Os dois helpers desestruturam a resposta com default em **cada** nível:

```js
const {
  'soap:Envelope': {
    'soap:Body': {
      nfeDistDFeInteresseResponse: {
        nfeDistDFeInteresseResult: { retDistDFeInt = {} } = {},
      } = {},
    } = {},
  } = {},
} = json
```

Motivo: quando a SEFAZ devolve HTML de erro, um envelope de falha SOAP, ou quando o `SefazService` sintetizou `<error>…</error>`, o caminho esperado não existe. Sem os defaults, seria `TypeError` em vez de retorno com `error`. **Não simplificar essa desestruturação.**

Em seguida, o campo repetível é normalizado para array — `docZip` na distribuição, `retEvento` na recepção — porque o `fast-xml-parser` devolve objeto quando há **um** elemento e array quando há vários:

```js
if (loteDistDFeInt.docZip) {
  if (!Array.isArray(loteDistDFeInt.docZip)) {
    loteDistDFeInt['docZip'] = [loteDistDFeInt.docZip]
  }
} else {
  loteDistDFeInt['docZip'] = []
}
```

Por fim, cada campo escalar recebe `|| ''`. O consumidor nunca vê `undefined` num campo esperado — vê string vazia.

### Propagação de erro

Se `Xml.xmlToJson` produziu um objeto com `error` (caso da resposta sintética do `SefazService`), `montarResponse` copia `retorno['error']` **antes** de tentar ler o envelope, e segue: o resultado é um objeto com `error` preenchido e os demais campos vazios. Quem transforma isso no formato final é o `RetornoHelper`.

## `RetornoHelper` — o formato final

[src/helpers/retorno-helper.js](../../../src/helpers/retorno-helper.js) é a única definição do formato de retorno público:

```js
const retorno = {
  data: json,
  reqXml: data,
  resXml: retornoSefaz.data,
  status: retornoSefaz.status,
}
```

| Campo    | Conteúdo                                                        |
| -------- | --------------------------------------------------------------- |
| `data`   | O JSON normalizado pelo `montarResponse`                        |
| `reqXml` | O XML **enviado**, envelope SOAP incluído (útil para auditoria) |
| `resXml` | O corpo cru da resposta, como veio                              |
| `status` | O HTTP status — real, ou o sintetizado pelo `SefazService`      |
| `error`  | Só existe quando houve erro                                     |

Duas condições fazem `data` virar `{}` e `error` aparecer:

```js
if (json.error) { ... }                                        // erro capturado no parse/transporte
if (Math.floor(retornoSefaz.status / 100) > 2 && !json.error) { ... }  // status >= 300
```

A segunda usa `Math.floor(status / 100) > 2`, ou seja, **3xx também é erro** aqui — não há tratamento de redirect. E `reqXml` e `resXml` continuam preenchidos mesmo no caminho de erro; é o que permite diagnosticar rejeição da SEFAZ sem reproduzir a chamada.

> `error` é **string**, não `Error`. Erro de transporte não lança — quem chama precisa testar o campo. Ver [ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md).

## Ao mexer aqui

- Campo novo no retorno da SEFAZ: acrescentar em `montarResponse` **com `|| ''`** e atualizar o JSDoc do controller (é ele que vira tipo público) e o `README.md`.
- Nunca lançar de dentro de helper por causa de resposta da SEFAZ — o contrato é devolver `error`. A única brecha conhecida é `Gzip.unzip` num `docZip` corrompido: a Promise rejeita dentro do `Promise.all` de `montarResponse` e a rejeição sobe até o chamador. Está registrada na [ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md); o conserto, quando vier, é convertê-la em `error` — não abrir a regra.
- Toda classe daqui é exportada com `Object.freeze` e existe teste que garante isso.
