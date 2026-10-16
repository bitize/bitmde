'use strict'

const { DistribuicaoNFSeController } = require('../controllers')
const {
  AmbienteValidator,
  CertificadoValidator,
  ChaveNfseValidator,
  CnpjValidator,
  NsuNfseValidator,
} = require('../validators')

class DistribuicaoNFSe {
  /**
   * Distribuição de NFS-e Nacional pelo Ambiente de Dados Nacional (ADN).
   *
   * @param {Object} config
   * @param {Buffer} [config.pfx]
   * @param {string} [config.passphrase]
   * @param {Buffer | string} [config.cert]
   * @param {Buffer | string} [config.key]
   * @param {string} config.cnpj CNPJ consultado, enviado como `cnpjConsulta`. Precisa ter a mesma raiz do CNPJ do certificado.
   * @param {'1' | '2'} config.tpAmb `'1'` produção, `'2'` produção restrita.
   * @param {Object} [config.options]
   * @param {import('axios').AxiosRequestConfig} [config.options.requestOptions]
   * @param {import('https').AgentOptions} [config.options.httpsOptions] Mesclado por cima do padrão `{ ca: CA_PADRAO, rejectUnauthorized: true }`. Informar `ca` substitui a cadeia inteira; para somar uma AC, use `[...CA_PADRAO, minhaCa]`.
   */
  constructor(config) {
    const { requestOptions = {}, httpsOptions = {} } = config.options || {}

    const certificadoValidator = new CertificadoValidator(config)
    const ambienteValidator = new AmbienteValidator(config)
    const cnpjValidator = new CnpjValidator(config)

    if (!certificadoValidator.isValid()) {
      throw new Error(certificadoValidator.getError())
    }

    if (!ambienteValidator.isValid()) {
      throw new Error(ambienteValidator.getError())
    }

    if (!cnpjValidator.isValid()) {
      throw new Error(cnpjValidator.getError())
    }

    const { cert, key } = certificadoValidator.getValues()
    const { tpAmb } = ambienteValidator.getValues()
    const { cnpj } = cnpjValidator.getValues()

    this.config = Object.freeze({
      cnpj: cnpj,
      tpAmb: tpAmb,
      cert: cert,
      key: key,
      requestOptions: Object.freeze(requestOptions),
      httpsOptions: Object.freeze(httpsOptions),
    })

    Object.freeze(this)
  }

  /**
   * A NFS-e da chave e os eventos vinculados a ela.
   *
   * @param {string} chNFSe Chave de acesso de 50 dígitos.
   */
  consultaChNFSe(chNFSe) {
    const chaveValidator = new ChaveNfseValidator(chNFSe)

    if (!chaveValidator.isValid()) {
      throw new Error(chaveValidator.getError())
    }

    const value = chaveValidator.getValues()

    const opts = {
      ...this.config,
      chNFSe: value,
    }

    return DistribuicaoNFSeController.enviar(opts)
  }

  /**
   * O documento daquele NSU.
   *
   * @param {string | number} nsu Maior que zero.
   */
  consultaNSU(nsu) {
    const nsuValidator = new NsuNfseValidator(nsu, { positivo: true })

    if (!nsuValidator.isValid()) {
      throw new Error(nsuValidator.getError())
    }

    const value = nsuValidator.getValues()

    const opts = {
      ...this.config,
      nsu: value,
    }

    return DistribuicaoNFSeController.enviar(opts)
  }

  /**
   * Até 50 documentos depois do NSU informado. Começa em `'0'`; o pedido
   * seguinte usa o último NSU recebido. Fila vazia é `status` 404, sem `error`.
   *
   * @param {string | number} ultNSU
   */
  consultaUltNSU(ultNSU) {
    const nsuValidator = new NsuNfseValidator(ultNSU)

    if (!nsuValidator.isValid()) {
      throw new Error(nsuValidator.getError())
    }

    const value = nsuValidator.getValues()

    const opts = {
      ...this.config,
      ultNSU: value,
    }

    return DistribuicaoNFSeController.enviar(opts)
  }
}

module.exports = DistribuicaoNFSe
