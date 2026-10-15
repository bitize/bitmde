# GH-19: Manifestação do tomador da NFS-e Nacional

| Campo                | Valor                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| **Issue**            | [GH-19](https://github.com/bitize/bitmde/issues/19)                                    |
| **Status**           | especificadas                                                                          |
| **Plano**            | [GH-17](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md) |
| **Prioridade**       | P2 (médio)                                                                             |
| **Tipo**             | feature                                                                                |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / env / util / test                |
| **Criado em**        | 2026-10-15                                                                             |
| **Atualizado em**    | 2026-10-15                                                                             |
| **Concluído em**     | —                                                                                      |

---

## Contexto e motivação

Segunda filha do plano [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md). Entrega o lado de escrita: o equivalente, para serviço, do que a `RecepcaoEvento` faz para NF-e.

O tomador manifesta-se sobre uma NFS-e com dois eventos, enviados à **SEFIN Nacional** — mesmo quando a nota foi gerada por sistema próprio de município, segundo o Anexo II (`E1818`: o município não pode compartilhar manifestação; `E1831`: a nota precisa existir no ADN). O contrato está em [conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md):

- `POST /SefinNacional/nfse/{chaveAcesso}/eventos` com `{ "pedidoRegistroEventoXmlGZipB64": "…" }`; sucesso `201` com `eventoXmlGZipB64`; erro `400`/`401` com um objeto `erro` único, em camelCase.
- `pedRegEvento` versão `1.01`, `infPedReg Id="PRE{chave 50}{código 6}"`, e o grupo `e203202` (só `xDesc`) ou `e203206` (`xDesc`, `cMotivo`, `xMotivo` opcional — obrigatório com `cMotivo` 9, `E1949`).
- **Pela API, o pedido vai assinado** (`E1989`), com o certificado do autor (`E1991`), e `CNPJAutor` na raiz do certificado (`E0812`). Eventos reais aceitos pela SEFIN mostram pedidos assinados com **RSA-SHA1, digest SHA1 e C14N** — a configuração que o `Assinatura.assinarXml` já usa — e também com SHA-256.

Depende da [GH-18](GH-18-distribuicao-nfse-nacional-adn.md), que cria o retorno próprio da NFS-e (`RetornoNfseHelper`), o transporte REST/JSON, o `ChaveNfseValidator`, o `CnpjValidator` e `src/env/nfse.js`.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [x] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — ordem das chaves, opções do builder: **ler antes de implementar**
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, erro de transporte
- [x] [env](../../arquitetura/camadas/env.md) — endpoints, `ZONES`, `VERSION`
- [ ] Fluxo: [recepção](../../arquitetura/fluxos/recepcao-evento.md) e [ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md) — **ler antes de implementar**: a assinatura da NF-e não pode mudar um byte
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md) — sem impacto além do bump de minor
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                           | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | Classe pública `ManifestacaoNFSe`, exportada nas três formas, com config `pfx`/`passphrase` ou `cert`/`key`, `cnpj`, `tpAmb`, `timezone` e `options`                | Must       |
| RF-02 | `confirmar(chNFSe)` registra a Confirmação do tomador (`e203202`)                                                                                                   | Must       |
| RF-03 | `rejeitar(chNFSe, { cMotivo, xMotivo })` registra a Rejeição do tomador (`e203206`)                                                                                 | Must       |
| RF-04 | `infPedReg` assinado com o A1 da config, assinatura enveloped inserida depois do `infPedReg`                                                                        | Must       |
| RF-05 | Retorno `{ data, reqXml, resBody, status, error?, transportError? }` pelo `RetornoNfseHelper` da filha 1; `reqXml` é o `pedRegEvento` assinado, antes do gzip       | Must       |
| RF-06 | `data.evento` com `xml` e `json` do `eventoXmlGZipB64`; falha ao abrir vira `error`, mantendo `reqXml` e `resBody`                                                  | Must       |
| RF-07 | `RecepcaoEvento` de NF-e inalterada — XML assinado **byte a byte igual** ([ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)) | Must       |
| RF-08 | Endpoints da SEFIN em `src/env/nfse.js` (`NFSE_SEFIN`), indexados por `tpAmb`                                                                                       | Must       |
| RF-09 | `test/tls-sefaz.test.js` cobre `sefin.nfse.gov.br` e `sefin.producaorestrita.nfse.gov.br`                                                                           | Must       |
| RF-10 | `README.md`, `CHANGELOG.md`, `CLAUDE.md` e `.docs/arquitetura/` atualizados, com fluxo novo `fluxos/manifestacao-nfse.md`                                           | Must       |

