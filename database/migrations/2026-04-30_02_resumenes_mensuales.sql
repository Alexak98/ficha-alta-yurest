-- =============================================================================
-- Migration: caché de resúmenes MENSUALES de incidencias (Soporte → IA)
-- =============================================================================
-- Fecha:    2026-04-30
-- Motivo:   Hermano mensual del informe semanal (workflow 28 / tabla
--           resumenes_semanales). El mensual hace un análisis MUCHO más
--           profundo: top clientes, distribución diaria, tendencias,
--           patrones, módulos críticos. Por eso pesa más en tokens y
--           tarda más en generarse → cacheamos siempre y dejamos un
--           botón de "Regenerar" en la UI cuando el usuario quiera
--           refrescar manualmente.
--
--           El workflow 29 hace GET por (anio, mes) antes de tirar a
--           Zendesk/OpenAI. Si hay fila → devuelve la cacheada. Si no
--           o si llega ?refresh=1 → genera, hace UPSERT y devuelve.
-- =============================================================================

CREATE TABLE IF NOT EXISTS resumenes_mensuales (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Año + mes natural (1..12). Sin solapamiento con semanas ISO ni
    -- particularidades de calendario — el mes es siempre el calendario
    -- gregoriano completo (1..28/29/30/31).
    anio            INTEGER      NOT NULL,
    mes             INTEGER      NOT NULL CHECK (mes BETWEEN 1 AND 12),

    -- Rango exacto en fechas — útil para el front (label) y para evitar
    -- tener que recalcular en cada lectura. fecha_desde es siempre día 1
    -- del mes, fecha_hasta es día 28..31 según el mes.
    fecha_desde     DATE         NOT NULL,
    fecha_hasta     DATE         NOT NULL,

    -- Snapshot agregado de los tickets. Mismo shape que resumenes_semanales
    -- + extras pensados para el análisis profundo:
    --   por_dia      → array [{dia: 1..31, count}] para gráfica/heatmap
    --   por_estado   → array [{estado, count}] (open/pending/solved/closed)
    --   top_clientes → array [{organizacion, count, modulos[], tipos[]}]
    --                   con los N clientes más activos del mes.
    total_tickets   INTEGER      NOT NULL DEFAULT 0,
    por_tipo        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    por_entorno     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    por_modulo      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    por_dia         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    por_estado      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    top_clientes    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    tickets         JSONB        NOT NULL DEFAULT '[]'::jsonb,

    -- Resultado de GPT (markdown del informe completo).
    resumen_markdown TEXT,
    modelo          TEXT,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Una sola fila por (anio, mes). El workflow hace UPSERT contra
    -- esta restricción cuando se fuerza regeneración con ?refresh=1.
    UNIQUE (anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_resumenes_mensuales_anio_mes
    ON resumenes_mensuales(anio DESC, mes DESC);
CREATE INDEX IF NOT EXISTS idx_resumenes_mensuales_created
    ON resumenes_mensuales(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS (mismo patrón que el resto de tablas del portal).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE resumenes_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON resumenes_mensuales;
CREATE POLICY "service_role_all" ON resumenes_mensuales
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger updated_at — usa la función update_updated_at() ya existente
-- (migración inicial del portal define una global compartida).
DROP TRIGGER IF EXISTS trg_resumenes_mensuales_updated ON resumenes_mensuales;
CREATE TRIGGER trg_resumenes_mensuales_updated
    BEFORE UPDATE ON resumenes_mensuales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'resumenes_mensuales'
 ORDER BY ordinal_position;
