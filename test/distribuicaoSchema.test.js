'use strict'

const assert = require('assert')
const { DOCUMENTOS } = require('../src/env')
const { DistribuicaoHelper } = require('../src/helpers')

const NFE_XML_BODY =
  '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>2</tpAmb><cUFAutor>29</cUFAutor><CNPJ>99999999999999</CNPJ><distNSU><ultNSU>000000000000001</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse>'

const CTE_XML_BODY =
  '<cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe"><cteDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>2</tpAmb><cUFAutor>29</cUFAutor><CNPJ>99999999999999</CNPJ><distNSU><ultNSU>000000000000001</ultNSU></distNSU></distDFeInt></cteDadosMsg></cteDistDFeInteresse>'

const MDFE_XML_BODY =
  '<mdfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe"><mdfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/mdfe" versao="1.00"><tpAmb>2</tpAmb><cUFAutor>29</cUFAutor><CNPJ>99999999999999</CNPJ><consChMDFe><chMDFe>41000000000000000000000000000000000000000039</chMDFe></consChMDFe></distDFeInt></mdfeDadosMsg></mdfeDistDFeInteresse>'

const MDFE_CABEC_MSG =
  '<mdfeCabecMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe"><cUF>29</cUF><versaoDados>1.00</versaoDados></mdfeCabecMsg>'

const optsBase = {
  tpAmb: '2',
  cUFAutor: '29',
  cnpj: '99999999999999',
  cert: '',
  key: '',
  requestOptions: {},
  httpsOptions: {},
}

describe('DistribuicaoHelper.montarRequest()', function () {
  it('XML da NF-e inalterado após parametrização', function () {
    const req = DistribuicaoHelper.montarRequest({
      ...optsBase,
      documento: DOCUMENTOS.NFE,
      ultNSU: '000000000000001',
    })

    assert.ok(req.includes(NFE_XML_BODY))
    assert.ok(!req.includes('<soap12:Header>'))
  })

  it('XML do CT-e com elementos e versão corretos', function () {
    const req = DistribuicaoHelper.montarRequest({
      ...optsBase,
      documento: DOCUMENTOS.CTE,
      ultNSU: '000000000000001',
    })

    assert.ok(req.includes(CTE_XML_BODY))
    assert.ok(!req.includes('<soap12:Header>'))
  })

  it('XML do MDF-e inclui mdfeCabecMsg no SOAP Header', function () {
    const req = DistribuicaoHelper.montarRequest({
      ...optsBase,
      documento: DOCUMENTOS.MDFE,
      chMDFe: '41000000000000000000000000000000000000000039',
    })

    assert.ok(req.includes(MDFE_XML_BODY))
    assert.ok(req.includes('<soap12:Header>'))
    assert.ok(req.includes(MDFE_CABEC_MSG))
  })
})
