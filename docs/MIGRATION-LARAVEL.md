# Migración Yurest → Laravel

> Documento maestro: stack objetivo, entornos, backups, mapeo workflow→controller, y plan de fases.
> Estado: **propuesta** (pendiente de validación). Una vez aceptado, este doc se actualiza por fase.

---

## 1. Resumen ejecutivo

Yurest hoy son **28 HTMLs estáticos en GitHub Pages** que consumen **29 webhooks n8n**, los cuales a su vez hablan con **Supabase Postgres** y con APIs externas (Asana, Zendesk, Google Calendar, Drive, OpenAI, SMTP, A3).

Migramos a:

- **Backend:** Laravel 11 (PHP 8.3) + PostgreSQL 15 propio + Redis + Horizon + S3 (Hetzner Object Storage).
- **Frontend:** se mantiene tal cual en GitHub Pages. Solo cambia `WEBHOOK_BASE` → `API_BASE`.
- **Operación:** 3 entornos (local / dev / prod) gestionados con Laravel Forge sobre Hetzner.
- **Backups:** `spatie/laravel-backup` con `pg_dump` diario + `pg_basebackup` semanal a S3, retención 30 días.

Esfuerzo estimado: **8–9 semanas full‑time** para una persona con experiencia Laravel; el frontend toca poco (solo apuntar a otra URL y ajustar formato auth).

---

## 2. Stack objetivo

| Capa | Tecnología | Comentario |
|------|------------|------------|
| Lenguaje | PHP 8.3 | Tipado estricto, enums, readonly, performance OK |
| Framework | Laravel 11 | Estándar de facto, ecosistema enorme |
| BD | PostgreSQL 15 | El schema actual usa JSONB, arrays, GIN, triggers — Postgres es obligatorio, no MySQL |
| Cache + colas | Redis 7 + Horizon | Reemplaza schedule de n8n + jobs async (envío de emails, Asana sync, A3) |
| Storage | S3 (Hetzner Object Storage o AWS S3) | Para `proyectos.adjuntos`, exports CSV, backups |
| Auth | Laravel Sanctum (token-based) | Reemplaza Basic Auth + tabla `usuarios` actual |
| HTTP client | `Illuminate\Support\Facades\Http` | Para Asana, Zendesk, A3, Calendar |
| OpenAI | `openai-php/laravel` | SDK oficial PHP, reemplaza nodos de IA en workflows 24/28/29 |
| Email | Symfony Mailer (Laravel Mail) + SMTP corporativo | Sustituye nodos `emailSend` |
| Tests | PHPUnit + Pest | Tests reales por endpoint (hoy: 0) |
| Frontend | Sin cambio: HTMLs estáticos en GitHub Pages | Solo cambia base URL y formato auth |
| Local dev | Laravel Sail (Docker) | `sail up` y arriba |
| Hosting dev/prod | Laravel Forge + 2× Hetzner CX22 | ~6 €/mes/server, 2 GB RAM, suficiente |
| TLS | Let's Encrypt (auto en Forge) | |
| CI | GitHub Actions | `phpunit`, `pint`, `phpstan`, `migrate --dry-run` en cada PR |
| Observabilidad | Laravel Pulse + Sentry | Dashboards y errores |

Servicios que **desaparecen**: Supabase (BD + Auth + Storage + RLS), n8n, los 29 workflows, las credenciales `Yurest Portal Auth` y `Supabase Yurest`.

Servicios que **se mantienen**: Asana, Zendesk, Google Calendar, Google Drive, OpenAI, A3, GitHub Pages.

---

## 3. Tres entornos

```
                     ┌──────────────────────────────────────────┐
                     │  Frontend (GitHub Pages, repo actual)    │
                     │  config.js lee API_BASE de un meta tag   │
                     │  o de un build-time env                  │
                     └─────────────────┬────────────────────────┘
                                       │
              ┌────────────────────────┼─────────────────────────┐
              │                        │                         │
       local (Sail)             dev (Forge)               prod (Forge)
       ───────────              ───────────               ────────────
       Docker compose           Hetzner CX22              Hetzner CX22
       laravel-app              api-dev.yurest.dev        api.yurest.dev
       postgres:15              Postgres 15 dedicado      Postgres 15 + replica
       redis:7                  Redis 7                   Redis 7
       mailpit                  Mailtrap (sandbox)        SMTP corporativo
       MinIO (S3-compat)        Hetzner Object Storage    Hetzner Object Storage
       .env                     .env (Forge UI)           .env (Forge UI)
```

