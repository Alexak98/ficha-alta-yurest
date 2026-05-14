# Módulo Presupuestos — diseño y QA

Nuevo módulo greenfield para el departamento **Producto**. Reemplaza el Excel
que el equipo usaba para trackear qué desarrollos a medida solicita cada
cliente, quién los paga (Yurest o el cliente), y en qué estado de aprobación
y entrega están.

A diferencia de los módulos anteriores (hardware, promociones), este no
parte de código heredado con bugs: se diseña desde cero aplicando **ya de
entrada** todos los fixes que hemos tenido que aplicar a los otros módulos
durante sus QA profundos.

Fecha inicial: **2026-04-23**.

---

## Modelo de datos

Tabla `presupuestos` (migración `2026-04-23_03_presupuestos.sql`):

| columna          | tipo / check                                       | semántica |
| ---              | ---                                                | --- |
| `id`             | UUID PK, default `gen_random_uuid()`               | — |
| `cliente`        | TEXT NOT NULL                                      | Organización solicitante. Texto libre (no FK: en el Excel aparecen nombres que no siempre coinciden con `clientes.html`). |
| `entorno`        | TEXT CHECK IN (`backoffice`, `app_cliente`)        | Dónde vive el desarrollo. |
| `desarrollo`     | TEXT NOT NULL                                      | Título / descripción breve. |
| `enviado`        | BOOL default FALSE                                 | ¿Se ha comunicado el presupuesto al cliente? |
| `quien_abona`    | TEXT CHECK IN (`yurest`, `cliente`)                | Quién paga las horas. |
| `estado`         | TEXT CHECK IN (`aceptado`, `en_espera`)            | Aprobación del cliente. |
| `horas_yurest`   | INT `0..10000`                                     | Horas a cargo de Yurest. |
| `coste_yurest`   | NUMERIC(10,2) `>= 0`                               | Importe que asume Yurest (típico: horas·85€). |
| `horas_cliente`  | INT `0..10000`                                     | Horas a cargo del cliente. |
| `coste_cliente`  | NUMERIC(10,2) `>= 0`                               | Importe que factura al cliente. |
| `estado_entrega` | TEXT CHECK IN (`pendiente`, `en_progreso`, `entregado`) | Ciclo de entrega del desarrollo. |
| `notas`          | TEXT                                               | Comentarios libres. |
| `deleted_at`     | TIMESTAMPTZ                                        | Soft-delete. |
| `created_at`, `updated_at`, `created_by` | | Metadatos. |

Índices parciales `WHERE deleted_at IS NULL` sobre `cliente`, `estado`,
`estado_entrega`.

**RLS.** Dos policies desde el principio, aprendido de los QA de
hardware/promociones:

- `service_role_all` — para integraciones backend.
- `anon_write_presupuestos` — el workflow n8n usa la clave anon vía la
  credencial `supabaseApi` (misma que el resto); sin esta policy el
  `INSERT/PATCH` se bloquearía en silencio.

La lectura pública no queda expuesta porque el webhook exige **BasicAuth**.

---

## Workflow n8n `22-presupuestos`

Mismo patrón canónico post-QA que `21-hardware-pedidos` y `20-promociones`:

**GET** `/webhook/presupuestos` (BasicAuth)
  → Supabase `getAll` de la tabla
  → Code `Formatear GET`:
    - filtra `deleted_at IS NULL`
    - acepta query-string `?cliente=&estado=&estado_entrega=&entorno=&quien_abona=`
    - computa `totales` agregado (horas/coste sumadas)
    - ordena aceptados primero, luego por `created_at` desc
  → `Respond to Webhook`

**POST** `/webhook/presupuestos` (BasicAuth)
  → Code `Preparar` (valida action + campos, genera UUID, monta `__method`/`__qs`)
  → `httpRequest` → `POST/PATCH /rest/v1/presupuestos` (PostgREST directo, **no** nodo Supabase: ese falla en silencio cuando `operation=upsert` con ciertos shapes)
  → Code `Formatear respuesta` (shape `{success, presupuesto, errores}`)
  → `Respond to Webhook`

