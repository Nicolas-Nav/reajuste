"""Convierte el JSON crudo de la fuente en una tabla ordenada.

El punto delicado acá son las fechas. La fuente entrega instantes UTC que
corresponden a la medianoche de Chile:

    2024-12-01T03:00:00.000Z   ->  1 de diciembre, horario de verano (UTC-3)
    2024-09-01T04:00:00.000Z   ->  1 de septiembre, horario de invierno (UTC-4)

El offset cambia dos veces al año. Para obtener la fecha que la fuente quiso
decir hay que convertir a horario de Santiago y recién ahí tomar la fecha; no
asumir el offset ni quedarse con la fecha UTC.
"""

from __future__ import annotations

from zoneinfo import ZoneInfo

import pandas as pd

SANTIAGO = ZoneInfo("America/Santiago")

COLUMNAS = ["indicador", "fecha", "valor"]


class ErrorNormalizacion(ValueError):
    """Los datos crudos no tienen la forma esperada."""


def a_dataframe(indicador: str, serie: list[dict]) -> pd.DataFrame:
    """Convierte la serie cruda en un DataFrame con columnas indicador/fecha/valor.

    - `fecha` queda como `date` en horario de Santiago, sin hora.
    - Se descartan registros sin fecha o sin valor.
    - Se eliminan fechas duplicadas, conservando la última aparición.
    - El resultado queda ordenado por fecha ascendente.
    """
    if not serie:
        return pd.DataFrame(columns=COLUMNAS).astype(
            {"indicador": "object", "valor": "float64"}
        )

    marco = pd.DataFrame(serie)

    faltantes = {"fecha", "valor"} - set(marco.columns)
    if faltantes:
        raise ErrorNormalizacion(
            f"{indicador}: faltan columnas {sorted(faltantes)} en los datos crudos"
        )

    instantes = pd.to_datetime(marco["fecha"], utc=True, errors="coerce")
    # Convertir a Santiago ANTES de quedarse con la fecha.
    marco["fecha"] = instantes.dt.tz_convert(SANTIAGO).dt.date

    marco["valor"] = pd.to_numeric(marco["valor"], errors="coerce")
    marco["indicador"] = indicador

    marco = marco.dropna(subset=["fecha", "valor"])
    marco = marco.drop_duplicates(subset=["fecha"], keep="last")
    marco = marco.sort_values("fecha", ignore_index=True)

    return marco[COLUMNAS]


def mensual(marco: pd.DataFrame) -> pd.DataFrame:
    """Reduce una serie a un registro por mes, quedándose con el último día.

    Sirve para alinear series de distinta frecuencia: la UF es diaria y se
    salta fines de semana y feriados, mientras que el IPC y la tasa de
    desempleo son mensuales. Para comparar mes contra mes hay que llevarlas
    todas a la misma grilla.
    """
    if marco.empty:
        return marco.copy()

    copia = marco.copy()
    fechas = pd.to_datetime(copia["fecha"])
    copia["periodo"] = fechas.dt.to_period("M")

    copia = copia.sort_values("fecha")
    copia = copia.drop_duplicates(subset=["indicador", "periodo"], keep="last")

    return copia.reset_index(drop=True)
