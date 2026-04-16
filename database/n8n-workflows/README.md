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
