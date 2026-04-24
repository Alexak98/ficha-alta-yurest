-- ============================================================================
-- Churn técnico (departamento Soporte)
--
-- Sustituye la hoja de Google Sheets
-- "Organizaciones id Zendesk" (gid=0, doc 1QLm2bZ_jUF3YED8DOh5viWFnSNVPw3hmaB8WxXDAYXA)
-- por una tabla en Supabase. Cada fila es una organización de Zendesk con
-- el último resumen de actividad de tickets generado por el workflow
-- "Churn Técnico - yurest" y su nivel de riesgo de abandono (1-10).
--
-- El flujo n8n (ver 24-churn-tecnico-supabase.json) hace upsert por
-- id_organizacion: inserta si no existe, actualiza si ya existe. El front
-- (churn-tecnico/index.html) lee:
--   · GET  all rows        → listado de clientes (card grid)
--   · lookup por org_id    → detalle "Buscar resumen"
-- ============================================================================

CREATE TABLE IF NOT EXISTS churn_tecnico (
    -- ID de la organización en Zendesk. Único natural por cliente — es la
    -- columna de match en todos los upserts del workflow.
    id_organizacion  TEXT        PRIMARY KEY,
    -- Nombre comercial de la organización (se copia de Zendesk en cada upsert
    -- para poder buscar/mostrar sin tener que hacer join contra Zendesk).
    nombre           TEXT,
    -- Resumen markdown generado por GPT-4o. Puede valer "No hay tickets"
    -- cuando el cliente existe en Zendesk pero no tiene tickets en el periodo.
    respuesta_ia     TEXT,
    -- Nivel de riesgo de churn (1-10). 0 se usa como sentinel para
    -- "No hay tickets". El front lo pinta en el chip de color del card.
    nivel            SMALLINT    CHECK (nivel IS NULL OR nivel BETWEEN 0 AND 10),
    -- Timestamp del último resumen. Los jobs diarios filtran por este campo
    -- para refrescar sólo filas con fecha < hoy o vacías.
    fecha_resumen    TIMESTAMPTZ,
    -- Auditoría interna (no se expone al front).
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para los Filter nodes que ordenan/filtran por fecha al refrescar.
CREATE INDEX IF NOT EXISTS idx_churn_tecnico_fecha_resumen
    ON churn_tecnico (fecha_resumen);

-- Índice para los Filter nodes que buscan filas sin nivel calculado.
CREATE INDEX IF NOT EXISTS idx_churn_tecnico_nivel_null
    ON churn_tecnico (id_organizacion) WHERE nivel IS NULL;

-- Trigger para mantener updated_at sincronizado en cada upsert/update.
CREATE OR REPLACE FUNCTION touch_churn_tecnico_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_churn_tecnico_touch ON churn_tecnico;
CREATE TRIGGER trg_churn_tecnico_touch
    BEFORE UPDATE ON churn_tecnico
    FOR EACH ROW EXECUTE FUNCTION touch_churn_tecnico_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- El acceso desde el front es vía n8n (service_role), no directamente desde
-- el navegador. Habilitamos RLS y dejamos sólo service_role con permisos.
ALTER TABLE churn_tecnico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS churn_tecnico_service_all ON churn_tecnico;
CREATE POLICY churn_tecnico_service_all ON churn_tecnico
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
