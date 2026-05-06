<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tablas de hardware (pedidos + catálogo de stock).
 *
 * Consolida 4 migraciones SQL del repo legacy:
 *   - 2026-04-21_12_hardware_pedidos.sql            (schema base)
 *   - 2026-04-23_01_hardware_pedidos_enviado.sql    (estado=enviado + tracking)
 *   - 2026-04-24_02_hardware_pedidos_sociedad.sql   (sepa_mandato_id + snapshot)
 *   - 2026-04-23_05_hardware_stock.sql              (catálogo de stock)
 *
 * NOTA: hardware_stock_movimientos (historial de entradas/salidas) se deja
 * para una migración futura si hace falta el módulo completo.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->createPedidos();
        $this->createStock();
    }

    public function down(): void
    {
        Schema::dropIfExists('hardware_stock');
        DB::statement('DROP TRIGGER IF EXISTS trg_hw_pedidos_touch ON hardware_pedidos');
        DB::statement('DROP FUNCTION IF EXISTS hardware_pedidos_touch_updated()');
        Schema::dropIfExists('hardware_pedidos');
    }

    private function createPedidos(): void
    {
        Schema::create('hardware_pedidos', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('proyecto_id')->nullable()->constrained('proyectos')->nullOnDelete();
            $table->text('cliente');
            $table->text('implementador')->nullable();
            $table->jsonb('items')->default(DB::raw("'[]'::jsonb"));
            $table->text('estado')->default('solicitada');
            $table->jsonb('proforma_pdf')->nullable();
            $table->jsonb('justificante_pdf')->nullable();
            $table->text('notas_implementador')->nullable();
            $table->text('notas_contabilidad')->nullable();
            $table->text('solicitado_por')->nullable();
            $table->timestampTz('solicitado_at')->useCurrent();
            $table->timestampTz('proforma_at')->nullable();
            $table->timestampTz('pagado_at')->nullable();
            $table->timestampTz('confirmado_at')->nullable();
            $table->timestampTz('enviado_at')->nullable();
            $table->text('enviado_por')->nullable();
            $table->uuid('sepa_mandato_id')->nullable();
            $table->jsonb('sepa_snapshot')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement(
            'ALTER TABLE hardware_pedidos ADD CONSTRAINT hardware_pedidos_estado_check '.
            "CHECK (estado IN ('solicitada','proforma_adjuntada','pendiente_confirmar','lista_envio','enviado'))",
        );

        DB::statement('CREATE INDEX idx_hw_pedidos_proyecto ON hardware_pedidos(proyecto_id) WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_hw_pedidos_estado   ON hardware_pedidos(estado)      WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_hw_pedidos_sepa     ON hardware_pedidos(sepa_mandato_id) WHERE sepa_mandato_id IS NOT NULL');

        // Trigger touch updated_at (replicado del schema original)
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION hardware_pedidos_touch_updated()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at := NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        SQL);
        DB::statement('CREATE TRIGGER trg_hw_pedidos_touch BEFORE UPDATE ON hardware_pedidos FOR EACH ROW EXECUTE FUNCTION hardware_pedidos_touch_updated()');
    }

    private function createStock(): void
    {
        Schema::create('hardware_stock', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('nombre');
            $table->text('sku')->nullable();
            $table->text('categoria')->default('otro');
            $table->text('descripcion')->nullable();
            $table->text('unidad')->default('ud');
            $table->integer('stock_actual')->default(0);
            $table->integer('stock_minimo')->default(0);
            $table->decimal('precio_compra', 10, 2)->default(0);
            $table->decimal('precio_venta', 10, 2)->default(0);
            $table->text('proveedor')->nullable();
            $table->text('ubicacion')->nullable();
            $table->text('notas')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('created_by')->nullable();
        });

        DB::statement('ALTER TABLE hardware_stock ADD CONSTRAINT hardware_stock_categoria_check '.
            "CHECK (categoria IN ('tablet','soporte','cargador','cable','impresora','cajon','balanza','lector','router','etiqueta','pantalla','sensor','funda','otro'))");
        DB::statement('ALTER TABLE hardware_stock ADD CONSTRAINT hardware_stock_actual_min_check CHECK (stock_actual >= 0)');
        DB::statement('ALTER TABLE hardware_stock ADD CONSTRAINT hardware_stock_minimo_min_check CHECK (stock_minimo >= 0)');
        DB::statement('ALTER TABLE hardware_stock ADD CONSTRAINT hardware_stock_pcompra_min_check CHECK (precio_compra >= 0)');
        DB::statement('ALTER TABLE hardware_stock ADD CONSTRAINT hardware_stock_pventa_min_check  CHECK (precio_venta  >= 0)');

        DB::statement('CREATE UNIQUE INDEX idx_hw_stock_sku_unique ON hardware_stock(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_hw_stock_categoria ON hardware_stock(categoria) WHERE deleted_at IS NULL');
    }
};
