# Camada `apis/` — a superfície pública

`src/apis/` é a única camada que o consumidor do pacote enxerga. Quatro classes:

- [DistribuicaoDFe](../../../src/apis/distribuicaoDFe-api.js) — NF-e destinada: `consultaUltNSU`, `consultaNSU`, `consultaChNFe`
- [DistribuicaoCTe](../../../src/apis/distribuicaoCTe-api.js) — CT-e destinado: `consultaUltNSU`, `consultaNSU`, `consultaChCTe`
- [DistribuicaoMDFe](../../../src/apis/distribuicaoMDFe-api.js) — MDF-e destinado: `consultaUltNSU`, `consultaNSU`, `consultaChMDFe`
- [RecepcaoEvento](../../../src/apis/recepcaoEvento-api.js) — `enviarEvento`

Todas são reexportadas por [src/index.js](../../../src/index.js) em três formas (`module.exports`, `.default`, `.mde`), para funcionar tanto com `require` quanto com `import` sob transpiladores diferentes.

## Responsabilidade

A camada faz exatamente três coisas, e nada além:

1. **Valida a configuração no construtor**, um validator por assunto, na ordem em que aparecem. O primeiro que falhar lança.
2. **Congela o resultado** em `this.config` e congela a própria instância.
3. **Valida o argumento do método público** e delega ao controller.

Nenhuma regra de negócio, nenhuma montagem de XML e nenhuma chamada HTTP vivem aqui.

## Construtor

O padrão é idêntico nas quatro classes:

```js
const certificadoValidator = new CertificadoValidator(config)
// ...
if (!certificadoValidator.isValid()) {
  throw new Error(certificadoValidator.getError())
}
// ...
const { cert, key } = certificadoValidator.getValues()
```

A ordem importa para a mensagem de erro: com dois problemas simultâneos na config, o usuário vê o primeiro da lista.

| Classe             | Validators, na ordem                    |
| ------------------ | --------------------------------------- |
| `DistribuicaoDFe`  | Certificado → Ambiente → CnpjCpf → Uf   |
| `DistribuicaoCTe`  | Certificado → Ambiente → CnpjCpf → Uf   |
| `DistribuicaoMDFe` | Certificado → Ambiente → CnpjCpf → Uf   |
| `RecepcaoEvento`   | Certificado → Ambiente → CnpjCpf → Zone |

`options.requestOptions` e `options.httpsOptions` **não passam por validator** — são repassados como estão (com `{}` de default) e mesclados lá embaixo, no [SefazService](services-sefaz.md).

### O que fica em `this.config`

Só o que já foi normalizado. O `pfx` e a `passphrase` **não** sobrevivem ao construtor: o `CertificadoValidator` converte para PEM em `isValid()` e o que fica guardado é `cert` e `key` já em string. Ver [validators.md](validators.md).

```js
this.config = Object.freeze({
  cUFAutor,
  cnpj,
  cpf,
  tpAmb,
  cert,
  key,
  requestOptions: Object.freeze(requestOptions),
  httpsOptions: Object.freeze(httpsOptions),
})
Object.freeze(this)
```

O congelamento alcança dois níveis — `config` e os dois objetos de options dentro dele —, mas `Object.freeze` é **raso**: só as propriedades de primeiro nível de cada um desses três objetos ficam imutáveis. O que estiver aninhado mais fundo, como `requestOptions.headers`, continua mutável. Quem recebe esses objetos pode lê-los e mesclá-los, mas **não pode escrever nas propriedades congeladas**; ver [ADR 0005](../decisoes/0005-object-freeze-pervasivo.md).

## Métodos públicos

Cada método valida seu argumento e monta `opts` espalhando a config:

```js
const opts = { ...this.config, nsu: value }
return DistribuicaoController.enviar(opts)
```

O spread produz um objeto **novo e não congelado** — o congelamento de `this.config` não se propaga por spread (é cópia rasa das propriedades enumeráveis). Isso é intencional: os controllers acrescentam chaves a `opts`.

`RecepcaoEvento.enviarEvento` faz mais que os outros três métodos: valida o lote, depois valida **cada** evento e monta o objeto que o schema espera, incluindo o que é derivado e não vem do usuário:

| Campo         | Origem                                                |
| ------------- | ----------------------------------------------------- |
| `nSeqEvento`  | Fixo `'1'` — a biblioteca não faz reenvio sequenciado |
| `cOrgao`      | Fixo `'91'` — Ambiente Nacional                       |
| `infEventoId` | `` `ID${tpEvento}${chNFe}01` ``                       |
| `dhEvento`    | `Data.toFormat(new Date(), opts.timezone)`            |

`dhEvento` usa o relógio da máquina convertido para o timezone da config (default `America/Sao_Paulo`), via luxon. É o único ponto de não-determinismo da biblioteca.

## Tipagem

O `dist/index.d.ts` é gerado pelo `tsc` (`allowJs` + `emitDeclarationOnly`) entrando por [src/index.js](../../../src/index.js). Na prática, **os blocos JSDoc destas quatro classes são a definição de tipos do pacote**.

Consequência: mudar assinatura pública sem atualizar o JSDoc gera um `.d.ts` errado, e o erro só aparece para o consumidor. Ao mexer aqui, atualizar no mesmo PR:

- o JSDoc do método/construtor;
- o [README.md](../../../README.md), que é a documentação pública;
- o `CHANGELOG.md`.

Ver [ADR 0006](../decisoes/0006-js-com-jsdoc-em-vez-de-typescript.md).
