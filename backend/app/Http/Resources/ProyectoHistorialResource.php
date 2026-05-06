<?php

namespace App\Http\Resources;

use App\Models\ProyectoHistorial;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProyectoHistorial
 */
class ProyectoHistorialResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'proyecto_id' => $this->proyecto_id,
            'usuario_id' => $this->usuario_id,
            'usuario_nombre' => $this->usuario_nombre,
            'usuario_rol' => $this->usuario_rol,
            'accion' => $this->accion,
            'seccion_nombre' => $this->seccion_nombre,
            'tarea_id' => $this->tarea_id,
            'tarea_nombre' => $this->tarea_nombre,
            'descripcion' => $this->descripcion,
            'cambios' => $this->cambios ?? [],
            'metadata' => $this->metadata ?? [],
            'creado_at' => $this->creado_at->toIso8601String(),
        ];
    }
}
