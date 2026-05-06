<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Escalados (ampliaciones contractuales) + CS Kanban + grabado_a3 en fichas.
 *
 * Consolida 3 SQLs legacy:
 *   - 2026-04-26_01_escalados.sql
 *   - 2026-04-26_02_cs_estado.sql
 *   - 2026-04-17_06_grabado_a3.sql (la parte de fichas_alta — proyectos
 *     ya lo tenía en el schema base)
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->createEscalados();
        $this->amendFichasAlta();
        $this->createCsHistorial();
    }

    public function down(): void
    {
        Schema::dropIfExists('cs_estado_historial');

        DB::statement('DROP TRIGGER IF EXISTS trg_fichas_grabado_a3 ON fichas_alta');
        DB::statement('DROP FUNCTION IF EXISTS fichas_set_grabado_a3_at()');
        DB::statement('ALTER TABLE fichas_alta DROP CONSTRAINT IF EXISTS fichas_alta_cs_estado_check');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS cs_estado');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS grabado_a3_at');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS grabado_a3');

        DB::statement('DROP TRIGGER IF EXISTS trg_escalados_updated ON escalados');
        Schema::dropIfExists('escalados');
    }

    private function createEscalados(): void
    {
        Schema::create('escalados', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('ficha_id')->constrained('fichas_alta')->restrictOnDelete();
            $table->text('tipo');
            $table->text('estado')->default('pendiente');
            $table->jsonb('detalle');
            $table->decimal('setup', 10, 2)->default(0);
            $table->decimal('recurrencia', 10, 2)->default(0);
            $table->text('creado_por')->nullable();
            $table->text('notas')->nullable();
            $table->timestampTz('aplicado_at')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement("ALTER TABLE escalados ADD CONSTRAINT escalados_tipo_check CHECK (tipo IN ('modulo','local'))");
        DB::statement("ALTER TABLE escalados ADD CONSTRAINT escalados_estado_check CHECK (estado IN ('pendiente','aplicado','cancelado'))");

        DB::statement('CREATE INDEX idx_escalados_ficha   ON escalados(ficha_id)         WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_escalados_estado  ON escalados(estado)           WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_escalados_created ON escalados(created_at DESC)  WHERE deleted_at IS NULL');

        // Trigger updated_at (la función update_updated_at() ya existe del schema base)
        DB::statement('CREATE TRIGGER trg_escalados_updated BEFORE UPDATE ON escalados FOR EACH ROW EXECUTE FUNCTION update_updated_at()');
    }

    private function amendFichasAlta(): void
    {
        // Grabado A3 (workflow 13)
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS grabado_a3 BOOLEAN NOT NULL DEFAULT FALSE');
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS grabado_a3_at TIMESTAMPTZ');

        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION fichas_set_grabado_a3_at()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.grabado_a3 = TRUE AND (OLD.grabado_a3 IS DISTINCT FROM TRUE) THEN
                    NEW.grabado_a3_at := NOW();
                ELSIF NEW.grabado_a3 = FALSE AND OLD.grabado_a3 = TRUE THEN
                    NEW.grabado_a3_at := NULL;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        SQL);
        DB::statement('CREATE TRIGGER trg_fichas_grabado_a3 BEFORE UPDATE OF grabado_a3 ON fichas_alta FOR EACH ROW EXECUTE FUNCTION fichas_set_grabado_a3_at()');

        // CS Kanban
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS cs_estado TEXT');
        DB::statement(<<<'SQL'
            ALTER TABLE fichas_alta ADD CONSTRAINT fichas_alta_cs_estado_check
                CHECK (cs_estado IS NULL OR cs_estado IN (
                    'en_implementacion','post_primer_mes','reunion_post_1_mes_agendada',
                    'posible_escalado','stand_by','critico','sanacion','post_3_meses'
                ))
        SQL);
        DB::statement('CREATE INDEX idx_fichas_alta_cs_estado ON fichas_alta(cs_estado) WHERE deleted_at IS NULL');
    }

    private function createCsHistorial(): void
    {
        Schema::create('cs_estado_historial', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('ficha_id')->constrained('fichas_alta')->cascadeOnDelete();
            $table->text('estado_desde')->nullable();
            $table->text('estado_hasta');
            $table->text('movido_por')->nullable();
            $table->text('notas')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement('CREATE INDEX idx_cs_historial_ficha   ON cs_estado_historial(ficha_id, created_at DESC)');
        DB::statement('CREATE INDEX idx_cs_historial_created ON cs_estado_historial(created_at DESC)');
    }
};
