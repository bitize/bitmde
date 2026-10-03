'use strict'

const DistribuicaoDFe = require('./apis/distribuicaoDFe-api')
const RecepcaoEvento = require('./apis/recepcaoEvento-api')
const env = require('./env')

// Congelados no lugar: CA_PADRAO é o mesmo array que os helpers passam ao
// https.Agent, e um push do consumidor mudaria a cadeia de toda chamada.
const CA_ICP_BRASIL = Object.freeze(env.CA)
const CA_PADRAO = Object.freeze(env.CA_PADRAO)

module.exports = {
  CA_ICP_BRASIL: CA_ICP_BRASIL,
  CA_PADRAO: CA_PADRAO,
  DistribuicaoDFe: DistribuicaoDFe,
  RecepcaoEvento: RecepcaoEvento,
}
module.exports.default = {
  CA_ICP_BRASIL: CA_ICP_BRASIL,
  CA_PADRAO: CA_PADRAO,
  DistribuicaoDFe: DistribuicaoDFe,
  RecepcaoEvento: RecepcaoEvento,
}
module.exports.mde = {
  CA_ICP_BRASIL: CA_ICP_BRASIL,
  CA_PADRAO: CA_PADRAO,
  DistribuicaoDFe: DistribuicaoDFe,
  RecepcaoEvento: RecepcaoEvento,
}
