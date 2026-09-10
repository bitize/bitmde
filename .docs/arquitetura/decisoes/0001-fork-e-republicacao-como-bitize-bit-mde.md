# 0001 — Fork de `node-mde` republicado como `@bitize/bit-mde`

**Status**: Aceito — a escolha do nome do pacote foi superseded por [0012](0012-renomeacao-para-bitize-bitmde.md); o resto segue vigente
**Data**: 2026-08-16

## Contexto

O [BitERP](https://www.biterp.ai) depende de manifestação do destinatário para operar o ciclo de NF-e. A biblioteca `node-mde`, de [lucashpmelo/node-mde](https://github.com/lucashpmelo/node-mde), resolvia o problema bem — arquitetura em camadas limpa, cobertura de teste real, sem dependência pesada.

Mas em abril de 2025 a 0.14.13 foi a última versão publicada, e ficaram pendências que afetam produção:

- 7 vulnerabilidades abertas no `npm audit` (1 crítica, 5 altas, 1 moderada), incluindo `axios`, `fast-xml-parser`, `node-forge` e `xml-crypto`;
- `xml-crypto` preso na 2.x, três majors atrás;
- nenhum canal para atender correção com a urgência que a operação exige.

## Alternativas consideradas

**Continuar consumindo `node-mde` e enviar PRs.** É o caminho educado e o de menor manutenção. Depende de o mantenedor original ter disponibilidade para revisar, mergear e publicar — e depende disso **no dia em que uma vulnerabilidade crítica aparecer**. O histórico de publicação não sustentava essa aposta.

**Fixar `node-mde` com `overrides` no consumidor.** Resolve a árvore de dependências sem tocar no código. Não resolve o `xml-crypto`: a mudança de API da v2 para a v3+ exige adaptar `Assinatura.assinarXml`, que está dentro da biblioteca. Ficaríamos travados na 2.x indefinidamente.

**Reimplementar do zero.** Descartado sem hesitação: o valor da `node-mde` está nos detalhes acumulados de leiaute, assinatura e comportamento da SEFAZ — coisas que só se aprende apanhando em produção. Reescrever seria pagar de novo por um conhecimento já pago.

**Fork mantido pela Bitize.** Preserva o código e o histórico, e transfere o controle de release para quem carrega o risco operacional.

## Decisão

**Fork em [bitize/bit-mde](https://github.com/bitize/bit-mde), publicado no npm como `@bitize/bit-mde`.**

A API pública permanece **inalterada** em relação à `node-mde` 0.14.13: mesma classe, mesmos métodos, mesmo formato de retorno. A migração para o consumidor é trocar o nome do pacote na instalação e no `require`/`import`.

O pacote é escopado sob a org `bitize` e público (`publishConfig.access: "public"`). O nome mudou porque republicar sob o nome original não é possível, e porque o escopo deixa explícito quem mantém.

## Consequências

**Fica mais fácil:**

- Corrigir vulnerabilidade no dia em que aparece, sem intermediário;
- Subir major de dependência que exige adaptação de código (foi o caso do `xml-crypto` 6 na 0.15.0);
- Adicionar tooling que o projeto original não tinha: CI em matriz de Node, guard de release, provenance.

**Fica mais difícil:**

- Todo bug agora é nosso, inclusive os herdados;
- Correção feita upstream não chega sozinha — precisa ser trazida à mão;
- O `CHANGELOG.md` carrega o histórico de duas identidades de pacote.

**Compromisso de longo prazo:**

- **A API pública é contrato.** Ela existe para permitir troca de nome sem refatoração no consumidor; quebrá-la sem major descartaria a única vantagem de compatibilidade que o fork tem.
- Manutenção contínua: acompanhar mudança de leiaute e de nota técnica da SEFAZ passou a ser responsabilidade da Bitize.
- Crédito e licença do projeto original preservados — o fork é continuação, não apropriação.
