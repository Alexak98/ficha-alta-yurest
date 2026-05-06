<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BajaRequest;
use App\Http\Resources\BajaResource;
use App\Models\Baja;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye el workflow `05-bajas.json`.
 *
 * Endpoints:
 *   GET    /api/bajas                lista todas (no paginadas, < 1k filas)
 *   POST   /api/bajas                crea una baja
 *   PUT    /api/bajas/{baja}         edita
 *   DELETE /api/bajas/{baja}         soft-delete
 */
class BajaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $rows = Baja::query()
            ->whereNull('deleted_at')
            ->orderByDesc('fecha_baja')
            ->orderByDesc('created_at')
            ->get();

        return BajaResource::collection($rows);
    }

    public function store(BajaRequest $request): JsonResponse
    {
        $row = Baja::create($this->mapPayload($request));

        return (new BajaResource($row))->response()->setStatusCode(201);
    }

    public function update(BajaRequest $request, Baja $baja): BajaResource
    {
        $baja->update($this->mapPayload($request));

        return new BajaResource($baja->refresh());
    }

    public function destroy(Baja $baja): JsonResponse
    {
        $baja->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Mapea el payload del frontend a las columnas reales + JSONB `datos`.
     * Replica la lógica del nodo "Preparar Baja" del workflow 05.
     *
     * @return array<string, mixed>
     */
    private function mapPayload(BajaRequest $request): array
    {
        /** @var array<string, mixed> $d */
        $d = $request->validated();

        $clienteId = (string) ($d['cliente_id'] ?? '');
        $isUuid = preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
            $clienteId,
        ) === 1;

        $row = [
            'cliente' => $d['cliente_nombre'] ?? '',
            'motivo' => $d['motivo'] ?? $d['motivo_id'] ?? null,
            'fecha_baja' => $d['fecha_baja'] ?? now()->toDateString(),
            'implementador' => $d['implementador'] ?? null,
            'tipo_cliente' => $d['tipo'] ?? null,
            'datos' => [
                'tipo' => $d['tipo'] ?? null,
                'cliente_id' => $d['cliente_id'] ?? null,
                'cliente_nombre' => $d['cliente_nombre'] ?? null,
                'cliente_denom' => $d['cliente_denom'] ?? null,
                'cliente_cif' => $d['cliente_cif'] ?? null,
                'cliente_email' => $d['cliente_email'] ?? null,
                'motivo_id' => $d['motivo_id'] ?? null,
                'motivo' => $d['motivo'] ?? null,
                'local' => $d['local'] ?? null,
                'modulos' => $d['modulos'] ?? [],
                'mrr' => $d['mrr'] ?? null,
                'fecha_efecto' => $d['fecha_efecto'] ?? null,
            ],
        ];

        if ($isUuid) {
            $row['ficha_id'] = $clienteId;
        }

        return $row;
    }
}
