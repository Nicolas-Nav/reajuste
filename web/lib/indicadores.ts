/**
 * Catalogo de indicadores.
 *
 * Debe mantenerse en sintonia con `pipeline/fuente.py`, mas la serie derivada
 * `ipc_indice` que calcula el pipeline y guarda ya encadenada.
 */

export const INDICADORES = {
  uf: { nombre: 'Unidad de Fomento', unidad: 'pesos', frecuencia: 'diaria' },
  ivp: { nombre: 'Indice de Valor Promedio', unidad: 'pesos', frecuencia: 'diaria' },
  dolar: { nombre: 'Dolar observado', unidad: 'pesos', frecuencia: 'diaria' },
  dolar_intercambio: { nombre: 'Dolar acuerdo', unidad: 'pesos', frecuencia: 'diaria' },
  euro: { nombre: 'Euro', unidad: 'pesos', frecuencia: 'diaria' },
  ipc: { nombre: 'IPC, variacion mensual', unidad: 'porcentaje', frecuencia: 'mensual' },
  ipc_indice: { nombre: 'IPC encadenado, base 100', unidad: 'indice', frecuencia: 'mensual' },
  utm: { nombre: 'Unidad Tributaria Mensual', unidad: 'pesos', frecuencia: 'mensual' },
  imacec: { nombre: 'Imacec', unidad: 'porcentaje', frecuencia: 'mensual' },
  tpm: { nombre: 'Tasa de Politica Monetaria', unidad: 'porcentaje', frecuencia: 'diaria' },
  libra_cobre: { nombre: 'Libra de cobre', unidad: 'dolares', frecuencia: 'diaria' },
  tasa_desempleo: { nombre: 'Tasa de desempleo', unidad: 'porcentaje', frecuencia: 'mensual' },
  bitcoin: { nombre: 'Bitcoin', unidad: 'dolares', frecuencia: 'diaria' },
} as const

export type Indicador = keyof typeof INDICADORES

export function esIndicador(valor: string): valor is Indicador {
  return Object.hasOwn(INDICADORES, valor)
}

/** Las varas de medida que se muestran al convertir un monto. */
export const VARAS = ['uf', 'utm', 'dolar'] as const
export type Vara = (typeof VARAS)[number]
