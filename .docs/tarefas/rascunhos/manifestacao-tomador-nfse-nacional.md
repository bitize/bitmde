# Manifestação do tomador da NFS-e Nacional

| Campo                | Valor                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| **Issue**            | —                                                                       |
| **Status**           | rascunhos                                                               |
| **Plano**            | rascunho: nfse-nacional-distribuicao-e-manifestacao                     |
| **Prioridade**       | P2 (médio)                                                              |
| **Tipo**             | feature                                                                 |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / env / util / test |
| **Criado em**        | 2026-10-15                                                              |
| **Atualizado em**    | 2026-10-15                                                              |
| **Concluído em**     | —                                                                       |

---

## Contexto e motivação

Segunda filha do plano [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/rascunhos/nfse-nacional-distribuicao-e-manifestacao.md). Entrega o lado de escrita: o equivalente, para serviço, do que a `RecepcaoEvento` faz para NF-e.

Na NFS-e Nacional, o tomador manifesta-se sobre a nota com dois eventos, registrados na **SEFIN Nacional** (não no ADN):

| Evento                 | Código    |
| ---------------------- | --------- |
| Confirmação do tomador | `e203202` |
| Rejeição do tomador    | `e203206` |

O fluxo, pelo que dizem o manual de API e os relatos da comunidade (a confirmar — ver questões em aberto): montar o `pedRegEvento`, assinar o `infPedReg` com XMLDSig, compactar com GZip, codificar em base64 e enviar num JSON por `POST /nfse/{chaveAcesso}/eventos`, no campo `pedidoRegistroEventoXmlGZipB64`.

Depende da filha 1, que cria o ADR 0015, o retorno e o transporte REST/JSON (Decisões 1 a 3 do plano).

## Escopo

### Dentro

- Classe pública nova, com um método para cada evento ou um método parametrizado — decidido na especificação.
- Montagem do `pedRegEvento`, assinatura do `infPedReg`, gzip + base64 e envio.
- Motivo da Rejeição como entrada obrigatória, com as regras de tamanho do leiaute.
- Endpoints de produção e produção restrita da SEFIN Nacional em `src/env/`.
- `test/tls-sefaz.test.js` estendido para os hosts da SEFIN.
- `README.md`, `CHANGELOG.md` e docs de `.docs/arquitetura/`, incluindo um fluxo novo ao lado de [fluxos/recepcao-evento.md](../../arquitetura/fluxos/recepcao-evento.md).

### Fora

- Eventos de prestador e de intermediário, cancelamento, substituição — fora do plano.
- Lote de eventos: a SEFIN recebe um evento por chamada, ao contrário do `envEvento` da NF-e. A biblioteca não simula lote.
- Anulação de rejeição (`ANULACAO_REJEICAO`) — issue futura, se aparecer consumidor.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [apis](../../arquitetura/camadas/apis.md) — API pública, config congelada, JSDoc que vira `.d.ts`
- [ ] [validators](../../arquitetura/camadas/validators.md) — contrato `isValid()`/`getValues()`, mensagens literais
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — ordem das chaves, opções do parser
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mTLS, mescla de options, status sintético
- [ ] [env](../../arquitetura/camadas/env.md) — endpoints, `EVENTOS`, `CA`, `VERSION`
- [ ] Fluxo: [recepção](../../arquitetura/fluxos/recepcao-evento.md)
- [ ] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] ADRs relacionados — listar em **Referências**

## Requisitos preliminares

> Rascunho. Fecham na especificação, depois das questões em aberto.

| ID    | Requisito                                                                                                                                                                  | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | Classe pública nova, exportada nas três formas por `src/index.js`, com config de certificado e `tpAmb` igual à das outras APIs                                             | Must       |
| RF-02 | Registrar Confirmação do tomador (`e203202`) para uma chave de acesso                                                                                                      | Must       |
| RF-03 | Registrar Rejeição do tomador (`e203206`) com motivo                                                                                                                       | Must       |
| RF-04 | `infPedReg` assinado com o A1 da config, como o `infEvento` da NF-e é hoje                                                                                                 | Must       |
| RF-05 | Retorno e erro no contrato da Decisão 2 do plano; `reqXml` com o `pedRegEvento` assinado, antes do gzip                                                                    | Must       |
| RF-06 | `RecepcaoEvento` de NF-e inalterada — inclusive o recorte por `indexOf` do lote ([ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)) | Must       |

## Questões em aberto — resolver em produção restrita antes de especificar

| #   | Questão                                                                                                                                         | Como resolver                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Onde está o Swagger da SEFIN Nacional? `SefinNacional/docs/index.html` e `SefinNacional/swagger/v1/swagger.json` dão 404 com certificado        | Manual de API do contribuinte (v1.2, out/2025) e portal gov.br/nfse |
| 2   | Rota e corpo: `POST /SefinNacional/nfse/{chaveAcesso}/eventos` com `{ pedidoRegistroEventoXmlGZipB64 }`?                                        | Chamada em produção restrita                                        |
| 3   | Leiaute do `pedRegEvento`/`infPedReg` (`Id`, `tpAmb`, `verAplic`, `dhEvento`, `CNPJAutor`, `chNFSe`, `nPedRegEvento`) e do grupo de cada evento | XSD vigente (`pedRegEvento_v1.01.xsd`, `tiposEventos_v1.01.xsd`)    |
| 4   | O `xml-crypto` com a configuração da NF-e (C14N, RSA-SHA1 ou SHA-256) é aceito, ou a SEFIN exige outro algoritmo?                               | Envio em produção restrita                                          |
| 5   | O E0717 ("assinatura é obrigatória") relatado com alguns e-CNPJ A1 se reproduz com o nosso?                                                     | Envio em produção restrita                                          |
| 6   | Formato da resposta de sucesso e de rejeição (status HTTP, campos, evento processado devolvido em gzip?)                                        | Envio em produção restrita                                          |
| 7   | A cadeia dos hosts da SEFIN fecha com o `CA_PADRAO`?                                                                                            | Handshake sem A1                                                    |

## Referências

- Plano: [NFS-e Nacional: distribuição e manifestação do tomador](../../planos/rascunhos/nfse-nacional-distribuicao-e-manifestacao.md)
- [fluxos/recepcao-evento.md](../../arquitetura/fluxos/recepcao-evento.md) e [ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md) — como a NF-e assina hoje
- [Manual dos Contribuintes — Emissor Público / API do Sistema Nacional NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf/@@download/file) (v1.2, out/2025)
- [Manual dos Municípios — Emissor Público / API](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-municipios-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out21025.pdf) — rota `POST /nfse/{chaveAcesso}/eventos`
- Relato do E0717 na Confirmação do tomador: [fórum ACBr, tópico 91333](https://www.projetoacbr.com.br/forum/topic/91333-erro-e0717-ao-registrar-evento-de-manifesta%C3%A7%C3%A3o-de-tomador-%E2%80%94-certificado-icp-brasil-e-cnpj-rfb-a1-rejeitado-pelo-webservice/)
- Issue: —

## Histórico de revisões

| Data       | Rev | Descrição                                   |
| ---------- | --- | ------------------------------------------- |
| 2026-10-15 | 0.1 | Rascunho criado como filha 2 do plano NFS-e |
