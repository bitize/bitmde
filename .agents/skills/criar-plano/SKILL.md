---
name: criar-plano
description: Cria e especifica um plano em .docs/planos/ do bitmde — objetivo verificável, escopo, decomposição em duas ou mais tarefas filhas (criadas em .docs/tarefas/), decisões transversais, abertura da issue do plano no GitHub com as filhas como sub-issues e promoção de rascunhos/ para especificados/. USE WHEN o pedido for criar, planejar, decompor ou promover um plano, épico ou trabalho grande demais para uma tarefa só. Trigger words - criar plano, novo plano, planejar, decompor em tarefas, quebrar em tarefas, promover plano, épico, epic, sub-issues, create plan, new plan, break down.
---

# Criar plano — bitmde

Procedimento executável. O **formato** do plano (ciclo de vida, nomenclatura, relação com as tarefas, o que fazer ao concluir ou cancelar) é definido em [.docs/planos/README.md](../../../.docs/planos/README.md) e no [modelo](../../../.docs/planos/_modelos/modelo-de-plano.md) — ler de lá, não reproduzir aqui. Esta skill cobre o que **fazer**, na ordem, e as decisões que costumam sair erradas.

As tarefas filhas são criadas e promovidas pela skill [criar-tarefa](../criar-tarefa/SKILL.md). Esta skill não repete aquele procedimento; diz só o que muda quando a tarefa pertence a um plano.

---

## Passo 0 — Confirmar que é plano

Plano é objetivo comum decomposto em **duas ou mais** tarefas que só fazem sentido juntas. Antes de criar o arquivo:

- Se o trabalho cabe em **um PR revisável**, é tarefa — usar `criar-tarefa`.
- Se as partes **não compartilham objetivo**, são tarefas avulsas — sem plano.
- Se a decomposição só chega a uma filha, não é plano.

Na dúvida, perguntar ao usuário em vez de criar o plano.

## Passo 1 — Nascer em `rascunhos/`

```bash
cp .docs/planos/_modelos/modelo-de-plano.md .docs/planos/rascunhos/descricao-curta.md
```

Nome: kebab-case, minúsculo, **sem acento**, até 50 caracteres, em **português**. Sem prefixo — a issue ainda não existe.

## Passo 2 — Objetivo, contexto e escopo

Ler [arquitetura/README.md](../../../.docs/arquitetura/README.md) (as cinco invariantes) e, por cima, os docs das camadas que o plano vai tocar — a tabela "A tarefa mexe em… / Ler" da `criar-tarefa` vale aqui também.

- **Objetivo verificável.** Uma ou duas frases que permitam dizer, no fim, se foi alcançado. Objetivo vago é a principal causa de plano que nunca fecha.
- **Escopo com "Fora" explícito**, e para onde vai cada item que ficou de fora.
- **Plano não especifica implementação.** Requisito, impacto por camada, mensagem de erro e teste vão nas filhas. Se o rascunho do plano começar a ter isso, o conteúdo está no arquivo errado.

## Passo 3 — Decompor em filhas

É o passo que mais sai errado. Cada filha deve:

- **Caber em um PR** que, mergeado sozinho, deixa a `main` verde e publicável. Filha que só compila junto com outra não é filha — é metade de uma.
- **Entregar algo nomeável** na coluna "Entrega" da tabela. Filha cujo resultado é "preparação" costuma ser parte da filha seguinte.
- **Declarar dependências** na coluna "Depende de", e a ordem refletir isso.

Armadilhas deste repositório que costumam ditar a decomposição:

- **Mudança de API pública** arrasta código, JSDoc de `src/apis/`, `README.md`, `CHANGELOG.md` e doc de camada **no mesmo PR** — não dá para separar "código" e "documentação" em filhas diferentes.
- **Bump de dependência** é `package.json` + `package-lock.json` no mesmo commit; se o plano envolve atualizar dependência, isso é uma filha inteira, não pedaço de outra.
- **Release não é filha comum** ([release.md](../../../.docs/arquitetura/release.md)): se o plano fecha numa versão, isso entra no critério de conclusão do plano, não como tarefa.
- **Recepção:** mexer no XML gerado afeta o recorte por `indexOf` do lote ([ADR 0007](../../../.docs/arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)) — se mais de uma filha toca o schema da recepção, isso é decisão transversal.

