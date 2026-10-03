'use strict'

const assert = require('assert')
const fs = require('fs')
const SefazService = require('../src/services/sefaz-service')
const { CA_PADRAO, DISTRIBUICAO, RECEPCAO } = require('../src/env')

const certificado = {
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

describe('SefazService', function () {
  describe('#request()', function () {
    it('NFeDistribuicaoDFe sem informar cert.pem e key.pem', async function () {
      const tpAmb = '2'
      const baseURL = DISTRIBUICAO[tpAmb]
      const requestOptions = {}
      const httpsOptions = {}

      const client = new SefazService({
        baseURL: baseURL,
        ca: CA_PADRAO,
        requestOptions: requestOptions,
        httpsOptions: httpsOptions,
      })

      const config = { method: 'GET' }

      const retorno = await client.request(config)

      assert.equal(retorno.status, 403)
    })

    it('NFeDistribuicaoDFe tpAmb = "1"', async function () {
      const tpAmb = '1'
      const baseURL = DISTRIBUICAO[tpAmb]
      const requestOptions = {}
      const httpsOptions = {}

      const client = new SefazService({
        baseURL: baseURL,
        ca: CA_PADRAO,
        cert: certificado.cert,
        key: certificado.key,
        tpAmb: tpAmb,
        requestOptions: requestOptions,
        httpsOptions: httpsOptions,
      })

      const config = { method: 'GET' }

      const retorno = await client.request(config)

      assert.equal(retorno.status, 200)
    })

    it('NFeDistribuicaoDFe tpAmb = "2"', async function () {
      const tpAmb = '2'
      const baseURL = DISTRIBUICAO[tpAmb]
      const requestOptions = {}
      const httpsOptions = {}

      const client = new SefazService({
        baseURL: baseURL,
        ca: CA_PADRAO,
        cert: certificado.cert,
        key: certificado.key,
        tpAmb: tpAmb,
        requestOptions: requestOptions,
        httpsOptions: httpsOptions,
      })

      const config = { method: 'GET' }

      const retorno = await client.request(config)

      assert.equal(retorno.status, 200)
    })

    it('NFeRecepcaoEvento4 sem informar cert.pem e key.pem', async function () {
      const tpAmb = '2'
      const baseURL = RECEPCAO[tpAmb]
      const requestOptions = {}
      const httpsOptions = {}

      const client = new SefazService({
        baseURL: baseURL,
        ca: CA_PADRAO,
        requestOptions: requestOptions,
        httpsOptions: httpsOptions,
      })

      const config = { method: 'GET' }

      const retorno = await client.request(config)

      assert.equal(retorno.status, 403)
    })

    it('NFeRecepcaoEvento4 tpAmb = "1"', async function () {
      const tpAmb = '1'
      const baseURL = RECEPCAO[tpAmb]
      const requestOptions = {}
      const httpsOptions = {}

      const client = new SefazService({
        baseURL: baseURL,
        ca: CA_PADRAO,
        cert: certificado.cert,
        key: certificado.key,
        tpAmb: tpAmb,
        requestOptions: requestOptions,
        httpsOptions: httpsOptions,
      })

      const config = { method: 'GET' }

      const retorno = await client.request(config)

      assert.equal(retorno.status, 200)
    })

    it('NFeRecepcaoEvento4 tpAmb = "2"', async function () {
      const tpAmb = '2'
      const baseURL = RECEPCAO[tpAmb]
      const requestOptions = {}
      const httpsOptions = {}

      const client = new SefazService({
        baseURL: baseURL,
        ca: CA_PADRAO,
        cert: certificado.cert,
        key: certificado.key,
        tpAmb: tpAmb,
        requestOptions: requestOptions,
        httpsOptions: httpsOptions,
      })

      const config = { method: 'GET' }

      const retorno = await client.request(config)

      assert.equal(retorno.status, 200)
    })
  })
})
