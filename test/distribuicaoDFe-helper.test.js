'use strict'

const assert = require('assert')
const { DistribuicaoHelper } = require('../src/helpers')

const XML_ZIP =
  'H4sIAAAAAAAEAIVS22qDQBD9FfFdd9Z7ZLKQphosqQ3mQuibMZto8RJcifn8rjG9PZUdZg7DOWeGYbHlIg65cqvKWvg3cZyqedddfEL6vtd7U2/aMzEAKNm/LtdZzqtU/SYX/5O1ohZdWmdcVa68FWkzVakO8PD4o780bZeWp0JkaakX9Uk/tKQ+cZVhlssVmUkNoPLZnjcAGKBtDwVMzzIodak3AIO6HpJRg/N49cL+apDcm3iLm4qz99lKWSSzMJrPlEAJnqPNWyJRlATLCMnIwShgUkqpNLEAHBOJ7OAxD6qCGWCARkEDZwPg30MDU2YkIwG7SxwyiuRe8SqTN3H1iXQZMB6L8y4t2W73sXdtJ+6TUDhGveaLbc9DsXyyt1NpNZLkzIRnh675PZZOfMP2LfNn7IOD9aptOkaHy5meDS44FnWRjG3M1kU3HEmu9gWRjP+BfQI6BY33GAIAAA=='
const XML_UNZIP =
  '<resNFe xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><chNFe>31201010588201000105550010038421171838422178</chNFe><CNPJ>10588201000105</CNPJ><xNome>ZAP GRAFICA E EDITORA EIRELI</xNome><IE>0011182040063</IE><dhEmi>2020-10-06T00:00:00-03:00</dhEmi><tpNF>1</tpNF><vNF>897.93</vNF><digVal>VVjX756NwRFs62nSeGUweFsLB5U=</digVal><dhRecbto>2020-10-06T19:25:43-03:00</dhRecbto><nProt>131203850706417</nProt><cSitNFe>1</cSitNFe></resNFe>'
// base64 de 'not gzip': decodifica, mas não é gzip
const ZIP_CORROMPIDO = 'bm90IGd6aXA='
// gzip de 'nao e xml <<': descompacta, mas não é XML
const ZIP_NAO_XML = 'H4sIAAAAAAAACstLzFdIVajIzVGwsQEA7021TQwAAAA='

const RES_SCHEMA = 'resNFe_v1.01.xsd'

/**
 * Envelope SOAP de resposta da distribuição, com os docZip informados.
 * Com `null`, o `loteDistDFeInt` é omitido, como a SEFAZ faz no cStat 137.
 *
 * @param {string|null} docZips
 * @returns {string}
 */
function montarResposta(docZips) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>' +
    '<nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">' +
    '<nfeDistDFeInteresseResult>' +
    '<retDistDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">' +
    '<tpAmb>2</tpAmb><verAplic>1.5.11</verAplic><cStat>138</cStat>' +
    '<xMotivo>Documento(s) localizado(s)</xMotivo><dhResp>2022-06-21T10:48:14-03:00</dhResp>' +
    '<ultNSU>000000000000003</ultNSU><maxNSU>000000000000010</maxNSU>' +
    (docZips === null ? '' : `<loteDistDFeInt>${docZips}</loteDistDFeInt>`) +
    '</retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse>' +
    '</soap:Body></soap:Envelope>'
  )
}

/**
 * @param {string} nsu
 * @param {string} conteudo
 * @returns {string}
 */
function docZip(nsu, conteudo) {
  return `<docZip NSU="${nsu}" schema="${RES_SCHEMA}">${conteudo}</docZip>`
}

function assertMetadadosDoLote(retorno) {
  assert.strictEqual(retorno.cStat, '138')
  assert.strictEqual(retorno.xMotivo, 'Documento(s) localizado(s)')
  assert.strictEqual(retorno.ultNSU, '000000000000003')
  assert.strictEqual(retorno.maxNSU, '000000000000010')
  assert.strictEqual(retorno.error, undefined)
}

describe('DistribuicaoHelper', function () {
  describe('#montarResponse()', function () {
    it('Lote misto: docZip corrompido não derruba o válido', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(
          docZip('000000000000001', XML_ZIP) +
            docZip('000000000000002', ZIP_CORROMPIDO)
        )
      )

      assertMetadadosDoLote(retorno)

      assert.strictEqual(retorno.docZip.length, 1)
      assert.strictEqual(retorno.docZip[0].xml, XML_UNZIP)
      assert.strictEqual(retorno.docZip[0].nsu, '000000000000001')
      assert.strictEqual(retorno.docZip[0].schema, RES_SCHEMA)
      assert.ok(retorno.docZip[0].json.resNFe)

      assert.deepStrictEqual(retorno.docZipErrors, [
        {
          nsu: '000000000000002',
          schema: RES_SCHEMA,
          error: 'Falha ao descompactar o docZip: incorrect header check',
        },
      ])
    })

    it('docZip que descompacta mas não é XML', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(docZip('000000000000001', ZIP_NAO_XML))
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(retorno.docZip, [])
      assert.strictEqual(retorno.docZipErrors.length, 1)
      assert.ok(
        retorno.docZipErrors[0].error.startsWith(
          'Falha ao interpretar o XML do docZip: '
        )
      )
    })

    it('docZip sem conteúdo', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(docZip('000000000000001', ''))
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(retorno.docZip, [])
      assert.deepStrictEqual(retorno.docZipErrors, [
        {
          nsu: '000000000000001',
          schema: RES_SCHEMA,
          error: 'docZip sem conteúdo.',
        },
      ])
    })

    it('Lote com todos os docZip falhando mantém os metadados', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(
          docZip('000000000000001', ZIP_CORROMPIDO) +
            docZip('000000000000002', ZIP_NAO_XML)
        )
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(retorno.docZip, [])
      assert.deepStrictEqual(
        retorno.docZipErrors.map((e) => e.nsu),
        ['000000000000001', '000000000000002']
      )
    })

    it('Lote sem loteDistDFeInt', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(null)
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(retorno.docZip, [])
      assert.deepStrictEqual(retorno.docZipErrors, [])
    })

    it('loteDistDFeInt vazio', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta('')
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(retorno.docZip, [])
      assert.deepStrictEqual(retorno.docZipErrors, [])
    })

    it('Ordem do lote preservada', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(
          docZip('000000000000001', XML_ZIP) +
            docZip('000000000000002', ZIP_CORROMPIDO) +
            docZip('000000000000003', XML_ZIP) +
            docZip('000000000000004', '')
        )
      )

      assert.deepStrictEqual(
        retorno.docZip.map((d) => d.nsu),
        ['000000000000001', '000000000000003']
      )
      assert.deepStrictEqual(
        retorno.docZipErrors.map((e) => e.nsu),
        ['000000000000002', '000000000000004']
      )
    })

    it('Imutabilidade', function () {
      assert.throws(function () {
        DistribuicaoHelper.abrirDocZip = 'subscrever abrirDocZip'
      })
    })
  })
})
