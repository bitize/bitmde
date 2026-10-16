'use strict'

const assert = require('assert')
const { DOCUMENTOS } = require('../src/env')
const { DistribuicaoHelper, RetornoHelper } = require('../src/helpers')
const {
  NFE_DIST_DFE_ENVELOPE,
} = require('./fixtures/nfe-distribuicao-envelope')

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

/**
 * Resposta do CTeDistribuicaoDFe: mesmo formato da NF-e, outros nomes.
 *
 * @param {string} docZips
 * @returns {string}
 */
function montarRespostaCte(docZips) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>' +
    '<cteDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">' +
    '<cteDistDFeInteresseResult>' +
    '<retDistDFeInt versao="1.00" xmlns="http://www.portalfiscal.inf.br/cte">' +
    '<tpAmb>2</tpAmb><verAplic>2.1.2</verAplic><cStat>138</cStat>' +
    '<xMotivo>Documento(s) localizado(s)</xMotivo><dhResp>2026-10-16T14:36:03</dhResp>' +
    '<ultNSU>000000000000003</ultNSU><maxNSU>000000000000010</maxNSU>' +
    `<loteDistDFeInt>${docZips}</loteDistDFeInt>` +
    '</retDistDFeInt></cteDistDFeInteresseResult></cteDistDFeInteresseResponse>' +
    '</soap:Body></soap:Envelope>'
  )
}

/**
 * Resposta do MDFeDistribuicaoDFe, no formato devolvido pela homologação da
 * SVRS: WSDL "bare", com o result direto no Body e o mdfeCabecMsg no Header.
 *
 * @param {string} docZips
 * @returns {string}
 */
function montarRespostaMdfe(docZips) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
    '<soap:Header><mdfeCabecMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe">' +
    '<cUF>43</cUF><versaoDados>1.00</versaoDados></mdfeCabecMsg></soap:Header><soap:Body>' +
    '<mdfeDistDFeInteresseResult xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe">' +
    '<retDistDFeInt versao="1.00" xmlns="http://www.portalfiscal.inf.br/mdfe">' +
    '<tpAmb>2</tpAmb><verAplic>RS20240709143531</verAplic><cStat>138</cStat>' +
    '<xMotivo>Documento(s) localizado(s)</xMotivo><dhResp>2026-10-16T17:36:00</dhResp>' +
    '<ultNSU>000000000000003</ultNSU><maxNSU>000000000000010</maxNSU>' +
    `<loteDistDFeInt>${docZips}</loteDistDFeInt>` +
    '</retDistDFeInt></mdfeDistDFeInteresseResult>' +
    '</soap:Body></soap:Envelope>'
  )
}

const ENVELOPE_ABRE =
  '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>'
const ENVELOPE_FECHA = '</soap12:Body></soap12:Envelope>'

const OPTS_BASE = {
  tpAmb: '2',
  cUFAutor: '29',
  cnpj: '99999999999999',
  cert: '',
  key: '',
  requestOptions: {},
  httpsOptions: {},
}

function assertMetadadosDoLote(retorno) {
  assert.strictEqual(retorno.cStat, '138')
  assert.strictEqual(retorno.xMotivo, 'Documento(s) localizado(s)')
  assert.strictEqual(retorno.ultNSU, '000000000000003')
  assert.strictEqual(retorno.maxNSU, '000000000000010')
  assert.strictEqual(retorno.error, undefined)
}

