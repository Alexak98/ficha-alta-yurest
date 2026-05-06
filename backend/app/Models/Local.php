<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Local (sede) por ficha — tabla `locales`. */
class Local extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'locales';

    public $timestamps = false;

    protected $guarded = ['id', 'created_at'];

    protected function casts(): array
    {
        return ['mensualidad' => 'decimal:2'];
    }

    public function ficha(): BelongsTo
    {
        return $this->belongsTo(FichaAlta::class, 'ficha_id');
    }
}
