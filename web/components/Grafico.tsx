'use client'

import { useId, useRef, useState } from 'react'
import { entero, mesCorto } from '@/lib/formato'

export type PuntoGrafico = { fecha: string; valor: number }

const ANCHO = 720
const ALTO = 220
const MARGEN = { arriba: 16, abajo: 28, izq: 8, der: 8 }

/**
 * Grafico de area de la serie, en SVG puro.
 *
 * Sin libreria de graficos a proposito: son cuatro operaciones de escala, una
 * ruta y la busqueda del punto mas cercano al cursor. Una dependencia de 50 kB
 * para esto no se justifica.
 */
export function Grafico({
  puntos,
  etiqueta,
}: {
  puntos: PuntoGrafico[]
  etiqueta: string
}) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const [activo, setActivo] = useState<number | null>(null)

  if (puntos.length < 2) return null

  const valores = puntos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1

  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo

  const x = (i: number) => MARGEN.izq + (i / (puntos.length - 1)) * anchoUtil
  const y = (v: number) => MARGEN.arriba + altoUtil - ((v - min) / rango) * altoUtil

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.valor)}`).join(' ')
  const area = `${linea} L ${x(puntos.length - 1)} ${MARGEN.arriba + altoUtil} L ${x(0)} ${MARGEN.arriba + altoUtil} Z`

  const primero = puntos[0]
  const ultimo = puntos[puntos.length - 1]
  const destacado = activo === null ? null : puntos[activo]

  /**
   * Indice del punto mas cercano al cursor.
   *
   * Hay que pasar de pixeles de pantalla a coordenadas del viewBox, porque el
   * SVG se escala con el ancho disponible y los dos sistemas no coinciden.
   */
  function alMover(evento: React.PointerEvent<SVGSVGElement>) {
    const caja = svg.current?.getBoundingClientRect()
    if (!caja) return

    const relativo = ((evento.clientX - caja.left) / caja.width) * ANCHO
    const proporcion = (relativo - MARGEN.izq) / anchoUtil
    const indice = Math.round(proporcion * (puntos.length - 1))

    setActivo(Math.min(puntos.length - 1, Math.max(0, indice)))
  }

  return (
    <figure className="mt-10">
      {/*
        Sin repetir cifras a proposito. El grafico dibuja la serie diaria y la
        tabla usa valores de fin de mes, asi que los extremos no coinciden al
        peso; mostrarlos en los dos lados se lee como una contradiccion.
      */}
      <figcaption className="mb-1 text-sm font-medium text-tinta">{etiqueta}</figcaption>

      {/* Altura fija para que el grafico no salte cuando aparece la lectura. */}
      <p className="mb-2 h-5 font-mono text-xs text-tenue" aria-live="polite">
        {destacado
          ? `${mesCorto(destacado.fecha.slice(0, 7))}: $${entero(destacado.valor)}`
          : 'Pasa el cursor para ver el valor de cada dia'}
      </p>

      <div className="overflow-x-auto">
        <svg
          ref={svg}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="h-auto w-full min-w-[320px] touch-pan-y"
          role="img"
          aria-label={`${etiqueta}. De $${entero(primero.valor)} en ${mesCorto(primero.fecha.slice(0, 7))} a $${entero(ultimo.valor)} en ${mesCorto(ultimo.fecha.slice(0, 7))}.`}
          onPointerMove={alMover}
          onPointerLeave={() => setActivo(null)}
        >
          <defs>
            <linearGradient id={`relleno-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-marca)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-marca)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={area} fill={`url(#relleno-${id})`} />

          <path
            d={linea}
            fill="none"
            stroke="var(--color-marca)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 2000,
              strokeDashoffset: 2000,
              animation: 'trazo 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          />

          {destacado && activo !== null && (
            <g>
              <line
                x1={x(activo)}
                y1={MARGEN.arriba}
                x2={x(activo)}
                y2={MARGEN.arriba + altoUtil}
                stroke="var(--color-tenue)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={x(activo)}
                cy={y(destacado.valor)}
                r="4.5"
                fill="var(--color-marca)"
                stroke="var(--color-papel)"
                strokeWidth="2"
              />
            </g>
          )}

          {/* El punto final solo cuando no hay lectura activa, para no duplicar. */}
          {!destacado && (
            <circle cx={x(puntos.length - 1)} cy={y(ultimo.valor)} r="4" fill="var(--color-marca)" />
          )}

          <text x={x(0)} y={ALTO - 8} className="fill-tenue text-[11px]" textAnchor="start">
            {mesCorto(primero.fecha.slice(0, 7))}
          </text>
          <text
            x={x(puntos.length - 1)}
            y={ALTO - 8}
            className="fill-tenue text-[11px]"
            textAnchor="end"
          >
            {mesCorto(ultimo.fecha.slice(0, 7))}
          </text>
        </svg>
      </div>
    </figure>
  )
}
