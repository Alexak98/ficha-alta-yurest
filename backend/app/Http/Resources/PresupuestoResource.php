<?php

namespace App\Http\Resources;

use App\Models\Presupuesto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Presupuesto */
class PresupuestoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'numero_doc' => $this->numero_doc,
            'cliente' => $this->cliente,
            'entorno' => $this->entorno,
            'desarrollo' => $this->desarrollo,
            'enviado' => (bool) $this->enviado,
            'quien_abona' => $this->quien_abona,
            'estado' => $this->estado,
            'horas_yurest' => $this->horas_yurest,
            'coste_yurest' => $this->coste_yurest,
            'horas_cliente' => $this->horas_cliente,
            'coste_cliente' => $this->coste_cliente,
            'estado_entrega' => $this->estado_entrega,
            'notas' => $this->notas,
            'coste_hora_yurest' => $this->coste_hora_yurest,
            'coste_hora_cliente' => $this->coste_hora_cliente,
            'descuento_pct' => $this->descuento_pct,
            // Secciones estructuradas (PDF)
            'contexto' => $this->contexto,
            'objetivo' => $this->objetivo,
            'alcance' => $this->alcance,
            'funcionamiento_esperado' => $this->funcionamiento_esperado,
            'entregables' => $this->entregables,
            'presupuesto_detalle' => $this->presupuesto_detalle,
            'aprobacion' => $this->aprobacion,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
