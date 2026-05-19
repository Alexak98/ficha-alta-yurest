-- ============================================================================
-- locales: integración TPV por local
--
-- Motivo:
-- Hasta ahora la integración TPV se guardaba en fichas_alta como un único
-- bloque global (tpv, tpv_contacto, tpv_email, tpv_no_integrado, …). Esto
-- forzaba a clientes multi-local con TPVs distintos por local (caso real:
-- 4 locales, 2 con TPV "Glop" y 2 con "Hosteltactil") a duplicar fichas o
-- a mezclar datos en un solo bloque, perdiendo la información de cuál TPV
-- usa cada local. Movemos ahora la integración a la tabla `locales`, una
-- columna por campo TPV, manteniendo las columnas viejas en fichas_alta
-- como "default/legacy" (heredan el TPV del primer local para que
-- consumidores externos — reports, Asana, etc. — sigan viendo un valor
-- razonable sin migrar a la vez).
--
-- Diseño:
-- · Columnas opcionales (NULL = sin asignar). El front decide qué bloque
--   pintar según tpv_no_integrado.
-- · Sin CHECK constraint sobre el valor de `tpv` (es texto libre del select
--   del front; añadir un CHECK obligaría a versionar el listado de TPVs en
--   BD cada vez que se añade uno nuevo en UI).
-- ============================================================================

ALTER TABLE locales
    ADD COLUMN IF NOT EXISTS tpv                TEXT,
    ADD COLUMN IF NOT EXISTS tpv_contacto       TEXT,
    ADD COLUMN IF NOT EXISTS tpv_email          TEXT,
    ADD COLUMN IF NOT EXISTS tpv_no_integrado   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tpv_ni_nombre      TEXT,
    ADD COLUMN IF NOT EXISTS tpv_ni_contacto    TEXT,
    ADD COLUMN IF NOT EXISTS tpv_ni_email       TEXT;

COMMENT ON COLUMN locales.tpv              IS 'Sistema TPV integrado del local (Agora, Glop, Revo, …). NULL si no aplica o si tpv_no_integrado=true.';
COMMENT ON COLUMN locales.tpv_contacto     IS 'Persona de contacto en el proveedor del TPV integrado.';
COMMENT ON COLUMN locales.tpv_email        IS 'Email de contacto en el proveedor del TPV integrado.';
COMMENT ON COLUMN locales.tpv_no_integrado IS 'TRUE si el local opera con un TPV no integrado con Yurest. En ese caso se usan las columnas tpv_ni_*.';
COMMENT ON COLUMN locales.tpv_ni_nombre    IS 'Nombre del TPV no integrado del local (texto libre).';
COMMENT ON COLUMN locales.tpv_ni_contacto  IS 'Persona de referencia del TPV no integrado.';
COMMENT ON COLUMN locales.tpv_ni_email     IS 'Email de referencia del TPV no integrado.';

NOTIFY pgrst, 'reload schema';

-- Verificación: locales sin TPV asignado (esperado en fichas previas a esta
-- migración — el front las pintará vacías y el comercial puede rellenarlas).
-- Nota: la tabla `locales` usa borrado físico (DELETE), no soft-delete, así
-- que no filtramos por deleted_at — esa columna no existe en esta tabla.
SELECT
    COUNT(*)                                       AS locales_totales,
    COUNT(*) FILTER (WHERE tpv IS NOT NULL)        AS con_tpv_integrado,
    COUNT(*) FILTER (WHERE tpv_no_integrado=true)  AS con_tpv_no_integrado
FROM locales;
