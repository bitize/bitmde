'use strict'

const { ManifestacaoNFSeHelper, RetornoNfseHelper } = require('../helpers')

class ManifestacaoNFSeController {
  /**
   *
   * @param {Object} opts
   * @returns {Promise<{data:{tipoAmbiente: string,versaoAplicativo: string,dataHoraProcessamento: string, alertas: Array<{codigo: string,descricao: string,complemento: string}>, erros: Array<{codigo: string,descricao: string,complemento: string}>, evento: {xml?: string, json?: Object}}, error?: string, transportError?: {code: string, message: string}, reqXml: string, resBody: string, status: number}>}
   */
  static async enviar(opts) {
    const { reqXml, config } = await ManifestacaoNFSeHelper.montarRequest(opts)

    const retornoSefin = await ManifestacaoNFSeHelper.enviarEvento(config, opts)

    const { json, falha } = await ManifestacaoNFSeHelper.montarResponse(
      retornoSefin.data
    )

    const retorno = RetornoNfseHelper.montarRetorno({
      json: json,
      falha: falha,
      retorno: retornoSefin,
      servico: 'SEFIN',
      reqXml: reqXml,
    })

    return retorno
  }
}

module.exports = Object.freeze(ManifestacaoNFSeController)
