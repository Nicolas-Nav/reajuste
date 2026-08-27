/**
 * GET /api/series/[indicador]?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 *
 * Serie historica de un indicador.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { leerSerie, SinConfigurar } from '@/lib/db'
import { esIndicador, INDICADORES } from '@/lib/indicadores'

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'usa el formato AAAA-MM-DD')
  .optional()

const consulta = z.object({ desde: fecha, hasta: fecha })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ indicador: string }> },
) {
  const { indicador } = await params

  if (!esIndicador(indicador)) {
    return NextResponse.json(
      {
        error: `indicador desconocido: "${indicador}"`,
        disponibles: Object.keys(INDICADORES),
      },
      { status: 404 },
    )
  }

  const { searchParams } = new URL(request.url)
  const parseo = consulta.safeParse({
    desde: searchParams.get('desde') ?? undefined,
    hasta: searchParams.get('hasta') ?? undefined,
  })

  if (!parseo.success) {
    return NextResponse.json(
      { error: 'parametros invalidos', detalle: z.treeifyError(parseo.error) },
      { status: 400 },
    )
  }

  const { desde, hasta } = parseo.data

  if (desde && hasta && desde > hasta) {
    return NextResponse.json(
      { error: `el rango esta invertido: ${desde} es posterior a ${hasta}` },
      { status: 400 },
    )
  }

  try {
    const registros = await leerSerie(indicador, desde, hasta)

    return NextResponse.json(
      {
        indicador,
        ...INDICADORES[indicador],
        registros,
        total: registros.length,
      },
      {
        // Los datos cambian una vez al dia, asi que vale la pena cachear.
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      },
    )
  } catch (error) {
    return manejarError(error)
  }
}

function manejarError(error: unknown) {
  if (error instanceof SinConfigurar) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }
  console.error('fallo al leer la serie:', error)
  return NextResponse.json({ error: 'error al consultar los datos' }, { status: 500 })
}
