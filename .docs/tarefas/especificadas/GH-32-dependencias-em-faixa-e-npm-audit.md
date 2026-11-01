# GH-32: Dependências de runtime em faixa e correção do `npm audit`

| Campo                | Valor                                               |
| -------------------- | --------------------------------------------------- |
| **Issue**            | [GH-32](https://github.com/bitize/bitmde/issues/32) |
| **Status**           | especificadas                                       |
| **Plano**            | —                                                   |
| **Prioridade**       | P1 (alto)                                           |
| **Tipo**             | dependências                                        |
| **Camadas afetadas** | services / util / test                              |
| **Criado em**        | 2026-11-01                                          |
| **Atualizado em**    | 2026-11-01                                          |
| **Concluído em**     | —                                                   |

---

## Contexto e motivação

Duas coisas, com a mesma causa: quatro das cinco dependências de runtime estão fixadas em **versão exata** no `package.json` desde a 0.15.0.

| Dependência       | Hoje     | Usada em                                                   |
| ----------------- | -------- | ---------------------------------------------------------- |
| `axios`           | `1.19.0` | [sefaz-service.js](../../../src/services/sefaz-service.js) |
| `fast-xml-parser` | `5.11.0` | [xml.js](../../../src/util/xml.js)                         |
| `node-forge`      | `1.4.0`  | [certificado.js](../../../src/util/certificado.js)         |
| `xml-crypto`      | `6.1.2`  | [assinatura.js](../../../src/util/assinatura.js)           |
| `luxon`           | `^3.7.2` | já em faixa                                                |

**1. O consumidor não deduplica.** O `package-lock.json` do bitmde não vai no pacote ([ADR 0003](../../arquitetura/decisoes/0003-lockfile-versionado.md)), então quem instala resolve pelo `package.json`. Com pino exato, qualquer consumidor que peça uma versão diferente fica com duas cópias: um projeto que dependa de `fast-xml-parser ^5.11.1`, por exemplo, mantém uma 5.11.0 aninhada em `node_modules/@bitize/bitmde/node_modules/`. Pior: **correção de segurança numa dependência direta só chega ao consumidor com um release do bitmde**. O pino não dá reprodutibilidade a ninguém — a do nosso build já vem do lockfile.

**2. O `npm audit` acusa 10 vulnerabilidades** (1 baixa, 3 moderadas, 6 altas), na `main` em 0.22.0:

| Pacote                 | Caminho           | Versão no lock | Corrigido em | Alcança o consumidor?                      |
| ---------------------- | ----------------- | -------------- | ------------ | ------------------------------------------ |
| `node-forge`           | direta            | 1.4.0          | 1.4.2        | **sim**, preso pelo pino                   |
| `axios`                | direta            | 1.19.0         | 1.20.0       | **sim**, preso pelo pino                   |
| `follow-redirects`     | via `axios`       | 1.16.0         | 1.16.2       | não — a faixa do `axios` já resolve 1.16.2 |
| `@xmldom/xmldom`       | via `xml-crypto`  | 0.8.14         | 0.8.15       | não — a faixa do `xml-crypto` já resolve   |
| `brace-expansion`      | via `mocha` (dev) | 2.1.4          | 2.1.7        | não, dev                                   |
| `js-yaml`              | via `mocha` (dev) | 4.3.1          | 4.3.2        | não, dev                                   |
| `serialize-javascript` | via `mocha` (dev) | 7.1.0          | 7.1.3        | não, dev                                   |
| `glob`, `minimatch`    | via `mocha` (dev) | 10.5.0, 9.0.9  | mocha 12     | não, dev                                   |
| `mocha`                | direta (dev)      | 11.8.0         | 12           | não, dev                                   |

Os dois que importam:

- **`node-forge` ≤ 1.4.0** — 12 avisos. Os que tocam código nosso são a falsificação do MAC do PKCS#12 com contagem de iterações zero (GHSA-jc66-7q78-782g) e o ReDoS em `pem.decode` (GHSA-7wch-p9px-956x): o `CertificadoValidator` converte o PFX→PEM com o forge.
- **`axios` < 1.20.0** — 12 avisos, quase todos _gadgets_ de prototype pollution, ReDoS e injeção de header. Para o nosso uso (adapter http, sem fetch, sem HTTP/2, sem proxy configurado) é defesa em profundidade, mas o consumidor que usa `axios` diretamente herda a cópia vulnerável aninhada.

As transitivas e as de dev se corrigem só regenerando o lockfile, menos `glob`/`minimatch`, que exigem `mocha` 12 (major). O `npm audit` sugere "mocha 11.0.0" como correção: está errado, é um downgrade que não corrige nada.

Simulado fora do repositório: com as faixas da Decisão 1 e o lockfile regenerado, o `npm audit` cai para **3 moderadas** — `glob`, `minimatch` e `mocha`, todas de dev.

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — as cinco invariantes
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — instância axios, `request` que nunca lança
- [x] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — opções do `XMLParser`/`XMLBuilder` que não podem afrouxar
- [x] Fluxo: [recepção](../../arquitetura/fluxos/recepcao-evento.md) — `xml-crypto` e o `getKeyInfoContent`
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md) — `certificado.test.js` compara a saída do forge byte a byte
- [x] [release](../../arquitetura/release.md) — `### Segurança` no CHANGELOG, `npm ci` falha com lock fora de sincronia
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                            | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | `axios` de `1.19.0` para `^1.21.0`                                                                                                                                   | Must       |
| RF-02 | `node-forge` de `1.4.0` para `^1.4.2`                                                                                                                                | Must       |
| RF-03 | `fast-xml-parser` de `5.11.0` para `^5.11.2` — leva junto a correção do `XMLValidator` da 5.11.1                                                                     | Must       |
| RF-04 | `xml-crypto` de `6.1.2` para `~6.4.0`, ou `~6.1.2` se a assinatura mudar (Decisão 2)                                                                                 | Must       |
| RF-05 | `package-lock.json` regenerado no mesmo commit, com as transitivas corrigidas; `npm audit` restrito a `glob`, `minimatch` e `mocha`                                  | Must       |
| RF-06 | XML assinado da recepção de evento e da manifestação da NFS-e **byte a byte igual**: `test/assinatura.test.js` passa sem alterar o lote congelado                    | Must       |
| RF-07 | PFX→PEM byte a byte igual: `test/certificado.test.js` passa sem alteração                                                                                            | Must       |
| RF-08 | `test/sefaz.test.js` rodado manualmente contra homologação — a tarefa troca o transporte, o certificado e a assinatura                                               | Must       |
| RF-09 | ADR 0017 registrando a política de faixa para dependências de runtime (Decisão 1), com linha na tabela de [decisoes/README.md](../../arquitetura/decisoes/README.md) | Must       |
| RF-10 | `CHANGELOG.md` em `[Não publicado]`, subseção `### Segurança`, com os de → para e a mudança de pino para faixa                                                       | Must       |
| RF-11 | `luxon` e as dependências de dev ficam como estão (fora `mocha`, que vira tarefa própria)                                                                            | Should     |

