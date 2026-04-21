-- =============================================================================
-- Migration: historial de acciones por ficha (audit log / version history)
-- =============================================================================
-- Fecha:    2026-04-21
-- Motivo:   Tener trazabilidad tipo Google Workspace: quién hizo qué cambio,
--           cuándo, sobre qué ficha. Para debugging, auditoría interna y
--           visibilidad del flujo del cliente.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS fichas_historial (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ficha_id         UUID,              -- referencia a fichas_alta.id (sin FK para no bloquear soft-deletes)
    solicitud_id    UUID,              -- id de solicitud si la acción ocurrió en esa fase
    usuario_id       UUID,              -- quién hizo la acción (null si fue el cliente o el sistema)
    usuario_nombre   TEXT,              -- snapshot del nombre (sobrevive aunque se borre el usuario)
    usuario_rol      TEXT,              -- 'admin' | 'user' | 'cliente' | 'sistema'
    accion           TEXT         NOT NULL,
    descripcion      TEXT,              -- texto legible para mostrar en la UI
    cambios          JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- {campo: {before, after}}
    metadata         JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- contexto adicional (IP, UA, disparador, etc.)
    creado_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices para consultas típicas: historial de una ficha, de un usuario, por fecha
CREATE INDEX IF NOT EXISTS idx_fichas_historial_ficha
    ON fichas_historial(ficha_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_historial_solicitud
    ON fichas_historial(solicitud_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_historial_usuario
    ON fichas_historial(usuario_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_fichas_historial_accion_fecha
    ON fichas_historial(accion, creado_at DESC);

-- RLS + política service_role
ALTER TABLE fichas_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON fichas_historial;
CREATE POLICY "service_role_all" ON fichas_historial
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Refrescar caché PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fichas_historial'
ORDER BY ordinal_position;
