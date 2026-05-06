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
     */
    'supabase_dsn' => env('SUPABASE_DSN'),

    /*
     * Password del admin local creado por DatabaseSeeder.
     * Solo aplica en local/test — en prod no se ejecuta el seeder.
     */
    'seed_admin_password' => env('SEED_ADMIN_PASSWORD', 'password'),

];
