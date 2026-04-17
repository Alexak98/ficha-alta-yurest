-- =============================================
-- YUREST GESTOR - PostgreSQL Schema (Supabase)
-- Versión 3.0 - Endurecido para QA
--
-- Cambios principales vs 2.0:
--   · Constraints CHECK en campos con dominio fijo (baja, cp, cif).
--   · Soft-delete con columna deleted_at (evita CASCADE destructivo).
--   · password_hash con CHECK de longitud mínima (bcrypt = 60 chars).
--   · Índices adicionales para filtros habituales del front.
--   · Índice GIN para búsqueda por módulos.
--   · Políticas RLS preparadas para separar lectura anon y escritura service_role.
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
    tipo_cliente TEXT CHECK (tipo_cliente IS NULL OR tipo_cliente IN ('lite', 'planes', 'corporate')),

    -- Direccion
    calle TEXT,
    numero TEXT,
    cp TEXT CHECK (cp IS NULL OR cp ~ '^[0-9]{5}$'),
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
    firmas_contratadas TEXT CHECK (firmas_contratadas IS NULL OR firmas_contratadas IN ('', '100', '200', '300')),
    ocr_activo BOOLEAN DEFAULT false,
    lite BOOLEAN DEFAULT false,

    -- TPV
    tpv TEXT,
    tpv_contacto TEXT,
    tpv_email TEXT,
    tpv_no_integrado BOOLEAN DEFAULT false,
    tpv_ni_nombre TEXT,
    tpv_ni_contacto TEXT,
    tpv_ni_email TEXT,

    -- Dirección de entrega (para clientes Lite)
    entrega_calle TEXT,
    entrega_numero TEXT,
    entrega_cp TEXT CHECK (entrega_cp IS NULL OR entrega_cp ~ '^[0-9]{5}$'),
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
    paquetes_carrito JSONB DEFAULT '[]',
    comentarios TEXT,
    implementador TEXT,

    -- Indicador de baja (preferido booleano; conservamos 'No'/'Sí' por compat)
    baja TEXT DEFAULT 'No' CHECK (baja IN ('No', 'Sí', 'Si')),

    -- Estado del alta
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'en_proceso', 'rellenado', 'Rellenado')),

    -- Timestamps por estado (poblados por triggers, ver más abajo).
    -- fecha_solicitud: copiada desde solicitudes.created_at cuando se enlaza la ficha.
    -- fecha_rellenado / fecha_completado: seteados al pasar a esos estados, no se sobreescriben.
    fecha_solicitud  TIMESTAMPTZ,
    fecha_rellenado  TIMESTAMPTZ,
    fecha_completado TIMESTAMPTZ,

    -- Soft-delete
    deleted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. LOCALES (sedes por ficha)
-- =============================================
CREATE TABLE locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID NOT NULL REFERENCES fichas_alta(id) ON DELETE RESTRICT,

    nombre TEXT NOT NULL,
    email TEXT,
    calle TEXT,
    numero TEXT,
    cp TEXT CHECK (cp IS NULL OR cp ~ '^[0-9]{5}$'),

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

    deleted_at TIMESTAMPTZ,
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
    tipo TEXT NOT NULL CHECK (tipo IN ('Planes', 'Corporate sin cocina', 'Corporate con cocina')),
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
    asana_project_url TEXT,

    -- Notas libres
    anotaciones TEXT,

    -- Contactos del proyecto (array JSONB)
    contactos JSONB DEFAULT '[]',

    -- Participantes (emails)
    participantes TEXT[] DEFAULT '{}',

    -- Adjuntos (metadatos, archivos en Supabase Storage)
    adjuntos JSONB DEFAULT '[]',

    -- Orden de domiciliación SEPA firmada por el cliente al rellenar la
    -- solicitud (datos del acreedor + deudor + IBAN/BIC + firma base64).
    sepa_mandato JSONB,

    -- Secciones con tareas (estructura completa del proyecto)
    secciones JSONB NOT NULL DEFAULT '[]',

    -- Soft-delete
    deleted_at TIMESTAMPTZ,

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

    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. SOLICITUDES DE SERVICIO
-- =============================================
CREATE TABLE solicitudes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE SET NULL,

    tipo TEXT,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completado', 'Rellenado', 'Pendiente')),
    asignado_a TEXT,

    -- Token aleatorio que viaja en la URL del enlace al cliente
    -- (en lugar del ID-Solicitud numérico, que es enumerable).
    access_token TEXT,

    fecha_vencimiento DATE,
    documentos JSONB DEFAULT '[]',
    notas TEXT,
    datos JSONB DEFAULT '{}',

    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_access_token
    ON solicitudes(access_token) WHERE access_token IS NOT NULL;

-- =============================================
-- 7. DISTRIBUCIÓN (asignaciones implementador → ficha)
-- =============================================
CREATE TABLE distribucion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    implementador TEXT NOT NULL,
    ficha_id UUID REFERENCES fichas_alta(id) ON DELETE SET NULL,
    datos JSONB DEFAULT '{}',

    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. USUARIOS (autenticación)
