<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/** @property Carbon $ejecutado_at @property string|null $grupo_id @property string $grupo_nombre @property string $destinatarios @property int $total_tareas @property array<int, mixed> $tareas @property bool $email_enviado @property string|null $error @property string $disparador */
class NotifIntegracionesHistorial extends Model
{
    use HasUuids;

    protected $table = 'notif_integraciones_historial';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'ejecutado_at' => 'datetime',
            'tareas' => 'array',
            'email_enviado' => 'boolean',
            'total_tareas' => 'integer',
            'umbral_dias' => 'integer',
        ];
    }
}
