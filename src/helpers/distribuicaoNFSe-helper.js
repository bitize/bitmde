'use strict'

const { CA_PADRAO, NFSE_ADN } = require('../env')
const SefazService = require('../services/sefaz-service')
const { Gzip, Xml } = require('../util')

// Ordem de precedência do papel: tomador primeiro resolve o CNPJ que é duas
// partes da mesma nota a favor do uso principal, separar as recebidas.
const PAPEIS = [
  ['toma', 'tomador'],
  ['prest', 'prestador'],
  ['interm', 'intermediario'],
]

/**
 * Lê um caminho de objetos sem lançar quando um nível não existe ou não é
 * objeto (o parser devolve string para elemento vazio).
 *
 * @param {any} objeto
 * @param {string[]} caminho
 * @returns {any}
 */
function ler(objeto, caminho) {
  return caminho.reduce(
    (atual, chave) =>
      atual && typeof atual === 'object' ? atual[chave] : undefined,
    objeto
  )
}

/**
 * @param {any} valor
 * @returns {string}
 */
function texto(valor) {
  return valor === undefined || valor === null ? '' : String(valor)
}

/**
 * @param {any} lista
 * @returns {{codigo: string, descricao: string, complemento: string}[]}
 */
function normalizarMensagens(lista) {
  if (!Array.isArray(lista)) {
    return []
  }

  return lista
    .filter((mensagem) => mensagem && typeof mensagem === 'object')
    .map((mensagem) => ({
      codigo: texto(mensagem.Codigo),
      descricao: texto(mensagem.Descricao),
      complemento: texto(mensagem.Complemento),
    }))
}

