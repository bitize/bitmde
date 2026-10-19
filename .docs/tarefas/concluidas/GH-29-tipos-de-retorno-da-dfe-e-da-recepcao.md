# GH-29: Corrigir os tipos de retorno da distribuição DF-e e da recepção de evento

| Campo                | Valor                                               |
| -------------------- | --------------------------------------------------- |
| **Issue**            | [GH-29](https://github.com/bitize/bitmde/issues/29) |
| **Status**           | concluidas                                          |
| **Plano**            | —                                                   |
| **Prioridade**       | P3 (baixo)                                          |
| **Tipo**             | correção                                            |
| **Camadas afetadas** | controllers / helpers / test                        |
| **Criado em**        | 2026-10-18                                          |
| **Atualizado em**    | 2026-10-18                                          |
| **Concluído em**     | 2026-10-18                                          |

---

## Contexto e motivação

O tipo de retorno de quatro APIs públicas, no `.d.ts` publicado (0.21.0), não corresponde ao que a biblioteca devolve em runtime. As classes de `src/apis/` não declaram retorno: o `tsc` infere o tipo do `@returns` do controller ([ADR 0006](../../arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md)). O erro está nesses JSDoc.

| Origem do tipo                                                                                     | APIs afetadas                                            | Campo em tupla           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| [distribuicaoDFe-controller.js](../../../src/controllers/distribuicaoDFe-controller.js) — `enviar` | `DistribuicaoDFe`, `DistribuicaoCTe`, `DistribuicaoMDFe` | `docZip`, `docZipErrors` |
| [recepcaoEvento-controller.js](../../../src/controllers/recepcaoEvento-controller.js) — `enviar`   | `RecepcaoEvento`                                         | `infEvento`              |

O `montarResponse` de [distribuicaoDFe-helper.js](../../../src/helpers/distribuicaoDFe-helper.js) e o de [recepcaoEvento-helper.js](../../../src/helpers/recepcaoEvento-helper.js) repetem o mesmo tipo. Ele não chega ao consumidor, mas precisa ser corrigido junto para os dois JSDoc não divergirem.

Há dois defeitos:

1. **Tupla de um elemento.** O JSDoc declara `docZip:[{…}]`, `docZipErrors:[{…}]` e `infEvento:[{…}]`, que para o TypeScript são tuplas de comprimento exatamente 1. Em runtime são arrays de tamanho variável: `docZip` e `docZipErrors` são montados por `push` e chegam vazios no `cStat` 137, e `infEvento` vem de um `.map` sobre o lote, que tem de 1 a 20 eventos.
2. **`error: string` obrigatório.** O [RetornoHelper](../../../src/helpers/retorno-helper.js) só preenche `error` quando há falha. O `montarResponse` também: só no `json.error` ou no `loteDistDFeInt inválido.`.

O [README.md](../../../README.md) já documenta o retorno como `{ data, reqXml, resXml, status, error?, transportError? }`, e as APIs de NFS-e já declaram `Array<…>` e `error?: string` no `@returns` dos controllers. Ou seja, só o `.d.ts` da NF-e está errado em relação à documentação e ao resto do pacote.

### Impacto verificado

Gerei o `.d.ts` da `main` e compilei com `tsc --strict` um consumidor em TS:

| Uso do retorno                                     | Resultado                                    |
| -------------------------------------------------- | -------------------------------------------- |
| `for…of`, `.map`, `.forEach` em `docZip`           | compila — iterar **não** exige cast          |
| `docZip.length === 0`                              | TS2367: o tipo de `length` é `1`             |
| `docZip[1]`                                        | TS2493: a tupla não tem elemento no índice 1 |
| atribuir `[]` ou `T[]` ao campo (mock, lote vazio) | TS2322                                       |
| `infEvento: […] = []`                              | TS2322                                       |
| montar um retorno de sucesso sem `error`           | TS2741: falta a propriedade `error`          |

Hoje, quem consome em TS precisa de cast para checar lote vazio, acessar o segundo documento e montar mocks nos testes.

Origem: DEV-1113 (rastreador interno da Bitize).

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — o JSDoc vira `.d.ts`; nenhuma assinatura de `src/apis/` muda
- [ ] [validators](../../arquitetura/camadas/validators.md) — sem impacto
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — o JSDoc de `enviar` é o tipo público de retorno
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — sem impacto
- [ ] [services](../../arquitetura/camadas/services-sefaz.md) — sem impacto
- [ ] [env](../../arquitetura/camadas/env.md) — sem impacto
- [ ] Fluxo: distribuição / recepção — sem impacto: o comportamento não muda
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md) — teste novo, sem `certs/`
- [x] [build e versão](../../arquitetura/build-e-versao.md) — `npm run types`, `tsconfig.json`
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                                            | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| RF-01 | `docZip` passa a `Array<{xml: string,json: Object,nsu: string,schema: string}>` e `docZipErrors` a `Array<{nsu: string,schema: string,error: string}>` nas três APIs de distribuição | Must       |
| RF-02 | `infEvento` passa a `Array<{…}>` em `RecepcaoEvento`, com os mesmos doze campos de hoje                                                                                              | Must       |
| RF-03 | `error` passa a `error?: string` no retorno das quatro APIs                                                                                                                          | Must       |
| RF-04 | O `@returns` do `montarResponse` dos dois helpers recebe a mesma correção (`Array<…>` e `error?: string`)                                                                            | Must       |
| RF-05 | Nenhum outro campo do tipo muda: `transportError?`, `reqXml`, `resXml`, `status` e os escalares de `data` ficam como estão                                                           | Must       |
| RF-06 | Runtime intacto: `lib/` gerado sai byte a byte igual ao da `main`                                                                                                                    | Must       |
| RF-07 | Teste novo, `test/tipos.test.js`, compila um consumidor TS contra o `.d.ts` gerado e reprova se houver diagnóstico                                                                   | Must       |
| RF-08 | O teste roda sem `certs/` e sem rede, e entra no `test:ci` sem mudança de workflow                                                                                                   | Must       |
| RF-09 | `CHANGELOG.md` em `[Não publicado]`, seção `### Corrigido`, com a nota de compatibilidade da Decisão 5                                                                               | Must       |
| RF-10 | Docs atualizados: `testes-e-certificados.md`, `build-e-versao.md`, `controllers-helpers.md` e `CLAUDE.md`                                                                            | Must       |

