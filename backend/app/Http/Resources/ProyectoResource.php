<?php

namespace App\Http\Resources;

use App\Models\Proyecto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Proyecto
 */
class ProyectoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ficha_id' => $this->ficha_id,
            'cliente' => $this->cliente,
            'implementador' => $this->implementador,
            'tipo' => $this->tipo,
            'estado' => $this->estado,
            'fecha_inicio' => $this->fecha_inicio?->toDateString(),
            'ultima_actividad' => $this->ultima_actividad?->toDateString(),
            'tpv' => $this->tpv,
            'motivo_pausa' => $this->motivo_pausa,
            'plan_accion' => $this->plan_accion,
            'asana_project_id' => $this->asana_project_id,
            'asana_project_url' => $this->asana_project_url,
            'anotaciones' => $this->anotaciones ?? [],
            'contactos' => $this->contactos ?? [],
            'adjuntos' => $this->adjuntos ?? [],
            'secciones' => $this->secciones ?? [],
            'sepa_mandato' => $this->sepa_mandato,
            'grabado_a3' => (bool) $this->grabado_a3,
            'grabado_a3_at' => $this->grabado_a3_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
