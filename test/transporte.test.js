'use strict'

const assert = require('assert')
const crypto = require('crypto')
const https = require('https')
const net = require('net')
const forge = require('node-forge')
const zlib = require('zlib')
const { CA_PADRAO, DistribuicaoDFe, DistribuicaoNFSe } = require('../src')
const { VERSION } = require('../src/env')
const { RetornoHelper } = require('../src/helpers')
const SefazService = require('../src/services/sefaz-service')

const RESPOSTA_137 =
  '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDistDFeInteresseResult><retDistDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo><ultNSU>000000000000000</ultNSU><maxNSU>000000000000000</maxNSU></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>'

const RESPOSTA_502 = '<html><body>Bad Gateway</body></html>'

/**
 * Autoassinado para 127.0.0.1, gerado na hora: os testes não dependem de
 * certs/ nem do gerador descartável.
 */
function gerarCertificado() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  })

  const cert = forge.pki.createCertificate()
  const atributos = [{ name: 'commonName', value: '127.0.0.1' }]

  cert.publicKey = forge.pki.publicKeyFromPem(publicKey)
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(Date.now() - 60 * 1000)
  cert.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000)
  cert.setSubject(atributos)
  cert.setIssuer(atributos)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] },
  ])
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create())

  return { cert: forge.pki.certificateToPem(cert), key: privateKey }
}

function escutar(servidor) {
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      resolve(`https://127.0.0.1:${servidor.address().port}/`)
    })
  })
}

function fechar(servidor) {
  return new Promise((resolve) => {
    if (servidor.closeAllConnections) servidor.closeAllConnections()
    servidor.close(() => resolve())
  })
}

describe('Transporte', function () {
  this.timeout(10000)

  let certificado
  let servidor
  let url

  // Responde 200 com um retDistDFeInt, ou 502 quando o caminho pede.
  let statusDaResposta

  before(async function () {
    certificado = gerarCertificado()

    servidor = https.createServer(
      { cert: certificado.cert, key: certificado.key },
      (req, res) => {
        req.resume()
        req.on('end', () => {
          if (statusDaResposta === 502) {
            res.writeHead(502, { 'Content-Type': 'text/html' })
            res.end(RESPOSTA_502)
            return
          }

          res.writeHead(200, { 'Content-Type': 'application/soap+xml' })
          res.end(RESPOSTA_137)
        })
      }
    )

    url = await escutar(servidor)
  })

  beforeEach(function () {
    statusDaResposta = 200
  })

  after(async function () {
    await fechar(servidor)
  })

  function consultar(baseURL, options = {}) {
    const distribuicao = new DistribuicaoDFe({
      cert: certificado.cert,
      key: certificado.key,
      tpAmb: '2',
      cUFAutor: '41',
      cnpj: '12345678901234',
      options: {
        requestOptions: { baseURL, ...options.requestOptions },
        httpsOptions: options.httpsOptions,
      },
    })

    return distribuicao.consultaUltNSU('0')
  }

  it('Certificado do servidor fora da cadeia padrão vira transportError, com status 0', async function () {
    const retorno = await consultar(url)

    assert.strictEqual(retorno.status, 0)
    assert.strictEqual(retorno.resXml, '')
    assert.deepStrictEqual(retorno.data, {})
    assert.ok(
      ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(
        retorno.transportError.code
      ),
      retorno.transportError.code
    )
    assert.ok(retorno.error.startsWith('Falha de transporte ('))
    assert.strictEqual(
      retorno.error,
      `Falha de transporte (${retorno.transportError.code}): ${retorno.transportError.message}`
    )
    assert.ok(retorno.reqXml.includes('<distDFeInt'))
  })

  it('ca com CA_PADRAO e o certificado do servidor: a requisição passa', async function () {
    const retorno = await consultar(url, {
      httpsOptions: { ca: [...CA_PADRAO, certificado.cert] },
    })

    assert.strictEqual(retorno.status, 200)
    assert.strictEqual(retorno.error, undefined)
    assert.strictEqual(retorno.transportError, undefined)
    assert.strictEqual(retorno.data.cStat, '137')
  })

  it('rejectUnauthorized: false continua desligando a validação', async function () {
    const retorno = await consultar(url, {
      httpsOptions: { rejectUnauthorized: false },
    })

    assert.strictEqual(retorno.status, 200)
    assert.strictEqual(retorno.transportError, undefined)
    assert.strictEqual(retorno.data.cStat, '137')
  })

  it('502 real do servidor mantém status e corpo, sem transportError', async function () {
    statusDaResposta = 502

    const retorno = await consultar(url, {
      httpsOptions: { ca: [...CA_PADRAO, certificado.cert] },
    })

    assert.strictEqual(retorno.status, 502)
    assert.strictEqual(retorno.resXml, RESPOSTA_502)
    assert.strictEqual(retorno.error, RESPOSTA_502)
    assert.deepStrictEqual(retorno.data, {})
    assert.strictEqual(retorno.transportError, undefined)
  })

  it('Porta fechada: ECONNREFUSED', async function () {
    const livre = net.createServer()
    const urlLivre = await escutar(livre)
    await fechar(livre)

    const retorno = await consultar(urlLivre)

    assert.strictEqual(retorno.status, 0)
    assert.strictEqual(retorno.transportError.code, 'ECONNREFUSED')
    assert.ok(retorno.error.startsWith('Falha de transporte (ECONNREFUSED): '))
  })

  it('Servidor que não responde: ECONNABORTED', async function () {
    const sockets = new Set()
    const mudo = net.createServer((socket) => {
      sockets.add(socket)
    })
    const urlMudo = await escutar(mudo)

    try {
      const retorno = await consultar(urlMudo, {
        requestOptions: { timeout: 50 },
      })

      assert.strictEqual(retorno.status, 0)
      assert.strictEqual(retorno.transportError.code, 'ECONNABORTED')
    } finally {
      sockets.forEach((socket) => socket.destroy())
      await fechar(mudo)
    }
  })

  it('O retorno não carrega o agente nem a chave do certificado', async function () {
    const retorno = await consultar(url)
    const serializado = JSON.stringify(retorno)

    assert.ok(retorno.transportError)
    assert.deepStrictEqual(Object.keys(retorno.transportError).sort(), [
      'code',
      'message',
    ])
    assert.ok(!serializado.includes('PRIVATE KEY'))
    assert.ok(!serializado.includes('httpsAgent'))
  })
})

