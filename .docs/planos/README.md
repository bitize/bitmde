# Fluxo de planos — bitmde

Um **plano** é um objetivo grande demais para uma tarefa só: ele se decompõe em **duas ou mais tarefas filhas**, que só fazem sentido juntas. O plano diz _o que_ se quer alcançar, _em que partes_ e _em que ordem_; cada filha diz _como_ a sua parte é feita.

Quando **não** é plano:

- O trabalho cabe em uma tarefa → é tarefa. Plano com uma filha só é tarefa com burocracia a mais.
- As tarefas são independentes entre si, sem objetivo comum → são tarefas avulsas.

A especificação de implementação (requisitos, impacto por camada, testes) mora **nas tarefas filhas**, nunca no plano. O plano guarda objetivo, escopo, decomposição, dependências entre filhas e as decisões que atravessam mais de uma delas.

## Estrutura

```text
.docs/planos/
├── _modelos/            # modelo padrão
│   └── modelo-de-plano.md
├── rascunhos/           # em planejamento
├── especificados/       # decomposição fechada, filhas em andamento
├── concluidos/          # todas as filhas encerradas, objetivo alcançado
└── cancelados/          # descartados (registro histórico)
```

As tarefas filhas **não** moram aqui: ficam em [../tarefas/](../tarefas/README.md), com o ciclo de vida delas, e apontam para o plano pelo campo **Plano** do cabeçalho.

## Ciclo de vida

```text
┌───────────┐      ┌───────────────┐      ┌────────────┐
│ rascunhos │ ───► │ especificados │ ───► │ concluidos │
└───────────┘      └───────────────┘      └────────────┘
                           │
                           ▼
                    ┌────────────┐
                    │ cancelados │
                    └────────────┘
```

| Status            | Descrição                                                            | Critério de saída                                                                                        |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **rascunhos**     | Em planejamento: objetivo, escopo e decomposição                     | Objetivo e escopo fechados; pelo menos duas filhas criadas em `tarefas/` (como rascunho, no mínimo)      |
| **especificados** | Decomposição aceita; as filhas seguem o próprio ciclo                | Nenhuma filha em `rascunhos/` ou `especificadas/`, ao menos uma em `concluidas/` e o objetivo verificado |
| **concluidos**    | Objetivo alcançado                                                   | —                                                                                                        |
| **cancelados**    | Descartado (objetivo obsoleto, superado, todas as filhas canceladas) | —                                                                                                        |

Promover o plano **não** exige que as filhas estejam especificadas — cada uma é promovida quando estiver pronta, no ritmo dela. Exige que a decomposição esteja fechada: quais filhas existem, em que ordem, e o que cada uma entrega.

Se todas as filhas acabarem canceladas, o plano é cancelado, não concluído.

## Relação com as tarefas

- **Mínimo de duas filhas para promover.** Se, ainda em rascunho, a decomposição encolher para uma, não é plano: o rascunho do plano é apagado e a filha segue como tarefa avulsa. Depois de especificado, filha cancelada é desvio registrado nas notas de conclusão do plano, não motivo para desfazê-lo.
- **Uma tarefa pertence a no máximo um plano.** O campo **Plano** do cabeçalho da tarefa leva o `GH-NN` do plano, ou `—` quando é avulsa.
- **O plano não tem PR próprio.** Ele é entregue pelos PRs das filhas; o arquivo do plano só muda em commit de documentação.
- **A tabela de filhas do plano é o índice.** Link e status de cada filha envelhecem a cada `git mv` dela — quem move a filha atualiza a linha dela no plano, no mesmo commit.
- **Filha nova depois de especificado** é permitida: entra na tabela e ganha linha no histórico de revisões do plano, com o motivo.
- **Decisão que vale para uma filha só fica na filha.** No plano, só as transversais.

## Nomenclatura

