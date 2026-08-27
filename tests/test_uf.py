"""Tests del deflactor basado en UF."""

from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from pipeline import uf


def diaria(pares: list[tuple[str, float]]) -> pd.DataFrame:
    """Arma una serie diaria de UF a partir de (fecha_iso, valor)."""
    return pd.DataFrame(
        {
            "indicador": ["uf"] * len(pares),
            "fecha": [date.fromisoformat(f) for f, _ in pares],
            "valor": [v for _, v in pares],
        }
    )


class TestSerieMensual:
    def test_toma_el_ultimo_dia_de_cada_mes(self):
        serie = uf.serie_mensual(
            diaria([
                ("2024-01-02", 36000.0),
                ("2024-01-31", 36100.0),
                ("2024-02-01", 36150.0),
                ("2024-02-29", 36300.0),
            ])
        )
        assert list(serie["valor"]) == [36100.0, 36300.0]

    def test_falla_con_serie_vacia(self):
        vacia = pd.DataFrame(columns=["indicador", "fecha", "valor"])
        with pytest.raises(uf.FueraDeRango):
            uf.serie_mensual(vacia)


class TestConversion:
    def test_convierte_segun_la_razon_de_uf(self):
        serie = uf.serie_mensual(
            diaria([("2024-01-31", 30000.0), ("2024-02-29", 33000.0)])
        )
        # La UF subió 10%, así que el monto equivalente sube 10%.
        assert uf.convertir(serie, 1000, date(2024, 1, 1), date(2024, 2, 1)) == pytest.approx(1100)

    def test_ida_y_vuelta(self):
        serie = uf.serie_mensual(
            diaria([("2024-01-31", 36000.0), ("2024-06-30", 37500.0)])
        )
        a, b = date(2024, 1, 1), date(2024, 6, 1)
        ida = uf.convertir(serie, 750_000, a, b)
        assert uf.convertir(serie, ida, b, a) == pytest.approx(750_000)

    def test_falla_fuera_de_rango(self):
        serie = uf.serie_mensual(diaria([("2024-01-31", 36000.0)]))
        with pytest.raises(uf.FueraDeRango, match="fuera de la serie"):
            uf.convertir(serie, 100, date(2010, 1, 1), date(2024, 1, 1))

    def test_perdida_de_poder_adquisitivo(self):
        serie = uf.serie_mensual(
            diaria([("2024-01-31", 30000.0), ("2024-02-29", 60000.0)])
        )
        # La UF al doble => se pierde la mitad del poder de compra.
        perdida = uf.perdida_poder_adquisitivo(serie, date(2024, 1, 1), date(2024, 2, 1))
        assert perdida == pytest.approx(50.0)


class TestUltimoPeriodo:
    def test_ignora_los_meses_futuros(self):
        # La UF se publica hacia adelante: la serie llega a septiembre aunque
        # estemos en agosto. El último mes válido es agosto.
        serie = uf.serie_mensual(
            diaria([
                ("2026-07-31", 40700.0),
                ("2026-08-31", 40800.0),
                ("2026-09-09", 40885.63),
            ])
        )
        ultimo = uf.ultimo_periodo_publicado(serie, hoy=date(2026, 8, 27))
        assert str(ultimo) == "2026-08"

    def test_falla_si_todo_es_futuro(self):
        serie = uf.serie_mensual(diaria([("2026-09-09", 40885.63)]))
        with pytest.raises(uf.FueraDeRango):
            uf.ultimo_periodo_publicado(serie, hoy=date(2020, 1, 1))
