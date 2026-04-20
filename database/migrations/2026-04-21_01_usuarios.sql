-- =============================================================================
-- Migration: sistema de usuarios y permisos del portal
-- =============================================================================
-- Fecha:    2026-04-21
-- Motivo:   Pasar de un único usuario "admin" compartido (basicAuth a nivel
--           n8n) a cuentas individuales con permisos granulares por página.
--           Cada usuario tiene un rol (admin | user) y un array JSONB de
--           permisos (IDs de páginas que puede ver). El rol "admin" implica
--           acceso total, incluida la gestión de usuarios.
-- Permisos disponibles (IDs de página):
--   ventas, distribucion, lista, bajas, sinasignar, proyectos,
--   contabilidad, integraciones, admin, docs
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────────────────────
-- Tabla usuarios
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT         NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    nombre          TEXT,
    email           TEXT,
    rol             TEXT         NOT NULL DEFAULT 'user'
                                   CHECK (rol IN ('admin', 'user')),
    permisos        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username_activo
    ON usuarios(username) WHERE deleted_at IS NULL AND activo = TRUE;

-- ───────────────────────────────────────────────────────────────────────────
-- Semilla: usuario admin inicial
-- ───────────────────────────────────────────────────────────────────────────
-- La contraseña del admin se siembra con el hash del password actual que
-- usa n8n en la credencial basicAuth: "Yurest@46002".
-- Formato del hash: pbkdf2$<iterations>$<salt_b64>$<hash_b64>
-- Generado con: crypto.pbkdf2Sync('Yurest@46002', salt, 100000, 32, 'sha256')
-- Si necesitas regenerarlo, usa el endpoint POST /auth/users con rol=admin
-- una vez tengas al menos un admin creado.
--
-- El valor aquí está pre-calculado con salt aleatorio + 100000 iteraciones.
-- Si es la primera vez que corres esta migración y quieres partir de cero,
-- simplemente entra luego con admin/Yurest@46002 y crea el resto de usuarios.
INSERT INTO usuarios (username, password_hash, nombre, rol, permisos)
SELECT 'admin',
       'pbkdf2$100000$6Z4U0ejFCfnJPEJ/knDDrA==$r7zq3lO/ZpsE6H+slNOLjmSPkqrIUsX90rDDyqf+Jn0=',
       'Administrador',
       'admin',
       '["ventas","distribucion","lista","bajas","sinasignar","proyectos","contabilidad","integraciones","admin","docs"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'admin');

-- ───────────────────────────────────────────────────────────────────────────
-- RLS + política service_role (el resto de tablas sigue el mismo patrón)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON usuarios;
CREATE POLICY "service_role_all" ON usuarios
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
CREATE TRIGGER trg_usuarios_updated
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Refrescar caché de PostgREST
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT username, rol, jsonb_array_length(permisos) AS n_permisos, activo
FROM usuarios
ORDER BY created_at ASC;
