'use strict'

// 12 posições alfanuméricas e 2 dígitos verificadores: aceita o CNPJ
// alfanumérico da IN RFB nº 2.229/2024. O DV fica a cargo do serviço.
const FORMATO_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/

class CnpjValidator {
  /**
   *
   * @param {Object} config
   * @param {string} config.cnpj
   */
  constructor(config) {
    const { cnpj } = config

    this.cnpj = cnpj
    this.error = ''
  }

  isValid() {
    if (!this.cnpj) {
      this.error = 'CNPJ não informado.'
      return false
    }

    this.cnpj = String(this.cnpj).toUpperCase()

    if (!FORMATO_CNPJ.test(this.cnpj)) {
      this.error = 'CNPJ com formato inválido.'
      return false
    }

    return true
  }

  getValues() {
    return { cnpj: this.cnpj }
  }

  getError() {
    return this.error
  }
}

module.exports = Object.freeze(CnpjValidator)
