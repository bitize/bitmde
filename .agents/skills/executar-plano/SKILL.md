---
name: executar-plano
description: Conduz a execução de um plano já especificado em .docs/planos/especificados/ do bitmde — situação real das filhas, escolha da próxima pela ordem e dependências, revisão do plano entre uma filha e outra, verificação do objetivo e fechamento. USE WHEN o pedido for executar, tocar, continuar, retomar, acompanhar ou fechar um plano ou épico GH-NN deste repositório, ou perguntar qual é a próxima tarefa de um plano. Trigger words - executar plano, tocar o plano, continuar o plano, próxima filha, próxima tarefa do plano, status do plano, concluir plano, fechar plano, épico, epic, execute plan, next subtask.
---

# Executar plano — bitmde

Procedimento executável. O **formato** do plano, a relação com as filhas e o que fazer ao concluir ou cancelar estão em [.docs/planos/README.md](../../../.docs/planos/README.md) e no [modelo](../../../.docs/planos/_modelos/modelo-de-plano.md) — ler de lá, não reproduzir aqui.

O plano **não tem PR próprio**: ele é entregue pelos PRs das filhas, e cada filha é executada pela skill [executar-tarefa](../executar-tarefa/SKILL.md). Esta skill não repete aquele procedimento. Ela cobre o que fica **entre** as filhas — qual vem agora, o que o plano aprendeu com a anterior — e o fechamento.

---

## Passo 0 — Pré-condições

- **O plano está em `especificados/`.** Em `rascunhos/`, a decomposição ainda não foi aceita: usar a skill [criar-plano](../criar-plano/SKILL.md).
- **A issue do plano está aberta** (`gh issue view "$PLANO" --json state`).
- **Ler o plano inteiro**: Objetivo, Escopo (inclusive o "Fora"), tabela de filhas, Decisões transversais, Riscos e Critério de conclusão.

## Passo 1 — Situação real, não a da tabela

A tabela de filhas envelhece a cada `git mv`, e quem esqueceu de atualizá-la deixou o plano mentindo. Antes de decidir qualquer coisa, conferir as três fontes e reconciliar:

```bash
PLANO=NN
# filhas que apontam para o plano pelo campo Plano do cabeçalho, com o diretório onde estão
grep -lE "^\| \*\*Plano\*\* +\| \[?GH-$PLANO\b" .docs/tarefas/*/*.md
# o que o GitHub diz
gh api repos/bitize/bitmde/issues/$PLANO/sub_issues \
  --jq '.[] | "#\(.number) \(.state) \(.title)"'
# PRs de cada filha — os dois comandos, e filtrar à mão
gh issue view <filha> --json closedByPullRequestsReferences   # só PR com "Closes #<filha>"
gh pr list --state all --search "GH-<filha>"                  # texto livre: traz também PR que só cita
```

Filha ainda em `rascunhos/` com o plano já promovido tem o campo **Plano** como `GH-$PLANO`; se o `grep` não a achar, procurar também por `rascunho:`.

Cada filha pode ter **dois** PRs: o de implementação e o de conclusão (`docs: conclui a tarefa GH-NN`). O estado que importa é o do primeiro; o segundo só diz se o `git mv` para `concluidas/` já foi mergeado.

Divergência — linha da tabela com status ou link velho, filha com issue que não é sub-issue, filha com campo **Plano** errado — é corrigida **antes** de seguir, num commit `docs:` próprio. Se esse commit vai direto na `main` ou num PR `docs/…`, perguntar ao usuário. Divergência que não se explica (filha concluída sem PR mergeado, sub-issue que não está na tabela) vira pergunta ao usuário.

Apresentar ao usuário a situação reconciliada: cada filha, o status, o PR se houver, e o que falta para o critério de conclusão.

## Passo 2 — Escolher a próxima filha