## Decisões de design

As que valem também para a filha 1 estão no plano (Decisões 1 a 5). As daqui:

### Decisão 1: um método por evento, um evento por chamada

- **Opções consideradas:** (A) `enviarEvento(lote)` como na NF-e; (B) `enviarEvento({ chNFSe, tipoEvento, … })` genérico; (C) `confirmar(chNFSe)` e `rejeitar(chNFSe, motivo)`.
- **Escolha:** C.
- **Justificativa:** a SEFIN recebe **um** pedido por `POST`, sem lote — simular lote esconderia falha parcial. Os dois eventos têm entradas diferentes (só a Rejeição tem motivo), e um método por evento deixa isso no `.d.ts` em vez de numa mensagem de erro. Eventos futuros (prestador, intermediário, anulação) entram como métodos novos sem mudar estes.

### Decisão 2: assinatura parametrizada pela referência, NF-e intocada

- **Opções consideradas:** (A) copiar `Assinatura.assinarXml` para NFS-e; (B) parâmetro opcional com o nome do elemento referenciado, default `'infEvento'`.
- **Escolha:** B — `Assinatura.assinarXml(cert, key, xml, elemento = 'infEvento')`.
- **Justificativa:** RSA-SHA1, digest SHA1 e C14N 20010315, com `Signature` depois do elemento referenciado, é exatamente o que eventos reais aceitos pela SEFIN usam (ver conhecimento). Muda só o XPath (`//*[local-name(.)='infPedReg']`). Chamada de três argumentos precisa produzir o mesmo XML de hoje — é o que protege o recorte por `indexOf` da recepção da NF-e.

### Decisão 3: `dhEvento` pelo relógio local no timezone da config

- **Escolha:** `Data.toFormat(new Date(), timezone)`, com o `ZoneValidator` e o default `America/Sao_Paulo` da `RecepcaoEvento`. O formato `yyyy-MM-dd'T'HH:mm:ssZZ` casa com `TSDateTimeUTC` do XSD.
- **Justificativa:** mesma solução da NF-e, mesmo ponto único de não determinismo. `verAplic` = `bitmde/<VERSION>` (cabe nos 20 caracteres de `TSVerAplic`).

### Decisão 4: o que vira `error`

| Situação                                           | `status` | `data`                                                                             | `error`                                         |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `201` com `eventoXmlGZipB64` que abre              | 201      | `{ tipoAmbiente, versaoAplicativo, dataHoraProcessamento, evento: { xml, json } }` | —                                               |
| `201` com `eventoXmlGZipB64` vazio ou que não abre | 201      | `{ tipoAmbiente, …, evento: {} }`                                                  | `Falha ao abrir o evento retornado: <mensagem>` |
| `400`/`401` com `erro`                             | real     | `{ tipoAmbiente, …, erros: [{ codigo, descricao, complemento }] }`                 | `<codigo>: <descricao>`                         |
| Corpo que não é JSON, ou JSON sem os campos        | real     | `{}`                                                                               | `Resposta inesperada da SEFIN (HTTP <status>).` |
| Sem resposta HTTP                                  | 0        | `{}`                                                                               | `Falha de transporte (<code>): <message>`       |

O `erro` único da SEFIN é normalizado para `erros: [...]`, como no ADN (Decisão 2 do plano). Em todos os casos `reqXml` leva o pedido assinado: é o que se audita numa rejeição.

### Questões em aberto — resolver em produção restrita antes de implementar

