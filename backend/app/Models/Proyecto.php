<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Proyecto de implementación — tabla `proyectos`. */
class Proyecto extends Model
{
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
}
