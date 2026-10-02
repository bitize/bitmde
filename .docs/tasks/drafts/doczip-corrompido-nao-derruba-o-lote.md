# GH-NN: docZip corrompido não deve derrubar o lote da distribuição DF-e

| Campo                | Valor                               |
| -------------------- | ----------------------------------- |
| **Issue**            | GH-NN                               |
| **Status**           | drafts                              |
| **Prioridade**       | P1 (alto)                           |
| **Tipo**             | correção                            |
| **Camadas afetadas** | controllers / helpers / util / test |
| **Criado em**        | 2026-10-01                          |
| **Atualizado em**    | 2026-10-01                          |
| **Concluído em**     | —                                   |

---

## Contexto e motivação

`DistribuicaoHelper.montarResponse` descompacta todos os `docZip` do `loteDistDFeInt` num único `Promise.all`:

```js
const docZip = await Promise.all(
  loteDistDFeInt['docZip'].map(async (doc) => {
    const notaXml = await Gzip.unzip(doc.value)
    const notaJson = Xml.xmlToJson(notaXml)
    return {
      xml: notaXml,
      json: notaJson,
      nsu: doc['@_NSU'],
      schema: doc['@_schema'],
    }
  })
)
```

A intenção documentada é tudo-ou-nada: se **um** documento falhar, a Promise rejeita e `consultaUltNSU` / `consultaNSU` / `consultaChNFe` lançam. Isso já é ruim — o chamador perde o lote inteiro, inclusive `ultNSU` e `maxNSU` e os documentos válidos. Sem `ultNSU`, a varredura fica presa no mesmo NSU, e repetir a consulta é exatamente o padrão que a SEFAZ trata como consumo indevido e penaliza por CNPJ.

**O comportamento real é pior que o documentado.** Em [src/util/gzip.js](../../../src/util/gzip.js), o callback do `zlib.unzip` chama `reject(err)` mas não retorna, e segue para `buffer.toString('utf8')` com `buffer` `undefined`:

```js
zlib.unzip(buf, function (err, buffer) {
  if (err) reject(err)
  const content = buffer.toString('utf8') // TypeError quando houve erro
  resolve(content)
})
```

O `TypeError` é lançado dentro de um callback do zlib, fora de qualquer Promise, e vira `uncaughtException`. Reproduzido no Node 24 com `Gzip.unzip('bm90IGd6aXA=')` (base64 válido, gzip inválido): o processo termina com código 1 **antes** de o `.catch` do chamador rodar. Ou seja, hoje um `docZip` corrompido não lança para o chamador — **derruba o processo** de quem consome a biblioteca, a menos que ele tenha um handler global de `uncaughtException`. Por isso a prioridade P1, acima do médio da origem.

A [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) já registrava essa brecha como "exceção conhecida" à regra de que resposta da SEFAZ nunca lança, e já prescrevia o conserto: converter em erro no retorno, não relaxar a regra. Esta tarefa executa essa prescrição — e corrige a descrição da brecha, que nos docs aparece como "rejeita e propaga".

Origem: DEV-987 (rastreador interno da Bitize). O consumidor interno hoje contorna capturando a resposta bruta e reparseando com parser próprio; depois do release ele deve poder usar o retorno do pacote direto.

### Fora de escopo

