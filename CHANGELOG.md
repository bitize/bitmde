# Changelog

## [Não publicado]

### Modificado

- **Pacote renomeado de `@bitize/bit-mde` para `@bitize/bitmde`** — atualize a instalação e os `require`/`import`. A API pública permanece inalterada. Ver [ADR 0012](https://github.com/bitize/bitmde/blob/main/.docs/arquitetura/decisoes/0012-renomeacao-para-bitize-bitmde.md)
- Repositório renomeado para [bitize/bitmde](https://github.com/bitize/bitmde). O GitHub redireciona as URLs antigas, mas atualize o remote: `git remote set-url origin https://github.com/bitize/bitmde.git`
- `@bitize/bit-mde` passa a ser **deprecado no npm, não despublicado**: a 0.15.0 e a 0.16.0 continuam instaláveis, com aviso apontando para o nome novo
- O header `User-Agent` enviado à SEFAZ passa de `bit-mde/<versão>` para `bitmde/<versão>`

### Compatibilidade

Nenhuma assinatura da API pública muda — mesma classe, mesmos métodos, mesmo formato de retorno. A migração é trocar o nome do pacote em dois lugares:

```diff
-npm i @bitize/bit-mde
+npm i @bitize/bitmde
```

```diff
-const { DistribuicaoDFe } = require('@bitize/bit-mde')
+const { DistribuicaoDFe } = require('@bitize/bitmde')
```

> Esta versão sai de uma **publicação manual, sem provenance**. Para o npm, o nome novo é um pacote novo, e a tela que configura o trusted publisher só existe para pacote já publicado — a mesma situação da 0.15.0. Da versão seguinte em diante volta a ser publicada pela CI.

## [0.16.0] / 2026-08-16

### Adicionado

- `files` no `package.json`, declarando explicitamente o que é publicado: `lib/`, `dist/` e `CHANGELOG.md`, mais `package.json`, `README.md` e `LICENSE`, que o npm sempre inclui. O tarball deixa de carregar `CLAUDE.md`, `AGENTS.md`, `.prettierignore`, `CODE_OF_CONDUCT.md` e `CONTRIBUTING.md`, que vinham na 0.15.0 — 86 arquivos passam a 82
- `exports` no `package.json`, fechando a superfície pública na raiz do pacote. `main` e `types` seguem declarados, para quem não entende `exports`
- A CI de publicação passa a conferir o conteúdo do tarball antes do `npm publish`, reprovando o release se um arquivo proibido entrar ou um essencial sumir

> **Primeira versão publicada pela CI**, com provenance. A 0.15.0 saiu de uma publicação manual, porque a configuração do trusted publisher no npm exige o pacote já publicado — a entrada daquela versão anuncia isso "a partir da 0.15.1", número que acabou não existindo.

### Modificado

- `.npmignore` removido. O que vai no pacote passa a ser decidido só pelo `files`, que tem precedência sobre ele — manter os dois deixaria duas fontes de verdade para a mesma pergunta, com a de menor precedência dando a resposta errada. Ver [ADR 0011](https://github.com/bitize/bit-mde/blob/main/.docs/arquitetura/decisoes/0011-files-e-exports-como-contrato-de-empacotamento.md)

### Compatibilidade

Nenhuma assinatura da API pública muda, e a importação documentada no `README.md` continua idêntica — `require('@bitize/bit-mde')`, `import` e as três formas (`module.exports`, `.default`, `.mde`) funcionam como antes, assim como `require('@bitize/bit-mde/package.json')`.

O que deixa de funcionar é o **deep import**: `require('@bitize/bit-mde/lib/validators/nsu-validator')` e similares passam a falhar com `ERR_PACKAGE_PATH_NOT_EXPORTED`. Nunca foi uso documentado, mas era possível na ausência do `exports` — daí o bump de minor. Quem dependia disso precisa passar pela raiz do pacote.

## [0.15.0] / 2026-08-16

- Projeto passa a ser mantido pela Bitize em [bitize/bit-mde](https://github.com/bitize/bit-mde), como fork de [lucashpmelo/node-mde](https://github.com/lucashpmelo/node-mde)
- Pacote renomeado de `node-mde` para `@bitize/bit-mde` — atualize a instalação e os `require`/`import`. A API pública permanece inalterada
- `README.md` passa a referenciar o [BitERP](https://www.biterp.ai), produto que mantém e utiliza a biblioteca
- Pacote passa a ser publicado pela CI, com provenance: cada versão no npm fica vinculada de forma verificável ao commit e ao workflow que a produziu. Vale a partir da 0.15.1 — esta versão saiu de uma publicação manual, porque a configuração do trusted publisher no npm exige o pacote já publicado

### Segurança

- Atualizadas as dependências npm, zerando as 7 vulnerabilidades reportadas pelo `npm audit` (1 crítica, 5 altas, 1 moderada):
  - `axios` 1.8.3 → 1.19.0
  - `fast-xml-parser` 4.5.3 → 5.11.0
  - `node-forge` 1.3.1 → 1.4.0
  - `xml-crypto` 2.1.6 → 6.1.2, que traz `@xmldom/xmldom` 0.8.14
- Adicionado `overrides` para `diff` e `serialize-javascript`, dependências transitivas do `mocha` (somente desenvolvimento) cujas versões corrigidas estão fora do range declarado pelo próprio `mocha`

### Modificado

- `Assinatura.assinarXml` adaptada à API do `xml-crypto` 6: as opções passam pelo construtor (`privateKey`, `publicCert`, `getKeyInfoContent`) e `addReference` recebe um objeto. Os algoritmos exigidos pela NF-e (`rsa-sha1` e digest `sha1`) agora são informados explicitamente, pois deixaram de ser o padrão da biblioteca a partir da v3. O XML assinado gerado permanece byte a byte idêntico ao das versões anteriores
- Dependências de desenvolvimento: `mocha` 10 → 11, `@types/node` 22 → 26. Removido `@types/xml-crypto`, que se tornou desnecessário porque o `xml-crypto` 6 já publica seus próprios tipos
- Reflexo do `@types/node` 26 no `dist/index.d.ts`: `import('https').AgentOptions` passou a ser emitido como `import('node:https').AgentOptions` — equivalente para qualquer consumidor com `@types/node` >= 16

## [0.14.13] / 2025-04-23

- Node lançando erro `TypeError: Cannot add property rejectUnauthorized, object is not extensible` #22

## [0.14.12] / 2025-04-17

- Ambiente de Produção retornando `unable to get local issuer certificate`

## [0.14.11] / 2025-03-18

### Segurança

- Atualizado as dependências npm

## [0.14.10] / 2024-10-24

### Segurança

- Atualizado as dependências npm

## [0.14.9] / 2024-05-08

### Segurança

- Atualizado as dependências npm

## [0.14.8] / 2024-01-15

### Segurança

- Atualizado as dependências npm

## [0.14.7] / 2023-10-30

### Segurança

- Atualizado as dependências npm

## [0.14.6] / 2023-09-19

### Segurança

- Atualizado as dependências npm

## [0.14.5] / 2023-07-28

### Corrigido

- Arquivo `.pfx` com lista de certificados invertida

## [0.14.4] / 2023-07-19

### Modificado

- Atualizado README.md

### Segurança

- Atualizado as dependências npm

## [0.14.3] / 2023-06-08

### Segurança

- Atualizado as dependências npm

## [0.14.2] / 2023-04-17

### Segurança

- Atualizado as dependências npm

## [0.14.1] / 2023-02-21

### Segurança

- Atualizado as dependências npm

## [0.14.0] / 2023-01-14

### Adicionado

- Testes Unitários #8

### Modificado

- Estruturação do código para ser possível testar cada módulo separadamente

### Segurança

- Atualizado as dependências npm

## [0.13.0] / 2022-11-29

### Modificado

- Biblioteca para lidar com datas e horas #7

## [0.12.0] / 2022-11-24

### Corrigido

- Método `consultaNSU` #4

### Segurança

- Atualizado as dependências npm

## [0.11.0] / 2022-08-20

### Adicionado

- Suporte para CPF nos serviços de `DistribuicaoDFe` e `RecepcaoEvento` #2
- Suporte para o tipo Buffer nas propriedades `cert` e `key` #3

### Corrigido

- Types

## [0.10.1] / 2022-08-15

### Adicionado

- ISSUE_TEMPLATE
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md

### Corrigido

- Imutabilidade
- Types

### Modificado

- .npmignore

## [0.10.0] / 2022-08-11

### Adicionado

- Imutabilidade aos serviços de `DistribuicaoDFe` e `RecepcaoEvento`

### Corrigido

- Types

### Modificado

- Os métodos `consultaUltNSU`, `consultaChNFe`, `consultaNSU` e `enviarEvento` agora são funções puras e não alteram mais o objeto construído

## [0.9.2] / 2022-06-24

### Corrigido

- Types

## [0.9.1] / 2022-06-21

### Corrigido

- Campos faltantes no retorno do serviço de RecepcaoEvento
- Types

## [0.9.0] / 2022-06-21

### Corrigido

- Assinatura XML
- Types

### Modificado

- O retorno dos serviços de DistribuicaoDFe e RecepcaoEvento

## [0.8.0] / 2022-06-14

### Adicionado

- VS Code settings e prettier.config.js

### Corrigido

- Types
- Palavra-chave

### Modificado

- O serviço de RecepcaoEvento foi modificado para aceitar um lote de eventos, agora deve ser enviado uma lista de eventos para a função enviarEvento, e o retorno será uma lista dos eventos processados

## [0.7.3] / 2022-06-10

### Corrigido

- Montagem do Esquema XML de RecepcaoEvento

## [0.7.2] / 2022-06-10

### Corrigido

- Script para build do código

### Modificado

- A chave NFe não é mais passada no construtor do serviço de RecepcaoEvento, agora ela deve ser enviada na função de enviarEvento junto com o tipoEvento e justificativa
- URL do Web Service de Recepção Evento do Ambiente de produção

## [0.7.1] / 2022-06-09

### Modificado

- Simplificado o nome das funções de consulta do serviço de DistribuicaoDFe
  - consultaPorUltNSU => consultaUltNSU
  - consultaPorChaveNFe => consultaChNFe
  - consultaPorNSU => consultaNSU

### Segurança

- Atualizado as dependências npm

## [0.7.0] / 2022-06-09

### Adicionado

- Cadeia de Certificados da NF-e (www1.nfe.fazenda.gov.br)
- Suporte SOAP 1.2

### Corrigido

- Script para build do código

### Modificado

- URL do Web Service de Recepção Evento do Ambiente de homologação conforme publicado no informe dia 20/05/2022

### Removido

- Suporte SOAP 1.1

## [0.6.0] / 2022-04-28

### Modificado

- Biblioteca para geração de XML

## [0.5.0] / 2022-04-28

### Corrigido

- Script para build do código
- Retorno da Sefaz
- Types

### Modificado

- Consulta por último NSU

## [0.4.1] / 2022-04-25

### Corrigido

- Types

## [0.4.0] / 2022-04-25

### Adicionado

- Script para minificação do código
- Script para build do código (Gera os types e o código minificado)
- .npmignore

### Corrigido

- Palavra-chave

### Removido

- Types do repositório Git
- src do repositório NPM
- tsconfig.json do repositório NPM

## [0.3.0] / 2022-04-22

### Adicionado

- Descrição e Palavra-chave
- README.md Resumido

## [0.2.2] / 2022-04-22

### Corrigido

- Types

## [0.2.1] / 2022-04-22

### Corrigido

- Types

## [0.2.0] / 2022-04-22

### Adicionado

- Types

### Corrigido

- Otimizado código de comunicação com o Web Service

## [0.1.0] / 2022-04-20

### Adicionado

- Comunicação com o Web Service de NFeDistribuicaoDFe (Nota Técnica 2014.002 - v.1.12)
  - Processamento da Requisição de Distribuição de Conjunto de DF-e a Partir do NSU Informado (distNSU)
  - Processamento da Requisição de Consulta DF-e Vinculado ao NSU Informado (consNSU)
  - Processamento da Requisição de Consulta de NF-e por Chave de Acesso Informada (consChNFe)
- Comunicação com o Web Service de NFeRecepcaoEvento4 (Nota Técnica 2020.001 v.1.20)
  - 210200 - Confirmação da Operação
  - 210210 - Ciência da Operação
  - 210220 - Desconhecimento da Operação
  - 210240 - Operação não Realizada

Os links das versões até a `0.14.13` apontam para o repositório original, [lucashpmelo/node-mde](https://github.com/lucashpmelo/node-mde), onde essas versões foram publicadas.

[não publicado]: https://github.com/bitize/bit-mde/commits/main
[0.14.13]: https://github.com/lucashpmelo/node-mde/compare/0.14.12...0.14.13
[0.14.12]: https://github.com/lucashpmelo/node-mde/compare/0.14.11...0.14.12
[0.14.11]: https://github.com/lucashpmelo/node-mde/compare/0.14.10...0.14.11
[0.14.10]: https://github.com/lucashpmelo/node-mde/compare/0.14.9...0.14.10
[0.14.9]: https://github.com/lucashpmelo/node-mde/compare/0.14.8...0.14.9
[0.14.8]: https://github.com/lucashpmelo/node-mde/compare/0.14.7...0.14.8
[0.14.7]: https://github.com/lucashpmelo/node-mde/compare/0.14.6...0.14.7
[0.14.6]: https://github.com/lucashpmelo/node-mde/compare/0.14.5...0.14.6
[0.14.5]: https://github.com/lucashpmelo/node-mde/compare/0.14.4...0.14.5
[0.14.4]: https://github.com/lucashpmelo/node-mde/compare/0.14.3...0.14.4
[0.14.3]: https://github.com/lucashpmelo/node-mde/compare/0.14.2...0.14.3
[0.14.2]: https://github.com/lucashpmelo/node-mde/compare/0.14.1...0.14.2
[0.14.1]: https://github.com/lucashpmelo/node-mde/compare/0.14.0...0.14.1
[0.14.0]: https://github.com/lucashpmelo/node-mde/compare/0.13.0...0.14.0
[0.13.0]: https://github.com/lucashpmelo/node-mde/compare/0.12.0...0.13.0
[0.12.0]: https://github.com/lucashpmelo/node-mde/compare/0.11.0...0.12.0
[0.11.0]: https://github.com/lucashpmelo/node-mde/compare/0.10.1...0.11.0
[0.10.1]: https://github.com/lucashpmelo/node-mde/compare/0.10.0...0.10.1
[0.10.0]: https://github.com/lucashpmelo/node-mde/compare/0.9.2...0.10.0
[0.9.2]: https://github.com/lucashpmelo/node-mde/compare/0.9.1...0.9.2
[0.9.1]: https://github.com/lucashpmelo/node-mde/compare/0.9.0...0.9.1
[0.9.0]: https://github.com/lucashpmelo/node-mde/compare/0.8.0...0.9.0
[0.8.0]: https://github.com/lucashpmelo/node-mde/compare/0.7.3...0.8.0
[0.7.3]: https://github.com/lucashpmelo/node-mde/compare/0.7.2...0.7.3
[0.7.2]: https://github.com/lucashpmelo/node-mde/compare/0.7.1...0.7.2
[0.7.1]: https://github.com/lucashpmelo/node-mde/compare/0.7.0...0.7.1
[0.7.0]: https://github.com/lucashpmelo/node-mde/compare/0.6.0...0.7.0
[0.6.0]: https://github.com/lucashpmelo/node-mde/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/lucashpmelo/node-mde/compare/0.4.1...0.5.0
[0.4.1]: https://github.com/lucashpmelo/node-mde/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/lucashpmelo/node-mde/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/lucashpmelo/node-mde/compare/0.2.2...0.3.0
[0.2.2]: https://github.com/lucashpmelo/node-mde/compare/0.2.1...0.2.2
[0.2.1]: https://github.com/lucashpmelo/node-mde/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/lucashpmelo/node-mde/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/lucashpmelo/node-mde/releases/tag/0.1.0