A próxima é a de **menor Ordem** que ainda não está concluída nem cancelada e cuja coluna "Depende de" está **toda em `concluidas/`**. PR de implementação aberto de uma dependência não conta: a branch da filha nasce da `main`, e empilhar branch sobre branch não mergeada é exatamente o acoplamento que a decomposição quis evitar.

| Estado da filha escolhida                                  | Próximo passo                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Em `rascunhos/`                                            | Especificar e promover pela [criar-tarefa](../criar-tarefa/SKILL.md), com o usuário. Promover vincula a sub-issue |
| Em `especificadas/`, sem PR                                | Executar pela [executar-tarefa](../executar-tarefa/SKILL.md)                                                      |
| Em `especificadas/`, PR de implementação aberto            | Retomar o PR (revisão, validação pendente) — não abrir outro                                                      |
| Em `especificadas/`, implementação mergeada, sem conclusão | Concluir: Passo 7 da [executar-tarefa](../executar-tarefa/SKILL.md). É rápido e destrava as dependentes           |
| Em `especificadas/`, PR de conclusão aberto                | Esperar o merge dele. O código já está na `main`, mas a tabela e o disco ainda não dizem isso                     |

Casos que não escolhem filha — dizer ao usuário e parar:

- **Dependência cancelada.** Não se satisfaz sozinha: a filha dependente ainda faz sentido? Reespecificar sem a dependência ou cancelar também, e registrar no plano (Passo 4).
- **Nenhuma filha elegível com filhas abertas.** Dizer qual dependência bloqueia cada uma e em que estado ela está.

Filhas **independentes entre si** podem andar em paralelo só se o usuário pedir — uma branch, um PR e, de preferência, um worktree por filha.

Apresentar a filha escolhida e **esperar confirmação antes de começá-la — inclusive a primeira.** Uma filha por vez é o padrão, e cada uma termina num PR que **o usuário** mergeia. Esta skill não encadeia filhas sozinha: ao abrir o PR de uma, para e reporta.

## Passo 3 — Durante a filha

A filha é executada pela [executar-tarefa](../executar-tarefa/SKILL.md). Do lado do plano, só três coisas:

- **As Decisões transversais valem como especificação da filha.** Contrariar uma delas é desvio que exige pergunta ao usuário, como contrariar a própria tarefa.
- **Desvio da filha que atinge outra filha ou o plano** (o contrato que a filha 1 criou mudou e a filha 2 reaproveita) é registrado na filha **e** sobe para o plano no Passo 4.
- **Risco do plano que exige ação externa ou irreversível** — emitir documento fiscal de teste, registrar evento em produção, pedir algo a terceiro — é decisão do usuário, nunca passo automático. Evento fiscal em produção não se desfaz.

## Passo 4 — Entre uma filha e a próxima

Depois que o PR de implementação da filha foi mergeado, antes de escolher a seguinte, revisar o plano à luz do que a filha ensinou. É o checkpoint que impede o plano de virar índice desatualizado. O lugar natural é o PR de conclusão da filha (Passo 7 da [executar-tarefa](../executar-tarefa/SKILL.md)), que já mexe na tabela do plano:

1. **Tabela**: link e status da filha concluída, no mesmo commit do `git mv` dela.
2. **Decisões transversais**: ainda valem? Se a implementação mudou alguma, atualizar a decisão e as **filhas afetadas** que ainda não foram executadas, antes de começar a próxima. Filha especificada sobre uma premissa que mudou é a próxima a sair errada.
3. **Riscos e questões em aberto**: marcar o que a filha resolveu, acrescentar o que ela descobriu.
4. **Escopo**: filha nova necessária entra na tabela, criada pela [criar-tarefa](../criar-tarefa/SKILL.md), com linha no histórico do plano dizendo o motivo. Filha que deixou de fazer sentido é cancelada pelo fluxo de tarefa e registrada nas Notas de conclusão do plano.
5. **Histórico de revisões** do plano, se algo além da tabela mudou.

