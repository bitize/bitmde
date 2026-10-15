# Fluxo — Distribuição de NFS-e Nacional (ADN)

Consulta das NFS-e e dos eventos em que um CNPJ figura, no Ambiente de Dados Nacional. É o equivalente, para serviço, do [fluxo da NF-e](distribuicao-dfe.md), mas em REST/JSON: um `GET` sem corpo, sem schema nem envelope. Contrato e comportamento observado do serviço em [conhecimento/nfse-nacional-adn-distribuicao.md](../../conhecimento/nfse-nacional-adn-distribuicao.md).

## O caminho completo

```text
DistribuicaoNFSe.consultaUltNSU(ultNSU)          ← apis/distribuicaoNFSe-api.js
  │  NsuNfseValidator: exige valor, só dígitos, ≤ 15, sem zeros à esquerda
  ▼
DistribuicaoNFSeController.enviar({ ...config, ultNSU })
  │
  ├─ DistribuicaoNFSeHelper.montarRequest(opts)
  │    { method: 'GET', url: '/DFe/{ultNSU}', params: { lote, cnpjConsulta },
  │      headers: { Accept: 'application/json' }, responseType: 'text' }
  │
  ├─ DistribuicaoNFSeHelper.enviarConsulta(config, opts)
  │    endpoint = NFSE_ADN[tpAmb]
  │    new SefazService({ baseURL, ca: CA_PADRAO, cert, key, tpAmb, requestOptions, httpsOptions })
  │    GET  → { status, data, transportError? }
  │
  ├─ DistribuicaoNFSeHelper.montarResponse(corpo, cnpj)   ← async: tem gunzip; nunca lança
  │    JSON.parse protegido → null se não for resposta do ADN
  │    para cada item do LoteDFe: abrirArquivoXml → Gzip.unzip → Xml.xmlToJson → papel
  │
  └─ RetornoNfseHelper.montarRetorno → { data, resBody, status, error?, transportError? }
```

## As três consultas

| Método           | Validator                       | Requisição                                     | Devolve                                       |
| ---------------- | ------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `consultaUltNSU` | `NsuNfseValidator`              | `GET /DFe/{ultNSU}?lote=true&cnpjConsulta=…`   | Até 50 documentos **depois** do NSU informado |
| `consultaNSU`    | `NsuNfseValidator` (`positivo`) | `GET /DFe/{nsu - 1}?lote=false&cnpjConsulta=…` | O documento daquele NSU                       |
| `consultaChNFSe` | `ChaveNfseValidator`            | `GET /NFSe/{chNFSe}/Eventos`                   | A NFS-e da chave e os eventos dela            |

`cnpjConsulta` sai sempre, com o `config.cnpj`: o ADN aceita o CNPJ do próprio certificado e o de outro estabelecimento da mesma raiz, e rejeita os demais com `E2243`.

### Por que `consultaNSU` pede `nsu - 1`

Com `lote=false`, o ADN devolve o documento **seguinte** ao NSU do caminho, como faz com o lote: `/DFe/0?lote=false` traz o NSU 1, e `/DFe/5?lote=false`, o 6 (conferido em produção, 2026-10-15). Para `consultaNSU('51')` devolver o NSU 51, como o `consNSU` da NF-e, o helper pede `/DFe/50`. Por isso o validator recusa `0` nesse método (`NSU deve ser maior que zero.`), e a conta é feita com `BigInt`.

### NSU sem zero-pad

No ADN o NSU é `int64` no caminho e número no JSON; o zero-pad de 15 posições é convenção do leiaute XML da NF-e. O `NsuNfseValidator` normaliza para inteiro sem zeros à esquerda (`'00051'` → `'51'`, `0` → `'0'`), e o NSU devolvido em `documentos[].nsu` sai como **string**, como todo escalar do pacote.

## O retorno

`data` segue a resposta do ADN, em camelCase:

| Campo                   | Conteúdo                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `statusProcessamento`   | `DOCUMENTOS_LOCALIZADOS`, `NENHUM_DOCUMENTO_LOCALIZADO` ou `REJEICAO`                |
| `tipoAmbiente`          | `PRODUCAO` ou `HOMOLOGACAO` (é como a produção restrita se identifica)               |
| `versaoAplicativo`      | Versão do ADN                                                                        |
| `dataHoraProcessamento` | Data e hora da resposta                                                              |
| `alertas`, `erros`      | Sempre arrays de `{ codigo, descricao, complemento }`                                |
| `documentos[]`          | `{ nsu, chaveAcesso, tipoDocumento, tipoEvento, dataHoraGeracao, papel, xml, json }` |
| `documentosErros[]`     | `{ nsu, chaveAcesso, tipoDocumento, error }` — itens cujo `ArquivoXml` não abriu     |

As regras de `error` estão na [ADR 0016](../decisoes/0016-retorno-proprio-da-nfse.md). A que mais importa para quem drena a fila: **`NENHUM_DOCUMENTO_LOCALIZADO` nunca é erro**, nem com HTTP 404. É assim que o ADN responde ao fim da fila, à chave sem documento (`E2240`) e ao NSU sem documento (`E2230`).

### `papel`

A única leitura de campo de negócio que a biblioteca faz. Para item `NFSE`, compara `config.cnpj` com `NFSe/infNFSe/DPS/infDPS/{toma,prest,interm}/CNPJ`, nessa ordem; o primeiro que bater define `'tomador'`, `'prestador'` ou `'intermediario'`. Nenhum → `''`. Item `EVENTO` → `''`, porque o evento não traz as partes da nota.

A comparação é pelo CNPJ inteiro, não pela raiz: `config.cnpj` é exatamente o CNPJ consultado. A biblioteca marca e não filtra, porque a fila mistura notas recebidas, notas emitidas e eventos de terceiros, e cada consumidor quer um recorte diferente.

### `ArquivoXml` processado item a item

Mesmo desenho do `docZip` ([ADR 0013](../decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md)): `abrirArquivoXml` nunca rejeita, e a falha vira item de `documentosErros`, sem `error` de topo.

| Etapa                  | `error`                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `ArquivoXml` vazio     | `ArquivoXml sem conteúdo.`                                      |
| `Gzip.unzip` rejeitou  | `Falha ao descompactar o ArquivoXml: <mensagem original>`       |
| `Xml.xmlToJson` lançou | `Falha ao interpretar o XML do ArquivoXml: <mensagem original>` |

## Drenagem

1. Guardar o último NSU processado (começa em `'0'`);
2. Chamar `consultaUltNSU(ultimoNSU)`;
3. Com `error`, parar e tratar — a rejeição traz o motivo em `data.erros`;
4. Processar `documentos`, registrar `documentosErros` e guardar o NSU do último item de `documentos` ou `documentosErros`, o que vier depois no lote;
5. Repetir até `documentos` e `documentosErros` virem vazios, com `statusProcessamento` igual a `NENHUM_DOCUMENTO_LOCALIZADO` (HTTP 404).

Não há `maxNSU`: o fim da fila é o 404. Ao contrário da NF-e, o ADN não tem bloqueio de sequência (voltar a um NSU anterior funciona) nem limite de cadência observado. Mesmo assim, guardar o ponteiro e escolher o intervalo continuam sendo responsabilidade de quem consome, e a biblioteca não faz o laço.
