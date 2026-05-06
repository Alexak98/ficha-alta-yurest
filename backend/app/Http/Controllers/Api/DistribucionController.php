<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DistribucionResource;
use App\Models\Distribucion;
use App\Models\FichaAlta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Sustituye el workflow `06-distribucion.json`.
 *
 * Asigna un implementador a una ficha haciendo dos cosas en una transacción:
 *   1. UPDATE fichas_alta SET implementador = ? WHERE id = ?
 *   2. INSERT INTO distribucion (audit trail con datos del payload)
 *
 * Endpoint:
 *   POST /api/distribucion  body: { id|ficha_id, implementador, ... }
 */
class DistribucionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required_without:ficha_id', 'uuid'],
            'ficha_id' => ['required_without:id', 'uuid'],
            'implementador' => ['required', 'string', 'max:200'],
        ]);

        $fichaId = $data['id'] ?? $data['ficha_id'];

        /** @var Distribucion $distri */
        $distri = DB::transaction(function () use ($fichaId, $data, $request) {
            FichaAlta::query()
                ->where('id', $fichaId)
                ->update(['implementador' => $data['implementador']]);

            return Distribucion::create([
                'ficha_id' => $fichaId,
                'implementador' => $data['implementador'],
                'datos' => $request->all(),
            ]);
        });
        $distri->refresh();

        return (new DistribucionResource($distri))->response()->setStatusCode(201);
    }
}
