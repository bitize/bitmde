'use strict'

const axios = require('axios').default
const https = require('https')

const { VERSION } = require('../env')

class Instance {
  constructor(opts) {
    const { baseURL, ca, cert, key } = opts

    const AgentOptions = Object.assign(
      {
        cert: cert,
        key: key,
        ca: ca,
        rejectUnauthorized: true,
      },
      { ...opts.httpsOptions }
    )

    const httpsAgent = new https.Agent(AgentOptions)

    const requestOptions = Object.assign(
      {
        baseURL: baseURL,
        headers: {
          'User-Agent': `bitmde/${VERSION}`,
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
        httpsAgent: httpsAgent,
        timeout: 60000,
      },
      { ...opts.requestOptions }
    )

    const instance = axios.create({
      ...requestOptions,
    })

    this.instance = instance
  }

  /**
   * Sem resposta HTTP (cadeia TLS, DNS, conexão recusada, timeout, erro
   * antes do envio), devolve `status: 0` e o motivo em `transportError`.
   *
   * @returns {Promise<{status: number, data: string, transportError?: {code: string, message: string}}>}
   */
  async request(config) {
    try {
      const response = await this.instance(config)

      const { status, data } = response

      return { status, data }
    } catch (error) {
      if (error && error.response) {
        const { status, data } = error.response

        return { status, data }
      }

      // Só code e message saem daqui: o AxiosError carrega config.httpsAgent,
      // e o agente guarda o cert e a key do A1 nas options.
      const { code, message } = error || {}

      const retorno = {
        status: 0,
        data: '',
        transportError: {
          code: code ? String(code) : 'ERR_DESCONHECIDO',
          message: message ? String(message) : String(error),
        },
      }

      return retorno
    }
  }
}

module.exports = Instance
