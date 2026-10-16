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
| **Atualizado em**    | 2026-10-16                                                                             |
| **Concluído em**     | —                                                                                      |

---

## Contexto e motivação

Segunda filha do plano [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md). Entrega o lado de escrita: o equivalente, para serviço, do que a `RecepcaoEvento` faz para NF-e.

O tomador manifesta-se sobre uma NFS-e com dois eventos, enviados à **SEFIN Nacional** — mesmo quando a nota foi gerada por sistema próprio de município, segundo o Anexo II (`E1818`: o município não pode compartilhar manifestação; `E1831`: a nota precisa existir no ADN). O contrato está em [conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md):

- `POST /SefinNacional/nfse/{chaveAcesso}/eventos` com `{ "pedidoRegistroEventoXmlGZipB64": "…" }`; sucesso `201` com `eventoXmlGZipB64`; erro `400`/`401` com um objeto `erro` único, em camelCase.
- `pedRegEvento` versão `1.01`, `infPedReg Id="PRE{chave 50}{código 6}"`, e o grupo `e203202` (só `xDesc`) ou `e203206` (`xDesc`, `cMotivo`, `xMotivo` opcional — obrigatório com `cMotivo` 9, `E1949`).
- **Pela API, o pedido vai assinado** (`E1989`), com o certificado do autor (`E1991`), e `CNPJAutor` na raiz do certificado (`E0812`). Eventos reais aceitos pela SEFIN mostram pedidos assinados com **RSA-SHA1, digest SHA1 e C14N** — a configuração que o `Assinatura.assinarXml` já usa — e também com SHA-256.

Depende da [GH-18](../concluidas/GH-18-distribuicao-nfse-nacional-adn.md), entregue no PR #20, que cria o retorno próprio da NFS-e (`RetornoNfseHelper`), o transporte REST/JSON, o `ChaveNfseValidator`, o `CnpjValidator` e `src/env/nfse.js`.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [x] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [x] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — ordem das chaves, opções do builder: **ler antes de implementar**
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, erro de transporte
- [x] [env](../../arquitetura/camadas/env.md) — endpoints, `ZONES`, `VERSION`
- [x] Fluxo: [recepção](../../arquitetura/fluxos/recepcao-evento.md) e [ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md) — **ler antes de implementar**: a assinatura da NF-e não pode mudar um byte
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [x] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md) — sem impacto além do bump de minor
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

> **Revisto depois da GH-18** ([ADR 0016](../../arquitetura/decisoes/0016-retorno-proprio-da-nfse.md)): o `error` sai do HTTP e dos `erros`, não de um status declarado pelo serviço — o ADN rejeita o E2243 com `StatusProcessamento: DOCUMENTOS_LOCALIZADOS`. Conferir em produção restrita se a SEFIN faz algo parecido (questão 3).

### Questões em aberto — resolver em produção restrita antes de implementar

| #   | Questão                                                                                                          | Como resolver                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Como obter uma NFS-e em produção restrita com a Bitize como tomadora?                                            | Alguém emite pelo Emissor Nacional de produção restrita contra o CNPJ da Bitize |
| 2   | A SEFIN aceita manifestação de NFS-e gerada por município com sistema próprio (`ambGer` 1)?                      | Pedido em produção restrita; se não aceitar, revisar o objetivo do plano        |
| 3   | Corpo real de sucesso (`eventoXmlGZipB64` traz `evento/infEvento` completo?) e de rejeição (`400` com `erro`?)   | Os dois casos em produção restrita                                              |
| 4   | Confirmação depois de Rejeição (e vice-versa) dá `E0861`/`E0866`? A Rejeição pode ser anulada só pelo município? | Aba "RN EVENTOSxEVENTOS" do Anexo II + teste                                    |
| 5   | O namespace e o atributo `versao` vão só no `pedRegEvento`, sem `xmlns` repetido no `infPedReg`?                 | XSD + pedido aceito                                                             |

Respostas, em 2026-10-16:

