<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Audit log de cambios sobre una ficha — tabla `fichas_historial`.
 *
 * @property string $id
 * @property string|null $ficha_id
 * @property string|null $solicitud_id
 * @property string|null $usuario_id
 * @property string|null $usuario_nombre
 * @property string|null $usuario_rol
 * @property string $accion
 * @property string|null $descripcion
 * @property array<string, mixed> $cambios
 * @property array<string, mixed> $metadata
 * @property Carbon $creado_at
 */
class FichaHistorial extends Model
{
    use HasUuids;

    protected $table = 'fichas_historial';

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
}
