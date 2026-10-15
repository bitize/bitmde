# GH-18: Distribuição de NFS-e Nacional pelo ADN

| Campo                | Valor                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Issue**            | [GH-18](https://github.com/bitize/bitmde/issues/18)                                    |
| **Status**           | especificadas                                                                          |
| **Plano**            | [GH-17](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md) |
| **Prioridade**       | P2 (médio)                                                                             |
| **Tipo**             | feature                                                                                |
| **Camadas afetadas** | apis / validators / controllers / helpers / services / env / util / test               |
| **Criado em**        | 2026-10-15                                                                             |
| **Atualizado em**    | 2026-10-15                                                                             |
| **Concluído em**     | —                                                                                      |

---

## Contexto e motivação

Primeira filha do plano [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md). Entrega o lado de leitura: o equivalente, para serviço, do que a `DistribuicaoDFe` faz para NF-e.

O ADN expõe a distribuição para contribuintes em REST/JSON com mTLS. Contrato e comportamento — inclusive o observado numa drenagem completa em produção — estão em [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md). O essencial para esta tarefa:

- `GET /DFe/{NSU}?lote=true&cnpjConsulta=…` devolve até 50 documentos **depois** do NSU informado — a semântica do `ultNSU` da NF-e. Começa em `0`; o próximo pedido usa o último NSU recebido.
- Fila vazia é **HTTP 404** com `StatusProcessamento: NENHUM_DOCUMENTO_LOCALIZADO` e `E2220` — não é erro.
- Não há bloqueio de sequência (voltar a um NSU anterior funciona) nem limite de cadência observado.
- A fila mistura NFS-e em que o CNPJ é tomador, NFS-e que ele emitiu e eventos de terceiros sobre umas e outras. NFS-e de leiaute `1.00` e `1.01`, geradas pela SEFIN (`ambGer` 2) e por sistema próprio de município (`ambGer` 1).
- `GET /NFSe/{ChaveAcesso}/Eventos` devolve a própria NFS-e e os eventos dela.
- `ArquivoXml` é gzip + base64 em todos os itens.

Esta filha também escreve os **ADRs 0015 e 0016** (Decisões 1 e 2 do plano) e cria o que a filha de manifestação reaproveita: `RetornoNfseHelper`, transporte REST/JSON, `ChaveNfseValidator`, `CnpjValidator` e `src/env/nfse.js`.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [x] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — sem schema novo: esta tarefa só **lê** XML, pelo `Xml.xmlToJson` existente
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, erro de transporte
- [x] [env](../../arquitetura/camadas/env.md) — endpoints, `CA_PADRAO`, `VERSION`
- [x] Fluxo: [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md)
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md) — sem impacto além do bump de minor
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                                                                                 | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | Classe pública `DistribuicaoNFSe`, exportada nas três formas por `src/index.js`, com config `pfx`/`passphrase` ou `cert`/`key`, `cnpj`, `tpAmb` e `options`                                                               | Must       |
| RF-02 | `consultaUltNSU(ultNSU)` → `GET /DFe/{ultNSU}?lote=true&cnpjConsulta={cnpj}`: até 50 documentos depois do NSU                                                                                                             | Must       |
| RF-03 | `consultaNSU(nsu)` → `GET /DFe/{nsu - 1}?lote=false&cnpjConsulta={cnpj}`: o documento daquele NSU. O ADN devolve o documento **seguinte** ao NSU do caminho também com `lote=false` (revisto na implementação, ver Notas) | Must       |
| RF-04 | `consultaChNFSe(chNFSe)` → `GET /NFSe/{chNFSe}/Eventos`: a NFS-e e os eventos dela                                                                                                                                        | Must       |
| RF-05 | Retorno `{ data, resBody, status, error?, transportError? }` da Decisão 2 do plano, montado por um `RetornoNfseHelper` novo                                                                                               | Must       |
| RF-06 | Fila vazia (HTTP 404 + `NENHUM_DOCUMENTO_LOCALIZADO`) devolvida com `documentos: []` e **sem** `error`                                                                                                                    | Must       |
| RF-07 | Cada `ArquivoXml` devolvido como `xml` e `json`; falha de um item vai para `documentosErros`, sem esvaziar `data` ([ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md))             | Must       |
| RF-08 | Cada documento `NFSE` traz `papel` do CNPJ consultado: `'tomador'`, `'prestador'`, `'intermediario'` ou `''`. A biblioteca marca, não filtra                                                                              | Must       |
| RF-09 | `DistribuicaoDFe` e `RecepcaoEvento` inalteradas em assinatura e comportamento; `RetornoHelper` da NF-e intocado                                                                                                          | Must       |
| RF-10 | Endpoints de produção e produção restrita em `src/env/nfse.js`, indexados por `tpAmb`                                                                                                                                     | Must       |
| RF-11 | `test/tls-sefaz.test.js` cobre `adn.nfse.gov.br` e `adn.producaorestrita.nfse.gov.br`                                                                                                                                     | Must       |
| RF-12 | ADR 0015 (NFS-e no bitmde) e ADR 0016 (retorno próprio da NFS-e)                                                                                                                                                          | Must       |
| RF-13 | `README.md`, `CHANGELOG.md`, `CLAUDE.md` e `.docs/arquitetura/` atualizados, incluindo a ressalva de cobertura do ADN                                                                                                     | Must       |

