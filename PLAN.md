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
* [x] `[N]` Crear el proyecto en Neon y copiar el connection string
* [x] `[C]` Crear el repo en GitHub: https://github.com/Nicolas-Nav/reajuste

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

## Fase 2. Base de datos `[C]` TERMINADA

* [x] Connection string de Neon en `.env`, que esta en `.gitignore`
* [x] `db.py` normaliza la URL: Neon entrega `postgresql://`, que SQLAlchemy
      interpreta como psycopg2, y usamos psycopg 3
* [x] Carga inicial: 33.497 registros, 12 indicadores desde 2010
* [x] Idempotencia verificada: segunda ingesta completa, conteos identicos

Pendiente tuyo: **rotar la contraseña de Neon**, porque quedo escrita en el chat.
Boton "Reset password" en el dialogo de conexion. Despues hay que actualizarla en
dos lugares: el `.env` local y el secret del repo, con
`gh secret set DATABASE_URL --repo Nicolas-Nav/reajuste`.

---

## Fase 3. Automatizacion `[C]` TERMINADA

* [x] Workflow de tests en cada push, verde
* [x] Workflow de ingesta diaria con `schedule` a las 13:00 UTC
* [x] Connection string guardado como secret del repo
* [x] Ingesta disparada a mano y verificada de punta a punta: escribio 1.246
      registros del año en curso y los totales quedaron identicos, o sea la
      idempotencia tambien funciona desde CI
* [ ] `[N]` Confirmar mañana que el cron corrio solo, sin dispararlo

El cron trae solo el año en curso, unas 12 peticiones en vez de 200. La carga
historica fue una vez y el upsert se encarga del resto.

Dos cosas que conviene saber de los cron en Actions: las corridas programadas se
pueden atrasar bastante en horarios de alta demanda, y GitHub **desactiva el
schedule si el repo pasa 60 dias sin actividad**. Si el proyecto queda quieto y
un dia los datos dejan de actualizarse, es por eso.

---

## Fase 4. API en Next.js `[C]` TERMINADA

* [x] Proyecto Next.js 16 con TypeScript y Tailwind, en `web/`
* [x] `GET /api/series/[indicador]`, serie historica con rango de fechas
* [x] `GET /api/convertir`, el calculo completo
* [x] Resultado en pesos, UF, UTM y dolares en ambas fechas
* [x] Contraste automatico entre el deflactor UF y el IPC encadenado
* [x] 22 tests del calculo, sin red ni base de datos
* [x] Manejo de errores con codigos correctos: 400 parametros invalidos,
      404 indicador inexistente, 422 fecha fuera de rango, 503 sin configurar
* [x] Los tests del web se suman al CI, junto con el build

El encadenamiento del IPC **no se reimplemento en TypeScript**. El pipeline lo
calcula en Python y lo guarda como la serie `ipc_indice`; la API la lee ya lista.
Duplicar esa logica en dos lenguajes es la forma mas segura de que un dia dejen
de coincidir sin que nadie se entere.

Verificacion cruzada: la API responde $1.331.548 para $800.000 de 2015-01, el
mismo numero exacto que la CLI en Python. Y con destino dentro de la serie de
IPC, los dos deflactores difieren en 0,097%.

Pendiente tuyo para el deploy: en Vercel hay que configurar **Root Directory =
`web`** y agregar `DATABASE_URL` como variable de entorno.

---

## Fase 5. Interfaz `[C]` TERMINADA

* [x] Calculadora: monto, fecha origen, fecha destino
* [x] Resultado destacado, con la perdida de poder adquisitivo en porcentaje
* [x] Comparacion en pesos, UF, UTM y dolares en ambas fechas
* [x] Grafico de la UF en el periodo, en SVG propio sin libreria
* [x] Estados de carga y de error, en español y con `role="alert"`
* [x] Responsive, verificado a 1600 px y a 375 px sin scroll horizontal
* [x] Ejemplo precargado que se calcula solo al entrar
* [x] Formato chileno: punto para miles, coma para decimales

Dos cosas que aparecieron al probar en el navegador y no se veian en el codigo:

**El formulario no se enviaba.** El input del monto tenia `min="1"` con
`step="1000"`, combinacion que solo acepta 1, 1001, 2001... El navegador
bloqueaba el envio en silencio con cualquier monto redondo. Se corrigio a
`step="1"` y ademas se puso `noValidate` en el formulario, para que la
validacion sea siempre la nuestra, en español y visible en la pagina.

**Las columnas del formulario se aplastaban.** Los input de tipo `month` traen
un ancho minimo intrinseco grande y las columnas `fr` no los dejan encoger.
Se resolvio con `minmax(0, ...)`.

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
