/**
 * GET /api/convertir?monto=800000&desde=2015-01&hasta=2026-08
 *
 * Cuanto vale hoy una cantidad de dinero de otra epoca.
 *
 * Responde con dos calculos independientes: la UF, que es el deflactor
 * principal porque el Banco Central la reajusta a diario segun el IPC, y el IPC
 * encadenado como contraste. Que ambos coincidan es la senal de que el numero
 * esta bien; si se separan mucho, algo esta mal en los datos.
 *
 * Ademas expresa el monto nominal, sin reajustar, en UF, UTM y dolares en ambas
 * fechas. Esa comparacion hace tangible la erosion: los mismos pesos guardados
 * compran cada vez menos de cada unidad.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rangoDisponible, SinConfigurar, valorMensual } from '@/lib/db'
import { VARAS, type Vara } from '@/lib/indicadores'
import {
  convertir,
  enUnidad,
  MesInvalido,
  normalizarMes,
  perdidaPoderAdquisitivo,
  redondear,
  variacionAcumulada,
} from '@/lib/calculo'

const consulta = z.object({
  monto: z.coerce
    .number()
    .positive('el monto debe ser mayor que cero')
    .finite('el monto debe ser un numero'),
  desde: z.string().min(1, 'falta la fecha de origen'),
  hasta: z.string().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const parseo = consulta.safeParse({
    monto: searchParams.get('monto'),
    desde: searchParams.get('desde'),
    hasta: searchParams.get('hasta') ?? undefined,
  })

  if (!parseo.success) {
    return NextResponse.json(
      { error: 'parametros invalidos', detalle: z.treeifyError(parseo.error) },
      { status: 400 },
    )
  }

  try {
    const { monto } = parseo.data
    const desde = normalizarMes(parseo.data.desde)

    const rango = await rangoDisponible('uf')
    if (!rango) {
      return NextResponse.json(
        { error: 'todavia no hay datos cargados' },
        { status: 503 },
      )
    }

    // Sin fecha destino se usa el mes actual, no MAX(fecha): la UF se publica
    // con mas de un mes de anticipacion, asi que el maximo de la serie cae en un
    // mes que todavia no ocurre. Mismo criterio que `ultimo_periodo_publicado()`
    // en el pipeline.
    const hasta = parseo.data.hasta
      ? normalizarMes(parseo.data.hasta)
      : mesActual()

    const [ufDesde, ufHasta] = await Promise.all([
      valorMensual('uf', desde),
      valorMensual('uf', hasta),
    ])

    const faltante = !ufDesde ? desde : !ufHasta ? hasta : null
    if (faltante || !ufDesde || !ufHasta) {
      return NextResponse.json(
        {
          error: `no hay datos para ${faltante?.slice(0, 7)}`,
          disponible: { desde: rango.desde.slice(0, 7), hasta: rango.hasta.slice(0, 7) },
        },
        { status: 422 },
      )
    }

    const equivalente = convertir(monto, ufDesde, ufHasta)

    return NextResponse.json(
      {
        consulta: { monto, desde: desde.slice(0, 7), hasta: hasta.slice(0, 7) },
        resultado: {
          equivalente: Math.round(equivalente),
          variacionPrecios: redondear(variacionAcumulada(ufDesde, ufHasta)),
          perdidaPoderAdquisitivo: redondear(perdidaPoderAdquisitivo(ufDesde, ufHasta)),
          deflactor: 'uf',
        },
        contraste: await contrastarConIpc(monto, desde, hasta, equivalente),
        // El MISMO monto nominal en ambas fechas, no el reajustado. Medir el
        // monto ya convertido daria una fila de UF identica por construccion,
        // porque la UF es el deflactor que se acaba de usar; sin reajustar, en
        // cambio, se ve cuanto poder de compra se perdio en cada unidad.
        varas: {
          desde: await medirEnVaras(monto, desde),
          hasta: await medirEnVaras(monto, hasta),
        },
        // Cuanto costaba una unidad de cada vara, en pesos. Es lo que explica
        // la tabla: si la UF subio, el mismo monto compra menos UF.
        unidades: {
          desde: await preciosUnidad(desde),
          hasta: await preciosUnidad(hasta),
        },
      },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch (error) {
    if (error instanceof MesInvalido) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof SinConfigurar) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('fallo al convertir:', error)
    return NextResponse.json({ error: 'error al calcular' }, { status: 500 })
  }
}

/** Primer dia del mes actual, en formato AAAA-MM-DD. */
function mesActual(): string {
  const hoy = new Date()
  const mes = String(hoy.getUTCMonth() + 1).padStart(2, '0')
  return `${hoy.getUTCFullYear()}-${mes}-01`
}

/**
 * El mismo calculo via IPC encadenado.
 *
 * El IPC no siempre cubre el año en curso, asi que esto puede no estar
 * disponible. Se devuelve null en vez de fallar: es un contraste, no el
 * resultado principal.
 */
async function contrastarConIpc(
  monto: number,
  desde: string,
  hasta: string,
  equivalenteUf: number,
) {
  const [a, b] = await Promise.all([
    valorMensual('ipc_indice', desde),
    valorMensual('ipc_indice', hasta),
  ])

  if (!a || !b) {
    return { disponible: false, motivo: 'el IPC no cubre alguna de las dos fechas' }
  }

  const equivalente = convertir(monto, a, b)

  return {
    disponible: true,
    equivalente: Math.round(equivalente),
    diferenciaPorcentual: redondear(
      (Math.abs(equivalente - equivalenteUf) / equivalenteUf) * 100,
      3,
    ),
  }
}

/** Cuanto cuesta una unidad de cada vara, en pesos, en ese mes. */
async function preciosUnidad(mes: string) {
  const valores = await Promise.all(VARAS.map((vara) => valorMensual(vara, mes)))

  const salida: Partial<Record<Vara, number | null>> = {}
  VARAS.forEach((vara, i) => {
    salida[vara] = valores[i]
  })

  return salida
}

/** El monto expresado en cada vara de medida. */
async function medirEnVaras(montoPesos: number, mes: string) {
  const valores = await Promise.all(VARAS.map((vara) => valorMensual(vara, mes)))

  const salida: Partial<Record<Vara, number | null>> = {}
  VARAS.forEach((vara, i) => {
    const valor = valores[i]
    salida[vara] = valor ? redondear(enUnidad(montoPesos, valor)) : null
  })

  return { pesos: Math.round(montoPesos), ...salida }
}
