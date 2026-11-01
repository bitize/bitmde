# GH-38: Transporte em `node:https`, sem o axios

| Campo                | Valor                                               |
| -------------------- | --------------------------------------------------- |
| **Issue**            | [GH-38](https://github.com/bitize/bitmde/issues/38) |
| **Status**           | especificadas                                       |
| **Plano**            | —                                                   |
| **Prioridade**       | P2 (médio)                                          |
| **Tipo**             | dependências                                        |
| **Camadas afetadas** | apis / validators / helpers / services / test       |
| **Criado em**        | 2026-11-01                                          |
| **Atualizado em**    | 2026-11-01                                          |
| **Concluído em**     | —                                                   |

---

## Contexto e motivação

O axios é usado num único arquivo, [src/services/sefaz-service.js](../../../src/services/sefaz-service.js), e só para o essencial: um `POST` ou um `GET` HTTPS com `https.Agent` (mTLS), timeout, headers e o corpo como string. Os quatro helpers que chamam o `SefazService` passam no máximo `method`, `url`, `params`, `headers`, `data` e `responseType`.

O custo dele é desproporcional a esse uso:

- **É a dependência de runtime que mais recebe aviso de segurança.** Na 0.22.0 eram 12 avisos só nele, e a [GH-32](../concluidas/GH-32-dependencias-em-faixa-e-npm-audit.md) bumpou para 1.21.0. Para o nosso uso (adapter http, sem proxy, sem HTTP/2) quase todos eram defesa em profundidade, mas cada um vira `npm audit` vermelho para quem consome.
- **Traz transitivas** (`follow-redirects`, `form-data`, `https-proxy-agent`, `proxy-from-env` e as delas) que não usamos.
- **Vaza para a tipagem pública.** O JSDoc dos seis construtores declara `requestOptions` como `import('axios').AxiosRequestConfig`, então o `dist/index.d.ts` depende de o consumidor TS ter os tipos do axios resolvíveis.

### Por que não o `fetch` nativo

O `fetch` do Node não aceita `https.Agent`. Para apresentar certificado de cliente ele exige um `dispatcher` do undici (`new Agent({ connect: { cert, key, ca } })`), e o Node não exporta a classe `Agent` do undici que embarca. As saídas são instalar o pacote `undici` — troca uma dependência por outra, com o risco de o `Agent` do npm não casar com o undici interno da versão do Node — ou pegar o dispatcher global por `Symbol.for('undici.globalDispatcher.1')`, que é detalhe interno e pode quebrar em qualquer versão. Nenhuma das duas serve para uma lib pública.

`node:https.request` aceita o mesmo `https.Agent` de hoje. `httpsOptions`, `CA_PADRAO` e a validação TLS do [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md) continuam idênticos.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — invariante 1 (rede não lança) e invariante 4 (mensagens literais)
- [x] [apis](../../arquitetura/camadas/apis.md) — `requestOptions` repassado sem validator, JSDoc que vira `.d.ts`
- [x] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`/`getError()`
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — `montarRequest` da NFS-e devolve config do axios
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mescla de options, headers, `request` que nunca lança, só `code` e `message`
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md) — `transporte.test.js`, `sefaz.test.js` manual
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                                                                                    | Prioridade |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | `axios` sai de `dependencies`, com `package.json` e `package-lock.json` no mesmo commit. Nenhuma dependência de runtime nova entra                                                                                           | Must       |
| RF-02 | `SefazService` faz a requisição com `https.request` e o mesmo `https.Agent` de hoje (mesma mescla com `httpsOptions`)                                                                                                        | Must       |
| RF-03 | `request(config)` mantém a assinatura e o retorno: `{ status, data }` com qualquer resposta HTTP, `{ status: 0, data: '', transportError: { code, message } }` sem resposta. Nunca lança                                     | Must       |
| RF-04 | A URL é `baseURL` + `url` por **concatenação**, como o axios faz, e não por resolução de `URL` (Decisão 3). `params` vira query string com `URLSearchParams`                                                                 | Must       |
| RF-05 | Headers: defaults da instância (`User-Agent`, `Content-Type` SOAP), substituídos por inteiro por `requestOptions.headers` se informado, e por cima disso os headers da requisição, mesclados sem diferenciar maiúsculas      | Must       |
| RF-06 | `Content-Length` calculado com `Buffer.byteLength(data)` quando há corpo. O corpo vai em UTF-8                                                                                                                               | Must       |
| RF-07 | Envia `Accept-Encoding: gzip, deflate, br` e descompacta a resposta conforme o `Content-Encoding` (`gzip`, `x-gzip`, `deflate`, `br`) com `zlib`. Falha de descompactação vira erro de transporte (`status: 0`)              | Must       |
| RF-08 | Timeout com `req.setTimeout(timeout)` (inatividade do socket, como o axios). Estourou: destrói a requisição e devolve `code: 'ECONNABORTED'`, `message: 'timeout of <ms>ms exceeded'`. `timeout: 0` desliga. Default `60000` | Must       |
| RF-09 | Redirect não é seguido: um 3xx volta com `status` e corpo reais                                                                                                                                                              | Must       |
| RF-10 | O corpo da resposta volta sempre como string UTF-8. `responseType` sai das configs montadas pelos helpers da NFS-e                                                                                                           | Must       |
| RF-11 | `requestOptions` aceita só `baseURL`, `timeout` e `headers`, validados por um `RequestOptionsValidator` novo nos seis construtores, como último validator. Qualquer outra chave lança (Decisão 2)                            | Must       |
| RF-12 | JSDoc de `requestOptions` nos seis construtores troca `import('axios').AxiosRequestConfig` por um tipo próprio. O `dist/index.d.ts` não menciona `axios`                                                                     | Must       |
| RF-13 | Do erro capturado continuam saindo só `code` e `message`. `this.instance` continua sendo a função que faz a requisição, para os testes de `SefazService` que a substituem seguirem valendo                                   | Must       |
| RF-14 | ADR 0018 registra a troca, o contrato novo de `requestOptions`, o proxy por ambiente e o piso do Node                                                                                                                        | Must       |
| RF-15 | README, `CHANGELOG.md` (`[Não publicado]`, com `### Compatibilidade`), docs de camada, `arquitetura/README.md` e `CLAUDE.md` deixam de citar o axios                                                                         | Must       |
| RF-16 | O `https.Agent` ganha `proxyEnv: process.env` no default, antes da mescla com `httpsOptions`: `HTTPS_PROXY`/`https_proxy` e `NO_PROXY` continuam valendo como valem hoje com o axios (Decisão 5)                             | Must       |
| RF-17 | `engines.node` sobe de `>=22` para `>=22.21`, o primeiro 22.x com `proxyEnv` no `https.Agent` (Decisão 5)                                                                                                                    | Must       |

## Decisões de design

### Decisão 1: `node:https`, e não `fetch` nem manter o axios

- **Opções consideradas:** (A) manter o axios; (B) `fetch` nativo com o pacote `undici` para o `dispatcher` mTLS; (C) `fetch` com o dispatcher global pescado por `Symbol.for`; (D) `https.request` do Node.
- **Escolha:** D.
- **Justificativa:** B troca uma dependência por outra e acopla a versão do `undici` do npm à do Node. C depende de um detalhe interno. A mantém o custo descrito no Contexto. D zera a dependência, mantém o `https.Agent` e o comportamento de TLS sem nenhuma mudança, e o que se perde do axios (interceptors, redirect, adapters) não é usado aqui. O proxy, que o axios lê do ambiente sem ninguém pedir, é a exceção e tem decisão própria (Decisão 5). O preço é escrever umas 60 a 80 linhas de transporte, cobertas por servidor HTTPS local.

### Decisão 2: `requestOptions` restrito a `baseURL`, `timeout` e `headers`, com chave desconhecida lançando

- **Opções consideradas:** (A) aceitar qualquer chave e ignorar as que não se aplicam; (B) aceitar só as três e lançar nas demais; (C) manter `AxiosRequestConfig` e tentar traduzir as chaves mais comuns (`proxy`, `maxRedirects`, `auth`).
- **Escolha:** B.
- **Justificativa:** A esconde a quebra: hoje `requestOptions` vai inteiro para o `axios.create`, então `httpsAgent` substitui o agente da lib (e com ele o mTLS e a `CA_PADRAO`) e `proxy` desvia a requisição por um proxy. Quem passa uma dessas chaves acharia que ela continua valendo e mandaria a requisição por outro caminho sem saber. É a mesma lógica da invariante 1: configuração errada lança, de forma síncrona, no construtor. C reimplementa o axios aos pedaços. As três chaves cobrem o que faz sentido para esta lib: `timeout` é o uso real, `headers` já é documentado ([services-sefaz.md](../../arquitetura/camadas/services-sefaz.md)) e `baseURL` aponta a lib para outro host (servidor local nos testes, proxy reverso). Quem precisa de outra opção de TLS ou de socket já tem `httpsOptions`.

`proxy` e `httpsAgent` têm mensagem própria, que aponta o substituto: o proxy explícito vira `HTTPS_PROXY` ou `httpsOptions.proxyEnv` (Decisão 5), e o agente vira `httpsOptions`. Traduzir o objeto `proxy` do axios (`host`, `port`, `auth`, `protocol`) para `proxyEnv` foi descartado: é uma segunda forma de dizer a mesma coisa, com formato herdado de uma dependência que sai.

Mensagens, com o texto exato:

| Situação                                            | Mensagem                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `requestOptions` não é objeto (ou é array)          | `requestOptions deve ser um objeto.`                                                                     |
| Chave `proxy`                                       | `requestOptions.proxy não é suportado. Use a variável de ambiente HTTPS_PROXY ou httpsOptions.proxyEnv.` |
| Chave `httpsAgent`                                  | `requestOptions.httpsAgent não é suportado. Use httpsOptions.`                                           |
| Outra chave fora de `baseURL`, `timeout`, `headers` | `requestOptions.<chave> não é suportado. Use baseURL, timeout ou headers.`                               |
| `baseURL` não é string                              | `requestOptions.baseURL deve ser uma string.`                                                            |
| `timeout` não é número finito ≥ 0                   | `requestOptions.timeout deve ser um número maior ou igual a zero.`                                       |
| `headers` não é objeto (ou é array)                 | `requestOptions.headers deve ser um objeto.`                                                             |

Com várias chaves inválidas, vale a primeira na ordem de `Object.keys`. `requestOptions` ausente ou `{}` é válido. `getValues()` devolve `{ requestOptions }`, cópia rasa; o construtor continua congelando o que guarda em `this.config`.

### Decisão 3: URL por concatenação, como o axios

- **Opções consideradas:** (A) `new URL(url, baseURL)`; (B) concatenar `baseURL` sem a barra final com `url` sem a barra inicial, e só então `new URL(...)`.
- **Escolha:** B.
- **Justificativa:** os endpoints da NFS-e têm caminho na base (`https://adn.nfse.gov.br/contribuintes`, `https://sefin.nfse.gov.br/SefinNacional`) e os helpers passam `url` começando com `/`. Pela resolução de URL, `new URL('/DFe/1', 'https://adn.nfse.gov.br/contribuintes')` descarta o `/contribuintes`. O axios concatena, e é com isso que a NFS-e funciona hoje. Sem `url` (distribuição e recepção SOAP), a URL é a própria `baseURL`. `params` entra por `URLSearchParams`, o que dá `lote=true` e `lote=false` como o axios.

### Decisão 4: paridade de fio com o axios onde o servidor enxerga

- **Opções consideradas:** (A) requisição mínima (sem `Accept-Encoding`, timeout total por `AbortSignal`); (B) reproduzir o que o axios manda e como ele cronometra.
- **Escolha:** B.
- **Justificativa:** a SEFAZ, o ADN e a SEFIN foram validados contra o que o axios manda. Manter `Accept-Encoding` com descompactação, `Content-Length`, o mesmo `User-Agent` e o timeout por inatividade (`req.setTimeout`, que é o que o adapter http do axios usa) reduz a troca a uma mudança de implementação, sem efeito no servidor. `ECONNABORTED` e a mensagem `timeout of <ms>ms exceeded` são mantidos de propósito: o README documenta `ECONNABORTED` como o código de timeout, e quem trata esse código não quebra. Os demais códigos (`ECONNREFUSED`, `ENOTFOUND`, `ECONNRESET`, os de cadeia TLS) já vinham do Node, e continuam vindo. A única diferença de código: URL ou protocolo inválido deixa de ser `ERR_BAD_REQUEST` do axios e passa a ser o código do Node (`ERR_INVALID_URL`, `ERR_INVALID_PROTOCOL`), repassado sem tradução, como manda o ADR 0014.

### Decisão 5: proxy por variável de ambiente continua funcionando, com piso do Node em 22.21

- **Opções consideradas:** (A) ignorar proxy, como faz `https.request` puro; (B) ler `HTTPS_PROXY`/`NO_PROXY` na mão e abrir o túnel CONNECT no `SefazService`; (C) `proxyEnv: process.env` no default do `https.Agent`, com `engines >=22.21`; (D) C sem subir o `engines`.
- **Escolha:** C.
- **Justificativa:** o axios 1.21 lê `HTTPS_PROXY`/`https_proxy` e `NO_PROXY` sozinho (pelo `proxy-from-env`) e abre o túnel CONNECT com o `https-proxy-agent`, levando o `cert` e a `key` do nosso agente até a ponta. Quem roda atrás de proxy corporativo com a variável definida funciona hoje sem saber disso. Com A, essa pessoa passaria a tentar conexão direta, sem erro no construtor — a quebra silenciosa que a Decisão 2 existe para evitar. B reimplementa proxy e túnel, código que o Node já tem. O `https.Agent` aceita `proxyEnv` e faz o CONNECT nativamente; o `NODE_USE_ENV_PROXY` sozinho não alcança a lib, porque ele só configura os agentes globais e a lib cria o próprio. Com D, no Node 22 anterior à 22.21 a opção seria ignorada e o proxy deixaria de funcionar sem aviso; o piso no `engines` torna a exigência explícita (o npm avisa na instalação).
- `proxyEnv` entra no literal de default, **antes** de `httpsOptions`, então `httpsOptions.proxyEnv` manda: `{ HTTPS_PROXY: 'http://proxy:3128' }` fixa um proxy sem depender do ambiente, e `{}` desliga. O agente é criado a cada chamada ([services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), "O que não existe aqui"), então o `process.env` é lido a cada `enviar`, como o axios faz hoje.
- A confirmar na implementação, contra a documentação do Node: a versão exata em que `proxyEnv` chegou ao `https.Agent` na linha 22 (o adapter do axios usa 22.21 e 24.5) e que o túnel leva o `cert`/`key` do agente ao TLS de origem. Se a versão for outra, o `engines` acompanha e o desvio vai para as notas.
- Fica fora do escopo: com o piso em 22.21, o fallback para `tls.rootCertificates` em [src/env/ca.js](../../../src/env/ca.js) (Node 22 anterior à 22.15) vira código morto. Removê-lo é outra tarefa.

### Decisão 6: minor (0.24.0), com ADR próprio

- **Opções consideradas:** patch; minor; 1.0.0.
- **Escolha:** minor, no próximo release.
- **Justificativa:** `requestOptions` deixa de aceitar parte do que aceitava, e o piso do Node sobe de 22.0 para 22.21; as duas coisas são quebra. O [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) pede major para isso; na série 0.x o minor é o nível de quebra (`^0.23.0` não resolve para 0.24.0), o mesmo critério da 0.16.0 e da 0.19.0 ([GH-14](../concluidas/GH-14-tls-validado-e-erro-de-transporte-explicito.md), Decisão 5). A troca de cliente HTTP tem alternativa real e reversão custosa (voltar ao axios reabriria `requestOptions`), então vira **ADR 0018 — "Transporte em `node:https`, sem axios"**. O ADR 0014 não é editado: o princípio dele não muda, e o 0018 registra que o `ECONNABORTED` passa a ser produzido pela própria lib e que "objeto de erro do axios" no compromisso dele passa a ler-se "objeto de erro do transporte". Release segue [release.md](../../arquitetura/release.md), fora desta tarefa.

---

## Impacto por camada

### [services] (`src/services/`)

- `sefaz-service.js` reescrito sobre `https.request`. O construtor monta o `https.Agent` como hoje, com `proxyEnv: process.env` somado ao literal de default (`{ cert, key, ca, rejectUnauthorized: true, proxyEnv: process.env }`, depois `{ ...opts.httpsOptions }` por cima), e guarda `baseURL`, `timeout` (default `60000`) e os headers default (`requestOptions.headers` substitui o objeto inteiro, como hoje). `this.instance = (config) => Promise<{ status, data }>` faz a requisição e **rejeita** em erro de transporte; `request(config)` continua com o `try/catch` que separa resposta HTTP de falha e extrai só `code` e `message`.
- `https.request` pode lançar de forma síncrona (URL ou protocolo inválido): a chamada fica dentro da Promise, para cair no `catch` de `request`.
- O erro rejeitado pela `instance` tem que ser o erro do Node ou um `Error` próprio com `code` — nunca um objeto que carregue o agente ou as options. O `catch` continua sendo a barreira, mas não se monta erro com `options` dentro.
- Objeto vindo de `this.config` chega **congelado**: copiar antes de mesclar ([ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md)). Os headers da requisição são mesclados num objeto novo, com chave normalizada para minúsculas.
- O módulo continua sendo o único de `src/` exportado sem `Object.freeze`.

### [helpers / controllers] (`src/helpers/`)

- `distribuicaoNFSe-helper.js` e `manifestacaoNFSe-helper.js`: `responseType: 'text'` sai do `montarRequest` e do JSDoc de retorno. Os comentários que dizem "config do axios" e "para o axios mesclá-los" passam a falar do `SefazService`.
- Os testes de `montarRequest` em `test/distribuicaoNFSe-helper.test.js` (e o da manifestação, se compara a config inteira) deixam de esperar `responseType`.
- Retorno público não muda.

### [validators] (`src/validators/`)

- `RequestOptionsValidator` novo (`requestOptions-validator.js`), registrado em `src/validators/index.js`, exportado com `Object.freeze`. Recebe a config inteira (lê `config.options.requestOptions`) e devolve objeto em `getValues()`, como os demais validators de config.
- Mensagens: tabela da Decisão 2, texto exato.
- Normalização em `isValid()`: nenhuma além do default `{}` quando ausente.

### [apis] (`src/apis/`)

- Os seis construtores chamam o `RequestOptionsValidator` depois do último validator atual (tabela de ordem em [apis.md](../../arquitetura/camadas/apis.md) ganha a coluna).
- JSDoc de `config.options.requestOptions`: `{baseURL?: string, timeout?: number, headers?: Object<string, string>}`, com a descrição de cada campo e a observação de que `headers` substitui os defaults por inteiro. Se repetir o tipo seis vezes ficar ruim, um `@typedef` único importado pelos seis, desde que o `.d.ts` continue saindo só de `src/index.js`.
- JSDoc de `httpsOptions` nos seis construtores ganha uma frase sobre `proxyEnv` (default `process.env`; `{}` desliga).
- **A mudança quebra a API pública?** Sim: `requestOptions` com chave fora das três passa a lançar no construtor, o tipo público muda e o Node mínimo sobe para 22.21. Justificativa e versão na Decisão 6.

### [dependências]

- Pacote: `axios` `^1.21.0` → removido. Saem junto do lockfile as diretas dele (`follow-redirects`, `form-data`, `https-proxy-agent`, `proxy-from-env`) e as transitivas que só elas traziam — conferir com `npm ls` depois do `npm uninstall`.
- `package.json` **e** `package-lock.json` no mesmo commit ([ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md)).
- O guard de conteúdo do tarball em `publicar.yml` não deve mudar; confirmar com `npm pack --dry-run`.

---

## Testes

Todos em `test/transporte.test.js` (servidor HTTPS local, sem rede) salvo indicação:

- [ ] Os testes de transporte existentes passam **sem alteração**: cadeia fora do padrão, `ca` com `CA_PADRAO`, `rejectUnauthorized: false`, 502 real, `ECONNREFUSED`, `ECONNABORTED` com `timeout: 50`, retorno sem `PRIVATE KEY` nem `httpsAgent`, e os de `SefazService` que substituem `client.instance`
- [ ] URL: `baseURL` com caminho + `url` com barra inicial chega ao servidor como `/<caminho>/<url>`; `params` vira `?lote=true&cnpjConsulta=…`; sem `url`, o caminho é o da `baseURL`
- [ ] Headers: `User-Agent: bitmde/<VERSION>` presente numa requisição que manda `Accept`; `Content-Type` da requisição substitui o SOAP default, mesmo com caixa diferente; `requestOptions.headers` substitui os defaults
- [ ] Corpo: `POST` com XML acentuado chega byte a byte, com `Content-Length` correto
- [ ] Resposta `gzip`, `deflate` e `br` chega descompactada; `Content-Encoding: gzip` com corpo inválido vira `status: 0` com o `code` do `zlib`
- [ ] 3xx com `Location` volta com o status real, sem nova requisição ao servidor
- [ ] Resposta 4xx/5xx com corpo JSON volta como string (o helper da NFS-e faz o parse)
- [ ] `RequestOptionsValidator` (arquivo de teste de validators existente ou novo): cada mensagem da Decisão 2 com `assert.strictEqual`; ausente e `{}` válidos; as três chaves válidas
- [ ] Um construtor por classe (as seis) lança `requestOptions.transformResponse não é suportado. Use baseURL, timeout ou headers.`
- [ ] Proxy: com um proxy CONNECT local e um servidor HTTPS local que exige certificado de cliente (`requestCert: true`), `httpsOptions: { proxyEnv: { HTTPS_PROXY: <proxy> } }` passa pelo túnel e o servidor recebe o certificado do A1
- [ ] Proxy pelo ambiente: com `process.env.HTTPS_PROXY` apontando para o proxy local (restaurado no `finally`), a requisição passa pelo proxy sem nenhuma opção
- [ ] `NO_PROXY` com o host do servidor faz a requisição ir direto, sem passar pelo proxy
- [ ] `httpsOptions: { proxyEnv: {} }` ignora o `HTTPS_PROXY` do ambiente
- [ ] Proxy recusando a conexão vira `status: 0` com `transportError`, e o retorno serializado não contém `PRIVATE KEY`
- [ ] Imutabilidade do `RequestOptionsValidator`
- [ ] `test/tipos.test.js`: o `.d.ts` gerado não contém `axios`, e o consumidor TS com `requestOptions: { timeout: 1000 }` compila
- [ ] `npm ls axios` vazio
- [ ] `test/sefaz.test.js` rodado manualmente contra homologação (NF-e, CT-e, MDF-e e ADN) e o pedido rejeitado da SEFIN — obrigatório, a tarefa troca o transporte

## Checklist de implementação

- [ ] Código em `src/` (`services/`, `validators/`, `apis/`, helpers da NFS-e)
- [ ] Testes em `test/`
- [ ] JSDoc atualizado (`src/apis/` e helpers)
- [ ] `package.json`: `engines.node` de `>=22` para `>=22.21` (no mesmo commit do lockfile, se o `npm install` o reescrever)
- [ ] [README.md](../../../README.md): os quatro `requestOptions <AxiosRequestConfig>` viram o tipo novo com as três chaves; o parágrafo de `transportError.code` deixa de citar o axios; a seção "Conexão com a SEFAZ" ganha o proxy (`HTTPS_PROXY`, `NO_PROXY`, `httpsOptions.proxyEnv`); o requisito de Node passa a 22.21
- [ ] `CHANGELOG.md` em `[Não publicado]`: `### Removido` (axios), `### Modificado` (`requestOptions`, Node 22.21) e `### Compatibilidade` com a migração (chave que lança e o que usar no lugar: `httpsOptions` para agente e TLS, `HTTPS_PROXY` ou `httpsOptions.proxyEnv` para proxy; Node anterior à 22.21)
- [ ] Docs: [services-sefaz.md](../../arquitetura/camadas/services-sefaz.md) (seção "Instância axios", `proxyEnv` na tabela do agente e os códigos de erro), [apis.md](../../arquitetura/camadas/apis.md) (`requestOptions` validado), [validators.md](../../arquitetura/camadas/validators.md) (quinze validators, tabela), [controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md) (`montarRequest` sem `responseType`), [arquitetura/README.md](../../arquitetura/README.md) (diagrama e tabela), [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md) (linha do `transporte.test.js`) e `CLAUDE.md`
- [ ] ADR 0018 criado e registrado no [índice](../../arquitetura/decisoes/README.md)

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [ ] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [ ] `npm run test:ci` — tudo menos `test/sefaz.test.js`; é o que roda com o certificado descartável
- [ ] `test/sefaz.test.js` rodado à parte (`npx mocha test/sefaz.test.js --timeout 15000`) — exige certificado A1 válido e acesso à rede
- [ ] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [ ] `npm pack --dry-run` — conteúdo do tarball inalterado
- [ ] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/tarefas/especificadas/GH-38-substituir-axios-por-node-https.md .docs/tarefas/concluidas/GH-38-substituir-axios-por-node-https.md`
- [ ] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [ ] Issue fechada no GitHub

## Referências

- [Visão geral da arquitetura](../../arquitetura/README.md)
- [camadas/services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), [camadas/apis.md](../../arquitetura/camadas/apis.md), [camadas/validators.md](../../arquitetura/camadas/validators.md), [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md)
- [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md)
- [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) — compatibilidade da API pública
- [ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md) — dependência em dois arquivos
- [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) — configuração lança, rede retorna
- [ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md) — options congeladas
- [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md) — `transportError` e códigos sem tradução
- [ADR 0017](../../arquitetura/decisoes/0017-dependencias-de-runtime-em-faixa.md) — dependências de runtime
- [GH-14](../concluidas/GH-14-tls-validado-e-erro-de-transporte-explicito.md) e [GH-32](../concluidas/GH-32-dependencias-em-faixa-e-npm-audit.md)
- Node.js: [`https.request`](https://nodejs.org/api/https.html#httpsrequestoptions-callback), [`zlib`](https://nodejs.org/api/zlib.html)
- Issue: https://github.com/bitize/bitmde/issues/38

## Histórico de revisões

| Data       | Rev | Descrição                |
| ---------- | --- | ------------------------ |
| 2026-11-01 | 1.0 | Criação da especificação |
