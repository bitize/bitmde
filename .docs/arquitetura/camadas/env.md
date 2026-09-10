# Camada `env/` — constantes

[src/env/index.js](../../../src/env/index.js) reexporta sete constantes. Nada aqui lê variável de ambiente do processo, apesar do nome da pasta: são valores fixos, compilados no pacote.

| Constante      | Arquivo                                             | Conteúdo                                    |
| -------------- | --------------------------------------------------- | ------------------------------------------- |
| `DISTRIBUICAO` | [distribuicao.js](../../../src/env/distribuicao.js) | Endpoint do NFeDistribuicaoDFe por ambiente |
| `RECEPCAO`     | [recepcao.js](../../../src/env/recepcao.js)         | Endpoint do NFeRecepcaoEvento4 por ambiente |
| `CA`           | [ca.js](../../../src/env/ca.js)                     | Cadeia de certificados ICP-Brasil           |
| `EVENTOS`      | [evento.js](../../../src/env/evento.js)             | Os quatro eventos de manifestação           |
| `CODIGOS_UF`   | [uf.js](../../../src/env/uf.js)                     | Códigos IBGE de UF aceitos em `cUFAutor`    |
| `ZONES`        | [zone.js](../../../src/env/zone.js)                 | Timezones brasileiros aceitos               |
| `VERSION`      | [version.js](../../../src/env/version.js)           | Versão do pacote — **gerado pelo build**    |

## Endpoints e `tpAmb`

Os dois serviços rodam no **Ambiente Nacional (AN)**, e o mapa é indexado por `tpAmb`:

| `tpAmb` | Ambiente    | Host                      |
| ------- | ----------- | ------------------------- |
| `'1'`   | Produção    | `www1.nfe.fazenda.gov.br` |
| `'2'`   | Homologação | `hom1.nfe.fazenda.gov.br` |

Detalhe que engana: os objetos são declarados com chave **numérica** (`1:` e `2:`), mas `tpAmb` circula como **string**. Funciona porque chave de objeto em JS é sempre string — `DISTRIBUICAO['1']` acha `DISTRIBUICAO[1]`. Não "arrumar" nem um lado nem o outro sem ver o outro: o `AmbienteValidator` rejeita `tpAmb` numérico, então a string é a forma canônica na fronteira pública.

## `CA` — a cadeia ICP-Brasil

Usada como `ca` do `https.Agent`. Existe para que quem quiser validar a cadeia consiga sem carregar a ICP-Brasil por conta própria.

> ⚠️ O default do serviço é `rejectUnauthorized: false`, ou seja, **o certificado do servidor não é verificado** — é comportamento inseguro, mantido por compatibilidade com as versões anteriores (ver [services-sefaz.md](services-sefaz.md)). **Em produção, passar `httpsOptions: { rejectUnauthorized: true }`**; a cadeia em `CA` já é enviada ao agent, então a verificação funciona sem configuração adicional.

Cadeia de AC tem validade. Quando um certificado do arquivo expirar ou a ICP-Brasil publicar uma AC nova, este arquivo precisa ser atualizado e o pacote republicado — é manutenção previsível, não incidente.

## `EVENTOS`

| `tipoEvento` | `descEvento`                  | Exige justificativa         |
| ------------ | ----------------------------- | --------------------------- |
| `210200`     | `Confirmacao da Operacao`     | Não                         |
| `210210`     | `Ciencia da Operacao`         | Não                         |
| `210220`     | `Desconhecimento da Operacao` | Não                         |
| `210240`     | `Operacao nao Realizada`      | **Sim** (15–255 caracteres) |

> As descrições são **sem acento, de propósito** — é o texto exato que o leiaute da NF-e espera em `descEvento`. Acentuar quebra a validação da SEFAZ.

`EVENTOS` é a fonte da lista tanto para a validação (`EventoValidator`) quanto para a descrição enviada no XML. A chave é o `tipoEvento` informado pelo usuário e `tpEvento` é o valor repetido — a indireção existe para permitir que os dois divirjam no futuro sem mudar a API pública.

## `CODIGOS_UF`

27 códigos IBGE, como **string**: `11`–`17`, `21`–`29`, `31`–`33`, `35`, `41`–`43`, `50`–`53`. Não há `34` (não existe UF com esse código) e `53` é o Distrito Federal.

Só é usado pelo `UfValidator`, para `cUFAutor` na distribuição. A recepção de evento não usa UF: ela envia `cOrgao` fixo em `'91'` (Ambiente Nacional).

## `ZONES`

14 timezones IANA do Brasil, aceitos em `config.timezone` do `RecepcaoEvento`. Default `America/Sao_Paulo`. Alimenta o `dhEvento` via luxon — ver [fluxos/recepcao-evento.md](../fluxos/recepcao-evento.md).

A lista é fechada por decisão: o campo existe para o offset sair correto no `dhEvento`, e aceitar qualquer string IANA permitiria mandar evento com fuso que a SEFAZ não espera.

## `VERSION` — o arquivo gerado

[src/env/version.js](../../../src/env/version.js) é o único arquivo de `src/` **escrito por script**, e ainda assim é commitado. Ele alimenta o header `User-Agent: bitmde/<version>`.

O build (`npm run build`) reescreve o arquivo a partir do `version` do `package.json`. Bumpar o `package.json` sem rodar o build deixa os dois fora de sincronia — e a CI reprova o release por isso. Ver [build-e-versao.md](../build-e-versao.md).

## Ao acrescentar constante

- Criar arquivo próprio em `src/env/`, exportando `module.exports = { NOME: NOME }`.
- Registrar em [src/env/index.js](../../../src/env/index.js), mantendo a ordem alfabética que já existe lá.
- Os arquivos de `env/` são os únicos de `src/` **sem** `'use strict'` e **sem** `Object.freeze` — são módulos de dado, não de comportamento. Seguir o padrão local em vez do global.