## Decisões de design

As decisões que valem também para a filha 2 estão no plano (Decisões 1 a 5). As daqui:

### Decisão 1: nomes de método espelhando a `DistribuicaoDFe`

- **Opções consideradas:** (A) nomes do ADN (`distribuir`, `consultarDfe`, `consultarEventos`); (B) os mesmos da NF-e: `consultaUltNSU`, `consultaNSU`, `consultaChNFSe`.
- **Escolha:** B.
- **Justificativa:** a drenagem mostrou que a semântica é a mesma — `GET /DFe/{n}?lote=true` devolve o que vem **depois** de `n`, como o `ultNSU`. Quem já consome a `DistribuicaoDFe` reconhece o padrão, e o loop de drenagem do consumidor fica igual. `consultaChNFSe` devolve a nota e os eventos, como a consulta por chave da NF-e devolve o `procNFe`.

### Decisão 2: NSU sem zero-pad

- **Opções consideradas:** (A) reaproveitar o `NsuValidator` (zero-pad para 15); (B) validator próprio que normaliza para inteiro sem zeros à esquerda.
- **Escolha:** B, `NsuNfseValidator`.
- **Justificativa:** no ADN o NSU é `int64` no path e volta como número no JSON; zero-pad é convenção do leiaute XML da NF-e. As mensagens de ausência e tamanho repetem o texto do `NsuValidator` — o significado é o mesmo — e a de formato é nova.

### Decisão 3: `papel` com precedência, calculado contra `config.cnpj`

- **Escolha:** para item `NFSE`, ler `NFSe/infNFSe/DPS/infDPS` e comparar `config.cnpj` com `toma/CNPJ`, `prest/CNPJ` e `interm/CNPJ`, **nessa ordem**; o primeiro que bater define o `papel`. Nenhum → `''`. Item `EVENTO` → `''` (o evento não traz as partes da nota).
- **Justificativa:** o uso principal é separar as recebidas; tomador primeiro resolve o caso raro de o CNPJ ser duas partes da mesma nota. Comparação pelo CNPJ inteiro, não pela raiz: `config.cnpj` é exatamente o CNPJ consultado. É a única leitura de campo de negócio que a biblioteca faz; o resto do XML segue cru.

### Decisão 4: o que vira `error`