## Decisões de design

### Decisão 1: faixa em vez de pino exato nas dependências de runtime

- **Opções consideradas:**
  - A — manter o pino exato e só bumpar as versões;
  - B — caret (`^`) em todas;
  - C — caret em todas, til (`~`) na dependência que assina.
- **Escolha:** C.
- **Justificativa:** A resolve o audit de hoje e repete o problema no próximo aviso: o consumidor fica preso à versão vulnerável até um release nosso, e não deduplica. A reprodutibilidade que o pino daria já vem do lockfile no nosso build, e no consumidor ele não vale nada, porque o lockfile não é publicado. Entre B e C, ver Decisão 2.

Vira o **ADR 0017**. A alternativa A é real e a próxima pessoa a ver um `^` numa dependência de assinatura vai questionar. O ADR **não supersede** o 0003: ele já tinha rejeitado o pino exato como substituto do lockfile, e o pino do Prettier (dev, com motivo próprio) continua como está.

### Decisão 2: `~` no `xml-crypto`

- **Opções consideradas:** `^6.4.0`, `~6.4.0`, `~6.1.2`.
- **Escolha:** `~6.4.0` — só patch —, com `~6.1.2` como recuo se a saída mudar.
- **Justificativa:** o `xml-crypto` é a dependência em que uma mudança de comportamento padrão produz XML assinado diferente sem quebrar nenhuma chamada. Já aconteceu: a v3 deixou de usar `rsa-sha1` como padrão, e por isso a `Assinatura` passa os algoritmos explicitamente desde a 0.15.0. Nas outras três, um minor que mude comportamento aparece como teste vermelho; aqui pode aparecer como rejeição da SEFAZ em produção. O custo é o consumidor não deduplicar `xml-crypto` num minor novo — aceitável, porque `xml-crypto` é dependência pouco comum fora de bibliotecas de assinatura.

