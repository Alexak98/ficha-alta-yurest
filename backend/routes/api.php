<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FichaController;
use App\Http\Controllers\Api\LocalController;
use App\Http\Controllers\Api\ProyectoController;
use App\Http\Controllers\Api\ProyectoHistorialController;
use App\Http\Controllers\Api\SolicitudController;
use App\Http\Controllers\Api\TareaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Mapeo workflow n8n → Laravel. Ver docs/MIGRATION-LARAVEL.md §5.
| Las rutas legacy con UUIDs largos (ej. /webhook/57e0...a147) se
| montarán como aliases durante el cutover, en routes/api-legacy.php.
*/

// Health check para Forge / uptime monitors
Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'app' => config('app.name'),
    'env' => config('app.env'),
    'time' => now()->toIso8601String(),
]));

// === Auth (sustituye 16-auth.json) ===
Route::post('/auth/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

// === Solicitudes (sustituye 08-solicitudes.json) ===
// Endpoint público — el cliente entra desde email con access_token
Route::post('/solicitudes/responder', [SolicitudController::class, 'responder']);

Route::middleware('auth:sanctum')->group(function () {
    Route::middleware('permiso:solicitudes,read')->group(function () {
        Route::get('/solicitudes', [SolicitudController::class, 'index']);
        Route::get('/solicitudes/{solicitud}', [SolicitudController::class, 'show']);
    });
    Route::middleware('permiso:solicitudes,write')->group(function () {
        Route::post('/solicitudes', [SolicitudController::class, 'store']);
    });
    Route::middleware('permiso:solicitudes,delete')->group(function () {
        Route::delete('/solicitudes/{solicitud}', [SolicitudController::class, 'destroy']);
    });

    // === Fichas (sustituye 04-fichas-alta + 12-completar-ficha + 09-rellenado-cliente) ===
    Route::middleware('permiso:fichas,read')->group(function () {
        Route::get('/fichas', [FichaController::class, 'index']);
        Route::get('/fichas/{ficha}', [FichaController::class, 'show']);
        Route::get('/fichas/{ficha}/locales', [LocalController::class, 'index']);
    });
    Route::middleware('permiso:fichas,write')->group(function () {
        Route::post('/fichas', [FichaController::class, 'store']);
        Route::put('/fichas/{ficha}', [FichaController::class, 'update']);
        Route::post('/fichas/{ficha}/locales', [LocalController::class, 'store']);
        Route::put('/fichas/{ficha}/locales/{local}', [LocalController::class, 'update']);
    });
    Route::middleware('permiso:fichas,delete')->group(function () {
        Route::delete('/fichas/{ficha}', [FichaController::class, 'destroy']);
        Route::delete('/fichas/{ficha}/locales/{local}', [LocalController::class, 'destroy']);
    });

    // === Proyectos (sustituye 01-proyectos-crud + 02-proyectos-tareas + 18-proyectos-historial) ===
    Route::middleware('permiso:proyectos,read')->group(function () {
        Route::get('/proyectos', [ProyectoController::class, 'index']);
        Route::get('/proyectos/{proyecto}', [ProyectoController::class, 'show']);
        Route::get('/proyectos/{proyecto}/historial', [ProyectoHistorialController::class, 'index']);
    });
    Route::middleware('permiso:proyectos,write')->group(function () {
        Route::post('/proyectos', [ProyectoController::class, 'store']);
        Route::put('/proyectos/{proyecto}', [ProyectoController::class, 'update']);
        Route::put('/proyectos/{proyecto}/tareas', [TareaController::class, 'update']);
        Route::put('/proyectos/{proyecto}/tareas/mover', [TareaController::class, 'mover']);
        Route::put('/proyectos/{proyecto}/anotaciones', [TareaController::class, 'anotaciones']);
        Route::post('/proyectos/{proyecto}/historial', [ProyectoHistorialController::class, 'store']);
    });
    Route::middleware('permiso:proyectos,delete')->group(function () {
        Route::delete('/proyectos/{proyecto}', [ProyectoController::class, 'destroy']);
    });
});