1. **Não resolvida; substituída por decisão do usuário.** Ninguém emitiu nota em produção restrita. Os pedidos de erro rodam em produção e em produção restrita, e uma Confirmação real é feita uma vez, em produção, sobre nota indicada pelo usuário — ver Notas de implementação.
2. **Sim.** A Confirmação real em produção foi sobre nota de município com sistema próprio (`ambGer` 1) e foi aceita; o evento sai com `ambGer` 2.
3. **Respondida.** Rejeição: HTTP 400 com `erro` em **array** de `{ codigo, descricao }`, não o objeto único do Swagger; `tipoAmbiente` numérico. Sucesso: HTTP 201 com `eventoXmlGZipB64`, que abre no `evento/infEvento` completo, com o `pedRegEvento` enviado dentro — o mesmo formato do item `EVENTO` da distribuição.
4. **Respondida pelo Anexo II.** Confirmação depois de Confirmação dá `E0861`, Rejeição depois de Rejeição dá `E0866`; Rejeição depois de Confirmação e Confirmação depois de Rejeição são **aceitas**. Com a Confirmação vinculada, o emitente não cancela mais a nota (só substitui). A Anulação da Rejeição é do município de incidência. Não exercitado contra o serviço.
5. **Respondida pelo XSD.** `xmlns` e `versao` só no `pedRegEvento`; o `infPedReg` herda o namespace (`elementFormDefault="qualified"`).

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
- **Revisto depois da GH-18:** o `RetornoNfseHelper` entregue tem regras próprias do ADN — a mensagem `Resposta inesperada do ADN (HTTP <status>).`, a leitura de `statusProcessamento` e o caso `NENHUM_DOCUMENTO_LOCALIZADO`, que nunca é erro. Para servir à SEFIN, ele precisa ser parametrizado por serviço: o nome na mensagem de resposta inesperada e a falha ao abrir o `eventoXmlGZipB64` da linha 2 da Decisão 4. O comportamento da distribuição não muda, e os testes do `RetornoNfseHelper` em `test/distribuicaoNFSe-helper.test.js` são a regressão.

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

- [x] `test/manifestacaoNFSe.test.js`: construtor (cada mensagem de configuração), `confirmar` e `rejeitar` com chave ausente e de tamanho errado, e as quatro mensagens do `MotivoRejeicaoValidator`
- [x] Imutabilidade da classe nova e dos módulos novos
- [x] **XML gerado** para Confirmação e Rejeição (com e sem `xMotivo`) conferido contra o esperado, com `dhEvento` fixo; ordem dos elementos igual à do XSD
- [x] Assinatura do `infPedReg` verificável com `xml-crypto` (`SignedXml.checkSignature`), com `Signature` como irmã seguinte do `infPedReg`
- [x] **Regressão da NF-e:** `Assinatura.assinarXml` de três argumentos e o lote da `RecepcaoEvento` byte a byte iguais aos de antes — congelar o XML esperado (`test/assinatura.test.js`; ver Notas)
- [x] `Gzip.zip` → `Gzip.unzip` devolve a entrada
- [x] Helper e `RetornoNfseHelper` com respostas sintéticas: as cinco linhas da Decisão 4
- [x] Transporte com servidor HTTPS local: `POST` com `Content-Type` e `Accept` JSON, corpo `{ pedidoRegistroEventoXmlGZipB64 }` que abre no XML de `reqXml`, sem `PRIVATE KEY` no retorno serializado
- [x] `test/tls-sefaz.test.js` com os dois hosts da SEFIN (GlobalSign, como o Ambiente Nacional da NF-e)
- [x] `test/sefaz.test.js` estendido com pedidos **rejeitados** em produção e em produção restrita (chave inventada, `E1831`; assinatura adulterada, `E0714`) — rodado manualmente com A1 real. Confirmação e Rejeição aceitas ficam fora da suíte (ver Notas)
- [x] Confirmação real em **produção**, uma vez, fora da suíte, sobre nota legítima autorizada pelo usuário (2026-10-16): `201`, evento aberto, sem `error`

