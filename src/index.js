'use strict'

const DistribuicaoCTe = require('./apis/distribuicaoCTe-api')
const DistribuicaoDFe = require('./apis/distribuicaoDFe-api')
const DistribuicaoMDFe = require('./apis/distribuicaoMDFe-api')
const RecepcaoEvento = require('./apis/recepcaoEvento-api')

module.exports = {
  DistribuicaoCTe: DistribuicaoCTe,
  DistribuicaoDFe: DistribuicaoDFe,
  DistribuicaoMDFe: DistribuicaoMDFe,
  RecepcaoEvento: RecepcaoEvento,
}
module.exports.default = {
  DistribuicaoCTe: DistribuicaoCTe,
  DistribuicaoDFe: DistribuicaoDFe,
  DistribuicaoMDFe: DistribuicaoMDFe,
  RecepcaoEvento: RecepcaoEvento,
}
module.exports.mde = {
  DistribuicaoCTe: DistribuicaoCTe,
  DistribuicaoDFe: DistribuicaoDFe,
  DistribuicaoMDFe: DistribuicaoMDFe,
  RecepcaoEvento: RecepcaoEvento,
}
