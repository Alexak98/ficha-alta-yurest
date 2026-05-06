<?php

namespace App\Http\Resources;

use App\Models\HardwareStock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin HardwareStock
 */
class HardwareStockResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'sku' => $this->sku,
            'categoria' => $this->categoria,
            'descripcion' => $this->descripcion,
            'unidad' => $this->unidad,
            'stock_actual' => $this->stock_actual,
            'stock_minimo' => $this->stock_minimo,
            'precio_compra' => $this->precio_compra,
            'precio_venta' => $this->precio_venta,
            'proveedor' => $this->proveedor,
            'ubicacion' => $this->ubicacion,
            'notas' => $this->notas,
            'bajo_minimo' => $this->stock_actual < $this->stock_minimo,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
