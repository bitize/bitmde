# Camada `validators/` — contrato e efeitos colaterais

Doze validators em [src/validators/](../../../src/validators/), todos com o mesmo formato. Eles fazem duas coisas ao mesmo tempo: **validam** e **normalizam**.

## O contrato

```js
const validator = new XValidator(entrada)

if (!validator.isValid()) {
  throw new Error(validator.getError())
}

const valores = validator.getValues()
```

| Método        | Retorno                 | Observação                                                    |
| ------------- | ----------------------- | ------------------------------------------------------------- |
| `constructor` | —                       | Só copia os campos da entrada para `this` e zera `this.error` |
| `isValid()`   | `boolean`               | **Muta o estado interno.** É aqui que a normalização acontece |
| `getValues()` | objeto ou valor escalar | Sem `isValid()` antes, devolve dados crus                     |
| `getError()`  | `string`                | Vazia enquanto nada falhou                                    |

> **A pegadinha:** `isValid()` não é uma função pura de checagem. Chamar `getValues()` sem chamar `isValid()` antes devolve a entrada sem conversão de PFX, sem zero-pad e sem default aplicado. Todo validator novo deve seguir esse mesmo contrato — inclusive o efeito colateral, para não criar duas convenções.

`getValues()` devolve **objeto** quando o validator recebeu a config inteira, e **valor escalar** quando recebeu um argumento único:

| Escalar                                                                     | Objeto                                                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ChaveValidator`, `ChaveCteValidator`, `ChaveMdfeValidator`, `NsuValidator` | `CertificadoValidator`, `AmbienteValidator`, `CnpjCpfValidator`, `UfValidator`, `ZoneValidator`, `LoteValidator`, `EventoValidator` |

## O que cada um normaliza

Nem todo validator normaliza; os que normalizam são a razão de o contrato ter o efeito colateral.

| Validator              | Valida                                                      | Normaliza em `isValid()`                                |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `CertificadoValidator` | `pfx` + `passphrase`, ou `cert` + `key`                     | **Converte PFX→PEM** (`Certificado.p12ToPem`)           |
| `NsuValidator`         | Presente e com no máximo 15 caracteres                      | `String(...)` e **zero-pad para 15** (`ZeroPad.padNsu`) |
| `LoteValidator`        | Array com 1 a 20 eventos                                    | Default de `idLote` = `'1'`                             |
| `ZoneValidator`        | Pertence a `ZONES`, se informado                            | Default de `timezone` = `'America/Sao_Paulo'`           |
| `EventoValidator`      | `chNFe`, `tipoEvento` em `EVENTOS`, justificativa no 210240 | Resolve `tpEvento` e `descEvento` a partir de `EVENTOS` |
| `ChaveValidator`       | Presente e com exatamente 44 caracteres                     | `String(...)`                                           |
| `ChaveCteValidator`    | Idem, para CT-e                                             | `String(...)`                                           |
| `ChaveMdfeValidator`   | Idem, para MDF-e                                            | `String(...)`                                           |
| `AmbienteValidator`    | `tpAmb` é exatamente `'1'` ou `'2'`                         | —                                                       |
| `CnpjCpfValidator`     | Ao menos um dos dois informado                              | —                                                       |
| `UfValidator`          | `cUFAutor` pertence a `CODIGOS_UF`                          | —                                                       |

Detalhes que não são óbvios pelo nome:

- **`CnpjCpfValidator` não valida dígito verificador.** Só exige que um dos dois campos exista. A SEFAZ é quem rejeita documento inválido.
- **`ChaveValidator` só confere o comprimento**, não o DV da chave nem se os campos internos fazem sentido.
- **`EventoValidator` só exige justificativa no evento 210240** (Operação não Realizada), com 15 a 255 caracteres. Nos outros três tipos, uma justificativa informada é repassada assim mesmo.
- **`AmbienteValidator` compara com string.** `tpAmb: 1` (número) falha com `'Ambiente com valor inválido.'`; ver invariante 3 em [../README.md](../README.md).
- **`CertificadoValidator.getValues()` faz `.toString()`** em `cert` e `key`, então Buffer entra e string sai.

## Mensagens de erro

As mensagens são comparadas **literalmente** nos testes:

```js
assert.strictEqual(err.message, 'NSU não informado.')
```

Mudar o texto de uma mensagem quebra teste e é mudança observável para o consumidor (quem trata erro por `err.message`). Se for necessário mudar, entra no `CHANGELOG.md`.

Catálogo atual, na ordem em que aparecem:

| Mensagem                                                                   | Validator     |
| -------------------------------------------------------------------------- | ------------- |
| `Senha do Certificado não informada.`                                      | Certificado   |
| `Cert não informado.` / `Key não informada.`                               | Certificado   |
| `Ambiente não informado.` / `Ambiente com valor inválido.`                 | Ambiente      |
| `CNPJ/CPF não informado.`                                                  | CnpjCpf       |
| `Código UF do Autor não informado.` / `Código UF inválido.`                | Uf            |
| `Timezone inválido.`                                                       | Zone          |
| `Chave da NF-e não informada.` / `Chave da NF-e com tamanho incorreto.`    | Chave, Evento |
| `Chave do CT-e não informada.` / `Chave do CT-e com tamanho incorreto.`    | ChaveCte      |
| `Chave do MDF-e não informada.` / `Chave do MDF-e com tamanho incorreto.`  | ChaveMdfe     |
| `NSU não informado.` / `NSU com tamanho incorreto.`                        | Nsu           |
| `Lote não informado.`                                                      | Lote          |
| `Um lote deve possuir no mínimo 1 e no máximo 20 eventos.`                 | Lote          |
| `Tipo Evento não informado.`                                               | Evento        |
| `Tipo Evento deve conter um dos valores: 210200, 210210, 210220 ou 210240` | Evento        |
| `Justificativa não informada.` / `Justificativa com tamanho incorreto.`    | Evento        |

## Onde o erro aparece

Erro de validator **sempre lança**, de forma síncrona, no construtor da API ou no método público — nunca vira retorno. É a metade "configuração" da separação descrita no [ADR 0004](../decisoes/0004-erro-de-configuracao-lanca-erro-de-rede-retorna.md).

Em `RecepcaoEvento.enviarEvento`, a validação de evento acontece dentro de um `.map()`: o primeiro evento inválido do lote lança e **nada é enviado**. Não há validação parcial nem relatório de todos os erros do lote.

## Ao criar um validator novo

- Mesmo contrato: `constructor` → `isValid()` → `getValues()` / `getError()`.
- Exportar com `Object.freeze(Classe)` e registrar em [src/validators/index.js](../../../src/validators/index.js).
- Mensagem em português, terminada em ponto, no mesmo tom das existentes.
- Teste cobrindo cada mensagem, comparando com `assert.strictEqual`.
