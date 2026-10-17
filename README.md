# Bit MD-e

[![npm version](https://img.shields.io/npm/v/@bitize/bitmde.svg)](https://www.npmjs.com/package/@bitize/bitmde)
[![npm downloads](https://img.shields.io/npm/dt/@bitize/bitmde.svg)](https://npm-stat.com/charts.html?package=@bitize/bitmde)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/bitize/bitmde/blob/main/LICENSE)
[![Mantido pelo BitERP](https://img.shields.io/badge/mantido%20por-BitERP-0b5fff.svg)](https://www.biterp.ai)

Biblioteca para consumo dos Web Services da Sefaz de Distribuição de DF-e e Evento de Manifestação do Destinatário, e da NFS-e Nacional: distribuição pelo Ambiente de Dados Nacional (ADN) e manifestação do tomador na SEFIN Nacional.

Essa biblioteca permite consultar a relação das notas fiscais emitidas contra um determinado CNPJ/CPF e realizar o envio do evento de manifestação, podendo assim, baixar o XML da NF-e. Com o mesmo certificado, consulta as NFS-e em que o CNPJ é tomador, prestador ou intermediário, e registra a Confirmação ou a Rejeição do tomador.

Desenvolvida e mantida pela equipe do **[BitERP](https://www.biterp.ai)**, onde é usada em produção para a automação da manifestação do destinatário e do download de XML de NF-e de entrada.

> Este projeto é um fork de [node-mde](https://github.com/lucashpmelo/node-mde), criado por [Lucas Melo](https://github.com/lucashpmelo), mantido pela [Bitize](https://www.biterp.ai) e publicado no npm como `@bitize/bitmde`. A API pública permanece a mesma — apenas o nome do pacote muda.
>
> **Vindo de `@bitize/bit-mde` ou de `node-mde`?** O pacote é o mesmo; só o nome mudou (`node-mde` até a 0.14.13, `@bitize/bit-mde` até a 0.16.0). Troque o nome na instalação e nos `require`/`import` — nenhuma outra alteração é necessária.

## Instalação

```sh
npm i @bitize/bitmde
```

## Pré-Requisitos

- Possuir um **Certificado A1** válido emitido por uma Autoridade Certificadora credenciada pela Infraestrutura de Chaves Públicas Brasileira – **ICP-Brasil**.
- O certificado pode ser usando no formato **PFX** e **Senha** _OU_ **cert.pem** e **key.pem**
- **Node.js 22 ou posterior.** O Node 20, sem suporte desde abril de 2026, deixou de ser testado na 0.19.0.

## Funcionalidades

- Consultar por último NSU
  - Retorna a relação dos Documentos Fiscais (`Resumo da NF-e`, `NF-e`, `Resumo do Evento` ou `Evento`)
- Consultar por chave de acesso
  - Retorna o `XML da NF-e` ou o `Resumo da NF-e`
- Consultar por NSU
  - Retorna o Documento Fiscal referente ao NSU informado, podendo ser um `Resumo`, uma `NF-e` ou um `Evento`
- Envio de evento
  - Registra o evento de manifestação na nota informada (`Confirmação da Operação`, `Ciência da Operação`, `Desconhecimento da Operação` ou `Operação não Realizada`)
- Distribuição de CT-e e MDF-e
  - Consulta por último NSU e por NSU dos CT-e (Ambiente Nacional) e MDF-e (SVRS) em que o CNPJ/CPF é interessado. Nenhum dos dois serviços tem consulta por chave
- Distribuição de NFS-e Nacional
  - Consulta por último NSU, por NSU e por chave de acesso no ADN, com o papel do CNPJ (`tomador`, `prestador` ou `intermediario`) em cada NFS-e
- Manifestação do tomador da NFS-e Nacional
  - Registra a `Confirmação do Tomador` ou a `Rejeição do Tomador` na SEFIN Nacional

## Distribuição de DF-e

### Construtor

```js
new DistribuicaoDFe(config)
```

- `config` `<Object>`
  - `pfx` `<Buffer>` - [OPCIONAL] - Arquivo **.pfx**. Se o `pfx` não for informado, as propriedades `cert` e `key` passam a ser obrigatórias.
  - `passphrase` `<String>` - [OPCIONAL] - Senha do arquivo **.pfx**.
  - `cert` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _cert.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `key` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _key.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `cUFAutor` `<String>` - [OBRIGATÓRIO] - Código da UF do autor. Consulte a tabela [códigos UF](#códigos-uf).
  - `cnpj` `<String>` - [OPCIONAL] - CNPJ do interessado no DF-e. Se não informado um CNPJ, será obrigatório informar um CPF.
  - `cpf` `<String>` - [OPCIONAL] - CPF do interessado no DF-e. Se não informado um CPF, será obrigatório informar um CNPJ.
  - `tpAmb` `<String>` - [OBRIGATÓRIO] - Identificação de Ambiente. Informar `'1'` para **Produção** ou `'2'` para **Homologação**.
  - `options` `<Object>` - [OPCIONAL]
    - `requestOptions` `<AxiosRequestConfig>` - [OPCIONAL]
    - `httpsOptions` `<AgentOptions>` - [OPCIONAL] - Opções do `https.Agent`, mescladas por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Ver [Conexão com a SEFAZ](#conexão-com-a-sefaz).

### Consulta por ultNSU

| Campo    |   Tipo   | Tamanho | Descrição                      |
| :------- | :------: | :-----: | :----------------------------- |
| `ultNSU` | _string_ |  1-15   | Último NSU recebido pelo ator. |

#### Exemplo

```js
const { DistribuicaoDFe } = require('@bitize/bitmde')
const fs = require('fs')

const distribuicao = new DistribuicaoDFe({
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
  cnpj: '12345678901234',
  cUFAutor: '41',
  tpAmb: '2',
})

const consulta = await distribuicao.consultaUltNSU('000000000000000')

if (consulta.error) {
  throw new Error(consulta.error)
}

console.log(consulta)
// {
//   data: {
//     tpAmb: '2',
//     verAplic: '1.5.11',
//     cStat: '138',
//     xMotivo: 'Documento(s) localizado(s)',
//     dhResp: '2022-06-21T10:48:14-03:00',
//     ultNSU: '000000000000050',
//     maxNSU: '000000000000212',
//     docZip: [
//       {
//         xml: '<resNFe xmlns:xsd="http://www.w3.org/2001/XMLSchema" ... </resNFe>',
//         json: { resNFe: { ... } },
//         nsu: '000000000000049',
//         schema: 'resNFe_v1.01.xsd',
//       },
//       {
//         xml: '<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"> ... </nfeProc>',
//         json: { nfeProc: { ... } },
//         nsu: '000000000000050',
//         schema: 'procNFe_v4.00.xsd',
//       },
//     ],
//     docZipErrors: [],
//   },
//   reqXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap12:Body></soap12:Envelope>',
//   resXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap:Body></soap:Envelope>',
//   status: 200,
// }
```

`docZip` traz só os documentos que puderam ser abertos. Um documento do lote que não descompacta ou não é XML válido não derruba a consulta: ele vai para `docZipErrors`, com o motivo, e `ultNSU`/`maxNSU` continuam preenchidos para a varredura avançar. O formato é o mesmo nas três consultas:

```js
// docZipErrors: [
//   {
//     nsu: '000000000000051',
//     schema: 'procNFe_v4.00.xsd',
//     error: 'Falha ao descompactar o docZip: incorrect header check',
//   },
// ]
```

As mensagens possíveis em `error` são `docZip sem conteúdo.`, `Falha ao descompactar o docZip: <motivo>` e `Falha ao interpretar o XML do docZip: <motivo>`.

### Consulta por chNFe

| Campo   |   Tipo   | Tamanho | Descrição                   |
| :------ | :------: | :-----: | :-------------------------- |
| `chNFe` | _string_ |   44    | Chave de acesso específica. |

#### Exemplo

```js
const { DistribuicaoDFe } = require('@bitize/bitmde')
const fs = require('fs')

const distribuicao = new DistribuicaoDFe({
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
  cnpj: '12345678901234',
  cUFAutor: '41',
  tpAmb: '2',
})

const consulta = await distribuicao.consultaChNFe(
  '41000000000000000000000000000000000000000039'
)

if (consulta.error) {
  throw new Error(consulta.error)
}

console.log(consulta)
// {
//   data: {
//     tpAmb: '2',
//     verAplic: '1.5.11',
//     cStat: '138',
//     xMotivo: 'Documento localizado',
//     dhResp: '2022-06-21T10:49:21-03:00',
//     ultNSU: '',
//     maxNSU: '',
//     docZip: [
//       {
//         xml: '<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"> ... </nfeProc>',
//         json: { nfeProc: { ... } },
//         nsu: '000000000000050',
//         schema: 'procNFe_v4.00.xsd',
//       },
//     ],
//     docZipErrors: [],
//   },
//   reqXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap12:Body></soap12:Envelope>',
//   resXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap:Body></soap:Envelope>',
//   status: 200,
// }
```

### Consulta por NSU

| Campo |   Tipo   | Tamanho | Descrição                           |
| :---- | :------: | :-----: | :---------------------------------- |
| `NSU` | _string_ |  1-15   | Número Sequencial Único específico. |

#### Exemplo

```js
const { DistribuicaoDFe } = require('@bitize/bitmde')
const fs = require('fs')

const distribuicao = new DistribuicaoDFe({
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
  cnpj: '12345678901234',
  cUFAutor: '41',
  tpAmb: '2',
})

const consulta = await distribuicao.consultaNSU('000000000000049')

if (consulta.error) {
  throw new Error(consulta.error)
}

console.log(consulta)
// {
//   data: {
//     tpAmb: '2',
//     verAplic: '1.5.11',
//     cStat: '138',
//     xMotivo: 'Documento localizado',
//     dhResp: '2022-06-21T10:50:46-03:00',
//     ultNSU: '000000000000049',
//     maxNSU: '000000000000212',
//     docZip: [
//       {
//         xml: '<resNFe xmlns:xsd="http://www.w3.org/2001/XMLSchema" ... </resNFe>',
//         json: { resNFe: { ... } },
//         nsu: '000000000000049',
//         schema: 'resNFe_v1.01.xsd',
//       },
//     ],
//     docZipErrors: [],
//   },
//   reqXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap12:Body></soap12:Envelope>',
//   resXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap:Body></soap:Envelope>',
//   status: 200,
// }
```

## Distribuição de CT-e e MDF-e

`DistribuicaoCTe` consulta o `CTeDistribuicaoDFe` do Ambiente Nacional e `DistribuicaoMDFe` consulta o `MDFeDistribuicaoDFe` da SVRS. Os dois têm só `consultaUltNSU(ultNSU)` e `consultaNSU(nsu)`, com os mesmos argumentos da [Distribuição de DF-e](#distribuição-de-df-e): o leiaute desses serviços não tem consulta por chave de acesso.

O retorno é o mesmo da NF-e, `{ data, reqXml, resXml, status, error?, transportError? }`, com `docZip` e `docZipErrors`. Muda o `schema` de cada documento (`procCTe`, `procEventoCTe`, `procMDFe`, …), que a biblioteca repassa sem interpretar.

### Construtor

```js
new DistribuicaoCTe(config)
new DistribuicaoMDFe(config)
```

A `config` é a da [`DistribuicaoDFe`](#construtor), com uma diferença: a `DistribuicaoMDFe` **não** recebe `cUFAutor`, porque o pedido de distribuição do MDF-e não tem esse campo. Se informado, é ignorado. Na `DistribuicaoCTe` ele continua obrigatório.

#### Exemplo

```js
const { DistribuicaoCTe, DistribuicaoMDFe } = require('@bitize/bitmde')
const fs = require('fs')

const certificado = {
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
}

const cte = new DistribuicaoCTe({
  ...certificado,
  cnpj: '12345678901234',
  cUFAutor: '41',
  tpAmb: '2',
})

const mdfe = new DistribuicaoMDFe({
  ...certificado,
  cnpj: '12345678901234',
  tpAmb: '2',
})

const consultaCTe = await cte.consultaUltNSU('000000000000000')
const consultaMDFe = await mdfe.consultaNSU('000000000000049')

if (consultaCTe.error) {
  throw new Error(consultaCTe.error)
}
```

Cada serviço guarda o seu próprio `ultNSU` por CNPJ/CPF: o NSU do CT-e não tem relação com o da NF-e nem com o do MDF-e.

### Cadência

Trate o CT-e e o MDF-e com a mesma disciplina da NF-e. A biblioteca não controla intervalo nem repetição: isso é de quem consome.

- Guarde o `ultNSU` devolvido e use-o no próximo pedido. Repita enquanto `ultNSU` for menor que `maxNSU`.
- Com `cStat` `137` (nenhum documento localizado), espere uma hora antes de consultar de novo.
- Na NF-e, a SEFAZ guarda o ponteiro por CNPJ/CPF e rejeita com `656` quem sai da sequência. Uma consulta avulsa por NSU em produção, para um CNPJ que outro sistema já varre, move esse ponteiro e pode dessincronizar o outro sistema.

Essas regras foram observadas na NF-e. No CT-e e no MDF-e a biblioteca assume que valem igual.

## Manifestação do Destinatário

### Construtor

```js
new RecepcaoEvento(config)
```

- `config` `<Object>`
  - `pfx` `<Buffer>` - [OPCIONAL] - Arquivo **.pfx**. Se o `pfx` não for informado, as propriedades `cert` e `key` passam a ser obrigatórias.
  - `passphrase` `<String>` - [OPCIONAL] - Senha do arquivo **.pfx**.
  - `cert` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _cert.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `key` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _key.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `cnpj` `<String>` - [OPCIONAL] - CNPJ do interessado no DF-e. Se não informado um CNPJ, será obrigatório informar um CPF.
  - `cpf` `<String>` - [OPCIONAL] - CPF do interessado no DF-e. Se não informado um CPF, será obrigatório informar um CNPJ.
  - `tpAmb` `<String>` - [OBRIGATÓRIO] - Identificação de Ambiente. Informar `'1'` para **Produção** ou `'2'` para **Homologação**.
  - `timezone` `<String>` - [OPCIONAL] - Fuso horário do autor. É utilizado `'America/Sao_Paulo'` como valor padrão. Consulte a tabela [lista de timezones](#lista-de-timezones) válidos para o Brasil.
  - `options` `<Object>` - [OPCIONAL]
    - `requestOptions` `<AxiosRequestConfig>` - [OPCIONAL]
    - `httpsOptions` `<AgentOptions>` - [OPCIONAL] - Opções do `https.Agent`, mescladas por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Ver [Conexão com a SEFAZ](#conexão-com-a-sefaz).

### Enviar Lote de Eventos

| Campo                |   Tipo   | Tamanho | Descrição                                                                                                                                                |
| :------------------- | :------: | :-----: | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idLote`             | _string_ |  1-15   | Identificador de controle do Lote de envio do Evento.                                                                                                    |
| `lote`               | _array_  |  1-20   | Lista de eventos para manifestação.                                                                                                                      |
| `lote.chNFe`         | _string_ |   44    | Chave de Acesso da NF-e vinculada ao Evento.                                                                                                             |
| `lote.tpEvento`      | _number_ |    6    | Código do evento: 210200 - Confirmacao da Operacao; 210210 - Ciencia da Operacao; 210220 - Desconhecimento da Operacao; 210240 - Operacao nao Realizada. |
| `lote.justificativa` | _string_ | 15-255  | Informar a justificativa do porque a operação não foi realizada, este campo deve ser informado somente no evento de Operação não Realizada.              |

#### Exemplo

```js
const { RecepcaoEvento } = require('@bitize/bitmde')
const fs = require('fs')

const recepcao = new RecepcaoEvento({
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
  cnpj: '12345678901234',
  tpAmb: '2',
})

const lote = [
  {
    chNFe: '41000000000000000000000000000000000000000040',
    tipoEvento: 210210,
  },
  {
    chNFe: '41000000000000000000000000000000000000000041',
    tipoEvento: 210240,
    justificativa: 'Não foi realizado a entrega correta dos itens da nota.',
  },
]

const manifestacao = await recepcao.enviarEvento({
  idLote: '1337',
  lote: lote,
})

if (manifestacao.error) {
  throw new Error(manifestacao.error)
}

console.log(manifestacao)
// {
//   data: {
//     idLote: '1337',
//     tpAmb: '2',
//     verAplic: 'AN_1.4.3',
//     cOrgao: '91',
//     cStat: '128',
//     xMotivo: 'Lote de evento processado',
//     infEvento: [
//       {
//         tpAmb: '2',
//         verAplic: 'AN_1.4.3',
//         cOrgao: '91',
//         cStat: '596',
//         xMotivo: 'Rejeicao: Evento apresentado apos o prazo permitido para o evento: [10 dias]',
//         chNFe: '41000000000000000000000000000000000000000040',
//         tpEvento: '210210',
//         xEvento: 'Ciencia da Operacao',
//         nSeqEvento: '1',
//         CNPJDest: '',
//         dhRegEvento: '2022-06-21T11:20:10-03:00',
//         nProt: ''
//       },
//       {
//         tpAmb: '2',
//         verAplic: 'AN_1.4.3',
//         cOrgao: '91',
//         cStat: '135',
//         xMotivo: 'Evento registrado e vinculado a NF-e',
//         chNFe: '41000000000000000000000000000000000000000041',
//         tpEvento: '210240',
//         xEvento: 'Operacao nao Realizada',
//         nSeqEvento: '1',
//         CNPJDest: '12345678901234',
//         dhRegEvento: '2022-06-21T11:20:10-03:00',
//         nProt: '891220000003301'
//       },
//     ],
//   },
//   reqXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap12:Body></soap12:Envelope>',
//   resXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap:Body></soap:Envelope>',
//   status: 200,
// }
```

## Distribuição de NFS-e Nacional

Consulta, no Ambiente de Dados Nacional (ADN), as NFS-e e os eventos em que o CNPJ figura. A fila traz o histórico inteiro do CNPJ desde a primeira nota no ADN e mistura notas recebidas, notas emitidas e eventos de terceiros sobre umas e outras. A biblioteca **não filtra**: cada NFS-e vem com o `papel` do CNPJ consultado.

> **Cobertura.** Só aparece a NFS-e que chegou ao ADN: as emitidas no Emissor Nacional e as de município cujo sistema próprio compartilha com o ADN. Nota de município que ainda não compartilha não está na distribuição, mesmo com a obrigatoriedade da LC 214/2025.

### Construtor

```js
new DistribuicaoNFSe(config)
```

- `config` `<Object>`
  - `pfx` `<Buffer>` - [OPCIONAL] - Arquivo **.pfx**. Se o `pfx` não for informado, as propriedades `cert` e `key` passam a ser obrigatórias.
  - `passphrase` `<String>` - [OPCIONAL] - Senha do arquivo **.pfx**.
  - `cert` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _cert.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `key` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _key.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `cnpj` `<String>` - [OBRIGATÓRIO] - CNPJ consultado, com 14 caracteres e sem pontuação (aceita o alfanumérico). Pode ser o do certificado ou o de outro estabelecimento com a mesma raiz.
  - `tpAmb` `<String>` - [OBRIGATÓRIO] - Informar `'1'` para **Produção** ou `'2'` para **Produção restrita**.
  - `options` `<Object>` - [OPCIONAL]
    - `requestOptions` `<AxiosRequestConfig>` - [OPCIONAL]
    - `httpsOptions` `<AgentOptions>` - [OPCIONAL] - Opções do `https.Agent`, mescladas por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Ver [Conexão com a SEFAZ](#conexão-com-a-sefaz).

### Consultas

| Método                   | Argumento                          | Devolve                                        |
| :----------------------- | :--------------------------------- | :--------------------------------------------- |
| `consultaUltNSU(ultNSU)` | NSU, 1-15 dígitos; começa em `'0'` | Até 50 documentos **depois** do NSU informado  |
| `consultaNSU(nsu)`       | NSU, 1-15 dígitos, maior que zero  | O documento daquele NSU                        |
| `consultaChNFSe(chNFSe)` | Chave de acesso, 50 dígitos        | A NFS-e da chave e os eventos vinculados a ela |

No ADN o NSU é um inteiro, sem zeros à esquerda: `'00051'` e `51` viram `'51'`.

#### Exemplo: drenar a fila

```js
const { DistribuicaoNFSe } = require('@bitize/bitmde')
const fs = require('fs')

const distribuicao = new DistribuicaoNFSe({
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
  cnpj: '12345678000190',
  tpAmb: '1',
})

let ultNSU = '0' // ou o último NSU guardado

while (true) {
  const consulta = await distribuicao.consultaUltNSU(ultNSU)

  if (consulta.error) {
    throw new Error(consulta.error)
  }

  const { documentos, documentosErros } = consulta.data

  // Fim da fila: HTTP 404, NENHUM_DOCUMENTO_LOCALIZADO, sem error.
  if (documentos.length === 0 && documentosErros.length === 0) {
    break
  }

  for (const doc of documentos) {
    if (doc.tipoDocumento === 'NFSE' && doc.papel === 'tomador') {
      // NFS-e recebida: doc.xml e doc.json
    }
  }

  ultNSU = [...documentos, ...documentosErros]
    .map((doc) => doc.nsu)
    .sort((a, b) => Number(a) - Number(b))
    .pop()
}
```

O próximo pedido usa o **último NSU recebido**, sem somar 1. O ADN não bloqueia quem volta a um NSU anterior, como faz a distribuição de NF-e, mas guardar o ponteiro e escolher o intervalo entre as consultas continua sendo de quem consome.

#### Retorno

```js
console.log(consulta)
// {
//   data: {
//     statusProcessamento: 'DOCUMENTOS_LOCALIZADOS',
//     tipoAmbiente: 'PRODUCAO',
//     versaoAplicativo: '1.0.0.0',
//     dataHoraProcessamento: '2026-10-15T10:35:14.5687887-03:00',
//     alertas: [],
//     erros: [],
//     documentos: [
//       {
//         nsu: '1',
//         chaveAcesso: '41000000000000000000000000000000000000000000000001',
//         tipoDocumento: 'NFSE',
//         tipoEvento: '',
//         dataHoraGeracao: '2026-10-01T09:12:00',
//         papel: 'tomador',
//         xml: '<?xml version="1.0" encoding="utf-8"?><NFSe versao="1.01" ... </NFSe>',
//         json: { NFSe: { ... } },
//       },
//       {
//         nsu: '2',
//         chaveAcesso: '41000000000000000000000000000000000000000000000001',
//         tipoDocumento: 'EVENTO',
//         tipoEvento: 'CANCELAMENTO',
//         dataHoraGeracao: '2026-10-02T15:40:00',
//         papel: '',
//         xml: '<?xml version="1.0" encoding="utf-8"?><evento versao="1.01" ... </evento>',
//         json: { evento: { ... } },
//       },
//     ],
//     documentosErros: [],
//   },
//   resBody: '{"StatusProcessamento":"DOCUMENTOS_LOCALIZADOS", ... }',
//   status: 200,
// }
```

- `papel` vale `'tomador'`, `'prestador'` ou `'intermediario'` quando o `cnpj` da config é o `toma`, o `prest` ou o `interm` da DPS, testados nessa ordem; `''` quando não é nenhum, e sempre `''` em eventos. Para ficar só com as recebidas, filtre por `tipoDocumento === 'NFSE' && papel === 'tomador'`.
- `resBody` é o corpo cru da resposta do ADN, como veio. Não há `reqXml` nem `resXml`: a consulta é um `GET` sem corpo e a resposta é JSON.
- `documentosErros` traz, com `nsu`, `chaveAcesso`, `tipoDocumento` e `error`, os itens cujo XML não abriu: `ArquivoXml sem conteúdo.`, `Falha ao descompactar o ArquivoXml: <motivo>` ou `Falha ao interpretar o XML do ArquivoXml: <motivo>`. Eles não derrubam o lote nem preenchem o `error` de topo.

#### Quando há `error`

| Situação                                          | `status` | `data`                       | `error`                                            |
| :------------------------------------------------ | :------: | :--------------------------- | :------------------------------------------------- |
| Fila vazia, chave ou NSU sem documento            |   404    | preenchido, `documentos: []` | —                                                  |
| Rejeição do ADN (ex.: `cnpj` de outra raiz)       |   400    | preenchido, com `erros`      | `E2243: O CNPJ informado na consulta deve ter ...` |
| Resposta que não é do ADN (ex.: HTML de um proxy) |   real   | `{}`                         | `Resposta inesperada do ADN (HTTP 502).`           |
| Sem resposta HTTP                                 |    0     | `{}`                         | `Falha de transporte (<code>): <message>`          |

Na rejeição, `data` **não** é esvaziado: `data.erros` traz o diagnóstico em `{ codigo, descricao, complemento }`. `error` e `transportError` têm o mesmo significado da distribuição de DF-e — ver [Erro de transporte](#erro-de-transporte).

## Manifestação do tomador da NFS-e Nacional

Registra, na SEFIN Nacional, a Confirmação (`e203202`) ou a Rejeição (`e203206`) do tomador sobre uma NFS-e que exista no ADN. Cada chamada é **um** pedido de registro de evento, assinado com o A1 da config — não há lote.

> **Evento fiscal não se desfaz.** Em produção (`tpAmb: '1'`), cada chamada aceita registra um evento vinculado à nota. Depois da Confirmação, o prestador não consegue mais cancelar a NFS-e, só substituí-la; a Rejeição só é anulada pelo município de incidência. Teste em produção restrita (`tpAmb: '2'`).

### Construtor

```js
new ManifestacaoNFSe(config)
```

- `config` `<Object>`
  - `pfx` `<Buffer>` - [OPCIONAL] - Arquivo **.pfx**. Se o `pfx` não for informado, as propriedades `cert` e `key` passam a ser obrigatórias.
  - `passphrase` `<String>` - [OPCIONAL] - Senha do arquivo **.pfx**.
  - `cert` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _cert.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `key` `<Buffer | String>` - [OPCIONAL] - Conteúdo do _key.pem_. Essa propriedade fica obrigatória se o `pfx` não for informado.
  - `cnpj` `<String>` - [OBRIGATÓRIO] - CNPJ do tomador, enviado como `CNPJAutor`, com 14 caracteres e sem pontuação. Precisa ter a mesma raiz do CNPJ do certificado.
  - `tpAmb` `<String>` - [OBRIGATÓRIO] - Informar `'1'` para **Produção** ou `'2'` para **Produção restrita**.
  - `timezone` `<String>` - [OPCIONAL] - Fuso do `dhEvento`. Padrão `'America/Sao_Paulo'`. Ver [Lista de Timezones](#lista-de-timezones).
  - `options` `<Object>` - [OPCIONAL]
    - `requestOptions` `<AxiosRequestConfig>` - [OPCIONAL]
    - `httpsOptions` `<AgentOptions>` - [OPCIONAL] - Opções do `https.Agent`, mescladas por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Ver [Conexão com a SEFAZ](#conexão-com-a-sefaz).

### Métodos

| Método                     | Argumentos                                         | Evento                             |
| :------------------------- | :------------------------------------------------- | :--------------------------------- |
| `confirmar(chNFSe)`        | Chave de acesso, 50 dígitos                        | `e203202` — Confirmação do Tomador |
| `rejeitar(chNFSe, motivo)` | Chave de acesso e `motivo` `{ cMotivo, xMotivo? }` | `e203206` — Rejeição do Tomador    |

Códigos de `cMotivo`:

| `cMotivo` | Motivo                                                                                        |
| :-------: | :-------------------------------------------------------------------------------------------- |
|   `'1'`   | NFS-e em duplicidade                                                                          |
|   `'2'`   | NFS-e já emitida pelo tomador                                                                 |
|   `'3'`   | Não ocorrência do fato gerador                                                                |
|   `'4'`   | Erro quanto à responsabilidade tributária                                                     |
|   `'5'`   | Erro quanto ao valor do serviço, valor das deduções, serviço prestado ou data do fato gerador |
|   `'9'`   | Outros — **exige `xMotivo`**                                                                  |

`xMotivo` é opcional nos demais motivos e, quando informado, tem de 15 a 255 caracteres.

Cada NFS-e aceita uma Confirmação e uma Rejeição do tomador. A Rejeição é aceita depois da Confirmação, e a Confirmação depois da Rejeição; repetir o mesmo evento é rejeitado (`E0861` e `E0866`).

#### Exemplo

```js
const { ManifestacaoNFSe } = require('@bitize/bitmde')
const fs = require('fs')

const manifestacao = new ManifestacaoNFSe({
  pfx: fs.readFileSync('./certificado.pfx'),
  passphrase: 'senha',
  cnpj: '12345678000190',
  tpAmb: '2',
})

const confirmacao = await manifestacao.confirmar(
  '41000000000000000000000000000000000000000000000001'
)

const rejeicao = await manifestacao.rejeitar(
  '41000000000000000000000000000000000000000000000002',
  { cMotivo: '9', xMotivo: 'Serviço não foi prestado.' }
)

if (rejeicao.error) {
  console.error(rejeicao.error) // ex.: 'E0866: ...'
}
```

#### Retorno

```js
console.log(confirmacao)
// {
//   data: {
//     tipoAmbiente: '2',
//     versaoAplicativo: 'SefinNacional_1.6.0',
//     dataHoraProcessamento: '2026-10-16T09:26:06-03:00',
//     alertas: [],
//     erros: [],
//     evento: {
//       xml: '<evento versao="1.01" ... </evento>',
//       json: { evento: { ... } },
//     },
//   },
//   reqXml: '<?xml version="1.0" encoding="UTF-8"?><pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"> ... </pedRegEvento>',
//   resBody: '{"tipoAmbiente":2, ... }',
//   status: 201,
// }
```

- `reqXml` é o `pedRegEvento` assinado, antes do gzip — é o que se audita numa rejeição.
- `data.evento` traz o evento registrado pela SEFIN, em `xml` e `json`.
- `status`, `error` e `transportError` têm o mesmo significado das outras APIs.

#### Quando há `error`

| Situação                                            | `status` | `data`                   | `error`                                                |
| :-------------------------------------------------- | :------: | :----------------------- | :----------------------------------------------------- |
| Evento registrado e devolvido                       |   201    | preenchido, com `evento` | —                                                      |
| Evento registrado, mas o retorno não abre           |   201    | preenchido, `evento: {}` | `Falha ao abrir o evento retornado: <motivo>`          |
| Rejeição da SEFIN (ex.: nota fora do ADN)           |   400    | preenchido, com `erros`  | `E1831: O evento não pode ser recepcionado pois a ...` |
| Resposta que não é da SEFIN (ex.: HTML de um proxy) |   real   | `{}`                     | `Resposta inesperada da SEFIN (HTTP 502).`             |
| Sem resposta HTTP                                   |    0     | `{}`                     | `Falha de transporte (<code>): <message>`              |

Na segunda linha o evento **foi registrado**: não repita o pedido; consulte a nota pela [Distribuição de NFS-e Nacional](#distribuição-de-nfs-e-nacional). `reqXml` vem em todos os casos.

## Conexão com a SEFAZ

### Validação do certificado do servidor

O certificado do servidor da SEFAZ é **validado por padrão**. Sem `httpsOptions`, o agente HTTPS usa:

```js
{ ca: CA_PADRAO, rejectUnauthorized: true }
```

A biblioteca exporta as duas cadeias que usa:

- `CA_PADRAO` — as raízes que o Node usaria por padrão, somadas à cadeia ICP-Brasil. Inclui `NODE_EXTRA_CA_CERTS` e `--use-system-ca` quando o Node oferece `tls.getCACertificates` (22.15 ou posterior); nas versões do Node 22 anteriores a ela, usa o bundle da Mozilla (`tls.rootCertificates`). É montada uma vez, quando o pacote é carregado.
- `CA_ICP_BRASIL` — só a cadeia ICP-Brasil embarcada (AC Raiz Brasileira v10 e AC SERPRO SSLv1).

As duas são arrays de PEM congelados. Informar `ca` em `httpsOptions` **substitui** a cadeia inteira. Para acrescentar uma AC, por exemplo a de um proxy corporativo, some à cadeia padrão:

```js
const { CA_PADRAO, DistribuicaoDFe } = require('@bitize/bitmde')

const distribuicao = new DistribuicaoDFe({
  // ...
  options: {
    httpsOptions: {
      ca: [...CA_PADRAO, fs.readFileSync('./minha-ca.pem', 'utf8')],
    },
  },
})
```

Desligar a validação ainda é possível com `httpsOptions: { rejectUnauthorized: false }`, mas **não é recomendado**: assim a biblioteca aceita qualquer servidor e apresenta a ele o certificado A1 no mTLS.

### Erro de transporte

Quando não há resposta HTTP (falha na cadeia TLS, DNS, conexão recusada, timeout), a biblioteca não lança. O retorno vem com `status: 0` e o motivo em `transportError`:

```js
// {
//   data: {},
//   reqXml: '<?xml version="1.0" encoding="utf-8"?> ... </soap12:Body></soap12:Envelope>',
//   resXml: '',
//   status: 0,
//   error: 'Falha de transporte (UNABLE_TO_GET_ISSUER_CERT_LOCALLY): unable to get local issuer certificate',
//   transportError: {
//     code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
//     message: 'unable to get local issuer certificate',
//   },
// }
```

`transportError.code` é o código do Node ou do axios, sem tradução: `ECONNREFUSED`, `ENOTFOUND`, `ECONNRESET`, `ECONNABORTED` (timeout), `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (cadeia), entre outros. Sem código, vem `ERR_DESCONHECIDO`. `error` continua preenchido, então `if (retorno.error)` cobre esse caso como antes.

Uma resposta HTTP de erro da SEFAZ, como um `502` ou um `503`, chega com o status real, o corpo em `resXml` e **sem** `transportError`. Então `status: 0` significa sempre "a SEFAZ não respondeu".

Nas APIs da NFS-e o erro de transporte tem a mesma forma, com `resBody: ''` no lugar de `resXml`. A `DistribuicaoNFSe` não tem `reqXml`; a `ManifestacaoNFSe` mantém o `reqXml` com o pedido assinado, para saber o que foi enviado. As mesmas regras de `CA_PADRAO` e `httpsOptions` valem para os hosts do ADN, que hoje servem certificado Let's Encrypt, e para os da SEFIN Nacional, que servem a mesma cadeia GlobalSign do Ambiente Nacional da NF-e.

O Ambiente Nacional do CT-e serve a mesma cadeia GlobalSign da NF-e. A SVRS, onde fica a distribuição do MDF-e, serve uma cadeia **ICP-Brasil** (AC SERPRO SSLv1). Por isso um `ca` montado só com as raízes do Node quebra o MDF-e: parta sempre de `CA_PADRAO`, que tem as duas.

## Sobre o BitERP

O `@bitize/bitmde` é mantido pela equipe do **[BitERP](https://www.biterp.ai)**, um ERP online que automatiza a rotina fiscal, financeira e comercial de empresas brasileiras.

Dentro do BitERP, esta biblioteca é o componente responsável por:

- monitorar os documentos fiscais destinados ao CNPJ/CPF do cliente (Distribuição de DF-e);
- registrar a manifestação do destinatário (Ciência, Confirmação, Desconhecimento ou Operação não Realizada);
- baixar e armazenar o XML das NF-e de entrada.

Se você precisa disso pronto — sem manter certificado, agendamento de consulta por NSU e conciliação de notas de entrada na mão — conheça o BitERP em **[www.biterp.ai](https://www.biterp.ai)**.

## Tabelas

### Códigos UF

|  UF  | cUF  | Estado                  |
| :--: | :--: | :---------------------- |
| `RO` | _11_ | **Rondônia**            |
| `AC` | _12_ | **Acre**                |
| `AM` | _13_ | **Amazonas**            |
| `RR` | _14_ | **Roraima**             |
| `PA` | _15_ | **Pará**                |
| `AP` | _16_ | **Amapá**               |
| `TO` | _17_ | **Tocantins**           |
| `MA` | _21_ | **Maranhão**            |
| `PI` | _22_ | **Piauí**               |
| `CE` | _23_ | **Ceará**               |
| `RN` | _24_ | **Rio Grande do Norte** |
| `PB` | _25_ | **Paraíba**             |
| `PE` | _26_ | **Pernambuco**          |
| `AL` | _27_ | **Alagoas**             |
| `SE` | _28_ | **Sergipe**             |
| `BA` | _29_ | **Bahia**               |
| `MG` | _31_ | **Minas Gerais**        |
| `ES` | _32_ | **Espírito Santo**      |
| `RJ` | _33_ | **Rio de Janeiro**      |
| `SP` | _35_ | **São Paulo**           |
| `PR` | _41_ | **Paraná**              |
| `SC` | _42_ | **Santa Catarina**      |
| `RS` | _43_ | **Rio Grande do Sul**   |
| `MS` | _50_ | **Mato Grosso do Sul**  |
| `MT` | _51_ | **Mato Grosso**         |
| `GO` | _52_ | **Goiás**               |
| `DF` | _53_ | **Distrito Federal**    |

### Lista de Timezones

|        timezone        | Estado                                 |   UTC    |
| :--------------------: | :------------------------------------- | :------: |
|   `America/Noronha`    | **Fernando de Noronha**                | _−02:00_ |
|  `America/Araguaina`   | **TO**                                 | _−03:00_ |
|    `America/Bahia`     | **BA**                                 | _−03:00_ |
|    `America/Belem`     | **AP, PA (leste)**                     | _−03:00_ |
|  `America/Fortaleza`   | **CE, MA, PB, PI, RN**                 | _−03:00_ |
|    `America/Maceio`    | **AL, SE**                             | _−03:00_ |
|    `America/Recife`    | **PE**                                 | _−03:00_ |
|   `America/Santarem`   | **PA (oeste)**                         | _−03:00_ |
|  `America/Sao_Paulo`   | **DF, ES, GO, MG, PR, RJ, RS, SC, SP** | _−03:00_ |
|  `America/Boa_Vista`   | **RR**                                 | _−04:00_ |
| `America/Campo_Grande` | **MS**                                 | _−04:00_ |
|    `America/Cuiaba`    | **MT**                                 | _−04:00_ |
|    `America/Manaus`    | **AM (leste)**                         | _−04:00_ |
| `America/Porto_Velho`  | **RO**                                 | _−04:00_ |
|   `America/Eirunepe`   | **AM (oeste)**                         | _−05:00_ |
|  `America/Rio_Branco`  | **AC**                                 | _−05:00_ |
