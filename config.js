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

        // Integraciones externas
        asanaTasks:           `${WEBHOOK_BASE}/asana/tasks`,
        asanaStories:         `${WEBHOOK_BASE}/asana/task/stories`,
        calendar:             `${WEBHOOK_BASE}/calendar/event`,

        // Formulario público (cliente rellena desde email)
        responderSolicitud:   `${WEBHOOK_BASE}/6da4274f-5a6d-4981-a92a-f9d7eb734144`,

        // Notificación cuando el comercial completa la ficha → dispara
        // email Drive al cliente + tarea Asana + email integraciones
        // (workflow 19). Antes vivían en el workflow 11 al recibir la
        // solicitud, ahora se difieren hasta que la ficha está lista.
        notificarFichaCompleta: `${WEBHOOK_BASE}/ficha/notificar-completa`,

        // Promociones (Customer Success): tandas de implementación con
        // 16 plazas (8 mañana + 8 tarde). El front lee vía /promociones
        // una vista con la ocupación ya calculada.
        promociones:          `${WEBHOOK_BASE}/promociones`,

        // Contabilidad
        grabadoA3:            `${WEBHOOK_BASE}/yurest-grabado-a3`,

        // Notificaciones automáticas Integraciones
        notifIntConfig:       `${WEBHOOK_BASE}/notif-integraciones/config`,
        notifIntGrupos:       `${WEBHOOK_BASE}/notif-integraciones/grupos`,
        notifIntHistorial:    `${WEBHOOK_BASE}/notif-integraciones/historial`,

        // Auth y gestión de usuarios
        authLogin:            `${WEBHOOK_BASE}/auth/login`,
        authUsuarios:         `${WEBHOOK_BASE}/auth/usuarios`,
        authVerify:           `${WEBHOOK_BASE}/auth/verify`,

        // Historial de acciones (audit log por ficha)
        historial:            `${WEBHOOK_BASE}/historial`,

        // Historial de acciones por proyecto (timeline del gestor)
        proyectoHistorial:    `${WEBHOOK_BASE}/proyectos/historial`
    };

    // Permisos disponibles (IDs de página). Debe coincidir con el CHECK de la
    // tabla usuarios en la migración 2026-04-21_01_usuarios.sql.
    const PERMISOS_DISPONIBLES = [
        { id: 'ventas',        label: 'Ventas',               grupo: 'Informes'         },
        { id: 'distribucion',  label: 'Implementadores',      grupo: 'Informes'         },
        { id: 'lista',         label: 'Fichas de cliente',    grupo: 'Comercial'        },
        { id: 'sinasignar',    label: 'Sin asignar',          grupo: 'Implementación'   },
        { id: 'proyectos',     label: 'Proyectos',            grupo: 'Implementación'   },
        { id: 'contabilidad',  label: 'Grabar en A3',         grupo: 'Contabilidad'     },
        { id: 'clientes',      label: 'Clientes',             grupo: 'Customer Success' },
        { id: 'bajas',         label: 'Bajas',                grupo: 'Customer Success' },
        { id: 'promociones',   label: 'Promociones',          grupo: 'Customer Success' },
        { id: 'integraciones', label: 'Integraciones',        grupo: 'Soporte'          },
        { id: 'admin',         label: 'Administración',       grupo: 'Admin'            },
        { id: 'docs',          label: 'Documentación',        grupo: 'Otros'            }
    ];

    // ──────────────────────────────────────────────────────────
    //  CONSTANTES
    // ──────────────────────────────────────────────────────────
    const SESSION_KEY = 'yurest_auth';
    // Si el usuario marca "Recordar sesión": 30 días en localStorage.
    // Si no: 8 horas en sessionStorage (el comportamiento previo).
    const SESSION_TTL_MS      = 8  * 60 * 60 * 1000;       // 8 horas
    const SESSION_TTL_LONG_MS = 30 * 24 * 60 * 60 * 1000;  // 30 días
    const LAST_USER_KEY = 'yurest_last_user';
    // Bump cuando cambie el shape del payload de sesión. Sesiones con una
    // versión distinta se descartan al recargar (evita que alguien con sesión
    // vieja sin `rol`/`permisos` vea el portal con permisos vacíos).
    const SESSION_VERSION = 2;

    const IMPLEMENTADORES = [
        'Carlos Aparicio',
        'Mario Labrandero',
        'Hugo Zalazar',
        'Rino Luigi'
    ];

    // ──────────────────────────────────────────────────────────
    //  SESIÓN — helpers de autenticación
    // ──────────────────────────────────────────────────────────
    // Devuelve la sesión activa. Busca primero en sessionStorage (sesión
    // efímera, ventana actual) y si no hay, en localStorage (persistente,
    // 30 días, si el usuario marcó "Recordar sesión").
    function getSession() {
        try {
            // Intentar ambas ubicaciones. Si hay sesión en las dos, gana la
            // más reciente.
            const rawS = sessionStorage.getItem(SESSION_KEY);
            const rawL = localStorage.getItem(SESSION_KEY);
            let sessionS = null, sessionL = null;
            try { sessionS = rawS ? JSON.parse(rawS) : null; } catch (_) {}
            try { sessionL = rawL ? JSON.parse(rawL) : null; } catch (_) {}

            const candidates = [sessionS, sessionL].filter(x => x && x.ts);
            if (candidates.length === 0) return null;
            const s = candidates.sort((a, b) => b.ts - a.ts)[0];

            if (s.v !== SESSION_VERSION) {
                // Sesión con shape antiguo → descartamos en AMBOS stores
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_KEY);
                return null;
            }

            const ttl = s.persistent ? SESSION_TTL_LONG_MS : SESSION_TTL_MS;
            if (Date.now() - s.ts > ttl) {
                sessionStorage.removeItem(SESSION_KEY);
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return s;
        } catch (_) {
            return null;
        }
    }

    // Guarda la sesión. Si `data.persistent === true`, se almacena en
    // localStorage (dura 30 días, sobrevive a cerrar el navegador). En
    // caso contrario, sessionStorage (dura hasta cerrar la pestaña + 8 h).
    function setSession(data) {
        const payload = { ...data, ts: Date.now(), v: SESSION_VERSION };
        const raw = JSON.stringify(payload);
        if (data && data.persistent) {
            localStorage.setItem(SESSION_KEY, raw);
            sessionStorage.removeItem(SESSION_KEY);  // no dejar sesión duplicada
        } else {
            sessionStorage.setItem(SESSION_KEY, raw);
            localStorage.removeItem(SESSION_KEY);    // limpiar cualquier persistente vieja
        }
        // Recordar el último username para pre-rellenar el login la próxima
        // vez, aunque NO se marque "Recordar sesión". Sólo guardamos el
        // nombre, nunca la contraseña.
        if (data && (data.username || data.user)) {
            try { localStorage.setItem(LAST_USER_KEY, String(data.username || data.user)); } catch (_) {}
        }
    }

    function clearSession() {
        // Borramos la sesión en ambas ubicaciones. Mantenemos el
        // LAST_USER_KEY intencionalmente para que al volver a entrar el
        // username aparezca pre-rellenado — si el usuario quiere olvidarlo,
        // puede limpiarlo a mano desde el formulario de login.
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('yurest_fichas');
    }

    // Devuelve el último username usado para login (o '' si no hay).
    function getLastUser() {
        try { return localStorage.getItem(LAST_USER_KEY) || ''; } catch (_) { return ''; }
    }
    function forgetLastUser() {
        try { localStorage.removeItem(LAST_USER_KEY); } catch (_) {}
    }

    // Verifica que haya sesión activa. Si se pasa `permisoRequerido` (el ID
    // de la página actual), además comprueba que el usuario tiene acceso —
    // si no lo tiene, lo redirige a home en vez de a login.
    //
    // Además (asíncrono, sin bloquear): valida contra el backend que la
    // sesión no haya sido revocada por un admin. Si `sessions_revoked_at`
    // es más reciente que el snapshot de la sesión, o el usuario está
    // desactivado/borrado, forzamos logout.
    function requireAuth(permisoRequerido) {
        const s = getSession();
        if (!s) {
            window.location.replace('login.html');
            return false;
        }
        if (permisoRequerido && !tienePermiso(permisoRequerido)) {
            try { sessionStorage.setItem('yurest_permiso_denegado', permisoRequerido); } catch (_) {}
            window.location.replace('home.html');
            return false;
        }
        // Validación diferida (no bloqueante): corre en background
        _validateSessionFresh();
        return true;
    }

    // Llama al endpoint /auth/verify para ver si la sesión fue revocada por
    // un admin (cambio de permisos, rol, desactivación o borrado). Si sí,
    // forzamos logout con un aviso. Silencioso si el endpoint falla (red
    // caída, etc.) — no queremos que un fallo transitorio cierre sesiones.
    async function _validateSessionFresh() {
        const s = getSession();
        if (!s || !s.id) return;
        try {
            const url = `${ENDPOINTS.authVerify}?userId=${encodeURIComponent(s.id)}`;
            const res = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
            if (!res.ok) return;  // fallo transitorio: no invalidamos
            const data = await res.json().catch(() => null);
            if (!data) return;

            // Si el backend dice que el usuario no es válido (borrado,
            // desactivado) → forzar logout.
            if (data.ok === false) {
                clearSession();
                try { sessionStorage.setItem('yurest_sesion_revocada', '1'); } catch (_) {}
                window.location.replace('login.html');
                return;
            }

            // Comparar sessions_revoked_at: si el servidor tiene uno más
            // reciente que el snapshot de la sesión, el admin cambió algo.
            const srvTs = data.sessions_revoked_at ? new Date(data.sessions_revoked_at).getTime() : 0;
            const locTs = s.sessions_revoked_at ? new Date(s.sessions_revoked_at).getTime() : 0;
            if (srvTs > locTs) {
                clearSession();
                try { sessionStorage.setItem('yurest_sesion_revocada', '1'); } catch (_) {}
                window.location.replace('login.html');
                return;
            }

            // Si no hubo revocación pero los permisos o el rol cambiaron,
            // actualizamos el snapshot en la sesión en silencio para que la
            // UI refleje los cambios en la próxima carga.
            const permisosNuevos = Array.isArray(data.permisos) ? data.permisos : [];
            const permisosIguales = JSON.stringify([...s.permisos || []].sort()) === JSON.stringify([...permisosNuevos].sort());
            if (data.rol !== s.rol || !permisosIguales) {
                setSession({ ...s, rol: data.rol, permisos: permisosNuevos });
            }
        } catch (_) {
            // Red caída u otro fallo: no hacemos nada
        }
    }

    // Devuelve los permisos del usuario actual. Admin tiene acceso implícito
    // a todo, devolvemos el listado completo para simplificar checks.
    function getPermisos() {
        const s = getSession();
        if (!s) return [];
        if (s.rol === 'admin') return PERMISOS_DISPONIBLES.map(p => p.id);
        return Array.isArray(s.permisos) ? s.permisos : [];
    }

    // Check rápido: ¿el usuario tiene permiso para esta página?
    function tienePermiso(pageId) {
        if (!pageId) return false;
        const s = getSession();
        if (!s) return false;
        if (s.rol === 'admin') return true;            // admin ve todo
        const permisos = Array.isArray(s.permisos) ? s.permisos : [];
        return permisos.includes(pageId);
    }

    // ¿Es admin?
    function esAdmin() {
        const s = getSession();
        return !!(s && s.rol === 'admin');
    }

    // Devuelve info del usuario actual (o null si no hay sesión).
    function getUsuario() {
        const s = getSession();
        if (!s) return null;
        return {
            id:       s.id || null,
            username: s.user || s.username || '',
            nombre:   s.nombre || s.user || '',
            email:    s.email || '',
            rol:      s.rol || 'user',
            permisos: Array.isArray(s.permisos) ? s.permisos : []
        };
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
    //  BADGE "GRABAR EN A3" — pendientes de Contabilidad
    // ──────────────────────────────────────────────────────────
    // Cuenta fichas con mandato SEPA firmado pendientes de grabar en A3.
    // Se llama desde sidebar.js tras renderizar el menú.
    async function actualizarBadgeA3() {
        try {
            const badge = document.getElementById('badge-a3');
            if (!badge) return;
            const res = await apiFetch(ENDPOINTS.altas, { method: 'GET' });
            if (!res.ok) return;
            const data = await res.json();
            const lista = Array.isArray(data) ? data
                : Array.isArray(data.clientes) ? data.clientes
                : Array.isArray(data.data) ? data.data : [];
            const count = lista.filter(f => {
                if (f.grabado_a3) return false;
                const sepaRaw = f.sepa_mandato || f.SEPA;
                if (!sepaRaw) return false;
                let sepa = sepaRaw;
                if (typeof sepa === 'string') {
                    try { sepa = JSON.parse(sepa); } catch (_) { return false; }
                }
                return !!(sepa && sepa.firma_base64);
            }).length;
            badge.textContent = count > 0 ? count : '';
            if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
        } catch (_) { /* silencioso */ }
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
            if (typeof window._actualizarSidebarBadgesGrupos === 'function') window._actualizarSidebarBadgesGrupos();
        } catch (_) { /* silencioso: badge informativo */ }
    }

    // ──────────────────────────────────────────────────────────
    //  HISTORIAL DE ACCIONES (audit log por ficha)
    // ──────────────────────────────────────────────────────────

    // Compara dos valores de cualquier tipo; devuelve true si son equivalentes.
    function _esIgual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a == b;
        if (typeof a !== typeof b) return false;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((x, i) => _esIgual(x, b[i]));
        }
        if (typeof a === 'object') {
            const ka = Object.keys(a), kb = Object.keys(b);
            if (ka.length !== kb.length) return false;
            return ka.every(k => _esIgual(a[k], b[k]));
        }
        return false;
    }

    // Calcula el diff entre dos objetos — devuelve sólo los campos que
    // cambian: { campo: {before, after}, ... }. Los campos en `ignorar`
    // (array) se saltan (útil para timestamps, campos calculados, etc.).
    function computeDiff(before, after, ignorar) {
        const ignoreSet = new Set(Array.isArray(ignorar) ? ignorar : []);
        const diff = {};
        const keys = new Set([
            ...Object.keys(before || {}),
            ...Object.keys(after  || {})
        ]);
        for (const k of keys) {
            if (ignoreSet.has(k)) continue;
            const b = before && before[k];
            const a = after  && after[k];
            if (!_esIgual(b, a)) diff[k] = { before: b, after: a };
        }
        return diff;
    }

    // Registra una entrada en el historial. Fire-and-forget: si falla la
    // petición NO bloqueamos la operación principal, sólo logueamos en
    // consola. Devuelve una promesa por si el caller quiere await.
    //
    // Parámetros:
    //   entry = {
    //     ficha_id, solicitud_id,                    // uno de los dos, obligatorio
    //     accion: 'create'|'update'|'delete'|…,      // obligatorio
    //     descripcion: 'texto legible',
    //     cambios: {campo:{before,after}},
    //     metadata: {...}
    //   }
    //   opts = { actorOverride: {...} }              // para logs del cliente o sistema
    function logHistorial(entry, opts) {
        opts = opts || {};
        const sess = getSession();
        const actor = opts.actorOverride || (sess ? {
            id:     sess.id || null,
            nombre: sess.nombre || sess.user || 'desconocido',
            rol:    sess.rol   || 'user'
        } : { nombre: 'sistema', rol: 'sistema' });

        const body = {
            ficha_id:     entry.ficha_id     || null,
            solicitud_id: entry.solicitud_id || null,
            usuario:      actor,
            accion:       entry.accion,
            descripcion:  entry.descripcion || '',
            cambios:      entry.cambios     || {},
            metadata:     entry.metadata    || {}
        };

        return apiFetch(ENDPOINTS.historial, {
            method: 'POST',
            body: JSON.stringify(body)
        }).catch(err => {
            console.warn('[historial] fallo al registrar acción (no bloqueante):', err && err.message);
            return null;
        });
    }

    // Registra una entrada en el historial del PROYECTO (equivalente a
    // logHistorial pero contra la tabla proyectos_historial). Campos:
    //   { proyecto_id (oblig.), accion, descripcion, cambios, metadata,
    //     seccion_nombre?, tarea_id?, tarea_nombre? }
    function logProyectoHistorial(entry, opts) {
        opts = opts || {};
        const sess = getSession();
        const actor = opts.actorOverride || (sess ? {
            id:     sess.id || null,
            nombre: sess.nombre || sess.user || 'desconocido',
            rol:    sess.rol   || 'user'
        } : { nombre: 'sistema', rol: 'sistema' });
        const body = {
            proyecto_id:    entry.proyecto_id,
            usuario:        actor,
            accion:         entry.accion,
            seccion_nombre: entry.seccion_nombre || null,
            tarea_id:       entry.tarea_id       || null,
            tarea_nombre:   entry.tarea_nombre   || null,
            descripcion:    entry.descripcion    || '',
            cambios:        entry.cambios        || {},
            metadata:       entry.metadata       || {}
        };
        return apiFetch(ENDPOINTS.proyectoHistorial, {
            method: 'POST',
            body: JSON.stringify(body)
        }).catch(err => {
            console.warn('[proyecto-historial] fallo al registrar acción (no bloqueante):', err && err.message);
            return null;
        });
    }

    async function getProyectoHistorial(filter) {
        try {
            const q = new URLSearchParams();
            q.set('proyectoId', filter.proyectoId || filter.proyecto_id || '');
            if (filter && filter.limit)  q.set('limit',  String(filter.limit));
            if (filter && filter.offset) q.set('offset', String(filter.offset));
            const url = ENDPOINTS.proyectoHistorial + '?' + q.toString();
            const res = await apiFetch(url, { method: 'GET' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            return Array.isArray(data.historial) ? data.historial : [];
        } catch (err) {
            console.warn('[proyecto-historial] fallo al leer:', err && err.message);
            return [];
        }
    }

    // Recupera el historial de una ficha. Devuelve un array (o [] si hay
    // error). Úsalo en UI para pintar el timeline.
    async function getHistorial(filter) {
        try {
            const q = new URLSearchParams();
            if (filter && filter.fichaId)     q.set('fichaId',     filter.fichaId);
            if (filter && filter.solicitudId) q.set('solicitudId', filter.solicitudId);
            if (filter && filter.limit)       q.set('limit',       String(filter.limit));
            if (filter && filter.offset)      q.set('offset',      String(filter.offset));
            const url = ENDPOINTS.historial + '?' + q.toString();
            const res = await apiFetch(url, { method: 'GET' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            return Array.isArray(data.historial) ? data.historial : [];
        } catch (err) {
            console.warn('[historial] fallo al leer:', err && err.message);
            return [];
        }
    }

    // ──────────────────────────────────────────────────────────
    //  EXPORTAR
    // ──────────────────────────────────────────────────────────
    global.YurestConfig = {
        WEBHOOK_BASE,
        ENDPOINTS,
        SESSION_KEY,
        SESSION_TTL_MS,
        SESSION_TTL_LONG_MS,
        IMPLEMENTADORES,
        PERMISOS_DISPONIBLES,
        getSession,
        setSession,
        clearSession,
        getLastUser,
        forgetLastUser,
        requireAuth,
        getPermisos,
        tienePermiso,
        esAdmin,
        getUsuario,
        getAuthHeaders,
        apiFetch,
        cerrarSesion,
        escHtml,
        escAttr,
        escJsInAttr,
        generarId,
        actualizarBadgeSinAsignar,
        actualizarBadgeA3,
        a11yAbrirModal,
        a11yCerrarModal,
        logHistorial,
        getHistorial,
        logProyectoHistorial,
        getProyectoHistorial,
        computeDiff
    };
})(window);
