# 0010 — Distribuição parametrizada por descritor de documento

**Status**: Aceito
**Data**: 2026-10-16

## Contexto

A consulta de DF-e de interesse usa o mesmo leiaute de fundo para NF-e, CT-e e MDF-e — `distDFeInt` na ida, `retDistDFeInt` com `docZip` gzipado na volta —, mas os três serviços divergem em mais pontos do que o nome do namespace. Conferido contra o WSDL e a homologação de cada um em 2026-10-16:

|                            | NF-e                  | CT-e                  | MDF-e                                       |
| -------------------------- | --------------------- | --------------------- | ------------------------------------------- |
| Serviço                    | Ambiente Nacional     | Ambiente Nacional     | SVRS                                        |
| `versao`                   | `1.01`                | `1.00`                | `1.00`                                      |
| `cUFAutor` no `distDFeInt` | sim                   | sim                   | não (rejeição 215)                          |
| Consulta por chave         | `consChNFe`           | não existe (215)      | não existe (215)                            |
| Corpo SOAP                 | invólucro da operação | invólucro da operação | "bare": `mdfeDadosMsg` direto no Body       |
| Resposta                   | `…Response › …Result` | `…Response › …Result` | `mdfeDistDFeInteresseResult` direto no Body |

Os forks do ecossistema `node-mde` resolveram o CT-e e o MDF-e duplicando api/controller/helper/schema por tipo, e as cópias divergiram em silêncio: o da vexta saiu com `<consChCTe><chNFe>` e sem repassar `tpAmb` ao serviço.

## Alternativas consideradas

- **Cópia por documento** — três trilhas paralelas. Manutenção triplicada; correção que entra numa cópia e esquece as outras.
- **Parâmetro `modelo` em `DistribuicaoDFe`** — classe com nome de NF-e aceitando CT-e. Pior ainda com as diferenças acima: `consultaChNFe` e `cUFAutor` passariam a valer só para um dos modelos, sem o tipo público dizer qual.
- **Três classes públicas sobre uma implementação única** — superfície explícita no `.d.ts`, diferenças concentradas em dados.

## Decisão

Três classes em `apis/` — `DistribuicaoDFe`, `DistribuicaoCTe` e `DistribuicaoMDFe` — expõem só o que o serviço de cada uma aceita: as três têm `consultaUltNSU` e `consultaNSU`, só a NF-e tem consulta por chave, e só a `DistribuicaoMDFe` não recebe `cUFAutor`.

Cada classe injeta em `opts` um descritor de `DOCUMENTOS` ([src/env/documento.js](../../../src/env/documento.js)) ao delegar ao `DistribuicaoController`. Schema, helper e controller são um só, e leem do descritor tudo o que varia: endpoints, namespaces, `versao`, nome da operação (`null` no estilo "bare"), nomes da resposta, presença de `cUFAutor` e bloco de chave. O descritor vai em `opts`, **não** em `this.config`, que continua sendo só o que o consumidor informou.

`Xml.envelopar` não muda. O WSDL do MDF-e declara um `mdfeCabecMsg` no SOAP Header, mas a SVRS aceita o pedido sem ele; a biblioteca não o envia, e não há cabeçalho a parametrizar.

## Consequências

- Correção de bug ou ajuste na distribuição entra uma vez no helper/schema e vale para os três documentos — inclusive o tratamento de `docZipErrors` do [ADR 0013](0013-falha-de-doczip-vira-item-de-doczip-errors.md).
- Documento novo exige descritor, classe fina e, se houver, validator de chave — não uma cópia de `montarResponse`.
- Mexer na parametrização exige o teste que congela o XML da NF-e byte a byte, e os envelopes de CT-e e MDF-e conferidos inteiros.
- Diferença de leiaute que o descritor não cobre vira campo novo no descritor, com teste contra a homologação do serviço — não um `if` por tipo no helper.
- A SVRS serve cadeia ICP-Brasil: a distribuição do MDF-e é o que torna load-bearing a parte ICP-Brasil de `CA_PADRAO` ([ADR 0014](0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)).
