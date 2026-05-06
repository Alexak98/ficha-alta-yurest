<?php

namespace App\Models;

use Database\Factories\PromocionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Promoción (tanda de implementación) — tabla `promociones`.
 *
 * @property string $id
 * @property string $nombre
 * @property string|null $descripcion
 * @property Carbon|null $fecha_inicio
 * @property string $estado
 * @property int $plazas_manana
 * @property int $plazas_tarde
 * @property string|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Promocion extends Model
{
    /** @use HasFactory<PromocionFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'promociones';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date',
            'plazas_manana' => 'integer',
            'plazas_tarde' => 'integer',
        ];
    }
}
