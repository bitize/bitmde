# Distribuição de NFS-e Nacional pelo ADN

| Campo                | Valor                                                         |
| -------------------- | ------------------------------------------------------------- |
| **Issue**            | —                                                             |
| **Status**           | rascunhos                                                     |
| **Plano**            | rascunho: nfse-nacional-distribuicao-e-manifestacao           |
| **Prioridade**       | P2 (médio)                                                    |
| **Tipo**             | feature                                                       |
| **Camadas afetadas** | apis / validators / controllers / helpers / env / util / test |
| **Criado em**        | 2026-10-15                                                    |
| **Atualizado em**    | 2026-10-15                                                    |
| **Concluído em**     | —                                                             |

---

## Contexto e motivação

Primeira filha do plano [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/rascunhos/nfse-nacional-distribuicao-e-manifestacao.md). Entrega o lado de leitura: o equivalente, para serviço, do que a `DistribuicaoDFe` faz para NF-e.

O ADN expõe dois métodos, em REST/JSON com mTLS. O contrato e o comportamento observado estão em [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md):

- `GET /DFe/{NSU}?lote=true|false&cnpjConsulta=…` — lote a partir do NSU, ou o documento de um NSU;
- `GET /NFSe/{ChaveAcesso}/Eventos` — eventos de uma NFS-e.

Esta filha também escreve o **ADR 0015** (Decisão 1 do plano) e estabelece o retorno e o transporte REST/JSON (Decisões 2 e 3) que a filha de manifestação reaproveita.

## Escopo

### Dentro

- Classe pública nova, com os dois métodos do ADN — nomes finais na especificação.
- `cnpjConsulta` opcional, validado contra a raiz do CNPJ do certificado antes de ir à rede.
- Gunzip + base64 de cada `ArquivoXml`, com o tratamento item a item do [ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md): documento corrompido não derruba o lote.
- HTTP 404 com `NENHUM_DOCUMENTO_LOCALIZADO` tratado como lote vazio, não como erro.
- Endpoints de produção e produção restrita em `src/env/`.
- `test/tls-sefaz.test.js` estendido para `adn.nfse.gov.br` e `adn.producaorestrita.nfse.gov.br`.
- ADR 0015, `README.md`, `CHANGELOG.md` e docs de `.docs/arquitetura/`.

### Fora

- Manifestação do tomador — filha 2 do plano.
- Guarda do último NSU e cadência de consulta — é de quem consome.
- Interpretação dos campos do XML da NFS-e.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [ ] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, status sintético
- [ ] [env](../../arquitetura/camadas/env.md) — endpoints, `EVENTOS`, `CA`, `VERSION`
- [ ] Fluxo: [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md)
- [ ] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] ADRs relacionados — listar em **Referências**

## Requisitos preliminares

> Rascunho. Fecham na especificação, depois das questões em aberto.

| ID    | Requisito                                                                                                                       | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | Classe pública nova, exportada nas três formas por `src/index.js`, com config de certificado e `tpAmb` igual à das APIs de NF-e | Must       |
| RF-02 | Consulta de lote a partir de um NSU e de um NSU único (`lote=false`)                                                            | Must       |
| RF-03 | Consulta dos eventos de uma NFS-e pela chave de acesso (50 dígitos)                                                             | Must       |
| RF-04 | `cnpjConsulta` opcional; raiz diferente da do certificado lança erro de configuração                                            | Must       |
| RF-05 | `ArquivoXml` devolvido como XML e como JSON; falha de um item vai para uma lista de erros por item, sem esvaziar `data`         | Must       |
| RF-06 | Fila vazia (HTTP 404 + `NENHUM_DOCUMENTO_LOCALIZADO`) devolvida como lote vazio, sem `error`                                    | Must       |
| RF-07 | Retorno e erro no contrato da Decisão 2 do plano                                                                                | Must       |
| RF-08 | API de NF-e inalterada em assinatura e comportamento                                                                            | Must       |
| RF-09 | ADR 0015 — NFS-e Nacional no bitmde                                                                                             | Must       |

## Questões em aberto — resolver em produção restrita antes de especificar

| #   | Questão                                                                                               | Como resolver                                                       |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | O ADN rejeita consulta fora de sequência, como o `cStat` 656 da NF-e?                                 | Repetir o mesmo NSU e voltar para um anterior, em produção restrita |
| 2   | Quantos itens vêm por lote?                                                                           | Lote real com mais documentos que o limite                          |
| 3   | Formato do `ArquivoXml` no lote — gzip + base64, como diz o Swagger, para todos os `TipoDocumento`?   | Lote real com NFS-e e evento                                        |
| 4   | Qual o retorno de `REJEICAO` (status HTTP, `Codigo`)? Ex.: `cnpjConsulta` de outra raiz, NSU negativo | Provocar as duas situações                                          |
| 5   | A cadeia de `adn.nfse.gov.br` (produção) fecha com o `CA_PADRAO`?                                     | Handshake sem A1, como o `tls-sefaz.test.js` já faz                 |
| 6   | Como gerar documento de teste em produção restrita para a Bitize como tomadora?                       | Emitir NFS-e de teste no Emissor Nacional de produção restrita      |

## Referências

- Plano: [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/rascunhos/nfse-nacional-distribuicao-e-manifestacao.md)
- [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md)
- [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)
- [Manual dos Contribuintes — APIs do ADN](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf)
- Implementações de terceiros (ler como fonte de armadilha, não como modelo): [omartelo/nfse4j#4](https://github.com/omartelo/nfse4j/pull/4), [t3wv/nfse#50](https://github.com/t3wv/nfse/issues/50)
- Issue: —

## Histórico de revisões

| Data       | Rev | Descrição                                   |
| ---------- | --- | ------------------------------------------- |
| 2026-10-15 | 0.1 | Rascunho criado como filha 1 do plano NFS-e |
