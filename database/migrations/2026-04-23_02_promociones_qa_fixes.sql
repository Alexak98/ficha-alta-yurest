-- ============================================================================
-- QA Promociones: políticas RLS que faltaban + límites sanos de plazas
--
-- Motivo (ver docs/QA-PROMOCIONES-HALLAZGOS.md):
--   B4 — Hasta ahora sólo existía la policy service_role_all. El workflow 20
--        usa la clave anon (igual que 21-hardware-pedidos antes del fix),
--        por lo que todos los INSERT/UPDATE fallaban en silencio: GET []
--        devolvía vacío y POST aparentaba éxito sin persistir.
--
--   F1 — El CHECK original sólo exigía plazas_manana >= 0 y plazas_tarde >= 0.
--        Una promoción con 9999 plazas rompería el cálculo de ocupación y
--        el selector de sinasignar.html. Fijamos un tope razonable (100/turno).
-- ============================================================================

-- ── RLS para anon (misma política que hardware_pedidos / proyectos) ────────
-- La lectura pública no se expone — el webhook n8n exige BasicAuth
-- ("Yurest Portal Auth"), así que la policy abierta sólo es accesible vía
-- service_role o anon dentro del flujo autenticado.
DROP POLICY IF EXISTS "anon_write_promociones" ON promociones;
CREATE POLICY "anon_write_promociones" ON promociones
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- ── CHECK límite superior de plazas ────────────────────────────────────────
-- Postgres no permite alterar un CHECK in-place; hay que dropear y recrear.
ALTER TABLE promociones DROP CONSTRAINT IF EXISTS promociones_plazas_manana_check;
ALTER TABLE promociones
    ADD CONSTRAINT promociones_plazas_manana_check
    CHECK (plazas_manana >= 0 AND plazas_manana <= 100);

ALTER TABLE promociones DROP CONSTRAINT IF EXISTS promociones_plazas_tarde_check;
ALTER TABLE promociones
    ADD CONSTRAINT promociones_plazas_tarde_check
    CHECK (plazas_tarde >= 0 AND plazas_tarde <= 100);

-- ── S2: vista incluye archivadas para que la UI pueda reactivar ─────────────
-- La vista original filtraba `WHERE p.deleted_at IS NULL`, lo que hacía
-- invisibles las promociones archivadas y convertía el action `reactivar` en
-- código muerto. La recreamos sin filtro y delegamos al workflow (parámetro
-- ?incluir_archivadas=1) decidir si devuelve las borradas.
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
 GROUP BY p.id;

COMMENT ON VIEW promociones_ocupacion IS
    'Listado de promociones con ocupación derivada. Incluye archivadas (deleted_at IS NOT NULL); el consumidor debe filtrar si no las quiere.';

-- Refresca schema cache de PostgREST (imprescindible si se cambió RLS/vista).
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT estado, COUNT(*) AS n FROM promociones GROUP BY estado ORDER BY estado;
