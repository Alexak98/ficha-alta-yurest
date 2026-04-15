-- =============================================
-- YUREST GESTOR - PostgreSQL Schema para Supabase
-- Versión 2.0 - Completa y corregida
-- =============================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. FICHAS DE ALTA (Clientes)
-- =============================================
CREATE TABLE fichas_alta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_ficha SERIAL,

    -- Comercial (vendedor que gestiona el alta)
    comercial TEXT,

    -- Datos empresa
    denominacion TEXT NOT NULL,
    nombre_comercial TEXT,
    cif TEXT,
    email TEXT,
    email_factura TEXT,
    email_cc TEXT,
    tipo_cliente TEXT, -- 'lite', 'planes', 'corporate'

    -- Direccion
    calle TEXT,
    numero TEXT,
    cp TEXT,
    municipio TEXT,
    provincia TEXT,

    -- Jefe de proyecto (contacto principal del cliente)
    jp_nombre TEXT,
    jp_apellidos TEXT,
    jp_rol TEXT,
    jp_telefono TEXT,
    jp_mail TEXT,

    -- Firmante del contrato
    firm_nombre TEXT,
    firm_apellidos TEXT,
    firm_mail TEXT,
    firm_dni TEXT,
    firm_puesto TEXT,

    -- Servicios
    firmas_contratadas TEXT, -- '100', '200', '300' o vacío
    ocr_activo BOOLEAN DEFAULT false,
    lite BOOLEAN DEFAULT false,

    -- TPV
    tpv TEXT,
    tpv_contacto TEXT,
    tpv_email TEXT,

    -- Dirección de entrega (para clientes Lite)
    entrega_calle TEXT,
    entrega_numero TEXT,
    entrega_cp TEXT,
    entrega_municipio TEXT,
    entrega_provincia TEXT,

    -- Contacto de entrega
    contacto_nombre TEXT,
    contacto_email TEXT,
    contacto_telefono TEXT,

    -- Módulos contratados
    modulos TEXT[] DEFAULT '{}',

    -- Financiero
    iban TEXT,
    importe_setup DECIMAL(10,2) DEFAULT 0,
    descuento_setup DECIMAL(5,2) DEFAULT 0,
    mensualidad_total DECIMAL(10,2) DEFAULT 0,
    mensualidad_total_locales DECIMAL(10,2) DEFAULT 0,
    fin_implementacion DECIMAL(10,2) DEFAULT 0,
    fin_basic DECIMAL(10,2) DEFAULT 0,
    fin_pro DECIMAL(10,2) DEFAULT 0,
    fin_rrhh DECIMAL(10,2) DEFAULT 0,
    fin_operaciones DECIMAL(10,2) DEFAULT 0,
    fin_lite DECIMAL(10,2) DEFAULT 0,
    fin_integraciones DECIMAL(10,2) DEFAULT 0,
    fin_mensualidad_anual DECIMAL(10,2) DEFAULT 0,

    -- Distribuidor
    distribuidor BOOLEAN DEFAULT false,
    dist_empresa TEXT,
    dist_cif TEXT,
    dist_direccion TEXT,
    dist_cp TEXT,
    dist_contacto TEXT,
    dist_mail TEXT,
    dist_telefono TEXT,
    dist_comision DECIMAL(10,2) DEFAULT 0,

    -- Credenciales
    cred_master TEXT,
    cred_yurest TEXT,

    -- Otros
    paquetes_carrito JSONB DEFAULT '[]', -- items del carrito seleccionados
    comentarios TEXT,
    implementador TEXT,
    baja TEXT DEFAULT 'No', -- 'No' o 'Sí'

    -- Estado del alta
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'en_proceso')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. LOCALES (sedes por ficha)
-- =============================================
CREATE TABLE locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID NOT NULL REFERENCES fichas_alta(id) ON DELETE CASCADE,

    nombre TEXT NOT NULL,
    email TEXT,
    calle TEXT,
    numero TEXT,
    cp TEXT,

    -- Datos societarios del local
    sociedad_cif TEXT,
    sociedad_denominacion TEXT,
    sociedad_calle TEXT,
    sociedad_numero TEXT,
    sociedad_cp TEXT,
    sociedad_municipio TEXT,
    sociedad_provincia TEXT,

    -- Mensualidad del local
    mensualidad DECIMAL(10,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. PLANTILLAS DE PROYECTO
-- =============================================
CREATE TABLE plantillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    secciones JSONB NOT NULL DEFAULT '[]',
    -- Estructura: [{ "nombre": "Sección", "tareas": ["Tarea 1", "Tarea 2"] }]

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. PROYECTOS DE IMPLEMENTACIÓN
-- =============================================
CREATE TABLE proyectos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE SET NULL,
    plantilla_id UUID REFERENCES plantillas(id) ON DELETE SET NULL,

    cliente TEXT NOT NULL,
    implementador TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'Planes', 'Corporate sin cocina', 'Corporate con cocina'
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'completado', 'pausado')),
    fecha_inicio DATE,
    ultima_actividad DATE,

    -- TPV asociado
    tpv TEXT,

    -- Pausa
    motivo_pausa TEXT,
    plan_accion TEXT,

    -- Integración Asana
    asana_project_id TEXT,

    -- Notas libres
    anotaciones TEXT,

    -- Contactos del proyecto (array JSONB)
    contactos JSONB DEFAULT '[]',
    -- [{ "nombre": "", "apellidos": "", "email": "", "puesto": "", "telefono": "" }]

    -- Participantes (emails)
    participantes TEXT[] DEFAULT '{}',

    -- Adjuntos (metadatos, archivos en Supabase Storage)
    adjuntos JSONB DEFAULT '[]',
    -- [{ "id": "", "nombre": "", "tipo": "", "size": 0, "url": "", "fecha": "" }]

    -- Secciones con tareas (estructura completa del proyecto)
    secciones JSONB NOT NULL DEFAULT '[]',
    -- [{
    --   "nombre": "Sección",
    --   "tareas": [{
    --     "id": "abc123",
    --     "nombre": "Tarea",
    --     "completada": false,
    --     "show": null,          -- null | "Show" | "No Show"
    --     "fechaEntrega": null,  -- "YYYY-MM-DD"
    --     "tiempoEstimado": null,-- minutos
    --     "notas": "",
    --     "subtareas": [{
    --       "id": "def456",
    --       "nombre": "Subtarea",
    --       "completada": false,
    --       "fechaEntrega": null
    --     }]
    --   }]
    -- }]

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. BAJAS (desvinculaciones de clientes)
-- =============================================
CREATE TABLE bajas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE SET NULL,

    cliente TEXT NOT NULL,
    motivo TEXT,
    fecha_baja DATE DEFAULT CURRENT_DATE,
    implementador TEXT,
    tipo_cliente TEXT,

    -- Datos adicionales flexibles
    datos JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. SOLICITUDES DE SERVICIO
