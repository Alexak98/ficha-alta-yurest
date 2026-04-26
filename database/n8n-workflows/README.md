# Workflows n8n — Yurest

Este directorio contiene los workflows exportados de n8n que dan soporte al portal Yurest. Se importan a n8n vía **Settings → Import from File**.

## CORS

Tras importar, asegúrate de que cada webhook tenga configurado:

- **Allowed Origins**: lista a mantener sincronizada con el frontend.
  - `https://alexak98.github.io` (producción GitHub Pages)
  - `http://127.0.0.1:8090` y `http://localhost:8090` (desarrollo local)
- **Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS`.
- **Allowed Headers**: `Content-Type, Authorization`.

Los workflows incluyen estos headers en cada `Respond to Webhook`, pero el preflight (OPTIONS) lo responde el webhook nativo antes de entrar al flujo. En n8n v1.x actívalo en cada `Webhook` node → **Options → CORS → Enable**, y repite la lista anterior ahí.

Si n8n está detrás de un proxy (nginx/Caddy/Traefik), puedes también aplicar la política CORS a nivel de proxy y dejar los workflows con `*` — en ese caso el proxy gana.

## Credenciales

Los nodos `n8n-nodes-base.supabase` referencian `SUPABASE_CREDENTIAL_ID` y los nodos Asana usan `ASANA_CREDENTIAL_ID`. Estos IDs son placeholders que se sustituyen al importar si ya hay una credencial con el nombre `Supabase Yurest` / `Asana Yurest`. Si no, créalas antes de activar los workflows.

### Autenticación del portal (login)

El webhook `GET Altas` en `04-fichas-alta.json` es el que valida el login — ahora usa **Basic Auth nativo de n8n**. Crea en n8n una credencial del tipo **"Header Auth" → Basic Auth** llamada **`Yurest Portal Auth`** con el `user` y `password` que quieras exigir, y asóciala al nodo `Webhook GET Altas`. Sin esta credencial el webhook aceptaría cualquier request, rompiendo la seguridad del portal.

## Listado

| Archivo                     | Propósito                                     |
|-----------------------------|-----------------------------------------------|
| 01-proyectos-crud.json      | CRUD de proyectos de implementación          |
| 02-proyectos-tareas.json    | CRUD de tareas/subtareas dentro de proyectos |
| 04-fichas-alta.json         | CRUD de fichas de alta de clientes           |
| 05-bajas.json               | Registro y consulta de bajas                 |
| 06-distribucion.json        | Asignación implementador ↔ ficha             |
| 07-calendar-asana.json      | Proxy Google Calendar + Asana                |
| 08-solicitudes.json         | Creación y consulta de solicitudes           |
| 09-rellenado-cliente.json   | Listado de fichas rellenadas por cliente     |
| 10-eliminar.json            | Soft-delete de ficha o solicitud             |
| 11-auxiliares.json          | Endpoints auxiliares varios                  |
| 12-completar-ficha.json     | Carga de datos para completar ficha          |
| 13-grabado-a3.json          | Toggle "grabado en A3" en proyectos          |
| 14-notif-integraciones-semanal.json | Recordatorio semanal por email de integraciones sin avance, con último comentario Asana |
| 15-notif-integraciones-api.json     | API de configuración y consulta de historial (usada por el panel de Integraciones) |
| 26-escalados.json                   | CRUD de escalados de clientes (Comercial → Escalados de clientes)                       |

## Recordatorio semanal de Integraciones (workflow 14)

Trigger: cron interno de n8n, **lunes 09:00**. No tiene webhook (no hay endpoint público).

Flujo:
1. Lee la configuración hardcoded en el primer nodo `Configuración`
   (proyecto Asana, umbral en días, secciones a vigilar y lista de
   grupos con sus destinatarios + filtros opcionales por TPV/sección).
2. Llama al endpoint REST de Asana `/projects/{id}/tasks` con todos los
   `opt_fields` necesarios.
3. Filtra a las tareas que: están en una sección de seguimiento DENTRO
   de nuestro proyecto, no están completadas, y llevan más del umbral
   sin actividad (`modified_at`, con fallback a `created_at`).
4. Por cada tarea filtrada, llama a `/tasks/{gid}/stories` y se queda
   con el último comentario real (`resource_subtype='comment_added'`).
5. Compone un email HTML por grupo con tabla de tareas, días de
   inactividad, asignado, sección y el último comentario embebido.
6. Envía vía credencial SMTP "Soporte". Si un grupo no tiene tareas
   que matcheen su filtro, no se envía email.

La configuración ahora vive en Supabase (`notif_integraciones_config` y
`notif_integraciones_grupos`) y se edita desde el propio portal en
**Integraciones → Avisos automáticos**. Ya no hace falta tocar el
workflow para cambiar destinatarios, umbrales o grupos.

Cada ejecución escribe una fila por grupo en `notif_integraciones_historial`
con un snapshot de las tareas reportadas (incluyendo el último
comentario de Asana) para dejar trazabilidad semanal.

## API de notificaciones (workflow 15)

Tres webhooks usados exclusivamente por la UI:

- `GET  /webhook/notif-integraciones/config`   → devuelve `{config, grupos}`
- `PUT  /webhook/notif-integraciones/config`   → actualiza umbral, secciones, activo
- `POST /webhook/notif-integraciones/grupos`   → `{action: 'create'|'update'|'delete', grupo: {...}}`
- `GET  /webhook/notif-integraciones/historial` → últimos 200 registros

Para probar manualmente el envío sin esperar al lunes: abrir el workflow
14 en n8n y pulsar **Execute Workflow**.
