# Estrutura da documentação — o que vai onde

Este documento existe para evitar a pergunta "onde eu escrevo isso?" e, principalmente, para evitar a mesma informação em dois lugares. Em repositório pequeno, duplicação é o único jeito garantido de a documentação apodrecer.

## A regra de uma linha

> O **README.md** ensina a usar. O **CLAUDE.md** diz o que não pode ser quebrado. O **`.docs/arquitetura/`** explica como funciona. O **`.docs/arquitetura/decisoes/`** explica por que é assim. O **`.docs/planos/`** agrupa tarefas sob um objetivo comum. O **`.docs/tarefas/`** registra o que vai mudar.

## Fronteiras

### `README.md` (raiz)

Documentação **pública**, para quem instala o pacote: instalação, configuração, assinatura dos métodos, formato do retorno, exemplos. Muda junto com qualquer mudança de assinatura da API pública. Nada de detalhe interno aqui — consumidor não precisa saber que existe `RetornoHelper`.

### `CLAUDE.md` (raiz)

Regras operacionais, carregadas no contexto de **toda** sessão de agente. Por isso precisa continuar curto: comandos, pré-requisitos, invariantes e processo de release, em forma de regra. Detalhamento vai para `.docs/arquitetura/` e o CLAUDE.md aponta.

Critério: se é uma regra que, ignorada, quebra build/teste/release, está no CLAUDE.md. Se é explicação de como algo funciona, está aqui.

### `.docs/arquitetura/camadas/`

Um doc por camada de `src/`. Descreve responsabilidade, contrato de entrada e saída, e as armadilhas conhecidas daquela camada. É o "como".

### `.docs/arquitetura/fluxos/`

Um doc por operação de ponta a ponta (uma consulta, um envio de evento), atravessando todas as camadas. Existe porque ler seis docs de camada não substitui ver a chamada inteira.

### `.docs/arquitetura/decisoes/` (ADRs)

Entra aqui a decisão que satisfaz os três critérios:

1. Havia **alternativas reais** consideradas;
2. Alguém no futuro vai questionar ("por que não Y?");
3. Reverter tem custo — não é preferência de estilo.

O ADR registra o **porquê**; o **como** fica no doc temático. Um ADR aceito **não se edita**: cria-se outro que o supersede. Convenções completas em [decisoes/README.md](decisoes/README.md).

Contraexemplo: "usamos 2 espaços de indentação" não é ADR — é configuração do Prettier, e vive no `prettier.config.js`.

### `.docs/conhecimento/`

Material que **não é nosso**: manual de orientação do contribuinte, notas técnicas da SEFAZ, XSDs, comportamentos observados do serviço, links. Separado da arquitetura porque tem outro ciclo de vida — muda quando a SEFAZ muda, não quando nosso código muda.

### `.docs/planos/`

Objetivo grande demais para uma tarefa: escopo, decomposição em duas ou mais tarefas filhas e decisões que atravessam mais de uma delas. Não especifica implementação — isso fica nas filhas, que moram em `tarefas/`. Fluxo em [../planos/README.md](../planos/README.md).

### `.docs/tarefas/`

Trabalho: especificação antes, registro depois. Fluxo em [../tarefas/README.md](../tarefas/README.md).

## Quando criar arquivo novo

Preferir **crescer um doc existente** a criar um novo. Um arquivo novo se justifica quando o assunto tem leitor próprio (alguém vai abrir só ele) ou quando o doc hospedeiro passaria a tratar de duas coisas sem relação.

Documento que ninguém abriria sozinho vira seção, não arquivo.

## Ao mudar o código

No mesmo PR:

- Mudou assinatura pública → `README.md` **e** o JSDoc em `src/apis/` (é dele que sai o `dist/index.d.ts`).
- Mudou comportamento de uma camada → o doc dela em `camadas/`.
- Mudou uma invariante → `CLAUDE.md`, `arquitetura/README.md` e, se houver, o ADR correspondente (novo ADR supersedendo, não edição).
- Mudou o processo de build/teste/release → o doc de processo correspondente.

## Formatação

O Markdown daqui passa pelo Prettier e é verificado pelo `format:check` do job `qualidade`. Rodar `npm run format` antes de commitar.

Não brigar com o formatador: escrever a tabela sem se preocupar com alinhamento, que ele repara. O que ele **não** faz é reflowar parágrafo (`proseWrap` fica no padrão `preserve`) nem tocar no conteúdo de bloco de código — os diagramas ASCII de `fluxos/` estão protegidos por isso.

O efeito colateral a conhecer: mudar a largura de uma célula faz o Prettier realinhar a coluna inteira, então uma edição de uma palavra vira diff de várias linhas. Em review, ligar "hide whitespace changes".
