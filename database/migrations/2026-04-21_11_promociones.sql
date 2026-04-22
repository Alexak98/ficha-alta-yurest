-- ============================================================================
-- Promociones de implementación para clientes tipo "Planes"
--
-- Una promoción es una tanda de implementaciones con 16 plazas totales,
-- divididas en 2 turnos:
--   · Mañana:  8 plazas
--   · Tarde:   8 plazas
--
-- Cada proyecto de un cliente tipo Planes ocupa 1 plaza en 1 turno de 1
-- promoción. Cuando una promoción alcanza las 16 plazas ya no se muestra
-- como opción al asignar nuevos proyectos.
--
-- Modelo: no hay tabla de plazas — el cómputo se deriva del join
-- proyectos(promocion_id, promocion_turno) GROUP BY. Más simple, y el
-- número de plazas libres siempre refleja la realidad de proyectos.
-- ============================================================================

-- ── 1. Tabla promociones ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promociones (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre        TEXT NOT NULL,
    descripcion   TEXT,
    fecha_inicio  DATE,
    estado        TEXT DEFAULT 'activa'
                  CHECK (estado IN ('activa', 'cerrada')),
    -- Capacidades por turno (por si en el futuro se quieren promos
    -- irregulares de 5/10 etc.); por defecto 8+8 = 16.
    plazas_manana INT DEFAULT 8 CHECK (plazas_manana >= 0),
    plazas_tarde  INT DEFAULT 8 CHECK (plazas_tarde  >= 0),

    deleted_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    created_by    TEXT
);

COMMENT ON TABLE promociones IS
    'Tandas de implementación para clientes tipo Planes. 16 plazas (8 mañana + 8 tarde) salvo que se personalice.';

-- ── 2. FKs en proyectos ────────────────────────────────────────────────────
ALTER TABLE proyectos
    ADD COLUMN IF NOT EXISTS promocion_id   UUID REFERENCES promociones(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS promocion_turno TEXT;

ALTER TABLE proyectos
    DROP CONSTRAINT IF EXISTS proyectos_promocion_turno_check;
ALTER TABLE proyectos
    ADD CONSTRAINT proyectos_promocion_turno_check
    CHECK (promocion_turno IS NULL OR promocion_turno IN ('manana', 'tarde'));

-- Índice para el cálculo de ocupación (GROUP BY promocion_id, turno).
CREATE INDEX IF NOT EXISTS idx_proyectos_promocion
    ON proyectos(promocion_id, promocion_turno)
    WHERE promocion_id IS NOT NULL;

COMMENT ON COLUMN proyectos.promocion_id IS
    'FK a promociones.id. Solo informa para proyectos tipo Planes.';
COMMENT ON COLUMN proyectos.promocion_turno IS
    'manana | tarde. Turno asignado dentro de la promoción.';

-- ── 3. Vista con ocupación derivada ────────────────────────────────────────
-- Simplifica la query desde el front (y desde workflows) — no hay que
-- rehacer el GROUP BY cada vez que se muestra el selector de promoción.
CREATE OR REPLACE VIEW promociones_ocupacion AS
SELECT
    p.id,
    p.nombre,
    p.descripcion,
    p.fecha_inicio,
    p.estado,
    p.plazas_manana,
    p.plazas_tarde,
    p.deleted_at,
    p.created_at,
    p.updated_at,
    p.created_by,
    COALESCE(SUM(CASE WHEN pr.promocion_turno = 'manana' THEN 1 ELSE 0 END), 0)::int AS ocupadas_manana,
    COALESCE(SUM(CASE WHEN pr.promocion_turno = 'tarde'  THEN 1 ELSE 0 END), 0)::int AS ocupadas_tarde,
    (p.plazas_manana + p.plazas_tarde)::int AS plazas_total,
    (
        p.plazas_manana - COALESCE(SUM(CASE WHEN pr.promocion_turno = 'manana' THEN 1 ELSE 0 END), 0)
    )::int AS libres_manana,
    (
        p.plazas_tarde  - COALESCE(SUM(CASE WHEN pr.promocion_turno = 'tarde'  THEN 1 ELSE 0 END), 0)
    )::int AS libres_tarde,
    (
        (p.plazas_manana + p.plazas_tarde) -
        COALESCE(SUM(CASE WHEN pr.promocion_turno IN ('manana','tarde') THEN 1 ELSE 0 END), 0)
    )::int AS libres_total
  FROM promociones p
  LEFT JOIN proyectos pr
    ON pr.promocion_id = p.id
   AND pr.deleted_at IS NULL
 WHERE p.deleted_at IS NULL
 GROUP BY p.id;

COMMENT ON VIEW promociones_ocupacion IS
    'Listado de promociones con ocupación derivada desde proyectos. Útil como fuente para el selector de promoción en sinasignar.html.';

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE promociones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON promociones;
CREATE POLICY "service_role_all" ON promociones
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 5. Refresca schema cache de PostgREST ─────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT 'promociones' AS tabla, COUNT(*) AS n FROM promociones
 UNION ALL
SELECT 'proyectos con promocion', COUNT(*) FROM proyectos WHERE promocion_id IS NOT NULL;
