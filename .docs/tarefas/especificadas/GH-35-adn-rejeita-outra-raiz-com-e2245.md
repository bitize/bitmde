# GH-35: ADN rejeita CNPJ de outra raiz com `E2245`, não mais `E2243`

| Campo                | Valor                                               |
| -------------------- | --------------------------------------------------- |
| **Issue**            | [GH-35](https://github.com/bitize/bitmde/issues/35) |
| **Status**           | especificadas                                       |
| **Plano**            | —                                                   |
| **Prioridade**       | P2 (médio)                                          |
| **Tipo**             | correção                                            |
| **Camadas afetadas** | test                                                |
| **Criado em**        | 2026-11-01                                          |
| **Atualizado em**    | 2026-11-01                                          |
| **Concluído em**     | —                                                   |

---

## Contexto e motivação

Na validação da [GH-32](https://github.com/bitize/bitmde/issues/32), o `test/sefaz.test.js` com A1 real falhou em um teste: `DistribuicaoNFSe — cnpj de outra raiz em produção restrita: error com E2243`. A falha se reproduz com as dependências anteriores à GH-32, então não foi ela. Foi o ADN que mudou a resposta.

Sondagem de 2026-11-01, só leitura, com A1 real, `consultaUltNSU('0')`:

| `cnpj` consultado         | Ambiente | HTTP | `StatusProcessamento`         | `Erros` | `TipoConsulta`         |
| ------------------------- | -------- | ---- | ----------------------------- | ------- | ---------------------- |
| O do certificado          | Restrita | 404  | `NENHUM_DOCUMENTO_LOCALIZADO` | `E2220` | `CnpjBase`             |
| O do certificado          | Produção | 200  | `DOCUMENTOS_LOCALIZADOS`      | —       | `CnpjBase`             |
| Filial da mesma raiz      | Ambos    | 404  | `NENHUM_DOCUMENTO_LOCALIZADO` | `E2220` | `CnpjBase`             |
| De outra raiz (dois CNPJ) | Ambos    | 400  | **`REJEICAO`**                | `E2245` | `InscricaoCertificado` |

A descrição do `E2245` é "Não há procuração da inscrição `<CNPJ do certificado>` para a inscrição `<CNPJ consultado>`.". Em 2026-10-15 ([GH-18](../concluidas/GH-18-distribuicao-nfse-nacional-adn.md)), o mesmo caso voltava HTTP 400, `E2243` ("O CNPJ informado na consulta deve ter o mesmo CNPJ Base do Contribuinte solicitante.") e `StatusProcessamento: DOCUMENTOS_LOCALIZADOS`.

Três leituras disso:

1. **A biblioteca continua certa.** O `error` sai do HTTP e do `Erros` ([ADR 0016](../../arquitetura/decisoes/0016-retorno-proprio-da-nfse.md)), então o consumidor recebe `status: 400` e `error: 'E2245: Não há procuração…'` sem mudança de código. Nada em `src/` muda.
2. **O ADN passou a aceitar consulta por procuração.** A mensagem e o `TipoConsulta: InscricaoCertificado` indicam que um CNPJ de outra raiz não é mais recusado por regra: é recusado por falta de procuração. Com procuração cadastrada, a consulta deve passar. **Isso não foi confirmado**: não há procuração para testar.
3. **O exemplo histórico da ADR 0016 envelheceu.** O caso que a motivou — rejeição com `StatusProcessamento` de sucesso — não se reproduz mais com outra raiz. A regra da ADR continua valendo, porque o ADN pode voltar a fazer isso em qualquer código, e o teste do helper que a vigia não depende do ADN.

O que está errado hoje: o `sefaz.test.js` falha, e a documentação (README, docs de camada e de fluxo, `CLAUDE.md`, material de conhecimento) promete `E2243` a quem consulta outra raiz.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — invariante 1, retorno da NFS-e
- [x] [validators](../../arquitetura/camadas/validators.md) — `CnpjValidator` cita o `E2243`
- [x] Fluxo: [distribuição da NFS-e](../../arquitetura/fluxos/distribuicao-nfse.md) — `cnpjConsulta` e o que o ADN aceita
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md) — o bloco da `DistribuicaoNFSe` no `sefaz.test.js`
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                                                                                                                                                                                     | Prioridade |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | `test/sefaz.test.js`: o teste vira `cnpj de outra raiz em produção restrita: error com E2245`, e confere `status` 400, `error` começando com `'E2245: '` e `data.erros[0].codigo` `'E2245'`                                                                                                                                   | Must       |
| RF-02 | `test/sefaz.test.js`: teste novo `filial da mesma raiz em produção restrita: sucesso sem error`, com o CNPJ da filial `0002` derivado do certificado (`0003` se o certificado já for da `0002`), com DV calculado no teste. Aceita fila vazia (404) ou com documentos (200), como o teste do próprio CNPJ                     | Should     |
| RF-03 | Documentação: README (tabela "Quando há `error`"), [fluxos/distribuicao-nfse.md](../../arquitetura/fluxos/distribuicao-nfse.md), [camadas/validators.md](../../arquitetura/camadas/validators.md), [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md) e `CLAUDE.md` passam a citar `E2245` e a procuração | Must       |
| RF-04 | [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md): a tabela de 2026-10-15 fica como registro datado; entra a sondagem de 2026-11-01 e, em "Ainda não confirmado", a consulta por procuração                                                                              | Must       |
| RF-05 | `test/distribuicaoNFSe-helper.test.js`: o teste `HTTP 400 com Erros vira error mesmo com DOCUMENTOS_LOCALIZADOS` fica, com o comentário dizendo que é como o ADN respondia até 2026-10 — ele vigia a regra da ADR 0016, não o ADN                                                                                             | Must       |
| RF-06 | `CHANGELOG.md` em `[Não publicado]`, subseção `### Corrigido`: o exemplo do README                                                                                                                                                                                                                                            | Must       |
| RF-07 | No mesmo PR, a mudança das skills `executar-tarefa` e `executar-plano`: o PR de conclusão de tarefa e de plano leva `@coderabbitai ignore` no corpo (Decisão 3)                                                                                                                                                               | Must       |

## Decisões de design

### Decisão 1: ADR 0016 não muda

- **Opções consideradas:** ADR novo que supersede a 0016; manter a 0016 e corrigir só os docs que descrevem o comportamento atual.
- **Escolha:** manter.
- **Justificativa:** a decisão da ADR 0016 — `error` sai do HTTP e do `Erros`, não só do `StatusProcessamento` — continua certa e continua necessária. O que envelheceu é o exemplo do contexto, que foi verdade em 2026-10-15 e está datado lá. ADR aceita não se edita, e não há decisão nova para registrar.

### Decisão 2: o `sefaz.test.js` não confere o `StatusProcessamento`

- **Opções consideradas:** conferir `REJEICAO`; não conferir.
- **Escolha:** não conferir, como o teste atual já não confere `DOCUMENTOS_LOCALIZADOS`; fica num comentário.
- **Justificativa:** o contrato da biblioteca não depende dele (ADR 0016). Conferir faria o teste quebrar por uma mudança do ADN que não afeta quem consome — o oposto do que aconteceu agora, em que a quebra apontou uma mudança que afeta a documentação pública.

### Decisão 3: a mudança das skills vai neste PR

- **Escolha:** pedido do usuário. É mudança de processo em `.claude/skills/`, sem relação com o ADN. Fica num commit próprio, para a revisão separar.

---

## Impacto por camada

### [test]

- `test/sefaz.test.js` — RF-01 e RF-02. A filial é calculada a partir de `cnpjDoCertificado()`, então nenhum CNPJ real fica no repositório. Com o certificado descartável, os testes da `DistribuicaoNFSe` já falham, e o novo também.
- `test/distribuicaoNFSe-helper.test.js` — só o comentário (RF-05). A fixture `E2243` com `DOCUMENTOS_LOCALIZADOS` fica: é o caso que prova a regra da ADR 0016.

Nenhuma mensagem de erro da biblioteca muda. Nenhum arquivo de `src/` muda.

---

## Testes

- [x] `npm run test:ci` verde, com a mesma contagem: nenhum teste novo fora do `sefaz.test.js`
- [x] `test/sefaz.test.js` rodado com A1 real: 23 de 23 (22 de antes, com o de outra raiz corrigido, mais o da filial)

## Checklist de implementação

- [x] Testes em `test/`
- [x] [README.md](../../../README.md) atualizado
- [x] `CHANGELOG.md` atualizado em `[Não publicado]`
- [x] Docs de `.docs/arquitetura/`, `.docs/conhecimento/` e `CLAUDE.md` atualizados
- [x] Skills `executar-tarefa` e `executar-plano` com o `@coderabbitai ignore`, em commit próprio

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [x] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real) — não se aplicou: `certs/` já existia, com o certificado descartável
- [x] `npm run test:ci` — tudo menos `test/sefaz.test.js`; é o que roda com o certificado descartável
- [x] `test/sefaz.test.js` rodado à parte (`npx mocha test/sefaz.test.js`) — exige certificado A1 válido e acesso à rede
- [x] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [x] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

