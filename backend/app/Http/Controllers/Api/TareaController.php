<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProyectoResource;
use App\Models\Proyecto;
use App\Services\Proyectos\TareaJsonbService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Sustituye `02-proyectos-tareas.json`: manipulación de tareas dentro
 * del JSONB `proyectos.secciones[]`, con merge campo a campo y movido
 * entre secciones, en una sola operación atómica que también actualiza
 * `ultima_actividad`.
 *
 * Endpoints:
 *   PUT /api/proyectos/{proyecto}/tareas              body: { seccionNombre, tarea }
 *   PUT /api/proyectos/{proyecto}/tareas/mover        body: { tareaId, seccionOrigen, seccionDestino }
 *   PUT /api/proyectos/{proyecto}/anotaciones         body: { anotaciones }
 */
class TareaController extends Controller
{
    public function __construct(
        private readonly TareaJsonbService $service,
    ) {}

    public function update(Request $request, Proyecto $proyecto): ProyectoResource|JsonResponse
    {
        $data = $request->validate([
            'seccionNombre' => ['required', 'string'],
            'tarea' => ['required', 'array'],
            'tarea.id' => ['required', 'string'],
        ]);

        try {
            $secciones = $this->service->actualizarTarea(
                $proyecto->secciones ?? [],
                $data['seccionNombre'],
                $data['tarea'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $proyecto->update([
            'secciones' => $secciones,
            'ultima_actividad' => now()->toDateString(),
        ]);

        return new ProyectoResource($proyecto->refresh());
    }

    public function mover(Request $request, Proyecto $proyecto): ProyectoResource|JsonResponse
    {
        $data = $request->validate([
            'tareaId' => ['required', 'string'],
            'seccionOrigen' => ['required', 'string'],
            'seccionDestino' => ['required', 'string'],
        ]);

        try {
            $secciones = $this->service->moverTarea(
                $proyecto->secciones ?? [],
                $data['tareaId'],
                $data['seccionOrigen'],
                $data['seccionDestino'],
            );
        } catch (RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $proyecto->update([
            'secciones' => $secciones,
            'ultima_actividad' => now()->toDateString(),
        ]);

        return new ProyectoResource($proyecto->refresh());
    }

    public function anotaciones(Request $request, Proyecto $proyecto): ProyectoResource
    {
        $data = $request->validate([
            'anotaciones' => ['required', 'array'],
        ]);

        $proyecto->update(['anotaciones' => $data['anotaciones']]);

        return new ProyectoResource($proyecto->refresh());
    }
}
