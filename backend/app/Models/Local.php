<?php

namespace App\Models;

use Database\Factories\LocalFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Local (sede) por ficha — tabla `locales`.
 *
 * @property string $id
 * @property string $ficha_id
 * @property string $nombre
 * @property string|null $email
 * @property string|null $cp
 * @property mixed $mensualidad
 * @property Carbon|null $created_at
 * @property Carbon|null $deleted_at
 */
class Local extends Model
{
    /** @use HasFactory<LocalFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'locales';

    public $timestamps = false;

    protected $guarded = ['id', 'created_at'];

    protected function casts(): array
    {
        return [
            'mensualidad' => 'decimal:2',
            'created_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }
}
