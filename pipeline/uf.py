"""La UF como deflactor.

Por qué existe este módulo además de `ipc.py`:

La fuente **no publica IPC del año en curso**. Al momento de escribir esto la
serie de IPC llega hasta diciembre del año anterior, mientras que la UF tiene
datos hasta más de un mes hacia adelante. Una calculadora que responde "cuánto
vale hoy" no puede quedarse ocho meses atrasada.

Y resulta que la UF es el deflactor natural en Chile: se reajusta a diario
según la variación del IPC del mes anterior, así que *es* un índice de precios
ya encadenado por el Banco Central. Los arriendos, los créditos hipotecarios y
buena parte de los contratos están en UF precisamente por eso.

A diferencia del IPC, acá no hay que encadenar nada: la UF ya viene como nivel.

Contrastar ambos métodos da la misma respuesta con ~0,1% de diferencia, lo que
sirve de validación cruzada del encadenamiento del IPC.
"""

from __future__ import annotations

from datetime import date

import pandas as pd


class FueraDeRango(ValueError):
    """La fecha pedida no está cubierta por la serie de UF."""


def serie_mensual(marco: pd.DataFrame) -> pd.DataFrame:
    """Reduce la UF diaria a un valor por mes (el del último día disponible).

    Devuelve columnas `periodo` y `valor`.
    """
    if marco.empty:
        raise FueraDeRango("la serie de UF está vacía")

    copia = marco.copy()
    copia["periodo"] = pd.to_datetime(copia["fecha"]).dt.to_period("M")
    copia = copia.sort_values("fecha")
    copia = copia.drop_duplicates(subset=["periodo"], keep="last")

    return copia[["periodo", "valor"]].reset_index(drop=True)


def _valor_en(mensual: pd.DataFrame, momento: date) -> float:
    periodo = pd.Period(momento, freq="M")
    fila = mensual.loc[mensual["periodo"] == periodo, "valor"]

    if fila.empty:
        primero, ultimo = mensual["periodo"].iloc[0], mensual["periodo"].iloc[-1]
        raise FueraDeRango(
            f"{periodo} está fuera de la serie de UF ({primero} a {ultimo})"
        )

    return float(fila.iloc[0])


def convertir(mensual: pd.DataFrame, monto: float, desde: date, hasta: date) -> float:
    """Cuánto vale en `hasta` un monto que en `desde` valía `monto`."""
    return monto * _valor_en(mensual, hasta) / _valor_en(mensual, desde)


def perdida_poder_adquisitivo(mensual: pd.DataFrame, desde: date, hasta: date) -> float:
    """Porcentaje de poder de compra que perdió un monto nominal."""
    factor = _valor_en(mensual, hasta) / _valor_en(mensual, desde)
    return (1.0 - 1.0 / factor) * 100.0


def ultimo_periodo_publicado(mensual: pd.DataFrame, hoy: date | None = None) -> pd.Period:
    """El mes más reciente que ya ocurrió.

    La UF se publica con anticipación: se calcula del día 10 de un mes al 9 del
    siguiente, así que la serie contiene fechas futuras. Tomar `max(fecha)` como
    "hoy" daría un mes que todavía no termina.
    """
    hoy = hoy or date.today()
    actual = pd.Period(hoy, freq="M")
    disponibles = mensual.loc[mensual["periodo"] <= actual, "periodo"]

    if disponibles.empty:
        raise FueraDeRango(f"no hay datos de UF hasta {actual}")

    return disponibles.iloc[-1]
