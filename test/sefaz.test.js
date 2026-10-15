'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const { DistribuicaoNFSe } = require('../src')
const SefazService = require('../src/services/sefaz-service')
const { CA_PADRAO, DISTRIBUICAO, RECEPCAO } = require('../src/env')

const certificado = {
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

/**
 * CNPJ do e-CNPJ, tirado do CN (`RAZAO SOCIAL:CNPJ`) para não ficar no repositório.
 *
 * @returns {string}
 */
function cnpjDoCertificado() {
  const { subject } = new crypto.X509Certificate(certificado.cert)
  const encontrado = /^CN=.*:([0-9]{14})$/m.exec(subject)

  if (!encontrado) {
    throw new Error('certs/cert.pem não é um e-CNPJ ICP-Brasil.')
  }

  return encontrado[1]
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

// Só leitura: o ADN não tem bloqueio de sequência, e o teste nunca grava
// ponteiro de NSU de ninguém.
describe('DistribuicaoNFSe', function () {
  this.timeout(30000)

  function instanciar(tpAmb) {
    return new DistribuicaoNFSe({
      cert: certificado.cert,
      key: certificado.key,
      cnpj: cnpjDoCertificado(),
      tpAmb: tpAmb,
    })
  }

  it('consultaUltNSU("0") em produção restrita: fila vazia, 404 sem error', async function () {
    const retorno = await instanciar('2').consultaUltNSU('0')

    assert.strictEqual(retorno.status, 404, retorno.error)
    assert.strictEqual(retorno.error, undefined)
    assert.strictEqual(
      retorno.data.statusProcessamento,
      'NENHUM_DOCUMENTO_LOCALIZADO'
    )
    assert.strictEqual(retorno.data.tipoAmbiente, 'HOMOLOGACAO')
    assert.deepStrictEqual(retorno.data.documentos, [])
  })

  it('cnpj de outra raiz em produção restrita: error com E2243', async function () {
    const distribuicao = new DistribuicaoNFSe({
      cert: certificado.cert,
      key: certificado.key,
      cnpj: '11111111000191',
      tpAmb: '2',
    })

    const retorno = await distribuicao.consultaUltNSU('0')

    // O ADN responde 400 com StatusProcessamento DOCUMENTOS_LOCALIZADOS.
    assert.strictEqual(retorno.status, 400)
    assert.ok(retorno.error.startsWith('E2243: '), retorno.error)
    assert.strictEqual(retorno.data.erros[0].codigo, 'E2243')
  })

  it('consultaUltNSU("0") em produção: DOCUMENTOS_LOCALIZADOS', async function () {
    const retorno = await instanciar('1').consultaUltNSU('0')

    assert.strictEqual(retorno.status, 200, retorno.error)
    assert.strictEqual(retorno.error, undefined)
    assert.strictEqual(
      retorno.data.statusProcessamento,
      'DOCUMENTOS_LOCALIZADOS'
    )
    assert.strictEqual(retorno.data.tipoAmbiente, 'PRODUCAO')
    assert.deepStrictEqual(retorno.data.documentosErros, [])
    assert.ok(retorno.data.documentos.length > 0)
    assert.strictEqual(retorno.data.documentos[0].nsu, '1')
    assert.ok(
      retorno.data.documentos.every((d) =>
        ['tomador', 'prestador', 'intermediario', ''].includes(d.papel)
      )
    )
  })

  it('consultaNSU("1") em produção devolve exatamente o NSU 1', async function () {
    const retorno = await instanciar('1').consultaNSU('1')

    assert.strictEqual(retorno.status, 200, retorno.error)
    assert.deepStrictEqual(
      retorno.data.documentos.map((d) => d.nsu),
      ['1']
    )
  })
})
