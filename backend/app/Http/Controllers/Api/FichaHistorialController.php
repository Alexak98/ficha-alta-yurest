<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FichaHistorial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Sustituye el workflow `17-historial.json` (audit log de fichas / solicitudes).
 *
 * Endpoints:
 *   GET  /api/historial?fichaId=...|solicitudId=...&limit=N&offset=M
 *   POST /api/historial
 */
class FichaHistorialController extends Controller
{
    private const ACCIONES_VALIDAS = [
        'create', 'update', 'delete', 'estado_change',
        'adjunto_add', 'adjunto_remove', 'sepa_firmado',
        'cliente_respondio', 'a3_grabado', 'a3_desmarcado',
        'proyecto_creado', 'enviado_cliente', 'password_reset',
        'permiso_change', 'otro',
    ];

    public function index(Request $request): JsonResource
    {
        $request->validate([
            'fichaId' => ['nullable', 'uuid'],
            'ficha_id' => ['nullable', 'uuid'],
            'solicitudId' => ['nullable', 'uuid'],
            'solicitud_id' => ['nullable', 'uuid'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'offset' => ['nullable', 'integer', 'min:0'],
        ]);

        $fichaId = $request->input('fichaId') ?? $request->input('ficha_id');
        $solicitudId = $request->input('solicitudId') ?? $request->input('solicitud_id');

        if (! $fichaId && ! $solicitudId) {
            abort(422, 'Se requiere fichaId o solicitudId');
        }

        $limit = (int) ($request->integer('limit') ?: 100);
        $offset = (int) $request->integer('offset', 0);

        $query = FichaHistorial::query();
        if ($fichaId) {
            $query->where('ficha_id', $fichaId);
        }
        if ($solicitudId) {
            $query->where('solicitud_id', $solicitudId);
        }

        $rows = $query->orderByDesc('creado_at')->skip($offset)->take($limit)->get();

        return JsonResource::collection($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ficha_id' => ['nullable', 'uuid'],
            'solicitud_id' => ['nullable', 'uuid'],
            'accion' => ['required', 'in:'.implode(',', self::ACCIONES_VALIDAS)],
            'usuario' => ['nullable', 'array'],
            'usuario.id' => ['nullable', 'uuid'],
            'usuario.nombre' => ['nullable', 'string', 'max:200'],
            'usuario.rol' => ['nullable', 'in:admin,user,cliente,sistema'],
            'descripcion' => ['nullable', 'string'],
            'cambios' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (empty($data['ficha_id']) && empty($data['solicitud_id'])) {
            abort(422, 'ficha_id o solicitud_id es obligatorio');
        }

        $u = $data['usuario'] ?? [];

        $row = FichaHistorial::create([
            'ficha_id' => $data['ficha_id'] ?? null,
            'solicitud_id' => $data['solicitud_id'] ?? null,
            'usuario_id' => $u['id'] ?? null,
            'usuario_nombre' => $u['nombre'] ?? null,
            'usuario_rol' => $u['rol'] ?? null,
            'accion' => $data['accion'],
            'descripcion' => $data['descripcion'] ?? null,
            'cambios' => $data['cambios'] ?? [],
            'metadata' => $data['metadata'] ?? [],
        ]);
        $row->refresh();

        return response()->json(['success' => true, 'id' => $row->id], 201);
    }
}
