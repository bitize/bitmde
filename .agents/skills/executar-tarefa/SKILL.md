---
name: executar-tarefa
description: Implementa uma tarefa já especificada em .docs/tarefas/especificadas/ do bitmde até o PR mergeado e a tarefa concluída — branch, implementação contra a especificação, desvios, validação pré-PR, PR e conclusão. USE WHEN o pedido for implementar, executar, codar, fazer, tocar, pegar ou concluir uma tarefa GH-NN deste repositório, ou abrir o PR dela. Trigger words - executar tarefa, implementar tarefa, implementar GH-, fazer a GH-, pegar a tarefa, concluir tarefa, fechar tarefa, abrir PR da tarefa, execute task, implement task, work on GH-.
---

# Executar tarefa — bitmde

Procedimento executável. O **formato** da tarefa e o que preencher ao concluir ou cancelar estão em [.docs/tarefas/README.md](../../../.docs/tarefas/README.md) e no [modelo](../../../.docs/tarefas/_modelos/modelo-de-tarefa.md) — ler de lá, não reproduzir aqui. Esta skill cobre o que **fazer** entre "a tarefa está especificada" e "a tarefa está em `concluidas/`", e as decisões que costumam sair erradas.

A especificação é o contrato. Implementar é cumprir a tarefa como escrita, registrando todo desvio — não reinterpretá-la em silêncio.

Tarefa filha de plano é executada por aqui também; a skill [executar-plano](../executar-plano/SKILL.md) só decide **qual** filha vem e o que muda no plano entre uma e outra.

---

## Passo 0 — Pré-condições

Conferir antes de criar branch. Qualquer "não" para aqui e vira pergunta ao usuário:

- **A tarefa está em `especificadas/`.** Em `rascunhos/` ela ainda não foi aceita: especificar e promover primeiro, pela skill [criar-tarefa](../criar-tarefa/SKILL.md). Implementar rascunho é implementar sem contrato.
- **A tarefa ainda não foi entregue.** Procurar PR dela antes de começar — tarefa mergeada e nunca concluída existe no histórico (a GH-4 ficou assim):

  ```bash
  gh issue view "$NN" --json state,closedByPullRequestsReferences
  gh pr list --state all --search "GH-$NN"
  ```

  Nenhum dos dois cobre tudo: o primeiro só acha PR com `Closes #NN` no corpo; o segundo é texto livre e traz também PR que só cita a tarefa e o de conclusão (`docs: conclui…`). Filtrar à mão.
  - PR de implementação **aberto** → retomar pelo Passo 6, não abrir outro.
  - PR de implementação **mergeado** → a tarefa foi entregue e não concluída: confirmar com o usuário e ir direto ao Passo 7.
  - Issue fechada sem PR de entrega → perguntar: pode ter sido cancelada sem registro.

- **Filha de plano: as dependências estão mergeadas.** Cada filha da coluna "Depende de" na tabela do plano precisa estar em `concluidas/` — PR aberto não basta, porque a branch nasce da `main`.
- **Working tree limpo e `main` atualizada** (`git status`, `git pull`).

## Passo 1 — Ler antes de codar

1. A tarefa **inteira**, inclusive Decisões de design e Notas de implementação já preenchidas.
2. As fontes da verdade marcadas no cabeçalho e os ADRs de **Referências**. A tabela "A tarefa mexe em… / Ler" do Passo 2 da [criar-tarefa](../criar-tarefa/SKILL.md) vale aqui: se a implementação vai tocar uma camada que a especificação não marcou, ler o doc dela também.
3. Filha de plano: o **Objetivo** e as **Decisões transversais** do plano.
4. O código e os testes das camadas tocadas, conferindo se a especificação ainda descreve o código atual. Tarefa especificada há tempo pode ter envelhecido — outra tarefa mergeada no meio muda a premissa (foi o caso da GH-3 depois da GH-11). Divergência aqui é desvio do Passo 3, antes da primeira linha.

## Passo 2 — Branch

```bash
git switch -c <tipo>/gh-NN-descricao-curta main
```

`<tipo>` segue o **Tipo** do cabeçalho: `feat` (feature), `fix` (correção), `chore` (dependências, infraestrutura), `docs` (documentação). Infraestrutura que só mexe em `.github/workflows/` pode usar `ci`; com workflow e mais alguma coisa, `chore`. A descrição é a do nome do arquivo, encurtada se precisar.

Uma tarefa, uma branch, um PR. Não empilhar branch sobre branch de outra tarefa não mergeada.

## Passo 3 — Implementar

**Os testes da seção Testes vêm primeiro.** Cada item vira teste que falha, depois código que o faz passar — REQUIRED SUB-SKILL: `test-driven-development`. Mensagem de erro nova entra no teste com o **texto exato** da especificação.

