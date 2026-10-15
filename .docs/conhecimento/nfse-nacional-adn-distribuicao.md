# NFS-e Nacional — distribuição para contribuintes (ADN)

**Fonte**: Swagger "API NFS-e - ADN Contribuinte" v1 (`/contribuintes/swagger/v1/swagger.json`, produção restrita) e [Manual dos Contribuintes — Guia para utilização das APIs do ADN](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf), versão 1.0 de 12/02/2026
**Consultado em**: 2026-10-15

O Ambiente de Dados Nacional (ADN) da NFS-e distribui ao contribuinte os documentos fiscais de serviço "em que figure como emitente, tomador ou intermediário". É o equivalente, para serviço, do `NFeDistribuicaoDFe` — mas em REST/JSON, não SOAP.

## Endpoints

| Ambiente          | Base                                                     |
| ----------------- | -------------------------------------------------------- |
| Produção          | `https://adn.nfse.gov.br/contribuintes`                  |
| Produção restrita | `https://adn.producaorestrita.nfse.gov.br/contribuintes` |

A documentação navegável (Redoc) fica em `<base>/docs/index.html` e o OpenAPI em `/contribuintes/swagger/v1/swagger.json`. Os dois **exigem o certificado do cliente** — sem ele a conexão cai (`socket hang up`). Caminho no singular (`/contribuinte/`) dá 404; houve Swagger antigo publicado assim.

Protocolo declarado: TLS 1.2+ com autenticação mútua, certificado ICP-Brasil A1 ou A3 de CNPJ com "Autenticação do Cliente". Sem token.

## Métodos

| Método                            | Parâmetros                                                                                     | Devolve                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /DFe/{NSU}`                  | `NSU` (path, int64); `cnpjConsulta` (query, opcional); `lote` (query, bool, **padrão `true`**) | Lote a partir do NSU, ou o documento do NSU com `lote=false` |
| `GET /NFSe/{ChaveAcesso}/Eventos` | `ChaveAcesso` (path, 50 dígitos)                                                               | Eventos vinculados à NFS-e                                   |

`cnpjConsulta` permite consultar um CNPJ diferente do certificado, desde que a **raiz** (8 primeiros dígitos) seja a mesma — matriz consultando filial. Sem ele, vale o CNPJ do certificado.

A resposta é negociada pelo `Accept`: `application/json`, `text/json`, `application/xml`, `text/xml` ou `text/plain`, sempre com o mesmo schema.

## Resposta — `LoteDistribuicaoNSUResponse`

| Campo                   | Tipo                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| `StatusProcessamento`   | `REJEICAO` / `NENHUM_DOCUMENTO_LOCALIZADO` / `DOCUMENTOS_LOCALIZADOS` |
| `LoteDFe`               | array de `DistribuicaoNSU`                                            |
| `Alertas`, `Erros`      | array de `{ Mensagem, Parametros[], Codigo, Descricao, Complemento }` |
| `TipoAmbiente`          | `PRODUCAO` / `HOMOLOGACAO`                                            |
| `VersaoAplicativo`      | string                                                                |
| `DataHoraProcessamento` | date-time                                                             |

Cada item de `LoteDFe`:

| Campo             | Conteúdo                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| `NSU`             | int64                                                                   |
| `ChaveAcesso`     | chave da NFS-e (50 dígitos)                                             |
| `TipoDocumento`   | `NENHUM` / `DPS` / `PEDIDO_REGISTRO_EVENTO` / `NFSE` / `EVENTO` / `CNC` |
| `TipoEvento`      | um dos 18 abaixo, ou `null`                                             |
| `ArquivoXml`      | XML do documento, **GZip + base64**                                     |
| `DataHoraGeracao` | date-time                                                               |

`TipoEvento`: `CANCELAMENTO`, `SOLICITACAO_CANCELAMENTO_ANALISE_FISCAL`, `CANCELAMENTO_POR_SUBSTITUICAO`, `CANCELAMENTO_DEFERIDO_ANALISE_FISCAL`, `CANCELAMENTO_INDEFERIDO_ANALISE_FISCAL`, `CONFIRMACAO_PRESTADOR`, `REJEICAO_PRESTADOR`, `CONFIRMACAO_TOMADOR`, `REJEICAO_TOMADOR`, `CONFIRMACAO_INTERMEDIARIO`, `REJEICAO_INTERMEDIARIO`, `CONFIRMACAO_TACITA`, `ANULACAO_REJEICAO`, `CANCELAMENTO_POR_OFICIO`, `BLOQUEIO_POR_OFICIO`, `DESBLOQUEIO_POR_OFICIO`, `INCLUSAO_NFSE_DAN`, `TRIBUTOS_NFSE_RECOLHIDOS`.

## Comportamento observado

Chamada em produção restrita, 2026-10-15, `GET /DFe/0?lote=true` com o A1 da Bitize:

```json
HTTP 404
{
  "StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO",
  "LoteDFe": [],
  "Alertas": [],
  "Erros": [
    {
      "Mensagem": {},
      "Codigo": "E2220",
      "Descricao": "Nenhum documento localizado - não existem documentos fiscais para o Contribuinte a partir do NSU informado."
    }
  ],
  "TipoAmbiente": "HOMOLOGACAO",
  "VersaoAplicativo": "1.0.0.0",
  "DataHoraProcessamento": "2026-10-15T10:35:14.5687887-03:00"
}
```

- **Fila vazia é HTTP 404**, não 200 — e vem com o corpo completo. Tratar 404 como erro genérico confunde "não há nada novo" com falha.
- Produção restrita se identifica como `TipoAmbiente: HOMOLOGACAO`.
- A cadeia TLS de `adn.producaorestrita.nfse.gov.br` fechou com o `CA_PADRAO` (raízes do Node + ICP-Brasil), sem ajuste.

## Ainda não confirmado

- Quantos documentos cabem num lote. Bibliotecas de terceiros citam 50; o Swagger não diz.
- Se o ADN mantém ponteiro por CNPJ e rejeita consulta fora de sequência, como a SEFAZ faz com o `cStat` 656 na NF-e.
- Limite de cadência (rate limit).
- Cadeia TLS de `adn.nfse.gov.br` (produção).

## Cobertura

Pela LC 214/2025 (art. 62), desde 01/01/2026 todos os municípios devem observar o padrão nacional — pelo Emissor Nacional ou por integração do sistema próprio ao ADN. Nota de município que ainda não compartilha com o ADN **não aparece** na distribuição; a cobertura não é garantida como a da NF-e.