describe('Transporte NFS-e', function () {
  this.timeout(10000)

  const CNPJ = '11111111000191'
  const CHAVE = '1'.repeat(50)

  // Espaçamento e acento de propósito: resBody tem de ser o corpo byte a byte.
  const CORPO_LOTE =
    '{ "StatusProcessamento": "DOCUMENTOS_LOCALIZADOS",\n  "LoteDFe": [{"NSU": 1, "ChaveAcesso": "' +
    CHAVE +
    '", "TipoDocumento": "NFSE", "ArquivoXml": "' +
    zlib
      .gzipSync(
        `<NFSe><infNFSe><DPS><infDPS><toma><CNPJ>${CNPJ}</CNPJ></toma></infDPS></DPS></infNFSe></NFSe>`
      )
      .toString('base64') +
    '", "DataHoraGeracao": "2026-10-15T10:00:00"}],\n  "Alertas": [],"Erros": [], "TipoAmbiente": "HOMOLOGACAO", "VersaoAplicativo": "Versão 1" }'

  const CORPO_VAZIO = JSON.stringify({
    StatusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO',
    LoteDFe: [],
    Alertas: [],
    Erros: [{ Mensagem: {}, Codigo: 'E2220', Descricao: 'Nenhum documento.' }],
    TipoAmbiente: 'HOMOLOGACAO',
  })

  let certificado
  let servidor
  let url
  let ultimaRequisicao
  let resposta

  before(async function () {
    certificado = gerarCertificado()

    servidor = https.createServer(
      { cert: certificado.cert, key: certificado.key },
      (req, res) => {
        ultimaRequisicao = {
          method: req.method,
          url: req.url,
          headers: req.headers,
        }
        req.resume()
        req.on('end', () => {
          res.writeHead(resposta.status, { 'Content-Type': resposta.tipo })
          res.end(resposta.corpo)
        })
      }
    )

    url = await escutar(servidor)
  })

  beforeEach(function () {
    ultimaRequisicao = undefined
    resposta = {
      status: 200,
      tipo: 'application/json; charset=utf-8',
      corpo: CORPO_LOTE,
    }
  })

  after(async function () {
    await fechar(servidor)
  })

  function instanciar(httpsOptions = { ca: [...CA_PADRAO, certificado.cert] }) {
    return new DistribuicaoNFSe({
      cert: certificado.cert,
      key: certificado.key,
      tpAmb: '2',
      cnpj: CNPJ,
      options: { requestOptions: { baseURL: url }, httpsOptions },
    })
  }

  it('consultaUltNSU: GET com Accept JSON, User-Agent e params na query', async function () {
    const retorno = await instanciar().consultaUltNSU('00051')

    assert.strictEqual(ultimaRequisicao.method, 'GET')
    assert.strictEqual(
      ultimaRequisicao.url,
      `/DFe/51?lote=true&cnpjConsulta=${CNPJ}`
    )
    assert.strictEqual(ultimaRequisicao.headers.accept, 'application/json')
    assert.strictEqual(
      ultimaRequisicao.headers['user-agent'],
      `bitmde/${VERSION}`
    )

    assert.strictEqual(retorno.status, 200)
    assert.strictEqual(retorno.error, undefined)
    assert.strictEqual(retorno.transportError, undefined)
    assert.strictEqual(retorno.resBody, CORPO_LOTE)
    assert.strictEqual(retorno.data.versaoAplicativo, 'Versão 1')
    assert.strictEqual(retorno.data.documentos[0].nsu, '1')
    assert.strictEqual(retorno.data.documentos[0].papel, 'tomador')
  })

  it('consultaNSU pede o NSU anterior com lote=false', async function () {
    await instanciar().consultaNSU('51')

    assert.strictEqual(
      ultimaRequisicao.url,
      `/DFe/50?lote=false&cnpjConsulta=${CNPJ}`
    )
  })

  it('consultaChNFSe pede os eventos da chave', async function () {
    await instanciar().consultaChNFSe(CHAVE)

    assert.strictEqual(ultimaRequisicao.url, `/NFSe/${CHAVE}/Eventos`)
  })

  it('Fila vazia: 404 sem error', async function () {
    resposta = { status: 404, tipo: 'application/json', corpo: CORPO_VAZIO }

    const retorno = await instanciar().consultaUltNSU('0')

    assert.strictEqual(retorno.status, 404)
    assert.strictEqual(retorno.error, undefined)
    assert.strictEqual(retorno.resBody, CORPO_VAZIO)
    assert.deepStrictEqual(retorno.data.documentos, [])
    assert.strictEqual(retorno.data.erros[0].codigo, 'E2220')
  })

  it('502 com HTML: resposta inesperada, corpo em resBody', async function () {
    resposta = { status: 502, tipo: 'text/html', corpo: RESPOSTA_502 }

    const retorno = await instanciar().consultaUltNSU('0')

    assert.deepStrictEqual(retorno, {
      data: {},
      resBody: RESPOSTA_502,
      status: 502,
      error: 'Resposta inesperada do ADN (HTTP 502).',
    })
  })

  it('Certificado do servidor fora da cadeia: transportError sem a chave', async function () {
    const retorno = await instanciar({}).consultaUltNSU('0')
    const serializado = JSON.stringify(retorno)

    assert.strictEqual(retorno.status, 0)
    assert.strictEqual(retorno.resBody, '')
    assert.deepStrictEqual(retorno.data, {})
    assert.deepStrictEqual(Object.keys(retorno.transportError).sort(), [
      'code',
      'message',
    ])
    assert.strictEqual(
      retorno.error,
      `Falha de transporte (${retorno.transportError.code}): ${retorno.transportError.message}`
    )
    assert.ok(!serializado.includes('PRIVATE KEY'))
    assert.ok(!serializado.includes('httpsAgent'))
  })
})

