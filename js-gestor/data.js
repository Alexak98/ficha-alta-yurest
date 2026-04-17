// ==========================================
// DATA LAYER - Gestor de Proyectos
// ==========================================

const STORAGE_KEY = 'gestor_proyectos_v3';
// Lista de IDs de proyectos borrados localmente que el backend todavía no ha
// confirmado como eliminados. Actúa de red de seguridad: si la propagación
// del soft-delete (deleted_at) falla o se demora, igualmente filtramos esos
// proyectos en el cliente. Se limpian automáticamente cuando el backend deja
// de devolverlos.
const STORAGE_KEY_ELIMINADOS = 'gestor_proyectos_eliminados_v1';

// ==========================================
// WEBHOOK ENDPOINTS (desde config.js centralizado)
// ==========================================

const _YC = (typeof window !== 'undefined' && window.YurestConfig) ? window.YurestConfig : null;
if (!_YC) {
    console.error('[gestor] config.js no está cargado — el gestor requiere YurestConfig');
}

const WEBHOOK_BASE                  = _YC ? _YC.WEBHOOK_BASE              : 'https://n8n-soporte.data.yurest.dev/webhook';
const WEBHOOK_PROYECTOS             = _YC ? _YC.ENDPOINTS.proyectos       : `${WEBHOOK_BASE}/proyectos`;
const WEBHOOK_PROYECTOS_TAREA       = _YC ? _YC.ENDPOINTS.proyectosTarea  : `${WEBHOOK_BASE}/proyectos/tarea`;
const WEBHOOK_PROYECTOS_TAREA_MOVER = _YC ? _YC.ENDPOINTS.proyectosTareaMover : `${WEBHOOK_BASE}/proyectos/tarea/mover`;
const WEBHOOK_ALTAS                 = _YC ? _YC.ENDPOINTS.altas           : `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`;
const WEBHOOK_ASANA_PROXY           = _YC ? _YC.ENDPOINTS.asanaTasks      : `${WEBHOOK_BASE}/asana/tasks`;
const WEBHOOK_CALENDAR              = _YC ? _YC.ENDPOINTS.calendar        : `${WEBHOOK_BASE}/calendar/event`;

const IMPLEMENTADORES = _YC ? _YC.IMPLEMENTADORES : [
    'Carlos Aparicio',
    'Mario Labrandero',
    'Hugo Zalazar',
    'Rino Luigi'
];

const TIPOS_PROYECTO = [
    'Planes',
    'Corporate sin cocina',
    'Corporate con cocina'
];

const ESTADOS_PROYECTO = ['activo', 'completado', 'pausado'];

// Secciones fijas basadas en la estructura de Asana
const SECCIONES = [
    'Puesta en Marcha / Finalización',
    'Hardware',
    'Carga de Datos Yuload',
    'Planificación de sesiones',
    'Módulos terminados de implementar'
];

// Tareas plantilla para "Planificación de sesiones"
const SESIONES_PLANTILLA = [
    'Planificacion',
    'Sesión de Bienvenida',
    'Modulo Compras',
    'Modulo Cocina',
    'Modulo Stock',
    'Modulo Financiero',
    'Modulo Checklist',
    'Modulo APPCC',
    'Modulo Auditorias',
    'Modulo Comunicación',
    'Modulo RRHH',
    'Modulo Cocina Produccion',
    'Modulo Almacén Central',
    'Modulo Gestor documental',
    'Módulo Analítica de ventas',
    'Módulo Dashboard dinamicos',
    'Módulo Firmas Digitales',
    'Sesiones Extra'
];

// Sesiones base que se incluyen siempre (no dependen de módulos contratados)
const SESIONES_BASE = new Set([
    'Planificacion',
    'Sesión de Bienvenida',
    'Sesiones Extra'
]);

// Mapa: nombre de sesión → nombre del módulo (tal como se guarda en `Módulos`
// desde el formulario de la ficha). Las sesiones de `SESIONES_BASE` no figuran
// aquí porque siempre se incluyen.
const SESION_A_MODULO = {
    'Modulo Compras':              'Compras',
    'Modulo Cocina':               'Cocina',
    'Modulo Stock':                'Stock',
    'Modulo Financiero':           'Finanzas',
    'Modulo Checklist':            'Checklists',
    'Modulo APPCC':                'APPCC',
    'Modulo Auditorias':           'Auditorías',
    'Modulo Comunicación':         'Comunicación y averías',
    'Modulo RRHH':                 'RRHH',
    'Modulo Cocina Produccion':    'Cocina de Producción',
    'Modulo Almacén Central':      'Almacén Central',
    'Modulo Gestor documental':    'Gestor Documental',
    'Módulo Analítica de ventas':  'Analítica de Ventas',
    'Módulo Dashboard dinamicos':  'Paneles BI (Dashboards Dinámicos)',
    'Módulo Firmas Digitales':     'Firma Digital'
};

