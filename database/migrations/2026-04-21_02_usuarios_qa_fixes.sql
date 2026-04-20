-- =============================================================================
-- Migration: parches tras la QA del sistema de usuarios y permisos
-- =============================================================================
-- Fecha:    2026-04-21
-- Motivo:   Refuerzos de seguridad detectados en QA:
--           1) Añadir columna `sessions_revoked_at` para invalidar sesiones
--              activas cuando el admin cambie rol/permisos/activo o borre un
--              usuario. El frontend comparará este timestamp con el snapshot
--              guardado en la sesión y forzará re-login si es más reciente.
--           2) Garantizar que existe la función update_updated_at() en caso
--              de que la migración base no la hubiera creado.
-- =============================================================================

-- 1) Asegurar función update_updated_at (usada por el trigger)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Nueva columna en usuarios
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ;

-- Refrescar caché PostgREST para que el nodo Supabase de n8n vea la columna
NOTIFY pgrst, 'reload schema';

-- 3) Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name IN ('sessions_revoked_at', 'updated_at', 'password_hash');
