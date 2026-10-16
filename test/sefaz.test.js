'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const {
  DistribuicaoCTe,
  DistribuicaoMDFe,
  DistribuicaoNFSe,
  ManifestacaoNFSe,
} = require('../src')
const SefazService = require('../src/services/sefaz-service')
const {
  CA_PADRAO,
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE,
  EVENTOS_NFSE,
  RECEPCAO,
} = require('../src/env')
const { ManifestacaoNFSeHelper } = require('../src/helpers')
const { Gzip } = require('../src/util')

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

    it('CTeDistribuicaoDFe tpAmb = "1"', async function () {
      const tpAmb = '1'
      const baseURL = DISTRIBUICAO_CTE[tpAmb]
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

    it('CTeDistribuicaoDFe tpAmb = "2"', async function () {
      const tpAmb = '2'
      const baseURL = DISTRIBUICAO_CTE[tpAmb]
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

    it('MDFeDistribuicaoDFe tpAmb = "1"', async function () {
      const tpAmb = '1'
      const baseURL = DISTRIBUICAO_MDFE[tpAmb]
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

    it('MDFeDistribuicaoDFe tpAmb = "2"', async function () {
      const tpAmb = '2'
      const baseURL = DISTRIBUICAO_MDFE[tpAmb]
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

// Só homologação. Em produção, consulta por NSU move o ponteiro que a SEFAZ
// guarda por CNPJ e dessincroniza quem já faz a distribuição desse CNPJ
// (cStat 656). Em homologação o cStat varia com o que há na base (137, 138,
// 493 se o NSU passar do maior, 656 se o teste repetir em menos de uma hora)
// e todos provam que o leiaute foi aceito. O que não pode é 215: schema.
function assertLeiauteAceito(retorno) {
  assert.strictEqual(retorno.status, 200)
  assert.strictEqual(retorno.error, undefined)
  assert.match(retorno.data.cStat, /^[0-9]{3}$/, retorno.resXml)
  assert.notStrictEqual(retorno.data.cStat, '215', retorno.data.xMotivo)
}

describe('DistribuicaoCTe', function () {
  this.timeout(30000)

  const distribuicao = () =>
    new DistribuicaoCTe({
      cert: certificado.cert,
      key: certificado.key,
      cnpj: cnpjDoCertificado(),
      cUFAutor: '35',
      tpAmb: '2',
    })

  it('consultaUltNSU("0") em homologação: leiaute aceito', async function () {
    const retorno = await distribuicao().consultaUltNSU('0')

    assertLeiauteAceito(retorno)
  })

  it('consultaNSU("1") em homologação: leiaute aceito', async function () {
    const retorno = await distribuicao().consultaNSU('1')

    assertLeiauteAceito(retorno)
  })
})

describe('DistribuicaoMDFe', function () {
  this.timeout(30000)

  const distribuicao = () =>
    new DistribuicaoMDFe({
      cert: certificado.cert,
      key: certificado.key,
      cnpj: cnpjDoCertificado(),
      tpAmb: '2',
    })

  it('consultaUltNSU("0") em homologação: leiaute aceito', async function () {
    const retorno = await distribuicao().consultaUltNSU('0')

    assertLeiauteAceito(retorno)
  })

  it('consultaNSU("1") em homologação: leiaute aceito', async function () {
    const retorno = await distribuicao().consultaNSU('1')

    assertLeiauteAceito(retorno)
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

  // A fila de produção restrita hoje está vazia, mas deixa de estar quando
  // alguém emitir lá uma NFS-e de teste (a GH-19 precisa de uma). O contrato
  // da fila vazia é coberto com resposta controlada nos testes do helper e
  // de transporte; aqui vale qualquer um dos dois estados de sucesso.
  it('consultaUltNSU("0") em produção restrita: sucesso sem error, com ou sem documentos', async function () {
    const retorno = await instanciar('2').consultaUltNSU('0')
    const { statusProcessamento, documentos } = retorno.data

    assert.strictEqual(retorno.error, undefined)
    assert.strictEqual(retorno.data.tipoAmbiente, 'HOMOLOGACAO')

    if (statusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO') {
      assert.strictEqual(retorno.status, 404)
      assert.deepStrictEqual(documentos, [])
    } else {
      assert.strictEqual(statusProcessamento, 'DOCUMENTOS_LOCALIZADOS')
      assert.strictEqual(retorno.status, 200)
      assert.ok(documentos.length > 0)
    }
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

// Só pedidos que a SEFIN rejeita: a chave é inventada, então nenhum evento
// pode ser registrado. Confirmação e Rejeição aceitas não entram na suíte —
// cada uma registra um evento fiscal, e a segunda execução seria duplicidade.
describe('ManifestacaoNFSe', function () {
  this.timeout(30000)

  const CHAVE_INEXISTENTE = '1'.repeat(50)

  function instanciar(tpAmb, cnpj = cnpjDoCertificado()) {
    return new ManifestacaoNFSe({
      cert: certificado.cert,
      key: certificado.key,
      cnpj: cnpj,
      tpAmb: tpAmb,
    })
  }

  function assertE1831(retorno, tipoAmbiente) {
    assert.strictEqual(retorno.status, 400, retorno.error)
    assert.ok(retorno.error.startsWith('E1831: '), retorno.error)
    assert.strictEqual(retorno.data.erros[0].codigo, 'E1831')
    assert.strictEqual(retorno.data.tipoAmbiente, tipoAmbiente)
    assert.deepStrictEqual(retorno.data.evento, {})
    assert.ok(retorno.reqXml.includes('</infPedReg><Signature'))
  }

  // A SEFIN confere a assinatura antes da existência da nota (ver o teste
  // da assinatura adulterada): chegar ao E1831 prova que ela foi aceita.
  it('confirmar em produção, chave inexistente: E1831', async function () {
    assertE1831(await instanciar('1').confirmar(CHAVE_INEXISTENTE), '1')
  })

  it('rejeitar em produção, chave inexistente: E1831', async function () {
    const retorno = await instanciar('1').rejeitar(CHAVE_INEXISTENTE, {
      cMotivo: '9',
      xMotivo: 'Teste de integração do bitmde.',
    })

    assertE1831(retorno, '1')
  })

  it('confirmar em produção restrita, chave inexistente: E1831', async function () {
    assertE1831(await instanciar('2').confirmar(CHAVE_INEXISTENTE), '2')
  })

  it('Assinatura adulterada em produção: E0714, antes da existência da nota', async function () {
    const opts = {
      cert: certificado.cert,
      key: certificado.key,
      tpAmb: '1',
      cnpj: cnpjDoCertificado(),
      chNFSe: CHAVE_INEXISTENTE,
      evento: EVENTOS_NFSE[203202],
      verAplic: 'bitmde/teste',
      dhEvento: '2026-10-16T09:30:00-03:00',
    }

    const { reqXml, config } = await ManifestacaoNFSeHelper.montarRequest(opts)
    const adulterado = reqXml.replace('09:30:00', '09:31:00')
    const pedido = await Gzip.zip(adulterado)

    const retorno = await ManifestacaoNFSeHelper.enviarEvento(
      {
        ...config,
        data: JSON.stringify({ pedidoRegistroEventoXmlGZipB64: pedido }),
      },
      opts
    )

    assert.strictEqual(retorno.status, 400)
    assert.strictEqual(JSON.parse(retorno.data).erro[0].codigo, 'E0714')
  })
})
