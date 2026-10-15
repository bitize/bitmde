# Fluxo de tarefas — bitmde

Tarefas de desenvolvimento versionadas no repositório, com rastreabilidade por número de issue do GitHub.

A especificação mora aqui; a issue no GitHub serve de rastreador e de canal com quem é de fora. O arquivo é a fonte da verdade — issue não guarda especificação completa.

## Estrutura

```text
.docs/tarefas/
├── _modelos/            # modelo padrão
│   └── modelo-de-tarefa.md
├── rascunhos/           # em planejamento
├── especificadas/       # especificadas, prontas para implementar
├── concluidas/          # implementadas e entregues
└── canceladas/          # descartadas sem entrega (registro histórico)
```

## Ciclo de vida

```text
┌───────────┐      ┌───────────────┐      ┌────────────┐
│ rascunhos │ ───► │ especificadas │ ───► │ concluidas │
└───────────┘      └───────────────┘      └────────────┘
                           │
                           ▼
                    ┌────────────┐
                    │ canceladas │
                    └────────────┘
```

| Status            | Descrição                                                                              | Critério de saída                                                  |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **rascunhos**     | Em planejamento e especificação                                                        | Escopo definido, seções obrigatórias preenchidas, decisões tomadas |
| **especificadas** | Especificada, pronta para implementar                                                  | Implementação finalizada, testes passando, PR mergeado             |
| **concluidas**    | Implementada e entregue                                                                | —                                                                  |
| **canceladas**    | Descartada sem entrega (escopo obsoleto, superada por outra tarefa, decisão revertida) | —                                                                  |

## Nomenclatura

### Em `rascunhos/`

Nome temporário, sem prefixo — a issue ainda não existe.

**Formato:** `descricao-curta.md` — kebab-case, minúsculo, sem acento, até 50 caracteres.

### Em `especificadas/`, `concluidas/` e `canceladas/`

