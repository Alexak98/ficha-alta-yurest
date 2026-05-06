<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit log de fichas + columnas adjuntos y notificada_completa_at.
 * Consolida 3 SQLs legacy:
 *   - 2026-04-21_03_fichas_historial.sql
 *   - 2026-04-21_05_fichas_adjuntos.sql
 *   - 2026-04-21_08_notif_ficha_completa.sql
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]'::jsonb");
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS notificada_completa_at TIMESTAMPTZ');

        Schema::create('fichas_historial', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('ficha_id')->nullable();
            $table->uuid('solicitud_id')->nullable();
            $table->uuid('usuario_id')->nullable();
            $table->text('usuario_nombre')->nullable();
            $table->text('usuario_rol')->nullable();
            $table->text('accion');
            $table->text('descripcion')->nullable();
            $table->jsonb('cambios')->default(DB::raw("'{}'::jsonb"));
            $table->jsonb('metadata')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('creado_at')->useCurrent();
        });

        DB::statement('CREATE INDEX idx_fichas_historial_ficha         ON fichas_historial(ficha_id, creado_at DESC)');
        DB::statement('CREATE INDEX idx_fichas_historial_solicitud     ON fichas_historial(solicitud_id, creado_at DESC)');
        DB::statement('CREATE INDEX idx_fichas_historial_usuario       ON fichas_historial(usuario_id, creado_at DESC)');
        DB::statement('CREATE INDEX idx_fichas_historial_accion_fecha  ON fichas_historial(accion, creado_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('fichas_historial');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS notificada_completa_at');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS adjuntos');
    }
};
