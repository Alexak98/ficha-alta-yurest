-- ============================================================================
-- Amplía el conjunto de valores válidos de tipo_cliente.
--
-- Antes: 'lite', 'planes', 'corporate'
-- Ahora: añade 'corporate_cp' (Corporate + CP) y 'corp_cocina'
--        (CORP. Cocina Producción). 'lite' se conserva porque sigue
--        siendo un flag interno alcanzable vía el checkbox "Cliente LITE"
--        aunque ya no aparezca en el selector principal.
-- ============================================================================

ALTER TABLE fichas_alta DROP CONSTRAINT IF EXISTS fichas_alta_tipo_cliente_check;

ALTER TABLE fichas_alta
  ADD CONSTRAINT fichas_alta_tipo_cliente_check
  CHECK (tipo_cliente IS NULL OR tipo_cliente IN (
    'lite',
    'planes',
    'corporate',
    'corporate_cp',
    'corp_cocina'
  ));

-- Refresca caché de PostgREST para que los nuevos valores sean aceptados
-- inmediatamente por la API.
NOTIFY pgrst, 'reload schema';

-- Verificación: muestra el constraint vigente.
SELECT conname, pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conname = 'fichas_alta_tipo_cliente_check';
