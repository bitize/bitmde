# 0016 — Retorno próprio da NFS-e, com o mesmo contrato de erro

**Status**: Aceito
**Data**: 2026-10-15

> Decisão 2 do plano [GH-17](../../planos/concluidos/GH-17-nfse-nacional-distribuicao-e-manifestacao.md), escrita na filha [GH-18](../../tarefas/concluidas/GH-18-distribuicao-nfse-nacional-adn.md). Aplica às APIs de NFS-e o princípio da [ADR 0004](0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) e a forma do erro de transporte da [ADR 0014](0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md); não muda nenhuma das duas.

## Contexto

As APIs de NF-e devolvem `{ data, reqXml, resXml, status, error?, transportError? }`, montado pelo `RetornoHelper`. Esse formato nasceu para SOAP, e três coisas não servem para o ADN:

- **Os nomes.** O ADN responde JSON e a requisição é um `GET` sem corpo: `reqXml` não existiria e `resXml` carregaria JSON.
- **A regra de erro.** O `RetornoHelper` trata todo HTTP ≥ 300 como falha e esvazia `data`. O ADN responde **fila vazia com HTTP 404** (`NENHUM_DOCUMENTO_LOCALIZADO`, `E2220`), que é o fim normal de toda drenagem, e chave ou NSU sem documento também com 404 (`E2240`, `E2230`).
- **O status de processamento não basta.** Um `cnpjConsulta` de outra raiz volta com HTTP 400, `Erros: [E2243]` e `StatusProcessamento: DOCUMENTOS_LOCALIZADOS` (observado em produção e em produção restrita, 2026-10-15). Uma regra que olhasse só o `StatusProcessamento` daria esse caso como sucesso com lote vazio.

E o consumidor não deve precisar de dois jeitos de tratar falha: `if (retorno.error)` e `retorno.transportError` precisam significar a mesma coisa nas quatro APIs.

## Alternativas consideradas

- **Reaproveitar o `RetornoHelper`**, com JSON em `resXml`. Zero código novo, mas o nome mentiria e o 404 da fila vazia viraria `error` com `data: {}`: a drenagem não teria como distinguir "acabou" de "falhou".
- **Reaproveitar o `RetornoHelper` com exceção para 404.** Corrige o caso da fila, mas mantém os nomes SOAP e espalha regra do ADN pelo helper da NF-e, que esta mudança não deveria tocar.
- **Retorno próprio**, com o corpo cru num campo de nome honesto, `data` normalizado e o mesmo significado de `status`, `error` e `transportError`.

## Decisão

**Retorno próprio, montado pelo `RetornoNfseHelper`:**

```js
{ data, resBody, status, error?, transportError? }
```

| Campo            | Conteúdo                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `data`           | Resposta normalizada em camelCase; `erros` e `alertas` sempre arrays de `{ codigo, descricao, complemento }`    |
| `resBody`        | Corpo cru, como veio (`responseType: 'text'`); `''` sem resposta                                                |
| `status`         | HTTP real, ou `0` sem resposta — como na NF-e                                                                   |
| `error`          | String, só quando houve falha — como na NF-e                                                                    |
| `transportError` | `{ code, message }`, só sem resposta HTTP, com `error` no texto exato `Falha de transporte (<code>): <message>` |
| `reqXml`         | Só nas APIs que enviam XML de domínio (o `pedRegEvento` assinado, na GH-19); a distribuição não tem esse campo  |

As condições, nesta ordem:

| Situação                                                | `data`      | `error`                                               |
| ------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| Sem resposta HTTP                                       | `{}`        | `Falha de transporte (<code>): <message>`             |
| Corpo que não é JSON, ou JSON sem `StatusProcessamento` | `{}`        | `Resposta inesperada do ADN (HTTP <status>).`         |
| `NENHUM_DOCUMENTO_LOCALIZADO`, com qualquer status      | preenchido  | —                                                     |
| HTTP fora de 2xx, `REJEICAO` ou `Erros` não vazio       | **mantido** | `<codigo>: <descricao>` de cada erro, unidos por `; ` |
| O mesmo, mas sem nenhum item em `Erros`                 | **mantido** | `Resposta inesperada do ADN (HTTP <status>).`         |
| `DOCUMENTOS_LOCALIZADOS` com 2xx e sem `Erros`          | preenchido  | —                                                     |

Na falha com resposta JSON, `data` **não** é esvaziado, ao contrário da NF-e: lá a rejeição vem num `retDistDFeInt` que o consumidor lê por `cStat`; aqui `erros` e `tipoAmbiente` são o diagnóstico, e esvaziar só tiraria informação.

Falha de um documento do lote segue a [ADR 0013](0013-falha-de-doczip-vira-item-de-doczip-errors.md): vira item de `data.documentosErros` e não preenche o `error` de topo.

## Consequências

**Fica mais fácil:**

- Drenar a fila: o 404 do fim é `documentos: []` sem `error`, e o mesmo laço da NF-e funciona;
- Diagnosticar: `resBody` traz o corpo exato, e `data.erros` vem normalizado mesmo quando há `error`;
- Tratar falha: `if (retorno.error)` e `retorno.transportError` funcionam igual nas APIs de NF-e e de NFS-e.

**Fica mais difícil:**

- Há dois formatos de retorno no pacote. Quem escreve código genérico para as quatro APIs lê o corpo cru de `resXml` ou de `resBody`, conforme a API;
- `data` pode vir preenchido junto com `error`. Quem usa `data` precisa testar `error` antes, como já precisava com `docZipErrors`.

**Compromisso de longo prazo:**

- `status`, `error` e `transportError` mantêm o mesmo significado em toda API nova, de NF-e ou de NFS-e;
- O `RetornoHelper` da NF-e não muda por causa da NFS-e;
- A GH-19 reaproveita o `RetornoNfseHelper`. A SEFIN Nacional responde em camelCase, com `erro` único em vez de `Erros[]`: a normalização para `erros` fica no helper da manifestação, e a mensagem de resposta inesperada precisa nomear o serviço certo.
