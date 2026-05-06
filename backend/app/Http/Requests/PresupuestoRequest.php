<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PresupuestoRequest extends FormRequest
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
            'cliente' => [$req, 'string', 'max:200'],
            'entorno' => [$req, 'in:backoffice,app_cliente'],
            'desarrollo' => [$req, 'string'],
            'enviado' => ['nullable', 'boolean'],
            'quien_abona' => ['nullable', 'in:yurest,cliente'],
            'estado' => ['nullable', 'in:aceptado,en_espera,pagado_50,pagado'],
            'horas_yurest' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'coste_yurest' => ['nullable', 'numeric', 'min:0'],
            'horas_cliente' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'coste_cliente' => ['nullable', 'numeric', 'min:0'],
            'estado_entrega' => ['nullable', 'in:pendiente,en_progreso,entregado'],
            'notas' => ['nullable', 'string'],
            'coste_hora_yurest' => ['nullable', 'numeric', 'min:0'],
            'coste_hora_cliente' => ['nullable', 'numeric', 'min:0'],
            'descuento_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'contexto' => ['nullable', 'string'],
            'objetivo' => ['nullable', 'string'],
            'alcance' => ['nullable', 'string'],
            'funcionamiento_esperado' => ['nullable', 'string'],
            'entregables' => ['nullable', 'string'],
            'presupuesto_detalle' => ['nullable', 'string'],
            'aprobacion' => ['nullable', 'string'],
        ];
    }
}
