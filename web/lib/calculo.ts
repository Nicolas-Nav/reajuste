/**
 * El calculo de poder adquisitivo.
 *
 * Todo lo de este archivo es puro: entran numeros, salen numeros. Nada de red
 * ni base de datos, para que se pueda testear sin montar nada.
 *
 * El encadenamiento del IPC NO vive aca: lo hace el pipeline en Python y lo
 * guarda ya calculado como la serie `ipc_indice`. Duplicar esa logica en dos
 * lenguajes es la forma mas segura de que un dia dejen de coincidir.
 */

export class MesInvalido extends Error {}

const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const FORMATO_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * Normaliza "2015-01" o "2015-01-20" al primer dia del mes.
 *
 * Se trabaja a nivel de mes porque el IPC es mensual: pedir precision diaria
 * sugeriria una exactitud que el dato de origen no tiene.
 */
export function normalizarMes(entrada: string): string {
  if (FORMATO_MES.test(entrada)) return `${entrada}-01`
  if (FORMATO_FECHA.test(entrada)) return `${entrada.slice(0, 7)}-01`

  throw new MesInvalido(
    `fecha invalida: "${entrada}". Usa AAAA-MM, por ejemplo 2015-01.`,
  )
}

/** Cuanto vale en el mes destino un monto del mes origen. */
export function convertir(
  monto: number,
  indiceDesde: number,
  indiceHasta: number,
): number {
  if (indiceDesde === 0) {
    throw new RangeError('el indice de origen no puede ser cero')
  }
  return (monto * indiceHasta) / indiceDesde
}

/** Variacion porcentual acumulada del nivel de precios entre dos momentos. */
export function variacionAcumulada(
  indiceDesde: number,
  indiceHasta: number,
): number {
  return (indiceHasta / indiceDesde - 1) * 100
}

/**
 * Porcentaje de poder de compra que perdio un monto nominal.
 *
 * No es lo mismo que la variacion acumulada: si los precios se duplican, el
 * dinero no pierde 100% de su poder de compra sino 50%. Es la relacion inversa,
 * y confundirlas es el error mas comun al hablar de inflacion.
 */
export function perdidaPoderAdquisitivo(
  indiceDesde: number,
  indiceHasta: number,
): number {
  const factor = indiceHasta / indiceDesde
  return (1 - 1 / factor) * 100
}

/** Expresa un monto en pesos como cantidad de otra unidad (UF, UTM, dolares). */
export function enUnidad(montoPesos: number, valorUnidad: number): number {
  if (valorUnidad === 0) {
    throw new RangeError('el valor de la unidad no puede ser cero')
  }
  return montoPesos / valorUnidad
}

/** Redondea a `decimales` sin arrastrar ruido de punto flotante. */
export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales
  return Math.round(valor * factor) / factor
}
