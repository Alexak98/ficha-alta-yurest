<?php

use App\Http\Middleware\CheckPermiso;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'permiso' => CheckPermiso::class,
        ]);
        // statefulApi() activa CSRF para Sanctum SPA (same-origin con cookies),
        // pero usamos Bearer tokens cross-origin (frontend en otro host) →
        // no aplica y rompe con 419 "page expired" en el primer POST.
        // Si en el futuro hace falta modo SPA same-origin, reactivar y
        // configurar SANCTUM_STATEFUL_DOMAINS en .env.
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Forzar respuesta JSON en /api/* y /up aunque el cliente no
        // envíe Accept: application/json. Sin esto Laravel devuelve el
        // debugger HTML en local y eso rompe los frontends que esperan JSON.
        $exceptions->shouldRenderJsonWhen(function ($request) {
            return $request->is('api/*') || $request->is('up');
        });
    })->create();
