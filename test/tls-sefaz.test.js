'use strict'

// Handshake real contra o Ambiente Nacional da NF-e e o ADN e a SEFIN da NFS-e, sem
// certificado A1: só valida a cadeia do servidor. Exige rede, por isso fica fora do test:ci e roda no
// workflow agendado .github/workflows/cadeia-tls.yml.

const assert = require('assert')
const tls = require('tls')
const { CA_ICP_BRASIL, CA_PADRAO } = require('../src')
const { DISTRIBUICAO, NFSE_ADN, NFSE_SEFIN, RECEPCAO } = require('../src/env')

const HOSTS = [
  ...new Set(
    [
      ...Object.values(DISTRIBUICAO),
      ...Object.values(RECEPCAO),
      ...Object.values(NFSE_ADN),
      ...Object.values(NFSE_SEFIN),
    ].map((url) => new URL(url).hostname)
  ),
]

function handshake(host, ca) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, ca, rejectUnauthorized: true },
      () => {
        const certificado = socket.getPeerCertificate()
        socket.end()
        resolve(certificado)
      }
    )

    socket.setTimeout(15000, () => {
      const erro = new Error(`Sem resposta de ${host}`)
      erro.code = 'ETIMEDOUT'
      socket.destroy(erro)
    })
    socket.on('error', reject)
  })
}

describe('Cadeia TLS do Ambiente Nacional, do ADN e da SEFIN', function () {
  this.timeout(30000)

  it('Os endpoints usam www1, hom1 e os dois hosts do ADN e da SEFIN', function () {
    assert.deepStrictEqual(HOSTS.sort(), [
      'adn.nfse.gov.br',
      'adn.producaorestrita.nfse.gov.br',
      'hom1.nfe.fazenda.gov.br',
      'sefin.nfse.gov.br',
      'sefin.producaorestrita.nfse.gov.br',
      'www1.nfe.fazenda.gov.br',
    ])
  })

  for (const host of HOSTS) {
    it(`${host} fecha com CA_PADRAO`, async function () {
      const certificado = await handshake(host, CA_PADRAO)

      assert.ok(certificado.subject)
    })

    // Se isto passar a fechar, o host voltou a uma cadeia ICP-Brasil (o AN
    // e a SEFIN servem GlobalSign; o ADN, Let's Encrypt): falhar alto para alguém rever
    // a Decisão 1 do ADR 0014.
    it(`${host} não fecha só com CA_ICP_BRASIL`, async function () {
      await assert.rejects(handshake(host, CA_ICP_BRASIL), (erro) => {
        assert.strictEqual(erro.code, 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY')
        return true
      })
    })
  }
})