| Situação                                                | `status` | `data`                       | `error`                                               |
| ------------------------------------------------------- | -------- | ---------------------------- | ----------------------------------------------------- |
| `DOCUMENTOS_LOCALIZADOS`, 2xx e sem `Erros`             | 200      | preenchido                   | —                                                     |
| `NENHUM_DOCUMENTO_LOCALIZADO`, com qualquer status      | 404      | preenchido, `documentos: []` | —                                                     |
| HTTP fora de 2xx, `REJEICAO` ou `Erros` não vazio       | real     | preenchido (com `erros`)     | `<codigo>: <descricao>` de cada erro, unidos por `; ` |
| O mesmo, sem nenhum item em `Erros`                     | real     | preenchido                   | `Resposta inesperada do ADN (HTTP <status>).`         |
| Corpo que não é JSON, ou JSON sem `StatusProcessamento` | real     | `{}`                         | `Resposta inesperada do ADN (HTTP <status>).`         |
| Sem resposta HTTP                                       | 0        | `{}`                         | `Falha de transporte (<code>): <message>`             |

> Revista na implementação: a rejeição `E2243` (`cnpjConsulta` de outra raiz) vem com HTTP 400 e `StatusProcessamento: DOCUMENTOS_LOCALIZADOS`, então o `StatusProcessamento` sozinho não decide. Ver Notas.

Na rejeição, `data` **não** é esvaziado: `erros` e `tipoAmbiente` são o diagnóstico. É diferente da NF-e de propósito — lá a rejeição vem dentro de um `retDistDFeInt` que o consumidor lê por `cStat`; aqui o status já diz que falhou, e esconder `erros` só tiraria informação.

### Questões em aberto — confirmar na implementação

| #   | Questão                                                                                         | Resposta (2026-10-15)                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `lote=false` devolve exatamente o NSU informado (inclusive), num `LoteDFe` de um item?          | **Não.** Devolve um item, mas o **seguinte**: `/DFe/0` → NSU 1, `/DFe/5` → NSU 6. `consultaNSU` passou a pedir `nsu - 1` (RF-03)                                                                                         |
| 2   | `cnpjConsulta` igual ao CNPJ do certificado é aceito sem efeito colateral?                      | Sim, mesmo resultado de omitir o parâmetro                                                                                                                                                                               |
| 3   | Status e `Codigo` de `REJEICAO` — `cnpjConsulta` de outra raiz, NSU negativo, chave inexistente | Outra raiz: HTTP 400, `E2243`, com `StatusProcessamento` **`DOCUMENTOS_LOCALIZADOS`**. NSU `-1`: 404 `E2220`. Chave inexistente: 404 `E2240`. NSU inexistente com `lote=false`: 404 `E2230`. Nenhum veio como `REJEICAO` |

---

## Impacto por camada

### [apis] (`src/apis/`)

- Arquivo novo: `distribuicaoNFSe-api.js`. Validators no construtor, nesta ordem: **Certificado → Ambiente → Cnpj**. `this.config` e `this` congelados, `requestOptions` e `httpsOptions` congelados dentro dela, como na `DistribuicaoDFe`.
- Assinaturas:
  - `new DistribuicaoNFSe({ pfx, passphrase } | { cert, key }, cnpj, tpAmb, options })`
  - `consultaUltNSU(ultNSU: string | number)`
  - `consultaNSU(nsu: string | number)`
  - `consultaChNFSe(chNFSe: string)`
- JSDoc completo (vira o `dist/index.d.ts`), com o texto de `httpsOptions` copiado da `DistribuicaoDFe`. Registrar em [src/index.js](../../../src/index.js) nas três formas.
- **Mudança quebra a API pública?** Não. Estritamente aditiva.

### [validators] (`src/validators/`)

Três validators novos, registrados em ordem alfabética em [src/validators/index.js](../../../src/validators/index.js):

| Validator            | Entrada | Valida                                                                                               | Normaliza em `isValid()`                    | `getValues()` |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------- |
| `CnpjValidator`      | config  | `cnpj` presente, 14 caracteres, `[0-9A-Z]{12}[0-9]{2}`                                               | `String(...)`, maiúsculas                   | `{ cnpj }`    |
| `NsuNfseValidator`   | escalar | presente, só dígitos, até 15 dígitos; com `{ positivo: true }` (só na `consultaNSU`), maior que zero | sem zeros à esquerda (`'0'` continua `'0'`) | string        |
| `ChaveNfseValidator` | escalar | presente, exatamente 50 dígitos                                                                      | `String(...)`                               | string        |