As armadilhas listadas no Passo 3 da [criar-tarefa](../criar-tarefa/SKILL.md) foram escritas para a especificação e continuam valendo na implementação — mensagem literal, ordem das chaves do schema, recorte por `indexOf` da recepção, `|| ''` no retorno, `tpAmb` string, objeto congelado chegando ao service. Reler antes de começar.

### Desvio da especificação

Toda divergência entre o que foi entregue e o que está escrito é desvio, inclusive a que parece melhoria. O critério é **quem precisa decidir**:

| Situação                                                                                                                                           | O que fazer                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Detalhe de implementação que a especificação não fixou (nome de função interna, arquivo onde um helper mora, teste a mais)                         | Decidir e registrar em **Notas de implementação**                                                                              |
| Muda requisito, assinatura pública, formato de retorno, **texto de mensagem de erro**, decisão de design da tarefa ou decisão transversal do plano | **Parar e perguntar.** Aprovado, atualizar a seção correspondente da tarefa (e do plano) e registrar nas Notas                 |
| Contraria uma invariante ou um ADR aceito                                                                                                          | **Parar e perguntar.** Aprovado, ADR novo que supersede o antigo — ADR aceito não se edita                                     |
| Trabalho útil fora do escopo da tarefa (refatoração vizinha, bug encontrado de passagem)                                                           | Não entra no PR. Vira tarefa nova em `rascunhos/` ou é anotado para o usuário. Só entra se ele pedir, e aí é desvio registrado |
| A tarefa se mostra obsoleta ou errada na premissa                                                                                                  | Parar e perguntar se cancela — fluxo de cancelamento em [.docs/tarefas/README.md](../../../.docs/tarefas/README.md)            |

### O que vai no mesmo PR

O PR de implementação leva junto, quando aplicável — separar em PR seguinte deixa a `main` com documentação mentindo:

- `CHANGELOG.md` em `[Não publicado]`, na subseção certa (Adicionado, Modificado, Corrigido, Removido, Segurança). Quebra de comportamento ganha destaque e nota de compatibilidade.
- JSDoc de `src/apis/` e dos controllers, `README.md`, doc de camada em `.docs/arquitetura/`.
- ADR novo prometido pela tarefa ou pelo plano, com a linha na tabela de [decisoes/README.md](../../../.docs/arquitetura/decisoes/README.md). Usar o número que a especificação reservou; número de ADR não se reutiliza.
- `CLAUDE.md`, se a tarefa muda uma regra que quebra build, teste ou release.
- `package.json` **e** `package-lock.json` no mesmo commit, em bump de dependência.
- **O próprio arquivo da tarefa**, que continua em `especificadas/`: checklists de Fontes da verdade, Testes, Implementação e Validação pré-PR marcados conforme o que de fato aconteceu; **Notas de implementação** com os desvios (ou "Sem desvios"), as contagens de teste antes/depois e o que ficou pendente; **Atualizado em**; linha `1.1 — Implementação e notas` no histórico. O item "Marcar os checklists" do "Ao concluir" do README vira, no Passo 7, só conferência e complemento do que já foi marcado aqui.

O `git mv` para `concluidas/` **não** vai neste PR — só depois do merge (Passo 7).

## Passo 4 — Validação pré-PR

Na raiz, nesta ordem, e só marcar no arquivo da tarefa o que rodou e passou:

```bash
npm run format
npm run test:ci
npm run build
npm pack --dry-run   # se mexeu em package.json, exports ou estrutura de pastas
git status
```

- **`certs/`**: se não existir, `npm run certs:teste`. Se existir, **não** rodar — o script aborta para não sobrescrever um A1 real, e não se contorna isso apagando a pasta.
- **`test/sefaz.test.js`** é obrigatório se a tarefa toca transporte, certificado ou assinatura, e exige A1 válido. Com o `certs/` descartável ele não prova nada: registrar como **pendente** nas Notas e no PR, com o que rodou no lugar, e deixar o item desmarcado. Nunca marcar como feito o que não rodou com A1 real — a GH-14 é o precedente, e o release esperou por ele.
- **`test/tls-sefaz.test.js`**, se a tarefa mexe em host, CA ou cadeia: exige rede, não exige A1.

Falhou? Corrigir e rodar de novo. REQUIRED SUB-SKILL: `verification-before-completion` antes de dizer que está pronto.

## Passo 5 — Commits e PR

Commits em português, com o prefixo do tipo (`feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`), separados por assunto quando ajuda a revisão — código, testes, workflow, documentação. Ver `git log` para o tom.

**Push e PR são externos e o repositório é público: confirmar com o usuário antes.** Conferir que não há certificado, CNPJ de cliente, chave de NF-e/NFS-e real ou XML de produção no diff, nos testes ou no corpo do PR.

```bash
git push -u origin <branch>
gh pr create --base main --title "<tipo>: <resumo> (GH-NN)" --body-file <arquivo>
```

Corpo do PR, no formato dos PRs anteriores (ver `gh pr view 15`):

