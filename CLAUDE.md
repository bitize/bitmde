# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Biblioteca Node.js (CommonJS, JS puro com tipagem via JSDoc) que consome quatro Web Services SOAP da SEFAZ e duas APIs REST da NFS-e Nacional:

- **NFeDistribuicaoDFe** — consulta de documentos destinados a um CNPJ/CPF (por `ultNSU`, `NSU` ou `chNFe`).
- **CTeDistribuicaoDFe** (AN) e **MDFeDistribuicaoDFe** (SVRS) — o mesmo para CT-e e MDF-e, só por `ultNSU` e `NSU`, pelas classes `DistribuicaoCTe` e `DistribuicaoMDFe` sobre o mesmo schema/helper/controller da NF-e, parametrizado pelo descritor `DOCUMENTOS` ([ADR 0010](.docs/arquitetura/decisoes/0010-distribuicao-parametrizada-por-documento.md)).
- **NFeRecepcaoEvento4** — envio de lote de eventos de manifestação do destinatário.
- **ADN — distribuição para contribuintes** — NFS-e e eventos em que um CNPJ figura (por `ultNSU`, `NSU` ou chave), em REST/JSON com mTLS, pela classe `DistribuicaoNFSe` ([ADR 0015](.docs/arquitetura/decisoes/0015-nfse-nacional-no-proprio-bitmde.md)).
- **SEFIN Nacional — pedido de registro de evento** — Confirmação (`e203202`) e Rejeição (`e203206`) do tomador, um `pedRegEvento` assinado e gzipado num `POST` JSON, pela classe `ManifestacaoNFSe`.

Publicada no npm como `@bitize/bitmde` (pacote escopado, `publishConfig.access: public`); o remote é `bitize/bitmde` (fork de `lucashpmelo/node-mde`, publicado como `node-mde` até a 0.14.13 e como `@bitize/bit-mde` até a 0.16.0). O `README.md` é a documentação pública da API e deve ser atualizado junto com mudanças de assinatura.

## Documentação interna (`.docs/`)

Este arquivo é o resumo operacional. O detalhamento vive em `.docs/`, que não vai no pacote publicado:

- `.docs/arquitetura/` — como cada camada funciona ([camadas/](.docs/arquitetura/camadas/)), os fluxos de ponta a ponta ([fluxos/](.docs/arquitetura/fluxos/)) e o processo de [teste](.docs/arquitetura/testes-e-certificados.md), [build](.docs/arquitetura/build-e-versao.md) e [release](.docs/arquitetura/release.md).
- `.docs/arquitetura/decisoes/` — ADRs numerados: o **porquê** das escolhas estruturais. Consultar antes de propor mudança que contrarie uma invariante.
- `.docs/conhecimento/` — material externo da SEFAZ.
- `.docs/tarefas/` — tarefas versionadas, ciclo `rascunhos → especificadas → concluidas | canceladas`. Fluxo em [.docs/tarefas/README.md](.docs/tarefas/README.md), modelo em [.docs/tarefas/\_modelos/modelo-de-tarefa.md](.docs/tarefas/_modelos/modelo-de-tarefa.md). Para criar ou promover uma tarefa, usar a skill [criar-tarefa](.claude/skills/criar-tarefa/SKILL.md); para implementá-la até o PR e concluí-la, a skill [executar-tarefa](.claude/skills/executar-tarefa/SKILL.md).
- `.docs/planos/` — objetivo que se decompõe em duas ou mais tarefas filhas, mesmo ciclo (`rascunhos → especificados → concluidos | cancelados`). As filhas ficam em `.docs/tarefas/`, com o campo **Plano** no cabeçalho, e no GitHub são sub-issues da issue do plano. Fluxo em [.docs/planos/README.md](.docs/planos/README.md). Para criar ou promover um plano, usar a skill [criar-plano](.claude/skills/criar-plano/SKILL.md); para conduzir as filhas e fechá-lo, a skill [executar-plano](.claude/skills/executar-plano/SKILL.md).

Regra de fronteira: aqui ficam as regras que, ignoradas, quebram build/teste/release; em `.docs/arquitetura/` fica a explicação de como as coisas funcionam. Não duplicar — critério completo em [.docs/arquitetura/ESTRUTURA.md](.docs/arquitetura/ESTRUTURA.md).

