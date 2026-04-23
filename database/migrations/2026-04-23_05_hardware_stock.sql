-- ============================================================================
-- Stock de hardware (departamento Soporte)
--
-- Catálogo de artículos que Yurest tiene en almacén para vender/enviar
-- a clientes (tablets, soportes, cargadores, cables, impresoras,
-- cajones portamonedas…). Cada artículo lleva stock actual y mínimo;
-- el mínimo se usa para generar alertas de rotura.
--
-- Dos tablas:
--   hardware_stock              — catálogo + stock actual (snapshot).
--   hardware_stock_movimientos  — historial de entradas/salidas/ajustes.
--
-- El stock_actual se mantiene sincronizado con los movimientos vía
-- trigger: insertar un movimiento (entrada|salida|ajuste) actualiza
-- automáticamente el stock del artículo — así nunca diverge entre la
-- foto (stock_actual) y la película (movimientos).
-- ============================================================================

-- ── Catálogo de artículos ──────────────────────────────────────────────────
-- Las categorías reflejan los tipos reales del catálogo de pedidos
-- (js-gestor/data.js HARDWARE_CATALOGO): etiquetas de impresora, hardware
-- de punto de venta (tablet, pantalla KDS, impresora, lector, báscula,
-- sensores IoT) y accesorios (soportes, fundas).
CREATE TABLE IF NOT EXISTS hardware_stock (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT        NOT NULL,
    -- `sku` identifica unívocamente el artículo en el catálogo de pedidos
    -- (ids tipo 'etq_s', 'imp_zebra_zd', 'tablet_a9'…). UNIQUE con WHERE
    -- sku IS NOT NULL permite seed-ear con ON CONFLICT (sku) DO NOTHING.
    sku             TEXT,
    categoria       TEXT        NOT NULL DEFAULT 'otro'
                    CHECK (categoria IN (
                        'tablet', 'soporte', 'cargador', 'cable',
                        'impresora', 'cajon', 'balanza', 'lector',
                        'router', 'etiqueta', 'pantalla', 'sensor',
                        'funda', 'otro'
                    )),
    descripcion     TEXT,
    unidad          TEXT        NOT NULL DEFAULT 'ud',  -- ud, caja, metro…
    stock_actual    INT         NOT NULL DEFAULT 0
                    CHECK (stock_actual >= 0),
    stock_minimo    INT         NOT NULL DEFAULT 0
                    CHECK (stock_minimo >= 0),
    precio_compra   NUMERIC(10,2) NOT NULL DEFAULT 0
                    CHECK (precio_compra >= 0),
    precio_venta    NUMERIC(10,2) NOT NULL DEFAULT 0
                    CHECK (precio_venta  >= 0),
    proveedor       TEXT,
    ubicacion       TEXT,                       -- ej: "Estante A-3, balda 2"
    notas           TEXT,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      TEXT
);

COMMENT ON TABLE hardware_stock IS
    'Catálogo de artículos de hardware en almacén con stock actual y mínimo para alertas.';

