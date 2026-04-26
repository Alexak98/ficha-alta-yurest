-- =============================================================================
-- Migration: escalados de clientes
-- =============================================================================
-- Fecha:    2026-04-26
-- Motivo:   Registrar ampliaciones contractuales sobre clientes existentes
--           (sólo Corporate y Corporate + CP). Dos tipos:
--             · 'modulo' — el cliente contrata módulos que aún no tenía,
--               aplicados a uno o varios locales (cada local apunta a un
--               mandato SEPA existente en fichas_alta.sepa_mandato).
--             · 'local'  — se da de alta un nuevo local para el cliente.
--               Su SEPA puede ser uno ya existente del cliente o uno nuevo
--               que se crea junto con el local. Opcionalmente lleva módulos
--               vinculados al local nuevo.
--
--           El frontend graba el escalado en estado 'pendiente' y un workflow
--           n8n (a crear aparte) será el responsable de aplicar los cambios
--           reales sobre fichas_alta / locales / sepa_mandato y marcarlo
--           como 'aplicado'.
--
--           Se permite borrado lógico vía deleted_at.
-- =============================================================================

CREATE TABLE IF NOT EXISTS escalados (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Cliente sobre el que se hace el escalado.
    ficha_id        UUID         NOT NULL REFERENCES fichas_alta(id) ON DELETE RESTRICT,

    -- Tipo de escalado:
    --   'modulo' → contratación de módulos nuevos sobre uno o varios locales.
    --   'local'  → alta de un local nuevo (con SEPA y, opcionalmente, módulos).
    tipo            TEXT         NOT NULL CHECK (tipo IN ('modulo', 'local')),

    -- Ciclo de vida:
    --   'pendiente' → recién creado por el comercial; aún no aplicado en backend.
    --   'aplicado'  → workflow n8n confirmó la aplicación sobre fichas/locales.
    --   'cancelado' → descartado antes de aplicar.
    estado          TEXT         NOT NULL DEFAULT 'pendiente'
                                   CHECK (estado IN ('pendiente', 'aplicado', 'cancelado')),

    -- Detalle estructurado del escalado. Forma según `tipo`:
    --
    -- tipo = 'modulo':
    --   {
    --     "modulos": ["pro", "rrhh", ...],          // ids del catálogo
    --     "locales_ids": ["uuid", "uuid", ...],     // locales del cliente afectados
    --     "setup": 500,                              // total cobrado de setup
    --     "recurrencia": 120                         // total mensual añadido
    --   }
    --
    -- tipo = 'local':
    --   {
    --     "local": {
    --       "nombre": "Burger del Centro",
    --       "calle": "...", "numero": "...",
    --       "cp": "28001", "municipio": "...", "provincia": "...",
    --       "email": "...",
    --       "sociedad_cif": "...", "sociedad_denominacion": "...", ...
    --     },
    --     "sepa": {
    --        "modo": "existente" | "nuevo",
    --        "mandato_id": "uuid"      // si modo = "existente"
    --        | "iban": "...", "bic": "...", "titular": "...",
    --          "sociedad_cif": "...", "sociedad_denominacion": "..."
    --                                   // si modo = "nuevo"
    --     },
    --     "modulos": ["basic", ...],   // opcional, módulos vinculados al local
    --     "setup": 300,
    --     "recurrencia": 80
    --   }
    detalle         JSONB        NOT NULL,

    -- Importes de cabecera (denormalizados para listados y KPIs).
    setup           DECIMAL(10,2) DEFAULT 0,
    recurrencia     DECIMAL(10,2) DEFAULT 0,

    -- Auditoría
    creado_por      TEXT,             -- username del comercial que lo registró
    notas           TEXT,

    aplicado_at     TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalados_ficha
    ON escalados(ficha_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escalados_estado
    ON escalados(estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escalados_created
    ON escalados(created_at DESC) WHERE deleted_at IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS + política service_role (mismo patrón que el resto de tablas)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE escalados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON escalados;
CREATE POLICY "service_role_all" ON escalados
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_escalados_updated ON escalados;
CREATE TRIGGER trg_escalados_updated
    BEFORE UPDATE ON escalados
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Permiso de portal: 'escalados' en la tabla usuarios.permisos.
-- (No hay CHECK de valores en usuarios.permisos, sólo se controla en front.)
-- ───────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'escalados'
 ORDER BY ordinal_position;
