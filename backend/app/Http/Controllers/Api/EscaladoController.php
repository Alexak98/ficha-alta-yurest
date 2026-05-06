<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EscaladoResource;
use App\Models\Escalado;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Sustituye el workflow `26-escalados.json` (ampliaciones contractuales:
 * módulos nuevos sobre locales existentes, o alta de local nuevo).
 */
class EscaladoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Escalado::query()
            ->whereNull('deleted_at')
            ->orderByDesc('created_at');

        if ($v = $request->string('estado')->toString()) {
            $query->where('estado', $v);
        }
        if ($v = $request->string('ficha_id')->toString()) {
            $query->where('ficha_id', $v);
        }

        return EscaladoResource::collection($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ficha_id' => ['required', 'uuid', 'exists:fichas_alta,id'],
            'tipo' => ['required', 'in:modulo,local'],
            'estado' => ['nullable', 'in:pendiente,aplicado,cancelado'],
            'detalle' => ['required', 'array'],
            'setup' => ['nullable', 'numeric', 'min:0'],
            'recurrencia' => ['nullable', 'numeric', 'min:0'],
            'creado_por' => ['nullable', 'string', 'max:200'],
            'notas' => ['nullable', 'string'],
        ]);

        $e = Escalado::create($data);
        $e->refresh();

        return (new EscaladoResource($e))->response()->setStatusCode(201);
    }

    public function show(Escalado $escalado): EscaladoResource
    {
        return new EscaladoResource($escalado);
    }

    public function update(Request $request, Escalado $escalado): EscaladoResource
    {
        $data = $request->validate([
            'estado' => ['nullable', 'in:pendiente,aplicado,cancelado'],
            'detalle' => ['nullable', 'array'],
            'setup' => ['nullable', 'numeric', 'min:0'],
            'recurrencia' => ['nullable', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string'],
            'aplicado_at' => ['nullable', 'date'],
        ]);

        // Auto-stamp aplicado_at al pasar a 'aplicado'
        if (($data['estado'] ?? null) === 'aplicado' && $escalado->estado !== 'aplicado') {
            $data['aplicado_at'] = $data['aplicado_at'] ?? now();
        }

        $escalado->update($data);

        return new EscaladoResource($escalado->refresh());
    }

    public function destroy(Escalado $escalado): JsonResponse
    {
        $escalado->delete();

        return response()->json(['ok' => true]);
    }
}
