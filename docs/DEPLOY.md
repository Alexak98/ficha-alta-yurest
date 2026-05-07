# Guía de despliegue: Yurest backend en Hetzner + Forge

Pasos de cero a producción. Mantén este doc actualizado a medida que algo cambie.

---

## 1. Prerequisitos (hazlo tú una vez)

### 1.1. Dominio

Compra un dominio o usa uno tuyo existente. Necesitas crear **dos subdominios**:

- `api-dev.tu-dominio.com` — entorno de desarrollo
- `api.tu-dominio.com` — entorno de producción

Apunta los registros **A** a las IPs que te dará Hetzner en el paso 1.2. (También puedes esperar a tener las IPs y volver aquí.)

### 1.2. Servidores Hetzner

1. Crea cuenta en [Hetzner Cloud](https://www.hetzner.com/cloud).
2. Crea **dos servidores**:
   - **Tipo:** CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) — ~6 €/mes cada uno.
   - **Imagen:** Ubuntu 24.04 LTS.
   - **Localización:** Falkenstein (Alemania) o Helsinki — ambas con buena latencia desde España.
   - **Nombres:** `yurest-dev` y `yurest-prod`.
   - **Networking:** IPv4 + IPv6.
   - **SSH key:** sube tu clave pública (`~/.ssh/id_rsa.pub`) en el panel.
3. Anota las dos **IPs públicas**.
4. Vuelve a tu DNS y apunta `api-dev` y `api` a sus IPs respectivas.

### 1.3. Laravel Forge

