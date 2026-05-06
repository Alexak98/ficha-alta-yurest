<?php

namespace App\Models;

use Database\Factories\HardwareStockFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Catálogo de artículos de hardware en almacén. Tabla `hardware_stock`.
 *
 * @property string $id
 * @property string $nombre
 * @property string|null $sku
 * @property string $categoria
 * @property string|null $descripcion
 * @property string $unidad
 * @property int $stock_actual
 * @property int $stock_minimo
 * @property mixed $precio_compra
 * @property mixed $precio_venta
 * @property string|null $proveedor
 * @property string|null $ubicacion
 * @property string|null $notas
 * @property string|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class HardwareStock extends Model
{
    /** @use HasFactory<HardwareStockFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'hardware_stock';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'stock_actual' => 'integer',
            'stock_minimo' => 'integer',
            'precio_compra' => 'decimal:2',
            'precio_venta' => 'decimal:2',
        ];
    }
}
