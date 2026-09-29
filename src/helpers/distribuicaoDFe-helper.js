'use strict'

const { CA } = require('../env')
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
    const baseURL = opts.documento.endpoints[opts.tpAmb]
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
    const documento = opts.documento
    const schema = DistribuicaoSchema.montarSchema(opts)
    const xml = Xml.jsonToXml(schema)
    let cabecalho = null

    if (documento.cabecMsg) {
      cabecalho = Xml.jsonToXml({
        [documento.cabecMsg]: {
          cUF: opts.cUFAutor,
          versaoDados: documento.versao,
          '@_xmlns': documento.cabecMsgXmlns,
        },
      })
    }

    const data = Xml.envelopar(xml, cabecalho)

    return data
  }

  /**
   *
   * @param {string} data
   * @param {Object} documento
   * @returns {Promise<{tpAmb: string,verAplic: string,cStat: string,xMotivo: string,dhResp: string,ultNSU: string,maxNSU: string, docZip:[{xml: string,json: Object,nsu: string,schema: string}], error: string}>}
   */
  static async montarResponse(data, documento) {
    const retorno = {}

    const json = Xml.xmlToJson(data)

    if (json.error) {
      retorno['error'] = json.error
    }

    const body = json['soap:Envelope']?.['soap:Body'] ?? {}
    const response = body[documento.resposta.response] ?? {}
    const result = response[documento.resposta.result] ?? {}
    const retDistDFeInt = result.retDistDFeInt ?? {}

    const { loteDistDFeInt = {} } = retDistDFeInt

    if (loteDistDFeInt.docZip) {
      if (!Array.isArray(loteDistDFeInt.docZip)) {
        loteDistDFeInt['docZip'] = [loteDistDFeInt.docZip]
      }
    } else {
      loteDistDFeInt['docZip'] = []
    }

    const docZip = await Promise.all(
      loteDistDFeInt['docZip'].map(async (doc) => {
        const notaXml = await Gzip.unzip(doc.value)
        const notaJson = Xml.xmlToJson(notaXml)
        return {
          xml: notaXml,
          json: notaJson,
          nsu: doc['@_NSU'],
          schema: doc['@_schema'],
        }
      })
    )

    retorno['tpAmb'] = retDistDFeInt.tpAmb || ''
    retorno['verAplic'] = retDistDFeInt.verAplic || ''
    retorno['cStat'] = retDistDFeInt.cStat || ''
    retorno['xMotivo'] = retDistDFeInt.xMotivo || ''
    retorno['dhResp'] = retDistDFeInt.dhResp || ''
    retorno['ultNSU'] = retDistDFeInt.ultNSU || ''
    retorno['maxNSU'] = retDistDFeInt.maxNSU || ''

    retorno['docZip'] = docZip

    return retorno
  }
}

module.exports = Object.freeze(DistribuicaoHelper)
