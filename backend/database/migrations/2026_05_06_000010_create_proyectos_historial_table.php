<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit log de acciones dentro de cada proyecto (replicado de
 * `database/migrations/2026-04-21_04_proyectos_historial.sql`).
 *
 * Cada fila registra quién (usuario_*) hizo qué (accion) sobre qué
 * elemento del proyecto (tarea, sección, anotación, adjunto, etc.).
 * Las acciones válidas se validan a nivel API en ProyectoHistorialController.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proyectos_historial', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('proyecto_id')->constrained('proyectos')->cascadeOnDelete();
            $table->uuid('usuario_id')->nullable();
            $table->text('usuario_nombre')->nullable();
            $table->text('usuario_rol')->nullable();
            $table->text('accion');
            $table->text('seccion_nombre')->nullable();
            $table->text('tarea_id')->nullable();
            $table->text('tarea_nombre')->nullable();
            $table->text('descripcion')->nullable();
            $table->jsonb('cambios')->default(DB::raw("'{}'::jsonb"));
            $table->jsonb('metadata')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('creado_at')->useCurrent();
        });

        DB::statement('CREATE INDEX idx_proyectos_historial_proyecto ON proyectos_historial(proyecto_id, creado_at DESC)');
        DB::statement('CREATE INDEX idx_proyectos_historial_usuario  ON proyectos_historial(usuario_id, creado_at DESC)');
        DB::statement('CREATE INDEX idx_proyectos_historial_accion   ON proyectos_historial(accion, creado_at DESC)');
    }

    public function down(): void
    {
        Schema::dropIfExists('proyectos_historial');
    }
};
