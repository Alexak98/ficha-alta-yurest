<?php

namespace App\Models;

use Database\Factories\SolicitudFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Solicitud de servicio (tabla `solicitudes`).
 *
 * Replica el workflow `08-solicitudes.json` — endpoint público con
 * `access_token` aleatorio para que el cliente rellene desde email.
 *
 * @property string $id
 * @property string|null $ficha_id
 * @property string|null $tipo
 * @property string $estado
 * @property string|null $asignado_a
 * @property string|null $access_token
 * @property Carbon|null $fecha_vencimiento
 * @property array<int, mixed>|null $documentos
 * @property string|null $notas
 * @property array<string, mixed>|null $datos
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Solicitud extends Model
{
    /** @use HasFactory<SolicitudFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'solicitudes';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'documentos' => 'array',
            'datos' => 'array',
            'fecha_vencimiento' => 'date',
        ];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }

    /**
     * Genera un access_token aleatorio (32 hex chars). El UNIQUE INDEX
     * parcial en BD garantiza unicidad.
     */
    public static function generateAccessToken(): string
    {
        return bin2hex(random_bytes(16));
    }

    public static function booted(): void
    {
        static::creating(function (Solicitud $s) {
            if (empty($s->access_token)) {
                $s->access_token = self::generateAccessToken();
            }
        });
    }
}
