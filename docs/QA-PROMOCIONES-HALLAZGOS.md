# QA — Módulo Promociones

Sesión de E2E profundo sobre el módulo Promociones del portal Yurest
(`/promociones.html`, workflow n8n `20-promociones`, tabla `promociones` +
vista `promociones_ocupacion`).

Mirror de la metodología aplicada en [QA-HARDWARE-HALLAZGOS.md](./QA-HARDWARE-HALLAZGOS.md).
Fecha: **2026-04-23**.

Notación:

- **B**_N_ — bloqueante (o al menos severo). Hay que arreglarlo antes de
  declarar el módulo apto.
- **S**_N_ — severo. Rompe un caso de uso pero no el módulo entero.
- **F**_N_ — funcional / de pulido. Mejora observable para el usuario.

---

## Resumen ejecutivo

El módulo compartía **todos** los patrones buggy que ya habíamos detectado
en el módulo Hardware: webhooks sin autenticación, acción `delete` expuesta
al exterior, nodo `Supabase UPSERT` que fallaba en silencio, validación
laxa y filtros GET que nunca llegaban al código. Además heredaba dos
problemas propios:

1. La acción `reactivar` existía en el workflow pero **la UI no tenía cómo
   llamarla** — las promociones archivadas desaparecían de la vista y la
   acción era efectivamente código muerto.
2. El sidebar no mostraba badge con el número de promociones activas (el
   resto de módulos sí).

Tras las correcciones, el ciclo completo queda:
`activa → (cerrar) → cerrada` y en paralelo `archivar ↔ reactivar` como
soft-delete reversible.

---

## Hallazgos

### B1 — Webhooks sin BasicAuth

**Síntoma.** Los dos webhooks (`GET /webhook/promociones` y
`POST /webhook/promociones`) aceptaban cualquier petición, sin
`authentication: basicAuth`. Cualquiera con la URL podía listar, crear o
borrar promociones.

**Causa.** El JSON de n8n no tenía el campo `authentication` ni la sección
`credentials.httpBasicAuth`. El resto de workflows del portal (hardware,
bajas, fichas-alta) sí lo tenían.

**Fix.** Añadidos `"authentication": "basicAuth"` y la credencial
`Yurest Portal Auth` a ambos webhooks. Misma credencial que usa el resto
del portal — el front ya enviaba `Authorization: Basic ...` en `apiFetch`.

---

### B2 — Acción `delete` hard-delete expuesta al webhook

**Síntoma.** El nodo `Preparar` aceptaba `action: 'delete'` y lo
interpretaba como soft-delete (poner `deleted_at = now()`). Era el mismo
antipatrón que habíamos retirado en Hardware: cualquier cliente autenticado
podía archivar cualquier promoción por id sin ningún control adicional.

**Fix.** Retirado `delete`. La nueva acción se llama `archivar` (que
describe mejor lo que hace, soft-delete reversible). Y añadimos `reactivar`
como acción complementaria + `cerrar` como atajo para pasar estado a
`cerrada`. La UI pasa a llamar `archivar` en vez de `delete`.

---

### B3 — Nodo `Supabase UPSERT` v1 fallaba en silencio

**Síntoma.** Mismo bug que en Hardware: el nodo `n8n-nodes-base.supabase`
v1 con `operation=upsert` + `dataToSend=autoMapInputData` devolvía **0
filas sin error** para ciertos shapes (especialmente con `continueOnFail`).
El endpoint aparentaba éxito (status 200) pero nada se persistía y el
frontend veía `{ success: false, errores: ['UPSERT devolvió 0 filas'] }`.

**Fix.** Sustituido por `httpRequest` a PostgREST, exactamente el mismo
patrón que `04-fichas-alta.json` y ya-fijado `21-hardware-pedidos.json`:

- `POST /rest/v1/promociones?on_conflict=id` para `create`.
- `PATCH /rest/v1/promociones?id=eq.<uuid>` para `update`/`archivar`/
  `reactivar`/`cerrar`.
