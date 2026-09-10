# Decisões (ADRs)

Architecture Decision Records: o **porquê** de escolhas que atravessam vários arquivos e que alguém, no futuro, vai questionar.

> **O que entra aqui:** decisão com alternativas reais consideradas, cuja reversão tem custo. O ADR registra o _porquê_; o _como_ fica no doc temático correspondente. Critérios completos em [../ESTRUTURA.md](../ESTRUTURA.md).

## Template

```markdown
# NNNN — Título curto

**Status**: Aceito | Superseded por NNNN | Em revisão
**Data**: AAAA-MM-DD

## Contexto

O que motivou a decisão?

## Alternativas consideradas

- Opção A — prós/contras
- Opção B — prós/contras

## Decisão

Escolhemos X porque Y.

## Consequências

- O que fica mais fácil?
- O que fica mais difícil?
- O que vira compromisso de longo prazo?
```

## Convenções

- **Prefixo numérico imutável**: `0001-…`, `0002-…`. Nunca reutilizar número.
- Depois de aceito, **não editar** — criar ADR novo que o supersede e marcar o antigo com `Superseded por NNNN`.
- Só decisões com alternativas reais que foram consideradas. Preferência de estilo não é ADR.
- Ao aceitar um ADR, acrescentar a linha na tabela abaixo.

## ADRs ativos

| ADR                                                             | Decisão                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [0001](0001-fork-e-republicacao-como-bitize-bit-mde.md)         | Fork de `node-mde` republicado como `@bitize/bit-mde`                          |
| [0002](0002-publicacao-por-oidc-sem-npm-token.md)               | Publicação pela CI por Trusted Publishing (OIDC), sem `NPM_TOKEN`              |
| [0003](0003-lockfile-versionado.md)                             | `package-lock.json` versionado e `npm ci` em todos os workflows                |
| [0004](0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) | Erro de configuração lança; erro de rede/SEFAZ vira retorno                    |
| [0005](0005-object-freeze-pervasivo.md)                         | `Object.freeze` em todo módulo e nas instâncias públicas                       |
| [0006](0006-js-com-jsdoc-em-vez-de-typescript.md)               | JavaScript com JSDoc em vez de TypeScript no fonte                             |
| [0007](0007-assinatura-por-infevento-e-splice-do-lote.md)       | Assinatura individual por `infEvento` e montagem do lote por recorte de string |
| [0008](0008-build-com-uglifyjs-beautify.md)                     | `lib/` gerado por UglifyJS em modo `beautify`                                  |
| [0009](0009-certificados-fora-do-git-e-gerador-descartavel.md)  | Certificados fora do git, com gerador de certificado de teste descartável      |
| [0011](0011-files-e-exports-como-contrato-de-empacotamento.md)  | `files` e `exports` como contrato de empacotamento, sem `.npmignore`           |
| [0012](0012-renomeacao-para-bitize-bitmde.md)                   | Pacote e repositório renomeados de `bit-mde` para `bitmde`                     |

> O **0010** está reservado pela tarefa [GH-3](../../tasks/specified/GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md), que já o referencia em texto commitado — daí o salto na tabela. Número de ADR não se reutiliza nem se renumera.

## Próximos candidatos

Decisões já tomadas na prática que ainda não viraram ADR formal:

- `rejectUnauthorized: false` como default do `https.Agent`, com a cadeia ICP-Brasil embutida em `src/env/ca.js` (hoje em [../camadas/services-sefaz.md](../camadas/services-sefaz.md))
- Todo campo de retorno é string — `parseTagValue: false` e `parseAttributeValue: false` no parser (hoje em [../camadas/schemas-xml.md](../camadas/schemas-xml.md))
- Sem retry, backoff ou controle de cadência dentro da biblioteca (hoje em [../fluxos/distribuicao-dfe.md](../fluxos/distribuicao-dfe.md))
- `prettier.config.js` com `endOfLine: 'auto'` enquanto não houver `.gitattributes`, e Prettier fixado em versão exata
- Mensagens de erro em português comparadas literalmente nos testes (hoje em [../camadas/validators.md](../camadas/validators.md))
- Exportar a API em três formas (`module.exports`, `.default`, `.mde`)
