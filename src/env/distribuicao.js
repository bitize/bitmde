/**
 * URLs dos serviços de Distribuição de DF-e por documento e ambiente
 */
const DISTRIBUICAO = {
  1: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl',
  2: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl',
}

const DISTRIBUICAO_CTE = {
  1: 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx?wsdl',
  2: 'https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx?wsdl',
}

const DISTRIBUICAO_MDFE = {
  1: 'https://mdfe.svrs.rs.gov.br/ws/MDFeDistribuicaoDFe/MDFeDistribuicaoDFe.asmx?wsdl',
  2: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeDistribuicaoDFe/MDFeDistribuicaoDFe.asmx?wsdl',
}

module.exports = {
  DISTRIBUICAO: DISTRIBUICAO,
  DISTRIBUICAO_CTE: DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE: DISTRIBUICAO_MDFE,
}
