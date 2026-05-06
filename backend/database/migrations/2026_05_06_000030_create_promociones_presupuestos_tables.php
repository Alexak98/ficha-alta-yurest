<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Promociones (tandas de implementación) + presupuestos de desarrollo.
 *
 * Consolida 5 SQLs legacy:
 *   - 2026-04-21_11_promociones.sql
 *   - 2026-04-23_02_promociones_qa_fixes.sql
 *   - 2026-04-23_03_presupuestos.sql
 *   - 2026-04-23_04_presupuestos_secciones.sql
 *   - 2026-04-30_01_presupuestos_v2.sql
 *
 * Añade promocion_id + promocion_turno a la tabla `proyectos` (FK).
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->createPromociones();
        $this->amendProyectos();
        $this->createPresupuestos();
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_presupuestos_numero ON presupuestos');
        DB::statement('DROP FUNCTION IF EXISTS presupuestos_set_numero_doc()');
        DB::statement('DROP SEQUENCE IF EXISTS presupuestos_numero_seq');
        Schema::dropIfExists('presupuestos');

        DB::statement('ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_promocion_turno_check');
        DB::statement('ALTER TABLE proyectos DROP COLUMN IF EXISTS promocion_turno');
        DB::statement('ALTER TABLE proyectos DROP COLUMN IF EXISTS promocion_id');

        Schema::dropIfExists('promociones');
    }

    private function createPromociones(): void
    {
        Schema::create('promociones', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->text('nombre');
            $table->text('descripcion')->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->text('estado')->default('activa');
            $table->integer('plazas_manana')->default(8);
            $table->integer('plazas_tarde')->default(8);
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('created_by')->nullable();
        });

        DB::statement("ALTER TABLE promociones ADD CONSTRAINT promociones_estado_check CHECK (estado IN ('activa','cerrada'))");
        DB::statement('ALTER TABLE promociones ADD CONSTRAINT promociones_plazas_manana_check CHECK (plazas_manana >= 0)');
        DB::statement('ALTER TABLE promociones ADD CONSTRAINT promociones_plazas_tarde_check  CHECK (plazas_tarde  >= 0)');
    }

    private function amendProyectos(): void
    {
        DB::statement('ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS promocion_id UUID REFERENCES promociones(id) ON DELETE SET NULL');
        DB::statement('ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS promocion_turno TEXT');
        DB::statement("ALTER TABLE proyectos ADD CONSTRAINT proyectos_promocion_turno_check CHECK (promocion_turno IS NULL OR promocion_turno IN ('manana','tarde'))");
        DB::statement('CREATE INDEX IF NOT EXISTS idx_proyectos_promocion ON proyectos(promocion_id, promocion_turno) WHERE promocion_id IS NOT NULL');
    }

    private function createPresupuestos(): void
    {
        Schema::create('presupuestos', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('cliente');
            $table->text('entorno');
            $table->text('desarrollo');
            $table->boolean('enviado')->default(false);
            $table->text('quien_abona')->default('cliente');
            $table->text('estado')->default('en_espera');
            $table->integer('horas_yurest')->default(0);
            $table->decimal('coste_yurest', 10, 2)->default(0);
            $table->integer('horas_cliente')->default(0);
            $table->decimal('coste_cliente', 10, 2)->default(0);
            $table->text('estado_entrega')->default('pendiente');
            $table->text('notas')->nullable();
            // v2
            $table->text('numero_doc')->nullable();
            $table->decimal('coste_hora_yurest', 10, 2)->default(25.00);
            $table->decimal('coste_hora_cliente', 10, 2)->default(85.00);
            $table->decimal('descuento_pct', 5, 2)->default(0);
            // secciones estructuradas
            $table->text('contexto')->nullable();
            $table->text('objetivo')->nullable();
            $table->text('alcance')->nullable();
            $table->text('funcionamiento_esperado')->nullable();
            $table->text('entregables')->nullable();
            $table->text('presupuesto_detalle')->nullable();
            $table->text('aprobacion')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('created_by')->nullable();
        });

        DB::statement("ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_entorno_check CHECK (entorno IN ('backoffice','app_cliente'))");
        DB::statement("ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_quien_abona_check CHECK (quien_abona IN ('yurest','cliente'))");
        DB::statement("ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_estado_check CHECK (estado IN ('aceptado','en_espera','pagado_50','pagado'))");
        DB::statement("ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_estado_entrega_check CHECK (estado_entrega IN ('pendiente','en_progreso','entregado'))");
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_horas_yurest_check  CHECK (horas_yurest  >= 0 AND horas_yurest  <= 10000)');
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_horas_cliente_check CHECK (horas_cliente >= 0 AND horas_cliente <= 10000)');
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_coste_yurest_check  CHECK (coste_yurest  >= 0)');
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_coste_cliente_check CHECK (coste_cliente >= 0)');
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_coste_hora_yurest_check  CHECK (coste_hora_yurest  >= 0)');
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_coste_hora_cliente_check CHECK (coste_hora_cliente >= 0)');
        DB::statement('ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_descuento_pct_check CHECK (descuento_pct >= 0 AND descuento_pct <= 100)');

        DB::statement('CREATE INDEX idx_presupuestos_cliente ON presupuestos(cliente) WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_presupuestos_estado  ON presupuestos(estado)  WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_presupuestos_estado_entrega ON presupuestos(estado_entrega) WHERE deleted_at IS NULL');

        // Sequencer + trigger para auto-generar PRES-NNNN
        DB::statement('CREATE SEQUENCE IF NOT EXISTS presupuestos_numero_seq START 1');
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION presupuestos_set_numero_doc() RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.numero_doc IS NULL OR NEW.numero_doc = '' THEN
                    NEW.numero_doc := 'PRES-' || LPAD(nextval('presupuestos_numero_seq')::text, 4, '0');
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        SQL);
        DB::statement('CREATE TRIGGER trg_presupuestos_numero BEFORE INSERT ON presupuestos FOR EACH ROW EXECUTE FUNCTION presupuestos_set_numero_doc()');
    }
};