**Branches y deploy:**

- `main` → deploy automático a **prod** (vía Forge "Deploy when pushed")
- `develop` → deploy automático a **dev**
- Feature branches → preview en local con Sail; opcional preview en Forge si pesa la PR

**Migraciones de BD:**

- `php artisan migrate --pretend` corre en CI antes de cada merge
- `php artisan migrate` corre en el `deploy.sh` de Forge, **siempre con backup previo automático**
- Rollback documentado por feature; si una migración no se puede revertir, se documenta en el PR

**Variables de entorno (.env):**

```
APP_ENV=local|staging|production
APP_KEY=<base64>
APP_URL=...
DB_CONNECTION=pgsql
DB_HOST=...
DB_DATABASE=yurest
DB_USERNAME=yurest
DB_PASSWORD=<secret>
REDIS_HOST=...
REDIS_PASSWORD=<secret>
SANCTUM_STATEFUL_DOMAINS=alexak98.github.io,localhost:8090
SESSION_DOMAIN=.yurest.dev
ASANA_PAT=<secret>
ZENDESK_SUBDOMAIN=...
ZENDESK_EMAIL=...
ZENDESK_TOKEN=<secret>
OPENAI_API_KEY=<secret>
S3_KEY=<secret>
S3_SECRET=<secret>
S3_BUCKET=yurest-{env}
MAIL_HOST=...
A3_API_URL=...
A3_API_KEY=<secret>
```

Secretos: nunca en repo. Se gestionan en Forge UI (cifrados) y se sincronizan a `.env` al hacer deploy.

---

## 4. Backups y disaster recovery

### Postgres

- **Diario `pg_dump` lógico** a S3, 03:00 UTC, retención 30 días. Job: `spatie/laravel-backup`.
- **Semanal `pg_basebackup` físico** + WAL archiving continuo a S3 (RPO ≤ 5 min). Cron en el server.
- **Test de restauración mensual** automatizado: el job descarga el último dump, lo restaura en una BD efímera y corre una query de smoke; si falla, alerta.
- Replica de lectura solo en prod (otro server Hetzner) para informes pesados (Zendesk heatmap, churn técnico).

### Storage S3

- Versionado activado en el bucket de prod.
- Lifecycle: archivos >180 días → Glacier (coste).
- Cross-region replication opcional si se exige RTO bajo.

### Configuración

- `forge:env-pull` se ejecuta semanalmente a un repo privado encriptado con `git-crypt` (los `.env` cambian poco).

### Alertas

- Sentry para errores de aplicación.
- Healthchecks.io ping al final de cada job de backup; si no llega, alerta a email + Slack.

---

## 5. Mapeo workflow n8n → controller Laravel

29 workflows. Endpoints reales extraídos de los `.json`. Los UUIDs largos (`/57e04029-...`) son herencia histórica y se sustituyen por rutas REST limpias **manteniendo la URL antigua como alias** durante el cutover para que el frontend pueda migrar gradualmente.

### Auth (16-auth.json)

| Verbo | URL n8n actual | URL Laravel propuesta | Controller@método |
|-------|----------------|----------------------|-------------------|
| POST  | /webhook/auth/login        | /api/auth/login         | `AuthController@login` |
| GET   | /webhook/auth/verify       | /api/auth/me            | `AuthController@me` |
| GET   | /webhook/auth/usuarios     | /api/usuarios           | `UsuarioController@index` |
| POST  | /webhook/auth/usuarios     | /api/usuarios           | `UsuarioController@store/update/destroy` (acción en body) |

**Importante:** el hash actual es **PBKDF2‑SHA256** (`pbkdf2$<iter>$<salt_b64>$<hash_b64>`), implementado a mano en JS dentro de n8n porque ese tenant tiene `crypto` capado. En Laravel pasamos a `Hash::make()` con bcrypt nativo. Migración:

