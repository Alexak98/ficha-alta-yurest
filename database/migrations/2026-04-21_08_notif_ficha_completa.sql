-- ============================================================================
-- Flag de notificación "ficha completada".
--
-- Hasta ahora los emails de Drive + Integraciones (y la tarea Asana) se
-- disparaban al recibir la solicitud del cliente (workflow 11). El nuevo
-- flujo los difiere hasta que el comercial completa la ficha y el front
-- llama al webhook /ficha/notificar-completa (workflow 19).
--
-- Esta columna sirve para idempotencia: si el comercial guarda la ficha
-- dos veces después de completarla, el workflow 19 solo envía los emails
-- la primera vez. Permite también re-disparar manualmente si hace falta
-- (basta con poner la columna a NULL).
-- ============================================================================

ALTER TABLE fichas_alta
    ADD COLUMN IF NOT EXISTS notificada_completa_at TIMESTAMPTZ;

COMMENT ON COLUMN fichas_alta.notificada_completa_at IS
    'Momento en que el workflow 19 envió los emails de Drive + Integraciones para esta ficha. NULL = aún no notificada. Se usa como idempotencia para no reenviar si el comercial guarda dos veces una ficha ya completada.';

-- Recarga cache de PostgREST para que el nuevo campo esté disponible en la API.
NOTIFY pgrst, 'reload schema';
