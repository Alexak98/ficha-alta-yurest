<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BajaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $isCreate = $this->isMethod('POST');

        return [
            // Campos del formulario del frontend (algunos vienen con nombres
            // legacy del workflow original — los aceptamos y los aplanamos
            // dentro de `datos` JSONB en el controller).
            'cliente_nombre' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:200'],
            'cliente_id' => ['nullable', 'string', 'max:64'],
            'cliente_denom' => ['nullable', 'string', 'max:200'],
            'cliente_cif' => ['nullable', 'string', 'max:30'],
            'cliente_email' => ['nullable', 'email', 'max:200'],
            'motivo' => ['nullable', 'string', 'max:200'],
            'motivo_id' => ['nullable', 'string', 'max:64'],
            'fecha_baja' => ['nullable', 'date'],
            'fecha_efecto' => ['nullable', 'date'],
            'implementador' => ['nullable', 'string', 'max:200'],
            'tipo' => ['nullable', 'string', 'max:50'],
            'local' => ['nullable'],
            'modulos' => ['nullable', 'array'],
            'mrr' => ['nullable', 'numeric'],
        ];
    }
}