| #   | Questão                                                                                                          | Como resolver                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Como obter uma NFS-e em produção restrita com a Bitize como tomadora?                                            | Alguém emite pelo Emissor Nacional de produção restrita contra o CNPJ da Bitize |
| 2   | A SEFIN aceita manifestação de NFS-e gerada por município com sistema próprio (`ambGer` 1)?                      | Pedido em produção restrita; se não aceitar, revisar o objetivo do plano        |
| 3   | Corpo real de sucesso (`eventoXmlGZipB64` traz `evento/infEvento` completo?) e de rejeição (`400` com `erro`?)   | Os dois casos em produção restrita                                              |
| 4   | Confirmação depois de Rejeição (e vice-versa) dá `E0861`/`E0866`? A Rejeição pode ser anulada só pelo município? | Aba "RN EVENTOSxEVENTOS" do Anexo II + teste                                    |
| 5   | O namespace e o atributo `versao` vão só no `pedRegEvento`, sem `xmlns` repetido no `infPedReg`?                 | XSD + pedido aceito                                                             |

> Manifestação em **produção** registra evento fiscal irreversível. Os testes desta tarefa rodam só em produção restrita; teste em produção só com decisão explícita sobre qual nota e qual evento.

---

## Impacto por camada

### [apis] (`src/apis/`)

- Arquivo novo: `manifestacaoNFSe-api.js`. Validators no construtor: **Certificado → Ambiente → Cnpj → Zone**. `this.config` e `this` congelados.
- Assinaturas:
  - `new ManifestacaoNFSe({ pfx, passphrase } | { cert, key }, cnpj, tpAmb, timezone?, options })`
  - `confirmar(chNFSe: string)`
  - `rejeitar(chNFSe: string, motivo: { cMotivo: '1' | '2' | '3' | '4' | '5' | '9', xMotivo?: string })`
- JSDoc completo; a união de literais de `cMotivo` vira tipo no `.d.ts`, com a descrição de cada código. Registrar em [src/index.js](../../../src/index.js) nas três formas.
- **Mudança quebra a API pública?** Não. Estritamente aditiva.

### [validators] (`src/validators/`)

- Reaproveitados: `CertificadoValidator`, `AmbienteValidator`, `ZoneValidator`, e da filha 1 `CnpjValidator` e `ChaveNfseValidator`.
- Novo: `MotivoRejeicaoValidator` (entrada: o objeto `motivo`; `getValues()` devolve `{ cMotivo, xMotivo }`, com `String(...)` em `cMotivo` e `xMotivo` aparado).

  | Situação                           | Mensagem (texto exato)                                              |
  | ---------------------------------- | ------------------------------------------------------------------- |
  | `motivo` ou `cMotivo` ausente      | `Motivo da rejeição não informado.`                                 |
  | `cMotivo` fora de 1, 2, 3, 4, 5, 9 | `Motivo da rejeição deve conter um dos valores: 1, 2, 3, 4, 5 ou 9` |
  | `cMotivo` 9 sem `xMotivo`          | `Descrição do motivo obrigatória para o motivo 9 (Outros).`         |
  | `xMotivo` informado fora de 15–255 | `Descrição do motivo com tamanho incorreto.`                        |

  A segunda mensagem segue o formato da existente `Tipo Evento deve conter um dos valores: …`, sem ponto final. Acrescentar as quatro ao catálogo de [validators.md](../../arquitetura/camadas/validators.md).

### [schemas] (`src/schemas/`)

- Arquivo novo: `manifestacaoNFSe-schema.js`, montando `pedRegEvento` para o `XMLBuilder`. **A ordem das chaves é a ordem do XSD** (`TCInfPedReg`):

  1. `@_Id` = `PRE` + `chNFSe` + código do evento (`203202` ou `203206`)
  2. `tpAmb`
  3. `verAplic`
  4. `dhEvento`
  5. `CNPJAutor`
  6. `chNFSe`
  7. `e203202` com `xDesc` = `Manifestação de NFS-e - Confirmação do Tomador`, ou `e203206` com `xDesc` = `Manifestação de NFS-e - Rejeição do Tomador`, `cMotivo` e, se informado, `xMotivo`