Acciones soportadas (`action` en el body):

| action            | efecto |
| ---               | --- |
| `create`          | Inserta nuevo presupuesto. UUID generado en el Code node. |
| `update`          | PATCH por id con los campos presentes. |
| `archivar`        | Soft-delete: `deleted_at = now()`. |
| `reactivar`       | Revierte soft-delete: `deleted_at = null`. |
| `marcar_enviado`  | Atajo: toggle del flag `enviado`. |
| `aceptar`         | Atajo: `estado = 'aceptado'`. |
| `entregar`        | Atajo: `estado_entrega = 'entregado'`. |

**No existe `delete`.** Igual que en promociones/hardware post-QA, el
hard-delete no se expone al webhook — el archivado reversible cubre todos
los casos de uso reales sin exponer un vector destructivo.

### Decisiones de diseño heredadas de QA anteriores

- **BasicAuth obligatoria en ambos webhooks** desde el día 1 — credencial
  `Yurest Portal Auth`, la misma que usa el resto del portal.
- **httpRequest a PostgREST en lugar del nodo Supabase UPSERT.** El nodo
  v1 con `operation=upsert + dataToSend=autoMapInputData` devuelve 0 filas
  sin error en ciertos shapes. Ya nos mordió en hardware y promociones.
- **Validación estricta en el Code `Preparar`**: UUID regex, ranges numéricos,
  enums contra los CHECKs de la BD, mensajes claros.
- **Sin `_trace` en la respuesta.** Sólo el shape contractual.
- **Filtros GET leen de `$('Webhook GET Presupuestos').first().json.query`**
  (referencia explícita al nodo webhook — el patrón que funciona en esta
  versión de n8n).

---

## Frontend (`presupuestos.html`)

Tema **indigo** (`#6366f1`) para diferenciar del rosa de promociones y el
azul de los demás módulos.

- **Tabla** con chips de colores para cada enum (estado, entrega,
  quien_abona, enviado).
- **Filtros**: búsqueda por cliente/desarrollo, select de entorno, abona,
  estado, entrega, toggle "mostrar archivadas".
- **Ticker de totales** (mostrados / horas / €) que recalcula sobre los
  registros filtrados.
- **Modal CRUD** con form-row-3 (tres columnas), auto-cálculo del coste a
  **85 €/h** (tarifa por defecto extraída del Excel de referencia). Si el
  usuario edita el coste a mano, se marca `dataset.manual='1'` y el
  auto-fill deja de sobrescribir.
- **Acciones por fila**:
  - Editar (abre modal).
  - Aceptar (si está en espera).
  - Entregar (si aceptado y entrega no entregado).
  - Toggle `enviado`.
  - Archivar.
  - Si está archivado: un único botón `♻️ Reactivar`.
- **Badge** en sidebar: cuenta `estado = aceptado && estado_entrega != entregado`
  (lo que Producto tiene pendiente de entregar).

### Sidebar

Nuevo grupo **Producto** con icono bombilla (ideas/desarrollo), colocado
entre Customer Success y Soporte. El item `Presupuestos` lleva
`badgeId: 'badge-presupuestos'`.

### Permisos

`config.js::PERMISOS_DISPONIBLES` incluye
`{ id: 'presupuestos', label: 'Presupuestos', grupo: 'Producto' }`.
La tabla `usuarios` guarda permisos en `JSONB` sin CHECK, así que no hace
falta migración para exponer el permiso — el admin lo asigna desde
`admin.html` como cualquier otro.

---

## Mapa de ficheros

