import { describe, expect, it } from 'vitest'
import {
  convertir,
  enUnidad,
  MesInvalido,
  normalizarMes,
  perdidaPoderAdquisitivo,
  redondear,
  variacionAcumulada,
} from './calculo'

describe('normalizarMes', () => {
  it('acepta AAAA-MM', () => {
    expect(normalizarMes('2015-01')).toBe('2015-01-01')
  })

  it('lleva una fecha completa al primer dia del mes', () => {
    expect(normalizarMes('2015-01-20')).toBe('2015-01-01')
  })

  it.each(['2015-13', '2015-00', '2015', 'enero de 2015', '', '2015-1'])(
    'rechaza %o',
    (entrada) => {
      expect(() => normalizarMes(entrada)).toThrow(MesInvalido)
    },
  )
})

describe('convertir', () => {
  it('aplica la razon entre indices', () => {
    expect(convertir(1000, 100, 110)).toBeCloseTo(1100)
  })

  it('funciona hacia atras', () => {
    expect(convertir(1100, 110, 100)).toBeCloseTo(1000)
  })

  it('ida y vuelta devuelve el original', () => {
    const ida = convertir(850_000, 24_600, 40_868)
    expect(convertir(ida, 40_868, 24_600)).toBeCloseTo(850_000, 6)
  })

  it('falla si el indice de origen es cero', () => {
    expect(() => convertir(1000, 0, 110)).toThrow(RangeError)
  })
})

describe('variacionAcumulada y perdidaPoderAdquisitivo', () => {
  it('no son lo mismo', () => {
    // Precios +25% significa perder 20% del poder de compra, no 25%.
    expect(variacionAcumulada(100, 125)).toBeCloseTo(25)
    expect(perdidaPoderAdquisitivo(100, 125)).toBeCloseTo(20)
  })

  it('precios al doble es perder la mitad', () => {
    expect(perdidaPoderAdquisitivo(100, 200)).toBeCloseTo(50)
  })

  it('sin cambios no hay perdida', () => {
    expect(perdidaPoderAdquisitivo(100, 100)).toBeCloseTo(0)
  })

  it('acepta deflacion', () => {
    expect(variacionAcumulada(100, 98)).toBeCloseTo(-2)
  })
})

describe('enUnidad', () => {
  it('expresa pesos como cantidad de UF', () => {
    expect(enUnidad(408_685, 40_868.5)).toBeCloseTo(10)
  })

  it('falla si la unidad vale cero', () => {
    expect(() => enUnidad(1000, 0)).toThrow(RangeError)
  })
})

describe('redondear', () => {
  it('corta a dos decimales por defecto', () => {
    expect(redondear(1.23456)).toBe(1.23)
  })

  it('respeta los decimales pedidos', () => {
    expect(redondear(1.23456, 3)).toBe(1.235)
  })

  it('no arrastra ruido de punto flotante', () => {
    expect(redondear(0.1 + 0.2)).toBe(0.3)
  })
})

describe('coherencia con el pipeline', () => {
  it('reproduce el resultado real de la CLI', () => {
    // La CLI en Python respondio: $800.000 de 2015-01 equivalen a $1.331.548
    // en 2026-08, con 39,9% de poder de compra perdido.
    const ufEnero2015 = 24_627.1
    const ufAgosto2026 = 40_985.98

    expect(Math.round(convertir(800_000, ufEnero2015, ufAgosto2026))).toBeCloseTo(
      1_331_548,
      -3,
    )
    expect(redondear(perdidaPoderAdquisitivo(ufEnero2015, ufAgosto2026), 1)).toBeCloseTo(
      39.9,
      1,
    )
  })
})
