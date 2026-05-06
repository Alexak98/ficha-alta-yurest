<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PromocionRequest extends FormRequest
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
            'descripcion' => ['nullable', 'string'],
            'fecha_inicio' => ['nullable', 'date'],
            'estado' => ['nullable', 'in:activa,cerrada'],
            'plazas_manana' => ['nullable', 'integer', 'min:0'],
            'plazas_tarde' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