- `pedRegEvento` com `@_xmlns="http://www.sped.fazenda.gov.br/nfse"` e `@_versao="1.01"`. Os `xDesc` são literais do XSD (`enumeration`) **com acento** — ao contrário do `descEvento` da NF-e. Ficam em `src/env/nfse.js` (`EVENTOS_NFSE`).
- **Recepção da NF-e:** não é tocada. O schema e o recorte por `indexOf` da `RecepcaoEvento` ficam como estão.

### [helpers / controllers] (`src/helpers/`, `src/controllers/`)

- `manifestacaoNFSe-controller.js`: `static async enviar(opts)` — `montarRequest` → `SefazService.request` → `montarResponse` → `RetornoNfseHelper.montarRetorno`.
- `manifestacaoNFSe-helper.js`:
  - `montarRequest(opts)`: schema → `Xml.jsonToXml` → `Assinatura.assinarXml(cert, key, xml, 'infPedReg')` → `Gzip.zip` → base64. Devolve `{ reqXml, config }`, com `config` = `method: 'POST'`, `url: '/nfse/{chNFSe}/eventos'`, `data: JSON.stringify({ pedidoRegistroEventoXmlGZipB64 })`, `headers: { Accept: 'application/json', 'Content-Type': 'application/json' }`, `responseType: 'text'`.
  - `montarResponse(corpo)`: assíncrono, nunca lança; normaliza `tipoAmbiente` para string (`'1'`/`'2'`, como o `tpAmb`) e `erro` para `erros: [...]`.
- `RetornoNfseHelper` da filha 1 ganha o `reqXml` opcional — presente aqui, ausente na distribuição.

### [env] (`src/env/`)

- Em `nfse.js`:

  | Constante      | Conteúdo                                                                                                             |
  | -------------- | -------------------------------------------------------------------------------------------------------------------- |
  | `NFSE_SEFIN`   | `'1'`: `https://sefin.nfse.gov.br/SefinNacional` · `'2'`: `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` |
  | `EVENTOS_NFSE` | `203202` e `203206`, com `elemento` (`e203202`/`e203206`) e `xDesc`                                                  |

- Atualizar a tabela de [env.md](../../arquitetura/camadas/env.md).

### [util] (`src/util/`)

- `Gzip.zip(str)`: gzip + base64, inverso do `unzip` existente, `Promise` como ele.
- `Assinatura.assinarXml` com o quarto parâmetro da Decisão 2.

---

## Testes

- [ ] `test/manifestacaoNFSe.test.js`: construtor (cada mensagem de configuração), `confirmar` e `rejeitar` com chave ausente e de tamanho errado, e as quatro mensagens do `MotivoRejeicaoValidator`
- [ ] Imutabilidade da classe nova e dos módulos novos
- [ ] **XML gerado** para Confirmação e Rejeição (com e sem `xMotivo`) conferido contra o esperado, com `dhEvento` fixo; ordem dos elementos igual à do XSD
- [ ] Assinatura do `infPedReg` verificável com `xml-crypto` (`SignedXml.checkSignature`), com `Signature` como irmã seguinte do `infPedReg`
- [ ] **Regressão da NF-e:** `Assinatura.assinarXml` de três argumentos e o lote da `RecepcaoEvento` byte a byte iguais aos de antes — congelar o XML esperado
- [ ] `Gzip.zip` → `Gzip.unzip` devolve a entrada
- [ ] Helper e `RetornoNfseHelper` com respostas sintéticas: as cinco linhas da Decisão 4
- [ ] Transporte com servidor HTTPS local: `POST` com `Content-Type` e `Accept` JSON, corpo `{ pedidoRegistroEventoXmlGZipB64 }` que abre no XML de `reqXml`, sem `PRIVATE KEY` no retorno serializado
- [ ] `test/tls-sefaz.test.js` com os dois hosts da SEFIN (GlobalSign, como o Ambiente Nacional da NF-e)
- [ ] `test/sefaz.test.js` estendido com Confirmação e Rejeição em **produção restrita**, sobre a nota de teste da questão 1 — rodado manualmente