## Checklist de implementação

- [x] Código em `src/` (apis, validators, schemas, controllers, helpers, env, util)
- [x] Testes em `test/`
- [x] JSDoc da `ManifestacaoNFSe` e do controller
- [x] [README.md](../../../README.md): seção da manifestação, com os códigos de `cMotivo` e a regra do motivo 9
- [x] `CHANGELOG.md` em `[Não publicado]`
- [x] `CLAUDE.md`: "O que é" e exports de `src/index.js`
- [x] `.docs/arquitetura/`: [apis](../../arquitetura/camadas/apis.md), [validators](../../arquitetura/camadas/validators.md), [schemas-xml](../../arquitetura/camadas/schemas-xml.md), [controllers-helpers](../../arquitetura/camadas/controllers-helpers.md), [env](../../arquitetura/camadas/env.md) e fluxo novo [fluxos/manifestacao-nfse.md](../../arquitetura/fluxos/manifestacao-nfse.md); também [services-sefaz](../../arquitetura/camadas/services-sefaz.md), [testes-e-certificados](../../arquitetura/testes-e-certificados.md), [fluxos/recepcao-evento](../../arquitetura/fluxos/recepcao-evento.md) e [conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md)
- [x] Questões em aberto respondidas nesta seção, com data, antes do PR
- [ ] Versão: bump de **minor** no release que fechar o plano

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [x] `npm run format` (ou conferir com `npm run format:check`)
- [x] `npm run certs:teste` — não rodado: `certs/` já existe, com o e-CNPJ A1 real
- [x] `npm run test:ci` — tudo menos `test/sefaz.test.js` e `test/tls-sefaz.test.js`: 212 passando, antes eram 152
- [x] `test/sefaz.test.js` e `test/tls-sefaz.test.js` rodados à parte — 14 e 13 passando, antes eram 10 e 9; o primeiro com o A1 real
- [x] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [x] Conferir no `dist/index.d.ts` que `ManifestacaoNFSe` aparece com os dois métodos, a união de `cMotivo` e o tipo de retorno
- [x] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

**Desvio aprovado pelo usuário (2026-10-16): testes reais em produção, não em produção restrita.** Ninguém emitiu nota de teste em produção restrita (questão 1). O usuário decidiu: (1) pedidos que a SEFIN rejeita, sem registrar nada, em produção — eles entram no `sefaz.test.js`; (2) **uma** Confirmação real em produção, sobre nota que ele indicar, fora da suíte; (3) nenhuma Rejeição em produção. A implementação andou antes de responder as questões 1 a 3, que a seção pedia antes de implementar. Consequências:

- A Rejeição aceita não é exercitada contra o serviço: fica validada por unidade e por transporte local, e pelo pedido rejeitado em produção (`E1831`), que passou pela assinatura. Se aparecer nota em produção restrita, a Rejeição pode ser exercitada lá.
- O critério de conclusão do plano (Confirmação e Rejeição aceitas em produção restrita) precisa de revisão — fica para o Passo 4 do plano, no PR de conclusão.

**Descobertas em produção que mudaram a implementação** (pedidos com chave inventada, 2026-10-16):

- **Declaração XML obrigatória.** Sem `<?xml version="1.0" encoding="UTF-8"?>` a SEFIN rejeita com `E1229`. O helper acrescenta a declaração depois de assinar (fica fora do `infPedReg` e do digest). `reqXml` começa por ela.
- **`erro` é array.** A SEFIN responde `erro: [{ codigo, descricao }]`, não o objeto único do Swagger e da Decisão 4. O helper aceita objeto, array e `erros`, e o teste de transporte usa a forma real.
- **Ordem de validação da SEFIN:** codificação (`E1229`) → assinatura (`E0717` sem, `E0714` inválida) → existência da nota (`E1831`) → autor (`E0812`). Por isso o `E1831` com chave inventada prova que a assinatura (RSA-SHA1, C14N) é aceita, e o `sefaz.test.js` traz um caso de assinatura adulterada para manter essa prova de pé.

