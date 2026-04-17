-- ─────────────────────────────────────────────────────────────────────────
-- Flag "Grabado en A3" en fichas_alta para la sección Contabilidad.
-- Se activa cuando el equipo contable da de alta el cliente en A3.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS grabado_a3    BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS grabado_a3_at TIMESTAMPTZ;

COMMENT ON COLUMN fichas_alta.grabado_a3    IS 'TRUE cuando el cliente está dado de alta en A3 (Contabilidad).';
COMMENT ON COLUMN fichas_alta.grabado_a3_at IS 'Momento en que se marcó como grabado en A3.';

-- Trigger: setea grabado_a3_at la primera vez que pasa a TRUE; lo limpia
-- si vuelve a FALSE para dejar trazabilidad limpia.
CREATE OR REPLACE FUNCTION fichas_set_grabado_a3_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.grabado_a3 = TRUE AND (OLD.grabado_a3 IS DISTINCT FROM TRUE) THEN
        NEW.grabado_a3_at := NOW();
    ELSIF NEW.grabado_a3 = FALSE AND OLD.grabado_a3 = TRUE THEN
        NEW.grabado_a3_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fichas_grabado_a3 ON fichas_alta;
CREATE TRIGGER trg_fichas_grabado_a3
    BEFORE UPDATE OF grabado_a3 ON fichas_alta
    FOR EACH ROW EXECUTE FUNCTION fichas_set_grabado_a3_at();

-- Índice para listar rápidamente las pendientes de grabar.
CREATE INDEX IF NOT EXISTS idx_fichas_grabado_a3
    ON fichas_alta(grabado_a3)
    WHERE deleted_at IS NULL;

-- Recargar PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
