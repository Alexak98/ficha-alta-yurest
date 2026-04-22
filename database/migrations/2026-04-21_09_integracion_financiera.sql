-- ============================================================================
-- Integración financiera (software de contabilidad del cliente)
--
-- El comercial indica con qué ERP/contabilidad trabaja el cliente para
-- decidir si hace falta integración (Sage o A3) o no aplica. Si aplica,
-- captura también persona+email de referencia para la integración.
-- ============================================================================

ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS integracion_financiera TEXT,
    ADD COLUMN IF NOT EXISTS int_fin_persona        TEXT,
    ADD COLUMN IF NOT EXISTS int_fin_email          TEXT;

-- Restringe a los 3 valores permitidos (o NULL para fichas sin decidir
-- todavía). Si en el futuro aparece un ERP nuevo, basta con actualizar
-- este check.
ALTER TABLE fichas_alta
    DROP CONSTRAINT IF EXISTS fichas_alta_integracion_financiera_check;
ALTER TABLE fichas_alta
    ADD CONSTRAINT fichas_alta_integracion_financiera_check
    CHECK (integracion_financiera IS NULL
           OR integracion_financiera IN ('no_aplica', 'sage', 'a3'));

-- Comentarios para que queden documentados en el catálogo de Postgres.
COMMENT ON COLUMN fichas_alta.integracion_financiera IS
    'Software de contabilidad del cliente: no_aplica | sage | a3. NULL = sin decidir todavía.';
COMMENT ON COLUMN fichas_alta.int_fin_persona IS
    'Persona de referencia del cliente para la integración financiera. Solo aplica si integracion_financiera IN (sage, a3).';
COMMENT ON COLUMN fichas_alta.int_fin_email IS
    'Email de contacto del cliente para la integración financiera. Solo aplica si integracion_financiera IN (sage, a3).';

-- Refresca el schema cache de PostgREST para que las nuevas columnas
-- sean accesibles de inmediato vía la API.
NOTIFY pgrst, 'reload schema';
