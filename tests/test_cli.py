"""Tests del parseo de argumentos de la CLI.

Existen por un fallo real: `--verboso` estaba definido solo en el parser
principal, asi que `pipeline ingesta --verboso` moria con "unrecognized
arguments" y tumbo el workflow de ingesta la primera vez que corrio.
"""

from __future__ import annotations

import datetime as dt

import pytest

from pipeline.__main__ import construir_parser


def parsear(*argv: str):
    return construir_parser().parse_args(list(argv))


class TestVerboso:
    def test_antes_del_subcomando(self):
        args = parsear("-v", "ingesta")
        assert getattr(args, "verboso", False) is True

    def test_despues_del_subcomando(self):
        args = parsear("ingesta", "--verboso")
        assert getattr(args, "verboso", False) is True

    def test_ausente(self):
        args = parsear("ingesta")
        assert getattr(args, "verboso", False) is False

    @pytest.mark.parametrize("comando", ["ingesta", "resumen"])
    def test_en_todos_los_subcomandos(self, comando):
        assert getattr(parsear(comando, "-v"), "verboso", False) is True


class TestIngesta:
    def test_desde_por_defecto(self):
        assert parsear("ingesta").desde == 2010

    def test_desde_explicito(self):
        # Asi lo invoca el workflow: --desde "$(date -u +%Y)"
        assert parsear("ingesta", "--desde", "2026").desde == 2026

    def test_indicadores_validos(self):
        args = parsear("ingesta", "--indicadores", "uf", "ipc")
        assert args.indicadores == ["uf", "ipc"]

    def test_indicador_inventado_falla(self):
        with pytest.raises(SystemExit):
            parsear("ingesta", "--indicadores", "no_existe")


class TestCalcular:
    def test_acepta_mes(self):
        args = parsear("calcular", "--monto", "800000", "--desde", "2015-01")
        assert args.monto == 800000.0
        assert args.desde == dt.date(2015, 1, 1)

    def test_acepta_fecha_completa(self):
        args = parsear("calcular", "--monto", "1000", "--desde", "2015-01-15")
        assert args.desde == dt.date(2015, 1, 15)

    def test_fecha_invalida_falla(self):
        with pytest.raises(SystemExit):
            parsear("calcular", "--monto", "1000", "--desde", "enero de 2015")

    def test_monto_es_obligatorio(self):
        with pytest.raises(SystemExit):
            parsear("calcular", "--desde", "2015-01")


def test_sin_subcomando_falla():
    with pytest.raises(SystemExit):
        parsear()
