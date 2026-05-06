<?php

/*
 * Configuración específica de Yurest.
 *
 * Centraliza variables de entorno para que el resto del código las consuma
 * vía config('yurest.*') en lugar de env() directo (Larastan rule).
 */

return [

    /*
     * DSN del Postgres origen (Supabase) usado por el comando
     * `php artisan yurest:import-users` cuando no se pasa --dsn.
     * El comando se mantiene como infraestructura por si en el futuro
     * se quiere migrar otra tabla, pero el seeder actual NO lo usa
     * (la BD parte de cero con un único admin).
     */
    'supabase_dsn' => env('SUPABASE_DSN'),

];
