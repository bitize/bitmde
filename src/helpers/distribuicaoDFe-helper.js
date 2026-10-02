'use strict'

const { CA, DISTRIBUICAO } = require('../env')
const { DistribuicaoSchema } = require('../schemas')
const SefazService = require('../services/sefaz-service')
const { Gzip, Xml } = require('../util')

class DistribuicaoHelper {
  /**
   *
   * @param {string} data
   * @param {Object} opts
   * @returns
   */
  static async enviarConsulta(data, opts) {
    const baseURL = DISTRIBUICAO[opts.tpAmb]
    const options = {
      method: 'POST',
      data: data,
    }

    const client = new SefazService({
      baseURL: baseURL,
      ca: CA,
      cert: opts.cert,
      key: opts.key,
      tpAmb: opts.tpAmb,
      requestOptions: opts.requestOptions,
      httpsOptions: opts.httpsOptions,
    })

    const retorno = await client.request(options)

    return retorno
  }

  /**
   *
   * @param {Object} opts
   * @returns {string}
   */
  static montarRequest(opts) {
    const schema = DistribuicaoSchema.montarSchema(opts)
    const xml = Xml.jsonToXml(schema)
    const data = Xml.envelopar(xml)

    return data
  }

  /**
   *
   * @param {string} data
   * @returns {Promise<{tpAmb: string,verAplic: string,cStat: string,xMotivo: string,dhResp: string,ultNSU: string,maxNSU: string, docZip:[{xml: string,json: Object,nsu: string,schema: string}], docZipErrors:[{nsu: string,schema: string,error: string}], error: string}>}
   */
  static async montarResponse(data) {
    const retorno = {}

    const json = Xml.xmlToJson(data)

    if (json.error) {
      retorno['error'] = json.error
    }

    const {
      'soap:Envelope': {
        'soap:Body': {
          nfeDistDFeInteresseResponse: {
            nfeDistDFeInteresseResult: { retDistDFeInt = {} } = {},
          } = {},
        } = {},
      } = {},
    } = json

    let { loteDistDFeInt = {} } = retDistDFeInt

    // <loteDistDFeInt/> vazio chega do parser como string, não como objeto
    if (typeof loteDistDFeInt !== 'object') {
      loteDistDFeInt = {}
    }

    if (loteDistDFeInt.docZip) {
      if (!Array.isArray(loteDistDFeInt.docZip)) {
        loteDistDFeInt['docZip'] = [loteDistDFeInt.docZip]
      }
    } else {
      loteDistDFeInt['docZip'] = []
    }

    const resultados = await Promise.all(
      loteDistDFeInt['docZip'].map((doc) => DistribuicaoHelper.abrirDocZip(doc))
    )

    const docZip = []
    const docZipErrors = []

    for (const resultado of resultados) {
      if (resultado.error) {
        docZipErrors.push(resultado)
      } else {
        docZip.push(resultado)
      }
    }

    retorno['tpAmb'] = retDistDFeInt.tpAmb || ''
    retorno['verAplic'] = retDistDFeInt.verAplic || ''
    retorno['cStat'] = retDistDFeInt.cStat || ''
    retorno['xMotivo'] = retDistDFeInt.xMotivo || ''
    retorno['dhResp'] = retDistDFeInt.dhResp || ''
    retorno['ultNSU'] = retDistDFeInt.ultNSU || ''
    retorno['maxNSU'] = retDistDFeInt.maxNSU || ''

    retorno['docZip'] = docZip
    retorno['docZipErrors'] = docZipErrors

    return retorno
  }

  /**
   * Descompacta e interpreta um docZip sem nunca rejeitar: a falha vira
   * um item com `error`, para não derrubar o restante do lote.
   *
   * @param {Object} doc
   * @returns {Promise<{xml: string,json: Object,nsu: string,schema: string} | {nsu: string,schema: string,error: string}>}
   */
  static async abrirDocZip(doc) {
    const nsu = doc['@_NSU'] || ''
    const schema = doc['@_schema'] || ''

    if (!doc.value) {
      return { nsu, schema, error: 'docZip sem conteúdo.' }
    }

    let notaXml
    try {
      notaXml = await Gzip.unzip(doc.value)
    } catch (err) {
      return {
        nsu,
        schema,
        error: `Falha ao descompactar o docZip: ${err.message}`,
      }
    }

    let notaJson
    try {
      notaJson = Xml.xmlToJson(notaXml)
    } catch (err) {
      return {
        nsu,
        schema,
        error: `Falha ao interpretar o XML do docZip: ${err.message}`,
      }
    }

    return { xml: notaXml, json: notaJson, nsu, schema }
  }
}

module.exports = Object.freeze(DistribuicaoHelper)
