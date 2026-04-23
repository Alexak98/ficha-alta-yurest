# QA Hardware — Hallazgos y correcciones (2026-04-23)

Revisión E2E del módulo de **Pedidos de Hardware** del portal Yurest:
creación por Implementador (desde proyectos), administración por
Contabilidad (`proformas.html`), y envío físico por Soporte
(`hardware.html`).

Endpoint único (n8n): `/hardware/pedidos` (GET + POST), persistencia en
Supabase tabla `hardware_pedidos`.

Flujo corregido tras esta QA:

    solicitada → proforma_adjuntada → pendiente_confirmar → lista_envio → enviado

Con rollback controlado vía `action=devolver_a_contabilidad`:
- Desde `proforma_adjuntada` el implementador puede rechazar la proforma
  (vuelve a `solicitada`).
- Desde `pendiente_confirmar` contabilidad puede devolver el justificante
  (vuelve a `proforma_adjuntada`).

---

## 🔴 Bloqueantes (corregidos)

### B1. Webhooks `GET` y `POST /hardware/pedidos` sin autenticación

- Síntoma: cualquiera con la URL podía crear pedidos, subir PDFs, confirmar
  pagos y borrar pedidos (había `action:delete`).
- Archivo: `database/n8n-workflows/21-hardware-pedidos.json` (webhooks
  `wh-hw-get` y `wh-hw-post`).
- **Fix:** añadido `"authentication":"basicAuth"` + `credentials.httpBasicAuth`
  apuntando a "Yurest Portal Auth" en ambos webhooks, mismo patrón que el
  workflow 04-fichas-alta.
- Acción pendiente en n8n: importar el workflow actualizado y vincular la
  credencial BasicAuth existente.

### B2. `action:delete` expuesto en webhook público sin control

- El nodo `Preparar` aceptaba `{action:'delete', pedido:{id}}` aplicando
  soft-delete. Ninguna vista del portal lo usa; era un vector directo de
  borrado incluso tras añadir BasicAuth (todos los roles comparten la misma
  credencial).
- **Fix:** `delete` retirado del array `VALID` del nodo `Preparar`. El
  borrado queda fuera del webhook; si alguna vez hace falta se hará por SQL
  directo o mediante una cola de admin con doble confirmación.

### B3. Leak de datos internos en `_trace` de la respuesta POST

- El commit `5371b19` ("debug(wf-20/21): volcar _trace…") añadió un campo
  `_trace` al `Formatear respuesta` con `Object.keys(i.json)` y el JSON
  entero de cada output de Supabase. En caso de error esto podía exponer
  columnas internas al cliente.
- **Fix:** retirado el campo `_trace` y las trazas intermedias en el nodo
  `fmt-upsert-hardware_pedidos`. La respuesta queda en
  `{success, pedido, errores}` únicamente.

### B4. Validación de `id` y payloads

- `action!='create'` solo comprobaba `!p.id` — aceptaba cualquier string.
  Llegaba a Supabase como UUID inválido → error `22P02` sin mensaje
  procesable.
- `create` no validaba que cada item tuviera `nombre` y `cantidad>0`.
- **Fix:** regex UUID en el nodo `Preparar`, validación estricta de items,
  mensaje de error descriptivo devuelto en `errores[]`.

---

## 🟠 Severos (corregidos)

### S1. No existía estado `enviado` — los pedidos se acumulaban en Soporte

- El CHECK constraint del schema limitaba a 4 estados; `hardware.html` solo
  filtraba `estado=lista_envio` y no tenía acción para cerrar el envío.
- **Fix:**
  - Migración `database/migrations/2026-04-23_01_hardware_pedidos_enviado.sql`:
    amplía el CHECK a 5 estados y añade columnas `enviado_at`, `enviado_por`,
    `tracking`.
  - Nueva acción `marcar_enviado` en el workflow 21.
  - `hardware.html` reescrito con tabs **Pendientes de envío** / **Ya
    enviados**, formulario inline con tracking opcional, y badge de sidebar.

### S2. No había rollback entre estados

- Si la proforma era incorrecta o el justificante no servía, la única salida
  era editar la fila a mano en Supabase. En producción quedaba un pedido
  bloqueado porque ambas partes esperaban a la otra.
- **Fix:** nueva acción `devolver_a_contabilidad` con parámetro `desde` +
  `motivo` obligatorio. El motivo queda en `notas_contabilidad` con prefijo
  `[DEVOLUCIÓN <timestamp>]` y se limpian los adjuntos del estado abandonado.