| Fichero | Estado |
| --- | --- |
| `database/migrations/2026-04-23_03_presupuestos.sql` | **Nuevo** — tabla + RLS + índices. |
| `database/migrations/2026-05-14_01_presupuestos_asana_gid.sql` | **Nuevo** — columna `asana_gid` + UNIQUE parcial. |
| `database/n8n-workflows/22-presupuestos.json` | **Nuevo** — GET + POST con las 7 acciones (+ acepta `asana_gid` en create/update). |
| `database/n8n-workflows/31-presupuestos-asana.json` | **Nuevo** — importador desde Asana (GET sección + POST import/refresh). |
| `presupuestos.html` | **Nuevo** — página completa (tabla + filtros + modal + totales + importador Asana). |
| `sidebar.js` | Añadido icono `producto` + `presupuestos`, grupo `Producto`. |
| `config.js` | Añadido endpoints `presupuestos` y `presupuestosAsana` + permiso en `PERMISOS_DISPONIBLES`. |
| `scripts/test-e2e-presupuestos.sh` | **Nuevo** — E2E con ~30 asertos. |

---

## Importador desde Asana

A petición del equipo, se cablean **cuatro secciones** repartidas
entre dos proyectos de Asana como fuente para crear presupuestos sin
retipear nada de la tarea:

| gid sección          | nombre                       | proyecto       | comentario                                                                                 |
| ---                  | ---                          | ---            | ---                                                                                        |
| `1210961912211323`   | Pendiente de presupuesto     | Back Clientes  | flujo principal del backlog presupuestable de Back.                                        |
| `1204767716226169`   | Pendiente de revisión        | Back Clientes  | el equipo decide caso a caso si presupuestar — entra sólo si pasa el filtro.               |
| `1214118251811646`   | Presupuesto                  | KDS            | flujo principal del backlog presupuestable de KDS (paralelo a la de Back).                 |
| `1204767716226198`   | Pendiente de revisión        | KDS            | mismo rol que la de Back, pero del board de KDS.                                           |

Cada tarea trae en la respuesta del GET `seccion_gid`, `seccion_nombre`
y `proyecto` para que el front pueda filtrar / agrupar si lo necesita.

Sobre la unión de ambas se aplica un **filtro por custom fields** en el
Code `Formatear GET` para que sólo aparezcan tareas realmente
presupuestables:

- `Canal = "Cliente"`        — descarta peticiones internas.
- `Tipo  = "Funcionalidad"`  — descarta errores y otros (los errores se
  arreglan, no se presupuestan).

Las tareas que aparezcan en ambas secciones se dedupican por `gid`.
La respuesta del GET incluye `descartadas: { canal, tipo }` y
`raw_total` por si en el futuro queremos exponer el contador en la UI.

El flujo se dispara desde un botón "Importar de Asana" en la toolbar
de `presupuestos.html`.

### Mapeo Asana → presupuesto

Salvo el ratio (€/h, descuento) y el flujo de aprobación, todo lo demás
se deriva de la tarea de Asana:

| Campo BD                  | Origen en Asana                                                         |
| ---                       | ---                                                                     |
| `asana_gid`               | `task.gid`                                                              |
| `cliente`                 | Tag con prefijo `Cliente: …` (regex). Si no hay tag → `"Sin cliente"`.  |
| `desarrollo`              | `task.name` quitando el prefijo `( Pagado )` / `( Pago )`.              |
| `entorno`                 | Heurística por keywords (`app|móvil|notificación|tpv` → `app_cliente`; default `backoffice`). |
| `quien_abona`             | `( Pagado )` en nombre **o** custom field `Coste = Con coste` → `cliente`; resto `yurest`. |
| `horas_cliente`           | Custom field `Estimated time` (parseo de `"26h 00m"` → `26`).           |
| `coste_hora_yurest/cliente`, `descuento_pct` | Defaults (25 / 85 / 0). El usuario los retoca a mano. |
| `estado`, `estado_entrega`, `enviado` | `en_espera` / `pendiente` / `false` (importación = entrada al pipeline). |
| `contexto`                | Bloque entre `## 🎯 TAREA` y `Comportamiento actual:`.                   |
| `objetivo`                | Línea que empieza por `Para ` dentro del bloque de contexto.            |
| `alcance`                 | Bloque `Comportamiento actual: …`.                                      |
| `funcionamiento_esperado` | Bloque `Comportamiento esperado: …`.                                    |
| `aprobacion`              | Bloque `✅ CRITERIOS DE ACEPTACIÓN …`.                                   |
| `notas`                   | `permalink_url` + `Mail cliente:` (custom field) + traza del gid.       |

