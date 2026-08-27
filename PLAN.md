# Plan — Plata Real

Calculadora de poder adquisitivo con indicadores económicos chilenos.

> **Nombre provisional.** Si lo cambias, hazlo ahora y no después: aparece en el
> nombre del repo, en la URL de Vercel y en el `pyproject.toml`.

**Objetivo:** un proyecto en vivo, con código público, tests y CI, que responda
*"tu sueldo de 2015, ¿cuánto vale hoy?"* — y que no cueste ni un peso mantener.

**Leyenda:** 🤖 lo hace Claude · 👤 lo haces tú · ⏱️ estimación

---

## Fase 0 — Preparación

- [x] 🤖 Crear estructura de carpetas y repo local
- [x] 🤖 Verificar que `mindicador.cl` responde y con qué forma vienen los datos
- [ ] 👤 Decidir el nombre definitivo del proyecto ⏱️ 5 min
- [ ] 👤 Crear cuenta en [Neon](https://neon.tech) y copiar el connection string ⏱️ 10 min
- [ ] 👤 Crear el repo en GitHub y hacer el primer push ⏱️ 5 min

---

## Fase 1 — Pipeline de datos (Python) 🤖 ✅

El corazón del proyecto. **36 tests en verde, validado contra datos reales.**

- [x] Configuración del paquete (`pyproject.toml`, dependencias, `.gitignore`)
- [x] `fuente.py` — cliente de mindicador.cl
  - [x] Descarga por indicador y año
  - [x] Reintentos con espera incremental — *y sirvieron: la fuente dio timeout
        en la primera corrida real y el reintento la salvó*
  - [x] Timeouts explícitos
- [x] `normalizar.py` — JSON crudo → tabla ordenada
  - [x] Fechas convertidas a horario de Santiago antes de tomar el día
  - [x] Descartar duplicados, valores no numéricos, y ordenar
  - [x] `mensual()` para alinear series diarias con mensuales
- [x] `ipc.py` — encadenamiento del IPC
  - [x] Encadenar multiplicando: `indice[m] = indice[m-1] * (1 + var[m]/100)`
  - [x] Detectar meses faltantes y **fallar fuerte** en vez de inventar datos
  - [x] Conversión entre dos fechas, en ambos sentidos
  - [x] `perdida_poder_adquisitivo()` — distinta de la variación acumulada
- [x] `uf.py` — deflactor alternativo *(no estaba en el plan original, ver hallazgos)*
- [x] `tests/` — 36 tests, sin red ni base de datos
- [x] `db.py` — esquema y **upsert idempotente** por `(indicador, fecha)`
- [x] `__main__.py` — CLI con `ingesta`, `resumen` y `calcular`

> ⚠️ `db.py` está escrito pero **no probado contra una base real** — no había
> connection string todavía. Es lo primero a verificar en la Fase 2.

---

## Hallazgos de la Fase 1

Cosas que aparecieron al trabajar con los datos de verdad y que cambian el diseño.

**1. La fuente no publica IPC del año en curso.** La serie de IPC llega hasta
diciembre del año pasado; la UF, en cambio, tiene datos al día. Una calculadora
que responde "cuánto vale hoy" no puede quedarse ocho meses atrás.

**La solución resultó mejor que el plan original:** la UF *es* un índice de
precios ya encadenado por el Banco Central — se reajusta a diario según el IPC
del mes anterior, y por eso los arriendos y créditos en Chile están en UF. Se
usa como deflactor principal y el IPC encadenado queda como contraste.

**2. Los dos métodos coinciden en 0,10%.** Calcular con la UF (diaria, fuente
independiente) y con el IPC encadenado da prácticamente el mismo número. Es una
validación cruzada del encadenamiento: si estuviera mal, no calzarían.

**3. La UF se publica hacia el futuro.** Se calcula del día 10 de un mes al 9
del siguiente, así que la serie contiene fechas posteriores a hoy. Tomar
`max(fecha)` como "hoy" daría un mes que aún no termina — por eso existe
`ultimo_periodo_publicado()`.

**Los tres puntos van al README:** son exactamente el tipo de detalle que
distingue a alguien que trabajó los datos de alguien que solo los graficó.

---

## Fase 2 — Base de datos 👤

- [ ] Conectar el pipeline a Neon con el connection string ⏱️ 15 min
- [ ] Correr la carga inicial 2010 → hoy ⏱️ 10 min
- [ ] Verificar: correr la ingesta dos veces y confirmar que no se duplica nada ⏱️ 5 min

---

## Fase 3 — Automatización 👤 ⏱️ 1-2 h

- [ ] Workflow de tests en cada push
- [ ] Workflow de ingesta diaria con `schedule` (cron) — gratis en repos públicos
- [ ] Guardar el connection string como secret del repo
- [ ] Confirmar que el cron corrió solo al día siguiente

---

## Fase 4 — API (Next.js) 👤 ⏱️ 1-2 días

- [ ] Proyecto Next.js con TypeScript y Tailwind
- [ ] `GET /api/series/[indicador]` — serie histórica con rango de fechas
- [ ] `GET /api/convertir` — el cálculo: monto, fecha origen, fecha destino
- [ ] Devolver el resultado en **pesos, UF, UTM y dólares** (la parte interesante)
- [ ] Tests de los endpoints
- [ ] Manejo de errores: fechas fuera de rango, montos inválidos

---

## Fase 5 — Interfaz 👤 ⏱️ 2-3 días

- [ ] Calculadora: monto + fecha origen + fecha destino
- [ ] Resultado destacado, con la pérdida de poder adquisitivo en porcentaje
- [ ] Comparación en las cuatro varas de medida
- [ ] Gráfico de la serie entre ambas fechas
- [ ] Estados de carga y de error
- [ ] Responsive
- [ ] Un ejemplo precargado, para que se entienda sin escribir nada

---

## Fase 6 — Cierre 👤 ⏱️ medio día

- [ ] README: qué es, capturas, cómo correrlo, y **por qué** las decisiones técnicas
  - [ ] Explicar el encadenamiento del IPC — es lo que te diferencia
  - [ ] Explicar la idempotencia de la ingesta
- [ ] Deploy a Vercel
- [ ] Descripción y topics en el repo de GitHub
- [ ] Agregar el proyecto a `profile.ts` del portafolio
- [ ] Revisar que el CI esté verde

---

## Lo que se está demostrando

Vale tenerlo presente al escribir el README, porque es lo que un entrevistador busca:

| Decisión | Qué señala |
|---|---|
| Ingesta idempotente con upsert | Sabes que los pipelines se re-ejecutan |
| Encadenamiento del IPC con tests | Entiendes el dominio, no solo graficas |
| Fallar ante meses faltantes | Prefieres un error visible a un número silencioso y falso |
| Reintentos contra la fuente | Asumes que los servicios externos fallan |
| Normalizar el horario de verano | Atención al detalle donde de verdad importa |
| Cron en Actions | Automatizas en vez de correr scripts a mano |

---

## Fuera de alcance (a propósito)

Para que el proyecto termine en dos semanas y no en dos meses:

- Autenticación de usuarios — no hay nada que proteger
- Datos regionales de `datos.gob.cl` — la mitad son PDFs, es un pozo de tiempo
- App móvil
- Predicciones o proyecciones — entra en terreno de dar consejo financiero
