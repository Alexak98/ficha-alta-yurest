<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Schema core de Yurest, replicado del schema.sql original de Supabase.
 *
 * Esta es la migración 1:1 del estado actual de producción. Cualquier
 * cambio futuro va en una migración nueva.
 *
 * Cambios respecto al schema.sql:
 *   - usuarios → users (en migración separada).
 *   - RLS eliminado: la seguridad pasa al middleware Sanctum + Policies.
 *   - Triggers de Postgres se conservan tal cual (lógica de timestamps
 *     por estado y propagación solicitud → ficha).
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->createFichasAlta();
        $this->createLocales();
        $this->createProyectos();
        $this->createBajas();
        $this->createSolicitudes();
        $this->createDistribucion();
        $this->createTriggers();
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS trg_solicitud_propagar_fecha ON solicitudes');
        DB::statement('DROP TRIGGER IF EXISTS trg_fichas_estado_ts ON fichas_alta');
        DB::statement('DROP TRIGGER IF EXISTS trg_solicitudes_updated ON solicitudes');
        DB::statement('DROP TRIGGER IF EXISTS trg_bajas_updated ON bajas');
        DB::statement('DROP TRIGGER IF EXISTS trg_proyectos_updated ON proyectos');
        DB::statement('DROP TRIGGER IF EXISTS trg_fichas_updated ON fichas_alta');
        DB::statement('DROP FUNCTION IF EXISTS solicitud_propagar_fecha_a_ficha()');
        DB::statement('DROP FUNCTION IF EXISTS fichas_set_estado_timestamps()');
        DB::statement('DROP FUNCTION IF EXISTS update_updated_at()');

        Schema::dropIfExists('distribucion');
        Schema::dropIfExists('solicitudes');
        Schema::dropIfExists('bajas');
        Schema::dropIfExists('proyectos');
        Schema::dropIfExists('locales');
        Schema::dropIfExists('fichas_alta');
    }

    private function createFichasAlta(): void
    {
        Schema::create('fichas_alta', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
        });
        // numero_ficha es SERIAL secundario (no PK). Se añade aparte porque
        // Blueprint::bigIncrements() siempre crea PK.
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN numero_ficha SERIAL');

        Schema::table('fichas_alta', function (Blueprint $table) {
            $table->text('comercial')->nullable();
            $table->text('denominacion');
            $table->text('nombre_comercial')->nullable();
            $table->text('cif')->nullable();
            $table->text('email')->nullable();
            $table->text('email_factura')->nullable();
            $table->text('email_cc')->nullable();
            $table->text('tipo_cliente')->nullable();
            $table->text('calle')->nullable();
            $table->text('numero')->nullable();
            $table->text('cp')->nullable();
            $table->text('municipio')->nullable();
            $table->text('provincia')->nullable();
            $table->text('jp_nombre')->nullable();
            $table->text('jp_apellidos')->nullable();
            $table->text('jp_rol')->nullable();
            $table->text('jp_telefono')->nullable();
            $table->text('jp_mail')->nullable();
            $table->text('firm_nombre')->nullable();
            $table->text('firm_apellidos')->nullable();
            $table->text('firm_mail')->nullable();
            $table->text('firm_dni')->nullable();
            $table->text('firm_puesto')->nullable();
            $table->text('firmas_contratadas')->nullable();
            $table->boolean('ocr_activo')->default(false);
            $table->boolean('lite')->default(false);
            $table->text('tpv')->nullable();
            $table->text('tpv_contacto')->nullable();
            $table->text('tpv_email')->nullable();
            $table->boolean('tpv_no_integrado')->default(false);
            $table->text('tpv_ni_nombre')->nullable();
            $table->text('tpv_ni_contacto')->nullable();
            $table->text('tpv_ni_email')->nullable();
            $table->text('entrega_calle')->nullable();
            $table->text('entrega_numero')->nullable();
            $table->text('entrega_cp')->nullable();
            $table->text('entrega_municipio')->nullable();
            $table->text('entrega_provincia')->nullable();
            $table->text('contacto_nombre')->nullable();
            $table->text('contacto_email')->nullable();
            $table->text('contacto_telefono')->nullable();
            $table->text('iban')->nullable();
            $table->decimal('importe_setup', 10, 2)->default(0);
            $table->decimal('descuento_setup', 5, 2)->default(0);
            $table->decimal('mensualidad_total', 10, 2)->default(0);
            $table->decimal('mensualidad_total_locales', 10, 2)->default(0);
            $table->decimal('fin_implementacion', 10, 2)->default(0);
            $table->decimal('fin_basic', 10, 2)->default(0);
            $table->decimal('fin_pro', 10, 2)->default(0);
            $table->decimal('fin_rrhh', 10, 2)->default(0);
            $table->decimal('fin_operaciones', 10, 2)->default(0);
            $table->decimal('fin_lite', 10, 2)->default(0);
            $table->decimal('fin_integraciones', 10, 2)->default(0);
            $table->decimal('fin_mensualidad_anual', 10, 2)->default(0);
            $table->boolean('distribuidor')->default(false);
            $table->text('dist_empresa')->nullable();
            $table->text('dist_cif')->nullable();
            $table->text('dist_direccion')->nullable();
            $table->text('dist_cp')->nullable();
            $table->text('dist_contacto')->nullable();
            $table->text('dist_mail')->nullable();
            $table->text('dist_telefono')->nullable();
            $table->decimal('dist_comision', 10, 2)->default(0);
            $table->text('cred_master')->nullable();
            $table->text('cred_yurest')->nullable();
            $table->jsonb('paquetes_carrito')->default(DB::raw("'[]'::jsonb"));
            $table->text('comentarios')->nullable();
            $table->text('implementador')->nullable();
            $table->text('baja')->default('No');
            $table->text('estado')->default('pendiente');
            $table->timestampTz('fecha_solicitud')->nullable();
            $table->timestampTz('fecha_rellenado')->nullable();
            $table->timestampTz('fecha_completado')->nullable();
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        // Arrays Postgres (modulos[])
        DB::statement("ALTER TABLE fichas_alta ADD COLUMN modulos TEXT[] DEFAULT '{}'");

        // CHECK constraints
        DB::statement('ALTER TABLE fichas_alta ADD CONSTRAINT fichas_tipo_cliente_check '.
            "CHECK (tipo_cliente IS NULL OR tipo_cliente IN ('lite','planes','corporate','corporate_cp','corp_cocina'))");
        DB::statement('ALTER TABLE fichas_alta ADD CONSTRAINT fichas_cp_check '.
            "CHECK (cp IS NULL OR cp ~ '^[0-9]{5}$')");
        DB::statement('ALTER TABLE fichas_alta ADD CONSTRAINT fichas_entrega_cp_check '.
            "CHECK (entrega_cp IS NULL OR entrega_cp ~ '^[0-9]{5}$')");
        DB::statement('ALTER TABLE fichas_alta ADD CONSTRAINT fichas_firmas_check '.
            "CHECK (firmas_contratadas IS NULL OR firmas_contratadas IN ('','100','200','300'))");
        DB::statement('ALTER TABLE fichas_alta ADD CONSTRAINT fichas_baja_check '.
            "CHECK (baja IN ('No','Sí','Si'))");
        DB::statement('ALTER TABLE fichas_alta ADD CONSTRAINT fichas_estado_check '.
            "CHECK (estado IN ('pendiente','completada','en_proceso','rellenado','Rellenado'))");

        // Índices
        DB::statement('CREATE INDEX idx_fichas_estado          ON fichas_alta(estado)');
        DB::statement('CREATE INDEX idx_fichas_tipo            ON fichas_alta(tipo_cliente)');
        DB::statement('CREATE INDEX idx_fichas_implementador   ON fichas_alta(implementador)');
        DB::statement('CREATE INDEX idx_fichas_comercial       ON fichas_alta(comercial)');
        DB::statement('CREATE INDEX idx_fichas_denominacion    ON fichas_alta(denominacion)');
        DB::statement('CREATE INDEX idx_fichas_cif             ON fichas_alta(cif)');
        DB::statement('CREATE INDEX idx_fichas_created         ON fichas_alta(created_at DESC)');
        DB::statement('CREATE INDEX idx_fichas_updated         ON fichas_alta(updated_at DESC)');
        DB::statement('CREATE INDEX idx_fichas_deleted         ON fichas_alta(deleted_at) WHERE deleted_at IS NULL');
        DB::statement('CREATE INDEX idx_fichas_modulos_gin     ON fichas_alta USING GIN (modulos)');
    }

    private function createLocales(): void
    {
        Schema::create('locales', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('ficha_id')->constrained('fichas_alta')->restrictOnDelete();
            $table->text('nombre');
            $table->text('email')->nullable();
            $table->text('calle')->nullable();
            $table->text('numero')->nullable();
            $table->text('cp')->nullable();
            $table->text('sociedad_cif')->nullable();
            $table->text('sociedad_denominacion')->nullable();
            $table->text('sociedad_calle')->nullable();
            $table->text('sociedad_numero')->nullable();
            $table->text('sociedad_cp')->nullable();
            $table->text('sociedad_municipio')->nullable();
            $table->text('sociedad_provincia')->nullable();
            $table->decimal('mensualidad', 10, 2)->default(0);
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });
        DB::statement('ALTER TABLE locales ADD CONSTRAINT locales_cp_check '.
            "CHECK (cp IS NULL OR cp ~ '^[0-9]{5}$')");
        DB::statement('CREATE INDEX idx_locales_ficha ON locales(ficha_id)');
    }

    private function createProyectos(): void
    {
        Schema::create('proyectos', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('ficha_id')->nullable()->constrained('fichas_alta')->nullOnDelete();
            $table->text('cliente');
            $table->text('implementador');
            $table->text('tipo');
            $table->text('estado')->default('activo');
            $table->date('fecha_inicio')->nullable();
            $table->date('ultima_actividad')->nullable();
            $table->text('tpv')->nullable();
            $table->text('motivo_pausa')->nullable();
            $table->text('plan_accion')->nullable();
            $table->text('asana_project_id')->nullable();
            $table->text('asana_project_url')->nullable();
            $table->jsonb('anotaciones')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('contactos')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('adjuntos')->default(DB::raw("'[]'::jsonb"));
            $table->jsonb('sepa_mandato')->nullable();
            $table->boolean('grabado_a3')->default(false);
            $table->timestampTz('grabado_a3_at')->nullable();
            $table->jsonb('secciones')->default(DB::raw("'[]'::jsonb"));
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement("ALTER TABLE proyectos ADD COLUMN participantes TEXT[] DEFAULT '{}'");

        DB::statement('ALTER TABLE proyectos ADD CONSTRAINT proyectos_tipo_check '.
            "CHECK (tipo IN ('Planes','Corporate sin cocina','Corporate con cocina'))");
        DB::statement('ALTER TABLE proyectos ADD CONSTRAINT proyectos_estado_check '.
            "CHECK (estado IN ('activo','completado','pausado'))");

        DB::statement('CREATE INDEX idx_proyectos_estado         ON proyectos(estado)');
        DB::statement('CREATE INDEX idx_proyectos_tipo           ON proyectos(tipo)');
        DB::statement('CREATE INDEX idx_proyectos_implementador  ON proyectos(implementador)');
        DB::statement('CREATE INDEX idx_proyectos_ficha          ON proyectos(ficha_id)');
        DB::statement('CREATE INDEX idx_proyectos_cliente        ON proyectos(cliente)');
        DB::statement('CREATE INDEX idx_proyectos_ultima_actv    ON proyectos(ultima_actividad DESC)');
        DB::statement('CREATE INDEX idx_proyectos_created        ON proyectos(created_at DESC)');
        DB::statement('CREATE INDEX idx_proyectos_deleted        ON proyectos(deleted_at) WHERE deleted_at IS NULL');
    }

    private function createBajas(): void
    {
        Schema::create('bajas', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('ficha_id')->nullable()->constrained('fichas_alta')->nullOnDelete();
            $table->text('cliente');
            $table->text('motivo')->nullable();
            $table->date('fecha_baja')->default(DB::raw('CURRENT_DATE'));
            $table->text('implementador')->nullable();
            $table->text('tipo_cliente')->nullable();
            $table->jsonb('datos')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });
        DB::statement('CREATE INDEX idx_bajas_ficha    ON bajas(ficha_id)');
        DB::statement('CREATE INDEX idx_bajas_fecha    ON bajas(fecha_baja DESC)');
        DB::statement('CREATE INDEX idx_bajas_cliente  ON bajas(cliente)');
    }

    private function createSolicitudes(): void
    {
        Schema::create('solicitudes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->foreignUuid('ficha_id')->nullable()->constrained('fichas_alta')->nullOnDelete();
            $table->text('tipo')->nullable();
            $table->text('estado')->default('pendiente');
            $table->text('asignado_a')->nullable();
            $table->text('access_token')->nullable();
            $table->date('fecha_vencimiento')->nullable();
            $table->jsonb('documentos')->default(DB::raw("'[]'::jsonb"));
            $table->text('notas')->nullable();
            $table->jsonb('datos')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        DB::statement('ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check '.
            "CHECK (estado IN ('pendiente','en_progreso','completado','Rellenado','Pendiente'))");

        DB::statement('CREATE UNIQUE INDEX idx_solicitudes_access_token ON solicitudes(access_token) WHERE access_token IS NOT NULL');
        DB::statement('CREATE INDEX idx_solicitudes_ficha   ON solicitudes(ficha_id)');
        DB::statement('CREATE INDEX idx_solicitudes_estado  ON solicitudes(estado)');
        DB::statement('CREATE INDEX idx_solicitudes_created ON solicitudes(created_at DESC)');
    }

    private function createDistribucion(): void
    {
        Schema::create('distribucion', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->text('implementador');
            $table->foreignUuid('ficha_id')->nullable()->constrained('fichas_alta')->nullOnDelete();
            $table->jsonb('datos')->default(DB::raw("'{}'::jsonb"));
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });
        DB::statement('CREATE INDEX idx_distribucion_implementador ON distribucion(implementador)');
        DB::statement('CREATE INDEX idx_distribucion_ficha          ON distribucion(ficha_id)');
    }

    private function createTriggers(): void
    {
        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION update_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        SQL);

        DB::statement('CREATE TRIGGER trg_fichas_updated      BEFORE UPDATE ON fichas_alta  FOR EACH ROW EXECUTE FUNCTION update_updated_at()');
        DB::statement('CREATE TRIGGER trg_proyectos_updated   BEFORE UPDATE ON proyectos    FOR EACH ROW EXECUTE FUNCTION update_updated_at()');
        DB::statement('CREATE TRIGGER trg_bajas_updated       BEFORE UPDATE ON bajas        FOR EACH ROW EXECUTE FUNCTION update_updated_at()');
        DB::statement('CREATE TRIGGER trg_solicitudes_updated BEFORE UPDATE ON solicitudes  FOR EACH ROW EXECUTE FUNCTION update_updated_at()');

        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION fichas_set_estado_timestamps()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.estado = 'completada' AND NEW.fecha_rellenado IS NULL THEN
                    NEW.fecha_rellenado := NOW();
                END IF;
                IF NEW.estado IN ('rellenado', 'Rellenado') AND NEW.fecha_completado IS NULL THEN
                    NEW.fecha_completado := NOW();
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        SQL);

        DB::statement(<<<'SQL'
            CREATE TRIGGER trg_fichas_estado_ts
                BEFORE INSERT OR UPDATE OF estado ON fichas_alta
                FOR EACH ROW EXECUTE FUNCTION fichas_set_estado_timestamps()
        SQL);

        DB::statement(<<<'SQL'
            CREATE OR REPLACE FUNCTION solicitud_propagar_fecha_a_ficha()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.ficha_id IS NOT NULL
                   AND (TG_OP = 'INSERT' OR OLD.ficha_id IS DISTINCT FROM NEW.ficha_id)
                THEN
                    UPDATE fichas_alta
                       SET fecha_solicitud = NEW.created_at
                     WHERE id = NEW.ficha_id
                       AND fecha_solicitud IS NULL;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        SQL);

        DB::statement(<<<'SQL'
            CREATE TRIGGER trg_solicitud_propagar_fecha
                AFTER INSERT OR UPDATE OF ficha_id ON solicitudes
                FOR EACH ROW EXECUTE FUNCTION solicitud_propagar_fecha_a_ficha()
        SQL);
    }
};