- `Xml.xmlToJson` sobre o **envelope** da resposta (não o conteúdo de um `docZip`) também pode lançar quando o corpo não é XML — o `fast-xml-parser` lança em entradas como `'nao e xml <<'`. É o mesmo tipo de brecha, mas afeta também a recepção e merece tarefa própria.
- `rejectUnauthorized: false` como default do `https.Agent` — já listado como candidato a ADR em [decisoes/README.md](../../arquitetura/decisoes/README.md).
- Bump do pacote no consumidor interno.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [ ] [apis](../../arquitetura/camadas/apis.md) — sem impacto: os métodos de `apis/` não declaram `@returns`, o tipo sai do controller
- [ ] [validators](../../arquitetura/camadas/validators.md) — sem impacto
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — orquestração e formato de retorno
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — sem impacto: nada muda no XML enviado
- [ ] [services](../../arquitetura/camadas/services-sefaz.md) — sem impacto
- [ ] [env](../../arquitetura/camadas/env.md) — sem impacto
- [x] Fluxo: [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md)
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ ] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md) — sem impacto além do bump de minor
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                            | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| RF-01 | `Gzip.unzip` rejeita a Promise em `gzip`/base64 inválido **sem** gerar `uncaughtException`                                           | Must       |
| RF-02 | Cada `docZip` é processado isoladamente: a falha de um não impede o processamento dos demais                                         | Must       |
| RF-03 | Documentos válidos continuam em `data.docZip`, com o formato atual (`xml`, `json`, `nsu`, `schema`) e na ordem do lote               | Must       |
| RF-04 | Documentos que falharam vão para `data.docZipErrors: [{ nsu, schema, error }]`, na ordem do lote; `[]` quando nenhum falhar          | Must       |
| RF-05 | `tpAmb`, `verAplic`, `cStat`, `xMotivo`, `dhResp`, `ultNSU` e `maxNSU` são preenchidos mesmo quando algum — ou todo — `docZip` falha | Must       |
| RF-06 | Falha de `docZip` **não** preenche o `error` de topo nem esvazia `data`                                                              | Must       |
| RF-07 | Mensagens de `docZipErrors[].error` em português, com o texto exato definido abaixo                                                  | Must       |
| RF-08 | JSDoc do helper e do controller, `README.md`, `CHANGELOG.md` e docs de arquitetura descrevem `docZipErrors`                          | Must       |

## Decisões de design

### Decisão 1: tudo-ou-nada × resultado parcial

- **Opções consideradas:**
  - A. Manter tudo-ou-nada, só convertendo a rejeição em `error` de topo (`data: {}`);
  - B. Resultado parcial: válidos em `docZip`, falhas em campo separado, metadados do lote preservados;
  - C. Resultado parcial com a falha **dentro** de `docZip` (item com `error` no lugar de `xml`/`json`).
- **Escolha:** B.
- **Justificativa:** A cumpre a ADR 0004 ao pé da letra, mas joga fora `ultNSU`/`maxNSU` — e sem eles o chamador não avança a varredura, que é o problema real. C quebra o contrato atual de `docZip`: todo consumidor que hoje faz `doc.json.procNFe` sem checar passaria a receber itens sem `json`. B é aditivo — quem ignora o campo novo continua funcionando, só que agora com os documentos válidos em vez de com o processo morto.

Decisão com alternativa real e reversão custosa (forma do retorno público): registrar como **ADR 0013** — "Falha de `docZip` vira item de `docZipErrors` sem derrubar o lote". Ela **complementa** a ADR 0004 (cujo princípio não muda) e encerra a "exceção conhecida" lá registrada. A ADR 0004 não é editada; a 0013 cita o parágrafo que ela resolve. O número 0010 segue reservado pela GH-3.

### Decisão 2: nome e forma do campo

- **Opções consideradas:** `docZipErrors`, `docZipErros`, `falhas`.
- **Escolha:** `docZipErrors: [{ nsu, schema, error }]`.
- **Justificativa:** os nomes do retorno seguem duas fontes — os elementos da SEFAZ (`docZip`, `cStat`, `ultNSU`) e o campo `error`, já em inglês no topo do retorno desde o upstream. `docZipErrors` junta as duas: deixa explícito a que elemento se refere e reaproveita o termo que o consumidor já testa. Cada item usa `error` como **string**, como o `error` de topo ([ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)). `nsu` e `schema` recebem `|| ''`, como todo escalar do retorno.
- O base64 original **não** entra no item: está no `resXml`, que chega sempre preenchido, e duplicá-lo aumentaria o retorno sem ganho.

### Decisão 3: `Promise.allSettled` × try/catch por item

- **Opções consideradas:** `Promise.allSettled` e partição dos resultados; `Promise.all` sobre funções que nunca rejeitam (try/catch interno).
- **Escolha:** try/catch por item.
- **Justificativa:** a mensagem precisa dizer em que etapa falhou (descompactar ou interpretar o XML), e isso só se sabe dentro do item. Com try/catch, cada item devolve `{ ok, ... }` e a partição em `docZip`/`docZipErrors` é um laço simples que preserva a ordem do lote.

### Decisão 4: o lote inteiro falhando

