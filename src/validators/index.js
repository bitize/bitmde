'use strict'

const AmbienteValidator = require('./ambiente-validator')
const CertificadoValidator = require('./certificado-validator')
const ChaveNfseValidator = require('./chaveNfse-validator')
const ChaveValidator = require('./chave-validator')
const CnpjCpfValidator = require('./cnpjCpf-validator')
const CnpjValidator = require('./cnpj-validator')
const EventoValidator = require('./evento-validator')
const LoteValidator = require('./lote-validator')
const MotivoRejeicaoValidator = require('./motivoRejeicao-validator')
const NsuNfseValidator = require('./nsuNfse-validator')
const NsuValidator = require('./nsu-validator')
const UfValidator = require('./uf-validator')
const ZoneValidator = require('./zone-validator')

const validator = Object.freeze({
  AmbienteValidator,
  CertificadoValidator,
  ChaveNfseValidator,
  ChaveValidator,
  CnpjCpfValidator,
  CnpjValidator,
  EventoValidator,
  LoteValidator,
  MotivoRejeicaoValidator,
  NsuNfseValidator,
  NsuValidator,
  UfValidator,
  ZoneValidator,
})

module.exports = validator
