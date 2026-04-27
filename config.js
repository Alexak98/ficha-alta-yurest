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

        // Pedidos de hardware por proyecto — ciclo solicitada → proforma →
        // pago → lista_envío. Se consume desde proyecto.Hardware (crear),
        // contabilidad.Proformas (adjuntar PDF / confirmar) y soporte
        // Hardware envíos (ver proforma lista).
        hardwarePedidos:      `${WEBHOOK_BASE}/hardware/pedidos`,

        // Stock de hardware (departamento Soporte): catálogo de artículos
        // con stock actual, mínimo para alertas, precios y movimientos
        // (entradas / salidas / ajustes). Acciones: create, update,
        // archivar, reactivar, movimiento.
        hardwareStock:        `${WEBHOOK_BASE}/hardware/stock`,

        // Presupuestos (departamento Producto): desarrollos a medida por
        // cliente, con quién paga, estado de aprobación y de entrega.
        // Reemplaza el Excel que usaba Producto.
        presupuestos:         `${WEBHOOK_BASE}/presupuestos`,

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
        proyectoHistorial:    `${WEBHOOK_BASE}/proyectos/historial`,

        // Mapa de calor de tickets Zendesk: GET con ?from=YYYY-MM-DD&to=YYYY-MM-DD.
        // Devuelve los tickets creados en el rango (esperamos created_at o,
        // pre-agregado, una matriz [day_of_week 0-6][hour 0-23] con counts).
        zendeskTicketsHeatmap: `${WEBHOOK_BASE}/zendesk/tickets-heatmap`,

        // Escalados de clientes (departamento Comercial): ampliaciones
        // contractuales sobre clientes existentes (módulos nuevos o nuevos
        // locales). GET lista los registros, POST crea uno nuevo en estado
        // 'pendiente'. La aplicación real sobre fichas/locales/sepa la hace
        // un workflow n8n cuando el escalado se confirma.
        escalados:            `${WEBHOOK_BASE}/escalados`,

        // Customer Success Kanban: POST para mover un cliente entre
        // columnas del seguimiento (en_implementacion → post_primer_mes →
        // …). Actualiza fichas_alta.cs_estado y registra en
        // cs_estado_historial. El listado de clientes con su cs_estado se
        // sirve desde el endpoint `altas` (workflow 04 ya devuelve la columna).
        csEstado:             `${WEBHOOK_BASE}/cs-estado`
    };

    // Permisos disponibles (IDs de página). Debe coincidir con el CHECK de la
    // tabla usuarios en la migración 2026-04-21_01_usuarios.sql.
    const PERMISOS_DISPONIBLES = [
        { id: 'ventas',          label: 'Ventas',                  grupo: 'Informes'         },
        { id: 'distribucion',    label: 'Implementadores',         grupo: 'Informes'         },
        { id: 'informe_tickets', label: 'Mapa de calor de tickets', grupo: 'Informes'        },
        { id: 'lista',         label: 'Fichas de cliente',    grupo: 'Comercial'        },
        { id: 'escalados',     label: 'Escalados de clientes', grupo: 'Comercial'       },
        { id: 'sinasignar',    label: 'Sin asignar',          grupo: 'Implementación'   },
        { id: 'proyectos',     label: 'Proyectos',            grupo: 'Implementación'   },
        { id: 'contabilidad',  label: 'Grabar en A3',         grupo: 'Contabilidad'     },
        { id: 'proformas',     label: 'Solicitud de proformas', grupo: 'Contabilidad'   },
        { id: 'clientes',      label: 'Clientes',             grupo: 'Customer Success' },
        { id: 'cs_kanban',     label: 'Kanban CS',             grupo: 'Customer Success' },
        { id: 'bajas',         label: 'Bajas',                grupo: 'Customer Success' },
        { id: 'promociones',   label: 'Promociones',          grupo: 'Customer Success' },
        { id: 'presupuestos',  label: 'Presupuestos',         grupo: 'Producto'         },
        { id: 'integraciones', label: 'Integraciones',        grupo: 'Soporte'          },
        { id: 'hardware',      label: 'Hardware envíos',      grupo: 'Soporte'          },
        { id: 'stock',         label: 'Stock hardware',       grupo: 'Soporte'          },
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

    // Indicador global de peticiones en curso. Se inyecta una sola vez
    // en cualquier página que use apiFetch y se muestra/oculta según el
    // contador de fetches activos. No requiere markup en cada HTML.
    let _inflightCount = 0;
    function _ensureInflightEl() {
        if (typeof document === 'undefined') return null;
        let el = document.getElementById('yurest-inflight');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'yurest-inflight';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = [
            'position:fixed', 'right:18px', 'bottom:18px', 'z-index:9999',
            'display:none', 'align-items:center', 'gap:8px',
            'padding:8px 14px', 'border-radius:999px',
            'background:rgba(15,23,42,.92)', 'color:#fff',
            // Fuente corporativa Bw Modelica (cargada vía fonts.css/style.css);
            // si por algún motivo no estuviera disponible, los fallbacks system
            // mantienen legibilidad sin romper layout.
            "font:600 12px 'Bw Modelica', system-ui, -apple-system, sans-serif",
            'letter-spacing:.02em',
            'box-shadow:0 6px 18px rgba(15,23,42,.18)',
            'pointer-events:none', 'transition:opacity .18s'
        ].join(';');
        el.innerHTML =
            '<span style="display:inline-block;width:14px;height:14px;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:yurest-spin .7s linear infinite"></span>' +
            '<span id="yurest-inflight-txt">Cargando…</span>';
        // Inyectamos la animación una vez.
        if (!document.getElementById('yurest-inflight-style')) {
            const st = document.createElement('style');
            st.id = 'yurest-inflight-style';
            st.textContent = '@keyframes yurest-spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(st);
        }
        const attach = () => { if (document.body) document.body.appendChild(el); };
        if (document.body) attach();
        else document.addEventListener('DOMContentLoaded', attach, { once: true });
        return el;
    }
    function _bumpInflight(delta) {
        _inflightCount = Math.max(0, _inflightCount + delta);
        const el = _ensureInflightEl();
        if (!el) return;
        if (_inflightCount > 0) {
            const txt = document.getElementById('yurest-inflight-txt');
            if (txt) txt.textContent = _inflightCount === 1
                ? 'Cargando…'
                : 'Cargando · ' + _inflightCount + ' peticiones';
            el.style.display = 'inline-flex';
            el.style.opacity = '1';
        } else {
            el.style.opacity = '0';
            // Pequeño delay antes de ocultar para evitar parpadeos al
            // encadenar peticiones rápidas.
            setTimeout(() => { if (_inflightCount === 0) el.style.display = 'none'; }, 180);
        }
    }

    // Fetch con:
    //   · manejo automático de 401/403 → redirige a login,
    //   · contador global de peticiones en vuelo (indicador "Cargando…"),
    //   · deduplicación de GETs idénticos en vuelo (varios consumidores
    //     piden la misma URL y se hace UNA sola llamada de red),
    //   · timeout duro de 30s para que el indicador no se quede colgado
    //     si n8n tarda eternamente.
    const _inflightGet = new Map(); // url → Promise<Response>
    const FETCH_TIMEOUT_MS = 30000;

    function _abortAfter(ms) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
        return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
    }

    async function _doFetchTracked(url, opts) {
        _bumpInflight(+1);
        const t = _abortAfter(FETCH_TIMEOUT_MS);
        // No pisamos un AbortSignal pasado por el caller — si lo pasó, lo
        // respetamos; si no, usamos el nuestro de timeout.
        const finalOpts = { ...opts, signal: opts.signal || t.signal };
        try {
            const res = await fetch(url, finalOpts);
            if (res.status === 401 || res.status === 403) {
                clearSession();
                window.location.replace('login.html');
                throw new Error('Sesión expirada');
            }
            return res;
        } catch (err) {
            // Mensaje legible para timeout (DOMException de AbortError).
            if (err && (err.name === 'AbortError' || /timeout/i.test(String(err.message || '')))) {
                throw new Error('La petición tardó más de ' + (FETCH_TIMEOUT_MS / 1000) + 's y se canceló');
            }
            throw err;
        } finally {
            t.cancel();
            _bumpInflight(-1);
        }
    }

    async function apiFetch(url, options) {
        const opts = { ...(options || {}) };
        opts.headers = { ...getAuthHeaders(), ...(opts.headers || {}) };
        const method = String(opts.method || 'GET').toUpperCase();

        // Solo deduplicamos GETs (los POST/PATCH son acciones, no idempotentes
        // a nivel de respuesta). Si llega un GET con AbortSignal propio del
        // caller no podemos compartir promesa, así que tampoco se dedupe.
        if (method !== 'GET' || opts.signal) {
            return _doFetchTracked(url, opts);
        }

        const key = method + ' ' + url;
        if (_inflightGet.has(key)) {
            // Hay una petición idéntica en vuelo — devolvemos un clon de su
            // Response para que cada consumidor pueda leer el body con
            // .json()/.text() de forma independiente.
            return _inflightGet.get(key).then(r => r.clone());
        }
        const p = _doFetchTracked(url, opts);
        _inflightGet.set(key, p);
        // Liberar la entrada al terminar (éxito o fallo) para que un fetch
        // posterior vuelva a hit a red.
        p.finally(() => { _inflightGet.delete(key); });
        return p.then(r => r.clone());
    }

    function cerrarSesion() {
        // Pedimos confirmación — varios usuarios reportaron clicks accidentales
        // sobre el botón del sidebar tras venir del menú. confirm() nativo
        // basta porque la acción no requiere fricción extra (solo evitar
        // los falsos positivos por dedazo).
        if (!window.confirm('¿Cerrar sesión?')) return;
        clearSession();
        window.location.replace('login.html');
    }

    // ──────────────────────────────────────────────────────────
    //  UTILIDADES COMUNES
    // ──────────────────────────────────────────────────────────

    // Formatea una fecha para los listados de UI con un par de modos
    // estandarizados — antes cada página tenía su propio toLocaleDateString
    // con opciones distintas (mezcla de "23 abr 2026" y "23/04/2026" y
    // "Sábado, 23 de abril..."), lo que rompía la consistencia visual de
    // las tablas. Ahora todo el portal pasa por aquí.
    //
    // Modos:
    //   'short'    → "23 abr 2026"           (default — listados generales)
    //   'numeric'  → "23/04/2026"            (tablas densas, columnas estrechas)
    //   'datetime' → "23 abr 2026, 13:45"    (auditoría, audit log, timestamps)
    //   'long'     → "sábado, 23 de abril de 2026"  (encabezados destacados)
    //
    // Devuelve '—' si la entrada es null/undefined/'' o no parsea como
    // fecha válida — el listado nunca debería pintar "Invalid Date".
    function formatDate(v, modo) {
        if (v == null || v === '') return '—';
        const d = (v instanceof Date) ? v : new Date(v);
        if (isNaN(d.getTime())) return '—';
        const m = modo || 'short';
        if (m === 'numeric') {
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        if (m === 'datetime') {
            return d.toLocaleString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
        if (m === 'long') {
            return d.toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
        }
        // 'short' (default)
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }

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

    // a11yAbrirModal(overlayId, modalId?)
    //   overlayId — id del fondo (.modal-overlay). Si modalId no se pasa,
    //               busca .modal/[role="dialog"] DENTRO del overlay.
    //   modalId   — id del contenedor del modal cuando vive como hermano
    //               del overlay (patrón usado en escalados.html y otras
    //               páginas donde el aside.modal flota a top-level).
    function a11yAbrirModal(overlayId, modalId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        const modal = (modalId && document.getElementById(modalId))
                   || overlay.querySelector('.modal, [role="dialog"]')
                   || overlay;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        // Marcar aria-hidden en el resto de la página, EXCEPTO el overlay
        // y el modal real (que puede vivir como hermano del overlay, no
        // dentro). Si lo escondemos, los lectores no leerán nada.
        document.querySelectorAll('body > *').forEach(el => {
            if (el === overlay || el === modal) return;
            if (el.contains(overlay) || el.contains(modal)) return;
            el.setAttribute('data-a11y-hidden-before', el.getAttribute('aria-hidden') || '');
            el.setAttribute('aria-hidden', 'true');
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
    //  TOMBSTONES LOCALES DE FICHAS BORRADAS
    // ──────────────────────────────────────────────────────────
    // Cuando borramos una ficha con el workflow 10 (soft-delete por
    // deleted_at), a veces hay una ventana entre que la BD confirma el
    // UPDATE y PostgREST refresca su snapshot → el endpoint /altas
    // vuelve a devolverla momentáneamente. Consecuencia visible: el
    // badge "Sin asignar" se queda en 1 aunque la ficha ya no existe en
    // la vista actual. Para blindarlo, guardamos localmente los IDs
    // borrados y los filtramos en todos los consumers de /altas hasta
    // que la BD deje de enviarlos.
    //
    // Mismo patrón que STORAGE_KEY_ELIMINADOS usa el gestor de proyectos.
    const STORAGE_KEY_FICHAS_TOMBSTONE = 'yurest_fichas_eliminadas_v1';

    function _leerTombstonesFichas() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_FICHAS_TOMBSTONE);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch (_) { return new Set(); }
    }
    function marcarFichaEliminada(id) {
        if (!id) return;
        const set = _leerTombstonesFichas();
        set.add(String(id));
        try { localStorage.setItem(STORAGE_KEY_FICHAS_TOMBSTONE, JSON.stringify([...set])); }
        catch (_) { /* quota: no crítico */ }
    }
    // Filtra un array de fichas crudas de /altas retirando las que están
    // en el tombstone. El tombstone NO se auto-purga — si el backend
    // vuelve a devolver la ficha es síntoma de que el soft-delete falló
    // en BD, y auto-purgar ocultaría el problema sin resolverlo. El
    // tombstone solo se limpia al ejecutar YurestConfig.limpiarTombstonesFichas()
    // manualmente desde la consola.
    function aplicarTombstonesFichas(rawFichas) {
        const tomb = _leerTombstonesFichas();
        if (tomb.size === 0) return rawFichas || [];
        return (rawFichas || []).filter(f => !tomb.has(String(f.id || f.ID || '')));
    }
    function limpiarTombstonesFichas() {
        try { localStorage.removeItem(STORAGE_KEY_FICHAS_TOMBSTONE); return true; }
        catch (_) { return false; }
    }

    // Diagnóstico: devuelve en consola la lista de fichas que el badge
    // cuenta como "sin asignar" con toda la info útil (id, nombre, estado,
    // deleted_at). Úsalo así desde la consola del navegador:
    //    await YurestConfig.debugSinAsignar();
    // Si ves fichas con deleted_at=null que crees haber borrado, el
    // soft-delete no se aplicó en BD y hay que revisar el workflow 10.
    async function debugSinAsignar() {
        const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
        const urlAltas = ENDPOINTS.altas + (ENDPOINTS.altas.includes('?') ? '&' : '?') + '_=' + Date.now();
        const urlProy  = ENDPOINTS.proyectos + (ENDPOINTS.proyectos.includes('?') ? '&' : '?') + '_=' + Date.now();
        const [resAltas, resProy] = await Promise.all([
            apiFetch(urlAltas, { method: 'GET', headers }),
            apiFetch(urlProy,  { method: 'GET', headers }).catch(() => null)
        ]);
        if (!resAltas || !resAltas.ok) { console.error('[debug] /altas HTTP', resAltas && resAltas.status); return; }
        const dataAltas = await resAltas.json();
        const raw = Array.isArray(dataAltas) ? dataAltas
            : Array.isArray(dataAltas.clientes) ? dataAltas.clientes
            : Array.isArray(dataAltas.data) ? dataAltas.data : [];
        let listaProy = [];
        if (resProy && resProy.ok) {
            const dataProy = await resProy.json();
            listaProy = Array.isArray(dataProy) ? dataProy
                : Array.isArray(dataProy.proyectos) ? dataProy.proyectos
                : Array.isArray(dataProy.data) ? dataProy.data : [];
            listaProy = listaProy.filter(p => p && !p.deleted_at);
        }
        const proyectosCache = JSON.parse(localStorage.getItem('gestor_proyectos_v3') || '[]');
        const existentesNorm = new Set(listaProy.map(p => _normNombre(p.cliente)));
        const tomb = _leerTombstonesFichas();
        console.log('=== [debug] Sin asignar ===');
        console.log('Fichas totales devueltas por /altas:', raw.length);
        console.log('Proyectos del backend (/proyectos):', listaProy.map(p => ({ id: p.id, cliente: p.cliente, estado: p.estado })));
        console.log('Proyectos en caché local (localStorage):', proyectosCache.map(p => p.cliente));
        console.log('Tombstones locales:', [...tomb]);
        const sinAsignar = raw.filter(a => {
            const id = String(a.id || a.ID || '');
            if (tomb.has(id)) return false;
            const nombre = _extraerNombreFicha(a);
            if (!nombre) return false;
            return !existentesNorm.has(_normNombre(nombre));
        });
        console.table(sinAsignar.map(a => ({
            id: a.id || a.ID,
            nombre: _extraerNombreFicha(a),
            estado: a.estado || a['Estado'] || '',
            deleted_at: a.deleted_at || null,
            created_at: a.created_at || null
        })));
        return sinAsignar;
    }

    // Helpers compartidos con el badge para que la lógica esté centralizada.
    function _extraerNombreFicha(a) {
        return (
            a['Denominación Social'] || a['Denominacion Social'] || a.denominacion ||
            a['Nombre Sociedad']      || a['Nombre Comercial']     || a.nombreComercial ||
            a.Nombre || ''
        ).toString().trim();
    }
    function _normNombre(n) {
        return String(n || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
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

            // Cache-bust para evitar que el navegador devuelva respuestas
            // viejas tras borrar una ficha.
            const urlAltas = ENDPOINTS.altas + (ENDPOINTS.altas.includes('?') ? '&' : '?') + '_=' + Date.now();
            const headers = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };

            // Fetch en PARALELO de fichas y proyectos. Antes leíamos
            // proyectos solo desde localStorage['gestor_proyectos_v3'],
            // que es un caché que solo rellena proyectos.html. Si el
            // usuario no había pasado por ahí, el caché estaba vacío
            // y el badge contaba CUALQUIER ficha como "sin asignar",
            // incluidas las que en realidad sí tienen proyecto.
            const urlProy  = ENDPOINTS.proyectos + (ENDPOINTS.proyectos.includes('?') ? '&' : '?') + '_=' + Date.now();
            const [resAltas, resProy] = await Promise.all([
                apiFetch(urlAltas, { method: 'GET', headers }),
                apiFetch(urlProy,  { method: 'GET', headers })
            ]);
            if (!resAltas.ok) return;
            const dataAltas = await resAltas.json();
            const rawInicial = Array.isArray(dataAltas) ? dataAltas
                : Array.isArray(dataAltas.clientes) ? dataAltas.clientes
                : Array.isArray(dataAltas.data) ? dataAltas.data : [];
            const raw = aplicarTombstonesFichas(rawInicial);

            // Lista de clientes con proyecto activo (del backend). Si la
            // llamada al endpoint de proyectos falla, caemos al caché local
            // como fallback y loggeamos el problema en consola.
            let clientesConProy = [];
            if (resProy && resProy.ok) {
                const dataProy = await resProy.json();
                const listaProy = Array.isArray(dataProy) ? dataProy
                    : Array.isArray(dataProy.proyectos) ? dataProy.proyectos
                    : Array.isArray(dataProy.data) ? dataProy.data : [];
                clientesConProy = listaProy
                    .filter(p => p && !p.deleted_at)
                    .map(p => p.cliente);
            } else {
                console.warn('[badge] /proyectos no disponible, usando caché local.');
                const cache = JSON.parse(localStorage.getItem('gestor_proyectos_v3') || '[]');
                clientesConProy = cache.map(p => p.cliente);
            }

            const existentes = new Set(clientesConProy.map(_normNombre));
            const count = raw.filter(a => {
                const nombre = _extraerNombreFicha(a);
                return nombre && !existentes.has(_normNombre(nombre));
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
        marcarFichaEliminada,
        aplicarTombstonesFichas,
        limpiarTombstonesFichas,
        debugSinAsignar,
        actualizarBadgeA3,
        a11yAbrirModal,
        a11yCerrarModal,
        logHistorial,
        getHistorial,
        logProyectoHistorial,
        getProyectoHistorial,
        computeDiff,
        formatDate
    };
})(window);