## Decisões de design

### Decisão 1: `Array<…>` em vez de `T[]`

- **Opções consideradas:** `Array<{…}>`, `{…}[]`
- **Escolha:** `Array<{…}>`
- **Justificativa:** os dois geram o mesmo tipo. `Array<…>` é a forma que o [distribuicaoNFSe-controller.js](../../../src/controllers/distribuicaoNFSe-controller.js) e o [manifestacaoNFSe-controller.js](../../../src/controllers/manifestacaoNFSe-controller.js) já usam, e lê melhor quando o elemento é um objeto literal longo numa linha só de JSDoc.

### Decisão 2: `error?: string`, e não uma união discriminada

- **Opções consideradas:**
  - (A) só tornar `error` opcional;
  - (B) união `{ data: {…}, error?: undefined } | { data: {}, error: string }`, que modela também o `data` esvaziado na falha.
- **Escolha:** A
- **Justificativa:** B é mais fiel. Na falha, o `RetornoHelper` troca `data` por `{}` ([ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)), e o tipo continua dizendo que `data.docZip` sempre existe. Mas B quebra o código de todo consumidor TS que lê `data` sem checar `error` antes, e precisa de um desenho próprio. Fica para outra tarefa, se houver interesse. Esta tarefa só corrige o que está errado sem mudar a forma do tipo, e alinha a NF-e ao que a NFS-e já declara.

### Decisão 3: teste pela API do compilador, dentro do mocha

- **Opções consideradas:**
  - (A) `test/tipos.test.js` usando `require('typescript')`;
  - (B) script `npm run test:tipos` com `tsc -p test/tsconfig.json`, mais um passo no `testes.yml`;
  - (C) dependência nova, como `tsd` ou `expect-type`.
- **Escolha:** A
- **Justificativa:** o `typescript` já é dependência de dev, que o build usa. A não acrescenta pacote ([ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md)) nem passo de CI, e entra no `test:ci` e no `npm test` como qualquer outro arquivo. B exigiria mexer no workflow e um `tsconfig` a mais. C é dependência para algo que a API do compilador faz em poucas linhas.

Como o teste funciona:

