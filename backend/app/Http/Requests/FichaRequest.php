<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validación de fichas_alta — usado en POST /api/fichas y PUT /api/fichas/{id}.
 *
 * En PUT permitimos actualizaciones parciales: cualquier campo que no
 * venga en el body se ignora (no se sobrescribe a null). Las reglas
 * apuntan a `nullable` en lugar de `required` por la misma razón —
 * solo `denominacion` es obligatorio en creación, y eso lo verifica
 * `prepareForValidation` mediante el método HTTP.
 */
class FichaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permisos los aplica el middleware permiso:fichas,write
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $isCreate = $this->isMethod('POST');

        return [
            'comercial' => ['nullable', 'string', 'max:200'],
            'implementador' => ['nullable', 'string', 'max:200'],
            'denominacion' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:200'],
            'nombre_comercial' => ['nullable', 'string', 'max:200'],
            'cif' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:200'],
            'email_factura' => ['nullable', 'email', 'max:200'],
            'email_cc' => ['nullable', 'string', 'max:500'],
            'tipo_cliente' => ['nullable', 'in:lite,planes,corporate,corporate_cp,corp_cocina'],

            // Dirección fiscal
            'calle' => ['nullable', 'string', 'max:200'],
            'numero' => ['nullable', 'string', 'max:20'],
            'cp' => ['nullable', 'regex:/^[0-9]{5}$/'],
            'municipio' => ['nullable', 'string', 'max:200'],
            'provincia' => ['nullable', 'string', 'max:200'],

            // Jefe de proyecto
            'jp_nombre' => ['nullable', 'string', 'max:100'],
            'jp_apellidos' => ['nullable', 'string', 'max:100'],
            'jp_rol' => ['nullable', 'string', 'max:100'],
            'jp_telefono' => ['nullable', 'string', 'max:30'],
            'jp_mail' => ['nullable', 'email', 'max:200'],

            // Firmante
            'firm_nombre' => ['nullable', 'string', 'max:100'],
            'firm_apellidos' => ['nullable', 'string', 'max:100'],
            'firm_mail' => ['nullable', 'email', 'max:200'],
            'firm_dni' => ['nullable', 'string', 'max:30'],
            'firm_puesto' => ['nullable', 'string', 'max:100'],

            // Servicios
            'firmas_contratadas' => ['nullable', 'in:,100,200,300'],
            'ocr_activo' => ['nullable', 'boolean'],
            'lite' => ['nullable', 'boolean'],

            // TPV
            'tpv' => ['nullable', 'string', 'max:200'],
            'tpv_contacto' => ['nullable', 'string', 'max:200'],
            'tpv_email' => ['nullable', 'email', 'max:200'],
            'tpv_no_integrado' => ['nullable', 'boolean'],
            'tpv_ni_nombre' => ['nullable', 'string', 'max:200'],
            'tpv_ni_contacto' => ['nullable', 'string', 'max:200'],
            'tpv_ni_email' => ['nullable', 'email', 'max:200'],

            // Entrega
            'entrega_calle' => ['nullable', 'string', 'max:200'],
            'entrega_numero' => ['nullable', 'string', 'max:20'],
            'entrega_cp' => ['nullable', 'regex:/^[0-9]{5}$/'],
            'entrega_municipio' => ['nullable', 'string', 'max:200'],
            'entrega_provincia' => ['nullable', 'string', 'max:200'],

            // Contacto entrega
            'contacto_nombre' => ['nullable', 'string', 'max:200'],
            'contacto_email' => ['nullable', 'email', 'max:200'],
            'contacto_telefono' => ['nullable', 'string', 'max:30'],

            // Financiero
            'iban' => ['nullable', 'string', 'max:34'],
            'importe_setup' => ['nullable', 'numeric'],
            'descuento_setup' => ['nullable', 'numeric'],
            'mensualidad_total' => ['nullable', 'numeric'],
            'mensualidad_total_locales' => ['nullable', 'numeric'],
            'fin_implementacion' => ['nullable', 'numeric'],
            'fin_basic' => ['nullable', 'numeric'],
            'fin_pro' => ['nullable', 'numeric'],
            'fin_rrhh' => ['nullable', 'numeric'],
            'fin_operaciones' => ['nullable', 'numeric'],
            'fin_lite' => ['nullable', 'numeric'],
            'fin_integraciones' => ['nullable', 'numeric'],
            'fin_mensualidad_anual' => ['nullable', 'numeric'],

            // Distribuidor
            'distribuidor' => ['nullable', 'boolean'],
            'dist_empresa' => ['nullable', 'string', 'max:200'],
            'dist_cif' => ['nullable', 'string', 'max:30'],
            'dist_direccion' => ['nullable', 'string', 'max:200'],
            'dist_cp' => ['nullable', 'string', 'max:20'],
            'dist_contacto' => ['nullable', 'string', 'max:200'],
            'dist_mail' => ['nullable', 'email', 'max:200'],
            'dist_telefono' => ['nullable', 'string', 'max:30'],
            'dist_comision' => ['nullable', 'numeric'],

            // Credenciales
            'cred_master' => ['nullable', 'string', 'max:500'],
            'cred_yurest' => ['nullable', 'string', 'max:500'],

            // Otros
            'paquetes_carrito' => ['nullable', 'array'],
            'comentarios' => ['nullable', 'string'],
            'baja' => ['nullable', 'in:No,Sí,Si'],
            'estado' => ['nullable', 'in:pendiente,completada,en_proceso,rellenado,Rellenado'],
        ];
    }
}
