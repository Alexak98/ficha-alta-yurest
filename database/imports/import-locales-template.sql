-- =============================================================================
-- Importación masiva de locales — tabla `locales`
-- =============================================================================
-- Cada local se enlaza a un cliente ya importado (en `fichas_alta`)
-- buscando por su CIF. La columna `cliente_cif` del CTE NO se inserta
-- en `locales` — se usa SOLO para resolver `ficha_id` al hacer JOIN.
--
-- Si un local apunta a un CIF que no existe en BD, esa fila se salta
-- (y aparece en el SELECT final como "huérfano" para que sepas qué
-- corregir).
--
-- Validaciones:
--   · cp y sociedad_cp:  exactamente 5 dígitos o NULL.
--   · nombre:  obligatorio (NOT NULL en la tabla).
--   · es_cocina_central:  TRUE | FALSE. Sólo UN local por ficha puede
--     tener TRUE (UNIQUE parcial) — si tienes varios marcados a TRUE
--     para el mismo cliente, el último gana y los demás caen.
-- =============================================================================

WITH datos AS (
    SELECT * FROM (VALUES
        --
        -- Filas de ejemplo (descomentar y adaptar). cliente_cif debe
        -- coincidir EXACTAMENTE (case-insensitive) con un fichas_alta.cif
        -- ya existente.
        --
        -- ('B12345678', 'Burger Centro Sol',     'sol@burger.com',     '28013', 'Calle Sol',     '8',   'Madrid',   'B12345678', 'Burger del Centro SL',     150.00, FALSE),
        -- ('B12345678', 'Burger Centro Plaza',   'plaza@burger.com',   '28014', 'Plaza Mayor',   '1',   'Madrid',   'B12345678', 'Burger del Centro SL',     150.00, FALSE),
        -- ('B12345678', 'Cocina Central Burger', 'cocina@burger.com',  '28021', 'Pol. Las Rozas','15',  'Madrid',   'B12345678', 'Burger del Centro SL',       0.00, TRUE),

        -- ▼▼▼ TUS DATOS AQUÍ ▼▼▼
        ('SUSTITUYEME', 'SUSTITUYEME', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, FALSE)
        -- ▲▲▲                                                                        ▲▲▲
    ) AS t(
        cliente_cif,             -- CIF del cliente padre — para hacer match con fichas_alta.cif
        nombre,                  -- NOT NULL — nombre del local
        email,                   -- email del local o NULL
        cp,                      -- 5 dígitos o NULL
        calle,
        numero,
        municipio,
        sociedad_cif,            -- si la sociedad facturadora del local es distinta del cliente
        sociedad_denominacion,
        mensualidad,             -- DECIMAL(10,2) — 0 si gratis
        es_cocina_central        -- TRUE solo para corp_cocina (max 1 por ficha)
    )
)
INSERT INTO locales (
    ficha_id, nombre, email,
    cp, calle, numero, municipio,
    sociedad_cif, sociedad_denominacion,
    mensualidad, es_cocina_central
)
SELECT
    f.id,
    d.nombre, d.email,
    NULLIF(d.cp, ''), d.calle, d.numero, d.municipio,
    d.sociedad_cif, d.sociedad_denominacion,
    COALESCE(d.mensualidad, 0),
    COALESCE(d.es_cocina_central, FALSE)
FROM datos d
JOIN fichas_alta f
  ON f.cif IS NOT NULL
 AND UPPER(TRIM(f.cif)) = UPPER(TRIM(d.cliente_cif))
 AND f.deleted_at IS NULL
WHERE d.cliente_cif IS NOT NULL
  AND d.cliente_cif <> 'SUSTITUYEME'
  AND d.nombre IS NOT NULL
RETURNING id, ficha_id, nombre, mensualidad;

-- =============================================================================
-- Locales huérfanos (cliente_cif que no encontró cliente)
-- =============================================================================
-- Ejecuta esta query SUELTA después del INSERT para ver qué filas
-- no tuvieron match. Útil para detectar typos en los CIFs.
--
-- WITH datos AS (
--     SELECT * FROM (VALUES
--         -- (mismas filas que arriba)
--     ) AS t(cliente_cif, nombre, email, cp, calle, numero, municipio,
--            sociedad_cif, sociedad_denominacion, mensualidad, es_cocina_central)
-- )
-- SELECT d.cliente_cif, d.nombre AS local
--   FROM datos d
--  WHERE NOT EXISTS (
--      SELECT 1 FROM fichas_alta f
--       WHERE f.cif IS NOT NULL
--         AND UPPER(TRIM(f.cif)) = UPPER(TRIM(d.cliente_cif))
--         AND f.deleted_at IS NULL
--  );
