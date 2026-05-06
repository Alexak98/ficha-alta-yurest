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
        'http://localhost:8090',
        'http://127.0.0.1:8090',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-XSRF-TOKEN'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => true,
];
