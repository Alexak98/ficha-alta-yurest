<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SolicitudController;
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
});