1. Añadir columna `password_algo` (`pbkdf2` | `bcrypt`).
2. En el primer login exitoso, **rehashear con bcrypt** y actualizar columna.
3. Tras 60 días, forzar reset de los usuarios que sigan en pbkdf2.

Sustituye también la **Basic Auth del webhook GET Altas** por `auth:sanctum` middleware.

### Fichas de alta (04-fichas-alta, 12-completar-ficha, 09-rellenado-cliente, 19-notif-ficha-completa)

| Verbo | URL n8n | URL Laravel | Controller@método |
|-------|---------|-------------|-------------------|
| GET   | /webhook/018f...c77f       | /api/fichas                 | `FichaController@index` |
| POST  | /webhook/57e0...a147       | /api/fichas                 | `FichaController@store / @update` |
| GET   | /webhook/5a30...bbfd       | /api/fichas/{id}/completar  | `FichaController@cargarParaCompletar` |
| GET   | /webhook/fa16...37c3       | /api/fichas?estado=rellenado | mismo `index` con filter |
| POST  | /webhook/ficha/notificar-completa | /api/fichas/{id}/notificar | `FichaController@notificarCompleta` (dispatch Job) |

### Solicitudes (08-solicitudes, 11-auxiliares, 10-eliminar)

| Verbo | URL n8n | URL Laravel | Controller@método |
|-------|---------|-------------|-------------------|
| GET   | /webhook/1757...aa1e             | /api/solicitudes                 | `SolicitudController@index` |
| POST  | /webhook/b062...dc9b             | /api/solicitudes                 | `SolicitudController@store` |
| POST  | /webhook/6da4...4144             | /api/solicitudes/responder       | `SolicitudController@responder` (público con `access_token`) |
| GET   | /webhook/bdef...b96b             | /api/solicitudes/docs-subidos    | `SolicitudController@docsSubidos` |
| GET   | /webhook/2010...9009             | /api/drive                       | `DriveController@show` (proxy a Google Drive) |
| POST  | /webhook/a2b1...faa3d            | /api/fichas/{id} (DELETE) y /api/solicitudes/{id} (DELETE) | soft-delete |

### Bajas (05-bajas)

| Verbo | URL n8n | URL Laravel | Controller@método |
|-------|---------|-------------|-------------------|
| GET   | /webhook/84f0...1873        | /api/bajas         | `BajaController@index` |
| POST  | /webhook/73ce...83cf        | /api/bajas         | `BajaController@store / @update` |
| POST  | /webhook/95d5...e45b        | /api/bajas/{id} (DELETE) | `BajaController@destroy` |

### Distribución (06-distribucion)

| POST  | /webhook/6d3e...30a5        | /api/distribucion  | `DistribucionController@upsert` |

### Proyectos (01, 02, 18)

| Verbo | URL n8n | URL Laravel | Controller@método |
|-------|---------|-------------|-------------------|
| GET    | /webhook/proyectos                  | /api/proyectos                              | `ProyectoController@index` |
| POST   | /webhook/proyectos                  | /api/proyectos                              | `ProyectoController@store` |
| PUT    | /webhook/proyectos                  | /api/proyectos/{id}                         | `ProyectoController@update` |
| DELETE | /webhook/proyectos                  | /api/proyectos/{id}                         | `ProyectoController@destroy` |
| PUT    | /webhook/proyectos/tarea            | /api/proyectos/{id}/tareas/{tareaId}        | `TareaController@update` |
| PUT    | /webhook/proyectos/tarea/mover      | /api/proyectos/{id}/tareas/{tareaId}/mover  | `TareaController@mover` |
| PUT    | /webhook/proyectos/anotaciones      | /api/proyectos/{id}/anotaciones             | `AnotacionController@update` |
| GET/POST| /webhook/proyectos/historial       | /api/proyectos/{id}/historial               | `ProyectoHistorialController` |

### Integraciones externas (07-calendar-asana)

| Verbo | URL n8n | URL Laravel | Controller@método |
|-------|---------|-------------|-------------------|
| POST  | /webhook/calendar/event       | /api/calendar/events           | `CalendarController@store` (proxy a Google Calendar API) |
| GET   | /webhook/asana/tasks          | /api/asana/tasks               | `AsanaController@tasks` |
| GET   | /webhook/asana/task/stories   | /api/asana/tasks/{gid}/stories | `AsanaController@stories` |

