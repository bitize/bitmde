# Arquitetura — bitmde

Biblioteca Node.js (CommonJS, JavaScript puro com tipagem via JSDoc) que consome quatro Web Services SOAP da SEFAZ e duas APIs REST da NFS-e Nacional:

- **NFeDistribuicaoDFe** — consulta de documentos destinados a um CNPJ/CPF, por `ultNSU`, `NSU` ou `chNFe`.
- **CTeDistribuicaoDFe** (AN) e **MDFeDistribuicaoDFe** (SVRS) — o mesmo para CT-e e MDF-e, por `ultNSU` e `NSU`; nenhum dos dois tem consulta por chave.
- **NFeRecepcaoEvento4** — envio de lote de eventos de manifestação do destinatário.
- **ADN — distribuição para contribuintes** — NFS-e e eventos em que um CNPJ figura, por `ultNSU`, `NSU` ou chave de acesso.
- **SEFIN Nacional — pedido de registro de evento** — Confirmação e Rejeição do tomador de uma NFS-e.

A biblioteca não guarda estado, não persiste nada e não faz retry: ela monta a requisição, fala com o serviço por mTLS e devolve a resposta em JSON, junto com o corpo cru — o XML dos dois lados na NF-e, o corpo da resposta em `resBody` na NFS-e.

## Fluxo de uma chamada

As camadas são fixas e cada uma só conhece a de baixo:

```text
apis/                classe pública; valida a config no construtor e congela (Object.freeze)
  └ validators/      normaliza a entrada e produz a mensagem de erro
controllers/         static enviar(opts): montarRequest → envia → montarResponse → montarRetorno
    └ helpers/       orquestra schema → XML → (assinatura) → serviço → parse da resposta
        └ schemas/   objeto JS espelhando o XML (chaves `@_` = atributos, para o XMLBuilder)
        └ services/  sefaz-service.js: instância axios + https.Agent com mTLS, TLS validado por padrão
        └ helpers/retorno-helper.js: formato final da NF-e { data, reqXml, resXml, status, error?, transportError? }
        └ helpers/retornoNfse-helper.js: formato final da NFS-e { data, reqXml?, resBody, status, error?, transportError? }
env/                 constantes: endpoints por tpAmb (NF-e, CT-e, MDF-e, ADN e SEFIN), DOCUMENTOS, EVENTOS_NFSE, cadeias CA (ICP-Brasil e CA_PADRAO), EVENTOS, CODIGOS_UF, ZONES, VERSION
util/                XML, gzip, PFX→PEM, assinatura, data, zero-pad
```

As três distribuições SOAP (NF-e, CT-e e MDF-e) passam pelo mesmo schema, helper e controller; o que muda entre elas está no descritor de `DOCUMENTOS` que a classe pública injeta em `opts.documento`. Ver [fluxos/distribuicao-dfe.md](fluxos/distribuicao-dfe.md).

Na NFS-e não há envelope. A distribuição não tem `schemas/`: o helper monta a config de um `GET` do axios e lê JSON. A manifestação tem schema e assinatura, e manda o XML assinado em gzip+base64 num `POST` JSON.

[src/index.js](../../src/index.js) exporta `DistribuicaoCTe`, `DistribuicaoDFe`, `DistribuicaoMDFe`, `DistribuicaoNFSe`, `ManifestacaoNFSe`, `RecepcaoEvento` e as cadeias `CA_PADRAO` e `CA_ICP_BRASIL` em três formas — `module.exports`, `.default` e `.mde` — para interoperar com `require` e `import`.

## Documentos

### Camadas

| Doc                                                              | Cobre                                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [camadas/apis.md](camadas/apis.md)                               | Classes públicas, config congelada, JSDoc como fonte dos tipos                    |
| [camadas/validators.md](camadas/validators.md)                   | O contrato `isValid()` / `getValues()` / `getError()` e seus efeitos colaterais   |
| [camadas/controllers-helpers.md](camadas/controllers-helpers.md) | Orquestração, montagem da resposta e formato de retorno                           |
| [camadas/schemas-xml.md](camadas/schemas-xml.md)                 | Schemas como objeto JS, `fast-xml-parser`, envelope SOAP                          |
| [camadas/services-sefaz.md](camadas/services-sefaz.md)           | axios, `https.Agent`, mTLS, validação TLS, erro de transporte (`status: 0`)       |
| [camadas/env.md](camadas/env.md)                                 | `tpAmb`, endpoints, `CA`/`CA_PADRAO`, `EVENTOS`, `CODIGOS_UF`, `ZONES`, `VERSION` |