// Normaliza un string de módulo para comparación tolerante (sin acentos,
// minúsculas, sin espacios extremos).
function _normalizarModulo(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// Devuelve el subconjunto de SESIONES_PLANTILLA que corresponde a los módulos
// realmente contratados. Siempre incluye las sesiones base (Planificación,
// Bienvenida, Sesiones Extra). Si `modulos` es null/undefined, devuelve la
// plantilla completa (comportamiento legacy para datos de ejemplo).
function filtrarSesionesPorModulos(modulos) {
    if (modulos == null) return SESIONES_PLANTILLA.slice();
    const arr = Array.isArray(modulos) ? modulos
              : typeof modulos === 'string'
                ? modulos.split(/[,;|]/)
                : [];
    const contratados = new Set(arr.map(_normalizarModulo).filter(Boolean));
    return SESIONES_PLANTILLA.filter(nombre => {
        if (SESIONES_BASE.has(nombre)) return true;
        const mod = SESION_A_MODULO[nombre];
        if (!mod) return false;
        return contratados.has(_normalizarModulo(mod));
    });
}

// Tareas plantilla para "Puesta en Marcha / Finalización"
const TAREAS_PUESTA_EN_MARCHA = [
    'Llamada de contacto',
    'Creación de Grupo Whatsapp',
    'Eliminar grupo de Whatsapp'
];

// Tareas plantilla para "Carga de Datos Yuload"
const TAREAS_CARGA_DATOS = [
    'Carga - Cliente - OCR - Corp'
];


const COLORES_IMPLEMENTADOR = {
    'Carlos Aparicio': '#4F46E5',
    'Mario Labrandero': '#059669',
    'Hugo Zalazar': '#D97706',
    'Rino Luigi': '#DC2626'
};

const INICIALES_IMPLEMENTADOR = {
    'Carlos Aparicio': 'CA',
    'Mario Labrandero': 'ML',
    'Hugo Zalazar': 'HZ',
    'Rino Luigi': 'RL'
};

function generarId() {
    if (_YC && typeof _YC.generarId === 'function') return _YC.generarId();
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}

// Crea la estructura de secciones con tareas para un nuevo proyecto.
// `modulosContratados` (opcional): array de nombres de módulos tal como se
// guardan en la ficha (`Módulos`). Cuando se proporciona, la sección
// "Planificación de sesiones" sólo incluirá las sesiones correspondientes a
// los módulos contratados (más las sesiones base: Planificación, Bienvenida,
// Sesiones Extra). Si se omite, se incluyen todas las sesiones (legacy).
function crearEstructuraProyecto(modulosContratados) {
    const sesionesActivas = filtrarSesionesPorModulos(modulosContratados);
    return SECCIONES.map(seccion => {
        let tareas = [];
        if (seccion === 'Planificación de sesiones') {
            tareas = sesionesActivas.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null, // null = sin asignar, 'Show', 'No Show'
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: '',
                subtareas: []
            }));
        } else if (seccion === 'Puesta en Marcha / Finalización') {
            tareas = TAREAS_PUESTA_EN_MARCHA.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null,
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: '',
                subtareas: []
            }));
        } else if (seccion === 'Carga de Datos Yuload') {
            tareas = TAREAS_CARGA_DATOS.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null,
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: '',
                subtareas: []
            }));
        }
        return {
            nombre: seccion,
            tareas
        };
    });
}