describe('DistribuicaoHelper', function () {
  describe('#montarRequest()', function () {
    it('NF-e: XML idêntico ao de antes da parametrização', function () {
      const req = DistribuicaoHelper.montarRequest({
        ...OPTS_BASE,
        documento: DOCUMENTOS.NFE,
        ultNSU: '000000000000001',
      })

      assert.strictEqual(req, NFE_DIST_DFE_ENVELOPE)
    })

    it('CT-e: invólucro cteDistDFeInteresse, versão 1.00, com cUFAutor', function () {
      const req = DistribuicaoHelper.montarRequest({
        ...OPTS_BASE,
        documento: DOCUMENTOS.CTE,
        nsu: '000000000000007',
      })

      assert.strictEqual(
        req,
        ENVELOPE_ABRE +
          '<cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe"><cteDadosMsg>' +
          '<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>2</tpAmb><cUFAutor>29</cUFAutor>' +
          '<CNPJ>99999999999999</CNPJ><consNSU><NSU>000000000000007</NSU></consNSU></distDFeInt>' +
          '</cteDadosMsg></cteDistDFeInteresse>' +
          ENVELOPE_FECHA
      )
    })

    it('MDF-e: mdfeDadosMsg direto no Body, sem cUFAutor e sem Header', function () {
      const req = DistribuicaoHelper.montarRequest({
        ...OPTS_BASE,
        documento: DOCUMENTOS.MDFE,
        ultNSU: '000000000000001',
      })

      assert.strictEqual(
        req,
        ENVELOPE_ABRE +
          '<mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe">' +
          '<distDFeInt xmlns="http://www.portalfiscal.inf.br/mdfe" versao="1.00"><tpAmb>2</tpAmb>' +
          '<CNPJ>99999999999999</CNPJ><distNSU><ultNSU>000000000000001</ultNSU></distNSU></distDFeInt>' +
          '</mdfeDadosMsg>' +
          ENVELOPE_FECHA
      )
    })

    it('CT-e e MDF-e ignoram chave: o leiaute não tem consulta por chave', function () {
      for (const documento of [DOCUMENTOS.CTE, DOCUMENTOS.MDFE]) {
        const req = DistribuicaoHelper.montarRequest({
          ...OPTS_BASE,
          documento: documento,
          chNFe: '41000000000000000000000000000000000000000039',
          nsu: '000000000000007',
        })

        assert.ok(req.includes('<consNSU><NSU>000000000000007</NSU></consNSU>'))
        assert.ok(!req.includes('consCh'))
      }
    })
  })

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

    it('loteDistDFeInt com texto no lugar dos docZip vira error', async function () {
      const resXml = montarResposta('conteúdo inesperado')
      const retorno = await DistribuicaoHelper.montarResponse(resXml)

      assert.strictEqual(retorno.error, 'loteDistDFeInt inválido.')

      // Com `error`, o RetornoHelper esvazia `data`: o chamador não tem
      // ultNSU para avançar sobre um lote que não pôde ler.
      const final = RetornoHelper.montarRetorno({
        json: retorno,
        data: '',
        retornoSefaz: { data: resXml, status: 200 },
      })
      assert.deepStrictEqual(final.data, {})
      assert.strictEqual(final.error, 'loteDistDFeInt inválido.')
    })

    it('loteDistDFeInt repetido vira error', async function () {
      // fecha o primeiro lote e abre um segundo dentro do mesmo retDistDFeInt
      const retorno = await DistribuicaoHelper.montarResponse(
        montarResposta(
          docZip('000000000000001', XML_ZIP) +
            '</loteDistDFeInt><loteDistDFeInt>' +
            docZip('000000000000002', XML_ZIP)
        )
      )

      assert.strictEqual(retorno.error, 'loteDistDFeInt inválido.')
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

    it('CT-e: lote misto lido pelos nomes do CTeDistribuicaoDFe', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarRespostaCte(
          docZip('000000000000001', XML_ZIP) +
            docZip('000000000000002', ZIP_CORROMPIDO)
        ),
        DOCUMENTOS.CTE
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(
        retorno.docZip.map((d) => d.nsu),
        ['000000000000001']
      )
      assert.deepStrictEqual(
        retorno.docZipErrors.map((e) => e.nsu),
        ['000000000000002']
      )
    })

    it('MDF-e: lote misto lido com o result direto no Body', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarRespostaMdfe(
          docZip('000000000000001', XML_ZIP) +
            docZip('000000000000002', ZIP_CORROMPIDO)
        ),
        DOCUMENTOS.MDFE
      )

      assertMetadadosDoLote(retorno)
      assert.deepStrictEqual(
        retorno.docZip.map((d) => d.nsu),
        ['000000000000001']
      )
      assert.deepStrictEqual(
        retorno.docZipErrors.map((e) => e.nsu),
        ['000000000000002']
      )
    })

    it('Sem descritor, lê como NF-e: resposta de MDF-e sai vazia', async function () {
      const retorno = await DistribuicaoHelper.montarResponse(
        montarRespostaMdfe('')
      )

      assert.strictEqual(retorno.cStat, '')
      assert.deepStrictEqual(retorno.docZip, [])
    })

    it('Imutabilidade', function () {
      assert.throws(function () {
        DistribuicaoHelper.abrirDocZip = 'subscrever abrirDocZip'
      })
    })
  })
})