1. Crea cuenta en [Forge](https://forge.laravel.com) (12 €/mes plan Hobby — basta).
2. **Conectar tu provider:** Server Providers → Add Custom Provider → introduces el endpoint Hetzner Cloud (o usa la opción "Custom VPS" con SSH).
3. **Conectar GitHub:** Source Control → Connect → autoriza acceso al repo `Alexak98/Yurest`.

### 1.4. Hetzner Object Storage (para backups)

1. En el panel de Hetzner Cloud → **Storage Boxes** o **Object Storage**.
2. Crea un bucket `yurest-backups` (~3 €/mes).
3. Anota las **credenciales S3-compatible**:
   - `access_key`
   - `secret_key`
   - `endpoint` (ej. `https://nbg1.your-objectstorage.com`)

---

## 2. Setup del servidor en Forge

Hazlo para **ambos servidores** (`yurest-dev` y `yurest-prod`). Donde dice `dev`/`prod`, sustituye según corresponda.

### 2.1. Crear el server

Forge → Servers → **Add New** → Custom VPS:
- **Name:** `yurest-dev` o `yurest-prod`.
- **IP address:** la de Hetzner.
- **PHP version:** 8.4.
- **DB:** PostgreSQL 15.
- **Site type:** PHP/Laravel.

Forge instalará Nginx + PHP 8.4 + Postgres + Redis + supervisor + lo que haga falta. Tarda ~5 min.

### 2.2. Crear el sitio

Forge → tu server → **Sites → Add Site**:
- **Domain:** `api-dev.tu-dominio.com` (o `api.tu-dominio.com`).
- **Project type:** General PHP / Laravel.
- **Web directory:** `/public`.

### 2.3. Conectar el repo

Tu sitio → **App** tab → **Install Repository**:
- **Provider:** GitHub.
- **Repository:** `Alexak98/Yurest`.
- **Branch:** `main` para prod, `develop` para dev (crea la rama si no existe).
- **Install composer:** sí.

### 2.4. Variables de entorno

Tu sitio → **Environment** tab. Sustituye los valores `XXX` por los reales.

```env
APP_NAME=Yurest
APP_ENV=production         # o 'staging' para dev
APP_KEY=                   # rellena después con artisan key:generate
APP_DEBUG=false            # true en dev si quieres ver stack traces
APP_URL=https://api.tu-dominio.com   # o api-dev.

APP_LOCALE=es
APP_TIMEZONE=Europe/Madrid

LOG_CHANNEL=stack
LOG_LEVEL=info

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=yurest_prod    # o yurest_dev
DB_USERNAME=forge
DB_PASSWORD=XXX            # Forge te lo asigna al crear el sitio

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

SESSION_DRIVER=redis
CACHE_STORE=redis
QUEUE_CONNECTION=redis
FILESYSTEM_DISK=s3
BROADCAST_CONNECTION=log

# === Mail ===
MAIL_MAILER=smtp
MAIL_HOST=smtp.hostinger.com    # o tu SMTP corporativo
MAIL_PORT=587
MAIL_USERNAME=soporte@yurest.com
MAIL_PASSWORD=XXX
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="soporte@yurest.com"
MAIL_FROM_NAME="${APP_NAME}"

# === S3 (Hetzner Object Storage para backups) ===
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
AWS_DEFAULT_REGION=eu-central-1
AWS_BUCKET=yurest-backups
AWS_ENDPOINT=https://nbg1.your-objectstorage.com
AWS_USE_PATH_STYLE_ENDPOINT=true

# === CORS (orígenes permitidos, CSV) ===
CORS_ALLOWED_ORIGINS=https://alexak98.github.io,https://yurest.com

# === Sanctum ===
SANCTUM_STATEFUL_DOMAINS=

# === Backups (spatie/laravel-backup) ===
BACKUP_DESTINATION_DISK=s3
BACKUP_HEALTHCHECKS_URL=https://hc-ping.com/XXX  # crea en healthchecks.io
BACKUP_ARCHIVE_PASSWORD=XXX                       # password para zip cifrado

# === Integraciones futuras (cuando las actives) ===
# ASANA_PAT=
# OPENAI_API_KEY=
# ZENDESK_SUBDOMAIN=
# ZENDESK_EMAIL=
# ZENDESK_TOKEN=
# GOOGLE_SERVICE_ACCOUNT_JSON=
```

Tras guardar, Forge te ofrece "Update Environment". Confírmalo.

### 2.5. Generar APP_KEY

Forge → tu sitio → **Commands** tab:
```
php artisan key:generate --force
```
Esto rellena `APP_KEY` en el `.env` del servidor.

### 2.6. Crear la base de datos

Forge → tu server → **Databases** tab → **Create Database**:
- **Name:** `yurest_prod` (o `yurest_dev`).
- **User:** `forge` (ya existe; o crea `yurest`).

### 2.7. Migrar el schema

Forge → tu sitio → **Commands** tab:
```
php artisan migrate --force
```

### 2.8. Crear el admin

```
php artisan db:seed --force
```
Esto crea `alex` / `alex08`. **Cambia la contraseña inmediatamente** desde el portal o con un comando custom (TODO crear `php artisan yurest:reset-admin-password`).

### 2.9. Activar deploy automático

Tu sitio → **App** tab → **Deployment Script**. Pega el contenido de [`backend/deploy.sh`](../backend/deploy.sh):

```bash
cd $FORGE_SITE_PATH
git pull origin $FORGE_SITE_BRANCH
$FORGE_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader --no-dev

$FORGE_PHP artisan migrate --force
$FORGE_PHP artisan config:cache
$FORGE_PHP artisan route:cache
$FORGE_PHP artisan view:cache
$FORGE_PHP artisan event:cache

$FORGE_PHP artisan queue:restart
( flock -w 10 9 || exit 1
    echo 'Restarting FPM...'; sudo -S service $FORGE_PHP_FPM reload ) 9>/tmp/fpmlock
```

Y activa **Quick Deploy**: cada push a la rama configurada hará deploy automático.

### 2.10. Horizon (worker de queue)

Forge → tu server → **Daemons** → **New Daemon**:
- **Command:** `php artisan horizon`
- **Directory:** `/home/forge/api.tu-dominio.com/current`
- **User:** `forge`

Forge configura supervisor para mantenerlo vivo. La UI de Horizon estará en `https://api.tu-dominio.com/horizon` (solo accesible por admin).

### 2.11. Cron de schedule:run

Forge → tu server → **Scheduler**:
- **Command:** `php /home/forge/api.tu-dominio.com/current/artisan schedule:run`
- **Frequency:** every minute

Con eso el job semanal (notif integraciones lunes 09:00) se dispara solo.

### 2.12. SSL

Tu sitio → **SSL** tab → **Let's Encrypt**:
- **Domain:** `api-dev.tu-dominio.com` (o `api.`).
- **Activate** → Forge gestiona el certificado y renovación automática.

### 2.13. Backups

Forge → tu server → **Daemons** → **New Daemon** o un cron diario via Scheduler:

```
php /home/forge/api.tu-dominio.com/current/artisan backup:run --only-db
```
Frecuencia: daily 03:00 UTC. Más detalles en [BACKUPS.md](BACKUPS.md).

---

## 3. Verificar que todo funciona

Desde tu Mac:

```bash
# Healthcheck
curl https://api.tu-dominio.com/api/health

# Login
curl -X POST https://api.tu-dominio.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"username":"alex","password":"alex08"}'
```

Debería devolver `{"success":true,"token":"..."}`.

---

## 4. Activar Yurest portal contra el backend prod

En `config.js` (frontend) cambia:

```js
const API_BASE = (function () {
    if (typeof location !== 'undefined' && location.hostname === 'alexak98.github.io') {
        return 'https://api.tu-dominio.com/api';   // ← descomenta cuando prod esté lista
    }
    return 'http://localhost/api';
})();
```

Hacer un push a main, GitHub Pages se redespliega solo, y el portal en `alexak98.github.io` empieza a hablar con tu backend prod.

Hasta ese momento el portal sigue contra n8n para alguien que entre desde GitHub Pages.

---

## 5. Apagar n8n

Cuando todo lleve unas semanas estable:

1. Confirma que el frontend ya no llama a n8n (revisa Network en producción durante un día).
2. Pausa los workflows en n8n.
3. Si todo sigue funcionando en 1-2 días, exporta los workflows como backup y descomisiona la instancia n8n.
4. Borra el referal a n8n del repo (`database/n8n-workflows/` carpeta y `WEBHOOK_BASE` en config.js).

---

## 6. Disaster recovery

Si todo se va al carajo:

1. **Backups:** restaurar el último dump `pg_dump` desde Hetzner Object Storage (3 últimos disponibles, retention 30d).
2. **Servidores:** Hetzner Cloud te deja restaurar snapshot del último día.
3. **Migraciones:** todas están en git — `php artisan migrate` recrea schema desde cero.
4. **Frontend:** GitHub Pages está en GitHub, no se pierde.

---

## 7. Costes mensuales estimados

| Servicio | Coste |
|----------|-------|
| 2× Hetzner CX22 | 12 € |
| Hetzner Object Storage 100 GB | 3 € |
| Forge Hobby | 12 € |
| Healthchecks.io (free) | 0 € |
| Sentry (free hasta 5k errors) | 0 € |
| **Total** | **~27 €/mes** |

Vs. coste actual con Supabase free + n8n auto-hosted: ~5 €/mes (servidor n8n). Coste neto +22 €/mes a cambio de control total, backups serios y entornos dev/prod separados.
