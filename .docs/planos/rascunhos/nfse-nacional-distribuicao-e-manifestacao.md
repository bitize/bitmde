# NFS-e Nacional: distribuição e manifestação do tomador

| Campo                | Valor                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| **Issue**            | —                                                                       |
| **Status**           | rascunhos                                                               |
| **Prioridade**       | P2 (médio)                                                              |
| **Camadas afetadas** | apis / validators / controllers / helpers / schemas / env / util / test |
| **Criado em**        | 2026-10-15                                                              |
| **Atualizado em**    | 2026-10-15                                                              |
| **Concluído em**     | —                                                                       |

---

## Objetivo

Com o mesmo certificado A1 que já usa para NF-e, quem consome o bitmde **lista as NFS-e Nacionais em que o CNPJ figura como tomador** (por NSU, com os eventos de cada nota) e **registra Confirmação e Rejeição do tomador** na SEFIN Nacional. As duas APIs seguem o contrato de erro das APIs de NF-e ([ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)). Verificado em produção restrita.

## Contexto e motivação

O bitmde cobre o lado de **mercadoria**: o `NFeDistribuicaoDFe` traz as NF-e emitidas contra o CNPJ e o `NFeRecepcaoEvento4` manifesta o destinatário. O lado de **serviço** não existia num lugar só até a NFS-e Nacional, obrigatória para todos os municípios desde 01/01/2026 (LC 214/2025, art. 62).

Com ela, o Ambiente de Dados Nacional (ADN) passou a distribuir ao contribuinte as NFS-e "em que figure como emitente, tomador ou intermediário" — o mesmo modelo de NSU da NF-e, em REST/JSON e com mTLS ICP-Brasil. E a SEFIN Nacional recebe os eventos do tomador: Confirmação (`e203202`) e Rejeição (`e203206`). O que se observou do ADN está em [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md).

Não cabe numa tarefa só porque são dois serviços, em dois hosts, com fluxos diferentes: a distribuição é leitura (`GET`, JSON com XML gzipado dentro), e a manifestação é escrita com assinatura XMLDSig do `infPedReg`, gzip e `POST`. Cada um é um PR revisável sozinho. Juntos, entregam ao tomador de serviço o mesmo que o bitmde já entrega ao destinatário de mercadoria.

Sem o plano, quem consome (o bitERP, em primeiro lugar) só tem as NFS-e recebidas por importação manual de XML, e não tem como manifestá-las.

## Escopo

### Dentro

- Distribuição do ADN: `GET /DFe/{NSU}` (lote e documento único, com `cnpjConsulta` para filial de mesma raiz) e `GET /NFSe/{ChaveAcesso}/Eventos`.
- Manifestação do tomador na SEFIN Nacional: Confirmação (`e203202`) e Rejeição (`e203206`).
- Endpoints de produção e produção restrita das duas APIs.
- ADR registrando que o bitmde passa a cobrir NFS-e Nacional (REST/JSON) além de NF-e (SOAP).
- `README.md`, `CHANGELOG.md` e `.docs/arquitetura/` atualizados por cada filha, no PR dela.

### Fora

- Emissão de NFS-e (DPS), cancelamento e substituição pelo prestador — o bitmde não emite documento; descartado.
- Eventos de prestador e de intermediário (`e202201`, `e202205`, `e204203`, `e204207`) — issue futura, se aparecer consumidor.
- DANFSe (PDF) — issue futura.
- Captura automática, agendamento e guarda do último NSU — é de quem consome; a biblioteca não guarda estado ([arquitetura/README.md](../../arquitetura/README.md)).
- Interpretação dos campos do XML da NFS-e — a biblioteca devolve o XML e o JSON cru, como faz com o `docZip`; o bitERP já tem parser do padrão Nacional.
- NFS-e de município fora do ADN (webservices municipais ABRASF) — descartado.
- CT-e e MDF-e — já estão na [GH-3](../../tarefas/especificadas/GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md).

## Tarefas filhas

