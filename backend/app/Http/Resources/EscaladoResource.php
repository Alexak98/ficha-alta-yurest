<?php

namespace App\Http\Resources;

use App\Models\Escalado;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Escalado */
class EscaladoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ficha_id' => $this->ficha_id,
            'tipo' => $this->tipo,
            'estado' => $this->estado,
            'detalle' => $this->detalle,
            'setup' => $this->setup,
            'recurrencia' => $this->recurrencia,
            'creado_por' => $this->creado_por,
            'notas' => $this->notas,
            'aplicado_at' => $this->aplicado_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
