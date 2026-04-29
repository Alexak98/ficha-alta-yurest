-- ============================================================
--  2026-04-30_03 — Migra `usuarios.permisos` legacy → granular
--  ------------------------------------------------------------
--  Estandariza el shape del campo `permisos` en la tabla
--  `usuarios`. Hasta ahora se aceptaban DOS shapes:
--
--    1) Legacy:    ["clientes", "lista"]
--                  → cada id implica acceso completo (r+w+d).
--    2) Granular:  { "read": [...], "write": [...], "delete": [...] }
--                  → control fino: leer ≠ escribir ≠ borrar.
--
--  Tener dos shapes vivos a la vez es la causa raíz del bug que
--  hacía que un usuario con permisos granulares perdiera el
--  acceso al validar la sesión en background (config.js
--  forzaba `[]` cuando no era array). Aunque el bug ya está
--  corregido, mantener dos paths es deuda técnica innecesaria.
--
--  Esta migration:
--    · Convierte cada fila con shape legacy (jsonb_typeof =
--      'array') al shape granular equivalente, replicando el
--      array en read/write/delete (mantiene exactamente los
--      mismos permisos efectivos que tenía antes).
--    · Es idempotente: filas ya granulares no se tocan.
--    · NO modifica filas con NULL ni con shapes corruptos —
--      esos hay que revisarlos a mano antes de aplicar.
--
--  Después de aplicar, el path `Array.isArray(p)` en config.js
--  queda muerto y se podrá retirar en un commit posterior.
--  ------------------------------------------------------------
--  Para aplicar:
--    1) Hacer backup de la tabla `usuarios` (Supabase Studio
--       → Table Editor → usuarios → Export as CSV).
--    2) Ejecutar este script desde Supabase Studio → SQL Editor.
--    3) Verificar con la query de comprobación al final.
--    4) Si todo OK, en un commit posterior retirar la rama
--       legacy de _normalizarPermisosUsuario en config.js.
-- ============================================================

-- 1. Inspección previa: cuántos usuarios tienen cada shape.
--    Comentado por defecto — descomenta si quieres ver los
--    números antes de modificar nada.
-- SELECT
--     COUNT(*) FILTER (WHERE jsonb_typeof(permisos) = 'array')  AS legacy_array,
--     COUNT(*) FILTER (WHERE jsonb_typeof(permisos) = 'object') AS granular_object,
--     COUNT(*) FILTER (WHERE permisos IS NULL)                   AS sin_permisos,
--     COUNT(*) FILTER (WHERE
--         jsonb_typeof(permisos) NOT IN ('array', 'object')
--         AND permisos IS NOT NULL
--     )                                                          AS shape_raro,
--     COUNT(*)                                                   AS total
-- FROM usuarios;

-- 2. Conversión legacy → granular.
--    Para cada usuario con array, generamos un objeto con las
--    tres listas iguales al array original (mismo acceso efectivo).
UPDATE usuarios
SET permisos = jsonb_build_object(
        'read',   permisos,
        'write',  permisos,
        'delete', permisos
    )
WHERE jsonb_typeof(permisos) = 'array';

-- 3. Comprobación post-migration.
--    Tras ejecutar (2), legacy_array debería ser 0.
SELECT
    COUNT(*) FILTER (WHERE jsonb_typeof(permisos) = 'array')   AS legacy_array_pendientes,
    COUNT(*) FILTER (WHERE jsonb_typeof(permisos) = 'object')  AS granular_object,
    COUNT(*) FILTER (WHERE permisos IS NULL)                    AS sin_permisos,
    COUNT(*)                                                    AS total
FROM usuarios;

-- 4. Comprobación cualitativa (opcional). Saca un usuario al
--    azar para verificar el shape. Comentado por defecto.
-- SELECT id, username, rol, permisos
-- FROM usuarios
-- WHERE rol <> 'admin'
-- ORDER BY random()
-- LIMIT 3;