O CNPJ aceita o formato alfanumérico, que a IN RFB nº 2.229/2024 introduz a partir de julho/2026, embora o XSD 1.01 da NFS-e ainda só aceite numérico. Quem rejeita, se for o caso, é o serviço (Decisão 4 do plano).

Mensagens (texto exato — comparadas literalmente nos testes):

| Situação                       | Mensagem                                | Validator            |
| ------------------------------ | --------------------------------------- | -------------------- |
| CNPJ ausente                   | `CNPJ não informado.`                   | `CnpjValidator`      |
| CNPJ fora do formato           | `CNPJ com formato inválido.`            | `CnpjValidator`      |
| NSU ausente                    | `NSU não informado.`                    | `NsuNfseValidator`   |
| NSU com mais de 15 dígitos     | `NSU com tamanho incorreto.`            | `NsuNfseValidator`   |
| NSU com caractere não numérico | `NSU deve conter apenas números.`       | `NsuNfseValidator`   |
| NSU `0` na `consultaNSU`       | `NSU deve ser maior que zero.`          | `NsuNfseValidator`   |
| Chave ausente                  | `Chave da NFS-e não informada.`         | `ChaveNfseValidator` |
| Chave diferente de 50 dígitos  | `Chave da NFS-e com tamanho incorreto.` | `ChaveNfseValidator` |

`'NSU não informado.'` e `'NSU com tamanho incorreto.'` repetem o texto do `NsuValidator` de propósito. Acrescentar as mensagens novas ao catálogo de [validators.md](../../arquitetura/camadas/validators.md).

### [helpers / controllers] (`src/helpers/`, `src/controllers/`)

- `distribuicaoNFSe-controller.js`: `static async enviar(opts)` com a mesma sequência fixa — `montarRequest` → `SefazService.request` → `montarResponse` → `RetornoNfseHelper.montarRetorno`. JSDoc com o shape completo do retorno.
- `distribuicaoNFSe-helper.js`:
  - `montarRequest(opts)` devolve a config do axios: `method: 'GET'`, `url` (`/DFe/{nsu}` ou `/NFSe/{chave}/Eventos`), `params` (`lote`, `cnpjConsulta`), `headers: { Accept: 'application/json' }`, `responseType: 'text'`.
  - `montarResponse(corpo)` é **assíncrono** (gunzip) e **nunca lança**: `JSON.parse` em `try/catch`; leitura defensiva com default em cada nível, como no helper da NF-e.
  - `abrirArquivoXml(item)` no molde do `abrirDocZip` — nunca rejeita. Falhas, com o texto exato:

    | Etapa                  | `error`                                                         |
    | ---------------------- | --------------------------------------------------------------- |
    | `ArquivoXml` vazio     | `ArquivoXml sem conteúdo.`                                      |
    | `Gzip.unzip` rejeitou  | `Falha ao descompactar o ArquivoXml: <mensagem original>`       |
    | `Xml.xmlToJson` lançou | `Falha ao interpretar o XML do ArquivoXml: <mensagem original>` |

- `retornoNfse-helper.js` — `RetornoNfseHelper.montarRetorno({ json, retorno })` com as regras da Decisão 4. A ordem das condições segue a do `RetornoHelper`: transporte primeiro (com `status: 0` nada mais casa).
- Forma de `data`, com todo escalar em `|| ''`:

  ```js
  {
    statusProcessamento, tipoAmbiente, versaoAplicativo, dataHoraProcessamento,
    alertas: [{ codigo, descricao, complemento }],
    erros: [{ codigo, descricao, complemento }],
    documentos: [{ nsu, chaveAcesso, tipoDocumento, tipoEvento, dataHoraGeracao, papel, xml, json }],
    documentosErros: [{ nsu, chaveAcesso, tipoDocumento, error }],
  }
  ```

  `nsu` sai como **string** (o JSON traz número; a invariante do pacote é escalar como string, ver [schemas-xml.md](../../arquitetura/camadas/schemas-xml.md)). `tipoEvento` ausente vira `''`.

