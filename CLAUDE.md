# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Biblioteca Node.js (CommonJS, JS puro com tipagem via JSDoc) que consome dois Web Services SOAP da SEFAZ:

- **NFeDistribuicaoDFe** — consulta de documentos destinados a um CNPJ/CPF (por `ultNSU`, `NSU` ou `chNFe`).
- **NFeRecepcaoEvento4** — envio de lote de eventos de manifestação do destinatário.

Publicada no npm como `@bitize/bitmde` (pacote escopado, `publishConfig.access: public`); o remote é `bitize/bitmde` (fork de `lucashpmelo/node-mde`, publicado como `node-mde` até a 0.14.13 e como `@bitize/bit-mde` até a 0.16.0). O `README.md` é a documentação pública da API e deve ser atualizado junto com mudanças de assinatura.

## Documentação interna (`.docs/`)

Este arquivo é o resumo operacional. O detalhamento vive em `.docs/`, que não vai no pacote publicado:

- `.docs/arquitetura/` — como cada camada funciona ([camadas/](.docs/arquitetura/camadas/)), os fluxos de ponta a ponta ([fluxos/](.docs/arquitetura/fluxos/)) e o processo de [teste](.docs/arquitetura/testes-e-certificados.md), [build](.docs/arquitetura/build-e-versao.md) e [release](.docs/arquitetura/release.md).
- `.docs/arquitetura/decisoes/` — ADRs numerados: o **porquê** das escolhas estruturais. Consultar antes de propor mudança que contrarie uma invariante.
- `.docs/conhecimento/` — material externo da SEFAZ.
- `.docs/tasks/` — tarefas versionadas, ciclo `drafts → specified → done | canceled`. Fluxo em [.docs/tasks/README.md](.docs/tasks/README.md), template em [.docs/tasks/\_templates/task-template.md](.docs/tasks/_templates/task-template.md). Para criar ou promover uma tarefa, usar a skill [criar-tarefa](.claude/skills/criar-tarefa/SKILL.md).

Regra de fronteira: aqui ficam as regras que, ignoradas, quebram build/teste/release; em `.docs/arquitetura/` fica a explicação de como as coisas funcionam. Não duplicar — critério completo em [.docs/arquitetura/ESTRUTURA.md](.docs/arquitetura/ESTRUTURA.md).

`.docs` não vai no pacote publicado (o `files` do `package.json` só lista `lib/`, `dist/` e `CHANGELOG.md`), mas **não** está no `.prettierignore`: o Markdown de lá passa pelo `format:check`. Rodar `npm run format` depois de mexer em doc.

## Comandos

```sh
npm test                        # mocha sobre ./test (exige ./certs — ver abaixo)
npm run test:ci                 # tudo menos sefaz.test.js (o que a CI roda)
npm run certs:teste             # gera ./certs autoassinado descartável
npx mocha test/xml.test.js      # um arquivo de teste
npx mocha --grep "Imutabilidade"  # filtra por nome do teste
npm run build                   # npm run script && npm run types
npm run script                  # gera ./lib a partir de ./src (scripts/index.js)
npm run types                   # npx tsc -> ./dist/index.d.ts
npm run release                 # git pull && npm publish
```

### Pré-requisito dos testes

Todo arquivo de teste que toca certificado faz `fs.readFileSync` **no topo do módulo**, com caminho relativo ao CWD. Sem o diretório `certs/` (gitignored) o mocha aborta antes de rodar qualquer teste — inclusive os que não dependem dele. É preciso criar `certs/` na raiz com `certificado.pfx`, `passphrase.txt`, `cert.pem` e `key.pem` (o mesmo certificado A1 nos dois formatos, pois `certificado.test.js` compara a conversão PFX→PEM com os `.pem` do disco). Sempre rodar mocha a partir da raiz do repositório.

Sem `certs/`, ainda é possível rodar isoladamente: `test/xml.test.js`, `test/gzip.test.js`, `test/zeroPad.test.js`, `test/data.test.js`.

