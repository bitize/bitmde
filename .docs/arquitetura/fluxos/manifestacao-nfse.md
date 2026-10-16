# Fluxo — Manifestação do tomador da NFS-e Nacional (SEFIN)

Registro da Confirmação (`e203202`) ou da Rejeição (`e203206`) do tomador sobre uma NFS-e, na SEFIN Nacional. É o equivalente, para serviço, da [recepção de evento da NF-e](recepcao-evento.md), mas sem lote nem envelope: **um** `pedRegEvento` assinado, gzipado e em base64 dentro de um `POST` JSON. Contrato e comportamento observado do serviço em [conhecimento/nfse-nacional-sefin-eventos.md](../../conhecimento/nfse-nacional-sefin-eventos.md).

## O caminho completo

```text
ManifestacaoNFSe.rejeitar(chNFSe, motivo)        ← apis/manifestacaoNFSe-api.js
  │  ChaveNfseValidator: 50 dígitos
  │  MotivoRejeicaoValidator: cMotivo em 1–5 ou 9, xMotivo 15–255, obrigatório no 9
  │  montarOpts: evento (EVENTOS_NFSE), verAplic, dhEvento no timezone da config
  ▼
ManifestacaoNFSeController.enviar({ ...config, chNFSe, evento, verAplic, dhEvento, cMotivo, xMotivo })
  │
  ├─ ManifestacaoNFSeHelper.montarRequest(opts)              ← async: gzip
  │    ManifestacaoNFSeSchema.montarSchema → Xml.jsonToXml
  │    Assinatura.assinarXml(cert, key, xml, 'infPedReg')
  │    '<?xml version="1.0" encoding="UTF-8"?>' + assinado  = reqXml
  │    Gzip.zip(reqXml) → { pedidoRegistroEventoXmlGZipB64 }
  │    config = { method: 'POST', url: '/nfse/{chNFSe}/eventos', data,
  │               headers: { Accept, Content-Type: application/json }, responseType: 'text' }
  │
  ├─ ManifestacaoNFSeHelper.enviarEvento(config, opts)
  │    endpoint = NFSE_SEFIN[tpAmb]
  │    new SefazService({ baseURL, ca: CA_PADRAO, cert, key, tpAmb, requestOptions, httpsOptions })
  │    POST → { status, data, transportError? }
  │
  ├─ ManifestacaoNFSeHelper.montarResponse(corpo)            ← async: gunzip; nunca lança
  │    JSON.parse protegido → json null se não for resposta da SEFIN
  │    erro (array ou objeto) → erros normalizados
  │    eventoXmlGZipB64 → abrirEvento → { xml, json } ou falha
  │
  └─ RetornoNfseHelper.montarRetorno({ json, falha, retorno, servico: 'SEFIN', reqXml })
       → { data, reqXml, resBody, status, error?, transportError? }
```

`confirmar(chNFSe)` é o mesmo caminho sem o motivo.

## O pedido

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infPedReg Id="PRE{chNFSe}203202">
    <tpAmb>2</tpAmb>
    <verAplic>bitmde/x.y.z</verAplic>
    <dhEvento>2026-10-16T09:30:00-03:00</dhEvento>
    <CNPJAutor>{config.cnpj}</CNPJAutor>
    <chNFSe>{chNFSe}</chNFSe>
    <e203202><xDesc>Manifestação de NFS-e - Confirmação do Tomador</xDesc></e203202>
  </infPedReg>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">…</Signature>
