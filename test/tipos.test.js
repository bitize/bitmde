'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const ts = require('typescript')

const RAIZ = path.resolve(__dirname, '..')
const FIXTURE = path.join(__dirname, 'fixtures', 'consumidor-tipos.ts')

/**
 * Diagnósticos no formato do tsc, com arquivo e linha, para a falha ser
 * legível na CI.
 *
 * @param {readonly import('typescript').Diagnostic[]} diagnosticos
 * @returns {string}
 */
function formatar(diagnosticos) {
  return ts.formatDiagnostics(diagnosticos, {
    getCanonicalFileName: (nome) => nome,
    getCurrentDirectory: () => RAIZ,
    getNewLine: () => '\n',
  })
}

describe('Tipos públicos (.d.ts)', function () {
  // O emit do .d.ts passa dos 2 s padrão do mocha.
  this.timeout(30000)

  let outDir

  before(function () {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitmde-tipos-'))
  })

  after(function () {
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  it('o consumidor TS compila em strict contra o .d.ts gerado', function () {
    // Mesmas opções do `npm run types`, menos o destino: o test:ci roda sem
    // build, e o build limpa dist/. skipLibCheck não muda o que é emitido.
    const arquivo = path.join(RAIZ, 'tsconfig.json')
    const { config, error } = ts.readConfigFile(arquivo, ts.sys.readFile)
    assert.strictEqual(formatar(error ? [error] : []), '')

    // tsconfig com opção inválida não impede o emit: o erro só aparece aqui,
    // e sem esta checagem o teste passaria com opções diferentes das do build.
    const projeto = ts.parseJsonConfigFileContent(config, ts.sys, RAIZ)
    assert.strictEqual(formatar(projeto.errors), '')

    const programa = ts.createProgram(projeto.fileNames, {
      ...projeto.options,
      outDir,
      skipLibCheck: true,
    })
    const emissao = programa.emit()

    assert.strictEqual(
      formatar([...ts.getPreEmitDiagnostics(programa), ...emissao.diagnostics]),
      ''
    )

    const consumidor = ts.createProgram([FIXTURE], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      paths: { '@bitize/bitmde': [path.join(outDir, 'index.d.ts')] },
    })

    assert.strictEqual(formatar(ts.getPreEmitDiagnostics(consumidor)), '')
  })
})
