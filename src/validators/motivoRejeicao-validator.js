'use strict'

const MOTIVOS = ['1', '2', '3', '4', '5', '9']

class MotivoRejeicaoValidator {
  /**
   *
   * @param {Object} [motivo]
   * @param {'1' | '2' | '3' | '4' | '5' | '9'} motivo.cMotivo
   * @param {string} [motivo.xMotivo]
   */
  constructor(motivo) {
    const { cMotivo, xMotivo } = motivo || {}

    this.cMotivo = cMotivo
    this.xMotivo = xMotivo
    this.error = ''
  }

  isValid() {
    if (
      this.cMotivo === undefined ||
      this.cMotivo === null ||
      this.cMotivo === ''
    ) {
      this.error = 'Motivo da rejeição não informado.'
      return false
    }

    this.cMotivo = String(this.cMotivo)

    if (!MOTIVOS.includes(this.cMotivo)) {
      this.error =
        'Motivo da rejeição deve conter um dos valores: 1, 2, 3, 4, 5 ou 9'
      return false
    }

    // Vazio depois de aparado é o mesmo que não informado.
    const xMotivo =
      this.xMotivo === undefined || this.xMotivo === null
        ? ''
        : String(this.xMotivo).trim()

    this.xMotivo = xMotivo || undefined

    if (this.cMotivo === '9' && !this.xMotivo) {
      this.error = 'Descrição do motivo obrigatória para o motivo 9 (Outros).'
      return false
    }

    if (this.xMotivo && (xMotivo.length < 15 || xMotivo.length > 255)) {
      this.error = 'Descrição do motivo com tamanho incorreto.'
      return false
    }

    return true
  }

  getValues() {
    return { cMotivo: this.cMotivo, xMotivo: this.xMotivo }
  }

  getError() {
    return this.error
  }
}

module.exports = Object.freeze(MotivoRejeicaoValidator)
