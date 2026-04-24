// ============================================================
//  NOTIFICACIONES — Yurest Portal
//  Campana en la cabecera de todas las páginas (excepto home) con
//  un dropdown de "Cosas por hacer" filtrado por los permisos del
//  usuario. El home usa la misma fuente de datos pero se pinta en
//  línea como sección tras el hero.
// ============================================================
(function (global) {
    'use strict';

    const SVG = {
        bell:
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        sinasignar:
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>',
        a3:
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
        proformas:
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    };

    // Cada tipo declara:
    //   permiso   — debe coincidir con YurestConfig.tienePermiso(id)
    //   resolve() — Promise → { count, href, title, subtitle, icon }
    //   Devolvemos null si count === 0 (no aparece en la lista).
    const SOURCES = [
        {
            id: 'sinasignar',
            permiso: 'sinasignar',
            resolve: async () => {
                const count = await countSinAsignar();
                if (!count) return null;
                return {
                    count,
                    href: 'sinasignar.html',
                    title: 'Fichas sin asignar',
                    subtitle: count === 1 ? '1 ficha pendiente de crear proyecto' : `${count} fichas pendientes de crear proyecto`,
                    icon: SVG.sinasignar,
                    color: '#f59e0b'
                };
            }
        },
        {
            id: 'contabilidad',
            permiso: 'contabilidad',
            resolve: async () => {
                const count = await countGrabarA3();
                if (!count) return null;
                return {
                    count,
                    href: 'contabilidad.html',
                    title: 'Grabar en A3',
                    subtitle: count === 1 ? '1 ficha lista para grabar' : `${count} fichas listas para grabar`,
                    icon: SVG.a3,
                    color: '#0891b2'
                };
            }
        },
        {
            id: 'proformas',
            permiso: 'proformas',
            resolve: async () => {
                const count = await countProformasPendientes();
                if (!count) return null;
                return {
                    count,
                    href: 'proformas.html',
                    title: 'Proformas por hacer',
                    subtitle: count === 1 ? '1 proforma requiere acción' : `${count} proformas requieren acción`,
                    icon: SVG.proformas,
                    color: '#7c3aed'
                };
            }
        },
    ];

    // Fichas sin asignar: reutiliza actualizarBadgeSinAsignar() con un span
    // oculto puente (mismo patrón que home.html).
    async function countSinAsignar() {
        const YC = global.YurestConfig;
        if (!YC || !YC.actualizarBadgeSinAsignar) return 0;
        ensureBadgeEl('badge-sinasignar');
        await YC.actualizarBadgeSinAsignar();
        return readBadge('badge-sinasignar');
    }

    async function countGrabarA3() {
        const YC = global.YurestConfig;
        if (!YC || !YC.actualizarBadgeA3) return 0;
        ensureBadgeEl('badge-a3');
        await YC.actualizarBadgeA3();
        return readBadge('badge-a3');
    }

    // Proformas: no hay helper en config.js, fetcheamos el endpoint y
    // contamos los estados que requieren acción de contabilidad.
    async function countProformasPendientes() {
        const YC = global.YurestConfig;
        if (!YC || !YC.ENDPOINTS || !YC.ENDPOINTS.hardwarePedidos) return 0;
        try {
            const res = await (YC.apiFetch || fetch)(YC.ENDPOINTS.hardwarePedidos, { method: 'GET' });
            if (!res.ok) return 0;
            const data = await res.json();
            const lista = Array.isArray(data) ? data : (data.pedidos || data.data || []);
            return lista.filter(p => p && (p.estado === 'solicitada' || p.estado === 'pendiente_confirmar')).length;
        } catch (_) { return 0; }
    }

    function ensureBadgeEl(id) {
        if (!document.getElementById(id)) {
            const s = document.createElement('span');
            s.id = id;
            s.style.display = 'none';
            document.body.appendChild(s);
        }
    }
    function readBadge(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const n = parseInt((el.textContent || '').trim(), 10);
        return isNaN(n) ? 0 : n;
    }

    // Pide todas las fuentes aplicables según permisos y descarta
    // las que no tengan count. Devuelve en el orden de SOURCES.
    async function fetchAll() {
        const YC = global.YurestConfig;
        const puede = (p) => !YC || typeof YC.tienePermiso !== 'function' ? true : YC.tienePermiso(p);
        const aplicables = SOURCES.filter(s => puede(s.permiso));
        const results = await Promise.all(aplicables.map(s => s.resolve().catch(() => null)));
        return results
            .map((r, i) => r ? { id: aplicables[i].id, ...r } : null)
            .filter(Boolean);
    }

    // ── UI: Campana en page-header ─────────────────────────────
    // Se invoca desde sidebar.js tras render(). Skipea en home
    // (donde la sección "Cosas por hacer" ya vive en el hero).

    let stylesInjected = false;
    function injectStyles() {
        if (stylesInjected) return;
        stylesInjected = true;
        const css = `
            .notif-bell {
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 40px; height: 40px;
                border-radius: 10px;
                background: #fff;
                border: 1.5px solid #e2e8f0;
                color: #334155;
                cursor: pointer;
                transition: all .15s;
                flex-shrink: 0;
            }
            .notif-bell:hover { border-color:#fc5858; color:#fc5858; background:#fff1f1; }
            .notif-bell.has-badge::after {
                content: attr(data-count);
                position: absolute;
                top: -4px; right: -4px;
                min-width: 18px; height: 18px;
                padding: 0 5px;
                background: #fc5858;
                color: #fff;
                border-radius: 999px;
                font-size: 10.5px;
                font-weight: 700;
                line-height: 18px;
                text-align: center;
                box-shadow: 0 0 0 2px #fff;
                font-family: 'Inter', -apple-system, sans-serif;
            }
            .notif-popover {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                width: 340px;
                max-width: calc(100vw - 24px);
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                box-shadow: 0 12px 40px rgba(15, 23, 42, .14);
                z-index: 1000;
                overflow: hidden;
                display: none;
            }
            .notif-popover.open { display: block; }
            .notif-popover-header {
                padding: 14px 16px 10px;
                border-bottom: 1px solid #f1f5f9;
            }
            .notif-popover-title {
                font-size: 13.5px;
                font-weight: 700;
                color: #0f172a;
                letter-spacing: -0.01em;
            }
            .notif-popover-sub {
                font-size: 11.5px;
                color: #64748b;
                margin-top: 2px;
            }
            .notif-popover-list {
                list-style: none;
                margin: 0; padding: 6px;
                max-height: 420px;
                overflow-y: auto;
            }
            .notif-item {
                display: flex;
                gap: 10px;
                padding: 10px 10px;
                border-radius: 10px;
                cursor: pointer;
                text-decoration: none;
                color: inherit;
                transition: background .12s;
                align-items: flex-start;
            }
            .notif-item + .notif-item { margin-top: 2px; }
            .notif-item:hover { background: #f8fafc; }
            .notif-item-icon {
                flex-shrink: 0;
                width: 32px; height: 32px;
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                color: #fff;
            }
            .notif-item-body { flex: 1; min-width: 0; }
            .notif-item-title {
                font-size: 13px;
                font-weight: 600;
                color: #0f172a;
                display: flex; align-items: center; gap: 6px;
            }
            .notif-item-count {
                background: #fef2f2;
                color: #dc2626;
                font-size: 11px;
                font-weight: 700;
                padding: 1px 7px;
                border-radius: 999px;
            }
            .notif-item-sub {
                font-size: 12px;
                color: #64748b;
                margin-top: 2px;
            }
            .notif-empty {
                padding: 24px 16px;
                text-align: center;
                color: #64748b;
                font-size: 13px;
            }
            .notif-loading {
                padding: 20px 16px;
                text-align: center;
                color: #94a3b8;
                font-size: 12px;
            }

            /* "Cosas por hacer" (home) */
            .todo-section {
                margin: 0 0 28px;
                padding: 18px 20px 16px;
                background: #fff;
                border: 1.5px solid #e2e8f0;
                border-radius: 16px;
            }
            .todo-section-header {
                display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 12px;
            }
            .todo-section-title {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
                letter-spacing: -0.01em;
            }
            .todo-section-sub {
                font-size: 12px; color: #64748b;
            }
            .todo-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 10px;
                list-style: none;
                margin: 0; padding: 0;
            }
            .todo-list .notif-item {
                border: 1px solid #f1f5f9;
                background: #fafbfc;
            }
            .todo-list .notif-item:hover { background: #fff; border-color: #fecaca; }
        `;
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function itemHtml(n) {
        return `
            <a class="notif-item" href="${n.href}">
                <span class="notif-item-icon" style="background:${n.color}">${n.icon}</span>
                <span class="notif-item-body">
                    <span class="notif-item-title">${escapeHtml(n.title)}<span class="notif-item-count">${n.count}</span></span>
                    <span class="notif-item-sub">${escapeHtml(n.subtitle)}</span>
                </span>
            </a>`;
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = String(s == null ? '' : s);
        return d.innerHTML;
    }

    // Monta la campana junto al .btn-menu de la cabecera.
    function mountHeaderBell() {
        // No montar en home — tiene su propia sección "Cosas por hacer".
        if (document.body && document.body.dataset && document.body.dataset.page === 'home') return;
        // Si no hay YurestConfig/sesión no hay nada que mostrar.
        if (!global.YurestConfig) return;

        injectStyles();

        const header = document.querySelector('.page-header');
        if (!header) return;
        if (header.querySelector('.notif-bell')) return;  // ya montado

        // Wrapper posicionado para anclar el popover.
        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.style.display = 'inline-flex';
        // Empuja el wrapper a la derecha del header (top-right).
        wrap.style.marginLeft = 'auto';

        const bell = document.createElement('button');
        bell.className = 'notif-bell';
        bell.type = 'button';
        bell.setAttribute('aria-label', 'Notificaciones');
        bell.innerHTML = SVG.bell;

        const pop = document.createElement('div');
        pop.className = 'notif-popover';
        pop.innerHTML = `
            <div class="notif-popover-header">
                <div class="notif-popover-title">Notificaciones</div>
                <div class="notif-popover-sub">Cosas pendientes por hacer</div>
            </div>
            <div class="notif-popover-list" id="notif-popover-list">
                <div class="notif-loading">Cargando…</div>
            </div>
        `;

        wrap.appendChild(bell);
        wrap.appendChild(pop);
        // Apéndice al final del header → queda en la esquina superior derecha
        // (margin-left:auto del wrap empuja a la derecha en flex).
        header.appendChild(wrap);

        let loaded = false;
        let lastItems = [];

        const renderItems = () => {
            const list = pop.querySelector('#notif-popover-list');
            if (!list) return;
            if (lastItems.length === 0) {
                list.innerHTML = `<div class="notif-empty">No tienes nada pendiente</div>`;
            } else {
                list.innerHTML = lastItems.map(itemHtml).join('');
            }
            const total = lastItems.reduce((s, n) => s + (n.count || 0), 0);
            if (total > 0) {
                bell.classList.add('has-badge');
                bell.setAttribute('data-count', total > 99 ? '99+' : String(total));
            } else {
                bell.classList.remove('has-badge');
                bell.removeAttribute('data-count');
            }
        };

        const load = async () => {
            try {
                lastItems = await fetchAll();
            } catch (_) {
                lastItems = [];
            }
            loaded = true;
            renderItems();
        };

        // Precargar para mostrar el contador en la campana sin abrir el dropdown.
        load();

        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = pop.classList.toggle('open');
            if (isOpen && !loaded) load();
        });

        document.addEventListener('click', (e) => {
            if (!pop.classList.contains('open')) return;
            if (wrap.contains(e.target)) return;
            pop.classList.remove('open');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') pop.classList.remove('open');
        });
    }

    // Pinta la sección "Cosas por hacer" dentro de un contenedor (home).
    async function renderInto(container) {
        if (!container) return;
        injectStyles();
        container.innerHTML = `
            <div class="todo-section-header">
                <div class="todo-section-title">Cosas por hacer</div>
                <div class="todo-section-sub" id="todo-section-sub">Cargando…</div>
            </div>
            <ul class="todo-list notif-popover-list" id="todo-list" style="max-height:none;padding:0"></ul>
        `;
        let items = [];
        try { items = await fetchAll(); } catch (_) { items = []; }
        const listEl = container.querySelector('#todo-list');
        const subEl = container.querySelector('#todo-section-sub');
        if (items.length === 0) {
            listEl.outerHTML = `<div class="notif-empty" style="padding:18px 0">No tienes nada pendiente 🎉</div>`;
            if (subEl) subEl.textContent = 'Todo al día';
            return;
        }
        const total = items.reduce((s, n) => s + (n.count || 0), 0);
        if (subEl) subEl.textContent = `${total} ítem${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'}`;
        listEl.innerHTML = items.map(itemHtml).join('');
    }

    global.YurestNotifications = { fetchAll, mountHeaderBell, renderInto };

    // Auto-montaje cuando el DOM esté listo (sidebar.js lo referencia también).
    function autoMount() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mountHeaderBell, { once: true });
        } else {
            mountHeaderBell();
        }
    }
    autoMount();

})(window);
