'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { mesLargo } from '@/lib/formato'

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

type Props = {
  etiqueta: string
  valor: string
  onChange: (mes: string) => void
  /** Limites inclusivos, en formato AAAA-MM. */
  min: string
  max: string
}

/**
 * Selector de mes propio.
 *
 * El `input type="month"` nativo funciona, pero cada navegador lo dibuja a su
 * manera y ninguno se parece al resto de la pagina. Este es una grilla de doce
 * meses con navegacion por año, que se ve igual en todas partes y respeta los
 * limites de la serie de datos.
 */
export function SelectorMes({ etiqueta, valor, onChange, min, max }: Props) {
  const id = useId()
  const contenedor = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)

  const [abierto, setAbierto] = useState(false)
  const [anioVisible, setAnioVisible] = useState(() => Number(valor.slice(0, 4)))
  // Dos vistas: la grilla de meses y la de años. Sin la de años, saltar de 2015
  // a 2026 son once clics en la flecha.
  const [vista, setVista] = useState<'meses' | 'anios'>('meses')

  const anioMin = Number(min.slice(0, 4))
  const anioMax = Number(max.slice(0, 4))

  // Al reabrir, mostrar el año del valor elegido y no donde quedo la navegacion.
  useEffect(() => {
    if (abierto) {
      setAnioVisible(Number(valor.slice(0, 4)))
      setVista('meses')
    }
  }, [abierto, valor])

  useEffect(() => {
    if (!abierto) return

    function alClicFuera(evento: MouseEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false)
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAbierto(false)
        disparador.current?.focus()
      }
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  function elegir(indiceMes: number) {
    const mes = `${anioVisible}-${String(indiceMes + 1).padStart(2, '0')}`
    onChange(mes)
    setAbierto(false)
    disparador.current?.focus()
  }

  /** Un mes esta fuera de rango si cae antes de `min` o despues de `max`. */
  function deshabilitado(indiceMes: number): boolean {
    const mes = `${anioVisible}-${String(indiceMes + 1).padStart(2, '0')}`
    return mes < min || mes > max
  }

  const anioSeleccionado = Number(valor.slice(0, 4))
  const mesSeleccionado = Number(valor.slice(5, 7)) - 1

  return (
    <div ref={contenedor} className="relative">
      <span id={`${id}-etiqueta`} className="mb-2 block text-sm font-medium text-tinta">
        {etiqueta}
      </span>

      <button
        ref={disparador}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-labelledby={`${id}-etiqueta ${id}-valor`}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3 text-left text-lg transition-colors ${
          abierto
            ? 'border-marca ring-2 ring-marca/20'
            : 'border-linea hover:border-tenue/50'
        }`}
      >
        <span id={`${id}-valor`}>{mesLargo(valor)}</span>
        <ChevronAbajo abierto={abierto} />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={`Elegir mes para ${etiqueta.toLowerCase()}`}
          className="absolute top-full left-0 z-20 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-linea bg-white p-3 shadow-lg shadow-tinta/5"
        >
          <div className="mb-2 flex items-center justify-between">
            <FlechaAnio
              direccion="atras"
              onClick={() => setAnioVisible((a) => a - 1)}
              deshabilitado={vista === 'anios' || anioVisible <= anioMin}
            />

            {/* El año abre la grilla de años, para no tener que ir de a uno. */}
            <button
              type="button"
              onClick={() => setVista((v) => (v === 'meses' ? 'anios' : 'meses'))}
              aria-expanded={vista === 'anios'}
              className="rounded-md px-3 py-1 font-mono text-sm font-medium tabular-nums transition-colors hover:bg-marca-suave"
            >
              {vista === 'anios' ? 'Elegir año' : anioVisible}
            </button>

            <FlechaAnio
              direccion="adelante"
              onClick={() => setAnioVisible((a) => a + 1)}
              deshabilitado={vista === 'anios' || anioVisible >= anioMax}
            />
          </div>

          {vista === 'anios' ? (
            <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
              {Array.from({ length: anioMax - anioMin + 1 }, (_, i) => anioMin + i).map(
                (anio) => (
                  <button
                    key={anio}
                    type="button"
                    aria-current={anio === anioVisible ? 'true' : undefined}
                    onClick={() => {
                      setAnioVisible(anio)
                      setVista('meses')
                    }}
                    className={`rounded-md px-2 py-2.5 font-mono text-sm tabular-nums transition-colors ${
                      anio === anioVisible
                        ? 'bg-marca font-medium text-white'
                        : 'text-tinta hover:bg-marca-suave'
                    }`}
                  >
                    {anio}
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {MESES_CORTOS.map((mes, i) => {
                const inhabilitado = deshabilitado(i)
                const elegido = anioVisible === anioSeleccionado && i === mesSeleccionado

                return (
                  <button
                    key={mes}
                    type="button"
                    disabled={inhabilitado}
                    aria-current={elegido ? 'true' : undefined}
                    onClick={() => elegir(i)}
                    className={`rounded-md px-2 py-2.5 text-sm transition-colors ${
                      elegido
                        ? 'bg-marca font-medium text-white'
                        : inhabilitado
                          ? 'cursor-not-allowed text-tenue/35'
                          : 'text-tinta hover:bg-marca-suave'
                    }`}
                  >
                    {mes}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChevronAbajo({ abierto }: { abierto: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-tenue transition-transform duration-200 ${
        abierto ? 'rotate-180' : ''
      }`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function FlechaAnio({
  direccion,
  onClick,
  deshabilitado,
}: {
  direccion: 'atras' | 'adelante'
  onClick: () => void
  deshabilitado: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={direccion === 'atras' ? 'Año anterior' : 'Año siguiente'}
      className="grid size-8 place-items-center rounded-md text-tenue transition-colors hover:bg-marca-suave hover:text-tinta disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={direccion === 'atras' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  )
}
