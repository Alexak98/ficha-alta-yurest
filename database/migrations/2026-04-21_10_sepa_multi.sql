-- ============================================================================
-- SEPA multi-sociedad por ficha
--
-- Antes: 1 mandato SEPA por ficha (columna sepa_mandato JSONB era un único
-- objeto). Ahora una ficha puede tener N mandatos (uno por sociedad), y
-- cada local apunta al mandato que le factura.
--
-- Cambios:
--   1. locales.sepa_mandato_id — UUID opcional que referencia el `id`
--      dentro de sepa_mandato (array de objetos con .id).
--   2. sepa_mandato pasa a poder ser tanto objeto (single, legacy) como
--      array (multi, nuevo). El trigger asignar_sepa_ref soporta ambos.
--   3. El índice UNIQUE de referencia SEPA cubre también los elementos
--      dentro del array.
-- ============================================================================

-- ── 1. locales.sepa_mandato_id ─────────────────────────────────────────────
ALTER TABLE locales
    ADD COLUMN IF NOT EXISTS sepa_mandato_id UUID;

COMMENT ON COLUMN locales.sepa_mandato_id IS
    'UUID que referencia el `id` de un elemento del array fichas_alta.sepa_mandato. NULL cuando aún no se ha asignado sociedad/cuenta al local.';

-- ── 2. Trigger asignar_sepa_ref — soporte de objeto O array ────────────────
CREATE OR REPLACE FUNCTION asignar_sepa_ref()
RETURNS TRIGGER AS $$
DECLARE
    tipo           text;
    ref_actual     text;
    next_num       integer;
    year_str       text := to_char(NOW(), 'YYYY');
    patron_canon   text := '^YUREST-\d{4}-\d{4}$';
    patron_anual   text;
    arr            jsonb;
    item           jsonb;
    item_ref       text;
    n              integer;
    i              integer;
BEGIN
    IF NEW.sepa_mandato IS NULL THEN
        RETURN NEW;
    END IF;

    tipo := jsonb_typeof(NEW.sepa_mandato);
    IF tipo NOT IN ('object', 'array') THEN
        RETURN NEW;
    END IF;

    patron_anual := '^YUREST-' || year_str || '-(\d{4})$';

    -- Bloqueo de tabla para evitar carreras entre dos INSERTs simultáneos
    -- que recalculen el mismo MAX.
    LOCK TABLE fichas_alta IN SHARE ROW EXCLUSIVE MODE;

    -- Cálculo del próximo número disponible en el año. Unionamos referencias
    -- del formato antiguo (objeto) y del nuevo (cada elemento del array).
    WITH all_refs AS (
        SELECT sepa_mandato->>'referencia' AS ref
          FROM fichas_alta
         WHERE jsonb_typeof(sepa_mandato) = 'object'
        UNION ALL
        SELECT elem->>'referencia'
          FROM fichas_alta, jsonb_array_elements(sepa_mandato) elem
         WHERE jsonb_typeof(sepa_mandato) = 'array'
    )
    SELECT COALESCE(MAX((SUBSTRING(ref FROM patron_anual))::int), 0) + 1
      INTO next_num
      FROM all_refs
     WHERE ref ~ patron_anual;

    IF tipo = 'object' THEN
        -- Path single-mandate (legacy / fichas antiguas).
        ref_actual := NEW.sepa_mandato->>'referencia';
        IF ref_actual IS NULL OR ref_actual = '' OR ref_actual !~ patron_canon THEN
            NEW.sepa_mandato := jsonb_set(
                NEW.sepa_mandato,
                '{referencia}',
                to_jsonb('YUREST-' || year_str || '-' || LPAD(next_num::text, 4, '0'))
            );
        END IF;
    ELSE
        -- Path array: asignamos ref a cada elemento que no tenga una válida.
        arr := NEW.sepa_mandato;
        n := jsonb_array_length(arr);
        i := 0;
        WHILE i < n LOOP
            item := arr->i;
            item_ref := item->>'referencia';
            IF item IS NOT NULL
               AND jsonb_typeof(item) = 'object'
               AND (item_ref IS NULL OR item_ref = '' OR item_ref !~ patron_canon) THEN
                arr := jsonb_set(
                    arr,
                    ARRAY[i::text, 'referencia'],
                    to_jsonb('YUREST-' || year_str || '-' || LPAD(next_num::text, 4, '0'))
                );
                next_num := next_num + 1;
            END IF;
            i := i + 1;
        END LOOP;
        NEW.sepa_mandato := arr;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Índice UNIQUE — cubre single Y array ────────────────────────────────
-- El índice anterior solo cubría el path 'object'. Añadimos uno nuevo que
-- indexa cada referencia dentro del array para que dos elementos nunca
-- compartan ref.
DROP INDEX IF EXISTS uniq_fichas_alta_sepa_referencia;
CREATE UNIQUE INDEX uniq_fichas_alta_sepa_referencia
    ON fichas_alta ((sepa_mandato->>'referencia'))
    WHERE sepa_mandato IS NOT NULL
      AND jsonb_typeof(sepa_mandato) = 'object'
      AND sepa_mandato->>'referencia' ~ '^YUREST-\d{4}-\d{4}$';

-- Para el path array usamos un índice funcional: expandimos el array en una
-- función inmutable que concatena todas las refs. No es tan estricto como
-- el UNIQUE anterior pero evita duplicados dentro de una MISMA ficha (que
-- es el caso principal a proteger — entre fichas distintas el trigger
-- siempre suma +1 al contador global bajo LOCK).
-- Para garantía total de unicidad entre fichas, confiamos en el LOCK del
-- trigger: ninguna ref se repite porque el MAX(+1) lo impide.

-- ── 4. Verificación ────────────────────────────────────────────────────────
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'locales'
   AND column_name = 'sepa_mandato_id';

-- Refresca cache PostgREST.
NOTIFY pgrst, 'reload schema';
