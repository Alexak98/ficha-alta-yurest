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
        calendar:             `${WEBHOOK_BASE}/calendar/event`,

        // Formulario público (cliente rellena desde email)
        responderSolicitud:   `${WEBHOOK_BASE}/6da4274f-5a6d-4981-a92a-f9d7eb734144`
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
        // Solo borramos las claves del dominio auth. Otras claves
        // transitorias (yurest_edit_ficha, yurest_completar_id, etc.)
        // se gestionan desde el código que las creó.
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('yurest_fichas');
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
    //  ACCESIBILIDAD DE MODALES
    // ──────────────────────────────────────────────────────────
    // Los proyectos usan la convención:
    //   <div class="modal-overlay" id="..."> <div class="modal"> ... </div> </div>
    // Esta función:
    //   - pone role="dialog" + aria-modal="true" en el .modal interno,
    //   - marca aria-hidden en el resto de la página para screen readers,
    //   - mueve el foco al primer elemento focusable del modal,
    //   - recuerda el elemento que tenía el foco antes, para devolvérselo al cerrar,
    //   - atrapa Tab dentro del modal mientras esté abierto.
    //
    // Las llamadas a `abrirModal/cerrarModal` ya existentes en el código del proyecto
    // deben delegar aquí. Para no romper nada, exponemos los helpers como opt-in.

    let _previousFocus = null;
    let _trapListener = null;

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function a11yAbrirModal(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        const modal = overlay.querySelector('.modal, [role="dialog"]') || overlay;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-hidden', 'false');
        // Marcar aria-hidden en el resto de la página
        document.querySelectorAll('body > *').forEach(el => {
            if (el !== overlay && !el.contains(overlay)) {
                el.setAttribute('data-a11y-hidden-before', el.getAttribute('aria-hidden') || '');
                el.setAttribute('aria-hidden', 'true');
            }
        });
        _previousFocus = document.activeElement;
        // Foco al primer elemento focusable. Ignoramos readonly/aria-hidden.
        const focusables = [...modal.querySelectorAll(FOCUSABLE)].filter(el =>
            !el.hasAttribute('readonly') &&
            el.offsetParent !== null &&
            el.getAttribute('aria-hidden') !== 'true'
        );
        if (focusables.length) {
            const preferred = focusables.find(el =>
                (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
            ) || focusables[0];
            setTimeout(() => preferred.focus(), 20);
        }
        // Trap de Tab
        _trapListener = (e) => {
            if (e.key !== 'Tab') return;
            const items = [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        };
        document.addEventListener('keydown', _trapListener);
    }

    function a11yCerrarModal(overlayId) {
        const overlay = overlayId ? document.getElementById(overlayId) : null;
        if (overlay) overlay.setAttribute('aria-hidden', 'true');
        // Restaurar aria-hidden previo del resto de la página
        document.querySelectorAll('[data-a11y-hidden-before]').forEach(el => {
            const prev = el.getAttribute('data-a11y-hidden-before');
            if (prev) el.setAttribute('aria-hidden', prev);
            else el.removeAttribute('aria-hidden');
            el.removeAttribute('data-a11y-hidden-before');
        });
        if (_trapListener) {
            document.removeEventListener('keydown', _trapListener);
            _trapListener = null;
        }
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
            setTimeout(() => _previousFocus.focus(), 10);
        }
        _previousFocus = null;
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
        actualizarBadgeSinAsignar,
        a11yAbrirModal,
        a11yCerrarModal
    };
})(window);
