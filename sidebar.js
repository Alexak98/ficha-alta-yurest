// ============================================================
//  SIDEBAR COMPARTIDO — Yurest Portal
//  Renderiza el menú lateral desde JS para garantizar que las
//  6 páginas que lo usan queden siempre sincronizadas.
//  Se agrupa por departamento: Comercial, Implementación, Soporte.
// ============================================================
(function (global) {
    'use strict';

    // Iconos SVG inline (mismo set que se usaba antes en los HTML)
    const ICON = {
        chevronRight:  '<svg class="sidebar-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
        close:         '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
        informes:      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l3-3 4 4 5-5"/></svg>',
        comercial:     '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>',
        // Implementación → llave inglesa + destornillador (work in progress)
        implementacion:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        // Soporte → auriculares con micrófono (helpdesk)
        soporte:       '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5z"/><path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5z"/></svg>',
        implementadores:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="6" r="2.5"/></svg>',
        fichas:        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        bajas:         '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        sinasignar:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>',
        proyectos:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>',
        integraciones: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
        ventas:        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
        contabilidad:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
        a3:            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        admin:         '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        // Customer Success → corazón con pulso (lealtad + atención al cliente)
        customer:      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        clientes:      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        // Promociones → rejilla 4×4 (las 16 plazas) con un par destacadas.
        promociones:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        hardware:      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
        // Producto → bombilla (ideas/desarrollo)
        producto:      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>',
        // Presupuestos → documento con € (presupuesto financiero)
        presupuestos:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18V11"/><path d="M9 14c0-1 .6-2 3-2s3 1 3 2-1 2-3 2-3 1-3 2 1 2 3 2 3-1 3-2"/></svg>'
    };

    // Estructura del menú. Cada item tiene:
    //   id      — identificador único (el mismo que se pasa a render(activeId)).
    //   href    — destino del link.
    //   label   — texto visible.
    //   icon    — clave dentro de ICON.
    //   badgeId — opcional, id del <span> para badges numéricos.
    const GROUPS = [
        {
            id: 'informes',
            label: 'Informes',
            icon: 'informes',
            items: [
                { id: 'ventas',       href: 'ventas.html',       label: 'Ventas',           icon: 'ventas' },
                { id: 'distribucion', href: 'distribucion.html', label: 'Implementadores', icon: 'implementadores' }
            ]
        },
        {
            id: 'comercial',
            label: 'Comercial',
            icon: 'comercial',
            items: [
                { id: 'lista',  href: 'lista.html',  label: 'Fichas de cliente', icon: 'fichas' }
            ]
        },
        {
            id: 'implementacion',
            label: 'Implementación',
            icon: 'implementacion',
            items: [
                { id: 'sinasignar', href: 'sinasignar.html', label: 'Sin asignar', icon: 'sinasignar', badgeId: 'badge-sinasignar' },
                { id: 'proyectos',  href: 'proyectos.html',  label: 'Proyectos',   icon: 'proyectos' }
            ]
        },
        {
            id: 'contabilidad',
            label: 'Contabilidad',
            icon: 'contabilidad',
            items: [
                { id: 'contabilidad', href: 'contabilidad.html', label: 'Grabar en A3',          icon: 'a3',       badgeId: 'badge-a3' },
                { id: 'proformas',    href: 'proformas.html',    label: 'Solicitud de proformas', icon: 'fichas', badgeId: 'badge-proformas' }
            ]
        },
        {
            id: 'customer',
            label: 'Customer Success',
            icon: 'customer',
            items: [
                { id: 'clientes',    href: 'clientes.html',    label: 'Clientes',    icon: 'clientes'    },
                { id: 'bajas',       href: 'bajas.html',       label: 'Bajas',       icon: 'bajas'       },
                { id: 'promociones', href: 'promociones.html', label: 'Promociones', icon: 'promociones', badgeId: 'badge-promociones' }
            ]
        },
        {
            id: 'producto',
            label: 'Producto',
            icon: 'producto',
            items: [
                { id: 'presupuestos', href: 'presupuestos.html', label: 'Presupuestos', icon: 'presupuestos', badgeId: 'badge-presupuestos' }
            ]
        },
        {
            id: 'soporte',
            label: 'Soporte',
            icon: 'soporte',
            items: [
                { id: 'integraciones', href: 'integraciones.html', label: 'Integraciones',   icon: 'integraciones' },
                { id: 'hardware',      href: 'hardware.html',      label: 'Hardware envíos', icon: 'hardware', badgeId: 'badge-hardware' }
            ]
        },
        {
            id: 'admin',
            label: 'Administración',
            icon: 'admin',
            items: [
                { id: 'admin', href: 'admin.html', label: 'Usuarios y permisos', icon: 'admin' }
            ]
        }
    ];

    // Devuelve el id de grupo al que pertenece el item con id `activeId`.
    function findGroupOf(activeId) {
        for (const g of GROUPS) {
            if (g.items.some(it => it.id === activeId)) return g.id;
        }
        return null;
    }

    // Devuelve una copia de GROUPS con sólo los items que el usuario actual
    // tiene permiso para ver. Grupos sin items visibles se omiten.
    function groupsVisibles() {
        const YC = window.YurestConfig;
        if (!YC || typeof YC.tienePermiso !== 'function') return GROUPS;
        return GROUPS
            .map(g => ({ ...g, items: g.items.filter(it => YC.tienePermiso(it.id)) }))
            .filter(g => g.items.length > 0);
    }

    // Construye el HTML de un item (link dentro de grupo).
    function renderItem(item, activeId) {
        const active = item.id === activeId ? ' active' : '';
        const badge = item.badgeId
            ? ` <span class="sidebar-badge" id="${item.badgeId}"></span>`
            : '';
        return `
            <a href="${item.href}" class="sidebar-item${active}">
                ${ICON[item.icon] || ''}
                ${item.label}${badge}
            </a>`;
    }

    // Construye el HTML de un grupo colapsable.
    function renderGroup(group, activeId, isOpen) {
        const domId = 'sidebar-group-' + group.id;
        const openCls = isOpen ? ' open' : '';
        // Badge agregado al grupo: aparece SOLO cuando el grupo está cerrado
        // (CSS regla más abajo) y muestra la suma de los hijos con badge.
        const childBadgeIds = group.items.map(it => it.badgeId).filter(Boolean);
        const groupBadge = childBadgeIds.length > 0
            ? `<span class="sidebar-group-badge" id="sidebar-group-badge-${group.id}" data-children="${childBadgeIds.join(',')}"></span>`
            : '';
        return `
            <div class="sidebar-group${openCls}" id="${domId}">
                <div class="sidebar-group-header" onclick="document.getElementById('${domId}').classList.toggle('open')">
                    ${ICON[group.icon] || ''}
                    ${group.label}
                    ${groupBadge}
                    ${ICON.chevronRight}
                </div>
                <div class="sidebar-group-children">
                    ${group.items.map(it => renderItem(it, activeId)).join('')}
                </div>
            </div>`;
    }

    // Recorre los grupos y suma los badges hijos para mostrarlos en el padre
    // cuando el grupo está cerrado. Se llama tras cada actualizarBadgeX.
    function actualizarBadgesGrupos() {
        document.querySelectorAll('.sidebar-group-badge').forEach(badge => {
            const ids = (badge.dataset.children || '').split(',').filter(Boolean);
            let total = 0;
            ids.forEach(id => {
                const v = parseInt((document.getElementById(id)?.textContent || '').trim(), 10);
                if (!isNaN(v)) total += v;
            });
            badge.textContent = total > 0 ? total : '';
        });
    }
    // Exponer para llamar desde fuera tras actualizar badges hijos.
    if (typeof window !== 'undefined') window._actualizarSidebarBadgesGrupos = actualizarBadgesGrupos;

    // Renderiza el sidebar completo en el <nav id="sidebar"> de la página actual.
    // `activeId` es el id del item que debe aparecer resaltado (p.ej. 'lista').
    function render(activeId) {
        const nav = document.getElementById('sidebar');
        if (!nav) return;

        const activeGroup = findGroupOf(activeId);
        // Sólo mostramos los grupos/items para los que el usuario tiene permiso
        const visibles = groupsVisibles();

        const html = `
            <div class="sidebar-hd">
                <div class="sidebar-brand">
                    <span class="sidebar-brand-dot"></span>
                    Yurest
                </div>
                <button class="sidebar-close" onclick="closeSidebar()" aria-label="Cerrar menú">✕</button>
            </div>
            <div class="sidebar-label">Navegación</div>
            <a href="home.html" class="sidebar-item" style="margin-bottom:8px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Inicio
            </a>
            <div class="sidebar-label" style="margin-top:4px">Secciones</div>
            ${visibles.map(g => renderGroup(g, activeId, g.id === activeGroup)).join('')}
            <div class="sidebar-ft">
                <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
                    <button onclick="closeSidebar(); window.open('docs/yurest-flow.html','_blank');" title="Esquema visual del funcionamiento" style="background:#fff;border:1.5px solid #e2e8f0;color:#334155;padding:8px 12px;border-radius:10px;font-size:.8rem;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;text-align:left;transition:all .15s">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Esquema de la web
                    </button>
                    <button onclick="closeSidebar(); window.open('docs/yurest-api.html','_blank');" title="Documentación de la API" style="background:#fff;border:1.5px solid #e2e8f0;color:#334155;padding:8px 12px;border-radius:10px;font-size:.8rem;font-weight:600;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;text-align:left;transition:all .15s">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        Documentación API
                    </button>
                </div>
                <button onclick="closeSidebar(); (window.cerrarSesion||YurestConfig.cerrarSesion)();">
                    ${ICON.close}
                    Cerrar sesión
                </button>
            </div>`;

        nav.innerHTML = html;

        // Disparar actualización de los badges informativos del sidebar.
        if (window.YurestConfig && window.YurestConfig.actualizarBadgeSinAsignar) {
            window.YurestConfig.actualizarBadgeSinAsignar();
        }
        if (window.YurestConfig && window.YurestConfig.actualizarBadgeA3) {
            window.YurestConfig.actualizarBadgeA3();
        }
    }

    global.YurestSidebar = { render, GROUPS };
})(window);