// Helper para crear un proyecto rápido con datos
function crearProyectoEjemplo(cliente, implementador, tipo, estado, fechaInicio, ultimaActividad, progreso) {
    const s = crearEstructuraProyecto();
    const ses = s.find(x => x.nombre === 'Planificación de sesiones');
    const pm = s.find(x => x.nombre === 'Puesta en Marcha / Finalización');

    // Marcar tareas de puesta en marcha como completadas si hay progreso
    if (progreso.pmCompletadas) {
        for (let i = 0; i < Math.min(progreso.pmCompletadas, pm.tareas.length); i++) {
            pm.tareas[i].completada = true;
            pm.tareas[i].show = 'Show';
        }
    }

    // Marcar sesiones completadas
    if (progreso.sesCompletadas) {
        for (let i = 0; i < Math.min(progreso.sesCompletadas, ses.tareas.length); i++) {
            ses.tareas[i].completada = true;
            ses.tareas[i].show = 'Show';
            ses.tareas[i].tiempoEstimado = [60, 90, 60, 90, 60, 45, 60, 90, 60, 45, 60, 90, 60, 45, 60, 90, 60, 45][i];
        }
    }

    // Marcar próximas sesiones con Show
    if (progreso.sesShow) {
        const start = progreso.sesCompletadas || 0;
        for (let i = start; i < Math.min(start + progreso.sesShow, ses.tareas.length); i++) {
            ses.tareas[i].show = 'Show';
            ses.tareas[i].tiempoEstimado = 60;
        }
    }

    // Marcar No Show
    if (progreso.sesNoShow) {
        const start = (progreso.sesCompletadas || 0) + (progreso.sesShow || 0);
        for (let i = start; i < Math.min(start + progreso.sesNoShow, ses.tareas.length); i++) {
            ses.tareas[i].show = 'No Show';
        }
    }

    // Marcar proyecto finalizado
    if (estado === 'completado') {
        pm.tareas.forEach(t => { t.completada = true; });
    }

    return {
        id: generarId(),
        cliente,
        implementador,
        tipo,
        estado,
        fechaInicio,
        ultimaActividad: ultimaActividad || fechaInicio,
        secciones: s
    };
}

