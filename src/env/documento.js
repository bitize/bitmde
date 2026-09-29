const {
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE,
} = require('./distribuicao')

const DOCUMENTOS = {
  NFE: {
    endpoints: DISTRIBUICAO,
    xmlns: 'http://www.portalfiscal.inf.br/nfe',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
    versao: '1.01',
    operacao: 'nfeDistDFeInteresse',
    dadosMsg: 'nfeDadosMsg',
    consChave: { bloco: 'consChNFe', campo: 'chNFe' },
    resposta: {
      response: 'nfeDistDFeInteresseResponse',
      result: 'nfeDistDFeInteresseResult',
    },
    cabecMsg: null,
    cabecMsgXmlns: null,
  },
  CTE: {
    endpoints: DISTRIBUICAO_CTE,
    xmlns: 'http://www.portalfiscal.inf.br/cte',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe',
    versao: '1.00',
    operacao: 'cteDistDFeInteresse',
    dadosMsg: 'cteDadosMsg',
    consChave: { bloco: 'consChCTe', campo: 'chCTe' },
    resposta: {
      response: 'cteDistDFeInteresseResponse',
      result: 'cteDistDFeInteresseResult',
    },
    cabecMsg: null,
    cabecMsgXmlns: null,
  },
  MDFE: {
    endpoints: DISTRIBUICAO_MDFE,
    xmlns: 'http://www.portalfiscal.inf.br/mdfe',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe',
    versao: '1.00',
    operacao: 'mdfeDistDFeInteresse',
    dadosMsg: 'mdfeDadosMsg',
    consChave: { bloco: 'consChMDFe', campo: 'chMDFe' },
    resposta: {
      response: 'mdfeDistDFeInteresseResponse',
      result: 'mdfeDistDFeInteresseResult',
    },
    cabecMsg: 'mdfeCabecMsg',
    cabecMsgXmlns:
      'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe',
  },
}

module.exports = { DOCUMENTOS: DOCUMENTOS }
