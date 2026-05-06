<?php

namespace App\Http\Resources;

use App\Models\HardwarePedido;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin HardwarePedido
 */
class HardwarePedidoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'proyecto_id' => $this->proyecto_id,
            'cliente' => $this->cliente,
            'implementador' => $this->implementador,
            'items' => $this->items ?? [],
            'estado' => $this->estado,
            'proforma_pdf' => $this->proforma_pdf,
            'justificante_pdf' => $this->justificante_pdf,
            'notas_implementador' => $this->notas_implementador,
            'notas_contabilidad' => $this->notas_contabilidad,
            'solicitado_por' => $this->solicitado_por,
            'solicitado_at' => $this->solicitado_at?->toIso8601String(),
            'proforma_at' => $this->proforma_at?->toIso8601String(),
            'pagado_at' => $this->pagado_at?->toIso8601String(),
            'confirmado_at' => $this->confirmado_at?->toIso8601String(),
            'enviado_at' => $this->enviado_at?->toIso8601String(),
            'enviado_por' => $this->enviado_por,
            'sepa_mandato_id' => $this->sepa_mandato_id,
            'sepa_snapshot' => $this->sepa_snapshot,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
