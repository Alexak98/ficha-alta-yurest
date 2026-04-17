// ==========================================
// APP - Gestor de Proyectos
// ==========================================

let proyectos = [];
let vistaActual = 'dashboard';
let dashboardFiltroActivo = null; // null, 'pausados', 'avanzando', 'terminados', 'inicio'

// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    try {
        proyectos = await cargarProyectos();
    } catch (err) {
        mostrarToast('Error cargando datos: ' + err.message, 'error');
        proyectos = [];
    } finally {
        hideLoading();
    }
    inicializarFiltros();
    refrescarTodo();
    actualizarBadgeSinAsignar();

    // Inicializar flatpickr en los campos de fecha
    const fpConfig = { locale: 'es', dateFormat: 'Y-m-d', altInput: true, altFormat: 'j M Y', allowInput: false };
    if (typeof flatpickr !== 'undefined') {
        flatpickr('#tarea-fecha', fpConfig);
        flatpickr('#subtarea-fecha', fpConfig);
    }

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Cerrar sólo el último modal abierto (para no colapsar stacks como detalle+confirm)
            const abiertos = document.querySelectorAll('.modal-overlay.active');
            if (abiertos.length > 0) {
                const top = abiertos[abiertos.length - 1];
                cerrarModal(top.id);
            }
        }
    });
});

// ==========================================
// FILTERS
// ==========================================

function inicializarFiltros() {
    const filtroImplChecks = document.getElementById('filtro-impl-checks');
    filtroImplChecks.innerHTML = IMPLEMENTADORES.map(impl =>
        `<label class="filter-check-item"><input type="checkbox" value="${impl}" class="filtro-impl-cb" onchange="aplicarFiltros()"> ${impl}</label>`
    ).join('');

    const filtroTipoChecks = document.getElementById('filtro-tipo-checks');
    filtroTipoChecks.innerHTML = TIPOS_PROYECTO.map(tipo =>
        `<label class="filter-check-item"><input type="checkbox" value="${tipo}" class="filtro-tipo-cb" onchange="aplicarFiltros()"> ${tipo}</label>`
    ).join('');

    const filtroEstadoChecks = document.getElementById('filtro-estado-checks');
    filtroEstadoChecks.innerHTML = ESTADOS_PROYECTO.map(estado =>
        `<label class="filter-check-item"><input type="checkbox" value="${estado}" class="filtro-estado-cb" onchange="aplicarFiltros()"> ${capitalizar(estado)}</label>`
    ).join('');

    const proyImpl = document.getElementById('proyecto-implementador');
    IMPLEMENTADORES.forEach(impl => {
        proyImpl.innerHTML += `<option value="${impl}">${impl}</option>`;
    });

    // El campo proyecto-tipo es un input readonly que se rellena desde la ficha del cliente.
    // No se popula con opciones aquí.

    const proyEstado = document.getElementById('proyecto-estado');
    ESTADOS_PROYECTO.forEach(estado => {
        proyEstado.innerHTML += `<option value="${estado}">${capitalizar(estado)}</option>`;
    });
}

function aplicarFiltros() {
    // Update impl multi-select pill label
    const implChecked = [...document.querySelectorAll('.filtro-impl-cb:checked')].map(cb => cb.value.split(' ')[0]);
    const implPill = document.querySelector('[onclick*="toggleImplDropdown"]');
    const implLabel = document.getElementById('filtro-impl-label');
    if (implChecked.length === 0) {
        implLabel.textContent = 'Implementador';
        if (implPill) implPill.classList.remove('active');
    } else {
        implLabel.textContent = implChecked.join(', ');
        if (implPill) implPill.classList.add('active');
    }

    // Update tipo multi-select pill label
    const tiposChecked = [...document.querySelectorAll('.filtro-tipo-cb:checked')].map(cb => cb.value);
    const tipoPill = document.querySelector('[onclick*="toggleTipoDropdown"]');
    const tipoLabel = document.getElementById('filtro-tipo-label');
    if (tiposChecked.length === 0) {
        tipoLabel.textContent = 'Tipo';
        if (tipoPill) tipoPill.classList.remove('active');
    } else {
        tipoLabel.textContent = tiposChecked.join(', ');
        if (tipoPill) tipoPill.classList.add('active');
    }

    // Update estado multi-select pill label
    const estadosChecked = [...document.querySelectorAll('.filtro-estado-cb:checked')].map(cb => capitalizar(cb.value));
    const estadoPill = document.querySelector('[onclick*="toggleEstadoDropdown"]');
    const estadoLabel = document.getElementById('filtro-estado-label');
    if (estadosChecked.length === 0) {
        estadoLabel.textContent = 'Estado';
        if (estadoPill) estadoPill.classList.remove('active');
    } else {
        estadoLabel.textContent = estadosChecked.join(', ');
        if (estadoPill) estadoPill.classList.add('active');
    }

    // Show/hide clear button
    const buscar = (document.getElementById('buscar-proyecto')?.value || '').trim();
    const clearBtn = document.getElementById('filter-clear-btn');
    clearBtn.style.display = (implChecked.length > 0 || tiposChecked.length > 0 || estadosChecked.length > 0 || buscar) ? 'inline-flex' : 'none';

    renderizarDashboard();
}

function closeAllFilterDropdowns(except) {
    ['filtro-impl-dropdown', 'filtro-tipo-dropdown', 'filtro-estado-dropdown'].forEach(id => {
        if (id !== except) document.getElementById(id)?.classList.remove('open');
    });
}

function openFilterDropdown(ddId, e) {
    e.stopPropagation();
    closeAllFilterDropdowns(ddId);
    const dd = document.getElementById(ddId);
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) {
        const close = (ev) => {
            if (!dd.contains(ev.target) && !ev.target.closest('.filter-pill-multi')) {
                dd.classList.remove('open');
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }
}

function toggleImplDropdown(e) { openFilterDropdown('filtro-impl-dropdown', e); }

function toggleTipoDropdown(e) { openFilterDropdown('filtro-tipo-dropdown', e); }
function toggleEstadoDropdown(e) { openFilterDropdown('filtro-estado-dropdown', e); }

function limpiarFiltros() {
    document.querySelectorAll('.filtro-impl-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.filtro-tipo-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.filtro-estado-cb').forEach(cb => { cb.checked = false; });
    const buscarInput = document.getElementById('buscar-proyecto');
    if (buscarInput) buscarInput.value = '';
    aplicarFiltros();
}

// ==========================================
// VIEW NAVIGATION
// ==========================================

function cambiarVista(vista) {
    vistaActual = vista;
    document.getElementById('vista-dashboard').style.display = vista === 'dashboard' ? '' : 'none';
    document.getElementById('vista-proyectos').style.display = vista === 'proyectos' ? '' : 'none';

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === vista);
    });

    if (vista === 'proyectos') {
        renderizarDashboard();
    }
}

// ==========================================
// DASHBOARD STATS
// ==========================================