Subir o `xml-crypto` **não é necessário para o audit**: a 6.1.2 declara `@xmldom/xmldom ^0.8.10` e já aceita a 0.8.15. A subida vale pelas correções de canonicalização e de PEM da 6.2 à 6.4, mas é justamente o que mexe no XML assinado — as notas de release citam escape de `\r` na saída, geração de `Id` durante a assinatura, `KeyInfo` omitido quando vazio, parser de PEM próprio e avisos de entrada que a 7.0 vai rejeitar. Para o nosso `infEvento`/`infPedReg` (sem PI, sem DOCTYPE, sem prefixo redeclarado) a expectativa é saída idêntica, e o `assinatura.test.js` decide:

- lote congelado intacto e sem aviso de depreciação no console → `~6.4.0`;
- qualquer byte diferente → `~6.1.2`, registrado em Notas de implementação, e a subida para 6.4 vira tarefa própria, com `sefaz.test.js` contra homologação.

### Decisão 3: `mocha` 12 fica fora

- **Escolha:** tarefa separada.
- **Justificativa:** é major de dependência de dev, não vai no pacote publicado e não muda nada para o consumidor. Junto, o PR de segurança passaria a carregar adaptação de suíte de teste. As 3 moderadas restantes ficam registradas no CHANGELOG como conhecidas.

### Decisão 4: versão do release

- **Escolha:** minor (0.23.0), e não patch.
- **Justificativa:** trocar pino por faixa muda o que o consumidor resolve na instalação, mesmo sem mudar a API. O release em si segue [release.md](../../arquitetura/release.md) e não faz parte desta tarefa.

---

## Impacto por camada

### [dependências]

- Pacote e versão (de → para): `axios` 1.19.0 → `^1.21.0`; `node-forge` 1.4.0 → `^1.4.2`; `fast-xml-parser` 5.11.0 → `^5.11.2`; `xml-crypto` 6.1.2 → `~6.4.0`. No lock: `follow-redirects` 1.16.2, `@xmldom/xmldom` 0.8.15, `brace-expansion` 2.1.7, `js-yaml` 4.3.2, `serialize-javascript` 7.1.4.
- `package.json` **e** `package-lock.json` no mesmo commit. Regenerar com `npm install` depois de editar o `package.json` e `npm audit fix` **sem** `--force` (o `--force` instalaria o downgrade do mocha). Não rodar `npm update` geral: ele subiria também as dependências de dev e espalharia o diff.
- Os `overrides` de `diff` e `serialize-javascript` ficam: o `mocha` 11 ainda declara faixas que não alcançam as versões corrigidas.
- Mudança de API da dependência que exige adaptação: nenhuma esperada. `axios` 1.21 e `node-forge` 1.4.2 não mudam a API que usamos; `xml-crypto` 6.4 é minor da 6, com a mesma assinatura de construtor e `addReference` adaptada na 0.15.0. Se o `assinatura.test.js` acusar diferença, **não ajustar o teste**: XML assinado diferente aciona o recuo da Decisão 2.

