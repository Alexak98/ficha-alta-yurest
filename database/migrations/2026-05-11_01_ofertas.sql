-- =============================================================================
-- Migration: ofertas (configurador comercial)
-- =============================================================================
-- Fecha:    2026-05-11
-- Motivo:   Persistir las ofertas generadas por el configurador (página
--           Comercial > Configurador de oferta). Hasta ahora cada sesión
--           del configurador era efímera: el comercial montaba la oferta,
--           descargaba el PDF y se acababa. Necesitamos guardarlas para:
--             · consultar ofertas previas por cliente / comercial,
--             · reabrir una oferta concreta y editarla,
--             · enlazarla a la ficha de alta cuando se materializa
--               (campo `solicitud_ficha_id`).
--
--           El cuerpo de la oferta tiene dos zonas:
--
--           1. CONFIGURACIÓN (suficiente para reproducir el snapshot
--              visual sin recalcular nada en cliente):
--                billing  · plan · locales · addons (JSONB) · impl.
--
--           2. CLIENTE — opcional. Se completa al pulsar "Empezar Ficha"
--              en la vista presupuesto (sociedad, CIF, contacto, comercial,
--              tipo de plan que se mapea al catálogo de lista.html).
--              Es opcional porque una oferta puede crearse "en frío" sin
--              datos del cliente todavía (demo en sala, primer email…).
--
--           3. SNAPSHOT DE PRECIOS denormalizado — para listados y KPIs sin
--              tener que volver a correr la math del configurador. La math
--              vive en el front (CLAUDE.md → "math sanity checks"); aquí
--              sólo guardamos el resultado tal cual se mostró al cliente.
--
--           4. ESTADO + auditoría estándar (created_by, soft-delete,
--              updated_at via trigger compartido).
-- =============================================================================

CREATE TABLE IF NOT EXISTS ofertas (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ── Configuración de la oferta ──────────────────────────────────────
    billing             TEXT         NOT NULL
                                       CHECK (billing IN ('annual', 'monthly')),
    plan                TEXT         NOT NULL
                                       CHECK (plan IN ('lite', 'basic', 'pro')),
    locales             INT          NOT NULL DEFAULT 1
                                       CHECK (locales >= 1 AND locales <= 999),
    -- Mapa de flags por módulo: { "checklist":true, "cocina":false, ... }.
    -- JSONB para que el front pueda añadir addons nuevos sin migración.
    addons              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- Modalidad de implementación. NULL si aún no se eligió.
    impl                TEXT
                                       CHECK (impl IN ('grupal', 'personalizada')),

    -- ── Cliente (opcional — se completa al iniciar la Ficha) ────────────
    cliente_sociedad    TEXT,
    cliente_cif         TEXT,
    cliente_nombre      TEXT,
    cliente_email       TEXT,
    -- Comercial que monta la oferta. Texto libre (mismo catálogo que
    -- lista.html → #sol-comercial; no hay FK a usuarios para no acoplar).
    comercial           TEXT,
    -- Tipo de plan del catálogo lista.html (lite | planes | corporate |
    -- corporate_cp | corp_cocina). NO confundir con `plan` (catálogo del
    -- configurador: lite/basic/pro). El mapeo lo hace el front.
    tipo_plan           TEXT
                                       CHECK (tipo_plan IN ('lite', 'planes', 'corporate', 'corporate_cp', 'corp_cocina')),

    -- ── Snapshot de precios (denormalizado) ──────────────────────────────
    -- Importes tal cual los vio el cliente. Si la math del configurador
    -- cambia en el futuro, las ofertas pasadas mantienen sus números.
    monthly_total       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_total   >= 0),
    annual_subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (annual_subtotal >= 0),
    onetime_total       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (onetime_total   >= 0),
    bonus_val           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bonus_val       >= 0),
    full_val            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (full_val        >= 0),
    -- Importe real "A pagar hoy" mostrado en el checkout. Equivale a
    -- annualSub+onetimeTotal en anual o monthlyTot+onetimeTotal en mensual.
    final_amount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (final_amount    >= 0),

    -- ── Estado y vínculo con ficha ───────────────────────────────────────
    estado              TEXT         NOT NULL DEFAULT 'borrador'
                                       CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'caducada')),
    -- Cuando la oferta se convierte en ficha real, guardamos la FK para
    -- poder navegar oferta → ficha y viceversa. ON DELETE SET NULL para no
    -- romper el histórico de ofertas si se borra la ficha.
    solicitud_ficha_id  UUID         REFERENCES fichas_alta(id) ON DELETE SET NULL,

    -- ── Auditoría ────────────────────────────────────────────────────────
    notas               TEXT,
    created_by          TEXT,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ofertas IS
    'Ofertas generadas en el configurador comercial. Captura la configuración (plan, addons, locales, impl), datos del cliente cuando los hay, y el snapshot de precios que vio el cliente. Se vincula opcionalmente a una ficha de alta cuando la oferta se materializa.';

-- ───────────────────────────────────────────────────────────────────────────
-- Índices — todos parciales `WHERE deleted_at IS NULL` para que el listado
-- por defecto (vivos) sea barato. Mismo patrón que presupuestos/escalados.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ofertas_comercial
    ON ofertas(comercial) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ofertas_estado
    ON ofertas(estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ofertas_cliente_cif
    ON ofertas(cliente_cif) WHERE deleted_at IS NULL AND cliente_cif IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ofertas_created
    ON ofertas(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ofertas_solicitud_ficha
    ON ofertas(solicitud_ficha_id) WHERE solicitud_ficha_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — mismo patrón que presupuestos/escalados/hardware_pedidos.
-- service_role full access; el front habla vía n8n con service_role.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON ofertas;
CREATE POLICY "service_role_all" ON ofertas
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger updated_at (función compartida ya existente en schema.sql).
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ofertas_updated ON ofertas;
CREATE TRIGGER trg_ofertas_updated
    BEFORE UPDATE ON ofertas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Permiso de portal — añadir manualmente en config.js (PERMISOS_DISPONIBLES)
-- y en sidebar.js si se quiere una vista de listado. La página configurador
-- usa el permiso 'configurador' ya creado en el commit anterior.
-- ───────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'ofertas'
 ORDER BY ordinal_position;
