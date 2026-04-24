-- ============================================================================
-- hardware_pedidos: vincula cada pedido con la sociedad (mandato SEPA) del
-- cliente que paga la proforma.
--
-- Motivo:
-- Hasta ahora, un pedido de hardware no identificaba a qué sociedad había
-- que emitir la proforma. Cuando un cliente tiene varios locales con SEPAs
-- distintos (sociedades distintas), contabilidad no podía saber a cuál
-- facturar un pedido concreto — y un único pedido mezclaba items que en
-- realidad correspondían a sociedades diferentes.
--
-- Nueva norma: 1 pedido = 1 sociedad. Para 3 locales con 3 SEPAs distintos,
-- se crean 3 pedidos. Cada uno captura:
--   * sepa_mandato_id   — UUID del elemento de fichas_alta.sepa_mandato
--                         (cuando es array). Nullable: los clientes legacy
--                         que aún tienen sepa_mandato como objeto único o
--                         sin firmar pueden seguir creando pedidos sin
--                         seleccionar sociedad.
--   * sepa_snapshot     — copia inmutable de los datos relevantes del SEPA
--                         en el momento del pedido: { id, referencia,
--                         acreedor, iban, localidad, firma_base64 }. Si más
--                         tarde el cliente modifica o reemite el SEPA, la
--                         proforma del pedido histórico sigue mostrando los
--                         datos correctos.
--
-- No hay FK hacia sepa_mandato_id porque los mandatos viven dentro de un
-- JSONB en fichas_alta, no en una tabla propia. La integridad referencial
-- es responsabilidad del frontend/workflow (al crear el pedido se verifica
-- que el id exista en la ficha del cliente).
-- ============================================================================

ALTER TABLE hardware_pedidos ADD COLUMN IF NOT EXISTS sepa_mandato_id UUID;
ALTER TABLE hardware_pedidos ADD COLUMN IF NOT EXISTS sepa_snapshot   JSONB;

COMMENT ON COLUMN hardware_pedidos.sepa_mandato_id IS
    'UUID del mandato SEPA (elemento de fichas_alta.sepa_mandato[]) contra el que se factura este pedido. Null para clientes legacy sin SEPA firmado.';
COMMENT ON COLUMN hardware_pedidos.sepa_snapshot IS
    'Copia inmutable del mandato SEPA en el momento del pedido: { id, referencia, acreedor, iban, localidad, firma_base64 }. Congela los datos para que la proforma histórica no cambie si el cliente edita o reemite el SEPA.';

-- Índice para las consultas de contabilidad que agrupan pedidos por
-- sociedad (p. ej. "todos los pedidos pendientes de X sociedad").
CREATE INDEX IF NOT EXISTS idx_hardware_pedidos_sepa_mandato
    ON hardware_pedidos(sepa_mandato_id)
    WHERE sepa_mandato_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT
    COUNT(*)                                          AS total_pedidos,
    COUNT(sepa_mandato_id)                            AS con_sociedad,
    COUNT(*) FILTER (WHERE sepa_mandato_id IS NULL)   AS sin_sociedad
FROM hardware_pedidos;
