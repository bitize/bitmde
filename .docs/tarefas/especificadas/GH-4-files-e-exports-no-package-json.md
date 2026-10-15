# GH-4: Declarar `files` e `exports` no `package.json`

| Campo                | Valor                                              |
| -------------------- | -------------------------------------------------- |
| **Issue**            | [GH-4](https://github.com/bitize/bit-mde/issues/4) |
| **Status**           | especificadas                                      |
| **Prioridade**       | P1 (alto)                                          |
| **Tipo**             | infraestrutura                                     |
| **Camadas afetadas** | empacotamento / release / CI                       |
| **Criado em**        | 2026-08-16                                         |
| **Atualizado em**    | 2026-08-16                                         |
| **Concluído em**     | —                                                  |

---

## Contexto e motivação

O `package.json` não declara `files` nem `exports`. O conteúdo do pacote publicado é decidido por uma **denylist** — o `.npmignore` — e a superfície de importação é decidida por `main`, que não restringe nada.

Duas consequências, uma já materializada e outra latente.

### O que já está vazando

`npm pack --dry-run` na `main` em 0.15.0 produz 86 arquivos, e entre eles:

| Arquivo              | Tamanho | Por que não deveria estar lá                     |
| -------------------- | ------- | ------------------------------------------------ |
| `CLAUDE.md`          | 13,8 kB | Instruções internas de agente, não do consumidor |
| `AGENTS.md`          | 437 B   | Idem                                             |
| `.prettierignore`    | 243 B   | Configuração de tooling                          |
| `CODE_OF_CONDUCT.md` | 5,3 kB  | Documento do repositório, não do pacote          |
| `CONTRIBUTING.md`    | 762 B   | Idem                                             |

Nenhum deles é segredo — o repositório é público — mas são ~20 kB de ruído que descrevem processo interno, incluindo a seção de release e credencial do `CLAUDE.md`. Entraram porque foram criados depois do `.npmignore` e ninguém lembrou de listá-los, que é exatamente a falha estrutural de uma denylist.

### A falha latente, pior

`.npmignore` não lista `lib` nem `dist` — e é isso que faz o build ser publicado. Mas o [.gitignore](../../../.gitignore) **lista os dois**. A precedência do npm é `files` > `.npmignore` > `.gitignore`: hoje o `.npmignore` existe e o `.gitignore` é ignorado por completo no empacotamento. Se algum dia o `.npmignore` for apagado — por parecer redundante, por conflito de merge, por qualquer motivo — o `.gitignore` assume e o pacote passa a ser publicado **sem `lib/` e sem `dist/`**, ou seja, sem código nenhum.

Não haveria erro em nenhum passo do release: os testes rodam sobre `src/`, o build gera os diretórios normalmente, e o `npm publish` sobe um tarball válido e vazio. A quebra só apareceria em quem instalasse a versão. E versão publicada no npm não se reescreve ([release.md](../../arquitetura/release.md)).

### A superfície de importação

Sem `exports`, `require('@bitize/bit-mde/lib/validators/nsu-validator')` é uma importação legal. Todo módulo interno de `lib/` e todo `.d.ts` de `dist/` são API pública de fato, e qualquer reorganização de arquivo dentro de `src/` vira breaking change para quem tiver feito deep import. O [README.md](../../../README.md) só documenta a importação pela raiz, e é essa a superfície que se pretende manter.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [ ] [apis](../../arquitetura/camadas/apis.md) — sem impacto: nenhuma assinatura muda
- [ ] [validators](../../arquitetura/camadas/validators.md) — sem impacto
- [ ] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — sem impacto
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — sem impacto
- [ ] [services](../../arquitetura/camadas/services-sefaz.md) — sem impacto
- [x] [env](../../arquitetura/camadas/env.md) — só `VERSION`, regenerado pelo build
- [ ] Fluxo: distribuição / recepção — sem impacto
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [x] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md)
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                         | Prioridade |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | `package.json` declara `files` como allowlist do que é publicado                                                  | Must       |
| RF-02 | O tarball publicado contém `lib/`, `dist/`, `package.json`, `README.md`, `LICENSE` e `CHANGELOG.md` — e nada mais | Must       |
| RF-03 | `package.json` declara `exports`, fechando a superfície pública na raiz do pacote                                 | Must       |
| RF-04 | `require('@bitize/bit-mde')` e `import … from '@bitize/bit-mde'` continuam funcionando exatamente como hoje       | Must       |
| RF-05 | `require('@bitize/bit-mde/package.json')` continua resolvendo (usado por ferramentas)                             | Must       |
| RF-06 | `main` e `types` permanecem declarados, para bundler antigo que não entende `exports`                             | Must       |
| RF-07 | `.npmignore` é removido — `files` passa a ser a única fonte de verdade do empacotamento                           | Must       |
| RF-08 | A CI de publicação reprova o release se o tarball ganhar arquivo proibido ou perder arquivo essencial             | Must       |
| RF-09 | `publishConfig.access: "public"` permanece intocado                                                               | Must       |
| RF-10 | Docs de processo atualizados: `CLAUDE.md`, `build-e-versao.md`, `release.md`                                      | Must       |
| RF-11 | Versão bumpada para `0.16.0` e `CHANGELOG.md` com a nota de compatibilidade do `exports`                          | Must       |

