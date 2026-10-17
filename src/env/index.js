const { CA, CA_PADRAO } = require('./ca')
const {
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE,
} = require('./distribuicao')
const { DOCUMENTOS } = require('./documento')
const { EVENTOS } = require('./evento')
const { EVENTOS_NFSE, NFSE_ADN, NFSE_SEFIN } = require('./nfse')
const { RECEPCAO } = require('./recepcao')
const { CODIGOS_UF } = require('./uf')
const { VERSION } = require('./version')
const { ZONES } = require('./zone')

module.exports = {
  CA: CA,
  CA_PADRAO: CA_PADRAO,
  CODIGOS_UF: CODIGOS_UF,
  DISTRIBUICAO: DISTRIBUICAO,
  DISTRIBUICAO_CTE: DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE: DISTRIBUICAO_MDFE,
  DOCUMENTOS: DOCUMENTOS,
  EVENTOS: EVENTOS,
  EVENTOS_NFSE: EVENTOS_NFSE,
  NFSE_ADN: NFSE_ADN,
  NFSE_SEFIN: NFSE_SEFIN,
  RECEPCAO: RECEPCAO,
  VERSION: VERSION,
  ZONES: ZONES,
}
