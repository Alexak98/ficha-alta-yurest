-- =============================================================================
-- Importación masiva de clientes — fichas_alta
-- =============================================================================
-- Pega tus filas como tuplas dentro del CTE `datos`. El INSERT
-- final deduplica por CIF: si un cliente con el mismo CIF ya existe
-- en BD, esa fila se ignora (idempotente: re-ejecutar no duplica).
--
-- Para datasets grandes (>30 filas), genera el SQL automáticamente
-- con `csv-to-sql.py`:
--     python3 csv-to-sql.py clientes.csv > import-clientes.sql
--
-- Validaciones que hace Postgres y conviene cumplir antes:
--   · cp:  exactamente 5 dígitos o NULL.
--   · tipo_cliente:  'lite' | 'planes' | 'corporate' | 'corporate_cp'
--                    | 'corp_cocina' | NULL.
--   · firmas_contratadas:  '' | '100' | '200' | '300' | NULL.
--   · estado:  'pendiente' | 'completada' | 'en_proceso' | 'rellenado'
--              | 'Rellenado'. Por defecto ponemos 'rellenado'.
--   · baja:  'No' | 'Sí' | 'Si'. Por defecto 'No'.
--
-- Si una fila cae por CHECK, Postgres aborta TODA la transacción y
-- ningún cliente queda insertado — corrige y vuelve a lanzar.
-- =============================================================================

WITH datos AS (
    SELECT * FROM (VALUES
        --
        -- Filas de ejemplo (descomentar y reemplazar). Mantén el orden
        -- de columnas según la tupla AS de abajo.
        --
        -- ('Burger del Centro SL',     'Burger Centro',  'B12345678', 'info@burger.com',  'corporate',     '28001', 'Calle Mayor',   '12', 'Madrid',   'Madrid',   'Alex',  'Juan',   'Pérez',   'juan@burger.com',  '600111222', 'Glop',    NULL),
        -- ('Pizzería Los Molinos SL',  'Pizza Molinos',  'B98765432', 'pedidos@molinos.es','planes',       '46001', 'Av. Test',       '5',  'Valencia', 'Valencia', 'Alex',  'María',  'García',  'maria@molinos.es', '600222333', 'Cashlogy', NULL),

        -- ▼▼▼ TUS DATOS AQUÍ ▼▼▼
        ('SUSTITUYEME', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
        -- ▲▲▲                ▲▲▲
    ) AS t(
        denominacion,        -- NOT NULL — razón social
        nombre_comercial,    -- nombre comercial (alias) o NULL
        cif,                 -- CIF/NIF — usado para deduplicar
        email,               -- email general
        tipo_cliente,        -- enum, ver arriba
        cp,                  -- 5 dígitos o NULL
        calle,
        numero,
        municipio,
        provincia,
        comercial,           -- nombre del comercial responsable
        jp_nombre,           -- jefe de proyecto: nombre
        jp_apellidos,
        jp_mail,
        jp_telefono,
        tpv,                 -- nombre del TPV (Glop, Cashlogy, etc) o NULL
        comentarios          -- notas libres o NULL
    )
)
INSERT INTO fichas_alta (
    denominacion, nombre_comercial, cif, email, tipo_cliente,
    cp, calle, numero, municipio, provincia,
    comercial,
    jp_nombre, jp_apellidos, jp_mail, jp_telefono,
    tpv,
    comentarios,
    estado, baja, modulos
)
SELECT
    d.denominacion, d.nombre_comercial, d.cif, d.email, d.tipo_cliente,
    NULLIF(d.cp, ''), d.calle, d.numero, d.municipio, d.provincia,
    d.comercial,
    d.jp_nombre, d.jp_apellidos, d.jp_mail, d.jp_telefono,
    d.tpv,
    d.comentarios,
    'rellenado',  -- importadas = ya gestionadas, no aparecen como pendientes
    'No',
    '{}'::text[]
FROM datos d
WHERE d.denominacion IS NOT NULL
  AND d.denominacion <> 'SUSTITUYEME'
  -- Dedup: si ya hay un cliente con ese CIF, no lo metemos otra vez.
  -- Cuando d.cif es NULL, el NOT EXISTS pasa siempre y se inserta como
  -- "ficha sin CIF" — Postgres acepta múltiples filas con cif IS NULL.
  AND NOT EXISTS (
      SELECT 1 FROM fichas_alta f
       WHERE d.cif IS NOT NULL
         AND f.cif IS NOT NULL
         AND UPPER(TRIM(f.cif)) = UPPER(TRIM(d.cif))
         AND f.deleted_at IS NULL
  )
RETURNING id, denominacion, cif, tipo_cliente;

-- =============================================================================
-- Verificación rápida (descomenta para ejecutar tras el INSERT)
-- =============================================================================
-- SELECT COUNT(*) FILTER (WHERE estado = 'rellenado') AS total_importadas,
--        COUNT(*) FILTER (WHERE tipo_cliente = 'corporate')    AS corporate,
--        COUNT(*) FILTER (WHERE tipo_cliente = 'corporate_cp') AS corp_cp,
--        COUNT(*) FILTER (WHERE tipo_cliente = 'corp_cocina')  AS corp_cocina,
--        COUNT(*) FILTER (WHERE tipo_cliente = 'planes')       AS planes,
--        COUNT(*) FILTER (WHERE tipo_cliente = 'lite')         AS lite
--   FROM fichas_alta WHERE deleted_at IS NULL;
