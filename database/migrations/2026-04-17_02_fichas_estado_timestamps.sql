-- ─────────────────────────────────────────────────────────────────────────
-- Timestamps por estado para fichas_alta + triggers + backfill
-- ─────────────────────────────────────────────────────────────────────────
-- Motivación: hasta ahora se inferían los tiempos por estado a partir de
-- created_at / updated_at, pero updated_at se mueve con cualquier edición
-- posterior y no permite calcular con precisión las métricas de Ventas
-- (Solicitud → Rellenado, Rellenado → Completado).
--
-- Esta migración:
--   1. Añade tres columnas timestamp dedicadas a fichas_alta.
--   2. Crea triggers que las setean automáticamente al cambiar el estado o
--      al enlazar una solicitud con su ficha resultante.
--   3. Hace un backfill conservador con los datos actuales.
--
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Columnas
ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS fecha_solicitud  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fecha_rellenado  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fecha_completado TIMESTAMPTZ;

-- 2a. Trigger sobre fichas_alta: setea fecha_rellenado / fecha_completado la
--     primera vez que estado pasa a 'rellenado' / 'completada'. No vuelve a
--     pisarlas si ya tenían valor (preserva la fecha original).
CREATE OR REPLACE FUNCTION fichas_set_estado_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IN ('rellenado', 'Rellenado') AND NEW.fecha_rellenado IS NULL THEN
        NEW.fecha_rellenado := NOW();
    END IF;
    IF NEW.estado = 'completada' AND NEW.fecha_completado IS NULL THEN
        NEW.fecha_completado := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fichas_estado_ts ON fichas_alta;
CREATE TRIGGER trg_fichas_estado_ts
    BEFORE INSERT OR UPDATE OF estado ON fichas_alta
    FOR EACH ROW EXECUTE FUNCTION fichas_set_estado_timestamps();

-- 2b. Trigger sobre solicitudes: cuando se rellena una solicitud y queda
--     enlazada a su ficha (ficha_id pasa de NULL a un valor), copia
--     solicitudes.created_at a fichas_alta.fecha_solicitud.
CREATE OR REPLACE FUNCTION solicitud_propagar_fecha_a_ficha()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ficha_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.ficha_id IS DISTINCT FROM NEW.ficha_id)
    THEN
        UPDATE fichas_alta
           SET fecha_solicitud = NEW.created_at
         WHERE id = NEW.ficha_id
           AND fecha_solicitud IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solicitud_propagar_fecha ON solicitudes;
CREATE TRIGGER trg_solicitud_propagar_fecha
    AFTER INSERT OR UPDATE OF ficha_id ON solicitudes
    FOR EACH ROW EXECUTE FUNCTION solicitud_propagar_fecha_a_ficha();

-- 3. Backfill conservador con los datos existentes:
--    - fecha_rellenado: para cualquier ficha ya creada, asumimos que se rellenó
--      al crearse (created_at). Mejor proxy disponible.
--    - fecha_completado: solo si estado = 'completada'. Usamos updated_at como
--      proxy del momento en que pasó a ese estado.
--    - fecha_solicitud: si existe una solicitud enlazada (solicitudes.ficha_id),
--      tomamos su created_at.
UPDATE fichas_alta
   SET fecha_rellenado = COALESCE(fecha_rellenado, created_at)
 WHERE fecha_rellenado IS NULL;

UPDATE fichas_alta
   SET fecha_completado = COALESCE(fecha_completado, updated_at)
 WHERE estado = 'completada'
   AND fecha_completado IS NULL;

UPDATE fichas_alta f
   SET fecha_solicitud = s.created_at
  FROM solicitudes s
 WHERE s.ficha_id = f.id
   AND f.fecha_solicitud IS NULL;
