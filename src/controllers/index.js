'use strict'

const DistribuicaoController = require('./distribuicaoDFe-controller')
const DistribuicaoNFSeController = require('./distribuicaoNFSe-controller')
const ManifestacaoNFSeController = require('./manifestacaoNFSe-controller')
const RecepcaoController = require('./recepcaoEvento-controller')

const controller = Object.freeze({
  DistribuicaoController,
  DistribuicaoNFSeController,
  ManifestacaoNFSeController,
  RecepcaoController,
})

module.exports = controller