### [services] (`src/services/`)

- Sem mudança de código. O helper passa `method`, `url`, `params`, `headers` e `responseType` em `request(config)`; o axios mescla `headers` da requisição com os da instância, então `Accept` entra sem tirar o `User-Agent`. O `Content-Type: application/soap+xml` do default vai junto num `GET` sem corpo e é inofensivo — confirmar na implementação; se o ADN reclamar, o helper o sobrescreve na requisição.
- Lembrar: `requestOptions` e `httpsOptions` chegam congelados ([ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md)).

### [env] (`src/env/`)

- Arquivo novo `nfse.js`, sem `'use strict'` e sem `Object.freeze`, como os demais:

  | Constante  | `'1'` (produção)                        | `'2'` (produção restrita)                                |
  | ---------- | --------------------------------------- | -------------------------------------------------------- |
  | `NFSE_ADN` | `https://adn.nfse.gov.br/contribuintes` | `https://adn.producaorestrita.nfse.gov.br/contribuintes` |

- Registrar em [src/env/index.js](../../../src/env/index.js) em ordem alfabética e na tabela de [env.md](../../arquitetura/camadas/env.md). A filha 2 acrescenta `NFSE_SEFIN` no mesmo arquivo.

### [util] (`src/util/`)

- Nenhum utilitário novo: `Gzip.unzip` e `Xml.xmlToJson` servem como estão.

---

## Testes

- [x] `test/distribuicaoNFSe.test.js`: construtor sem cert, sem key, sem `tpAmb`, `tpAmb` inválido, sem `cnpj`, `cnpj` em formato inválido — cada mensagem com `assert.strictEqual`
- [x] Validators: cada mensagem nova da tabela acima; normalização do NSU (`'00051'` → `'51'`, `0` → `'0'`, `51` número → `'51'`) e do CNPJ
- [x] Imutabilidade: instância, `config`, `requestOptions` e `httpsOptions` congelados; `assert.throws` ao sobrescrever método estático dos módulos novos
- [x] Helper com **fixtures sintéticas** (gzip + base64 de XML inventado, nada de produção): lote com NFS-e de tomador, de prestador e de intermediário (`papel`), evento (`papel: ''`, `tipoEvento` preenchido), item `NFSE` sem `TipoEvento` (vira `''`), `ArquivoXml` vazio, base64 que não é gzip e XML inválido (cada um em `documentosErros`, sem esvaziar o lote)
- [x] `RetornoNfseHelper`: as linhas da Decisão 4, incluindo 404 de fila vazia **sem** `error`, corpo HTML num 502 e o HTTP 400 com `DOCUMENTOS_LOCALIZADOS` + `Erros`
- [x] Transporte com servidor HTTPS local, no molde de [test/transporte.test.js](../../../test/transporte.test.js): `GET` com `Accept: application/json`, `User-Agent` preservado, `params` na query, `resBody` igual ao corpo servido byte a byte, e o retorno serializado sem `PRIVATE KEY` nem `httpsAgent`
- [x] `test/tls-sefaz.test.js` com os dois hosts do ADN — ambos fecham por `CA_PADRAO` (Let's Encrypt, ISRG Root X1) e **não** pela ICP-Brasil sozinha, como os hosts atuais
- [x] `test/sefaz.test.js` estendido com `consultaUltNSU('0')` em produção restrita (404 sem `error`) e em produção (`DOCUMENTOS_LOCALIZADOS`), só leitura — rodado manualmente: a tarefa toca transporte. Mais dois casos: `consultaNSU('1')` em produção e `cnpj` de outra raiz em produção restrita (`E2243`)

## Checklist de implementação

- [x] Código em `src/` (apis, validators, controllers, helpers, env)
- [x] Testes em `test/`
- [x] JSDoc da `DistribuicaoNFSe` e do controller
- [x] [README.md](../../../README.md): seção nova da NFS-e no formato das existentes, exemplo de drenagem (`ultNSU` começando em `'0'`, 404 como fim da fila), filtro por `papel`, ressalva de cobertura do ADN, e a lista de **Funcionalidades**
- [x] `CHANGELOG.md` em `[Não publicado]`
- [x] `CLAUDE.md`: "O que é" passa a citar a distribuição do ADN; `src/index.js` exporta `DistribuicaoNFSe`
- [x] `.docs/arquitetura/`: [README](../../arquitetura/README.md) (invariante 1 cita os dois retornos), [apis](../../arquitetura/camadas/apis.md), [validators](../../arquitetura/camadas/validators.md), [controllers-helpers](../../arquitetura/camadas/controllers-helpers.md), [env](../../arquitetura/camadas/env.md), [testes-e-certificados](../../arquitetura/testes-e-certificados.md) e fluxo novo `fluxos/distribuicao-nfse.md`
- [x] ADR 0015 e ADR 0016, com as linhas na tabela de [decisoes/README.md](../../arquitetura/decisoes/README.md)
- [ ] Versão: bump de **minor** no release que fechar o plano

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [x] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real) — não se aplica: `certs/` já tem um A1 real, e o script não foi rodado
- [x] `npm run test:ci` — tudo menos `test/sefaz.test.js` e `test/tls-sefaz.test.js` — 152 passando (eram 92). Rodado junto com build e `npm pack`, estourou timeout de 2 s nos testes de construtor com PFX (ver Notas); sozinho, passou inteiro
- [x] `test/sefaz.test.js` e `test/tls-sefaz.test.js` rodados à parte — exigem rede, e o primeiro, certificado A1 válido — 19 passando com o A1 real (10 + 9)
- [x] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [x] Conferir no `dist/index.d.ts` que `DistribuicaoNFSe` aparece com os três métodos e o tipo de retorno
- [x] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

