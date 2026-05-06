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

        $newValue = (bool) $data['grabado_a3'];

        // El schema de proyectos no lleva trigger auto-stamp (a diferencia
        // de fichas_alta), así que lo gestionamos en el controller:
        // - true ←  cualquiera : stampar grabado_a3_at = NOW
        // - false ← true       : limpiar grabado_a3_at
        $update = ['grabado_a3' => $newValue];
        if ($newValue && ! $proyecto->grabado_a3) {
            $update['grabado_a3_at'] = now();
        } elseif (! $newValue && $proyecto->grabado_a3) {
            $update['grabado_a3_at'] = null;
        }
        $proyecto->update($update);

        $fresh = $proyecto->fresh();

        return response()->json([
            'success' => true,
            'id' => $proyecto->id,
            'grabado_a3' => $newValue,
            'grabado_a3_at' => $fresh?->grabado_a3_at?->toIso8601String(),
        ]);
    }
}