**Formato:** `GH-NN-descricao-curta.md`, onde `NN` é o número da issue em [bitize/bitmde](https://github.com/bitize/bitmde/issues).

Exemplos:

- `GH-12-suporte-a-evento-210250.md`
- `GH-31-timeout-configuravel-por-chamada.md`
- `GH-7-atualizar-cadeia-icp-brasil.md`

A descrição do arquivo é em **português**, como o resto do repositório — kebab-case, sem acento.

## Criar uma tarefa

1. Copiar o modelo com nome temporário:

   ```sh
   cp .docs/tarefas/_modelos/modelo-de-tarefa.md .docs/tarefas/rascunhos/descricao-curta.md
   ```

2. Ler as fontes da verdade em [../arquitetura/](../arquitetura/) — os docs das camadas impactadas e os ADRs relacionados. Marcar no cabeçalho o que foi lido.
3. Preencher as seções conforme a necessidade da tarefa; apagar as que não se aplicam.
4. Registrar em **Referências** os docs consultados.

## Mover entre status

Usar `git mv` e atualizar o campo **Status** no cabeçalho:

```sh
# rascunhos → especificadas (especificação concluída, issue criada)
git mv .docs/tarefas/rascunhos/descricao-curta.md .docs/tarefas/especificadas/GH-12-descricao-curta.md

# especificadas → concluidas (implementação entregue)
git mv .docs/tarefas/especificadas/GH-12-descricao-curta.md .docs/tarefas/concluidas/GH-12-descricao-curta.md

# especificadas → canceladas (descartada sem entrega)
git mv .docs/tarefas/especificadas/GH-12-descricao-curta.md .docs/tarefas/canceladas/GH-12-descricao-curta.md
```

## Integração com o GitHub

Cada tarefa em `especificadas/`, `concluidas/` e `canceladas/` tem uma issue correspondente. Ao mover de `rascunhos/` para `especificadas/`:

1. Criar a issue com corpo provisório e guardar o número — o corpo definitivo depende do caminho final do arquivo, que depende do número:

   ```bash
   NN=$(gh issue create --title "<título da tarefa>" \
     --body "Resumo em edição." | grep -oE '[0-9]+$')
   ```

2. Renomear e mover o arquivo usando o número retornado;
3. Preencher o campo **Issue** e o título `# GH-NN: …` no cabeçalho, com o mesmo número do nome do arquivo;
4. Atualizar o corpo da issue com um **resumo curto** (não a especificação inteira), via `gh issue edit "$NN" --body …`:

   ```markdown
   ## Resumo

   <2 a 4 frases sobre objetivo e escopo>

   ## Pontos principais

   - <ponto 1>
   - <ponto 2>

   ---

   > **Especificação completa:** `.docs/tarefas/especificadas/GH-NN-descricao-curta.md`
   ```

Regras: até ~300 palavras no resumo, sem duplicar o conteúdo do arquivo, e o blockquote final com o **caminho real do arquivo** é obrigatório.

> **O caminho envelhece a cada `git mv`.** O blockquote aponta para `especificadas/` enquanto a tarefa está lá, mas o arquivo muda de diretório ao ser concluída ou cancelada. Toda vez que a tarefa mudar de status, editar o blockquote na issue trocando `especificadas/` pelo diretório de destino — `concluidas/` ou `canceladas/`. Sem isso a issue passa a apontar para um caminho que não existe mais.

> O repositório é **público**: qualquer pessoa lê as issues. Não colocar em issue dado de certificado, CNPJ de cliente, chave de NF-e real ou trecho de XML de produção. Se for necessário para o diagnóstico, anonimizar.

Issue aberta por terceiro segue o mesmo caminho: vira arquivo em `rascunhos/` quando for trabalhada, e o arquivo nasce já com o número dela.

## Ao concluir a tarefa

O arquivo em `concluidas/` deve ser um retrato fiel do que foi entregue — é registro auditável, não cópia da especificação.

1. **Cabeçalho** — **Status**: `concluidas`, **Concluído em**: `AAAA-MM-DD`, **Atualizado em**: data corrente;
2. **Marcar os checklists** efetivamente concluídos: fontes da verdade, testes, implementação e validação pré-PR;
3. **Notas de implementação** — registrar todo **desvio** em relação à especificação e a justificativa. Se não houve, escrever "Sem desvios". Não deixar item em branco sem contexto;
4. **Histórico de revisões** — nova linha descrevendo a entrega;
5. **Mover para `concluidas/`** com `git mv`;
6. **Corrigir o blockquote de especificação na issue** — trocar `.docs/tarefas/especificadas/` por `.docs/tarefas/concluidas/`;
7. **Fechar a issue** no GitHub.

## Ao cancelar a tarefa

O arquivo **não** se apaga — ele registra a decisão.

1. **Cabeçalho** — **Status**: `canceladas`, trocar **Concluído em** por **Cancelado em**, atualizar **Atualizado em**;
2. **Motivo** — bloco logo após o cabeçalho explicando por que foi cancelada e, se houver, qual tarefa a substitui. PR aberto, referenciar (mergeado ou não);
3. **Histórico de revisões** — linha com o cancelamento;
4. **Mover para `canceladas/`** com `git mv`;
5. **Corrigir o blockquote de especificação na issue** — trocar `.docs/tarefas/especificadas/` por `.docs/tarefas/canceladas/`;
6. **Fechar a issue** como `not planned`.

> Os checklists de implementação ficam **como estão**, desmarcados: o arquivo em `canceladas/` é o retrato da especificação que não foi executada, não um relatório de entrega.

## Regras específicas deste repositório

- **Release não é tarefa comum.** Bump de versão, `CHANGELOG.md` e tag seguem [../arquitetura/release.md](../arquitetura/release.md), e a tag precisa bater com o `package.json`.
- **Mudança de API pública** exige, no mesmo PR: código, JSDoc em `src/apis/`, `README.md`, `CHANGELOG.md` e o doc de camada correspondente.
- **`test/sefaz.test.js` bate na SEFAZ de verdade** e não roda na CI. Tarefa que toca transporte, certificado ou assinatura deve rodá-lo manualmente antes do PR, contra homologação.
- **Bump de dependência é mudança de dois arquivos** — `package.json` e `package-lock.json`, no mesmo commit ([ADR 0003](../arquitetura/decisoes/0003-lockfile-versionado.md)).
