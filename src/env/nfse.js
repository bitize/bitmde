/**
 * URL base da API de distribuição para contribuintes da NFS-e Nacional
 * Ambiente de Dados Nacional (ADN) — Manual dos Contribuintes, APIs do ADN v1.0
 */
const NFSE_ADN = {
  1: 'https://adn.nfse.gov.br/contribuintes',
  2: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
}

/**
 * URL base da API da SEFIN Nacional, que recebe o pedido de registro de evento
 * (manifestação do tomador) — Swagger SEFIN Nacional v1
 */
const NFSE_SEFIN = {
  1: 'https://sefin.nfse.gov.br/SefinNacional',
  2: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
}

/**
 * Eventos de manifestação do tomador. O `xDesc` é literal do XSD
 * (`enumeration`), com acento: alterar o texto rejeita o pedido por schema.
 */
const EVENTOS_NFSE = {
  203202: {
    codigo: '203202',
    elemento: 'e203202',
    xDesc: 'Manifestação de NFS-e - Confirmação do Tomador',
  },
  203206: {
    codigo: '203206',
    elemento: 'e203206',
    xDesc: 'Manifestação de NFS-e - Rejeição do Tomador',
  },
}

module.exports = {
  EVENTOS_NFSE: EVENTOS_NFSE,
  NFSE_ADN: NFSE_ADN,
  NFSE_SEFIN: NFSE_SEFIN,
}
