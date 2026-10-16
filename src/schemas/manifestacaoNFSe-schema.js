'use strict'

class ManifestacaoNFSeSchema {
  /**
   * `pedRegEvento` v1.01 de um evento do tomador. A ordem das chaves é a do
   * `TCInfPedReg` do XSD.
   *
   * @param {Object} options
   * @param {string} options.tpAmb
   * @param {string} options.verAplic
   * @param {string} options.dhEvento
   * @param {string} options.cnpj
   * @param {string} options.chNFSe
   * @param {{codigo: string, elemento: string, xDesc: string}} options.evento
   * @param {string} [options.cMotivo]
   * @param {string} [options.xMotivo]
   * @returns {Object}
   */
  static montarSchema(options) {
    const grupo = { xDesc: options.evento.xDesc }

    if (options.cMotivo) {
      grupo['cMotivo'] = options.cMotivo
    }

    if (options.xMotivo) {
      grupo['xMotivo'] = options.xMotivo
    }

    const infPedReg = {}

    infPedReg['tpAmb'] = options.tpAmb
    infPedReg['verAplic'] = options.verAplic
    infPedReg['dhEvento'] = options.dhEvento
    infPedReg['CNPJAutor'] = options.cnpj
    infPedReg['chNFSe'] = options.chNFSe
    infPedReg[options.evento.elemento] = grupo
    infPedReg['@_Id'] = `PRE${options.chNFSe}${options.evento.codigo}`

    return {
      pedRegEvento: {
        infPedReg: infPedReg,
        '@_xmlns': 'http://www.sped.fazenda.gov.br/nfse',
        '@_versao': '1.01',
      },
    }
  }
}

module.exports = Object.freeze(ManifestacaoNFSeSchema)
