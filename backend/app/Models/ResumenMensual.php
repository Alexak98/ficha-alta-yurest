<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Caché por (anio, mes) del resumen IA de tickets Zendesk.
 *
 * @property int $anio
 * @property int $mes
 * @property Carbon $fecha_desde
 * @property Carbon $fecha_hasta
 * @property int $total_tickets
 * @property array<int, mixed> $por_tipo
 * @property array<int, mixed> $por_entorno
 * @property array<int, mixed> $por_modulo
 * @property array<int, mixed> $tickets
 * @property string|null $resumen_markdown
 * @property string|null $modelo
 */
class ResumenMensual extends Model
{
    use HasUuids;

    protected $table = 'resumenes_mensuales';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'anio' => 'integer',
            'mes' => 'integer',
            'fecha_desde' => 'date',
            'fecha_hasta' => 'date',
            'total_tickets' => 'integer',
            'por_tipo' => 'array',
            'por_entorno' => 'array',
            'por_modulo' => 'array',
            'tickets' => 'array',
        ];
    }
}