- UI: en `proformas.html` botón **↩ Devolver justificante** (desde
  pendiente_confirmar); en el tab Hardware del proyecto (`app.js`) botón
  **↩ Rechazar proforma** (desde proforma_adjuntada).

### S3. Re-subir proforma/justificante sobrescribía sin aviso

- Con los estados lineales originales no había forma de volver atrás, así
  que este caso no se daba en UI. Con el rollback del S2, las devoluciones
  **limpian explícitamente** el adjunto del estado abandonado en vez de
  dejar un PDF huérfano (ver `prep-upsert` → rama
  `devolver_a_contabilidad`).

### S4. Soporte no veía contexto de envío

- `hardware.html` original no mostraba ID del pedido ni fecha de proforma
  (solo solicitada/pagada/confirmada). Difícil referenciar un pedido al
  gestionarlo.
- **Fix:** tarjeta reescrita con ID corto (8 chars), fila de fechas
  completa y badge "proyecto eliminado" si el pedido es huérfano
  (`proyecto_id IS NULL` tras `ON DELETE SET NULL`).

---

## 🟡 Funcionales (corregidos)

### F1. `notas_contabilidad` sin UI de entrada

- El workflow ya aceptaba el campo, `app.js` lo renderizaba al
  implementador, pero `proformas.html` no tenía textarea.
- **Fix:** modal `pedirNota()` genérico en `proformas.html`. Se muestra al
  subir proforma (opcional), confirmar pago (opcional) y devolver
  justificante (obligatoria).

### F2. Badge de Hardware envíos ausente en sidebar

- `sidebar.js:96` no declaraba `badgeId` para el item Hardware. Soporte no
  veía cuántos envíos había pendientes.
- **Fix:** añadido `badgeId: 'badge-hardware'`; `hardware.html` lo actualiza
  al cargar (`= count(lista_envio)`).

### F3. Botón "Recargar" ausente en `proformas.html` y tab del proyecto

- Inconsistencia con `hardware.html` que sí lo tenía.
- **Fix:** botón ↻ Recargar añadido en la cabecera de `proformas.html`. La
  pestaña Hardware del proyecto se re-renderiza tras cada acción, no
  necesita botón explícito.

### F4. PDFs en base64 en cada GET (pendiente)

- Los fetchs de `hardware.html` y `proformas.html` descargan TODOS los PDFs
  de todos los pedidos en cada render. Con 20 pedidos × 2 MB son 40 MB.
- **Estado:** **sin corregir** en esta QA. Requiere refactor a almacenamiento
  externo (Supabase Storage + signed URLs). Se recomienda:
  1. Migrar `proforma_pdf.data` / `justificante_pdf.data` a Storage.
  2. El GET devuelve solo metadatos + URL firmada de 5 min.
  3. El frontend descarga bajo demanda al hacer clic en "Abrir proforma".
- Mitigación temporal: paginación en la UI (filtros client-side ya
  aplicados; con >100 pedidos habrá que paginar).

### F5. `solicitado_por` y rol de transición confían solo en el cliente

- `solicitado_por` viene del cliente (`YurestConfig.getUsuario().username`)
  — es un campo de UX (etiqueta), no un control de seguridad.
- El rol de la transición (contabilidad puede confirmar pago, soporte puede
  marcar enviado) se valida solo con `requireAuth()` en el browser.
- **Estado:** **sin corregir** en esta QA. Requiere que n8n reciba el JWT /
  credencial del usuario y lo valide contra la tabla `usuarios.permisos`.
  Es un cambio transversal que afecta a todos los workflows; no se toca en
  este parche específico de hardware.
- Mitigación: ahora al menos los endpoints exigen BasicAuth (B1).

---

## 🔴 Bloqueantes descubiertos durante ejecución E2E (corregidos)

### B5. Supabase UPSERT silencioso + RLS bloqueando a la clave anon

- Síntoma durante E2E: `POST create` devolvía `success:true` con la fila
  eco del input, pero `GET` seguía devolviendo `[]`. El nodo
  `n8n-nodes-base.supabase` con `operation=upsert` + `continueOnFail=true`
  estaba tragando los errores de PostgREST (RLS `new row violates policy`).
- Causa raíz combinada:
  1. `hardware_pedidos` sólo tenía policy para `service_role`, pero n8n usa
     la clave **anon** (ver `2026-04-16_01_anon_write_policies.sql`).
  2. El nodo Supabase `upsert` de n8n v1 no resuelve `ON CONFLICT` sin
     tener PK en el payload — y `DEFAULT gen_random_uuid()` no se aplica a
     tiempo para el `autoMapInputData`.