function renderizarEstadisticas() {
    const stats = generarEstadisticasDashboard(proyectos);
    const duracion = generarEstadisticasDuracion(proyectos);
    const container = document.getElementById('dashboard-stats');

    container.innerHTML = `
        <div class="kpi-row">
            <div class="kpi-card kpi-total ${dashboardFiltroActivo === 'total' ? 'kpi-active' : ''}" onclick="filtrarDashboard('total')">
                <div class="kpi-value">${stats.totales.total}</div>
                <div class="kpi-label">Total de Proyectos</div>
            </div>
            <div class="kpi-card kpi-parados ${dashboardFiltroActivo === 'pausados' ? 'kpi-active' : ''}" onclick="filtrarDashboard('pausados')">
                <div class="kpi-value">${stats.totales.pausados}</div>
                <div class="kpi-label">Pausados</div>
            </div>
            <div class="kpi-card kpi-avanzando ${dashboardFiltroActivo === 'avanzando' ? 'kpi-active' : ''}" onclick="filtrarDashboard('avanzando')">
                <div class="kpi-value">${stats.totales.avanzando}</div>
                <div class="kpi-label">Avanzando</div>
            </div>
            <div class="kpi-card kpi-terminados ${dashboardFiltroActivo === 'terminados' ? 'kpi-active' : ''}" onclick="filtrarDashboard('terminados')">
                <div class="kpi-value">${stats.totales.terminados}</div>
                <div class="kpi-label">Terminados</div>
            </div>
            <div class="kpi-card kpi-inicio ${dashboardFiltroActivo === 'inicio' ? 'kpi-active' : ''}" onclick="filtrarDashboard('inicio')">
                <div class="kpi-value">${stats.totales.inicio}</div>
                <div class="kpi-label">Inicio / Sin datos</div>
            </div>
            <div class="kpi-card kpi-agendadas">
                <div class="kpi-value">${stats.totales.sesionesAgendadas}</div>
                <div class="kpi-label">Sesiones agendadas</div>
            </div>
            <div class="kpi-card kpi-singendar">
                <div class="kpi-value">${stats.totales.sesionesSinAgendar}</div>
                <div class="kpi-label">Sesiones sin agendar</div>
            </div>
        </div>

        <div class="stats-tables">
            <div class="stats-panel">
                <div class="stats-panel-header impl-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    Resumen por implementador
                </div>
                <table class="impl-table">
                    <thead>
                        <tr>
                            <th>Implementador</th>
                            <th>Total</th>
                            <th>Pausados</th>
                            <th>Avanzando</th>
                            <th>Terminados</th>
                            <th>Inicio</th>
                            <th>Pendientes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${IMPLEMENTADORES.map(impl => {
                            const d = stats.porImplementador[impl];
                            const color = COLORES_IMPLEMENTADOR[impl];
                            const ini = INICIALES_IMPLEMENTADOR[impl];
                            return `<tr class="impl-row" onclick="filtrarDashboardPorImplementador('${escapeAttr(impl)}')">
                                <td><div class="impl-name"><span class="avatar" style="background:${color}">${ini}</span>${impl.split(' ')[0]}</div></td>
                                <td><strong>${d.total}</strong></td>
                                <td class="td-parados">${d.pausados || '—'}</td>
                                <td class="td-avanzando">${d.avanzando || '—'}</td>
                                <td class="td-terminados">${d.terminados || '—'}</td>
                                <td class="td-inicio">${d.inicio || '—'}</td>
                                <td class="td-pendientes">${d.pendientes}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="stats-panel">
                <div class="stats-panel-header parados-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Clientes pausados — sin reducción de pendientes en 3+ semanas
                </div>
                <table class="parados-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Implementador</th>
                            <th>Pendientes</th>
                            <th>Semanas pausado</th>
                        </tr>
                    </thead>
                </table>
                <div class="parados-scroll">
                    <table class="parados-table">
                        <tbody>
                            ${stats.clientesPausados.length > 0 ? stats.clientesPausados.map(cp => `
                                <tr onclick="abrirDetalle('${cp.id}')">
                                    <td class="parados-cliente">${escapeHtml(cp.cliente)}</td>
                                    <td class="parados-impl">${cp.implementador.split(' ')[0]}</td>
                                    <td class="parados-pendientes">${cp.pendientes}</td>
                                    <td class="parados-semanas">${cp.semanasPausado !== null ? cp.semanasPausado : '—'}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">No hay clientes pausados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="stats-panel duracion-panel">
            <div class="stats-panel-header duracion-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Duracion media de implementaciones — dias laborables
            </div>
            <div class="duracion-globals">
                <div class="duracion-global-item">
                    <span class="duracion-global-label">Media global</span>
                    <span class="duracion-global-value">${duracion.mediaGlobal} dias lab</span>
                    <span class="duracion-global-sub">(${duracion.mediaGlobalSem} semanas)</span>
                </div>
                <div class="duracion-global-item">
                    <span class="duracion-global-label">Mediana global</span>
                    <span class="duracion-global-value">${duracion.medianaGlobal} dias lab</span>
                    <span class="duracion-global-sub">(${duracion.medianaGlobalSem} semanas)</span>
                </div>
                <div class="duracion-global-item">
                    <span class="duracion-global-label">Proyectos analizados</span>
                    <span class="duracion-global-value">${duracion.totalAnalizados}</span>
                </div>
            </div>
            <table class="duracion-table">
                <thead>
                    <tr>
                        <th>Tipo de proyecto</th>
                        <th>Proyectos</th>
                        <th>Media (dias)</th>
                        <th>Media (sem)</th>
                        <th>Mediana (dias)</th>
                        <th>Mediana (sem)</th>
                    </tr>
                </thead>
                <tbody>
                    ${duracion.porTipo.map(t => `
                        <tr>
                            <td class="duracion-tipo"><strong>${escapeHtml(t.tipo)}</strong></td>
                            <td>${t.count}</td>
                            <td class="duracion-highlight">${t.mediaDias}</td>
                            <td>${t.mediaSem}</td>
                            <td>${t.medianaDias}</td>
                            <td>${t.medianaSem}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <table class="duracion-table duracion-table-impl">
                <thead>
                    <tr>
                        <th>Implementador</th>
                        <th>Proyectos</th>
                        <th>Media (dias)</th>
                        <th>Media (sem)</th>
                    </tr>
                </thead>
                <tbody>
                    ${duracion.porImplementador.map(i => {
                        const color = COLORES_IMPLEMENTADOR[i.impl] || '#6366f1';
                        return `<tr>
                            <td><span style="color:${color};font-weight:700">${escapeHtml(i.impl.split(' ')[0])}</span></td>
                            <td>${i.count}</td>
                            <td class="duracion-highlight">${i.mediaDias}</td>
                            <td>${i.mediaSem}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="duracion-footer">
                Basado en ${duracion.totalAnalizados} proyectos con fecha de inicio. En curso: dias desde inicio hasta hoy. Sin tipo excluidos.
            </div>
        </div>
    `;
}

// ==========================================
// DASHBOARD KPI FILTERING
// ==========================================

const LABELS_FILTRO = {
    total: 'Todos los clientes',
    pausados: 'Clientes pausados',
    avanzando: 'Clientes avanzando',
    terminados: 'Clientes terminados',
    inicio: 'Clientes en inicio / sin datos'
};

const ESTADO_MAP = {
    pausados: 'pausado',
    avanzando: 'avanzando',
    terminados: 'terminado',
    inicio: 'inicio'
};

function filtrarDashboard(tipo) {
    // Toggle: click again to close
    if (dashboardFiltroActivo === tipo) {
        cerrarFiltradoDashboard();
        return;
    }

    dashboardFiltroActivo = tipo;
    renderizarFiltradoDashboard(tipo, true);
    renderizarEstadisticas(); // re-render to update active state
}

// Re-renderiza el panel filtrado sin toggle ni scroll (para refrescarTodo tras editar).
function renderizarFiltradoDashboard(tipo, scroll) {
    let filtrados;
    if (tipo === 'total') {
        filtrados = proyectos;
    } else {
        const estadoBuscado = ESTADO_MAP[tipo];
        filtrados = proyectos.filter(p => obtenerEstadoDashboard(p) === estadoBuscado);
    }
    mostrarCardsFiltradas(LABELS_FILTRO[tipo], filtrados, scroll);
}

function filtrarDashboardPorImplementador(impl) {
    dashboardFiltroActivo = null;
    const filtrados = proyectos.filter(p => p.implementador === impl);
    mostrarCardsFiltradas(`Proyectos de ${impl}`, filtrados, true);
    renderizarEstadisticas();
}

function mostrarCardsFiltradas(titulo, lista, scroll) {
    const container = document.getElementById('dashboard-filtered');
    const cardsGrid = document.getElementById('dashboard-cards');
    const titleEl = document.getElementById('filtered-title');

    titleEl.innerHTML = `${escapeHtml(titulo)} <span class="filtered-count">${lista.length}</span>`;

    if (lista.length === 0) {
        cardsGrid.innerHTML = `<div class="empty-state"><h3>Sin resultados</h3><p>No hay proyectos en esta categoría</p></div>`;
    } else {
        cardsGrid.innerHTML = lista.map(p => renderCard(p)).join('');
    }

    container.style.display = '';
    if (scroll) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cerrarFiltradoDashboard() {
    dashboardFiltroActivo = null;
    document.getElementById('dashboard-filtered').style.display = 'none';
    renderizarEstadisticas();
}

function refrescarTodo() {
    renderizarEstadisticas();
    if (vistaActual === 'proyectos') {
        renderizarDashboard();
    }
    // Re-render filtered dashboard cards if active (sin toggle ni scroll)
    if (dashboardFiltroActivo) {
        renderizarFiltradoDashboard(dashboardFiltroActivo, false);
    }
}

// Normaliza texto para búsqueda: minúsculas, sin acentos, trim.
function _normBusqueda(s) {
    return String(s == null ? '' : s)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim();
}

function _hayFiltrosActivos() {
    const anyCheck = document.querySelectorAll('.filtro-impl-cb:checked, .filtro-tipo-cb:checked, .filtro-estado-cb:checked').length > 0;
    const texto = (document.getElementById('buscar-proyecto')?.value || '').trim();
    return anyCheck || texto.length > 0;
}

function obtenerProyectosFiltrados() {
    const implSeleccionados = [...document.querySelectorAll('.filtro-impl-cb:checked')].map(cb => cb.value);
    const tiposSeleccionados = [...document.querySelectorAll('.filtro-tipo-cb:checked')].map(cb => cb.value);
    const estadosSeleccionados = [...document.querySelectorAll('.filtro-estado-cb:checked')].map(cb => cb.value);
    const buscar = _normBusqueda(document.getElementById('buscar-proyecto')?.value || '');

    return proyectos.filter(p => {
        if (implSeleccionados.length > 0 && !implSeleccionados.includes(p.implementador)) return false;
        if (tiposSeleccionados.length > 0 && !tiposSeleccionados.includes(p.tipo)) return false;
        if (estadosSeleccionados.length > 0 && !estadosSeleccionados.includes(p.estado)) return false;
        if (buscar && !_normBusqueda(p.cliente).includes(buscar) && !_normBusqueda(p.implementador).includes(buscar)) return false;
        return true;
    });
}

// ==========================================
// RENDER DASHBOARD
// ==========================================

function renderizarDashboard() {
    const grid = document.getElementById('cards-grid');
    const filtrados = obtenerProyectosFiltrados();

    document.getElementById('stats').innerHTML = `Mostrando <strong>${filtrados.length}</strong> de <strong>${proyectos.length}</strong> proyectos`;

    if (filtrados.length === 0) {
        const hayFiltros = _hayFiltrosActivos();
        if (hayFiltros) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <h3>Sin resultados</h3>
                    <p>Ningún proyecto coincide con los filtros aplicados.</p>
                    <button class="btn btn-secondary btn-sm" onclick="limpiarFiltros()" style="margin-top:12px">Limpiar filtros</button>
                </div>`;
        } else {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    <h3>No hay proyectos</h3>
                    <p>Los proyectos se generan desde la sección "Sin asignar" cuando se da de alta un cliente.</p>
                </div>`;
        }
        return;
    }

    // Agrupar por tipo de cliente
    const grupos = {};
    TIPOS_PROYECTO.forEach(tipo => { grupos[tipo] = []; });
    filtrados.forEach(p => {
        const tipo = TIPOS_PROYECTO.includes(p.tipo) ? p.tipo : 'Otros';
        if (!grupos[tipo]) grupos[tipo] = [];
        grupos[tipo].push(p);
    });

    const coloresTipo = {
        'Planes': '#8b5cf6',
        'Corporate con cocina': '#059669',
        'Corporate sin cocina': '#D97706'
    };

    let html = '';
    for (const tipo of [...TIPOS_PROYECTO, 'Otros']) {
        const lista = grupos[tipo];
        if (!lista || lista.length === 0) continue;
        html += `
            <div class="tipo-group open">
                <div class="tipo-group-header" onclick="this.parentElement.classList.toggle('open')">
                    <svg class="tipo-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    <span class="tipo-group-dot" style="background:${coloresTipo[tipo] || '#6366f1'}"></span>
                    <span class="tipo-group-name">${escapeHtml(tipo)}</span>
                    <span class="tipo-group-count">${lista.length}</span>
                </div>
                <div class="tipo-group-cards">
                    ${lista.map(p => renderCard(p)).join('')}
                </div>
            </div>`;
    }
    grid.innerHTML = html;
}

function renderCard(proyecto) {
    const color = COLORES_IMPLEMENTADOR[proyecto.implementador] || '#6366f1';
    const iniciales = INICIALES_IMPLEMENTADOR[proyecto.implementador] || '??';
    const resumen = obtenerResumenProyecto(proyecto);

    return `
        <div class="project-card" style="--card-color: ${color}" onclick="abrirDetalle('${proyecto.id}')">
            <div class="card-header">
                <span class="card-cliente">${escapeHtml(proyecto.cliente)}</span>
                <span class="card-estado estado-${proyecto.estado}">${proyecto.estado}</span>
            </div>
            <div class="card-body">
                <div class="card-meta">
                    <div class="card-implementador">
                        <span class="avatar" style="background:${color}">${iniciales}</span>
                        ${escapeHtml(proyecto.implementador)}
                    </div>
                    <span class="card-tipo">${escapeHtml(proyecto.tipo)}</span>
                </div>
                <div class="card-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width:${resumen.progreso}%; background:${color}"></div>
                    </div>
                    <div class="progress-text">
                        <span>${resumen.tareasCompletadas}/${resumen.totalTareas} tareas</span>
                        <span>${resumen.progreso}%</span>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <span class="card-sesiones">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <strong>${resumen.sesionesCompletadas}/${resumen.totalSesiones}</strong> sesiones
                </span>
                ${(() => {
                    const ultimaComp = obtenerUltimaSubtareaCompletada(proyecto);
                    return ultimaComp ? `<span class="card-sesion-fecha">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                        ${formatearFechaCorta(ultimaComp)}
                    </span>` : '';
                })()}
            </div>
        </div>`;
}

// ==========================================
// MODAL HELPERS
// ==========================================

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
    if (window.YurestConfig && window.YurestConfig.a11yAbrirModal) {
        window.YurestConfig.a11yAbrirModal(id);
    }
    // Cuando se abre el modal-confirm, bloquea la interacción con otros modales
    // abiertos para evitar que un click "atravesado" dispare acciones destructivas
    // (p.ej. el botón Eliminar del proyecto detrás del confirm).
    if (id === 'modal-confirm') {
        document.querySelectorAll('.modal-overlay.active').forEach(el => {
            if (el.id !== 'modal-confirm') el.setAttribute('inert', '');
        });
    }
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
    if (window.YurestConfig && window.YurestConfig.a11yCerrarModal) {
        window.YurestConfig.a11yCerrarModal(id);
    }
    if (id === 'modal-confirm') {
        document.querySelectorAll('.modal-overlay[inert]').forEach(el => el.removeAttribute('inert'));
    }
}

// ==========================================
// CRUD PROYECTOS
// ==========================================

// Cache de altas para resolver datos de la ficha por nombre de cliente.
// La ficha del cliente es la fuente de verdad para TPV y Tipo — el proyecto no los edita.
let _altasCachePromise = null;
let _altasCacheTs = 0;
const _ALTAS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function _cargarAltasCache(forzar) {
    const ahora = Date.now();
    if (!forzar && _altasCachePromise && (ahora - _altasCacheTs) < _ALTAS_CACHE_TTL_MS) {
        return _altasCachePromise;
    }
    _altasCacheTs = ahora;
    _altasCachePromise = (async () => {
        try {
            const res = await fetch(WEBHOOK_ALTAS, { method: 'GET', headers: getAuthHeaders() });
            if (!res.ok) return [];
            let data = {};
            try { data = await res.json(); } catch (_) {}
            const raw = Array.isArray(data) ? data
                : Array.isArray(data.clientes) ? data.clientes
                : Array.isArray(data.data) ? data.data : [];
            return raw.map(normalizarAlta).filter(a => a.nombre);
        } catch (_) {
            return [];
        }
    })();
    return _altasCachePromise;
}

// Devuelve la ficha normalizada asociada a un cliente, o null si no hay match.
async function obtenerFichaPorCliente(nombreCliente) {
    const clave = normalizarNombreCliente(nombreCliente);
    if (!clave) return null;
    const altas = await _cargarAltasCache();
    return altas.find(a => normalizarNombreCliente(a.nombre) === clave) || null;
}

// Helper compatible: devuelve el TPV asociado a un cliente.
async function obtenerTpvDeFicha(nombreCliente) {
    const ficha = await obtenerFichaPorCliente(nombreCliente);
    return ficha ? (ficha.tpv || '') : '';
}

// Rellena (o vacía) los inputs de TPV y Tipo a partir del nombre de cliente indicado.
// Si el endpoint de altas está caído (cache vacío), no sobrescribimos lo que ya haya,
// para no perder el valor almacenado mientras se edita.
async function _sincronizarDatosDesdeFicha(nombreCliente) {
    const inputTpv = document.getElementById('proyecto-tpv');
    const inputTipo = document.getElementById('proyecto-tipo');
    const altas = await _cargarAltasCache();
    if (!altas.length) return; // probable fallo de red; mantener valores actuales
    const clave = normalizarNombreCliente(nombreCliente);
    const ficha = clave ? altas.find(a => normalizarNombreCliente(a.nombre) === clave) : null;
    if (inputTpv) inputTpv.value = ficha ? (ficha.tpv || '') : '';
    if (inputTipo) inputTipo.value = ficha ? (ficha.tipo || '') : '';
}

// Alias compatible con el nombre previo.
const _sincronizarTpvDesdeFicha = _sincronizarDatosDesdeFicha;

// Los proyectos sólo se crean desde "Sin asignar" (ficha → asignación a implementador).
// Este modal es exclusivamente de edición.
function abrirModalProyecto(id) {
    if (!id) return;
    const p = proyectos.find(pr => pr.id === id);
    if (!p) return;

    const inputId = document.getElementById('proyecto-id');
    const inputCliente = document.getElementById('proyecto-cliente');
    const selectImpl = document.getElementById('proyecto-implementador');
    const inputTipo = document.getElementById('proyecto-tipo');
    const selectEstado = document.getElementById('proyecto-estado');
    const inputFecha = document.getElementById('proyecto-fecha');

    inputId.value = p.id;
    inputCliente.value = p.cliente;
    selectImpl.value = p.implementador;
    selectEstado.value = p.estado;
    inputFecha.value = p.fechaInicio;
    // Tipo y TPV vienen de la ficha — mostramos lo guardado y refrescamos en segundo plano
    inputTipo.value = p.tipo || '';
    document.getElementById('proyecto-tpv').value = p.tpv || '';
    _sincronizarDatosDesdeFicha(p.cliente);
    window._proyectoParticipantes = [...(p.participantes || [])];

    renderParticipantesChips();
    abrirModal('modal-proyecto');
    selectImpl.focus();
}

async function guardarProyecto() {
    const id = document.getElementById('proyecto-id').value;
    if (!id) return; // edición únicamente
    const cliente = document.getElementById('proyecto-cliente').value.trim();
    const implementador = document.getElementById('proyecto-implementador').value;
    const estado = document.getElementById('proyecto-estado').value;
    const fechaInicio = document.getElementById('proyecto-fecha').value;

    if (!cliente) return;

    // Tipo y TPV se derivan siempre de la ficha del cliente — nunca del DOM editable.
    const ficha = await obtenerFichaPorCliente(cliente);
    // Preservar valor previo si no hay match en la ficha (p.ej. el backend está caído).
    const idx = proyectos.findIndex(p => p.id === id);
    if (idx === -1) return;
    const proyectoPrev = proyectos[idx];
    const tipo = ficha ? (ficha.tipo || '') : (proyectoPrev.tipo || '');
    const tpv = ficha ? (ficha.tpv || '') : (proyectoPrev.tpv || '');
    document.getElementById('proyecto-tipo').value = tipo;
    document.getElementById('proyecto-tpv').value = tpv;

    showLoading();
    try {
        proyectoPrev.cliente = cliente;
        proyectoPrev.implementador = implementador;
        proyectoPrev.tipo = tipo;
        proyectoPrev.estado = estado;
        proyectoPrev.fechaInicio = fechaInicio;
        proyectoPrev.tpv = tpv;
        proyectoPrev.participantes = window._proyectoParticipantes || [];
        await actualizarProyectoAPI(proyectoPrev);

        guardarProyectosLocal(proyectos);
        cerrarModal('modal-proyecto');
        refrescarTodo();
        mostrarToast('Proyecto guardado correctamente', 'success');
    } catch (err) {
        mostrarToast('Error al guardar proyecto: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function eliminarProyecto(id) {
    const proyecto = proyectos.find(p => p.id === id);
    if (!proyecto) return;
    const cliente = proyecto.cliente || '';
    const mensaje = `¿Eliminar el proyecto de "${cliente}" y todas sus tareas?\n\nPara confirmar, en el siguiente paso deberás escribir el nombre del cliente.`;
    mostrarConfirmacion(mensaje, async () => {
        const escrito = (prompt(`Esta acción es irreversible.\nEscribe exactamente el nombre del cliente para confirmar:\n\n${cliente}`) || '').trim();
        if (escrito !== cliente) {
            mostrarToast('Cancelado: el nombre no coincide', 'warning');
            return;
        }
        showLoading();
        try {
            await eliminarProyectoAPI(id);
            proyectos = proyectos.filter(p => p.id !== id);
            guardarProyectosLocal(proyectos);
            cerrarModal('modal-detalle');
            refrescarTodo();
            mostrarToast('Proyecto eliminado', 'success');
        } catch (err) {
            mostrarToast('Error al eliminar: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    });
}

// ==========================================
// DETAIL VIEW (Secciones + Tareas)
// ==========================================

let detalleProyectoId = null;

function abrirDetalle(id) {
    const overlay = document.getElementById('modal-detalle');
    const yaAbierto = overlay.classList.contains('active') && detalleProyectoId === id;
    detalleProyectoId = id;
    const proyecto = proyectos.find(p => p.id === id);
    if (!proyecto) return;

    document.getElementById('detalle-titulo').textContent = proyecto.cliente;

    // Solo resetear tabs si es la primera apertura (o cambio de proyecto)
    if (!yaAbierto) {
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.detail-tab[data-dtab="tareas"]').classList.add('active');
        document.getElementById('detalle-tareas').style.display = '';
        document.getElementById('detalle-contactos').style.display = 'none';
        document.getElementById('detalle-desarrollos').style.display = 'none';
        document.getElementById('detalle-anotaciones').style.display = 'none';
    }

    // Re-render sólo el tab activo para preservar el contexto del usuario
    const tabActivo = document.querySelector('.detail-tab.active')?.dataset.dtab || 'tareas';
    if (tabActivo === 'tareas') renderDetalleTareas(proyecto);
    else if (tabActivo === 'contactos') renderDetalleContactos(proyecto);
    else if (tabActivo === 'desarrollos') renderDetalleDesarrollos(proyecto);
    else if (tabActivo === 'anotaciones') renderDetalleAnotaciones(proyecto);

    if (!yaAbierto) abrirModal('modal-detalle');
}

function renderDetalleTareas(proyecto) {
    const color = COLORES_IMPLEMENTADOR[proyecto.implementador] || '#6366f1';
    const iniciales = INICIALES_IMPLEMENTADOR[proyecto.implementador] || '??';
    const resumen = obtenerResumenProyecto(proyecto);
    const ultimaSesion = obtenerUltimaSesionAgendada(proyecto);

    document.getElementById('detalle-tareas').innerHTML = `
        <div class="detail-info">
            <div class="detail-field">
                <span class="detail-label">Implementador</span>
                <span class="detail-value">
                    <span class="avatar" style="background:${color}; width:24px; height:24px; font-size:10px;">${iniciales}</span>
                    ${escapeHtml(proyecto.implementador)}
                </span>
            </div>
            <div class="detail-field">
                <span class="detail-label">Tipo</span>
                <span class="detail-value">${escapeHtml(proyecto.tipo)}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">Estado</span>
                <span class="detail-value">
                    <span class="card-estado estado-${proyecto.estado}">${proyecto.estado}</span>
                </span>
            </div>
            <div class="detail-field">
                <span class="detail-label">Progreso</span>
                <span class="detail-value">${resumen.progreso}% (${resumen.tareasCompletadas}/${resumen.totalTareas})</span>
            </div>
            ${ultimaSesion ? `<div class="detail-field">
                <span class="detail-label">Ultima sesion</span>
                <span class="detail-value detail-sesion-fecha">${formatearFecha(ultimaSesion)}</span>
            </div>` : ''}
            <div class="detail-field">
                <span class="detail-label">Integracion TPV</span>
                <span class="detail-value">${proyecto.tpv ? `<span class="detail-tpv-badge">${escapeHtml(proyecto.tpv)}</span>` : '<span style="color:var(--text-muted)">Sin TPV</span>'}</span>
            </div>
            ${(proyecto.participantes && proyecto.participantes.length > 0) ? `<div class="detail-field">
                <span class="detail-label">Participantes</span>
                <span class="detail-value"><div class="participantes-chips-inline">${proyecto.participantes.map(e => `<span class="participante-chip-sm">${escapeHtml(e)}</span>`).join('')}</div></span>
            </div>` : ''}
        </div>

        ${proyecto.estado === 'pausado' ? `
        <div class="pausa-info-panel">
            <div class="pausa-info-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
                Proyecto pausado
            </div>
            <div class="form-group">
                <label>Motivo de pausa</label>
                <textarea id="motivo-pausa" class="form-control" rows="2" placeholder="Indica el motivo de la pausa..." onchange="guardarDatosPausa()">${escapeHtml(proyecto.motivoPausa || '')}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:0">
                <label>Plan de accion</label>
                <textarea id="plan-accion" class="form-control" rows="2" placeholder="Describe el plan para retomar..." onchange="guardarDatosPausa()">${escapeHtml(proyecto.planAccion || '')}</textarea>
            </div>
        </div>
        ` : ''}

        <div class="detail-sections">
            ${proyecto.secciones.map((seccion, si) => renderSeccion(proyecto.id, seccion, si)).join('')}
        </div>

        <div class="detail-actions">
            <button class="btn btn-secondary" onclick="abrirModalProyecto('${proyecto.id}'); cerrarModal('modal-detalle')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar Proyecto
            </button>
            <button class="btn btn-danger" onclick="eliminarProyecto('${proyecto.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Eliminar
            </button>
        </div>`;
}

async function guardarDatosPausa() {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    proyecto.motivoPausa = document.getElementById('motivo-pausa').value;
    proyecto.planAccion = document.getElementById('plan-accion').value;
    guardarProyectosLocal(proyectos);
    try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
    mostrarToast('Datos de pausa guardados', 'success');
}

function cambiarVistaDetalle(vista) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.dtab === vista));
    document.getElementById('detalle-tareas').style.display = vista === 'tareas' ? '' : 'none';
    document.getElementById('detalle-contactos').style.display = vista === 'contactos' ? '' : 'none';
    document.getElementById('detalle-desarrollos').style.display = vista === 'desarrollos' ? '' : 'none';
    document.getElementById('detalle-anotaciones').style.display = vista === 'anotaciones' ? '' : 'none';

    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;

    if (vista === 'contactos') renderDetalleContactos(proyecto);
    if (vista === 'desarrollos') renderDetalleDesarrollos(proyecto);
    if (vista === 'anotaciones') renderDetalleAnotaciones(proyecto);
}

function renderDetalleContactos(proyecto) {
    if (!proyecto.contactos) proyecto.contactos = [];
    // Migrar formato viejo (array de strings) a objetos
    if (proyecto.contactos.length > 0 && typeof proyecto.contactos[0] === 'string') {
        proyecto.contactos = proyecto.contactos.map(email => ({ email, nombre: '', apellidos: '', puesto: '', telefono: '' }));
    }
    // Migrar participantes viejos si existen
    if (proyecto.participantes && proyecto.participantes.length > 0 && proyecto.contactos.length === 0) {
        proyecto.contactos = proyecto.participantes.map(e => typeof e === 'string' ? { email: e, nombre: '', apellidos: '', puesto: '', telefono: '' } : e);
    }

    const container = document.getElementById('detalle-contactos');
    container.innerHTML = `
        <div class="contactos-editor">
            <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
                <button class="btn btn-primary btn-sm" onclick="abrirFormContacto()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo contacto
                </button>
            </div>
            <div id="contacto-form-container" style="display:none">
                <div class="contacto-form">
                    <input type="hidden" id="contacto-edit-idx" value="">
                    <div class="form-row">
                        <div class="form-group"><label>Nombre</label><input type="text" id="contacto-nombre" class="form-control" placeholder="Nombre"></div>
                        <div class="form-group"><label>Apellidos</label><input type="text" id="contacto-apellidos" class="form-control" placeholder="Apellidos"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Email</label><input type="email" id="contacto-email" class="form-control" placeholder="email@ejemplo.com"></div>
                        <div class="form-group"><label>Puesto</label><input type="text" id="contacto-puesto" class="form-control" placeholder="Cargo / Puesto"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Telefono</label><input type="tel" id="contacto-telefono" class="form-control" placeholder="+34 600 000 000"></div>
                        <div class="form-group" style="display:flex;align-items:flex-end;gap:6px">
                            <button class="btn btn-primary btn-sm" onclick="guardarContactoDetalle()">Guardar</button>
                            <button class="btn btn-secondary btn-sm" onclick="cerrarFormContacto()">Cancelar</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="contactos-list">
                ${proyecto.contactos.length > 0
                    ? proyecto.contactos.map((c, i) => `
                        <div class="contacto-row">
                            <div class="contacto-avatar">${(c.nombre || c.email || '?').charAt(0).toUpperCase()}</div>
                            <div class="contacto-info">
                                <div class="contacto-nombre-line">
                                    ${c.nombre || c.apellidos ? `<strong>${escapeHtml((c.nombre || '') + ' ' + (c.apellidos || '')).trim()}</strong>` : ''}
                                    ${c.puesto ? `<span class="contacto-puesto">${escapeHtml(c.puesto)}</span>` : ''}
                                </div>
                                <div class="contacto-detail-line">
                                    ${c.email ? `<span>${escapeHtml(c.email)}</span>` : ''}
                                    ${c.telefono ? `<span class="contacto-tel">${escapeHtml(c.telefono)}</span>` : ''}
                                </div>
                            </div>
                            <div class="task-actions" style="flex-shrink:0">
                                <button class="task-edit-btn" style="opacity:1" onclick="editarContactoDetalle(${i})" title="Editar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="task-delete-btn" style="opacity:1" onclick="eliminarContactoDetalle(${i})" title="Eliminar">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                </button>
                            </div>
                        </div>
                    `).join('')
                    : '<div class="contactos-empty">No hay contactos asociados a este proyecto</div>'
                }
            </div>
        </div>`;
}

function abrirFormContacto() {
    document.getElementById('contacto-form-container').style.display = '';
    document.getElementById('contacto-edit-idx').value = '';
    document.getElementById('contacto-nombre').value = '';
    document.getElementById('contacto-apellidos').value = '';
    document.getElementById('contacto-email').value = '';
    document.getElementById('contacto-puesto').value = '';
    document.getElementById('contacto-telefono').value = '';
    document.getElementById('contacto-nombre').focus();
}

function editarContactoDetalle(idx) {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto || !proyecto.contactos || !proyecto.contactos[idx]) return;
    const c = proyecto.contactos[idx];
    document.getElementById('contacto-form-container').style.display = '';
    document.getElementById('contacto-edit-idx').value = idx;
    document.getElementById('contacto-nombre').value = c.nombre || '';
    document.getElementById('contacto-apellidos').value = c.apellidos || '';
    document.getElementById('contacto-email').value = c.email || '';
    document.getElementById('contacto-puesto').value = c.puesto || '';
    document.getElementById('contacto-telefono').value = c.telefono || '';
    document.getElementById('contacto-nombre').focus();
}

function cerrarFormContacto() {
    document.getElementById('contacto-form-container').style.display = 'none';
}

async function guardarContactoDetalle() {
    const nombre = document.getElementById('contacto-nombre').value.trim();
    const apellidos = document.getElementById('contacto-apellidos').value.trim();
    const email = document.getElementById('contacto-email').value.trim().toLowerCase();
    const puesto = document.getElementById('contacto-puesto').value.trim();
    const telefono = document.getElementById('contacto-telefono').value.trim();

    if (!nombre) {
        document.getElementById('contacto-nombre').focus();
        mostrarToast('El nombre es obligatorio', 'warning');
        return;
    }
    if (!email || !email.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('contacto-email').focus();
        mostrarToast('Email obligatorio y con formato válido', 'warning');
        return;
    }

    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    if (!proyecto.contactos) proyecto.contactos = [];

    const editIdx = document.getElementById('contacto-edit-idx').value;
    const contacto = { nombre, apellidos, email, puesto, telefono };

    if (editIdx !== '') {
        proyecto.contactos[parseInt(editIdx)] = contacto;
    } else {
        proyecto.contactos.push(contacto);
    }

    // Sincronizar participantes (array de emails) para compatibilidad con subtareas
    proyecto.participantes = proyecto.contactos.map(c => c.email);

    guardarProyectosLocal(proyectos);
    try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
    renderDetalleContactos(proyecto);
    mostrarToast('Contacto guardado', 'success');
}

async function eliminarContactoDetalle(idx) {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto || !proyecto.contactos) return;
    mostrarConfirmacion('¿Eliminar este contacto?', async () => {
        proyecto.contactos.splice(idx, 1);
        proyecto.participantes = proyecto.contactos.map(c => c.email);
        guardarProyectosLocal(proyectos);
        try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
        renderDetalleContactos(proyecto);
        mostrarToast('Contacto eliminado', 'success');
    });
}

// Extrae el projectId numérico de una URL de Asana o devuelve el valor si ya es un ID.
function _parseAsanaInput(raw) {
    const v = String(raw || '').trim();
    if (!v) return { id: '', url: '' };
    if (/^\d{6,}$/.test(v)) {
        return { id: v, url: `https://app.asana.com/0/${v}/list` };
    }
    try {
        const u = new URL(v);
        if (!/asana\.com$/i.test(u.hostname)) return { id: '', url: v, error: 'La URL debe ser de app.asana.com' };
        const m = u.pathname.match(/\/(\d{6,})/);
        if (!m) return { id: '', url: v, error: 'No se pudo extraer el ID del proyecto desde la URL' };
        return { id: m[1], url: v };
    } catch (_) {
        return { id: '', url: v, error: 'URL no válida' };
    }
}

async function renderDetalleDesarrollos(proyecto) {
    const container = document.getElementById('detalle-desarrollos');
    const asanaId = proyecto.asanaProjectId || '';
    const asanaUrl = proyecto.asanaProjectUrl || (asanaId ? `https://app.asana.com/0/${asanaId}/list` : '');

    container.innerHTML = `
        <div class="desarrollos-config">
            <div class="form-row" style="align-items:flex-end;flex-wrap:wrap;gap:8px">
                <div class="form-group" style="flex:1;min-width:240px">
                    <label>URL del proyecto en Asana</label>
                    <input type="url" id="asana-project-url" class="form-control" placeholder="https://app.asana.com/0/1234567890/list" value="${escapeHtml(asanaUrl)}">
                    <small class="form-hint">Pega la URL completa del proyecto desde Asana. Se guardará en el proyecto y se usará para listar sus tareas aquí.</small>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:0">
                    <button class="btn btn-primary btn-sm" onclick="vincularAsana()" style="height:38px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        ${asanaId ? 'Actualizar' : 'Vincular'}
                    </button>
                    ${asanaId ? `
                        <a class="btn btn-secondary btn-sm" href="${escapeHtml(asanaUrl)}" target="_blank" rel="noopener" style="height:38px;display:inline-flex;align-items:center;gap:6px">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Abrir en Asana
                        </a>
                        <button class="btn btn-secondary btn-sm" onclick="desvincularAsana()" style="height:38px" title="Desvincular">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
        <div id="asana-tasks-list" class="desarrollos-list">
            ${asanaId ? '<div class="loading-inline"><div class="spinner"></div> Cargando tareas de Asana...</div>' : '<div style="text-align:center;padding:32px;color:var(--text-muted)">Pega la URL del proyecto Asana para ver sus desarrollos</div>'}
        </div>`;

    if (asanaId) {
        const tasks = await obtenerTareasAsana(asanaId);
        const listEl = document.getElementById('asana-tasks-list');
        if (!listEl) return;
        if (tasks.length > 0) {
            listEl.innerHTML = tasks.map(t => `
                <div class="asana-task-row ${t.completed ? 'completed' : ''}">
                    <div class="task-check ${t.completed ? 'checked' : ''}"></div>
                    <span class="task-name ${t.completed ? 'completed' : ''}">${escapeHtml(t.name || t.nombre || '')}</span>
                    <span class="task-date">${t.due_on ? formatearFechaCorta(t.due_on) : '—'}</span>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">No se encontraron tareas o no se pudo conectar con Asana</div>';
        }
    }
}

async function vincularAsana() {
    const input = document.getElementById('asana-project-url').value;
    const parsed = _parseAsanaInput(input);
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;

    if (input.trim() && !parsed.id) {
        mostrarToast(parsed.error || 'No se pudo identificar el proyecto Asana', 'warning');
        return;
    }

    proyecto.asanaProjectId = parsed.id;
    proyecto.asanaProjectUrl = parsed.id ? parsed.url : '';
    guardarProyectosLocal(proyectos);
    try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}

    renderDetalleDesarrollos(proyecto);
    mostrarToast(parsed.id ? 'Proyecto Asana vinculado' : 'Vinculación eliminada', 'success');
}

async function desvincularAsana() {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    mostrarConfirmacion('¿Desvincular el proyecto Asana?', async () => {
        proyecto.asanaProjectId = '';
        proyecto.asanaProjectUrl = '';
        guardarProyectosLocal(proyectos);
        try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
        renderDetalleDesarrollos(proyecto);
        mostrarToast('Vinculación eliminada', 'success');
    });
}

function renderDetalleAnotaciones(proyecto) {
    const anotaciones = proyecto.anotaciones || '';
    const adjuntos = proyecto.adjuntos || [];

    document.getElementById('detalle-anotaciones').innerHTML = `
        <div class="anotaciones-editor">
            <label style="font-weight:600;margin-bottom:8px;display:block">Anotaciones del proyecto</label>
            <textarea id="anotaciones-text" class="form-control anotaciones-textarea" placeholder="Escribe notas, observaciones, acuerdos...">${escapeHtml(anotaciones)}</textarea>

            <div class="adjuntos-section">
                <div class="adjuntos-header">
                    <label style="font-weight:600;display:block">Adjuntos</label>
                    <label class="btn btn-secondary btn-sm adjuntos-upload-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                        Adjuntar archivo
                        <input type="file" id="adjunto-input" accept="image/*,.pdf" multiple style="display:none" onchange="agregarAdjuntos(event)">
                    </label>
                </div>
                <div class="adjuntos-list" id="adjuntos-list">
                    ${adjuntos.length > 0 ? adjuntos.map((adj, i) => renderAdjunto(adj, i)).join('') : '<div class="adjuntos-empty">Sin archivos adjuntos</div>'}
                </div>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-top:12px">
                <button class="btn btn-primary btn-sm" onclick="guardarAnotaciones()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Guardar todo
                </button>
            </div>
        </div>`;
}

function renderAdjunto(adj, index) {
    const isImage = adj.tipo && adj.tipo.startsWith('image/');
    const isPdf = adj.tipo && adj.tipo === 'application/pdf';
    const iconSvg = isPdf
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

    return `
        <div class="adjunto-item">
            ${isImage ? `<div class="adjunto-thumb" onclick="abrirAdjunto(${index})"><img src="${adj.data}" alt="${escapeHtml(adj.nombre)}"></div>` : `<div class="adjunto-icon" onclick="abrirAdjunto(${index})">${iconSvg}</div>`}
            <div class="adjunto-info" onclick="abrirAdjunto(${index})">
                <span class="adjunto-nombre">${escapeHtml(adj.nombre)}</span>
                <span class="adjunto-size">${adj.size ? formatearTamano(adj.size) : ''}</span>
            </div>
            <button class="task-delete-btn" onclick="eliminarAdjunto(${index})" title="Eliminar" style="opacity:1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>`;
}

function formatearTamano(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function agregarAdjuntos(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    if (!proyecto.adjuntos) proyecto.adjuntos = [];

    const maxSize = 5 * 1024 * 1024; // 5MB por archivo
    let procesados = 0;
    const total = files.length;

    for (const file of files) {
        if (file.size > maxSize) {
            mostrarToast(`${file.name} es mayor a 5MB, omitido`, 'warning');
            procesados++;
            continue;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
            proyecto.adjuntos.push({
                id: generarId(),
                nombre: file.name,
                tipo: file.type,
                size: file.size,
                data: e.target.result,
                fecha: new Date().toISOString()
            });
            procesados++;
            if (procesados === total) {
                guardarProyectosLocal(proyectos);
                try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
                renderDetalleAnotaciones(proyecto);
                mostrarToast(`${proyecto.adjuntos.length} adjunto(s) en total`, 'success');
            }
        };
        reader.readAsDataURL(file);
    }

    // Reset input
    event.target.value = '';
}

function eliminarAdjunto(index) {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto || !proyecto.adjuntos) return;
    mostrarConfirmacion('¿Eliminar este adjunto?', async () => {
        proyecto.adjuntos.splice(index, 1);
        guardarProyectosLocal(proyectos);
        try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
        renderDetalleAnotaciones(proyecto);
        mostrarToast('Adjunto eliminado', 'success');
    });
}

function abrirAdjunto(index) {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto || !proyecto.adjuntos || !proyecto.adjuntos[index]) return;
    const adj = proyecto.adjuntos[index];
    const win = window.open('', '_blank');
    if (adj.tipo && adj.tipo.startsWith('image/')) {
        win.document.write(`<html><head><title>${escapeHtml(adj.nombre)}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9"><img src="${adj.data}" style="max-width:100%;max-height:100vh"></body></html>`);
    } else {
        win.document.write(`<html><head><title>${escapeHtml(adj.nombre)}</title></head><body style="margin:0"><iframe src="${adj.data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
    }
}

async function guardarAnotaciones() {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    const texto = document.getElementById('anotaciones-text').value;
    proyecto.anotaciones = texto;
    guardarProyectosLocal(proyectos);
    try {
        await actualizarAnotacionesAPI(proyecto.id, texto).catch(() => {});
    } catch (_) {}
    mostrarToast('Anotaciones guardadas', 'success');
}

function renderSeccion(proyectoId, seccion, seccionIndex) {
    const completadas = seccion.tareas.filter(t => t.completada).length;
    const subtareasTotal = seccion.tareas.reduce((acc, t) => acc + (t.subtareas ? t.subtareas.length : 0), 0);
    const subtareasComp = seccion.tareas.reduce((acc, t) => acc + (t.subtareas ? t.subtareas.filter(s => s.completada).length : 0), 0);
    const total = seccion.tareas.length;
    const totalConSub = total + subtareasTotal;
    const compConSub = completadas + subtareasComp;
    const isOpen = seccion.nombre === 'Planificación de sesiones' || total > 0;

    return `
        <div class="section-block ${isOpen ? 'open' : ''}" id="section-${seccionIndex}"
             data-seccion="${escapeAttr(seccion.nombre)}" data-proyecto="${proyectoId}"
             ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)">
            <div class="section-header" onclick="toggleSeccion(${seccionIndex})">
                <div class="section-header-left">
                    <svg class="section-toggle" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <span class="section-name">${escapeHtml(seccion.nombre)}</span>
                </div>
                <span class="section-count">${compConSub}/${totalConSub}</span>
            </div>
            <div class="section-body" data-seccion="${escapeAttr(seccion.nombre)}">
                ${total > 0 ? `
                    <div class="task-header-row">
                        <span></span>
                        <span></span>
                        <span>Tarea</span>
                        <span>Estado</span>
                        <span>Reunion</span>
                        <span>Tiempo</span>
                        <span></span>
                    </div>
                    ${seccion.tareas.map(tarea => renderTareaRow(proyectoId, seccion.nombre, tarea)).join('')}
                ` : ''}
                <div class="section-add-task">
                    <button onclick="agregarTarea('${proyectoId}', '${escapeAttr(seccion.nombre)}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Agregar tarea
                    </button>
                </div>
            </div>
        </div>`;
}

function renderTareaRow(proyectoId, seccionNombre, tarea) {
    const subtareas = tarea.subtareas || [];
    const subCount = subtareas.length;
    const subCompleted = subtareas.filter(s => s.completada).length;
    const hasSubtareas = subCount > 0;

    // Estado derivado: terminado solo si tiene subtareas y TODAS estan completadas
    const estaTerminada = hasSubtareas ? (subCount === subCompleted) : tarea.completada;
    const estadoClass = hasSubtareas
        ? (estaTerminada ? 'terminado' : 'no-terminado')
        : (tarea.completada ? 'terminado' : 'none');
    const estadoText = hasSubtareas
        ? (estaTerminada ? 'Terminado' : 'No terminado')
        : (tarea.completada ? 'Terminado' : '—');

    return `
        <div class="task-row" draggable="true"
             data-tarea-id="${tarea.id}" data-seccion="${escapeAttr(seccionNombre)}" data-proyecto="${proyectoId}"
             ondragstart="onDragStart(event)" ondragend="onDragEnd(event)">
            <span class="drag-handle" title="Arrastrar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>
            </span>
            <div class="task-check ${estaTerminada ? 'checked' : ''}"
                 onclick="toggleTareaCompletada('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')"></div>
            <span class="task-name clickable ${estaTerminada ? 'completed' : ''}" onclick="abrirModalTarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')">
                ${escapeHtml(tarea.nombre)}
                ${hasSubtareas ? `<span class="subtask-count">${subCompleted}/${subCount}</span>` : ''}
            </span>
            <span class="task-estado-badge ${estadoClass}">${estadoText}</span>
            <span class="task-date">${tarea.fechaEntrega ? formatearFechaCorta(tarea.fechaEntrega) : '—'}</span>
            <span class="task-time">${tarea.tiempoEstimado ? tarea.tiempoEstimado + ' min' : '—'}</span>
            <div class="task-actions">
                <button class="task-subtask-btn" onclick="event.stopPropagation(); abrirModalSubtarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')" title="Agregar subtarea">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="task-edit-btn" onclick="abrirModalTarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="task-delete-btn" onclick="event.stopPropagation(); eliminarTarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')" title="Eliminar tarea">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        </div>
        ${hasSubtareas ? `<div class="subtask-container">${subtareas.map(sub => renderSubtareaRow(proyectoId, seccionNombre, tarea.id, sub)).join('')}</div>` : ''}`;
}

function renderSubtareaRow(proyectoId, seccionNombre, tareaId, subtarea) {
    const partCount = (subtarea.participantes || []).length;
    const agendado = subtarea.agendado;

    return `
        <div class="subtask-row">
            <span class="subtask-indent">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"><polyline points="9 6 15 12 9 18"/></svg>
            </span>
            <div class="task-check ${subtarea.completada ? 'checked' : ''}"
                 onclick="toggleSubtareaCompletada('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tareaId}', '${subtarea.id}')"></div>
            <span class="task-name clickable ${subtarea.completada ? 'completed' : ''}" onclick="abrirModalSubtarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tareaId}', '${subtarea.id}')">
                ${escapeHtml(subtarea.nombre)}
                ${partCount > 0 ? `<span class="subtask-participantes-badge" title="${(subtarea.participantes||[]).join(', ')}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    ${partCount}
                </span>` : ''}
                ${agendado ? `<span class="subtask-calendar-badge" title="Agendado en Calendar">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </span>` : ''}
            </span>
            <span class="task-date">${subtarea.fechaEntrega ? formatearFechaCorta(subtarea.fechaEntrega) : '—'}</span>
            <span class="task-time">${subtarea.tiempoEstimado ? subtarea.tiempoEstimado + ' min' : '—'}</span>
            <div class="task-actions">
                <button class="task-edit-btn" onclick="abrirModalSubtarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tareaId}', '${subtarea.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="task-delete-btn" onclick="event.stopPropagation(); eliminarSubtarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tareaId}', '${subtarea.id}')" title="Eliminar subtarea">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        </div>`;
}

function toggleSeccion(index) {
    const block = document.getElementById('section-' + index);
    block.classList.toggle('open');
}

// ==========================================
// TASK OPERATIONS
// ==========================================

async function toggleTareaCompletada(proyectoId, seccionNombre, tareaId) {
    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;
    const tarea = seccion.tareas.find(t => t.id === tareaId);
    if (!tarea) return;

    // Si tiene subtareas, no se puede cambiar manualmente — es estado derivado
    if (tarea.subtareas && tarea.subtareas.length > 0) {
        mostrarAviso('Esta tarea se completa automaticamente cuando todas sus subtareas esten terminadas');
        return;
    }

    tarea.completada = !tarea.completada;

    try {
        await actualizarTareaAPI(proyectoId, seccionNombre, tarea);
        guardarProyectosLocal(proyectos);
    } catch (err) {
        tarea.completada = !tarea.completada; // revert
        mostrarToast('Error al actualizar tarea: ' + err.message, 'error');
    }
    abrirDetalle(proyectoId);
    refrescarTodo();
}

function eliminarTarea(proyectoId, seccionNombre, tareaId) {
    mostrarConfirmacion('¿Eliminar esta tarea y sus subtareas?', async () => {
        const proyecto = proyectos.find(p => p.id === proyectoId);
        if (!proyecto) return;
        const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
        if (!seccion) return;
        seccion.tareas = seccion.tareas.filter(t => t.id !== tareaId);
        guardarProyectosLocal(proyectos);
        try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}
        abrirDetalle(proyectoId);
        refrescarTodo();
        mostrarToast('Tarea eliminada', 'success');
    });
}

