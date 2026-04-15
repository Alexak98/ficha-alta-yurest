// ==========================================
// DATA LAYER - Gestor de Proyectos
// ==========================================

const STORAGE_KEY = 'gestor_proyectos_v3';

// ==========================================
// WEBHOOK ENDPOINTS (n8n backend)
// ==========================================

const WEBHOOK_BASE = 'https://n8n-soporte.data.yurest.dev/webhook';
const WEBHOOK_PROYECTOS = `${WEBHOOK_BASE}/proyectos`;
const WEBHOOK_PROYECTOS_TAREA = `${WEBHOOK_BASE}/proyectos/tarea`;

const IMPLEMENTADORES = [
    'Carlos Aparicio',
    'Mario Labrandero',
    'Hugo Zalazar',
    'Rino Luigi'
];

const TIPOS_PROYECTO = [
    'Planes',
    'Corporate con cocina',
    'Corporate sin cocina'
];

const ESTADOS_PROYECTO = ['activo', 'completado', 'pausado'];

// Secciones fijas basadas en la estructura de Asana
const SECCIONES = [
    'Puesta en Marcha / Finalización',
    'Desarrollos',
    'Hardware',
    'Carga de Datos Yuload',
    'Integraciones',
    'Planificación de sesiones',
    'Módulos terminados de implementar',
    'Desarrollos Finalizados',
    'Proyecto Finalizado'
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

// Tareas plantilla para "Proyecto Finalizado"
const TAREAS_PROYECTO_FINALIZADO = [
    'Proyecto finalizado'
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
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Crea la estructura de secciones con tareas para un nuevo proyecto
function crearEstructuraProyecto() {
    return SECCIONES.map(seccion => {
        let tareas = [];
        if (seccion === 'Planificación de sesiones') {
            tareas = SESIONES_PLANTILLA.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null, // null = sin asignar, 'Show', 'No Show'
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: ''
            }));
        } else if (seccion === 'Puesta en Marcha / Finalización') {
            tareas = TAREAS_PUESTA_EN_MARCHA.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null,
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: ''
            }));
        } else if (seccion === 'Carga de Datos Yuload') {
            tareas = TAREAS_CARGA_DATOS.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null,
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: ''
            }));
        } else if (seccion === 'Proyecto Finalizado') {
            tareas = TAREAS_PROYECTO_FINALIZADO.map(nombre => ({
                id: generarId(),
                nombre,
                completada: false,
                show: null,
                fechaEntrega: null,
                tiempoEstimado: null,
                notas: ''
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
        const fin = s.find(x => x.nombre === 'Proyecto Finalizado');
        fin.tareas[0].completada = true;
        pm.tareas.forEach(t => { t.completada = true; t.show = 'Show'; });
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
    const session = JSON.parse(sessionStorage.getItem('yurest_auth') || '{}');
    const headers = { 'Content-Type': 'application/json' };
    if (session.basicAuth) {
        headers['Authorization'] = 'Basic ' + session.basicAuth;
    }
    return headers;
}

async function apiRequest(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: getAuthHeaders()
    };
    if (body !== null) {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Error ${res.status}${text ? ': ' + text : ''}`);
    }
    try {
        return await res.json();
    } catch (_) {
        return {};
    }
}

// ==========================================
// STORAGE / API FUNCTIONS
// ==========================================

async function cargarProyectos() {
    try {
        const data = await apiRequest(WEBHOOK_PROYECTOS, 'GET');
        const lista = Array.isArray(data) ? data
            : Array.isArray(data.proyectos) ? data.proyectos
            : Array.isArray(data.data) ? data.data : [];
        return lista;
    } catch (err) {
        console.warn('Error cargando proyectos del backend:', err.message);
        mostrarToast('No se pudo conectar al backend.', 'warning');
        return [];
    }
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
// HELPERS
// ==========================================

// Determina el estado derivado del proyecto para el dashboard
function obtenerEstadoDashboard(proyecto) {
    if (proyecto.estado === 'completado') return 'terminado';
    if (proyecto.estado === 'pausado') return 'parado';

    // Para activos, verificar si tiene sesiones completadas
    const resumen = obtenerResumenProyecto(proyecto);
    if (resumen.sesionesCompletadas > 0) return 'avanzando';
    return 'inicio';
}

// Calcula semanas parado desde ultimaActividad
function calcularSemanasParado(proyecto) {
    if (!proyecto.ultimaActividad) return null;
    const hoy = new Date();
    const ultima = new Date(proyecto.ultimaActividad + 'T00:00:00');
    const diffMs = hoy - ultima;
    const diffSemanas = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
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
    const totales = { total: proyectos.length, parados: 0, avanzando: 0, terminados: 0, inicio: 0, totalPendientes: 0 };
    const porImplementador = {};

    IMPLEMENTADORES.forEach(impl => {
        porImplementador[impl] = { total: 0, parados: 0, avanzando: 0, terminados: 0, inicio: 0, pendientes: 0 };
    });

    const clientesParados = [];

    proyectos.forEach(p => {
        const estadoDash = obtenerEstadoDashboard(p);
        const pendientes = contarSesionesPendientes(p);
        const impl = p.implementador;

        totales.totalPendientes += pendientes;

        const keyMap = { parado: 'parados', avanzando: 'avanzando', terminado: 'terminados', inicio: 'inicio' };
        const statsKey = keyMap[estadoDash] || estadoDash;

        if (porImplementador[impl]) {
            porImplementador[impl].total++;
            porImplementador[impl].pendientes += pendientes;
            porImplementador[impl][statsKey]++;
        }

        totales[statsKey]++;

        if (estadoDash === 'parado') {
            clientesParados.push({
                cliente: p.cliente,
                implementador: p.implementador,
                pendientes,
                semanasParado: calcularSemanasParado(p),
                id: p.id
            });
        }
    });

    // Ordenar parados por pendientes descendente
    clientesParados.sort((a, b) => b.pendientes - a.pendientes);

    return { totales, porImplementador, clientesParados };
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