- **Fix:**
  - Añadida policy `anon_write_hardware_pedidos` en la migración
    `2026-04-23_01_hardware_pedidos_enviado.sql` (mismo patrón que
    fichas/locales/solicitudes).
  - Sustituido el nodo `n8n-nodes-base.supabase upsert` por `httpRequest`
    a PostgREST: POST `/rest/v1/hardware_pedidos?on_conflict=id` para
    `create` y PATCH `/rest/v1/hardware_pedidos?id=eq.<uuid>` para updates,
    con `Prefer: return=representation` y `neverError: true`. PostgREST
    devuelve el error real si falla — ya no hay silent-fail.
  - `Preparar` genera UUID v4 client-side (Math.random) para que el PK
    exista siempre al emitir la request.
  - `Formatear respuesta` lee `$('Preparar').first().json.__error` para
    priorizar errores de validación sobre respuestas de PostgREST.

### B6. Filtros `?estado=` y `?proyecto_id=` no se aplicaban en GET

- `Formatear GET` leía `$input.first().json.query` pero `$input.first()`
  en ese contexto es la PRIMERA fila de Supabase, no el webhook.
- **Fix:** cambiado a `$('Webhook GET Pedidos').first().json.query` — los
  filtros funcionan. Validado en el script E2E (test "GET ?proyecto_id=
  inexistente → 0").

---

## Mapa de cambios aplicados

| Archivo | Cambio |
|---|---|
| `database/n8n-workflows/21-hardware-pedidos.json` | BasicAuth en GET+POST, validación UUID, items con cantidad>0, `delete` retirada, `marcar_enviado` y `devolver_a_contabilidad` añadidas, sort desc por `solicitado_at`, `_trace` eliminado, **UPSERT migrado a httpRequest PostgREST (B5)**, **filtros GET leen del webhook (B6)** |
| `database/migrations/2026-04-23_01_hardware_pedidos_enviado.sql` | Nuevo estado `enviado`, columnas `enviado_at/enviado_por/tracking`, policy `anon_write_hardware_pedidos` (B5) |
| `hardware.html` | Tabs Pendientes/Enviados, badge sidebar, ID corto, fechas completas, indicador huérfano, formulario tracking inline |
| `proformas.html` | Botón recargar, ID+proforma_at, indicador huérfano, modal `pedirNota()`, botones **↩ Devolver justificante**, acción rollback |
| `js-gestor/app.js` | Estado `enviado` en `ESTADO_LBL`, ID corto + fechas clave, botón **↩ Rechazar proforma** (rollback lado implementador), render de tracking |
| `sidebar.js` | `badgeId: 'badge-hardware'` en item Hardware envíos |
| `css-gestor/styles.css` | Estilo `.est-enviado` |
| `scripts/test-e2e-hardware.sh` | Script E2E (ver más abajo) |

---

## Cobertura de test E2E

El script `scripts/test-e2e-hardware.sh` cubre:

| # | Bloque | Aserción |
|---|---|---|
| 1 | Auth negativa GET | 401 sin Basic Auth |
| 2 | Auth negativa POST | 401 sin Basic Auth |
| 3 | GET listado completo | 200 + `pedidos[]` |
| 4 | GET filtrado por estado | solo estado pedido |
| 5 | GET filtrado por proyecto_id | solo pedidos de ese proyecto |
| 6 | POST create | success + id válido + estado=solicitada |
| 7 | POST create sin items | success=false + error "items vacío" |
| 8 | POST create sin cliente | success=false + error "cliente obligatorio" |
| 9 | POST adjuntar_proforma | estado=proforma_adjuntada + proforma_at set |
| 10 | POST adjuntar_proforma sin PDF | success=false + error |
| 11 | POST adjuntar_justificante | estado=pendiente_confirmar + pagado_at |
| 12 | POST confirmar_pago | estado=lista_envio + confirmado_at |
| 13 | POST marcar_enviado | estado=enviado + enviado_at |
| 14 | Round-trip completo | flujo feliz encadenado |
| 15 | POST devolver_a_contabilidad (proforma) | vuelve a solicitada + proforma limpia |
| 16 | POST devolver_a_contabilidad (justificante) | vuelve a proforma_adjuntada |
| 17 | POST devolver sin motivo | success=false |
| 18 | POST action=delete | action inválida (retirada) |
| 19 | POST action desconocida | success=false + error claro |
| 20 | POST id no-UUID | success=false + error "UUID inválido" |

Uso:

    YUREST_BASIC_AUTH='dXNlcjpwYXNz' ./scripts/test-e2e-hardware.sh

Opcional:

    SKIP_CLEANUP=1   → deja los pedidos creados
    VERBOSE=1        → imprime respuestas completas
