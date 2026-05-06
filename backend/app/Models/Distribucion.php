<?php

namespace App\Models;

use Database\Factories\DistribucionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Audit trail de asignaciones implementador ↔ ficha — tabla `distribucion`.
 *
 * Cada vez que el panel de distribución asigna o reasigna un implementador
 * a una ficha, se inserta una fila aquí + se actualiza fichas_alta.implementador.
 *
 * @property string $id
 * @property string $implementador
 * @property string|null $ficha_id
 * @property array<string, mixed> $datos
 * @property Carbon|null $created_at
 * @property Carbon|null $deleted_at
 */
class Distribucion extends Model
{
    /** @use HasFactory<DistribucionFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'distribucion';

    public $timestamps = false;

    protected $guarded = ['id', 'created_at'];

    protected function casts(): array
    {
        return [
            'datos' => 'array',
            'created_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }
}
