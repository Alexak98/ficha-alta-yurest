-- =============================================================================
-- Migration: garantizar columna `deleted_at` en `proyectos` y refrescar caché
-- de PostgREST
-- =============================================================================
-- Fecha:    2026-04-18
-- Motivo:   El workflow 01-proyectos-crud falla al borrar con
--           "Could not find the 'deleted_at' column of 'proyectos' in the
--           schema cache". La columna debería existir según schema.sql, pero
--           PostgREST puede tener su caché obsoleto, o la columna no llegó a
--           aplicarse en este entorno. Este script es idempotente.
-- =============================================================================

-- 1) Asegurar que la columna existe (no-op si ya está)
ALTER TABLE proyectos
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2) Asegurar el índice parcial (acelera filtros "WHERE deleted_at IS NULL")
CREATE INDEX IF NOT EXISTS idx_proyectos_deleted
    ON proyectos(deleted_at) WHERE deleted_at IS NULL;

-- 3) Forzar a PostgREST a recargar el esquema. Sin esto, aunque la columna
--    exista, el nodo Supabase de n8n seguirá fallando con el mismo error.
NOTIFY pgrst, 'reload schema';

-- 4) Verificar (devuelve la fila si la columna existe)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proyectos'
  AND column_name = 'deleted_at';
