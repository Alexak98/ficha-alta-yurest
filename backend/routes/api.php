<?php

use App\Http\Controllers\Api\AsanaController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BajaController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\ChurnTecnicoController;
use App\Http\Controllers\Api\CsKanbanController;
use App\Http\Controllers\Api\DistribucionController;
use App\Http\Controllers\Api\DriveController;
use App\Http\Controllers\Api\EliminarController;
use App\Http\Controllers\Api\EscaladoController;
use App\Http\Controllers\Api\FichaController;
use App\Http\Controllers\Api\FichaHistorialController;
use App\Http\Controllers\Api\GrabadoA3Controller;
use App\Http\Controllers\Api\HardwarePedidoController;
use App\Http\Controllers\Api\HardwareStockController;
use App\Http\Controllers\Api\LocalController;
use App\Http\Controllers\Api\NotificarFichaCompletaController;
use App\Http\Controllers\Api\NotifIntegracionesController;
use App\Http\Controllers\Api\PresupuestoController;
use App\Http\Controllers\Api\PromocionController;
use App\Http\Controllers\Api\ProyectoController;
use App\Http\Controllers\Api\ProyectoHistorialController;
use App\Http\Controllers\Api\SolicitudController;
use App\Http\Controllers\Api\TareaController;
use App\Http\Controllers\Api\ZendeskController;
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
        // Reenviar email al cliente (botón ✉ del listado de solicitudes).
        Route::post('/solicitudes/{solicitud}/reenviar', [SolicitudController::class, 'reenviar']);
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

    // === Bajas (sustituye 05-bajas) ===
    Route::middleware('permiso:bajas,read')->group(function () {
        Route::get('/bajas', [BajaController::class, 'index']);
    });
    Route::middleware('permiso:bajas,write')->group(function () {
        Route::post('/bajas', [BajaController::class, 'store']);
        Route::put('/bajas/{baja}', [BajaController::class, 'update']);
    });
    Route::middleware('permiso:bajas,delete')->group(function () {
        Route::delete('/bajas/{baja}', [BajaController::class, 'destroy']);
    });

    // === Distribución (sustituye 06-distribucion) ===
    // Asigna implementador a ficha (1 endpoint POST, mismo permiso que escritura de fichas).
    Route::middleware('permiso:distribucion,write')->group(function () {
        Route::post('/distribucion', [DistribucionController::class, 'store']);
    });

    // === Hardware pedidos (sustituye 21-hardware-pedidos) ===
    Route::middleware('permiso:hardware,read')->group(function () {
        Route::get('/hardware/pedidos', [HardwarePedidoController::class, 'index']);
        Route::get('/hardware/pedidos/{pedido}', [HardwarePedidoController::class, 'show']);
    });
    Route::middleware('permiso:hardware,write')->group(function () {
        Route::post('/hardware/pedidos', [HardwarePedidoController::class, 'store']);
        Route::put('/hardware/pedidos/{pedido}', [HardwarePedidoController::class, 'update']);
    });
    Route::middleware('permiso:hardware,delete')->group(function () {
        Route::delete('/hardware/pedidos/{pedido}', [HardwarePedidoController::class, 'destroy']);
    });

    // === Hardware stock (sustituye 23-hardware-stock) ===
    Route::middleware('permiso:stock,read')->group(function () {
        Route::get('/hardware/stock', [HardwareStockController::class, 'index']);
        Route::get('/hardware/stock/{articulo}', [HardwareStockController::class, 'show']);
    });
    Route::middleware('permiso:stock,write')->group(function () {
        Route::post('/hardware/stock', [HardwareStockController::class, 'store']);
        Route::put('/hardware/stock/{articulo}', [HardwareStockController::class, 'update']);
    });
    Route::middleware('permiso:stock,delete')->group(function () {
        Route::delete('/hardware/stock/{articulo}', [HardwareStockController::class, 'destroy']);
    });

    // === Promociones (sustituye 20-promociones) ===
    Route::middleware('permiso:promociones,read')->group(function () {
        Route::get('/promociones', [PromocionController::class, 'index']);
        Route::get('/promociones/{promocion}', [PromocionController::class, 'show']);
    });
    Route::middleware('permiso:promociones,write')->group(function () {
        Route::post('/promociones', [PromocionController::class, 'store']);
        Route::put('/promociones/{promocion}', [PromocionController::class, 'update']);
    });
    Route::middleware('permiso:promociones,delete')->group(function () {
        Route::delete('/promociones/{promocion}', [PromocionController::class, 'destroy']);
    });

    // === Presupuestos (sustituye 22-presupuestos) ===
    Route::middleware('permiso:presupuestos,read')->group(function () {
        Route::get('/presupuestos', [PresupuestoController::class, 'index']);
        Route::get('/presupuestos/{presupuesto}', [PresupuestoController::class, 'show']);
    });
    Route::middleware('permiso:presupuestos,write')->group(function () {
        Route::post('/presupuestos', [PresupuestoController::class, 'store']);
        Route::put('/presupuestos/{presupuesto}', [PresupuestoController::class, 'update']);
    });
    Route::middleware('permiso:presupuestos,delete')->group(function () {
        Route::delete('/presupuestos/{presupuesto}', [PresupuestoController::class, 'destroy']);
    });

    // === Escalados (sustituye 26-escalados) ===
    Route::middleware('permiso:escalados,read')->group(function () {
        Route::get('/escalados', [EscaladoController::class, 'index']);
        Route::get('/escalados/{escalado}', [EscaladoController::class, 'show']);
    });
    Route::middleware('permiso:escalados,write')->group(function () {
        Route::post('/escalados', [EscaladoController::class, 'store']);
        Route::put('/escalados/{escalado}', [EscaladoController::class, 'update']);
    });
    Route::middleware('permiso:escalados,delete')->group(function () {
        Route::delete('/escalados/{escalado}', [EscaladoController::class, 'destroy']);
    });

    // === CS Kanban (sustituye 27-cs-kanban) ===
    Route::middleware('permiso:cs-kanban,write')->group(function () {
        Route::post('/cs/estado', [CsKanbanController::class, 'updateEstado']);
    });

    // === Grabado A3 (sustituye 13-grabado-a3) ===
    Route::middleware('permiso:contabilidad,write')->group(function () {
        Route::post('/proyectos/{proyecto}/grabado-a3', [GrabadoA3Controller::class, 'update']);
    });

    // === Historial fichas (sustituye 17-historial) ===
    Route::middleware('permiso:fichas,read')->group(function () {
        Route::get('/historial', [FichaHistorialController::class, 'index']);
    });
    Route::middleware('permiso:fichas,write')->group(function () {
        Route::post('/historial', [FichaHistorialController::class, 'store']);
    });

    // === Notificación ficha completa (sustituye 19-notif-ficha-completa) ===
    Route::middleware('permiso:fichas,write')->group(function () {
        Route::post('/fichas/{ficha}/notificar-completa', [NotificarFichaCompletaController::class, 'notificar'])
            ->where('ficha', '[0-9a-f-]+');
    });

    // === Asana proxy (sustituye nodos Asana del workflow 07) ===
    Route::middleware('permiso:proyectos,read')->group(function () {
        Route::get('/asana/tasks', [AsanaController::class, 'tasks']);
        Route::get('/asana/tasks/{taskId}/stories', [AsanaController::class, 'stories']);
    });

    // === Calendar proxy (sustituye nodo Calendar del workflow 07) ===
    Route::middleware('permiso:proyectos,write')->group(function () {
        Route::post('/calendar/events', [CalendarController::class, 'store']);
    });

    // === Drive proxy (sustituye nodos Drive del workflow 11) ===
    Route::middleware('permiso:fichas,read')->group(function () {
        Route::get('/drive', [DriveController::class, 'show']);
        Route::get('/drive/docs-subidos', [DriveController::class, 'docsSubidos']);
    });

    // === Eliminar genérico (sustituye 10-eliminar) ===
    // Acepta { id, entity? } y soft-deletea en la tabla correspondiente.
    // Existe como compat para frontend legacy; los DELETEs específicos por
    // recurso ya están disponibles (DELETE /api/fichas/{id}, etc).
    Route::middleware('permiso:fichas,delete')->group(function () {
        Route::post('/eliminar', [EliminarController::class, 'eliminar']);
    });

    // === Notificaciones automáticas integraciones (sustituye 15) ===
    Route::middleware('permiso:integraciones,read')->group(function () {
        Route::get('/notif-integraciones/config', [NotifIntegracionesController::class, 'getConfig']);
        Route::get('/notif-integraciones/historial', [NotifIntegracionesController::class, 'getHistorial']);
    });
    Route::middleware('permiso:integraciones,write')->group(function () {
        Route::put('/notif-integraciones/config', [NotifIntegracionesController::class, 'updateConfig']);
        Route::post('/notif-integraciones/grupos', [NotifIntegracionesController::class, 'gruposAction']);
    });

    // === Churn técnico (sustituye 24-churn-tecnico-supabase, parcial) ===
    Route::middleware('permiso:churn-tecnico,read')->group(function () {
        Route::get('/churn/clientes', [ChurnTecnicoController::class, 'clientes']);
        Route::get('/churn/status', [ChurnTecnicoController::class, 'status']);
        Route::post('/churn/buscar-resumen', [ChurnTecnicoController::class, 'buscarResumen']);
    });
    Route::middleware('permiso:churn-tecnico,write')->group(function () {
        Route::post('/churn/scan', [ChurnTecnicoController::class, 'scan']);
        Route::post('/churn/refresh', [ChurnTecnicoController::class, 'refresh']);
    });

    // === Zendesk heatmap + resúmenes (sustituye 25, 26-ia, 28, 29) ===
    // Heatmap y heatmap-IA son stubs 503 (n8n sigue sirviéndolos).
    // /resumen lee de la caché si existe; el generador real va en fase 6.
    Route::middleware('permiso:zendesk,read')->group(function () {
        Route::get('/zendesk/heatmap', [ZendeskController::class, 'heatmap']);
        Route::get('/zendesk/heatmap/ia', [ZendeskController::class, 'heatmapIa']);
        Route::get('/zendesk/resumen', [ZendeskController::class, 'resumen']);
    });
});
