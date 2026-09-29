'use strict'

class ChaveCteValidator {
  /**
   *
   * @param {string} chave
   */
  constructor(chave) {
    this.chave = chave
    this.error = ''
  }

  isValid() {
    if (!this.chave) {
      this.error = 'Chave do CT-e não informada.'
      return false
    }

    this.chave = String(this.chave)

    if (this.chave.length !== 44) {
      this.error = 'Chave do CT-e com tamanho incorreto.'
      return false
    }

    return true
  }

  getValues() {
    return this.chave
  }

  getError() {
    return this.error
  }
}

module.exports = Object.freeze(ChaveCteValidator)
