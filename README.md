# Reajuste

Calculadora de poder adquisitivo con indicadores economicos chilenos.
Responde cuanto vale hoy una cantidad de dinero de otra epoca.

```
$800.000 de 2015-01
equivalen a $1.331.548 en 2026-08
poder de compra perdido: 39.9%
```

> En construccion. El pipeline de datos esta terminado y probado; la API y la
> interfaz web vienen en camino. El avance por fases esta en [PLAN.md](PLAN.md).

**Python + pandas + PostgreSQL.** Datos de [mindicador.cl](https://mindicador.cl),
sin API key.

---

## Como funciona

Un pipeline en Python descarga las series de 12 indicadores (UF, IPC, dolar,
UTM, IMACEC, TPM, tasa de desempleo y otros), las normaliza y las guarda en
PostgreSQL. Un cron diario en GitHub Actions mantiene los datos al dia.

```bash
pip install -e ".[dev]"
cp .env.example .env          # y pon ahi tu connection string

python -m pipeline ingesta --desde 2010
python -m pipeline resumen
python -m pipeline calcular --monto 800000 --desde 2015-01
```

El comando `calcular` no toca la base: descarga, transforma y responde, asi que
sirve para probar el pipeline sin configurar PostgreSQL.

---

## Decisiones tecnicas

Lo interesante de este proyecto no son los graficos, es lo que hay que resolver
para que los numeros sean correctos.

### El IPC no es un indice, son variaciones mensuales

La fuente entrega el IPC como el porcentaje que variaron los precios en cada
mes: `-0.2`, `0.2`, `1.0`. Para comparar dos fechas cualesquiera hay que
**encadenar** esas variaciones multiplicando, no sumando:

```
+1% en enero y +1% en febrero  =  +2,01%   (no +2%)
```

Sumarlas es el error clasico, y el desvio crece mientras mas largo es el
periodo. Doce meses de +1% dan 12,68% acumulado, no 12%.

### Un mes faltante levanta excepcion

Si falta un mes en la serie, el pipeline falla en vez de rellenar el hueco. Un
mes ausente tratado como 0% produce un numero que se ve razonable y es falso, y
nadie lo nota nunca.

### La UF es el deflactor principal, el IPC es el contraste

La fuente no publica IPC del año en curso. Una calculadora que responde "cuanto
vale hoy" no puede quedarse ocho meses atras.

La UF resuelve el problema y ademas es el deflactor natural en Chile: se
reajusta a diario segun el IPC del mes anterior, o sea **ya es un indice de
precios encadenado por el Banco Central**. Por eso los arriendos y los creditos
hipotecarios estan en UF.

Calcular por ambos caminos da el mismo resultado con 0,10% de diferencia. Como
son fuentes independientes, ese contraste valida el encadenamiento del IPC.

### La UF se publica hacia el futuro

Se calcula del dia 10 de un mes al 9 del siguiente, asi que la serie contiene
fechas posteriores a hoy. Tomar `max(fecha)` como "hoy" daria un mes que todavia
no termina.

### Las fechas cambian de offset dos veces al año

La fuente entrega instantes UTC que corresponden a la medianoche de Chile:

```
2024-12-01T03:00:00.000Z   ->  1 de diciembre, horario de verano (UTC-3)
2024-09-01T04:00:00.000Z   ->  1 de septiembre, horario de invierno (UTC-4)
```

Hay que convertir a horario de Santiago antes de quedarse con la fecha, no
asumir el offset.

### La ingesta es idempotente

Corre todos los dias y vuelve a bajar meses ya guardados. La clave primaria es
`(indicador, fecha)` y cada registro se inserta o se actualiza, nunca se
duplica. Correrla diez veces deja la tabla igual que correrla una.

Verificado con la carga real: 33.497 registros, y una segunda ingesta completa
deja los conteos identicos.

### La fuente puede fallar

mindicador.cl es un servicio gratuito y sin SLA, asi que el cliente tiene
timeouts explicitos y reintentos con espera creciente. No es precaucion
teorica: dio timeout en la primera corrida real y el reintento la salvo.

---

## Estructura

```
pipeline/
  fuente.py       cliente de mindicador.cl, con reintentos
  normalizar.py   JSON crudo a tabla ordenada, con foco en las fechas
  ipc.py          encadenamiento del IPC y conversion entre fechas
  uf.py           deflactor basado en UF
  db.py           esquema y escritura idempotente
  __main__.py     CLI: ingesta, resumen, calcular
tests/            36 tests, sin red ni base de datos
```

Los tests corren sin salir a internet y sin PostgreSQL, asi que el CI tarda
segundos y no se cae si la fuente esta abajo.

---

## Licencia

MIT.
