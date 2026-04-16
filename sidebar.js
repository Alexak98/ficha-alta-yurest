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
        implementacion:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        soporte:       '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
        implementadores:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="6" r="2.5"/></svg>',
        fichas:        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        bajas:         '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
        sinasignar:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>',
        proyectos:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>',
        integraciones: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
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
                { id: 'distribucion', href: 'distribucion.html', label: 'Implementadores', icon: 'implementadores' }
            ]
        },
        {
            id: 'comercial',
            label: 'Comercial',
            icon: 'comercial',
            items: [
                { id: 'lista',  href: 'lista.html',  label: 'Fichas de cliente', icon: 'fichas' },
                { id: 'bajas',  href: 'bajas.html',  label: 'Bajas',             icon: 'bajas'  }
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
            id: 'soporte',
            label: 'Soporte',
            icon: 'soporte',
            items: [
                { id: 'integraciones', href: 'integraciones.html', label: 'Integraciones', icon: 'integraciones' }
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
        return `
            <div class="sidebar-group${openCls}" id="${domId}">
                <div class="sidebar-group-header" onclick="document.getElementById('${domId}').classList.toggle('open')">
                    ${ICON[group.icon] || ''}
                    ${group.label}
                    ${ICON.chevronRight}
                </div>
                <div class="sidebar-group-children">
                    ${group.items.map(it => renderItem(it, activeId)).join('')}
                </div>
            </div>`;
    }

    // Renderiza el sidebar completo en el <nav id="sidebar"> de la página actual.
    // `activeId` es el id del item que debe aparecer resaltado (p.ej. 'lista').
    function render(activeId) {
        const nav = document.getElementById('sidebar');
        if (!nav) return;

        const activeGroup = findGroupOf(activeId);

        const html = `
            <div class="sidebar-hd">
                <div class="sidebar-brand">
                    <span class="sidebar-brand-dot"></span>
                    Yurest
                </div>
                <button class="sidebar-close" onclick="closeSidebar()" aria-label="Cerrar menú">✕</button>
            </div>
            <div class="sidebar-label">Secciones</div>
            ${GROUPS.map(g => renderGroup(g, activeId, g.id === activeGroup)).join('')}
            <div class="sidebar-ft">
                <button onclick="closeSidebar(); (window.cerrarSesion||YurestConfig.cerrarSesion)();">
                    ${ICON.close}
                    Cerrar sesión
                </button>
            </div>`;

        nav.innerHTML = html;

        // Disparar actualización del badge "Sin asignar" si existe en la página
        if (window.YurestConfig && window.YurestConfig.actualizarBadgeSinAsignar) {
            window.YurestConfig.actualizarBadgeSinAsignar();
        }
    }

    global.YurestSidebar = { render, GROUPS };
})(window);
