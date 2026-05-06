<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Baja;
use App\Models\Escalado;
use App\Models\FichaAlta;
use App\Models\HardwarePedido;
use App\Models\HardwareStock;
use App\Models\Local;
use App\Models\Presupuesto;
use App\Models\Promocion;
use App\Models\Proyecto;
use App\Models\Solicitud;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Endpoint genérico de soft-delete (sustituye `10-eliminar.json`).
 *
 * Acepta { id, entity? } y soft-deletea en la tabla correspondiente.
 * Si entity es 'desconocido' o no se pasa, prueba en orden conocido y
 * borra la primera coincidencia. Idempotente: si no existe, devuelve
 * affected=0 sin error.
 *
 * El frontend tiene endpoints REST específicos para cada recurso
 * (DELETE /api/fichas/{id}, etc.) — este endpoint existe solo como
 * compat para no romper código que aún use el shape genérico.
 */
class EliminarController extends Controller
{
    /** @var array<string, class-string<Model>> */
    private const MODELS = [
        'ficha' => FichaAlta::class,
        'fichas_alta' => FichaAlta::class,
        'solicitud' => Solicitud::class,
        'solicitudes' => Solicitud::class,
        'proyecto' => Proyecto::class,
        'proyectos' => Proyecto::class,
        'baja' => Baja::class,
        'bajas' => Baja::class,
        'local' => Local::class,
        'locales' => Local::class,
        'escalado' => Escalado::class,
        'escalados' => Escalado::class,
        'promocion' => Promocion::class,
        'promociones' => Promocion::class,
        'presupuesto' => Presupuesto::class,
        'presupuestos' => Presupuesto::class,
        'hardware_pedido' => HardwarePedido::class,
        'hardware_pedidos' => HardwarePedido::class,
        'hardware_stock' => HardwareStock::class,
        'stock' => HardwareStock::class,
    ];

    public function eliminar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'entity' => ['nullable', 'string', 'max:50'],
        ]);

        $entity = strtolower((string) ($data['entity'] ?? ''));

        if ($entity !== '' && isset(self::MODELS[$entity])) {
            $affected = $this->softDelete(self::MODELS[$entity], $data['id']);

            return response()->json([
                'success' => $affected > 0,
                'id' => $data['id'],
                'entity' => $entity,
                'affected' => $affected,
            ]);
        }

        // Sin entity o desconocido: probar todas las tablas conocidas
        // y devolver la primera coincidencia.
        foreach (array_unique(self::MODELS) as $modelClass) {
            $affected = $this->softDelete($modelClass, $data['id']);
            if ($affected > 0) {
                return response()->json([
                    'success' => true,
                    'id' => $data['id'],
                    'entity' => class_basename($modelClass),
                    'affected' => $affected,
                ]);
            }
        }

        return response()->json([
            'success' => false,
            'id' => $data['id'],
            'entity' => $entity ?: 'desconocido',
            'affected' => 0,
            'error' => 'no encontrado en ninguna tabla soft-deletable',
        ], 404);
    }

    /** @param  class-string<Model>  $modelClass */
    private function softDelete(string $modelClass, string $id): int
    {
        $row = $modelClass::query()->find($id);
        if (! $row) {
            return 0;
        }
        $row->delete();

        return 1;
    }
}
