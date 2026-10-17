'use strict'

const assert = require('assert')
const { Xml } = require('../src/util')

const {
  NFE_DIST_DFE_ENVELOPE,
  NFE_DIST_DFE_XML_BODY: XML_TESTE,
} = require('./fixtures/nfe-distribuicao-envelope')
const JSON_TESTE = {
  nfeDistDFeInteresse: {
    nfeDadosMsg: {
      distDFeInt: {
        tpAmb: '2',
        cUFAutor: '29',
        CNPJ: '99999999999999',
        distNSU: {
          ultNSU: '000000000000001',
        },
        '@_xmlns': 'http://www.portalfiscal.inf.br/nfe',
        '@_versao': '1.01',
      },
    },
    '@_xmlns': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
  },
}
const ENVELOPAR_TESTE = NFE_DIST_DFE_ENVELOPE

describe('Xml', function () {
  describe('#jsonToXml()', function () {
    it('Converter JSON para XML', function () {
      assert.equal(Xml.jsonToXml(JSON_TESTE), XML_TESTE)
    })

    it('Imutabilidade', function () {
      assert.throws(function () {
        Xml.jsonToXml = 'subscrever jsonToXml'
      })
    })
  })

  describe('#xmlToJson()', function () {
    it('Converter XML para JSON', function () {
      const json_retorno = Xml.xmlToJson(XML_TESTE)

      assert.equal(
        json_retorno.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.tpAmb,
        JSON_TESTE.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.tpAmb
      )
      assert.equal(
        json_retorno.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.cUFAutor,
        JSON_TESTE.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.cUFAutor
      )
      assert.equal(
        json_retorno.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.CNPJ,
        JSON_TESTE.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.CNPJ
      )
      assert.equal(
        json_retorno.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.distNSU.ultNSU,
        JSON_TESTE.nfeDistDFeInteresse.nfeDadosMsg.distDFeInt.distNSU.ultNSU
      )
    })

    it('Imutabilidade', function () {
      assert.throws(function () {
        Xml.xmlToJson = 'subscrever xmlToJson'
      })
    })
  })

  describe('#envelopar()', function () {
    it('Envelopar XML', function () {
      assert.equal(Xml.envelopar(XML_TESTE), ENVELOPAR_TESTE)
    })

    it('Imutabilidade', function () {
      assert.throws(function () {
        Xml.envelopar = 'subscrever envelopar'
      })
    })
  })
})