- Headers `Prefer: resolution=merge-duplicates,return=representation`.
- `nodeCredentialType: supabaseApi` (reutiliza la credencial con apiKey +
  service key → la clave anon, que funciona porque añadimos RLS para
  anon — ver B4).

---

### B4 — Faltaba RLS para la clave `anon`

**Síntoma.** La migración `2026-04-21_11_promociones.sql` sólo creaba la
policy `service_role_all`. Como el workflow usa la clave anon (misma que
usa PostgREST por defecto), todos los `INSERT/PATCH` se bloqueaban en
silencio: GET devolvía `[]` y los POST aparentaban éxito sin persistir.
Idéntico caso que tuvimos en `hardware_pedidos`.

**Fix.** Nueva migración `2026-04-23_02_promociones_qa_fixes.sql` que
añade `anon_write_promociones` con `USING (true) WITH CHECK (true)` — la
lectura pública **no** se expone porque el webhook exige BasicAuth
(fix B1). Termina con `NOTIFY pgrst, 'reload schema';` para forzar el
reload del cache.

---

### B5 — `_trace` leak en la respuesta del POST

**Síntoma.** El formatter del POST emitía un campo `_trace` con la
estructura interna del input (`keys`, `json`) — útil para debugging pero
un leak de shape interno al frontend.

**Fix.** Retirado. El formatter ahora devuelve exactamente el shape
`{ success, promocion, errores }` que espera el front.

---

### B6 — Filtros GET no llegaban al Code node

**Síntoma.** El GET del webhook aceptaba query-string `?estado=...` y
`?incluir_archivadas=1` pero el formatter no miraba `query`. Cualquier
filtro se ignoraba. Además la vista `promociones_ocupacion` filtraba
`WHERE deleted_at IS NULL`, así que las archivadas eran **invisibles**
incluso pidiéndolas explícitamente.

**Fix.** Dos partes:

1. El formatter lee `$('Webhook GET Promociones').first().json.query`
   (referencia explícita al nodo webhook — mismo patrón que hardware).
   Aplica `?estado` y `?incluir_archivadas=1`.
2. La migración 2026-04-23_02 recrea la vista SIN el filtro
   `deleted_at IS NULL`. Ahora devuelve también las archivadas y es el
   Code node quien decide si incluirlas.

---

### S1 — UI no exponía filtros

**Síntoma.** El frontend mostraba todas las promociones vivas sin opción
de filtrar por estado ni de ver archivadas. Con varias docenas de
promociones activas la pantalla se volvía inmanejable y no había forma
de acceder a las archivadas (para reactivar, consultar histórico, etc.).

**Fix.** Barra de filtros (`.filters`) con:

- Select `estado` (todos / activas / cerradas).
- Toggle `Mostrar archivadas` (añade `?incluir_archivadas=1` al GET).
- Contador lateral con `N activas · M archivadas`.

---

### S2 — `reactivar` era código muerto

**Síntoma.** El workflow aceptaba `action: 'reactivar'` pero la UI no
tenía ningún botón para llamarlo y la vista filtraba las archivadas, así
que nadie podía ver una promoción borrada para intentar restaurarla.

**Fix.** Con el toggle de "Mostrar archivadas" (S1) las promociones
soft-deleted aparecen con badge ARCHIVADA y un único botón `♻️ Reactivar`
que llama `action: 'reactivar'`. La llamada devuelve `deleted_at=null` y
la promoción vuelve a estar viva.

---

### S3 — Sidebar sin badge de conteo

**Síntoma.** El resto de items del sidebar con flujo pendiente (bajas,
hardware, …) tenían `badgeId`. Promociones no — así que el operador de
Customer Success no tenía indicador rápido de cuántas promociones activas
con plazas libres había en curso.

