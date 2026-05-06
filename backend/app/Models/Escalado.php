<?php

namespace App\Models;

use Database\Factories\EscaladoFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Escalado contractual de un cliente — tabla `escalados`.
 *
 * @property string $id
 * @property string $ficha_id
 * @property string $tipo
 * @property string $estado
 * @property array<string, mixed> $detalle
 * @property mixed $setup
 * @property mixed $recurrencia
 * @property string|null $creado_por
 * @property string|null $notas
 * @property Carbon|null $aplicado_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Escalado extends Model
{
    /** @use HasFactory<EscaladoFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'escalados';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'detalle' => 'array',
            'setup' => 'decimal:2',
            'recurrencia' => 'decimal:2',
            'aplicado_at' => 'datetime',
        ];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }
}