`.docs` não vai no pacote publicado (o `files` do `package.json` só lista `lib/`, `dist/` e `CHANGELOG.md`), mas **não** está no `.prettierignore`: o Markdown de lá passa pelo `format:check`. Rodar `npm run format` depois de mexer em doc.

## Comandos

```sh
npm test                        # mocha sobre ./test (exige ./certs — ver abaixo)
npm run test:ci                 # tudo menos sefaz.test.js e tls-sefaz.test.js (o que a CI roda)
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

Sem `certs/`, ainda é possível rodar isoladamente: `test/xml.test.js`, `test/gzip.test.js`, `test/zeroPad.test.js`, `test/data.test.js`, `test/distribuicaoDFe-helper.test.js`, `test/distribuicaoNFSe-helper.test.js`, `test/nfse-validators.test.js`, `test/ca.test.js`, `test/transporte.test.js` (servidor HTTPS local, sem rede externa), `test/tipos.test.js` (gera o `.d.ts` e compila um consumidor TS) e `test/tls-sefaz.test.js` (exige rede).

Quem não tem um A1 em mãos pode rodar `npm run certs:teste`, que gera um autoassinado descartável e libera tudo menos `sefaz.test.js` (272 dos 294 testes). O script **aborta se `certs/` já existir**, para não sobrescrever um certificado real. Dois detalhes do `scripts/gerar-certificado-teste.sh` são load-bearing e não devem ser "simplificados": o `.pfx` precisa ser gerado com `-keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES` porque o node-forge não decifra o padrão AES-256 do OpenSSL 3; e os `.pem` são normalizados para CRLF porque `certificado.test.js` compara byte a byte com a saída do forge, que usa CRLF, enquanto o OpenSSL escreve LF no Linux.

`test/sefaz.test.js` é um teste de integração real: bate nos endpoints de produção **e** homologação da SEFAZ e do ADN com mTLS, e falha sem rede ou com certificado vencido. No ADN ele só lê, e tira o CNPJ do CN do `certs/cert.pem` — não escrever CNPJ real em teste. Na SEFIN ele só manda pedido que é rejeitado (chave inventada, `E1831`): Confirmação ou Rejeição aceita registra evento fiscal irreversível e **não entra na suíte**. Com A1 real, a conversão PFX→PEM leva perto de 2 s e pode estourar o timeout padrão do mocha nos testes de construtor com PFX; `--timeout 15000` separa isso de falha real. `test/tls-sefaz.test.js` só faz o handshake TLS com os hosts da NF-e, do CT-e, do MDF-e, do ADN e da SEFIN, sem A1, e falha de propósito se a ICP-Brasil sozinha voltar a fechar a cadeia de um deles — menos os da SVRS (MDF-e), que servem cadeia ICP-Brasil e precisam fechar só com ela. Na distribuição de CT-e e MDF-e o `sefaz.test.js` consulta só homologação: consulta por NSU em produção move o ponteiro da SEFAZ para o CNPJ. Os dois são os únicos excluídos do `test:ci`.

### CI

Dois workflows em push e PR na `main`:

- `.github/workflows/testes.yml` — matriz Node 22/24: `npm ci` → `npm run certs:teste` → `npm run test:ci`. A matriz é pulada quando todos os arquivos alterados são `**/*.md`, `.docs/**`, `.claude/**` ou `LICENSE`; o job `Testes` roda sempre e consolida o resultado.
- `.github/workflows/qualidade.yml` — dois jobs paralelos em Node 22: `npm run format:check` (Prettier) e `npm run build`. Roda sempre, inclusive em PR só de docs: é o Prettier que valida o Markdown.

A `main` é protegida por dois rulesets: um sem bypass que bloqueia deleção e force-push, e outro que exige PR e os checks `Prettier`, `Build` e `Testes`, com bypass para admin (é por ele que o commit de release vai direto na `main`). **Não voltar a usar `paths-ignore` no `testes.yml`**: workflow pulado por filtro de caminho não reporta status, e PR só de docs ficaria preso em "Expected — Waiting for status". Pelo mesmo motivo, o check obrigatório é `Testes`, e não `Node 22.x`/`Node 24.x` — job de matriz pulado reporta o nome sem expandir. Renomear um job obrigatório exige atualizar o ruleset junto. Detalhes em [testes-e-certificados.md](.docs/arquitetura/testes-e-certificados.md#proteção-da-main). O `publicar.yml` não tem filtro e roda os testes antes de todo release.

Mais um em release publicado, descrito em [Release](#release):

- `.github/workflows/publicar.yml` — confere tag e `version.js`, roda testes, build, confere o conteúdo do tarball e `npm publish`.

E um agendado, toda segunda-feira e sob demanda:

- `.github/workflows/cadeia-tls.yml` — Node 24, `npm ci` → `npx mocha test/tls-sefaz.test.js`. Avisa (pelo e-mail padrão do GitHub) quando o Ambiente Nacional trocar de cadeia.

Os quatro usam `npm ci` com `cache: npm` no `setup-node`. Ambos exigem `package-lock.json` versionado, e ele é — **não voltar a ignorá-lo**: sem lockfile, `npm ci` falha de imediato em todos os workflows, e o pacote publicado passaria a ser montado com dependências resolvidas na hora do run, sem reprodutibilidade. Como consequência, bump de dependência agora é mudança de dois arquivos: `package.json` e `package-lock.json`, no mesmo commit.

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
      └ services/sefaz-service.js  instância axios + https.Agent com mTLS, TLS validado por padrão
      └ helpers/retorno-helper.js  formato final da NF-e { data, reqXml, resXml, status, error?, transportError? }
      └ helpers/retornoNfse-helper.js  formato final da NFS-e { data, reqXml?, resBody, status, error?, transportError? }
env/           constantes: endpoints por tpAmb (NF-e, CT-e, MDF-e, NFSE_ADN e NFSE_SEFIN), DOCUMENTOS (descritores da distribuição), EVENTOS_NFSE, CA (ICP-Brasil) e CA_PADRAO (raízes do Node + ICP-Brasil), EVENTOS, CODIGOS_UF, ZONES, VERSION
```

`src/index.js` exporta `DistribuicaoCTe`, `DistribuicaoDFe`, `DistribuicaoMDFe`, `DistribuicaoNFSe`, `ManifestacaoNFSe`, `RecepcaoEvento`, `CA_PADRAO` e `CA_ICP_BRASIL` (estes dois congelados) em três formas (`module.exports`, `.default`, `.mde`) para interoperar com `require` e `import`.

Na NFS-e não há `schemas/` nem envelope: o helper monta a config de um `GET` do axios (`Accept` e `responseType: 'text'` na requisição, não em `requestOptions`) e lê JSON. O retorno é do `RetornoNfseHelper`, não do `RetornoHelper`: `resBody` no lugar de `reqXml`/`resXml`, fila vazia (HTTP 404, `NENHUM_DOCUMENTO_LOCALIZADO`) **sem** `error`, e rejeição com `data` mantido. `error` sai do HTTP e do `Erros` do ADN, não só do `StatusProcessamento`, que vem `DOCUMENTOS_LOCALIZADOS` até na rejeição E2243 ([ADR 0016](.docs/arquitetura/decisoes/0016-retorno-proprio-da-nfse.md)).

A manifestação da NFS-e tem schema (`pedRegEvento` v1.01) e assinatura, mas não tem envelope: o helper monta um `POST` JSON com o XML assinado em gzip+base64 e reaproveita o `RetornoNfseHelper` com `servico: 'SEFIN'` e `reqXml`. O `pedRegEvento` leva `<?xml version="1.0" encoding="UTF-8"?>` na frente — sem ela a SEFIN rejeita com `E1229` —, e o `erro` da SEFIN chega como **array**, apesar do Swagger dizer objeto.

### Convenções que atravessam o código

**Contrato dos validators.** Todos seguem o mesmo formato: `new Validator(entrada)` → `isValid()` → `getValues()` / `getError()`. `isValid()` **muta o estado interno** — é onde acontecem a conversão PFX→PEM, o zero-padding do NSU (`ZeroPad.padNsu`, 15 dígitos), o default de `idLote` (`'1'`) e o de `timezone` (`'America/Sao_Paulo'`). Chamar `getValues()` sem antes chamar `isValid()` devolve dados crus. Novos validators devem seguir esse mesmo contrato.

**Onde o erro aparece.** Problemas de configuração e de argumento **lançam** (`throw new Error(validator.getError())`) de forma síncrona, dentro do construtor ou do método público. Problemas de rede/SEFAZ **não lançam**: `SefazService.request` captura tudo. Resposta HTTP de erro passa com o status real; sem resposta HTTP, devolve `{ status: 0, data: '', transportError: { code, message } }`, e `RetornoHelper` transforma isso em `{ data: {}, error: 'Falha de transporte (<code>): <message>', transportError, reqXml, resXml: '', status: 0 }`. Nenhum status é sintetizado. Do erro do axios saem **só** `code` e `message`: ele carrega `config.httpsAgent`, com a chave do A1. Preservar essa separação ([ADR 0014](.docs/arquitetura/decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md)).

**Imutabilidade.** Praticamente todo módulo exporta `Object.freeze(Classe)`, e as instâncias de `apis/` congelam `this` e `this.config`. Existem testes que asseguram isso (`assert.throws` ao sobrescrever um método estático). Consequência prática: `requestOptions` e `httpsOptions` chegam congelados no `SefazService`, que precisa copiá-los (`{ ...opts.httpsOptions }`) antes de mesclar — foi exatamente a origem do bug #22 (`Cannot add property rejectUnauthorized, object is not extensible`).

**TLS.** O padrão do agente é `{ ca: CA_PADRAO, rejectUnauthorized: true }`, e `httpsOptions` sobrescreve tudo. `CA_PADRAO` soma as raízes do Node (`tls.getCACertificates('default')`, ou `tls.rootCertificates` no Node 22 anterior à 22.15) à ICP-Brasil, porque a opção `ca` do Node **substitui** as raízes padrão. Passar só a ICP-Brasil quebra o handshake com o Ambiente Nacional, cuja cadeia hoje é GlobalSign.

**Assinatura digital.** Assinam a recepção de evento da NF-e e a manifestação da NFS-e, com a mesma `Assinatura.assinarXml` (RSA-SHA1, digest SHA1, C14N); o quarto parâmetro escolhe o elemento (`'infEvento'` por padrão, `'infPedReg'` na NFS-e), e `test/assinatura.test.js` congela o lote da NF-e para provar que a chamada de três argumentos não mudou um byte. `RecepcaoHelper.montarRequest` assina cada `infEvento` individualmente com `xml-crypto` (referência `//*[local-name(.)='infEvento']`, assinatura inserida _depois_ do nó) e depois faz _splice de string_ nos blocos `<evento versao="1.00">…` para montar o lote dentro de um único `<envEvento>`. Mexer no formato do XML gerado pelo schema pode quebrar esse recorte por `indexOf`.

**Ambiente.** `tpAmb` é string: `'1'` produção, `'2'` homologação (produção restrita, na NFS-e). É a chave dos mapas em `env/distribuicao.js`, `env/recepcao.js` e `env/nfse.js`.

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

Logo antes do `npm publish` há um guard que consulta o npm e **pula a publicação** se aquela versão já está no registro — é o que permite criar o release no GitHub para uma versão de bootstrap sem quebrar o workflow, e o que faz re-run de release terminar verde. Ele testa a **saída** do `npm view`, não o código de saída, porque isso mudou entre versões do npm. Ver [release.md](.docs/arquitetura/release.md).

### Registro e credencial

Publicado no **npmjs.com** como pacote escopado público, sob a org `bitize`. `publishConfig.access: "public"` é obrigatório e não pode ser removido: pacote escopado nasce `restricted`, e sem essa flag o `npm publish` falha exigindo plano pago. Publicar públicos no npm é gratuito; só pacote privado é cobrado.

A autenticação é por **Trusted Publishing (OIDC)**, sem `NPM_TOKEN` guardado como secret: o npm troca o token de identidade emitido pelo GitHub por uma credencial de curta duração. Por isso o workflow declara `permissions: id-token: write` — tirar essa linha quebra a publicação por falta de credencial. O efeito colateral desejável é o **provenance**, gerado automaticamente (dispensa `--provenance`), que vira selo verificado na página do pacote. Exige `npm >= 11.5.1`, posterior ao npm que acompanha o Node 22, daí o passo que atualiza o npm antes de tudo.

O trusted publisher é configurado na página do pacote no npmjs.com (Settings → Trusted Publisher → GitHub Actions), apontando `bitize/bitmde` e o arquivo `publicar.yml`. Renomear esse arquivo invalida a configuração do lado do npm. Como a tela só existe para pacote já publicado, a **primeira** publicação de um nome precisa sair de uma máquina, com `npm run release`; da segunda em diante é sempre a CI. **Renomear o pacote refaz esse ciclo** — o nome novo nasce sem trusted publisher configurado —, e foi o que aconteceu duas vezes: na 0.15.0 (`@bitize/bit-mde`) e na renomeação para `@bitize/bitmde`.