### Notificaciones integraciones (14, 15)

Workflow 14 = cron lunes 09:00 sin webhook → **Job + scheduler**.

```php
// app/Console/Kernel.php
$schedule->job(new NotificarIntegracionesSinAvance)->weeklyOn(1, '09:00');
```

API del panel (15):

| Verbo | URL n8n | URL Laravel |
|-------|---------|-------------|
| GET   | /webhook/notif-integraciones/config     | /api/notif-integraciones/config |
| PUT   | /webhook/notif-integraciones/config     | /api/notif-integraciones/config |
| POST  | /webhook/notif-integraciones/grupos     | /api/notif-integraciones/grupos (acción en body) |
| GET   | /webhook/notif-integraciones/historial  | /api/notif-integraciones/historial |

### Promociones, hardware, presupuestos, escalados, CS Kanban, contabilidad

| Verbo | URL n8n | URL Laravel | Controller@método |
|-------|---------|-------------|-------------------|
| GET/POST | /webhook/promociones        | /api/promociones        | `PromocionController` |
| GET/POST | /webhook/hardware/pedidos   | /api/hardware/pedidos   | `HardwarePedidoController` |
| GET/POST | /webhook/hardware/stock     | /api/hardware/stock     | `HardwareStockController` |
| GET/POST | /webhook/presupuestos       | /api/presupuestos       | `PresupuestoController` |
| GET/POST | /webhook/escalados          | /api/escalados          | `EscaladoController` |
| POST     | /webhook/cs-estado          | /api/cs/estado          | `CsKanbanController@updateEstado` |
| POST     | /webhook/yurest-grabado-a3  | /api/proyectos/{id}/grabado-a3 | `ProyectoController@toggleGrabadoA3` (dispatch Job a A3 API) |

### Zendesk (25, 26-ia, 28, 29) — los pesados

| Verbo | URL n8n | URL Laravel | Notas |
|-------|---------|-------------|-------|
| GET   | /webhook/zendesk/tickets-heatmap     | /api/zendesk/heatmap    | cacheado 30 min con tag `zendesk` |
| GET   | /webhook/zendesk/tickets-heatmap-ia  | /api/zendesk/heatmap/ia | invoca OpenAI (Job async + polling) |
| GET   | /webhook/zendesk/resumen-semanal     | /api/zendesk/resumen?periodo=semana | dispatch Job |
| GET   | /webhook/zendesk/resumen-mensual     | /api/zendesk/resumen?periodo=mes | dispatch Job |

Estos endpoints son los más caros (llaman a Zendesk API + OpenAI). Se ejecutan como **Jobs en Horizon** y el frontend hace polling al estado del job.

### Churn técnico (24-churn-tecnico-supabase) — el monstruo

503 líneas de JS en Code nodes + cron cada 6h + cron cada 1 min. Es el mayor reto de la migración. Endpoints actuales:

| Verbo | URL n8n | URL Laravel |
|-------|---------|-------------|
| POST | /webhook/2c62...104f       | /api/churn/scan           |
| POST | /webhook/buscar-resumen    | /api/churn/buscar-resumen |
| POST | /webhook/042f...1084       | /api/churn/refresh        |
| GET  | /webhook/9e0f...45b25      | /api/churn/status         |
| GET  | /webhook/6c6b...3964f      | /api/churn/clientes       |

Estrategia: **dedicar 1 semana completa solo a este workflow**, con tests E2E que comparen output de la versión n8n con la versión Laravel sobre snapshots reales de BD.

### Historial (17-historial)

| Verbo | URL n8n | URL Laravel |
|-------|---------|-------------|
| GET/POST | /webhook/historial | /api/historial |

Recomendación: convertir en `App\Models\Concerns\Auditable` con `spatie/laravel-activitylog` para que cualquier modelo lo herede y se eliminen las inserciones manuales del frontend.

---

## 6. Modelo de datos

`schema.sql` + 36 migraciones se convierten en migraciones Laravel **sin cambiar ningún tipo de columna** (esto es clave: minimiza el riesgo del cutover).

Generación inicial:

```bash
php artisan migrate:generate --connection=pgsql_supabase_clone
```

