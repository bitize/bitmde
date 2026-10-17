# GH-17: NFS-e Nacional: distribuição e manifestação do tomador

| Campo                | Valor                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Issue**            | [GH-17](https://github.com/bitize/bitmde/issues/17)                                |
| **Status**           | concluidos                                                                         |
| **Prioridade**       | P2 (médio)                                                                         |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / services / env / util / test |
| **Criado em**        | 2026-10-15                                                                         |
| **Atualizado em**    | 2026-10-16                                                                         |
| **Concluído em**     | 2026-10-16                                                                         |

---

## Objetivo

Com o mesmo e-CNPJ A1 que já usa para NF-e, quem consome o bitmde **consulta por NSU os documentos da NFS-e Nacional do CNPJ no ADN** — sabendo, item a item, se o CNPJ é tomador, prestador ou intermediário — e **registra Confirmação e Rejeição do tomador** na SEFIN Nacional para NFS-e que exista no ADN. As duas APIs preservam a separação entre erro de entrada/configuração (lança) e erro de transporte/serviço (retorno), e o significado de `status`, `error` e `transportError` das APIs de NF-e ([ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)).

## Contexto e motivação

O bitmde cobre o lado de **mercadoria**: o `NFeDistribuicaoDFe` traz as NF-e emitidas contra o CNPJ e o `NFeRecepcaoEvento4` manifesta o destinatário. O lado de **serviço** não existia num lugar só até a NFS-e Nacional, obrigatória para todos os municípios desde 01/01/2026 (LC 214/2025, art. 62).

Com ela, o Ambiente de Dados Nacional (ADN) distribui ao contribuinte os documentos em que ele figura — o mesmo modelo de NSU da NF-e, em REST/JSON com mTLS ICP-Brasil —, e a SEFIN Nacional recebe os eventos de manifestação do tomador: Confirmação (`e203202`) e Rejeição (`e203206`).

Uma drenagem completa em produção (2026-10-15, registrada em [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md)) confirmou que o serviço entrega o **histórico inteiro** do CNPJ desde a primeira nota no ADN, com notas geradas pela SEFIN e por sistema próprio de município, e que a fila mistura notas recebidas, emitidas e eventos de terceiros. Os eventos de tomador reais observados mostram as assinaturas que a SEFIN aceita ([conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md)).

Não cabe numa tarefa só: são dois serviços, em dois hosts, com fluxos diferentes — leitura (`GET`, JSON com XML gzipado dentro) e escrita (XML assinado, gzipado, num `POST` JSON). Cada um é um PR revisável sozinho; juntos, entregam ao tomador de serviço o que o bitmde já entrega ao destinatário de mercadoria.

Sem o plano, quem consome — o bitERP, em primeiro lugar — só tem as NFS-e recebidas por importação manual de XML e não tem como manifestá-las.

## Escopo

### Dentro

- Distribuição do ADN: `GET /DFe/{NSU}` (lote e documento único, com `cnpjConsulta`) e `GET /NFSe/{ChaveAcesso}/Eventos`.
- Papel do CNPJ consultado em cada NFS-e distribuída (tomador, prestador ou intermediário), sem filtrar.
- Manifestação do tomador na SEFIN Nacional: Confirmação (`e203202`) e Rejeição (`e203206`).
- Endpoints de produção e produção restrita das duas APIs.
- ADRs da NFS-e no bitmde e do retorno próprio da NFS-e.
- `README.md`, `CHANGELOG.md`, `CLAUDE.md` e `.docs/arquitetura/` atualizados por cada filha, no PR dela.

### Fora

- Emissão de NFS-e (DPS), cancelamento e substituição pelo prestador — o bitmde não emite documento; descartado.
- Eventos de prestador e de intermediário (`e202201`, `e202205`, `e204203`, `e204207`) e anulação de rejeição (`e205208`) — issue futura, se aparecer consumidor.
- DANFSe — issue futura; a [NT 008/2026](https://www.gov.br/nfse/pt-br/noticias/se-cgnfs-e-publica-nota-tecnica-no-008-2026-com-regras-para-emissao-do-danfse) mudou o padrão e a API.
- Captura automática, agendamento e guarda do último NSU — é de quem consome; a biblioteca não guarda estado ([arquitetura/README.md](../../arquitetura/README.md)).
- Interpretação dos campos da NFS-e além do papel do CNPJ — a biblioteca devolve XML e JSON, como faz com o `docZip`.
- NFS-e de município fora do ADN (webservices municipais ABRASF) — descartado.
- CT-e e MDF-e — já estão na [GH-3](../../tarefas/concluidas/GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md).

## Tarefas filhas

| Ordem | Tarefa                                                                                                                    | Status     | Depende de | Entrega                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1     | [GH-18 — Distribuição de NFS-e Nacional pelo ADN](../../tarefas/concluidas/GH-18-distribuicao-nfse-nacional-adn.md)       | concluidas | —          | `DistribuicaoNFSe`: fila do ADN por NSU e consulta por chave, com papel por item; retorno próprio da NFS-e; ADRs 0015 e 0016 |
| 2     | [GH-19 — Manifestação do tomador da NFS-e Nacional](../../tarefas/concluidas/GH-19-manifestacao-tomador-nfse-nacional.md) | concluidas | GH-18      | `ManifestacaoNFSe`: Confirmação e Rejeição do tomador na SEFIN Nacional                                                      |

A GH-19 depende da GH-18 pelas decisões 2 a 5: a GH-18 cria o retorno da NFS-e, o transporte REST/JSON, o validator de chave de 50 dígitos e o de CNPJ, que a GH-19 reaproveita.

A GH-18 foi entregue no PR #20 (merge `cce9548`, 2026-10-15), com os dois desvios aprovados registrados nas notas dela: `consultaNSU` pede `nsu - 1` e o `error` sai do HTTP e do `Erros`, não só do `StatusProcessamento`. O segundo afeta a GH-19 pela Decisão 2 abaixo.

A GH-19 foi entregue no PR #23 (merge `3e8c976`, 2026-10-16). O desvio aprovado está nas notas dela: sem nota de teste em produção restrita, os testes reais foram em **produção** — pedidos que a SEFIN rejeita (chave inventada) no `sefaz.test.js` e **uma** Confirmação real, fora da suíte, sobre nota legítima escolhida pelo usuário. Nenhuma Rejeição foi enviada à SEFIN.

## Decisões transversais

### Decisão 1: NFS-e Nacional no próprio bitmde

- **Opções consideradas:** (A) pacote separado só para NFS-e; (B) novas classes públicas no bitmde, ao lado de `DistribuicaoDFe` e `RecepcaoEvento`.
- **Escolha:** B.
- **Justificativa:** mTLS com A1 (PFX ou PEM), `CA_PADRAO` (que fecha a cadeia dos quatro hosts — ADN e SEFIN, produção e produção restrita), gunzip, erro de transporte sem vazar a chave ([ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)), assinatura XMLDSig e o pipeline de release com provenance já estão prontos e testados aqui. Um pacote separado duplicaria tudo isso. O custo é o nome: "MDe" passa a cobrir mais que manifestação de NF-e. A mudança é aditiva e não quebra a compatibilidade do [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md).
- **Filhas afetadas:** GH-18 e GH-19.

> Vira o **ADR 0015**, escrito na GH-18. O 0010 está reservado pela GH-3.

### Decisão 2: retorno próprio da NFS-e, com o mesmo contrato de erro

- **Opções consideradas:** (A) reaproveitar o `RetornoHelper` da NF-e, com `resXml` carregando JSON; (B) retorno próprio, com o corpo cru em campo de nome honesto e o mesmo significado de `status`, `error` e `transportError`.
- **Escolha:** B.
- **Justificativa:** o `RetornoHelper` nasceu para SOAP: `reqXml`/`resXml` com JSON dentro mentiriam no nome, e a regra "status ≥ 300 vira `error`" erra no ADN, que responde fila vazia com HTTP 404. ADN e SEFIN ainda divergem entre si (PascalCase e `Erros[]` contra camelCase e `erro` único), então o `data` precisa de normalização própria de qualquer forma. O que o consumidor usa para tratar falha continua idêntico nas quatro APIs:

  | Campo            | Significado (igual ao da NF-e)                                                                        |
  | ---------------- | ----------------------------------------------------------------------------------------------------- |
  | `status`         | HTTP real, ou `0` sem resposta                                                                        |
  | `error`          | String, só quando houve falha; transporte com o texto exato `Falha de transporte (<code>): <message>` |
  | `transportError` | `{ code, message }`, só sem resposta HTTP                                                             |

  E o que é próprio da NFS-e:

  | Campo     | Conteúdo                                                                                                |
  | --------- | ------------------------------------------------------------------------------------------------------- |
  | `data`    | Normalizado em camelCase; `erros` e `alertas` sempre como array de `{ codigo, descricao, complemento }` |
  | `resBody` | Corpo cru da resposta, como veio; `''` sem resposta                                                     |
  | `reqXml`  | Só onde existe XML de domínio enviado — o `pedRegEvento` assinado, na filha 2                           |

- **Filhas afetadas:** GH-18 (cria o `RetornoNfseHelper`) e GH-19 (reaproveita).

> Contrato público com alternativa real: vira o **ADR 0016**, escrito na GH-18.

> **Confirmado na GH-19.** O `RetornoNfseHelper` ganhou `servico` (`'ADN'` padrão), `reqXml` e `falha`, sem mudar a distribuição. A SEFIN não declara status de processamento; o `error` sai do HTTP e dos `erros`, e o `erro` dela chega em array, não no objeto único do Swagger.

> **Revisto depois da GH-18.** A [ADR 0016](../../arquitetura/decisoes/0016-retorno-proprio-da-nfse.md) acrescentou duas regras que valem para toda API de NFS-e: na falha com resposta JSON, `data` é **mantido** com os `erros`; e o `error` sai do HTTP e dos `erros`, não do status que o serviço declara, porque o ADN rejeita o E2243 com `StatusProcessamento: DOCUMENTOS_LOCALIZADOS`. O `RetornoNfseHelper` entregue tem regras próprias do ADN — a mensagem `Resposta inesperada do ADN`, o `statusProcessamento` e o caso `NENHUM_DOCUMENTO_LOCALIZADO` —, então a GH-19 precisa parametrizá-lo por serviço, e não só acrescentar o `reqXml`.

### Decisão 3: transporte pelo `SefazService` existente, sem mudar o default

- **Opções consideradas:** (A) um service novo para REST; (B) o mesmo `SefazService`, com método, `Accept`, `Content-Type` e `responseType` informados por requisição pelo helper.
- **Escolha:** B.
- **Justificativa:** o `SefazService` já é genérico no que importa (agente mTLS, `CA_PADRAO`, `request` que nunca lança, só `code` e `message` saindo do erro). O default `application/soap+xml` continua valendo para NF-e. Os headers da NFS-e vão **na requisição**, que o axios mescla com os da instância — não em `requestOptions.headers`, que substitui o objeto inteiro ([services-sefaz.md](../../arquitetura/camadas/services-sefaz.md)). `responseType: 'text'` garante que `resBody` seja o corpo cru, e o `JSON.parse` acontece no helper, protegido.
- **Filhas afetadas:** GH-18 e GH-19.

> Confirmado na GH-18: o `Content-Type: application/soap+xml` do default vai num `GET` sem corpo e o ADN o ignora. Na GH-19 o `POST` tem corpo JSON, então o `Content-Type: application/json` vai na requisição — confirmado em produção.

### Decisão 4: CNPJ vem da config; quem confere contra o certificado é o serviço

- **Opções consideradas:** (A) extrair o CNPJ do certificado (OID `2.16.76.1.3.3`) e validar localmente; (B) `config.cnpj` obrigatório, só com validação de formato, e o serviço confere contra o certificado.
- **Escolha:** B.
- **Justificativa:** é o que a NF-e já faz ([validators.md](../../arquitetura/camadas/validators.md): "a SEFAZ é quem rejeita documento inválido"), e os dois serviços já conferem — o ADN rejeita `cnpjConsulta` de outra raiz, a SEFIN rejeita `CNPJAutor` fora da raiz do certificado (`E0812`). Extrair do certificado exigiria mudar o gerador de certificado de teste, que é load-bearing ([testes-e-certificados.md](../../arquitetura/testes-e-certificados.md)). `config.cnpj` é o CNPJ consultado no ADN (sempre enviado como `cnpjConsulta`, o que cobre filial de mesma raiz) e o `CNPJAutor` na SEFIN.
- **Filhas afetadas:** GH-18 e GH-19.

### Decisão 5: `tpAmb` `'2'` é a produção restrita

- **Escolha:** os mapas de endpoint seguem a convenção do [env.md](../../arquitetura/camadas/env.md): `'1'` produção, `'2'` produção restrita (que se identifica como `HOMOLOGACAO` no ADN e `2` na SEFIN). Endpoints num arquivo próprio, `src/env/nfse.js`.
- **Filhas afetadas:** GH-18 (ADN) e GH-19 (SEFIN).

## Riscos e questões em aberto

- ~~**Cobertura incompleta.** Nota de município que ainda não compartilha com o ADN não aparece. Não é falha da biblioteca, mas o `README.md` precisa dizer isso — filha 1.~~ Resolvido na GH-18: ressalva na seção da NFS-e do `README.md`.
- ~~**Manifestação de nota de município com sistema próprio.** O Anexo II (`E1818`, `E1831`) indica que a SEFIN aceita; não foi exercitado. Se não valer, a filha 2 restringe o escopo às geradas pela SEFIN e o objetivo deste plano é revisado.~~ Resolvido na GH-19: a Confirmação real em produção foi sobre nota de `ambGer` 1 e foi aceita.
- ~~**Nota de teste para a filha 2.** Produção restrita não tem nenhuma NFS-e com a Bitize como tomadora (a fila de lá ainda dava 404 em 2026-10-15). Alguém precisa emitir uma lá; manifestação em produção registra evento fiscal irreversível e só sai com decisão explícita sobre nota e evento. O `sefaz.test.js` da GH-18 já aceita a fila de produção restrita com ou sem documentos, então emitir a nota não o quebra.~~ Contornado na GH-19 por decisão do usuário: uma Confirmação real em produção, sobre nota que ele reconheceu como legítima.
- **Rejeição do tomador não exercitada contra o serviço.** Validada por unidade, por transporte local e por pedido rejeitado em produção (que já passou pela assinatura). Enviar uma Rejeição real só com nota que de fato mereça ser rejeitada, ou em produção restrita, se aparecer nota lá.
- ~~**Distribuição em produção nos testes.** O ADN não tem bloqueio de sequência (verificado), então o teste de integração da filha 1 pode ler em produção sem dessincronizar consumidor. Mesmo assim, o bitERP passa a capturar NFS-e depois desta entrega; o teste lê, nunca grava ponteiro.~~ Resolvido na GH-18: o `sefaz.test.js` só lê, e tira o CNPJ do certificado.
- **Cadeia TLS dos hosts novos.** Os quatro fecham com `CA_PADRAO` hoje. Cada filha estende o `test/tls-sefaz.test.js` (e com isso o `cadeia-tls.yml`) para os hosts que toca. Os do ADN entraram na GH-18 (Let's Encrypt, cross-sign da ISRG Root X1) e os da SEFIN na GH-19 (GlobalSign R46, como o Ambiente Nacional da NF-e).
- ~~**Status declarado pelo serviço não decide o erro.** O ADN rejeitou o E2243 com `StatusProcessamento: DOCUMENTOS_LOCALIZADOS`. A GH-19 confere, em produção restrita, se a SEFIN tem o mesmo comportamento, e decide o `error` pelo HTTP e pelos `erros`, como na ADR 0016.~~ Resolvido na GH-19: a SEFIN não declara status; rejeita com HTTP 400 e `erro` em array, e o `error` sai do HTTP e dos `erros`.
- **Intermitência dos testes com A1 real.** A conversão PFX→PEM leva perto de 2 s, o timeout padrão do mocha, e os testes de construtor com PFX estouram com a máquina carregada. Anterior ao plano e fora da CI; anotado no `CLAUDE.md`. Candidato a tarefa própria.

## Critério de conclusão

- [x] Nenhuma filha em `rascunhos/` ou `especificadas/`
- [x] Ao menos uma filha em `concluidas/`
- [x] Objetivo verificado: a distribuição drena uma fila real com o contrato da Decisão 2 (produção, 2026-10-16), e uma Confirmação do tomador é aceita pela SEFIN em produção (2026-10-16); a Rejeição é validada por unidade e por pedido rejeitado em produção, sem envio real — critério revisto, ver histórico 1.2
- [x] ADRs 0015 e 0016 aceitos
- [x] Release de **minor** com as duas APIs — segue [../../arquitetura/release.md](../../arquitetura/release.md), não é filha comum: [0.20.0](https://github.com/bitize/bitmde/releases/tag/v0.20.0), publicada no npm com provenance em 2026-10-16

## Notas de conclusão

> Preenchido ao encerrar. Registrar os **desvios** em relação a este plano — filha adicionada, cancelada, escopo que migrou — e o motivo de cada um. Se não houve, escrever "Sem desvios".

Nenhuma filha adicionada nem cancelada, e nenhum escopo migrou. Um desvio, no critério de conclusão:

- **Verificação em produção, e não em produção restrita** (revisão 1.2). Produção restrita não tinha NFS-e com a Bitize como tomadora, e ninguém emitiu uma. Por decisão do usuário, a GH-19 testou em produção: pedidos que a SEFIN rejeita na suíte de integração e **uma** Confirmação real, sobre nota legítima escolhida por ele. A Rejeição não foi enviada à SEFIN e segue registrada como risco aberto — validada por unidade, por transporte local e por pedido rejeitado em produção, que passou pela assinatura.

Aprendizados que valem para quem mexer na NFS-e: o ADN rejeita com status de processamento de sucesso (E2243, ADR 0016); a SEFIN exige a declaração XML (`E1229`) e responde `erro` em array, ao contrário do Swagger; e a SEFIN aceita manifestação de NFS-e gerada por sistema próprio de município.

## Conclusão e entrega

Executar quando a última filha sair de `especificadas/`:

- [x] Tabela de filhas com link e status final
- [x] Desvios registrados em "Notas de conclusão"
- [x] Cabeçalho: **Status** = `concluidos` e **Concluído em** preenchido
- [x] Arquivo movido: `git mv .docs/planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md .docs/planos/concluidos/`
- [x] Campo **Plano** da GH-18 e da GH-19 apontando para `../../planos/concluidos/` (era `especificados/`); os links das ADRs 0015 e 0016 também
- [x] Blockquote do plano na issue apontando para `.docs/planos/concluidos/` (era `especificados/`)
- [x] Issue do plano fechada no GitHub e no Linear

## Referências

- [Fluxo de planos](../README.md)
- [Visão geral da arquitetura](../../arquitetura/README.md), [camadas/apis.md](../../arquitetura/camadas/apis.md), [camadas/validators.md](../../arquitetura/camadas/validators.md), [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md), [camadas/services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), [camadas/env.md](../../arquitetura/camadas/env.md)
- [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md), [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0007](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md), [ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)
- [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md) e [conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md)
- Originais (manuais, Anexo II, XSDs e Swaggers): [conhecimento/fontes/nfse-nacional/](../../conhecimento/fontes/nfse-nacional/README.md)
- Issue: https://github.com/bitize/bitmde/issues/17
- Linear: [DEV-1098](https://linear.app/bitize/issue/DEV-1098)

## Histórico de revisões

| Data       | Rev | Descrição                                                                                                                                                                                                                                                                |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-15 | 0.1 | Criação do plano                                                                                                                                                                                                                                                         |
| 2026-10-15 | 0.2 | Decisões revistas com Swaggers, Anexo II e drenagem em produção: retorno próprio da NFS-e, CNPJ da config, papel por item, assinatura confirmada                                                                                                                         |
| 2026-10-15 | 1.0 | Promovido a `especificados` com a issue GH-17; filhas GH-18 e GH-19 promovidas junto e vinculadas como sub-issues                                                                                                                                                        |
| 2026-10-15 | 1.1 | GH-18 concluída (PR #20): Decisão 2 revista com a ADR 0016 e o `RetornoNfseHelper` a parametrizar na GH-19; riscos atualizados                                                                                                                                           |
| 2026-10-16 | 1.2 | GH-19 concluída (PR #23). Critério de conclusão revisto por decisão do usuário: Confirmação real em produção no lugar de Confirmação e Rejeição em produção restrita, que não tinha nota de teste; Rejeição sem envio real. Riscos atualizados. Falta o release de minor |
| 2026-10-16 | 2.0 | Release 0.20.0 publicado; plano concluído e movido para `concluidos/`                                                                                                                                                                                                    |
