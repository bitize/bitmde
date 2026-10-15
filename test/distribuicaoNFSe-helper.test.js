'use strict'

const assert = require('assert')
const zlib = require('zlib')
const { DistribuicaoNFSeHelper, RetornoNfseHelper } = require('../src/helpers')

// Tudo inventado: nenhum CNPJ, chave ou XML de produção.
const CNPJ = '11111111000191'
const OUTRO = '22222222000191'
const TERCEIRO = '33333333000191'
const CHAVE = '1'.repeat(50)

// base64 de 'not gzip': decodifica, mas não é gzip
const ZIP_CORROMPIDO = 'bm90IGd6aXA='
// gzip de 'nao e xml <<': descompacta, mas não é XML
const ZIP_NAO_XML = 'H4sIAAAAAAAACstLzFdIVajIzVGwsQEA7021TQwAAAA='

function gzip(xml) {
  return zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64')
}

/**
 * @param {{prest?: string, toma?: string, interm?: string}} partes
 * @returns {string}
 */
function xmlNfse(partes) {
  const parte = (tag) =>
    partes[tag] ? `<${tag}><CNPJ>${partes[tag]}</CNPJ></${tag}>` : ''

  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">' +
    `<infNFSe Id="NFS${CHAVE}"><nNFSe>1</nNFSe>` +
    `<DPS versao="1.01"><infDPS Id="DPS${CHAVE.slice(0, 42)}">` +
    parte('prest') +
    parte('toma') +
    parte('interm') +
    '</infDPS></DPS></infNFSe></NFSe>'
  )
}

const XML_EVENTO =
  '<evento versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">' +
  `<infEvento Id="EVT${CHAVE}203202001"><nSeqEvento>1</nSeqEvento></infEvento></evento>`

function item(nsu, tipoDocumento, arquivoXml, extra = {}) {
  return {
    NSU: nsu,
    ChaveAcesso: CHAVE,
    TipoDocumento: tipoDocumento,
    ArquivoXml: arquivoXml,
    DataHoraGeracao: '2026-10-15T10:00:00',
    ...extra,
  }
}

function corpo({
  status = 'DOCUMENTOS_LOCALIZADOS',
  lote = [],
  erros = [],
  alertas = [],
} = {}) {
  return JSON.stringify({
    StatusProcessamento: status,
    LoteDFe: lote,
    Alertas: alertas,
    Erros: erros,
    TipoAmbiente: 'HOMOLOGACAO',
    VersaoAplicativo: '1.0.0.0',
    DataHoraProcessamento: '2026-10-15T10:35:14-03:00',
  })
}

const E2220 = {
  Mensagem: {},
  Codigo: 'E2220',
  Descricao: 'Nenhum documento localizado.',
}
const E2243 = {
  Mensagem: {},
  Codigo: 'E2243',
  Descricao: 'O CNPJ informado na consulta deve ter o mesmo CNPJ Base.',
}

