'use strict'

const { DistribuicaoNFSeHelper, RetornoNfseHelper } = require('../helpers')

class DistribuicaoNFSeController {
  /**
   *
   * @param {Object} opts
   * @returns {Promise<{data:{statusProcessamento: string,tipoAmbiente: string,versaoAplicativo: string,dataHoraProcessamento: string, alertas: Array<{codigo: string,descricao: string,complemento: string}>, erros: Array<{codigo: string,descricao: string,complemento: string}>, documentos: Array<{nsu: string,chaveAcesso: string,tipoDocumento: string,tipoEvento: string,dataHoraGeracao: string,papel: '' | 'tomador' | 'prestador' | 'intermediario',xml: string,json: Object}>, documentosErros: Array<{nsu: string,chaveAcesso: string,tipoDocumento: string,error: string}>}, error?: string, transportError?: {code: string, message: string}, resBody: string, status: number}>}
   */
  static async enviar(opts) {
    const config = DistribuicaoNFSeHelper.montarRequest(opts)

    const retornoAdn = await DistribuicaoNFSeHelper.enviarConsulta(config, opts)

    const json = await DistribuicaoNFSeHelper.montarResponse(
      retornoAdn.data,
      opts.cnpj
    )

    const retorno = RetornoNfseHelper.montarRetorno({
      json: json,
      retorno: retornoAdn,
    })

    return retorno
  }
}

module.exports = Object.freeze(DistribuicaoNFSeController)
