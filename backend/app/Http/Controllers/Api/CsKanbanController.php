<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CsEstadoHistorial;
use App\Models\FichaAlta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sustituye el workflow `27-cs-kanban.json`. Mueve un cliente entre
 * columnas del kanban CS y registra la transición en el historial.
 *
 * Endpoint:
 *   POST /api/cs/estado  body: { ficha_id, estado_hasta, notas?, movido_por? }
 */
class CsKanbanController extends Controller
{
    private const ESTADOS_VALIDOS = [
        'en_implementacion', 'post_primer_mes', 'reunion_post_1_mes_agendada',
        'posible_escalado', 'stand_by', 'critico', 'sanacion', 'post_3_meses',
    ];

    public function updateEstado(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ficha_id' => ['required', 'uuid', 'exists:fichas_alta,id'],
            'estado_hasta' => ['required', 'in:'.implode(',', self::ESTADOS_VALIDOS)],
            'notas' => ['nullable', 'string'],
            'movido_por' => ['nullable', 'string', 'max:200'],
        ]);

        return DB::transaction(function () use ($data) {
            /** @var FichaAlta $ficha */
            $ficha = FichaAlta::query()->findOrFail($data['ficha_id']);
            $estadoDesde = $ficha->getAttribute('cs_estado');

            $ficha->forceFill(['cs_estado' => $data['estado_hasta']])->save();

            CsEstadoHistorial::create([
                'ficha_id' => $ficha->id,
                'estado_desde' => $estadoDesde,
                'estado_hasta' => $data['estado_hasta'],
                'movido_por' => $data['movido_por'] ?? null,
                'notas' => $data['notas'] ?? null,
            ]);

            return response()->json([
                'ok' => true,
                'ficha_id' => $ficha->id,
                'estado_desde' => $estadoDesde,
                'estado_hasta' => $data['estado_hasta'],
            ]);
        });
    }
}
