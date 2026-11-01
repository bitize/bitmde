# 0017 — Dependências de runtime em faixa, não em versão exata

**Status**: Aceito
**Data**: 2026-11-01

## Contexto

Na 0.15.0, a rodada que zerou o `npm audit` herdado do upstream ([ADR 0001](0001-fork-e-republicacao-como-bitize-bit-mde.md)) fixou quatro das cinco dependências de runtime em versão exata: `axios`, `fast-xml-parser`, `node-forge` e `xml-crypto`. Nenhum documento registrou o motivo, e o efeito só apareceu depois, em quem consome o pacote.

O lockfile do bitmde não vai no pacote publicado ([ADR 0003](0003-lockfile-versionado.md)): quem instala resolve as versões pelo `package.json`. Com pino exato, isso tem duas consequências:

- **O consumidor não deduplica.** Um projeto que peça `fast-xml-parser ^5.11.1` fica com duas cópias, a dele e a 5.11.0 aninhada em `node_modules/@bitize/bitmde/node_modules/`.
- **Correção de segurança só chega com release nosso.** Na 0.22.0, `node-forge` 1.4.0 e `axios` 1.19.0 tinham 12 avisos cada, com versões corrigidas na mesma linha (1.4.2 e 1.20.0). O consumidor não tinha como recebê-las: o `^` dele não alcança a cópia aninhada, e um `overrides` o faria rodar o bitmde numa versão com que ele não foi publicado.

A reprodutibilidade que o pino poderia dar já vem do lockfile, no nosso build. No consumidor, ela não existe de qualquer forma: o pino fixa a dependência direta, mas as transitivas continuam resolvidas pela faixa de cada uma.

## Alternativas consideradas

**Manter o pino exato e bumpar a cada aviso.** Resolve o audit do dia e repete o problema no próximo: cada correção de dependência vira release do bitmde, e o consumidor espera por ele. Não resolve a duplicação.

**Caret (`^`) em todas.** O consumidor deduplica e recebe minor e patch sem depender de nós. O risco é um minor mudar comportamento; nas dependências de transporte, parse e certificado, isso aparece como teste vermelho na CI ou no consumidor.

**Caret em todas, til (`~`) no `xml-crypto`.** Igual à anterior, menos na dependência que assina. No `xml-crypto`, uma mudança de comportamento padrão produz XML assinado diferente sem quebrar nenhuma chamada, e pode virar rejeição da SEFAZ em produção. Já aconteceu: a v3 deixou de usar `rsa-sha1` como padrão. Patch continua entrando; minor passa a exigir PR nosso, com o `test/assinatura.test.js` conferindo o lote byte a byte.

## Decisão

**Dependências de runtime declaradas em faixa: `^` por padrão, `~` no `xml-crypto`.**

Na 0.23.0: `axios ^1.21.0`, `fast-xml-parser ^5.11.2`, `luxon ^3.7.2` (já estava), `node-forge ^1.4.2` e `xml-crypto ~6.4.0`.

O piso da faixa é a versão sem aviso conhecido no momento do bump, e não a mais antiga que funciona: subir o piso é o que garante que nenhuma instalação nova resolva para uma versão vulnerável.

## Consequências

**Fica mais fácil:**

- O consumidor deduplica as dependências que compartilha com o bitmde;
- Correção de segurança em minor ou patch chega ao consumidor sem release nosso, assim que ele atualiza o próprio lockfile — a faixa permite a versão nova, mas não troca sozinha a que já está gravada lá;
- Bump de rotina vira só regenerar o lockfile, sem tocar o `package.json`.

**Fica mais difícil:**

- O consumidor pode rodar o bitmde com um minor de dependência que a nossa CI ainda não viu. O teste dele é a primeira barreira; a nossa CI pega na próxima vez que o lockfile for regenerado;
- Subir o minor do `xml-crypto` continua manual, e é de propósito.

**Compromisso de longo prazo:**

- **Dependência nova de runtime entra em faixa.** Pino exato só com motivo registrado aqui, num ADR que supersede este;
- **`xml-crypto` fica em `~`.** Subir o minor exige que o `test/assinatura.test.js` passe sem mudar os XMLs congelados — o lote da NF-e e o `pedRegEvento` da NFS-e; se mudar, é decisão de tarefa própria, com `test/sefaz.test.js` contra homologação;
- Dependências de dev não entram nesta regra. O Prettier continua em versão exata, pelo motivo do [ADR 0003](0003-lockfile-versionado.md).
