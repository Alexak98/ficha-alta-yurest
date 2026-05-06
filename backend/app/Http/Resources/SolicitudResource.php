<?php

namespace App\Http\Resources;

use App\Models\Solicitud;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Solicitud
 */
class SolicitudResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ficha_id' => $this->ficha_id,
            'ficha' => $this->whenLoaded('ficha'),
            'tipo' => $this->tipo,
            'estado' => $this->estado,
            'asignado_a' => $this->asignado_a,
            'access_token' => $this->access_token,
            'fecha_vencimiento' => $this->fecha_vencimiento?->toDateString(),
            'documentos' => $this->documentos ?? [],
            'notas' => $this->notas,
            'datos' => $this->datos ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