</pedRegEvento>
```

Indentado aqui só para leitura: o builder emite tudo numa linha. A Rejeição troca o grupo por `e203206`, com `xDesc`, `cMotivo` e, se informado, `xMotivo`.

### Assinatura

A mesma `Assinatura.assinarXml` da NF-e — RSA-SHA1, digest SHA1, C14N 20010315, `Signature` depois do elemento —, com o quarto parâmetro `'infPedReg'`. Eventos de terceiros aceitos pela SEFIN já mostravam essa configuração, e o `sefaz.test.js` confirma em produção: a SEFIN confere a assinatura antes de procurar a nota.

Pela API a assinatura é **obrigatória** (`E0717`), embora o Anexo II marque "Não" na coluna de assinatura das manifestações: o "Não" vale para o emissor web, que assina pelo usuário.

### A declaração XML

O `pedRegEvento` vai com `<?xml version="1.0" encoding="UTF-8"?>` na frente. Sem ela a SEFIN rejeita com `E1229` ("Xml não está utilizando codificação UTF-8"), mesmo com o corpo em UTF-8 — observado em produção e em produção restrita, 2026-10-16. A declaração fica fora do `infPedReg` e não entra no digest, por isso é acrescentada depois de assinar.

## O que a SEFIN valida, na ordem observada

Com chave inventada (a nota não existe no ADN), em 2026-10-16:

| Pedido                              | Resposta                                            |
| ----------------------------------- | --------------------------------------------------- |
| Sem declaração XML                  | `E1229` — Xml não está utilizando codificação UTF-8 |
| Sem `Signature`                     | `E0717` — a assinatura é obrigatória                |
| Assinatura ou conteúdo adulterado   | `E0714` — erro na assinatura                        |
| Assinado corretamente               | `E1831` — a NFS-e não existe no ADN                 |
| `CNPJAutor` de outra raiz, assinado | `E1831` — a existência vem antes do `E0812`         |

A ordem importa para o teste de integração: chegar ao `E1831` prova que codificação, schema e assinatura passaram. Todos com HTTP 400.

## O retorno

| Situação                                  | `status` | `data`                         | `error`                                         |
| ----------------------------------------- | -------- | ------------------------------ | ----------------------------------------------- |
| Evento registrado e devolvido             | 201      | `{ …, evento: { xml, json } }` | —                                               |
| Evento registrado, mas o retorno não abre | 201      | `{ …, evento: {} }`            | `Falha ao abrir o evento retornado: <mensagem>` |
| Rejeição da SEFIN                         | real     | `{ …, erros: [...] }`          | `<codigo>: <descricao>`, unidos por `; `        |
| Corpo que não é resposta da SEFIN         | real     | `{}`                           | `Resposta inesperada da SEFIN (HTTP <status>).` |
| Sem resposta HTTP                         | 0        | `{}`                           | `Falha de transporte (<code>): <message>`       |

`data` traz `tipoAmbiente` (`'1'`/`'2'`, em string), `versaoAplicativo`, `dataHoraProcessamento`, `alertas`, `erros` e `evento`. `reqXml` vem em todos os casos, inclusive no de transporte: é o que se audita numa rejeição. As regras gerais são as da [ADR 0016](../decisoes/0016-retorno-proprio-da-nfse.md).

A segunda linha é a única em que há `error` **e** o evento foi registrado. Quem consome não deve repetir o pedido nesse caso — seria duplicidade (`E0861`/`E0866`) —, e sim consultar a nota pela [distribuição](distribuicao-nfse.md).

## Eventos entre si

Pela aba "RN EVENTOSxEVENTOS" do Anexo II, para o tomador:

| Já vinculado à nota    | Confirmação do tomador | Rejeição do tomador |
| ---------------------- | ---------------------- | ------------------- |
| Nenhum evento          | aceita                 | aceita              |
| Confirmação do tomador | `E0861`                | aceita              |
| Rejeição do tomador    | aceita                 | `E0866`             |
| Confirmação tácita     | `E0861`                | `E0866`             |
| Cancelamento           | `E0861`                | `E0866`             |

E no sentido inverso: com a Confirmação do tomador vinculada, o **Cancelamento** da nota pelo emitente deixa de ser aceito (só o cancelamento por substituição continua). A Anulação da Rejeição (`e205208`) é evento do município de incidência, não do tomador, e está fora do bitmde.
