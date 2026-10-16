'use strict'

const assert = require('assert')
const fs = require('fs')
const zlib = require('zlib')
const { SignedXml } = require('xml-crypto')
const { EVENTOS_NFSE } = require('../src/env')
const { ManifestacaoNFSeHelper, RetornoNfseHelper } = require('../src/helpers')
const { ManifestacaoNFSeSchema } = require('../src/schemas')
const { Gzip, Xml } = require('../src/util')

const certificado = {
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

// Tudo inventado: nenhum CNPJ, chave ou XML de produção.
const CNPJ = '11111111000191'
const CHAVE = '1'.repeat(50)
const DH_EVENTO = '2026-10-15T10:00:00-03:00'

// gzip de 'nao e xml <<': descompacta, mas não é XML
const ZIP_NAO_XML = 'H4sIAAAAAAAACstLzFdIVajIzVGwsQEA7021TQwAAAA='

const XML_CONFIRMACAO =
  '<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">' +
  `<infPedReg Id="PRE${CHAVE}203202">` +
  '<tpAmb>2</tpAmb><verAplic>bitmde/0.0.0</verAplic>' +
  `<dhEvento>${DH_EVENTO}</dhEvento><CNPJAutor>${CNPJ}</CNPJAutor>` +
  `<chNFSe>${CHAVE}</chNFSe>` +
  '<e203202><xDesc>Manifestação de NFS-e - Confirmação do Tomador</xDesc></e203202>' +
  '</infPedReg></pedRegEvento>'

const XML_EVENTO =
  '<evento versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">' +
  `<infEvento Id="EVT${CHAVE}203202001"><nSeqEvento>1</nSeqEvento></infEvento></evento>`

function opcoes(extra = {}) {
  return {
    tpAmb: '2',
    verAplic: 'bitmde/0.0.0',
    dhEvento: DH_EVENTO,
    cnpj: CNPJ,
    chNFSe: CHAVE,
    evento: EVENTOS_NFSE[203202],
    ...extra,
  }
}

function gzip(xml) {
  return zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64')
}

function corpoSucesso(extra = {}) {
  return JSON.stringify({
    tipoAmbiente: 2,
    versaoAplicativo: 'SefinNacional_1.0',
    dataHoraProcessamento: '2026-10-15T10:00:01-03:00',
    eventoXmlGZipB64: gzip(XML_EVENTO),
    ...extra,
  })
}

function corpoErro(erro) {
  return JSON.stringify({
    tipoAmbiente: 2,
    versaoAplicativo: 'SefinNacional_1.0',
    dataHoraProcessamento: '2026-10-15T10:00:01-03:00',
    erro: erro,
  })
}

describe('ManifestacaoNFSeSchema', function () {
  describe('#montarSchema()', function () {
    it('Confirmação: ordem do XSD, xDesc com acento e Id PRE+chave+código', function () {
      const xml = Xml.jsonToXml(ManifestacaoNFSeSchema.montarSchema(opcoes()))

      assert.strictEqual(xml, XML_CONFIRMACAO)
    })

    it('Rejeição com xMotivo', function () {
      const xml = Xml.jsonToXml(
        ManifestacaoNFSeSchema.montarSchema(
          opcoes({
            evento: EVENTOS_NFSE[203206],
            cMotivo: '9',
            xMotivo: 'Serviço não foi prestado & cobrado.',
          })
        )
      )

      assert.ok(xml.includes(`<infPedReg Id="PRE${CHAVE}203206">`))
      assert.ok(
        xml.includes(
          `<chNFSe>${CHAVE}</chNFSe><e203206><xDesc>Manifestação de NFS-e - Rejeição do Tomador</xDesc>` +
            '<cMotivo>9</cMotivo><xMotivo>Serviço não foi prestado &amp; cobrado.</xMotivo></e203206></infPedReg>'
        ),
        xml
      )
    })

    it('Rejeição sem xMotivo não gera o elemento', function () {
      const xml = Xml.jsonToXml(
        ManifestacaoNFSeSchema.montarSchema(
          opcoes({ evento: EVENTOS_NFSE[203206], cMotivo: '1' })
        )
      )

      assert.ok(
        xml.endsWith(
          '<e203206><xDesc>Manifestação de NFS-e - Rejeição do Tomador</xDesc>' +
            '<cMotivo>1</cMotivo></e203206></infPedReg></pedRegEvento>'
        ),
        xml
      )
    })

    it('Imutabilidade', function () {
      assert.throws(() => {
        ManifestacaoNFSeSchema.montarSchema = 'subscrever montarSchema'
      }, TypeError)
    })
  })
})

describe('ManifestacaoNFSeHelper', function () {
  describe('#montarRequest()', function () {
    it('reqXml assinado e POST JSON com o pedido gzipado em base64', async function () {
      const { reqXml, config } = await ManifestacaoNFSeHelper.montarRequest({
        ...opcoes(),
        cert: certificado.cert,
        key: certificado.key,
      })

      // Sem a declaração, a SEFIN rejeita com E1229.
      assert.ok(
        reqXml.startsWith(
          '<?xml version="1.0" encoding="UTF-8"?>' +
            XML_CONFIRMACAO.replace('</pedRegEvento>', '')
        )
      )
      assert.ok(
        reqXml.includes(
          '</infPedReg><Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'
        )
      )

      const sig = new SignedXml({ publicCert: certificado.cert })
      sig.loadSignature(reqXml.match(/<Signature [\s\S]*<\/Signature>/)[0])
      assert.strictEqual(sig.checkSignature(reqXml), true)

      assert.deepStrictEqual(Object.keys(config).sort(), [
        'data',
        'headers',
        'method',
        'responseType',
        'url',
      ])
      assert.strictEqual(config.method, 'POST')
      assert.strictEqual(config.url, `/nfse/${CHAVE}/eventos`)
      assert.deepStrictEqual(config.headers, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      })
      assert.strictEqual(config.responseType, 'text')

      const corpo = JSON.parse(config.data)
      assert.deepStrictEqual(Object.keys(corpo), [
        'pedidoRegistroEventoXmlGZipB64',
      ])
      assert.strictEqual(
        await Gzip.unzip(corpo.pedidoRegistroEventoXmlGZipB64),
        reqXml
      )
    })
  })

  describe('#montarResponse()', function () {
    it('201 com evento: tipoAmbiente string e evento aberto', async function () {
      const { json, falha } =
        await ManifestacaoNFSeHelper.montarResponse(corpoSucesso())

      assert.strictEqual(falha, undefined)
      assert.strictEqual(json.tipoAmbiente, '2')
      assert.strictEqual(json.versaoAplicativo, 'SefinNacional_1.0')
      assert.strictEqual(
        json.dataHoraProcessamento,
        '2026-10-15T10:00:01-03:00'
      )
      assert.deepStrictEqual(json.alertas, [])
      assert.deepStrictEqual(json.erros, [])
      assert.strictEqual(json.evento.xml, XML_EVENTO)
      assert.strictEqual(
        json.evento.json.evento.infEvento['@_Id'],
        `EVT${CHAVE}203202001`
      )
      assert.strictEqual(json.evento.json.evento.infEvento.nSeqEvento, '1')
    })

    it('eventoXmlGZipB64 vazio: evento vazio e falha', async function () {
      for (const vazio of ['', null]) {
        const { json, falha } = await ManifestacaoNFSeHelper.montarResponse(
          corpoSucesso({ eventoXmlGZipB64: vazio })
        )

        assert.deepStrictEqual(json.evento, {})
        assert.strictEqual(
          falha,
          'Falha ao abrir o evento retornado: eventoXmlGZipB64 sem conteúdo.'
        )
      }
    })

    it('eventoXmlGZipB64 que não abre: evento vazio e falha', async function () {
      for (const quebrado of ['bm90IGd6aXA=', ZIP_NAO_XML]) {
        const { json, falha } = await ManifestacaoNFSeHelper.montarResponse(
          corpoSucesso({ eventoXmlGZipB64: quebrado })
        )

        assert.deepStrictEqual(json.evento, {})
        assert.ok(
          falha.startsWith('Falha ao abrir o evento retornado: '),
          falha
        )
      }
    })

    it('erro em array, como a SEFIN responde de fato', async function () {
      const { json, falha } = await ManifestacaoNFSeHelper.montarResponse(
        corpoErro([
          {
            codigo: 'E1831',
            descricao: 'A NFS-e indicada não existe no ADN.',
          },
        ])
      )

      assert.strictEqual(falha, undefined)
      assert.deepStrictEqual(json.erros, [
        {
          codigo: 'E1831',
          descricao: 'A NFS-e indicada não existe no ADN.',
          complemento: '',
        },
      ])
      assert.deepStrictEqual(json.evento, {})
    })

    it('erro objeto único, como no Swagger, vira erros normalizado', async function () {
      const { json, falha } = await ManifestacaoNFSeHelper.montarResponse(
        corpoErro({ codigo: 'E1831', descricao: 'NFS-e não existe.' })
      )

      assert.strictEqual(falha, undefined)
      assert.deepStrictEqual(json, {
        tipoAmbiente: '2',
        versaoAplicativo: 'SefinNacional_1.0',
        dataHoraProcessamento: '2026-10-15T10:00:01-03:00',
        alertas: [],
        erros: [
          { codigo: 'E1831', descricao: 'NFS-e não existe.', complemento: '' },
        ],
        evento: {},
      })
    })

    it('erros, no plural, também são lidos', async function () {
      const { json } = await ManifestacaoNFSeHelper.montarResponse(
        JSON.stringify({
          tipoAmbiente: 1,
          erros: [
            { codigo: 'E1', descricao: 'Um.', complemento: 'c' },
            'não é objeto',
          ],
        })
      )

      assert.strictEqual(json.tipoAmbiente, '1')
      assert.deepStrictEqual(json.erros, [
        { codigo: 'E1', descricao: 'Um.', complemento: 'c' },
      ])
    })

    it('Corpo que não é resposta da SEFIN devolve json null, sem lançar', async function () {
      for (const corpo of [
        '',
        '<html>Bad Gateway</html>',
        'null',
        '[]',
        '"texto"',
        '{}',
        '{"tipoAmbiente": 2}',
        undefined,
      ]) {
        const resposta = await ManifestacaoNFSeHelper.montarResponse(corpo)

        assert.deepStrictEqual(resposta, { json: null }, String(corpo))
      }
    })

    it('Imutabilidade', function () {
      assert.throws(() => {
        ManifestacaoNFSeHelper.montarResponse = 'subscrever montarResponse'
      }, TypeError)
    })
  })
})