**Desvios aprovados pelo usuário** (2026-10-15, depois de responder as questões em aberto com chamadas de leitura em produção e produção restrita):

- **RF-03 — `consultaNSU` pede `nsu - 1`.** Com `lote=false` o ADN devolve o documento seguinte ao NSU do caminho, e não o próprio. Para o método fazer o que o nome diz, como o `consNSU` da NF-e, o helper pede `/DFe/{nsu - 1}?lote=false` (conta com `BigInt`). Consequência: mensagem nova `NSU deve ser maior que zero.` para `consultaNSU('0')`, pela opção `{ positivo: true }` do `NsuNfseValidator`. Alternativas descartadas: repassar o NSU e documentar que vem o seguinte; tirar o método.
- **Decisão 4 — o `error` não sai só do `StatusProcessamento`.** O `E2243` vem com HTTP 400 e `StatusProcessamento: DOCUMENTOS_LOCALIZADOS`, e a regra escrita o daria como sucesso com lote vazio. Regra entregue: `NENHUM_DOCUMENTO_LOCALIZADO` nunca é erro; fora isso, há `error` quando o HTTP sai de 2xx, quando vem `REJEICAO` ou quando `Erros` não está vazio. Sem itens em `Erros`, o texto é `Resposta inesperada do ADN (HTTP <status>).`, com `data` mantido. Registrado na [ADR 0016](../../arquitetura/decisoes/0016-retorno-proprio-da-nfse.md).

**Decisões de implementação** (a especificação não fixava):

