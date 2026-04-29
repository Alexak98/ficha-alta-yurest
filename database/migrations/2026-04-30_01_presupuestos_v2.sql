-- ============================================================================
-- Migration: ampliación de presupuestos (v2)
-- ============================================================================
-- Fecha:   2026-04-30
-- Motivo:  Tras un primer uso real, el equipo pide trazar el coste real de
--          cada desarrollo (no asumir tarifa única) y abrir el flujo de
--          cobro hasta "pagado". Cambios:
--
--          1. nº de documento auto-generado por presupuesto, formato
--             PRES-0001, PRES-0002, … Sirve para citar el presupuesto
--             en factura/email sin tener que pasar el UUID.
--
--          2. coste_hora_yurest (default 25 €/h) — lo que internamente
--             nos cuesta una hora de desarrollo. Editable por presupuesto
--             porque a veces parte va externalizada y cambia el coste.
--
--          3. coste_hora_cliente (default 85 €/h) — la tarifa que se le
--             cobra al cliente. Editable por presupuesto cuando hay
--             tarifa pactada distinta.
--
--          4. descuento_pct (default 0, rango 0..100) — descuento
--             aplicado al cliente. coste_cliente se calcula al vuelo
--             como horas_cliente × coste_hora_cliente × (1 - descuento%/100).
--
--          5. estado se amplía con dos valores nuevos:
--               · pagado_50  → cliente pagó la primera mitad
--               · pagado     → cobrado al 100%
--             Los estados anteriores (en_espera, aceptado) se mantienen.
--
-- IMPORTANTE: el coste interno por defecto (25 €/h) es una estimación.
-- Si el real es distinto, edita el ALTER COLUMN ... SET DEFAULT abajo
-- antes de ejecutar la migración. Los presupuestos existentes se
-- backfillean a 25 también; pueden editarse uno a uno desde la UI.
-- ============================================================================

-- ── 1) Columnas nuevas (idempotente) ────────────────────────────────────
ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS numero_doc          TEXT,
  ADD COLUMN IF NOT EXISTS coste_hora_yurest   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS coste_hora_cliente  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS descuento_pct       NUMERIC(5,2);

-- Defaults para inserts futuros
ALTER TABLE presupuestos ALTER COLUMN coste_hora_yurest  SET DEFAULT 25.00;
ALTER TABLE presupuestos ALTER COLUMN coste_hora_cliente SET DEFAULT 85.00;
ALTER TABLE presupuestos ALTER COLUMN descuento_pct      SET DEFAULT 0;

-- Backfill de filas existentes (NULL → default)
UPDATE presupuestos SET coste_hora_yurest  = 25.00 WHERE coste_hora_yurest  IS NULL;
UPDATE presupuestos SET coste_hora_cliente = 85.00 WHERE coste_hora_cliente IS NULL;
UPDATE presupuestos SET descuento_pct      = 0     WHERE descuento_pct      IS NULL;

-- NOT NULL + CHECKs (idempotentes via pg_constraint)
ALTER TABLE presupuestos ALTER COLUMN coste_hora_yurest  SET NOT NULL;
ALTER TABLE presupuestos ALTER COLUMN coste_hora_cliente SET NOT NULL;
ALTER TABLE presupuestos ALTER COLUMN descuento_pct      SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_coste_hora_yurest_check') THEN
    ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_coste_hora_yurest_check
      CHECK (coste_hora_yurest >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_coste_hora_cliente_check') THEN
    ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_coste_hora_cliente_check
      CHECK (coste_hora_cliente >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_descuento_pct_check') THEN
    ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_descuento_pct_check
      CHECK (descuento_pct >= 0 AND descuento_pct <= 100);
  END IF;
END $$;

-- ── 2) Numero de documento auto-generado ───────────────────────────────
-- Secuencia simple. Formato PRES-NNNN con 4 dígitos zero-padded
-- (capacidad 9999 presupuestos antes de tener que ampliar el padding,
-- ningún drama en la práctica).
CREATE SEQUENCE IF NOT EXISTS presupuestos_numero_seq START 1;

CREATE OR REPLACE FUNCTION presupuestos_set_numero_doc() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_doc IS NULL OR NEW.numero_doc = '' THEN
    NEW.numero_doc := 'PRES-' || LPAD(nextval('presupuestos_numero_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_presupuestos_numero_doc ON presupuestos;
CREATE TRIGGER trg_presupuestos_numero_doc
  BEFORE INSERT ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION presupuestos_set_numero_doc();

-- Backfill: ordenamos por created_at ASC para que el numero más bajo
-- corresponda al presupuesto más antiguo.
DO $$
DECLARE
  r RECORD;
  i INT := 1;
BEGIN
  FOR r IN SELECT id FROM presupuestos
            WHERE numero_doc IS NULL OR numero_doc = ''
            ORDER BY created_at ASC LOOP
    UPDATE presupuestos
       SET numero_doc = 'PRES-' || LPAD(i::TEXT, 4, '0')
     WHERE id = r.id;
    i := i + 1;
  END LOOP;
  -- La secuencia continúa donde se quedó el backfill, así el siguiente
  -- INSERT manual dará un número que no colisiona.
  PERFORM setval('presupuestos_numero_seq', GREATEST(i - 1, 1), true);
END $$;

ALTER TABLE presupuestos ALTER COLUMN numero_doc SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presupuestos_numero_doc_key') THEN
    ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_numero_doc_key UNIQUE (numero_doc);
  END IF;
END $$;

-- ── 3) Estados ampliados ───────────────────────────────────────────────
ALTER TABLE presupuestos DROP CONSTRAINT IF EXISTS presupuestos_estado_check;
ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_estado_check
  CHECK (estado IN ('en_espera', 'aceptado', 'pagado_50', 'pagado'));

-- ── 4) PostgREST: recargar schema y verificar ───────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT estado, COUNT(*) AS n
  FROM presupuestos
 GROUP BY estado
 ORDER BY estado;

SELECT COUNT(*)               AS total,
       COUNT(numero_doc)      AS con_doc,
       MIN(numero_doc)        AS primer_numero,
       MAX(numero_doc)        AS ultimo_numero,
       AVG(coste_hora_yurest) AS coste_h_y_promedio,
       AVG(coste_hora_cliente)AS coste_h_c_promedio,
       AVG(descuento_pct)     AS desc_promedio
  FROM presupuestos;
