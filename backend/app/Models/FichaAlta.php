<?php

namespace App\Models;

use Database\Factories\FichaAltaFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Ficha de alta de cliente (tabla `fichas_alta`).
 *
 * Replica el shape exacto del workflow `04-fichas-alta.json`. Los timestamps
 * `fecha_solicitud`, `fecha_rellenado`, `fecha_completado` los puebla un
 * trigger Postgres — no se tocan desde código.
 *
 * @property string $id
 * @property int $numero_ficha
 * @property string $denominacion
 * @property string|null $cif
 * @property string|null $email
 * @property string|null $tipo_cliente
 * @property string|null $comercial
 * @property string|null $implementador
 * @property string|null $estado
 * @property bool $ocr_activo
 * @property bool $lite
 * @property bool $tpv_no_integrado
 * @property bool $distribuidor
 * @property array<int, mixed>|null $paquetes_carrito
 * @property Carbon|null $fecha_solicitud
 * @property Carbon|null $fecha_rellenado
 * @property Carbon|null $fecha_completado
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Collection<int, Local> $locales
 */
class FichaAlta extends Model
{
    /** @use HasFactory<FichaAltaFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'fichas_alta';

    protected $guarded = ['id', 'numero_ficha', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            // 'modulos' es TEXT[] de Postgres — sin cast nativo en Eloquent.
            // Se trata como string al leer; el accessor explícito vendrá cuando
            // implementemos la migración de fichas (workflow 04).
            'paquetes_carrito' => 'array',
            'ocr_activo' => 'boolean',
            'lite' => 'boolean',
            'tpv_no_integrado' => 'boolean',
            'distribuidor' => 'boolean',
            'importe_setup' => 'decimal:2',
            'descuento_setup' => 'decimal:2',
            'mensualidad_total' => 'decimal:2',
            'fecha_solicitud' => 'datetime',
            'fecha_rellenado' => 'datetime',
            'fecha_completado' => 'datetime',
        ];
    }

    public function locales(): HasMany
    {
        return $this->hasMany(Local::class, 'ficha_id');
    }

    public function solicitudes(): HasMany
    {
        return $this->hasMany(Solicitud::class, 'ficha_id');
    }

    public function proyectos(): HasMany
    {
        return $this->hasMany(Proyecto::class, 'ficha_id');
    }
}