**Detalhes de implementação que a especificação não fixou:**

- `ManifestacaoNFSeHelper.montarResponse` devolve `{ json, falha? }`, e não `json | null` como o da distribuição: a falha ao abrir o `eventoXmlGZipB64` precisa chegar ao retorno. `RetornoNfseHelper.montarRetorno` ganhou três opções — `servico` (`'ADN'` padrão, nomeia o serviço na resposta inesperada: "do ADN"/"da SEFIN"), `reqXml` e `falha` —, sem mudar a distribuição: os testes dela passam sem alteração.
- `data` sempre traz `alertas`, `erros` e `evento` (`{}` quando não há), seguindo a Decisão 2 do plano ("`erros` e `alertas` sempre como array"); a tabela da Decisão 4 listava só parte dos campos por linha.
- Os erros têm precedência sobre a `falha`; a `falha` só vira `error` numa resposta 2xx sem erros.
- Uma resposta é reconhecida como da SEFIN se tiver `eventoXmlGZipB64`, `erro` ou `erros`. `201` com `eventoXmlGZipB64` vazio ou `null` é falha (`eventoXmlGZipB64 sem conteúdo.`).
- `rejeitar` valida a chave antes do motivo. `xMotivo` vazio depois de aparado conta como não informado.
- `verAplic`, `evento` e `dhEvento` saem de uma função `montarOpts` do módulo da API, não de um método, para não aparecer no `.d.ts`.
- **Regressão da NF-e:** o lote congelado em `test/assinatura.test.js` mascara `SignatureValue` e `X509Certificate`, que dependem da chave, para o teste valer com o A1 real e com o certificado descartável da CI; o `DigestValue` e todo o resto são comparados byte a byte. A assinatura de cada evento é conferida dentro de um `envEvento` isolado, porque no envelope SOAP a C14N inclusiva leva os `xmlns` do envelope para o digest e a verificação falha — comportamento de sempre da recepção, que a SEFAZ aceita, e não mexido aqui.
- Cadeia TLS da SEFIN confirmada: `AC SERPRO AR46 OV TLS CA 2025 ← GlobalSign Root R46` nos dois hosts, como o Ambiente Nacional da NF-e.

**Contagens:** `test:ci` de 152 para 212; `sefaz.test.js` de 10 para 14; `tls-sefaz.test.js` de 9 para 13.

**Confirmação real em produção (2026-10-16):** feita uma vez, pelo `ManifestacaoNFSe.confirmar`, sobre NFS-e recebida pela Bitize, gerada por sistema próprio de município, que o usuário reconheceu como legítima. O modo automático do agente bloqueou o envio como transação real, e o próprio usuário rodou o script. Resultado: `201`, `tipoAmbiente` `'1'`, `erros: []`, evento aberto. Chave e retorno ficam fora do repositório.

**Ainda não exercitado contra o serviço:** Rejeição aceita, e as regras `E0861`/`E0866` entre eventos.

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

| Data       | Rev | Descrição                                                                                                                     |
| ---------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-15 | 0.1 | Rascunho criado como filha 2 do plano NFS-e                                                                                   |
| 2026-10-15 | 1.0 | Especificada com o Swagger da SEFIN, o Anexo II e a evidência de assinatura; questões de produção restrita seguem abertas     |
| 2026-10-15 | 1.1 | Promovida a `especificadas` com a issue GH-19, filha do plano GH-17                                                           |
| 2026-10-15 | 1.2 | Revista depois da GH-18: `RetornoNfseHelper` a parametrizar por serviço e `error` pelo HTTP e pelos `erros` (ADR 0016)        |
| 2026-10-16 | 1.3 | Implementação e notas: testes reais em produção por decisão do usuário; declaração XML e `erro` em array descobertos na SEFIN |
| 2026-10-16 | 1.4 | Confirmação real aceita em produção, sobre nota de município: questões 2 e 3 respondidas                                      |