1. Lê o [tsconfig.json](../../../tsconfig.json) do projeto com `ts.readConfigFile` + `ts.parseJsonConfigFileContent`. Assim o `.d.ts` sai com as mesmas opções do `npm run types`, e não com uma cópia delas que poderia divergir.
2. Sobrescreve só `outDir`, que passa a ser um diretório temporário de `fs.mkdtempSync(path.join(os.tmpdir(), 'bitmde-tipos-'))`, e `skipLibCheck: true`. Não usa `dist/`: o `test:ci` roda sem build, e `npm run build` limpa `dist/`. `skipLibCheck` só deixa de checar os `.d.ts` de `node_modules` e não muda o que é emitido. No protótipo, o tempo caiu de ~15 s para ~5 s.
3. Emite (`program.emit()`) e afirma zero diagnósticos no emit.
4. Cria um segundo programa só com a fixture `test/fixtures/consumidor-tipos.ts`, com `strict: true`, `noEmit: true`, `skipLibCheck: true` e `paths: { '@bitize/bitmde': [<tmp>/index.d.ts] }`. A fixture importa o pacote como um consumidor faria.
5. Afirma `ts.getPreEmitDiagnostics(...)` vazio. Na falha, a mensagem do `assert` lista os diagnósticos já formatados, com arquivo, linha e texto (`ts.formatDiagnostics`), para o erro ser legível na CI.
6. Apaga o diretório temporário no `after`, com `fs.rmSync(…, { recursive: true, force: true })`.

O `describe` define `this.timeout(30000)`, porque o emit passa dos 2 s padrão do mocha.

