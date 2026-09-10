# Arquitetura — bitmde

Biblioteca Node.js (CommonJS, JavaScript puro com tipagem via JSDoc) que consome dois Web Services SOAP da SEFAZ:

- **NFeDistribuicaoDFe** — consulta de documentos destinados a um CNPJ/CPF, por `ultNSU`, `NSU` ou `chNFe`.
- **NFeRecepcaoEvento4** — envio de lote de eventos de manifestação do destinatário.

A biblioteca não guarda estado, não persiste nada e não faz retry: ela monta XML, fala com a SEFAZ por mTLS e devolve a resposta em JSON, junto com o XML cru dos dois lados.

## Fluxo de uma chamada

As camadas são fixas e cada uma só conhece a de baixo:

```text
apis/                classe pública; valida a config no construtor e congela (Object.freeze)
  └ validators/      normaliza a entrada e produz a mensagem de erro
controllers/         static enviar(opts): montarRequest → envia → montarResponse → montarRetorno
    └ helpers/       orquestra schema → XML → (assinatura) → serviço → parse da resposta
        └ schemas/   objeto JS espelhando o XML (chaves `@_` = atributos, para o XMLBuilder)
        └ services/  sefaz-service.js: instância axios + https.Agent com mTLS
        └ helpers/retorno-helper.js: formato final { data, reqXml, resXml, status, error? }
env/                 constantes: endpoints por tpAmb, cadeia CA ICP-Brasil, EVENTOS, CODIGOS_UF, ZONES, VERSION
util/                XML, gzip, PFX→PEM, assinatura, data, zero-pad
```

[src/index.js](../../src/index.js) exporta `DistribuicaoDFe` e `RecepcaoEvento` em três formas — `module.exports`, `.default` e `.mde` — para interoperar com `require` e `import`.

## Documentos

### Camadas

| Doc                                                              | Cobre                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [camadas/apis.md](camadas/apis.md)                               | Classes públicas, config congelada, JSDoc como fonte dos tipos                  |
| [camadas/validators.md](camadas/validators.md)                   | O contrato `isValid()` / `getValues()` / `getError()` e seus efeitos colaterais |
| [camadas/controllers-helpers.md](camadas/controllers-helpers.md) | Orquestração, montagem da resposta e formato de retorno                         |
| [camadas/schemas-xml.md](camadas/schemas-xml.md)                 | Schemas como objeto JS, `fast-xml-parser`, envelope SOAP                        |
| [camadas/services-sefaz.md](camadas/services-sefaz.md)           | axios, `https.Agent`, mTLS, mapeamento de erro de rede para status              |
| [camadas/env.md](camadas/env.md)                                 | `tpAmb`, endpoints, cadeia CA, `EVENTOS`, `CODIGOS_UF`, `ZONES`, `VERSION`      |

### Fluxos completos

- [fluxos/distribuicao-dfe.md](fluxos/distribuicao-dfe.md) — consulta por `ultNSU`, `NSU` e `chNFe`, e o gunzip dos `docZip`.
- [fluxos/recepcao-evento.md](fluxos/recepcao-evento.md) — montagem, assinatura individual e recorte de string que forma o lote.

### Processo

- [testes-e-certificados.md](testes-e-certificados.md) — o pré-requisito de `certs/`, o gerador descartável e o teste de integração.
- [build-e-versao.md](build-e-versao.md) — `scripts/index.js`, `src/env/version.js` commitado, `lib/` e `dist/`.
- [release.md](release.md) — tag, guards da CI, Trusted Publishing e provenance.

### Decisões

[decisoes/](decisoes/) — ADRs numerados. Começar por eles quando a pergunta for "por que assim?".

## Invariantes que atravessam o código

Cinco regras valem em qualquer arquivo de `src/`. Quebrar uma delas quebra teste.

1. **Erro de configuração ou de argumento lança; erro de rede ou da SEFAZ, não.** Config inválida vira `throw new Error(validator.getError())` de forma síncrona; falha de transporte vira `{ data: {}, error, reqXml, resXml, status }`. Uma exceção conhecida sobrevive: `Gzip.unzip` de um `docZip` corrompido rejeita e a rejeição propaga para o chamador. Ver [ADR 0004](decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md).
2. **Imutabilidade.** Praticamente todo módulo exporta `Object.freeze(Classe)`, e as instâncias de `apis/` congelam `this` e `this.config`. Ver [ADR 0005](decisoes/0005-object-freeze-pervasivo.md).
3. **`tpAmb` é string.** `'1'` produção, `'2'` homologação — é a chave dos mapas em [src/env/distribuicao.js](../../src/env/distribuicao.js) e [src/env/recepcao.js](../../src/env/recepcao.js).
4. **Idioma e mensagens.** Domínio, nomes de arquivo/classe e mensagens de erro em português. As mensagens são comparadas **literalmente** nos testes (`assert.strictEqual(err.message, 'NSU não informado.')`) — mudar o texto quebra teste.
5. **Estilo.** Prettier: sem ponto e vírgula, aspas simples, 2 espaços, trailing comma `es5`. Todo módulo começa com `'use strict'` — **exceto os de [src/env/](../../src/env/)**, que são módulos de dado e não o declaram (ver [camadas/env.md](camadas/env.md)). Sem TypeScript no fonte — a tipagem pública sai do JSDoc de `src/apis/`. Ver [ADR 0006](decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md).