const DATOS_EJEMPLO = [
    // === AVANZANDO ===
    crearProyectoEjemplo('Hotel Mediterráneo', 'Carlos Aparicio', 'Corporate con cocina', 'activo', '2026-03-01', '2026-04-07', { pmCompletadas: 2, sesCompletadas: 2, sesShow: 2, sesNoShow: 1 }),
    crearProyectoEjemplo('Restaurante La Brasa', 'Mario Labrandero', 'Planes', 'activo', '2026-02-15', '2026-04-05', { pmCompletadas: 1, sesCompletadas: 1, sesShow: 1 }),
    crearProyectoEjemplo('Cadena Gastro Plus', 'Hugo Zalazar', 'Corporate sin cocina', 'activo', '2026-01-10', '2026-04-02', { pmCompletadas: 3, sesCompletadas: 6, sesShow: 1 }),
    crearProyectoEjemplo('Trattoria Bella', 'Rino Luigi', 'Corporate con cocina', 'activo', '2026-03-10', '2026-04-08', { pmCompletadas: 2, sesCompletadas: 3, sesShow: 2 }),
    crearProyectoEjemplo('Grupo Norte', 'Carlos Aparicio', 'Corporate sin cocina', 'activo', '2026-02-20', '2026-04-06', { pmCompletadas: 3, sesCompletadas: 8, sesShow: 1 }),
    crearProyectoEjemplo('La Esquina Gourmet', 'Mario Labrandero', 'Corporate con cocina', 'activo', '2026-03-05', '2026-04-04', { pmCompletadas: 2, sesCompletadas: 4, sesShow: 2 }),
    crearProyectoEjemplo('Sushi Palace', 'Hugo Zalazar', 'Planes', 'activo', '2026-03-15', '2026-04-03', { pmCompletadas: 1, sesCompletadas: 2, sesShow: 1 }),

    // === TERMINADOS ===
    crearProyectoEjemplo('Café Central', 'Carlos Aparicio', 'Planes', 'completado', '2025-11-01', '2026-01-15', { pmCompletadas: 3, sesCompletadas: 18 }),
    crearProyectoEjemplo('Pizzería Don Mario', 'Mario Labrandero', 'Corporate con cocina', 'completado', '2025-10-01', '2026-02-10', { pmCompletadas: 3, sesCompletadas: 18 }),
    crearProyectoEjemplo('Grupo Alimentos SA', 'Hugo Zalazar', 'Corporate sin cocina', 'completado', '2025-09-15', '2026-01-20', { pmCompletadas: 3, sesCompletadas: 18 }),
    crearProyectoEjemplo('El Fogón Criollo', 'Rino Luigi', 'Planes', 'completado', '2025-12-01', '2026-03-01', { pmCompletadas: 3, sesCompletadas: 18 }),

    // === PARADOS ===
    crearProyectoEjemplo('Da Capo Pizza', 'Hugo Zalazar', 'Corporate con cocina', 'pausado', '2025-12-01', '2026-02-12', { pmCompletadas: 1, sesCompletadas: 1, sesNoShow: 2 }),
    crearProyectoEjemplo('Francina', 'Carlos Aparicio', 'Corporate sin cocina', 'pausado', '2025-11-15', '2026-02-05', { pmCompletadas: 2, sesCompletadas: 2, sesNoShow: 1 }),
    crearProyectoEjemplo('Banco de Boquerones', 'Hugo Zalazar', 'Planes', 'pausado', '2026-01-05', '2026-03-12', { pmCompletadas: 1, sesCompletadas: 3, sesNoShow: 1 }),
    crearProyectoEjemplo('A Napule', 'Mario Labrandero', 'Corporate con cocina', 'pausado', '2025-12-20', '2026-02-26', { pmCompletadas: 2, sesCompletadas: 4, sesNoShow: 2 }),
    crearProyectoEjemplo('Grupo Sabores', 'Rino Luigi', 'Corporate con cocina', 'pausado', '2026-02-01', '2026-03-05', { pmCompletadas: 1, sesCompletadas: 1, sesNoShow: 1 }),
    crearProyectoEjemplo('Crepnova', 'Mario Labrandero', 'Corporate sin cocina', 'pausado', '2025-12-10', '2026-02-19', { pmCompletadas: 1, sesCompletadas: 5, sesNoShow: 1 }),
    crearProyectoEjemplo('Tu Arrocero', 'Hugo Zalazar', 'Corporate con cocina', 'pausado', '2026-02-10', '2026-03-26', { pmCompletadas: 2, sesCompletadas: 6, sesNoShow: 2 }),
    crearProyectoEjemplo('Gottan Grill', 'Hugo Zalazar', 'Planes', 'pausado', '2025-11-20', '2026-02-19', { pmCompletadas: 1, sesCompletadas: 5, sesNoShow: 1 }),
    crearProyectoEjemplo('Romeo', 'Carlos Aparicio', 'Corporate con cocina', 'pausado', '2025-10-15', '2026-01-29', { pmCompletadas: 2, sesCompletadas: 6, sesNoShow: 2 }),
    crearProyectoEjemplo('Grupo Nola', 'Mario Labrandero', 'Corporate sin cocina', 'pausado', '2026-01-15', '2026-03-05', { pmCompletadas: 1, sesCompletadas: 7 }),

    // === INICIO / SIN DATOS ===
    crearProyectoEjemplo('Delicias Express', 'Mario Labrandero', 'Corporate sin cocina', 'activo', '2026-03-20', '2026-03-20', { pmCompletadas: 0 }),
    crearProyectoEjemplo('Sabor Andino', 'Hugo Zalazar', 'Planes', 'activo', '2026-04-01', '2026-04-01', { pmCompletadas: 0 }),
    crearProyectoEjemplo('Bar El Clásico', 'Carlos Aparicio', 'Corporate con cocina', 'activo', '2026-04-05', '2026-04-05', { pmCompletadas: 0 }),
];

// ==========================================
// API HELPER
// ==========================================

function getAuthHeaders() {
    if (_YC) return _YC.getAuthHeaders();
    // Fallback si config.js no cargó
    const session = JSON.parse(sessionStorage.getItem('yurest_auth') || '{}');
    const headers = { 'Content-Type': 'application/json' };
    if (session.basicAuth) headers['Authorization'] = 'Basic ' + session.basicAuth;
    return headers;
}

