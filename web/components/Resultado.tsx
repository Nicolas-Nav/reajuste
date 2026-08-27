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
 * El mismo monto medido con distintas varas.
 *
 * En UF la cifra es identica en ambas fechas, porque la UF es justamente el
 * deflactor que se uso. Lo interesante es la comparacion con las otras: contra
 * el dolar o la UTM la respuesta cambia.
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
      <table className="w-full min-w-[380px] border-collapse text-sm">
        <caption className="mb-3 text-left text-sm text-tenue">
          El mismo monto, medido con otras varas
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
          </tr>
        </thead>
        <tbody>
          {filas.map((vara) => (
            <tr key={vara} className="border-b border-linea/60">
              <th scope="row" className="py-3 text-left font-normal text-tinta">
                {NOMBRE_VARA[vara]}
              </th>
              <td className="py-3 text-right font-mono tabular-nums text-tenue">
                {numero(varas.desde[vara]!)}
              </td>
              <td className="py-3 text-right font-mono tabular-nums text-tinta">
                {numero(varas.hasta[vara]!)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