**Fix.**
- `sidebar.js`: el item promociones recibe `badgeId: 'badge-promociones'`.
- `promociones.html::render()` llama `actualizarBadge(list)` tras cada
  recarga. Cuenta promociones que son `!deleted_at && estado=='activa'
  && !full`.

---

### F1 — Sin tope superior en plazas

**Síntoma.** El CHECK original sólo exigía `plazas_manana >= 0` y
`plazas_tarde >= 0`. Nada impedía crear una promoción con 9999 plazas que
rompería el cálculo de ocupación y saturaría el selector de
`sinasignar.html`.

**Fix.** CHECK amplía a `>= 0 AND <= 100`. En el frontend el `<input
type=number>` sube su `max` de 50 a 100 para coincidir. En el Code node
`Preparar` validamos el rango antes de enviar a Supabase.

---

### F2 — Validación de `update` sin comprobaciones

**Síntoma.** El `Preparar` original no validaba que los campos de
`update` respetaran los CHECKs (estado ∈ {activa, cerrada}, plazas en
rango, nombre no vacío). Cualquier valor pasaba hasta Supabase, que
respondía 400 con un mensaje de error confuso al usuario.

**Fix.** Validaciones explícitas en el `Preparar` con mensajes claros
(`'estado debe ser activa|cerrada'`, `'plazas_manana fuera de rango
(0..100)'`, `'nombre no puede ser vacío'`, etc.).

---

### F3 — `action: cerrar` como atajo

**Síntoma.** Para cerrar una promoción había que hacer `update` pasando
`estado: 'cerrada'`, lo que requiere el resto de campos en UI
reconstruidos. Poco ergonómico — cerrar es un acto final muy común.

**Fix.** Nueva acción `cerrar` que solo marca `estado='cerrada'` por id.
El frontend muestra un botón `🔒 Cerrar` en las promociones activas (no
aparece si ya están cerradas o archivadas).

---

## Mapa de cambios

| Fichero | Cambio |
| --- | --- |
| `database/migrations/2026-04-23_02_promociones_qa_fixes.sql` | **Nuevo**. RLS anon (B4), CHECK plazas ≤ 100 (F1), vista sin filtro `deleted_at` (B6/S2). |
| `database/n8n-workflows/20-promociones.json` | BasicAuth en ambos webhooks (B1); retirada `delete`, añadidas `archivar`/`reactivar`/`cerrar` (B2); reemplazo Supabase UPSERT por httpRequest PostgREST (B3); `_trace` retirado (B5); filtros GET funcionales (B6); validación estricta (F2). |
| `promociones.html` | Barra de filtros (S1); botón `♻️ Reactivar` (S2); badge sidebar (S3); `max=100` en inputs (F1); botón `🔒 Cerrar` (F3); llamada `archivar` en vez de `delete` (B2). |
| `sidebar.js` | `badgeId: 'badge-promociones'` en el item promociones (S3). |
| `scripts/test-e2e-promociones.sh` | **Nuevo**. E2E con ~28 asertos cubriendo auth, CRUD, filtros, reactivar, validación. |

---

## Cobertura E2E (test-e2e-promociones.sh)

| Grupo | Asertos | Cubre |
| --- | --- | --- |
| auth | GET sin auth → 401; POST sin auth → 401; GET con auth → 200 | B1 |
| crud | create happy; listado total ≥1; ?estado=activa; badge flags | B3, B4 |
| validacion | create sin nombre; update sin id; id no-UUID; action desconocida; plazas fuera de rango; delete retirada | B2, F1, F2 |
| flujo | create → update → cerrar → archivar → reactivar (round-trip) | B3, F3, S2 |
| filtros | ?estado=cerrada sólo devuelve cerradas; ?incluir_archivadas=1 devuelve archivadas; por defecto las oculta | B6, S1 |

El script termina con `SKIP_CLEANUP=1` si quieres conservar los registros
creados; por defecto los deja archivados.