- `montarResponse(corpo, cnpj)` recebe o CNPJ para o `papel` e devolve `null` quando o corpo não é resposta do ADN; o `RetornoNfseHelper` transforma o `null` em `Resposta inesperada do ADN (HTTP <status>).`. O helper ganhou `enviarConsulta(config, opts)`, como o da NF-e, e `calcularPapel`.
- `consultaChNFSe` não manda `params`: o Swagger não declara `cnpjConsulta` nesse caminho.
- `ChaveNfseValidator` exige só dígitos, além dos 50 caracteres, porque a chave vai no caminho da URL. Chave com letra cai em `Chave da NFS-e com tamanho incorreto.`.
- `NsuNfseValidator` testa só dígitos antes do tamanho, e trata `0` número como informado (o `NsuValidator` usa `!this.nsu`).
- Os tipos dos arrays do retorno saem como `Array<…>` no JSDoc do controller. O idioma do controller da NF-e (`docZip:[{…}]`) vira tupla de um elemento no `.d.ts`; não foi mexido lá, fora do escopo.
- `package.json`: `description` e `keywords` passam a citar a NFS-e, como a ADR 0015 promete. Não afeta o lockfile.
- `test/sefaz.test.js` tira o CNPJ do CN do certificado, em vez de tê-lo escrito no teste.
- `.docs/conhecimento/nfse-nacional-adn-distribuicao.md` recebeu os achados das questões em aberto e perdeu uma linha duplicada.

**Afeta a GH-19:** a mensagem `Resposta inesperada do ADN (HTTP <status>).` está no `RetornoNfseHelper`, que a manifestação reaproveita. A SEFIN precisa de outro nome de serviço na mensagem e de normalizar seu `erro` único para `erros`; ver a ADR 0016. Sobe para o plano no Passo 4.

**Testes:** `test:ci` de 92 para 152 passando; suíte inteira, com `sefaz.test.js` e `tls-sefaz.test.js`, 171 passando com o A1 real.

**Intermitência anterior a esta tarefa:** com o A1 real em `certs/`, `Certificado.p12ToPem` leva de 1,7 s a 2,2 s, perto do timeout padrão de 2 s do mocha, e testes de construtor com PFX de `distribuicao.test.js` e `recepcao.test.js` estouram em algumas rodadas (já na linha de base, antes de qualquer mudança). Com `--timeout 15000` passam todos. Na CI, com o certificado descartável em 3DES, não acontece. Não corrigido aqui; anotado no `CLAUDE.md`.

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [ ] Arquivo movido para `.docs/tarefas/concluidas/`
- [ ] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [ ] Issue fechada no GitHub e no Linear
- [ ] Link e status desta tarefa atualizados na tabela de filhas do plano

## Referências

- Plano: [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md)
- [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md) — contrato e comportamento observado em produção
- Originais: [Swagger ADN Contribuinte](../../conhecimento/fontes/nfse-nacional/swagger-adn-contribuintes-v1-20261015.json), [Manual dos Contribuintes — APIs do ADN v1.0](../../conhecimento/fontes/nfse-nacional/manual-contribuintes-apis-adn-v1.0-20260212.pdf), [XSDs v1.01](../../conhecimento/fontes/nfse-nacional/nfse-esquemas-xsd-v1.01-20260209.zip)
- [camadas/apis.md](../../arquitetura/camadas/apis.md), [camadas/validators.md](../../arquitetura/camadas/validators.md), [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md), [camadas/services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), [camadas/env.md](../../arquitetura/camadas/env.md), [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md)
- [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md), [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md), [ADR 0006](../../arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md), [ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)
- Implementações de terceiros (ler como fonte de armadilha, não como modelo): [omartelo/nfse4j#4](https://github.com/omartelo/nfse4j/pull/4), [t3wv/nfse#50](https://github.com/t3wv/nfse/issues/50)
- Issue: https://github.com/bitize/bitmde/issues/18
- Linear: [DEV-1099](https://linear.app/bitize/issue/DEV-1099)

## Histórico de revisões

| Data       | Rev | Descrição                                                                                                                  |
| ---------- | --- | -------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-15 | 0.1 | Rascunho criado como filha 1 do plano NFS-e                                                                                |
| 2026-10-15 | 1.0 | Especificada com o Swagger, a drenagem em produção e as decisões do plano: retorno próprio, papel por item, CNPJ da config |
| 2026-10-15 | 1.1 | Promovida a `especificadas` com a issue GH-18, filha do plano GH-17                                                        |
| 2026-10-15 | 1.2 | Implementação e notas: RF-03 e Decisão 4 revistas com as respostas das questões em aberto, aprovadas pelo usuário          |