O protótipo dessa abordagem, rodado contra a `main`, reproduziu os erros da tabela de [Impacto verificado](#impacto-verificado). O teste precisa nascer **vermelho** antes da correção do JSDoc.

### Decisão 4: o que a fixture cobre

A fixture é um `.ts` em `test/fixtures/` (o mocha só carrega `.js` de `test/`, então ela não roda como teste). Ela declara o retorno com `declare const` e usa `Awaited<ReturnType<…>>` em todos os métodos públicos afetados: `DistribuicaoDFe.consultaUltNSU`, `consultaNSU` e `consultaChNFe`; `DistribuicaoCTe` e `DistribuicaoMDFe` em `consultaUltNSU` e `consultaNSU`; e `RecepcaoEvento.enviarEvento`. Todos passam pelo mesmo controller, mas a tipagem de cada um é emitida separadamente em `dist/apis/*.d.ts`.

Casos que precisam compilar:

- `docZip.length === 0` e `docZipErrors.length === 0`;
- `docZip[1]` e `infEvento[1]`;
- `const lote: Retorno['data']['docZip'] = []`, o mesmo para `docZipErrors` e `infEvento`, e a atribuição de um `Array<…>` de vários itens;
- um retorno de sucesso **sem** `error`, nas quatro APIs;
- `if (r.error) { const msg: string = r.error }`, o estreitamento que continua funcionando.

Casos marcados com `// @ts-expect-error`, para o teste reprovar se o tipo degradar para `any`. Sem eles, a fixture compilaria contra um `.d.ts` frouxo demais:

- `const n: number = r.error` — `error` continua sendo `string | undefined`;
- `const n: number = r.data.docZip` — `docZip` continua sendo array de objeto;
- `r.data.docZip[0].inexistente` — o elemento continua tendo forma fechada;
- `const e: string = r.error` — falha em `strict`, o que prova que `error` é opcional.

O teste não compara o `.d.ts` como snapshot: qualquer mudança legítima de JSDoc o quebraria, e o que interessa é o que o consumidor consegue escrever.

### Decisão 5: classificar como correção, com nota de compatibilidade

A mudança acompanha o que o README já documenta e o que o runtime sempre fez. Mesmo assim, ela pode **reprovar a compilação** de consumidor TS em dois casos:

- código que atribui `r.error` a `string` sob `strictNullChecks`;
- projeto com `noUncheckedIndexedAccess`, onde `docZip[0]` deixa de ser `T` e passa a `T | undefined`, porque a tupla garantia o índice 0.

Os dois são casos em que o tipo antigo mentia: `error` vinha `undefined` no sucesso, e `docZip[0]` vinha `undefined` no lote vazio. A entrada do `CHANGELOG.md` vai em `### Corrigido`, com um parágrafo de compatibilidade que cita os dois casos. A versão do release é decidida pelo [release.md](../../arquitetura/release.md); como a compilação pode quebrar, a sugestão é um minor, e não um patch.

Nenhuma decisão aqui pede ADR. A Decisão 3 fecha, só para o formato de retorno, a lacuna que o [ADR 0006](../../arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md) descreve ("JSDoc que compila e está **errado**, não [reprova]"). Isso não contraria o ADR, que é aceito e não se edita. A cobertura nova fica registrada em [build-e-versao.md](../../arquitetura/build-e-versao.md).

---

## Impacto por camada

### [helpers / controllers] (`src/helpers/`, `src/controllers/`)

- Nenhum campo novo no retorno e nenhuma linha de código executável muda: só os blocos `@returns`.
- `distribuicaoDFe-controller.js`, `enviar`: `docZip:[{…}]` → `docZip: Array<{…}>`, `docZipErrors:[{…}]` → `docZipErrors: Array<{…}>`, `error: string` → `error?: string`.
- `distribuicaoDFe-helper.js`, `montarResponse`: as mesmas três trocas. O `@returns` de `abrirDocZip` já está certo e fica como está.
- `recepcaoEvento-controller.js`, `enviar`: `infEvento:[{…}]` → `infEvento: Array<{…}>`, `error: string` → `error?: string`.
- `recepcaoEvento-helper.js`, `montarResponse`: as mesmas duas trocas.
- O `RetornoHelper` tem `@returns` vazio e fica como está: o tipo público sai do controller.

### [apis] (`src/apis/`)

- Sem mudança de código nem de JSDoc. O tipo de retorno dos métodos muda no `.d.ts` porque é inferido do controller.
- **Quebra a API pública?** Não em runtime. Em tipo, ver a Decisão 5.

### [test] (`test/`)

- Novo `test/tipos.test.js`, conforme a Decisão 3.
- Nova fixture `test/fixtures/consumidor-tipos.ts`, conforme a Decisão 4. Ela passa pelo Prettier (`.ts` não está no `.prettierignore`).
- O teste não lê `certs/` e não acessa rede.

---

## Testes

- [x] `test/tipos.test.js` **vermelho** contra o JSDoc atual, antes da correção, reproduzindo os erros de [Impacto verificado](#impacto-verificado)
- [x] `test/tipos.test.js` verde depois da correção
- [x] Cada `// @ts-expect-error` da fixture confirmado: trocar o tipo por `any` provisoriamente faz o teste reprovar com TS2578 (diretiva não usada)
- [x] `npx mocha test/tipos.test.js` roda sem `certs/`
- [x] Runtime intacto (RF-06): `npm run script` na `main` e na branch, e `lib/` comparado arquivo a arquivo. O UglifyJS remove comentários, então a saída tem de ser idêntica
- [x] Suíte atual inteira verde, sem nenhum teste alterado

## Checklist de implementação

- [x] JSDoc dos dois controllers e dos dois helpers corrigido
- [x] `test/tipos.test.js` e `test/fixtures/consumidor-tipos.ts`
- [x] [README.md](../../../README.md) conferido: já documenta `error?` e lote de tamanho variável, nada a mudar
- [x] `CHANGELOG.md` em `[Não publicado]`, `### Corrigido`, com a nota de compatibilidade da Decisão 5
- [x] [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md): linha de `tipos.test.js` na tabela de arquivos, o arquivo na lista "Sem `certs/`" e as contagens de testes atualizadas ("271 dos 293")
- [x] [build-e-versao.md](../../arquitetura/build-e-versao.md), seção `npm run types`: o formato de retorno passa a ser conferido por `tipos.test.js`, e o resto do JSDoc continua dependendo de disciplina
- [x] [controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md), "Ao mexer aqui": campo repetível no retorno se declara como `Array<…>`, nunca como `[{…}]`, e a fixture de tipos acompanha o campo novo
- [x] `CLAUDE.md`: `test/tipos.test.js` na lista dos que rodam sem `certs/` e as contagens "271 dos 293" atualizadas
- [x] ADR: não se aplica (ver a Decisão 5)

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [x] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — não rodado: `certs/` já existe na máquina, com A1 real
- [x] `npm run test:ci` — 250 passando, rodado como `npx mocha --timeout 15000 --ignore test/sefaz.test.js --ignore test/tls-sefaz.test.js` (ver Notas)
- [ ] `test/sefaz.test.js` — dispensado: a tarefa não toca transporte, certificado nem assinatura
- [x] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [x] `dist/apis/distribuicaoDFe-api.d.ts`, `distribuicaoCTe-api.d.ts`, `distribuicaoMDFe-api.d.ts` e `recepcaoEvento-api.d.ts` conferidos: `Array<…>` e `error?: string`
- [x] `git status` limpo, exceto o que a tarefa mudou de propósito (`src/env/version.js` não muda: a versão não é bumpada aqui)

## Notas de implementação

Sem desvios de escopo, requisito ou decisão. Detalhes que a especificação não fixava:

- **Commit da especificação.** O arquivo da tarefa foi criado direto em `especificadas/`, sem passar por `rascunhos/`, e foi commitado como primeiro commit da branch de implementação (`docs: especifica a tarefa GH-29`), e não num PR de docs separado.
- **Fixture.** Os retornos da distribuição são conferidos de duas formas: pela união dos sete métodos (`RetornoDistribuicao`) nos casos de uso, e um por um no retorno de sucesso sem `error`, porque cada classe é emitida no próprio `dist/apis/*.d.ts`. Há sete `@ts-expect-error`: quatro na distribuição (`error` como `number`, `error` como `string`, `docZip` como `number`, propriedade inexistente no item) e três na recepção (os mesmos, sem o da propriedade).
- **Vermelho antes da correção.** Contra o JSDoc da `main` (`1ef6a9a`), o teste reprovou com TS2367 (`length` `1` vs `0`), TS2339/TS2493 (índice 1), TS2322 (`[]` e arrays de 2 e 3 itens nos três campos), TS2578 nas duas diretivas de `error` como `string` e TS2322 em cada retorno de sucesso.
- **`@ts-expect-error` contra `any`.** Com `docZip`, `infEvento` e `error` trocados por `any` nos dois controllers, o teste reprovou com TS2578 nas sete diretivas. Os controllers foram restaurados em seguida.
- **Sem `certs/`.** O teste foi rodado a partir de um diretório sem `certs/`, com o caminho absoluto do arquivo. Ele resolve tudo por `__dirname`, então não depende do CWD.
- **Runtime.** O `lib/` gerado na `main` e na branch foi comparado com `diff -r`: idêntico nos 55 arquivos.
- **`npm run test:ci` na máquina local.** O `certs/` local tem A1 real, e com o timeout padrão do mocha os testes de construtor com PFX estouram os 2000 ms (6 falhas numa execução e 11 na seguinte, todas `Timeout of 2000ms exceeded` em `distribuicao*.test.js` e `recepcao.test.js`). É o comportamento que o `CLAUDE.md` documenta. Com `--timeout 15000`, os 250 passam. A CI roda com o certificado descartável, que não tem esse custo.
- **Contagens.** A suíte foi de 293 para 294 testes, e o `test:ci` de 249 para 250. Com o certificado descartável, ficam liberados 272 dos 294.
- **Âncora.** Os links para a seção nova de `testes-e-certificados.md` usam `#tipostestjs`, o slug do GitHub para `` ### `tipos.test.js` ``.

### Revisão automática (CodeRabbit, PR #30)

- **Aplicado:** o teste só checava os diagnósticos do emit. Opção inválida no `tsconfig.json` cai em `projeto.errors`, o emit sai mesmo assim, e o teste passaria com opções diferentes das do `npm run types`, que reprova. O teste passou a checar também o `error` do `readConfigFile`, o `projeto.errors` e o `ts.getPreEmitDiagnostics` do programa de emit. Para conferir, uma opção inexistente no `tsconfig.json` agora reprova o teste com TS5023, e o `tsconfig.json` foi restaurado em seguida. O tempo do teste subiu de ~5 s para ~7 s, ainda dentro do `this.timeout(30000)`. Ajuste dentro da Decisão 3, sem mudar o escopo.

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [x] Desvios registrados em "Notas de implementação"
- [x] Checklists marcados. Ficam desmarcados, com o motivo ao lado, o `certs:teste` (o `certs/` local tem A1 real) e o `sefaz.test.js` (dispensado pela tarefa)
- [x] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [x] Arquivo movido: `git mv .docs/tarefas/especificadas/GH-29-tipos-de-retorno-da-dfe-e-da-recepcao.md .docs/tarefas/concluidas/GH-29-tipos-de-retorno-da-dfe-e-da-recepcao.md`
- [x] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [x] Issue fechada no GitHub e no Linear

## Referências

- [Visão geral e invariantes](../../arquitetura/README.md)
- [camadas/apis.md](../../arquitetura/camadas/apis.md) — seção Tipagem
- [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md)
- [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md)
- [build-e-versao.md](../../arquitetura/build-e-versao.md) — `npm run types`
- [ADR 0003 — lockfile versionado](../../arquitetura/decisoes/0003-lockfile-versionado.md)
- [ADR 0004 — erro de configuração lança, erro de rede retorna](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)
- [ADR 0006 — JS com JSDoc em vez de TypeScript](../../arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md)
- [ADR 0013 — falha de docZip vira item de docZipErrors](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md)
- [ADR 0016 — retorno próprio da NFS-e](../../arquitetura/decisoes/0016-retorno-proprio-da-nfse.md)
- Issue: https://github.com/bitize/bitmde/issues/29
- Linear: [DEV-1113](https://linear.app/bitize/issue/DEV-1113)

## Histórico de revisões

| Data       | Rev | Descrição                                                              |
| ---------- | --- | ---------------------------------------------------------------------- |
| 2026-10-18 | 1.0 | Criação da especificação                                               |
| 2026-10-18 | 1.1 | Implementação e notas                                                  |
| 2026-10-18 | 1.2 | Entregue no PR #30 (merge `c93c177`); tarefa movida para `concluidas/` |
