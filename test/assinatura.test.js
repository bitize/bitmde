'use strict'

const assert = require('assert')
const fs = require('fs')
const { SignedXml } = require('xml-crypto')
const { RecepcaoHelper } = require('../src/helpers')
const { Assinatura } = require('../src/util')

const certificado = {
  cert: fs.readFileSync('certs/cert.pem', 'utf8'),
  key: fs.readFileSync('certs/key.pem', 'utf8'),
}

const BASE = {
  idLote: '1',
  nSeqEvento: '1',
  cOrgao: '91',
  tpAmb: '2',
  cnpj: '12345678000190',
  dhEvento: '2026-10-15T10:00:00-03:00',
}

const EVENTOS = [
  {
    ...BASE,
    tpEvento: 210200,
    descEvento: 'Confirmacao da Operacao',
    chNFe: '4'.repeat(44),
    infEventoId: `ID210200${'4'.repeat(44)}01`,
  },
  {
    ...BASE,
    tpEvento: 210240,
    descEvento: 'Operacao nao Realizada',
    xJust: 'Justificativa de teste',
    chNFe: '5'.repeat(44),
    infEventoId: `ID210240${'5'.repeat(44)}01`,
  },
]

// Lote da recepção da NF-e gerado antes da GH-19, com o que depende da chave
// mascarado: vale com o A1 real e com o certificado descartável da CI. O
// DigestValue não depende da chave e continua conferido byte a byte.
const LOTE_NFE =
  '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote><evento versao="1.00"><infEvento Id="ID2102004444444444444444444444444444444444444444444401"><cOrgao>91</cOrgao><tpAmb>2</tpAmb><CNPJ>12345678000190</CNPJ><chNFe>44444444444444444444444444444444444444444444</chNFe><dhEvento>2026-10-15T10:00:00-03:00</dhEvento><tpEvento>210200</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Confirmacao da Operacao</descEvento></detEvento></infEvento><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#ID2102004444444444444444444444444444444444444444444401"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>HCg4CrB/htjggBG2dVCpSwEUAo4=</DigestValue></Reference></SignedInfo><SignatureValue>…</SignatureValue><KeyInfo><X509Data><X509Certificate>…</X509Certificate></X509Data></KeyInfo></Signature></evento><evento versao="1.00"><infEvento Id="ID2102405555555555555555555555555555555555555555555501"><cOrgao>91</cOrgao><tpAmb>2</tpAmb><CNPJ>12345678000190</CNPJ><chNFe>55555555555555555555555555555555555555555555</chNFe><dhEvento>2026-10-15T10:00:00-03:00</dhEvento><tpEvento>210240</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Operacao nao Realizada</descEvento><xJust>Justificativa de teste</xJust></detEvento></infEvento><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#ID2102405555555555555555555555555555555555555555555501"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>533bLEgIbhsmZg7K8Y76Pm5sy0c=</DigestValue></Reference></SignedInfo><SignatureValue>…</SignatureValue><KeyInfo><X509Data><X509Certificate>…</X509Certificate></X509Data></KeyInfo></Signature></evento></envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>'

const PED_REG_EVENTO =
  '<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">' +
  `<infPedReg Id="PRE${'1'.repeat(50)}203202"><tpAmb>2</tpAmb></infPedReg>` +
  '</pedRegEvento>'

/**
 * @param {string} xml
 * @returns {string}
 */
function mascarar(xml) {
  return xml
    .replace(
      /<SignatureValue>[^<]*<\/SignatureValue>/g,
      '<SignatureValue>…</SignatureValue>'
    )
    .replace(
      /<X509Certificate>[^<]*<\/X509Certificate>/g,
      '<X509Certificate>…</X509Certificate>'
    )
}

/**
 * Confere cada Signature do documento contra o certificado.
 *
 * @param {string} xml
 * @returns {number} quantas assinaturas foram conferidas
 */
function verificarAssinaturas(xml) {
  const assinaturas = xml.match(/<Signature [\s\S]*?<\/Signature>/g) || []

  for (const assinatura of assinaturas) {
    const sig = new SignedXml({ publicCert: certificado.cert })
    sig.loadSignature(assinatura)

    assert.strictEqual(sig.checkSignature(xml), true)
  }

  return assinaturas.length
}

describe('Assinatura', function () {
  describe('#assinarXml()', function () {
    it('Lote da NF-e byte a byte igual ao de antes da GH-19', function () {
      const xml = RecepcaoHelper.montarRequest({
        cert: certificado.cert,
        key: certificado.key,
        idLote: '1',
        eventos: EVENTOS,
      })

      assert.strictEqual(mascarar(xml), LOTE_NFE)

      // Cada evento foi assinado num envEvento próprio, fora do envelope
      // SOAP: a C14N inclusiva levaria os xmlns do envelope para o digest.
      const eventos = xml.match(/<evento versao="1.00">[\s\S]*?<\/evento>/g)

      assert.strictEqual(eventos.length, 2)
      for (const evento of eventos) {
        const isolado = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${evento}</envEvento>`

        assert.strictEqual(verificarAssinaturas(isolado), 1)
      }
    })

    it('infPedReg: assinatura válida, irmã seguinte do infPedReg', function () {
      const xml = Assinatura.assinarXml(
        certificado.cert,
        certificado.key,
        PED_REG_EVENTO,
        'infPedReg'
      )

      assert.ok(
        xml.includes(
          '</infPedReg><Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'
        )
      )
      assert.ok(xml.endsWith('</Signature></pedRegEvento>'))
      assert.ok(xml.includes(`<Reference URI="#PRE${'1'.repeat(50)}203202">`))
      assert.ok(
        xml.includes(
          '<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>'
        )
      )
      assert.strictEqual(verificarAssinaturas(xml), 1)
    })

    it('Imutabilidade', function () {
      assert.throws(() => {
        Assinatura.assinarXml = 'subscrever assinarXml'
      }, TypeError)
    })
  })
})