describe('SefazService', function () {
  describe('#request()', function () {
    it('Erro sem code vira ERR_DESCONHECIDO', async function () {
      const client = new SefazService({ baseURL: 'https://127.0.0.1/' })
      client.instance = () => Promise.reject(new Error('quebrou'))

      const retorno = await client.request({ method: 'POST' })

      assert.deepStrictEqual(retorno, {
        status: 0,
        data: '',
        transportError: { code: 'ERR_DESCONHECIDO', message: 'quebrou' },
      })
    })

    it('Erro sem mensagem usa String(error)', async function () {
      const client = new SefazService({ baseURL: 'https://127.0.0.1/' })
      client.instance = () => Promise.reject('texto solto')

      const retorno = await client.request({ method: 'POST' })

      assert.deepStrictEqual(retorno.transportError, {
        code: 'ERR_DESCONHECIDO',
        message: 'texto solto',
      })
    })
  })
})

describe('RetornoHelper', function () {
  describe('#montarRetorno()', function () {
    it('transportError esvazia data e monta o error com o texto exato', function () {
      const retorno = RetornoHelper.montarRetorno({
        json: { cStat: '', docZip: [] },
        data: '<soap12:Envelope/>',
        retornoSefaz: {
          status: 0,
          data: '',
          transportError: {
            code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
            message: 'unable to get local issuer certificate',
          },
        },
      })

      assert.deepStrictEqual(retorno, {
        data: {},
        reqXml: '<soap12:Envelope/>',
        resXml: '',
        status: 0,
        error:
          'Falha de transporte (UNABLE_TO_GET_ISSUER_CERT_LOCALLY): unable to get local issuer certificate',
        transportError: {
          code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
          message: 'unable to get local issuer certificate',
        },
      })
    })

    it('Imutabilidade', function () {
      assert.throws(() => {
        RetornoHelper.montarRetorno = () => ({})
      }, TypeError)
    })
  })
})
