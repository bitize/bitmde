# Fluxo — NFeRecepcaoEvento4 (manifestação do destinatário)

Envio de lote de eventos de manifestação. É o único fluxo que **assina** XML, e o único cuja montagem de XML sai do schema e vai para manipulação de string.

## O caminho completo

```text
RecepcaoEvento.enviarEvento({ idLote, lote })      ← apis/recepcaoEvento-api.js
  │  LoteValidator: array com 1 a 20 eventos; default idLote = '1'
  │  para cada item: EventoValidator → resolve tpEvento/descEvento
  │  acrescenta nSeqEvento='1', cOrgao='91', infEventoId, dhEvento
  ▼
RecepcaoController.enviar({ ...config, idLote, eventos })
  │
  ├─ RecepcaoHelper.montarRequest(opts)
  │    para cada evento:
  │      RecepcaoSchema.montarSchema → objeto JS (um evento)
  │      Xml.jsonToXml               → XML completo, com envEvento em volta
  │      Assinatura.assinarXml       → assina o infEvento
  │    recorta cada XML e concatena dentro de um único <envEvento>
  │    Xml.envelopar                 → <soap12:Envelope>…
  │
  ├─ RecepcaoHelper.enviarEvento(data, opts)
  │    endpoint = RECEPCAO[tpAmb]  →  POST  →  { status, data, transportError? }
  │
  ├─ RecepcaoHelper.montarResponse(retornoSefaz.data)   ← síncrono
  │
  └─ RetornoHelper.montarRetorno → { data, reqXml, resXml, status, error?, transportError? }
```

## Os campos derivados

O usuário informa apenas `chNFe`, `tipoEvento` e (quando 210240) `justificativa`. Todo o resto é montado em [recepcaoEvento-api.js](../../../src/apis/recepcaoEvento-api.js):

| Campo         | Valor                                 | Observação                                       |
| ------------- | ------------------------------------- | ------------------------------------------------ |
| `cOrgao`      | `'91'`                                | Ambiente Nacional, fixo                          |
| `nSeqEvento`  | `'1'`                                 | Fixo — a biblioteca não faz reenvio sequenciado  |
| `infEventoId` | `` `ID${tpEvento}${chNFe}01` ``       | Vira o atributo `Id`, que é o alvo da assinatura |
| `dhEvento`    | `Data.toFormat(new Date(), timezone)` | `yyyy-MM-dd'T'HH:mm:ssZZ` via luxon              |
| `descEvento`  | De `EVENTOS[tipoEvento]`              | Texto sem acento, exigido pelo leiaute           |

O `'01'` no fim do `Id` é o `nSeqEvento` com dois dígitos. Como `nSeqEvento` é fixo em `'1'`, os dois andam juntos — mudar um exige mudar o outro, senão a SEFAZ rejeita por inconsistência entre `Id` e conteúdo.

`dhEvento` é o único ponto não-determinístico da biblioteca: usa o relógio da máquina. Máquina com hora errada gera evento rejeitado.

## Assinatura

[src/util/assinatura.js](../../../src/util/assinatura.js), com `xml-crypto`:

| Parâmetro               | Valor                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| Referência (XPath)      | `//*[local-name(.)='infEvento']`                                     |
| Transforms              | `enveloped-signature` + `xml-c14n-20010315`                          |
| Algoritmo de assinatura | `rsa-sha1`                                                           |
| Digest                  | `sha1`                                                               |
| Canonicalização         | `xml-c14n-20010315`                                                  |
| Posição                 | `action: 'after'` — a `Signature` entra **depois** do nó `infEvento` |
| `KeyInfo`               | `X509Data`/`X509Certificate` montado à mão                           |

Três coisas aqui não são negociáveis:

