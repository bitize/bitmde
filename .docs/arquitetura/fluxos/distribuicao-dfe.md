# Fluxo — Distribuição de DF-e (NF-e, CT-e, MDF-e)

Consulta de documentos fiscais destinados a um CNPJ/CPF. Três formas de perguntar (`ultNSU`, NSU, chave), um único caminho de código parametrizado por `opts.documento` (`DOCUMENTOS.NFE`, `.CTE`, `.MDFE`). As classes públicas são `DistribuicaoDFe`, `DistribuicaoCTe` e `DistribuicaoMDFe`.

## O caminho completo

```text
DistribuicaoDFe.consultaUltNSU(ultNSU)      ← apis/distribuicaoDFe-api.js
  │  NsuValidator: exige valor, ≤ 15 chars, zero-pad para 15
  ▼
DistribuicaoController.enviar({ ...config, ultNSU, documento: DOCUMENTOS.* })
  │
  ├─ DistribuicaoHelper.montarRequest(opts)
  │    DistribuicaoSchema.montarSchema → objeto JS
  │    Xml.jsonToXml                   → <nfeDistDFeInteresse>…
  │    Xml.envelopar                   → <soap12:Envelope>…
  │
  ├─ DistribuicaoHelper.enviarConsulta(data, opts)
  │    endpoint = documento.endpoints[tpAmb]
  │    new SefazService({ baseURL, ca: CA, cert, key, tpAmb, requestOptions, httpsOptions })
  │    POST  → { status, data }
  │
  ├─ DistribuicaoHelper.montarResponse(retornoSefaz.data, opts.documento)   ← async: tem gunzip
  │    Xml.xmlToJson → desestruturação defensiva → normaliza docZip para array
  │    para cada docZip: Gzip.unzip(base64) → Xml.xmlToJson
  │
  └─ RetornoHelper.montarRetorno → { data, reqXml, resXml, status, error? }
```

## As três consultas

Cada classe pública expõe os mesmos três modos (`consultaUltNSU`, `consultaNSU`, consulta por chave); NSU é compartilhado via `NsuValidator`, a chave usa validator e bloco XML conforme o documento.

| Classe / método                   | Validator            | Bloco no XML           | Uso                                                             |
| --------------------------------- | -------------------- | ---------------------- | --------------------------------------------------------------- |
| `consultaUltNSU`                  | `NsuValidator`       | `<distNSU><ultNSU>`    | Varredura incremental: devolve o lote seguinte ao NSU informado |
| `consultaNSU`                     | `NsuValidator`       | `<consNSU><NSU>`       | Um documento específico, pelo NSU                               |
| `DistribuicaoDFe.consultaChNFe`   | `ChaveValidator`     | `<consChNFe><chNFe>`   | Chave NF-e (44 dígitos)                                         |
| `DistribuicaoCTe.consultaChCTe`   | `ChaveCteValidator`  | `<consChCTe><chCTe>`   | Chave CT-e (44 dígitos)                                         |
| `DistribuicaoMDFe.consultaChMDFe` | `ChaveMdfeValidator` | `<consChMDFe><chMDFe>` | Chave MDF-e (44 dígitos)                                        |

A precedência é resolvida no schema (`ultNSU` → campo de chave do descritor → `nsu`), mas na prática cada método monta `opts` com **um** desses campos apenas. Ver [../camadas/schemas-xml.md](../camadas/schemas-xml.md).

### Zero-pad do NSU

`NsuValidator` faz `padStart(15, '0')`. `'1'` vira `'000000000000001'`. É requisito de leiaute — a SEFAZ espera 15 posições — e é a razão de o NSU circular como string do começo ao fim: convertido para número, o zero à esquerda se perderia.

O limite superior é validado **antes** do pad (`length > 15` reprova), então um NSU de 16 dígitos falha com `'NSU com tamanho incorreto.'` em vez de ser truncado.

## O retorno

`data` traz os campos de `retDistDFeInt`, todos string, mais o array `docZip`:

| Campo                         | Significado                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `cStat` / `xMotivo`           | Status do processamento (`138` = documentos localizados, `137` = nenhum documento) |
| `ultNSU`                      | Último NSU devolvido neste lote — é o que alimenta a próxima chamada               |
| `maxNSU`                      | Maior NSU existente para o destinatário — comparar com `ultNSU` diz se acabou      |
| `dhResp`, `verAplic`, `tpAmb` | Metadados da resposta                                                              |
| `docZip[]`                    | Os documentos                                                                      |

Cada item de `docZip`:

| Campo    | Origem                                                            |
| -------- | ----------------------------------------------------------------- |
| `xml`    | Conteúdo descompactado (o `value` do nó, base64 → gunzip → utf-8) |
| `json`   | O mesmo conteúdo já parseado por `Xml.xmlToJson`                  |
| `nsu`    | Atributo `@_NSU`                                                  |
| `schema` | Atributo `@_schema` — diz o que o documento é                     |

O campo `schema` é o que distingue os tipos de documento que a SEFAZ devolve no mesmo lote (procNFe, resNFe, resEvento, procEventoNFe). A biblioteca **não** interpreta esse campo nem valida o conteúdo — entrega os quatro campos e sai do caminho.

## Varredura incremental

O padrão de uso previsto pelo serviço, e o motivo de `ultNSU` e `maxNSU` virem no retorno:

1. Guardar o último NSU processado;
2. Chamar `consultaUltNSU(ultimoNSU)`;
3. Processar `docZip`;
4. Se `ultNSU < maxNSU`, ainda há documentos — repetir a partir do `ultNSU` devolvido.

A biblioteca não faz esse laço, e isso é intencional: a SEFAZ impõe **restrição de cadência** por consumidor (consulta repetida em intervalo curto é rejeitada com `cStat` de bloqueio, e a penalidade é por CNPJ). Quem chama precisa controlar o intervalo com conhecimento do próprio agendamento — ver [../camadas/services-sefaz.md](../camadas/services-sefaz.md).

## Gunzip

[src/util/gzip.js](../../../src/util/gzip.js) envolve `zlib.unzip` em Promise: `Buffer.from(str, 'base64')` → `unzip` → `toString('utf8')`.

Os `docZip` são descompactados em paralelo (`Promise.all` sobre o `map`), e é o único motivo de `montarResponse` da distribuição ser assíncrono, enquanto o da recepção é síncrono.

Um `docZip` corrompido rejeita a Promise, e essa rejeição **propaga** — é o único caminho em que a distribuição lança em vez de devolver `error`. Na prática só acontece com resposta truncada.