Essas mudanças vão em commit `docs:` no PR de conclusão da filha; se surgirem depois dele, num PR `docs/…` próprio. `npm run format` antes de commitar.

Reportar ao usuário o que mudou no plano e qual é a próxima filha, e **esperar confirmação** para começá-la.

## Passo 5 — Fechar o plano

O plano fecha quando a situação reconciliada do Passo 1 — não a tabela lida de memória — não tem mais filha em `rascunhos/` nem em `especificadas/`. Antes de mover qualquer arquivo:

- **Verificar o objetivo de verdade**, do jeito que o Critério de conclusão descreve — rodar o que ele manda rodar, não inferir de "as filhas estão concluídas". Filhas concluídas com objetivo não alcançado é desvio a registrar e a levar ao usuário: filha nova ou objetivo revisto.
- **ADRs prometidos** pelo plano aceitos e na tabela de [decisoes/README.md](../../../.docs/arquitetura/decisoes/README.md).
- **Release**, se o critério inclui um: segue [release.md](../../../.docs/arquitetura/release.md) e é disparado pelo usuário — publicar no npm não se reescreve. Sem release publicado, o item fica desmarcado e o plano não fecha, salvo decisão explícita do usuário registrada nas Notas de conclusão.
- **Todas as filhas canceladas** → o plano é cancelado, não concluído: seguir "Ao cancelar o plano" do README, com `DESTINO=cancelados` nos comandos abaixo.

Depois, seguir "Ao concluir o plano" do [README](../../../.docs/planos/README.md) e a checklist "Conclusão e entrega" do próprio plano, em branch `docs/conclui-gh-$PLANO` (ou no mesmo PR de conclusão da última filha). O que costuma ser esquecido:

- **Campo Plano das filhas**: ele é link para `../../planos/especificados/GH-$PLANO-….md` e quebra com o `git mv` do plano. Corrigir em cada filha, no mesmo commit:

  ```bash
  DESTINO=concluidos   # ou cancelados
  grep -lE "^\| \*\*Plano\*\* +\| \[GH-$PLANO\]" .docs/tarefas/*/*.md \
    | xargs sed -i "s#planos/especificados/GH-$PLANO-#planos/$DESTINO/GH-$PLANO-#"
  ```

- **Blockquote da issue do plano**, que envelheceu com o `git mv`. O `grep` impede regravar o corpo sem mudança:

  ```bash
  CORPO=$(mktemp)
  gh issue view "$PLANO" --json body -q .body \
    | sed "s#\.docs/planos/especificados/#.docs/planos/$DESTINO/#" > "$CORPO"
  grep -F ".docs/planos/$DESTINO/GH-$PLANO-" "$CORPO" && gh issue edit "$PLANO" --body-file "$CORPO"
  ```

- **Fechar a issue à mão** (`gh issue close "$PLANO"`) — o GitHub não fecha a mãe quando a última sub-issue fecha, e o PR da filha não leva `Closes` para ela.
- **Rastreador externo** citado em Referências (ex.: Linear), se houver: fechar lá também.
- Push e PR com confirmação do usuário, como em qualquer filha.

---

## Sinais de que a execução está saindo do trilho

- Escolhendo a próxima filha pela tabela sem ter conferido disco, sub-issues e PRs.
- Começando filha cuja dependência está só com PR aberto.
- Executando filha ainda em `rascunhos/`.
- Emendando uma filha na outra sem passar pelo Passo 4 e sem confirmação do usuário.
- Decisão transversal mudada numa filha e as filhas seguintes ainda especificadas sobre a decisão antiga.
- Fechando o plano porque as filhas acabaram, sem ter verificado o objetivo.
- `Closes #<plano>` no PR de uma filha.
- Plano movido de diretório com as filhas ainda linkando o caminho antigo.

Qualquer um destes: parar, voltar ao passo correspondente.
