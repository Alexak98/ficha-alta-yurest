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

```bash
# 1) Admin local de pruebas
./vendor/bin/sail artisan db:seed
# username: admin / password: la de SEED_ADMIN_PASSWORD (default: "password")

# 2) Importar usuarios reales desde Supabase
echo 'SUPABASE_DSN=postgres://USER:PASS@db.kyvzrqxicxirnroowriq.supabase.co:5432/postgres' >> .env
./vendor/bin/sail artisan yurest:import-users --dry-run   # preview sin escribir
./vendor/bin/sail artisan yurest:import-users             # importa de verdad
./vendor/bin/sail artisan yurest:import-users --force     # sobrescribe duplicados
```

El comando preserva UUIDs, hashes PBKDF2 (con `password_algo='pbkdf2'` para
rehash gradual al primer login), permisos granulares y normaliza el formato
legacy de `permisos` (array plano → objeto `{read,write,delete}`).

Para importar desde un dump SQL en lugar de DSN:

```bash
# Crea BD temporal en Sail
./vendor/bin/sail bin createdb -U yurest yurest_supabase_dump
./vendor/bin/sail bin psql -U yurest yurest_supabase_dump < database/imports/usuarios-supabase.sql
./vendor/bin/sail artisan yurest:import-users --dsn=postgres://yurest:yurest@127.0.0.1/yurest_supabase_dump
./vendor/bin/sail bin dropdb -U yurest yurest_supabase_dump
rm database/imports/usuarios-supabase.sql
```

**Importante:** los archivos en `database/imports/*.sql` están en `.gitignore`
(contienen PII — passwords y emails reales). Bórralos en cuanto termines.

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
