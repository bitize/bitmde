# Conhecimento externo

Material que **não é nosso**: documentação da SEFAZ, notas técnicas, XSDs, comportamentos observados do serviço e links de referência.

Está separado de [../arquitetura/](../arquitetura/) porque tem outro ciclo de vida — muda quando a SEFAZ muda, não quando o nosso código muda.

## O que entra aqui

- Resumo de nota técnica ou de trecho do Manual de Orientação do Contribuinte que afeta a biblioteca;
- Tabela de código (`cStat`, `tpEvento`, schema de `docZip`) que a gente consulta com frequência;
- Comportamento observado do serviço que não está documentado — restrição de cadência, mensagem de erro real, diferença entre produção e homologação;
- Links, com data de acesso.

## O que não entra

- Como o nosso código funciona → [../arquitetura/](../arquitetura/);
- Por que escolhemos algo → [../arquitetura/decisoes/](../arquitetura/decisoes/);
- Cópia integral de documento da SEFAZ **fora de [fontes/](fontes/)**. Nos resumos, resumir o que importa e linkar a fonte; documento fiscal é revisado com frequência e a cópia envelhece em silêncio.

## Fontes originais (`fontes/`)

Quando um documento oficial é base de uma decisão ou de uma tarefa, o **original** fica versionado em `fontes/<assunto>/`, para que a decisão continue verificável mesmo depois de o portal trocar a versão. Regras:

- **Nome com versão e data de publicação**, como o órgão as informa: `manual-contribuintes-apis-adn-v1.0-20260212.pdf`. Versão nova entra como **arquivo novo**, ao lado da anterior — não sobrescrever: o resumo e as tarefas citam a versão que leram.
- **Arquivo como baixado**, sem editar. O `README.md` de cada assunto registra, por arquivo, a URL de origem, a data de download e o SHA-256.
- **Só documento público.** Nada de XML de produção, certificado ou dado de contribuinte — o repositório é público.
- O original não substitui o resumo: o que a biblioteca usa vai num `.md` aqui ao lado, citando o arquivo de `fontes/`.

## Convenção

Um arquivo por assunto, kebab-case. Começar com a **fonte e a data**:

```markdown
# Título

**Fonte**: <link ou nome do documento e versão>
**Consultado em**: AAAA-MM-DD
```

A data importa mais aqui do que em qualquer outro doc do repositório: material fiscal desatualizado leva a decisão errada, e sem data ninguém sabe se ainda vale.

## Referências permanentes

| O quê                                       | Onde                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Portal da NF-e — serviços e documentação    | https://www.nfe.fazenda.gov.br                                                                                         |
| Relação de serviços web (Ambiente Nacional) | Portal NF-e → Serviços → Relação de Serviços Web                                                                       |
| Endpoints usados pela biblioteca            | [../../src/env/distribuicao.js](../../src/env/distribuicao.js), [../../src/env/recepcao.js](../../src/env/recepcao.js) |