async function apiRequest(url, method = 'GET', body = null) {
    const opts = { method, headers: getAuthHeaders() };
    if (body !== null) opts.body = JSON.stringify(body);

    // Preferimos apiFetch para que maneje 401/403 automáticamente
    const res = _YC
        ? await _YC.apiFetch(url, opts)
        : await fetch(url, opts);

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Error ${res.status}${text ? ': ' + text : ''}`);
    }
    try { return await res.json(); } catch (_) { return {}; }
}

// ==========================================
// STORAGE / API FUNCTIONS
// ==========================================

async function cargarProyectos() {
    try {
        const data = await apiRequest(WEBHOOK_PROYECTOS, 'GET');
        let lista = Array.isArray(data) ? data
            : Array.isArray(data.proyectos) ? data.proyectos
            : Array.isArray(data.data) ? data.data : [];
        // Aplicar tombstones locales: si borramos un proyecto y el backend
        // aún lo devuelve (latencia/fallo en el soft-delete), lo filtramos
        // aquí para mantener consistencia de UI.
        const eliminados = obtenerProyectosEliminadosLocal();
        if (eliminados.size > 0) {
            const idsBackend = new Set(lista.map(p => p && p.id).filter(Boolean));
            lista = lista.filter(p => !eliminados.has(p && p.id));
            // Limpiar lápidas que el backend ya no devuelve (eliminación
            // confirmada): purga IDs que ya no están en la respuesta.
            purgarTombstonesConfirmados(idsBackend);
        }
        return migrarProyectos(lista);
    } catch (err) {
        console.warn('Error cargando proyectos del backend:', err.message);
        mostrarToast('No se pudo conectar al backend.', 'warning');
        return [];
    }
}

// ──────────────────────────────────────────────────────────
// Tombstones locales para proyectos eliminados
// ──────────────────────────────────────────────────────────
function obtenerProyectosEliminadosLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ELIMINADOS);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) { return new Set(); }
}

function marcarProyectoEliminadoLocal(id) {
    if (!id) return;
    try {
        const set = obtenerProyectosEliminadosLocal();
        set.add(id);
        localStorage.setItem(STORAGE_KEY_ELIMINADOS, JSON.stringify([...set]));
    } catch (_) { /* sin localStorage: ignorar */ }
}

// Si el backend ya no devuelve un proyecto que tenemos en lápidas, significa
// que el soft-delete realmente se aplicó: podemos retirar la lápida.
function purgarTombstonesConfirmados(idsBackend) {
    try {
        const set = obtenerProyectosEliminadosLocal();
        if (set.size === 0) return;
        const restantes = [...set].filter(id => idsBackend.has(id));
        if (restantes.length === set.size) return;
        localStorage.setItem(STORAGE_KEY_ELIMINADOS, JSON.stringify(restantes));
    } catch (_) {}
}

// Parsea campos JSONB que vienen como string desde Supabase
function parseJSONBField(val, fallback) {
    if (val == null) return fallback;
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (_) { return fallback; }
    }
    return fallback;
}

// Elimina secciones que ya no existen en SECCIONES (ej: "Desarrollos" eliminada)
function migrarProyectos(lista) {
    const seccionesValidas = new Set(SECCIONES);
    lista.forEach(p => {
        // Parsear campos JSONB que Supabase puede devolver como string
        p.secciones = parseJSONBField(p.secciones, []);
        p.contactos = parseJSONBField(p.contactos, []);
        p.adjuntos = parseJSONBField(p.adjuntos, []);

        if (Array.isArray(p.secciones)) {
            p.secciones = p.secciones.filter(s => s && seccionesValidas.has(s.nombre));
        } else {
            p.secciones = [];
        }
        if (!p.participantes) p.participantes = [];
        if (!p.contactos) p.contactos = [];
        if (!p.anotaciones) p.anotaciones = '';
        if (!p.adjuntos) p.adjuntos = [];
        if (!p.tpv) p.tpv = '';
        if (!p.motivoPausa) p.motivoPausa = '';
        if (!p.planAccion) p.planAccion = '';
        // Normalizar campos Asana (snake_case desde Supabase → camelCase usado en UI)
        if (p.asana_project_id && !p.asanaProjectId) p.asanaProjectId = p.asana_project_id;
        if (p.asana_project_url && !p.asanaProjectUrl) p.asanaProjectUrl = p.asana_project_url;
        if (!p.asanaProjectId) p.asanaProjectId = '';
        if (!p.asanaProjectUrl) p.asanaProjectUrl = p.asanaProjectId ? `https://app.asana.com/0/${p.asanaProjectId}/list` : '';
    });
    return lista;
}

function guardarProyectosLocal(proyectos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proyectos));
}

async function crearProyectoAPI(proyecto) {
    const result = await apiRequest(WEBHOOK_PROYECTOS, 'POST', { proyecto });
    return result;
}

async function actualizarProyectoAPI(proyecto) {
    const result = await apiRequest(WEBHOOK_PROYECTOS, 'PUT', { proyecto });
    return result;
}

async function eliminarProyectoAPI(id) {
    const result = await apiRequest(WEBHOOK_PROYECTOS, 'DELETE', { id });
    return result;
}

async function actualizarTareaAPI(proyectoId, seccionNombre, tarea) {
    const result = await apiRequest(WEBHOOK_PROYECTOS_TAREA, 'PUT', {
        proyectoId,
        seccionNombre,
        tarea
    });
    return result;
}

