"""Cliente de mindicador.cl.

Es un servicio gratuito y sin SLA, así que asumimos que a veces va a fallar:
timeouts explícitos y reintentos con espera creciente.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import requests

log = logging.getLogger(__name__)

BASE_URL = "https://mindicador.cl/api"

# Los 12 indicadores que publica la fuente. Los de tipo "Porcentaje" son
# variaciones o tasas; los demás son valores en pesos o dólares.
INDICADORES = (
    "uf",
    "ivp",
    "dolar",
    "dolar_intercambio",
    "euro",
    "ipc",
    "utm",
    "imacec",
    "tpm",
    "libra_cobre",
    "tasa_desempleo",
    "bitcoin",
)

TIMEOUT_SEGUNDOS = 20
REINTENTOS = 3
ESPERA_BASE_SEGUNDOS = 1.5


class ErrorFuente(RuntimeError):
    """La fuente no entregó datos utilizables."""


def _pedir(url: str) -> dict[str, Any]:
    """GET con reintentos. Espera 1.5s, 3s, 6s entre intentos."""
    ultimo_error: Exception | None = None

    for intento in range(1, REINTENTOS + 1):
        try:
            respuesta = requests.get(
                url,
                timeout=TIMEOUT_SEGUNDOS,
                headers={"Accept": "application/json"},
            )
            respuesta.raise_for_status()
            return respuesta.json()
        except (requests.RequestException, ValueError) as error:
            ultimo_error = error
            if intento < REINTENTOS:
                espera = ESPERA_BASE_SEGUNDOS * (2 ** (intento - 1))
                log.warning(
                    "intento %d/%d falló para %s (%s); reintentando en %.1fs",
                    intento, REINTENTOS, url, error, espera,
                )
                time.sleep(espera)

    raise ErrorFuente(f"no se pudo obtener {url}: {ultimo_error}") from ultimo_error


def traer_anio(indicador: str, anio: int) -> list[dict[str, Any]]:
    """Serie de un indicador para un año. Devuelve la lista cruda de la fuente.

    Un año sin datos devuelve lista vacía, no es un error: los indicadores no
    empiezan todos el mismo año (bitcoin no existe en 2010, por ejemplo).
    """
    if indicador not in INDICADORES:
        raise ValueError(f"indicador desconocido: {indicador!r}")

    datos = _pedir(f"{BASE_URL}/{indicador}/{anio}")
    serie = datos.get("serie") or []

    if not isinstance(serie, list):
        raise ErrorFuente(f"serie inesperada para {indicador}/{anio}: {type(serie)}")

    return serie


def traer_rango(indicador: str, desde: int, hasta: int) -> list[dict[str, Any]]:
    """Concatena las series de varios años consecutivos."""
    if desde > hasta:
        raise ValueError(f"rango invertido: {desde} > {hasta}")

    acumulado: list[dict[str, Any]] = []
    for anio in range(desde, hasta + 1):
        serie = traer_anio(indicador, anio)
        log.info("%s %d: %d registros", indicador, anio, len(serie))
        acumulado.extend(serie)

    return acumulado
