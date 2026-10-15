'use strict'

const DistribuicaoController = require('./distribuicaoDFe-controller')
const DistribuicaoNFSeController = require('./distribuicaoNFSe-controller')
const RecepcaoController = require('./recepcaoEvento-controller')

const controller = Object.freeze({
  DistribuicaoController,
  DistribuicaoNFSeController,
  RecepcaoController,
})

module.exports = controller
