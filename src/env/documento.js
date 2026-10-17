const {
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE,
} = require('./distribuicao')

/**
 * Descritores da distribuição de DF-e: tudo o que muda entre NF-e, CT-e e
 * MDF-e. Conferidos contra o WSDL e a homologação de cada serviço.
 *
 * - `operacao`: elemento que embrulha o `dadosMsg` no Body. `null` no MDF-e,
 *   cujo WSDL é "bare": o `mdfeDadosMsg` vai direto no Body, e com o
 *   invólucro o SVRS devolve HTTP 500.
 * - `resposta.response`: idem na volta; `null` quando o `result` vem direto
 *   no Body.
 * - `cUFAutor`: o `distDFeInt` do MDF-e não tem o campo (rejeição 215).
 * - `consChave`: CT-e e MDF-e só aceitam `distNSU` e `consNSU`.
 */
const DOCUMENTOS = {
  NFE: {
    endpoints: DISTRIBUICAO,
    xmlns: 'http://www.portalfiscal.inf.br/nfe',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe',
    versao: '1.01',
    operacao: 'nfeDistDFeInteresse',
    dadosMsg: 'nfeDadosMsg',
    resposta: {
      response: 'nfeDistDFeInteresseResponse',
      result: 'nfeDistDFeInteresseResult',
    },
    cUFAutor: true,
    consChave: { bloco: 'consChNFe', campo: 'chNFe' },
  },
  CTE: {
    endpoints: DISTRIBUICAO_CTE,
    xmlns: 'http://www.portalfiscal.inf.br/cte',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe',
    versao: '1.00',
    operacao: 'cteDistDFeInteresse',
    dadosMsg: 'cteDadosMsg',
    resposta: {
      response: 'cteDistDFeInteresseResponse',
      result: 'cteDistDFeInteresseResult',
    },
    cUFAutor: true,
    consChave: null,
  },
  MDFE: {
    endpoints: DISTRIBUICAO_MDFE,
    xmlns: 'http://www.portalfiscal.inf.br/mdfe',
    xmlnsWsdl: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeDistribuicaoDFe',
    versao: '1.00',
    operacao: null,
    dadosMsg: 'mdfeDadosMsg',
    resposta: {
      response: null,
      result: 'mdfeDistDFeInteresseResult',
    },
    cUFAutor: false,
    consChave: null,
  },
}

module.exports = { DOCUMENTOS: DOCUMENTOS }