1. **RSA-SHA1 e digest SHA1.** A NF-e exige. Até a v2 o `xml-crypto` usava esses algoritmos por padrão; da v3 em diante precisam ser informados explicitamente — foi o que a 0.15.0 fez ao subir para o `xml-crypto` 6, mantendo o XML assinado byte a byte idêntico.
2. **XPath por `local-name()`.** O documento tem namespace default (`xmlns="http://www.portalfiscal.inf.br/nfe"`); um XPath com nome qualificado não casaria sem registrar prefixo.
3. **O `getKeyInfoContent` faz `cert.split('-----')[2]`.** Extrai o corpo base64 do PEM entre os delimitadores e remove quebras de linha. Depende do formato exato do PEM — que é o que o `CertificadoValidator` produz, via node-forge ou lido do disco. PEM com cadeia concatenada (mais de um bloco `BEGIN CERTIFICATE`) pegaria o primeiro corpo, que é o certificado folha; é o comportamento desejado, mas por acidente da estrutura, não por checagem.

Cada evento é assinado **individualmente**, antes de entrar no lote. Ver [ADR 0007](../decisoes/0007-assinatura-por-infevento-e-splice-do-lote.md).

## O recorte de string

Este é o ponto mais frágil do código e merece leitura atenta:

```js
const xml = `<nfeDadosMsg xmlns="…/NFeRecepcaoEvento4"><envEvento xmlns="…/nfe" versao="1.00"><idLote>${
  opts.idLote
}</idLote>${eventosXML.reduce((acc, cur) => {
  acc += cur.substring(
    cur.indexOf('<evento versao="1.00">'),
    cur.indexOf('</envEvento>')
  )
  return acc
}, '')}</envEvento></nfeDadosMsg>`
```

O que acontece: `RecepcaoSchema` monta **um evento por vez**, mas gera a árvore completa — `nfeDadosMsg` > `envEvento` > `evento`. Depois de assinado, cada XML é recortado entre `<evento versao="1.00">` e `</envEvento>`, e os pedaços são concatenados dentro de um `envEvento` único, escrito à mão aqui.

O recorte é por `indexOf` de **literal exato**. Ele depende de:

- o `XMLBuilder` emitir `<evento versao="1.00">` exatamente assim, com um espaço e aspas duplas;
- `'@_versao': '1.00'` continuar sendo o **último** atributo de `evento` no schema (a ordem das chaves determina a ordem dos atributos);
- a assinatura ser inserida **dentro** de `evento` e antes de `</envEvento>` — garantido por `action: 'after'` sobre `infEvento`;
- nenhum espaço em branco entre as tags.

> **Mexer no formato do XML gerado pelo schema pode quebrar esse recorte silenciosamente**: `indexOf` que não encontra devolve `-1`, e `substring(-1, n)` trata como `0` — o resultado seria um XML com prefixo indevido, aceito pelo JS e rejeitado pela SEFAZ. Alterou schema de recepção, rodar os testes de recepção.

## Limites do lote

`LoteValidator` exige **1 a 20 eventos**. O limite superior é do próprio serviço da SEFAZ. O primeiro evento inválido lança e nada é enviado — não há envio parcial.

## O retorno

`data` traz os campos de `retEnvEvento` mais `infEvento[]`, um por evento do lote:

| Nível      | Campos                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Lote       | `idLote`, `tpAmb`, `verAplic`, `cOrgao`, `cStat`, `xMotivo`                                                                         |
| Por evento | `tpAmb`, `verAplic`, `cOrgao`, `cStat`, `xMotivo`, `chNFe`, `tpEvento`, `xEvento`, `nSeqEvento`, `CNPJDest`, `dhRegEvento`, `nProt` |

**O `cStat` do lote e o de cada evento são independentes.** Lote aceito (`cStat` 128) com evento rejeitado dentro dele é o caso normal — sempre inspecionar `infEvento[]` item a item, e não só o status do lote. `nProt` preenchido é o sinal de evento registrado.

Como em toda a biblioteca, campo ausente vira `''`, e o array é normalizado mesmo quando a SEFAZ devolve um único `retEvento`.

Quando a SEFAZ não responde — cadeia TLS que não fecha, DNS, conexão recusada, timeout —, o retorno vem com `status: 0`, `resXml: ''`, `data: {}` e `transportError: { code, message }`. O `reqXml` assinado continua no retorno. Um timeout **não** prova que o lote não chegou: antes de reenviar, consultar a situação da NF-e, porque um evento já registrado volta rejeitado como duplicidade. Ver [ADR 0014](../decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md).