### Fluxos completos

- [fluxos/distribuicao-dfe.md](fluxos/distribuicao-dfe.md) — consulta por `ultNSU`, `NSU` e `chNFe`, e o gunzip dos `docZip`.
- [fluxos/recepcao-evento.md](fluxos/recepcao-evento.md) — montagem, assinatura individual e recorte de string que forma o lote.
- [fluxos/distribuicao-nfse.md](fluxos/distribuicao-nfse.md) — fila do ADN por NSU e consulta por chave, `papel` por item e a drenagem que termina no 404.
- [fluxos/manifestacao-nfse.md](fluxos/manifestacao-nfse.md) — `pedRegEvento` assinado, gzipado num `POST` JSON à SEFIN, e o que a SEFIN valida antes de registrar.

### Processo

- [testes-e-certificados.md](testes-e-certificados.md) — o pré-requisito de `certs/`, o gerador descartável, os testes de integração e o workflow semanal da cadeia TLS.
- [build-e-versao.md](build-e-versao.md) — `scripts/index.js`, `src/env/version.js` commitado, `lib/` e `dist/`.
- [release.md](release.md) — tag, guards da CI, Trusted Publishing e provenance.

### Decisões

[decisoes/](decisoes/) — ADRs numerados. Começar por eles quando a pergunta for "por que assim?".

## Invariantes que atravessam o código

Cinco regras valem em qualquer arquivo de `src/`. Quebrar uma delas quebra teste.

1. **Erro de configuração ou de argumento lança; erro de rede ou da SEFAZ, não.** Config inválida vira `throw new Error(validator.getError())` de forma síncrona; resposta HTTP de erro vira `{ data: {}, error, reqXml, resXml, status }`, e falha sem resposta HTTP vira o mesmo com `status: 0`, `resXml: ''` e `transportError: { code, message }` — nenhum status é sintetizado. Ver [ADR 0004](decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md) e [ADR 0014](decisoes/0014-tls-validado-por-padrao-e-erro-de-transporte-explicito.md). As APIs de NFS-e têm retorno próprio, `{ data, resBody, status, error?, transportError? }`, com o mesmo significado de `status`, `error` e `transportError`; nelas a fila vazia (HTTP 404) não é erro, e a rejeição mantém `data` com os `erros` do serviço — ver [ADR 0016](decisoes/0016-retorno-proprio-da-nfse.md). Falha de **um** documento do lote da distribuição (`docZip` ou `ArquivoXml` corrompido) não esvazia `data`: vira item de `data.docZipErrors` ou `data.documentosErros` e o resto do lote segue — ver [ADR 0013](decisoes/0013-falha-de-doczip-vira-item-de-doczip-errors.md).
2. **Imutabilidade.** Praticamente todo módulo exporta `Object.freeze(Classe)`, e as instâncias de `apis/` congelam `this` e `this.config`. Ver [ADR 0005](decisoes/0005-object-freeze-pervasivo.md).
3. **`tpAmb` é string.** `'1'` produção, `'2'` homologação (produção restrita, na NFS-e) — é a chave dos mapas em [src/env/distribuicao.js](../../src/env/distribuicao.js), [src/env/recepcao.js](../../src/env/recepcao.js) e [src/env/nfse.js](../../src/env/nfse.js).
4. **Idioma e mensagens.** Domínio, nomes de arquivo/classe e mensagens de erro em português. As mensagens são comparadas **literalmente** nos testes (`assert.strictEqual(err.message, 'NSU não informado.')`) — mudar o texto quebra teste.
5. **Estilo.** Prettier: sem ponto e vírgula, aspas simples, 2 espaços, trailing comma `es5`. Todo módulo começa com `'use strict'` — **exceto os de [src/env/](../../src/env/)**, que são módulos de dado e não o declaram (ver [camadas/env.md](camadas/env.md)). Sem TypeScript no fonte — a tipagem pública sai do JSDoc de `src/apis/`. Ver [ADR 0006](decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md).
