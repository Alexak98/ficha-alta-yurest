-- ─────────────────────────────────────────────────────────────────────────
-- Token de acceso aleatorio para el enlace que recibe el cliente.
-- Sustituye al ID-Solicitud numérico (predecible) en la URL del formulario.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE solicitudes
    ADD COLUMN IF NOT EXISTS access_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_access_token
    ON solicitudes(access_token)
    WHERE access_token IS NOT NULL;

COMMENT ON COLUMN solicitudes.access_token IS
    'Token aleatorio (UUID) que viaja en la URL pública solicitud.html?t=<token>. '
    'No expone datos del cliente y no es enumerable.';
