'use strict'

class RetornoNfseHelper {
  /**
   * Formato de retorno das APIs da NFS-e. `status`, `error` e
   * `transportError` têm o mesmo significado das APIs de NF-e; o corpo cru
   * vai em `resBody`.
   *
   * @param {Object} options
   * @param {Object | null} options.json `null` quando o corpo não é uma resposta do ADN
   * @param {Object} options.retorno
   * @param {string} options.retorno.data
   * @param {number} options.retorno.status
   * @param {{code: string, message: string}} [options.retorno.transportError]
   * @returns {{data: Object, resBody: string, status: number, error?: string, transportError?: {code: string, message: string}}}
   */
  static montarRetorno(options) {
    const { json, retorno } = options
    const { status } = retorno

    const resultado = {
      data: json || {},
      resBody: retorno.data || '',
      status: status,
    }

    // Sem resposta HTTP, status é 0 e nenhuma condição abaixo se aplica.
    if (retorno.transportError) {
      const { code, message } = retorno.transportError

      resultado['data'] = {}
      resultado['error'] = `Falha de transporte (${code}): ${message}`
      resultado['transportError'] = { code, message }

      return resultado
    }

    if (!json) {
      resultado['error'] = `Resposta inesperada do ADN (HTTP ${status}).`

      return resultado
    }

    // Fila vazia (404, E2220) e chave ou NSU sem documento não são falha.
    if (json.statusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO') {
      return resultado
    }

    // O ADN também rejeita com StatusProcessamento DOCUMENTOS_LOCALIZADOS
    // (E2243, HTTP 400): o status HTTP e os Erros decidem, não só o campo.
    const erros = Array.isArray(json.erros) ? json.erros : []
    const falhou =
      Math.floor(status / 100) !== 2 ||
      json.statusProcessamento === 'REJEICAO' ||
      erros.length > 0

    if (falhou) {
      resultado['error'] = erros.length
        ? erros.map((erro) => `${erro.codigo}: ${erro.descricao}`).join('; ')
        : `Resposta inesperada do ADN (HTTP ${status}).`
    }

    return resultado
  }
}

module.exports = Object.freeze(RetornoNfseHelper)
