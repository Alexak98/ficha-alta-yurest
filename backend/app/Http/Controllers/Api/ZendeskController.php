<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResumenMensual;
use App\Models\ResumenSemanal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye los workflows 25, 26-ia, 28, 29 (Zendesk heatmaps + resúmenes IA).
 *
 * Endpoints:
 *   GET /api/zendesk/heatmap                 stub 503 hasta integrar Zendesk API
 *   GET /api/zendesk/heatmap/ia              stub 503 hasta integrar OpenAI
 *   GET /api/zendesk/resumen?periodo=semana  lee de caché si existe; 503 si no
 *   GET /api/zendesk/resumen?periodo=mes     idem
 *
 * Las tablas resumenes_semanales/mensuales sí se exponen (lectura del caché)
 * para que el frontend pueda hidratar datos históricos ya generados por n8n.
 *
 * El generador real (con Zendesk + OpenAI) se completa en fase 6 con Jobs.
 */
class ZendeskController extends Controller
{
    public function heatmap(): JsonResponse
    {
        return response()->json([
            'error' => 'zendesk_not_implemented',
            'message' => 'Zendesk heatmap aún se sirve desde n8n. Migración pendiente fase 6.',
        ], 503);
    }

    public function heatmapIa(): JsonResponse
    {
        return response()->json([
            'error' => 'zendesk_ia_not_implemented',
            'message' => 'Zendesk heatmap IA aún se sirve desde n8n. Requiere integración OpenAI.',
        ], 503);
    }

    public function resumen(Request $request): JsonResponse
    {
        $data = $request->validate([
            'periodo' => ['required', 'in:semana,mes'],
            'anio' => ['nullable', 'integer', 'min:2020', 'max:2100'],
            'semana' => ['nullable', 'integer', 'min:1', 'max:53'],
            'mes' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        if ($data['periodo'] === 'semana') {
            $cached = ResumenSemanal::query()
                ->when($data['anio'] ?? null, fn ($q, $v) => $q->where('anio', $v))
                ->when($data['semana'] ?? null, fn ($q, $v) => $q->where('semana', $v))
                ->orderByDesc('anio')->orderByDesc('semana')
                ->first();
        } else {
            $cached = ResumenMensual::query()
                ->when($data['anio'] ?? null, fn ($q, $v) => $q->where('anio', $v))
                ->when($data['mes'] ?? null, fn ($q, $v) => $q->where('mes', $v))
                ->orderByDesc('anio')->orderByDesc('mes')
                ->first();
        }

        if (! $cached) {
            return response()->json([
                'error' => 'resumen_no_cacheado',
                'message' => 'Aún no se ha generado este resumen. n8n lo crea bajo demanda; Laravel solo expone la caché.',
            ], 503);
        }

        return response()->json($cached);
    }
}
