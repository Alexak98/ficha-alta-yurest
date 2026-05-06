<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware de permisos granulares: replica `permisos.{read,write,delete}`
 * de la tabla `users` (heredado de `js/lib/permisos-defs.js`).
 *
 * Uso en routes/api.php:
 *   Route::middleware('permiso:solicitudes,read')->get(...)
 *   Route::middleware('permiso:solicitudes,write')->post(...)
 *
 * `admin` pasa todo. Los demás roles consultan su array `permisos[$accion]`.
 */
class CheckPermiso
{
    public function handle(Request $request, Closure $next, string $pageId, string $accion): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        if (! $user->tienePermiso($pageId, $accion)) {
            return response()->json([
                'error' => "Sin permiso $accion sobre $pageId",
            ], 403);
        }

        return $next($request);
    }
}
