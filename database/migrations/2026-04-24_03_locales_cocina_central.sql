-- ============================================================================
-- locales: flag "es_cocina_central" para clientes corp_cocina
--
-- Motivo:
-- Los clientes de tipo 'corp_cocina' (Corporate + Cocina Producción) tienen
-- varios locales: uno o más puntos de venta y una cocina central donde se
-- produce. En el detalle del proyecto queremos mostrar la dirección de esa
-- cocina central, que hoy no se distingue de los demás locales.
--
-- Diseño: flag booleano por local. Un UNIQUE parcial garantiza que por
-- ficha haya como mucho UN local marcado como cocina central — la
-- aplicación exige exactamente uno para clientes corp_cocina.
--
-- Por defecto FALSE: los locales existentes de cualquier tipo de cliente
-- no se ven afectados. Solo cambia la experiencia de los corp_cocina, y
-- solo cuando el implementador marque explícitamente la cocina central.
-- ============================================================================

ALTER TABLE locales
    ADD COLUMN IF NOT EXISTS es_cocina_central BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN locales.es_cocina_central IS
    'TRUE solo para el local que actúa como cocina central/producción del cliente. Exclusivo por ficha (UNIQUE parcial). Usado por el gestor de proyectos para mostrar la dirección de cocina en clientes corp_cocina.';

-- Índice único parcial: a lo sumo un local de cocina central por ficha.
-- La tabla locales usa borrado físico (DELETE), no soft-delete, así que
-- no hace falta filtrar por deleted_at.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_locales_cocina_central_por_ficha
    ON locales(ficha_id)
    WHERE es_cocina_central = TRUE;

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT
    f.tipo_cliente,
    COUNT(*)                                        AS locales_totales,
    COUNT(*) FILTER (WHERE l.es_cocina_central)     AS con_cocina_central
FROM locales l
JOIN fichas_alta f ON f.id = l.ficha_id
GROUP BY f.tipo_cliente
ORDER BY f.tipo_cliente;
