# Fluxo — NFeDistribuicaoDFe

Consulta de documentos fiscais destinados a um CNPJ/CPF. Três formas de perguntar, um único caminho de código.

## O caminho completo

```text
DistribuicaoDFe.consultaUltNSU(ultNSU)      ← apis/distribuicaoDFe-api.js
  │  NsuValidator: exige valor, ≤ 15 chars, zero-pad para 15
  ▼
DistribuicaoController.enviar({ ...config, ultNSU })
  │
  ├─ DistribuicaoHelper.montarRequest(opts)
  │    DistribuicaoSchema.montarSchema → objeto JS
  │    Xml.jsonToXml                   → <nfeDistDFeInteresse>…
  │    Xml.envelopar                   → <soap12:Envelope>…
  │
  ├─ DistribuicaoHelper.enviarConsulta(data, opts)
  │    endpoint = DISTRIBUICAO[tpAmb]
  │    new SefazService({ baseURL, ca: CA, cert, key, tpAmb, requestOptions, httpsOptions })
  │    POST  → { status, data }
  │
  ├─ DistribuicaoHelper.montarResponse(retornoSefaz.data)   ← async: tem gunzip
  │    Xml.xmlToJson → desestruturação defensiva → normaliza docZip para array
  │    para cada docZip: Gzip.unzip(base64) → Xml.xmlToJson
  │
  └─ RetornoHelper.montarRetorno → { data, reqXml, resXml, status, error? }
```

## As três consultas

| Método           | Validator        | Bloco no XML         | Uso                                                             |
| ---------------- | ---------------- | -------------------- | --------------------------------------------------------------- |
| `consultaUltNSU` | `NsuValidator`   | `<distNSU><ultNSU>`  | Varredura incremental: devolve o lote seguinte ao NSU informado |
| `consultaNSU`    | `NsuValidator`   | `<consNSU><NSU>`     | Um documento específico, pelo NSU                               |
| `consultaChNFe`  | `ChaveValidator` | `<consChNFe><chNFe>` | Um documento específico, pela chave de 44 dígitos               |

A precedência é resolvida no schema (`ultNSU` → `chNFe` → `nsu`), mas na prática cada método monta `opts` com **um** desses campos apenas. Ver [../camadas/schemas-xml.md](../camadas/schemas-xml.md).

### Zero-pad do NSU

`NsuValidator` faz `padStart(15, '0')`. `'1'` vira `'000000000000001'`. É requisito de leiaute — a SEFAZ espera 15 posições — e é a razão de o NSU circular como string do começo ao fim: convertido para número, o zero à esquerda se perderia.

O limite superior é validado **antes** do pad (`length > 15` reprova), então um NSU de 16 dígitos falha com `'NSU com tamanho incorreto.'` em vez de ser truncado.

## O retorno

`data` traz os campos de `retDistDFeInt`, todos string, mais os arrays `docZip` e `docZipErrors`:

| Campo                         | Significado                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `cStat` / `xMotivo`           | Status do processamento (`138` = documentos localizados, `137` = nenhum documento) |
| `ultNSU`                      | Último NSU devolvido neste lote — é o que alimenta a próxima chamada               |
| `maxNSU`                      | Maior NSU existente para o destinatário — comparar com `ultNSU` diz se acabou      |
| `dhResp`, `verAplic`, `tpAmb` | Metadados da resposta                                                              |
| `docZip[]`                    | Os documentos                                                                      |
| `docZipErrors[]`              | Os documentos do lote que não puderam ser abertos — `[]` quando todos abriram      |

Cada item de `docZip`:

| Campo    | Origem                                                            |
| -------- | ----------------------------------------------------------------- |
| `xml`    | Conteúdo descompactado (o `value` do nó, base64 → gunzip → utf-8) |
| `json`   | O mesmo conteúdo já parseado por `Xml.xmlToJson`                  |
| `nsu`    | Atributo `@_NSU`                                                  |
| `schema` | Atributo `@_schema` — diz o que o documento é                     |

O campo `schema` é o que distingue os tipos de documento que a SEFAZ devolve no mesmo lote (procNFe, resNFe, resEvento, procEventoNFe). A biblioteca **não** interpreta esse campo nem valida o conteúdo — entrega os quatro campos e sai do caminho.

Cada item de `docZipErrors` traz `nsu`, `schema` e `error` (string). Os dois arrays preservam a ordem do lote. Os textos de `error` estão em [../camadas/controllers-helpers.md](../camadas/controllers-helpers.md).

## Varredura incremental

O padrão de uso previsto pelo serviço, e o motivo de `ultNSU` e `maxNSU` virem no retorno:

1. Guardar o último NSU processado;
2. Chamar `consultaUltNSU(ultimoNSU)`;
3. Processar `docZip` — e registrar `docZipErrors`, que já não impedem o avanço;
4. Se `ultNSU < maxNSU`, ainda há documentos — repetir a partir do `ultNSU` devolvido.

A biblioteca não faz esse laço, e isso é intencional: a SEFAZ impõe **restrição de cadência** por consumidor (consulta repetida em intervalo curto é rejeitada com `cStat` de bloqueio, e a penalidade é por CNPJ). Quem chama precisa controlar o intervalo com conhecimento do próprio agendamento — ver [../camadas/services-sefaz.md](../camadas/services-sefaz.md).

## Gunzip

[src/util/gzip.js](../../../src/util/gzip.js) envolve `zlib.unzip` em Promise: `Buffer.from(str, 'base64')` → `unzip` → `toString('utf8')`.

Os `docZip` são descompactados em paralelo (`Promise.all` sobre o `map`), e é o único motivo de `montarResponse` da distribuição ser assíncrono, enquanto o da recepção é síncrono.

Cada item passa por `DistribuicaoHelper.abrirDocZip`, que captura a falha do próprio item, então o `Promise.all` nunca rejeita: um `docZip` corrompido vira entrada de `docZipErrors` e o resto do lote — documentos válidos, `ultNSU`, `maxNSU` — chega ao chamador. Sem isso a varredura ficaria presa no mesmo NSU, repetindo a consulta que a SEFAZ penaliza. Ver [ADR 0013](../decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md).

Até a 0.17.1, o callback do `zlib.unzip` em `Gzip.unzip` chamava `reject(err)` sem `return` e seguia para `buffer.toString()` com `buffer` indefinido. O `TypeError` saía fora de qualquer Promise, como `uncaughtException`: um `docZip` corrompido **encerrava o processo** do consumidor, antes de qualquer `.catch`. O `return` antes do `reject` é load-bearing, e `test/gzip.test.js` cobre o caso.
