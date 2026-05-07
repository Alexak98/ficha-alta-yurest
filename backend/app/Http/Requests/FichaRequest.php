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
    /**
     * Mapeo de keys del shape legacy del frontend (capitalizadas, español)
     * al shape snake_case interno. Replica la traducción que hacía el
     * workflow `04-fichas-alta.json` en el nodo "Preparar Ficha".
     *
     * @var array<string, string>
     */
    private const LEGACY_KEY_MAP = [
        'Comercial' => 'comercial',
        'Nombre Sociedad' => 'denominacion',
        'Denominación Social' => 'denominacion',
        'Nombre Comercial' => 'nombre_comercial',
        'Calle' => 'calle',
        'Número' => 'numero',
        'CP' => 'cp',
        'Municipio' => 'municipio',
        'Provincia' => 'provincia',
        'CIF/NIF' => 'cif',
        'Email' => 'email',
        'Email Factura' => 'email_factura',
        'Email CC' => 'email_cc',
        'IBAN' => 'iban',
        'Tipo Cliente' => 'tipo_cliente',
        'Firmas Contratadas' => 'firmas_contratadas',
        'JP Nombre' => 'jp_nombre',
        'JP Apellidos' => 'jp_apellidos',
        'JP Rol' => 'jp_rol',
        'JP Teléfono' => 'jp_telefono',
        'JP Mail' => 'jp_mail',
        'Firmante Nombre' => 'firm_nombre',
        'Firmante Apellidos' => 'firm_apellidos',
        'Firmante Mail' => 'firm_mail',
        'Firmante DNI' => 'firm_dni',
        'Firmante Puesto' => 'firm_puesto',
        'TPV' => 'tpv',
        'TPV Contacto' => 'tpv_contacto',
        'TPV Email' => 'tpv_email',
        'TPV NI Nombre' => 'tpv_ni_nombre',
        'TPV NI Contacto' => 'tpv_ni_contacto',
        'TPV NI Email' => 'tpv_ni_email',
        'Entrega Calle' => 'entrega_calle',
        'Entrega Número' => 'entrega_numero',
        'Entrega CP' => 'entrega_cp',
        'Entrega Municipio' => 'entrega_municipio',
        'Entrega Provincia' => 'entrega_provincia',
        'Contacto Nombre' => 'contacto_nombre',
        'Contacto Email' => 'contacto_email',
        'Contacto Teléfono' => 'contacto_telefono',
        'Dist. Empresa' => 'dist_empresa',
        'Dist. CIF' => 'dist_cif',
        'Dist. Dirección' => 'dist_direccion',
        'Dist. CP' => 'dist_cp',
        'Dist. Contacto' => 'dist_contacto',
        'Dist. Mail' => 'dist_mail',
        'Dist. Teléfono' => 'dist_telefono',
        'Credencial Master' => 'cred_master',
        'Credencial Yurest' => 'cred_yurest',
        'Comentarios' => 'comentarios',
        'Estado' => 'estado',
        'Baja' => 'baja',
        'Adjuntos' => 'adjuntos',
        'Módulos' => 'modulos',
        'Modulos' => 'modulos',
        'Integracion Financiera' => 'integracion_financiera',
        'Int Fin Persona' => 'int_fin_persona',
        'Int Fin Email' => 'int_fin_email',
        // Booleans legacy: el legacy map los pasa a snake_case con valor
        // string ('Sí'/''); el loop posterior los convierte a true/false.
        'Lite' => 'lite',
        'TPV No Integrado' => 'tpv_no_integrado',
        'Distribuidor' => 'distribuidor',
    ];

    /**
     * Si el body llega con keys en formato legacy (capitalizadas, español),
     * lo traducimos a snake_case ANTES de validar. Booleans tipo 'Sí'/''
     * se convierten a true/false, y los importes numéricos se parsean.
     *
     * Soporta también el shape moderno (snake_case directo) — solo traduce
     * las keys que están en LEGACY_KEY_MAP. Es idempotente.
     */
    protected function prepareForValidation(): void
    {
        $input = $this->all();
        $out = $input;

        // 1) Re-mapear keys legacy → snake_case
        foreach (self::LEGACY_KEY_MAP as $legacyKey => $modernKey) {
            if (! array_key_exists($legacyKey, $input)) {
                continue;
            }
            // Si ya hay una versión moderna en el body, no la pisamos.
            if (! array_key_exists($modernKey, $out) || $out[$modernKey] === '') {
                $out[$modernKey] = $input[$legacyKey];
            }
            unset($out[$legacyKey]);
        }

        // 2) Booleans 'Sí'/'' → true/false (cuando vienen como string)
        foreach (['lite', 'tpv_no_integrado', 'distribuidor', 'ocr_activo'] as $bf) {
            if (array_key_exists($bf, $out) && is_string($out[$bf])) {
                $out[$bf] = strtolower(trim($out[$bf])) === 'sí'
                    || strtolower(trim($out[$bf])) === 'si'
                    || $out[$bf] === '1'
                    || strtolower(trim($out[$bf])) === 'true';
            }
        }

        // 3) Importes financieros legacy → snake_case (con parseFloat)
        $legacyImportes = [
            'ImporteSetup' => 'importe_setup',
            'Descuentosetup' => 'descuento_setup',
            'Mensualidad Anualizada' => 'fin_mensualidad_anual',
            'Proyecto de Implementación' => 'fin_implementacion',
            'Plan Producto BASIC' => 'fin_basic',
            'Plan Producto PRO' => 'fin_pro',
            'Plan RRHH' => 'fin_rrhh',
            'Plan Operaciones' => 'fin_operaciones',
            'Yurest Lite' => 'fin_lite',
            'Integraciones' => 'fin_integraciones',
            'Dist. Comisión Implementación (%)' => 'dist_comision',
        ];
        foreach ($legacyImportes as $legacyKey => $modernKey) {
            if (array_key_exists($legacyKey, $input)) {
                $out[$modernKey] = is_numeric($input[$legacyKey])
                    ? (float) $input[$legacyKey]
                    : 0.0;
                unset($out[$legacyKey]);
            }
        }

        // 4) Mensualidad Total Locales setea ambos campos a la vez.
        if (array_key_exists('Mensualidad Total Locales', $input)) {
            $val = is_numeric($input['Mensualidad Total Locales'])
                ? (float) $input['Mensualidad Total Locales'] : 0.0;
            $out['mensualidad_total_locales'] = $val;
            $out['mensualidad_total'] = $val;
            unset($out['Mensualidad Total Locales']);
        }

        // 5) Necesita Tablet no es columna del schema — descartar silenciosamente.
        unset($out['Necesita Tablet']);
        // 6) `locales` y `paquetes_carrito` ya vienen en snake_case del front.

        // 7) Normalizar campos con CHECK que rechazan '' pero aceptan NULL
        foreach (['tipo_cliente', 'integracion_financiera'] as $f) {
            if (isset($out[$f]) && $out[$f] === '') {
                $out[$f] = null;
            }
        }

        // 8) firmas_contratadas legacy también se acepta como '' (sin firmas)
        // — no hay que tocarlo, el CHECK ya admite la cadena vacía.

        $this->replace($out);
    }

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
            'modulos' => ['nullable', 'array'],
            'modulos.*' => ['string'],
            'adjuntos' => ['nullable', 'array'],
            'comentarios' => ['nullable', 'string'],
            'baja' => ['nullable', 'in:No,Sí,Si'],
            'estado' => ['nullable', 'in:pendiente,completada,en_proceso,rellenado,Rellenado'],

            // Integración financiera (added in 2026_05_07_000010)
            'integracion_financiera' => ['nullable', 'in:no_aplica,sage,a3'],
            'int_fin_persona' => ['nullable', 'string', 'max:200'],
            'int_fin_email' => ['nullable', 'email', 'max:200'],

            // Locales nested al crear/editar ficha desde index.html
            'locales' => ['nullable', 'array'],
            'locales.*' => ['array'],
        ];
    }
}
