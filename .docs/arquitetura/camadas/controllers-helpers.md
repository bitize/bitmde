# Camadas `controllers/` e `helpers/`

## Controllers — a sequência fixa

[src/controllers/](../../../src/controllers/) tem duas classes, cada uma com um único método estático `enviar(opts)`, e as duas têm praticamente o mesmo corpo:

```js
static async enviar(opts) {
  const data = XHelper.montarRequest(opts)
  const retornoSefaz = await XHelper.enviarConsulta(data, opts) // .enviarEvento na recepção
  const json = await XHelper.montarResponse(retornoSefaz.data)
  return RetornoHelper.montarRetorno({ json, data, retornoSefaz })
}
```

O controller não decide nada: ele fixa a ordem e o formato do retorno. Toda variação entre os dois serviços está no helper. Se um passo novo aparecer (retry, cache, log), é aqui que ele entraria — e isso mudaria o contrato dos dois serviços de uma vez.

Diferença única entre os dois: `DistribuicaoHelper.montarResponse` é **assíncrono** (precisa de gunzip nos `docZip`), `RecepcaoHelper.montarResponse` é síncrono. Por isso o `await` acima é obrigatório na distribuição — sem ele, `json` seria a Promise, não a resposta — e o [recepcaoEvento-controller.js](../../../src/controllers/recepcaoEvento-controller.js) o dispensa. Escrevê-lo nos dois é inofensivo: `await` sobre valor não-Promise resolve para ele mesmo.

O JSDoc de `enviar` em cada controller descreve o shape completo do retorno — é o que aparece no `dist/index.d.ts` como tipo de retorno dos métodos públicos.

## Helpers — a orquestração

Cada helper de serviço tem os mesmos três métodos:

| Método                            | Faz                                                                     |
| --------------------------------- | ----------------------------------------------------------------------- |
| `montarRequest`                   | `opts` → schema → XML → (assinatura, só na recepção) → envelope SOAP    |
| `enviarConsulta` / `enviarEvento` | Escolhe o endpoint por `tpAmb`, instancia o `SefazService` e faz `POST` |
| `montarResponse`                  | XML da SEFAZ → JSON normalizado                                         |

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

Motivo: quando a SEFAZ devolve HTML de erro, um envelope de falha SOAP, ou quando não houve resposta e `data` chega como `''`, o caminho esperado não existe. Sem os defaults, seria `TypeError` em vez de retorno com `error`. **Não simplificar essa desestruturação.**

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

Antes disso, um `<loteDistDFeInt/>` vazio — que o parser devolve como string `''`, não como objeto — é trocado por `{}`; sem isso a atribuição de `docZip` lançaria `TypeError` em modo estrito. **Só** a string vazia vira lote vazio: texto no lugar dos `docZip` (string não vazia) ou elemento repetido (array) preenchem `error` com `loteDistDFeInt inválido.`. Tratá-los como lote vazio deixaria `ultNSU` chegar ao chamador, que avançaria a varredura por cima de documentos que não viu; com `error`, o `RetornoHelper` esvazia `data`.

Por fim, cada campo escalar recebe `|| ''`. O consumidor nunca vê `undefined` num campo esperado — vê string vazia.

### `docZip` processado item a item

Na distribuição, cada `docZip` passa por `DistribuicaoHelper.abrirDocZip`, que **nunca rejeita**: ou devolve `{ xml, json, nsu, schema }`, ou devolve `{ nsu, schema, error }`. `montarResponse` faz o `Promise.all` sobre esses resultados e os separa, na ordem do lote, em `docZip` (válidos) e `docZipErrors` (falhas). As três falhas possíveis, com o texto exato:

| Etapa                  | `error`                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `value` vazio          | `docZip sem conteúdo.`                                      |
| `Gzip.unzip` rejeitou  | `Falha ao descompactar o docZip: <mensagem original>`       |
| `Xml.xmlToJson` lançou | `Falha ao interpretar o XML do docZip: <mensagem original>` |

O prefixo é contrato; o sufixo é o `err.message` do zlib ou do `fast-xml-parser`. Falha de `docZip` não preenche o `error` de topo, então o `RetornoHelper` não esvazia `data` e `ultNSU`/`maxNSU` chegam ao chamador. Ver [ADR 0013](../decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md).

### Propagação de erro

Erro de transporte **não passa** por `montarResponse` como erro. Sem resposta HTTP, o `SefazService` devolve `data: ''` e o motivo em `transportError`; `montarResponse('')` não lança e devolve o objeto com os campos vazios, e o controller segue sem ramo especial. Quem lê `transportError` é o `RetornoHelper`.

O `if (json.error)` de `montarResponse` continua lá: se o corpo de uma resposta HTTP real vier como `<error>…</error>`, ele copia `retorno['error']` **antes** de tentar ler o envelope, e o resultado é um objeto com `error` preenchido e os demais campos vazios. Até a 0.18.0 era o caminho do erro de transporte, que o `SefazService` embrulhava nessa tag; hoje é só defesa contra corpo inesperado.

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

| Campo            | Conteúdo                                                           |
| ---------------- | ------------------------------------------------------------------ |
| `data`           | O JSON normalizado pelo `montarResponse`                           |
| `reqXml`         | O XML **enviado**, envelope SOAP incluído (útil para auditoria)    |
| `resXml`         | O corpo cru da resposta, como veio; `''` quando não houve resposta |
| `status`         | O HTTP status real, ou `0` quando não houve resposta               |
| `error`          | Só existe quando houve erro                                        |
| `transportError` | `{ code, message }` — só existe quando não houve resposta HTTP     |

Três condições fazem `data` virar `{}` e `error` aparecer, nesta ordem:

```js
if (retornoSefaz.transportError) { ...; return retorno }      // sem resposta HTTP
if (json.error) { ... }                                        // corpo <error>…</error>
if (Math.floor(retornoSefaz.status / 100) > 2 && !json.error) { ... }  // status >= 300
```

A primeira monta `error` com o texto exato `Falha de transporte (${code}): ${message}`, copia `transportError` (só `code` e `message`) e retorna cedo. Ela precisa vir antes: com `status: 0`, a terceira condição é falsa (`Math.floor(0 / 100) > 2`), e o retorno sairia sem `error`. Ver [ADR 0014](../decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md).

A segunda usa `Math.floor(status / 100) > 2`, ou seja, **3xx também é erro** aqui — não há tratamento de redirect. E `reqXml` e `resXml` continuam preenchidos mesmo no caminho de erro; é o que permite diagnosticar rejeição da SEFAZ sem reproduzir a chamada.

> `error` é **string**, não `Error`. Erro de transporte não lança — quem chama precisa testar o campo. Ver [ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md).

## Ao mexer aqui

- Campo novo no retorno da SEFAZ: acrescentar em `montarResponse` **com `|| ''`** e atualizar o JSDoc do controller (é ele que vira tipo público) e o `README.md`.
- Nunca lançar de dentro de helper por causa de resposta da SEFAZ — o contrato é devolver `error` ([ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)). A brecha que existia no `docZip` corrompido foi fechada pela [ADR 0013](../decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md); não reintroduzir `Promise.all` sobre operação que pode rejeitar.
- Brecha ainda aberta: `Xml.xmlToJson` sobre o **envelope** lança quando o corpo da resposta não é XML (o `fast-xml-parser` rejeita entradas como `'nao e xml <<'`). Vale para os dois helpers.
- Toda classe daqui é exportada com `Object.freeze` e existe teste que garante isso.
