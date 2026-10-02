# GH-3: Suporte a CT-e e MDF-e na distribuição de DF-e

| Campo                | Valor                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| **Issue**            | [GH-3](https://github.com/bitize/bit-mde/issues/3)                      |
| **Status**           | specified                                                               |
| **Prioridade**       | P2 (médio)                                                              |
| **Tipo**             | feature                                                                 |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / env / util / test |
| **Criado em**        | 2026-08-16                                                              |
| **Atualizado em**    | 2026-10-01                                                              |
| **Concluído em**     | —                                                                       |

---

## Contexto e motivação

A biblioteca só consulta **NF-e** destinada, pelo `NFeDistribuicaoDFe`. Quem precisa dos outros documentos que chegam ao mesmo CNPJ — **CT-e** (frete contratado) e **MDF-e** (manifesto de carga) — hoje precisa de outra biblioteca ou de código próprio, apesar de os três serviços terem leiaute quase idêntico: mesmo `distDFeInt`, mesmo trio `distNSU` / `consCh*` / `consNSU`, mesmo `retDistDFeInt` com `docZip` gzipado.

Dois forks do upstream já implementaram parte disso e servem de referência — e de aviso:

| Fork                                                                | O que fez    | Estado                                                                                 |
| ------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| [vexta-systems/node-mde](https://github.com/vexta-systems/node-mde) | CT-e         | `@vexta-systems/node-mde` 0.15.7, ~7,8 mil downloads/mês. `main` parado desde out/2025 |
| [TyagoVeras/node-mde](https://github.com/TyagoVeras/node-mde)       | CT-e + MDF-e | `@tyagoveras/node-mde` 0.3.1, ~100 downloads/mês. Dependências defasadas               |

Os dois resolveram por **cópia**: `distribuicaoCTe-{api,controller,helper,schema}.js` duplicando o arquivo de NF-e quase byte a byte, o que já produziu divergência silenciosa entre as cópias — no fork da vexta o bloco de consulta por chave saiu `<consChCTe><chNFe>` (nome de elemento do CT-e, campo interno do NF-e), e o helper de CT-e deixou de repassar `tpAmb` ao `SefazService`. Esta tarefa existe para entregar o mesmo recurso **sem** triplicar o código.

Não faz parte do escopo: manifestação/evento de CT-e ou MDF-e (`CTeRecepcaoEvento`, `MDFeRecepcaoEvento`) — a `RecepcaoEvento` continua só de NF-e.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [x] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [x] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — ordem das chaves, opções do parser
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, status sintético
- [x] [env](../../arquitetura/camadas/env.md) — endpoints, `EVENTOS`, `CA`, `VERSION`
- [x] Fluxo: [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md)
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md) — sem impacto além do bump de minor
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                      | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | Classe pública `DistribuicaoCTe` com `consultaUltNSU`, `consultaNSU` e `consultaChCTe`, mesma config de `DistribuicaoDFe`                                      | Must       |
| RF-02 | Classe pública `DistribuicaoMDFe` com `consultaUltNSU`, `consultaNSU` e `consultaChMDFe`, mesma config                                                         | Must       |
| RF-03 | `DistribuicaoDFe` permanece **inalterada** em assinatura e comportamento                                                                                       | Must       |
| RF-04 | Retorno idêntico ao da NF-e: `{ data: { tpAmb, verAplic, cStat, xMotivo, dhResp, ultNSU, maxNSU, docZip[], docZipErrors[] }, reqXml, resXml, status, error? }` | Must       |
| RF-05 | Endpoints por `tpAmb`: CT-e no Ambiente Nacional, MDF-e na SVRS                                                                                                | Must       |
| RF-06 | Validators próprios de chave para CT-e e MDF-e, com mensagens em português (texto exato abaixo)                                                                | Must       |
| RF-07 | Suporte a cabeçalho SOAP (`mdfeCabecMsg`), exigido pelos serviços de MDF-e, sem alterar o envelope gerado hoje                                                 | Must       |
| RF-08 | Uma única implementação de schema/helper/controller parametrizada por documento — sem cópia por tipo                                                           | Must       |
| RF-09 | `src/index.js` exporta as classes novas nas três formas (`module.exports`, `.default`, `.mde`)                                                                 | Must       |
| RF-10 | `README.md` documenta os dois serviços novos, com exemplo por método                                                                                           | Must       |
| RF-11 | Docs de `.docs/arquitetura/` atualizados (env, apis, schemas, controllers-helpers, fluxo)                                                                      | Should     |

## Decisões de design

### Decisão 1: três classes públicas, uma implementação parametrizada

- **Opções consideradas:**
  - **A —** copiar api/controller/helper/schema por documento, como fizeram os dois forks;
  - **B —** um parâmetro `modelo: 'nfe' | 'cte' | 'mdfe'` no construtor de `DistribuicaoDFe`;
  - **C —** três classes finas em `apis/`, sobre um schema/helper/controller único parametrizado por um **descritor de documento** em `env/`.
- **Escolha:** C.
- **Justificativa:** A é o que já apodreceu nos forks — `montarResponse` é idêntico nos três casos a menos do nome de dois elementos da resposta, e manter três cópias garante que a correção de bug entre em uma e esqueça as outras. B esconderia CT-e e MDF-e atrás de uma classe chamada `DistribuicaoDFe` e obrigaria `consultaChNFe` a aceitar chave de CT-e, o que estraga tanto o nome quanto a mensagem de erro. C mantém a superfície pública explícita e legível no `.d.ts`, preserva a compatibilidade exigida pelo [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) e concentra a diferença entre os três serviços em uma tabela de dados.

O descritor, um por documento, carrega tudo o que varia:

```js
// src/env/documento.js  (esboço — nomes finais na implementação)
const DOCUMENTOS = {
  NFE: {
    endpoints: DISTRIBUICAO_NFE, // por tpAmb
    xmlns: 'http://www.portalfiscal.inf.br/nfe',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
    versao: '1.01',
    operacao: 'nfeDistDFeInteresse', // elemento raiz e nome da resposta
    dadosMsg: 'nfeDadosMsg',
    consChave: { bloco: 'consChNFe', campo: 'chNFe' },
    cabecMsg: null,
  },
  // CTE: … versao '1.00', consChCTe/chCTe, cabecMsg null
  // MDFE: … versao '1.00', consChMDFe/chMDFe, cabecMsg 'mdfeCabecMsg'
}
```

> Isto é decisão estrutural com reversão custosa: ao ser aceita, gerar **ADR 0010 — distribuição parametrizada por descritor de documento**, registrando por que a duplicação por tipo foi recusada.

### Decisão 2: cabeçalho SOAP opcional em `Xml.envelopar`

- **Opções consideradas:** (A) `Xml.envelopar(xml, header)` com segundo parâmetro opcional; (B) função nova `Xml.enveloparComCabecalho`; (C) montar o envelope do MDF-e à mão no helper, como no fork do Tyago.
- **Escolha:** A.
- **Justificativa:** C reintroduz string de XML escrita à mão fora de `util/xml.js` e some com a garantia de envelope sem espaço em branco. B duplica o template. Em A, **a saída para chamada de um argumento precisa ser byte a byte a de hoje** — é o que protege o recorte por `indexOf` da recepção ([ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)). O prefixo `soap12:` também não muda: o fork do Tyago trocou para `soap:` sem necessidade, e o `montarResponse` lê a resposta por `'soap:Envelope'` — que é o que a SEFAZ **responde**, independente do prefixo enviado.

### Decisão 3: `cUFAutor` e `CODIGOS_UF` reaproveitados como estão

- **Escolha:** os três serviços usam o mesmo `UfValidator` e o mesmo `CnpjCpfValidator`, sem cópia.
- **Justificativa:** `distDFeInt` tem o mesmo cabeçalho nos três leiautes (`tpAmb`, `cUFAutor`, `CNPJ`/`CPF`). Reaproveitar mantém uma só mensagem de erro por assunto.

### Decisão 4: `NsuValidator` reaproveitado, chave com validator próprio

- **Escolha:** NSU compartilha o validator (mesmo zero-pad de 15); a chave ganha `ChaveCteValidator` e `ChaveMdfeValidator`.
- **Justificativa:** o NSU tem o mesmo formato e a mesma mensagem nos três serviços. A chave, não: `'Chave da NF-e não informada.'` num método `consultaChCTe` seria mensagem errada, e as mensagens são contrato ([validators.md](../../arquitetura/camadas/validators.md)).

### Questões em aberto — confirmar contra homologação antes de implementar

| #   | Questão                                                                                                                                         | Como resolver                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | O `MDFeDistribuicaoDFe` exige mesmo `mdfeCabecMsg` no SOAP Header? Existe a rejeição **242 — Elemento mdfeCabecMsg inexistente no SOAP Header** | Chamada em homologação com e sem o cabeçalho                     |
| 2   | O bloco de chave do CT-e é `<consChCTe><chCTe>` (MOC) e não `<consChCTe><chNFe>` (fork da vexta)                                                | Consulta por chave em homologação; conferir contra o XSD do CT-e |
| 3   | `versao` do `distDFeInt` é `1.00` no CT-e e no MDF-e (`1.01` só na NF-e)?                                                                       | XSD de cada serviço + resposta de homologação                    |
| 4   | O `?wsdl` no fim da URL, herdado do endpoint de NF-e, é inofensivo no CT-e e no MDF-e?                                                          | Testar as duas formas; padronizar a que responder                |
| 5   | Homologação do CT-e responde em `hom1.cte.fazenda.gov.br`? Do MDF-e, em `mdfe-homologacao.svrs.rs.gov.br`?                                      | `test/sefaz.test.js` estendido                                   |

> As respostas entram nesta seção **antes** de a implementação começar, e a tarefa foi promovida a `specified/` com elas ainda abertas. Enquanto a 1 e a 2 não forem confirmadas em homologação, RF-07 e o descritor do CT-e não têm forma final — quem pegar a tarefa começa por essa confirmação, não pelo código.

---

## Impacto por camada

### [apis] (`src/apis/`)

- Arquivos novos: `distribuicaoCTe-api.js` e `distribuicaoMDFe-api.js`, no mesmo formato de [distribuicaoDFe-api.js](../../../src/apis/distribuicaoDFe-api.js): validators na ordem **Certificado → Ambiente → CnpjCpf → Uf**, `this.config` e `this` congelados.
- Assinaturas novas:
  - `new DistribuicaoCTe(config)` · `consultaUltNSU(ultNSU)` · `consultaNSU(nsu)` · `consultaChCTe(chCTe)`
  - `new DistribuicaoMDFe(config)` · `consultaUltNSU(ultNSU)` · `consultaNSU(nsu)` · `consultaChMDFe(chMDFe)`
- `config` idêntica à da `DistribuicaoDFe` — `pfx`/`passphrase` ou `cert`/`key`, `cUFAutor`, `cnpj`/`cpf`, `tpAmb`, `options`.
- JSDoc a atualizar (vira o `dist/index.d.ts`): construtor e os três métodos de cada classe nova. Copiar o bloco de tipos de `cUFAutor` como está — é ele que gera a união de literais no `.d.ts`.
- Registrar as duas classes em [src/index.js](../../../src/index.js), nas **três** formas de export.
- **Mudança quebra a API pública?** Não. É estritamente aditiva; `DistribuicaoDFe` e `RecepcaoEvento` não mudam.

### [validators] (`src/validators/`)

- Validators novos: `ChaveCteValidator` (`chave-cte-validator.js`) e `ChaveMdfeValidator` (`chave-mdfe-validator.js`), decalcados de [chave-validator.js](../../../src/validators/chave-validator.js) — `String(...)` e comprimento 44, sem DV.
- Mensagens de erro (texto exato — comparadas literalmente nos testes):

  | Situação                    | `ChaveCteValidator`                    | `ChaveMdfeValidator`                    |
  | --------------------------- | -------------------------------------- | --------------------------------------- |
  | Chave ausente               | `Chave do CT-e não informada.`         | `Chave do MDF-e não informada.`         |
  | Comprimento diferente de 44 | `Chave do CT-e com tamanho incorreto.` | `Chave do MDF-e com tamanho incorreto.` |

- Normalização feita em `isValid()`: `this.chave = String(this.chave)`, como no de NF-e. `getValues()` devolve escalar.
- Registrar os dois em [src/validators/index.js](../../../src/validators/index.js), em ordem alfabética.
- Acrescentar as quatro mensagens ao catálogo de [validators.md](../../arquitetura/camadas/validators.md).

### [schemas] (`src/schemas/`)

- `distribuicaoDFe-schema.js` passa a receber o descritor e montar `distDFeInt` para qualquer um dos três documentos. **A ordem das chaves não muda:** `tpAmb` → `cUFAutor` → `CNPJ`/`CPF` → bloco de consulta → atributos `@_versao` e `@_xmlns` por último.
- Precedência do bloco de consulta preservada: `ultNSU` → chave → `nsu` (`else` final), agora com o nome da chave vindo do descritor.
- Elemento raiz e `dadosMsg` também saem do descritor:

  | Documento | Raiz                   | `dadosMsg`     | Bloco de chave          | `versao` |
  | --------- | ---------------------- | -------------- | ----------------------- | -------- |
  | NF-e      | `nfeDistDFeInteresse`  | `nfeDadosMsg`  | `consChNFe` › `chNFe`   | `1.01`   |
  | CT-e      | `cteDistDFeInteresse`  | `cteDadosMsg`  | `consChCTe` › `chCTe`   | `1.00`   |
  | MDF-e     | `mdfeDistDFeInteresse` | `mdfeDadosMsg` | `consChMDFe` › `chMDFe` | `1.00`   |

- **Recepção:** não é tocada. O `RecepcaoSchema` e o recorte por `indexOf` do lote ficam como estão — desde que `Xml.envelopar(xml)` de um argumento continue produzindo a mesma string ([ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)).
- **Teste de regressão obrigatório:** o XML gerado para NF-e antes e depois da parametrização precisa ser byte a byte igual.

### [util] (`src/util/xml.js`)

- `envelopar(xml, cabecalho)` ganha segundo parâmetro opcional. Sem ele, a saída é **exatamente** a de hoje (mesmo prefixo `soap12:`, sem espaço em branco entre tags); com ele, insere `<soap12:Header>…</soap12:Header>` antes do `Body`.
- O conteúdo do `mdfeCabecMsg` (`cUF` = `cUFAutor`, `versaoDados` = versão do descritor) é montado pelo schema/helper, não por `util/xml.js` — que continua sem conhecer domínio.

### [helpers / controllers] (`src/helpers/`, `src/controllers/`)

- `DistribuicaoHelper` e `DistribuicaoController` passam a receber o descritor por `opts` (a classe de `apis/` o injeta junto da config). `montarResponse` lê a resposta pelo nome vindo do descritor (`<doc>DistDFeInteresseResponse` › `<doc>DistDFeInteresseResult` › `retDistDFeInt`), mantendo a desestruturação defensiva com default em cada nível.
- Alternativa aceitável na implementação, se a parametrização do `montarResponse` ficar ilegível: três controllers finos delegando a **um** helper parametrizado. O que não é aceitável é copiar `montarResponse`.
- Campos novos no retorno: **nenhum** além dos que a NF-e já tem. `docZip[]` continua com `xml`, `json`, `nsu` e `schema`, `docZipErrors[]` com `nsu`, `schema` e `error` ([GH-11](../done/GH-11-doczip-corrompido-nao-derruba-o-lote.md), [ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md)), e todo escalar continua com `|| ''`. O que muda é o valor de `schema` que a SEFAZ devolve (`procCTe`, `resCTe`, `procEventoCTe`, `procMDFe`…) — a biblioteca segue sem interpretá-lo.
- **Herdado da GH-11:** o tratamento por item de `docZip` (`abrirDocZip`, que nunca rejeita) e a normalização de `loteDistDFeInt` — string vazia vira lote vazio, qualquer outra forma não-lote vira `error: 'loteDistDFeInt inválido.'` — já estão no `montarResponse` da NF-e. Ao parametrizar, **preservar os dois**: são independentes do tipo de documento e valem igual para CT-e e MDF-e. Não reintroduzir `Promise.all` sobre operação que pode rejeitar.
- `enviarConsulta` precisa repassar `tpAmb` ao `SefazService` também nos documentos novos (o fork da vexta esqueceu).
- JSDoc do controller a atualizar: é ele que vira o tipo de retorno público dos seis métodos novos.

### [env] (`src/env/`)

- `distribuicao.js` passa a exportar os três mapas de endpoint, indexados por `tpAmb` (chave numérica, acesso por string — ver [env.md](../../arquitetura/camadas/env.md)):

  | Documento    | `tpAmb` `'1'` (produção)                                              | `tpAmb` `'2'` (homologação)                                                       |
  | ------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
  | NF-e (AN)    | `www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`  | `hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`              |
  | CT-e (AN)    | `www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx`  | `hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx`              |
  | MDF-e (SVRS) | `mdfe.svrs.rs.gov.br/ws/MDFeDistribuicaoDFe/MDFeDistribuicaoDFe.asmx` | `mdfe-homologacao.svrs.rs.gov.br/ws/MDFeDistribuicaoDFe/MDFeDistribuicaoDFe.asmx` |

- Constante nova: o mapa de descritores (`DOCUMENTOS`), em arquivo próprio.
- **Compatibilidade:** manter `DISTRIBUICAO` exportado com o valor atual (endpoints de NF-e). É consumido por `DistribuicaoHelper` e renomeá-lo não traz nada — o fork da vexta renomeou para `DISTRIBUICAONFE` sem necessidade.
- Registrados em [src/env/index.js](../../../src/env/index.js), mantendo a ordem alfabética. Arquivos de `env/` seguem sem `'use strict'` e sem `Object.freeze`.
- Atualizar a tabela de constantes em [env.md](../../arquitetura/camadas/env.md).

### [services] (`src/services/`)

- Sem mudança de código prevista. Se a confirmação da questão 1 exigir `action="…"` no `Content-Type` para o MDF-e, o ajuste sai por `requestOptions.headers` **montado no helper**, não por alteração do default do serviço.
- Lembrar: `requestOptions` e `httpsOptions` chegam **congelados** de `this.config` — copiar antes de mesclar ([ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md)). Foi a origem do #22.

---

## Testes

- [ ] `test/distribuicaoCTe.test.js` e `test/distribuicaoMDFe.test.js`, decalcados de [test/distribuicao.test.js](../../../test/distribuicao.test.js): construtor sem cert, sem key, sem `tpAmb`, `tpAmb` inválido, sem CNPJ/CPF, sem `cUFAutor`, `cUFAutor` inválido
- [ ] Teste para cada mensagem de erro nova das chaves — quatro no total, com `assert.throws` sobre o texto exato
- [ ] Teste de imutabilidade das duas classes novas (instância e `config` congeladas; `assert.throws` ao sobrescrever)
- [ ] **Regressão de XML da NF-e:** `DistribuicaoSchema` parametrizado gera, para NF-e, string idêntica à atual — congelar o XML esperado no teste
- [ ] XML gerado para CT-e e MDF-e conferido contra o esperado, incluindo `<soap12:Header><mdfeCabecMsg>` no MDF-e
- [ ] `Xml.envelopar(xml)` de um argumento continua byte a byte igual (protege o recorte do lote da recepção)
- [ ] `test/distribuicaoDFe-helper.test.js` (GH-11) continua passando sem alteração depois da parametrização, e ganha ao menos um lote misto de CT-e ou MDF-e — prova que `docZipErrors` vale para os documentos novos
- [ ] `test/sefaz.test.js` estendido com CT-e e MDF-e em homologação **e** produção, e rodado manualmente — obrigatório: a tarefa toca transporte

## Checklist de implementação

- [ ] Código em `src/` (apis, validators, schemas, helpers/controllers, env, util)
- [ ] Testes em `test/`
- [ ] JSDoc atualizado (`src/apis/` e controllers)
- [ ] [README.md](../../../README.md) atualizado: seções novas de CT-e e MDF-e no formato das existentes, e a lista de **Funcionalidades**
- [ ] `CHANGELOG.md` atualizado em `[Não publicado]`
- [ ] Docs de `.docs/arquitetura/` atualizados: [README](../../arquitetura/README.md), [apis](../../arquitetura/camadas/apis.md), [validators](../../arquitetura/camadas/validators.md), [schemas-xml](../../arquitetura/camadas/schemas-xml.md), [controllers-helpers](../../arquitetura/camadas/controllers-helpers.md), [env](../../arquitetura/camadas/env.md) e o fluxo de [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md)
- [ ] ADR 0010 criado (Decisão 1)
- [ ] Versão: bump de **minor** (mudança aditiva) no release seguinte

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [ ] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [ ] `npm run test:ci` — tudo menos `test/sefaz.test.js`; é o que roda com o certificado descartável
- [ ] `test/sefaz.test.js` rodado à parte (`npx mocha test/sefaz.test.js`) — exige certificado A1 válido e acesso à rede
- [ ] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [ ] Conferir no `dist/index.d.ts` que as duas classes novas aparecem com os métodos e o tipo de retorno corretos
- [ ] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `done` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/tasks/specified/GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md .docs/tasks/done/`
- [ ] Blockquote de especificação na issue apontando para `.docs/tasks/done/` (era `specified/`)
- [ ] Issue fechada no GitHub

## Referências

- [Visão geral da arquitetura](../../arquitetura/README.md) e [fluxo da distribuição](../../arquitetura/fluxos/distribuicao-dfe.md)
- [camadas/apis.md](../../arquitetura/camadas/apis.md), [camadas/validators.md](../../arquitetura/camadas/validators.md), [camadas/schemas-xml.md](../../arquitetura/camadas/schemas-xml.md), [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md), [camadas/services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), [camadas/env.md](../../arquitetura/camadas/env.md)
- [ADR 0001 — fork e republicação](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) (compatibilidade da API pública)
- [ADR 0004 — erro de configuração lança, erro de rede retorna](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)
- [ADR 0005 — `Object.freeze` pervasivo](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md)
- [ADR 0006 — JS com JSDoc em vez de TypeScript](../../arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md)
- [ADR 0007 — assinatura por `infEvento` e splice do lote](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)
- MDF-e, NT 2015/002 — Web Service de Distribuição de DF-e de Interesse dos Atores: <http://sped.rfb.gov.br/estatico/98/22760A84B768D36BA81C2CF7648186AE2CCEE0/MDFe_NotaTecnica_2015_002_WS_Distribuicao_DFE_v1.01.pdf>
- Portal SVRS — relação de serviços do MDF-e: <https://dfe-portal.svrs.rs.gov.br/MDFE/Servicos>
- Implementações de referência (ler como fonte de armadilha, não como modelo): [vexta-systems/node-mde](https://github.com/vexta-systems/node-mde) (CT-e) e [TyagoVeras/node-mde](https://github.com/TyagoVeras/node-mde) (CT-e e MDF-e)
- Issue: <https://github.com/bitize/bit-mde/issues/3>

## Histórico de revisões

| Data       | Rev | Descrição                                                                    |
| ---------- | --- | ---------------------------------------------------------------------------- |
| 2026-08-16 | 0.1 | Rascunho inicial, com cinco questões em aberto para confirmar                |
| 2026-08-16 | 1.0 | Promovida a `specified/` com a issue GH-3; questões em aberto seguem abertas |
| 2026-10-01 | 1.1 | RF-04 e helpers ajustados ao `docZipErrors` entregue pela GH-11              |
