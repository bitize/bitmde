# Fluxo — distribuição de DF-e (NF-e, CT-e e MDF-e)

Consulta de documentos fiscais destinados a um CNPJ/CPF. Três classes públicas — `DistribuicaoDFe` (NF-e), `DistribuicaoCTe` e `DistribuicaoMDFe` —, um único caminho de código, parametrizado pelo descritor de `DOCUMENTOS` que cada classe injeta em `opts.documento` ([ADR 0010](../decisoes/0010-distribuicao-parametrizada-por-documento.md), descritor em [../camadas/env.md](../camadas/env.md#documentos)).

## O caminho completo

```text
DistribuicaoDFe.consultaUltNSU(ultNSU)      ← apis/distribuicaoDFe-api.js
  │  NsuValidator: exige valor, ≤ 15 chars, zero-pad para 15
  ▼
DistribuicaoController.enviar({ ...config, ultNSU, documento: DOCUMENTOS.NFE })
  │
  ├─ DistribuicaoHelper.montarRequest(opts)
  │    DistribuicaoSchema.montarSchema → objeto JS
  │    Xml.jsonToXml                   → <nfeDistDFeInteresse>… (MDF-e: <mdfeDadosMsg>…)
  │    Xml.envelopar                   → <soap12:Envelope>…
  │
  ├─ DistribuicaoHelper.enviarConsulta(data, opts)
  │    endpoint = documento.endpoints[tpAmb]
  │    new SefazService({ baseURL, ca: CA_PADRAO, cert, key, tpAmb, requestOptions, httpsOptions })
  │    POST  → { status, data, transportError? }
  │
  ├─ DistribuicaoHelper.montarResponse(retornoSefaz.data, opts.documento)   ← async: tem gunzip
  │    Xml.xmlToJson → Body › [response ›] result › retDistDFeInt → normaliza docZip para array
  │    para cada docZip: Gzip.unzip(base64) → Xml.xmlToJson
  │
  └─ RetornoHelper.montarRetorno → { data, reqXml, resXml, status, error?, transportError? }
```

## As consultas

| Método           | Classes   | Validator        | Bloco no XML         | Uso                                                             |
| ---------------- | --------- | ---------------- | -------------------- | --------------------------------------------------------------- |
| `consultaUltNSU` | as três   | `NsuValidator`   | `<distNSU><ultNSU>`  | Varredura incremental: devolve o lote seguinte ao NSU informado |
| `consultaNSU`    | as três   | `NsuValidator`   | `<consNSU><NSU>`     | Um documento específico, pelo NSU                               |
| `consultaChNFe`  | só a NF-e | `ChaveValidator` | `<consChNFe><chNFe>` | Um documento específico, pela chave de 44 dígitos               |

O CT-e e o MDF-e não têm consulta por chave: o `distDFeInt` dos dois só aceita `distNSU` e `consNSU`, e a SEFAZ rejeita o bloco de chave com `215`. Por isso o descritor deles tem `consChave: null`.

A precedência é resolvida no schema (`ultNSU` → chave do descritor, quando há → `nsu`), mas na prática cada método monta `opts` com **um** desses campos apenas. Ver [../camadas/schemas-xml.md](../camadas/schemas-xml.md).

### O que muda por documento

|                          | NF-e                  | CT-e                  | MDF-e                               |
| ------------------------ | --------------------- | --------------------- | ----------------------------------- |
| Serviço                  | Ambiente Nacional     | Ambiente Nacional     | SVRS                                |
| Cadeia TLS               | GlobalSign            | GlobalSign            | ICP-Brasil                          |
| `versao` do `distDFeInt` | `1.01`                | `1.00`                | `1.00`                              |
| `cUFAutor`               | sim                   | sim                   | **não existe**                      |
| Invólucro no Body        | `nfeDistDFeInteresse` | `cteDistDFeInteresse` | **nenhum** (`mdfeDadosMsg` direto)  |
| Resposta                 | `…Response › …Result` | `…Response › …Result` | `mdfeDistDFeInteresseResult` direto |

O WSDL do MDF-e declara um `mdfeCabecMsg` no SOAP Header, mas a SVRS aceita o pedido sem ele e o devolve preenchido na resposta, que a biblioteca ignora. Cada serviço guarda o próprio `ultNSU` por CNPJ/CPF: as três varreduras são independentes.

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

O campo `schema` é o que distingue os tipos de documento que a SEFAZ devolve no mesmo lote (procNFe, resNFe, resEvento, procEventoNFe; no CT-e e no MDF-e, procCTe, procEventoCTe, procMDFe…). A biblioteca **não** interpreta esse campo nem valida o conteúdo — entrega os quatro campos e sai do caminho.

Cada item de `docZipErrors` traz `nsu`, `schema` e `error` (string). Os dois arrays preservam a ordem do lote. Os textos de `error` estão em [../camadas/controllers-helpers.md](../camadas/controllers-helpers.md).

Quando a SEFAZ não responde — cadeia TLS que não fecha, DNS, conexão recusada, timeout —, o retorno vem com `status: 0`, `resXml: ''`, `data: {}` e `transportError: { code, message }`. Sem `data`, não há `ultNSU`: a varredura não avança, e a próxima tentativa repete o mesmo NSU, respeitando a cadência. Ver [ADR 0014](../decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md).

## Varredura incremental

O padrão de uso previsto pelo serviço, e o motivo de `ultNSU` e `maxNSU` virem no retorno:

1. Guardar o último NSU processado;
2. Chamar `consultaUltNSU(ultimoNSU)`;
3. Processar `docZip` — e registrar `docZipErrors`, que já não impedem o avanço;
4. Se `ultNSU < maxNSU`, ainda há documentos — repetir a partir do `ultNSU` devolvido.

A biblioteca não faz esse laço, e isso é intencional: a SEFAZ impõe **restrição de cadência** por consumidor (consulta repetida em intervalo curto é rejeitada com `cStat` de bloqueio, e a penalidade é por CNPJ). Quem chama precisa controlar o intervalo com conhecimento do próprio agendamento — ver [../camadas/services-sefaz.md](../camadas/services-sefaz.md).

O mesmo vale para o CT-e e o MDF-e, que a biblioteca e a documentação tratam com a mesma disciplina da NF-e: ponteiro por CNPJ/CPF, uma hora de espera depois de `137` e `656` para quem sai da sequência. O bloqueio foi observado na NF-e; nos outros dois é premissa, não medição. É também por isso que o `sefaz.test.js` só consulta CT-e e MDF-e em homologação.

## Gunzip

[src/util/gzip.js](../../../src/util/gzip.js) envolve `zlib.unzip` em Promise: `Buffer.from(str, 'base64')` → `unzip` → `toString('utf8')`.

Os `docZip` são descompactados em paralelo (`Promise.all` sobre o `map`), e é o único motivo de `montarResponse` da distribuição ser assíncrono, enquanto o da recepção é síncrono.

Cada item passa por `DistribuicaoHelper.abrirDocZip`, que captura a falha do próprio item, então o `Promise.all` nunca rejeita: um `docZip` corrompido vira entrada de `docZipErrors` e o resto do lote — documentos válidos, `ultNSU`, `maxNSU` — chega ao chamador. Sem isso a varredura ficaria presa no mesmo NSU, repetindo a consulta que a SEFAZ penaliza. Ver [ADR 0013](../decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md).

Até a 0.17.1, o callback do `zlib.unzip` em `Gzip.unzip` chamava `reject(err)` sem `return` e seguia para `buffer.toString()` com `buffer` indefinido. O `TypeError` saía fora de qualquer Promise, como `uncaughtException`: um `docZip` corrompido **encerrava o processo** do consumidor, antes de qualquer `.catch`. O `return` antes do `reject` é load-bearing, e `test/gzip.test.js` cobre o caso.
