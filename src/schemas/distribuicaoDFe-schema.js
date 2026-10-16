'use strict'

class DistribuicaoSchema {
  static montarSchema(options) {
    const documento = options.documento
    const distDFeInt = {
      tpAmb: options.tpAmb,
    }

    if (documento.cUFAutor) {
      distDFeInt['cUFAutor'] = options.cUFAutor
    }

    if (options.cnpj) {
      distDFeInt['CNPJ'] = options.cnpj
    } else {
      distDFeInt['CPF'] = options.cpf
    }

    const consChave = documento.consChave

    if (options.ultNSU) {
      distDFeInt['distNSU'] = {
        ['ultNSU']: options.ultNSU,
      }
    } else if (consChave && options[consChave.campo]) {
      distDFeInt[consChave.bloco] = {
        [consChave.campo]: options[consChave.campo],
      }
    } else {
      distDFeInt['consNSU'] = {
        ['NSU']: options.nsu,
      }
    }

    distDFeInt['@_xmlns'] = documento.xmlns
    distDFeInt['@_versao'] = documento.versao

    // Sem `operacao`, o WSDL é "bare": o dadosMsg vai direto no Body e leva
    // ele mesmo o namespace do WSDL.
    if (!documento.operacao) {
      return {
        [documento.dadosMsg]: {
          distDFeInt: distDFeInt,
          '@_xmlns': documento.xmlnsWsdl,
        },
      }
    }

    return {
      [documento.operacao]: {
        [documento.dadosMsg]: {
          distDFeInt: distDFeInt,
        },
        '@_xmlns': documento.xmlnsWsdl,
      },
    }
  }
}

module.exports = Object.freeze(DistribuicaoSchema)
