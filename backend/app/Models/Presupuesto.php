<?php

namespace App\Models;

use Database\Factories\PresupuestoFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Presupuesto de desarrollo (departamento Producto).
 *
 * @property string $id
 * @property string $cliente
 * @property string $entorno
 * @property string $desarrollo
 * @property bool $enviado
 * @property string $quien_abona
 * @property string $estado
 * @property int $horas_yurest
 * @property mixed $coste_yurest
 * @property int $horas_cliente
 * @property mixed $coste_cliente
 * @property string $estado_entrega
 * @property string|null $notas
 * @property string|null $numero_doc
 * @property mixed $coste_hora_yurest
 * @property mixed $coste_hora_cliente
 * @property mixed $descuento_pct
 * @property string|null $contexto
 * @property string|null $objetivo
 * @property string|null $alcance
 * @property string|null $funcionamiento_esperado
 * @property string|null $entregables
 * @property string|null $presupuesto_detalle
 * @property string|null $aprobacion
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Presupuesto extends Model
{
    /** @use HasFactory<PresupuestoFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'presupuestos';

    protected $guarded = ['id', 'numero_doc', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'enviado' => 'boolean',
            'horas_yurest' => 'integer',
            'horas_cliente' => 'integer',
            'coste_yurest' => 'decimal:2',
            'coste_cliente' => 'decimal:2',
            'coste_hora_yurest' => 'decimal:2',
            'coste_hora_cliente' => 'decimal:2',
            'descuento_pct' => 'decimal:2',
        ];
    }
}
