"""Tests de la normalización, con foco en las fechas.

Los datos crudos de estos tests son fragmentos reales de la respuesta de
mindicador.cl, incluidos los dos offsets distintos que aparecen según el
horario de verano.
"""

from __future__ import annotations

from datetime import date

import pandas as pd
import pytest

from pipeline import normalizar


class TestFechas:
    def test_horario_de_verano_cae_en_el_dia_correcto(self):
        # Chile en diciembre está en UTC-3, así que la medianoche local son
        # las 03:00 UTC.
        marco = normalizar.a_dataframe(
            "ipc", [{"fecha": "2024-12-01T03:00:00.000Z", "valor": -0.2}]
        )
        assert marco["fecha"].iloc[0] == date(2024, 12, 1)

    def test_horario_de_invierno_cae_en_el_dia_correcto(self):
        # En septiembre está en UTC-4: la medianoche local son las 04:00 UTC.
        marco = normalizar.a_dataframe(
            "ipc", [{"fecha": "2024-09-01T04:00:00.000Z", "valor": 0.1}]
        )
        assert marco["fecha"].iloc[0] == date(2024, 9, 1)

    def test_los_dos_offsets_conviven_en_una_serie(self):
        # Una serie anual cruza ambos cambios de hora. Todos los registros
        # deben caer el día 1 de su mes.
        crudo = [
            {"fecha": "2024-12-01T03:00:00.000Z", "valor": -0.2},
            {"fecha": "2024-09-01T04:00:00.000Z", "valor": 0.1},
            {"fecha": "2024-06-01T04:00:00.000Z", "valor": 0.1},
            {"fecha": "2024-01-01T03:00:00.000Z", "valor": 0.7},
        ]
        marco = normalizar.a_dataframe("ipc", crudo)
        assert all(f.day == 1 for f in marco["fecha"])
        assert list(marco["fecha"]) == [
            date(2024, 1, 1), date(2024, 6, 1), date(2024, 9, 1), date(2024, 12, 1),
        ]


class TestLimpieza:
    def test_ordena_ascendente(self):
        # La fuente entrega del más reciente al más antiguo.
        crudo = [
            {"fecha": "2024-03-01T03:00:00.000Z", "valor": 3},
            {"fecha": "2024-01-01T03:00:00.000Z", "valor": 1},
            {"fecha": "2024-02-01T03:00:00.000Z", "valor": 2},
        ]
        marco = normalizar.a_dataframe("uf", crudo)
        assert list(marco["valor"]) == [1.0, 2.0, 3.0]

    def test_descarta_duplicados(self):
        crudo = [
            {"fecha": "2024-01-01T03:00:00.000Z", "valor": 1},
            {"fecha": "2024-01-01T03:00:00.000Z", "valor": 99},
        ]
        marco = normalizar.a_dataframe("uf", crudo)
        assert len(marco) == 1

    def test_descarta_valores_no_numericos(self):
        crudo = [
            {"fecha": "2024-01-01T03:00:00.000Z", "valor": 1},
            {"fecha": "2024-02-01T03:00:00.000Z", "valor": None},
            {"fecha": "2024-03-01T03:00:00.000Z", "valor": "n/d"},
        ]
        marco = normalizar.a_dataframe("uf", crudo)
        assert len(marco) == 1

    def test_serie_vacia_da_dataframe_vacio_con_columnas(self):
        marco = normalizar.a_dataframe("bitcoin", [])
        assert marco.empty
        assert list(marco.columns) == normalizar.COLUMNAS

    def test_falla_si_faltan_columnas(self):
        with pytest.raises(normalizar.ErrorNormalizacion, match="valor"):
            normalizar.a_dataframe("uf", [{"fecha": "2024-01-01T03:00:00.000Z"}])

    def test_marca_el_indicador(self):
        marco = normalizar.a_dataframe(
            "dolar", [{"fecha": "2024-01-01T03:00:00.000Z", "valor": 900}]
        )
        assert marco["indicador"].iloc[0] == "dolar"


class TestMensual:
    def test_se_queda_con_el_ultimo_dia_del_mes(self):
        # La UF es diaria; para comparar contra el IPC hay que reducirla a un
        # dato por mes.
        diaria = pd.DataFrame(
            {
                "indicador": ["uf"] * 4,
                "fecha": [
                    date(2024, 1, 2), date(2024, 1, 31),
                    date(2024, 2, 1), date(2024, 2, 29),
                ],
                "valor": [36000.0, 36100.0, 36150.0, 36300.0],
            }
        )
        resultado = normalizar.mensual(diaria)
        assert len(resultado) == 2
        assert list(resultado["valor"]) == [36100.0, 36300.0]

    def test_vacio_sigue_vacio(self):
        vacio = pd.DataFrame(columns=normalizar.COLUMNAS)
        assert normalizar.mensual(vacio).empty
