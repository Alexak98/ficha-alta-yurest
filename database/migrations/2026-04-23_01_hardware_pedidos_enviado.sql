-- ============================================================================
-- hardware_pedidos: nuevo estado `enviado` + columnas de trazabilidad de envío
--
-- Motivo (ver docs/QA-HARDWARE-HALLAZGOS.md S1):
-- Hasta ahora, Soporte sólo podía ver pedidos en `lista_envio` pero no tenía
-- forma de marcar "ya enviado al cliente". Todos los pedidos se acumulaban
-- en la cola de envíos indefinidamente.
--
-- Ciclo resultante:
--   solicitada → proforma_adjuntada → pendiente_confirmar → lista_envio → enviado
--   (con rollback controlado mediante action=devolver_a_contabilidad)
-- ============================================================================

-- Amplía el CHECK del estado. Postgres no permite alterar un CHECK en sitio;
-- hay que dropearlo y recrearlo. El nombre se genera en la forma
-- <tabla>_<col>_check cuando se declara inline en CREATE TABLE.
ALTER TABLE hardware_pedidos DROP CONSTRAINT IF EXISTS hardware_pedidos_estado_check;
ALTER TABLE hardware_pedidos
    ADD CONSTRAINT hardware_pedidos_estado_check
    CHECK (estado IN (
        'solicitada',
        'proforma_adjuntada',
        'pendiente_confirmar',
        'lista_envio',
        'enviado'
    ));

-- Columnas de trazabilidad del envío físico.
--   enviado_at  — timestamp al pulsar "Marcar como enviado" en Soporte.
--   enviado_por — username del operador de Soporte que cerró el envío.
--   tracking    — código/URL de seguimiento opcional (texto libre; algunas
--                 transportistas dan números, otras URLs). No validamos
--                 formato a propósito.
ALTER TABLE hardware_pedidos ADD COLUMN IF NOT EXISTS enviado_at  TIMESTAMPTZ;
ALTER TABLE hardware_pedidos ADD COLUMN IF NOT EXISTS enviado_por TEXT;
ALTER TABLE hardware_pedidos ADD COLUMN IF NOT EXISTS tracking    TEXT;

COMMENT ON COLUMN hardware_pedidos.enviado_at  IS 'Cuándo Soporte marcó el pedido como enviado físicamente.';
COMMENT ON COLUMN hardware_pedidos.enviado_por IS 'Username del operador de Soporte que cerró el envío.';
COMMENT ON COLUMN hardware_pedidos.tracking    IS 'Código o URL de seguimiento opcional.';

COMMENT ON TABLE hardware_pedidos IS
    'Pedidos de hardware por proyecto. Ciclo: solicitada → proforma_adjuntada → pendiente_confirmar → lista_envio → enviado. Rollback vía action=devolver_a_contabilidad.';

-- Política RLS para la clave anon que usa n8n (mismo patrón que
-- 2026-04-16_01_anon_write_policies.sql). Sin esto, los INSERT/UPDATE del
-- workflow 21 fallan silenciosamente: GET devuelve [] y POST aparenta éxito
-- pero no persiste. La lectura pública no se expone — el webhook exige
-- BasicAuth (fix B1).
DROP POLICY IF EXISTS "anon_write_hardware_pedidos" ON hardware_pedidos;
CREATE POLICY "anon_write_hardware_pedidos" ON hardware_pedidos
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT estado, COUNT(*) FROM hardware_pedidos GROUP BY estado ORDER BY estado;
