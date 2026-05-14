-- ============================================================================
-- Migration: presupuestos.asana_gid
-- ============================================================================
-- Fecha:   2026-05-14
-- Motivo:  Habilitar la importación automática de tareas de Asana de la
--          sección "Pendiente de presupuesto" (gid 1210961912211323 del
--          proyecto "Back Clientes") como presupuestos del portal.
--
--          Se añade una columna nullable `asana_gid` con UNIQUE parcial
--          (sólo donde no sea NULL) para:
--
--            1. Marcar qué presupuestos vienen de Asana vs. los creados
--               a mano desde la UI.
--            2. Servir como clave de deduplicación cuando el usuario
--               vuelva a abrir el modal "Importar desde Asana" — la
--               tarea aparece marcada como "ya importada" y se ofrece
--               un "Refrescar" en lugar de un "Importar".
--
--          UNIQUE parcial (`WHERE asana_gid IS NOT NULL`) en lugar de
--          UNIQUE plano para que los presupuestos manuales (con
--          asana_gid=NULL) no choquen entre sí — Postgres trata cada
--          NULL como distinto pero algunos clientes asumen lo contrario,
--          mejor explícito.
-- ============================================================================

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS asana_gid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS presupuestos_asana_gid_uidx
  ON presupuestos (asana_gid)
  WHERE asana_gid IS NOT NULL;

COMMENT ON COLUMN presupuestos.asana_gid IS
  'GID de la tarea de Asana de origen (sección "Pendiente de presupuesto"). NULL si el presupuesto se creó a mano.';

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'presupuestos'
   AND column_name = 'asana_gid';

SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'presupuestos'
   AND indexname = 'presupuestos_asana_gid_uidx';
