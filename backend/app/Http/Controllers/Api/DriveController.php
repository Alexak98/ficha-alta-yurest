<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye los nodos Drive del workflow `11-auxiliares.json`.
 *
 * - GET /api/drive?carpetaId=...       devuelve metadatos de carpeta
 * - GET /api/drive/docs-subidos?...    listado de docs subidos por solicitud
 *
 * Stubs 503 hasta integrar Google Drive (mismo razonamiento que
 * CalendarController). El frontend sigue usando n8n.
 */
class DriveController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'error' => 'drive_not_implemented',
            'message' => 'Google Drive aún no está integrado en Laravel. Sigue usando n8n para esta ruta.',
        ], 503);
    }

    public function docsSubidos(Request $request): JsonResponse
    {
        return response()->json([
            'error' => 'drive_not_implemented',
            'message' => 'Google Drive aún no está integrado en Laravel. Sigue usando n8n para esta ruta.',
        ], 503);
    }
}
