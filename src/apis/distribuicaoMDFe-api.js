'use strict'

const { DistribuicaoController } = require('../controllers')
const { DOCUMENTOS } = require('../env')
const {
  AmbienteValidator,
  CertificadoValidator,
  CnpjCpfValidator,
  NsuValidator,
} = require('../validators')

/**
 * Distribuição de MDF-e de interesse do CNPJ/CPF, na SVRS. O `distDFeInt` do
 * MDF-e não tem `cUFAutor` nem consulta por chave: só `distNSU` e `consNSU`.
 */
class DistribuicaoMDFe {
  /**
   * @param {Object} config
   * @param {Buffer} [config.pfx]
   * @param {string} [config.passphrase]
   * @param {Buffer | string} [config.cert]
   * @param {Buffer | string} [config.key]
   * @param {string} [config.cnpj]
   * @param {string} [config.cpf]
   * @param {'1' | '2'} config.tpAmb
   * @param {Object} [config.options]
   * @param {import('axios').AxiosRequestConfig} [config.options.requestOptions]
   * @param {import('https').AgentOptions} [config.options.httpsOptions] Mesclado por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Informar `ca` substitui a cadeia inteira; para somar uma AC, use `[...CA_PADRAO, minhaCa]`.
   */
  constructor(config) {
    const { requestOptions = {}, httpsOptions = {} } = config.options || {}

    const certificadoValidator = new CertificadoValidator(config)
    const ambienteValidator = new AmbienteValidator(config)
    const cnpjCpfValidator = new CnpjCpfValidator(config)

    if (!certificadoValidator.isValid()) {
      throw new Error(certificadoValidator.getError())
    }

    if (!ambienteValidator.isValid()) {
      throw new Error(ambienteValidator.getError())
    }

    if (!cnpjCpfValidator.isValid()) {
      throw new Error(cnpjCpfValidator.getError())
    }

    const { cert, key } = certificadoValidator.getValues()
    const { tpAmb } = ambienteValidator.getValues()
    const { cnpj, cpf } = cnpjCpfValidator.getValues()

    this.config = Object.freeze({
      cnpj: cnpj,
      cpf: cpf,
      tpAmb: tpAmb,
      cert: cert,
      key: key,
      requestOptions: Object.freeze(requestOptions),
      httpsOptions: Object.freeze(httpsOptions),
    })

    Object.freeze(this)
  }

  /**
   * @param {string} nsu
   */
  consultaNSU(nsu) {
    const nsuValidator = new NsuValidator(nsu)

    if (!nsuValidator.isValid()) {
      throw new Error(nsuValidator.getError())
    }

    const value = nsuValidator.getValues()

    const opts = {
      ...this.config,
      nsu: value,
      documento: DOCUMENTOS.MDFE,
    }

    return DistribuicaoController.enviar(opts)
  }

  /**
   * @param {string} ultNSU
   */
  consultaUltNSU(ultNSU) {
    const nsuValidator = new NsuValidator(ultNSU)

    if (!nsuValidator.isValid()) {
      throw new Error(nsuValidator.getError())
    }

    const value = nsuValidator.getValues()

    const opts = {
      ...this.config,
      ultNSU: value,
      documento: DOCUMENTOS.MDFE,
    }

    return DistribuicaoController.enviar(opts)
  }
}

module.exports = DistribuicaoMDFe
