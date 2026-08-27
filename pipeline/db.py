"""Persistencia en PostgreSQL.

La ingesta se va a correr todos los días desde un cron, y va a re-descargar
meses que ya están guardados. Por eso la escritura es **idempotente**: la
clave primaria es `(indicador, fecha)` y cada registro se inserta o se
actualiza, nunca se duplica.

Correr la ingesta diez veces seguidas deja la tabla exactamente igual que
correrla una vez.
"""

from __future__ import annotations

import logging
import os

import pandas as pd
from sqlalchemy import (
    Column, Date, DateTime, Float, MetaData, String, Table, create_engine, func, select,
)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)

metadata = MetaData()

indicadores = Table(
    "indicadores",
    metadata,
    Column("indicador", String(32), primary_key=True),
    Column("fecha", Date, primary_key=True),
    Column("valor", Float, nullable=False),
    Column("actualizado_en", DateTime(timezone=True), server_default=func.now()),
)


class SinConexion(RuntimeError):
    """No hay connection string configurado."""


def motor(url: str | None = None) -> Engine:
    """Crea el engine. Lee DATABASE_URL del entorno si no se pasa una URL."""
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        raise SinConexion(
            "falta DATABASE_URL. Copia .env.example a .env y pon el "
            "connection string de Neon."
        )
    return create_engine(url, pool_pre_ping=True)


def crear_esquema(engine: Engine) -> None:
    """Crea las tablas si no existen."""
    metadata.create_all(engine)


def guardar(engine: Engine, marco: pd.DataFrame) -> int:
    """Inserta o actualiza los registros del DataFrame. Devuelve cuántos escribió.

    Espera columnas `indicador`, `fecha` y `valor`.
    """
    if marco.empty:
        return 0

    filas = marco[["indicador", "fecha", "valor"]].to_dict("records")

    sentencia = insert(indicadores).values(filas)
    sentencia = sentencia.on_conflict_do_update(
        index_elements=["indicador", "fecha"],
        set_={
            "valor": sentencia.excluded.valor,
            "actualizado_en": func.now(),
        },
    )

    with engine.begin() as conexion:
        conexion.execute(sentencia)

    return len(filas)


def leer(engine: Engine, indicador: str) -> pd.DataFrame:
    """Lee una serie completa, ordenada por fecha."""
    consulta = (
        select(indicadores.c.indicador, indicadores.c.fecha, indicadores.c.valor)
        .where(indicadores.c.indicador == indicador)
        .order_by(indicadores.c.fecha)
    )
    with engine.connect() as conexion:
        return pd.DataFrame(conexion.execute(consulta).fetchall(),
                            columns=["indicador", "fecha", "valor"])


def resumen(engine: Engine) -> pd.DataFrame:
    """Cuántos registros y qué rango de fechas hay por indicador."""
    consulta = (
        select(
            indicadores.c.indicador,
            func.count().label("registros"),
            func.min(indicadores.c.fecha).label("desde"),
            func.max(indicadores.c.fecha).label("hasta"),
        )
        .group_by(indicadores.c.indicador)
        .order_by(indicadores.c.indicador)
    )
    with engine.connect() as conexion:
        return pd.DataFrame(
            conexion.execute(consulta).fetchall(),
            columns=["indicador", "registros", "desde", "hasta"],
        )
