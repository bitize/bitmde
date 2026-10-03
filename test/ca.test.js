'use strict'

const assert = require('assert')
const crypto = require('crypto')
const tls = require('tls')
const mde = require('../src')
const env = require('../src/env')

describe('Cadeia de certificados', function () {
  const { CA_ICP_BRASIL, CA_PADRAO } = mde

  it('CA_PADRAO e CA_ICP_BRASIL nas três formas de exportação', function () {
    for (const forma of [mde, mde.default, mde.mde]) {
      assert.strictEqual(forma.CA_PADRAO, CA_PADRAO)
      assert.strictEqual(forma.CA_ICP_BRASIL, CA_ICP_BRASIL)
    }
  })

  it('CA_PADRAO é o mesmo array que os helpers passam ao agente', function () {
    assert.strictEqual(env.CA_PADRAO, CA_PADRAO)
    assert.strictEqual(env.CA, CA_ICP_BRASIL)
  })

  it('Imutabilidade', function () {
    assert.throws(() => {
      CA_PADRAO.push('x')
    }, TypeError)

    assert.throws(() => {
      CA_ICP_BRASIL.push('x')
    }, TypeError)
  })

  it('CA_ICP_BRASIL traz a AC Raiz v10 e a AC SERPRO SSLv1', function () {
    assert.strictEqual(CA_ICP_BRASIL.length, 2)

    const nomes = CA_ICP_BRASIL.map((pem) => new crypto.X509Certificate(pem))
      .map((x509) => x509.subject)
      .join('\n')

    assert.ok(nomes.includes('Raiz Brasileira v10'))
    assert.ok(nomes.includes('SERPRO SSLv1'))
  })

  it('CA_PADRAO soma as raízes do Node à ICP-Brasil', function () {
    // A seleção efetiva do runtime: com --use-openssl-ca, por exemplo, ela
    // não contém necessariamente tls.rootCertificates.
    const raizes =
      typeof tls.getCACertificates === 'function'
        ? tls.getCACertificates('default')
        : tls.rootCertificates

    assert.deepStrictEqual(CA_PADRAO.slice(0, raizes.length), raizes)
    assert.deepStrictEqual(CA_PADRAO.slice(raizes.length), [...CA_ICP_BRASIL])
  })
})
