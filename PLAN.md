# Plan de trabajo: Reajuste

Calculadora de poder adquisitivo con indicadores economicos chilenos.
Responde "tu sueldo de 2015, cuanto vale hoy".

Objetivo: un proyecto en vivo, con codigo publico, tests y CI, que no cueste
nada mantener.

Convenciones de este documento:

* `[C]` lo hace Claude, `[N]` lo haces tu.
* Los tiempos son estimaciones para las tareas tuyas.

---

## Fase 0. Preparacion

* [x] `[C]` Crear estructura de carpetas y repo local
* [x] `[C]` Verificar que mindicador.cl responde y con que forma vienen los datos
* [x] `[C]` Definir el nombre del proyecto: Reajuste
* [ ] `[N]` Crear el proyecto en Neon y copiar el connection string (10 min)
  * Project name: `reajuste`
  * Region: AWS US East 1 (N. Virginia) si esta disponible; Vercel corre sus
    funciones ahi por defecto y quien habla con la base es la API, no el visitante
  * Services: solo Postgres. Object storage, Functions, AI gateway y Neon Auth apagados
* [ ] `[N]` Crear el repo en GitHub y hacer el primer push (5 min)

---

## Fase 1. Pipeline de datos en Python `[C]` TERMINADA

El corazon del proyecto. 36 tests en verde, validado contra datos reales.

* [x] Configuracion del paquete: `pyproject.toml`, dependencias, `.gitignore`
* [x] `fuente.py`, cliente de mindicador.cl
  * [x] Descarga por indicador y año
  * [x] Reintentos con espera creciente. Sirvieron: la fuente dio timeout en la
        primera corrida real y el reintento la salvo
  * [x] Timeouts explicitos
* [x] `normalizar.py`, JSON crudo a tabla ordenada
  * [x] Fechas convertidas a horario de Santiago antes de tomar el dia
  * [x] Descartar duplicados y valores no numericos, y ordenar
  * [x] `mensual()` para alinear series diarias con mensuales
* [x] `ipc.py`, encadenamiento del IPC
  * [x] Encadenar multiplicando: `indice[m] = indice[m-1] * (1 + var[m]/100)`
  * [x] Detectar meses faltantes y fallar fuerte en vez de inventar datos
  * [x] Conversion entre dos fechas, en ambos sentidos
  * [x] `perdida_poder_adquisitivo()`, distinta de la variacion acumulada
* [x] `uf.py`, deflactor alternativo. No estaba en el plan original, ver hallazgos
* [x] `tests/`, 36 tests que corren sin red ni base de datos
* [x] `db.py`, esquema y upsert idempotente por `(indicador, fecha)`
* [x] `__main__.py`, CLI con `ingesta`, `resumen` y `calcular`

Pendiente: `db.py` esta escrito pero **no probado contra una base real**, porque
todavia no habia connection string. Es lo primero a verificar en la Fase 2.

---

## Hallazgos de la Fase 1

Cosas que aparecieron al trabajar con los datos de verdad y que cambian el diseño.

**1. La fuente no publica IPC del año en curso.** La serie de IPC llega hasta
diciembre del año pasado; la UF, en cambio, tiene datos al dia. Una calculadora
que responde "cuanto vale hoy" no puede quedarse ocho meses atras.

La solucion resulto mejor que el plan original: la UF ya es un indice de precios
encadenado por el Banco Central, porque se reajusta a diario segun el IPC del mes
anterior. Por eso los arriendos y creditos en Chile estan en UF. Queda como
deflactor principal y el IPC encadenado pasa a ser el contraste.

**2. Los dos metodos coinciden en 0,10%.** Calcular con la UF (diaria, fuente
independiente) y con el IPC encadenado da practicamente el mismo numero. Es una
validacion cruzada del encadenamiento: si estuviera mal, no calzarian.

**3. La UF se publica hacia el futuro.** Se calcula del dia 10 de un mes al 9 del
siguiente, asi que la serie contiene fechas posteriores a hoy. Tomar `max(fecha)`
como "hoy" daria un mes que aun no termina. Por eso existe
`ultimo_periodo_publicado()`.

Los tres puntos van al README. Son el tipo de detalle que distingue a alguien que
trabajo los datos de alguien que solo los grafico.

---

## Fase 2. Base de datos `[N]`

* [ ] Poner el connection string de Neon en `.env` (15 min)
* [ ] Correr la carga inicial: `python -m pipeline ingesta --desde 2010` (10 min)
* [ ] Verificar la idempotencia: correr la ingesta dos veces y confirmar con
      `python -m pipeline resumen` que no se duplico nada (5 min)

---

## Fase 3. Automatizacion `[N]` (1 a 2 horas)

* [ ] Workflow que corre los tests en cada push
* [ ] Workflow de ingesta diaria con `schedule`, gratis en repos publicos
* [ ] Guardar el connection string como secret del repo
* [ ] Confirmar al dia siguiente que el cron corrio solo

---

## Fase 4. API en Next.js `[N]` (1 a 2 dias)

* [ ] Proyecto Next.js con TypeScript y Tailwind
* [ ] `GET /api/series/[indicador]`, serie historica con rango de fechas
* [ ] `GET /api/convertir`, el calculo: monto, fecha origen, fecha destino
* [ ] Devolver el resultado en pesos, UF, UTM y dolares. Esa comparacion es la
      parte interesante del producto
* [ ] Tests de los endpoints
* [ ] Manejo de errores: fechas fuera de rango, montos invalidos

---

## Fase 5. Interfaz `[N]` (2 a 3 dias)

* [ ] Calculadora: monto, fecha origen, fecha destino
* [ ] Resultado destacado, con la perdida de poder adquisitivo en porcentaje
* [ ] Comparacion en las cuatro varas de medida
* [ ] Grafico de la serie entre ambas fechas
* [ ] Estados de carga y de error
* [ ] Responsive
* [ ] Un ejemplo precargado, para que se entienda sin escribir nada

---

## Fase 6. Cierre `[N]` (medio dia)

* [ ] README: que es, capturas, como correrlo, y por que las decisiones tecnicas
  * [ ] Explicar el encadenamiento del IPC, que es lo que te diferencia
  * [ ] Explicar la idempotencia de la ingesta
* [ ] Deploy a Vercel
* [ ] Descripcion y topics en el repo de GitHub
* [ ] Agregar el proyecto a `profile.ts` del portafolio
* [ ] Revisar que el CI este verde

---

## Que se esta demostrando

Vale tenerlo presente al escribir el README, porque es lo que un entrevistador busca.

| Decision | Que señala |
| --- | --- |
| Ingesta idempotente con upsert | Sabes que los pipelines se re-ejecutan |
| Encadenamiento del IPC con tests | Entiendes el dominio, no solo graficas |
| Fallar ante meses faltantes | Prefieres un error visible a un numero falso y silencioso |
| Reintentos contra la fuente | Asumes que los servicios externos fallan |
| Normalizar el horario de verano | Atencion al detalle donde de verdad importa |
| Cron en Actions | Automatizas en vez de correr scripts a mano |

---

## Fuera de alcance, a proposito

Para que el proyecto termine en dos semanas y no en dos meses.

* Autenticacion de usuarios. No hay nada que proteger
* Datos regionales de datos.gob.cl. La mitad son PDFs, es un pozo de tiempo
* App movil
* Predicciones o proyecciones. Entra en terreno de dar consejo financiero