describe('DistribuicaoNFSeHelper', function () {
  describe('#montarRequest()', function () {
    const headers = { Accept: 'application/json' }

    it('consultaUltNSU: lote a partir do NSU, com cnpjConsulta', function () {
      assert.deepStrictEqual(
        DistribuicaoNFSeHelper.montarRequest({ cnpj: CNPJ, ultNSU: '51' }),
        {
          method: 'GET',
          url: '/DFe/51',
          params: { lote: true, cnpjConsulta: CNPJ },
          headers,
          responseType: 'text',
        }
      )
    })

    it('consultaNSU: pede o NSU anterior, porque o ADN devolve o seguinte', function () {
      assert.deepStrictEqual(
        DistribuicaoNFSeHelper.montarRequest({ cnpj: CNPJ, nsu: '51' }),
        {
          method: 'GET',
          url: '/DFe/50',
          params: { lote: false, cnpjConsulta: CNPJ },
          headers,
          responseType: 'text',
        }
      )

      assert.strictEqual(
        DistribuicaoNFSeHelper.montarRequest({ cnpj: CNPJ, nsu: '1' }).url,
        '/DFe/0'
      )
      assert.strictEqual(
        DistribuicaoNFSeHelper.montarRequest({
          cnpj: CNPJ,
          nsu: '999999999999999',
        }).url,
        '/DFe/999999999999998'
      )
    })

    it('consultaChNFSe: eventos da chave, sem parâmetros', function () {
      assert.deepStrictEqual(
        DistribuicaoNFSeHelper.montarRequest({ cnpj: CNPJ, chNFSe: CHAVE }),
        {
          method: 'GET',
          url: `/NFSe/${CHAVE}/Eventos`,
          headers,
          responseType: 'text',
        }
      )
    })
  })

  describe('#montarResponse()', function () {
    it('Lote com tomador, prestador, intermediário, terceiro e evento', async function () {
      const lote = [
        item(1, 'NFSE', gzip(xmlNfse({ prest: OUTRO, toma: CNPJ }))),
        item(2, 'NFSE', gzip(xmlNfse({ prest: CNPJ, toma: OUTRO }))),
        item(
          3,
          'NFSE',
          gzip(xmlNfse({ prest: OUTRO, toma: TERCEIRO, interm: CNPJ }))
        ),
        item(4, 'NFSE', gzip(xmlNfse({ prest: OUTRO, toma: TERCEIRO }))),
        item(5, 'EVENTO', gzip(XML_EVENTO), {
          TipoEvento: 'CONFIRMACAO_TOMADOR',
        }),
      ]

      const data = await DistribuicaoNFSeHelper.montarResponse(
        corpo({ lote }),
        CNPJ
      )

      assert.strictEqual(data.statusProcessamento, 'DOCUMENTOS_LOCALIZADOS')
      assert.strictEqual(data.tipoAmbiente, 'HOMOLOGACAO')
      assert.strictEqual(data.versaoAplicativo, '1.0.0.0')
      assert.strictEqual(
        data.dataHoraProcessamento,
        '2026-10-15T10:35:14-03:00'
      )
      assert.deepStrictEqual(data.erros, [])
      assert.deepStrictEqual(data.alertas, [])
      assert.deepStrictEqual(data.documentosErros, [])

      assert.deepStrictEqual(
        data.documentos.map((d) => [d.nsu, d.tipoDocumento, d.papel]),
        [
          ['1', 'NFSE', 'tomador'],
          ['2', 'NFSE', 'prestador'],
          ['3', 'NFSE', 'intermediario'],
          ['4', 'NFSE', ''],
          ['5', 'EVENTO', ''],
        ]
      )

      const [primeiro] = data.documentos
      assert.deepStrictEqual(Object.keys(primeiro), [
        'nsu',
        'chaveAcesso',
        'tipoDocumento',
        'tipoEvento',
        'dataHoraGeracao',
        'papel',
        'xml',
        'json',
      ])
      assert.strictEqual(primeiro.chaveAcesso, CHAVE)
      assert.strictEqual(primeiro.tipoEvento, '')
      assert.strictEqual(primeiro.dataHoraGeracao, '2026-10-15T10:00:00')
      assert.strictEqual(primeiro.xml, xmlNfse({ prest: OUTRO, toma: CNPJ }))
      assert.strictEqual(primeiro.json.NFSe.infNFSe.DPS.infDPS.toma.CNPJ, CNPJ)

      assert.strictEqual(data.documentos[4].tipoEvento, 'CONFIRMACAO_TOMADOR')
      assert.ok(data.documentos[4].json.evento)
    })

    it('Tomador tem precedência quando o CNPJ é duas partes da nota', async function () {
      const data = await DistribuicaoNFSeHelper.montarResponse(
        corpo({
          lote: [item(1, 'NFSE', gzip(xmlNfse({ prest: CNPJ, toma: CNPJ })))],
        }),
        CNPJ
      )

      assert.strictEqual(data.documentos[0].papel, 'tomador')
    })

    it('Falha de um ArquivoXml vai para documentosErros sem esvaziar o lote', async function () {
      const lote = [
        item(1, 'NFSE', gzip(xmlNfse({ toma: CNPJ }))),
        item(2, 'NFSE', ''),
        item(3, 'NFSE', ZIP_CORROMPIDO),
        item(4, 'EVENTO', ZIP_NAO_XML, { TipoEvento: 'CANCELAMENTO' }),
      ]

      const data = await DistribuicaoNFSeHelper.montarResponse(
        corpo({ lote }),
        CNPJ
      )

      assert.strictEqual(data.statusProcessamento, 'DOCUMENTOS_LOCALIZADOS')
      assert.deepStrictEqual(
        data.documentos.map((d) => d.nsu),
        ['1']
      )
      assert.deepStrictEqual(data.documentosErros.slice(0, 2), [
        {
          nsu: '2',
          chaveAcesso: CHAVE,
          tipoDocumento: 'NFSE',
          error: 'ArquivoXml sem conteúdo.',
        },
        {
          nsu: '3',
          chaveAcesso: CHAVE,
          tipoDocumento: 'NFSE',
          error: 'Falha ao descompactar o ArquivoXml: incorrect header check',
        },
      ])
      assert.strictEqual(data.documentosErros[2].nsu, '4')
      assert.strictEqual(data.documentosErros[2].tipoDocumento, 'EVENTO')
      assert.ok(
        data.documentosErros[2].error.startsWith(
          'Falha ao interpretar o XML do ArquivoXml: '
        ),
        data.documentosErros[2].error
      )
    })

    it('Item que não é objeto vira documentosErros', async function () {
      const data = await DistribuicaoNFSeHelper.montarResponse(
        JSON.stringify({
          StatusProcessamento: 'DOCUMENTOS_LOCALIZADOS',
          LoteDFe: [null],
        }),
        CNPJ
      )

      assert.deepStrictEqual(data.documentos, [])
      assert.deepStrictEqual(data.documentosErros, [
        {
          nsu: '',
          chaveAcesso: '',
          tipoDocumento: '',
          error: 'ArquivoXml sem conteúdo.',
        },
      ])
    })

    it('Fila vazia: documentos vazios e erros normalizados', async function () {
      const data = await DistribuicaoNFSeHelper.montarResponse(
        corpo({ status: 'NENHUM_DOCUMENTO_LOCALIZADO', erros: [E2220] }),
        CNPJ
      )

      assert.deepStrictEqual(data, {
        statusProcessamento: 'NENHUM_DOCUMENTO_LOCALIZADO',
        tipoAmbiente: 'HOMOLOGACAO',
        versaoAplicativo: '1.0.0.0',
        dataHoraProcessamento: '2026-10-15T10:35:14-03:00',
        alertas: [],
        erros: [
          {
            codigo: 'E2220',
            descricao: 'Nenhum documento localizado.',
            complemento: '',
          },
        ],
        documentos: [],
        documentosErros: [],
      })
    })

    it('Campos ausentes viram string vazia e array vazio', async function () {
      const data = await DistribuicaoNFSeHelper.montarResponse(
        JSON.stringify({
          StatusProcessamento: 'REJEICAO',
          Alertas: [{ Codigo: 'A1', Complemento: 'detalhe' }, 'solto'],
        }),
        CNPJ
      )

      assert.deepStrictEqual(data, {
        statusProcessamento: 'REJEICAO',
        tipoAmbiente: '',
        versaoAplicativo: '',
        dataHoraProcessamento: '',
        alertas: [{ codigo: 'A1', descricao: '', complemento: 'detalhe' }],
        erros: [],
        documentos: [],
        documentosErros: [],
      })
    })

    it('Corpo que não é resposta do ADN devolve null, sem lançar', async function () {
      for (const entrada of [
        '',
        '<html><body>Bad Gateway</body></html>',
        'null',
        '[]',
        '"texto"',
        '{"type":"https://tools.ietf.org/html/rfc9110","status":400}',
        undefined,
      ]) {
        assert.strictEqual(
          await DistribuicaoNFSeHelper.montarResponse(entrada, CNPJ),
          null,
          String(entrada)
        )
      }
    })

    it('Imutabilidade', function () {
      assert.throws(function () {
        DistribuicaoNFSeHelper.abrirArquivoXml = 'subscrever abrirArquivoXml'
      })
    })
  })
})

