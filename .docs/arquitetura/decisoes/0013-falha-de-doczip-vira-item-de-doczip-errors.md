# 0013 — Falha de `docZip` vira item de `docZipErrors`, sem derrubar o lote

**Status**: Aceito
**Data**: 2026-10-01

> Complementa a [ADR 0004](0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), cujo princípio não muda, e encerra a "exceção conhecida" registrada nela: `Gzip.unzip` de um `docZip` corrompido. A 0004 não é editada; este registro é o que a resolve. O número 0010 segue reservado pela [GH-3](../../tasks/specified/GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md).

## Contexto

O retorno da distribuição DF-e traz um lote de até 50 documentos, cada um num `docZip` (base64 de gzip). `DistribuicaoHelper.montarResponse` descompactava todos num único `Promise.all`, o que tornava o lote tudo-ou-nada: um documento ruim e o chamador perdia os outros e, pior, `ultNSU` e `maxNSU`. Sem `ultNSU`, a varredura incremental não avança, o chamador repete a mesma consulta, e consulta repetida é justamente o que a SEFAZ penaliza por CNPJ.

O comportamento real era ainda mais grave que o tudo-ou-nada. O callback do `zlib.unzip` em `Gzip.unzip` rejeitava sem `return` e seguia para `buffer.toString()` com `buffer` indefinido; o `TypeError` escapava como `uncaughtException` e encerrava o processo do consumidor antes de qualquer `.catch`.

A ADR 0004 já previa o conserto — "converter em `error`, não relaxar a regra" —, mas não dizia **onde** pôr esse erro.

## Alternativas consideradas

**Tudo-ou-nada com `error` de topo.** Converter a rejeição em `error` e devolver `data: {}`, como em qualquer falha de transporte. Cumpre a 0004 ao pé da letra, mas joga fora `ultNSU`/`maxNSU`: o processo deixa de cair e a varredura continua presa.

**Falha dentro de `docZip`.** Item com `error` no lugar de `xml`/`json`, no mesmo array. Preserva a ordem num lugar só, mas quebra o contrato atual: todo consumidor que hoje lê `doc.json` sem checar passaria a encontrar item sem `json`.

**Array separado.** Válidos em `docZip` com o formato de sempre; falhas em `docZipErrors: [{ nsu, schema, error }]`; metadados do lote preservados.

## Decisão

**Array separado.** Cada `docZip` é aberto isoladamente por `DistribuicaoHelper.abrirDocZip`, que nunca rejeita. Os resultados são separados, na ordem do lote, em `data.docZip` e `data.docZipErrors` (sempre presente, `[]` quando nada falha).

- `error` de cada item é **string**, como o `error` de topo — mesma convenção da 0004.
- Falha de `docZip` **não** preenche o `error` de topo, nem quando todo o lote falha. O `error` de topo significa "não há `data` utilizável", e aqui há: `cStat`, `ultNSU` e `maxNSU`.
- O base64 original não entra no item: está no `resXml`, que chega sempre preenchido.
- O nome segue as duas fontes de nome do retorno: o elemento da SEFAZ (`docZip`) e o campo `error`, que o consumidor já testa.

## Consequências

**Fica mais fácil:**

- Avançar a varredura mesmo com documento ilegível no meio do lote;
- Diagnosticar: o item traz o NSU e a etapa que falhou, e o `resXml` traz o conteúdo cru;
- Atualizar: o campo é aditivo, e quem o ignora recebe os documentos válidos em vez de um processo morto.

**Fica mais difícil:**

- Quem precisa de "lote completo ou nada" agora testa `docZipErrors.length` — a biblioteca não lança mais nesse caso;
- Um documento que falhou não volta sozinho: para reprocessá-lo, o chamador consulta aquele NSU com `consultaNSU`.

**Compromisso de longo prazo:**

- Nenhuma operação por documento roda dentro de um `Promise.all` que possa rejeitar; a falha é capturada no item;
- `docZip` mantém a forma `{ xml, json, nsu, schema }` — falha nunca entra nele;
- Os prefixos das mensagens de `docZipErrors[].error` são contrato e são comparados nos testes.
