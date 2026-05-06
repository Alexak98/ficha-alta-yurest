<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChurnTecnico;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye los endpoints lectura del workflow `24-churn-tecnico-supabase.json`.
 *
 * El generador IA (workflow con OpenAI + Zendesk) se mueve a un Job en
 * Laravel cuando estén las credenciales. Mientras tanto, n8n sigue
 * upserteando la tabla y este controller solo expone lectura + lookup.
 *
 * Endpoints:
 *   GET  /api/churn/clientes      lista todos
 *   POST /api/churn/buscar-resumen { id_organizacion } → fila concreta
 *   GET  /api/churn/status        contadores (total, sin nivel, hoy, etc.)
 *   POST /api/churn/scan          stub 503 (genera con IA — fase 7+)
 *   POST /api/churn/refresh       stub 503 (regenera todos — fase 7+)
 */
class ChurnTecnicoController extends Controller
{
    public function clientes(): JsonResponse
    {
        $rows = ChurnTecnico::query()->orderByDesc('fecha_resumen')->get();

        return response()->json($rows);
    }

    public function buscarResumen(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id_organizacion' => ['required', 'string', 'max:64'],
        ]);

        $row = ChurnTecnico::query()->where('id_organizacion', $data['id_organizacion'])->first();
        if (! $row) {
            return response()->json(['error' => 'no_encontrado'], 404);
        }

        return response()->json($row);
    }

    public function status(): JsonResponse
    {
        $hoy = now()->startOfDay();

        return response()->json([
            'total' => ChurnTecnico::query()->count(),
            'sin_nivel' => ChurnTecnico::query()->whereNull('nivel')->count(),
            'sin_resumen' => ChurnTecnico::query()->whereNull('fecha_resumen')->count(),
            'actualizados_hoy' => ChurnTecnico::query()->where('fecha_resumen', '>=', $hoy)->count(),
        ]);
    }

    public function scan(): JsonResponse
    {
        return response()->json([
            'error' => 'churn_scan_not_implemented',
            'message' => 'Generador IA aún no migrado. Sigue ejecutándose desde n8n (workflow 24).',
        ], 503);
    }

    public function refresh(): JsonResponse
    {
        return response()->json([
            'error' => 'churn_refresh_not_implemented',
            'message' => 'Regeneración aún no migrada. Sigue ejecutándose desde n8n (workflow 24).',
        ], 503);
    }
}