describe('RetornoNfseHelper com a SEFIN', function () {
  describe('#montarRetorno()', function () {
    const REQ_XML = '<pedRegEvento/>'

    const dados = (erros = []) => ({
      tipoAmbiente: '2',
      versaoAplicativo: 'SefinNacional_1.0',
      dataHoraProcessamento: '2026-10-15T10:00:01-03:00',
      alertas: [],
      erros: erros,
      evento: {},
    })

    it('201 com evento: sem error, com reqXml', function () {
      const json = { ...dados(), evento: { xml: '<evento/>', json: {} } }

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          retorno: { status: 201, data: 'corpo' },
          servico: 'SEFIN',
          reqXml: REQ_XML,
        }),
        { data: json, reqXml: REQ_XML, resBody: 'corpo', status: 201 }
      )
    })

    it('201 com evento que não abre: error da falha, data mantido', function () {
      const json = dados()
      const falha = 'Falha ao abrir o evento retornado: incorrect header check'

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          falha,
          retorno: { status: 201, data: 'corpo' },
          servico: 'SEFIN',
          reqXml: REQ_XML,
        }),
        {
          data: json,
          reqXml: REQ_XML,
          resBody: 'corpo',
          status: 201,
          error: falha,
        }
      )
    })

    it('400 com erro: error com o código, data mantido', function () {
      const json = dados([
        { codigo: 'E1831', descricao: 'NFS-e não existe.', complemento: '' },
      ])

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          retorno: { status: 400, data: 'corpo' },
          servico: 'SEFIN',
          reqXml: REQ_XML,
        }),
        {
          data: json,
          reqXml: REQ_XML,
          resBody: 'corpo',
          status: 400,
          error: 'E1831: NFS-e não existe.',
        }
      )
    })

    it('Os erros têm precedência sobre a falha do evento', function () {
      const retorno = RetornoNfseHelper.montarRetorno({
        json: dados([{ codigo: 'E1', descricao: 'Um.', complemento: '' }]),
        falha: 'Falha ao abrir o evento retornado: x',
        retorno: { status: 400, data: 'corpo' },
        servico: 'SEFIN',
      })

      assert.strictEqual(retorno.error, 'E1: Um.')
    })

    it('Corpo que não é JSON da SEFIN: resposta inesperada da SEFIN', function () {
      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json: null,
          retorno: { status: 502, data: '<html/>' },
          servico: 'SEFIN',
          reqXml: REQ_XML,
        }),
        {
          data: {},
          reqXml: REQ_XML,
          resBody: '<html/>',
          status: 502,
          error: 'Resposta inesperada da SEFIN (HTTP 502).',
        }
      )
    })

    it('HTTP fora de 2xx sem erros: resposta inesperada da SEFIN', function () {
      assert.strictEqual(
        RetornoNfseHelper.montarRetorno({
          json: dados(),
          retorno: { status: 401, data: 'corpo' },
          servico: 'SEFIN',
        }).error,
        'Resposta inesperada da SEFIN (HTTP 401).'
      )
    })

    it('Sem resposta HTTP: transportError, data vazio e reqXml mantido', function () {
      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json: null,
          retorno: {
            status: 0,
            data: '',
            transportError: { code: 'ETIMEDOUT', message: 'timeout' },
          },
          servico: 'SEFIN',
          reqXml: REQ_XML,
        }),
        {
          data: {},
          reqXml: REQ_XML,
          resBody: '',
          status: 0,
          error: 'Falha de transporte (ETIMEDOUT): timeout',
          transportError: { code: 'ETIMEDOUT', message: 'timeout' },
        }
      )
    })
  })
})
