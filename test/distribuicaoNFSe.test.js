'use strict'

const assert = require('assert')
const fs = require('fs')
const bitmde = require('../src')
const { DistribuicaoNFSe } = bitmde
const { DistribuicaoNFSeController } = require('../src/controllers')

const certificado = {
  pfx: fs.readFileSync('certs/certificado.pfx'),
  passphrase: fs.readFileSync('certs/passphrase.txt', 'utf8'),
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

const CNPJ = '11111111000191'

function instanciar(extra = {}) {
  return new DistribuicaoNFSe({
    cert: certificado.cert,
    key: certificado.key,
    tpAmb: '2',
    cnpj: CNPJ,
    ...extra,
  })
}

async function assertRejeita(chamada, mensagem) {
  await assert.rejects(
    async () => {
      chamada()
    },
    (err) => {
      assert.strictEqual(err.message, mensagem)
      return true
    }
  )
}

describe('DistribuicaoNFSe', function () {
  it('Exportada nas três formas', function () {
    assert.strictEqual(bitmde.default.DistribuicaoNFSe, DistribuicaoNFSe)
    assert.strictEqual(bitmde.mde.DistribuicaoNFSe, DistribuicaoNFSe)
  })

  describe('#constructor()', function () {
    it('Cert não informado', function () {
      assert.throws(() => {
        new DistribuicaoNFSe({})
      }, /^Error: Cert não informado.$/)
    })

    it('Key não informada', function () {
      assert.throws(() => {
        new DistribuicaoNFSe({ cert: certificado.cert })
      }, /^Error: Key não informada.$/)
    })

    it('Ambiente não informado', function () {
      assert.throws(() => {
        new DistribuicaoNFSe({ cert: certificado.cert, key: certificado.key })
      }, /^Error: Ambiente não informado.$/)
    })

    it('Ambiente com valor inválido', function () {
      assert.throws(() => {
        instanciar({ tpAmb: 2 })
      }, /^Error: Ambiente com valor inválido.$/)
    })

    it('CNPJ não informado', function () {
      assert.throws(() => {
        instanciar({ cnpj: undefined })
      }, /^Error: CNPJ não informado.$/)
    })

    it('CNPJ com formato inválido', function () {
      assert.throws(() => {
        instanciar({ cnpj: '11.111.111/0001-91' })
      }, /^Error: CNPJ com formato inválido.$/)
    })

    it('A ordem é Certificado → Ambiente → Cnpj', function () {
      assert.throws(() => {
        new DistribuicaoNFSe({ tpAmb: '0', cnpj: 'x' })
      }, /^Error: Cert não informado.$/)

      assert.throws(() => {
        instanciar({ tpAmb: '0', cnpj: 'x' })
      }, /^Error: Ambiente com valor inválido.$/)
    })

    it('Objeto instanciado com PFX', function () {
      const distribuicao = new DistribuicaoNFSe({
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '1',
        cnpj: '11abc111000191',
      })

      assert.strictEqual(distribuicao.config.cnpj, '11ABC111000191')
      assert.strictEqual(distribuicao.config.tpAmb, '1')
      assert.strictEqual(distribuicao.config.cert, certificado.cert)
      assert.strictEqual(distribuicao.config.key, certificado.key)
      assert.ok(distribuicao.consultaUltNSU)
      assert.ok(distribuicao.consultaNSU)
      assert.ok(distribuicao.consultaChNFSe)
    })
  })

  describe('Imutabilidade', function () {
    it('Instância, config, requestOptions e httpsOptions congelados', function () {
      const distribuicao = instanciar({
        options: {
          requestOptions: { timeout: 1000 },
          httpsOptions: { rejectUnauthorized: true },
        },
      })

      assert.ok(Object.isFrozen(distribuicao))
      assert.ok(Object.isFrozen(distribuicao.config))
      assert.ok(Object.isFrozen(distribuicao.config.requestOptions))
      assert.ok(Object.isFrozen(distribuicao.config.httpsOptions))

      assert.throws(() => {
        distribuicao.config = {}
      }, TypeError)
      assert.throws(() => {
        distribuicao.config.cnpj = '22222222000191'
      }, TypeError)
      assert.throws(() => {
        distribuicao.config.requestOptions.timeout = 1
      }, TypeError)
    })

    it('Controller congelado', function () {
      assert.throws(() => {
        DistribuicaoNFSeController.enviar = 'subscrever enviar'
      }, TypeError)
    })
  })

  describe('#consultaUltNSU()', function () {
    it('NSU não informado', async function () {
      await assertRejeita(
        () => instanciar().consultaUltNSU(),
        'NSU não informado.'
      )
    })

    it('NSU com tamanho incorreto', async function () {
      await assertRejeita(
        () => instanciar().consultaUltNSU('1234567890123456'),
        'NSU com tamanho incorreto.'
      )
    })

    it('NSU deve conter apenas números', async function () {
      await assertRejeita(
        () => instanciar().consultaUltNSU('-1'),
        'NSU deve conter apenas números.'
      )
    })
  })

  describe('#consultaNSU()', function () {
    it('NSU não informado', async function () {
      await assertRejeita(
        () => instanciar().consultaNSU(),
        'NSU não informado.'
      )
    })

    it('NSU deve ser maior que zero', async function () {
      await assertRejeita(
        () => instanciar().consultaNSU('0'),
        'NSU deve ser maior que zero.'
      )
    })

    it('NSU deve conter apenas números', async function () {
      await assertRejeita(
        () => instanciar().consultaNSU('1a'),
        'NSU deve conter apenas números.'
      )
    })
  })

  describe('#consultaChNFSe()', function () {
    it('Chave da NFS-e não informada', async function () {
      await assertRejeita(
        () => instanciar().consultaChNFSe(),
        'Chave da NFS-e não informada.'
      )
    })

    it('Chave da NFS-e com tamanho incorreto', async function () {
      await assertRejeita(
        () => instanciar().consultaChNFSe('4'.repeat(44)),
        'Chave da NFS-e com tamanho incorreto.'
      )
    })
  })
})
