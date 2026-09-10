# Camada `services/` — o cliente HTTP da SEFAZ

[src/services/sefaz-service.js](../../../src/services/sefaz-service.js) é o único ponto do código que fala com a rede. Exporta a classe `Instance` (importada como `SefazService`), com um construtor que monta a instância do axios e um método `request`.

É também o **único módulo de `src/` que não é exportado com `Object.freeze`** — porque é o único que precisa ser instanciado com estado (`this.instance`).

## Construtor — a mescla de options

Duas mesclas, ambas com o mesmo padrão: default nosso primeiro, options do usuário por cima.

```js
const AgentOptions = Object.assign(
  { cert, key, ca, rejectUnauthorized: false },
  { ...opts.httpsOptions }
)
```

> **`httpsOptions` chega congelado de `apis/`** (ver [apis.md](apis.md)), e é o que dita a forma dessa mescla. `Object.assign` escreve no **primeiro** argumento, que aqui é um literal recém-criado — o objeto congelado é só fonte, nunca alvo, então não é por causa dele que o spread `{ ...opts.httpsOptions }` existe. O que causou o bug `Cannot add property rejectUnauthorized, object is not extensible` (#22, corrigido na 0.14.13) foi outra coisa: antes da mescla havia uma linha que **mutava o objeto congelado direto**, `opts.httpsOptions['rejectUnauthorized'] = false`. O conserto foi apagá-la e mover o default para dentro do literal. A regra que sobra: **objeto vindo de `this.config` não se muta — copie antes.** Ver [ADR 0005](../decisoes/0005-object-freeze-pervasivo.md).

### `https.Agent`

| Opção                | Origem                                                       |
| -------------------- | ------------------------------------------------------------ |
| `cert`, `key`        | Certificado A1 do contribuinte, já em PEM — é o mTLS         |
| `ca`                 | Cadeia ICP-Brasil de [src/env/ca.js](../../../src/env/ca.js) |
| `rejectUnauthorized` | `false` por padrão, sobrescritível por `httpsOptions`        |

`rejectUnauthorized: false` é o default histórico, adotado porque endpoints da SEFAZ apresentavam cadeia incompleta. É um default **inseguro**: nessa configuração o certificado do servidor não é verificado, e a conexão fica exposta a interceptação. Ele é mantido só por compatibilidade com as versões anteriores.

> **Em produção, passar `httpsOptions: { rejectUnauthorized: true }`.** A cadeia própria em `ca` já vai no agent, então a verificação funciona sem carregar a ICP-Brasil por conta própria.

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

Todo o corpo é `try/catch`, e o `catch` classifica em três casos:

| Situação                                           | `status`         | `data`                    |
| -------------------------------------------------- | ---------------- | ------------------------- |
| Sucesso                                            | Real             | Corpo da resposta         |
| `error.response` (a SEFAZ respondeu com erro HTTP) | Real do response | Corpo do response         |
| `error.request` + `ECONNABORTED`                   | **504**          | `<error>mensagem</error>` |
| `error.request` (sem resposta)                     | **502**          | `<error>mensagem</error>` |
| Qualquer outro erro                                | **500**          | `<error>mensagem</error>` |

Dois pontos que explicam o desenho:

1. **Status sintético.** 504/502/500 não vieram da SEFAZ — foram atribuídos aqui. Quem lê `status` no retorno está lendo "o que aconteceu", não necessariamente "o que o servidor respondeu".
2. **O erro vira XML.** Empacotar a mensagem em `<error>…</error>` mantém a assinatura de `data` como string de XML, para que `montarResponse` possa fazer `Xml.xmlToJson` sem tratar o caso especial. O `error` resultante sobe até o retorno público pelo `RetornoHelper`. Ver [controllers-helpers.md](controllers-helpers.md).

Consequência prática: **a biblioteca não lança por problema de rede.** Timeout, DNS, certificado vencido e 500 da SEFAZ chegam como retorno com `error` preenchido. Ver [ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md).

## O que não existe aqui

Deliberadamente: sem retry, sem backoff, sem circuit breaker, sem pool reaproveitado entre chamadas (cada `enviar` cria uma instância nova), sem log. Política de repetição é decisão de quem consome — a SEFAZ tem regras de cadência por serviço, e embutir retry aqui esconderia o `cStat` que o chamador precisa ver.
