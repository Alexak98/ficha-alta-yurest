# Backups Yurest

Estrategia 3-2-1: 3 copias, 2 soportes distintos, 1 fuera del datacenter.

## Qué se respalda

`spatie/laravel-backup` está configurado para guardar:

- **Base de datos completa** (`pg_dump` lógico) — diario.
- **Storage privado** (`storage/app/private/*`) — diario.
- **Archivo zip cifrado** (con `BACKUP_ARCHIVE_PASSWORD`) en Hetzner Object Storage.

NO se respalda:
- `vendor/` (regenerable con `composer install`).
- `node_modules/`.
- Logs.
- Cachés.

## Cron en Forge

Forge → server → Scheduler:

```
php /home/forge/api.tu-dominio.com/current/artisan backup:run    every day at 03:00
php /home/forge/api.tu-dominio.com/current/artisan backup:clean  every day at 04:00
```

`backup:run` crea el zip y lo sube. `backup:clean` aplica la política de retención (30 días por defecto).

## Política de retención

Editar en `backend/config/backup.php` → `cleanup.default_strategy`:

```php
'default_strategy' => [
    'keep_all_backups_for_days' => 7,        // todos del últimos 7 días
    'keep_daily_backups_for_days' => 30,     // 1 por día durante 30 días
    'keep_weekly_backups_for_weeks' => 8,    // 1 por semana, 8 semanas
    'keep_monthly_backups_for_months' => 12, // 1 por mes, 12 meses
    'keep_yearly_backups_for_years' => 5,    // 1 por año, 5 años
    'delete_oldest_backups_when_using_more_megabytes_than' => 5000,
],
```

Default: hasta 5 GB de backups, ~1 año de cobertura. Aumenta los megabytes si los dumps crecen.

## Healthchecks

`spatie/laravel-backup` puede notificar a [healthchecks.io](https://healthchecks.io) (free hasta 20 checks):

1. Crea cuenta en healthchecks.io.
2. Crea un check llamado "Yurest backup".
3. Configura cron de 1 día con grace de 6h.
4. Copia la URL de ping.
5. En `.env` del servidor:
   ```
   BACKUP_HEALTHCHECKS_URL=https://hc-ping.com/XXXXXXXX
   ```
6. El job de backup hace ping al final si terminó OK.

Si pasan 30h sin ping, healthchecks.io te manda email avisando que algo falla.

## Test de restauración (mensual obligatorio)

Cualquier backup que no se haya probado **no es un backup**. Calendario mensual:

### Manualmente desde tu Mac

```bash
# 1) Descarga el último zip desde Hetzner Object Storage
aws s3 cp s3://yurest-backups/Yurest/2026-12-01-03-00-00.zip ./test-backup.zip \
  --endpoint-url https://nbg1.your-objectstorage.com

# 2) Descifra (mismo password que BACKUP_ARCHIVE_PASSWORD)
unzip -P "$BACKUP_ARCHIVE_PASSWORD" test-backup.zip -d test-backup

# 3) Restaura en BD efímera
createdb yurest_restore_test
psql yurest_restore_test < test-backup/db-dumps/postgresql-yurest_prod.sql

# 4) Smoke query: cuenta filas en tablas críticas
psql yurest_restore_test -c "SELECT
  (SELECT COUNT(*) FROM users)        AS users,
  (SELECT COUNT(*) FROM fichas_alta)  AS fichas,
  (SELECT COUNT(*) FROM proyectos)    AS proyectos,
  (SELECT COUNT(*) FROM solicitudes)  AS solicitudes;
"

# 5) Limpia
dropdb yurest_restore_test
rm -rf test-backup test-backup.zip
```

Si los counts cuadran con lo que esperas, el backup es funcional.

### Automatizado (TODO)

Crear comando `php artisan yurest:test-restore` que haga lo de arriba y escriba un check en healthchecks. Pendiente.

## Recuperación de desastre real

Si el servidor prod muere y necesitas restaurar:

1. **Crear servidor nuevo** (paso 1.2 de `DEPLOY.md`).
2. **Setup Forge** (paso 2 de `DEPLOY.md`).
3. **Restaurar BD desde el último backup**:
   ```bash
   ssh forge@nuevo-servidor
   cd /home/forge/api.tu-dominio.com/current
   # Descargar último backup
   php artisan tinker --execute="
     \$disk = Storage::disk('s3');
     \$last = collect(\$disk->files('Yurest'))->sortDesc()->first();
     \$disk->copy(\$last, 'restore.zip');
   "
   unzip -P "$BACKUP_ARCHIVE_PASSWORD" storage/app/restore.zip -d /tmp/restore
   psql yurest_prod < /tmp/restore/db-dumps/postgresql-yurest_prod.sql
   rm -rf /tmp/restore storage/app/restore.zip
   ```
4. **Verificar healthcheck** y un login real desde el portal.
5. **Apuntar DNS** a la nueva IP si es necesario.

RTO objetivo: < 4 horas.
RPO objetivo: < 24 horas (último backup diario).

## Mejorar RPO

Si necesitas RPO < 5 min (no perder más de 5 min de datos):

- Activar **WAL archiving** en Postgres + envío continuo a S3 (`wal-g` o `pgbackrest`).
- O **streaming replication** a un servidor secundario.

Ambas opciones añaden complejidad operacional. Para Yurest probablemente no aplica — los datos no son tan críticos como para perder 5 min.
