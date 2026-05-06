<?php

namespace App\Http\Resources;

use App\Models\Distribucion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Distribucion
 */
class DistribucionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'implementador' => $this->implementador,
            'ficha_id' => $this->ficha_id,
            'datos' => $this->datos ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
