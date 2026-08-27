/**
 * Acceso a la base.
 *
 * Se usa el driver serverless de Neon, que habla por HTTP en vez de mantener
 * una conexion TCP abierta. En Vercel cada invocacion es un proceso efimero, y
 * un pool tradicional agotaria las conexiones de la base en cuanto haya algo de
 * trafico.
 */

import { neon } from '@neondatabase/serverless'
import type { Indicador } from './indicadores'

export type Punto = { fecha: string; valor: number }

export class SinConfigurar extends Error {}

function conexion() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new SinConfigurar(
      'falta DATABASE_URL. Copia .env.example a .env.local y pon el connection string de Neon.',
    )
  }
  return neon(url)
}

/** Serie completa de un indicador, opcionalmente acotada por fechas. */
export async function leerSerie(
  indicador: Indicador,
  desde?: string,
  hasta?: string,
): Promise<Punto[]> {
  const sql = conexion()

  const filas = await sql`
    SELECT fecha::text AS fecha, valor
    FROM indicadores
    WHERE indicador = ${indicador}
      AND (${desde ?? null}::date IS NULL OR fecha >= ${desde ?? null}::date)
      AND (${hasta ?? null}::date IS NULL OR fecha <= ${hasta ?? null}::date)
    ORDER BY fecha
  `

  return filas as Punto[]
}

/**
 * Valor de un indicador en el mes de la fecha pedida.
 *
 * Toma el ultimo dato del mes, que es lo que corresponde para series diarias
 * como la UF: comparar el 3 de enero contra el 28 de febrero introduciria una
 * diferencia que depende del dia elegido, no del mes.
 */
export async function valorMensual(
  indicador: Indicador,
  mes: string,
): Promise<number | null> {
  const sql = conexion()

  const filas = await sql`
    SELECT valor
    FROM indicadores
    WHERE indicador = ${indicador}
      AND date_trunc('month', fecha) = date_trunc('month', ${mes}::date)
    ORDER BY fecha DESC
    LIMIT 1
  `

  return filas.length > 0 ? Number(filas[0].valor) : null
}

/** Rango de fechas disponible para un indicador. */
export async function rangoDisponible(
  indicador: Indicador,
): Promise<{ desde: string; hasta: string } | null> {
  const sql = conexion()

  const filas = await sql`
    SELECT MIN(fecha)::text AS desde, MAX(fecha)::text AS hasta
    FROM indicadores
    WHERE indicador = ${indicador}
  `

  const fila = filas[0]
  return fila?.desde ? { desde: fila.desde, hasta: fila.hasta } : null
}
