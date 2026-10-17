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

### Os três schemas

[DistribuicaoSchema](../../../src/schemas/distribuicaoDFe-schema.js) monta `distDFeInt` para NF-e, CT-e e MDF-e, lendo de `opts.documento` (ver [env.md](env.md#documentos)) o namespace, a `versao` (`1.01` na NF-e, `1.00` nos outros dois), se há `cUFAutor` e se há bloco de chave. A ordem das chaves é a mesma nos três: `tpAmb` → `cUFAutor` (quando o documento tem) → `CNPJ`/`CPF` → bloco de consulta. Escolhe **um** dos três blocos, nesta precedência:

| Precedência | Campo em `opts` | Bloco gerado                      |
| ----------- | --------------- | --------------------------------- |
| 1º          | `ultNSU`        | `<distNSU><ultNSU>`               |
| 2º          | `chNFe`         | `<consChNFe><chNFe>` — só na NF-e |
| 3º (else)   | `nsu`           | `<consNSU><NSU>`                  |

No CT-e e no MDF-e o descritor tem `consChave: null`: o leiaute não tem consulta por chave, e uma chave em `opts` é ignorada.

O elemento em volta do `dadosMsg` também sai do descritor. NF-e e CT-e usam o invólucro da operação (`nfeDistDFeInteresse`, `cteDistDFeInteresse`), com o `xmlns` do WSDL nele. O MDF-e não tem invólucro: o WSDL é "bare", o `mdfeDadosMsg` vai direto no Body e leva ele mesmo o `xmlns` do WSDL. O XML da NF-e é conferido byte a byte em `test/distribuicaoDFe-helper.test.js`.

O `else` final não testa `opts.nsu`: se nenhum dos três vier, sai `<consNSU><NSU>undefined</NSU>`. Na prática isso não acontece porque a camada `apis/` só chama o controller depois de validar, mas é a razão de não chamar controller diretamente.

[RecepcaoSchema](../../../src/schemas/recepcaoEvento-schema.js) monta **um** evento por vez, com `versao="1.00"` em `envEvento`, `evento` e `detEvento`, e `xJust` presente só quando informado. O agrupamento em lote não é feito aqui — ver [fluxos/recepcao-evento.md](../fluxos/recepcao-evento.md).

[ManifestacaoNFSeSchema](../../../src/schemas/manifestacaoNFSe-schema.js) monta o `pedRegEvento` v1.01 da NFS-e, com `xmlns="http://www.sped.fazenda.gov.br/nfse"` só na raiz: o `infPedReg` herda o namespace (`elementFormDefault="qualified"` no XSD). A ordem é a do `TCInfPedReg` — `tpAmb`, `verAplic`, `dhEvento`, `CNPJAutor`, `chNFSe` e o grupo do evento (`e203202` ou `e203206`) —, com `Id` = `PRE` + chave + código do evento. No grupo, `cMotivo` e `xMotivo` só entram quando informados. Não há recorte de string: o pedido é um documento só, assinado inteiro.

CNPJ e CPF são mutuamente exclusivos nos dois schemas da NF-e, com a mesma forma: `if (options.cnpj) ... else ...` — CNPJ ganha quando ambos vêm preenchidos.

## `util/xml.js`

Três funções estáticas em [src/util/xml.js](../../../src/util/xml.js):

### `jsonToXml(json)`

`new XMLBuilder({ ignoreAttributes: false }).build(json)`. A flag é obrigatória — sem ela o builder descarta as chaves `@_` e o XML sai sem `xmlns`, `versao` e `Id`.

### `envelopar(xml)`

Concatena o envelope **SOAP 1.2** em volta do corpo:

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
