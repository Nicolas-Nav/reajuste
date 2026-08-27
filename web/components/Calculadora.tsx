'use client'

import { useEffect, useState, useTransition } from 'react'

import { Resultado } from './Resultado'
import { SelectorMes } from './SelectorMes'
import type { PuntoGrafico } from './Grafico'
import { entero, mesActual } from '@/lib/formato'
import type { RespuestaConversion, RespuestaError, RespuestaSerie } from '@/lib/tipos'

const EJEMPLO = { monto: 800_000, desde: '2015-01' }

const LIMITE_INFERIOR = '2010-01'

export function Calculadora() {
  const [monto, setMonto] = useState(String(EJEMPLO.monto))
  const [desde, setDesde] = useState(EJEMPLO.desde)
  const [hasta, setHasta] = useState(mesActual())

  const [datos, setDatos] = useState<RespuestaConversion | null>(null)
  const [serie, setSerie] = useState<PuntoGrafico[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, empezar] = useTransition()

  // Se calcula el ejemplo al entrar, para que la pagina se entienda sin escribir
  // nada. Es la diferencia entre "ya veo que hace" y un formulario en blanco.
  useEffect(() => {
    void calcular(String(EJEMPLO.monto), EJEMPLO.desde, mesActual())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function calcular(montoTexto: string, mesDesde: string, mesHasta: string) {
    const valor = Number(montoTexto)

    if (!Number.isFinite(valor) || valor <= 0) {
      setError('Escribe un monto mayor que cero.')
      setDatos(null)
      return
    }
    if (mesDesde > mesHasta) {
      setError('La fecha de origen tiene que ser anterior a la de destino.')
      setDatos(null)
      return
    }

    setError(null)

    const parametros = new URLSearchParams({
      monto: String(valor),
      desde: mesDesde,
      hasta: mesHasta,
    })

    try {
      const [conversion, historia] = await Promise.all([
        fetch(`/api/convertir?${parametros}`),
        fetch(`/api/series/uf?desde=${mesDesde}-01&hasta=${mesHasta}-28`),
      ])

      if (!conversion.ok) {
        const cuerpo = (await conversion.json()) as RespuestaError
        setError(
          cuerpo.disponible
            ? `${cuerpo.error}. Hay datos entre ${cuerpo.disponible.desde} y ${cuerpo.disponible.hasta}.`
            : cuerpo.error,
        )
        setDatos(null)
        return
      }

      setDatos((await conversion.json()) as RespuestaConversion)

      if (historia.ok) {
        const cuerpo = (await historia.json()) as RespuestaSerie
        setSerie(muestrear(cuerpo.registros, 160))
      } else {
        setSerie([])
      }
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
      setDatos(null)
    }
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    empezar(() => {
      void calcular(monto, desde, hasta)
    })
  }

  return (
    <>
      {/*
        noValidate desactiva la validacion del navegador a proposito. Bloquea el
        envio sin avisar y con mensajes propios que no controlamos; la validacion
        de `calcular` es en español, explica que hacer y se muestra en la pagina.
      */}
      {/*
        minmax(0, ...) en vez de solo fr: los input de tipo month traen un ancho
        minimo intrinseco grande, y sin el minimo en cero se niegan a encoger y
        aplastan la columna del monto.
      */}
      <form
        onSubmit={enviar}
        noValidate
        className="mt-10 grid gap-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <Campo etiqueta="Monto en pesos" htmlFor="monto">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-tenue">
              $
            </span>
            <input
              id="monto"
              type="number"
              inputMode="numeric"
              min="1"
              // step="1" y no "1000": con min=1, un step de 1000 solo acepta
              // 1, 1001, 2001... y deja invalido cualquier monto redondo.
              step="1"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-lg border border-linea bg-white py-3 pr-4 pl-8 text-lg tabular-nums transition-colors focus:border-marca focus:ring-2 focus:ring-marca/20 focus:outline-none"
            />
          </div>
          {monto && Number(monto) > 0 && (
            <p className="mt-1.5 text-xs text-tenue">{entero(Number(monto))} pesos</p>
          )}
        </Campo>

        <SelectorMes
          etiqueta="Desde"
          valor={desde}
          onChange={setDesde}
          min={LIMITE_INFERIOR}
          max={hasta}
        />

        <SelectorMes
          etiqueta="Hasta"
          valor={hasta}
          onChange={setHasta}
          min={desde}
          max={mesActual()}
        />

        <div className="flex items-end">
          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-tinta px-6 py-3 font-medium text-papel transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {cargando ? 'Calculando' : 'Calcular'}
          </button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-alerta/25 bg-alerta/5 px-4 py-3 text-sm text-alerta"
        >
          {error}
        </p>
      )}

      {cargando && !datos && <Esqueleto />}

      {datos && <Resultado datos={datos} grafico={serie} />}
    </>
  )
}

function Campo({
  etiqueta,
  htmlFor,
  children,
}: {
  etiqueta: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-tinta">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="mt-12 animate-pulse" aria-hidden>
      <div className="h-4 w-56 rounded bg-linea" />
      <div className="mt-4 h-16 w-80 max-w-full rounded bg-linea" />
      <div className="mt-4 h-4 w-full max-w-lg rounded bg-linea" />
    </div>
  )
}

/**
 * Reduce la serie a un maximo de puntos, tomando uno de cada n.
 *
 * Once años de UF diaria son mas de 4.000 puntos para un grafico de 720 px de
 * ancho: dibujarlos todos infla el SVG sin cambiar lo que se ve. Siempre se
 * conserva el ultimo, porque es el que lleva la etiqueta.
 */
function muestrear(puntos: PuntoGrafico[], maximo: number): PuntoGrafico[] {
  if (puntos.length <= maximo) return puntos

  const paso = Math.ceil(puntos.length / maximo)
  const salida = puntos.filter((_, i) => i % paso === 0)
  const ultimo = puntos[puntos.length - 1]

  if (salida[salida.length - 1] !== ultimo) salida.push(ultimo)
  return salida
}
