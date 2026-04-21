-- =============================================================================
-- Migration: timeline de acciones por proyecto (audit log del gestor)
-- =============================================================================
-- Fecha:    2026-04-21
-- Motivo:   Registrar quién hizo qué dentro de cada proyecto del gestor:
--           tareas completadas/reabiertas, subtareas agendadas, cambios de
--           estado del proyecto, etc. Paralelo a fichas_historial.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS proyectos_historial (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id     UUID         NOT NULL,
    usuario_id      UUID,
    usuario_nombre  TEXT,
    usuario_rol     TEXT,
    accion          TEXT         NOT NULL,
    -- Contexto del elemento afectado (opcional según la acción)
    seccion_nombre  TEXT,
    tarea_id        TEXT,
    tarea_nombre    TEXT,
    -- Texto libre + diff opcional
    descripcion     TEXT,
    cambios         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    metadata        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    creado_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proyectos_historial_proyecto
    ON proyectos_historial(proyecto_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_proyectos_historial_usuario
    ON proyectos_historial(usuario_id, creado_at DESC);
CREATE INDEX IF NOT EXISTS idx_proyectos_historial_accion
    ON proyectos_historial(accion, creado_at DESC);

ALTER TABLE proyectos_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON proyectos_historial;
CREATE POLICY "service_role_all" ON proyectos_historial
    FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'proyectos_historial'
ORDER BY ordinal_position;
