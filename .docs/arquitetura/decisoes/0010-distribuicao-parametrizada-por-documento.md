# 0010 — Distribuição parametrizada por descritor de documento

**Status**: Aceito
**Data**: 2026-09-29

## Contexto

A consulta de DF-e destinados usa o mesmo leiaute (`distDFeInt`, `retDistDFeInt`, `docZip` gzipado) para NF-e, CT-e e MDF-e, mas com namespaces, nomes de operação SOAP, versão de leiaute e endpoints distintos. Forks do ecossistema `node-mde` resolveram isso duplicando api/controller/helper/schema por tipo, o que produziu divergência silenciosa entre cópias.

## Alternativas consideradas

- **Cópia por documento** — três trilhas paralelas. Manutenção triplicada; correções esquecidas em uma cópia.
- **Parâmetro `modelo` em `DistribuicaoDFe`** — API com nome de NF-e aceitando chave de CT-e; mensagens e tipos públicos ficam ambíguos.
- **Três classes públicas sobre implementação única** — superfície explícita no `.d.ts`, diferenças concentradas em `DOCUMENTOS` em `env/`.

## Decisão

Três classes em `apis/` (`DistribuicaoDFe`, `DistribuicaoCTe`, `DistribuicaoMDFe`) injetam um descritor de `env/documento.js` em `this.config`; schema, helper e controller compartilhados leem esse descritor para montar XML, envelope SOAP (incluindo `mdfeCabecMsg` quando aplicável), endpoint e parse da resposta.

## Consequências

- Correção de bug ou ajuste de leiaute na distribuição entra uma vez no helper/schema.
- Novo documento no futuro exige descritor + classe fina + validators de chave, não nova cópia de `montarResponse`.
- Refatoração da NF-e exige teste de regressão byte a byte do XML gerado.
- `Xml.envelopar(xml)` com um argumento permanece idêntico ao anterior (ADR 0007).
