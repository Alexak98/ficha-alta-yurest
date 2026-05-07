<?php

namespace App\Http\Resources;

use App\Models\Baja;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Baja
 */
class BajaResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $datos = $this->datos ?? [];

        return [
            'id' => $this->id,
            'ficha_id' => $this->ficha_id,
            'cliente' => $this->cliente,
            'motivo' => $this->motivo,
            'fecha_baja' => $this->fecha_baja?->toDateString(),
            'implementador' => $this->implementador,
            'tipo_cliente' => $this->tipo_cliente,

            // Aplanamos campos del JSONB datos al nivel raíz para que el
            // frontend los lea directamente (mismo comportamiento del workflow 05).
            'cliente_id' => $datos['cliente_id'] ?? null,
            'cliente_nombre' => $datos['cliente_nombre'] ?? null,
            'cliente_comercial' => $datos['cliente_comercial'] ?? null,
            'cliente_denom' => $datos['cliente_denom'] ?? null,
            'cliente_cif' => $datos['cliente_cif'] ?? null,
            'cliente_email' => $datos['cliente_email'] ?? null,
            'motivo_id' => $datos['motivo_id'] ?? null,
            'local' => $datos['local'] ?? null,
            'modulos' => $datos['modulos'] ?? [],
            'mrr' => $datos['mrr'] ?? null,
            'fecha_efecto' => $datos['fecha_efecto'] ?? null,

            'datos' => $datos,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
