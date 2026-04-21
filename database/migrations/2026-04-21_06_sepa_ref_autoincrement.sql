-- ============================================================================
-- SEPA: asignación automática de referencia secuencial por año.
--
-- Problema: el front enviaba referencia='YUREST-<id_solicitud>', que podía
-- ser "YUREST-null" cuando la URL del cliente usaba token (?t=) en vez de
-- id numérico. Además, la referencia no era secuencial tipo factura.
--
-- Solución: trigger BEFORE INSERT/UPDATE que calcula la siguiente
-- referencia libre con formato YUREST-YYYY-NNNN (4 dígitos, reset anual)
-- siempre que la referencia entrante esté vacía, sea null, sea el string
-- literal "YUREST-null", o no cumpla el patrón canónico.
--
-- Concurrencia: dos INSERTs simultáneos pueden calcular el mismo número.
-- Para garantizar unicidad añadimos un índice UNIQUE parcial; si hay
-- colisión, el segundo INSERT falla con "duplicate key" y el front
-- reintenta (o el usuario reenvía). Para cargas reales (<< 10 SEPA/día)
-- esto es prácticamente imposible.
-- ============================================================================

-- ── 0a. Limpiar JSON null sueltos ────────────────────────────────────────
UPDATE fichas_alta
   SET sepa_mandato = NULL
 WHERE sepa_mandato IS NOT NULL
   AND jsonb_typeof(sepa_mandato) = 'null';

-- ── 0b. Reparar filas donde sepa_mandato se guardó como string JSON ──────
-- Algún workflow antiguo hizo JSON.stringify antes de mandarlo al nodo
-- Supabase, que a su vez volvió a serializar → en BD quedó un escalar
-- string en lugar de un objeto. Lo extraemos con #>>'{}' y reparseamos.
UPDATE fichas_alta
   SET sepa_mandato = (sepa_mandato #>> '{}')::jsonb
 WHERE sepa_mandato IS NOT NULL
   AND jsonb_typeof(sepa_mandato) = 'string';

-- ── 0c. Cualquier otro tipo no-object (number, boolean, array) → NULL ────
UPDATE fichas_alta
   SET sepa_mandato = NULL
 WHERE sepa_mandato IS NOT NULL
   AND jsonb_typeof(sepa_mandato) <> 'object';

-- ── 1. Función del trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION asignar_sepa_ref()
RETURNS TRIGGER AS $$
DECLARE
    ref_actual text;
    next_num   integer;
    year_str   text := to_char(NOW(), 'YYYY');
    patron_canonico text := '^YUREST-\d{4}-\d{4}$';
BEGIN
    -- Sin mandato SEPA no hay nada que hacer.
    IF NEW.sepa_mandato IS NULL THEN
        RETURN NEW;
    END IF;

    -- Defensivo: si llega algo que no sea object (string, null, array),
    -- no tocamos y dejamos que lo detecte el código cliente.
    IF jsonb_typeof(NEW.sepa_mandato) <> 'object' THEN
        RETURN NEW;
    END IF;

    ref_actual := NEW.sepa_mandato->>'referencia';

    -- Si ya hay una ref válida con formato canónico, no la tocamos
    -- (preserva referencias asignadas previamente al editar fichas).
    IF ref_actual IS NOT NULL
       AND ref_actual <> ''
       AND ref_actual ~ patron_canonico THEN
        RETURN NEW;
    END IF;

    -- Calcular siguiente secuencial del año actual.
    -- Bloqueamos la tabla en modo SHARE ROW EXCLUSIVE para evitar que
    -- dos INSERTs concurrentes calculen el mismo MAX. El bloqueo se
    -- libera al final de la transacción.
    LOCK TABLE fichas_alta IN SHARE ROW EXCLUSIVE MODE;

    SELECT COALESCE(MAX(
              (SUBSTRING(sepa_mandato->>'referencia' FROM ('^YUREST-' || year_str || '-(\d{4})$')))::int
           ), 0) + 1
      INTO next_num
      FROM fichas_alta
     WHERE jsonb_typeof(sepa_mandato) = 'object'
       AND sepa_mandato->>'referencia' ~ ('^YUREST-' || year_str || '-\d{4}$');

    NEW.sepa_mandato := jsonb_set(
        NEW.sepa_mandato,
        '{referencia}',
        to_jsonb('YUREST-' || year_str || '-' || LPAD(next_num::text, 4, '0'))
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Trigger BEFORE INSERT/UPDATE ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_asignar_sepa_ref ON fichas_alta;

CREATE TRIGGER trg_asignar_sepa_ref
    BEFORE INSERT OR UPDATE OF sepa_mandato ON fichas_alta
    FOR EACH ROW
    WHEN (NEW.sepa_mandato IS NOT NULL)
    EXECUTE FUNCTION asignar_sepa_ref();

-- ── 3. Índice UNIQUE parcial para blindar unicidad ────────────────────────
-- Si dos transacciones esquivan el LOCK (caso raro), la segunda falla aquí.
DROP INDEX IF EXISTS uniq_fichas_alta_sepa_referencia;
CREATE UNIQUE INDEX uniq_fichas_alta_sepa_referencia
    ON fichas_alta ((sepa_mandato->>'referencia'))
    WHERE sepa_mandato IS NOT NULL
      AND jsonb_typeof(sepa_mandato) = 'object'
      AND sepa_mandato->>'referencia' ~ '^YUREST-\d{4}-\d{4}$';

-- ── 4. BACKFILL: renumerar todas las referencias existentes ───────────────
-- Borra las refs viejas ("YUREST-null", "YUREST-<id>", etc.) y deja que el
-- trigger reasigne secuencialmente. Orden: por fecha de firma ascendente
-- para que el cliente más antiguo sea 0001.
--
-- NOTA: esto renumera TODO el histórico. Si quieres conservar alguna ref
-- legacy (por contrato firmado físicamente), comenta este bloque.
WITH ordenadas AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY COALESCE(SUBSTRING(sepa_mandato->>'firmado_at' FROM 1 FOR 4),
                                     to_char(NOW(),'YYYY'))
               ORDER BY sepa_mandato->>'firmado_at' NULLS LAST, id
           ) AS rn,
           COALESCE(SUBSTRING(sepa_mandato->>'firmado_at' FROM 1 FOR 4),
                    to_char(NOW(),'YYYY')) AS anio
      FROM fichas_alta
     WHERE sepa_mandato IS NOT NULL
       AND jsonb_typeof(sepa_mandato) = 'object'
)
UPDATE fichas_alta f
   SET sepa_mandato = jsonb_set(
         f.sepa_mandato,
         '{referencia}',
         to_jsonb('YUREST-' || o.anio || '-' || LPAD(o.rn::text, 4, '0'))
       )
  FROM ordenadas o
 WHERE f.id = o.id;

-- ── 5. Verificación ───────────────────────────────────────────────────────
-- Deberías ver todas las fichas con SEPA numeradas YUREST-YYYY-0001,
-- YUREST-YYYY-0002, ... sin huecos ni duplicados.
SELECT id,
       denominacion,
       sepa_mandato->>'referencia' AS referencia,
       sepa_mandato->>'firmado_at' AS firmado_at
  FROM fichas_alta
 WHERE sepa_mandato IS NOT NULL
 ORDER BY sepa_mandato->>'referencia';