| Ordem | Tarefa                                                                                              | Status    | Depende de | Entrega                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------- | --------- | ---------- | ------------------------------------------------------------------------------------------ |
| 1     | [distribuicao-nfse-nacional-adn](../../tarefas/rascunhos/distribuicao-nfse-nacional-adn.md)         | rascunhos | —          | Classe pública que lê as NFS-e recebidas e os eventos de uma nota no ADN; ADR da Decisão 1 |
| 2     | [manifestacao-tomador-nfse-nacional](../../tarefas/rascunhos/manifestacao-tomador-nfse-nacional.md) | rascunhos | filha 1    | Classe pública que registra Confirmação e Rejeição do tomador na SEFIN Nacional            |

A filha 2 depende da 1 pelas decisões 2 e 3: a 1 é quem cria o retorno e o transporte REST/JSON que a 2 reaproveita.

## Decisões transversais

### Decisão 1: NFS-e Nacional no próprio bitmde

- **Opções consideradas:** (A) pacote separado só para NFS-e; (B) novas classes públicas no bitmde, ao lado de `DistribuicaoDFe` e `RecepcaoEvento`.
- **Escolha:** B.
- **Justificativa:** o que é difícil já está pronto e testado aqui: mTLS com A1 (PFX ou PEM), `CA_PADRAO` (que já fechou a cadeia do ADN em produção restrita), gunzip, erro de transporte sem vazar a chave ([ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)) e o pipeline de release com provenance. Um pacote separado duplicaria tudo isso e teria que acompanhar as correções. O custo é o nome: "MDe" passa a cobrir mais que manifestação de NF-e. Como a mudança é aditiva, não quebra a compatibilidade do [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md).
- **Filhas afetadas:** 1 e 2.

> Amplia o escopo da biblioteca e tem reversão custosa (tirar daqui depois quebra quem consome): vira **ADR 0015**, escrito na filha 1.

### Decisão 2: mesmo contrato de retorno e de erro das APIs de NF-e

- **Opções consideradas:** (A) devolver o JSON do serviço como veio; (B) mesma forma de topo das APIs de NF-e — `{ data, reqXml, resXml, status, error?, transportError? }`, com `data` normalizado.
- **Escolha:** B. `reqXml` leva o XML de domínio enviado (o `pedRegEvento` assinado na filha 2; `''` na filha 1, que não envia corpo) e `resXml` leva o corpo cru da resposta, como veio — mesmo que seja JSON. Isso preserva o que o campo significa hoje em [controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md): "o corpo cru da resposta, como veio".
- **Justificativa:** quem consome as quatro APIs testa `error` e `transportError` do mesmo jeito, e o `RetornoHelper` continua sendo a única definição de retorno. Erro de configuração lança, erro de rede ou do serviço vira retorno. O nome `resXml` com conteúdo JSON é o preço; renomear só nas APIs novas criaria dois contratos para a mesma ideia.
- **Exceção que cada filha resolve no seu helper:** o ADN responde **HTTP 404** com `NENHUM_DOCUMENTO_LOCALIZADO` para fila vazia ([conhecimento](../../conhecimento/nfse-nacional-adn-distribuicao.md)). Isso não é erro, mas a regra "status ≥ 300 vira `error`" do `RetornoHelper` o trataria como erro. A filha 1 especifica como isso fica.
- **Filhas afetadas:** 1 e 2.

### Decisão 3: transporte pelo `SefazService` existente, sem mudar o default

- **Opções consideradas:** (A) um service novo para REST; (B) o mesmo `SefazService`, com método, `Content-Type` e `Accept` informados por requisição pelo helper.
- **Escolha:** B.
- **Justificativa:** o `SefazService` já é genérico no que importa (agente mTLS, `CA_PADRAO`, `request` que nunca lança, só `code` e `message` saindo do erro). O default `application/soap+xml` continua valendo para NF-e. As APIs de NFS-e informam `application/json` **por requisição**, que o axios mescla com os headers da instância — não por `requestOptions.headers`, que substitui o objeto inteiro ([services-sefaz.md](../../arquitetura/camadas/services-sefaz.md)).
- **Filhas afetadas:** 1 e 2.

### Decisão 4: `tpAmb` `'2'` é a produção restrita

