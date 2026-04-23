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
| `database/n8n-workflows/22-presupuestos.json` | **Nuevo** — GET + POST con las 7 acciones. |
| `presupuestos.html` | **Nuevo** — página completa (tabla + filtros + modal + totales). |
| `sidebar.js` | Añadido icono `producto` + `presupuestos`, grupo `Producto`. |
| `config.js` | Añadido endpoint `presupuestos` y permiso en `PERMISOS_DISPONIBLES`. |
| `scripts/test-e2e-presupuestos.sh` | **Nuevo** — E2E con ~30 asertos. |

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
