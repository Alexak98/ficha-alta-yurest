<?php

namespace App\Http\Resources;

use App\Models\Promocion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Promocion */
class PromocionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'fecha_inicio' => $this->fecha_inicio?->toDateString(),
            'estado' => $this->estado,
            'plazas_manana' => $this->plazas_manana,
            'plazas_tarde' => $this->plazas_tarde,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