Se **todos** os `docZip` falharem, o retorno continua sendo sucesso de transporte: `cStat` da SEFAZ (ex.: `138`), `docZip: []`, `docZipErrors` com todos os itens e **sem** `error` de topo. O `error` de topo significa "não há `data` utilizável", e aqui há — `ultNSU` e `maxNSU` são justamente o que o chamador precisa. Quem quiser tratar "lote sem nenhum documento legível" testa `docZipErrors.length`.

---

## Impacto por camada

### [util] (`src/util/gzip.js`)

- `if (err) reject(err)` passa a `if (err) return reject(err)`. Só isso — sem mudar a assinatura nem a mensagem do erro rejeitado (é o `Error` original do zlib, com `code`).

### [helpers / controllers] (`src/helpers/distribuicaoDFe-helper.js`, `src/controllers/distribuicaoDFe-controller.js`)

- `montarResponse` processa cada `docZip` dentro de try/catch próprio, em três etapas, cada uma com sua mensagem:

  | Etapa                            | Condição                            | `error` (texto exato)                                       |
  | -------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
  | Conteúdo ausente                 | `doc.value` vazio ou ausente        | `docZip sem conteúdo.`                                      |
  | `Gzip.unzip`                     | rejeição do zlib ou base64 inválido | `Falha ao descompactar o docZip: <mensagem original>`       |
  | `Xml.xmlToJson` sobre o conteúdo | exceção do `fast-xml-parser`        | `Falha ao interpretar o XML do docZip: <mensagem original>` |

  `<mensagem original>` é o `err.message` de quem falhou. O prefixo é contrato; o sufixo vem de dependência e pode mudar entre versões do Node ou do parser.

- Campos novos no retorno: `retorno['docZipErrors']`, sempre array. Atribuído junto de `retorno['docZip']`, depois dos escalares.
- A desestruturação defensiva e a normalização de `docZip` para array **não mudam** ([controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md) — "não simplificar essa desestruturação").
- `RetornoHelper` não muda: as duas condições que esvaziam `data` (`json.error` e status ≥ 300) continuam as mesmas, e falha de `docZip` não aciona nenhuma delas.
- JSDoc a atualizar — o do controller vira o tipo público no `dist/index.d.ts`:

  ```js
  // helper e controller
  docZip: [{ xml: string, json: Object, nsu: string, schema: string }],
  docZipErrors: [{ nsu: string, schema: string, error: string }]
  ```

- **Mudança quebra a API pública?** Não. Campo aditivo; `docZip` mantém forma e semântica. Muda o comportamento de um caso que hoje encerra o processo — nenhum consumidor depende disso. Versão: **minor** (0.18.0), por acrescentar campo ao retorno.
- **Interação com a GH-3:** a [GH-3](GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md) parametriza este mesmo `montarResponse` por documento e diz "campos novos no retorno: nenhum". Quem entrar depois rebaseia: se esta tarefa entrar primeiro, a GH-3 herda `docZipErrors` para CT-e e MDF-e sem trabalho extra (o tratamento por item independe do tipo de documento) e precisa ajustar o RF-04 dela.

---

## Testes

Arquivo novo `test/distribuicaoDFe-helper.test.js`, chamando `DistribuicaoHelper.montarResponse` direto com um envelope SOAP montado no teste — sem rede e **sem ler certificado**, então roda isolado como `xml.test.js` e `gzip.test.js`. O `docZip` válido reaproveita o `XML_ZIP` de `test/gzip.test.js`; o corrompido usa `'bm90IGd6aXA='` (base64 de `not gzip`).

- [ ] `Gzip.unzip` com gzip inválido: `assert.rejects` com `code === 'Z_DATA_ERROR'` **e** nenhum `uncaughtException` — aguardar um `setImmediate` depois da rejeição, para o mocha acusar a exceção no teste certo se ela voltar (em `test/gzip.test.js`)
- [ ] Lote misto (um válido + um corrompido): `docZip` com 1 item igual ao esperado, `docZipErrors` com 1 item `{ nsu, schema, error }`, `ultNSU`/`maxNSU`/`cStat` preenchidos, sem `error` de topo
- [ ] Mensagem do gzip corrompido: `assert.strictEqual(err, 'Falha ao descompactar o docZip: incorrect header check')` — a mensagem vem da própria zlib e é estável entre Node 20/22/24
- [ ] Conteúdo que descompacta mas não é XML (gzip de `'nao e xml <<'`): `error` começa com `'Falha ao interpretar o XML do docZip: '` — `startsWith`, porque o sufixo é do `fast-xml-parser`
- [ ] `docZip` sem conteúdo: `assert.strictEqual(err, 'docZip sem conteúdo.')`
- [ ] Lote com todos os itens falhando: `docZip: []`, `docZipErrors` com todos, `ultNSU`/`maxNSU` preenchidos, sem `error`
- [ ] Lote sem nenhum `docZip` (`cStat` 137): `docZip: []` e `docZipErrors: []`
- [ ] Ordem do lote preservada nos dois arrays (válido, corrompido, válido → `nsu` na ordem original)
- [ ] `test/sefaz.test.js` — não obrigatório: a tarefa não toca transporte, certificado nem assinatura. Rodar contra homologação só se houver A1 à mão, para confirmar que o lote real continua vindo com `docZipErrors: []`

