# 0015 — NFS-e Nacional no próprio bitmde

**Status**: Aceito
**Data**: 2026-10-15

> Decisão 1 do plano [GH-17](../../planos/especificados/GH-17-nfse-nacional-distribuicao-e-manifestacao.md), escrita na filha [GH-18](../../tarefas/concluidas/GH-18-distribuicao-nfse-nacional-adn.md). Não altera a [ADR 0001](0001-fork-e-republicacao-como-bitize-bit-mde.md): a mudança é aditiva.

## Contexto

O bitmde cobre o lado de mercadoria: `DistribuicaoDFe` traz as NF-e emitidas contra o CNPJ e `RecepcaoEvento` manifesta o destinatário. Desde 01/01/2026 todo município deve observar o padrão nacional da NFS-e (LC 214/2025, art. 62). Com isso, o Ambiente de Dados Nacional (ADN) passa a distribuir ao contribuinte as NFS-e em que ele figura, e a SEFIN Nacional recebe a manifestação do tomador.

Os dois serviços falam REST/JSON, e não SOAP, mas pedem o que a biblioteca já resolve: mTLS com o mesmo e-CNPJ A1, em PFX ou PEM; cadeia TLS validada; gunzip de base64; assinatura XMLDSig (no evento); e um erro de transporte que não vaze a chave privada. O primeiro consumidor, o bitERP, já usa o bitmde para NF-e e hoje só recebe NFS-e por importação manual de XML.

## Alternativas consideradas

- **Pacote separado só para NFS-e.** O nome ficaria honesto e a superfície de cada pacote, menor. Em troca, seria preciso duplicar o `CertificadoValidator` (PFX→PEM com node-forge), o `SefazService` (agente mTLS, `CA_PADRAO`, `request` que nunca lança e só deixa sair `code` e `message`), `Gzip`, `Assinatura`, o gerador de certificado de teste e o pipeline de release com Trusted Publishing e provenance. Cada correção de transporte ou de TLS passaria a sair em dois pacotes.
- **Novas classes públicas no bitmde**, ao lado de `DistribuicaoDFe` e `RecepcaoEvento`, reaproveitando as camadas existentes.

## Decisão

**Novas classes no bitmde.** A primeira é `DistribuicaoNFSe`, exportada nas três formas de `src/index.js`; a manifestação do tomador vem na GH-19. Endpoints em `src/env/nfse.js`, indexados por `tpAmb` como os demais (`'1'` produção, `'2'` produção restrita). O transporte é o `SefazService` existente: método, `Accept` e `responseType` vão **na requisição**, e o default SOAP da instância continua valendo para NF-e. O `Content-Type: application/soap+xml` do default vai junto num `GET` sem corpo, e o ADN o ignora (conferido em produção).

## Consequências

**Fica mais fácil:**

- Quem já configura o certificado para NF-e consulta NFS-e com o mesmo objeto de config;
- Correção de TLS, de transporte ou de vazamento de credencial vale para as quatro APIs de uma vez;
- O `tls-sefaz.test.js` e o workflow semanal `cadeia-tls.yml` passam a vigiar também os hosts do ADN.

**Fica mais difícil:**

- O nome: "MDe" passa a cobrir mais que a manifestação de NF-e. `package.json`, README e CLAUDE.md descrevem o escopo novo;
- O `SefazService` deixa de ser só SOAP. Mudança no default da instância precisa considerar os dois protocolos.

**Compromisso de longo prazo:**

- As APIs de NFS-e seguem as invariantes do pacote: erro de configuração lança, erro de rede ou de serviço vira retorno ([ADR 0004](0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)); instância e config congeladas ([ADR 0005](0005-object-freeze-pervasivo.md)); `tpAmb` string; mensagens literais em português;
- Emissão de NFS-e e webservice municipal (ABRASF) seguem fora: a biblioteca consome o que o contribuinte recebe, não emite documento.
