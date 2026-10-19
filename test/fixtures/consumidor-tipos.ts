// Consumidor TypeScript do pacote, compilado em strict por test/tipos.test.js
// contra o .d.ts gerado. Não roda: só precisa compilar sem diagnóstico.

import {
  DistribuicaoCTe,
  DistribuicaoDFe,
  DistribuicaoMDFe,
  RecepcaoEvento,
} from '@bitize/bitmde'

type Retorno<T extends (...args: any) => any> = Awaited<ReturnType<T>>

type RetornoDistribuicao =
  | Retorno<DistribuicaoDFe['consultaUltNSU']>
  | Retorno<DistribuicaoDFe['consultaNSU']>
  | Retorno<DistribuicaoDFe['consultaChNFe']>
  | Retorno<DistribuicaoCTe['consultaUltNSU']>
  | Retorno<DistribuicaoCTe['consultaNSU']>
  | Retorno<DistribuicaoMDFe['consultaUltNSU']>
  | Retorno<DistribuicaoMDFe['consultaNSU']>

type RetornoRecepcao = Retorno<RecepcaoEvento['enviarEvento']>

// Cada API é emitida no próprio dist/apis/*.d.ts, então cada uma é
// conferida à parte, e não só a união acima.
function distribuicao(r: RetornoDistribuicao) {
  if (r.data.docZip.length === 0) {
    return
  }

  if (r.data.docZipErrors.length === 0) {
    return
  }

  const segundo = r.data.docZip[1]
  const segundoErro = r.data.docZipErrors[1]

  for (const doc of r.data.docZip) {
    doc.xml.length
  }

  if (r.error) {
    const msg: string = r.error
  }

  // @ts-expect-error error é string | undefined, não any
  const errorNumero: number = r.error

  // @ts-expect-error error é opcional: em strict não cabe em string
  const errorString: string = r.error

  // @ts-expect-error docZip é array de objeto, não any
  const docZipNumero: number = r.data.docZip

  // @ts-expect-error o elemento de docZip tem forma fechada
  r.data.docZip[0].inexistente
}

function lotes() {
  type DocZip = Retorno<DistribuicaoDFe['consultaUltNSU']>['data']['docZip']
  type DocZipErrors = Retorno<
    DistribuicaoDFe['consultaUltNSU']
  >['data']['docZipErrors']
  type InfEvento = RetornoRecepcao['data']['infEvento']

  const docZipVazio: DocZip = []
  const docZipErrorsVazio: DocZipErrors = []
  const infEventoVazio: InfEvento = []

  const doc = { xml: '<a/>', json: {}, nsu: '000000000000001', schema: 'x' }
  const docZipVarios: DocZip = [doc, doc, doc]
  const docZipArray: DocZip = new Array<DocZip[number]>()

  const erro = { nsu: '000000000000002', schema: 'x', error: 'falha' }
  const docZipErrorsVarios: DocZipErrors = [erro, erro]
}

function recepcao(r: RetornoRecepcao) {
  if (r.data.infEvento.length === 0) {
    return
  }

  const segundo = r.data.infEvento[1]

  if (r.error) {
    const msg: string = r.error
  }

  // @ts-expect-error error é string | undefined, não any
  const errorNumero: number = r.error

  // @ts-expect-error error é opcional: em strict não cabe em string
  const errorString: string = r.error

  // @ts-expect-error infEvento é array de objeto, não any
  const infEventoNumero: number = r.data.infEvento
}

// Retorno de sucesso, sem error, em cada uma das APIs.
const dados = {
  tpAmb: '2',
  verAplic: 'x',
  cStat: '137',
  xMotivo: 'x',
  dhResp: 'x',
  ultNSU: '000000000000000',
  maxNSU: '000000000000000',
  docZip: [],
  docZipErrors: [],
}

const sucesso = { reqXml: '', resXml: '', status: 200 }

const nfeUltNSU: Retorno<DistribuicaoDFe['consultaUltNSU']> = {
  ...sucesso,
  data: dados,
}
const nfeNSU: Retorno<DistribuicaoDFe['consultaNSU']> = {
  ...sucesso,
  data: dados,
}
const nfeChave: Retorno<DistribuicaoDFe['consultaChNFe']> = {
  ...sucesso,
  data: dados,
}
const cteUltNSU: Retorno<DistribuicaoCTe['consultaUltNSU']> = {
  ...sucesso,
  data: dados,
}
const cteNSU: Retorno<DistribuicaoCTe['consultaNSU']> = {
  ...sucesso,
  data: dados,
}
const mdfeUltNSU: Retorno<DistribuicaoMDFe['consultaUltNSU']> = {
  ...sucesso,
  data: dados,
}
const mdfeNSU: Retorno<DistribuicaoMDFe['consultaNSU']> = {
  ...sucesso,
  data: dados,
}
const evento: RetornoRecepcao = {
  ...sucesso,
  data: {
    idLote: '1',
    tpAmb: '2',
    verAplic: 'x',
    cOrgao: '91',
    cStat: '128',
    xMotivo: 'x',
    infEvento: [],
  },
}
