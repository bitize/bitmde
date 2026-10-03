# 0014 — TLS validado por padrão e erro de transporte explícito

**Status**: Aceito
**Data**: 2026-10-03

> Complementa a [ADR 0004](0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md), cujo princípio não muda: configuração lança, rede retorna. Este registro **substitui** a tabela de status sintético da 0004 (504/502/500) e o item "Status 502/504/500 sintéticos se misturam a status reais da SEFAZ" do "Fica mais difícil" dela. A 0004 não é editada, como no precedente da [0013](0013-falha-de-doczip-vira-item-de-doczip-errors.md). Tarefa de origem: [GH-14](https://github.com/bitize/bitmde/issues/14).

## Contexto

Até a 0.18.0, três comportamentos se somavam:

1. **A cadeia embarcada substituía as raízes do Node.** [src/env/ca.js](../../../src/env/ca.js) trazia só a ICP-Brasil (AC Raiz Brasileira v10 e AC SERPRO SSLv1), passada como `ca` do `https.Agent`. No Node, `ca` **substitui** as raízes padrão em vez de somar. O Ambiente Nacional (`www1` e `hom1`) passou a servir `AC SERPRO AR46 OV TLS CA 2025 ← GlobalSign Root R46`, que está no bundle da Mozilla e não está na ICP-Brasil. Handshake com `rejectUnauthorized: true` e só a cadeia embarcada: `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` nos dois hosts. Com as raízes do Node, fecha.
2. **A validação vinha desligada.** O padrão era `rejectUnauthorized: false`: qualquer servidor era aceito, e recebia o certificado A1 do contribuinte no mTLS. Foi isso que escondeu o problema 1 de quem ficava no padrão.
3. **O erro de transporte se disfarçava de HTTP.** Sem resposta, o `SefazService` devolvia 504 (timeout), 502 (sem resposta) ou 500 (erro antes do envio), com a mensagem embrulhada em `<error>…</error>` no lugar do corpo. O `code` do erro se perdia, e um 502 sintético era indistinguível de um 502 real da SEFAZ.

Um consumidor que seguiu a recomendação da própria documentação e ligou a validação passou a receber 502 em toda chamada.

## Alternativas consideradas

**Cadeia padrão.**

- Não passar `ca` e deixar o Node usar as raízes padrão. Resolve o AN de hoje, mas descarta a ICP-Brasil, e o pacote quebraria do mesmo jeito se o AN voltasse a uma cadeia ICP-Brasil.
- `[...tls.rootCertificates, ...CA]`. Passar `ca` explícito desliga `NODE_EXTRA_CA_CERTS` e `--use-system-ca`, e `tls.rootCertificates` é só o bundle da Mozilla. Quem está atrás de proxy corporativo com CA própria quebraria ao atualizar.
- `[...raízes padrão do runtime, ...CA]`, com `tls.getCACertificates('default')` quando existir e `tls.rootCertificates` quando não existir (Node 22 anterior à 22.15).

**Padrão de `rejectUnauthorized`.** Inverter o padrão; manter `false` com flag de opt-in; inverter com flag de opt-out.

**Forma do erro de transporte.**

- Lançar um erro tipado. Contraria a 0004: erro de rede é condição de operação, e `reqXml` deixaria de chegar para diagnóstico.
- Manter os status sintéticos e só acrescentar `transportError`. Quem lê `status` continuaria vendo um 502 que a SEFAZ não mandou.
- `status: 0` com `transportError: { code, message }` e `error` preenchido.

## Decisão

**1. A cadeia padrão soma as raízes do runtime à ICP-Brasil.** `CA_PADRAO = [...raízes, ...CA]`, onde as raízes vêm de `tls.getCACertificates('default')` quando a função existe e de `tls.rootCertificates` quando não existe. A composição acontece uma vez, no carregamento do módulo. Duplicatas não são filtradas: o OpenSSL não se importa.

**2. `rejectUnauthorized: true` por padrão, sem flag nova.** O opt-out já existe, `httpsOptions: { rejectUnauthorized: false }`, porque `httpsOptions` sobrescreve qualquer default. Uma flag seria uma segunda forma de dizer a mesma coisa. As decisões 1 e 2 só fazem sentido juntas: a 1 sozinha mantém o padrão aceitando qualquer servidor; a 2 sozinha quebra todo mundo.

**3. Sem resposta HTTP, `status: 0` e `transportError`.** Os três ramos sintéticos colapsam num só:

```js
{
  data: {},
  reqXml: '<soap12:Envelope…>',
  resXml: '',
  status: 0,
  error: 'Falha de transporte (UNABLE_TO_GET_ISSUER_CERT_LOCALLY): unable to get local issuer certificate',
  transportError: {
    code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    message: 'unable to get local issuer certificate',
  },
}
```

- `status: 0` é a convenção de `fetch` e `XMLHttpRequest` para "não houve resposta HTTP" e não colide com nenhum status real.
- `code` é o `error.code` sem remapear (`ERR_DESCONHECIDO` quando falta). A distinção entre timeout (`ECONNABORTED`), sem resposta e erro antes do envio fica nele, que é mais preciso que os três números.
- `error` continua string e continua presente: quem testa `if (retorno.error)` não muda nada.
- Do erro capturado saem **só** `code` e `message`. O `AxiosError` carrega `config.httpsAgent`, e o agente guarda `cert` e `key` do A1 nas options. Repassar o erro, `error.config`, `error.request`, ou usá-lo como `cause`, vazaria a chave privada para log.

As cadeias saem na raiz do pacote como `CA_PADRAO` e `CA_ICP_BRASIL`, congeladas, sem subcaminho em `exports` (ver [ADR 0011](0011-files-e-exports-como-contrato-de-empacotamento.md)).

## Consequências

**Fica mais fácil:**

- Ficar no padrão e estar seguro: o servidor é verificado e o A1 só vai para quem fecha a cadeia;
- Distinguir "a SEFAZ respondeu mal" de "a SEFAZ não respondeu": `status: 0` só significa o segundo;
- Diagnosticar falha de rede pelo `code` original, sem heurística sobre `resXml`;
- Usar proxy corporativo: `NODE_EXTRA_CA_CERTS` volta a funcionar no Node que oferece `getCACertificates`.

**Fica mais difícil:**

- Servidor com cadeia que não fecha em `CA_PADRAO` é recusado. Quem precisa de outra AC compõe `[...CA_PADRAO, minhaCa]` — informar `ca` substitui a cadeia inteira;
- No Node 22 anterior à 22.15, sem `getCACertificates`, `NODE_EXTRA_CA_CERTS` continua sem efeito sobre a cadeia padrão. O Node 20, sem suporte desde abril de 2026, saiu da matriz de testes na mesma versão (`engines: >=22`);
- `NODE_EXTRA_CA_CERTS` alterado depois do `require` não tem efeito.

**Compromisso de longo prazo:**

- Nenhum status HTTP é sintetizado pela biblioteca. `status` é sempre o que o servidor mandou, ou `0`;
- `transportError` tem só `code` e `message`, ambos string. Nada do objeto de erro do axios chega ao retorno;
- A cadeia do AN é verificada toda semana por [cadeia-tls.yml](../../../.github/workflows/cadeia-tls.yml), com [test/tls-sefaz.test.js](../../../test/tls-sefaz.test.js). Se a ICP-Brasil sozinha voltar a fechar o handshake, o teste falha de propósito, para alguém rever a decisão 1;
- Reverter qualquer uma das três decisões é outro breaking change.
