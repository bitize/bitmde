# Camadas `schemas/` e `util/xml.js` — do objeto JS ao XML

## Schemas

Um schema é uma classe com um único método estático `montarSchema(options)` que devolve **um objeto JavaScript espelhando a árvore XML**. Nenhuma string de XML é escrita à mão nos schemas.

Duas convenções do [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) fazem esse espelhamento funcionar:

| Convenção      | Significado                                                       |
| -------------- | ----------------------------------------------------------------- |
| Chave normal   | Elemento filho                                                    |
| Chave com `@_` | **Atributo** do elemento (`'@_versao': '1.01'` → `versao="1.01"`) |
| Chave `value`  | Conteúdo textual do nó (na leitura; `textNodeName` do parser)     |

### A ordem das chaves é a ordem do XML

O `XMLBuilder` percorre as chaves na ordem de inserção do objeto. O XML da NF-e tem **sequência obrigatória** de elementos: fora de ordem, a SEFAZ rejeita por schema.

É por isso que os schemas montam o objeto em etapas, com atribuição explícita em vez de literal único — a atribuição deixa a ordem visível e controlável:

```js
infEvento['chNFe'] = options.chNFe
infEvento['dhEvento'] = options.dhEvento
infEvento['tpEvento'] = options.tpEvento
infEvento['nSeqEvento'] = options.nSeqEvento
infEvento['verEvento'] = '1.00'
infEvento['detEvento'] = { descEvento: options.descEvento, '@_versao': '1.00' }
```

E também por que os atributos (`'@_xmlns'`, `'@_versao'`, `'@_Id'`) são inseridos **por último**: eles não têm posição na sequência de elementos, então ficam no fim para não empurrar a ordem dos filhos.

> **Reordenar chave em schema é mudança de comportamento**, mesmo que o objeto pareça equivalente em JS.

### Os dois schemas

[DistribuicaoSchema](../../../src/schemas/distribuicaoDFe-schema.js) monta `distDFeInt` a partir de `opts.documento` (NF-e, CT-e ou MDF-e — ver [documento.js](../../../src/env/documento.js)): namespace, `versao`, raiz SOAP e bloco de chave vêm do descritor. Escolhe **um** dos três blocos de consulta, nesta precedência:

| Precedência | Campo em `opts`              | Bloco gerado (NF-e)    |
| ----------- | ---------------------------- | ---------------------- |
| 1º          | `ultNSU`                     | `<distNSU><ultNSU>`    |
| 2º          | `chNFe` / `chCTe` / `chMDFe` | `consCh*` do descritor |
| 3º (else)   | `nsu`                        | `<consNSU><NSU>`       |

O `else` final não testa `opts.nsu`: se nenhum dos três vier, sai `<consNSU><NSU>undefined</NSU>`. Na prática isso não acontece porque a camada `apis/` só chama o controller depois de validar, mas é a razão de não chamar controller diretamente.

[RecepcaoSchema](../../../src/schemas/recepcaoEvento-schema.js) monta **um** evento por vez, com `versao="1.00"` em `envEvento`, `evento` e `detEvento`, e `xJust` presente só quando informado. O agrupamento em lote não é feito aqui — ver [fluxos/recepcao-evento.md](../fluxos/recepcao-evento.md).

CNPJ e CPF são mutuamente exclusivos nos dois schemas, com a mesma forma: `if (options.cnpj) ... else ...` — CNPJ ganha quando ambos vêm preenchidos.

## `util/xml.js`

Três funções estáticas em [src/util/xml.js](../../../src/util/xml.js):

### `jsonToXml(json)`

`new XMLBuilder({ ignoreAttributes: false }).build(json)`. A flag é obrigatória — sem ela o builder descarta as chaves `@_` e o XML sai sem `xmlns`, `versao` e `Id`.

### `envelopar(xml, cabecalho?)`

Concatena o envelope **SOAP 1.2** em volta do corpo. Com um argumento, a saída é byte a byte a de antes da distribuição de CT-e/MDF-e. Com `cabecalho`, insere `<soap12:Header>…</soap12:Header>` antes do `Body` (MDF-e: `mdfeCabecMsg` montado no helper).

```text
<?xml version="1.0" encoding="utf-8"?><soap12:Envelope …><soap12:Body>…</soap12:Body></soap12:Envelope>
```

Template literal, uma linha, sem espaço em branco entre as tags. Isso importa na recepção, onde o XML assinado é recortado por índice de string — espaço a mais desloca offset.

### `xmlToJson(xml)`

`XMLParser` com opções que **não devem ser afrouxadas**:

| Opção                 | Valor     | Por quê                                          |
| --------------------- | --------- | ------------------------------------------------ |
| `attributeNamePrefix` | `'@_'`    | Simétrico ao builder                             |
| `textNodeName`        | `'value'` | É de onde sai o base64 do `docZip`               |
| `ignoreAttributes`    | `false`   | Sem isso, `@_NSU` e `@_schema` do `docZip` somem |
| `parseAttributeValue` | `false`   | **Crítico:** mantém tudo string                  |
| `parseTagValue`       | `false`   | **Crítico:** mantém tudo string                  |
| `trimValues`          | `true`    | A SEFAZ indenta o XML                            |

Os dois `false` são o que impede o parser de converter `cStat` `'000'` em `0`, chave de NF-e em notação científica e NSU com zeros à esquerda em número. **Todo campo escalar do retorno é string** — essa é a garantia de contrato da biblioteca, e há teste cobrindo. Campos repetíveis continuam sendo estrutura: `docZip` (distribuição) e `retEvento` (recepção) são sempre **array**, normalizados pelos helpers, e cada item traz seus próprios campos escalares em string mais o `json` já parseado. Ver [controllers-helpers.md](controllers-helpers.md).

Note que o parser é instanciado a cada chamada (não há instância compartilhada) e que `xmlToJson` **não valida** o XML: entrada malformada devolve o que o parser conseguiu montar, e a leitura defensiva dos helpers absorve o resto.
