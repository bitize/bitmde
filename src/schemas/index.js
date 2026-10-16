'use strict'

const DistribuicaoSchema = require('./distribuicaoDFe-schema')
const ManifestacaoNFSeSchema = require('./manifestacaoNFSe-schema')
const RecepcaoSchema = require('./recepcaoEvento-schema')

const schema = Object.freeze({
  DistribuicaoSchema,
  ManifestacaoNFSeSchema,
  RecepcaoSchema,
})

module.exports = schema