-- =============================================
CREATE TABLE solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE CASCADE,

    tipo TEXT,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
    asignado_a TEXT, -- implementador

    fecha_vencimiento DATE,
    documentos JSONB DEFAULT '[]', -- [{ "nombre": "", "url": "" }]
    notas TEXT,
    datos JSONB DEFAULT '{}', -- body completo de la solicitud

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. DISTRIBUCIÓN (asignaciones implementador → ficha)
-- =============================================
CREATE TABLE distribucion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    implementador TEXT NOT NULL,
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE CASCADE,
    datos JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. USUARIOS (autenticación)
-- =============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT,
    rol TEXT DEFAULT 'user' CHECK (rol IN ('admin', 'user', 'implementador')),
    activo BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES para rendimiento
-- =============================================

-- fichas_alta
CREATE INDEX idx_fichas_estado ON fichas_alta(estado);
CREATE INDEX idx_fichas_tipo ON fichas_alta(tipo_cliente);
CREATE INDEX idx_fichas_implementador ON fichas_alta(implementador);
CREATE INDEX idx_fichas_comercial ON fichas_alta(comercial);
CREATE INDEX idx_fichas_denominacion ON fichas_alta(denominacion);
CREATE INDEX idx_fichas_cif ON fichas_alta(cif);
CREATE INDEX idx_fichas_created ON fichas_alta(created_at DESC);

-- proyectos
CREATE INDEX idx_proyectos_estado ON proyectos(estado);
CREATE INDEX idx_proyectos_tipo ON proyectos(tipo);
CREATE INDEX idx_proyectos_implementador ON proyectos(implementador);
CREATE INDEX idx_proyectos_ficha ON proyectos(ficha_id);
CREATE INDEX idx_proyectos_cliente ON proyectos(cliente);
CREATE INDEX idx_proyectos_created ON proyectos(created_at DESC);

-- bajas
CREATE INDEX idx_bajas_ficha ON bajas(ficha_id);
CREATE INDEX idx_bajas_fecha ON bajas(fecha_baja DESC);

-- solicitudes
CREATE INDEX idx_solicitudes_ficha ON solicitudes(ficha_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);

-- locales
CREATE INDEX idx_locales_ficha ON locales(ficha_id);

-- distribucion
CREATE INDEX idx_distribucion_implementador ON distribucion(implementador);
CREATE INDEX idx_distribucion_ficha ON distribucion(ficha_id);

-- =============================================
-- TRIGGER: actualizar updated_at automáticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fichas_updated BEFORE UPDATE ON fichas_alta FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proyectos_updated BEFORE UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plantillas_updated BEFORE UPDATE ON plantillas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bajas_updated BEFORE UPDATE ON bajas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_solicitudes_updated BEFORE UPDATE ON solicitudes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- Habilitar RLS en todas las tablas
ALTER TABLE fichas_alta ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política permisiva para service_role (n8n usa service_role key)
-- Estas políticas permiten acceso completo vía service_role
CREATE POLICY "service_role_all" ON fichas_alta FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON locales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON plantillas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON proyectos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON bajas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON solicitudes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON distribucion FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON usuarios FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Plantilla default
INSERT INTO plantillas (id, nombre, descripcion, secciones) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default',
    'Plantilla estándar con sesiones, puesta en marcha y carga de datos',
    '[
        {"nombre": "Puesta en Marcha / Finalización", "tareas": ["Llamada de contacto", "Creación de Grupo Whatsapp", "Eliminar grupo de Whatsapp"]},
        {"nombre": "Hardware", "tareas": []},
        {"nombre": "Carga de Datos Yuload", "tareas": ["Carga - Cliente - OCR - Corp"]},
        {"nombre": "Planificación de sesiones", "tareas": ["Planificacion", "Sesión de Bienvenida", "Modulo Compras", "Modulo Cocina", "Modulo Stock", "Modulo Financiero", "Modulo Checklist", "Modulo APPCC", "Modulo Auditorias", "Modulo Comunicación", "Modulo RRHH", "Modulo Cocina Produccion", "Modulo Almacén Central", "Modulo Gestor documental", "Módulo Analítica de ventas", "Módulo Dashboard dinamicos", "Módulo Firmas Digitales", "Sesiones Extra"]},
        {"nombre": "Módulos terminados de implementar", "tareas": []}
    ]'::jsonb
);