- **Sem desvios.** Nada em `src/` mudou.
- **Testes.** `npm run test:ci`: 251 passando antes e depois. `test/sefaz.test.js` com A1 real: 23 de 23, rodado de um diretório temporário com `certs/` apontando para o A1. A filial do teste novo é derivada do CNPJ do certificado durante a execução; nenhum CNPJ real entrou no repositório.
- **Contagem da suíte inteira**: 296 testes, 23 deles no `sefaz.test.js`. A frase do `CLAUDE.md` e de [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md) foi de "273 dos 295" para "273 dos 296". Com o certificado descartável, `npx mocha` deu 275 passando e 21 falhando, todas no `sefaz.test.js`. Uma rodada anterior teve uma falha a mais, que não se repetiu: oscilação de rede.
- **`E2243` ainda citado de propósito** no comentário do `retornoNfse-helper.js` e no teste do helper, que vigiam a regra da ADR 0016; na ADR 0016, que é registro datado; e em `CLAUDE.md`, `fluxos/distribuicao-nfse.md` e no material de conhecimento, como histórico. O comentário de `src/` não foi tocado, para o PR não mexer em código.

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/tarefas/especificadas/GH-35-adn-rejeita-outra-raiz-com-e2245.md .docs/tarefas/concluidas/GH-35-adn-rejeita-outra-raiz-com-e2245.md`
- [ ] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [ ] Issue fechada no GitHub

## Referências

- [ADR 0016 — retorno próprio da NFS-e](../../arquitetura/decisoes/0016-retorno-proprio-da-nfse.md)
- [fluxos/distribuicao-nfse.md](../../arquitetura/fluxos/distribuicao-nfse.md), [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md)
- [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md) — a sondagem de 2026-10-15
- [GH-18](../concluidas/GH-18-distribuicao-nfse-nacional-adn.md), onde o `E2243` foi observado; [GH-32](https://github.com/bitize/bitmde/issues/32), onde a mudança apareceu
- Issue: https://github.com/bitize/bitmde/issues/35

## Histórico de revisões

| Data       | Rev | Descrição                |
| ---------- | --- | ------------------------ |
| 2026-11-01 | 1.0 | Criação da especificação |
| 2026-11-01 | 1.1 | Implementação e notas    |