function eliminarSubtarea(proyectoId, seccionNombre, tareaId, subtareaId) {
    mostrarConfirmacion('¿Eliminar esta subtarea?', async () => {
        const proyecto = proyectos.find(p => p.id === proyectoId);
        if (!proyecto) return;
        const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
        if (!seccion) return;
        const tarea = seccion.tareas.find(t => t.id === tareaId);
        if (!tarea || !tarea.subtareas) return;
        tarea.subtareas = tarea.subtareas.filter(s => s.id !== subtareaId);
        // Recalcular estado padre
        tarea.completada = tarea.subtareas.length > 0 && tarea.subtareas.every(s => s.completada);
        guardarProyectosLocal(proyectos);
        try { await actualizarTareaAPI(proyectoId, seccionNombre, tarea).catch(() => {}); } catch (_) {}
        abrirDetalle(proyectoId);
        refrescarTodo();
        mostrarToast('Subtarea eliminada', 'success');
    });
}

// Abre el modal-confirm en modo aviso (solo "Entendido"). Siempre deja el
// botón en su estado por defecto al cerrar para no contaminar la próxima
// confirmación de borrado.
function mostrarAviso(mensaje) {
    _configurarBotonConfirm('Entendido', 'btn btn-primary', () => cerrarModal('modal-confirm'));
    document.getElementById('confirm-mensaje').textContent = mensaje;
    abrirModal('modal-confirm');
}

