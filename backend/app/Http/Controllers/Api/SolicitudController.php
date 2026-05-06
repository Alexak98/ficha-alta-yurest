<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SolicitudResource;
use App\Models\Solicitud;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye `08-solicitudes.json` y la parte pública de `11-auxiliares.json`.
 *
 * Endpoints (ver routes/api.php):
 *   - GET    /api/solicitudes                     (auth:sanctum + permiso solicitudes,read)
 *   - POST   /api/solicitudes                     (auth:sanctum + permiso solicitudes,write)
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
        $data = $request->validate([
            'ficha_id' => ['nullable', 'uuid'],
            'tipo' => ['nullable', 'string', 'max:100'],
            'asignado_a' => ['nullable', 'string', 'max:200'],
            'fecha_vencimiento' => ['nullable', 'date'],
            'documentos' => ['array'],
            'documentos.*' => ['array'],
            'notas' => ['nullable', 'string'],
            'datos' => ['array'],
            'estado' => ['nullable', 'string', 'in:pendiente,en_progreso,completado,Rellenado,Pendiente'],
        ]);

        $solicitud = Solicitud::create($data + ['estado' => $data['estado'] ?? 'pendiente']);

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
}