### [services] / [util]

Nenhuma mudança de código esperada. Os testes que vigiam cada dependência:

| Dependência       | Guarda                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `axios`           | `test/transporte.test.js` (servidor HTTPS local: TLS, timeout, 502, sem chave no retorno serializado)    |
| `node-forge`      | `test/certificado.test.js` (PFX→PEM byte a byte), `test/transporte.test.js` (gera certificado com forge) |
| `fast-xml-parser` | `test/xml.test.js`, `test/distribuicaoDFe-helper.test.js`                                                |
| `xml-crypto`      | `test/assinatura.test.js` (lote congelado)                                                               |

---

## Testes

- [ ] `npm run test:ci` verde, **sem alterar teste existente** — esta tarefa não pode mudar saída
- [ ] `test/assinatura.test.js` passa com o lote congelado intacto
- [ ] `test/certificado.test.js` passa (com o certificado descartável e, se houver, com o A1 real)
- [ ] `npm audit` lista só `glob`, `minimatch` e `mocha`
- [ ] `test/sefaz.test.js` rodado manualmente contra homologação, com A1 real (`--timeout 15000`)

## Checklist de implementação

- [ ] `package.json` e `package-lock.json` no mesmo commit
- [ ] ADR 0017 em `.docs/arquitetura/decisoes/` e linha na tabela do README de decisões
- [ ] `CHANGELOG.md` atualizado em `[Não publicado]`, subseção `### Segurança`
- [ ] Tarefa do `mocha` 12 criada (rascunho basta)

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [ ] `npm run format` (ou conferir com `npm run format:check`)
- [ ] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [ ] `npm run test:ci` — tudo menos `test/sefaz.test.js`; é o que roda com o certificado descartável
- [ ] `test/sefaz.test.js` rodado à parte (`npx mocha test/sefaz.test.js`) — exige certificado A1 válido e acesso à rede
- [ ] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`
- [ ] `npm pack --dry-run` — o tarball não muda de conteúdo
- [ ] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação. Registrar os **desvios** em relação a esta especificação e a justificativa de cada um. Se não houve, escrever "Sem desvios".

-

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [ ] Desvios registrados em "Notas de implementação"
- [ ] Checklists marcados
- [ ] Cabeçalho: **Status** = `concluidas` e **Concluído em** preenchido
- [ ] Arquivo movido: `git mv .docs/tarefas/especificadas/GH-32-dependencias-em-faixa-e-npm-audit.md .docs/tarefas/concluidas/GH-32-dependencias-em-faixa-e-npm-audit.md`
- [ ] Blockquote de especificação na issue apontando para `.docs/tarefas/concluidas/` (era `especificadas/`)
- [ ] Issue fechada no GitHub
- [ ] Release 0.23.0 seguindo [release.md](../../arquitetura/release.md); depois dele, o consumidor sobe o `@bitize/bitmde` e confere que o lock dele ficou com uma única cópia de `fast-xml-parser`

## Referências

- [ADR 0003 — lockfile versionado](../../arquitetura/decisoes/0003-lockfile-versionado.md) — rejeitou o pino exato como substituto do lockfile
- [ADR 0001 — fork](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) — a primeira rodada de audit, que introduziu os pinos atuais na 0.15.0
- [ADR 0007 — assinatura por `infEvento`](../../arquitetura/decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md)
- [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md), [release.md](../../arquitetura/release.md)
- Avisos: [GHSA-jc66-7q78-782g](https://github.com/advisories/GHSA-jc66-7q78-782g) e [GHSA-7wch-p9px-956x](https://github.com/advisories/GHSA-7wch-p9px-956x) (`node-forge`); [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g) e demais do `axios` < 1.20.0
- Issue: https://github.com/bitize/bitmde/issues/32

## Histórico de revisões

| Data       | Rev | Descrição                |
| ---------- | --- | ------------------------ |
| 2026-11-01 | 1.0 | Criação da especificação |
