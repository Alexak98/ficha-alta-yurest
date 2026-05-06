<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProyectoRequest extends FormRequest
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
            'ficha_id' => ['nullable', 'uuid'],
            'cliente' => [$req, 'string', 'max:200'],
            'implementador' => [$req, 'string', 'max:200'],
            'tipo' => [$req, 'in:Planes,Corporate sin cocina,Corporate con cocina'],
            'estado' => ['nullable', 'in:activo,completado,pausado'],
            'fecha_inicio' => ['nullable', 'date'],
            'ultima_actividad' => ['nullable', 'date'],
            'tpv' => ['nullable', 'string', 'max:200'],
            'motivo_pausa' => ['nullable', 'string'],
            'plan_accion' => ['nullable', 'string'],
            'asana_project_id' => ['nullable', 'string', 'max:200'],
            'asana_project_url' => ['nullable', 'url', 'max:500'],
            'anotaciones' => ['nullable', 'array'],
            'contactos' => ['nullable', 'array'],
            'adjuntos' => ['nullable', 'array'],
            'secciones' => ['nullable', 'array'],
        ];
    }
}
