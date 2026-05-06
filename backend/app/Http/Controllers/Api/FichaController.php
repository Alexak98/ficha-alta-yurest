<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FichaRequest;
use App\Http\Resources\FichaResource;
use App\Models\FichaAlta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye los workflows `04-fichas-alta`, `12-completar-ficha`,
 * `09-rellenado-cliente` y la parte de eliminar ficha de `10-eliminar`.
 *
 * Endpoints:
 *   GET    /api/fichas                  index — con filtros (estado, tipo_cliente, comercial, implementador)
 *   POST   /api/fichas                  store — crea ficha
 *   GET    /api/fichas/{ficha}          show  — incluye locales embebidos
 *   PUT    /api/fichas/{ficha}          update — admite payload parcial
 *   DELETE /api/fichas/{ficha}          destroy — soft-delete
 *
 * El enrichment de implementador desde distribución/proyectos y la
 * notificación email cuando se completa quedan pendientes (PRs futuros
 * de la fase 4).
 */
class FichaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = FichaAlta::query()
            ->with('locales')
            ->whereNull('deleted_at')
            ->orderByDesc('created_at');

        if ($v = $request->string('estado')->toString()) {
            $query->where('estado', $v);
        }
        if ($v = $request->string('tipo_cliente')->toString()) {
            $query->where('tipo_cliente', $v);
        }
        if ($v = $request->string('comercial')->toString()) {
            $query->where('comercial', $v);
        }
        if ($v = $request->string('implementador')->toString()) {
            $query->where('implementador', $v);
        }
        if ($v = $request->string('q')->toString()) {
            $query->where(function ($q) use ($v) {
                $q->where('denominacion', 'ilike', "%$v%")
                    ->orWhere('cif', 'ilike', "%$v%")
                    ->orWhere('email', 'ilike', "%$v%");
            });
        }

        $perPage = (int) $request->integer('per_page', 50);
        $perPage = max(1, min(200, $perPage));

        return FichaResource::collection($query->paginate($perPage));
    }

    public function store(FichaRequest $request): JsonResponse
    {
        $ficha = FichaAlta::create($request->validated());
        // refresh para traer defaults de la BD (estado='pendiente', numero_ficha SERIAL,
        // baja='No', deleted_at=null) que no existen en la instancia recién creada.
        $ficha->refresh()->load('locales');

        return (new FichaResource($ficha))->response()->setStatusCode(201);
    }

    public function show(FichaAlta $ficha): FichaResource
    {
        $ficha->load('locales');

        return new FichaResource($ficha);
    }

    public function update(FichaRequest $request, FichaAlta $ficha): FichaResource
    {
        $ficha->update($request->validated());
        $ficha->load('locales');

        return new FichaResource($ficha);
    }

    public function destroy(FichaAlta $ficha): JsonResponse
    {
        $ficha->delete();

        return response()->json(['ok' => true]);
    }
}
