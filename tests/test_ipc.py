"""Tests del encadenamiento del IPC.

Toda la lógica de este módulo es pura: entra un DataFrame, sale un número.
Eso la hace determinista y testeable sin red ni base de datos, así que el CI
corre en segundos y no depende de que mindicador.cl esté arriba.
"""

from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from pipeline import ipc


def serie(*variaciones: float, desde: str = "2024-01-01") -> pd.DataFrame:
    """Arma una serie mensual de variaciones a partir del mes `desde`."""
    fechas = pd.date_range(desde, periods=len(variaciones), freq="MS")
    return pd.DataFrame({"fecha": fechas.date, "valor": list(variaciones)})


class TestEncadenamiento:
    def test_el_primer_mes_es_la_base(self):
        indice = ipc.construir_indice(serie(0.5))
        assert indice["indice"].iloc[0] == pytest.approx(100.0)

    def test_encadena_multiplicando_no_sumando(self):
        # Este es EL test del proyecto: +1% dos veces da +2,01%, no +2%.
        indice = ipc.construir_indice(serie(0.0, 1.0, 1.0))
        assert indice["indice"].iloc[-1] == pytest.approx(102.01)

    def test_la_diferencia_crece_con_el_plazo(self):
        # Doce meses de +1%: sumando daría 112, encadenando da 112,68.
        indice = ipc.construir_indice(serie(0.0, *([1.0] * 12)))
        assert indice["indice"].iloc[-1] == pytest.approx(112.6825, abs=1e-3)

    def test_acepta_deflacion(self):
        # Diciembre 2024 fue -0,2% en Chile: las variaciones negativas son reales.
        indice = ipc.construir_indice(serie(0.0, -0.2))
        assert indice["indice"].iloc[-1] == pytest.approx(99.8)

    def test_sube_y_baja_no_vuelve_al_origen(self):
        # +10% y luego -10% deja 99, no 100. Otro error clásico.
        indice = ipc.construir_indice(serie(0.0, 10.0, -10.0))
        assert indice["indice"].iloc[-1] == pytest.approx(99.0)


class TestContinuidad:
    def test_falla_si_falta_un_mes(self):
        incompleta = pd.DataFrame(
            {
                "fecha": [date(2024, 1, 1), date(2024, 2, 1), date(2024, 4, 1)],
                "valor": [0.5, 0.3, 0.2],
            }
        )
        with pytest.raises(ipc.SerieIncompleta, match="2024-03"):
            ipc.construir_indice(incompleta)

    def test_falla_con_serie_vacia(self):
        vacia = pd.DataFrame({"fecha": [], "valor": []})
        with pytest.raises(ipc.SerieIncompleta):
            ipc.construir_indice(vacia)

    def test_no_falla_si_esta_completa(self):
        ipc.verificar_continuidad(serie(0.1, 0.2, 0.3))

    def test_el_desorden_no_es_un_hueco(self):
        desordenada = pd.DataFrame(
            {
                "fecha": [date(2024, 3, 1), date(2024, 1, 1), date(2024, 2, 1)],
                "valor": [0.2, 0.5, 0.3],
            }
        )
        ipc.verificar_continuidad(desordenada)


class TestConversion:
    def test_convierte_hacia_adelante(self):
        indice = ipc.construir_indice(serie(0.0, 10.0))
        resultado = ipc.convertir(indice, 1000, date(2024, 1, 15), date(2024, 2, 20))
        assert resultado == pytest.approx(1100.0)

    def test_convierte_hacia_atras(self):
        indice = ipc.construir_indice(serie(0.0, 10.0))
        resultado = ipc.convertir(indice, 1100, date(2024, 2, 1), date(2024, 1, 1))
        assert resultado == pytest.approx(1000.0)

    def test_ida_y_vuelta_devuelve_el_original(self):
        indice = ipc.construir_indice(serie(0.0, 0.7, -0.3, 1.2, 0.4))
        a, b = date(2024, 1, 1), date(2024, 5, 1)
        ida = ipc.convertir(indice, 850_000, a, b)
        vuelta = ipc.convertir(indice, ida, b, a)
        assert vuelta == pytest.approx(850_000)

    def test_el_dia_del_mes_no_cambia_el_resultado(self):
        indice = ipc.construir_indice(serie(0.0, 5.0))
        inicio = ipc.convertir(indice, 100, date(2024, 1, 1), date(2024, 2, 1))
        fin = ipc.convertir(indice, 100, date(2024, 1, 31), date(2024, 2, 29))
        assert inicio == pytest.approx(fin)

    def test_falla_fuera_de_rango(self):
        indice = ipc.construir_indice(serie(0.0, 1.0))
        with pytest.raises(ipc.SerieIncompleta, match="fuera de la serie"):
            ipc.convertir(indice, 100, date(2020, 1, 1), date(2024, 2, 1))


class TestPoderAdquisitivo:
    def test_variacion_acumulada(self):
        indice = ipc.construir_indice(serie(0.0, 1.0, 1.0))
        acumulada = ipc.variacion_acumulada(indice, date(2024, 1, 1), date(2024, 3, 1))
        assert acumulada == pytest.approx(2.01)

    def test_precios_al_doble_es_perder_la_mitad(self):
        # Si los precios suben 100%, el poder de compra cae 50%, no 100%.
        indice = ipc.construir_indice(serie(0.0, 100.0))
        perdida = ipc.perdida_poder_adquisitivo(indice, date(2024, 1, 1), date(2024, 2, 1))
        assert perdida == pytest.approx(50.0)

    def test_perdida_y_variacion_no_son_lo_mismo(self):
        indice = ipc.construir_indice(serie(0.0, 25.0))
        desde, hasta = date(2024, 1, 1), date(2024, 2, 1)
        assert ipc.variacion_acumulada(indice, desde, hasta) == pytest.approx(25.0)
        assert ipc.perdida_poder_adquisitivo(indice, desde, hasta) == pytest.approx(20.0)
