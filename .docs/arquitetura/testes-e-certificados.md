# Testes e certificados

```sh
npm test                          # mocha sobre ./test — exige ./certs
npm run test:ci                   # tudo menos sefaz.test.js e tls-sefaz.test.js (o que a CI roda)
npm run certs:teste               # gera ./certs autoassinado descartável
npx mocha test/xml.test.js        # um arquivo
npx mocha --grep "Imutabilidade"  # filtra por nome do teste
```

Sempre rodar mocha **a partir da raiz do repositório**.

## O pré-requisito de `certs/`

Todo arquivo de teste que toca certificado faz `fs.readFileSync` **no topo do módulo**, com caminho relativo ao CWD. Isso significa que, sem o diretório `certs/`, o mocha aborta no carregamento — antes de rodar qualquer teste, **inclusive os que não dependem de certificado**.

`certs/` é gitignored e precisa conter:

| Arquivo           | Conteúdo                                     |
| ----------------- | -------------------------------------------- |
| `certificado.pfx` | O certificado A1                             |
| `passphrase.txt`  | A senha do `.pfx`, sem quebra de linha final |
| `cert.pem`        | O mesmo certificado, em PEM                  |
| `key.pem`         | A chave, em PEM                              |

Os `.pem` precisam ser do **mesmo** certificado do `.pfx`: [certificado.test.js](../../test/certificado.test.js) compara a conversão PFX→PEM feita pelo node-forge com os arquivos do disco, byte a byte.

### Sem `certs/`

Rodam isoladamente, porque não leem certificado:

```sh
npx mocha test/xml.test.js test/gzip.test.js test/zeroPad.test.js test/data.test.js test/distribuicaoDFe-helper.test.js test/ca.test.js test/transporte.test.js
```

`test/tls-sefaz.test.js` também não lê `certs/`, mas exige rede.

## O certificado descartável

Quem não tem um A1 em mãos roda:

```sh
npm run certs:teste
```

[scripts/gerar-certificado-teste.sh](../../scripts/gerar-certificado-teste.sh) gera um autoassinado válido por 10 anos e libera tudo menos `sefaz.test.js` — 97 dos 103 testes, dos quais os 5 de `tls-sefaz.test.js` exigem rede.

O script **aborta se `certs/` já existir**, para não sobrescrever um certificado real. Regerar exige apagar o diretório à mão.

### Dois detalhes load-bearing do script

Nenhum dos dois deve ser "simplificado":

1. **`-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES`.** O padrão do OpenSSL 3 para PKCS#12 é AES-256-CBC com PBKDF2, que o **node-forge não decifra**. Sem essas flags, todo teste que carrega o `.pfx` falha na leitura.
2. **Normalização para CRLF nos `.pem`.** O node-forge emite PEM com CRLF; o OpenSSL emite LF no Linux. Como `certificado.test.js` compara byte a byte, sem a normalização o teste falha por quebra de linha na CI.

Há ainda `MSYS_NO_PATHCONV=1`, que impede o Git Bash de converter o argumento de `-subj` em caminho do Windows. Inofensivo no Linux, necessário no Windows.

## Os arquivos de teste

| Arquivo                          | Cobre                                                                                           | Precisa de `certs/`  |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------- |
| `xml.test.js`                    | `jsonToXml`, `xmlToJson`, `envelopar`                                                           | Não                  |
| `gzip.test.js`                   | `Gzip.unzip`                                                                                    | Não                  |
| `zeroPad.test.js`                | `ZeroPad.padNsu`                                                                                | Não                  |
| `data.test.js`                   | `Data.toFormat` e os timezones                                                                  | Não                  |
| `distribuicaoDFe-helper.test.js` | `DistribuicaoHelper.montarResponse` sobre envelope montado no teste: lote misto, `docZipErrors` | Não                  |
| `ca.test.js`                     | `CA_PADRAO` e `CA_ICP_BRASIL`: exportação, congelamento, composição com as raízes do Node       | Não                  |
| `transporte.test.js`             | Validação TLS e `transportError` contra servidor HTTPS local em `127.0.0.1`; `RetornoHelper`    | Não                  |
| `certificado.test.js`            | `Certificado.p12ToPem` contra os `.pem` do disco                                                | **Sim**              |
| `distribuicao.test.js`           | `DistribuicaoDFe`: validação, montagem, imutabilidade                                           | **Sim**              |
| `recepcao.test.js`               | `RecepcaoEvento`: validação, lote, assinatura, imutabilidade                                    | **Sim**              |
| `sefaz.test.js`                  | Integração real contra a SEFAZ                                                                  | **Sim**, e A1 válido |
| `tls-sefaz.test.js`              | Handshake TLS real com `www1` e `hom1`, sem A1                                                  | Não, mas exige rede  |

