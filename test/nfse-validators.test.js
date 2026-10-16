'use strict'

const assert = require('assert')
const {
  ChaveNfseValidator,
  CnpjValidator,
  MotivoRejeicaoValidator,
  NsuNfseValidator,
} = require('../src/validators')

const CHAVE_NFSE = '4'.repeat(50)

function erroDe(validator) {
  assert.strictEqual(validator.isValid(), false)
  return validator.getError()
}

describe('CnpjValidator', function () {
  it('CNPJ não informado', function () {
    assert.strictEqual(erroDe(new CnpjValidator({})), 'CNPJ não informado.')
  })

  it('CNPJ com formato inválido', function () {
    for (const cnpj of [
      '1234567890123',
      '123456789012345',
      '12.345.678/0001-90',
      '12345678ABCDEF',
      '12345678 00019',
    ]) {
      assert.strictEqual(
        erroDe(new CnpjValidator({ cnpj })),
        'CNPJ com formato inválido.',
        cnpj
      )
    }
  })

  it('CNPJ numérico', function () {
    const validator = new CnpjValidator({ cnpj: '12345678000190' })

    assert.strictEqual(validator.isValid(), true)
    assert.deepStrictEqual(validator.getValues(), { cnpj: '12345678000190' })
  })

  it('CNPJ alfanumérico vira maiúsculas', function () {
    const validator = new CnpjValidator({ cnpj: '12abc34501de35' })

    assert.strictEqual(validator.isValid(), true)
    assert.deepStrictEqual(validator.getValues(), { cnpj: '12ABC34501DE35' })
  })

  it('Imutabilidade', function () {
    assert.throws(() => {
      CnpjValidator.isValid = 'subscrever isValid'
    }, TypeError)
  })
})

describe('NsuNfseValidator', function () {
  it('NSU não informado', function () {
    for (const nsu of [undefined, null, '']) {
      assert.strictEqual(
        erroDe(new NsuNfseValidator(nsu)),
        'NSU não informado.'
      )
    }
  })

  it('NSU com tamanho incorreto', function () {
    assert.strictEqual(
      erroDe(new NsuNfseValidator('1234567890123456')),
      'NSU com tamanho incorreto.'
    )
  })

  it('NSU deve conter apenas números', function () {
    for (const nsu of ['abc', '-1', '1.5', ' 51', -1]) {
      assert.strictEqual(
        erroDe(new NsuNfseValidator(nsu)),
        'NSU deve conter apenas números.',
        String(nsu)
      )
    }
  })

  it('NSU deve ser maior que zero, quando exigido', function () {
    for (const nsu of ['0', '000', 0]) {
      assert.strictEqual(
        erroDe(new NsuNfseValidator(nsu, { positivo: true })),
        'NSU deve ser maior que zero.',
        String(nsu)
      )
    }
  })

  it('Normaliza sem zeros à esquerda', function () {
    const casos = [
      ['00051', '51'],
      ['0', '0'],
      ['000000000000000', '0'],
      [0, '0'],
      [51, '51'],
      ['123456789012345', '123456789012345'],
    ]

    for (const [entrada, esperado] of casos) {
      const validator = new NsuNfseValidator(entrada)

      assert.strictEqual(validator.isValid(), true, String(entrada))
      assert.strictEqual(validator.getValues(), esperado)
    }
  })

  it('Imutabilidade', function () {
    assert.throws(() => {
      NsuNfseValidator.isValid = 'subscrever isValid'
    }, TypeError)
  })
})