```markdown
Closes #NN. Especificação: [.docs/tarefas/especificadas/GH-NN-….md](.docs/tarefas/especificadas/GH-NN-….md). Decisões: [ADR NNNN](…).

## Problema

<o que estava errado ou faltando, do ponto de vista de quem consome>

## O que muda

- <mudança, com o porquê quando não é óbvio>

## Validação

- [x] `npm run format:check`
- [x] `npm run test:ci`: <N> passando, antes eram <M>
- [x] `npm run build`
- [ ] `npx mocha test/sefaz.test.js` com A1 real — <rodou e passou | pendente, e por quê>

## Depois do merge

- Concluir a tarefa (Passo 7)
- <workflow a disparar à mão, release, etc.>
```

`Closes #NN` fecha a issue no merge. Filha de plano: **não** escrever `Closes` para a issue do plano — ela é fechada à mão, no fechamento do plano.

## Passo 6 — Revisão

Comentário de revisão (humano ou CodeRabbit) é avaliado, não obedecido — REQUIRED SUB-SKILL: `receiving-code-review`. O que foi aplicado e o que **não** foi, com o motivo, vai nas Notas de implementação e numa seção "Revisão automática" do PR.

Mudança pedida na revisão que altera o escopo é desvio do Passo 3: registrar, e se for grande, perguntar se não é outra tarefa.

**Não mergear por conta própria.** O merge é do usuário.

## Passo 7 — Concluir (depois do merge)

Em branch e PR próprios, de documentação:

```bash
git switch main && git pull
git switch -c docs/conclui-gh-NN
```

Seguir "Ao concluir a tarefa" do [README](../../../.docs/tarefas/README.md) e a checklist "Conclusão e entrega" da própria tarefa. O que é específico da execução:

- **Datas**: **Concluído em** é a data do merge do PR de implementação (`gh pr view X --json mergedAt`), não a de hoje; **Atualizado em** é hoje. Elas só coincidem quando a conclusão sai no mesmo dia.
- **Histórico de revisões**: linha `Entregue no PR #X (merge \`<sha curto>\`); tarefa movida para \`concluidas/\``. Em conclusão atrasada, se o PR de implementação não trouxe a linha `1.1`, não inventá-la depois: a linha de entrega basta.
- **Pendências reais ficam desmarcadas**, com a explicação ao lado (ex.: `sefaz.test.js` com A1 real antes do release). Concluir a tarefa não exige zerar pendência; exige que ela esteja escrita.
- **Retrato fiel vale para o conteúdo, não para link quebrado.** Link que aponta para repositório ou pasta renomeados (`bitize/bit-mde`, `.docs/tasks/`) é corrigido; o texto que descreve o que valia na época fica.
- **Blockquote da issue**, que envelheceu com o `git mv`. Issues antigas apontam para os nomes de pasta de antes da renomeação (`.docs/tasks/specified/`), então o `sed` cobre os dois, e o `grep` impede regravar o corpo sem mudança — se ele não achar o caminho novo, o blockquote está em formato inesperado e é corrigido à mão:

  ```bash
  DESTINO=concluidas   # ou canceladas
  CORPO=$(mktemp)
  gh issue view "$NN" --json body -q .body \
    | sed -E "s#\.docs/(tasks|tarefas)/(specified|especificadas)/#.docs/tarefas/$DESTINO/#" > "$CORPO"
  grep -F ".docs/tarefas/$DESTINO/GH-$NN-" "$CORPO" && gh issue edit "$NN" --body-file "$CORPO"
  ```

- **Issue**: já fechada pelo `Closes #NN`; conferir com `gh issue view`. Se não fechou, `gh issue close "$NN"`.
- **Filha de plano**: atualizar link e status desta tarefa na tabela de filhas do plano, **no mesmo commit** do `git mv`. Se era a última filha aberta, o fechamento do plano segue a [executar-plano](../executar-plano/SKILL.md).
- `npm run format` antes de commitar. PR `docs: conclui a tarefa GH-NN`, também com confirmação do usuário antes do push.

Release **não** faz parte da tarefa: segue [release.md](../../../.docs/arquitetura/release.md), quando o usuário decidir.

---

## Sinais de que a execução está saindo do trilho

- Implementando a partir de rascunho, ou de uma lembrança da tarefa sem tê-la relido.
- "A especificação diz X, mas Y é melhor" — e o código já faz Y, sem pergunta e sem nota.
- Texto de mensagem de erro ajustado "só um pouco" em relação ao especificado.
- Checklist marcado para o que não rodou, ou `sefaz.test.js` dado como passando com o certificado descartável.
- Documentação, `CHANGELOG.md` ou ADR deixados "para um PR de docs depois".
- `git mv` para `concluidas/` antes do merge, ou no PR de implementação.
- Push, PR ou merge feitos sem o usuário ter confirmado.

Qualquer um destes: parar, voltar ao passo correspondente.
