-- =============================================================================
-- Migration: caché de resúmenes semanales de incidencias (Soporte → IA)
-- =============================================================================
-- Fecha:    2026-04-28
-- Motivo:   El informe "Resumen semanal de incidencias" llama a OpenAI cada
--           vez que se abre una semana. Para semanas pasadas el dataset es
--           inmutable (los tickets ya no cambian) y volver a generar el
--           resumen cuesta tokens y produce textos ligeramente distintos
--           cada vez. Cacheamos el resumen completo por (año, semana ISO).
--
--           El workflow 28 hace un GET por (anio, semana) antes de pegar
--           a Zendesk/OpenAI. Si encuentra fila → devuelve la cacheada.
--           Si no → genera, hace UPSERT y devuelve. Con `?refresh=1` el
--           workflow ignora la caché y regenera (sobreescribe la fila).
-- =============================================================================

CREATE TABLE IF NOT EXISTS resumenes_semanales (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificador único de la semana ISO. ISO 8601: la semana 1 contiene
    -- el primer jueves del año, así que (anio, semana) puede no coincidir
    -- exactamente con el year del lunes/domingo, pero garantiza unicidad.
    anio            INTEGER      NOT NULL,
    semana          INTEGER      NOT NULL CHECK (semana BETWEEN 1 AND 53),

    -- Rango exacto en fechas — útil para el front (label) y para evitar
    -- tener que recalcular en cada lectura.
    fecha_desde     DATE         NOT NULL,
    fecha_hasta     DATE         NOT NULL,

    -- Snapshot agregado de los tickets (lo que devuelve el workflow al front).
    -- Se persiste tal cual para que la página tenga consistencia 100% entre
    -- la lectura cacheada y la generada al vuelo.
    total_tickets   INTEGER      NOT NULL DEFAULT 0,
    por_tipo        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    por_entorno     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    por_modulo      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    tickets         JSONB        NOT NULL DEFAULT '[]'::jsonb,

    -- Resultado de GPT.
    resumen_markdown TEXT,
    modelo          TEXT,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Una sola fila por (anio, semana). El workflow hace UPSERT contra
    -- esta restricción cuando se fuerza regeneración con ?refresh=1.
    UNIQUE (anio, semana)
);

CREATE INDEX IF NOT EXISTS idx_resumenes_semanales_anio_semana
    ON resumenes_semanales(anio DESC, semana DESC);
CREATE INDEX IF NOT EXISTS idx_resumenes_semanales_created
    ON resumenes_semanales(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS (mismo patrón que el resto de tablas del portal).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE resumenes_semanales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON resumenes_semanales;
CREATE POLICY "service_role_all" ON resumenes_semanales
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_resumenes_semanales_updated ON resumenes_semanales;
CREATE TRIGGER trg_resumenes_semanales_updated
    BEFORE UPDATE ON resumenes_semanales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'resumenes_semanales'
 ORDER BY ordinal_position;
