'use strict'

const assert = require('assert')
const { ChaveCteValidator, ChaveMdfeValidator } = require('../src/validators')

describe('ChaveCteValidator', function () {
  it('Chave do CT-e não informada', function () {
    const validator = new ChaveCteValidator()

    assert.equal(validator.isValid(), false)
    assert.strictEqual(validator.getError(), 'Chave do CT-e não informada.')
  })

  it('Chave do CT-e com tamanho incorreto', function () {
    const validator = new ChaveCteValidator('41')

    assert.equal(validator.isValid(), false)
    assert.strictEqual(
      validator.getError(),
      'Chave do CT-e com tamanho incorreto.'
    )
  })
})

describe('ChaveMdfeValidator', function () {
  it('Chave do MDF-e não informada', function () {
    const validator = new ChaveMdfeValidator()

    assert.equal(validator.isValid(), false)
    assert.strictEqual(validator.getError(), 'Chave do MDF-e não informada.')
  })

  it('Chave do MDF-e com tamanho incorreto', function () {
    const validator = new ChaveMdfeValidator('41')

    assert.equal(validator.isValid(), false)
    assert.strictEqual(
      validator.getError(),
      'Chave do MDF-e com tamanho incorreto.'
    )
  })
})