CREATE INDEX IF NOT EXISTS idx_hw_stock_categoria
    ON hardware_stock(categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hw_stock_nombre
    ON hardware_stock(nombre) WHERE deleted_at IS NULL;
-- Unique parcial en sku: permite NULL (sku opcional) pero garantiza que
-- cada sku del catálogo de pedidos aparezca una sola vez. Habilita los
-- INSERT ... ON CONFLICT (sku) DO NOTHING del seed de abajo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hw_stock_sku
    ON hardware_stock(sku) WHERE sku IS NOT NULL;

-- Parche de categoría por si la tabla existía con el CHECK antiguo
-- (antes añadíamos sólo 10 categorías; ahora son 14). Idempotente.
ALTER TABLE hardware_stock DROP CONSTRAINT IF EXISTS hardware_stock_categoria_check;
ALTER TABLE hardware_stock ADD  CONSTRAINT hardware_stock_categoria_check
    CHECK (categoria IN (
        'tablet', 'soporte', 'cargador', 'cable',
        'impresora', 'cajon', 'balanza', 'lector',
        'router', 'etiqueta', 'pantalla', 'sensor',
        'funda', 'otro'
    ));

-- ── Movimientos (historial) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hardware_stock_movimientos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    articulo_id     UUID NOT NULL REFERENCES hardware_stock(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL
                    CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    -- cantidad SIEMPRE positiva; el `tipo` indica el sentido.
    -- Para ajuste: si delta es positivo → súmalo; si negativo → resta.
    -- Lo resolvemos con columna `delta` firmada calculada desde el trigger.
    cantidad        INT NOT NULL CHECK (cantidad > 0),
    -- Para ajustes: +N añade, -N resta. Ignorado si tipo != 'ajuste'.
    delta_ajuste    INT,
    motivo          TEXT,
    -- Opcional: enlace al pedido que generó la salida (trazabilidad).
    pedido_id       UUID,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hardware_stock_movimientos IS
    'Historial de entradas/salidas/ajustes de stock. Un trigger actualiza hardware_stock.stock_actual al insertar.';

CREATE INDEX IF NOT EXISTS idx_hw_stock_mov_articulo
    ON hardware_stock_movimientos(articulo_id);
CREATE INDEX IF NOT EXISTS idx_hw_stock_mov_created
    ON hardware_stock_movimientos(created_at DESC);

-- ── Trigger: mantener stock_actual sincronizado con movimientos ────────────
CREATE OR REPLACE FUNCTION hardware_stock_aplicar_movimiento()
RETURNS TRIGGER AS $$
DECLARE
    v_delta INT;
BEGIN
    IF NEW.tipo = 'entrada' THEN
        v_delta := NEW.cantidad;
    ELSIF NEW.tipo = 'salida' THEN
        v_delta := -NEW.cantidad;
    ELSIF NEW.tipo = 'ajuste' THEN
        -- Para ajuste, delta_ajuste manda. Si no viene, tratamos
        -- cantidad como valor absoluto y asumimos +.
        v_delta := COALESCE(NEW.delta_ajuste, NEW.cantidad);
    ELSE
        v_delta := 0;
    END IF;

    UPDATE hardware_stock
       SET stock_actual = GREATEST(stock_actual + v_delta, 0),
           updated_at   = NOW()
     WHERE id = NEW.articulo_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hw_stock_mov_aplicar ON hardware_stock_movimientos;
CREATE TRIGGER trg_hw_stock_mov_aplicar
    AFTER INSERT ON hardware_stock_movimientos
    FOR EACH ROW EXECUTE FUNCTION hardware_stock_aplicar_movimiento();

-- ── Trigger: touch updated_at en hardware_stock ────────────────────────────
CREATE OR REPLACE FUNCTION hardware_stock_touch_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hw_stock_touch ON hardware_stock;
CREATE TRIGGER trg_hw_stock_touch
    BEFORE UPDATE ON hardware_stock
    FOR EACH ROW EXECUTE FUNCTION hardware_stock_touch_updated();

-- ── RLS (mismo patrón que el resto: service_role full, anon CRUD) ─────────
ALTER TABLE hardware_stock                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_stock_movimientos     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON hardware_stock;
CREATE POLICY "service_role_all" ON hardware_stock
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all" ON hardware_stock;
CREATE POLICY "anon_all" ON hardware_stock
    FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all" ON hardware_stock_movimientos;
CREATE POLICY "service_role_all" ON hardware_stock_movimientos
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all" ON hardware_stock_movimientos;
CREATE POLICY "anon_all" ON hardware_stock_movimientos
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Seed: catálogo real de artículos del pedido de hardware ───────────────
-- Fuente: js-gestor/data.js → HARDWARE_CATALOGO (lo que el implementador
-- ve al montar el carrito de un pedido). Se pre-cargan los 21 artículos
-- con stock_actual = 0 — el usuario hace movimientos de entrada cuando
-- llegue la mercancía. El `sku` guarda el id interno del catálogo para
-- poder casar pedidos ↔ stock por código estable.
-- ON CONFLICT (sku) DO NOTHING → idempotente; re-ejecutar no duplica.
INSERT INTO hardware_stock (sku, nombre, categoria, descripcion, unidad, precio_venta) VALUES
    -- Etiquetas (rollos de impresora Zebra)
    ('etq_s',             'Etiqueta S (sencilla)',                            'etiqueta',  '57×32 mm · 2000 uds/rollo',  'rollo',  12.25),
    ('etq_m',             'Etiqueta M (avanzada)',                            'etiqueta',  '57×58 mm · 1000 uds/rollo',  'rollo',   9.20),
    ('etq_l',             'Etiqueta L (completa)',                            'etiqueta',  '60×120 mm · 500 uds/rollo',  'rollo',   8.90),
    ('etq_xl',            'Etiqueta XL (completa)',                           'etiqueta',  '100×100 mm · 800 uds/rollo', 'rollo',  13.90),
    -- Hardware de TPV
    ('imp_zebra_zd',      'Impresora Zebra ZD',                                'impresora', NULL,                          'ud',    300.00),
    ('kds_pcp_215',       'Pantalla KDS PCP-215',                              'pantalla',  '21.5" Windows',               'ud',    665.00),
    ('lector_hwvoy',      'Lector Honeywell Voyager XP 1472G',                 'lector',    NULL,                          'ud',    300.00),
    ('zebra_tc22',        'Zebra TC22',                                        'lector',    'ordenador móvil Android',     'ud',    650.00),
    ('tablet_a9',         'Tablet Samsung Tab A9+',                            'tablet',    '11"',                         'ud',    250.00),
    ('bascula_gram_30',   'Báscula Gram WiFi – hasta 30 kg',                   'balanza',   NULL,                          'ud',    625.00),
    ('bascula_gram_150',  'Báscula Gram WiFi – hasta 150 kg',                  'balanza',   NULL,                          'ud',    775.00),
    ('dobbox_s1',         'Sensor temperatura/humedad doBBox S1',              'sensor',    NULL,                          'ud',    158.00),
    ('dobbox_g15',        'Receptor WiFi doBBox G15',                          'sensor',    NULL,                          'ud',     98.00),
    -- Soportes y fundas
    ('sop_tab_ext',       'Soporte tablet extensible y rotatorio',             'soporte',   NULL,                          'ud',     50.00),
    ('sop_tab_reg',       'Soporte tablet sencillo regulable',                 'soporte',   NULL,                          'ud',     30.00),
    ('sop_tab_pared',     'Soporte tablet fijo de pared (aluminio)',           'soporte',   NULL,                          'ud',     70.00),
    ('sop_kds_movil',     'Soporte KDS VESA móvil de pared',                   'soporte',   NULL,                          'ud',     35.00),
    ('sop_kds_fijo',      'Soporte KDS VESA fijo de pared',                    'soporte',   NULL,                          'ud',     20.00),
    ('sop_kds_ancl',      'Soporte KDS VESA con anclaje a mesa',               'soporte',   NULL,                          'ud',     50.00),
    ('sop_kds_mesa',      'Soporte KDS VESA de mesa (sin anclaje)',            'soporte',   NULL,                          'ud',     50.00),
    ('funda_antic',       'Funda anticaída con soporte giratorio y correas',   'funda',     NULL,                          'ud',     34.00)
ON CONFLICT (sku) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Verificación rápida: deben salir 21 artículos sembrados y 0 movimientos.
SELECT 'hardware_stock' AS tabla, COUNT(*) AS n FROM hardware_stock
UNION ALL
SELECT 'hardware_stock_movimientos', COUNT(*) FROM hardware_stock_movimientos;
