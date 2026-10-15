# GH-NN: Título do plano

| Campo                | Valor                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| **Issue**            | GH-NN                                                                                        |
| **Status**           | rascunhos                                                                                    |
| **Prioridade**       | P0 (crítico) / P1 (alto) / P2 (médio) / P3 (baixo)                                           |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / services / env / util / scripts / test |
| **Criado em**        | AAAA-MM-DD                                                                                   |
| **Atualizado em**    | AAAA-MM-DD                                                                                   |
| **Concluído em**     | —                                                                                            |

> **Como usar este modelo:** o plano não especifica implementação — requisitos, impacto por camada e testes ficam nas tarefas filhas. Aqui entram objetivo, escopo, decomposição e decisões que valem para mais de uma filha. **Camadas afetadas** é a união das camadas das filhas. Apagar estes blocos de instrução.

---

## Objetivo

O que existe quando o plano termina, em uma ou duas frases **verificáveis**. "Melhorar o suporte a CT-e" não é verificável; "a distribuição consulta CT-e e MDF-e com a mesma API da NF-e" é.

## Contexto e motivação

Por que o plano existe e por que não cabe em uma tarefa só. O que acontece se não for feito.

## Escopo

### Dentro

-

### Fora

- <item> — para onde vai (outro plano, issue futura, descartado)

## Tarefas filhas

| Ordem | Tarefa                                                        | Status        | Depende de | Entrega                       |
| ----- | ------------------------------------------------------------- | ------------- | ---------- | ----------------------------- |
| 1     | [GH-NN — título](../../tarefas/especificadas/GH-NN-desc.md)   | especificadas | —          | o que fica pronto ao concluir |
| 2     | [descricao-curta](../../tarefas/rascunhos/descricao-curta.md) | rascunhos     | GH-NN      | …                             |

> Mínimo de duas filhas. **Link e status envelhecem a cada `git mv` da filha** — quem move a filha atualiza esta linha no mesmo commit. Filha ainda sem issue entra pelo nome temporário.

## Decisões transversais

Só decisões que valem para **mais de uma** filha. A decisão de uma filha só fica na filha.

### Decisão 1: [título]

- **Opções consideradas:** A, B, C
- **Escolha:** B
- **Justificativa:** …
- **Filhas afetadas:** GH-NN, GH-NN

> Alternativa real e reversão custosa pedem ADR em [../../arquitetura/decisoes/](../../arquitetura/decisoes/), não só um parágrafo aqui.

## Riscos e questões em aberto

- <risco ou pergunta> — como e quando se resolve

## Critério de conclusão

- [ ] Nenhuma filha em `rascunhos/` ou `especificadas/`
- [ ] Ao menos uma filha em `concluidas/`
- [ ] Objetivo verificado: <como foi conferido>
- [ ] Release, se o plano fecha numa versão — segue [../../arquitetura/release.md](../../arquitetura/release.md), não é filha comum

## Notas de conclusão

> Preenchido ao encerrar. Registrar os **desvios** em relação a este plano — filha adicionada, cancelada, escopo que migrou — e o motivo de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar quando a última filha sair de `especificadas/`:

- [ ] Tabela de filhas com link e status final
- [ ] Desvios registrados em "Notas de conclusão"
- [ ] Cabeçalho: **Status** = `concluidos` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/planos/especificados/GH-NN-descricao.md .docs/planos/concluidos/GH-NN-descricao.md`
- [ ] Blockquote do plano na issue apontando para `.docs/planos/concluidos/` (era `especificados/`)
- [ ] Issue do plano fechada no GitHub

## Referências

- [Fluxo de planos](../README.md)
- [ADR relacionado](../../arquitetura/decisoes/README.md)
- Issue: https://github.com/bitize/bitmde/issues/NN

## Histórico de revisões

| Data       | Rev | Descrição        |
| ---------- | --- | ---------------- |
| AAAA-MM-DD | 1.0 | Criação do plano |
