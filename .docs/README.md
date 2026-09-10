# .docs — documentação interna do bitmde

Documentação de desenvolvimento do repositório. **Não** vai no pacote publicado (o `files` do [package.json](../package.json) só lista `lib/`, `dist/` e `CHANGELOG.md`) e **não** substitui o [README.md](../README.md), que é a documentação pública da API, lida por quem instala `@bitize/bitmde`.

## Mapa

| Pasta                                          | O que guarda                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [arquitetura/](arquitetura/)                   | Como o código é organizado e quais invariantes o sustentam. Fonte da verdade para especificar tarefa. |
| [arquitetura/decisoes/](arquitetura/decisoes/) | ADRs — o _porquê_ de escolhas que atravessam vários docs.                                             |
| [conhecimento/](conhecimento/)                 | Material externo: SEFAZ (MOC, notas técnicas, XSD), links e notas de terceiros.                       |
| [tasks/](tasks/)                               | Tarefas de desenvolvimento versionadas, com ciclo de vida em pastas.                                  |

## Onde cada coisa é documentada

| Assunto                                      | Onde                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| API pública (instalação, exemplos, retorno)  | [README.md](../README.md)                                                          |
| Regras operacionais para agentes de IA       | [CLAUDE.md](../CLAUDE.md) (e o ponteiro [AGENTS.md](../AGENTS.md))                 |
| Histórico de versões publicadas              | [CHANGELOG.md](../CHANGELOG.md)                                                    |
| Como contribuir / código de conduta          | [CONTRIBUTING.md](../CONTRIBUTING.md), [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) |
| Estrutura interna, camadas, invariantes      | [arquitetura/](arquitetura/)                                                       |
| Porquê de uma escolha estrutural             | [arquitetura/decisoes/](arquitetura/decisoes/)                                     |
| Trabalho planejado, em andamento ou entregue | [tasks/](tasks/)                                                                   |

O critério de fronteira entre esses destinos está em [arquitetura/ESTRUTURA.md](arquitetura/ESTRUTURA.md).

## Convenções

- **Português**, inclusive em nome de pasta e de arquivo — mesma regra do código. Nome de arquivo em kebab-case, minúsculo, sem acento.
- **Prettier formata o Markdown daqui.** Rodar `npm run format` antes de commitar; sem isso o job `qualidade` reprova em `format:check`. Na prática ele só realinha coluna de tabela — não reflowa parágrafo (`proseWrap: preserve`) nem toca em bloco de código.
- **Link relativo** entre documentos, nunca caminho absoluto — assim funciona no GitHub e no editor.
- Doc desatualizado é pior que doc ausente: mudou o código, o doc correspondente muda no mesmo PR.
