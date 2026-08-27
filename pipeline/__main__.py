"""CLI del pipeline.

    python -m pipeline ingesta --desde 2010
    python -m pipeline calcular --monto 800000 --desde 2015-01
    python -m pipeline resumen
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import sys

from dotenv import load_dotenv

from pipeline import db, fuente, ipc, normalizar, uf


def _configurar_log(verboso: bool) -> None:
    logging.basicConfig(
        level=logging.INFO if verboso else logging.WARNING,
        format="%(levelname)s %(message)s",
    )


def _mes(texto: str) -> dt.date:
    """Acepta AAAA-MM o AAAA-MM-DD."""
    for formato in ("%Y-%m", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"fecha inválida: {texto!r} (usa AAAA-MM)")


def comando_ingesta(args: argparse.Namespace) -> int:
    engine = db.motor()
    db.crear_esquema(engine)

    hasta = args.hasta or dt.date.today().year
    elegidos = args.indicadores or list(fuente.INDICADORES)
    total = 0

    for indicador in elegidos:
        crudo = fuente.traer_rango(indicador, args.desde, hasta)
        marco = normalizar.a_dataframe(indicador, crudo)
        escritos = db.guardar(engine, marco)
        total += escritos
        print(f"  {indicador:18s} {escritos:6d} registros")

    print(f"\n{total} registros escritos (insertados o actualizados).")
    return 0


def comando_resumen(args: argparse.Namespace) -> int:
    engine = db.motor()
    tabla = db.resumen(engine)

    if tabla.empty:
        print("La tabla está vacía. Corre primero: python -m pipeline ingesta")
        return 1

    print(tabla.to_string(index=False))
    return 0


def comando_calcular(args: argparse.Namespace) -> int:
    """Calcula sin tocar la base: descarga, transforma y responde.

    Sirve para verificar el pipeline antes de tener Neon configurado.
    """
    anio_inicial = min(args.desde.year, 2010)
    hoy = dt.date.today()

    serie_uf = uf.serie_mensual(
        normalizar.a_dataframe("uf", fuente.traer_rango("uf", anio_inicial, hoy.year))
    )
    hasta = args.hasta or uf.ultimo_periodo_publicado(serie_uf, hoy).to_timestamp().date()

    valor = uf.convertir(serie_uf, args.monto, args.desde, hasta)
    perdida = uf.perdida_poder_adquisitivo(serie_uf, args.desde, hasta)

    print(f"\n  ${args.monto:,.0f} de {args.desde:%Y-%m}")
    print(f"  equivalen a ${valor:,.0f} en {hasta:%Y-%m}")
    print(f"  poder de compra perdido: {perdida:.1f}%\n")

    # Contraste con el IPC encadenado, cuando la serie lo cubre.
    try:
        marco_ipc = normalizar.a_dataframe(
            "ipc", fuente.traer_rango("ipc", anio_inicial, hoy.year)
        )
        indice = ipc.construir_indice(marco_ipc)
        por_ipc = ipc.convertir(indice, args.monto, args.desde, hasta)
        print(f"  (vía IPC encadenado: ${por_ipc:,.0f}, "
              f"{abs(por_ipc - valor) / valor * 100:.2f}% de diferencia)\n")
    except (ipc.SerieIncompleta, fuente.ErrorFuente) as error:
        print(f"  (sin contraste con IPC: {error})\n")

    return 0


def main(argv: list[str] | None = None) -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(prog="pipeline", description=__doc__)
    parser.add_argument("-v", "--verboso", action="store_true")
    sub = parser.add_subparsers(dest="comando", required=True)

    p_ingesta = sub.add_parser("ingesta", help="descarga y guarda en la base")
    p_ingesta.add_argument("--desde", type=int, default=2010, help="año inicial")
    p_ingesta.add_argument("--hasta", type=int, default=None, help="año final")
    p_ingesta.add_argument("--indicadores", nargs="*", choices=fuente.INDICADORES)
    p_ingesta.set_defaults(func=comando_ingesta)

    p_resumen = sub.add_parser("resumen", help="qué hay guardado en la base")
    p_resumen.set_defaults(func=comando_resumen)

    p_calc = sub.add_parser("calcular", help="poder adquisitivo, sin usar la base")
    p_calc.add_argument("--monto", type=float, required=True)
    p_calc.add_argument("--desde", type=_mes, required=True, help="AAAA-MM")
    p_calc.add_argument("--hasta", type=_mes, default=None, help="AAAA-MM")
    p_calc.set_defaults(func=comando_calcular)

    args = parser.parse_args(argv)
    _configurar_log(args.verboso)

    try:
        return args.func(args)
    except (db.SinConexion, fuente.ErrorFuente, ipc.SerieIncompleta, uf.FueraDeRango) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
