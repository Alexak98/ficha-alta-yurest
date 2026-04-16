-- =============================================================
-- Migración: políticas RLS para la clave anon usada por n8n
-- Fecha: 2026-04-16
--
-- Contexto:
--   n8n usa la clave anon de Supabase para conectarse (credencial
--   "Supabase Yurest").  La tabla proyectos funciona porque ya tiene
--   una política permisiva; fichas_alta y locales solo tenían
--   service_role → INSERT/UPDATE/DELETE fallaban silenciosamente.
--
-- Aplicar: Supabase Dashboard → SQL Editor → ejecutar este archivo.
-- =============================================================

-- 1. fichas_alta: permitir INSERT / UPDATE / DELETE a anon
--    (la lectura pública no se expone: el GET /altas sigue usando
--    Basic Auth en el webhook de n8n)
DROP POLICY IF EXISTS "anon_write_fichas" ON fichas_alta;
CREATE POLICY "anon_write_fichas" ON fichas_alta
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 2. locales: ídem
DROP POLICY IF EXISTS "anon_write_locales" ON locales;
CREATE POLICY "anon_write_locales" ON locales
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 3. solicitudes: el flujo de eliminación también toca esta tabla
DROP POLICY IF EXISTS "anon_write_solicitudes" ON solicitudes;
CREATE POLICY "anon_write_solicitudes" ON solicitudes
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Verificar resultado
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('fichas_alta', 'locales', 'solicitudes', 'proyectos')
ORDER BY tablename, policyname;
