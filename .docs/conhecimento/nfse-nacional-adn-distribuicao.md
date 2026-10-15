# NFS-e Nacional — distribuição para contribuintes (ADN)

**Fonte**: [Swagger "API NFS-e - ADN Contribuinte" v1](fontes/nfse-nacional/swagger-adn-contribuintes-v1-20261015.json) e [Manual dos Contribuintes — Guia para utilização das APIs do ADN, v1.0 de 12/02/2026](fontes/nfse-nacional/manual-contribuintes-apis-adn-v1.0-20260212.pdf)
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
- A cadeia TLS de `adn.producaorestrita.nfse.gov.br` e de `adn.nfse.gov.br` (produção) fecha com o `CA_PADRAO` (raízes do Node + ICP-Brasil), sem ajuste — conferido com `rejectUnauthorized: true`.
- O Swagger de contribuintes de produção é idêntico byte a byte ao de produção restrita.
- O Swagger de contribuintes de produção é idêntico byte a byte ao de produção restrita.

Os Swaggers estão versionados em [fontes/nfse-nacional/](fontes/nfse-nacional/README.md).

### Em produção

Drenagem completa da fila de um CNPJ em 2026-10-15, com `GET /DFe/{NSU}?lote=true` em sequência, partindo de `1` e depois conferindo a partir de `0`:

- **O NSU informado não entra no lote** — a semântica é a do `ultNSU` da NF-e. `GET /DFe/0` devolve a partir do NSU 1; `GET /DFe/51` devolve a partir do 52. O próximo pedido usa o **último NSU recebido**, sem somar 1. O Swagger da API irmã de municípios diz "a partir do NSU informado (inclusive)" ([swagger-adn-municipios](fontes/nfse-nacional/swagger-adn-municipios-v1-20261015.json)) — não vale para a de contribuintes.
- **Lote de até 50 documentos**, NSUs consecutivos, sem buraco. O último lote veio incompleto (`200`) e o pedido seguinte, a partir do último NSU, deu `404`/`E2220`.
- **O histórico vem desde o primeiro documento do CNPJ no ADN** — no caso, outubro de 2023, NSU 1. A distribuição não começa na primeira consulta: quem chega agora recebe tudo.
- **Voltar para um NSU anterior funciona.** Depois de chegar ao fim da fila, `GET /DFe/0` devolveu o primeiro lote normalmente. Não há bloqueio de sequência como o `cStat` 656 da NF-e.
- **Sem limite de cadência observado** em cerca de 120 chamadas seguidas, sem intervalo.
- **A fila mistura todos os papéis do CNPJ:** NFS-e em que ele é **tomador**, NFS-e que ele **emitiu**, e eventos de terceiros sobre notas dele — Confirmação e Rejeição do tomador sobre as notas emitidas, cancelamento pelo prestador sobre as recebidas. Quem quer só as recebidas filtra pelo `toma` do XML; o ADN não filtra.
- Vêm NFS-e geradas pela SEFIN Nacional (`ambGer` 2) e por sistema próprio de município (`ambGer` 1), nas versões de leiaute `1.00` e `1.01` misturadas.
- `ArquivoXml` é gzip + base64 em todos os itens. NFS-e tem raiz `NFSe`; evento tem raiz `evento`. Em item `NFSE`, `TipoEvento` vem ausente, não `null`.
- `GET /NFSe/{ChaveAcesso}/Eventos` devolve, além dos eventos, **a própria NFS-e** no `LoteDFe`, com o NSU original de cada item.

## Ainda não confirmado

- Se a distribuição tem retenção máxima — o histórico observado não mostrou corte.
- Limite de cadência sob carga maior que a observada.

## Cobertura

Pela LC 214/2025 (art. 62), desde 01/01/2026 todos os municípios devem observar o padrão nacional — pelo Emissor Nacional ou por integração do sistema próprio ao ADN. Nota de município que ainda não compartilha com o ADN **não aparece** na distribuição; a cobertura não é garantida como a da NF-e.