describe('ChaveNfseValidator', function () {
  it('Chave da NFS-e não informada', function () {
    assert.strictEqual(
      erroDe(new ChaveNfseValidator()),
      'Chave da NFS-e não informada.'
    )
  })

  it('Chave da NFS-e com tamanho incorreto', function () {
    for (const chave of [
      '4'.repeat(44),
      '4'.repeat(51),
      '4'.repeat(49) + 'A',
      '../'.repeat(17).slice(0, 50),
    ]) {
      assert.strictEqual(
        erroDe(new ChaveNfseValidator(chave)),
        'Chave da NFS-e com tamanho incorreto.',
        chave
      )
    }
  })

  it('Chave válida', function () {
    const validator = new ChaveNfseValidator(CHAVE_NFSE)

    assert.strictEqual(validator.isValid(), true)
    assert.strictEqual(validator.getValues(), CHAVE_NFSE)
  })

  it('Imutabilidade', function () {
    assert.throws(() => {
      ChaveNfseValidator.isValid = 'subscrever isValid'
    }, TypeError)
  })
})

describe('MotivoRejeicaoValidator', function () {
  const DESCRICAO = 'Serviço não foi prestado.'

  it('Motivo da rejeição não informado', function () {
    for (const motivo of [
      undefined,
      null,
      {},
      { cMotivo: '' },
      { xMotivo: DESCRICAO },
    ]) {
      assert.strictEqual(
        erroDe(new MotivoRejeicaoValidator(motivo)),
        'Motivo da rejeição não informado.',
        JSON.stringify(motivo)
      )
    }
  })

  it('Motivo da rejeição deve conter um dos valores: 1, 2, 3, 4, 5 ou 9', function () {
    for (const cMotivo of ['0', '6', '8', '10', '01', 'a', 7]) {
      assert.strictEqual(
        erroDe(new MotivoRejeicaoValidator({ cMotivo })),
        'Motivo da rejeição deve conter um dos valores: 1, 2, 3, 4, 5 ou 9',
        String(cMotivo)
      )
    }
  })

  it('Descrição do motivo obrigatória para o motivo 9 (Outros).', function () {
    for (const xMotivo of [undefined, '', '   ']) {
      assert.strictEqual(
        erroDe(new MotivoRejeicaoValidator({ cMotivo: '9', xMotivo })),
        'Descrição do motivo obrigatória para o motivo 9 (Outros).',
        String(xMotivo)
      )
    }
  })

  it('Descrição do motivo com tamanho incorreto.', function () {
    for (const xMotivo of ['Curto demais.', 'x'.repeat(256)]) {
      for (const cMotivo of ['1', '9']) {
        assert.strictEqual(
          erroDe(new MotivoRejeicaoValidator({ cMotivo, xMotivo })),
          'Descrição do motivo com tamanho incorreto.',
          `${cMotivo} ${xMotivo.length}`
        )
      }
    }
  })

  it('cMotivo vira string e xMotivo é aparado', function () {
    const validator = new MotivoRejeicaoValidator({
      cMotivo: 9,
      xMotivo: `  ${DESCRICAO}  `,
    })

    assert.strictEqual(validator.isValid(), true)
    assert.deepStrictEqual(validator.getValues(), {
      cMotivo: '9',
      xMotivo: DESCRICAO,
    })
  })

  it('xMotivo é opcional fora do motivo 9', function () {
    for (const xMotivo of [undefined, '', '  ']) {
      const validator = new MotivoRejeicaoValidator({ cMotivo: '3', xMotivo })

      assert.strictEqual(validator.isValid(), true)
      assert.deepStrictEqual(validator.getValues(), {
        cMotivo: '3',
        xMotivo: undefined,
      })
    }
  })

  it('Limites de tamanho do xMotivo: 15 e 255', function () {
    for (const xMotivo of ['x'.repeat(15), 'x'.repeat(255)]) {
      const validator = new MotivoRejeicaoValidator({ cMotivo: '5', xMotivo })

      assert.strictEqual(validator.isValid(), true)
      assert.strictEqual(validator.getValues().xMotivo, xMotivo)
    }
  })

  it('Imutabilidade', function () {
    assert.throws(() => {
      MotivoRejeicaoValidator.isValid = 'subscrever isValid'
    }, TypeError)
  })
})