## Decisões de design

### Decisão 1: allowlist (`files`) em vez de denylist (`.npmignore`)

- **Opções consideradas:**
  - **A —** manter o `.npmignore` e apenas acrescentar as entradas que faltam (`CLAUDE.md`, `AGENTS.md`, `.prettierignore`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`);
  - **B —** declarar `files` e manter o `.npmignore` como segunda camada;
  - **C —** declarar `files` e remover o `.npmignore`.
- **Escolha:** C.
- **Justificativa:** A corrige os cinco casos de hoje e não corrige o mecanismo — o sexto arquivo criado na raiz volta a vazar, e é o que já aconteceu duas vezes. B deixa duas fontes de verdade para a mesma pergunta, sendo que uma delas (`files`) tem precedência e a outra vira letra morta para seleção de topo — quem ler o `.npmignore` para saber o que é publicado lê a resposta errada. C é o único que faz o `package.json` responder sozinho "o que vai no pacote", e é o que fecha a falha latente do `.gitignore` descrita no contexto.

O `.npmignore` continuaria valendo **dentro** dos diretórios incluídos por `files`, mas `lib/` e `dist/` são gerados e não têm nada a excluir — a segunda camada não protege de nada real.

### Decisão 2: `exports` com `main`/`types` mantidos

- **Opções consideradas:** (A) só `files`, deixando a superfície aberta; (B) `exports` substituindo `main` e `types`; (C) `exports` somado a `main` e `types`.
- **Escolha:** C.
- **Justificativa:** A deixa `lib/**` como API pública de fato e amarra qualquer refatoração interna a um major. B é mais limpo no papel, mas bundler antigo (e ferramenta que lê `package.json` sem resolver condições) ainda entra por `main` — remover não ganha nada e quebra caso de borda. Em C, runtime moderno entra por `exports` e o resto cai em `main`, com o mesmo destino nos dois caminhos.

A entrada `"./package.json": "./package.json"` é obrigatória: sem ela o `exports` bloqueia a leitura do próprio manifesto, que várias ferramentas fazem.

A ordem das condições importa — `types` **antes** de `require` e `default`, porque o TypeScript resolve pela primeira que casa.

### Decisão 3: guard de conteúdo do tarball na CI, por regra e não por snapshot

- **Opções consideradas:** (A) nenhum guard, confiando no `files`; (B) snapshot da lista completa de arquivos, comparada a cada release; (C) asserção por regra — nenhum caminho proibido presente, todos os caminhos essenciais presentes.
- **Escolha:** C.
- **Justificativa:** A é o estado de hoje com outro mecanismo; o `files` torna o acidente improvável, mas o objetivo declarado da tarefa é que ele não passe **silencioso**. B quebra a cada arquivo novo em `src/` — `lib/` espelha `src/`, então o snapshot viraria ruído de manutenção e acabaria sendo atualizado no reflexo, sem ninguém ler o diff. C é estável: só reprova quando algo realmente saiu do lugar, e cobre inclusive o cenário de alguém remover o `files` (o tarball perderia `lib/index.js` e o guard pega).

> Esta é decisão estrutural com reversão custosa — muda o que é o contrato de empacotamento e o que é a superfície pública. Gerar **ADR 0011 — `files` e `exports` como contrato de empacotamento**.
>
> Numeração: o 0010 está reservado pela [GH-3](GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md), que já o referencia em texto commitado. Números de ADR não se reutilizam nem se renumeram.

---

## Impacto por camada

### [empacotamento] (`package.json`, remoção do `.npmignore`)

```jsonc
"files": ["lib/", "dist/", "CHANGELOG.md"],
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "require": "./lib/index.js",
    "default": "./lib/index.js"
  },
  "./package.json": "./package.json"
}
```

- `package.json`, `README.md` e `LICENSE` entram sempre, independente do `files` — não precisam ser listados. `CHANGELOG.md` **precisa**: o npm não o inclui automaticamente, então a entrada no `files` é o único motivo de ele estar no pacote.
- `.npmignore` **removido**.
- `main` (`./lib/index.js`) e `types` (`./dist/index.d.ts`) ficam como estão.
- Nada em `src/` muda. `src/env/version.js` é reescrito pelo build por causa do bump, não por causa desta tarefa.

### [CI / release] (`.github/workflows/publicar.yml`)

- Passo novo entre **Build** e **Publicar no npm** — precisa vir depois do build, porque antes dele `lib/` e `dist/` não existem.
- Reprova se o tarball contiver `src/`, `test/`, `scripts/`, `.docs/`, `.github/`, `certs/`, `CLAUDE.md`, `AGENTS.md` ou `.prettierignore`.
- Reprova se faltar `lib/index.js` ou `dist/index.d.ts`.
- Não renomear o arquivo do workflow: o nome faz parte da identidade verificada pelo trusted publisher ([ADR 0002](../../arquitetura/decisoes/0002-publicacao-por-oidc-sem-npm-token.md)).

### [dependências]

- Nenhuma. `package.json` muda sem mexer em `dependencies`, então `package-lock.json` não é tocado — a regra dos dois arquivos do [ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md) não se aplica aqui.
- O ADR 0003 menciona o `.npmignore` como o mecanismo que mantém o lockfile fora do pacote. ADR aceito não se edita: a mudança de mecanismo fica registrada no ADR 0011, e o lockfile continua fora do pacote — agora por omissão do `files`.

---

## Testes

Não há teste unitário a escrever: nada em `src/` muda, e o comportamento afetado é o do `npm pack`, que não é código deste repositório.

- [x] `npm run test:ci` continua verde — regressão, garante que a mudança de `package.json` não afetou o runtime — **65 passing**
- [x] `npm pack --dry-run` conferido à mão: lista bate exatamente com RF-02 — **82 arquivos**, contra 86 na 0.15.0
- [x] `require` da raiz a partir do tarball empacotado, não da árvore de trabalho — `npm pack` e instalação do `.tgz` num diretório limpo
- [x] Deep import (`@bitize/bit-mde/lib/index.js`) confirmado como **bloqueado** depois do `exports` — `ERR_PACKAGE_PATH_NOT_EXPORTED`
- [x] `require('@bitize/bit-mde/package.json')` confirmado como **permitido**
- [x] `test/sefaz.test.js` — não se aplica: a tarefa não toca transporte, certificado nem assinatura

Verificado também, no tarball instalado: `import` de ESM (default e nomeados) e as três formas de export (`module.exports`, `.default`, `.mde`). E o guard da CI, extraído do YAML já dedentado, rodado nos dois sentidos — passa no pacote real e reprova um `pacote.json` forjado com `CLAUDE.md`, `src/` e sem `lib/index.js`.

## Checklist de implementação

- [x] `files` e `exports` no `package.json`
- [x] `.npmignore` removido
- [x] Guard de conteúdo do tarball em `.github/workflows/publicar.yml`
- [x] [CLAUDE.md](../../../CLAUDE.md) — seção de release passa a descrever `files`, não `.npmignore`
- [x] [build-e-versao.md](../../arquitetura/build-e-versao.md) — seção "O que vai no pacote" reescrita
- [x] [release.md](../../arquitetura/release.md) — tabela do workflow com o passo novo
- [x] ADR 0011 criado e registrado na tabela de [decisoes/README.md](../../arquitetura/decisoes/README.md)
- [x] `CHANGELOG.md` com a seção `## [0.16.0]`
- [x] `version` do `package.json` em `0.16.0` e `npm run build` rodado (regenera `src/env/version.js`)
- [x] `README.md` — **sem alteração**: a importação documentada é pela raiz e continua idêntica

## Validação pré-PR (obrigatório)

- [x] `npm run format`
- [x] `npm run test:ci`
- [x] `npm run build`
- [x] `npm pack --dry-run` conferido contra RF-02
- [x] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

- **Dois arquivos fora do checklist precisaram entrar.** `.docs/README.md` tinha link vivo para `../.npmignore`, que a remoção matou. Corrigido para apontar o `files` do `package.json`. A especificação só previa `CLAUDE.md`, `build-e-versao.md` e `release.md`.
- **Link morto no [ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md), resolvido em review.** A remoção do `.npmignore` matou o hyperlink da frase que explica como o lockfile fica fora do pacote. Levantei como ponto em aberto, porque editar ADR aceito é contra a regra de [decisoes/README.md](../../arquitetura/decisoes/README.md); o review decidiu desfazer só o hyperlink. `.npmignore` virou código inline no mesmo lugar — palavras idênticas, texto e decisão intactos. O ADR 0011 registra que aquela referência agora é histórica.
- **ADR numerado 0011, não 0010**, porque a [GH-3](GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md) já reserva o 0010 em texto commitado. A tabela de [decisoes/README.md](../../arquitetura/decisoes/README.md) ganhou nota explicando o salto.
- **Guard da CI: o caminho do JSON vai por variável de ambiente, não por argumento.** A primeira versão lia `process.argv[1]`, que num script vindo do stdin (`node - arquivo`) vale `'-'` e não o argumento — o arquivo fica em `process.argv[2]`. Trocado por `process.env.PACOTE_JSON`, que não depende dessa sutileza.
- **`CHANGELOG.md` faltava na lista de essenciais do guard**, apontado em review do PR.

  A primeira versão exigia cinco caminhos: `lib/index.js`, `dist/index.d.ts`, `package.json`, `README.md` e `LICENSE`. Todos os cinco chegam ao pacote sem depender de o `files` os nomear — `package.json`, `README.md` e `LICENSE` porque o npm sempre os inclui, `lib/` e `dist/` porque a entrada do `files` que os cobre é a mesma que faz o pacote ter código. Nenhum deles isolava a falha de alguém mexer no `files`.

  O guard atual exige seis, com `CHANGELOG.md` acrescentado. Ele é o único caso em que a entrada no `files` é o **único** motivo de o arquivo estar no pacote: o npm não o inclui automaticamente. Confirmado empacotando com `files` reduzido a `["lib/", "dist/"]` — o tarball sai com `LICENSE`, `README.md` e `package.json`, sem o `CHANGELOG.md`. Sem essa entrada na lista, tirar o `CHANGELOG.md` do `files` seria uma regressão que passaria pelo guard.

- Sem outros desvios. Nenhum arquivo de `src/` foi editado à mão: `src/env/version.js` mudou só pelo build, por causa do bump.

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [ ] Arquivo movido para `.docs/tarefas/concluidas/`
- [ ] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [ ] Issue fechada no GitHub
- [ ] Release `v0.16.0` criado no GitHub — é o que dispara a publicação no npm

## Referências

- [build e versão](../../arquitetura/build-e-versao.md) e [release](../../arquitetura/release.md)
- [ADR 0002 — publicação por OIDC sem `NPM_TOKEN`](../../arquitetura/decisoes/0002-publicacao-por-oidc-sem-npm-token.md)
- [ADR 0003 — lockfile versionado](../../arquitetura/decisoes/0003-lockfile-versionado.md)
- npm — `files`: <https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files>
- Node.js — campo `exports`: <https://nodejs.org/api/packages.html#exports>
- Issue: <https://github.com/bitize/bit-mde/issues/4>

## Histórico de revisões

| Data       | Rev | Descrição                |
| ---------- | --- | ------------------------ |
| 2026-08-16 | 1.0 | Criação da especificação |
