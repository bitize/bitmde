'use strict'

class ChaveNfseValidator {
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
      this.error = 'Chave da NFS-e não informada.'
      return false
    }

    this.chave = String(this.chave)

    // Só dígitos, também porque a chave vai no caminho da URL.
    if (!/^[0-9]{50}$/.test(this.chave)) {
      this.error = 'Chave da NFS-e com tamanho incorreto.'
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

module.exports = Object.freeze(ChaveNfseValidator)
