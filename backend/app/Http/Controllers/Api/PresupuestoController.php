<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PresupuestoRequest;
use App\Http\Resources\PresupuestoResource;
use App\Models\Presupuesto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Sustituye el workflow `22-presupuestos.json`. */
class PresupuestoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Presupuesto::query()
            ->whereNull('deleted_at')
            ->orderByDesc('created_at');

        if ($v = $request->string('cliente')->toString()) {
            $query->where('cliente', $v);
        }
        if ($v = $request->string('estado')->toString()) {
            $query->where('estado', $v);
        }
        if ($v = $request->string('estado_entrega')->toString()) {
            $query->where('estado_entrega', $v);
        }

        return PresupuestoResource::collection($query->paginate(50));
    }

    public function store(PresupuestoRequest $request): JsonResponse
    {
        $p = Presupuesto::create($request->validated());
        $p->refresh(); // trae numero_doc del trigger

        return (new PresupuestoResource($p))->response()->setStatusCode(201);
    }

    public function show(Presupuesto $presupuesto): PresupuestoResource
    {
        return new PresupuestoResource($presupuesto);
    }

    public function update(PresupuestoRequest $request, Presupuesto $presupuesto): PresupuestoResource
    {
        $presupuesto->update($request->validated());

        return new PresupuestoResource($presupuesto->refresh());
    }

    public function destroy(Presupuesto $presupuesto): JsonResponse
    {
        $presupuesto->delete();

        return response()->json(['ok' => true]);
    }
}
