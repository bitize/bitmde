const { CA } = require('./ca')
const { DOCUMENTOS } = require('./documento')
const {
  DISTRIBUICAO,
  DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE,
} = require('./distribuicao')
const { EVENTOS } = require('./evento')
const { RECEPCAO } = require('./recepcao')
const { CODIGOS_UF } = require('./uf')
const { VERSION } = require('./version')
const { ZONES } = require('./zone')

module.exports = {
  CA: CA,
  CODIGOS_UF: CODIGOS_UF,
  DISTRIBUICAO: DISTRIBUICAO,
  DISTRIBUICAO_CTE: DISTRIBUICAO_CTE,
  DISTRIBUICAO_MDFE: DISTRIBUICAO_MDFE,
  DOCUMENTOS: DOCUMENTOS,
  EVENTOS: EVENTOS,
  RECEPCAO: RECEPCAO,
  VERSION: VERSION,
  ZONES: ZONES,
}
