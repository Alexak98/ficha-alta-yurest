<?php

namespace App\Models;

use Database\Factories\ProyectoHistorialFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Audit log de acciones dentro de un proyecto. Tabla `proyectos_historial`.
 *
 * @property string $id
 * @property string $proyecto_id
 * @property string|null $usuario_id
 * @property string|null $usuario_nombre
 * @property string|null $usuario_rol
 * @property string $accion
 * @property string|null $seccion_nombre
 * @property string|null $tarea_id
 * @property string|null $tarea_nombre
 * @property string|null $descripcion
 * @property array<string, mixed> $cambios
 * @property array<string, mixed> $metadata
 * @property Carbon $creado_at
 */
class ProyectoHistorial extends Model
{
    /** @use HasFactory<ProyectoHistorialFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'proyectos_historial';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'cambios' => 'array',
            'metadata' => 'array',
            'creado_at' => 'datetime',
        ];
    }

    public function proyecto(): BelongsTo
    {
        return $this->belongsTo(Proyecto::class, 'proyecto_id');
    }
}
