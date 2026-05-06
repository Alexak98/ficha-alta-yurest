<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class HardwareStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $isCreate = $this->isMethod('POST');
        $req = $isCreate ? 'required' : 'sometimes';

        return [
            'nombre' => [$req, 'string', 'max:200'],
            'sku' => ['nullable', 'string', 'max:64'],
            'categoria' => ['nullable', 'in:tablet,soporte,cargador,cable,impresora,cajon,balanza,lector,router,etiqueta,pantalla,sensor,funda,otro'],
            'descripcion' => ['nullable', 'string'],
            'unidad' => ['nullable', 'string', 'max:30'],
            'stock_actual' => ['nullable', 'integer', 'min:0'],
            'stock_minimo' => ['nullable', 'integer', 'min:0'],
            'precio_compra' => ['nullable', 'numeric', 'min:0'],
            'precio_venta' => ['nullable', 'numeric', 'min:0'],
            'proveedor' => ['nullable', 'string', 'max:200'],
            'ubicacion' => ['nullable', 'string', 'max:200'],
            'notas' => ['nullable', 'string'],
        ];
    }
}
