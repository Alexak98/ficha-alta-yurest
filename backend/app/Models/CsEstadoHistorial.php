<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Historial de transiciones del kanban CS — tabla `cs_estado_historial`.
 *
 * @property string $id
 * @property string $ficha_id
 * @property string|null $estado_desde
 * @property string $estado_hasta
 * @property string|null $movido_por
 * @property string|null $notas
 * @property Carbon $created_at
 */
class CsEstadoHistorial extends Model
{
    use HasUuids;

    protected $table = 'cs_estado_historial';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }
}
