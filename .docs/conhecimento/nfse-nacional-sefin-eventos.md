# NFS-e Nacional — pedido de registro de evento na SEFIN Nacional

**Fonte**: [swagger-sefin-nacional-v1-20261015.json](fontes/nfse-nacional/swagger-sefin-nacional-v1-20261015.json), [Anexo II v1.01 de 22/01/2026](fontes/nfse-nacional/anexo-ii-sefin-adn-pedregevt-evt-v1.01-20260122.xlsx), [XSDs v1.01 de 09/02/2026](fontes/nfse-nacional/nfse-esquemas-xsd-v1.01-20260209.zip) e [Manual dos Contribuintes — Emissor Público v1.2](fontes/nfse-nacional/manual-contribuintes-emissor-publico-v1.2-202510.pdf)
**Consultado em**: 2026-10-15; pedidos à SEFIN em 2026-10-16 (rejeitados e uma Confirmação aceita)

Como o tomador registra Confirmação (`e203202`) e Rejeição (`e203206`) de uma NFS-e. O que os documentos dizem, corrigido pelo que a SEFIN respondeu em 2026-10-16 a pedidos com chave inventada, que ela rejeita sem registrar nada (seção [Observado na SEFIN](#observado-na-sefin-2026-10-16)).

## Onde o tomador manifesta

Na **SEFIN Nacional**, mesmo que a NFS-e tenha sido gerada por sistema próprio de município — **confirmado em produção em 2026-10-16**, com uma Confirmação aceita sobre nota de `ambGer` 1:

- Anexo II, RN 16 (`E1818`): o município **não pode** compartilhar com o ADN eventos de manifestação — "Estes eventos devem ser emitidos pelos não emitentes da NFS-e diretamente no SEFIN NFS-e."
- Anexo II, RN 24 (`E1831`): a NFS-e indicada precisa **existir no ADN**.

O "2 - ADN" na coluna "ambiente receptor" da aba "TIPO EVENTOS DE NFSe" é o 4º dígito do código do evento (`20320`**`2`**) e diz onde o evento fica registrado, não para onde o pedido é enviado. Confirmado na prática: a SEFIN aceita manifestação de NFS-e gerada por município com sistema próprio, e o evento sai com `ambGer` 2 (gerado pela SEFIN).

## Endpoint

| Ambiente          | Base                                                       |
| ----------------- | ---------------------------------------------------------- |
| Produção          | `https://sefin.nfse.gov.br/SefinNacional`                  |
| Produção restrita | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` |

mTLS com certificado ICP-Brasil A1 ou A3, de CNPJ ou CPF, com "Autenticação Cliente". Mensagens em JSON. O Swagger é Swagger 2.0 (`definitions`), não OpenAPI 3 como o do ADN.

| Método                                                        | Corpo                                       | Respostas                                                               |
| ------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `POST /nfse/{chaveAcesso}/eventos`                            | `{ "pedidoRegistroEventoXmlGZipB64": "…" }` | `201` `EventosPostResponseSucesso`; `400` e `401` `ResponseErro`        |
| `GET /nfse/{chaveAcesso}/eventos/{tipoEvento}/{numSeqEvento}` | —                                           | `200` `EventosPostResponseSucesso`; `401`, `404` e `422` `ResponseErro` |

O manual cita também `GET /nfse/{chaveAcesso}/eventos` e `GET /nfse/{chaveAcesso}/eventos/{tipoEvento}`, que **não estão no Swagger**. Para listar eventos de uma nota, o caminho documentado é o do ADN (`GET /contribuintes/NFSe/{ChaveAcesso}/Eventos`).

### Respostas — camelCase, ao contrário do ADN

```text
EventosPostResponseSucesso { tipoAmbiente: 1|2, versaoAplicativo, dataHoraProcessamento, eventoXmlGZipB64 }
ResponseErro               { tipoAmbiente: 1|2, versaoAplicativo, dataHoraProcessamento, erro: { codigo, descricao, complemento } }
```

> **O Swagger erra o `erro`.** A SEFIN responde `erro` como **array** de `{ codigo, descricao }`, sem `complemento` (observado em produção e em produção restrita, `SefinNacional_1.6.0`). O `ManifestacaoNFSeHelper` aceita as duas formas.

Diferenças em relação ao ADN ([nfse-nacional-adn-distribuicao.md](nfse-nacional-adn-distribuicao.md)) que pesam na normalização do retorno:

| Aspecto  | ADN                             | SEFIN                                 |
| -------- | ------------------------------- | ------------------------------------- |
| Chaves   | PascalCase (`Erros`, `Codigo`)  | camelCase (`erro`, `codigo`)          |
| Erro     | array `Erros[]`                 | array `erro[]` (o Swagger diz objeto) |
| Ambiente | `TipoAmbiente: "HOMOLOGACAO"`   | `tipoAmbiente: 2`                     |
| Sucesso  | `200` (e `404` para fila vazia) | `201`                                 |

## Leiaute do `pedRegEvento` (v1.01)

```xml
<?xml version="1.0" encoding="UTF-8"?>  <!-- obrigatória: sem ela, E1229 -->
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infPedReg Id="PRE{chNFSe 50}{código do evento 6}">
    <tpAmb/>      <!-- 1 produção, 2 homologação; diverge do ambiente → E1845 -->
    <verAplic/>   <!-- 1 a 20 caracteres -->
    <dhEvento/>   <!-- AAAA-MM-DDThh:mm:ssTZD, ex.: 2026-10-15T13:00:15-03:00 -->
    <CNPJAutor/>  <!-- ou CPFAutor; CNPJ só numérico (14) no XSD 1.01 -->
    <chNFSe/>     <!-- 50 dígitos -->
    <e203202> | <e203206>
  </infPedReg>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/>  <!-- depois de infPedReg -->
</pedRegEvento>
```

- `Id` errado → `E1827`. Para `e203202`: `PRE` + chave + `203202`.
- `versao` aceita `1.00` e `1.01` (`TVerNFSe`). O 1.01 não tem `nPedRegEvento`: o `Id` é `PRE[0-9]{56}` no XSD.
- O `xmlns` vai só no `pedRegEvento`: o XSD é `elementFormDefault="qualified"`, e o `infPedReg` herda o namespace default.
- Sem a declaração `<?xml version="1.0" encoding="UTF-8"?>`, a SEFIN rejeita com `E1229` ("Xml não está utilizando codificação UTF-8"), mesmo com o corpo em UTF-8.

### Grupos do tomador

| Evento    | Campo     | Regra                                                                                                                                                                                    |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e203202` | `xDesc`   | Literal `Manifestação de NFS-e - Confirmação do Tomador`                                                                                                                                 |
| `e203206` | `xDesc`   | Literal `Manifestação de NFS-e - Rejeição do Tomador`                                                                                                                                    |
| `e203206` | `cMotivo` | `1` duplicidade · `2` já emitida pelo tomador · `3` não ocorrência do fato gerador · `4` erro na responsabilidade tributária · `5` erro no valor, deduções, serviço ou data · `9` outros |
| `e203206` | `xMotivo` | Opcional, 15 a 255 caracteres; **obrigatório quando `cMotivo` = 9** (`E1949`)                                                                                                            |

Conflito com evento já vinculado à nota é rejeitado com `E0861` (Confirmação) ou `E0866` (Rejeição), conforme a aba "RN EVENTOSxEVENTOS" (linhas: evento já vinculado; colunas: evento recebido):

| Já vinculado                 | Confirmação do tomador | Rejeição do tomador |
| ---------------------------- | ---------------------- | ------------------- |
| Nenhum                       | aceita                 | aceita              |
| Confirmação do tomador       | `E0861`                | **aceita**          |
| Rejeição do tomador          | **aceita**             | `E0866`             |
| Confirmação tácita           | `E0861`                | `E0866`             |
| Cancelamento (qualquer tipo) | `E0861`                | `E0866`             |

No sentido inverso, com a Confirmação do tomador vinculada, o Cancelamento da NFS-e e a Solicitação de Análise Fiscal para Cancelamento passam a ser recusados; o Cancelamento por Substituição continua aceito. Com a Rejeição vinculada, o Cancelamento continua aceito.

A Anulação da Rejeição (`e205208`) tem como autor o **município de incidência** (`MIncid`, aba "TIPO EVENTOS DE NFSe"): o tomador não desfaz a própria Rejeição.

## Assinatura

O Anexo II se contradiz à primeira leitura:

- Aba "TIPO EVENTOS DE NFSe", coluna "assinatura digital obrigatória no pedRegEvt": **Não** para as manifestações (e **Sim** para cancelamento).
- Aba "RN EVENTO_PED.REG.EVENTO", regras executadas pela SEFIN na recepção (coluna K = V):
  - RN 102, `E1989`: "É obrigatória a existência da assinatura do Pedido de Registro de Evento quando for enviado para Web Service."
  - RN 99, `E1980`: a assinatura deve ser válida.
  - RN 103, `E1991`: a assinatura deve ser feita com o certificado do emitente do pedido.
  - RN 20, `E0812`: `CNPJAutor` deve ter a mesma **raiz** do CNPJ do certificado da assinatura.
  - RN 101, `E1986`: o certificado precisa da extensão de CNPJ (OID `2.16.76.1.3.3`) ou CPF (`2.16.76.1.3.1`) e de raiz ICP-Brasil.

**Confirmado em 2026-10-16: pela API, o pedido vai assinado.** Sem `Signature`, a SEFIN responde `E0717` ("A assinatura é obrigatória quando for enviado para o Web Service"). O "Não" da primeira aba vale para o emissor web, onde o portal assina pelo usuário. Bate com o relato de comunidade de rejeição por falta de assinatura na Confirmação do tomador.

## Observado na SEFIN (2026-10-16)

Pedidos com chave inventada (cinquenta `1`), que a SEFIN rejeita sem registrar evento, enviados com o e-CNPJ A1 da Bitize pelo `ManifestacaoNFSe`, em produção e em produção restrita (`versaoAplicativo: SefinNacional_1.6.0`):

| Pedido                                               | HTTP | `erro[0].codigo` | Descrição                                                                   |
| ---------------------------------------------------- | ---- | ---------------- | --------------------------------------------------------------------------- |
| Assinado, sem declaração XML                         | 400  | `E1229`          | Xml não está utilizando codificação UTF-8.                                  |
| Com declaração, sem `Signature`                      | 400  | `E0717`          | A assinatura é obrigatória quando for enviado para o Web Service.           |
| Com declaração, assinatura ou `dhEvento` adulterados | 400  | `E0714`          | Arquivo enviado com erro na assinatura.                                     |
| Com declaração, assinado (RSA-SHA1, C14N)            | 400  | `E1831`          | O evento não pode ser recepcionado pois a NFS-e indicada não existe no ADN. |
| Idem, com `CNPJAutor` de outra raiz                  | 400  | `E1831`          | Idem — a existência da nota é conferida antes do `E0812`.                   |

Conclusões:

- A ordem é codificação → assinatura → existência da nota → autor. Chegar ao `E1831` prova que o pedido passou pelo schema e pela assinatura: a configuração do `Assinatura.assinarXml` é aceita em produção.
- O corpo de erro é `{ tipoAmbiente: 1|2, versaoAplicativo, dataHoraProcessamento, erro: [{ codigo, descricao }] }`, com CRLF e indentação.
- `tipoAmbiente` vem numérico, `1` em produção e `2` em produção restrita.

### Confirmação aceita

Uma Confirmação do tomador (`e203202`) em produção, pela `ManifestacaoNFSe`, sobre NFS-e real recebida pela Bitize e gerada por sistema próprio de município (`ambGer` 1), com autorização explícita do responsável:

- **HTTP 201**, corpo `{ tipoAmbiente: 1, versaoAplicativo: "SefinNacional_1.6.0", dataHoraProcessamento, eventoXmlGZipB64 }`.
- O `eventoXmlGZipB64` abre no **evento completo**, no mesmo formato do item `EVENTO` da distribuição: `<?xml …?><evento versao="1.01"><infEvento Id="EVT{chave}{203202}{001}">` com `verAplic` da SEFIN, `ambGer` 2, `nSeqEvento` 1, `dhProc`, `nDFSe` 0 e o `pedRegEvento` enviado, byte a byte, com a assinatura do autor (RSA-SHA1); depois do `infEvento`, a assinatura da SEFIN (RSA-SHA256, exc-c14n with comments).
- `dhProc` sai um segundo depois do `dhEvento` do pedido.

## Ainda não confirmado

- Rejeição do tomador aceita: não exercitada contra o serviço. O código é o da Confirmação, com o grupo `e203206`.
- As regras da aba "RN EVENTOSxEVENTOS" (`E0861`, `E0866`): lidas no Anexo II, não exercitadas.

## Evidência: eventos de tomador reais

Eventos `CONFIRMACAO_TOMADOR` e `REJEICAO_TOMADOR` aceitos pela SEFIN, recebidos pela distribuição do ADN em 2026-10-15, feitos por terceiros sobre notas de um mesmo CNPJ. Contando só os algoritmos de cada assinatura:

| `pedRegEvento` dentro do evento | Assinatura do pedido                                 | Assinatura do evento (SEFIN)   |
| ------------------------------- | ---------------------------------------------------- | ------------------------------ |
| Sem `Signature` (maioria)       | —                                                    | RSA-SHA256, C14N with comments |
| Com `Signature`                 | **RSA-SHA1, digest SHA1, C14N 20010315** (enveloped) | RSA-SHA256                     |
| Com `Signature` (a Rejeição)    | RSA-SHA256, digest SHA256                            | RSA-SHA256                     |

Conclusões:

- A SEFIN **aceita** pedido assinado com a mesma configuração que o `Assinatura.assinarXml` já usa na NF-e (RSA-SHA1, SHA1, C14N) e também com SHA-256.
- Existe pedido aceito **sem assinatura** — coerente com o "Não" da aba "TIPO EVENTOS", provavelmente gerado pelo emissor web. Não muda a leitura de que pela API a `E1989` exige assinatura; quem integra por API deve assinar.
- O item `EVENTO` da distribuição traz o **evento completo** (`evento/infEvento`) com o `pedRegEvento` original dentro. Que o `eventoXmlGZipB64` da resposta do `POST` tenha o mesmo formato ainda é suposição.
