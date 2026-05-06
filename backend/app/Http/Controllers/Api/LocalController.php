<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LocalRequest;
use App\Http\Resources\LocalResource;
use App\Models\FichaAlta;
use App\Models\Local;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Locales (sedes) anidados bajo una ficha. Replica las llamadas que el
 * workflow 04-fichas-alta hace a la tabla `locales` (INSERT Locales,
 * DELETE Locales antiguos).
 *
 * Endpoints:
 *   GET    /api/fichas/{ficha}/locales
 *   POST   /api/fichas/{ficha}/locales
 *   PUT    /api/fichas/{ficha}/locales/{local}
 *   DELETE /api/fichas/{ficha}/locales/{local}
 */
class LocalController extends Controller
{
    public function index(FichaAlta $ficha): AnonymousResourceCollection
    {
        return LocalResource::collection(
            $ficha->locales()->whereNull('deleted_at')->orderBy('nombre')->get()
        );
    }

    public function store(LocalRequest $request, FichaAlta $ficha): JsonResponse
    {
        $local = $ficha->locales()->create($request->validated());

        return (new LocalResource($local))->response()->setStatusCode(201);
    }

    public function update(LocalRequest $request, FichaAlta $ficha, Local $local): LocalResource
    {
        $this->ensureBelongs($ficha, $local);
        $local->update($request->validated());

        return new LocalResource($local);
    }

    public function destroy(FichaAlta $ficha, Local $local): JsonResponse
    {
        $this->ensureBelongs($ficha, $local);
        $local->delete();

        return response()->json(['ok' => true]);
    }

    private function ensureBelongs(FichaAlta $ficha, Local $local): void
    {
        abort_unless($local->ficha_id === $ficha->id, 404);
    }
}
