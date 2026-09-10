# 0012 — Renomeação de `@bitize/bit-mde` para `@bitize/bitmde`

**Status**: Aceito
**Data**: 2026-09-10

## Contexto

O [ADR 0001](0001-fork-e-republicacao-como-bitize-bit-mde.md) escolheu `@bitize/bit-mde` ao republicar o fork, montando o nome do pacote a partir do nome do projeto original (`node-mde`) com o prefixo da casa. O hífen no meio veio junto, sem que ninguém decidisse por ele.

Na prática o nome tem duas grafias. Quem procura o pacote escreve `bitmde` tanto quanto `bit-mde` — inclusive quem o mantém: a conversa que originou esta decisão começou com uma tentativa de abrir `npmjs.com/package/bit-mde`, que nunca existiu. O nome sem hífen é o que sai naturalmente ao falar e ao digitar, e é o que combina com `Bitize`, escrito sem separador.

A janela para corrigir isso é agora. Existem duas versões publicadas (0.15.0 e 0.16.0), com menos de um mês de idade e adoção externa mínima. Cada versão nova aumenta o custo de renomear: consumidor instalado, cache de CDN, link em documento de terceiro.

## Alternativas consideradas

**Manter `@bitize/bit-mde`.** Custo zero hoje. Conserva a ambiguidade de grafia para sempre, num pacote que a Bitize pretende manter por anos — e o custo de mudar de ideia só cresce.

**`bitmde`, sem escopo.** Mais curto de instalar e de citar (`npm i bitmde`), e dispensa o `publishConfig.access: "public"`. Descartado por duas razões: nome sem escopo é first-come-first-served e não se reivindica de volta se alguém o registrar antes numa próxima migração; e o escopo é o que diz quem mantém, que foi justamente o motivo de adotá-lo no ADR 0001.

**`@bitize/bitmde`.** Resolve a grafia mantendo tudo o que o escopo já dá.

## Decisão

**O pacote passa a se chamar `@bitize/bitmde` e o repositório, [bitize/bitmde](https://github.com/bitize/bitmde).**

- A **API pública não muda** — o compromisso do ADR 0001 continua valendo. A migração para quem consome é trocar o nome na instalação e nos `require`/`import`.
- A **numeração de versão continua a série**, sem reiniciar: a primeira versão sob o nome novo é a seguinte à 0.16.0. É o mesmo tratamento que a renomeação de `node-mde` para `@bitize/bit-mde` recebeu, que saiu como 0.15.0 depois da 0.14.13.
- O pacote antigo é **deprecado, não despublicado**: `npm deprecate` com mensagem apontando para o nome novo. As versões 0.15.0 e 0.16.0 seguem instaláveis, porque desfazer isso quebraria quem já depende delas.
- O header `User-Agent` enviado à SEFAZ acompanha o nome e passa a ser `bitmde/<VERSION>`.

## Consequências

**Fica mais fácil:**

- Uma grafia só, em tudo: pacote, repositório, `User-Agent` e conversa;
- Repositório e pacote com o mesmo nome — o link entre os dois deixa de precisar de tradução.

**Fica mais difícil:**

- A **primeira publicação sob o nome novo volta a ser manual**. Trusted publisher é configurado por pacote, na página do pacote no npmjs.com, que só existe depois de publicado — repete-se o bootstrap da 0.15.0, e essa versão sai sem provenance. Ver [ADR 0002](0002-publicacao-por-oidc-sem-npm-token.md) e [release.md](../release.md);
- A configuração de trusted publisher do lado do npm precisa apontar para `bitize/bitmde` depois da renomeação do repositório;
- O `CHANGELOG.md` passa a carregar **três** identidades de pacote, e o histórico de cada uma tem de continuar legível;
- `@bitize/bit-mde` fica publicado para sempre. A mensagem de deprecação é o único sinal para quem chegar por ele.

**Compromisso de longo prazo:**

- **É a última renomeação.** Cada uma cobra do consumidor uma edição no `package.json` e nos imports, e gasta o crédito de que o nome é estável. O ganho aqui é corrigir uma escolha que nunca foi deliberada; repetir o movimento por preferência não se justificaria.
