<?php

namespace App\Http\Resources;

use App\Models\Local;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Local
 */
class LocalResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ficha_id' => $this->ficha_id,
            'nombre' => $this->nombre,
            'email' => $this->email,
            'calle' => $this->calle,
            'numero' => $this->numero,
            'cp' => $this->cp,
            'sociedad_cif' => $this->sociedad_cif,
            'sociedad_denominacion' => $this->sociedad_denominacion,
            'sociedad_calle' => $this->sociedad_calle,
            'sociedad_numero' => $this->sociedad_numero,
            'sociedad_cp' => $this->sociedad_cp,
            'sociedad_municipio' => $this->sociedad_municipio,
            'sociedad_provincia' => $this->sociedad_provincia,
            'mensualidad' => $this->mensualidad,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
