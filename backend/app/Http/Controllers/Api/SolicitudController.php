<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SolicitudResource;
use App\Mail\SolicitudFormularioMail;
use App\Models\Solicitud;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Sustituye `08-solicitudes.json` y la parte pública de `11-auxiliares.json`.
 *
 * Endpoints (ver routes/api.php):
 *   - GET    /api/solicitudes                     (auth:sanctum + permiso solicitudes,read)
 *   - POST   /api/solicitudes                     (auth:sanctum + permiso solicitudes,write)
 *                                                 inserta + envía email al cliente
 *   - POST   /api/solicitudes/{solicitud}/reenviar reenvía email sin tocar BD
 *   - GET    /api/solicitudes/{solicitud}         (auth:sanctum + permiso solicitudes,read)
 *   - POST   /api/solicitudes/responder           (público — usa access_token)
 *   - DELETE /api/solicitudes/{solicitud}         (auth:sanctum + permiso solicitudes,delete)
 */
class SolicitudController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Solicitud::query()
            ->with('ficha:id,denominacion,cif,implementador')
            ->whereNull('deleted_at')
            ->orderByDesc('created_at');

        if ($estado = $request->string('estado')->toString()) {
            $query->where('estado', $estado);
        }
        if ($fichaId = $request->string('ficha_id')->toString()) {
            $query->where('ficha_id', $fichaId);
        }

        return SolicitudResource::collection($query->paginate(50));
    }

    public function store(Request $request): JsonResponse
    {
        // Acepta tanto shape moderno (snake_case) como el legacy del frontend
        // (que envía 'Nombre Sociedad', 'CIF/NIF', 'Email', email_to/_body...
        // en el body junto con los datos de la solicitud).
        $data = $request->validate([
            'ficha_id' => ['nullable', 'uuid'],
            'tipo' => ['nullable', 'string', 'max:100'],
            'asignado_a' => ['nullable', 'string', 'max:200'],
            'fecha_vencimiento' => ['nullable', 'date'],
            'documentos' => ['nullable', 'array'],
            'notas' => ['nullable', 'string'],
            'datos' => ['nullable', 'array'],
            'estado' => ['nullable', 'string', 'in:pendiente,en_progreso,completado,Rellenado,Pendiente'],
            'access_token' => ['nullable', 'string', 'size:32'],
            // Campos legacy del frontend que enriquecen `datos` JSONB
            'Nombre Sociedad' => ['nullable', 'string'],
            'CIF/NIF' => ['nullable', 'string'],
            'cif' => ['nullable', 'string'],
            'Nombre' => ['nullable', 'string'],
            'Email' => ['nullable', 'email'],
            'Comercial' => ['nullable', 'string'],
            'Tipo Cliente' => ['nullable', 'string'],
            'Fecha' => ['nullable', 'date'],
            'Estado' => ['nullable', 'string'],
            // Email send (opcional)
            'email_to' => ['nullable', 'email'],
            'email_subject' => ['nullable', 'string', 'max:200'],
            'email_body' => ['nullable', 'string'],
            'form_url' => ['nullable', 'url'],
        ]);

        // Construir el row de solicitudes
        $rawDatos = $data['datos'] ?? [];
        $datos = $rawDatos + array_filter([
            'cliente_nombre' => $data['Nombre'] ?? null,
            'cliente_email' => $data['Email'] ?? null,
            'cliente_sociedad' => $data['Nombre Sociedad'] ?? null,
            'cliente_cif' => $data['CIF/NIF'] ?? $data['cif'] ?? null,
            'comercial' => $data['Comercial'] ?? null,
            'tipo_cliente' => $data['Tipo Cliente'] ?? null,
            'form_url' => $data['form_url'] ?? null,
        ]);

        $solicitud = Solicitud::create([
            'ficha_id' => $data['ficha_id'] ?? null,
            'tipo' => $data['tipo'] ?? 'formulario_alta',
            'asignado_a' => $data['asignado_a'] ?? null,
            'fecha_vencimiento' => $data['fecha_vencimiento'] ?? null,
            'documentos' => $data['documentos'] ?? [],
            'notas' => $data['notas'] ?? null,
            'datos' => $datos,
            'estado' => $data['estado'] ?? ($data['Estado'] ?? 'pendiente'),
            'access_token' => $data['access_token'] ?? null,
        ]);
        $solicitud->refresh(); // trae access_token autogenerado si no vino

        // Enviar email al cliente si vino la info — replica del workflow 08
        $this->enviarEmail($data, $solicitud);

        return (new SolicitudResource($solicitud))->response()->setStatusCode(201);
    }

    public function show(Solicitud $solicitud): SolicitudResource
    {
        $solicitud->load('ficha:id,denominacion,cif,implementador');

        return new SolicitudResource($solicitud);
    }

    public function destroy(Solicitud $solicitud): JsonResponse
    {
        $solicitud->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Reenvía el email de una solicitud existente. Usado por el botón ✉
     * en el listado. Body: { email_to, email_subject, email_body, form_url }.
     */
    public function reenviar(Request $request, Solicitud $solicitud): JsonResponse
    {
        $data = $request->validate([
            'email_to' => ['required', 'email'],
            'email_subject' => ['required', 'string', 'max:200'],
            'email_body' => ['required', 'string'],
        ]);

        try {
            Mail::to($data['email_to'])->send(
                new SolicitudFormularioMail($data['email_subject'], $data['email_body'])
            );

            return response()->json(['ok' => true, 'sent_to' => $data['email_to']]);
        } catch (\Throwable $e) {
            Log::error('reenviar email solicitud falló: '.$e->getMessage());

            return response()->json([
                'ok' => false,
                'error' => 'mail_failed',
                'message' => 'No se pudo enviar el email. Revisa la config SMTP en .env.',
            ], 500);
        }
    }

    /**
     * Endpoint público — el cliente entra desde el email con el access_token
     * en URL. No requiere Sanctum.
     */
    public function responder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'access_token' => ['required', 'string', 'size:32'],
            'datos' => ['required', 'array'],
        ]);

        $solicitud = Solicitud::query()
            ->where('access_token', $data['access_token'])
            ->whereNull('deleted_at')
            ->first();

        if (! $solicitud) {
            return response()->json(['error' => 'Token inválido'], 404);
        }

        $solicitud->update([
            'datos' => array_replace($solicitud->datos ?? [], $data['datos']),
            'estado' => 'Rellenado',
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * Envía el email al cliente con el formulario. Tolerante a fallo del
     * SMTP: loguea el error pero NO rompe la creación de la solicitud
     * (la solicitud queda en BD aunque no llegue el email — el comercial
     * puede usar el botón "reenviar" más tarde).
     *
     * @param  array<string, mixed>  $data
     */
    private function enviarEmail(array $data, Solicitud $solicitud): void
    {
        $emailTo = $data['email_to'] ?? $data['Email'] ?? null;
        $emailSubject = $data['email_subject'] ?? null;
        $emailBody = $data['email_body'] ?? null;

        if (! $emailTo || ! $emailSubject || ! $emailBody) {
            return; // sin info de email — solo se ha creado la solicitud, OK
        }

        try {
            Mail::to($emailTo)->send(
                new SolicitudFormularioMail(
                    $emailSubject,
                    $emailBody,
                    $data['Comercial'] ?? null,
                )
            );
        } catch (\Throwable $e) {
            Log::warning(sprintf(
                'solicitud %s creada pero email a %s falló: %s',
                $solicitud->id,
                $emailTo,
                $e->getMessage(),
            ));
        }
    }
}
