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
  varas: { desde: MontoEnVaras; hasta: MontoEnVaras }
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
