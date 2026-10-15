# Fontes — NFS-e Nacional

Originais da documentação técnica do Sistema Nacional NFS-e, publicados em <https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual>. Convenção da pasta em [../../README.md](../../README.md#fontes-originais-fontes).

| Arquivo                                                                                                      | Conteúdo                                                                                       | Origem                                                                                                                                                                                      | Baixado em | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| [manual-contribuintes-apis-adn-v1.0-20260212.pdf](manual-contribuintes-apis-adn-v1.0-20260212.pdf)           | Manual dos Contribuintes — APIs do ADN (distribuição por NSU e eventos por chave), v1.0        | [gov.br](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-apis-adn-sistema-nacional-nfse.pdf)                                          | 2026-10-15 | `9ffc97d8b1be4c80a440b3569b0027df61265b9e75ef69437f21f9481a9a1d6d` |
| [manual-contribuintes-emissor-publico-v1.2-202510.pdf](manual-contribuintes-emissor-publico-v1.2-202510.pdf) | Manual dos Contribuintes — APIs do Emissor Público Nacional (SEFIN: NFS-e, DPS, eventos), v1.2 | [gov.br](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf/@@download/file) | 2026-10-15 | `ac2f36e34ff565cc36d67c5d67415c33cc09f27b2dea006e8da9bcd2ddce5581` |
| [anexo-ii-sefin-adn-pedregevt-evt-v1.01-20260122.xlsx](anexo-ii-sefin-adn-pedregevt-evt-v1.01-20260122.xlsx) | Anexo II — leiaute e regras de negócio do pedido de registro de evento e do evento, v1.01      | [gov.br](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_ii-sefin_adn-pedregevt_evt-snnfse-v1-01-20260122.xlsx)                                      | 2026-10-15 | `5abe83d7e51023ffa979cc466c628399f3e4bbf03c293b5b1a0817e873eb428e` |
| [nfse-esquemas-xsd-v1.01-20260209.zip](nfse-esquemas-xsd-v1.01-20260209.zip)                                 | XSDs 1.00 e 1.01 (DPS, NFS-e, `pedRegEvento`, `evento`, CNC, tipos)                            | [gov.br](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/nfse-esquemas_xsd-v1-01-20260209.zip)                                                             | 2026-10-15 | `e7935cbd9470527c6cc32984c1b2263e614183bf0139ce2733eaaed2de9a8072` |

O hash do manual do ADN, do Anexo II e do zip de XSDs foi conferido contra cópias baixadas de forma independente da URL de origem no mesmo dia. O do manual do Emissor Público não foi conferido.

## Swaggers (OpenAPI)

Os Swaggers **só abrem com certificado ICP-Brasil de cliente** (mTLS) — sem ele a conexão cai. Não têm versão de publicação além de `v1`, então o nome leva a data de download. Baixados com o e-CNPJ A1 da Bitize e o `CA_PADRAO`, em produção restrita.

| Arquivo                                                                                  | API                                                                                       | Origem (produção restrita)                                                       | SHA-256                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [swagger-adn-contribuintes-v1-20261015.json](swagger-adn-contribuintes-v1-20261015.json) | ADN Contribuinte — distribuição por NSU e eventos por chave                               | `https://adn.producaorestrita.nfse.gov.br/contribuintes/swagger/v1/swagger.json` | `fb17a4256e4b96b74544bd0ef88e05660771276bb949ec07d6cc547bcc7c128c` |
| [swagger-adn-municipios-v1-20261015.json](swagger-adn-municipios-v1-20261015.json)       | ADN Município — mesma distribuição, para municípios; único que documenta o lote de até 50 | `https://adn.producaorestrita.nfse.gov.br/municipios/swagger/v1/swagger.json`    | `fa6e32d2fdf82c5a48ea49bc9b4220b1f95afae3150a8a68ef45c2e0727f7741` |
| [swagger-adn-recepcao-v1-20261015.json](swagger-adn-recepcao-v1-20261015.json)           | ADN Recepção — `POST /adn/DFe`, compartilhamento de documentos pelos municípios           | `https://adn.producaorestrita.nfse.gov.br/adn/swagger/v1/swagger.json`           | `ecd5ccf78fc39e4a65280613c5c7c605565e1fad103e4840e79d45f7bbdbccee` |
| [swagger-sefin-nacional-v1-20261015.json](swagger-sefin-nacional-v1-20261015.json)       | SEFIN Nacional — DPS/NFS-e, consulta por chave e **recepção de eventos**                  | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/swagger/docs/v1`       | `803cf1f0c8921b0b33212f4178565ecfa9bd3e6ce434d3bb891c9fc22f506e46` |

Produção, no mesmo dia:

- `https://adn.nfse.gov.br/contribuintes/swagger/v1/swagger.json` é **idêntico** byte a byte ao de produção restrita.
- `https://sefin.nfse.gov.br/SefinNacional/swagger/docs/v1` difere só em `host`, `basePath` (`/SefinNacional/`, com barra final), na URL do logo e nos timestamps de exemplo.

Páginas navegáveis (Redoc), também com mTLS: `<host>/contribuintes/docs/index.html`, `<host>/municipios/docs/index.html`, `<host>/docs/index.html` (ADN Recepção), `<host>/cnc/docs/index.html` (CNC Recepção), `<host>/parametrizacao/docs/index.html` (Parâmetros Municipais) e `https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index`. O Swagger da SEFIN marca `/DANFSe` como movido para o ADN; `<host>/danfse/docs/index.html` deu 404.

Os `.json` desta pasta ficam fora do Prettier (`.prettierignore`) e da normalização de fim de linha (`../.gitattributes`): os do ADN vêm em CRLF, e o hash acima é do arquivo como servido.

## Resumos que usam estes arquivos

- [../../nfse-nacional-adn-distribuicao.md](../../nfse-nacional-adn-distribuicao.md) — distribuição pelo ADN
- [../../nfse-nacional-sefin-eventos.md](../../nfse-nacional-sefin-eventos.md) — pedido de registro de evento na SEFIN Nacional