- **Escolha:** os mapas de endpoint das duas APIs seguem a convenção do [env.md](../../arquitetura/camadas/env.md): `'1'` produção, `'2'` produção restrita (que se identifica como `TipoAmbiente: HOMOLOGACAO`). Não há terceiro ambiente.
- **Filhas afetadas:** 1 e 2.

## Riscos e questões em aberto

- **Cobertura incompleta.** Nota de município que ainda não compartilha com o ADN não aparece. Não é falha da biblioteca, mas o `README.md` precisa dizer isso — filha 1.
- **Ponteiro por CNPJ no ADN.** Não se sabe se o ADN bloqueia consulta fora de sequência, como o `cStat` 656 da NF-e. Testar em produção restrita no começo da filha 1. Em produção, **não** rodar distribuição ad hoc para CNPJ que o bitERP já capture sem OK explícito.
- **Contrato da SEFIN não confirmado.** O Swagger da SEFIN Nacional não foi localizado: os caminhos `SefinNacional/docs` e `SefinNacional/swagger/v1/swagger.json` dão 404 mesmo com certificado. Rota (`POST /SefinNacional/nfse/{chaveAcesso}/eventos`) e campo (`pedidoRegistroEventoXmlGZipB64`) vêm do manual de API dos municípios e de relatos da comunidade. Confirmar em produção restrita antes de especificar a filha 2.
- **E0717 com alguns A1.** Há relato de "assinatura é obrigatória" (E0717) na Confirmação do tomador com e-CNPJ A1 de uma AC específica, enquanto outro CNPJ passou no mesmo dia. É risco da filha 2, sem diagnóstico conhecido.
- **Cadeia TLS dos hosts novos.** O `CA_PADRAO` fechou `adn.producaorestrita.nfse.gov.br`. Falta conferir `adn.nfse.gov.br` e os dois hosts da SEFIN. Cada filha estende o `test/tls-sefaz.test.js` (e com isso o workflow semanal `cadeia-tls.yml`) para os hosts que toca.
- **Limite do lote e cadência** do ADN não estão documentados — a filha 1 registra o que observar em [conhecimento](../../conhecimento/nfse-nacional-adn-distribuicao.md).

## Critério de conclusão

- [ ] Nenhuma filha em `rascunhos/` ou `especificadas/`
- [ ] Ao menos uma filha em `concluidas/`
- [ ] Objetivo verificado: em produção restrita, a distribuição devolve NFS-e e eventos com o contrato da Decisão 2, e uma Confirmação e uma Rejeição do tomador são aceitas pela SEFIN
- [ ] ADR 0015 aceito
- [ ] Release de **minor** com as duas APIs — segue [../../arquitetura/release.md](../../arquitetura/release.md), não é filha comum

## Notas de conclusão

> Preenchido ao encerrar. Registrar os **desvios** em relação a este plano — filha adicionada, cancelada, escopo que migrou — e o motivo de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar quando a última filha sair de `especificadas/`:

- [ ] Tabela de filhas com link e status final
- [ ] Desvios registrados em "Notas de conclusão"
- [ ] Cabeçalho: **Status** = `concluidos` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/planos/especificados/GH-NN-nfse-nacional-distribuicao-e-manifestacao.md .docs/planos/concluidos/`
- [ ] Blockquote do plano na issue apontando para `.docs/planos/concluidos/` (era `especificados/`)
- [ ] Issue do plano fechada no GitHub

## Referências

- [Fluxo de planos](../README.md)
- [Visão geral da arquitetura](../../arquitetura/README.md), [camadas/apis.md](../../arquitetura/camadas/apis.md), [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md), [camadas/services-sefaz.md](../../arquitetura/camadas/services-sefaz.md)
- [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md), [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), [ADR 0014](../../arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)
- [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md) — Swagger do ADN e comportamento observado
- [Manual dos Contribuintes — APIs do ADN](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf) (v1.0, 12/02/2026)
- [Manual dos Contribuintes — Emissor Público / API do Sistema Nacional NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf/@@download/file) (v1.2, out/2025)
- Issue: —

## Histórico de revisões

| Data       | Rev | Descrição        |
| ---------- | --- | ---------------- |
| 2026-10-15 | 0.1 | Criação do plano |
