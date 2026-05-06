<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\HardwarePedidoRequest;
use App\Http\Resources\HardwarePedidoResource;
use App\Models\HardwarePedido;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye el workflow `21-hardware-pedidos.json`.
 *
 * Endpoints:
 *   GET    /api/hardware/pedidos                lista (filtros: estado, proyecto_id)
 *   POST   /api/hardware/pedidos                crea
 *   GET    /api/hardware/pedidos/{pedido}       muestra uno
 *   PUT    /api/hardware/pedidos/{pedido}       update parcial — al cambiar estado
 *                                               se setean los timestamps de la transición
 *   DELETE /api/hardware/pedidos/{pedido}       soft-delete
 */
class HardwarePedidoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = HardwarePedido::query()
            ->whereNull('deleted_at')
            ->orderByDesc('solicitado_at');

        if ($v = $request->string('estado')->toString()) {
            $query->where('estado', $v);
        }
        if ($v = $request->string('proyecto_id')->toString()) {
            $query->where('proyecto_id', $v);
        }

        return HardwarePedidoResource::collection($query->paginate(50));
    }

    public function store(HardwarePedidoRequest $request): JsonResponse
    {
        $pedido = HardwarePedido::create($request->validated());
        $pedido->refresh();

        return (new HardwarePedidoResource($pedido))->response()->setStatusCode(201);
    }

    public function show(HardwarePedido $pedido): HardwarePedidoResource
    {
        return new HardwarePedidoResource($pedido);
    }

    public function update(HardwarePedidoRequest $request, HardwarePedido $pedido): HardwarePedidoResource
    {
        /** @var array<string, mixed> $data */
        $data = $request->validated();

        // Auto-sello de timestamps al pasar de estado, si el caller no los manda.
        // Replica la lógica del workflow 21 sin requerir que el frontend los envíe.
        if (isset($data['estado']) && $data['estado'] !== $pedido->estado) {
            $data = match ($data['estado']) {
                'proforma_adjuntada' => $data + ['proforma_at' => now()],
                'pendiente_confirmar' => $data + ['pagado_at' => now()],
                'lista_envio' => $data + ['confirmado_at' => now()],
                'enviado' => $data + ['enviado_at' => now()],
                default => $data,
            };
        }

        $pedido->update($data);

        return new HardwarePedidoResource($pedido->refresh());
    }

    public function destroy(HardwarePedido $pedido): JsonResponse
    {
        $pedido->delete();

        return response()->json(['ok' => true]);
    }
}
