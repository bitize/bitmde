# 0011 — `files` e `exports` como contrato de empacotamento

**Status**: Aceito
**Data**: 2026-08-16

> Numeração: o 0010 está reservado pela tarefa [GH-3](../../tarefas/concluidas/GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md), que já o referencia em texto commitado. Números de ADR não se reutilizam nem se renumeram.

## Contexto

Até a 0.15.0 o `package.json` não declarava `files` nem `exports`. Duas perguntas ficavam sem dono:

**O que vai no pacote?** Respondia o `.npmignore`, uma denylist. A precedência do npm é `files` > `.npmignore` > `.gitignore`: com o `.npmignore` presente, o `.gitignore` era ignorado por completo no empacotamento.

Denylist só acerta enquanto alguém lembra de alimentá-la, e ninguém lembrou. O tarball da 0.15.0 saiu com `CLAUDE.md` (13,8 kB de instrução interna de agente, incluindo o processo de release e credencial), `AGENTS.md`, `.prettierignore`, `CODE_OF_CONDUCT.md` e `CONTRIBUTING.md` — todos criados depois do `.npmignore`. O [build-e-versao.md](../build-e-versao.md) já avisava que pasta com ponto não é excluída por padrão pelo npm, e mesmo assim a lista envelheceu.

Havia um segundo risco, mais grave e sem sintoma. O `.gitignore` lista `lib` e `dist` — é o `.npmignore` que, ao existir, mantém os dois no pacote. Apagar o `.npmignore` por parecer redundante faria o `.gitignore` assumir, e o pacote passaria a ser publicado **sem código nenhum**, sem falhar em nenhum passo do release: os testes rodam sobre `src/`, o build gera os diretórios, o `npm publish` sobe um tarball válido e vazio. A quebra só apareceria em quem instalasse — e versão no npm não se reescreve ([release.md](../release.md)).

**O que é API pública?** Não respondia ninguém. Sem `exports`, `require('@bitize/bit-mde/lib/validators/nsu-validator')` era importação legal. Todo módulo de `lib/` e todo `.d.ts` de `dist/` eram superfície pública de fato, o que amarra qualquer reorganização de arquivo dentro de `src/` a um breaking change — enquanto o [README.md](../../../README.md) só documenta a entrada pela raiz.

## Alternativas consideradas

**Manter o `.npmignore` e completar a lista.** Corrige os cinco arquivos de hoje e não corrige o mecanismo: o sexto arquivo criado na raiz volta a vazar. É o conserto que já foi feito implicitamente duas vezes e não pegou.

**Declarar `files` e manter o `.npmignore` como segunda camada.** Redundância que parece defesa em profundidade e não é: `files` tem precedência, e o `.npmignore` vira letra morta para seleção de topo. Quem abrir o `.npmignore` para saber o que é publicado lê a resposta errada. Duas fontes de verdade para a mesma pergunta é o mecanismo pelo qual documentação apodrece — a regra do [ESTRUTURA.md](../ESTRUTURA.md) vale também para configuração.

**Substituir `main` e `types` por `exports`.** Mais limpo no papel. Bundler antigo e ferramenta que lê o `package.json` sem resolver condições ainda entram por `main`; remover não ganha nada e quebra caso de borda.

**Congelar a lista de arquivos do tarball como snapshot na CI.** `lib/` espelha `src/`, então o snapshot quebraria a cada arquivo novo do fonte. Viraria ruído de manutenção, atualizado no reflexo, sem ninguém ler o diff — que é o oposto de um guard.

## Decisão

**`files` como allowlist, `exports` como superfície pública, `.npmignore` removido, e um guard por regra na CI de publicação.**

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

Três detalhes são load-bearing:

- `package.json`, `README.md` e `LICENSE` entram sempre, independente do `files`. `CHANGELOG.md` **não** — o npm não o inclui por conta própria, então a entrada no `files` é o único motivo de ele estar no pacote. Verificado empacotando com `files` reduzido a `lib/` e `dist/`: o tarball sai sem ele.
- `"./package.json": "./package.json"` é obrigatório. Sem essa entrada, o `exports` bloqueia a leitura do próprio manifesto, que várias ferramentas fazem.
- `types` vem **antes** de `require` e `default`. O TypeScript resolve pela primeira condição que casa.

`main` e `types` continuam declarados, para quem não entende `exports`. Os dois caminhos levam ao mesmo destino.

O guard em [publicar.yml](../../../.github/workflows/publicar.yml) roda depois do build e reprova o release se o tarball contiver caminho proibido (`src/`, `test/`, `scripts/`, `certs/`, `.docs/`, `.github/`, `.vscode/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.prettierignore`, `package-lock.json`, `tsconfig.json`, `prettier.config.js`) ou perder caminho essencial (`lib/index.js`, `dist/index.d.ts`, `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`). Por regra, não por lista congelada — só fala quando algo saiu mesmo do lugar, e cobre inclusive alguém remover o `files`.

## Consequências

**Fica mais fácil:**

- Responder "o que vai no pacote?" lendo um campo do `package.json`, e só ele;
- Criar diretório ou arquivo novo na raiz sem risco de vazá-lo — a regra de manutenção do `.npmignore` deixa de existir;
- Reorganizar arquivos dentro de `src/` sem quebrar consumidor, porque só a raiz é importável;
- Descobrir um empacotamento errado **antes** da publicação, em vez de depois.

**Fica mais difícil:**

- Publicar arquivo novo de propósito exige acrescentá-lo ao `files` — silêncio agora significa exclusão, não inclusão;
- Deep import deixa de resolver, com `ERR_PACKAGE_PATH_NOT_EXPORTED`. Nenhum uso documentado quebra, mas quem tiver contornado a API pública precisa passar pela raiz;
- O guard tem duas listas a manter quando o layout do pacote mudar de propósito.

**Compromisso de longo prazo:**

- **Não reintroduzir `.npmignore`.** Com `files` presente ele não decide seleção de topo, e existir só cria a dúvida sobre qual dos dois manda;
- **`publishConfig.access: "public"` permanece** — pacote escopado nasce `restricted` ([release.md](../release.md));
- Arquivo novo destinado ao consumidor entra no `files` **e** sai da lista de proibidos do guard, se estiver nela;
- O [ADR 0003](0003-lockfile-versionado.md) cita o `.npmignore` como o mecanismo que mantém o `package-lock.json` fora do pacote. Essa referência passa a ser **histórica**: o lockfile continua fora do pacote, agora por omissão do `files`, e a decisão do 0003 — versionar o lockfile e usar `npm ci` — segue valendo integralmente. Lá só se desfez o hyperlink que apontava para o arquivo removido; o texto e a decisão ficaram intactos, respeitando a regra de [decisoes/README.md](README.md) de não editar ADR aceito.
