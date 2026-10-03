# Camada `services/` — o cliente HTTP da SEFAZ

[src/services/sefaz-service.js](../../../src/services/sefaz-service.js) é o único ponto do código que fala com a rede. Exporta a classe `Instance` (importada como `SefazService`), com um construtor que monta a instância do axios e um método `request`.

É também o **único módulo de `src/` que não é exportado com `Object.freeze`** — porque é o único que precisa ser instanciado com estado (`this.instance`).

## Construtor — a mescla de options

Duas mesclas, ambas com o mesmo padrão: default nosso primeiro, options do usuário por cima.

```js
const AgentOptions = Object.assign(
  { cert, key, ca, rejectUnauthorized: true },
  { ...opts.httpsOptions }
)
```

> **`httpsOptions` chega congelado de `apis/`** (ver [apis.md](apis.md)), e é o que dita a forma dessa mescla. `Object.assign` escreve no **primeiro** argumento, que aqui é um literal recém-criado — o objeto congelado é só fonte, nunca alvo, então não é por causa dele que o spread `{ ...opts.httpsOptions }` existe. O que causou o bug `Cannot add property rejectUnauthorized, object is not extensible` (#22, corrigido na 0.14.13) foi outra coisa: antes da mescla havia uma linha que **mutava o objeto congelado direto**, `opts.httpsOptions['rejectUnauthorized'] = false`. O conserto foi apagá-la e mover o default para dentro do literal. A regra que sobra: **objeto vindo de `this.config` não se muta — copie antes.** Ver [ADR 0005](../decisoes/0005-object-freeze-pervasivo.md).

### `https.Agent`

| Opção                | Origem                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `cert`, `key`        | Certificado A1 do contribuinte, já em PEM — é o mTLS                                                     |
| `ca`                 | `CA_PADRAO` de [src/env/ca.js](../../../src/env/ca.js), passado pelo helper: raízes do Node + ICP-Brasil |
| `rejectUnauthorized` | `true` por padrão, sobrescritível por `httpsOptions`                                                     |

O certificado do servidor é verificado por padrão desde a 0.19.0. Até a 0.18.0 o padrão era `false`, e a cadeia passada em `ca` era só a ICP-Brasil, que **substitui** as raízes do Node em vez de somar: quem ligava a validação não fechava o handshake com o Ambiente Nacional, cujo certificado hoje vem da GlobalSign. As duas coisas mudaram juntas, e o porquê está no [ADR 0014](../decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md). Ver também [env.md](env.md).

`httpsOptions` continua mandando sobre tudo. `{ rejectUnauthorized: false }` desliga a validação (desaconselhado), e `{ ca: [...] }` troca a cadeia **inteira** — para somar uma AC, o consumidor compõe `[...CA_PADRAO, minhaCa]`.

### Instância axios

| Opção          | Default                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `baseURL`      | Endpoint do serviço para o `tpAmb`                                        |
| `User-Agent`   | `bitmde/<VERSION>` — de [src/env/version.js](../../../src/env/version.js) |
| `Content-Type` | `application/soap+xml; charset=utf-8` (SOAP 1.2)                          |
| `httpsAgent`   | O agent acima                                                             |
| `timeout`      | `60000` (60 s)                                                            |

Passar `requestOptions: { headers: {...} }` **substitui o objeto de headers inteiro**, não mescla chave a chave — `Object.assign` é raso. Quem sobrescrever headers precisa repetir `Content-Type` e, se quiser, o `User-Agent`.

O `User-Agent` sai de `src/env/version.js`, que é **commitado e regenerado pelo build**. Bumpar só o `package.json` deixa a lib se identificando com a versão anterior; a CI tem guard para isso, ver [release.md](../release.md).

## `request(config)` — nunca lança

Todo o corpo é `try/catch`, e o `catch` separa só dois casos: houve resposta HTTP ou não houve.

| Situação                                           | `status`         | `data`            | `transportError`    |
| -------------------------------------------------- | ---------------- | ----------------- | ------------------- |
| Sucesso                                            | Real             | Corpo da resposta | —                   |
| `error.response` (a SEFAZ respondeu com erro HTTP) | Real do response | Corpo do response | —                   |
| Qualquer outro erro (sem resposta HTTP)            | **`0`**          | `''`              | `{ code, message }` |

Três pontos que explicam o desenho:

1. **Nenhum status sintético.** `status` é o que o servidor mandou, ou `0` quando não houve resposta — convenção de `fetch` e `XMLHttpRequest`. Até a 0.18.0 havia 504 (timeout), 502 (sem resposta) e 500 (antes do envio), indistinguíveis de status reais; a distinção agora está no `code`.
2. **`code` sem tradução.** É o `error.code` do Node ou do axios: `ECONNABORTED` (timeout do axios), `ECONNREFUSED`, `ENOTFOUND`, `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (cadeia), `ERR_BAD_REQUEST` (antes do envio). Sem `code`, `ERR_DESCONHECIDO`. `message` é `error.message`, ou `String(error)` quando vier vazio.
3. **Só `code` e `message` saem do `catch`.** O `AxiosError` carrega `config.httpsAgent`, e o agente guarda `cert` e `key` do A1. Nunca repassar o erro, `error.config`, `error.request`, nem usá-lo como `cause`: a chave privada iria parar no log de quem consome. `test/transporte.test.js` confere que o retorno serializado não contém `PRIVATE KEY` nem `httpsAgent`.

O `RetornoHelper` transforma `transportError` no `error` público. Ver [controllers-helpers.md](controllers-helpers.md).

Consequência prática: **a biblioteca não lança por problema de rede.** Timeout, DNS, certificado vencido e 500 da SEFAZ chegam como retorno com `error` preenchido. Ver [ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) e, para a forma do erro de transporte, [ADR 0014](../decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md).

## O que não existe aqui

Deliberadamente: sem retry, sem backoff, sem circuit breaker, sem pool reaproveitado entre chamadas (cada `enviar` cria uma instância nova), sem log. Política de repetição é decisão de quem consome — a SEFAZ tem regras de cadência por serviço, e embutir retry aqui esconderia o `cStat` que o chamador precisa ver.