O total de testes sobe; atualizar a contagem "65 dos 67" em `CLAUDE.md` e em [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md), e acrescentar o arquivo novo à lista dos que rodam sem certificado nos dois lugares.

## Checklist de implementação

- [ ] `src/util/gzip.js` — `return reject(err)`
- [ ] `src/helpers/distribuicaoDFe-helper.js` — try/catch por item, `docZipErrors`, JSDoc
- [ ] `src/controllers/distribuicaoDFe-controller.js` — JSDoc do retorno
- [ ] `test/distribuicaoDFe-helper.test.js` e caso novo em `test/gzip.test.js`
- [ ] [README.md](../../../README.md) — `docZipErrors` nos exemplos de retorno das três consultas, com uma frase sobre quando aparece
- [ ] `CHANGELOG.md` em `[Não publicado]`: `### Corrigido` (processo derrubado por `docZip` corrompido; lote inteiro perdido) e `### Adicionado` (`docZipErrors`)
- [ ] ADR 0013 criado e acrescentado à tabela de [decisoes/README.md](../../arquitetura/decisoes/README.md)
- [ ] [arquitetura/README.md](../../arquitetura/README.md) — invariante 1 sem a "exceção conhecida", apontando para a ADR 0013
- [ ] [controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md) — "Ao mexer aqui" sem a brecha; `docZipErrors` no formato de retorno
- [ ] [fluxos/distribuicao-dfe.md](../../arquitetura/fluxos/distribuicao-dfe.md) — seções "O retorno" e "Gunzip" reescritas
- [ ] `CLAUDE.md` e [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md) — contagem de testes e lista dos que rodam sem `certs/`

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [ ] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [ ] `npm run test:ci` — tudo menos `test/sefaz.test.js`; é o que roda com o certificado descartável
- [ ] `npx mocha test/distribuicaoDFe-helper.test.js test/gzip.test.js` **sem** `certs/` — confirma que o arquivo novo roda isolado
- [ ] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`; conferir `docZipErrors` no `dist/index.d.ts`
- [ ] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `done` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/tasks/specified/GH-NN-doczip-corrompido-nao-derruba-o-lote.md .docs/tasks/done/GH-NN-doczip-corrompido-nao-derruba-o-lote.md`
- [ ] Blockquote de especificação na issue apontando para `.docs/tasks/done/` (era `specified/`)
- [ ] Issue fechada no GitHub

## Referências

- [Visão geral e invariantes](../../arquitetura/README.md)
- [Camadas controllers e helpers](../../arquitetura/camadas/controllers-helpers.md)
- [Fluxo da distribuição DF-e](../../arquitetura/fluxos/distribuicao-dfe.md)
- [Testes e certificados](../../arquitetura/testes-e-certificados.md)
- [ADR 0004 — Erro de configuração lança; erro de rede/SEFAZ vira retorno](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)
- [ADR 0006 — JS com JSDoc em vez de TypeScript](../../arquitetura/decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md)
- [GH-3 — Suporte a CT-e e MDF-e na distribuição](GH-3-suporte-a-cte-e-mdfe-na-distribuicao.md) — mexe no mesmo `montarResponse`
- Origem: DEV-987 (rastreador interno da Bitize)
- Issue: https://github.com/bitize/bitmde/issues/NN

## Histórico de revisões

| Data       | Rev | Descrição                |
| ---------- | --- | ------------------------ |
| 2026-10-01 | 1.0 | Criação da especificação |
