-- =============================================
-- YUREST GESTOR - PostgreSQL Schema
-- Supabase compatible
-- =============================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. FICHAS DE ALTA (Clientes)
-- =============================================
CREATE TABLE fichas_alta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_ficha SERIAL,

    -- Datos empresa
    denominacion TEXT NOT NULL,
    nombre_comercial TEXT,
    cif TEXT,
    email TEXT,
    email_factura TEXT,
    email_cc TEXT,
    tipo_cliente TEXT, -- 'Planes', 'Corporate sin cocina', 'Corporate con cocina'

    -- Direccion
    calle TEXT,
    numero TEXT,
    cp TEXT,
    municipio TEXT,
    provincia TEXT,

    -- Jefe de proyecto
    jp_nombre TEXT,
    jp_apellidos TEXT,
    jp_rol TEXT,
    jp_telefono TEXT,
    jp_mail TEXT,

    -- Firmante
    firm_nombre TEXT,
    firm_apellidos TEXT,
    firm_mail TEXT,
    firm_dni TEXT,
    firm_puesto TEXT,
    firm_mensualidad DECIMAL(10,2) DEFAULT 0,

    -- Servicios
    firmas_contratadas TEXT,
    ocr_activo BOOLEAN DEFAULT false,
    lite BOOLEAN DEFAULT false,

    -- TPV
    tpv TEXT,
    tpv_contacto TEXT,
    tpv_email TEXT,

    -- Entrega
    entrega_calle TEXT,
    entrega_numero TEXT,
    entrega_cp TEXT,
    entrega_municipio TEXT,
    entrega_provincia TEXT,

    -- Contacto
    contacto_nombre TEXT,
    contacto_email TEXT,
    contacto_telefono TEXT,

    -- Modulos y financiero
    modulos TEXT[], -- array de strings
    iban TEXT,
    mensualidad_total DECIMAL(10,2) DEFAULT 0,
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
    paquetes_carrito TEXT[],
    comentarios TEXT,
    implementador TEXT,

    -- Estado
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'completada', 'en_proceso'

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. LOCALES (por ficha)
-- =============================================
CREATE TABLE locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE CASCADE,

    nombre TEXT,
    email TEXT,
    calle TEXT,
    numero TEXT,
    cp TEXT,

    -- Sociedad
    sociedad_cif TEXT,
    sociedad_denominacion TEXT,
    sociedad_calle TEXT,
    sociedad_numero TEXT,
    sociedad_cp TEXT,
    sociedad_municipio TEXT,
    sociedad_provincia TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. PLANTILLAS
-- =============================================
CREATE TABLE plantillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    secciones JSONB NOT NULL DEFAULT '[]',
    -- secciones: [{ "nombre": "Puesta en Marcha...", "tareas": ["Llamada de contacto", ...] }]

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. PROYECTOS
-- =============================================
CREATE TABLE proyectos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE SET NULL,
    plantilla_id UUID REFERENCES plantillas(id) ON DELETE SET NULL,

    cliente TEXT NOT NULL,
    implementador TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'Planes', 'Corporate sin cocina', 'Corporate con cocina'
    estado TEXT NOT NULL DEFAULT 'activo', -- 'activo', 'completado', 'pausado'
    fecha_inicio DATE,
    ultima_actividad DATE,

    -- TPV
    tpv TEXT,

    -- Pausa
    motivo_pausa TEXT,
    plan_accion TEXT,

    -- Asana
    asana_project_id TEXT,

    -- Anotaciones
    anotaciones TEXT,

    -- Contactos (array de objetos)
    contactos JSONB DEFAULT '[]',
    -- [{ "nombre": "...", "apellidos": "...", "email": "...", "puesto": "...", "telefono": "..." }]

    -- Participantes (emails derivados de contactos)
    participantes TEXT[] DEFAULT '{}',

    -- Adjuntos (metadatos, archivos en Supabase Storage)
    adjuntos JSONB DEFAULT '[]',
    -- [{ "id": "...", "nombre": "...", "tipo": "...", "size": 1234, "url": "...", "fecha": "..." }]

    -- Secciones con tareas (estructura completa)
    secciones JSONB NOT NULL DEFAULT '[]',
    -- [{ "nombre": "Puesta en Marcha...", "tareas": [{ "id": "...", "nombre": "...", "completada": false, "fechaEntrega": null, "tiempoEstimado": null, "notas": "", "subtareas": [...] }] }]

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. BAJAS
-- =============================================
CREATE TABLE bajas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE SET NULL,

    cliente TEXT NOT NULL,
    motivo TEXT,
    fecha_baja DATE DEFAULT CURRENT_DATE,
    implementador TEXT,
    tipo_cliente TEXT,

    -- Datos adicionales
    datos JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. SOLICITUDES
