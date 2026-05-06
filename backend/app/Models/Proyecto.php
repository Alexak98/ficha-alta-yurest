<?php

namespace App\Models;

use Database\Factories\ProyectoFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Proyecto de implementación — tabla `proyectos`.
 *
 * @property string $id
 * @property string|null $ficha_id
 * @property string $cliente
 * @property string $implementador
 * @property string $tipo
 * @property string $estado
 * @property string|null $tpv
 * @property string|null $motivo_pausa
 * @property string|null $plan_accion
 * @property string|null $asana_project_id
 * @property string|null $asana_project_url
 * @property array<int, mixed> $anotaciones
 * @property array<int, mixed> $contactos
 * @property array<int, mixed> $adjuntos
 * @property array<int, mixed> $secciones
 * @property array<string, mixed>|null $sepa_mandato
 * @property bool $grabado_a3
 * @property Carbon|null $grabado_a3_at
 * @property Carbon|null $fecha_inicio
 * @property Carbon|null $ultima_actividad
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Proyecto extends Model
{
    /** @use HasFactory<ProyectoFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'proyectos';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'anotaciones' => 'array',
            'contactos' => 'array',
            'adjuntos' => 'array',
            'sepa_mandato' => 'array',
            'secciones' => 'array',
            'grabado_a3' => 'boolean',
            'grabado_a3_at' => 'datetime',
            'fecha_inicio' => 'date',
            'ultima_actividad' => 'date',
        ];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }

    public function historial(): HasMany
    {
        return $this->hasMany(ProyectoHistorial::class, 'proyecto_id');
    }
}
