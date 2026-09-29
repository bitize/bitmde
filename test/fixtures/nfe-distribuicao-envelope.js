'use strict'

const NFE_DIST_DFE_XML_BODY =
  '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>2</tpAmb><cUFAutor>29</cUFAutor><CNPJ>99999999999999</CNPJ><distNSU><ultNSU>000000000000001</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse>'

const NFE_DIST_DFE_ENVELOPE = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${NFE_DIST_DFE_XML_BODY}</soap12:Body></soap12:Envelope>`

module.exports = {
  NFE_DIST_DFE_XML_BODY: NFE_DIST_DFE_XML_BODY,
  NFE_DIST_DFE_ENVELOPE: NFE_DIST_DFE_ENVELOPE,
}