Esto introspecta la BD de Supabase actual y genera el `database/migrations/2026_05_06_000000_initial_schema.php`. Luego añadimos las migraciones incrementales nuevas a partir de ahí.

**Modelos Eloquent** (uno por tabla principal): `FichaAlta`, `Local`, `Proyecto`, `Bajas`, `Solicitud`, `Distribucion`, `Usuario`, `Promocion`, `HardwarePedido`, `HardwareStock`, `Presupuesto`, `Escalado`, `CsEstado`, `NotifIntegracionesConfig`, `NotifIntegracionesGrupo`, `NotifIntegracionesHistorial`, `ChurnTecnico`, `ResumenSemanal`, `ResumenMensual`, `Historial`, `ProyectoHistorial`, `FichaHistorial`, `FichaAdjunto`.

**Relaciones**:

- `FichaAlta hasMany Local, Proyecto, Bajas, Solicitud, Distribucion, FichaAdjunto, FichaHistorial`
- `Proyecto hasMany ProyectoHistorial; belongsTo FichaAlta`
- Soft-deletes activados (`deleted_at`) en todos los modelos que ya lo tienen en BD.

**Triggers de Postgres**: los conservamos a nivel BD (la lógica `fichas_set_estado_timestamps` y `solicitud_propagar_fecha_a_ficha` está bien donde está). Laravel no necesita saber que existen.

**RLS**: se elimina (lo hace n8n con service_role; ya no aplica). Toda la seguridad pasa al middleware Sanctum + Policies de Laravel.

**JSONB**: Eloquent maneja `array` casts, así que `paquetes_carrito`, `secciones`, `anotaciones`, `adjuntos`, `sepa_mandato` se mapean a `protected $casts = ['secciones' => 'array', ...]`.

---

## 7. Permisos granulares

Ya tenéis `permisos: { read: [...], write: [...], delete: [...] }` por usuario (migración `2026-04-30_03_permisos_granulares.sql` y `js/lib/permisos-defs.js`).

Mapeo a Laravel:

```php
// app/Http/Middleware/CheckPermiso.php
Route::middleware(['auth:sanctum', 'permiso:fichas,read'])->get('/api/fichas', ...);
Route::middleware(['auth:sanctum', 'permiso:fichas,write'])->post('/api/fichas', ...);
```

El middleware lee `auth()->user()->permisos` (cast a array) y compara con `[$pageId][$accion]`. Mismo shape que hoy, así no toca el frontend.

---

## 8. Frontend: cambios necesarios

Mínimos:

1. **`config.js` y `js/lib/endpoints.js`:** sustituir `WEBHOOK_BASE` por `API_BASE` apuntando a `https://api.yurest.dev`. Las claves de `ENDPOINTS` cambian de UUIDs a rutas REST limpias.
2. **Auth:** el header pasa de `Authorization: Basic <base64>` a `Authorization: Bearer <token>`. `apiFetch` se actualiza una vez en `config.js`.
3. **CORS:** Laravel devuelve los headers en `config/cors.php`; lista de origins idéntica a la actual (`https://alexak98.github.io`, `http://127.0.0.1:8090`, `http://localhost:8090`).
4. **Login flow:** POST a `/api/auth/login` devuelve `{ token, user }`, se guarda en localStorage igual que hoy. `/api/auth/me` para el verify periódico.

No se reescribe ningún HTML. No se introduce build step. No se cambia el hosting del front.

---

## 9. CI/CD

`.github/workflows/ci.yml` actual valida JS/JSON/HTML/SQL. Lo extendemos con:

```yaml
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: ci, POSTGRES_DB: yurest_test }
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: '8.3', coverage: pcov }
      - run: composer install --no-progress
      - run: cp .env.testing .env
      - run: php artisan key:generate
      - run: php artisan migrate --force
      - run: vendor/bin/pint --test
      - run: vendor/bin/phpstan analyse
      - run: vendor/bin/pest --parallel
```

Deploy automático: Forge "Quick Deploy" en push a `main`/`develop`.

---

## 10. Plan de fases

