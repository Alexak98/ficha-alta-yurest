<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id_organizacion
 * @property string|null $nombre
 * @property string|null $respuesta_ia
 * @property int|null $nivel
 * @property Carbon|null $fecha_resumen
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class ChurnTecnico extends Model
{
    protected $table = 'churn_tecnico';

    protected $primaryKey = 'id_organizacion';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = ['created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'nivel' => 'integer',
            'fecha_resumen' => 'datetime',
        ];
    }
}
