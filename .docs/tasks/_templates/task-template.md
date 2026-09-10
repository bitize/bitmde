# GH-NN: Título da tarefa

| Campo                | Valor                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| **Issue**            | GH-NN                                                                                        |
| **Status**           | drafts                                                                                       |
| **Prioridade**       | P0 (crítico) / P1 (alto) / P2 (médio) / P3 (baixo)                                           |
| **Tipo**             | feature / correção / dependências / documentação / infraestrutura                            |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / services / env / util / scripts / test |
| **Criado em**        | AAAA-MM-DD                                                                                   |
| **Atualizado em**    | AAAA-MM-DD                                                                                   |
| **Concluído em**     | —                                                                                            |

> **Como usar este template:** as seções Contexto, Requisitos, Decisões, Testes e Conclusão valem para qualquer tarefa. Os blocos de **impacto por camada** só devem ser preenchidos para as camadas realmente tocadas — apagar os que não se aplicam. Apagar também estes blocos de instrução.

---

## Contexto e motivação

Por que essa tarefa existe? Qual problema resolve? O que acontece se não for feita?

Se veio de uma rejeição da SEFAZ, incluir o `cStat` e o `xMotivo` — anonimizados.

## Fontes da verdade (`.docs/arquitetura`)

Marcar as camadas impactadas e ler os docs correspondentes **antes** de especificar:

- [ ] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [ ] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [ ] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [ ] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — ordem das chaves, opções do parser
- [ ] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, status sintético
- [ ] [env](../../arquitetura/camadas/env.md) — endpoints, `EVENTOS`, `CA`, `VERSION`
- [ ] Fluxo: [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md) e/ou [recepção](../../arquitetura/fluxos/recepcao-evento.md)
- [ ] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md)
- [ ] ADRs relacionados — listar em **Referências**

## Requisitos

| ID    | Requisito              | Prioridade |
| ----- | ---------------------- | ---------- |
| RF-01 | Descrição do requisito | Must       |
| RF-02 | …                      | Should     |

## Decisões de design

### Decisão 1: [título]

- **Opções consideradas:** A, B, C
- **Escolha:** B
- **Justificativa:** …

> Se a decisão tiver alternativas reais e reversão custosa, ela merece um ADR em [../../arquitetura/decisoes/](../../arquitetura/decisoes/) — não só um parágrafo aqui.

---

## Impacto por camada

> Preencher só os blocos das camadas tocadas. Apagar o resto.

### [apis] (`src/apis/`)

- Assinatura afetada:
- JSDoc a atualizar (vira o `dist/index.d.ts`):
- **Mudança quebra a API pública?** Se sim, justificar — a compatibilidade com a `node-mde` 0.14.13 é compromisso do [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md).

### [validators] (`src/validators/`)

- Validator novo ou alterado:
- Mensagens de erro (texto exato — são comparadas literalmente nos testes):
- Normalização feita em `isValid()`:

### [schemas] (`src/schemas/`)

- Campos e **ordem** no XML (a ordem das chaves é a ordem dos elementos):
- Atributos (`@_`) e onde entram:
- **Recepção:** a mudança afeta o recorte por `indexOf` do lote? Ver [ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md).

### [helpers / controllers] (`src/helpers/`, `src/controllers/`)

- Campos novos no retorno (lembrar do `|| ''`):
- JSDoc do controller a atualizar (vira tipo público):

### [services] (`src/services/`)

- Comportamento de rede afetado:
- Lembrar: objeto vindo de `this.config` chega **congelado** — copiar antes de mesclar ([ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md)).

### [env] (`src/env/`)

- Constante nova ou alterada:
- Registrada em `src/env/index.js`?

### [dependências]

- Pacote e versão (de → para):
- `package.json` **e** `package-lock.json` no mesmo commit ([ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md)):
- Mudança de API da dependência que exige adaptação:

---

## Testes

- [ ] Teste unitário para o caminho feliz
- [ ] Teste para cada mensagem de erro nova (`assert.strictEqual`)
- [ ] Teste de imutabilidade, se houver classe nova
- [ ] XML gerado conferido contra o esperado (mudança de schema/assinatura)
- [ ] `test/sefaz.test.js` rodado manualmente contra homologação — obrigatório se a tarefa toca transporte, certificado ou assinatura

## Checklist de implementação

- [ ] Código em `src/`
- [ ] Testes em `test/`
- [ ] JSDoc atualizado (`src/apis/` e/ou controllers)
- [ ] [README.md](../../../README.md) atualizado, se a API pública mudou
- [ ] `CHANGELOG.md` atualizado em `[Não publicado]`
- [ ] Docs de `.docs/arquitetura/` atualizados
- [ ] ADR criado, se houve decisão estrutural

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [ ] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [ ] `npm run test:ci` — tudo menos `test/sefaz.test.js`; é o que roda com o certificado descartável
- [ ] `test/sefaz.test.js` rodado à parte (`npx mocha test/sefaz.test.js`) — exige certificado A1 válido e acesso à rede
- [ ] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [ ] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `done` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/tasks/specified/GH-NN-descricao.md .docs/tasks/done/GH-NN-descricao.md`
- [ ] Blockquote de especificação na issue apontando para `.docs/tasks/done/` (era `specified/`)
- [ ] Issue fechada no GitHub

## Referências

- [Doc de arquitetura consultado](../../arquitetura/README.md)
- [ADR relacionado](../../arquitetura/decisoes/README.md)
- Issue: https://github.com/bitize/bitmde/issues/NN
- Nota técnica / MOC da SEFAZ, se aplicável

## Histórico de revisões

| Data       | Rev | Descrição                |
| ---------- | --- | ------------------------ |
| AAAA-MM-DD | 1.0 | Criação da especificação |
