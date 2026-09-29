'use strict'

class DistribuicaoSchema {
  static montarSchema(options) {
    const documento = options.documento
    const distDFeInt = {
      tpAmb: options.tpAmb,
      cUFAutor: options.cUFAutor,
    }

    if (options.cnpj) {
      distDFeInt['CNPJ'] = options.cnpj
    } else {
      distDFeInt['CPF'] = options.cpf
    }

    const { bloco, campo } = documento.consChave

    if (options.ultNSU) {
      distDFeInt['distNSU'] = {
        ['ultNSU']: options.ultNSU,
      }
    } else if (options[campo]) {
      distDFeInt[bloco] = {
        [campo]: options[campo],
      }
    } else {
      distDFeInt['consNSU'] = {
        ['NSU']: options.nsu,
      }
    }

    distDFeInt['@_xmlns'] = documento.xmlns
    distDFeInt['@_versao'] = documento.versao

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