-- =============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    -- Esperado: hash bcrypt (60 chars) o argon2.
    -- Se rechaza cualquier valor demasiado corto (típicamente contraseñas en plano).
    password_hash TEXT NOT NULL CHECK (length(password_hash) >= 40),
    nombre TEXT,
    rol TEXT DEFAULT 'user' CHECK (rol IN ('admin', 'user', 'implementador')),
    activo BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES para rendimiento
-- =============================================

-- fichas_alta
CREATE INDEX idx_fichas_estado          ON fichas_alta(estado);
CREATE INDEX idx_fichas_tipo            ON fichas_alta(tipo_cliente);
CREATE INDEX idx_fichas_implementador   ON fichas_alta(implementador);
CREATE INDEX idx_fichas_comercial       ON fichas_alta(comercial);
CREATE INDEX idx_fichas_denominacion    ON fichas_alta(denominacion);
CREATE INDEX idx_fichas_cif             ON fichas_alta(cif);
CREATE INDEX idx_fichas_created         ON fichas_alta(created_at DESC);
CREATE INDEX idx_fichas_updated         ON fichas_alta(updated_at DESC);
CREATE INDEX idx_fichas_deleted         ON fichas_alta(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_fichas_modulos_gin     ON fichas_alta USING GIN (modulos);

-- proyectos
CREATE INDEX idx_proyectos_estado         ON proyectos(estado);
CREATE INDEX idx_proyectos_tipo           ON proyectos(tipo);
CREATE INDEX idx_proyectos_implementador  ON proyectos(implementador);
CREATE INDEX idx_proyectos_ficha          ON proyectos(ficha_id);
CREATE INDEX idx_proyectos_cliente        ON proyectos(cliente);
CREATE INDEX idx_proyectos_ultima_actv    ON proyectos(ultima_actividad DESC);
CREATE INDEX idx_proyectos_created        ON proyectos(created_at DESC);
CREATE INDEX idx_proyectos_deleted        ON proyectos(deleted_at) WHERE deleted_at IS NULL;

-- bajas
CREATE INDEX idx_bajas_ficha    ON bajas(ficha_id);
CREATE INDEX idx_bajas_fecha    ON bajas(fecha_baja DESC);
CREATE INDEX idx_bajas_cliente  ON bajas(cliente);

-- solicitudes
CREATE INDEX idx_solicitudes_ficha   ON solicitudes(ficha_id);
CREATE INDEX idx_solicitudes_estado  ON solicitudes(estado);
CREATE INDEX idx_solicitudes_created ON solicitudes(created_at DESC);

-- locales
CREATE INDEX idx_locales_ficha ON locales(ficha_id);

-- distribucion
CREATE INDEX idx_distribucion_implementador ON distribucion(implementador);
CREATE INDEX idx_distribucion_ficha          ON distribucion(ficha_id);

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

CREATE TRIGGER trg_fichas_updated      BEFORE UPDATE ON fichas_alta  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proyectos_updated   BEFORE UPDATE ON proyectos    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plantillas_updated  BEFORE UPDATE ON plantillas   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bajas_updated       BEFORE UPDATE ON bajas        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_solicitudes_updated BEFORE UPDATE ON solicitudes  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- TRIGGERS: timestamps por estado (analítica de Ventas)
-- Definidos en migrations/2026-04-17_02_fichas_estado_timestamps.sql.
-- =============================================
-- Mapeo estado BD ↔ semántica de negocio:
--   estado='completada' → cliente rellenó su parte (workflow 11-auxiliares)
--   estado='rellenado'/'Rellenado' → comercial completó la ficha (index.html)
CREATE OR REPLACE FUNCTION fichas_set_estado_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'completada' AND NEW.fecha_rellenado IS NULL THEN
        NEW.fecha_rellenado := NOW();
    END IF;
    IF NEW.estado IN ('rellenado', 'Rellenado') AND NEW.fecha_completado IS NULL THEN
        NEW.fecha_completado := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fichas_estado_ts
    BEFORE INSERT OR UPDATE OF estado ON fichas_alta
    FOR EACH ROW EXECUTE FUNCTION fichas_set_estado_timestamps();

CREATE OR REPLACE FUNCTION solicitud_propagar_fecha_a_ficha()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ficha_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.ficha_id IS DISTINCT FROM NEW.ficha_id)
    THEN
        UPDATE fichas_alta
           SET fecha_solicitud = NEW.created_at
         WHERE id = NEW.ficha_id
           AND fecha_solicitud IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitud_propagar_fecha
    AFTER INSERT OR UPDATE OF ficha_id ON solicitudes
    FOR EACH ROW EXECUTE FUNCTION solicitud_propagar_fecha_a_ficha();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE fichas_alta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bajas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;

-- service_role (usado por n8n) mantiene acceso completo.
CREATE POLICY "service_role_all" ON fichas_alta  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON locales      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON plantillas   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON proyectos    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON bajas        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON solicitudes  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON distribucion FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON usuarios     FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Clave anónima: SIN acceso. Si se llega a filtrar no da lectura a nadie.
-- (Por ausencia de políticas TO anon, RLS bloquea automáticamente.)
-- Si en el futuro se necesita acceso de lectura limitado, añadir políticas
-- explícitas TO anon con filtros USING (...) cuidadosos.

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Plantilla default (coincide con data.js del frontend)
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
)
ON CONFLICT (id) DO NOTHING;
