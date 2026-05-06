<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla churn_tecnico — replica del SQL legacy 2026-04-24_01_churn_tecnico.sql.
 *
 * Cada fila es una organización Zendesk con el resumen IA del periodo y el
 * nivel de riesgo de abandono (1-10, 0=sin tickets). El generador real
 * (workflow 24) corre con OpenAI y se moverá a un Job en Laravel cuando
 * estén las credenciales.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('churn_tecnico', function (Blueprint $table) {
            $table->text('id_organizacion')->primary();
            $table->text('nombre')->nullable();
            $table->text('respuesta_ia')->nullable();
            $table->smallInteger('nivel')->nullable();
            $table->timestampTz('fecha_resumen')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement('ALTER TABLE churn_tecnico ADD CONSTRAINT churn_tecnico_nivel_check CHECK (nivel IS NULL OR nivel BETWEEN 0 AND 10)');
        DB::statement('CREATE INDEX idx_churn_tecnico_fecha ON churn_tecnico(fecha_resumen)');
        DB::statement('CREATE INDEX idx_churn_tecnico_nivel_null ON churn_tecnico(id_organizacion) WHERE nivel IS NULL');

        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION touch_churn_tecnico_updated_at()
            RETURNS TRIGGER LANGUAGE plpgsql AS $$
            BEGIN
                NEW.updated_at := NOW();
                RETURN NEW;
            END;
            $$
        SQL);
        DB::statement('CREATE TRIGGER trg_churn_tecnico_touch BEFORE UPDATE ON churn_tecnico FOR EACH ROW EXECUTE FUNCTION touch_churn_tecnico_updated_at()');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_churn_tecnico_touch ON churn_tecnico');
        DB::statement('DROP FUNCTION IF EXISTS touch_churn_tecnico_updated_at()');
        Schema::dropIfExists('churn_tecnico');
    }
};
