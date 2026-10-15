# NFS-e Nacional — pedido de registro de evento na SEFIN Nacional

**Fonte**: [swagger-sefin-nacional-v1-20261015.json](fontes/nfse-nacional/swagger-sefin-nacional-v1-20261015.json), [Anexo II v1.01 de 22/01/2026](fontes/nfse-nacional/anexo-ii-sefin-adn-pedregevt-evt-v1.01-20260122.xlsx), [XSDs v1.01 de 09/02/2026](fontes/nfse-nacional/nfse-esquemas-xsd-v1.01-20260209.zip) e [Manual dos Contribuintes — Emissor Público v1.2](fontes/nfse-nacional/manual-contribuintes-emissor-publico-v1.2-202510.pdf)
**Consultado em**: 2026-10-15

Como o tomador registra Confirmação (`e203202`) e Rejeição (`e203206`) de uma NFS-e. Nada aqui foi exercitado contra o serviço ainda: é o que os documentos dizem.

## Onde o tomador manifesta

Na **SEFIN Nacional**, mesmo que a NFS-e tenha sido gerada por sistema próprio de município:

- Anexo II, RN 16 (`E1818`): o município **não pode** compartilhar com o ADN eventos de manifestação — "Estes eventos devem ser emitidos pelos não emitentes da NFS-e diretamente no SEFIN NFS-e."
- Anexo II, RN 24 (`E1831`): a NFS-e indicada precisa **existir no ADN**.

O "2 - ADN" na coluna "ambiente receptor" da aba "TIPO EVENTOS DE NFSe" é o 4º dígito do código do evento (`20320`**`2`**) e diz onde o evento fica registrado, não para onde o pedido é enviado. **Ainda não confirmado na prática:** a SEFIN aceitar manifestação de NFS-e gerada por município com sistema próprio.

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

Diferenças em relação ao ADN ([nfse-nacional-adn-distribuicao.md](nfse-nacional-adn-distribuicao.md)) que pesam na normalização do retorno:

| Aspecto  | ADN                             | SEFIN                        |
| -------- | ------------------------------- | ---------------------------- |
| Chaves   | PascalCase (`Erros`, `Codigo`)  | camelCase (`erro`, `codigo`) |
| Erro     | array `Erros[]`                 | objeto único `erro`          |
| Ambiente | `TipoAmbiente: "HOMOLOGACAO"`   | `tipoAmbiente: 2`            |
| Sucesso  | `200` (e `404` para fila vazia) | `201`                        |

## Leiaute do `pedRegEvento` (v1.01)

```xml
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
- `versao` aceita `1.00` e `1.01` (`TVerNFSe`). O 1.01 não tem `nPedRegEvento`.

### Grupos do tomador

| Evento    | Campo     | Regra                                                                                                                                                                                    |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e203202` | `xDesc`   | Literal `Manifestação de NFS-e - Confirmação do Tomador`                                                                                                                                 |
| `e203206` | `xDesc`   | Literal `Manifestação de NFS-e - Rejeição do Tomador`                                                                                                                                    |
| `e203206` | `cMotivo` | `1` duplicidade · `2` já emitida pelo tomador · `3` não ocorrência do fato gerador · `4` erro na responsabilidade tributária · `5` erro no valor, deduções, serviço ou data · `9` outros |
| `e203206` | `xMotivo` | Opcional, 15 a 255 caracteres; **obrigatório quando `cMotivo` = 9** (`E1949`)                                                                                                            |

Conflito com evento já vinculado à nota (por exemplo, Confirmação depois de Rejeição) é rejeitado com `E0861` (Confirmação) ou `E0866` (Rejeição), conforme a aba "RN EVENTOSxEVENTOS".

## Assinatura

O Anexo II se contradiz à primeira leitura:

- Aba "TIPO EVENTOS DE NFSe", coluna "assinatura digital obrigatória no pedRegEvt": **Não** para as manifestações (e **Sim** para cancelamento).
- Aba "RN EVENTO_PED.REG.EVENTO", regras executadas pela SEFIN na recepção (coluna K = V):
  - RN 102, `E1989`: "É obrigatória a existência da assinatura do Pedido de Registro de Evento quando for enviado para Web Service."
  - RN 99, `E1980`: a assinatura deve ser válida.
  - RN 103, `E1991`: a assinatura deve ser feita com o certificado do emitente do pedido.
  - RN 20, `E0812`: `CNPJAutor` deve ter a mesma **raiz** do CNPJ do certificado da assinatura.
  - RN 101, `E1986`: o certificado precisa da extensão de CNPJ (OID `2.16.76.1.3.3`) ou CPF (`2.16.76.1.3.1`) e de raiz ICP-Brasil.

Leitura adotada até prova em contrário: **pela API, o pedido vai assinado**. O "Não" da primeira aba vale para o emissor web, onde o portal assina pelo usuário. Bate com o relato de comunidade de rejeição por falta de assinatura na Confirmação do tomador.

## Ainda não confirmado

- Se a SEFIN aceita manifestação de NFS-e gerada por município com sistema próprio (ver "Onde o tomador manifesta").
- Status e corpo reais de uma rejeição de negócio (`400` com `erro`, ou outro).

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
