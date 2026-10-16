'use strict'

const assert = require('assert')
const fs = require('fs')
const { DistribuicaoMDFe } = require('../src')

const certificado = {
  pfx: fs.readFileSync('certs/certificado.pfx'),
  passphrase: fs.readFileSync('certs/passphrase.txt', 'utf8'),
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

describe('DistribuicaoMDFe', function () {
  describe('#constructor()', function () {
    it('Cert não informado', function () {
      const config = {}

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: Cert não informado.$/)
    })

    it('Key não informada', function () {
      const config = {
        cert: certificado.cert,
      }

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: Key não informada.$/)
    })

    it('Ambiente não informado (CERT, KEY)', function () {
      const config = {
        cert: certificado.cert,
        key: certificado.key,
      }

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: Ambiente não informado.$/)
    })

    it('Senha do Certificado não informada', function () {
      const config = {
        pfx: certificado.pfx,
      }

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: Senha do Certificado não informada.$/)
    })

    it('Ambiente não informado (PFX, PASSPHRASE)', function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
      }

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: Ambiente não informado.$/)
    })

    it('Ambiente com valor inválido', function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '0',
      }

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: Ambiente com valor inválido.$/)
    })

    it('CNPJ/CPF não informado', function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
      }

      assert.throws(() => {
        new DistribuicaoMDFe(config)
      }, /^Error: CNPJ\/CPF não informado.$/)
    })

    it('Objeto instanciado (CPF = "12345678901")', function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cpf: '12345678901',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      assert.equal(distribuicao.config.cpf, '12345678901')
    })

    it('Objeto instanciado', function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cnpj: '12345678901234',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      assert.ok(distribuicao.config)
      assert.strictEqual(distribuicao.consultaChMDFe, undefined)
      assert.ok(distribuicao.consultaNSU)
      assert.ok(distribuicao.consultaUltNSU)

      assert.throws(function () {
        distribuicao.config = {}
      })
      assert.throws(function () {
        distribuicao.consultaNSU = null
      })

      assert.equal(distribuicao.config.cnpj, '12345678901234')
      assert.equal(distribuicao.config.tpAmb, '2')
      assert.ok(!('cUFAutor' in distribuicao.config))
      assert.equal(distribuicao.config.cert, certificado.cert)
      assert.equal(distribuicao.config.key, certificado.key)
    })
  })

  describe('#cUFAutor', function () {
    it('Informado, é ignorado: o distDFeInt do MDF-e não tem o campo', function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cnpj: '12345678901234',
        cUFAutor: '99',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      assert.ok(!('cUFAutor' in distribuicao.config))
    })
  })

  describe('#consultaNSU()', function () {
    it('NSU não informado', async function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cnpj: '12345678901234',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      await assert.rejects(
        async () => {
          distribuicao.consultaNSU()
        },
        (err) => {
          assert.strictEqual(err.message, 'NSU não informado.')
          return true
        }
      )
    })

    it('NSU com tamanho incorreto', async function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cnpj: '12345678901234',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      await assert.rejects(
        async () => {
          distribuicao.consultaNSU('12345678901234567890')
        },
        (err) => {
          assert.strictEqual(err.message, 'NSU com tamanho incorreto.')
          return true
        }
      )
    })
  })

  describe('#consultaUltNSU()', function () {
    it('NSU não informado', async function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cnpj: '12345678901234',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      await assert.rejects(
        async () => {
          distribuicao.consultaUltNSU()
        },
        (err) => {
          assert.strictEqual(err.message, 'NSU não informado.')
          return true
        }
      )
    })

    it('NSU com tamanho incorreto', async function () {
      const config = {
        pfx: certificado.pfx,
        passphrase: certificado.passphrase,
        tpAmb: '2',
        cnpj: '12345678901234',
      }

      const distribuicao = new DistribuicaoMDFe(config)

      await assert.rejects(
        async () => {
          distribuicao.consultaUltNSU('12345678901234567890')
        },
        (err) => {
          assert.strictEqual(err.message, 'NSU com tamanho incorreto.')
          return true
        }
      )
    })
  })
})
