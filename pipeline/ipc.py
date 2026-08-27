"""Encadenamiento del IPC.

La fuente entrega el IPC como **variación porcentual mensual**, no como un
índice. Para comparar dos fechas cualesquiera hay que encadenar esas
variaciones multiplicando, no sumando:

    +1% en enero y +1% en febrero  =>  +2,01%   (no +2%)

Sumar las variaciones es el error clásico y da resultados cada vez más
equivocados mientras más largo es el período.

El índice que se construye acá es relativo: vale 100 en el primer mes de la
serie y de ahí en adelante refleja el nivel de precios acumulado.
"""

from __future__ import annotations

from datetime import date

import pandas as pd

BASE = 100.0


class SerieIncompleta(ValueError):
    """Faltan meses en la serie.

    Se levanta en vez de rellenar el hueco: un mes ausente tratado como 0%
    produce un número que se ve razonable pero es falso, y nadie lo nota.
    """


def _a_periodos(marco: pd.DataFrame) -> pd.Series:
    return pd.to_datetime(marco["fecha"]).dt.to_period("M")


def verificar_continuidad(marco: pd.DataFrame) -> None:
    """Falla si entre el primer y el último mes de la serie falta alguno."""
    if marco.empty:
        raise SerieIncompleta("la serie de IPC está vacía")

    periodos = _a_periodos(marco).sort_values()
    esperados = pd.period_range(periodos.iloc[0], periodos.iloc[-1], freq="M")

    faltantes = sorted(set(esperados) - set(periodos))
    if faltantes:
        muestra = ", ".join(str(p) for p in faltantes[:5])
        sufijo = f" (y {len(faltantes) - 5} más)" if len(faltantes) > 5 else ""
        raise SerieIncompleta(f"faltan {len(faltantes)} meses: {muestra}{sufijo}")


def construir_indice(marco: pd.DataFrame) -> pd.DataFrame:
    """Convierte variaciones mensuales en un indice encadenado.

    Espera un DataFrame con columnas `fecha` y `valor`, donde `valor` es la
    variación porcentual del mes. Devuelve columnas `periodo` e `indice`.

    El primer mes queda en 100: es la base, su propia variación no se aplica
    porque no hay un mes anterior contra el cual medirla.
    """
    verificar_continuidad(marco)

    ordenado = marco.copy()
    ordenado["periodo"] = _a_periodos(ordenado)
    ordenado = ordenado.sort_values("periodo", ignore_index=True)

    factores = 1.0 + ordenado["valor"].astype(float) / 100.0
    # El primer mes es la base: se ignora su variación.
    factores.iloc[0] = 1.0

    ordenado["indice"] = BASE * factores.cumprod()

    return ordenado[["periodo", "indice"]]


INDICADOR_DERIVADO = "ipc_indice"


def como_serie(indice: pd.DataFrame) -> pd.DataFrame:
    """Deja el indice en el formato de la tabla `indicadores`, para guardarlo.

    El encadenamiento se calcula una sola vez, aca en Python, y se persiste como
    la serie `ipc_indice`. Asi la API lo lee ya listo en vez de re-implementar la
    misma logica en TypeScript, que es la clase de duplicacion que termina
    divergiendo sin que nadie se entere.

    La fecha de cada punto es el primer dia de su mes.
    """
    salida = indice.copy()
    salida["fecha"] = salida["periodo"].dt.to_timestamp().dt.date
    salida["valor"] = salida["indice"]
    salida["indicador"] = INDICADOR_DERIVADO

    return salida[["indicador", "fecha", "valor"]].reset_index(drop=True)


def _indice_en(indice: pd.DataFrame, momento: date) -> float:
    periodo = pd.Period(momento, freq="M")
    fila = indice.loc[indice["periodo"] == periodo, "indice"]

    if fila.empty:
        primero, ultimo = indice["periodo"].iloc[0], indice["periodo"].iloc[-1]
        raise SerieIncompleta(
            f"{periodo} está fuera de la serie disponible ({primero} a {ultimo})"
        )

    return float(fila.iloc[0])


def convertir(indice: pd.DataFrame, monto: float, desde: date, hasta: date) -> float:
    """Cuánto vale en `hasta` un monto que en `desde` valía `monto`.

    Funciona en ambos sentidos: si `hasta` es anterior a `desde`, deflacta.
    """
    factor = _indice_en(indice, hasta) / _indice_en(indice, desde)
    return monto * factor


def variacion_acumulada(indice: pd.DataFrame, desde: date, hasta: date) -> float:
    """Variación porcentual acumulada del nivel de precios entre dos fechas."""
    factor = _indice_en(indice, hasta) / _indice_en(indice, desde)
    return (factor - 1.0) * 100.0


def perdida_poder_adquisitivo(indice: pd.DataFrame, desde: date, hasta: date) -> float:
    """Cuánto poder de compra perdió un monto nominal, en porcentaje.

    Distinto de `variacion_acumulada`: si los precios suben 100%, la plata no
    pierde 100% de su poder de compra sino 50%. Es la relación inversa, y
    confundirlas es otro error frecuente.
    """
    factor = _indice_en(indice, hasta) / _indice_en(indice, desde)
    return (1.0 - 1.0 / factor) * 100.0
