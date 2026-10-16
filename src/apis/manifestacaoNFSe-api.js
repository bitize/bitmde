'use strict'

const { ManifestacaoNFSeController } = require('../controllers')
const { EVENTOS_NFSE, VERSION } = require('../env')
const { Data } = require('../util')
const {
  AmbienteValidator,
  CertificadoValidator,
  ChaveNfseValidator,
  CnpjValidator,
  MotivoRejeicaoValidator,
  ZoneValidator,
} = require('../validators')

/**
 * Motivo da Rejeição do tomador (`cMotivo`):
 * - `'1'` NFS-e em duplicidade;
 * - `'2'` NFS-e já emitida pelo tomador;
 * - `'3'` não ocorrência do fato gerador;
 * - `'4'` erro quanto à responsabilidade tributária;
 * - `'5'` erro quanto ao valor do serviço, valor das deduções, serviço prestado ou data do fato gerador;
 * - `'9'` outros — exige `xMotivo`.
 *
 * @typedef {'1' | '2' | '3' | '4' | '5' | '9'} MotivoRejeicaoNFSe
 */

/**
 * Opções do controller para um evento do tomador. `dhEvento` sai do relógio
 * local, no timezone da config.
 *
 * @param {Object} config
 * @param {string} chNFSe
 * @param {203202 | 203206} codigo
 * @returns {Object}
 */
function montarOpts(config, chNFSe, codigo) {
  return {
    ...config,
    chNFSe: chNFSe,
    evento: EVENTOS_NFSE[codigo],
    verAplic: `bitmde/${VERSION}`,
    dhEvento: Data.toFormat(new Date(), config.timezone),
  }
}

class ManifestacaoNFSe {
  /**
   * Manifestação do tomador da NFS-e Nacional (Confirmação e Rejeição), na
   * SEFIN Nacional. Cada chamada registra um evento fiscal: em produção
   * (`tpAmb` `'1'`), ele não se desfaz.
   *
   * @param {Object} config
   * @param {Buffer} [config.pfx]
   * @param {string} [config.passphrase]
   * @param {Buffer | string} [config.cert]
   * @param {Buffer | string} [config.key]
   * @param {string} config.cnpj CNPJ do tomador, enviado como `CNPJAutor`. Precisa ter a mesma raiz do CNPJ do certificado.
   * @param {'1' | '2'} config.tpAmb `'1'` produção, `'2'` produção restrita.
   * @param {'America/Araguaina' | 'America/Bahia' | 'America/Belem' | 'America/Boa_Vista' | 'America/Campo_Grande' | 'America/Cuiaba' | 'America/Fortaleza' | 'America/Maceio' | 'America/Manaus' | 'America/Noronha' | 'America/Porto_Velho' | 'America/Recife' | 'America/Rio_Branco' | 'America/Sao_Paulo'} [config.timezone = 'America/Sao_Paulo']
   * @param {Object} [config.options]
   * @param {import('axios').AxiosRequestConfig} [config.options.requestOptions]
   * @param {import('https').AgentOptions} [config.options.httpsOptions] Mesclado por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Informar `ca` substitui a cadeia inteira; para somar uma AC, use `[...CA_PADRAO, minhaCa]`.
   */
  constructor(config) {
    const { requestOptions = {}, httpsOptions = {} } = config.options || {}

    const certificadoValidator = new CertificadoValidator(config)
    const ambienteValidator = new AmbienteValidator(config)
    const cnpjValidator = new CnpjValidator(config)
    const zoneValidator = new ZoneValidator(config)

    if (!certificadoValidator.isValid()) {
      throw new Error(certificadoValidator.getError())
    }

    if (!ambienteValidator.isValid()) {
      throw new Error(ambienteValidator.getError())
    }

    if (!cnpjValidator.isValid()) {
      throw new Error(cnpjValidator.getError())
    }

    if (!zoneValidator.isValid()) {
      throw new Error(zoneValidator.getError())
    }

    const { cert, key } = certificadoValidator.getValues()
    const { tpAmb } = ambienteValidator.getValues()
    const { cnpj } = cnpjValidator.getValues()
    const { timezone } = zoneValidator.getValues()

    this.config = Object.freeze({
      cnpj: cnpj,
      tpAmb: tpAmb,
      timezone: timezone,
      cert: cert,
      key: key,
      requestOptions: Object.freeze(requestOptions),
      httpsOptions: Object.freeze(httpsOptions),
    })

    Object.freeze(this)
  }

  /**
   * Confirmação do tomador (`e203202`). Depois dela, o prestador não
   * consegue mais cancelar a NFS-e, só substituí-la.
   *
   * @param {string} chNFSe Chave de acesso de 50 dígitos.
   */
  confirmar(chNFSe) {
    const chaveValidator = new ChaveNfseValidator(chNFSe)

    if (!chaveValidator.isValid()) {
      throw new Error(chaveValidator.getError())
    }

    const opts = montarOpts(this.config, chaveValidator.getValues(), 203202)

    return ManifestacaoNFSeController.enviar(opts)
  }

  /**
   * Rejeição do tomador (`e203206`).
   *
   * @param {string} chNFSe Chave de acesso de 50 dígitos.
   * @param {Object} motivo
   * @param {MotivoRejeicaoNFSe} motivo.cMotivo
   * @param {string} [motivo.xMotivo] De 15 a 255 caracteres; obrigatório com `cMotivo` `'9'`.
   */
  rejeitar(chNFSe, motivo) {
    const chaveValidator = new ChaveNfseValidator(chNFSe)

    if (!chaveValidator.isValid()) {
      throw new Error(chaveValidator.getError())
    }

    const motivoValidator = new MotivoRejeicaoValidator(motivo)

    if (!motivoValidator.isValid()) {
      throw new Error(motivoValidator.getError())
    }

    const { cMotivo, xMotivo } = motivoValidator.getValues()

    const opts = {
      ...montarOpts(this.config, chaveValidator.getValues(), 203206),
      cMotivo: cMotivo,
      xMotivo: xMotivo,
    }

    return ManifestacaoNFSeController.enviar(opts)
  }
}

module.exports = ManifestacaoNFSe