| Fase | Duración | Entregable |
|------|----------|------------|
| **0. Decisión + setup** | 2 días | Este doc aprobado, repos creados, dominios apuntando |
| **1. Esqueleto** | 1 sem | Laravel + Sail + Forge + 3 entornos + CI verde + healthcheck |
| **2. BD** | 1 sem | Migraciones generadas, dump de Supabase importado a dev, modelos Eloquent básicos |
| **3. Auth + usuarios** | 1 sem | Login con rehash, /me, CRUD usuarios, middleware permisos. Frontend habla con `/api/auth/*` |
| **4. CRUD core** | 2 sem | Fichas, locales, solicitudes, proyectos, bajas, distribución, hardware, promociones |
| **5. Integraciones** | 1.5 sem | Asana, Zendesk (heatmap + IA), Calendar, Drive proxy, A3, OpenAI |
| **6. Crons + jobs** | 0.5 sem | Notif integraciones lunes 09:00, resúmenes Zendesk, scheduler |
| **7. Churn técnico** | 1 sem | Re-implementar workflow 24 con tests de paridad |
| **8. Adjuntos** | 0.5 sem | Migración Supabase Storage → S3 + reescritura de URLs en BD |
| **9. Cutover** | 1 sem | Doble escritura, validación, switch DNS, apagado de n8n y Supabase |

**Total: 9.5 semanas.** Si el churn técnico es más rápido de lo esperado, baja a 8.

**Hitos visibles para validar progreso:**

- Final fase 1: `curl https://api-dev.yurest.dev/api/health` devuelve 200.
- Final fase 3: el `login.html` actual loguea contra Laravel en dev.
- Final fase 4: el portal entero funciona en dev contra Laravel (sin integraciones externas todavía).
- Final fase 7: prod listo para cutover.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Lógica de Code nodes no documentada | Cada workflow se migra con un test de paridad: mismo input → mismo output que n8n |
| Pérdida de datos en cutover | Doble escritura 1 semana + diff diario + rollback plan |
| Hash PBKDF2 → bcrypt rompe logins | Rehash al login, fallback a verifyPbkdf2 si `password_algo='pbkdf2'` |
| Adjuntos referenciados con URLs Supabase | Script de rewrite en migración: itera `proyectos.adjuntos`, sube a S3, actualiza URL |
| Backups que no se han probado | Test de restore mensual automatizado, alertable |
| Frontend dev y prod apuntan al mismo backend | Build step ligero que inyecta `API_BASE` por env, o detecta hostname (`alexak98.github.io` → prod, otro → dev) |
| Coste de infra mayor del previsto | 2× CX22 (12 €/mes) + S3 (~5 €/mes) + Forge (12 €/mes) = ~30 €/mes total, vs Supabase free → coste neto +25 €/mes. Aceptable. |
| Churn técnico no para en feature freeze | Mantener workflow n8n vivo durante fase 7, switch al final |

---

## 12. Decisiones abiertas

1. ¿Dónde alojar el código backend? **Repo nuevo `yurest-api`** o **monorepo en este mismo repo bajo `backend/`**.
   - Voto: monorepo. Mantiene migraciones SQL juntas, frontend y backend versionados a la par.
2. ¿Mantener tabla `usuarios` o migrar a `users` (convención Laravel)? Voto: renombrar a `users` con migración limpia, alias `usuarios` durante 30 días con vista de Postgres.
3. ¿Ejecutar `pg_dump` desde Forge o desde un worker dedicado? Voto: worker dedicado (un CX11 a ~3 €/mes) para que un fallo del server prod no se lleve los backups.
4. ¿Sentry / Bugsnag / propio? Voto: Sentry, plan free hasta 5k errors/mes.
5. ¿Frontend sigue en GitHub Pages o lo movemos a CloudFront/Cloudflare Pages? Voto: GitHub Pages, no aporta nada moverlo.

---

## 13. Próximos pasos inmediatos

Una vez aprobado este doc:

1. **PoC** (3-4 días): re-implementar `08-solicitudes.json` completo en Laravel (controller + tests + migración + endpoint `/api/solicitudes`). Es de tamaño medio y self-contained, sirve para validar el shape antes de comprometernos al resto.
2. **Esqueleto** (2 días): repo `backend/`, Sail funcionando local, Forge configurado, 3 entornos arriba con healthcheck.
3. **Kickoff fase 2 (BD)**.
