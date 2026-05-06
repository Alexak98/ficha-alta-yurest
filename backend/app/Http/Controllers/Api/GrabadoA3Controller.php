<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proyecto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sustituye el workflow `13-grabado-a3.json`. Toggle del flag grabado_a3
 * en un proyecto. El timestamp grabado_a3_at lo gestiona el trigger del
 * schema base.
 *
 * Endpoint:
 *   POST /api/proyectos/{proyecto}/grabado-a3  body: { grabado_a3 }
 */
class GrabadoA3Controller extends Controller
{
    public function update(Request $request, Proyecto $proyecto): JsonResponse
    {
        $data = $request->validate([
            'grabado_a3' => ['required', 'boolean'],
        ]);

        $proyecto->update(['grabado_a3' => $data['grabado_a3']]);

        return response()->json([
            'success' => true,
            'id' => $proyecto->id,
            'grabado_a3' => (bool) $data['grabado_a3'],
            'grabado_a3_at' => $proyecto->fresh()->grabado_a3_at?->toIso8601String(),
        ]);
    }
}
