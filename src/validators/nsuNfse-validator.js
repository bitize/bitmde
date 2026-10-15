'use strict'

class NsuNfseValidator {
  /**
   * No ADN o NSU é inteiro: sem o zero-pad do leiaute da NF-e.
   *
   * @param {string | number} nsu
   * @param {Object} [opcoes]
   * @param {boolean} [opcoes.positivo] Recusa o NSU `0`.
   */
  constructor(nsu, opcoes = {}) {
    this.nsu = nsu
    this.positivo = Boolean(opcoes.positivo)
    this.error = ''
  }

  isValid() {
    if (this.nsu === undefined || this.nsu === null || this.nsu === '') {
      this.error = 'NSU não informado.'
      return false
    }

    this.nsu = String(this.nsu)

    if (!/^[0-9]+$/.test(this.nsu)) {
      this.error = 'NSU deve conter apenas números.'
      return false
    }

    if (this.nsu.length > 15) {
      this.error = 'NSU com tamanho incorreto.'
      return false
    }

    this.nsu = this.nsu.replace(/^0+(?=[0-9])/, '')

    if (this.positivo && this.nsu === '0') {
      this.error = 'NSU deve ser maior que zero.'
      return false
    }

    return true
  }

  getValues() {
    return this.nsu
  }

  getError() {
    return this.error
  }
}

module.exports = Object.freeze(NsuNfseValidator)
