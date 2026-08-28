'use client'

import { Grafico, type PuntoGrafico } from './Grafico'
import { mesLargo, numero, pesos, porcentaje } from '@/lib/formato'
import type { RespuestaConversion } from '@/lib/tipos'

const NOMBRE_VARA: Record<string, string> = {
  uf: 'UF',
  utm: 'UTM',
  dolar: 'dolares',
}

export function Resultado({
  datos,
  grafico,
}: {
  datos: RespuestaConversion
  grafico: PuntoGrafico[]
}) {
  const { consulta, resultado, contraste, varas } = datos

  return (
    <section className="aparecer mt-14" aria-live="polite">
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm text-tenue">
            {pesos(consulta.monto)} de {mesLargo(consulta.desde)} equivalen a
          </p>

          <p className="mt-2 text-[clamp(2.75rem,7vw,5rem)] leading-none font-semibold tracking-tight text-marca">
            {pesos(resultado.equivalente)}
          </p>

          <p className="mt-4 max-w-lg text-lg leading-relaxed text-tinta text-pretty">
            en {mesLargo(consulta.hasta)}.{' '}
            <span className="text-tenue">
              Los precios subieron {porcentaje(resultado.variacionPrecios)}, asi que ese
              dinero perdio{' '}
              <strong className="font-semibold text-alerta">
                {porcentaje(resultado.perdidaPoderAdquisitivo)}
              </strong>{' '}
              de su poder de compra.
            </span>
          </p>

          <TablaVaras consulta={consulta} varas={varas} />
        </div>

        <div className="lg:pt-1">
          <Grafico puntos={grafico} etiqueta="Valor de la UF en el periodo" />
        </div>
      </div>

      <Contraste contraste={contraste} />
    </section>
  )
}

/**
 * El monto nominal, sin reajustar, medido con otras varas en ambas fechas.
 *
 * Muestra la erosion de forma tangible: los mismos pesos guardados bajo el
 * colchon compran cada vez menos UF, menos UTM y menos dolares.
 */
function TablaVaras({
  consulta,
  varas,
}: {
  consulta: RespuestaConversion['consulta']
  varas: RespuestaConversion['varas']
}) {
  const filas = (['uf', 'utm', 'dolar'] as const).filter(
    (vara) => varas.desde[vara] != null && varas.hasta[vara] != null,
  )

  if (filas.length === 0) return null

  return (
    <div className="mt-10 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <caption className="mb-4 text-left text-sm text-tenue">
          <strong className="block font-medium text-tinta">
            Y si esos {pesos(consulta.monto)} hubieran quedado guardados
          </strong>
          <span className="mt-1 block">
            Arriba calculamos cuanto necesitas hoy para igualar. Aca es al reves: los
            mismos pesos, sin reajustar, comprando cada vez menos de cada unidad.
          </span>
        </caption>
        <thead>
          <tr className="border-b border-linea text-left text-tenue">
            <th scope="col" className="pb-2 font-medium">
              Unidad
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {mesLargo(consulta.desde)}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {mesLargo(consulta.hasta)}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Cambio
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((vara) => {
            const antes = varas.desde[vara]!
            const ahora = varas.hasta[vara]!
            const cambio = (ahora / antes - 1) * 100

            return (
              <tr key={vara} className="border-b border-linea/60">
                <th scope="row" className="py-3 text-left font-normal text-tinta">
                  {NOMBRE_VARA[vara]}
                </th>
                <td className="py-3 text-right font-mono tabular-nums text-tenue">
                  {numero(antes)}
                </td>
                <td className="py-3 text-right font-mono tabular-nums text-tinta">
                  {numero(ahora)}
                </td>
                <td
                  className={`py-3 text-right font-mono tabular-nums ${
                    cambio < 0 ? 'text-alerta' : 'text-marca'
                  }`}
                >
                  {cambio > 0 ? '+' : ''}
                  {porcentaje(cambio)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/*
        Aclaracion util cuando alguien contrasta con otra calculadora: los sitios
        de UF suelen mostrar el valor de un dia puntual, y la UF se mueve todos
        los dias. Sin esta nota, una diferencia de decimas se lee como un error.
      */}
      <p className="mt-3 text-xs text-tenue">
        Valores al ultimo dia de cada mes. La UF cambia a diario, asi que otra
        calculadora que use un dia distinto puede dar decimas de diferencia.
      </p>
    </div>
  )
}

/** Contraste entre los dos deflactores independientes. */
function Contraste({ contraste }: { contraste: RespuestaConversion['contraste'] }) {
  if (!contraste.disponible) {
    return (
      <p className="mt-10 max-w-2xl border-l-2 border-linea pl-4 text-sm text-tenue">
        Calculado con la UF. No se pudo contrastar con el IPC encadenado porque{' '}
        {contraste.motivo}.
      </p>
    )
  }

  return (
    <p className="mt-10 max-w-2xl border-l-2 border-marca/30 pl-4 text-sm text-tenue">
      Calculado con la UF. El IPC encadenado, que es una fuente independiente, da{' '}
      <strong className="font-medium text-tinta">{pesos(contraste.equivalente)}</strong>
      : una diferencia de {porcentaje(contraste.diferenciaPorcentual, 2)}. Que ambos
      coincidan es la senal de que el numero esta bien.
    </p>
  )
}
