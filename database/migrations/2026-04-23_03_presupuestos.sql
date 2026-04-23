-- ============================================================================
-- Presupuestos de desarrollo por cliente (departamento Producto).
--
-- Reemplaza el Excel que se llevaba manual para trackear desarrollos
-- solicitados por cliente, quién los paga (Yurest o el propio cliente),
-- estado de aprobación y de entrega.
--
-- Columnas y semántica (siguiendo el Excel de referencia):
--   cliente        — organización que solicita. Texto libre (no FK todavía
--                    porque en el Excel aparecen nombres que no siempre
--                    coinciden con clientes.html).
--   entorno        — backoffice | app_cliente. Dónde vive el desarrollo.
--   desarrollo     — título / descripción breve.
--   enviado        — bool. ¿Se ha comunicado el presupuesto al cliente?
--   quien_abona    — yurest | cliente. Quién paga las horas.
--   estado         — aceptado | en_espera.
--   horas_yurest   — int. Horas a cargo de Yurest.
--   coste_yurest   — numeric(10,2). Importe que asume Yurest (típico: horas*85€).
--   horas_cliente  — int. Horas a cargo del cliente.
--   coste_cliente  — numeric(10,2). Importe que factura al cliente.
--   estado_entrega — pendiente | en_progreso | entregado.
--   notas          — TEXT, libre.
-- ============================================================================

CREATE TABLE IF NOT EXISTS presupuestos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente         TEXT NOT NULL,
    entorno         TEXT NOT NULL CHECK (entorno IN ('backoffice', 'app_cliente')),
    desarrollo      TEXT NOT NULL,
    enviado         BOOLEAN NOT NULL DEFAULT FALSE,
    quien_abona     TEXT NOT NULL DEFAULT 'cliente'
                    CHECK (quien_abona IN ('yurest', 'cliente')),
    estado          TEXT NOT NULL DEFAULT 'en_espera'
                    CHECK (estado IN ('aceptado', 'en_espera')),
    horas_yurest    INT  NOT NULL DEFAULT 0  CHECK (horas_yurest  >= 0 AND horas_yurest  <= 10000),
    coste_yurest    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (coste_yurest  >= 0),
    horas_cliente   INT  NOT NULL DEFAULT 0  CHECK (horas_cliente >= 0 AND horas_cliente <= 10000),
    coste_cliente   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (coste_cliente >= 0),
    estado_entrega  TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado_entrega IN ('pendiente', 'en_progreso', 'entregado')),
    notas           TEXT,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      TEXT
);

COMMENT ON TABLE presupuestos IS
    'Presupuestos de desarrollo por cliente (departamento Producto). Reemplaza el Excel que llevaba trackear qué solicita cada cliente, quién lo paga y estado.';

CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente
    ON presupuestos(cliente) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado
    ON presupuestos(estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado_entrega
    ON presupuestos(estado_entrega) WHERE deleted_at IS NULL;

-- ── RLS (mismo patrón que promociones/hardware_pedidos tras QA) ────────────
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON presupuestos;
CREATE POLICY "service_role_all" ON presupuestos
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_write_presupuestos" ON presupuestos;
CREATE POLICY "anon_write_presupuestos" ON presupuestos
    FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT estado, COUNT(*) AS n FROM presupuestos GROUP BY estado ORDER BY estado;
