<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProyectoRequest;
use App\Http\Resources\ProyectoResource;
use App\Models\Proyecto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye el workflow `01-proyectos-crud.json` (CRUD completo de
 * proyectos de implementación, incluyendo el JSONB `secciones[]` con
 * tareas anidadas y la bitácora de `anotaciones`).
 *
 * Las manipulaciones finas de tareas dentro de `secciones[]` viven en
 * TareaController + TareaJsonbService (workflow `02-proyectos-tareas`).
 */
class ProyectoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Proyecto::query()
            ->whereNull('deleted_at')
            ->orderByDesc('ultima_actividad');

        if ($v = $request->string('estado')->toString()) {
            $query->where('estado', $v);
        }
        if ($v = $request->string('tipo')->toString()) {
            $query->where('tipo', $v);
        }
        if ($v = $request->string('implementador')->toString()) {
            $query->where('implementador', $v);
        }
        if ($v = $request->string('ficha_id')->toString()) {
            $query->where('ficha_id', $v);
        }

        $perPage = (int) $request->integer('per_page', 50);
        $perPage = max(1, min(200, $perPage));

        return ProyectoResource::collection($query->paginate($perPage));
    }

    public function show(Proyecto $proyecto): ProyectoResource
    {
        return new ProyectoResource($proyecto);
    }

    public function store(ProyectoRequest $request): JsonResponse
    {
        $proyecto = Proyecto::create($request->validated());
        $proyecto->refresh();

        return (new ProyectoResource($proyecto))->response()->setStatusCode(201);
    }

    public function update(ProyectoRequest $request, Proyecto $proyecto): ProyectoResource
    {
        $proyecto->update($request->validated());

        return new ProyectoResource($proyecto->refresh());
    }

    public function destroy(Proyecto $proyecto): JsonResponse
    {
        $proyecto->delete();

        return response()->json(['ok' => true]);
    }
}
