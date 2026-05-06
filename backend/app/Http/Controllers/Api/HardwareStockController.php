<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\HardwareStockRequest;
use App\Http\Resources\HardwareStockResource;
use App\Models\HardwareStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye el workflow `23-hardware-stock.json`.
 *
 * Endpoints:
 *   GET    /api/hardware/stock                catálogo + stock actual
 *   POST   /api/hardware/stock                añadir artículo
 *   GET    /api/hardware/stock/{articulo}     uno
 *   PUT    /api/hardware/stock/{articulo}     editar
 *   DELETE /api/hardware/stock/{articulo}     soft-delete
 */
class HardwareStockController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = HardwareStock::query()
            ->whereNull('deleted_at')
            ->orderBy('categoria')
            ->orderBy('nombre');

        if ($v = $request->string('categoria')->toString()) {
            $query->where('categoria', $v);
        }
        if ($request->boolean('bajo_minimo')) {
            $query->whereColumn('stock_actual', '<', 'stock_minimo');
        }

        return HardwareStockResource::collection($query->get());
    }

    public function store(HardwareStockRequest $request): JsonResponse
    {
        $articulo = HardwareStock::create($request->validated());
        $articulo->refresh();

        return (new HardwareStockResource($articulo))->response()->setStatusCode(201);
    }

    public function show(HardwareStock $articulo): HardwareStockResource
    {
        return new HardwareStockResource($articulo);
    }

    public function update(HardwareStockRequest $request, HardwareStock $articulo): HardwareStockResource
    {
        $articulo->update($request->validated());

        return new HardwareStockResource($articulo->refresh());
    }

    public function destroy(HardwareStock $articulo): JsonResponse
    {
        $articulo->delete();

        return response()->json(['ok' => true]);
    }
}