Quem não tem um A1 em mãos pode rodar `npm run certs:teste`, que gera um autoassinado descartável e libera tudo menos `sefaz.test.js` (65 dos 67 testes). O script **aborta se `certs/` já existir**, para não sobrescrever um certificado real. Dois detalhes do `scripts/gerar-certificado-teste.sh` são load-bearing e não devem ser "simplificados": o `.pfx` precisa ser gerado com `-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES` porque o node-forge não decifra o padrão AES-256 do OpenSSL 3; e os `.pem` são normalizados para CRLF porque `certificado.test.js` compara byte a byte com a saída do forge, que usa CRLF, enquanto o OpenSSL escreve LF no Linux.

`test/sefaz.test.js` é um teste de integração real: bate nos endpoints de produção **e** homologação da SEFAZ com mTLS, e falha sem rede ou com certificado vencido. É o único arquivo excluído da CI.

### CI

Dois workflows em push e PR na `main`:

- `.github/workflows/testes.yml` — matriz Node 20/22/24: `npm ci` → `npm run certs:teste` → `npm run test:ci`.
- `.github/workflows/qualidade.yml` — dois jobs paralelos em Node 22: `npm run format:check` (Prettier) e `npm run build`.

Mais um em release publicado, descrito em [Release](#release):

- `.github/workflows/publicar.yml` — confere tag e `version.js`, roda testes, build, confere o conteúdo do tarball e `npm publish`.

Os três usam `npm ci` com `cache: npm` no `setup-node`. Ambos exigem `package-lock.json` versionado, e ele é — **não voltar a ignorá-lo**: sem lockfile, `npm ci` falha de imediato nos três workflows, e o pacote publicado passaria a ser montado com dependências resolvidas na hora do run, sem reprodutibilidade. Como consequência, bump de dependência agora é mudança de dois arquivos: `package.json` e `package-lock.json`, no mesmo commit.

Nenhum job escreve no repositório: todos declaram `permissions: contents: read` e `persist-credentials: false` no checkout, para o `GITHUB_TOKEN` não ficar gravado no `.git/config` do runner. `publicar.yml` é o único que soma `id-token: write`, pelo OIDC.

`prettier.config.js` fixa `endOfLine: 'auto'` e isso é obrigatório enquanto não houver `.gitattributes`: com `core.autocrlf=true` no Windows o working tree fica em CRLF, enquanto a CI em Linux vê LF. Com o padrão `'lf'` do Prettier, `format:check` acusaria todos os arquivos na máquina dos devs e nenhum na CI. O Prettier é dependência de dev fixada em versão exata (sem `^`). Com o lockfile versionado isso virou redundância proposital — o `npm ci` já instalaria a mesma versão —, mas o pin mantém a intenção visível no `package.json` e impede que um `npm update` suba um minor e reprove `format:check` em arquivos intocados. Pelo mesmo motivo, não trocar por `npx prettier` solto, que baixaria uma versão diferente a cada run.

### Build e versão

`scripts/index.js` faz três coisas, nessa ordem: reescreve `src/env/version.js` com a `version` do `package.json`, limpa `./lib` e `./dist`, e copia cada arquivo de `src/` passando por `UglifyJS.minify({output:{beautify:true}})` para `./lib`. O `main` do pacote é `./lib/index.js` e os tipos vêm de `./dist/index.d.ts`, gerado pelo `tsc` (`allowJs` + `emitDeclarationOnly`, entrando só por `src/index.js`).

`lib/` e `dist/` são gitignored — **rodar `npm run build` antes de publicar**. Bumpar a versão no `package.json` sozinho não basta: `src/env/version.js` é commitado e alimenta o header `User-Agent: bitmde/<version>`; ele só é atualizado pelo build.

## Arquitetura

Fluxo de uma chamada, em camadas fixas:

```
apis/          classe pública, valida config no construtor e congela (Object.freeze)
  └ validators/  normaliza a entrada e produz mensagem de erro
controllers/   static enviar(opts): montarRequest -> envia -> montarResponse -> montarRetorno
  └ helpers/     orquestra schema -> XML -> (assinatura) -> serviço -> parse da resposta
      └ schemas/   objeto JS espelhando o XML (chaves `@_` = atributos, para o XMLBuilder)
      └ services/sefaz-service.js  instância axios + https.Agent com mTLS
      └ helpers/retorno-helper.js  formato final { data, reqXml, resXml, status, error? }
env/           constantes: endpoints por tpAmb, cadeia CA ICP-Brasil, EVENTOS, CODIGOS_UF, ZONES, VERSION
```

`src/index.js` exporta `DistribuicaoDFe` e `RecepcaoEvento` em três formas (`module.exports`, `.default`, `.mde`) para interoperar com `require` e `import`.

### Convenções que atravessam o código

**Contrato dos validators.** Todos seguem o mesmo formato: `new Validator(entrada)` → `isValid()` → `getValues()` / `getError()`. `isValid()` **muta o estado interno** — é onde acontecem a conversão PFX→PEM, o zero-padding do NSU (`ZeroPad.padNsu`, 15 dígitos), o default de `idLote` (`'1'`) e o de `timezone` (`'America/Sao_Paulo'`). Chamar `getValues()` sem antes chamar `isValid()` devolve dados crus. Novos validators devem seguir esse mesmo contrato.

**Onde o erro aparece.** Problemas de configuração e de argumento **lançam** (`throw new Error(validator.getError())`) de forma síncrona, dentro do construtor ou do método público. Problemas de rede/SEFAZ **não lançam**: `SefazService.request` captura tudo e devolve `{status, data:'<error>…</error>'}` (504 para `ECONNABORTED`, 502 quando não houve resposta, 500 no resto), e `RetornoHelper` transforma isso em `{ data: {}, error, reqXml, resXml, status }`. Preservar essa separação.

**Imutabilidade.** Praticamente todo módulo exporta `Object.freeze(Classe)`, e as instâncias de `apis/` congelam `this` e `this.config`. Existem testes que asseguram isso (`assert.throws` ao sobrescrever um método estático). Consequência prática: `requestOptions` e `httpsOptions` chegam congelados no `SefazService`, que precisa copiá-los (`{ ...opts.httpsOptions }`) antes de mesclar — foi exatamente a origem do bug #22 (`Cannot add property rejectUnauthorized, object is not extensible`).

**Assinatura digital.** Só a recepção de evento assina. `RecepcaoHelper.montarRequest` assina cada `infEvento` individualmente com `xml-crypto` (referência `//*[local-name(.)='infEvento']`, assinatura inserida _depois_ do nó) e depois faz _splice de string_ nos blocos `<evento versao="1.00">…` para montar o lote dentro de um único `<envEvento>`. Mexer no formato do XML gerado pelo schema pode quebrar esse recorte por `indexOf`.

**Ambiente.** `tpAmb` é string: `'1'` produção, `'2'` homologação. É a chave dos mapas em `env/distribuicao.js` e `env/recepcao.js`.

**Idioma e mensagens.** Domínio, nomes de arquivo/classe e mensagens de erro são em português. As mensagens são comparadas **literalmente** nos testes (`assert.strictEqual(err.message, 'NSU não informado.')`) — alterar o texto quebra testes.

**Estilo.** Prettier: sem ponto e vírgula, aspas simples, 2 espaços, trailing comma `es5`. Todo módulo começa com `'use strict'`. Sem TypeScript no fonte: a tipagem pública vem dos blocos JSDoc nas classes de `src/apis/` — atualizá-los ao mudar a API pública, pois é deles que sai o `dist/index.d.ts`.

## Release

A publicação é feita pela CI, em `.github/workflows/publicar.yml`, disparada quando um **release é publicado no GitHub** — não em push na `main`.

1. Mover as mudanças de `[Não publicado]` para uma seção versionada e datada no `CHANGELOG.md` (formato `## [x.y.z] / AAAA-MM-DD`, com subseção `### Segurança` quando for só bump de dependências).
2. Bumpar `version` no `package.json`.
3. `npm run build` (regenera `src/env/version.js`, que é commitado).
4. Commit `release x.y.z` e push na `main`.
5. Criar o release no GitHub com a tag `vx.y.z`. O `v` é obrigatório: o workflow compara a tag com o `package.json` e aborta se divergirem, porque versão publicada no npm não se reescreve.

O workflow refaz o build antes de publicar, então `lib/` e `dist/` saem sempre do fonte daquela tag. O passo 3 continua necessário mesmo assim, porque `src/env/version.js` é commitado e alimenta o header `User-Agent: bitmde/<version>` — há um guard que reprova o release se ele estiver defasado. O guard compara o **valor** de `VERSION`, e não os bytes do arquivo: ele está em LF no índice e o build o reescreve em CRLF, então um `git diff` acusaria diferença em toda execução.

`npm run release` (`git pull && npm run build && npm publish`) é o caminho manual, mantido para a publicação de bootstrap descrita abaixo. Fora dela, publicar da máquina fura o guard de tag e sai sem provenance.

O que vai no pacote é decidido pelo campo **`files`** do `package.json` (`lib/`, `dist/`, `CHANGELOG.md` — mais `package.json`, `README.md` e `LICENSE`, que o npm inclui sempre). É uma allowlist: **silêncio significa exclusão**, então arquivo ou pasta nova na raiz fica fora por padrão, e publicar algo novo exige acrescentá-lo ao `files` de propósito. **Não reintroduzir `.npmignore`** — removido na 0.16.0, com `files` presente ele não decidiria nada e só criaria dúvida sobre qual dos dois manda.

`exports` fecha a superfície pública na raiz: deep import (`@bitize/bitmde/lib/...`) falha com `ERR_PACKAGE_PATH_NOT_EXPORTED`. A entrada `"./package.json"` é obrigatória, `types` tem de vir antes de `require`/`default`, e `main`/`types` continuam declarados para bundler antigo.

O workflow confere o conteúdo do tarball depois do build e reprova o release se algo proibido entrar ou algo essencial sumir. Conferir localmente com `npm pack --dry-run`. Detalhes em [ADR 0011](.docs/arquitetura/decisoes/0011-files-e-exports-como-contrato-de-empacotamento.md).

### Registro e credencial

Publicado no **npmjs.com** como pacote escopado público, sob a org `bitize`. `publishConfig.access: "public"` é obrigatório e não pode ser removido: pacote escopado nasce `restricted`, e sem essa flag o `npm publish` falha exigindo plano pago. Publicar públicos no npm é gratuito; só pacote privado é cobrado.

A autenticação é por **Trusted Publishing (OIDC)**, sem `NPM_TOKEN` guardado como secret: o npm troca o token de identidade emitido pelo GitHub por uma credencial de curta duração. Por isso o workflow declara `permissions: id-token: write` — tirar essa linha quebra a publicação por falta de credencial. O efeito colateral desejável é o **provenance**, gerado automaticamente (dispensa `--provenance`), que vira selo verificado na página do pacote. Exige `npm >= 11.5.1`, posterior ao npm que acompanha o Node 22, daí o passo que atualiza o npm antes de tudo.

O trusted publisher é configurado na página do pacote no npmjs.com (Settings → Trusted Publisher → GitHub Actions), apontando `bitize/bitmde` e o arquivo `publicar.yml`. Renomear esse arquivo invalida a configuração do lado do npm. Como a tela só existe para pacote já publicado, a **primeira** publicação de um nome precisa sair de uma máquina, com `npm run release`; da segunda em diante é sempre a CI. **Renomear o pacote refaz esse ciclo** — o nome novo nasce sem trusted publisher configurado —, e foi o que aconteceu duas vezes: na 0.15.0 (`@bitize/bit-mde`) e na renomeação para `@bitize/bitmde`.