async function moverTareaAPI(proyectoId, tareaId, seccionOrigen, seccionDestino) {
    const result = await apiRequest(WEBHOOK_PROYECTOS_TAREA_MOVER, 'PUT', {
        proyectoId, tareaId, seccionOrigen, seccionDestino
    });
    return result;
}

async function resetearDatosAPI() {
    try {
        // Enviar todos los datos ejemplo al backend
        await apiRequest(WEBHOOK_PROYECTOS + '/reset', 'POST', { proyectos: DATOS_EJEMPLO });
    } catch (err) {
        console.warn('Error reseteando en backend:', err.message);
    }
    localStorage.removeItem(STORAGE_KEY);
    return DATOS_EJEMPLO;
}

// ==========================================
// ASANA PROXY & ANOTACIONES
// ==========================================

async function obtenerTareasAsana(asanaProjectId) {
    if (!asanaProjectId) return [];
    try {
        const data = await apiRequest(`${WEBHOOK_ASANA_PROXY}?projectId=${encodeURIComponent(asanaProjectId)}`, 'GET');
        return Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
    } catch (err) {
        console.warn('Error obteniendo tareas Asana:', err.message);
        return [];
    }
}

async function actualizarAnotacionesAPI(proyectoId, anotaciones) {
    return await apiRequest(`${WEBHOOK_PROYECTOS}/anotaciones`, 'PUT', { proyectoId, anotaciones });
}

async function crearEventoCalendarAPI(data) {
    return await apiRequest(WEBHOOK_CALENDAR, 'POST', data);
}

// Obtiene la fecha mas reciente de subtareas (ultima sesion agendada)
function obtenerUltimaSesionAgendada(proyecto) {
    let maxFecha = null;
    proyecto.secciones.forEach(sec => {
        sec.tareas.forEach(tarea => {
            if (tarea.fechaEntrega) {
                if (!maxFecha || tarea.fechaEntrega > maxFecha) maxFecha = tarea.fechaEntrega;
            }
            if (tarea.subtareas) {
                tarea.subtareas.forEach(sub => {
                    if (sub.fechaEntrega) {
                        if (!maxFecha || sub.fechaEntrega > maxFecha) maxFecha = sub.fechaEntrega;
                    }
                });
            }
        });
    });
    return maxFecha;
}

// Obtiene la fecha mas reciente de subtareas COMPLETADAS
function obtenerUltimaSubtareaCompletada(proyecto) {
    let maxFecha = null;
    proyecto.secciones.forEach(sec => {
        sec.tareas.forEach(tarea => {
            if (tarea.subtareas) {
                tarea.subtareas.forEach(sub => {
                    if (sub.completada && sub.fechaEntrega) {
                        if (!maxFecha || sub.fechaEntrega > maxFecha) maxFecha = sub.fechaEntrega;
                    }
                });
            }
        });
    });
    return maxFecha;
}

