<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProyectoHistorialResource;
use App\Models\Proyecto;
use App\Models\ProyectoHistorial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Audit log de acciones por proyecto. Sustituye `18-proyectos-historial.json`.
 *
 * Endpoints:
 *   GET  /api/proyectos/{proyecto}/historial          últimas N entradas (default 100)
 *   POST /api/proyectos/{proyecto}/historial          inserta una entrada nueva
 */
class ProyectoHistorialController extends Controller
{
    private const ACCIONES_VALIDAS = [
        'tarea_completada', 'tarea_reabierta', 'tarea_eliminada', 'tarea_movida',
        'tarea_anadida', 'tarea_actualizada',
        'subtarea_completada', 'subtarea_reabierta', 'subtarea_eliminada',
        'subtarea_anadida', 'subtarea_actualizada', 'subtarea_agendada', 'subtarea_desagendada',
        'show_asignado', 'show_noshow', 'show_limpiado',
        'proyecto_creado', 'proyecto_pausado', 'proyecto_reanudado',
        'proyecto_completado', 'proyecto_eliminado', 'proyecto_actualizado',
        'anotacion_added', 'anotacion_updated', 'anotacion_deleted',
        'adjunto_add', 'adjunto_remove',
        'contacto_added', 'contacto_removed',
        'otro',
    ];

    public function index(Request $request, Proyecto $proyecto): AnonymousResourceCollection
    {
        $limit = max(1, min(500, (int) $request->integer('limit', 100)));

        $rows = ProyectoHistorial::query()
            ->where('proyecto_id', $proyecto->id)
            ->orderByDesc('creado_at')
            ->limit($limit)
            ->get();

        return ProyectoHistorialResource::collection($rows);
    }

    public function store(Request $request, Proyecto $proyecto): JsonResponse
    {
        $data = $request->validate([
            'accion' => ['required', 'string', 'in:'.implode(',', self::ACCIONES_VALIDAS)],
            'usuario' => ['nullable', 'array'],
            'usuario.id' => ['nullable', 'uuid'],
            'usuario.nombre' => ['nullable', 'string', 'max:120'],
            'usuario.username' => ['nullable', 'string', 'max:120'],
            'usuario.rol' => ['nullable', 'in:admin,user,sistema'],
            'seccion_nombre' => ['nullable', 'string', 'max:200'],
            'tarea_id' => ['nullable', 'string', 'max:64'],
            'tarea_nombre' => ['nullable', 'string', 'max:240'],
            'descripcion' => ['nullable', 'string', 'max:500'],
            'cambios' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $u = $data['usuario'] ?? [];

        $row = ProyectoHistorial::create([
            'proyecto_id' => $proyecto->id,
            'usuario_id' => $u['id'] ?? null,
            'usuario_nombre' => $u['nombre'] ?? $u['username'] ?? null,
            'usuario_rol' => in_array($u['rol'] ?? null, ['admin', 'user', 'sistema'], true)
                ? $u['rol']
                : 'user',
            'accion' => $data['accion'],
            'seccion_nombre' => $data['seccion_nombre'] ?? null,
            'tarea_id' => $data['tarea_id'] ?? null,
            'tarea_nombre' => $data['tarea_nombre'] ?? null,
            'descripcion' => $data['descripcion'] ?? null,
            'cambios' => $data['cambios'] ?? [],
            'metadata' => $data['metadata'] ?? [],
        ]);

        return (new ProyectoHistorialResource($row))->response()->setStatusCode(201);
    }
}
