/**
 * Formato de numeros y fechas en convenciones chilenas.
 *
 * En Chile el separador de miles es el punto y el decimal es la coma:
 * $1.331.548 y 32,58 UF.
 */

const PESOS = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const NUMERO = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const ENTERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })

export function pesos(valor: number): string {
  return PESOS.format(valor)
}

export function numero(valor: number): string {
  return NUMERO.format(valor)
}

export function entero(valor: number): string {
  return ENTERO.format(valor)
}

export function porcentaje(valor: number, decimales = 1): string {
  return `${valor.toFixed(decimales).replace('.', ',')}%`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2015-01" a "enero de 2015". */
export function mesLargo(mes: string): string {
  const [anio, numeroMes] = mes.split('-')
  const indice = Number(numeroMes) - 1
  return `${MESES[indice] ?? '?'} de ${anio}`
}

/** "2015-01" a "ene 2015", para espacios estrechos. */
export function mesCorto(mes: string): string {
  const [anio, numeroMes] = mes.split('-')
  const indice = Number(numeroMes) - 1
  return `${(MESES[indice] ?? '?').slice(0, 3)} ${anio}`
}

/** Primer dia del mes actual, en formato AAAA-MM. */
export function mesActual(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}
