# GH-14: Validar TLS por padrão com cadeia atualizada e expor o erro de transporte sem status HTTP sintético

| Campo                | Valor                                                     |
| -------------------- | --------------------------------------------------------- |
| **Issue**            | [GH-14](https://github.com/bitize/bitmde/issues/14)       |
| **Status**           | done                                                      |
| **Prioridade**       | P1 (alto)                                                 |
| **Tipo**             | correção                                                  |
| **Camadas afetadas** | apis / controllers / helpers / services / env / test / CI |
| **Criado em**        | 2026-10-03                                                |
| **Atualizado em**    | 2026-10-03                                                |
| **Concluído em**     | 2026-10-03                                                |

---

## Contexto e motivação

Um consumidor em produção passou a validar o certificado do servidor, como a documentação desta biblioteca recomenda ([services-sefaz.md](../../arquitetura/camadas/services-sefaz.md) e [env.md](../../arquitetura/camadas/env.md): _"em produção, passar `httpsOptions: { rejectUnauthorized: true }` … a verificação funciona sem configuração adicional"_). A partir daí, a distribuição DF-e e a manifestação falharam sempre, com um `status: 502` que não veio da SEFAZ. Três comportamentos da 0.18.0 se somam.

**1. A cadeia embarcada não valida mais o Ambiente Nacional, e substitui as raízes do Node.** [src/env/ca.js](../../../src/env/ca.js) traz só `AC Raiz Brasileira v10` e `AC SERPRO SSLv1` (ICP-Brasil, "atualizada em 04/08/2021"). Os helpers a passam como `ca` do `https.Agent`, e no Node a opção `ca` **substitui** as raízes padrão em vez de somar a elas. O AN trocou de cadeia. Handshake real em 2026-10-03, Node 24, `rejectUnauthorized: true`:

| `ca` passado                               | `www1.nfe.fazenda.gov.br`           | `hom1.nfe.fazenda.gov.br` |
| ------------------------------------------ | ----------------------------------- | ------------------------- |
| só a cadeia embarcada (comportamento 0.18) | `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` | idem                      |
| nenhum (raízes padrão do Node)             | OK                                  | OK                        |
| raízes do Node + cadeia embarcada          | OK                                  | OK                        |

Cadeia servida nos dois hosts: `<host> ← AC SERPRO AR46 OV TLS CA 2025 (até 2030-10-15) ← GlobalSign Root R46 (até 2046-03-20)`. A `GlobalSign Root R46` já faz parte do bundle da Mozilla que vem com o Node. O certificado folha do `www1` vence em 2026-10-29. Uma troca que mantenha a intermediária e a raiz não quebra nada com as raízes do Node; com a cadeia embarcada, já está quebrado.

**2. A validação vem desligada por padrão.** [sefaz-service.js](../../../src/services/sefaz-service.js) cria o agente com `rejectUnauthorized: false`. Quem fica no padrão aceita qualquer servidor, inclusive um intermediário malicioso, e apresenta a ele o certificado A1 do contribuinte no mTLS. É o único motivo de o problema 1 não ter aparecido antes para todo mundo: ninguém no padrão valida nada.

**3. O erro de transporte se disfarça de HTTP.** Quando não há resposta, `request` devolve `{ status: 502, data: '<error>mensagem</error>' }`. Em timeout devolve 504, e em erro antes do envio devolve 500. O `code` do erro (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `ECONNRESET`, `ENOTFOUND`) se perde. O consumidor não distingue isso de um 502 real da SEFAZ, e quem faz métrica ou retry por status trata falha de certificado como indisponibilidade do servidor. O consumidor interno passou a reconhecer o `<error>` por expressão regular sobre `resXml`, o que é uma heurística sobre detalhe de implementação.

Os dois testes comentados em [test/sefaz.test.js](../../../test/sefaz.test.js) ("sem informar a Cadeia de Certificados", que esperavam `502` e `'<error>unable to get local issuer certificate</error>'`) mostram que o sintoma já era conhecido e ficou silenciado.

Origem: DEV-990 (rastreador interno da Bitize), aberta a partir do incidente DEV-989. O consumidor interno hoje copia a cadeia ICP-Brasil e a heurística do `<error>`; depois do release, as duas saem de lá.

### Fora de escopo

- Atualizar a ICP-Brasil para uma AC Raiz v11 ou posterior. Nenhum endpoint que o pacote chama usa cadeia ICP-Brasil hoje: os dois serviços rodam no AN (`www1`/`hom1`), cujo certificado é GlobalSign. A cadeia ICP-Brasil continua embarcada e somada às raízes (ver Decisão 1), mas incluir uma AC nova só se justifica com um endpoint concreto que precise dela.
- Retry, backoff ou reaproveitamento de agente. Continuam fora da biblioteca ([services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), "O que não existe aqui").
- `Xml.xmlToJson` lançando sobre corpo de resposta que não é XML. É brecha conhecida ([controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md)) e merece tarefa própria.
- Bump do pacote no consumidor interno.
- O release em si (bump, `CHANGELOG` versionado, tag). Segue [release.md](../../arquitetura/release.md) em passo separado; esta tarefa só deixa a entrada em `[Não publicado]` e define que a versão-alvo é a **0.19.0** (Decisão 5).

## Fontes da verdade (`.docs/arquitetura`)

- [x] [Visão geral](../../arquitetura/README.md) — a invariante 1 descreve o formato do erro de transporte e precisa ganhar `transportError`
- [x] [apis](../../arquitetura/camadas/apis.md) — `httpsOptions` continua sobrescrevendo tudo; JSDoc do construtor descreve o novo padrão
- [ ] [validators](../../arquitetura/camadas/validators.md) — sem impacto: nenhuma validação nova, nenhuma mensagem de validator muda
- [x] [controllers e helpers](../../arquitetura/camadas/controllers-helpers.md) — `RetornoHelper` e JSDoc do controller (tipo público do retorno)
- [ ] [schemas e XML](../../arquitetura/camadas/schemas-xml.md) — sem impacto: nada muda no XML enviado, e o recorte por `indexOf` da recepção não é tocado
- [x] [services](../../arquitetura/camadas/services-sefaz.md) — mescla de options, default de `rejectUnauthorized`, tabela de status sintético
- [x] [env](../../arquitetura/camadas/env.md) — `CA`, e a recomendação hoje incorreta de ligar a validação
- [x] Fluxo: [distribuição](../../arquitetura/fluxos/distribuicao-dfe.md) e [recepção](../../arquitetura/fluxos/recepcao-evento.md) — só o caminho de erro de transporte
- [x] [testes e certificados](../../arquitetura/testes-e-certificados.md) — `sefaz.test.js` passa `ca: CA` direto ao serviço e precisa mudar
- [x] [build e versão](../../arquitetura/build-e-versao.md) / [release](../../arquitetura/release.md) — `exports` e o guard de tarball (Decisão 3 evita mexer neles)
- [x] ADRs relacionados — listados em **Referências**

## Requisitos

| ID    | Requisito                                                                                                                                                                              | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | A cadeia de confiança padrão **soma** as raízes que o Node usaria por padrão à cadeia ICP-Brasil embarcada, em vez de substituí-las                                                    | Must       |
| RF-02 | As raízes padrão respeitam `NODE_EXTRA_CA_CERTS` e `--use-system-ca` quando o runtime oferece `tls.getCACertificates`, e caem para `tls.rootCertificates` quando não oferece (Node 20) | Must       |
| RF-03 | `rejectUnauthorized: true` por padrão nos dois serviços                                                                                                                                | Must       |
| RF-04 | `httpsOptions` continua sobrescrevendo qualquer default, inclusive `ca` e `rejectUnauthorized`                                                                                         | Must       |
| RF-05 | A raiz do pacote exporta `CA_ICP_BRASIL` e `CA_PADRAO` (arrays de PEM congelados), nas três formas de exportação                                                                       | Must       |
| RF-06 | Falha sem resposta HTTP devolve `status: 0`, `resXml: ''`, `data: {}`, `transportError: { code, message }` e `error` com o texto exato da Decisão 4                                    | Must       |
| RF-07 | O retorno nunca carrega o objeto de erro do axios nem nada de `error.config` (que contém o `httpsAgent` e, com ele, a chave privada do A1)                                             | Must       |
| RF-08 | Resposta HTTP real da SEFAZ (2xx a 5xx) mantém o comportamento atual: status real, corpo em `resXml`, sem `transportError`                                                             | Must       |
| RF-09 | Teste de handshake real contra `www1` e `hom1` com `rejectUnauthorized: true` e `CA_PADRAO`, sem exigir certificado A1, fora do `test:ci`                                              | Must       |
| RF-10 | Workflow agendado que roda o teste da RF-09 semanalmente, para a próxima troca de cadeia aparecer antes de chegar à produção                                                           | Should     |
| RF-11 | ADR 0014 registra as decisões 1, 2 e 4 e substitui, para o futuro, a tabela de status sintético do ADR 0004                                                                            | Must       |
| RF-12 | JSDoc, `README.md`, `CHANGELOG.md`, `CLAUDE.md` e docs de arquitetura descrevem o novo padrão, com instrução de migração                                                               | Must       |

## Decisões de design

### Decisão 1: como compor a cadeia padrão

- **Opções consideradas:**
  - A. Não passar `ca` e deixar o Node usar as raízes padrão;
  - B. `[...tls.rootCertificates, ...CA]`, como a origem sugere;
  - C. `[...raízes padrão do runtime, ...CA]`, onde "raízes padrão" é `tls.getCACertificates('default')` quando existir e `tls.rootCertificates` quando não existir.
- **Escolha:** C.
- **Justificativa:** A resolve o AN de hoje, mas descarta a cadeia ICP-Brasil, que o consumidor interno ainda usa para outros endpoints. Se o AN voltar a uma cadeia ICP-Brasil, o pacote quebraria do mesmo jeito. B tem um efeito colateral silencioso: passar `ca` explícito desliga `NODE_EXTRA_CA_CERTS` e `--use-system-ca`, e `tls.rootCertificates` é só o bundle da Mozilla, sem nenhum dos dois. Quem está atrás de um proxy corporativo com CA própria quebraria ao atualizar. `tls.getCACertificates('default')` devolve exatamente o conjunto que o Node usaria sem `ca`, com as extras incluídas. Na ausência dela (Node 20, ainda na matriz da CI), B é o melhor disponível.
- A composição acontece **uma vez**, no carregamento do módulo. Mudar `NODE_EXTRA_CA_CERTS` depois do `require` não tem efeito, como no próprio Node.
- Duplicatas entre as raízes e a ICP-Brasil não são problema para o OpenSSL; não filtrar.

### Decisão 2: `rejectUnauthorized: true` por padrão, sem flag

- **Opções consideradas:** inverter o padrão; manter `false` e adicionar uma flag de opt-in; inverter e oferecer flag de opt-out.
- **Escolha:** inverter o padrão, sem flag nova.
- **Justificativa:** o opt-out já existe: `httpsOptions: { rejectUnauthorized: false }` continua funcionando (RF-04). Uma flag nova seria uma segunda forma de dizer a mesma coisa. Manter `false` por padrão adia um problema de segurança cuja correção agora não tem custo para quem fala com o AN, porque a cadeia padrão passa a validar (Decisão 1). Com a Decisão 1 sozinha, o padrão continua aceitando qualquer servidor; as duas só fazem sentido juntas.

### Decisão 3: onde exportar a cadeia

- **Opções consideradas:**
  - A. Subcaminho `@bitize/bitmde/ca`, como a origem sugere;
  - B. Constantes na raiz: `const { CA_PADRAO, CA_ICP_BRASIL } = require('@bitize/bitmde')`.
- **Escolha:** B.
- **Justificativa:** A exige entrada nova em `exports`, um `.d.ts` próprio (o `tsconfig.json` só entra por `src/index.js`) e item novo no guard de tarball de `publicar.yml`. O [ADR 0011](../../arquitetura/decisoes/0011-files-e-exports-como-contrato-de-empacotamento.md) fecha a superfície pública na raiz. Um subcaminho seria a primeira exceção, só para entregar dois arrays. B não toca `exports`, `files`, `tsconfig.json` nem o guard.
- Nomes em português e em caixa alta, como as demais constantes de `env/`. `CA_ICP_BRASIL` é o conteúdo atual de `CA`; `CA_PADRAO` é o resultado da Decisão 1, o que o pacote usa quando o consumidor não informa `ca`.
- Os dois saem com `Object.freeze`. Os módulos de `env/` não congelam por convenção ([env.md](../../arquitetura/camadas/env.md)), mas `CA_PADRAO` é o mesmo array que os helpers usam: sem congelar, um `push` do consumidor mudaria a cadeia de todas as chamadas seguintes. O congelamento acontece onde o valor sai para o público, e o arquivo de dado fica como está.
- Uso esperado pelo consumidor que precisa compor: `httpsOptions: { ca: [...CA_PADRAO, minhaCa] }`.

### Decisão 4: forma do erro de transporte

- **Opções consideradas:**
  - A. Lançar um erro tipado;
  - B. Retornar `{ status: 0, transportError: { code, message } }`, com `error` preenchido;
  - C. Manter os status 500/502/504 e só acrescentar `transportError`.
- **Escolha:** B.
- **Justificativa:** A contraria o núcleo do [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md): erro de rede é condição de operação e vira retorno, com `reqXml` preservado para diagnóstico. C mantém o problema principal: quem lê `status` continua vendo um 502 que a SEFAZ não mandou. `status: 0` é a convenção de `fetch` e `XMLHttpRequest` para "não houve resposta HTTP" e não colide com nenhum status real.
- **Contrato do retorno, quando não há resposta HTTP:**

  ```js
  {
    data: {},
    reqXml: '<soap12:Envelope…>',  // o que seria enviado, como hoje
    resXml: '',                     // não houve resposta
    status: 0,
    error: 'Falha de transporte (UNABLE_TO_GET_ISSUER_CERT_LOCALLY): unable to get local issuer certificate',
    transportError: {
      code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      message: 'unable to get local issuer certificate',
    },
  }
  ```

- **Texto exato de `error`:** `` `Falha de transporte (${code}): ${message}` ``. `error` continua string e continua presente, então quem testa `if (retorno.error)` não precisa mudar nada.
- `code` é o `error.code` repassado sem remapear. Valores observados em 2026-10-03 com axios 1.19: `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (cadeia), `ECONNREFUSED`, `ECONNABORTED` (timeout do axios), `ERR_BAD_REQUEST` (protocolo inválido, antes do envio). Sem `error.code`, usar `'ERR_DESCONHECIDO'`.
- `message` é `error.message`, ou `String(error)` quando vier vazio, como hoje.
- Os três ramos sintéticos de hoje (504, 502, 500) colapsam num só. A distinção entre "timeout", "sem resposta" e "antes do envio" fica no `code`, que é mais preciso que os três números.
- **Proibido:** repassar `error`, `error.config`, `error.request` ou usar o erro do axios como `cause`. O `AxiosError` carrega `config.httpsAgent` (confirmado em teste), e o agente guarda `cert` e `key` nas options. Só `code` e `message` saem do `catch`.

Decisões 1, 2 e 4 juntas mudam o contrato de transporte, e reverter qualquer uma delas custa outro breaking change. Registrar como **ADR 0014 — "TLS validado por padrão e erro de transporte explícito"**. O ADR 0004 **não é editado**, seguindo o precedente do 0013: o princípio dele (configuração lança, rede retorna) continua valendo, e o 0014 declara que substitui a tabela de status sintético e o "Fica mais difícil" correspondente. No [índice de ADRs](../../arquitetura/decisoes/README.md), o candidato "`rejectUnauthorized: false` como default" sai de "Próximos candidatos", porque o 0014 decide o contrário. O 0010 continua reservado pela GH-3.

### Decisão 5: versão-alvo

- **Opções consideradas:** 0.19.0; 1.0.0; 0.19.0 com flag de opt-in.
- **Escolha:** 0.19.0.
- **Justificativa:** o [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) diz que quebrar a API pública "sem major" descarta a compatibilidade do fork. Na série 0.x, o semver trata o minor como o nível de quebra: `^0.18.0` não resolve para 0.19.0, então nenhum consumidor recebe a mudança sem pedir. É o mesmo critério da 0.16.0, que fechou o deep import como minor. Ir para 1.0.0 seria declarar a API estável, um compromisso maior do que esta tarefa precisa assumir. O `CHANGELOG` ganha uma subseção `### Compatibilidade` com a migração, como na 0.16.0 e na 0.17.0.

---

## Impacto por camada

### [env] (`src/env/`)

- [ca.js](../../../src/env/ca.js): o array atual continua exportado como `CA` (conteúdo inalterado). Ganha `CA_PADRAO`, montado pela Decisão 1. Atualizar o comentário do topo, que hoje cita a "Cadeia de Certificados do www1 (atualizada em 04/08/2021)" — essa cadeia não é mais a do `www1`.
- Registrar `CA_PADRAO` em [src/env/index.js](../../../src/env/index.js), mantendo a ordem alfabética.
- A detecção de `tls.getCACertificates` em módulo de `env/` é uma pequena exceção à regra de "módulo de dado". Registrar isso em [env.md](../../arquitetura/camadas/env.md), ou mover a composição para `src/util/` se a implementação mostrar que fica mais claro. As duas opções atendem à especificação; o desvio, se houver, vai em Notas de implementação.

### [helpers / controllers] (`src/helpers/`, `src/controllers/`)

- [distribuicaoDFe-helper.js](../../../src/helpers/distribuicaoDFe-helper.js) e [recepcaoEvento-helper.js](../../../src/helpers/recepcaoEvento-helper.js): passar `ca: CA_PADRAO` em vez de `ca: CA`.
- [retorno-helper.js](../../../src/helpers/retorno-helper.js): quando `retornoSefaz.transportError` existir, preencher `data: {}`, `error` (texto da Decisão 4) e `transportError`, **antes** das outras duas condições. Sem isso, `status: 0` não preenche `error`, porque `Math.floor(0 / 100) > 2` é falso.
- `montarResponse('')` não lança e devolve o objeto com campos vazios (conferido nos dois helpers). O controller pode seguir chamando-o no caminho de erro, sem ramo especial.
- O `if (json.error)` de `montarResponse` deixa de ser alcançado por erro de transporte. Manter: é inofensivo e cobre um corpo `<error>` vindo de fora. Atualizar o comentário/doc que o atribui ao `SefazService`.
- JSDoc de `enviar` nos dois controllers: acrescentar `transportError?: {code: string, message: string}` ao tipo de retorno. É ele que vira o tipo público no `dist/index.d.ts`.

### [services] (`src/services/`)

- [sefaz-service.js](../../../src/services/sefaz-service.js): default `rejectUnauthorized: true`. A ordem da mescla não muda: default primeiro, `{ ...opts.httpsOptions }` por cima. `httpsOptions` chega congelado ([ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md)); a cópia por spread continua obrigatória.
- `request`: o ramo `error.response` fica como está. Os ramos `error.request` e "qualquer outro" passam a devolver `{ status: 0, data: '', transportError: { code, message } }`. Os três ramos sintéticos colapsam num só.
- O serviço continua sem lançar ([ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md)).
- Atualizar o `@returns` de `request`: `{status: number, data: string, transportError?: {code: string, message: string}}`.

### [apis] (`src/apis/`) e raiz do pacote

- [src/index.js](../../../src/index.js): exportar `CA_ICP_BRASIL` e `CA_PADRAO`, congelados, em `module.exports`, `.default` e `.mde`.
- JSDoc de `config.options.httpsOptions` nos dois construtores: informar que o padrão é `{ ca: CA_PADRAO, rejectUnauthorized: true }` e que informar `ca` substitui a cadeia inteira. Para somar, usar `[...CA_PADRAO, minhaCa]`.
- **A mudança quebra a API pública?** Sim, em dois pontos de comportamento sem mudança de assinatura: (1) servidor com cadeia que não fecha em `CA_PADRAO` passa a ser recusado; (2) erro de transporte passa de `status` 500/502/504 com `resXml: '<error>…</error>'` para `status: 0`, `resXml: ''` e `transportError`. Justificativa e versão na Decisão 5.

### [CI] (`.github/workflows/`, `package.json`)

- `test/tls-sefaz.test.js` (novo) não lê `certs/`, mas precisa de rede. Acrescentar `--ignore test/tls-sefaz.test.js` ao `test:ci`.
- `.github/workflows/cadeia-tls.yml` (novo): `schedule` semanal mais `workflow_dispatch`, Node 24, `npm ci`, depois `npx mocha test/tls-sefaz.test.js`. Mesma postura dos outros três: `permissions: contents: read` e `persist-credentials: false` no checkout. O aviso de falha é o e-mail padrão do GitHub para workflow agendado com falha. Abrir issue automaticamente exigiria `issues: write`; deixar fora.

---

## Testes

Unitários, sem rede externa (entram no `test:ci`). Usar um servidor HTTPS local em `127.0.0.1` com certificado gerado em tempo de teste pelo `node-forge`, que já é dependência. Assim os testes não dependem de `certs/` nem do gerador descartável.

- [x] Servidor local com certificado autoassinado e configuração padrão: `status: 0`, `resXml: ''`, `transportError.code` de cadeia (`SELF_SIGNED_CERT_IN_CHAIN` ou `DEPTH_ZERO_SELF_SIGNED_CERT`, conforme o certificado gerado) e `error` com o prefixo exato `Falha de transporte (`
- [x] O mesmo servidor com `httpsOptions: { ca: [...CA_PADRAO, certDoServidor] }`: a requisição passa e devolve o status real
- [x] O mesmo servidor com `httpsOptions: { rejectUnauthorized: false }`: a requisição passa (o opt-out da RF-04)
- [x] Porta fechada: `transportError.code === 'ECONNREFUSED'`
- [x] Servidor que aceita a conexão e não responde, com `requestOptions: { timeout: 50 }`: `transportError.code === 'ECONNABORTED'`
- [x] Servidor local respondendo 502 de verdade: `status: 502`, corpo em `resXml`, **sem** `transportError` (RF-08)
- [x] Nenhum vazamento: `JSON.stringify(retorno)` não contém `BEGIN` de chave privada nem `httpsAgent`
- [x] `RetornoHelper.montarRetorno` com `transportError`: `data: {}`, `error` com o texto exato, `transportError` repassado
- [x] `CA_PADRAO` e `CA_ICP_BRASIL` congelados (`assert.throws` ao fazer `push`) e presentes nas três formas de exportação
- [x] `CA_PADRAO` contém todos os itens de `CA_ICP_BRASIL` e todos os de `tls.rootCertificates`

Integração, com rede e sem A1 (fora do `test:ci`, roda no workflow agendado):

- [x] `test/tls-sefaz.test.js`: handshake TLS contra `www1` e `hom1` com `rejectUnauthorized: true` e `ca: CA_PADRAO` fecha com sucesso
- [x] O mesmo arquivo: com `ca: CA_ICP_BRASIL` sozinho, falha com `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. É o caso que os testes comentados de `sefaz.test.js` tentavam cobrir. Se um dia esse caso passar a fechar, o AN voltou à ICP-Brasil, e o teste deve falhar alto para alguém olhar.

Integração com A1 (manual, contra homologação):

- [x] [test/sefaz.test.js](../../../test/sefaz.test.js): trocar `ca: CA` por `ca: CA_PADRAO` (o arquivo instancia o serviço direto, sem passar pelos helpers) e apagar os dois testes comentados, que o `tls-sefaz.test.js` substitui. Rodar `npx mocha test/sefaz.test.js` com A1 válido. O caso "sem informar cert.pem e key.pem" deve continuar devolvendo `403`, agora com a validação ligada.

## Checklist de implementação

- [x] Código em `src/` (`env/ca.js`, `env/index.js`, `services/sefaz-service.js`, os dois helpers, `helpers/retorno-helper.js`, `index.js`)
- [x] Testes em `test/` (unitários novos, `tls-sefaz.test.js`, ajuste de `sefaz.test.js`)
- [x] `package.json`: `--ignore test/tls-sefaz.test.js` no `test:ci`
- [x] `.github/workflows/cadeia-tls.yml`
- [x] JSDoc atualizado (construtores de `src/apis/`, `enviar` dos controllers, `request` do serviço)
- [x] [README.md](../../../README.md): padrão de TLS, `CA_PADRAO`/`CA_ICP_BRASIL`, `transportError`, `status: 0`, e como voltar ao comportamento antigo (desaconselhado)
- [x] `CHANGELOG.md` em `[Não publicado]`, com `### Modificado`, `### Adicionado` e `### Compatibilidade` (migração)
- [x] [CLAUDE.md](../../../CLAUDE.md): a seção "Onde o erro aparece" cita os status 504/502/500, e o diagrama cita "cadeia CA ICP-Brasil"
- [x] Docs de `.docs/arquitetura/`: [README.md](../../arquitetura/README.md) (invariante 1 e diagrama), [services-sefaz.md](../../arquitetura/camadas/services-sefaz.md) (tabela do agent, recomendação de produção, tabela de `request`, "O erro vira XML"), [env.md](../../arquitetura/camadas/env.md) (seção `CA`, aviso de `rejectUnauthorized`), [controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md) (`RetornoHelper`, propagação de erro), [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md) (`tls-sefaz.test.js` e o workflow agendado)
- [x] ADR 0014 criado, índice de ADRs atualizado e candidato "`rejectUnauthorized: false`" removido

## Validação pré-PR (obrigatório)

Rodar na raiz do repositório:

- [x] `npm run format` (ou conferir com `npm run format:check`)
- [x] `npm run certs:teste` — se `certs/` ainda não existir (o script aborta se existir, para não sobrescrever certificado real)
- [x] `npm run test:ci` — tudo menos `test/sefaz.test.js` e `test/tls-sefaz.test.js`
- [x] `npx mocha test/tls-sefaz.test.js` — exige rede
- [x] `test/sefaz.test.js` rodado à parte (`npx mocha test/sefaz.test.js`) — exige certificado A1 válido e acesso à rede
- [x] `npm run build` — confere o JSDoc e regenera `lib/`, `dist/` e `src/env/version.js`; conferir que `dist/index.d.ts` expõe `CA_PADRAO`, `CA_ICP_BRASIL` e `transportError`
- [x] `npm pack --dry-run` — o tarball não muda de forma (nenhum arquivo novo fora de `lib/` e `dist/`)
- [x] `git status` limpo, exceto o que a tarefa mudou de propósito

## Notas de implementação

> Preenchido durante ou após a implementação.

- **Composição em `src/env/ca.js`**, não em `src/util/`: `CA_PADRAO` é uma constante como as outras e os helpers a leem pelo mesmo caminho de `CA`. A exceção à regra de "módulo de dado" ficou registrada em [env.md](../../arquitetura/camadas/env.md).
- **Congelamento em `src/index.js`**, no lugar: `Object.freeze(env.CA)` e `Object.freeze(env.CA_PADRAO)` congelam os mesmos arrays que os helpers usam, e atribuir o resultado a `const` faz os dois saírem como `readonly string[]` no `dist/index.d.ts`. Com `Object.freeze(CA_PADRAO)` como instrução solta, o `tsc` tipava `CA_PADRAO` como `string[]` mutável.
- **Testes unitários em dois arquivos**: `test/ca.test.js` (exportação, congelamento, composição) e `test/transporte.test.js` (servidor HTTPS local, `SefazService`, `RetornoHelper`). Nenhum lê `certs/`. A chave do servidor local sai de `crypto.generateKeyPairSync` e o certificado é montado pelo node-forge: gerar RSA 2048 em JS puro deixaria o `before` lento sem ganho.
- **Dois testes além da lista**: `SefazService.request` com erro sem `code` (`ERR_DESCONHECIDO`) e com rejeição que não é `Error` (`String(error)`), trocando `client.instance` — a classe do serviço é a única de `src/` sem `Object.freeze`.
- **Contagem de testes**: `test:ci` passou de 76 para 92; o total, de 82 para 103 (92 + 5 de `tls-sefaz.test.js` + 6 de `sefaz.test.js`).
- **Node 20 simulado**: `tls.getCACertificates = undefined` antes do `require` faz `CA_PADRAO` cair em `tls.rootCertificates` + ICP-Brasil (122 itens no Node 24.19), e `ca.test.js`, `transporte.test.js` e `tls-sefaz.test.js` passam nesse modo. A primeira rodada da CI no PR passou também no Node 20 real.
- **`sefaz.test.js` não rodou com A1 real**: o `certs/` desta máquina é o descartável. Com ele e a validação ligada, os dois casos "sem informar cert.pem e key.pem" passam (`403`) e os quatro que exigem A1 recebem `403` em vez de `200` — todos com resposta HTTP, ou seja, o handshake com `CA_PADRAO` fechou nos seis. Rodado depois com A1 válido (ICP-Brasil, AC Certisign RFB G5), antes do release da 0.19.0: os 6 passam (`403` sem certificado, `200` com ele, produção e homologação, nos dois serviços), e `npm test` completo fecha 103 de 103.
- **`cadeia-tls.yml` ainda não rodou no GitHub**: `workflow_dispatch` só fica disponível depois que o arquivo chega à `main`. Disparar à mão logo após o merge para confirmar que o runner (fora do Brasil) alcança `www1` e `hom1`. Localmente, `npx mocha test/tls-sefaz.test.js` passou nos quatro casos de host. Disparado após o merge (run [37143823035](https://github.com/bitize/bitmde/actions/runs/37143823035)): verde, o runner alcança os dois hosts.
- **Node 20 removido (fora da especificação original, a pedido no PR)**: sem suporte do projeto Node.js desde abril de 2026, sai da matriz de `testes.yml` (fica 22/24), e o `package.json` ganha `engines: { node: ">=22" }`, com o `package-lock.json` no mesmo commit. O fallback para `tls.rootCertificates` da Decisão 1 continua, agora para o Node 22 anterior à 22.15.
- **Revisão automática (CodeRabbit)**: `ca.test.js` passou a comparar `CA_PADRAO` com a seleção efetiva do runtime em vez de presumir `tls.rootCertificates` (com `--use-openssl-ca` os dois divergem). Não aplicado: ler o arquivo de `NODE_EXTRA_CA_CERTS` à mão no fallback. A Decisão 1 já aceita essa limitação, que agora só afeta o Node 22 anterior à 22.15, e quem precisa compõe `[...CA_PADRAO, minhaCa]`.
- **Recepção de evento**: [recepcao-evento.md](../../arquitetura/fluxos/recepcao-evento.md) ganhou um aviso de que timeout não prova que o lote não chegou, porque com `status: 0` fica mais tentador reenviar às cegas.

## Conclusão e entrega

Executar **após o PR ser mergeado na `main`**:

- [x] Desvios registrados em "Notas de implementação"
- [x] Checklists marcados — os dois de `sefaz.test.js` com A1 real fecharam antes do release da 0.19.0 (ver Notas de implementação)
- [x] Cabeçalho: **Status** = `done` e **Concluído em** preenchido
- [x] Arquivo movido: `git mv .docs/tasks/specified/GH-14-tls-validado-e-erro-de-transporte-explicito.md .docs/tasks/done/GH-14-tls-validado-e-erro-de-transporte-explicito.md`
- [x] Blockquote de especificação na issue apontando para `.docs/tasks/done/` (era `specified/`)
- [x] Issue fechada no GitHub (pelo `Closes #14` do PR #15)

## Referências

- [Visão geral e invariantes](../../arquitetura/README.md)
- [camadas/services-sefaz.md](../../arquitetura/camadas/services-sefaz.md), [camadas/env.md](../../arquitetura/camadas/env.md), [camadas/controllers-helpers.md](../../arquitetura/camadas/controllers-helpers.md), [camadas/apis.md](../../arquitetura/camadas/apis.md)
- [testes-e-certificados.md](../../arquitetura/testes-e-certificados.md), [build-e-versao.md](../../arquitetura/build-e-versao.md), [release.md](../../arquitetura/release.md)
- [ADR 0001](../../arquitetura/decisoes/0001-fork-e-republicacao-como-bitize-bit-mde.md) — compatibilidade da API pública
- [ADR 0004](../../arquitetura/decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) — erro de rede vira retorno; tabela de status sintético substituída pelo 0014
- [ADR 0005](../../arquitetura/decisoes/0005-object-freeze-pervasivo.md) — `httpsOptions` congelado, cópia antes da mescla
- [ADR 0011](../../arquitetura/decisoes/0011-files-e-exports-como-contrato-de-empacotamento.md) — superfície pública na raiz
- [ADR 0013](../../arquitetura/decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md) — precedente de complementar o 0004 sem editá-lo
- Node.js: [`tls.getCACertificates`](https://nodejs.org/api/tls.html#tlsgetcacertificatestype), [`tls.rootCertificates`](https://nodejs.org/api/tls.html#tlsrootcertificates) e a opção `ca` de [`tls.createSecureContext`](https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions) ("substitui as CAs padrão")
- Issue: https://github.com/bitize/bitmde/issues/14

## Histórico de revisões

| Data       | Rev | Descrição                                                        |
| ---------- | --- | ---------------------------------------------------------------- |
| 2026-10-03 | 1.0 | Criação da especificação                                         |
| 2026-10-03 | 1.1 | Implementação e notas                                            |
| 2026-10-03 | 1.2 | Entregue no PR #15 (merge `dcaffd9`); tarefa movida para `done/` |
| 2026-10-03 | 1.3 | `sefaz.test.js` com A1 real: 6/6; liberado o release da 0.19.0   |
