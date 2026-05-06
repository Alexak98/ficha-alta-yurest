<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class HardwarePedidoRequest extends FormRequest
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
            'proyecto_id' => ['nullable', 'uuid'],
            'cliente' => [$req, 'string', 'max:200'],
            'implementador' => ['nullable', 'string', 'max:200'],
            'items' => [$req, 'array'],
            'items.*.nombre' => ['required_with:items', 'string'],
            'items.*.cantidad' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unidad' => ['nullable', 'string'],
            'items.*.notas' => ['nullable', 'string'],
            'estado' => ['nullable', 'in:solicitada,proforma_adjuntada,pendiente_confirmar,lista_envio,enviado'],
            'proforma_pdf' => ['nullable', 'array'],
            'justificante_pdf' => ['nullable', 'array'],
            'notas_implementador' => ['nullable', 'string'],
            'notas_contabilidad' => ['nullable', 'string'],
            'solicitado_por' => ['nullable', 'string', 'max:200'],
            'enviado_por' => ['nullable', 'string', 'max:200'],
            'sepa_mandato_id' => ['nullable', 'uuid'],
            'sepa_snapshot' => ['nullable', 'array'],
        ];
    }
}