Para cada filha, criar a tarefa em `.docs/tarefas/rascunhos/` pelo Passo 1 da `criar-tarefa`, com o campo **Plano** = `rascunho: <nome do arquivo do plano sem .md>`. A filha não precisa estar especificada agora — só existir com objetivo e escopo próprios.

Preencher a tabela de filhas do plano com link relativo para cada uma (`../../tarefas/rascunhos/descricao-curta.md`).

## Passo 4 — Decisões transversais e riscos

Só decisão que vale para **mais de uma** filha entra no plano, com o campo **Filhas afetadas**. Decisão de uma filha só vai na filha.

Decisão com alternativa real e reversão custosa merece ADR — **um ADR aceito não se edita**; contrariar uma invariante exige ADR novo supersedendo o antigo.

## Passo 5 — Promover para `especificados/`

Só depois de objetivo, escopo e decomposição aceitos pelo usuário. As filhas **não** precisam estar especificadas.

Mesmo ovo-e-galinha das tarefas: o corpo da issue aponta para o caminho final, que depende do número. Nesta ordem:

1. **Criar a issue do plano** e guardar o número:

   ```bash
   PLANO=$(gh issue create --title "<título do plano>" \
     --body "Resumo em edição." | grep -oE '[0-9]+$')
   ```

2. **Mover com `git mv`:**

   ```bash
   git mv .docs/planos/rascunhos/descricao-curta.md \
     .docs/planos/especificados/GH-$PLANO-descricao-curta.md
   ```

3. **Preencher o cabeçalho** — título `# GH-NN: …`, campo **Issue**, **Status** `especificados`, **Atualizado em**. Título, campo **Issue** e nome do arquivo no mesmo `NN`.
4. **Atualizar as filhas** — em cada uma, trocar `rascunho: descricao-curta` do campo **Plano** por `GH-$PLANO`.
5. **Vincular as filhas que já têm issue** como sub-issues. A API recebe o `id` interno, não o número:

   ```bash
   for FILHA in 21 22; do
     ID=$(gh api repos/bitize/bitmde/issues/$FILHA --jq .id)
     gh api repos/bitize/bitmde/issues/$PLANO/sub_issues -F sub_issue_id=$ID
   done
   ```

   Filha ainda em rascunho é vinculada quando for promovida — o Passo 4 da `criar-tarefa` cobre isso.

6. **Escrever o corpo da issue**, no formato de [Integração com o GitHub](../../../.docs/planos/README.md#integração-com-o-github), com o `EOF` na coluna 0:

```bash
gh issue edit "$PLANO" --body "$(cat <<EOF
## Objetivo

<1 a 2 frases verificáveis>

## Escopo

- <o que entra>
- Fora: <o que fica de fora>

---

> **Plano completo:** \`.docs/planos/especificados/GH-$PLANO-descricao-curta.md\`
EOF
)"
```

Não listar as filhas no corpo: a lista de sub-issues do GitHub já faz isso e não envelhece.

> **O repositório é público.** Nada de certificado, CNPJ de cliente, chave de NF-e real ou XML de produção na issue.

## Passo 6 — Validar antes de commitar

Plano e filhas são Markdown em `.docs/`, que passa pelo `format:check` da CI:

```bash
npm run format
```

Commitar o plano junto com as filhas que ele criou ou alterou — o campo **Plano** delas e a tabela do plano precisam concordar no mesmo commit.

---

## Fechamento

Concluir ou cancelar segue [.docs/planos/README.md](../../../.docs/planos/README.md) e a checklist "Conclusão e entrega" do próprio plano. Os pontos mais esquecidos:

- **O GitHub não fecha a issue do plano** quando a última sub-issue fecha — fechar à mão.
- **Corrigir o blockquote** da issue do plano depois do `git mv` (`especificados/` → `concluidos/` ou `cancelados/`).
- **Cancelar o plano exige decidir cada filha aberta**: cancelar ou desvincular (campo **Plano** volta a `—` e a sub-issue é removida). Filhas concluídas ficam como estão.
- Plano cujas filhas foram **todas** canceladas é cancelado, não concluído.