// Normaliza un nombre de cliente para comparación (sin acentos, minúsculas, trim,
// espacios colapsados). Usar en deduplicación cruzada entre proyectos y altas.
function normalizarNombreCliente(nombre) {
    return String(nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // quitar diacríticos
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

// Normaliza datos de una ficha de alta
function normalizarAlta(f) {
    const get = (keys) => {
        for (const k of keys) {
            const val = f[k];
            if (val != null && val !== '') return String(val).trim();
        }
        return '';
    };
    const nombre = get(['Denominación Social', 'Denominacion Social', 'denominacion', 'Nombre Sociedad']);
    const comercial = get(['Nombre Comercial', 'nombreComercial', 'nombre_comercial', 'Nombre']);
    const tipo = get(['Tipo Cliente', 'Tipo de Cliente', 'tipoCliente', 'tipo_cliente']);
    const implementador = get(['Implementador', 'implementador']);
    const id = get(['ID', 'id']);
    const fecha = get(['Fecha', 'fecha', 'created_at']);
    const estado = get(['Estado', 'estado']);
    const tpv = get(['TPV', 'tpv']);

    // Módulos contratados (si vienen) — se preservan para que al crear el
    // proyecto sólo se generen las sesiones de los módulos realmente
    // contratados.
    const rawMods = f['Módulos'] || f['modulos'] || f.modulos || '';
    const modulos = Array.isArray(rawMods)
        ? rawMods.map(m => String(m).trim()).filter(Boolean)
        : String(rawMods).split(/[,;|]/).map(m => m.trim()).filter(Boolean);

    let tipoNorm = 'Corporate sin cocina';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('lite') || tipoLower.includes('planes') || tipoLower === 'planes') {
        tipoNorm = 'Planes';
    } else if (tipoLower.includes('corporate') || tipoLower.includes('corp')) {
        if (modulos.join(',').toLowerCase().includes('cocina')) tipoNorm = 'Corporate con cocina';
    }

    return {
        altaId: id,
        nombre: nombre || comercial,
        nombreComercial: comercial,
        tipo: tipoNorm,
        tipoOriginal: tipo,
        implementador: IMPLEMENTADORES.includes(implementador) ? implementador : '',
        fecha,
        estado,
        tpv,
        modulos
    };
}

// ==========================================
// HELPERS
// ==========================================

// Determina el estado derivado del proyecto para el dashboard
function obtenerEstadoDashboard(proyecto) {
    if (proyecto.estado === 'completado') return 'terminado';
    if (proyecto.estado === 'pausado') return 'pausado';

    // Para activos, verificar si tiene sesiones completadas
    const resumen = obtenerResumenProyecto(proyecto);
    if (resumen.sesionesCompletadas > 0) return 'avanzando';
    return 'inicio';
}

// Calcula semanas parado desde ultimaActividad (comparación a día, sin horas)
function calcularSemanasParado(proyecto) {
    if (!proyecto.ultimaActividad) return null;
    // Normalizar ambas fechas a medianoche local para no depender de la hora actual
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const partes = proyecto.ultimaActividad.split('-');
    if (partes.length !== 3) return null;
    const ultima = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    const diffDias = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));
    const diffSemanas = Math.floor(diffDias / 7);
    return diffSemanas > 0 ? diffSemanas : null;
}

// Cuenta sesiones pendientes (no completadas) en Planificación de sesiones
function contarSesionesPendientes(proyecto) {
    const seccion = proyecto.secciones.find(s => s.nombre === 'Planificación de sesiones');
    if (!seccion) return 0;
    return seccion.tareas.filter(t => !t.completada).length;
}

// Genera estadísticas del dashboard
function generarEstadisticasDashboard(proyectos) {
    const totales = { total: proyectos.length, pausados: 0, avanzando: 0, terminados: 0, inicio: 0, totalPendientes: 0, sesionesAgendadas: 0, sesionesSinAgendar: 0 };
    const porImplementador = {};

    IMPLEMENTADORES.forEach(impl => {
        porImplementador[impl] = { total: 0, pausados: 0, avanzando: 0, terminados: 0, inicio: 0, pendientes: 0 };
    });

    const clientesPausados = [];

    proyectos.forEach(p => {
        const estadoDash = obtenerEstadoDashboard(p);
        const pendientes = contarSesionesPendientes(p);
        const impl = p.implementador;

        totales.totalPendientes += pendientes;

        // Contar subtareas agendadas/sin agendar
        p.secciones.forEach(sec => {
            sec.tareas.forEach(tarea => {
                if (tarea.subtareas) {
                    tarea.subtareas.forEach(sub => {
                        if (sub.fechaEntrega) totales.sesionesAgendadas++;
                        else totales.sesionesSinAgendar++;
                    });
                }
            });
        });

        const keyMap = { pausado: 'pausados', avanzando: 'avanzando', terminado: 'terminados', inicio: 'inicio' };
        const statsKey = keyMap[estadoDash] || estadoDash;

        if (porImplementador[impl]) {
            porImplementador[impl].total++;
            porImplementador[impl].pendientes += pendientes;
            porImplementador[impl][statsKey]++;
        }

        totales[statsKey]++;

        if (estadoDash === 'pausado') {
            clientesPausados.push({
                cliente: p.cliente,
                implementador: p.implementador,
                pendientes,
                semanasPausado: calcularSemanasParado(p),
                id: p.id
            });
        }
    });

    // Ordenar pausados por pendientes descendente
    clientesPausados.sort((a, b) => b.pendientes - a.pendientes);

    return { totales, porImplementador, clientesPausados };
}

// Calcula dias laborables entre dos fechas (excluye sabados y domingos)
function calcularDiasLaborables(fechaInicioStr, fechaFinStr) {
    const inicio = new Date(fechaInicioStr + 'T00:00:00');
    const fin = new Date(fechaFinStr + 'T00:00:00');
    if (isNaN(inicio) || isNaN(fin) || fin <= inicio) return 0;
    let dias = 0;
    const current = new Date(inicio);
    while (current <= fin) {
        const dow = current.getDay();
        if (dow !== 0 && dow !== 6) dias++;
        current.setDate(current.getDate() + 1);
    }
    return dias;
}

