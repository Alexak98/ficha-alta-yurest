<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación de un local (sede) anidado bajo una ficha.
 */
class LocalRequest extends FormRequest
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
            'nombre' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:200'],
            'email' => ['nullable', 'email', 'max:200'],
            'calle' => ['nullable', 'string', 'max:200'],
            'numero' => ['nullable', 'string', 'max:20'],
            'cp' => ['nullable', 'regex:/^[0-9]{5}$/'],

            // Sociedad
            'sociedad_cif' => ['nullable', 'string', 'max:30'],
            'sociedad_denominacion' => ['nullable', 'string', 'max:200'],
            'sociedad_calle' => ['nullable', 'string', 'max:200'],
            'sociedad_numero' => ['nullable', 'string', 'max:20'],
            'sociedad_cp' => ['nullable', 'string', 'max:20'],
            'sociedad_municipio' => ['nullable', 'string', 'max:200'],
            'sociedad_provincia' => ['nullable', 'string', 'max:200'],

            'mensualidad' => ['nullable', 'numeric'],
        ];
    }
}
