'use strict'

// Handshake real contra o Ambiente Nacional da NF-e e do CT-e, a SVRS do MDF-e e o ADN e
// a SEFIN da NFS-e, sem certificado A1: só valida a cadeia do servidor. Exige rede, por isso fica fora do test:ci e roda no
// workflow agendado .github/workflows/cadeia-tls.yml.

const assert = require('assert')
const tls = require('tls')
const { CA_ICP_BRASIL, CA_PADRAO } = require('../src')
const {
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE,
  NFSE_ADN,
  NFSE_SEFIN,
  RECEPCAO,
} = require('../src/env')

function hosts(...mapas) {
  return [
    ...new Set(
      mapas
        .flatMap((mapa) => Object.values(mapa))
        .map((url) => new URL(url).hostname)
    ),
  ]
}

// Cadeia fora da ICP-Brasil: GlobalSign no AN (NF-e e CT-e) e na SEFIN,
// Let's Encrypt no ADN.
const HOSTS = hosts(
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  RECEPCAO,
  NFSE_ADN,
  NFSE_SEFIN
)

// Cadeia ICP-Brasil (AC SERPRO, Raiz v10): é por estes que CA_PADRAO
// soma a ICP-Brasil às raízes do Node.
const HOSTS_ICP_BRASIL = hosts(DISTRIBUICAO_MDFE)

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

describe('Cadeia TLS do Ambiente Nacional, da SVRS, do ADN e da SEFIN', function () {
  this.timeout(30000)

  it('Os endpoints usam www1, hom1 e os dois hosts do ADN e da SEFIN', function () {
    assert.deepStrictEqual(HOSTS.sort(), [
      'adn.nfse.gov.br',
      'adn.producaorestrita.nfse.gov.br',
      'hom1.cte.fazenda.gov.br',
      'hom1.nfe.fazenda.gov.br',
      'sefin.nfse.gov.br',
      'sefin.producaorestrita.nfse.gov.br',
      'www1.cte.fazenda.gov.br',
      'www1.nfe.fazenda.gov.br',
    ])
  })

  it('O MDF-e usa os dois hosts da SVRS', function () {
    assert.deepStrictEqual(HOSTS_ICP_BRASIL.sort(), [
      'mdfe-homologacao.svrs.rs.gov.br',
      'mdfe.svrs.rs.gov.br',
    ])
  })

  // Se isto parar de fechar, a SVRS saiu da ICP-Brasil: conferir se ainda
  // fecha com CA_PADRAO (teste abaixo) e rever o comentário de HOSTS_ICP_BRASIL.
  for (const host of HOSTS_ICP_BRASIL) {
    it(`${host} fecha com CA_PADRAO`, async function () {
      const certificado = await handshake(host, CA_PADRAO)

      assert.ok(certificado.subject)
    })

    it(`${host} fecha só com CA_ICP_BRASIL`, async function () {
      const certificado = await handshake(host, CA_ICP_BRASIL)

      assert.ok(certificado.subject)
    })
  }

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
