-- =============================================================================
-- Migration: convertir `proyectos.anotaciones` (TEXT libre) en bitácora JSONB
-- =============================================================================
-- Fecha:    2026-04-18
-- Motivo:   Las anotaciones de un proyecto deben ser un cuaderno de bitácora
--           con entradas independientes, cada una con fecha + usuario, y
--           editables/borrables. Pasamos de TEXT a JSONB con array de objetos:
--           [{ id, texto, usuario, fechaCreacion, fechaEdicion|null }]
-- =============================================================================

-- Necesario para gen_random_uuid() (incluido por defecto en Supabase pero
-- por si acaso).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proyectos'
      AND column_name = 'anotaciones';

    IF col_type IS NULL THEN
        -- Columna no existía: la creamos directamente como JSONB.
        ALTER TABLE proyectos ADD COLUMN anotaciones JSONB NOT NULL DEFAULT '[]'::jsonb;
    ELSIF col_type = 'text' THEN
        -- Migración: convertir TEXT → JSONB conservando el contenido como
        -- una primera entrada de la bitácora si no está vacío.
        ALTER TABLE proyectos
            ALTER COLUMN anotaciones DROP DEFAULT;
        ALTER TABLE proyectos
            ALTER COLUMN anotaciones TYPE JSONB USING (
                CASE
                    WHEN anotaciones IS NULL OR length(trim(anotaciones)) = 0
                        THEN '[]'::jsonb
                    ELSE jsonb_build_array(jsonb_build_object(
                        'id',            gen_random_uuid()::text,
                        'texto',         anotaciones,
                        'usuario',       'migración',
                        'fechaCreacion', COALESCE(updated_at, created_at, now()),
                        'fechaEdicion',  NULL
                    ))
                END
            );
        ALTER TABLE proyectos
            ALTER COLUMN anotaciones SET DEFAULT '[]'::jsonb;
        ALTER TABLE proyectos
            ALTER COLUMN anotaciones SET NOT NULL;
    END IF;
END $$;

-- Refrescar caché de PostgREST para que el nuevo tipo JSONB se vea desde el
-- nodo Supabase de n8n.
NOTIFY pgrst, 'reload schema';

-- Verificación: tipo y default
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proyectos'
  AND column_name = 'anotaciones';
