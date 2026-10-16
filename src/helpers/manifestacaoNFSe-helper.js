'use strict'

const { CA_PADRAO, NFSE_SEFIN } = require('../env')
const { ManifestacaoNFSeSchema } = require('../schemas')
const SefazService = require('../services/sefaz-service')
const { Assinatura, Gzip, Xml } = require('../util')

/**
 * @param {any} valor
 * @returns {string}
 */
function texto(valor) {
  return valor === undefined || valor === null ? '' : String(valor)
}

/**
 * A SEFIN devolve um objeto `erro` único; aceita também `erros` em array.
 *
 * @param {any} lista
 * @returns {{codigo: string, descricao: string, complemento: string}[]}
 */
function normalizarMensagens(lista) {
  const mensagens = Array.isArray(lista) ? lista : lista ? [lista] : []

  return mensagens
    .filter((mensagem) => mensagem && typeof mensagem === 'object')
    .map((mensagem) => ({
      codigo: texto(mensagem.codigo),
      descricao: texto(mensagem.descricao),
      complemento: texto(mensagem.complemento),
    }))
}

class ManifestacaoNFSeHelper {
  /**
   *
   * @param {Object} config
   * @param {Object} opts
   * @returns {Promise<{status: number, data: string, transportError?: {code: string, message: string}}>}
   */
  static async enviarEvento(config, opts) {
    const client = new SefazService({
      baseURL: NFSE_SEFIN[opts.tpAmb],
      ca: CA_PADRAO,
      cert: opts.cert,
      key: opts.key,
      tpAmb: opts.tpAmb,
      requestOptions: opts.requestOptions,
      httpsOptions: opts.httpsOptions,
    })

    const retorno = await client.request(config)

    return retorno
  }

  /**
   * Monta e assina o `pedRegEvento`, e a config do `POST` ao axios. Os
   * headers vão na requisição, e não na instância, para o axios mesclá-los
   * com o User-Agent.
   *
   * @param {Object} opts
   * @returns {Promise<{reqXml: string, config: {method: string, url: string, data: string, headers: Object, responseType: string}}>}
   */
  static async montarRequest(opts) {
    const schema = ManifestacaoNFSeSchema.montarSchema(opts)
    const xml = Xml.jsonToXml(schema)
    const assinado = Assinatura.assinarXml(
      opts.cert,
      opts.key,
      xml,
      'infPedReg'
    )

    // Sem a declaração, a SEFIN rejeita com E1229 (Xml não está utilizando
    // codificação UTF-8). Ela fica fora do infPedReg e não entra no digest.
    const reqXml = `<?xml version="1.0" encoding="UTF-8"?>${assinado}`

    const pedidoRegistroEventoXmlGZipB64 = await Gzip.zip(reqXml)

    return {
      reqXml: reqXml,
      config: {
        method: 'POST',
        url: `/nfse/${opts.chNFSe}/eventos`,
        data: JSON.stringify({ pedidoRegistroEventoXmlGZipB64 }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        responseType: 'text',
      },
    }
  }

  /**
   * Interpreta o corpo cru da SEFIN. Nunca lança: corpo que não é JSON, ou
   * JSON sem `eventoXmlGZipB64` nem `erro`, devolve `json: null`. Evento
   * retornado que não abre devolve `falha`, que o retorno transforma em
   * `error`.
   *
   * @param {string} corpo
   * @returns {Promise<{json: {tipoAmbiente: string, versaoAplicativo: string, dataHoraProcessamento: string, alertas: {codigo: string, descricao: string, complemento: string}[], erros: {codigo: string, descricao: string, complemento: string}[], evento: {xml?: string, json?: Object}} | null, falha?: string}>}
   */
  static async montarResponse(corpo) {
    let json
    try {
      json = JSON.parse(corpo)
    } catch (err) {
      return { json: null }
    }

    const reconhecido =
      json &&
      typeof json === 'object' &&
      !Array.isArray(json) &&
      ('eventoXmlGZipB64' in json || 'erro' in json || 'erros' in json)

    if (!reconhecido) {
      return { json: null }
    }

    const retorno = {
      tipoAmbiente: texto(json.tipoAmbiente),
      versaoAplicativo: texto(json.versaoAplicativo),
      dataHoraProcessamento: texto(json.dataHoraProcessamento),
      alertas: normalizarMensagens(json.alertas),
      erros: normalizarMensagens(json.erros || json.erro),
      evento: {},
    }

    if (!('eventoXmlGZipB64' in json)) {
      return { json: retorno }
    }

    const { evento, falha } = await ManifestacaoNFSeHelper.abrirEvento(
      json.eventoXmlGZipB64
    )

    retorno['evento'] = evento

    return falha ? { json: retorno, falha } : { json: retorno }
  }

  /**
   * Descompacta e interpreta o evento registrado, sem nunca rejeitar.
   *
   * @param {string} eventoXmlGZipB64
   * @returns {Promise<{evento: {xml?: string, json?: Object}, falha?: string}>}
   */
  static async abrirEvento(eventoXmlGZipB64) {
    const prefixo = 'Falha ao abrir o evento retornado: '

    if (!eventoXmlGZipB64) {
      return {
        evento: {},
        falha: `${prefixo}eventoXmlGZipB64 sem conteúdo.`,
      }
    }

    try {
      const xml = await Gzip.unzip(eventoXmlGZipB64)
      const json = Xml.xmlToJson(xml)

      return { evento: { xml, json } }
    } catch (err) {
      return { evento: {}, falha: `${prefixo}${err.message}` }
    }
  }
}

module.exports = Object.freeze(ManifestacaoNFSeHelper)