describe('RetornoNfseHelper', function () {
  describe('#montarRetorno()', function () {
    const dados = (status, erros = []) => ({
      statusProcessamento: status,
      erros: erros,
      documentos: [],
    })

    it('DOCUMENTOS_LOCALIZADOS: sem error', function () {
      const json = dados('DOCUMENTOS_LOCALIZADOS')

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          retorno: { status: 200, data: '{"corpo":1}' },
        }),
        { data: json, resBody: '{"corpo":1}', status: 200 }
      )
    })

    it('Fila vazia é 404 sem error', function () {
      const json = dados('NENHUM_DOCUMENTO_LOCALIZADO', [
        { codigo: 'E2220', descricao: 'Nenhum documento.', complemento: '' },
      ])

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          retorno: { status: 404, data: 'corpo' },
        }),
        { data: json, resBody: 'corpo', status: 404 }
      )
    })

    it('REJEICAO: error com cada erro, data preservado', function () {
      const json = dados('REJEICAO', [
        { codigo: 'E1', descricao: 'Primeiro.', complemento: '' },
        { codigo: 'E2', descricao: 'Segundo.', complemento: 'x' },
      ])

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          retorno: { status: 400, data: 'corpo' },
        }),
        {
          data: json,
          resBody: 'corpo',
          status: 400,
          error: 'E1: Primeiro.; E2: Segundo.',
        }
      )
    })

    it('HTTP 400 com Erros vira error mesmo com DOCUMENTOS_LOCALIZADOS', function () {
      // É como o ADN responde ao cnpjConsulta de outra raiz (E2243).
      const json = dados('DOCUMENTOS_LOCALIZADOS', [
        { codigo: 'E2243', descricao: 'CNPJ de outra raiz.', complemento: '' },
      ])

      const retorno = RetornoNfseHelper.montarRetorno({
        json,
        retorno: { status: 400, data: 'corpo' },
      })

      assert.strictEqual(retorno.error, 'E2243: CNPJ de outra raiz.')
      assert.strictEqual(retorno.data, json)
    })

    it('Erros com HTTP 200 também viram error', function () {
      const json = dados('DOCUMENTOS_LOCALIZADOS', [
        { codigo: 'E9', descricao: 'Algo.', complemento: '' },
      ])

      const retorno = RetornoNfseHelper.montarRetorno({
        json,
        retorno: { status: 200, data: 'corpo' },
      })

      assert.strictEqual(retorno.error, 'E9: Algo.')
    })

    it('Falha sem Erros usa a mensagem de resposta inesperada, com data', function () {
      const json = dados('DOCUMENTOS_LOCALIZADOS')

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json,
          retorno: { status: 500, data: 'corpo' },
        }),
        {
          data: json,
          resBody: 'corpo',
          status: 500,
          error: 'Resposta inesperada do ADN (HTTP 500).',
        }
      )

      assert.strictEqual(
        RetornoNfseHelper.montarRetorno({
          json: dados('REJEICAO'),
          retorno: { status: 400, data: 'corpo' },
        }).error,
        'Resposta inesperada do ADN (HTTP 400).'
      )
    })

    it('Corpo que não é JSON do ADN: data vazio e resposta inesperada', function () {
      const html = '<html><body>Bad Gateway</body></html>'

      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json: null,
          retorno: { status: 502, data: html },
        }),
        {
          data: {},
          resBody: html,
          status: 502,
          error: 'Resposta inesperada do ADN (HTTP 502).',
        }
      )
    })

    it('Sem resposta HTTP: transportError com o texto exato', function () {
      assert.deepStrictEqual(
        RetornoNfseHelper.montarRetorno({
          json: null,
          retorno: {
            status: 0,
            data: '',
            transportError: {
              code: 'ECONNREFUSED',
              message: 'connect ECONNREFUSED 127.0.0.1:443',
            },
          },
        }),
        {
          data: {},
          resBody: '',
          status: 0,
          error:
            'Falha de transporte (ECONNREFUSED): connect ECONNREFUSED 127.0.0.1:443',
          transportError: {
            code: 'ECONNREFUSED',
            message: 'connect ECONNREFUSED 127.0.0.1:443',
          },
        }
      )
    })

    it('Imutabilidade', function () {
      assert.throws(() => {
        RetornoNfseHelper.montarRetorno = () => ({})
      }, TypeError)
    })
  })
})
