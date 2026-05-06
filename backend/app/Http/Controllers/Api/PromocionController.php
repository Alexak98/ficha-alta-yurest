<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PromocionRequest;
use App\Http\Resources\PromocionResource;
use App\Models\Promocion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Sustituye el workflow `20-promociones.json`. */
class PromocionController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return PromocionResource::collection(
            Promocion::query()->whereNull('deleted_at')->orderByDesc('fecha_inicio')->get()
        );
    }

    public function store(PromocionRequest $request): JsonResponse
    {
        $p = Promocion::create($request->validated());
        $p->refresh();

        return (new PromocionResource($p))->response()->setStatusCode(201);
    }

    public function show(Promocion $promocion): PromocionResource
    {
        return new PromocionResource($promocion);
    }

    public function update(PromocionRequest $request, Promocion $promocion): PromocionResource
    {
        $promocion->update($request->validated());

        return new PromocionResource($promocion->refresh());
    }

    public function destroy(Promocion $promocion): JsonResponse
    {
        $promocion->delete();

        return response()->json(['ok' => true]);
    }
}
