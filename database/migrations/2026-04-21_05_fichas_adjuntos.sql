-- =============================================================================
-- Migration: añadir columna `adjuntos` a fichas_alta
-- =============================================================================
-- Fecha:    2026-04-21
-- Motivo:   El workflow 04-fichas-alta ya escribe row.adjuntos desde hace
--           varias versiones (documentos PDF/JPG/PNG que el comercial adjunta
--           a la ficha desde index.html), pero la columna faltaba en
--           fichas_alta — sólo existía en `proyectos`. Error observado:
--             "Could not find the 'adjuntos' column of 'fichas_alta'
--              in the schema cache"
--           Este script es idempotente: si la columna ya existe no hace nada.
-- =============================================================================

ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS adjuntos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN fichas_alta.adjuntos IS
    'Array JSONB de documentos adjuntos a la ficha: '
    '[{ id, nombre, tipo (mime), size, data (data-URI base64 o URL), fecha }].';

-- Refrescar caché de PostgREST para que n8n / Supabase REST vean la columna
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fichas_alta'
  AND column_name = 'adjuntos';
