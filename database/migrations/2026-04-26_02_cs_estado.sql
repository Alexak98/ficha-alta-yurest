-- =============================================================================
-- Migration: estado de Customer Success por cliente (Kanban CS)
-- =============================================================================
-- Fecha:    2026-04-26
-- Motivo:   Customer Success necesita una vista Kanban con el seguimiento de
--           cada cliente activo durante el primer ciclo de vida. Cada cliente
--           va circulando por columnas: en implementación → post primer mes
--           → reunión post 1 mes agendada → post 3 meses, con rutas laterales
--           para escalado, stand-by, crítico y sanación.
--
--           Persistimos el estado actual como columna en fichas_alta (la
--           fuente de verdad de los clientes) y guardamos cada transición
--           en una tabla aparte para tener trazabilidad.
-- =============================================================================

-- ── 1. Columna cs_estado en fichas_alta ────────────────────────────────────
ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS cs_estado TEXT
        CHECK (cs_estado IS NULL OR cs_estado IN (
            'en_implementacion',
            'post_primer_mes',
            'reunion_post_1_mes_agendada',
            'posible_escalado',
            'stand_by',
            'critico',
            'sanacion',
            'post_3_meses'
        ));

COMMENT ON COLUMN fichas_alta.cs_estado IS
    'Estado del cliente en el Kanban de Customer Success. NULL = sin clasificar (la UI lo muestra en una columna inicial). Los valores son slugs ASCII; la UI los traduce a etiquetas legibles.';

-- Índice para filtrar/agrupar clientes por columna del Kanban en GET.
CREATE INDEX IF NOT EXISTS idx_fichas_alta_cs_estado
    ON fichas_alta(cs_estado)
    WHERE deleted_at IS NULL;

-- ── 2. Historial de transiciones ───────────────────────────────────────────
-- Cada vez que un usuario mueve un cliente entre columnas, registramos la
-- transición. Útil para reportes ("¿cuánto tiempo de media en stand_by
-- antes de pasar a sanación?") y para reconstruir cómo llegó el cliente
-- al estado actual.
CREATE TABLE IF NOT EXISTS cs_estado_historial (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id      UUID         NOT NULL REFERENCES fichas_alta(id) ON DELETE CASCADE,

    estado_desde  TEXT,        -- NULL si era el primer registro
    estado_hasta  TEXT         NOT NULL,

    movido_por    TEXT,        -- username del usuario que hizo el movimiento
    notas         TEXT,

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_historial_ficha
    ON cs_estado_historial(ficha_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_historial_created
    ON cs_estado_historial(created_at DESC);

-- ── 3. RLS + políticas (mismo patrón que el resto) ─────────────────────────
ALTER TABLE cs_estado_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON cs_estado_historial;
CREATE POLICY "service_role_all" ON cs_estado_historial
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Refrescar caché de PostgREST.
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'fichas_alta'
   AND column_name = 'cs_estado';

SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'cs_estado_historial'
 ORDER BY ordinal_position;
