'use strict'

const assert = require('assert')
const fs = require('fs')
const bitmde = require('../src')
const { ManifestacaoNFSe } = bitmde
const { ManifestacaoNFSeController } = require('../src/controllers')
const { EVENTOS_NFSE, NFSE_SEFIN } = require('../src/env')
const { ManifestacaoNFSeHelper, RetornoNfseHelper } = require('../src/helpers')
const { ManifestacaoNFSeSchema } = require('../src/schemas')
const { MotivoRejeicaoValidator } = require('../src/validators')

const certificado = {
  pfx: fs.readFileSync('certs/certificado.pfx'),
  passphrase: fs.readFileSync('certs/passphrase.txt', 'utf8'),
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

const CNPJ = '11111111000191'
const CHAVE = '1'.repeat(50)

function instanciar(extra = {}) {
  return new ManifestacaoNFSe({
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

describe('ManifestacaoNFSe', function () {
  it('Exportada nas três formas', function () {
    assert.strictEqual(typeof ManifestacaoNFSe, 'function')
    assert.strictEqual(bitmde.default.ManifestacaoNFSe, ManifestacaoNFSe)
    assert.strictEqual(bitmde.mde.ManifestacaoNFSe, ManifestacaoNFSe)
  })

  it('Endpoints da SEFIN por tpAmb', function () {
    assert.deepStrictEqual(NFSE_SEFIN, {
      1: 'https://sefin.nfse.gov.br/SefinNacional',
      2: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
    })
    assert.deepStrictEqual(Object.keys(EVENTOS_NFSE), ['203202', '203206'])
  })

  describe('#constructor()', function () {
    it('Cert não informado', function () {
      assert.throws(() => {
        new ManifestacaoNFSe({})
      }, /^Error: Cert não informado.$/)
    })

    it('Key não informada', function () {
      assert.throws(() => {
        new ManifestacaoNFSe({ cert: certificado.cert })
      }, /^Error: Key não informada.$/)
    })

    it('Senha do Certificado não informada', function () {
      assert.throws(() => {
        new ManifestacaoNFSe({ pfx: certificado.pfx })
      }, /^Error: Senha do Certificado não informada.$/)
    })

    it('Ambiente não informado', function () {
      assert.throws(() => {
        new ManifestacaoNFSe({ cert: certificado.cert, key: certificado.key })
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

    it('Timezone inválido', function () {
      assert.throws(() => {
        instanciar({ timezone: 'America/Teste' })
      }, /^Error: Timezone inválido.$/)
    })

    it('A ordem é Certificado → Ambiente → Cnpj → Zone', function () {
      assert.throws(() => {
        new ManifestacaoNFSe({ tpAmb: '0', cnpj: 'x', timezone: 'x' })
      }, /^Error: Cert não informado.$/)

      assert.throws(() => {
        instanciar({ tpAmb: '0', cnpj: 'x', timezone: 'x' })
      }, /^Error: Ambiente com valor inválido.$/)

      assert.throws(() => {
        instanciar({ cnpj: 'x', timezone: 'x' })
      }, /^Error: CNPJ com formato inválido.$/)
    })

    it('Objeto instanciado com PFX e timezone padrão', function () {
      const manifestacao = new ManifestacaoNFSe({
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '1',
        cnpj: CNPJ,
      })

      assert.strictEqual(manifestacao.config.cnpj, CNPJ)
      assert.strictEqual(manifestacao.config.tpAmb, '1')
      assert.strictEqual(manifestacao.config.timezone, 'America/Sao_Paulo')
      assert.strictEqual(manifestacao.config.cert, certificado.cert)
      assert.strictEqual(manifestacao.config.key, certificado.key)
      assert.ok(manifestacao.confirmar)
      assert.ok(manifestacao.rejeitar)
    })

    it('Timezone informado', function () {
      const manifestacao = instanciar({ timezone: 'America/Manaus' })

      assert.strictEqual(manifestacao.config.timezone, 'America/Manaus')
    })
  })

  describe('Imutabilidade', function () {
    it('Instância, config, requestOptions e httpsOptions congelados', function () {
      const manifestacao = instanciar({
        options: {
          requestOptions: { timeout: 1000 },
          httpsOptions: { rejectUnauthorized: true },
        },
      })

      assert.ok(Object.isFrozen(manifestacao))
      assert.ok(Object.isFrozen(manifestacao.config))
      assert.ok(Object.isFrozen(manifestacao.config.requestOptions))
      assert.ok(Object.isFrozen(manifestacao.config.httpsOptions))

      assert.throws(() => {
        manifestacao.config.cnpj = '22222222000191'
      }, TypeError)
    })

    it('Módulos novos congelados', function () {
      for (const [modulo, metodo] of [
        [ManifestacaoNFSeController, 'enviar'],
        [ManifestacaoNFSeHelper, 'montarRequest'],
        [ManifestacaoNFSeSchema, 'montarSchema'],
        [MotivoRejeicaoValidator, 'isValid'],
        [RetornoNfseHelper, 'montarRetorno'],
      ]) {
        assert.throws(() => {
          modulo[metodo] = 'subscrever'
        }, TypeError)
      }
    })
  })

  describe('#confirmar()', function () {
    it('Chave da NFS-e não informada', async function () {
      await assertRejeita(
        () => instanciar().confirmar(),
        'Chave da NFS-e não informada.'
      )
    })

    it('Chave da NFS-e com tamanho incorreto', async function () {
      await assertRejeita(
        () => instanciar().confirmar('4'.repeat(44)),
        'Chave da NFS-e com tamanho incorreto.'
      )
    })
  })

  describe('#rejeitar()', function () {
    it('Chave da NFS-e não informada', async function () {
      await assertRejeita(
        () => instanciar().rejeitar(undefined, { cMotivo: '1' }),
        'Chave da NFS-e não informada.'
      )
    })

    it('Chave da NFS-e com tamanho incorreto', async function () {
      await assertRejeita(
        () => instanciar().rejeitar('4'.repeat(51), { cMotivo: '1' }),
        'Chave da NFS-e com tamanho incorreto.'
      )
    })

    it('Motivo da rejeição não informado', async function () {
      await assertRejeita(
        () => instanciar().rejeitar(CHAVE),
        'Motivo da rejeição não informado.'
      )
    })

    it('Motivo da rejeição deve conter um dos valores: 1, 2, 3, 4, 5 ou 9', async function () {
      await assertRejeita(
        () => instanciar().rejeitar(CHAVE, { cMotivo: '6' }),
        'Motivo da rejeição deve conter um dos valores: 1, 2, 3, 4, 5 ou 9'
      )
    })

    it('Descrição do motivo obrigatória para o motivo 9 (Outros).', async function () {
      await assertRejeita(
        () => instanciar().rejeitar(CHAVE, { cMotivo: '9' }),
        'Descrição do motivo obrigatória para o motivo 9 (Outros).'
      )
    })

    it('Descrição do motivo com tamanho incorreto.', async function () {
      await assertRejeita(
        () => instanciar().rejeitar(CHAVE, { cMotivo: '2', xMotivo: 'curto' }),
        'Descrição do motivo com tamanho incorreto.'
      )
    })
  })
})