function calcularMediana(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function calcularMedia(arr) {
    if (arr.length === 0) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

// Genera estadisticas de duracion media de implementaciones
function generarEstadisticasDuracion(proyectos) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const porTipo = {};
    const porImpl = {};
    const todosDias = [];

    proyectos.forEach(p => {
        if (!p.fechaInicio) return;
        // Para completados usar ultimaActividad, para el resto usar hoy
        const fechaFin = p.estado === 'completado' && p.ultimaActividad ? p.ultimaActividad : hoyStr;
        const dias = calcularDiasLaborables(p.fechaInicio, fechaFin);
        if (dias <= 0) return;

        todosDias.push(dias);

        // Por tipo
        if (!porTipo[p.tipo]) porTipo[p.tipo] = { dias: [], count: 0 };
        porTipo[p.tipo].dias.push(dias);
        porTipo[p.tipo].count++;

        // Por implementador
        if (!porImpl[p.implementador]) porImpl[p.implementador] = { dias: [], count: 0 };
        porImpl[p.implementador].dias.push(dias);
        porImpl[p.implementador].count++;
    });

    const mediaGlobal = calcularMedia(todosDias);
    const medianaGlobal = calcularMediana(todosDias);

    const tiposStats = Object.entries(porTipo).map(([tipo, data]) => {
        const mediana = calcularMediana(data.dias);
        return {
            tipo,
            count: data.count,
            mediaDias: calcularMedia(data.dias),
            mediaSem: calcularMedia(data.dias.map(d => d / 5)),
            medianaDias: mediana,
            medianaSem: Math.round((mediana / 5) * 10) / 10
        };
    }).sort((a, b) => b.mediaDias - a.mediaDias);

    const implStats = Object.entries(porImpl).map(([impl, data]) => ({
        impl,
        count: data.count,
        mediaDias: calcularMedia(data.dias),
        mediaSem: calcularMedia(data.dias.map(d => d / 5))
    })).sort((a, b) => b.mediaDias - a.mediaDias);

    return {
        totalAnalizados: todosDias.length,
        mediaGlobal,
        mediaGlobalSem: Math.round(mediaGlobal / 5 * 10) / 10,
        medianaGlobal,
        medianaGlobalSem: Math.round(medianaGlobal / 5 * 10) / 10,
        porTipo: tiposStats,
        porImplementador: implStats
    };
}

// Mueve una tarea de una seccion a otra dentro del mismo proyecto
function moverTareaEntreSecciones(proyecto, tareaId, seccionOrigenNombre, seccionDestinoNombre) {
    if (seccionOrigenNombre === seccionDestinoNombre) return false;
    const origen = proyecto.secciones.find(s => s.nombre === seccionOrigenNombre);
    const destino = proyecto.secciones.find(s => s.nombre === seccionDestinoNombre);
    if (!origen || !destino) return false;
    const idx = origen.tareas.findIndex(t => t.id === tareaId);
    if (idx === -1) return false;
    const [tarea] = origen.tareas.splice(idx, 1);
    destino.tareas.push(tarea);
    return true;
}

function obtenerResumenProyecto(proyecto) {
    let totalTareas = 0;
    let tareasCompletadas = 0;
    let totalSesiones = 0;
    let sesionesCompletadas = 0;
    let sesionesShow = 0;
    let sesionesNoShow = 0;

    proyecto.secciones.forEach(seccion => {
        seccion.tareas.forEach(tarea => {
            totalTareas++;
            if (tarea.completada) tareasCompletadas++;
            // Contar subtareas
            if (tarea.subtareas && tarea.subtareas.length > 0) {
                tarea.subtareas.forEach(sub => {
                    totalTareas++;
                    if (sub.completada) tareasCompletadas++;
                });
            }
        });

        if (seccion.nombre === 'Planificación de sesiones') {
            seccion.tareas.forEach(tarea => {
                totalSesiones++;
                if (tarea.completada) sesionesCompletadas++;
                if (tarea.show === 'Show') sesionesShow++;
                if (tarea.show === 'No Show') sesionesNoShow++;
            });
        }
    });

    return {
        totalTareas,
        tareasCompletadas,
        progreso: totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0,
        totalSesiones,
        sesionesCompletadas,
        sesionesShow,
        sesionesNoShow
    };
}
