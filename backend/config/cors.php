<?php

/*
 * CORS para que el portal Yurest (GitHub Pages + dev local) pueda
 * llamar a la API. Lista replicada de database/n8n-workflows/README.md.
 *
 * En prod, la lista exacta se sobreescribe por env CORS_ALLOWED_ORIGINS
 * (CSV) si se quiere endurecer sin redeployar.
 */

$envOrigins = array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', ''))));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'up'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    'allowed_origins' => $envOrigins ?: [
        'https://alexak98.github.io',
    ],
    // Patrón regex para dev: cualquier puerto en localhost / 127.0.0.1.
    // Necesario porque el frontend se sirve con php -S / python http.server
    // en puertos variables (8090, 8091, otros) y aquí no queremos manualidad.
    'allowed_origins_patterns' => [
        '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
    ],
    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-XSRF-TOKEN'],
    'exposed_headers' => [],
    'max_age' => 3600,
    // false porque usamos Bearer tokens (no cookies). Con true CORS exige
    // origin específico y no permite *, lo que complica patterns.
    'supports_credentials' => false,
];
