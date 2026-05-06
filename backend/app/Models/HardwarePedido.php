<?php

namespace App\Models;

use Database\Factories\HardwarePedidoFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Pedido de hardware. Tabla `hardware_pedidos`.
 *
 * Ciclo de estados:
 *   solicitada → proforma_adjuntada → pendiente_confirmar → lista_envio → enviado
 *
 * @property string $id
 * @property string|null $proyecto_id
 * @property string $cliente
 * @property string|null $implementador
 * @property array<int, mixed> $items
 * @property string $estado
 * @property array<string, mixed>|null $proforma_pdf
 * @property array<string, mixed>|null $justificante_pdf
 * @property string|null $notas_implementador
 * @property string|null $notas_contabilidad
 * @property string|null $solicitado_por
 * @property Carbon|null $solicitado_at
 * @property Carbon|null $proforma_at
 * @property Carbon|null $pagado_at
 * @property Carbon|null $confirmado_at
 * @property Carbon|null $enviado_at
 * @property string|null $enviado_por
 * @property string|null $sepa_mandato_id
 * @property array<string, mixed>|null $sepa_snapshot
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class HardwarePedido extends Model
{
    /** @use HasFactory<HardwarePedidoFactory> */
    use HasFactory;

    use HasUuids;
    use SoftDeletes;

    protected $table = 'hardware_pedidos';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'proforma_pdf' => 'array',
            'justificante_pdf' => 'array',
            'sepa_snapshot' => 'array',
            'solicitado_at' => 'datetime',
            'proforma_at' => 'datetime',
            'pagado_at' => 'datetime',
            'confirmado_at' => 'datetime',
            'enviado_at' => 'datetime',
        ];
    }

    public function proyecto(): BelongsTo
    {
        return $this->belongsTo(Proyecto::class, 'proyecto_id');
    }
}
