-- ============================================================================
-- Pedidos de hardware (flujo proforma → pago → envío)
--
-- Ciclo de vida:
--   solicitada          → implementador envía el carrito desde el proyecto
--   proforma_adjuntada  → contabilidad sube el PDF de la proforma
--                          (vuelve a verse en el proyecto)
--   pendiente_confirmar → implementador adjunta justificante de pago
--                          (vuelve a contabilidad para revisar)
--   lista_envio         → contabilidad confirma el pago
--                          (queda visible para soporte en "Hardware envíos")
-- ============================================================================

CREATE TABLE IF NOT EXISTS hardware_pedidos (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proyecto_id    UUID REFERENCES proyectos(id) ON DELETE SET NULL,

    -- Snapshot del cliente / implementador en el momento de la solicitud
    -- para poder mostrar contexto aunque el proyecto cambie o se borre.
    cliente        TEXT NOT NULL,
    implementador  TEXT,

    -- Carrito: array JSONB de items. Cada item:
    --   { nombre: string, cantidad: int, unidad: string|null, notas: string|null }
    items          JSONB NOT NULL DEFAULT '[]',

    -- Estado del pedido dentro del flujo descrito arriba.
    estado         TEXT NOT NULL DEFAULT 'solicitada'
                   CHECK (estado IN (
                       'solicitada',
                       'proforma_adjuntada',
                       'pendiente_confirmar',
                       'lista_envio'
                   )),

    -- Adjuntos: proforma (subida por contabilidad) + justificante de pago
    -- (subido por implementador). Mismo formato que fichas_alta.adjuntos:
    --   { nombre: string, tipo: string, size: int, data: base64, fecha: iso }
    proforma_pdf   JSONB,
    justificante_pdf JSONB,

    -- Notas opcionales por rol — útiles para contexto sin crear tablas aparte.
    notas_implementador TEXT,
    notas_contabilidad  TEXT,

    -- Timestamps de cada transición del flujo.
    solicitado_por TEXT,
    solicitado_at  TIMESTAMPTZ DEFAULT NOW(),
    proforma_at    TIMESTAMPTZ,
    pagado_at      TIMESTAMPTZ,
    confirmado_at  TIMESTAMPTZ,

    deleted_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles para los listados de cada rol:
--   · Implementador / hardware tab del proyecto → filtra por proyecto_id.
--   · Contabilidad (Solicitud de proformas + pendiente confirmar) → por estado.
--   · Soporte (Hardware envíos) → por estado = 'lista_envio'.
CREATE INDEX IF NOT EXISTS idx_hw_pedidos_proyecto ON hardware_pedidos(proyecto_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hw_pedidos_estado ON hardware_pedidos(estado)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE hardware_pedidos IS
    'Pedidos de hardware por proyecto. Ciclo: solicitada → proforma_adjuntada → pendiente_confirmar → lista_envio.';

-- Trigger: actualiza updated_at en cada UPDATE.
CREATE OR REPLACE FUNCTION hardware_pedidos_touch_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hw_pedidos_touch ON hardware_pedidos;
CREATE TRIGGER trg_hw_pedidos_touch
    BEFORE UPDATE ON hardware_pedidos
    FOR EACH ROW EXECUTE FUNCTION hardware_pedidos_touch_updated();

-- RLS: mismo patrón que el resto — service_role accede a todo; el acceso
-- de usuario final se gestiona vía PostgREST + permisos por página en el
-- frontend (cada rol solo ve los pedidos en el estado que le corresponde).
ALTER TABLE hardware_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON hardware_pedidos;
CREATE POLICY "service_role_all" ON hardware_pedidos
    FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Verificación rápida
SELECT 'hardware_pedidos' AS tabla, COUNT(*) AS n FROM hardware_pedidos;