// Helper interno para resetear el estado del botón del modal-confirm tras su uso.
function _configurarBotonConfirm(texto, clase, onClick) {
    const btn = document.getElementById('confirm-btn');
    btn.textContent = texto;
    btn.className = clase;
    btn.onclick = (e) => {
        try { onClick(e); } finally { _resetBotonConfirm(); }
    };
}

function _resetBotonConfirm() {
    const btn = document.getElementById('confirm-btn');
    if (!btn) return;
    btn.textContent = 'Eliminar';
    btn.className = 'btn btn-danger';
    btn.onclick = null;
}

function abrirModalTarea(proyectoId, seccionNombre, tareaId) {
    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;
    const tarea = seccion.tareas.find(t => t.id === tareaId);
    if (!tarea) return;

    // Populate section dropdown
    const selectSeccion = document.getElementById('tarea-seccion-destino');
    selectSeccion.innerHTML = proyecto.secciones.map(s =>
        `<option value="${escapeAttr(s.nombre)}" ${s.nombre === seccionNombre ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`
    ).join('');

    document.getElementById('modal-tarea-titulo').textContent = 'Editar Tarea';
    document.getElementById('tarea-proyecto-id').value = proyectoId;
    document.getElementById('tarea-seccion-nombre').value = seccionNombre;
    document.getElementById('tarea-id').value = tareaId;
    document.getElementById('tarea-nombre').value = tarea.nombre;
    document.getElementById('tarea-fecha').value = tarea.fechaEntrega || '';
    document.getElementById('tarea-tiempo').value = tarea.tiempoEstimado || '';
    document.getElementById('tarea-notas').value = tarea.notas || '';

    abrirModal('modal-tarea');
}

