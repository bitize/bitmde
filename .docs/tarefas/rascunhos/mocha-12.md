# GH-NN: Mocha 12

| Campo                | Valor        |
| -------------------- | ------------ |
| **Issue**            | GH-NN        |
| **Status**           | rascunhos    |
| **Plano**            | —            |
| **Prioridade**       | P3 (baixo)   |
| **Tipo**             | dependências |
| **Camadas afetadas** | test         |
| **Criado em**        | 2026-11-01   |
| **Atualizado em**    | 2026-11-01   |
| **Concluído em**     | —            |

---

## Contexto e motivação

Depois da [GH-32](https://github.com/bitize/bitmde/issues/32), o `npm audit` fica com 3 vulnerabilidades moderadas, todas de desenvolvimento: `mocha` 11.8.0 e, via ele, `glob` 10.5.0 ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)) e `minimatch` 9.0.9 ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). Nenhuma vai no pacote publicado. A correção é o `mocha` 12, que é major: declara `glob ^13`, `minimatch ^10.2.2`, `js-yaml ^5`, `diff ^9` e `chokidar ^5`, e exige Node `^20.19.0 || >=22.12.0` — a matriz da CI (22 e 24) atende.

O `npm audit` sugere `mocha` 11.0.0 como correção. Está errado: é um downgrade que não corrige nada.

## A especificar

- Mudanças do `mocha` 12 que afetam a suíte (opções de linha de comando, `.mocharc`, reporter, `--grep`).
- Se os `overrides` de `diff` e `serialize-javascript` no `package.json` deixam de ser necessários com as faixas do `mocha` 12 — a expectativa é que sim, e então saem.
- Se a contagem de testes do `test:ci` se mantém.

## Referências

- [ADR 0003 — lockfile versionado](../../arquitetura/decisoes/0003-lockfile-versionado.md)
- [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md)

## Histórico de revisões

| Data       | Rev | Descrição           |
| ---------- | --- | ------------------- |
| 2026-11-01 | 0.1 | Rascunho, da GH-32. |
