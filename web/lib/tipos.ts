/** Formas de las respuestas de la API, compartidas entre servidor y cliente. */

export type Vara = 'uf' | 'utm' | 'dolar'

export type MontoEnVaras = { pesos: number } & Partial<Record<Vara, number | null>>

export type Contraste =
  | { disponible: true; equivalente: number; diferenciaPorcentual: number }
  | { disponible: false; motivo: string }

export type RespuestaConversion = {
  consulta: { monto: number; desde: string; hasta: string }
  resultado: {
    equivalente: number
    variacionPrecios: number
    perdidaPoderAdquisitivo: number
    deflactor: string
  }
  contraste: Contraste
  /** Cuantas unidades de cada vara compra el monto. */
  varas: { desde: MontoEnVaras; hasta: MontoEnVaras }
  /** Cuanto cuesta una unidad de cada vara, en pesos. */
  unidades: {
    desde: Partial<Record<Vara, number | null>>
    hasta: Partial<Record<Vara, number | null>>
  }
}

export type RespuestaSerie = {
  indicador: string
  nombre: string
  unidad: string
  frecuencia: string
  registros: { fecha: string; valor: number }[]
  total: number
}

export type RespuestaError = { error: string; disponible?: { desde: string; hasta: string } }