## Checklist de implementação

- [ ] Código em `src/` (apis, validators, schemas, controllers, helpers, env, util)
- [ ] Testes em `test/`
- [ ] JSDoc da `ManifestacaoNFSe` e do controller
- [ ] [README.md](../../../README.md): seção da manifestação, com os códigos de `cMotivo` e a regra do motivo 9
- [ ] `CHANGELOG.md` em `[Não publicado]`
- [ ] `CLAUDE.md`: "O que é" e exports de `src/index.js`
- [ ] `.docs/arquitetura/`: [apis](../../arquitetura/camadas/apis.md), [validators](../../arquitetura/camadas/validators.md), [schemas-xml](../../arquitetura/camadas/schemas-xml.md), [controllers-helpers](../../arquitetura/camadas/controllers-helpers.md), [env](../../arquitetura/camadas/env.md) e fluxo novo `fluxos/manifestacao-nfse.md`
- [ ] Questões em aberto respondidas nesta seção, com data, antes do PR
- [ ] Versão: bump de **minor** no release que fechar o plano

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [ ] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [ ] `npm run test:ci` — tudo menos `test/sefaz.test.js` e `test/tls-sefaz.test.js`
- [ ] `test/sefaz.test.js` e `test/tls-sefaz.test.js` rodados à parte — exigem rede, e o primeiro, certificado A1 válido
- [ ] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [ ] Conferir no `dist/index.d.ts` que `ManifestacaoNFSe` aparece com os dois métodos, a união de `cMotivo` e o tipo de retorno
- [ ] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [ ] Arquivo movido para `.docs/tarefas/concluidas/`
- [ ] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [ ] Issue fechada no GitHub e no Linear
- [ ] Link e status desta tarefa atualizados na tabela de filhas do plano; se era a última filha aberta, concluir o plano

## Referências

- Plano: [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md)
- [conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md) — contrato, leiaute, regras e evidência de assinatura
- Originais: [Swagger SEFIN Nacional](../../conhecimento/fontes/nfse-nacional/swagger-sefin-nacional-v1-20261015.json), [Anexo II v1.01](../../conhecimento/fontes/nfse-nacional/anexo-ii-sefin-adn-pedregevt-evt-v1.01-20260122.xlsx), [XSDs v1.01](../../conhecimento/fontes/nfse-nacional/nfse-esquemas-xsd-v1.01-20260209.zip), [Manual do Emissor Público v1.2](../../conhecimento/fontes/nfse-nacional/manual-contribuintes-emissor-publico-v1.2-202510.pdf)
- [fluxos/recepcao-evento.md](../../arquitetura/fluxos/recepcao-evento.md) e [ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md) — como a NF-e assina hoje
- [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md); ADRs 0015 e 0016, criados pela filha 1
- Relato de rejeição por falta de assinatura na Confirmação do tomador: [fórum ACBr, tópico 91333](https://www.projetoacbr.com.br/forum/topic/91333-erro-e0717-ao-registrar-evento-de-manifesta%C3%A7%C3%A3o-de-tomador-%E2%80%94-certificado-icp-brasil-e-cnpj-rfb-a1-rejeitado-pelo-webservice/)
- Issue: https://github.com/bitize/bitmde/issues/19
- Linear: [DEV-1100](https://linear.app/bitize/issue/DEV-1100)

## Histórico de revisões

| Data       | Rev | Descrição                                                                                                                 |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-15 | 0.1 | Rascunho criado como filha 2 do plano NFS-e                                                                               |
| 2026-10-15 | 1.0 | Especificada com o Swagger da SEFIN, o Anexo II e a evidência de assinatura; questões de produção restrita seguem abertas |
| 2026-10-15 | 1.1 | Promovida a `especificadas` com a issue GH-19, filha do plano GH-17                                                       |
