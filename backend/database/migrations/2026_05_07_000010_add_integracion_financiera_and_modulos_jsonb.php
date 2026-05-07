<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Añade columnas integracion_financiera + int_fin_persona + int_fin_email
 * a fichas_alta (workflow legacy 04 las espera) y convierte la columna
 * `modulos` de TEXT[] a JSONB para que Eloquent la maneje sin sufrir.
 *
 * Replica la SQL legacy 2026-04-21_09_integracion_financiera.sql.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) Integración financiera
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS integracion_financiera TEXT');
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS int_fin_persona TEXT');
        DB::statement('ALTER TABLE fichas_alta ADD COLUMN IF NOT EXISTS int_fin_email TEXT');
        DB::statement('ALTER TABLE fichas_alta DROP CONSTRAINT IF EXISTS fichas_alta_integracion_financiera_check');
        DB::statement(<<<'SQL'
            ALTER TABLE fichas_alta ADD CONSTRAINT fichas_alta_integracion_financiera_check
                CHECK (integracion_financiera IS NULL
                       OR integracion_financiera IN ('no_aplica','sage','a3'))
        SQL);

        // 2) modulos: TEXT[] → JSONB.
        // Postgres exige quitar el DEFAULT antes de cambiar el tipo
        // porque '{}'::text[] no se puede castear automáticamente a jsonb.
        DB::statement('DROP INDEX IF EXISTS idx_fichas_modulos_gin');
        DB::statement('ALTER TABLE fichas_alta ALTER COLUMN modulos DROP DEFAULT');
        DB::statement(
            'ALTER TABLE fichas_alta ALTER COLUMN modulos TYPE JSONB '.
            'USING COALESCE(to_jsonb(modulos), \'[]\'::jsonb)'
        );
        DB::statement("ALTER TABLE fichas_alta ALTER COLUMN modulos SET DEFAULT '[]'::jsonb");
        DB::statement('CREATE INDEX idx_fichas_modulos_gin ON fichas_alta USING GIN (modulos)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_fichas_modulos_gin');
        DB::statement(
            'ALTER TABLE fichas_alta ALTER COLUMN modulos TYPE TEXT[] '.
            "USING (CASE WHEN jsonb_typeof(modulos) = 'array' ".
            'THEN ARRAY(SELECT jsonb_array_elements_text(modulos)) '.
            "ELSE '{}'::text[] END)"
        );
        DB::statement("ALTER TABLE fichas_alta ALTER COLUMN modulos SET DEFAULT '{}'");
        DB::statement('CREATE INDEX idx_fichas_modulos_gin ON fichas_alta USING GIN (modulos)');

        DB::statement('ALTER TABLE fichas_alta DROP CONSTRAINT IF EXISTS fichas_alta_integracion_financiera_check');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS int_fin_email');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS int_fin_persona');
        DB::statement('ALTER TABLE fichas_alta DROP COLUMN IF EXISTS integracion_financiera');
    }
};
