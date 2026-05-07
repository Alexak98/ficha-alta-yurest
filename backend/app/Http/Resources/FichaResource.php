<?php

namespace App\Http\Resources;

use App\Models\FichaAlta;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FichaAlta
 */
class FichaResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return $this->withLegacyAliases([
            'id' => $this->id,
            'numero_ficha' => $this->numero_ficha,

            // Comercial
            'comercial' => $this->comercial,
            'implementador' => $this->implementador,

            // Empresa
            'denominacion' => $this->denominacion,
            'nombre_comercial' => $this->nombre_comercial,
            'cif' => $this->cif,
            'email' => $this->email,
            'email_factura' => $this->email_factura,
            'email_cc' => $this->email_cc,
            'tipo_cliente' => $this->tipo_cliente,

            // Dirección fiscal
            'calle' => $this->calle,
            'numero' => $this->numero,
            'cp' => $this->cp,
            'municipio' => $this->municipio,
            'provincia' => $this->provincia,

            // Jefe de proyecto
            'jp_nombre' => $this->jp_nombre,
            'jp_apellidos' => $this->jp_apellidos,
            'jp_rol' => $this->jp_rol,
            'jp_telefono' => $this->jp_telefono,
            'jp_mail' => $this->jp_mail,

            // Firmante
            'firm_nombre' => $this->firm_nombre,
            'firm_apellidos' => $this->firm_apellidos,
            'firm_mail' => $this->firm_mail,
            'firm_dni' => $this->firm_dni,
            'firm_puesto' => $this->firm_puesto,

            // Servicios
            'firmas_contratadas' => $this->firmas_contratadas,
            'ocr_activo' => (bool) $this->ocr_activo,
            'lite' => (bool) $this->lite,

            // TPV
            'tpv' => $this->tpv,
            'tpv_contacto' => $this->tpv_contacto,
            'tpv_email' => $this->tpv_email,
            'tpv_no_integrado' => (bool) $this->tpv_no_integrado,
            'tpv_ni_nombre' => $this->tpv_ni_nombre,
            'tpv_ni_contacto' => $this->tpv_ni_contacto,
            'tpv_ni_email' => $this->tpv_ni_email,

            // Entrega (para clientes Lite)
            'entrega_calle' => $this->entrega_calle,
            'entrega_numero' => $this->entrega_numero,
            'entrega_cp' => $this->entrega_cp,
            'entrega_municipio' => $this->entrega_municipio,
            'entrega_provincia' => $this->entrega_provincia,

            // Contacto entrega
            'contacto_nombre' => $this->contacto_nombre,
            'contacto_email' => $this->contacto_email,
            'contacto_telefono' => $this->contacto_telefono,

            // Financiero
            'iban' => $this->iban,
            'importe_setup' => $this->importe_setup,
            'descuento_setup' => $this->descuento_setup,
            'mensualidad_total' => $this->mensualidad_total,
            'mensualidad_total_locales' => $this->mensualidad_total_locales,
            'fin_implementacion' => $this->fin_implementacion,
            'fin_basic' => $this->fin_basic,
            'fin_pro' => $this->fin_pro,
            'fin_rrhh' => $this->fin_rrhh,
            'fin_operaciones' => $this->fin_operaciones,
            'fin_lite' => $this->fin_lite,
            'fin_integraciones' => $this->fin_integraciones,
            'fin_mensualidad_anual' => $this->fin_mensualidad_anual,

            // Distribuidor
            'distribuidor' => (bool) $this->distribuidor,
            'dist_empresa' => $this->dist_empresa,
            'dist_cif' => $this->dist_cif,
            'dist_direccion' => $this->dist_direccion,
            'dist_cp' => $this->dist_cp,
            'dist_contacto' => $this->dist_contacto,
            'dist_mail' => $this->dist_mail,
            'dist_telefono' => $this->dist_telefono,
            'dist_comision' => $this->dist_comision,

            // Credenciales
            'cred_master' => $this->cred_master,
            'cred_yurest' => $this->cred_yurest,

            // Otros
            'paquetes_carrito' => $this->paquetes_carrito ?? [],
            'comentarios' => $this->comentarios,
            'baja' => $this->baja,
            'estado' => $this->estado,

            // Timestamps de estado (poblados por triggers)
            'fecha_solicitud' => $this->fecha_solicitud?->toIso8601String(),
            'fecha_rellenado' => $this->fecha_rellenado?->toIso8601String(),
            'fecha_completado' => $this->fecha_completado?->toIso8601String(),

            // Relaciones embebidas (cuando se cargan)
            'locales' => LocalResource::collection($this->whenLoaded('locales')),
            'locales_count' => $this->when(
                $this->relationLoaded('locales'),
                fn () => $this->locales->count(),
            ),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ]);
    }

    /**
     * Añade aliases con keys legacy ("Comercial", "Nombre Sociedad", "CIF/NIF",
     * "Implementador", "Tipo Cliente", etc.) para que las páginas del portal
     * que aún consultan los campos en formato n8n (mayúsculas con espacios)
     * sigan renderizando sin tocar el frontend.
     *
     * Las claves snake_case quedan intactas — un consumidor moderno puede
     * usar las que prefiera. El coste extra son ~30 strings por fila (sin
     * impacto perceptible en payload size).
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withLegacyAliases(array $data): array
    {
        return $data + [
            'Comercial' => $this->comercial,
            'Implementador' => $this->implementador,
            'Nombre Sociedad' => $this->denominacion,
            'Denominación Social' => $this->denominacion,
            'Nombre Comercial' => $this->nombre_comercial,
            'CIF/NIF' => $this->cif,
            'Email' => $this->email,
            'Email Factura' => $this->email_factura,
            'Email CC' => $this->email_cc,
            'Tipo Cliente' => $this->tipo_cliente,
            'Calle' => $this->calle,
            'Número' => $this->numero,
            'CP' => $this->cp,
            'Municipio' => $this->municipio,
            'Provincia' => $this->provincia,
            'JP Nombre' => $this->jp_nombre,
            'JP Apellidos' => $this->jp_apellidos,
            'JP Rol' => $this->jp_rol,
            'JP Teléfono' => $this->jp_telefono,
            'JP Mail' => $this->jp_mail,
            'Firmante Nombre' => $this->firm_nombre,
            'Firmante Apellidos' => $this->firm_apellidos,
            'Firmante Mail' => $this->firm_mail,
            'Firmante DNI' => $this->firm_dni,
            'Firmante Puesto' => $this->firm_puesto,
            'Firmas Contratadas' => $this->firmas_contratadas,
            'TPV' => $this->tpv,
            'TPV Contacto' => $this->tpv_contacto,
            'TPV Email' => $this->tpv_email,
            'TPV No Integrado' => $this->tpv_no_integrado ? 'Sí' : '',
            'TPV NI Nombre' => $this->tpv_ni_nombre,
            'TPV NI Contacto' => $this->tpv_ni_contacto,
            'TPV NI Email' => $this->tpv_ni_email,
            'Lite' => $this->lite ? 'Sí' : '',
            'Distribuidor' => $this->distribuidor ? 'Sí' : '',
            'Estado' => $this->estado,
            'Baja' => $this->baja,
            'Comentarios' => $this->comentarios,
            'Módulos' => $this->modulos ?? [],
        ];
    }
}