class DistribuicaoNFSeHelper {
  /**
   *
   * @param {Object} config
   * @param {Object} opts
   * @returns {Promise<{status: number, data: string, transportError?: {code: string, message: string}}>}
   */
  static async enviarConsulta(config, opts) {
    const client = new SefazService({
      baseURL: NFSE_ADN[opts.tpAmb],
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
   * Config da requisição ao axios. Os headers vão na requisição, e não na
   * instância, para o axios mesclá-los com o User-Agent.
   *
   * @param {Object} opts
   * @returns {{method: string, url: string, params?: {lote: boolean, cnpjConsulta: string}, headers: Object, responseType: string}}
   */
  static montarRequest(opts) {
    const headers = { Accept: 'application/json' }

    if (opts.chNFSe !== undefined) {
      return {
        method: 'GET',
        url: `/NFSe/${opts.chNFSe}/Eventos`,
        headers: headers,
        responseType: 'text',
      }
    }

    // Com lote=false o ADN devolve o documento seguinte ao NSU do caminho,
    // como no lote: pedir o anterior traz exatamente o NSU solicitado.
    const consultaUnica = opts.nsu !== undefined
    const nsu = consultaUnica
      ? (BigInt(opts.nsu) - BigInt(1)).toString()
      : opts.ultNSU

    return {
      method: 'GET',
      url: `/DFe/${nsu}`,
      params: { lote: !consultaUnica, cnpjConsulta: opts.cnpj },
      headers: headers,
      responseType: 'text',
    }
  }

  /**
   * Interpreta o corpo cru do ADN. Nunca lança: corpo que não é JSON, ou
   * JSON sem `StatusProcessamento`, devolve `null`.
   *
   * @param {string} corpo
   * @param {string} cnpj CNPJ consultado, para o `papel` de cada NFS-e
   * @returns {Promise<{statusProcessamento: string, tipoAmbiente: string, versaoAplicativo: string, dataHoraProcessamento: string, alertas: {codigo: string, descricao: string, complemento: string}[], erros: {codigo: string, descricao: string, complemento: string}[], documentos: {nsu: string, chaveAcesso: string, tipoDocumento: string, tipoEvento: string, dataHoraGeracao: string, papel: string, xml: string, json: Object}[], documentosErros: {nsu: string, chaveAcesso: string, tipoDocumento: string, error: string}[]} | null>}
   */
  static async montarResponse(corpo, cnpj) {
    let json
    try {
      json = JSON.parse(corpo)
    } catch (err) {
      return null
    }

    if (
      !json ||
      typeof json !== 'object' ||
      Array.isArray(json) ||
      !json.StatusProcessamento
    ) {
      return null
    }

    const lote = Array.isArray(json.LoteDFe) ? json.LoteDFe : []

    const resultados = await Promise.all(
      lote.map((item) => DistribuicaoNFSeHelper.abrirArquivoXml(item, cnpj))
    )

    const documentos = []
    const documentosErros = []

    for (const resultado of resultados) {
      if (resultado.error) {
        documentosErros.push(resultado)
      } else {
        documentos.push(resultado)
      }
    }

    return {
      statusProcessamento: texto(json.StatusProcessamento),
      tipoAmbiente: texto(json.TipoAmbiente),
      versaoAplicativo: texto(json.VersaoAplicativo),
      dataHoraProcessamento: texto(json.DataHoraProcessamento),
      alertas: normalizarMensagens(json.Alertas),
      erros: normalizarMensagens(json.Erros),
      documentos: documentos,
      documentosErros: documentosErros,
    }
  }

  /**
   * Descompacta e interpreta um item do `LoteDFe` sem nunca rejeitar: a
   * falha vira um item com `error`, para não derrubar o restante do lote.
   *
   * @param {Object} item
   * @param {string} cnpj
   * @returns {Promise<{nsu: string, chaveAcesso: string, tipoDocumento: string, tipoEvento: string, dataHoraGeracao: string, papel: string, xml: string, json: Object} | {nsu: string, chaveAcesso: string, tipoDocumento: string, error: string}>}
   */
  static async abrirArquivoXml(item, cnpj) {
    const doc = item && typeof item === 'object' ? item : {}

    const nsu = texto(doc.NSU)
    const chaveAcesso = texto(doc.ChaveAcesso)
    const tipoDocumento = texto(doc.TipoDocumento)

    if (!doc.ArquivoXml) {
      return {
        nsu,
        chaveAcesso,
        tipoDocumento,
        error: 'ArquivoXml sem conteúdo.',
      }
    }

    let xml
    try {
      xml = await Gzip.unzip(doc.ArquivoXml)
    } catch (err) {
      return {
        nsu,
        chaveAcesso,
        tipoDocumento,
        error: `Falha ao descompactar o ArquivoXml: ${err.message}`,
      }
    }

    let json
    try {
      json = Xml.xmlToJson(xml)
    } catch (err) {
      return {
        nsu,
        chaveAcesso,
        tipoDocumento,
        error: `Falha ao interpretar o XML do ArquivoXml: ${err.message}`,
      }
    }

    return {
      nsu,
      chaveAcesso,
      tipoDocumento,
      tipoEvento: texto(doc.TipoEvento),
      dataHoraGeracao: texto(doc.DataHoraGeracao),
      papel: DistribuicaoNFSeHelper.calcularPapel(tipoDocumento, json, cnpj),
      xml,
      json,
    }
  }

  /**
   * Papel do CNPJ consultado na NFS-e. Evento não traz as partes da nota.
   *
   * @param {string} tipoDocumento
   * @param {Object} json
   * @param {string} cnpj
   * @returns {'' | 'tomador' | 'prestador' | 'intermediario'}
   */
  static calcularPapel(tipoDocumento, json, cnpj) {
    if (tipoDocumento !== 'NFSE') {
      return ''
    }

    const infDPS = ler(json, ['NFSe', 'infNFSe', 'DPS', 'infDPS'])

    for (const [tag, papel] of PAPEIS) {
      if (ler(infDPS, [tag, 'CNPJ']) === cnpj) {
        return papel
      }
    }

    return ''
  }
}

module.exports = Object.freeze(DistribuicaoNFSeHelper)
