-- ============================================================================
-- Secciones estructuradas del presupuesto
--
-- Hasta ahora el presupuesto se creaba con un único campo `notas` libre.
-- Para que el documento PDF generado tenga el formato de una propuesta
-- profesional (y no un párrafo suelto), añadimos 7 bloques de texto
-- opcionales que corresponden a las secciones típicas de una oferta:
--
--   · contexto               — por qué se plantea el desarrollo
--   · objetivo               — qué se quiere conseguir
--   · alcance                — qué entra y qué NO entra
--   · funcionamiento_esperado— cómo debe comportarse una vez en producción
--   · entregables            — qué se entrega (código, docs, acceso, etc.)
--   · presupuesto_detalle    — desglose / condiciones económicas extendidas
--   · aprobacion             — cláusula de aceptación / firma
--
-- `presupuesto_detalle` (y no `presupuesto`) para evitar colisión con el
-- nombre de la propia tabla en queries genéricas.
--
-- Todas opcionales (NULL por defecto), sin CHECK — son texto libre.
-- ============================================================================

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS contexto                TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS objetivo                TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS alcance                 TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS funcionamiento_esperado TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS entregables             TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS presupuesto_detalle     TEXT;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS aprobacion              TEXT;

COMMENT ON COLUMN presupuestos.contexto                IS 'Antecedentes del proyecto: por qué se plantea el desarrollo.';
COMMENT ON COLUMN presupuestos.objetivo                IS 'Objetivo concreto que persigue el desarrollo.';
COMMENT ON COLUMN presupuestos.alcance                 IS 'Alcance funcional — qué entra y qué queda fuera.';
COMMENT ON COLUMN presupuestos.funcionamiento_esperado IS 'Comportamiento esperado una vez desplegado.';
COMMENT ON COLUMN presupuestos.entregables             IS 'Qué se entrega al cliente (código, documentación, accesos…).';
COMMENT ON COLUMN presupuestos.presupuesto_detalle     IS 'Desglose / condiciones económicas extendidas del presupuesto.';
COMMENT ON COLUMN presupuestos.aprobacion              IS 'Cláusula de aceptación / firma del cliente.';

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'presupuestos'
  AND column_name IN ('contexto','objetivo','alcance','funcionamiento_esperado','entregables','presupuesto_detalle','aprobacion')
ORDER BY column_name;
