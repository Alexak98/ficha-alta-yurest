-- ─────────────────────────────────────────────────────────────────────────
-- Corrección semántica de los triggers de timestamps por estado.
-- ─────────────────────────────────────────────────────────────────────────
-- Contexto: la migración 02 setteaba fecha_rellenado al pasar a 'rellenado'
-- y fecha_completado al pasar a 'completada', pero el flujo real de negocio
-- es justo al revés:
--
--   * Cliente rellena su parte (vía solicitud.html, workflow 11-auxiliares):
--     la ficha se crea con estado='completada'.  → "RELLENADA POR CLIENTE"
--   * Comercial completa la ficha (vía index.html, workflow 04-fichas-alta):
--     ahora index.html envía estado='rellenado'. → "COMPLETADA POR COMERCIAL"
--
-- Esta migración invierte el sentido de los triggers para que las nuevas
-- columnas reflejen tiempos de negocio reales y rehace el backfill.
-- Idempotente: re-ejecutable sin efectos secundarios.
-- ─────────────────────────────────────────────────────────────────────────

-- Sustituimos la función con la lógica correcta.
CREATE OR REPLACE FUNCTION fichas_set_estado_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Cliente rellenó su parte → estado='completada'.
    IF NEW.estado = 'completada' AND NEW.fecha_rellenado IS NULL THEN
        NEW.fecha_rellenado := NOW();
    END IF;
    -- Comercial completó la ficha → estado='rellenado' / 'Rellenado'.
    IF NEW.estado IN ('rellenado', 'Rellenado') AND NEW.fecha_completado IS NULL THEN
        NEW.fecha_completado := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe (creado en migración 02). No hace falta recrearlo.

-- Backfill correctivo: limpiamos los valores que la migración 02 puso al revés
-- y los rellenamos con la semántica correcta.
--   * fecha_rellenado: solo para fichas que vinieron del cliente (estado='completada').
--   * fecha_completado: para fichas con estado='rellenado'/'Rellenado' (cerradas
--     por comercial). Usamos updated_at como mejor proxy disponible.

-- Limpiar backfill incorrecto previo (sólo si coincide con created_at que es lo
-- que escribió la migración 02).
UPDATE fichas_alta
   SET fecha_rellenado = NULL
 WHERE estado IN ('rellenado', 'Rellenado')
   AND fecha_rellenado = created_at;

UPDATE fichas_alta
   SET fecha_completado = NULL
 WHERE estado = 'completada'
   AND fecha_completado IS NOT NULL;

-- Backfill correcto.
UPDATE fichas_alta
   SET fecha_rellenado = COALESCE(fecha_rellenado, created_at)
 WHERE estado = 'completada'
   AND fecha_rellenado IS NULL;

UPDATE fichas_alta
   SET fecha_completado = COALESCE(fecha_completado, updated_at)
 WHERE estado IN ('rellenado', 'Rellenado')
   AND fecha_completado IS NULL;

-- Para fichas cerradas por comercial cuyo cliente sí pasó por solicitud,
-- conservamos fecha_rellenado = solicitudes.created_at (ya cubierto por el
-- trigger de solicitudes en migración 02; este UPDATE es defensivo).
UPDATE fichas_alta f
   SET fecha_rellenado = COALESCE(f.fecha_rellenado, s.created_at)
  FROM solicitudes s
 WHERE s.ficha_id = f.id
   AND f.fecha_rellenado IS NULL;
