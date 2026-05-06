<?php

namespace App\Models;

use Database\Factories\BajaFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Baja (desvinculación de cliente) — tabla `bajas`.
 *
 * El JSONB `datos` almacena el contexto operativo (cliente_id,
 * cliente_nombre, modulos[], mrr, motivo_id, fecha_efecto, etc).
 *
 * @property string $id
 * @property string|null $ficha_id
 * @property string $cliente
 * @property string|null $motivo
 * @property Carbon|null $fecha_baja
 * @property string|null $implementador
 * @property string|null $tipo_cliente
 * @property array<string, mixed> $datos
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Baja extends Model
{
    /** @use HasFactory<BajaFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'bajas';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'datos' => 'array',
            'fecha_baja' => 'date',
        ];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }
}
