# Yurest Backend (Laravel)

API REST que sustituye los webhooks de **n8n** y la BD **Supabase** del portal Yurest.
Ver el plan completo de migración en [`../docs/MIGRATION-LARAVEL.md`](../docs/MIGRATION-LARAVEL.md).

## Estado actual

Esqueleto + **PoC funcional** del módulo de solicitudes (workflow `08-solicitudes.json`)
y autenticación (workflow `16-auth.json`). El resto se irá migrando por fases.

| Capa | Estado |
|------|--------|
| Esqueleto Laravel 13 + Sail (pgsql + redis + mailpit + minio) | ✅ |
| Migración inicial 1:1 del schema Supabase (`fichas_alta`, `locales`, `proyectos`, `bajas`, `solicitudes`, `distribucion`, `users`) | ✅ |
| Auth con rehash gradual PBKDF2 → bcrypt + Sanctum | ✅ |
| Middleware de permisos granulares (`permiso:pageId,accion`) | ✅ |
| CORS configurado para GitHub Pages + dev local | ✅ |
| CRUD de solicitudes (PoC) + endpoint público `responder` | ✅ |
| Seeder de admin local + comando `yurest:import-users` desde Supabase | ✅ |
| CI con Postgres + Redis + Pest + PHPStan + Pint | ✅ |
| Resto de workflows (fichas, proyectos, bajas, hardware, ...) | ⏳ pendiente |
| Crons (notif integraciones, resúmenes Zendesk) | ⏳ pendiente |
| Churn técnico (workflow 24) | ⏳ pendiente |
| Adjuntos en S3 | ⏳ pendiente |

## Arrancar en local (Sail)

Requiere Docker Desktop.

```bash
cd backend
cp .env.example .env
composer install
./vendor/bin/sail up -d
./vendor/bin/sail artisan key:generate
./vendor/bin/sail artisan migrate
```

API en `http://localhost`. Healthcheck: `curl http://localhost/api/health`.

## Datos iniciales

La BD arranca de cero con un único admin:

```bash
./vendor/bin/sail artisan db:seed
# username: alex / password: alex08 / rol: admin
```

### (Opcional) importar usuarios reales desde Supabase

El comando `yurest:import-users` se mantiene como infraestructura por si
en el futuro se quiere migrar otra tabla. Soporta tres orígenes:

```bash
# Vía CSV exportado del SQL Editor de Supabase Studio
./vendor/bin/sail artisan yurest:import-users --csv=database/imports/usuarios.csv

# Vía JSON copiado al portapapeles (Mac)
pbpaste > database/imports/usuarios.json
./vendor/bin/sail artisan yurest:import-users --json=database/imports/usuarios.json

# Vía DSN si tienes la password del rol postgres
./vendor/bin/sail artisan yurest:import-users --dsn=postgres://user:PASS@host:5432/db

# Borra siempre el archivo tras el import — contiene PII
rm database/imports/usuarios.*
```

Soporta `--dry-run` (preview) y `--force` (sobrescribir).

**Importante:** los archivos en `database/imports/*.sql/.json/.csv` están
en `.gitignore` (contienen PII — passwords y emails reales). Bórralos en
cuanto termines el import.

## Tests

```bash
./vendor/bin/sail test                    # Pest
./vendor/bin/sail bin pint --test         # formato
./vendor/bin/sail bin phpstan analyse     # análisis estático
```

## Estructura

```
app/
  Http/
    Controllers/Api/   # AuthController, SolicitudController, ...
    Middleware/        # CheckPermiso (permisos granulares)
    Resources/         # API Resources (SolicitudResource)
  Models/              # User, FichaAlta, Solicitud, Local, Proyecto, ...
  Services/Auth/       # LegacyPbkdf2Verifier (rehash gradual)
config/cors.php        # Origins del frontend (GitHub Pages + localhost)
database/
  migrations/          # Schema Yurest replicado desde ../database/schema.sql
  factories/           # UserFactory, FichaAltaFactory, SolicitudFactory
routes/api.php         # Rutas REST
tests/Feature/         # Tests Pest (Auth/, Solicitudes/, Healthcheck)
```

## Mapeo workflows n8n → endpoints Laravel

Tabla completa en [`../docs/MIGRATION-LARAVEL.md`](../docs/MIGRATION-LARAVEL.md) §5.
Implementados hoy:

- `16-auth.json` → `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `08-solicitudes.json` → `GET|POST /api/solicitudes`, `POST /api/solicitudes/responder`,
  `DELETE /api/solicitudes/{id}`

## Entornos

| Entorno | Hosting | DB | Dominio |
|---------|---------|-----|---------|
| local   | Sail (Docker) | postgres:15 + redis:7 | http://localhost |
| dev     | Forge sobre Hetzner CX22 | postgres:15 dedicado | TBD |
| prod    | Forge sobre Hetzner CX22 + replica | postgres:15 dedicado | TBD |

Ramas:
- `main` → deploy automático a prod (cuando esté configurado en Forge)
- `develop` → deploy automático a dev

## Backups (a configurar en deploy)

- `spatie/laravel-backup` programa `pg_dump` diario + WAL archiving continuo a S3.
- Retención 30 días, test de restore mensual automatizado.
- Healthchecks.io ping al final de cada job.

Configurar `BACKUP_DESTINATION_DISK=s3` y `BACKUP_HEALTHCHECKS_URL` en cada entorno.

## Migración de datos desde Supabase

Cuando estemos listos para el cutover:

```bash
# Volcado lógico desde Supabase
pg_dump "postgresql://...@db.kyvzrqxicxirnroowriq.supabase.co:5432/postgres" \
  --schema=public --data-only \
  --exclude-table=schema_migrations \
  > supabase-data.sql

# Restauración local
./vendor/bin/sail bin psql -U yurest yurest < supabase-data.sql
```

Detalles del cutover en `MIGRATION-LARAVEL.md` §10 fase 9.