Igual à das tarefas. Em `rascunhos/`, nome temporário sem prefixo (`descricao-curta.md`); em `especificados/`, `concluidos/` e `cancelados/`, `GH-NN-descricao-curta.md`, onde `NN` é o número da issue do plano em [bitize/bitmde](https://github.com/bitize/bitmde/issues). Kebab-case, minúsculo, sem acento, até 50 caracteres, em **português**.

Plano e tarefa compartilham a numeração das issues, então um `GH-NN` nunca se repete entre as duas pastas.

## Criar um plano

1. Copiar o modelo com nome temporário:

   ```sh
   cp .docs/planos/_modelos/modelo-de-plano.md .docs/planos/rascunhos/descricao-curta.md
   ```

2. Escrever objetivo, contexto e escopo.
3. Decompor em filhas: para cada uma, criar a tarefa em `.docs/tarefas/rascunhos/` pelo [fluxo de tarefas](../tarefas/README.md), já com o campo **Plano** preenchido (`rascunho: descricao-curta` enquanto o plano não tem número).
4. Preencher a tabela de filhas com ordem, dependências e o que cada uma entrega.
5. Registrar as decisões transversais e os riscos.

## Mover entre status

Usar `git mv` e atualizar o campo **Status** no cabeçalho:

```sh
# rascunhos → especificados (decomposição fechada, issue criada)
git mv .docs/planos/rascunhos/descricao-curta.md .docs/planos/especificados/GH-20-descricao-curta.md

# especificados → concluidos (todas as filhas encerradas)
git mv .docs/planos/especificados/GH-20-descricao-curta.md .docs/planos/concluidos/GH-20-descricao-curta.md

# especificados → cancelados (descartado)
git mv .docs/planos/especificados/GH-20-descricao-curta.md .docs/planos/cancelados/GH-20-descricao-curta.md
```

Ao promover, trocar o `rascunho: descricao-curta` do campo **Plano** de cada filha pelo `GH-NN` definitivo.

## Integração com o GitHub

O plano tem issue própria, e as issues das filhas são **sub-issues** dela — o GitHub mostra o progresso das filhas na issue do plano.

Ao mover de `rascunhos/` para `especificados/`:

1. Criar a issue com corpo provisório e guardar o número:

   ```bash
   PLANO=$(gh issue create --title "<título do plano>" \
     --body "Resumo em edição." | grep -oE '[0-9]+$')
   ```

2. Renomear e mover o arquivo usando o número retornado; preencher o campo **Issue** e o título `# GH-NN: …`;
3. Vincular como sub-issue cada filha que **já tem** issue. A API recebe o `id` interno da issue filha, não o número:

   ```bash
   ID=$(gh api repos/bitize/bitmde/issues/$FILHA --jq .id)
   gh api repos/bitize/bitmde/issues/$PLANO/sub_issues -F sub_issue_id=$ID
   ```

   Filha promovida depois do plano é vinculada no momento da promoção dela — está no [fluxo de tarefas](../tarefas/README.md#integração-com-o-github).

4. Atualizar o corpo da issue com um **resumo curto** — as filhas não precisam ser listadas, a lista de sub-issues já faz isso:

   ```markdown
   ## Objetivo

   <1 a 2 frases verificáveis>

   ## Escopo

   - <o que entra>
   - Fora: <o que fica de fora>

   ---

   > **Plano completo:** `.docs/planos/especificados/GH-NN-descricao-curta.md`
   ```

> **O caminho envelhece a cada `git mv`**, como nas tarefas: ao concluir ou cancelar o plano, editar o blockquote trocando `especificados/` por `concluidos/` ou `cancelados/`.

> O repositório é **público**: as mesmas restrições das issues de tarefa valem aqui — nada de certificado, CNPJ de cliente, chave de NF-e real ou XML de produção.

## Ao concluir o plano

Quando a última filha sair de `especificadas/` e o objetivo estiver verificado:

1. **Tabela de filhas** com link e status final de cada uma;
2. **Notas de conclusão** — desvios em relação ao plano: filha adicionada, cancelada, escopo que migrou para outro plano. Se não houve, "Sem desvios";
3. **Cabeçalho** — **Status**: `concluidos`, **Concluído em** e **Atualizado em**;
4. **Histórico de revisões** — linha com o encerramento;
5. **Mover para `concluidos/`** com `git mv`;
6. **Corrigir o blockquote** da issue para `.docs/planos/concluidos/`;
7. **Fechar a issue** do plano — o GitHub não fecha a mãe quando as sub-issues fecham.

## Ao cancelar o plano

O arquivo **não** se apaga. Para cada filha ainda aberta (em `rascunhos/` ou `especificadas/`), decidir e registrar no plano:

- **cancelar** a filha, pelo fluxo de cancelamento de tarefa; ou
- **desvincular** e manter como avulsa: campo **Plano** volta a `—`, e a sub-issue é removida:

  ```bash
  ID=$(gh api repos/bitize/bitmde/issues/$FILHA --jq .id)
  gh api -X DELETE repos/bitize/bitmde/issues/$PLANO/sub_issue -F sub_issue_id=$ID
  ```

Filhas já concluídas ficam como estão, com o campo **Plano** preservado — é registro histórico.

Depois: **Status** `cancelados` e **Cancelado em** no cabeçalho, bloco **Motivo** logo após o cabeçalho, linha no histórico, `git mv` para `cancelados/`, blockquote da issue corrigido e issue fechada como `not planned`.

## Por que as filhas ficam em `tarefas/`

A alternativa era cada plano virar uma pasta com as próprias tarefas dentro. Ficou de fora porque a tarefa filha perderia o ciclo de pastas (`rascunhos → especificadas → concluidas`) e passaria a ter dois fluxos diferentes conforme pertença ou não a um plano. Com as filhas em `tarefas/`, existe um fluxo de tarefa só, e o plano é um índice por cima dele. O custo é manter a tabela de filhas atualizada a cada `git mv` — por isso essa atualização está nas checklists da tarefa.