### Workflow `31-presupuestos-asana`

Dos endpoints bajo BasicAuth, mismo patrón canónico que el resto:

**GET** `/webhook/presupuestos-asana`
  → `GET https://app.asana.com/api/1.0/sections/1210961912211323/tasks`
    (credencial `asanaApi` ya existente)
  → `GET /rest/v1/presupuestos?asana_gid=not.is.null&deleted_at=is.null`
    (para deduplicar)
  → Code `Formatear GET` une ambos y emite
    `{ tareas: [...], total, nuevas, importadas }`. Cada tarea incluye
    `ya_importado`, `presupuesto_id`, `numero_doc`.

**POST** `/webhook/presupuestos-asana` con `{ action, asana_gid }`:

| action    | efecto                                                                                      |
| ---       | ---                                                                                         |
| `import`  | Fetch task → parseo → INSERT en `presupuestos`. UNIQUE en `asana_gid` bloquea re-imports.   |
| `refresh` | Fetch task → parseo → PATCH `?asana_gid=eq.X` **sólo** de campos derivables (cliente, desarrollo, notas, contexto, objetivo, alcance, funcionamiento_esperado, aprobacion). NO toca estado, horas, costes, ni flags del usuario. |

Tras el upsert se postea siempre un comentario en la tarea de Asana
(`POST /tasks/{gid}/stories`):
`[Yurest Portal] Importado al portal como PRES-XXXX el YYYY-MM-DD`. El
comment es **best-effort** (`continueOnFail`): si Asana rate-limitea o
falla, la importación se considera exitosa y se devuelve un `warning`.

### Decisiones de diseño

- **UNIQUE parcial sobre `asana_gid`** (`WHERE asana_gid IS NOT NULL`).
  Los presupuestos creados a mano (gid NULL) nunca chocan entre sí.
- **Sin merge automático.** Si ya existe presupuesto para una tarea,
  el modal lo marca como "ya importada" y ofrece **Refrescar**
  explícito en lugar de actualizar en silencio. Evita pisar ediciones
  del usuario.
- **Refrescar no toca estado/horas/costes.** El usuario ya ajustó esos
  campos a mano; refrescar sólo trae cambios de descripción/cliente.
- **Comentario en Asana, no cambio de sección ni de custom field.** El
  equipo de Producto pidió mínima intrusión en el board de Asana — basta
  con la traza textual en el thread de la tarea.
- **Heurística de entorno conservadora.** Default `backoffice`; se
  promueve a `app_cliente` solo si aparecen keywords explícitas (`app`,
  `móvil`, `notificación`, `tpv`) y *no* hay mención a `backoffice` en
  las primeras 500 chars. Pulir caso a caso si genera falsos positivos.
- **Importación masiva secuencial.** El botón "Importar todas las
  nuevas" itera una por una. Paralelizar dispararía rate-limits de
  Asana y desordenaría los comments en cada tarea.

---

## Cobertura E2E (test-e2e-presupuestos.sh)

| Grupo | Asertos | Cubre |
| --- | --- | --- |
| auth | GET sin auth → 401; POST sin auth → 401; GET con auth → 200 | BasicAuth |
| crud | create happy; listado total ≥1; filtros por cliente/estado/entorno | GET/POST PostgREST |
| validacion | create sin cliente/desarrollo; action desconocida; UUID malformado; enum fuera de rango; horas > 10000; coste negativo; delete no existe | Validaciones `Preparar` + CHECKs BD |
| flujo | create → update → marcar_enviado → aceptar → entregar → archivar → reactivar (round-trip completo) | Todas las acciones |
| filtros | `?incluir_archivadas` toggle; `?estado=aceptado` aísla | Query-string del Code GET |
| totales | el agregado `totales` suma correctamente horas/coste | Code GET |

Ejecución contra entorno de staging tras aplicar SQL + importar el
workflow. `SKIP_CLEANUP=1` conserva los registros creados; por defecto
los archiva al terminar.
