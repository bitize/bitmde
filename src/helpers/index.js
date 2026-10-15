'use strict'

const DistribuicaoHelper = require('./distribuicaoDFe-helper')
const DistribuicaoNFSeHelper = require('./distribuicaoNFSe-helper')
const RecepcaoHelper = require('./recepcaoEvento-helper')
const RetornoHelper = require('./retorno-helper')
const RetornoNfseHelper = require('./retornoNfse-helper')

const helper = Object.freeze({
  DistribuicaoHelper,
  DistribuicaoNFSeHelper,
  RecepcaoHelper,
  RetornoHelper,
  RetornoNfseHelper,
})

module.exports = helper
