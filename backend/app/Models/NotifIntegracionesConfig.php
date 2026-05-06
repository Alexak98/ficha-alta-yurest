<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** @property string $asana_project_id @property int $umbral_dias @property array<int, string> $secciones_seguimiento @property bool $activo */
class NotifIntegracionesConfig extends Model
{
    use HasUuids;

    protected $table = 'notif_integraciones_config';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'secciones_seguimiento' => 'array',
            'activo' => 'boolean',
            'umbral_dias' => 'integer',
        ];
    }
}
