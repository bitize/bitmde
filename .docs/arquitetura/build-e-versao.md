# Build e versão

```sh
npm run build     # npm run script && npm run types
npm run script    # gera ./lib a partir de ./src   (scripts/index.js)
npm run types     # npx tsc → ./dist/index.d.ts
```

`lib/` e `dist/` são **gitignored e gerados**. O `main` do pacote é `./lib/index.js` e os tipos vêm de `./dist/index.d.ts` — sem build, o pacote publicado sai sem o próprio código.

## `npm run script`

[scripts/index.js](../../scripts/index.js) faz três coisas, nesta ordem:

### 1. Reescreve `src/env/version.js`

```js
const data = `module.exports = { VERSION: '${version}' }\r\n`
```

A `version` vem do `package.json`. **Este arquivo é commitado** e alimenta o header `User-Agent: bitmde/<version>` do [SefazService](camadas/services-sefaz.md).

> Bumpar a versão no `package.json` **não basta**. Sem rodar o build, `src/env/version.js` fica na versão anterior e a lib se identifica errado na SEFAZ. A CI de publicação tem guard exatamente para isso — ver [release.md](release.md).
>
> Note o `\r\n`: o arquivo é escrito em **CRLF**, enquanto no índice do git está em LF. Por isso o guard da CI compara o **valor** de `VERSION`, e não os bytes do arquivo — um `git diff` acusaria diferença em toda execução.

### 2. Limpa `./lib` e `./dist`

Em paralelo, criando o diretório se não existir. Remove arquivos e subdiretórios, mantendo a raiz.

### 3. Copia `src/` → `lib/`, passando pelo UglifyJS

```js
UglifyJS.minify(data.toString(), { output: { beautify: true } })
```

Cada arquivo é processado individualmente, preservando a estrutura de diretórios. `beautify: true` é o ponto: o resultado **não é minificado de verdade** — sai legível, com nomes preservados no escopo exportado. O que o passo realmente faz é normalizar o código (comentários removidos, sintaxe consistente) e servir de checagem de parse: arquivo com erro de sintaxe não gera `code`.

Ver [ADR 0008](decisoes/0008-build-com-uglifyjs-beautify.md) para o porquê de manter esse passo.

> `popularDiretorio` só escreve arquivo que **não existe** (`if (!existsSync(a))`). Como o passo 2 limpou o diretório, na prática todos são escritos. Mas rodar `npm run script` com `lib/` populado e sem limpeza deixaria arquivos velhos intactos — não invocar as funções do script fora do `run()`.

## `npm run types`

`npx tsc`, com o [tsconfig.json](../../tsconfig.json) em `allowJs` + `emitDeclarationOnly`, entrando por [src/index.js](../../src/index.js) e emitindo `dist/index.d.ts`.

**A tipagem pública do pacote é gerada a partir dos blocos JSDoc** de `src/apis/` e do JSDoc de retorno dos controllers. Não há `.d.ts` escrito à mão. Ver [ADR 0006](decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md).

Consequência: JSDoc desatualizado vira tipo errado publicado, e o erro só aparece no editor de quem consome. O job `qualidade` da CI roda `npm run build`, então JSDoc que não compila reprova o PR — mas JSDoc que compila e está **errado**, não.

## O que vai no pacote

Quem decide é o campo `files` do [package.json](../../package.json), uma **allowlist**:

```jsonc
"files": ["lib/", "dist/", "CHANGELOG.md"]
```

O tarball sai com exatamente isso mais `package.json`, `README.md` e `LICENSE`, que o npm inclui sempre — 82 arquivos hoje. Não existe `.npmignore`: ele foi removido na 0.16.0, e **não deve voltar**. Com `files` declarado ele não decidiria a seleção de topo, só criaria a dúvida sobre qual dos dois manda. Ver [ADR 0011](decisoes/0011-files-e-exports-como-contrato-de-empacotamento.md).

> A inversão a ter na cabeça: **silêncio agora significa exclusão**. Arquivo ou pasta nova na raiz fica fora do pacote por padrão, o que é o comportamento desejado. Quem quiser publicar algo novo precisa acrescentá-lo ao `files` de propósito.

Conferir com `npm pack --dry-run` antes de qualquer release. A CI de publicação também confere, no passo descrito em [release.md](release.md).

## Superfície de importação

`exports` fecha o pacote na raiz:

```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "require": "./lib/index.js",
    "default": "./lib/index.js"
  },
  "./package.json": "./package.json"
}
```

Consequência: `require('@bitize/bitmde/lib/validators/nsu-validator')` e qualquer outro deep import falham com `ERR_PACKAGE_PATH_NOT_EXPORTED`. Só a raiz e o `package.json` resolvem. É o que permite mover arquivo dentro de `src/` sem quebrar consumidor.

Três detalhes que não devem ser "simplificados":

- **`"./package.json"` é obrigatório.** Sem essa entrada o `exports` bloqueia a leitura do próprio manifesto, que várias ferramentas fazem.
- **`types` vem antes de `require` e `default`.** O TypeScript resolve pela primeira condição que casa.
- **`main` e `types` continuam declarados** ao lado do `exports`, para bundler antigo que não o entende. Os dois caminhos levam ao mesmo destino.

## Checklist ao mudar a API pública

No mesmo PR:

1. Código em `src/`;
2. JSDoc do método/construtor em `src/apis/` (vira o `.d.ts`);
3. [README.md](../../README.md) — documentação pública;
4. `CHANGELOG.md`, em `[Não publicado]`;
5. O doc de camada correspondente aqui em `.docs/arquitetura/`;
6. `npm run build` e `npm test` antes de abrir o PR.