-- =============================================
CREATE TABLE solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE CASCADE,

    tipo TEXT, -- tipo de solicitud
    estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_progreso', 'completado'
    asignado_a TEXT, -- implementador

    fecha_vencimiento DATE,
    documentos JSONB DEFAULT '[]', -- [{ "nombre": "...", "url": "..." }]
    notas TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. DISTRIBUCION (asignaciones)
-- =============================================
CREATE TABLE distribucion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    implementador TEXT NOT NULL,
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE CASCADE,
    datos JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. USUARIOS (para auth)
-- =============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- bcrypt hash
    nombre TEXT,
    rol TEXT DEFAULT 'user', -- 'admin', 'user', 'implementador'
    activo BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDICES para rendimiento
-- =============================================
CREATE INDEX idx_fichas_estado ON fichas_alta(estado);
CREATE INDEX idx_fichas_tipo ON fichas_alta(tipo_cliente);
CREATE INDEX idx_fichas_implementador ON fichas_alta(implementador);
CREATE INDEX idx_proyectos_estado ON proyectos(estado);
CREATE INDEX idx_proyectos_tipo ON proyectos(tipo);
CREATE INDEX idx_proyectos_implementador ON proyectos(implementador);
CREATE INDEX idx_proyectos_ficha ON proyectos(ficha_id);
CREATE INDEX idx_bajas_ficha ON bajas(ficha_id);
CREATE INDEX idx_solicitudes_ficha ON solicitudes(ficha_id);
CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_locales_ficha ON locales(ficha_id);

-- =============================================
-- TRIGGER: actualizar updated_at automaticamente
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
-- DATOS INICIALES
-- =============================================

-- Plantilla default
INSERT INTO plantillas (id, nombre, descripcion, secciones) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default',
    'Plantilla estandar con sesiones, puesta en marcha y carga de datos',
    '[
        {"nombre": "Puesta en Marcha / Finalización", "tareas": ["Llamada de contacto", "Creación de Grupo Whatsapp", "Eliminar grupo de Whatsapp"]},
        {"nombre": "Hardware", "tareas": []},
        {"nombre": "Carga de Datos Yuload", "tareas": ["Carga - Cliente - OCR - Corp"]},
        {"nombre": "Planificación de sesiones", "tareas": ["Planificacion", "Sesión de Bienvenida", "Modulo Compras", "Modulo Cocina", "Modulo Stock", "Modulo Financiero", "Modulo Checklist", "Modulo APPCC", "Modulo Auditorias", "Modulo Comunicación", "Modulo RRHH", "Modulo Cocina Produccion", "Modulo Almacén Central", "Modulo Gestor documental", "Módulo Analítica de ventas", "Módulo Dashboard dinamicos", "Módulo Firmas Digitales", "Sesiones Extra"]},
        {"nombre": "Módulos terminados de implementar", "tareas": []}
    ]'::jsonb
);

-- Usuario admin
INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES (
    'admin',
    '$2b$10$placeholder_hash_replace_with_real', -- Reemplazar con hash real de Yurest@46002
    'Administrador',
    'admin'
);
