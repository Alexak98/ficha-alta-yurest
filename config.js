// ============================================================
//  CONFIGURACIÓN CENTRAL — Yurest Portal
//  Única fuente de verdad para endpoints, constantes y helpers
//  de sesión/autenticación compartidos entre todas las páginas.
// ============================================================

(function (global) {
    'use strict';

    // ──────────────────────────────────────────────────────────
    //  BASE URLS
    // ──────────────────────────────────────────────────────────
    const WEBHOOK_BASE = 'https://n8n-soporte.data.yurest.dev/webhook';

    // ──────────────────────────────────────────────────────────
    //  ENDPOINTS — agrupados por dominio
    // ──────────────────────────────────────────────────────────
    const ENDPOINTS = {
        // Autenticación y listado general
        login:                `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`,
        altas:                `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`,

        // Fichas
        guardarFicha:         `${WEBHOOK_BASE}/57e04029-bae4-4124-8c43-c535e831a147`,
        completarFicha:       `${WEBHOOK_BASE}/5a304fcd-ae1d-49e6-92d1-c5a5e007bbfd`,
        eliminarFicha:        `${WEBHOOK_BASE}/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`,

        // Solicitudes
        crearSolicitud:       `${WEBHOOK_BASE}/b0629324-e611-47d4-835f-3ac9bcd4dc9b`,
        listaSolicitudes:     `${WEBHOOK_BASE}/1757fdcc-7fa7-4cb9-93b9-eb8118adaa1e`,
        listaRellenado:       `${WEBHOOK_BASE}/fa16b994-5af1-4368-ba6b-592e633937c3`,
        eliminarSolicitud:    `${WEBHOOK_BASE}/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`,

        // Drive
        getDrive:             `${WEBHOOK_BASE}/2010bb2b-72e9-4bae-afb1-d5a937c59009`,
        docsSubidos:          `${WEBHOOK_BASE}/bdef8517-9b76-4640-8f82-d940fd0ab96b`,

        // Bajas
        bajas:                `${WEBHOOK_BASE}/84f094b2-9e55-448f-8ad9-f28721841873`,
        bajaCliente:          `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaLocal:            `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaModulos:          `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaEditar:           `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
        bajaBorrar:           `${WEBHOOK_BASE}/95d5ed5d-1139-45b9-88c2-3066bc49e45b`,

        // Distribución
        guardarDist:          `${WEBHOOK_BASE}/6d3ed726-c86a-4b86-a2ae-7f07da9630a5`,

        // Gestor de proyectos
        proyectos:            `${WEBHOOK_BASE}/proyectos`,
        proyectosTarea:       `${WEBHOOK_BASE}/proyectos/tarea`,
        proyectosTareaMover:  `${WEBHOOK_BASE}/proyectos/tarea/mover`,
        plantillas:           `${WEBHOOK_BASE}/plantillas`,

        // Integraciones externas
        asanaTasks:           `${WEBHOOK_BASE}/asana/tasks`,
        asanaStories:         `${WEBHOOK_BASE}/asana/task/stories`,
        calendar:             `${WEBHOOK_BASE}/calendar/event`
    };

    // ──────────────────────────────────────────────────────────
    //  CONSTANTES
    // ──────────────────────────────────────────────────────────
    const SESSION_KEY = 'yurest_auth';
    const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

    const IMPLEMENTADORES = [
        'Carlos Aparicio',
        'Mario Labrandero',
        'Hugo Zalazar',
        'Rino Luigi'
    ];

    // ──────────────────────────────────────────────────────────
    //  SESIÓN — helpers de autenticación
    // ──────────────────────────────────────────────────────────
    function getSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (!s || !s.ts) return null;
            if (Date.now() - s.ts > SESSION_TTL_MS) {
                sessionStorage.removeItem(SESSION_KEY);
                return null;
            }
            return s;
        } catch (_) {
            return null;
        }
    }

    function setSession(data) {
        const payload = { ...data, ts: Date.now() };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    }

    function clearSession() {
        sessionStorage.clear();
    }

    function requireAuth() {
        if (!getSession()) {
            window.location.replace('login.html');
            return false;
        }
        return true;
    }

    function getAuthHeaders(extra) {
        const s = getSession();
        const headers = { 'Content-Type': 'application/json', ...(extra || {}) };
        if (s && s.basicAuth) headers['Authorization'] = 'Basic ' + s.basicAuth;
        return headers;
    }

    // Fetch con manejo automático de 401/403 → redirige a login
    async function apiFetch(url, options) {
        const opts = { ...(options || {}) };
        opts.headers = { ...getAuthHeaders(), ...(opts.headers || {}) };
        const res = await fetch(url, opts);
        if (res.status === 401 || res.status === 403) {
            clearSession();
            window.location.replace('login.html');
            throw new Error('Sesión expirada');
        }
        return res;
    }

    function cerrarSesion() {
        clearSession();
        window.location.replace('login.html');
    }

    // ──────────────────────────────────────────────────────────
    //  UTILIDADES COMUNES
    // ──────────────────────────────────────────────────────────

    // Escapa texto para insertar como contenido HTML. Seguro frente a XSS.
    function escHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Escapa texto para un atributo HTML entrecomillado con ". Seguro frente a XSS.
    function escAttr(text) {
        return escHtml(text);
    }

    // Escapa un string para ser inyectado DENTRO de un literal JavaScript
    // entrecomillado con ' dentro de un atributo HTML (p.ej. onclick="foo('...')")
    // No es la opción preferida — mejor usar addEventListener — pero evita romper
    // cuando no queda más remedio.
    function escJsInAttr(text) {
        return String(text == null ? '' : text)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, '\\x27')
            .replace(/"/g, '&quot;')
            .replace(/</g, '\\x3c')
            .replace(/>/g, '\\x3e')
            .replace(/&/g, '&amp;')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    // Genera un ID único usando crypto.randomUUID cuando está disponible
    function generarId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // Fallback razonable
        return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
    }

    // ──────────────────────────────────────────────────────────
    //  BADGE "SIN ASIGNAR" — se usa en varias páginas
    // ──────────────────────────────────────────────────────────
    // Actualiza el <span id="badge-sinasignar"> con el número de fichas
    // de alta que aún no tienen proyecto creado en el gestor.
    async function actualizarBadgeSinAsignar() {
        try {
            const badge = document.getElementById('badge-sinasignar');
            if (!badge) return;
            const res = await apiFetch(ENDPOINTS.altas, { method: 'GET' });
            if (!res.ok) return;
            const data = await res.json();
            const raw = Array.isArray(data) ? data
                : Array.isArray(data.clientes) ? data.clientes
                : Array.isArray(data.data) ? data.data : [];
            const proyectos = JSON.parse(localStorage.getItem('gestor_proyectos_v3') || '[]');
            const existentes = new Set(proyectos.map(x => (x.cliente || '').toLowerCase().trim()));
            const count = raw.filter(a => {
                const nombre = (
                    a['Denominación Social'] || a['Denominacion Social'] || a.denominacion ||
                    a['Nombre Sociedad']      || a['Nombre Comercial']     || a.nombreComercial ||
                    a.Nombre || ''
                ).toString().trim();
                return nombre && !existentes.has(nombre.toLowerCase());
            }).length;
            badge.textContent = count > 0 ? count : '';
        } catch (_) { /* silencioso: badge informativo */ }
    }

    // ──────────────────────────────────────────────────────────
    //  EXPORTAR
    // ──────────────────────────────────────────────────────────
    global.YurestConfig = {
        WEBHOOK_BASE,
        ENDPOINTS,
        SESSION_KEY,
        SESSION_TTL_MS,
        IMPLEMENTADORES,
        getSession,
        setSession,
        clearSession,
        requireAuth,
        getAuthHeaders,
        apiFetch,
        cerrarSesion,
        escHtml,
        escAttr,
        escJsInAttr,
        generarId,
        actualizarBadgeSinAsignar
    };
})(window);
