#!/usr/bin/env bash
# ============================================================================
# Deploy script para Laravel Forge.
# Pegar este contenido en: Forge → tu sitio → App → Deployment Script.
# Forge le inyecta las variables FORGE_* automáticamente.
# ============================================================================

set -e

cd "$FORGE_SITE_PATH"

# 1) Pull de la rama configurada
git pull origin "$FORGE_SITE_BRANCH"

# 2) Composer (sin dev — prod, optimizado)
$FORGE_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# 3) Migraciones (en producción solo --force, sin prompts)
$FORGE_PHP artisan migrate --force

# 4) Cache de Laravel para producción (config, routes, views, events)
$FORGE_PHP artisan config:cache
$FORGE_PHP artisan route:cache
$FORGE_PHP artisan view:cache
$FORGE_PHP artisan event:cache

# 5) Reiniciar workers de queue (Horizon) y FPM
$FORGE_PHP artisan queue:restart

( flock -w 10 9 || exit 1
    echo 'Restarting FPM...'; sudo -S service "$FORGE_PHP_FPM" reload ) 9>/tmp/fpmlock

echo "Deploy OK — $(date)"