### `sefaz.test.js`

Teste de integração de verdade: bate nos endpoints de **produção e homologação** da SEFAZ com mTLS, com a validação do servidor ligada e `ca: CA_PADRAO`. Falha sem rede, com certificado vencido ou com o certificado autoassinado do gerador — com ele, os dois casos "sem informar cert.pem e key.pem" passam (`403`) e os quatro que exigem A1 recebem `403` no lugar de `200`. Fica fora da CI, via `npm run test:ci`.

Rodar antes de um release é recomendável quando a mudança tocou transporte, certificado ou assinatura — é o único teste que prova que a ponta ainda funciona.

### `tls-sefaz.test.js`

Faz só o handshake TLS com `www1` e `hom1`, sem certificado A1 e sem `certs/`, com `rejectUnauthorized: true`. Afirma duas coisas por host:

- com `CA_PADRAO`, o handshake fecha;
- só com `CA_ICP_BRASIL`, falha com `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

O segundo caso falha de propósito se o Ambiente Nacional voltar a uma cadeia ICP-Brasil, para alguém rever a decisão do [ADR 0014](decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md). Exige rede, então fica fora do `test:ci` e roda no workflow agendado abaixo.

### `transporte.test.js`

Sobe um servidor HTTPS em `127.0.0.1` com certificado gerado na hora (chave pelo `crypto`, certificado pelo node-forge) e chama a API pública apontando `requestOptions.baseURL` para ele. Cobre o padrão recusando o autoassinado, os dois opt-outs de `httpsOptions`, porta fechada, timeout, um `502` real e a ausência de chave privada e de `httpsAgent` no retorno serializado. Não lê `certs/` e não sai da máquina.

## O que os testes garantem além do comportamento

Duas famílias de teste existem para travar invariantes de arquitetura, e é comum quebrá-las sem perceber:

- **Mensagens de erro literais** — `assert.strictEqual(err.message, 'NSU não informado.')`. Mudou o texto, quebrou. Ver [camadas/validators.md](camadas/validators.md).
- **Imutabilidade** — `assert.throws` ao tentar sobrescrever método estático ou propriedade de instância congelada. Removeu um `Object.freeze`, quebrou. Ver [ADR 0005](decisoes/0005-object-freeze-pervasivo.md).

## Na CI

[.github/workflows/testes.yml](../../.github/workflows/testes.yml), matriz Node 22/24 — o mínimo declarado em `engines` (`>=22`):

```text
npm ci  →  npm run certs:teste  →  npm run test:ci
```

Em paralelo, [.github/workflows/qualidade.yml](../../.github/workflows/qualidade.yml) roda dois jobs em Node 22: `npm run format:check` (Prettier) e `npm run build`.

Fora de push e PR, [.github/workflows/cadeia-tls.yml](../../.github/workflows/cadeia-tls.yml) roda toda segunda-feira às 09:00 UTC, e também sob demanda (`workflow_dispatch`), em Node 24: `npm ci` → `npx mocha test/tls-sefaz.test.js`. É ele que avisa da próxima troca de cadeia do Ambiente Nacional antes que ela chegue a quem consome. O aviso de falha é o e-mail padrão do GitHub para workflow agendado; abrir issue automaticamente exigiria `issues: write` e ficou de fora. O GitHub desativa workflow agendado depois de 60 dias sem atividade no repositório — se o aviso sumir, conferir se ele ainda está ativo.

Os dois usam `npm ci` com `cache: npm`, o que exige o `package-lock.json` versionado — ver [ADR 0003](decisoes/0003-lockfile-versionado.md). Nenhum job escreve no repositório: todos declaram `permissions: contents: read` e `persist-credentials: false` no checkout.
