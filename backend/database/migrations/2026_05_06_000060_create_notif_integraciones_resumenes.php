<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * notif_integraciones_* + resumenes_semanales/mensuales (caché IA Zendesk).
 * Consolida 3 SQLs legacy (notif_integraciones, resumenes semanales y mensuales).
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->createNotifIntegraciones();
        $this->createResumenesSemanales();
        $this->createResumenesMensuales();
    }

    public function down(): void
    {
        Schema::dropIfExists('resumenes_mensuales');
        Schema::dropIfExists('resumenes_semanales');
        Schema::dropIfExists('notif_integraciones_historial');
        Schema::dropIfExists('notif_integraciones_grupos');
        Schema::dropIfExists('notif_integraciones_config');
    }

    private function createNotifIntegraciones(): void
    {
        Schema::create('notif_integraciones_config', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('asana_project_id')->default('1207920061546505');
            $table->integer('umbral_dias')->default(7);
            $table->jsonb('secciones_seguimiento')->default(DB::raw(
                "'[\"Solicitud de datos realizada\",\"Datos incorrectos y notificados\",\"Integraciones pendientes\"]'::jsonb"
            ));
            $table->boolean('activo')->default(true);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->text('updated_by')->nullable();
        });

        Schema::create('notif_integraciones_grupos', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('nombre');
            $table->text('destinatarios');
            $table->jsonb('filtro_tpv')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('filtro_secciones')->default(DB::raw("'[]'::jsonb"));
            $table->boolean('activo')->default(true);
            $table->integer('orden')->default(0);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->timestampTz('deleted_at')->nullable();
        });
        DB::statement('CREATE INDEX idx_notif_grupos_activos ON notif_integraciones_grupos(activo, orden) WHERE deleted_at IS NULL');

        Schema::create('notif_integraciones_historial', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->timestampTz('ejecutado_at')->useCurrent();
            $table->uuid('grupo_id')->nullable();
            $table->text('grupo_nombre');
            $table->text('destinatarios');
            $table->integer('total_tareas')->default(0);
            $table->integer('umbral_dias');
            $table->jsonb('tareas')->default(DB::raw("'[]'::jsonb"));
            $table->boolean('email_enviado')->default(false);
            $table->text('error')->nullable();
            $table->text('disparador')->default('cron');
        });
        DB::statement('CREATE INDEX idx_notif_hist_fecha ON notif_integraciones_historial(ejecutado_at DESC)');
        DB::statement('CREATE INDEX idx_notif_hist_grupo ON notif_integraciones_historial(grupo_id, ejecutado_at DESC)');
    }

    private function createResumenesSemanales(): void
    {
        Schema::create('resumenes_semanales', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->integer('anio');
            $table->integer('semana');
            $table->date('fecha_desde');
            $table->date('fecha_hasta');
            $table->integer('total_tickets')->default(0);
            $table->jsonb('por_tipo')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('por_entorno')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('por_modulo')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('tickets')->default(DB::raw("'[]'::jsonb"));
            $table->text('resumen_markdown')->nullable();
            $table->text('modelo')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->unique(['anio', 'semana']);
        });
        DB::statement('ALTER TABLE resumenes_semanales ADD CONSTRAINT resumenes_semanales_semana_check CHECK (semana BETWEEN 1 AND 53)');
    }

    private function createResumenesMensuales(): void
    {
        Schema::create('resumenes_mensuales', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->integer('anio');
            $table->integer('mes');
            $table->date('fecha_desde');
            $table->date('fecha_hasta');
            $table->integer('total_tickets')->default(0);
            $table->jsonb('por_tipo')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('por_entorno')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('por_modulo')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('tickets')->default(DB::raw("'[]'::jsonb"));
            $table->text('resumen_markdown')->nullable();
            $table->text('modelo')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->unique(['anio', 'mes']);
        });
        DB::statement('ALTER TABLE resumenes_mensuales ADD CONSTRAINT resumenes_mensuales_mes_check CHECK (mes BETWEEN 1 AND 12)');
    }
};
