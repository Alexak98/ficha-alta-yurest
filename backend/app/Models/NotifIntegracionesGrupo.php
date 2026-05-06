<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/** @property string $nombre @property string $destinatarios @property array<int, string> $filtro_tpv @property array<int, string> $filtro_secciones @property bool $activo @property int $orden */
class NotifIntegracionesGrupo extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'notif_integraciones_grupos';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'filtro_tpv' => 'array',
            'filtro_secciones' => 'array',
            'activo' => 'boolean',
            'orden' => 'integer',
        ];
    }
}