async function guardarTarea() {
    const proyectoId = document.getElementById('tarea-proyecto-id').value;
    const seccionNombre = document.getElementById('tarea-seccion-nombre').value;
    const seccionDestino = document.getElementById('tarea-seccion-destino').value || seccionNombre;
    const tareaId = document.getElementById('tarea-id').value;
    const nombre = document.getElementById('tarea-nombre').value.trim();
    const fechaEntrega = document.getElementById('tarea-fecha').value || null;
    const tiempoEstimado = parseInt(document.getElementById('tarea-tiempo').value) || null;
    const notas = document.getElementById('tarea-notas').value.trim();

    if (!nombre) {
        document.getElementById('tarea-nombre').focus();
        return;
    }

    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;

    // Handle section move
    if (tareaId && seccionDestino !== seccionNombre) {
        showLoading();
        try {
            moverTareaEntreSecciones(proyecto, tareaId, seccionNombre, seccionDestino);
            await moverTareaAPI(proyectoId, tareaId, seccionNombre, seccionDestino).catch(() => {});
            const destSec = proyecto.secciones.find(s => s.nombre === seccionDestino);
            const tareaMovida = destSec ? destSec.tareas.find(t => t.id === tareaId) : null;
            if (tareaMovida) {
                tareaMovida.nombre = nombre;
                tareaMovida.fechaEntrega = fechaEntrega;
                tareaMovida.tiempoEstimado = tiempoEstimado;
                tareaMovida.notas = notas;
                await actualizarTareaAPI(proyectoId, seccionDestino, tareaMovida).catch(() => {});
            }
            guardarProyectosLocal(proyectos);
            cerrarModal('modal-tarea');
            abrirDetalle(proyectoId);
            refrescarTodo();
            mostrarToast('Tarea movida a ' + seccionDestino, 'success');
        } catch (err) {
            mostrarToast('Error al mover tarea: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
        return;
    }

    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;

    showLoading();
    try {
        if (tareaId) {
            const tarea = seccion.tareas.find(t => t.id === tareaId);
            if (tarea) {
                tarea.nombre = nombre;
                tarea.fechaEntrega = fechaEntrega;
                tarea.tiempoEstimado = tiempoEstimado;
                tarea.notas = notas;
                // completada se deriva de subtareas, no se cambia manualmente aqui
                await actualizarTareaAPI(proyectoId, seccionNombre, tarea);
            }
        } else {
            const nuevaTarea = {
                id: generarId(),
                nombre,
                completada: false,
                fechaEntrega,
                tiempoEstimado,
                notas,
                subtareas: []
            };
            seccion.tareas.push(nuevaTarea);
            await actualizarTareaAPI(proyectoId, seccionNombre, nuevaTarea);
        }

        guardarProyectosLocal(proyectos);
        cerrarModal('modal-tarea');
        abrirDetalle(proyectoId);
        refrescarTodo();
        mostrarToast('Tarea guardada', 'success');
    } catch (err) {
        mostrarToast('Error al guardar tarea: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function agregarTarea(proyectoId, seccionNombre) {
    const proyecto = proyectos.find(p => p.id === proyectoId);

    // Populate section dropdown
    const selectSeccion = document.getElementById('tarea-seccion-destino');
    if (proyecto) {
        selectSeccion.innerHTML = proyecto.secciones.map(s =>
            `<option value="${escapeAttr(s.nombre)}" ${s.nombre === seccionNombre ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`
        ).join('');
    }

    document.getElementById('modal-tarea-titulo').textContent = 'Nueva Tarea';
    document.getElementById('tarea-proyecto-id').value = proyectoId;
    document.getElementById('tarea-seccion-nombre').value = seccionNombre;
    document.getElementById('tarea-id').value = '';
    document.getElementById('tarea-nombre').value = '';
    document.getElementById('tarea-fecha').value = '';
    document.getElementById('tarea-tiempo').value = '';
    document.getElementById('tarea-notas').value = '';

    abrirModal('modal-tarea');
    document.getElementById('tarea-nombre').focus();
}

// ==========================================
// CONFIRM DIALOG
// ==========================================

function mostrarConfirmacion(mensaje, callback) {
    _configurarBotonConfirm('Eliminar', 'btn btn-danger', () => {
        cerrarModal('modal-confirm');
        callback();
    });
    document.getElementById('confirm-mensaje').textContent = mensaje;
    abrirModal('modal-confirm');
}

// ==========================================
// RESET
// ==========================================

// Botón peligroso: sobreescribe todos los proyectos con DATOS_EJEMPLO.
// Se pide doble confirmación para evitar que alguien lo pulse por error
// en producción (los datos de ejemplo son nombres de clientes ficticios).
function resetearYRecargar() {
    mostrarConfirmacion('¿Resetear todos los datos a los valores de ejemplo? Esta acción NO se puede deshacer.', () => {
        const confirmacion = prompt('Escribe exactamente RESET para confirmar:');
        if (confirmacion !== 'RESET') {
            mostrarToast('Reset cancelado', 'warning');
            return;
        }
        (async () => {
            showLoading();
            try {
                proyectos = await resetearDatosAPI();
                refrescarTodo();
                mostrarToast('Datos reseteados correctamente', 'success');
            } catch (err) {
                mostrarToast('Error al resetear: ' + err.message, 'error');
            } finally {
                hideLoading();
            }
        })();
    });
}

// ==========================================
// PARTICIPANTES (Project modal)
// ==========================================

function agregarParticipanteProyecto() {
    const input = document.getElementById('proyecto-participante-input');
    const email = input.value.trim().toLowerCase();
    if (!email || !email.includes('@')) { input.focus(); return; }
    if (window._proyectoParticipantes.includes(email)) {
        mostrarToast('Email ya agregado', 'warning');
        input.value = '';
        input.focus();
        return;
    }
    window._proyectoParticipantes.push(email);
    input.value = '';
    renderParticipantesChips();
    input.focus();
}

function quitarParticipanteProyecto(idx) {
    window._proyectoParticipantes.splice(idx, 1);
    renderParticipantesChips();
}

function renderParticipantesChips() {
    const container = document.getElementById('proyecto-participantes-chips');
    if (!container) return;
    const list = window._proyectoParticipantes || [];
    container.innerHTML = list.length > 0
        ? list.map((email, i) => `<span class="participante-chip">${escapeHtml(email)}<button onclick="quitarParticipanteProyecto(${i})">&times;</button></span>`).join('')
        : '<span style="font-size:12px;color:var(--text-muted)">Sin participantes</span>';
}

// ==========================================
// DRAG & DROP
// ==========================================

let dragData = null;

function onDragStart(e) {
    const row = e.target.closest('.task-row');
    if (!row) return;
    dragData = {
        tareaId: row.dataset.tareaId,
        seccion: row.dataset.seccion,
        proyecto: row.dataset.proyecto
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.tareaId);
    row.classList.add('dragging');
}

function onDragEnd(e) {
    const row = e.target.closest('.task-row');
    if (row) row.classList.remove('dragging');
    document.querySelectorAll('.section-block.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragData = null;
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
    e.preventDefault();
    const block = e.target.closest('.section-block');
    if (block && dragData) {
        block.classList.add('drag-over');
        // Auto-open collapsed sections
        if (!block.classList.contains('open')) {
            block.classList.add('open');
        }
    }
}

function onDragLeave(e) {
    const block = e.target.closest('.section-block');
    if (block && !block.contains(e.relatedTarget)) {
        block.classList.remove('drag-over');
    }
}

async function onDrop(e) {
    e.preventDefault();
    const block = e.target.closest('.section-block');
    if (!block || !dragData) return;
    block.classList.remove('drag-over');

    const seccionDestino = block.dataset.seccion;
    const seccionOrigen = dragData.seccion;
    const tareaId = dragData.tareaId;
    const proyectoId = dragData.proyecto;

    if (seccionOrigen === seccionDestino) return;

    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;

    const moved = moverTareaEntreSecciones(proyecto, tareaId, seccionOrigen, seccionDestino);
    if (!moved) return;

    try {
        await moverTareaAPI(proyectoId, tareaId, seccionOrigen, seccionDestino).catch(() => {});
        guardarProyectosLocal(proyectos);
        mostrarToast('Tarea movida a ' + seccionDestino, 'success');
    } catch (err) {
        // Revert
        moverTareaEntreSecciones(proyecto, tareaId, seccionDestino, seccionOrigen);
        mostrarToast('Error al mover: ' + err.message, 'error');
    }

    abrirDetalle(proyectoId);
    refrescarTodo();
}

// ==========================================
// SUBTASK OPERATIONS
// ==========================================

function abrirModalSubtarea(proyectoId, seccionNombre, tareaId, subtareaId) {
    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;
    const tarea = seccion.tareas.find(t => t.id === tareaId);
    if (!tarea) return;

    document.getElementById('subtarea-proyecto-id').value = proyectoId;
    document.getElementById('subtarea-seccion-nombre').value = seccionNombre;
    document.getElementById('subtarea-tarea-id').value = tareaId;

    // Populate participantes checkboxes from project
    const partContainer = document.getElementById('subtarea-participantes');
    const partList = proyecto.participantes || [];
    partContainer.innerHTML = partList.length > 0
        ? partList.map(email => `<label class="participante-check-item"><input type="checkbox" value="${escapeHtml(email)}" class="sub-part-cb"> ${escapeHtml(email)}</label>`).join('')
        : '<span style="font-size:12px;color:var(--text-muted)">Agrega participantes al proyecto primero</span>';

    // Reset del checkbox de agendar y su label (por defecto editable, sin hint).
    // Solo tocamos el text node con contenido visible — antes pisábamos también
    // el whitespace previo al input, lo que duplicaba el texto a ambos lados
    // del checkbox al reabrir el modal.
    const agendarCb = document.getElementById('subtarea-agendar');
    const agendarLabel = agendarCb.parentElement;
    agendarCb.checked = false;
    agendarCb.disabled = false;
    agendarLabel.querySelector('.subtarea-agendada-hint')?.remove();
    agendarLabel.childNodes.forEach(n => {
        if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ' Agendar en Google Calendar';
    });

    if (subtareaId) {
        const subtarea = (tarea.subtareas || []).find(s => s.id === subtareaId);
        if (!subtarea) return;
        document.getElementById('modal-subtarea-titulo').textContent = 'Editar Subtarea';
        document.getElementById('subtarea-id').value = subtareaId;
        document.getElementById('subtarea-nombre').value = subtarea.nombre;
        document.getElementById('subtarea-fecha').value = subtarea.fechaEntrega || '';
        document.getElementById('subtarea-tiempo').value = subtarea.tiempoEstimado || '';
        document.getElementById('subtarea-completada').value = subtarea.completada ? 'true' : 'false';
        document.getElementById('subtarea-notas').value = subtarea.notas || '';
        // Check participantes
        const subPart = subtarea.participantes || [];
        partContainer.querySelectorAll('.sub-part-cb').forEach(cb => { cb.checked = subPart.includes(cb.value); });
        // Si ya está agendada, evitar duplicar: deshabilitar checkbox y mostrar hint
        if (subtarea.agendado) {
            agendarCb.disabled = true;
            agendarLabel.childNodes.forEach(n => {
                if (n.nodeType === 3 && n.textContent.trim()) n.textContent = ' Ya agendada en Google Calendar';
            });
            const hint = document.createElement('span');
            hint.className = 'subtarea-agendada-hint';
            hint.textContent = ' ✓';
            hint.style.color = 'var(--success, #059669)';
            hint.style.marginLeft = '4px';
            hint.style.fontWeight = '700';
            agendarLabel.appendChild(hint);
        }
    } else {
        document.getElementById('modal-subtarea-titulo').textContent = 'Nueva Subtarea';
        document.getElementById('subtarea-id').value = '';
        document.getElementById('subtarea-nombre').value = '';
        document.getElementById('subtarea-fecha').value = '';
        document.getElementById('subtarea-tiempo').value = '';
        document.getElementById('subtarea-completada').value = 'false';
        document.getElementById('subtarea-notas').value = '';
        partContainer.querySelectorAll('.sub-part-cb').forEach(cb => { cb.checked = false; });
        document.getElementById('subtarea-agendar').checked = false;
    }

    abrirModal('modal-subtarea');
    document.getElementById('subtarea-nombre').focus();
}

async function guardarSubtarea() {
    const proyectoId = document.getElementById('subtarea-proyecto-id').value;
    const seccionNombre = document.getElementById('subtarea-seccion-nombre').value;
    const tareaId = document.getElementById('subtarea-tarea-id').value;
    const subtareaId = document.getElementById('subtarea-id').value;
    const nombre = document.getElementById('subtarea-nombre').value.trim();
    const fechaEntrega = document.getElementById('subtarea-fecha').value || null;
    const tiempoEstimado = parseInt(document.getElementById('subtarea-tiempo').value) || null;
    const completada = document.getElementById('subtarea-completada').value === 'true';
    const notas = document.getElementById('subtarea-notas').value.trim();
    const participantesSeleccionados = [...document.querySelectorAll('.sub-part-cb:checked')].map(cb => cb.value);
    const agendar = document.getElementById('subtarea-agendar').checked;

    if (!nombre) {
        document.getElementById('subtarea-nombre').focus();
        return;
    }

    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;
    const tarea = seccion.tareas.find(t => t.id === tareaId);
    if (!tarea) return;
    if (!tarea.subtareas) tarea.subtareas = [];

    showLoading();
    try {
        let subtareaObj;
        if (subtareaId) {
            subtareaObj = tarea.subtareas.find(s => s.id === subtareaId);
            if (subtareaObj) {
                subtareaObj.nombre = nombre;
                subtareaObj.fechaEntrega = fechaEntrega;
                subtareaObj.tiempoEstimado = tiempoEstimado;
                subtareaObj.completada = completada;
                subtareaObj.notas = notas;
                subtareaObj.participantes = participantesSeleccionados;
            }
        } else {
            subtareaObj = {
                id: generarId(),
                nombre,
                completada,
                fechaEntrega,
                tiempoEstimado,
                notas,
                participantes: participantesSeleccionados,
                agendado: false
            };
            tarea.subtareas.push(subtareaObj);
        }

        // Derivar estado de la tarea padre
        tarea.completada = tarea.subtareas.length > 0 && tarea.subtareas.every(s => s.completada);

        await actualizarTareaAPI(proyectoId, seccionNombre, tarea);
        guardarProyectosLocal(proyectos);

        // Agendar en Calendar si se marcó
        if (agendar && subtareaObj && fechaEntrega) {
            try {
                await crearEventoCalendarAPI({
                    proyectoId,
                    cliente: proyecto.cliente,
                    tarea: tarea.nombre,
                    subtarea: subtareaObj.nombre,
                    fecha: fechaEntrega,
                    tiempoEstimado: tiempoEstimado || 60,
                    participantes: participantesSeleccionados
                });
                subtareaObj.agendado = true;
                guardarProyectosLocal(proyectos);
                mostrarToast('Subtarea guardada y agendada en Calendar', 'success');
            } catch (calErr) {
                mostrarToast('Subtarea guardada, pero error al agendar: ' + calErr.message, 'warning');
            }
        } else {
            mostrarToast('Subtarea guardada', 'success');
        }

        cerrarModal('modal-subtarea');
        abrirDetalle(proyectoId);
        refrescarTodo();
    } catch (err) {
        mostrarToast('Error al guardar subtarea: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

async function toggleSubtareaCompletada(proyectoId, seccionNombre, tareaId, subtareaId) {
    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;
    const tarea = seccion.tareas.find(t => t.id === tareaId);
    if (!tarea || !tarea.subtareas) return;
    const sub = tarea.subtareas.find(s => s.id === subtareaId);
    if (!sub) return;

    sub.completada = !sub.completada;

    // Derivar estado de la tarea padre: terminada solo si TODAS las subtareas estan completadas
    const todasCompletadas = tarea.subtareas.length > 0 && tarea.subtareas.every(s => s.completada);
    tarea.completada = todasCompletadas;

    try {
        await actualizarTareaAPI(proyectoId, seccionNombre, tarea);
        guardarProyectosLocal(proyectos);
    } catch (err) {
        sub.completada = !sub.completada; // revert
        tarea.completada = !todasCompletadas; // revert
        mostrarToast('Error al actualizar subtarea: ' + err.message, 'error');
    }
    abrirDetalle(proyectoId);
    refrescarTodo();
}

// ==========================================
// BADGE SIN ASIGNAR
// ==========================================

async function actualizarBadgeSinAsignar() {
    const badge = document.getElementById('badge-sinasignar');
    if (!badge) return;
    try {
        const res = await fetch(WEBHOOK_ALTAS, { method: 'GET', headers: getAuthHeaders() });
        if (!res.ok) return;
        let data = {};
        try { data = await res.json(); } catch (_) {}
        const raw = Array.isArray(data) ? data
            : Array.isArray(data.clientes) ? data.clientes
            : Array.isArray(data.data) ? data.data : [];
        const todas = raw.map(normalizarAlta).filter(a => a.nombre);
        const nombresExistentes = new Set(proyectos.map(p => normalizarNombreCliente(p.cliente)));
        const sinAsignar = todas.filter(a => !nombresExistentes.has(normalizarNombreCliente(a.nombre)));
        badge.textContent = sinAsignar.length > 0 ? sinAsignar.length : '';
    } catch (_) {}
}

// ==========================================
// UTILS
// ==========================================

function escapeHtml(text) {
    // Delegamos en config.js (escapa también < > " ')
    return (window.YurestConfig && window.YurestConfig.escHtml)
        ? window.YurestConfig.escHtml(text)
        : String(text == null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escape para strings inyectados en literales JS dentro de atributos HTML
// (p.ej. onclick="fn('...')"). Evita romper comillas + XSS por payload.
function escapeAttr(text) {
    return (window.YurestConfig && window.YurestConfig.escJsInAttr)
        ? window.YurestConfig.escJsInAttr(text)
        : String(text == null ? '' : text)
            .replace(/\\/g, '\\\\').replace(/'/g, '\\x27').replace(/"/g, '&quot;')
            .replace(/</g, '\\x3c').replace(/>/g, '\\x3e');
}

function capitalizar(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '—';
    const fecha = new Date(fechaStr + 'T00:00:00');
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatearFechaCorta(fechaStr) {
    if (!fechaStr) return '—';
    const fecha = new Date(fechaStr + 'T00:00:00');
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function mostrarToast(mensaje, tipo = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    const iconMap = {
        success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `<span class="toast-icon">${iconMap[tipo] || iconMap.info}</span><span class="toast-msg">${escapeHtml(mensaje)}</span>`;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

// ==========================================
// LOADING OVERLAY
// ==========================================

function showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}
