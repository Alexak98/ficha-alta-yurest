-- =============================================================================
-- Migration: notificaciones automáticas semanales de Integraciones
-- =============================================================================
-- Fecha:    2026-04-19
-- Motivo:   Mover la config del workflow 14 (que estaba hardcoded en n8n) a
--           Supabase para poder editarla desde el panel de Integraciones, y
--           guardar un historial de cada ejecución / email enviado para tener
--           trazabilidad semanal de a quién se ha avisado y de qué clientes.
-- Tablas:
--   notif_integraciones_config     (1 fila, configuración global)
--   notif_integraciones_grupos     (N filas, un grupo por destinatarios)
--   notif_integraciones_historial  (N filas, una por email enviado)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────────────────────
-- 1) CONFIGURACIÓN GLOBAL (única fila, se "upsert" desde la UI)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notif_integraciones_config (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asana_project_id       TEXT        NOT NULL DEFAULT '1207920061546505',
    umbral_dias            INT         NOT NULL DEFAULT 7,
    secciones_seguimiento  JSONB       NOT NULL DEFAULT
        '["Solicitud de datos realizada","Datos incorrectos y notificados","Integraciones pendientes"]'::jsonb,
    activo                 BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by             TEXT
);

-- Insertar la fila inicial si todavía no existe
INSERT INTO notif_integraciones_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM notif_integraciones_config);

-- ───────────────────────────────────────────────────────────────────────────
-- 2) GRUPOS DE DESTINATARIOS
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notif_integraciones_grupos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre            TEXT        NOT NULL,
    destinatarios     TEXT        NOT NULL,
    filtro_tpv        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    filtro_secciones  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    orden             INT         NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_grupos_activos
    ON notif_integraciones_grupos(activo, orden)
    WHERE deleted_at IS NULL;

-- Sembrar un grupo por defecto la primera vez (para que el workflow tenga
-- algo a quién mandar tras la migración).
INSERT INTO notif_integraciones_grupos (nombre, destinatarios, orden)
SELECT 'Equipo Integraciones', 'soporte@yurest.com', 0
WHERE NOT EXISTS (SELECT 1 FROM notif_integraciones_grupos WHERE deleted_at IS NULL);

-- ───────────────────────────────────────────────────────────────────────────
-- 3) HISTORIAL DE EJECUCIONES (una fila por email procesado)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notif_integraciones_historial (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ejecutado_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grupo_id        UUID,                                  -- puede quedar NULL si el grupo se borra
    grupo_nombre    TEXT        NOT NULL,
    destinatarios   TEXT        NOT NULL,
    total_tareas    INT         NOT NULL DEFAULT 0,
    umbral_dias     INT         NOT NULL,
    tareas          JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- snapshot de las tareas reportadas
    email_enviado   BOOLEAN     NOT NULL DEFAULT FALSE,
    error           TEXT,
    disparador      TEXT        NOT NULL DEFAULT 'cron'         -- 'cron' | 'manual'
);

CREATE INDEX IF NOT EXISTS idx_notif_hist_fecha
    ON notif_integraciones_historial(ejecutado_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_hist_grupo
    ON notif_integraciones_historial(grupo_id, ejecutado_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS y políticas (mismo patrón que el resto de tablas del portal)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE notif_integraciones_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notif_integraciones_grupos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notif_integraciones_historial  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON notif_integraciones_config;
DROP POLICY IF EXISTS "service_role_all" ON notif_integraciones_grupos;
DROP POLICY IF EXISTS "service_role_all" ON notif_integraciones_historial;

CREATE POLICY "service_role_all" ON notif_integraciones_config
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON notif_integraciones_grupos
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON notif_integraciones_historial
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────────
-- Triggers updated_at (reusan la función update_updated_at del esquema base)
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notif_config_updated  ON notif_integraciones_config;
DROP TRIGGER IF EXISTS trg_notif_grupos_updated  ON notif_integraciones_grupos;

CREATE TRIGGER trg_notif_config_updated
    BEFORE UPDATE ON notif_integraciones_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notif_grupos_updated
    BEFORE UPDATE ON notif_integraciones_grupos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT
    table_name,
    (SELECT COUNT(*)
     FROM information_schema.columns c
     WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS columnas
FROM (VALUES
    ('notif_integraciones_config'),
    ('notif_integraciones_grupos'),
    ('notif_integraciones_historial')
) AS t(table_name);
