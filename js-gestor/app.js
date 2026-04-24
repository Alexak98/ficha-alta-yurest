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
        `<label class="filter-check-item"><input type="checkbox" value="${estado}" class="filtro-estado-cb" onchange="aplicarFiltros()"> ${labelEstadoProyecto(estado)}</label>`
    ).join('');

    const proyImpl = document.getElementById('proyecto-implementador');
    IMPLEMENTADORES.forEach(impl => {
        proyImpl.innerHTML += `<option value="${impl}">${impl}</option>`;
    });

    // El campo proyecto-tipo es un input readonly que se rellena desde la ficha del cliente.
    // No se popula con opciones aquí.

    const proyEstado = document.getElementById('proyecto-estado');
    ESTADOS_PROYECTO.forEach(estado => {
        proyEstado.innerHTML += `<option value="${estado}">${labelEstadoProyecto(estado)}</option>`;
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
                <span class="card-estado estado-${proyecto.estado}">${escapeHtml(labelEstadoProyecto(proyecto.estado))}</span>
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
        // Snapshot del estado previo para detectar cambios y registrarlos
        const snapshotPrev = {
            cliente:       proyectoPrev.cliente,
            implementador: proyectoPrev.implementador,
            estado:        proyectoPrev.estado,
            fechaInicio:   proyectoPrev.fechaInicio
        };

        proyectoPrev.cliente = cliente;
        proyectoPrev.implementador = implementador;
        proyectoPrev.tipo = tipo;
        proyectoPrev.estado = estado;
        proyectoPrev.fechaInicio = fechaInicio;
        proyectoPrev.tpv = tpv;
        proyectoPrev.participantes = window._proyectoParticipantes || [];
        await actualizarProyectoAPI(proyectoPrev);

        guardarProyectosLocal(proyectos);

        // Audit log de cambio de estado (prioritario) y de otros campos.
        if (window.YurestConfig && YurestConfig.logProyectoHistorial) {
            const cambios = YurestConfig.computeDiff(snapshotPrev, {
                cliente, implementador, estado, fechaInicio
            }, []);
            if (snapshotPrev.estado !== estado) {
                // Acción específica según el nuevo estado
                const accionEstado =
                    estado === 'pausado'    ? 'proyecto_pausado' :
                    estado === 'completado' ? 'proyecto_completado' :
                    estado === 'activo' && snapshotPrev.estado === 'pausado' ? 'proyecto_reanudado' :
                    'proyecto_actualizado';
                YurestConfig.logProyectoHistorial({
                    proyecto_id: proyectoPrev.id,
                    accion: accionEstado,
                    // Usamos el label humano en la descripción del historial
                    // para que Timeline lea "Estado: Activo → Finalizado"
                    // en vez de los slugs internos.
                    descripcion: `Estado: ${labelEstadoProyecto(snapshotPrev.estado) || '—'} → ${labelEstadoProyecto(estado)}`,
                    cambios: { estado: { before: snapshotPrev.estado, after: estado } },
                    metadata: { cliente: proyectoPrev.cliente || '' }
                });
            } else if (Object.keys(cambios).length > 0) {
                YurestConfig.logProyectoHistorial({
                    proyecto_id: proyectoPrev.id,
                    accion: 'proyecto_actualizado',
                    descripcion: `Editados ${Object.keys(cambios).length} campo${Object.keys(cambios).length === 1 ? '' : 's'}`,
                    cambios
                });
            }
        }

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
            // Marcar tombstone local: si el backend tarda en propagar el
            // soft-delete (o falla en silencio), la UI seguirá viendo el
            // proyecto como eliminado en todas las páginas.
            marcarProyectoEliminadoLocal(id);
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

    // Lista de todos los IDs de panel para resetear visibilidad de golpe.
    // Actualizar aquí al añadir una pestaña nueva; así evitamos ir olvidando
    // el display:none en cada sitio.
    const PANEL_IDS = [
        'detalle-proyecto',
        'detalle-hardware',
        'detalle-tareas',
        'detalle-formularios',
        'detalle-contactos',
        'detalle-desarrollos',
        'detalle-anotaciones',
        'detalle-timeline'
    ];

    // Solo resetear tabs si es la primera apertura (o cambio de proyecto).
    // La pestaña por defecto ahora es "Proyecto" (primera en el orden).
    if (!yaAbierto) {
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        const defTab = document.querySelector('.detail-tab[data-dtab="proyecto"]');
        if (defTab) defTab.classList.add('active');
        PANEL_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = id === 'detalle-proyecto' ? '' : 'none';
        });
    }

    // Re-render sólo el tab activo para preservar el contexto del usuario
    const tabActivo = document.querySelector('.detail-tab.active')?.dataset.dtab || 'proyecto';
    if (tabActivo === 'proyecto')         renderDetalleProyecto(proyecto);
    else if (tabActivo === 'hardware')    renderDetalleHardware(proyecto);
    else if (tabActivo === 'tareas')      renderDetalleTareas(proyecto);
    else if (tabActivo === 'formularios') renderDetalleFormularios(proyecto);
    else if (tabActivo === 'contactos')   renderDetalleContactos(proyecto);
    else if (tabActivo === 'desarrollos') renderDetalleDesarrollos(proyecto);
    else if (tabActivo === 'anotaciones') renderDetalleAnotaciones(proyecto);
    else if (tabActivo === 'timeline')    renderDetalleTimeline(proyecto);

    if (!yaAbierto) abrirModal('modal-detalle');
}

// Secciones que vive cada pestaña. Se comparan sin diacríticos ni mayúsculas
// para ser tolerantes a variaciones históricas ("Puesta en Marcha/Finalización"
// con o sin acento, etc.).
const _SECC_TAREAS_SET = new Set([
    _normTxt('Puesta en Marcha / Finalización'),
    _normTxt('Carga de Datos Yuload')
]);
const _SECC_HARDWARE_SET = new Set([
    _normTxt('Hardware')
]);
function _normTxt(s) {
    return String(s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function _esSeccionTareas(nombre)   { return _SECC_TAREAS_SET.has(_normTxt(nombre)); }
function _esSeccionHardware(nombre) { return _SECC_HARDWARE_SET.has(_normTxt(nombre)); }

// Cabecera común (implementador / tipo / estado / progreso / TPV / participantes)
// + panel de pausa si aplica. La usamos tanto en el tab Proyecto como en Tareas
// para que el usuario vea el contexto sin saltar entre pestañas.
function _renderCabeceraProyecto(proyecto) {
    const color = COLORES_IMPLEMENTADOR[proyecto.implementador] || '#6366f1';
    const iniciales = INICIALES_IMPLEMENTADOR[proyecto.implementador] || '??';
    const resumen = obtenerResumenProyecto(proyecto);
    const ultimaSesion = obtenerUltimaSesionAgendada(proyecto);
    return `
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
                    <span class="card-estado estado-${proyecto.estado}">${escapeHtml(labelEstadoProyecto(proyecto.estado))}</span>
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
            <!-- TPV: valor vivo leído desde fichas_alta en cada render.
                 Antes se pintaba proyecto.tpv (snapshot al crear), y si
                 el comercial lo actualizaba en la ficha después, el
                 proyecto seguía mostrando el valor viejo (o "Sin TPV"
                 si la ficha aún no lo tenía). Mismo patrón que el
                 badge de Integración financiera: placeholder con clase
                 compartida + rellenado asíncrono vía obtenerFichaPorCliente. -->
            <div class="detail-field">
                <span class="detail-label">Integracion TPV</span>
                <span class="detail-value det-tpv" data-proyecto-id="${proyecto.id}">
                    ${proyecto.tpv ? `<span class="detail-tpv-badge">${escapeHtml(proyecto.tpv)}</span>` : '<span style="color:var(--text-muted)">Cargando…</span>'}
                </span>
            </div>
            <!-- Integración financiera (Sage / A3 / No aplica). El valor
                 lo tiene la ficha (fichas_alta.integracion_financiera) y lo
                 resolvemos asíncronamente vía obtenerFichaPorCliente +
                 caché. Usamos clase (no id) porque la cabecera se dibuja
                 en DOS pestañas (Proyecto y Tareas) — usar el mismo id
                 daría duplicado y document.getElementById solo devolvería
                 el primero. El helper _poblarIntegracionFinanciera itera
                 todos los matches con querySelectorAll. -->
            <div class="detail-field">
                <span class="detail-label">Integración financiera</span>
                <span class="detail-value det-intfin" data-proyecto-id="${proyecto.id}">
                    <span style="color:var(--text-muted)">Cargando…</span>
                </span>
            </div>
            <!-- Tiempo teórico vs real: suma tiempoEstimado y tiempoReal
                 de todas las subtareas. El helper _sumaTiemposProyecto()
                 devuelve ambos totales + % de desviación. -->
            <div class="detail-field">
                <span class="detail-label">Tiempo (est / real)</span>
                <span class="detail-value">${_renderTiemposBadge(proyecto)}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">Calendario</span>
                <span class="detail-value">
                    <button type="button" class="btn btn-secondary btn-calendario" onclick="abrirCalendarioProyecto('${proyecto.id}')" title="Ver calendario de subtareas">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Ver calendario
                    </button>
                </span>
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
        ` : ''}`;
}

// Rellena los spans de cabecera que dependen de la ficha:
//   · .det-intfin → badge de integración financiera (Sage / A3 / no aplica)
//   · .det-tpv    → badge del TPV del cliente
// Se resuelve la ficha una sola vez vía caché (obtenerFichaPorCliente) y
// se actualizan ambos spans de una tacada. Best-effort: si la ficha no
// está disponible, los spans quedan con su fallback.
//
// Se usan clases (no ids) porque la cabecera se dibuja en las DOS
// pestañas (Proyecto + Tareas) → hay dos pares de spans simultáneos.
// dataset.proyectoId protege de condiciones de carrera si el usuario
// cambia de proyecto mientras la promesa resolvía.
async function _poblarIntegracionFinanciera(proyecto) {
    const spansIntfin = document.querySelectorAll('.det-intfin');
    const spansTpv    = document.querySelectorAll('.det-tpv');
    if (spansIntfin.length === 0 && spansTpv.length === 0) return;

    let ficha = null;
    try {
        ficha = await obtenerFichaPorCliente(proyecto.cliente);
    } catch (_) { ficha = null; }

    // ── Integración financiera ────────────────────────────────────────
    const slug = ficha ? (ficha.integracionFinanciera || '') : '';
    const LABEL = { sage: 'Sage', a3: 'A3', no_aplica: 'No aplica' };
    const COLOR = {
        sage:      { bg: '#fef3c7', color: '#92400e' },
        a3:        { bg: '#dbeafe', color: '#1e40af' },
        no_aplica: { bg: '#f1f5f9', color: '#64748b' }
    };
    const vacio = '<span style="color:var(--text-muted)">Sin definir</span>';
    let htmlIntfin;
    if (!slug) {
        htmlIntfin = vacio;
    } else {
        const c = COLOR[slug] || { bg: '#f1f5f9', color: '#334155' };
        const lbl = LABEL[slug] || slug;
        const contactoHtml = (ficha && (ficha.intFinPersona || ficha.intFinEmail))
            ? `<span style="font-size:.72rem;color:var(--text-muted);margin-left:8px">${escapeHtml(ficha.intFinPersona || ficha.intFinEmail)}</span>`
            : '';
        htmlIntfin = `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:700;background:${c.bg};color:${c.color}">${escapeHtml(lbl)}</span>${contactoHtml}`;
    }
    spansIntfin.forEach(s => {
        if (!s.isConnected) return;
        if (s.dataset.proyectoId !== String(proyecto.id)) return;
        s.innerHTML = htmlIntfin;
    });

    // ── TPV ─────────────────────────────────────────────────────────
    // Preferimos el TPV de la ficha (fuente de verdad) sobre el snapshot
    // guardado en proyecto.tpv — así los cambios del comercial en la
    // ficha se reflejan al instante en el proyecto sin resincronizar.
    const tpvFicha = ficha ? (ficha.tpv || '').trim() : '';
    const tpvFinal = tpvFicha || (proyecto.tpv || '');
    const htmlTpv = tpvFinal
        ? `<span class="detail-tpv-badge">${escapeHtml(tpvFinal)}</span>`
        : '<span style="color:var(--text-muted)">Sin TPV</span>';
    spansTpv.forEach(s => {
        if (!s.isConnected) return;
        if (s.dataset.proyectoId !== String(proyecto.id)) return;
        s.innerHTML = htmlTpv;
    });
}

// ──────────────────────────────────────────────────────────
//  Calendario de subtareas del proyecto
// ──────────────────────────────────────────────────────────
// Estado del modal: qué proyecto está abierto y qué mes se muestra.
// _calMesActual es un Date con día=1 apuntando al mes visible.
let _calProyectoId = null;
let _calMesActual  = null;
let _calRangoMin   = null; // primer mes permitido (Date con día 1)
let _calRangoMax   = null; // último mes permitido (Date con día 1)
let _calMapaColor  = {};   // tareaId → hsl color

// Derivador de color estable: hash simple del id de la tarea → hue 0-360.
// Usa HSL con saturación/luminosidad fijas para que todas las tareas tengan
// colores bien diferenciados y legibles sobre fondo blanco.
function _colorParaTarea(tareaId) {
    if (_calMapaColor[tareaId]) return _calMapaColor[tareaId];
    let h = 0;
    const s = String(tareaId || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const color = `hsl(${hue}, 62%, 48%)`;
    _calMapaColor[tareaId] = color;
    return color;
}

// Parsea una fecha YYYY-MM-DD (o ISO) a Date local con hora 12:00 — evita
// el clásico off-by-one de timezones al mostrar días.
function _parseFechaSubtarea(fechaStr) {
    if (!fechaStr) return null;
    const s = String(fechaStr).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(fechaStr);
        return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    }
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
}

// Recolecta todas las subtareas del proyecto con su fecha + el color de
// su tarea padre (más el nombre de la tarea para la leyenda).
function _recolectarSubtareasConFecha(proyecto) {
    const out = [];
    const tareas = {}; // id → { nombre, color }
    (proyecto.secciones || []).forEach(sec => {
        (sec.tareas || []).forEach(t => {
            tareas[t.id] = { nombre: t.nombre, color: _colorParaTarea(t.id) };
            (t.subtareas || []).forEach(s => {
                const f = _parseFechaSubtarea(s.fechaEntrega);
                if (!f) return;
                out.push({
                    id: s.id,
                    nombre: s.nombre,
                    tareaId: t.id,
                    tareaNombre: t.nombre,
                    seccionNombre: sec.nombre,
                    fecha: f,
                    completada: !!s.completada,
                    color: tareas[t.id].color
                });
            });
        });
    });
    return { subtareas: out, tareas };
}

function abrirCalendarioProyecto(proyectoId) {
    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    _calProyectoId = proyectoId;

    const { subtareas, tareas } = _recolectarSubtareasConFecha(proyecto);

    // Rango de meses permitido: desde el mes de fechaInicio hasta el mes
    // de la subtarea más tardía (o el actual si no hay subtareas).
    const fechaInicio = _parseFechaSubtarea(proyecto.fechaInicio) || new Date();
    _calRangoMin = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
    let maxFecha = new Date(fechaInicio);
    subtareas.forEach(s => { if (s.fecha > maxFecha) maxFecha = s.fecha; });
    _calRangoMax = new Date(maxFecha.getFullYear(), maxFecha.getMonth(), 1);

    // Mes inicial: mes actual si cae en rango, si no el primero.
    const hoy = new Date();
    const mesHoy = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    if (mesHoy >= _calRangoMin && mesHoy <= _calRangoMax) _calMesActual = mesHoy;
    else _calMesActual = new Date(_calRangoMin);

    document.getElementById('calendario-titulo').textContent =
        `Calendario de ${proyecto.cliente || 'proyecto'}`;
    _calRender(proyecto, subtareas, tareas);
    abrirModal('modal-calendario');
}
window.abrirCalendarioProyecto = abrirCalendarioProyecto;

function _calMoverMes(delta) {
    if (!_calMesActual) return;
    const nuevo = new Date(_calMesActual.getFullYear(), _calMesActual.getMonth() + delta, 1);
    if (nuevo < _calRangoMin || nuevo > _calRangoMax) return;
    _calMesActual = nuevo;
    const proyecto = proyectos.find(p => p.id === _calProyectoId);
    if (!proyecto) return;
    const { subtareas, tareas } = _recolectarSubtareasConFecha(proyecto);
    _calRender(proyecto, subtareas, tareas);
}
window._calMoverMes = _calMoverMes;

function _calRender(proyecto, subtareas, tareas) {
    const yy = _calMesActual.getFullYear();
    const mm = _calMesActual.getMonth();

    // Etiqueta del mes en español — locale 'es-ES' con mes largo + año.
    document.getElementById('cal-mes-label').textContent =
        _calMesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // Deshabilitar navegación cuando estamos en los extremos del rango.
    document.getElementById('cal-prev').disabled =
        new Date(yy, mm - 1, 1) < _calRangoMin;
    document.getElementById('cal-next').disabled =
        new Date(yy, mm + 1, 1) > _calRangoMax;

    // Primer día del mes (convertido a índice 0=lun..6=dom) + nº de días.
    const primerDia = new Date(yy, mm, 1);
    const primerIdx = (primerDia.getDay() + 6) % 7;  // 0=lun
    const ultDia = new Date(yy, mm + 1, 0).getDate();

    // Agrupamos subtareas por día del mes visible (clave "d").
    const porDia = {};
    subtareas.forEach(s => {
        if (s.fecha.getFullYear() === yy && s.fecha.getMonth() === mm) {
            const d = s.fecha.getDate();
            (porDia[d] = porDia[d] || []).push(s);
        }
    });

    const hoy = new Date();
    const esMesActual = hoy.getFullYear() === yy && hoy.getMonth() === mm;
    const diaHoy = esMesActual ? hoy.getDate() : -1;

    const cells = [];
    // Celdas vacías para alinear el 1 del mes al día de la semana correcto.
    for (let i = 0; i < primerIdx; i++) cells.push('<div class="cal-cell cal-empty"></div>');
    for (let d = 1; d <= ultDia; d++) {
        const subs = porDia[d] || [];
        const clsHoy = d === diaHoy ? ' cal-today' : '';
        const pills = subs.map(s => {
            const tip = `${s.nombre} — ${s.tareaNombre} · ${s.seccionNombre}`;
            const cls = s.completada ? ' completada' : '';
            return `<span class="cal-sub${cls}" title="${escapeHtml(tip)}"
                          style="background:${s.color}"
                          onclick="_calClickSubtarea('${escapeHtml(s.id)}', '${escapeHtml(s.tareaId)}', '${escapeHtml(s.seccionNombre)}')">${escapeHtml(s.nombre)}</span>`;
        }).join('');
        cells.push(`<div class="cal-cell${clsHoy}">
            <span class="cal-cell-num">${d}</span>
            ${pills}
        </div>`);
    }
    document.getElementById('cal-grid').innerHTML = cells.join('');

    // Leyenda: una pill por cada tarea que tenga subtareas en el proyecto.
    // Ayuda a identificar a qué tarea pertenece cada color.
    const tareasUsadas = {};
    subtareas.forEach(s => { tareasUsadas[s.tareaId] = s; });
    const legendHtml = Object.values(tareasUsadas).map(s => `
        <span class="cal-legend-item">
            <span class="cal-legend-dot" style="background:${s.color}"></span>
            ${escapeHtml(s.tareaNombre)}
        </span>`).join('');
    document.getElementById('cal-legend').innerHTML = legendHtml
        || '<span style="color:var(--text-muted)">Sin subtareas en este proyecto.</span>';
}

function _calClickSubtarea(subtareaId, tareaId, seccionNombre) {
    // Abre el modal de la subtarea para editarla rápido desde el calendario.
    if (typeof abrirModalSubtarea === 'function') {
        cerrarModal('modal-calendario');
        abrirModalSubtarea(_calProyectoId, seccionNombre, tareaId, subtareaId);
    }
}
window._calClickSubtarea = _calClickSubtarea;

// ──────────────────────────────────────────────────────────
//  Exportar calendario a PDF — popup de impresión con TODOS los
//  meses del proyecto. Mismo patrón que imprimirSepa en
//  contabilidad.html: construye un documento autocontenido con
//  @page A4 landscape, uno por mes, y dispara window.print() al
//  cargar. Se imprime a PDF desde el diálogo del navegador y se
//  manda por email a los participantes del proyecto.
// ──────────────────────────────────────────────────────────
function _calExportarPDF() {
    const proyecto = proyectos.find(p => p.id === _calProyectoId);
    if (!proyecto) return;
    const { subtareas, tareas } = _recolectarSubtareasConFecha(proyecto);

    // Rango: mismo que el modal — desde fechaInicio hasta última subtarea.
    const meses = [];
    if (_calRangoMin && _calRangoMax) {
        let m = new Date(_calRangoMin);
        while (m <= _calRangoMax) {
            meses.push(new Date(m));
            m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        }
    }
    if (meses.length === 0) {
        mostrarToast('No hay rango de fechas que exportar', 'warning');
        return;
    }

    // Tareas que efectivamente tienen subtareas con fecha — para la leyenda
    // del PDF. Ordenadas por nombre para consistencia.
    const tareasConSub = {};
    subtareas.forEach(s => { tareasConSub[s.tareaId] = s; });
    const leyendaItems = Object.values(tareasConSub)
        .sort((a, b) => a.tareaNombre.localeCompare(b.tareaNombre, 'es'));

    // Renderiza una página (un mes) en HTML.
    function renderMesHTML(fecha) {
        const yy = fecha.getFullYear();
        const mm = fecha.getMonth();
        const primerIdx = (new Date(yy, mm, 1).getDay() + 6) % 7;  // 0 = lunes
        const ultDia = new Date(yy, mm + 1, 0).getDate();

        const porDia = {};
        subtareas.forEach(s => {
            if (s.fecha.getFullYear() === yy && s.fecha.getMonth() === mm) {
                const d = s.fecha.getDate();
                (porDia[d] = porDia[d] || []).push(s);
            }
        });

        const cells = [];
        for (let i = 0; i < primerIdx; i++) cells.push('<div class="pdf-cell pdf-empty"></div>');
        for (let d = 1; d <= ultDia; d++) {
            const subs = porDia[d] || [];
            const pills = subs.map(s => {
                const cls = s.completada ? 'pdf-sub completada' : 'pdf-sub';
                return `<span class="${cls}" style="background:${s.color}">${escapeHtml(s.nombre)}</span>`;
            }).join('');
            cells.push(`<div class="pdf-cell"><div class="pdf-cell-num">${d}</div>${pills}</div>`);
        }

        const mesLbl = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return `
            <section class="pdf-page">
                <div class="pdf-mes-title">${escapeHtml(mesLbl)}</div>
                <div class="pdf-weekdays">
                    <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
                </div>
                <div class="pdf-grid">${cells.join('')}</div>
            </section>`;
    }

    const pagesHtml = meses.map(renderMesHTML).join('');
    const leyendaHtml = leyendaItems.length
        ? leyendaItems.map(s => `
            <span class="pdf-legend-item">
                <span class="pdf-legend-dot" style="background:${s.color}"></span>
                ${escapeHtml(s.tareaNombre)}
            </span>`).join('')
        : '<span style="color:#94a3b8">Sin subtareas agendadas en el proyecto.</span>';

    const generadoEl = new Date().toLocaleString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // CSS autocontenido + @page landscape — cada mes se fuerza en su propia
    // hoja con page-break-after para que el calendario no se parta al medio.
    const css = `
        @page { size: A4 landscape; margin: 10mm 10mm 12mm; }
        * { box-sizing: border-box; }
        body { margin:0; padding:0; font-family:'Bw Modelica', Helvetica, Arial, sans-serif; color:#0f172a; font-size:9pt; line-height:1.35; }
        .pdf-header {
            display:flex; align-items:center; justify-content:space-between;
            padding:6pt 0 8pt; margin-bottom:8pt;
            border-bottom:2px solid #1e3a8a;
        }
        .pdf-logo img { height:28pt; }
        .pdf-head-right { text-align:right; }
        .pdf-head-right h1 { margin:0; font-size:14pt; color:#0f172a; font-weight:800; }
        .pdf-head-right .pdf-sub { font-size:9pt; color:#475569; margin-top:2pt; }
        .pdf-legend-wrap {
            display:flex; flex-wrap:wrap; gap:6pt;
            padding:6pt 8pt; margin-bottom:10pt;
            background:#f8fafc; border:1px solid #e2e8f0; border-radius:6pt;
            font-size:8.5pt;
        }
        .pdf-legend-item { display:inline-flex; align-items:center; gap:4pt; }
        .pdf-legend-dot { width:10pt; height:10pt; border-radius:2pt; display:inline-block; }
        .pdf-page { page-break-after:always; }
        .pdf-page:last-child { page-break-after:auto; }
        .pdf-mes-title {
            font-size:13pt; font-weight:800; color:#1e3a8a;
            text-transform:capitalize; margin:8pt 0 6pt;
        }
        .pdf-weekdays {
            display:grid; grid-template-columns:repeat(7, 1fr); gap:2pt;
            margin-bottom:3pt;
        }
        .pdf-weekdays div {
            text-align:center; font-size:7.5pt; font-weight:700;
            color:#64748b; letter-spacing:.06em; text-transform:uppercase;
        }
        .pdf-grid {
            display:grid; grid-template-columns:repeat(7, 1fr); gap:3pt;
        }
        .pdf-cell {
            background:#fff; border:1px solid #e2e8f0; border-radius:4pt;
            min-height:70pt; padding:3pt 4pt;
            display:flex; flex-direction:column; gap:2pt;
            overflow:hidden;
            page-break-inside:avoid;
        }
        .pdf-cell.pdf-empty { background:transparent; border-color:transparent; }
        .pdf-cell-num { font-size:8pt; font-weight:700; color:#475569; align-self:flex-start; }
        .pdf-sub {
            font-size:7pt; line-height:1.2;
            padding:1.5pt 4pt; border-radius:3pt;
            color:#fff; font-weight:600;
            white-space:normal;
            overflow:hidden;
            text-overflow:ellipsis;
        }
        .pdf-sub.completada { opacity:.6; text-decoration:line-through; }
        .pdf-foot {
            margin-top:6pt; padding-top:4pt; border-top:1px solid #e2e8f0;
            font-size:7pt; color:#94a3b8; text-align:right;
        }
    `;

    // Cabecera (se imprime al principio de la primera página — con page-break
    // las siguientes páginas no la repiten, pero sí el título del mes).
    const cabeceraHtml = `
        <div class="pdf-header">
            <div class="pdf-logo"><img src="https://www.yurest.com/wp-content/uploads/2022/10/logotipo-yurest-rojo.png" alt="Yurest"></div>
            <div class="pdf-head-right">
                <h1>Calendario de sesiones</h1>
                <div class="pdf-sub">
                    <strong>${escapeHtml(proyecto.cliente || '—')}</strong>
                    ${proyecto.implementador ? ' · Implementador: ' + escapeHtml(proyecto.implementador) : ''}
                </div>
            </div>
        </div>
        <div class="pdf-legend-wrap">${leyendaHtml}</div>
    `;

    const autoprintScript = '<scr' + 'ipt>window.onload=function(){var imgs=document.images;var left=imgs.length+1;var fire=function(){if(--left<=0)setTimeout(function(){window.print();},80);};if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fire);}else{fire();}if(imgs.length===0){fire();}else{for(var i=0;i<imgs.length;i++){if(imgs[i].complete)fire();else{imgs[i].addEventListener("load",fire);imgs[i].addEventListener("error",fire);}}}};window.onafterprint=function(){window.close();};</scr' + 'ipt>';

    // URL absoluta al fonts.css del portal para que Bw Modelica llegue al
    // popup (igual que el PDF del SEPA). En gestor está bajo /js-gestor/,
    // así que fonts.css vive un nivel arriba respecto al HTML actual si el
    // usuario está en proyectos.html (que está en root). window.location
    // resuelve bien contra la página actual.
    const fontsUrl = new URL('fonts.css', window.location.href).href;
    const titulo = `Calendario · ${(proyecto.cliente || 'proyecto').replace(/[^\w\s\-.áéíóúüñÁÉÍÓÚÜÑ]/g, '').trim()}`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(titulo)}</title><link rel="stylesheet" href="${fontsUrl}"><style>${css}</style></head><body>${cabeceraHtml}${pagesHtml}<div class="pdf-foot">Generado el ${escapeHtml(generadoEl)} · Yurest</div>${autoprintScript}</body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) {
        mostrarToast('El navegador bloqueó el popup. Permite ventanas emergentes para exportar.', 'warning', 5000);
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
}
window._calExportarPDF = _calExportarPDF;

// Totales de tiempo: recorre TODAS las subtareas del proyecto sumando
// tiempoEstimado y tiempoReal. Útil para comparar en la cabecera y para
// el cálculo de desviación.
function _sumaTiemposProyecto(proyecto) {
    let est = 0, real = 0, conReal = 0;
    (proyecto.secciones || []).forEach(sec => {
        (sec.tareas || []).forEach(t => {
            // También sumamos el tiempo de la TAREA (no solo subtareas)
            // por si alguien lo usa al nivel de tarea directamente.
            if (Number.isFinite(+t.tiempoEstimado)) est += +t.tiempoEstimado;
            if (Number.isFinite(+t.tiempoReal))      { real += +t.tiempoReal; conReal++; }
            (t.subtareas || []).forEach(s => {
                if (Number.isFinite(+s.tiempoEstimado)) est += +s.tiempoEstimado;
                if (Number.isFinite(+s.tiempoReal))      { real += +s.tiempoReal; conReal++; }
            });
        });
    });
    const desviacion = est > 0 ? Math.round(((real - est) / est) * 100) : 0;
    return { est, real, conReal, desviacion };
}

// Badge de "Tiempo estimado / real" con color según desviación.
// Si no hay ningún tiempoReal registrado todavía, solo mostramos el
// estimado y un "—" gris para el real.
function _renderTiemposBadge(proyecto) {
    const t = _sumaTiemposProyecto(proyecto);
    const formato = min => {
        if (!min) return '0 min';
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h ${m}m` : `${m} min`;
    };
    if (t.real === 0 && t.conReal === 0) {
        return `<span style="color:#334155;font-weight:600">${formato(t.est)}</span>
                <span style="color:var(--text-muted);margin:0 6px">/</span>
                <span style="color:var(--text-muted)">sin registrar</span>`;
    }
    // Colorimetría de desviación:
    //   <= 0%  (dentro de estimado) → verde
    //   0-20%  (dentro de margen)   → ámbar
    //   > 20%  (se pasó)            → rojo
    const color = t.desviacion <= 0 ? '#15803d' : t.desviacion <= 20 ? '#b45309' : '#b91c1c';
    const signo = t.desviacion > 0 ? '+' : '';
    return `<span style="color:#334155;font-weight:600">${formato(t.est)}</span>
            <span style="color:var(--text-muted);margin:0 6px">/</span>
            <span style="color:${color};font-weight:700">${formato(t.real)}</span>
            <span style="color:${color};font-size:.72rem;margin-left:6px">(${signo}${t.desviacion}%)</span>`;
}

// Acciones comunes (Editar / Eliminar) — se repiten al pie de Proyecto y Tareas
// para que el usuario las tenga a mano sin tener que cambiar de pestaña.
function _renderAccionesProyecto(proyecto) {
    return `
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

// Render de un subconjunto de secciones. Preserva el índice ORIGINAL dentro
// de proyecto.secciones para que toggleSeccion(index) y renderSeccion sigan
// identificando correctamente el DOM node (usamos `section-${origIdx}`).
function _renderSeccionesFiltradas(proyecto, predicate) {
    const html = proyecto.secciones
        .map((seccion, origIdx) => ({ seccion, origIdx }))
        .filter(({ seccion }) => predicate(seccion))
        .map(({ seccion, origIdx }) => renderSeccion(proyecto.id, seccion, origIdx))
        .join('');
    return `<div class="detail-sections">${html}</div>`;
}

// Tab "Tareas" → contiene las secciones administrativas previas al inicio:
//   · Puesta en Marcha / Finalización
//   · Carga de Datos Yuload
// Son los checklists que cubre el implementador antes de que arranquen las
// sesiones con el cliente. Todo lo demás ("Planificación de sesiones" y
// "Módulos terminados") vive ahora en el tab "Proyecto".
function renderDetalleTareas(proyecto) {
    document.getElementById('detalle-tareas').innerHTML = `
        ${_renderCabeceraProyecto(proyecto)}
        ${_renderSeccionesFiltradas(proyecto, s => _esSeccionTareas(s.nombre))}
        ${_renderAccionesProyecto(proyecto)}
    `;
    // Resuelve la integración financiera del cliente de forma asíncrona
    // (lee de fichas_alta vía caché). Si falla, el span queda en "Sin definir".
    _poblarIntegracionFinanciera(proyecto);
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
    // Mapeo vista → id del panel. Centralizarlo evita las N líneas de
    // style.display que había antes (y los olvidos cuando se añadían tabs).
    const PANEL_MAP = {
        proyecto:    'detalle-proyecto',
        hardware:    'detalle-hardware',
        tareas:      'detalle-tareas',
        formularios: 'detalle-formularios',
        contactos:   'detalle-contactos',
        desarrollos: 'detalle-desarrollos',
        anotaciones: 'detalle-anotaciones',
        timeline:    'detalle-timeline'
    };

    document.querySelectorAll('.detail-tab').forEach(t => t.classList.toggle('active', t.dataset.dtab === vista));
    Object.entries(PANEL_MAP).forEach(([v, id]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = v === vista ? '' : 'none';
    });

    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;

    // Re-render on demand para cada pestaña. Tareas y las primeras tres
    // (Proyecto, Hardware, Formularios) se re-renderizan siempre que se
    // activan; las legacy preservan el comportamiento anterior.
    if (vista === 'proyecto')         renderDetalleProyecto(proyecto);
    else if (vista === 'hardware')    renderDetalleHardware(proyecto);
    else if (vista === 'tareas')      renderDetalleTareas(proyecto);
    else if (vista === 'formularios') renderDetalleFormularios(proyecto);
    else if (vista === 'contactos')   renderDetalleContactos(proyecto);
    else if (vista === 'desarrollos') renderDetalleDesarrollos(proyecto);
    else if (vista === 'anotaciones') renderDetalleAnotaciones(proyecto);
    else if (vista === 'timeline')    renderDetalleTimeline(proyecto);
}

// ──────────────────────────────────────────────────────────
//  Pestañas nuevas: Proyecto, Hardware, Formularios
//  Por ahora son placeholders con estado vacío informativo.
//  El contenido funcional se definirá más adelante.
// ──────────────────────────────────────────────────────────
function _renderDetallePlaceholder(containerId, titulo, descripcion, icon) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="detail-placeholder">
            <div class="detail-placeholder-icon">${icon || ''}</div>
            <h3 class="detail-placeholder-title">${escapeHtml(titulo)}</h3>
            <p class="detail-placeholder-desc">${escapeHtml(descripcion)}</p>
        </div>`;
}

// Tab "Proyecto" → vista principal de la implementación. Incluye la cabecera
// de contexto + las secciones que componen el recorrido del cliente:
//   · Planificación de sesiones
//   · Módulos terminados de implementar
//   · (+ cualquier sección custom que no sea Tareas ni Hardware)
// El tab "Tareas" se queda con la parte administrativa (Puesta en Marcha y
// Carga de Datos Yuload). El tab "Hardware" se sigue excluyendo aquí — tiene
// su propia pestaña dedicada.
function renderDetalleProyecto(proyecto) {
    document.getElementById('detalle-proyecto').innerHTML = `
        ${_renderCabeceraProyecto(proyecto)}
        ${_renderSeccionesFiltradas(proyecto, s => !_esSeccionTareas(s.nombre) && !_esSeccionHardware(s.nombre))}
        ${_renderAccionesProyecto(proyecto)}
    `;
    _poblarIntegracionFinanciera(proyecto);
}

// ──────────────────────────────────────────────────────────
//  Tab "Hardware" del proyecto — pedidos con flujo proforma
//  estados: solicitada → proforma_adjuntada → pendiente_confirmar → lista_envio
// ──────────────────────────────────────────────────────────
let _hwPedidos = [];

async function renderDetalleHardware(proyecto) {
    const el = document.getElementById('detalle-hardware');
    if (!el) return;
    el.innerHTML = `
        <div class="hw-tab-head">
            <div>
                <h3 style="margin:0;font-size:1.05rem;font-weight:700;color:#0f172a">Pedidos de hardware</h3>
                <p style="margin:3px 0 0;font-size:.8rem;color:#64748b">Crea un pedido, contabilidad te enviará la proforma. Al pagar, sube el justificante y Soporte lo enviará al cliente.</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="hwAbrirModalNuevo('${proyecto.id}', ${JSON.stringify(proyecto.cliente).replace(/"/g, '&quot;')}, ${JSON.stringify(proyecto.implementador || '').replace(/"/g, '&quot;')})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nuevo pedido
            </button>
        </div>
        <div id="hw-lista-${proyecto.id}" class="hw-lista-wrap">
            <div class="hw-loading">Cargando pedidos…</div>
        </div>`;

    try {
        const url = YurestConfig.ENDPOINTS.hardwarePedidos + '?proyecto_id=' + encodeURIComponent(proyecto.id) + '&_=' + Date.now();
        const res = await YurestConfig.apiFetch(url, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        _hwPedidos = Array.isArray(data.pedidos) ? data.pedidos
                   : Array.isArray(data) ? data : [];
        _hwRenderLista(proyecto);
    } catch (err) {
        const w = document.getElementById('hw-lista-' + proyecto.id);
        if (w) w.innerHTML = `<div class="hw-empty" style="color:#dc2626">Error: ${escapeHtml(err.message)}</div>`;
    }
}

function _hwRenderLista(proyecto) {
    const wrap = document.getElementById('hw-lista-' + proyecto.id);
    if (!wrap) return;
    if (_hwPedidos.length === 0) {
        wrap.innerHTML = `
            <div class="hw-empty">
                <div class="hw-empty-icon">📦</div>
                <p style="font-weight:700;color:#475569;margin:0 0 6px">Aún no hay pedidos</p>
                <p style="margin:0;font-size:.85rem">Crea el primer pedido con "Nuevo pedido" para que contabilidad emita la proforma.</p>
            </div>`;
        return;
    }
    const ESTADO_LBL = {
        solicitada:          { lbl: 'Esperando proforma',     cls: 'est-solicitada' },
        proforma_adjuntada:  { lbl: 'Proforma recibida',      cls: 'est-proforma_adjuntada' },
        pendiente_confirmar: { lbl: 'Pendiente confirmar pago', cls: 'est-pendiente_confirmar' },
        lista_envio:         { lbl: 'Lista para envío',       cls: 'est-lista_envio' },
        enviado:             { lbl: 'Enviado',                cls: 'est-enviado' }
    };
    const fmt = v => v ? new Date(v).toLocaleString('es-ES', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    wrap.innerHTML = _hwPedidos.map(p => {
        const info = ESTADO_LBL[p.estado] || { lbl: p.estado, cls: '' };
        const items = Array.isArray(p.items) ? p.items : [];
        // Subtotal del pedido leyendo los precios snapshot-eados en cada
        // línea. Si es un pedido antiguo sin precios (formato libre de la
        // versión previa al catálogo) salimos sin total.
        let subtotal = 0;
        let tienePrecios = false;
        items.forEach(it => {
            if (Number.isFinite(+it.precio_total)) {
                subtotal += +it.precio_total; tienePrecios = true;
            } else if (Number.isFinite(+it.precio_unitario)) {
                subtotal += (+it.precio_unitario) * (Number(it.cantidad) || 1); tienePrecios = true;
            }
        });
        const itemsHtml = items.map(it => {
            const cant = Number(it.cantidad) || 1;
            const unidad = escapeHtml(it.unidad || 'ud');
            const precioUnit = Number.isFinite(+it.precio_unitario) ? hwFmtPrecio(it.precio_unitario) : null;
            const precioTot  = Number.isFinite(+it.precio_total)    ? hwFmtPrecio(it.precio_total)
                             : (precioUnit ? hwFmtPrecio((+it.precio_unitario) * cant) : null);
            return `
                <div class="hw-pedido-item-row">
                    <span class="hw-pedido-item-name">
                        ${escapeHtml(it.nombre || '—')}
                        ${it.formato ? ` <span style="color:#94a3b8;font-size:.72rem">· ${escapeHtml(it.formato)}</span>` : ''}
                        ${precioUnit ? ` <span style="color:#94a3b8;font-size:.72rem">· ${precioUnit}/${unidad}</span>` : ''}
                    </span>
                    <span class="hw-pedido-item-qty">${cant} ${unidad}${precioTot ? ` · <strong>${precioTot}</strong>` : ''}</span>
                </div>`;
        }).join('') || '<span style="color:#94a3b8">Sin items</span>';
        const subtotalHtml = tienePrecios
            ? `<div class="hw-pedido-subtotal">Subtotal: <strong>${hwFmtPrecio(subtotal)}</strong></div>`
            : '';

        // Acciones según estado (lado implementador):
        //   solicitada         → ver estado; esperar proforma
        //   proforma_adjuntada → ver proforma + subir justificante + rechazar proforma
        //   pendiente_confirmar→ ver proforma + ver justificante + esperar confirmación
        //   lista_envio / enviado → solo lectura
        let acciones = '';
        if (p.estado === 'proforma_adjuntada') {
            const prof = p.proforma_pdf && p.proforma_pdf.data
                ? `<a href="${escapeHtml(p.proforma_pdf.data)}" download="${escapeHtml(p.proforma_pdf.nombre || 'proforma.pdf')}" class="hw-cta">📄 Ver proforma</a>`
                : '';
            acciones = `${prof}
                <label class="hw-cta primary">
                    🧾 Subir justificante de pago
                    <input type="file" accept="application/pdf" onchange="hwSubirJustificante('${escapeHtml(p.id)}', '${escapeHtml(proyecto.id)}', this)">
                </label>
                <button class="hw-cta" onclick="hwRechazarProforma('${escapeHtml(p.id)}', '${escapeHtml(proyecto.id)}')" title="La proforma es incorrecta — pedir rehacer">↩ Rechazar proforma</button>`;
        } else if (p.estado === 'pendiente_confirmar') {
            const prof = p.proforma_pdf && p.proforma_pdf.data
                ? `<a href="${escapeHtml(p.proforma_pdf.data)}" download="${escapeHtml(p.proforma_pdf.nombre || 'proforma.pdf')}" class="hw-cta">📄 Proforma</a>`
                : '';
            const just = p.justificante_pdf && p.justificante_pdf.data
                ? `<a href="${escapeHtml(p.justificante_pdf.data)}" download="${escapeHtml(p.justificante_pdf.nombre || 'justificante.pdf')}" class="hw-cta">🧾 Justificante</a>`
                : '';
            acciones = `${prof}${just}<span style="font-size:.72rem;color:#64748b;align-self:center">Esperando confirmación de contabilidad…</span>`;
        } else if (p.estado === 'lista_envio') {
            const prof = p.proforma_pdf && p.proforma_pdf.data
                ? `<a href="${escapeHtml(p.proforma_pdf.data)}" download="${escapeHtml(p.proforma_pdf.nombre || 'proforma.pdf')}" class="hw-cta">📄 Proforma</a>`
                : '';
            acciones = `${prof}<span style="font-size:.72rem;color:#16a34a;align-self:center">✓ Enviado a Soporte</span>`;
        } else if (p.estado === 'enviado') {
            const prof = p.proforma_pdf && p.proforma_pdf.data
                ? `<a href="${escapeHtml(p.proforma_pdf.data)}" download="${escapeHtml(p.proforma_pdf.nombre || 'proforma.pdf')}" class="hw-cta">📄 Proforma</a>`
                : '';
            const tracking = p.tracking
                ? (/^https?:\/\//i.test(p.tracking)
                    ? `<a href="${escapeHtml(p.tracking)}" target="_blank" rel="noopener" class="hw-cta">🚚 Tracking</a>`
                    : `<span style="font-size:.72rem;color:#3730a3;align-self:center">🚚 ${escapeHtml(p.tracking)}</span>`)
                : '';
            acciones = `${prof}${tracking}<span style="font-size:.72rem;color:#3730a3;align-self:center">Enviado ${fmt(p.enviado_at)}${p.enviado_por ? ' · ' + escapeHtml(p.enviado_por) : ''}</span>`;
        } else {
            acciones = `<span style="font-size:.72rem;color:#64748b;align-self:center">Esperando a que contabilidad suba la proforma…</span>`;
        }

        // Cabecera con ID corto y fechas clave para trazabilidad.
        const fechas = [];
        if (p.proforma_at)    fechas.push('proforma ' + fmt(p.proforma_at));
        if (p.pagado_at)      fechas.push('pago ' + fmt(p.pagado_at));
        if (p.confirmado_at)  fechas.push('confirmado ' + fmt(p.confirmado_at));
        if (p.enviado_at)     fechas.push('enviado ' + fmt(p.enviado_at));
        const fechasLine = fechas.length
            ? `<div style="font-size:.7rem;color:#94a3b8;margin-top:2px">${fechas.join(' · ')}</div>`
            : '';

        return `
            <div class="hw-pedido">
                <div class="hw-pedido-head">
                    <div>
                        <p class="hw-pedido-cliente">Pedido del ${fmt(p.solicitado_at)}</p>
                        ${p.implementador ? `<div class="hw-pedido-sub">Solicitó: ${escapeHtml(p.implementador)}</div>` : ''}
                        <div style="font-size:.66rem;color:#94a3b8;font-family:monospace;margin-top:3px">#${escapeHtml(String(p.id || '').slice(0,8))}</div>
                        ${fechasLine}
                    </div>
                    <span class="hw-pedido-estado ${info.cls}">${escapeHtml(info.lbl)}</span>
                </div>
                <div class="hw-pedido-items">${itemsHtml}</div>
                ${subtotalHtml}
                ${p.notas_implementador ? `<div style="font-size:.78rem;color:#475569;background:#f8fafc;border-left:3px solid #94a3b8;padding:6px 10px;border-radius:4px">${escapeHtml(p.notas_implementador)}</div>` : ''}
                ${p.notas_contabilidad ? `<div style="font-size:.78rem;color:#475569;background:#fffbeb;border-left:3px solid #f59e0b;padding:6px 10px;border-radius:4px"><strong>Contabilidad:</strong> ${escapeHtml(p.notas_contabilidad)}</div>` : ''}
                <div class="hw-pedido-actions">${acciones}</div>
            </div>`;
    }).join('');
}

// Lado implementador: rechazar la proforma que ha subido contabilidad. Motivo
// obligatorio — se envía al WF y éste limpia proforma_at/proforma_pdf volviendo
// el pedido a 'solicitada'.
async function hwRechazarProforma(pedidoId, proyectoId) {
    const motivo = prompt('Motivo por el que rechazas la proforma (obligatorio):\n\nEj: importe incorrecto, datos de facturación erróneos, faltan conceptos…');
    if (motivo === null) return;
    const m = (motivo || '').trim();
    if (!m) { mostrarToast('El motivo es obligatorio', 'warning'); return; }
    try {
        const res = await YurestConfig.apiFetch(YurestConfig.ENDPOINTS.hardwarePedidos, {
            method: 'POST',
            body: JSON.stringify({
                action: 'devolver_a_contabilidad',
                pedido: { id: pedidoId, desde: 'proforma_adjuntada', motivo: m }
            })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const r = await res.json();
        if (r && r.success === false) throw new Error((r.errores || ['Error']).join('; '));
        mostrarToast('Proforma devuelta a contabilidad', 'success');
        const proyecto = proyectos.find(p => p.id === proyectoId);
        if (proyecto) renderDetalleHardware(proyecto);
    } catch (err) {
        mostrarToast('Error al rechazar: ' + err.message, 'error', 5000);
    }
}
window.hwRechazarProforma = hwRechazarProforma;

// ── Modal nuevo pedido — catálogo con cantidades ─────────────────────────
// Cantidades en memoria: { itemId: cantidad }. Se construye vacío al abrir
// el modal y se persiste sólo al enviar (no se auto-guarda).
let _hwCart = {};

function hwAbrirModalNuevo(proyectoId, cliente, implementador) {
    let modal = document.getElementById('modal-hw-nuevo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-hw-nuevo';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-hw-catalogo">
                <div class="modal-header">
                    <h2>Nuevo pedido de hardware</h2>
                    <button class="modal-close" onclick="cerrarModal('modal-hw-nuevo')">&times;</button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="hw-new-proyecto-id">
                    <input type="hidden" id="hw-new-cliente">
                    <input type="hidden" id="hw-new-implementador">
                    <div style="font-size:.82rem;color:#475569;margin-bottom:10px">
                        Cliente: <strong id="hw-new-cliente-lbl">—</strong>
                    </div>
                    <div id="hw-cat-container"></div>
                    <div class="form-group" style="margin-top:14px">
                        <label>Notas para contabilidad (opcional)</label>
                        <textarea id="hw-new-notas" class="form-control" rows="2" placeholder="Urgencia, contexto, dirección de facturación distinta…"></textarea>
                    </div>
                </div>
                <div class="modal-footer hw-footer-total">
                    <div class="hw-footer-total-info">
                        <span class="hw-footer-total-lbl">Total estimado</span>
                        <span class="hw-footer-total-val" id="hw-total">0,00 €</span>
                        <span class="hw-footer-total-items" id="hw-total-items"></span>
                    </div>
                    <div style="display:flex;gap:10px">
                        <button class="btn btn-secondary" onclick="cerrarModal('modal-hw-nuevo')">Cancelar</button>
                        <button class="btn btn-primary" onclick="hwCrearPedido()">Enviar solicitud</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('hw-new-proyecto-id').value = proyectoId;
    document.getElementById('hw-new-cliente').value = cliente || '';
    document.getElementById('hw-new-implementador').value = implementador || '';
    document.getElementById('hw-new-cliente-lbl').textContent = cliente || '—';
    document.getElementById('hw-new-notas').value = '';
    _hwCart = {};
    _hwRenderCatalogo();
    _hwActualizarTotal();
    abrirModal('modal-hw-nuevo');
}
window.hwAbrirModalNuevo = hwAbrirModalNuevo;

function _hwRenderCatalogo() {
    const cont = document.getElementById('hw-cat-container');
    if (!cont) return;
    cont.innerHTML = HARDWARE_CATALOGO.map(grupo => {
        const cards = grupo.items.map(it => `
            <div class="hw-cat-item" data-item-id="${escapeHtml(it.id)}">
                <div class="hw-cat-item-info">
                    <div class="hw-cat-item-nombre">${escapeHtml(it.nombre)}</div>
                    ${it.formato ? `<div class="hw-cat-item-formato">${escapeHtml(it.formato)}</div>` : ''}
                    <div class="hw-cat-item-precio">${hwFmtPrecio(it.precio)}${it.unidad ? ` / ${escapeHtml(it.unidad)}` : ''}</div>
                </div>
                <div class="hw-cat-item-qty">
                    <button type="button" class="hw-qty-btn" onclick="_hwCambiarCantidad('${escapeHtml(it.id)}', -1)" aria-label="Restar">−</button>
                    <input type="number" min="0" value="0" class="hw-qty-input" id="hw-qty-${escapeHtml(it.id)}"
                           oninput="_hwSetCantidad('${escapeHtml(it.id)}', this.value)">
                    <button type="button" class="hw-qty-btn" onclick="_hwCambiarCantidad('${escapeHtml(it.id)}', 1)" aria-label="Sumar">+</button>
                </div>
            </div>`).join('');
        return `
            <div class="hw-cat-grupo">
                <h4 class="hw-cat-grupo-title"><span>${grupo.icon}</span> ${escapeHtml(grupo.grupo)}</h4>
                <div class="hw-cat-grid">${cards}</div>
            </div>`;
    }).join('');
}

function _hwSetCantidad(itemId, valor) {
    const n = Math.max(0, parseInt(valor, 10) || 0);
    if (n === 0) delete _hwCart[itemId];
    else _hwCart[itemId] = n;
    const input = document.getElementById('hw-qty-' + itemId);
    if (input) input.value = n;
    // Resalta visualmente la tarjeta si tiene cantidad > 0.
    const card = document.querySelector(`.hw-cat-item[data-item-id="${itemId}"]`);
    if (card) card.classList.toggle('has-qty', n > 0);
    _hwActualizarTotal();
}
window._hwSetCantidad = _hwSetCantidad;

function _hwCambiarCantidad(itemId, delta) {
    const actual = _hwCart[itemId] || 0;
    _hwSetCantidad(itemId, actual + delta);
}
window._hwCambiarCantidad = _hwCambiarCantidad;

function _hwActualizarTotal() {
    let total = 0;
    let totalItems = 0;
    Object.entries(_hwCart).forEach(([id, qty]) => {
        const it = hardwareBuscarItem(id);
        if (!it) return;
        total += (Number(it.precio) || 0) * qty;
        totalItems += qty;
    });
    const totalEl = document.getElementById('hw-total');
    const itemsEl = document.getElementById('hw-total-items');
    if (totalEl) totalEl.textContent = hwFmtPrecio(total);
    if (itemsEl) itemsEl.textContent = totalItems === 0 ? 'carrito vacío'
        : (totalItems === 1 ? '1 artículo' : `${totalItems} artículos`);
}

async function hwCrearPedido() {
    const proyectoId    = document.getElementById('hw-new-proyecto-id').value;
    const cliente       = document.getElementById('hw-new-cliente').value;
    const implementador = document.getElementById('hw-new-implementador').value;
    const notas         = document.getElementById('hw-new-notas').value.trim();

    // Construye la lista de items a partir del carrito: solo entran los
    // que tienen cantidad > 0. Cada línea snapshot-ea id, nombre, formato,
    // precio_unitario y precio_total — así el pedido queda "congelado"
    // aunque luego cambie la tarifa en el catálogo.
    const items = Object.entries(_hwCart)
        .filter(([_, qty]) => (qty || 0) > 0)
        .map(([id, qty]) => {
            const it = hardwareBuscarItem(id);
            if (!it) return null;
            return {
                id:              it.id,
                nombre:          it.nombre,
                formato:         it.formato || null,
                grupo:           it.grupo,
                cantidad:        qty,
                unidad:          it.unidad || 'ud',
                precio_unitario: Number(it.precio) || 0,
                precio_total:    +((Number(it.precio) || 0) * qty).toFixed(2)
            };
        })
        .filter(Boolean);

    if (items.length === 0) {
        mostrarToast('Añade al menos un artículo al carrito', 'error');
        return;
    }

    try {
        const payload = {
            action: 'create',
            pedido: {
                proyecto_id: proyectoId,
                cliente,
                implementador,
                items,
                notas_implementador: notas,
                solicitado_por: (YurestConfig.getUsuario && YurestConfig.getUsuario() || {}).username || null
            }
        };
        console.log('[hw] POST pedido →', YurestConfig.ENDPOINTS.hardwarePedidos, payload);
        const res = await YurestConfig.apiFetch(YurestConfig.ENDPOINTS.hardwarePedidos, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        // Leemos el body como texto primero para poder mostrar errores
        // incluso cuando no llega JSON (404 HTML de n8n, etc.).
        const rawText = await res.text();
        let r = null;
        try { r = rawText ? JSON.parse(rawText) : null; } catch (_) { r = null; }
        console.log('[hw] respuesta', res.status, r || rawText);

        if (!res.ok) {
            const detalle = (r && (r.message || (Array.isArray(r.errores) && r.errores.join('; ')))) || rawText.slice(0, 240);
            throw new Error('HTTP ' + res.status + (detalle ? ' — ' + detalle : ''));
        }
        if (r && r.success === false) {
            const detalle = Array.isArray(r.errores) && r.errores.length ? r.errores.join('; ') : 'sin detalle';
            throw new Error(detalle);
        }
        if (!r) throw new Error('Respuesta vacía del servidor (revisa que el workflow 21 esté activo).');

        mostrarToast('Pedido enviado a contabilidad', 'success');
        cerrarModal('modal-hw-nuevo');
        const proyecto = proyectos.find(p => p.id === proyectoId);
        if (proyecto) renderDetalleHardware(proyecto);
    } catch (err) {
        console.error('[hw] crear pedido', err);
        // err.message puede venir vacío si fue un TypeError de red; añadimos
        // un fallback descriptivo + pista para el usuario.
        const msg = err && err.message
            ? err.message
            : 'No se pudo contactar con el servidor. ¿Está activo el workflow 21-hardware-pedidos en n8n?';
        mostrarToast('Error al crear pedido: ' + msg, 'error', 8000);
    }
}
window.hwCrearPedido = hwCrearPedido;

async function hwSubirJustificante(pedidoId, proyectoId, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
        mostrarToast('El justificante debe ser un PDF', 'warning');
        input.value = ''; return;
    }
    if (file.size > 10 * 1024 * 1024) {
        mostrarToast('PDF demasiado grande (máx 10 MB)', 'warning');
        input.value = ''; return;
    }
    try {
        const r = new FileReader();
        const dataUrl = await new Promise((ok, ko) => { r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file); });
        const justificante_pdf = {
            nombre: file.name, tipo: file.type || 'application/pdf', size: file.size,
            data: dataUrl, fecha: new Date().toISOString()
        };
        const res = await YurestConfig.apiFetch(YurestConfig.ENDPOINTS.hardwarePedidos, {
            method: 'POST',
            body: JSON.stringify({
                action: 'adjuntar_justificante',
                pedido: { id: pedidoId, justificante_pdf }
            })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const resp = await res.json();
        if (resp && resp.success === false) throw new Error((resp.errores || ['Error']).join('; '));
        mostrarToast('Justificante enviado a contabilidad', 'success');
        const proyecto = proyectos.find(p => p.id === proyectoId);
        if (proyecto) renderDetalleHardware(proyecto);
    } catch (err) {
        mostrarToast('Error al subir justificante: ' + err.message, 'error', 5000);
    }
    input.value = '';
}
window.hwSubirJustificante = hwSubirJustificante;

function renderDetalleFormularios(proyecto) {
    _renderDetallePlaceholder(
        'detalle-formularios',
        'Formularios',
        'Aquí vivirán los formularios que el implementador y el cliente comparten durante la implementación. Contenido pendiente de definir.',
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2h6l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>'
    );
}

// ──────────────────────────────────────────────────────────
//  Timeline del proyecto (audit log)
// ──────────────────────────────────────────────────────────
const _TL_COLORS = {
    tarea_completada:     '#16a34a',
    tarea_reabierta:      '#f59e0b',
    tarea_eliminada:      '#dc2626',
    tarea_movida:         '#6366f1',
    tarea_anadida:        '#3b82f6',
    tarea_actualizada:    '#8b5cf6',
    subtarea_completada:  '#16a34a',
    subtarea_reabierta:   '#f59e0b',
    subtarea_eliminada:   '#dc2626',
    subtarea_anadida:     '#3b82f6',
    subtarea_actualizada: '#8b5cf6',
    subtarea_agendada:    '#0ea5e9',
    subtarea_desagendada: '#94a3b8',
    show_asignado:        '#10b981',
    show_noshow:          '#ef4444',
    show_limpiado:        '#94a3b8',
    proyecto_creado:      '#14b8a6',
    proyecto_pausado:     '#f59e0b',
    proyecto_reanudado:   '#10b981',
    proyecto_completado:  '#16a34a',
    proyecto_eliminado:   '#dc2626',
    proyecto_actualizado: '#6366f1',
    anotacion_added:      '#6366f1',
    anotacion_updated:    '#6366f1',
    anotacion_deleted:    '#94a3b8',
    adjunto_add:          '#10b981',
    adjunto_remove:       '#f59e0b',
    contacto_added:       '#3b82f6',
    contacto_removed:     '#94a3b8',
    otro:                 '#64748b'
};
const _TL_LABELS = {
    tarea_completada:     'Tarea ✓',
    tarea_reabierta:      'Tarea ↩',
    tarea_eliminada:      'Tarea ×',
    tarea_movida:         'Tarea →',
    tarea_anadida:        '+ Tarea',
    tarea_actualizada:    'Tarea edit',
    subtarea_completada:  'Subtarea ✓',
    subtarea_reabierta:   'Subtarea ↩',
    subtarea_eliminada:   'Subtarea ×',
    subtarea_anadida:     '+ Subtarea',
    subtarea_actualizada: 'Subtarea edit',
    subtarea_agendada:    'Agendada',
    subtarea_desagendada: 'Desagendada',
    proyecto_pausado:     'Pausado',
    proyecto_reanudado:   'Reanudado',
    proyecto_completado:  'Finalizado',
    proyecto_creado:      'Creado',
    proyecto_actualizado: 'Actualizado',
    anotacion_added:      '+ Nota',
    otro:                 'Otro'
};

function _tlIniciales(nombre) {
    const p = String(nombre || '?').trim().split(/\s+/);
    return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
}
function _tlFormatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

async function renderDetalleTimeline(proyecto) {
    const cont = document.getElementById('detalle-timeline');
    if (!cont) return;
    cont.innerHTML = `
        <div class="timeline-head">
            <h3 style="margin:0">Timeline del proyecto</h3>
            <p style="font-size:12px;color:var(--text-muted);margin:4px 0 0">Registro cronológico de acciones realizadas sobre este proyecto.</p>
        </div>
        <div class="timeline-list" id="timeline-list">
            <div style="text-align:center;padding:30px 0;color:#94a3b8;font-size:13px">
                <div class="spinner" style="margin:0 auto 10px"></div>
                Cargando timeline…
            </div>
        </div>`;

    const rows = await YurestConfig.getProyectoHistorial({ proyectoId: proyecto.id, limit: 300 });
    const list = document.getElementById('timeline-list');
    if (!list) return;

    if (!rows.length) {
        list.innerHTML = `
            <div style="text-align:center;padding:40px 16px;color:#94a3b8;background:#fff;border:1.5px dashed #e2e8f0;border-radius:12px;font-size:13px">
                Aún no hay acciones registradas. Al marcar tareas, mover subtareas o cambiar el estado del proyecto, las verás aquí.
            </div>`;
        return;
    }

    list.innerHTML = rows.map(r => {
        const color = _TL_COLORS[r.accion] || _TL_COLORS.otro;
        const label = _TL_LABELS[r.accion] || r.accion;
        const cambios = r.cambios && typeof r.cambios === 'object' ? r.cambios : {};
        const keys = Object.keys(cambios);
        const diff = keys.length === 0 ? '' : `
            <div class="tl-changes">
                ${keys.slice(0, 10).map(k => {
                    // Para el campo 'estado' mostramos el label bonito
                    // ("Finalizado" en vez de "completado") en Timeline;
                    // los demás campos van tal cual.
                    const fmt = (k === 'estado')
                        ? v => labelEstadoProyecto(v) || '—'
                        : v => (v ?? '—');
                    return `
                    <div class="tl-change-row">
                        <span class="tl-change-field">${escapeHtml(k)}</span>
                        <span class="tl-change-before">${escapeHtml(String(fmt(cambios[k].before)))}</span>
                        <span class="tl-change-arrow">→</span>
                        <span class="tl-change-after">${escapeHtml(String(fmt(cambios[k].after)))}</span>
                    </div>`;
                }).join('')}
            </div>`;
        const ctx = [
            r.seccion_nombre ? `Sección: ${escapeHtml(r.seccion_nombre)}` : '',
            r.tarea_nombre ? `Tarea: ${escapeHtml(r.tarea_nombre)}` : ''
        ].filter(Boolean).join(' · ');
        return `
            <article class="tl-entry" style="--tl-color:${color}">
                <div class="tl-entry-head">
                    <span class="tl-avatar" style="background:${color}">${escapeHtml(_tlIniciales(r.usuario_nombre || '—'))}</span>
                    <div class="tl-meta">
                        <div class="tl-user">${escapeHtml(r.usuario_nombre || '—')}</div>
                        <div class="tl-fecha">${escapeHtml(_tlFormatFecha(r.creado_at))}</div>
                    </div>
                    <span class="tl-badge" style="background:${color}">${escapeHtml(label)}</span>
                </div>
                ${r.descripcion ? `<div class="tl-desc">${escapeHtml(r.descripcion)}</div>` : ''}
                ${ctx ? `<div class="tl-ctx">${ctx}</div>` : ''}
                ${diff}
            </article>`;
    }).join('');
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

    // Layout centrado con max-width razonable. Antes el form-row con
    // flex-wrap dejaba el botón "Vincular" flotando en el centro del
    // modal cuando la ventana era ancha — queda mucho mejor con el
    // input a ancho completo y los botones alineados debajo.
    container.innerHTML = `
        <div class="desarrollos-wrap">
            <div class="desarrollos-card">
                <label class="desarrollos-label" for="asana-project-url">URL del proyecto en Asana</label>
                <input type="url" id="asana-project-url" class="form-control desarrollos-input"
                       placeholder="https://app.asana.com/0/1234567890/list"
                       value="${escapeHtml(asanaUrl)}">
                <small class="desarrollos-hint">
                    Pega la URL completa del proyecto desde Asana. Se guardará en el proyecto
                    y se usará para listar sus tareas aquí.
                </small>
                <div class="desarrollos-actions">
                    <button class="btn btn-primary btn-sm" onclick="vincularAsana()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        ${asanaId ? 'Actualizar' : 'Vincular'}
                    </button>
                    ${asanaId ? `
                        <a class="btn btn-secondary btn-sm" href="${escapeHtml(asanaUrl)}" target="_blank" rel="noopener">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Abrir en Asana
                        </a>
                        <button class="btn btn-secondary btn-sm" onclick="desvincularAsana()" title="Desvincular">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            Desvincular
                        </button>
                    ` : ''}
                </div>
            </div>
            <div id="asana-tasks-list" class="desarrollos-list">
                ${asanaId
                    ? '<div class="loading-inline"><div class="spinner"></div> Cargando tareas de Asana…</div>'
                    : `<div class="desarrollos-empty">
                        <div class="desarrollos-empty-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        </div>
                        <p class="desarrollos-empty-title">Aún no hay desarrollos vinculados</p>
                        <p class="desarrollos-empty-desc">Pega la URL del proyecto en Asana y pulsa <strong>Vincular</strong> para ver aquí sus tareas.</p>
                    </div>`
                }
            </div>
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

// ID de la entrada de bitácora que está actualmente en modo edición (o null).
let bitacoraEditandoId = null;

function _bitacoraUsuarioActual() {
    try {
        if (window.YurestConfig && typeof window.YurestConfig.getSession === 'function') {
            const s = window.YurestConfig.getSession();
            if (s && s.user) return s.user;
        }
    } catch (_) {}
    return 'desconocido';
}

function _formatearFechaBitacora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function _bitacoraIniciales(nombre) {
    const partes = String(nombre || '?').trim().split(/\s+/);
    return ((partes[0]?.[0] || '?') + (partes[1]?.[0] || '')).toUpperCase();
}

function renderDetalleAnotaciones(proyecto) {
    const bitacora = Array.isArray(proyecto.anotaciones) ? proyecto.anotaciones : [];
    const adjuntos = proyecto.adjuntos || [];
    // Más recientes primero
    const ordenadas = [...bitacora].sort((a, b) =>
        String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || ''))
    );
    const usuario = _bitacoraUsuarioActual();

    document.getElementById('detalle-anotaciones').innerHTML = `
        <div class="anotaciones-editor">
            <label style="font-weight:600;margin-bottom:8px;display:block">Cuaderno de bitácora</label>

            <div class="bitacora-nueva">
                <div class="bitacora-meta-nueva">
                    <span class="bitacora-avatar">${escapeHtml(_bitacoraIniciales(usuario))}</span>
                    <span>${escapeHtml(usuario)}</span>
                </div>
                <textarea id="bitacora-nueva-text" class="form-control bitacora-textarea"
                    placeholder="Escribe una nueva entrada (acuerdos, llamadas, incidencias, próximos pasos…)"></textarea>
                <div style="display:flex;justify-content:flex-end;margin-top:8px">
                    <button class="btn btn-primary btn-sm" onclick="agregarEntradaBitacora()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Añadir entrada
                    </button>
                </div>
            </div>

            <div class="bitacora-lista" id="bitacora-lista">
                ${ordenadas.length === 0
                    ? '<div class="bitacora-empty">Aún no hay entradas. Crea la primera arriba.</div>'
                    : ordenadas.map(e => renderEntradaBitacora(e)).join('')}
            </div>

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
        </div>`;
}

function renderEntradaBitacora(entrada) {
    const editando = bitacoraEditandoId === entrada.id;
    const editadaTxt = entrada.fechaEdicion
        ? ` · editado ${escapeHtml(_formatearFechaBitacora(entrada.fechaEdicion))}`
        : '';
    return `
        <article class="bitacora-entrada" data-id="${escapeAttr(entrada.id)}">
            <div class="bitacora-entrada-header">
                <span class="bitacora-avatar">${escapeHtml(_bitacoraIniciales(entrada.usuario))}</span>
                <div class="bitacora-entrada-meta">
                    <span class="bitacora-usuario">${escapeHtml(entrada.usuario || '—')}</span>
                    <span class="bitacora-fecha">${escapeHtml(_formatearFechaBitacora(entrada.fechaCreacion))}${editadaTxt}</span>
                </div>
                ${editando ? '' : `
                    <div class="bitacora-acciones">
                        <button class="bitacora-btn-icon" title="Editar" onclick="iniciarEdicionBitacora('${escapeAttr(entrada.id)}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </button>
                        <button class="bitacora-btn-icon bitacora-btn-danger" title="Eliminar" onclick="eliminarEntradaBitacora('${escapeAttr(entrada.id)}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                `}
            </div>
            ${editando ? `
                <textarea class="form-control bitacora-textarea bitacora-edit-text" id="bitacora-edit-text-${escapeAttr(entrada.id)}">${escapeHtml(entrada.texto)}</textarea>
                <div class="bitacora-edit-actions">
                    <button class="btn btn-secondary btn-sm" onclick="cancelarEdicionBitacora()">Cancelar</button>
                    <button class="btn btn-primary btn-sm" onclick="guardarEdicionBitacora('${escapeAttr(entrada.id)}')">Guardar</button>
                </div>
            ` : `
                <div class="bitacora-texto">${escapeHtml(entrada.texto)}</div>
            `}
        </article>`;
}

async function _persistirBitacora(proyecto) {
    guardarProyectosLocal(proyectos);
    try {
        await actualizarAnotacionesAPI(proyecto.id, proyecto.anotaciones);
    } catch (err) {
        mostrarToast('No se pudo sincronizar con el servidor: ' + err.message, 'warning');
    }
}

async function agregarEntradaBitacora() {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    const ta = document.getElementById('bitacora-nueva-text');
    const texto = (ta?.value || '').trim();
    if (!texto) {
        mostrarToast('Escribe el contenido de la entrada', 'warning');
        ta?.focus();
        return;
    }
    if (!Array.isArray(proyecto.anotaciones)) proyecto.anotaciones = [];
    proyecto.anotaciones.push({
        id: generarId(),
        texto,
        usuario: _bitacoraUsuarioActual(),
        fechaCreacion: new Date().toISOString(),
        fechaEdicion: null
    });
    await _persistirBitacora(proyecto);
    renderDetalleAnotaciones(proyecto);
    mostrarToast('Entrada añadida', 'success');
}

function iniciarEdicionBitacora(entradaId) {
    bitacoraEditandoId = entradaId;
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;
    renderDetalleAnotaciones(proyecto);
    // Auto-foco en el textarea recién renderizado
    setTimeout(() => {
        const ta = document.getElementById('bitacora-edit-text-' + entradaId);
        if (ta) {
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);
        }
    }, 0);
}

function cancelarEdicionBitacora() {
    bitacoraEditandoId = null;
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (proyecto) renderDetalleAnotaciones(proyecto);
}

async function guardarEdicionBitacora(entradaId) {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto || !Array.isArray(proyecto.anotaciones)) return;
    const ta = document.getElementById('bitacora-edit-text-' + entradaId);
    const nuevoTexto = (ta?.value || '').trim();
    if (!nuevoTexto) {
        mostrarToast('La entrada no puede estar vacía', 'warning');
        return;
    }
    const entrada = proyecto.anotaciones.find(e => e.id === entradaId);
    if (!entrada) return;
    if (entrada.texto !== nuevoTexto) {
        entrada.texto = nuevoTexto;
        entrada.fechaEdicion = new Date().toISOString();
        // Si quien edita es distinto al autor, dejamos constancia en usuario
        // de la última edición.
        const editor = _bitacoraUsuarioActual();
        if (editor && editor !== entrada.usuario) {
            entrada.editadoPor = editor;
        }
        await _persistirBitacora(proyecto);
        mostrarToast('Entrada actualizada', 'success');
    }
    bitacoraEditandoId = null;
    renderDetalleAnotaciones(proyecto);
}

function eliminarEntradaBitacora(entradaId) {
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto || !Array.isArray(proyecto.anotaciones)) return;
    mostrarConfirmacion('¿Eliminar esta entrada de la bitácora?\n\nLa acción no se puede deshacer.', async () => {
        proyecto.anotaciones = proyecto.anotaciones.filter(e => e.id !== entradaId);
        await _persistirBitacora(proyecto);
        renderDetalleAnotaciones(proyecto);
        mostrarToast('Entrada eliminada', 'success');
    });
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
                ${tarea.show === 'No Show' ? '<span class="task-show-badge no-show">No Show</span>' : tarea.show === 'Show' ? '<span class="task-show-badge show">Show</span>' : ''}
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
        // Audit log: registrar la marca/desmarca en el timeline del proyecto.
        if (window.YurestConfig && YurestConfig.logProyectoHistorial) {
            YurestConfig.logProyectoHistorial({
                proyecto_id: proyectoId,
                accion: tarea.completada ? 'tarea_completada' : 'tarea_reabierta',
                seccion_nombre: seccionNombre,
                tarea_id: tarea.id,
                tarea_nombre: tarea.nombre || '',
                descripcion: tarea.completada
                    ? `Tarea completada: ${tarea.nombre || ''}`
                    : `Tarea reabierta: ${tarea.nombre || ''}`,
                metadata: {
                    cliente: proyecto.cliente || '',
                    implementador: proyecto.implementador || ''
                }
            });
        }
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
    document.getElementById('tarea-show').value = tarea.show || '';
    document.getElementById('tarea-notas').value = tarea.notas || '';

    abrirModal('modal-tarea');
}

function logShowTransicion(proyectoId, proyecto, seccionNombre, tarea, showAnterior, showNuevo) {
    if (showAnterior === showNuevo) return;
    if (!(window.YurestConfig && YurestConfig.logProyectoHistorial)) return;
    let accion = null, desc = '';
    if (showNuevo === 'No Show') { accion = 'show_noshow'; desc = `Marcada como No Show: ${tarea.nombre}`; }
    else if (showNuevo === 'Show') { accion = 'show_asignado'; desc = `Marcada como Show: ${tarea.nombre}`; }
    else if (showAnterior && !showNuevo) { accion = 'show_limpiado'; desc = `Asistencia limpiada: ${tarea.nombre}`; }
    if (!accion) return;
    YurestConfig.logProyectoHistorial({
        proyecto_id: proyectoId,
        accion,
        seccion_nombre: seccionNombre,
        tarea_id: tarea.id,
        tarea_nombre: tarea.nombre || '',
        descripcion: desc,
        metadata: { cliente: proyecto.cliente || '', implementador: proyecto.implementador || '' }
    });
}

async function crearReplicaNoShow(proyectoId, proyecto, seccion, tareaOriginal, insertarEn) {
    const subtareasClon = (tareaOriginal.subtareas || []).map(sub => ({
        id: generarId(),
        nombre: sub.nombre,
        completada: false,
        fechaEntrega: null,
        tiempoEstimado: sub.tiempoEstimado || null,
        tiempoReal: null,
        participantes: Array.isArray(sub.participantes) ? [...sub.participantes] : [],
        agendado: false
    }));
    const replica = {
        id: generarId(),
        nombre: 'Replicada por no show ' + tareaOriginal.nombre,
        completada: false,
        show: null,
        fechaEntrega: null,
        tiempoEstimado: tareaOriginal.tiempoEstimado || null,
        notas: tareaOriginal.notas || '',
        subtareas: subtareasClon
    };
    const idx = typeof insertarEn === 'number' && insertarEn >= 0 ? insertarEn + 1 : seccion.tareas.length;
    seccion.tareas.splice(idx, 0, replica);
    try {
        await actualizarTareaAPI(proyectoId, seccion.nombre, replica);
    } catch (err) {
        console.warn('Error guardando replica No Show:', err);
    }
    if (window.YurestConfig && YurestConfig.logProyectoHistorial) {
        YurestConfig.logProyectoHistorial({
            proyecto_id: proyectoId,
            accion: 'tarea_anadida',
            seccion_nombre: seccion.nombre,
            tarea_id: replica.id,
            tarea_nombre: replica.nombre,
            descripcion: `Replica generada por No Show: ${replica.nombre}`,
            metadata: { cliente: proyecto.cliente || '', implementador: proyecto.implementador || '', origen_tarea_id: tareaOriginal.id }
        });
    }
    return replica;
}

async function guardarTarea() {
    const proyectoId = document.getElementById('tarea-proyecto-id').value;
    const seccionNombre = document.getElementById('tarea-seccion-nombre').value;
    const seccionDestino = document.getElementById('tarea-seccion-destino').value || seccionNombre;
    const tareaId = document.getElementById('tarea-id').value;
    const nombre = document.getElementById('tarea-nombre').value.trim();
    const fechaEntrega = document.getElementById('tarea-fecha').value || null;
    const tiempoEstimado = parseInt(document.getElementById('tarea-tiempo').value) || null;
    const showValor = document.getElementById('tarea-show').value || null;
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
            const sourceSec = proyecto.secciones.find(s => s.nombre === seccionNombre);
            const tareaPrevia = sourceSec ? sourceSec.tareas.find(t => t.id === tareaId) : null;
            const showAnterior = tareaPrevia ? (tareaPrevia.show || null) : null;
            moverTareaEntreSecciones(proyecto, tareaId, seccionNombre, seccionDestino);
            await moverTareaAPI(proyectoId, tareaId, seccionNombre, seccionDestino).catch(() => {});
            const destSec = proyecto.secciones.find(s => s.nombre === seccionDestino);
            const tareaMovida = destSec ? destSec.tareas.find(t => t.id === tareaId) : null;
            let replicaCreada = false;
            if (tareaMovida) {
                tareaMovida.nombre = nombre;
                tareaMovida.fechaEntrega = fechaEntrega;
                tareaMovida.tiempoEstimado = tiempoEstimado;
                tareaMovida.show = showValor;
                tareaMovida.notas = notas;
                await actualizarTareaAPI(proyectoId, seccionDestino, tareaMovida).catch(() => {});
                logShowTransicion(proyectoId, proyecto, seccionDestino, tareaMovida, showAnterior, showValor);
                if (showAnterior !== 'No Show' && showValor === 'No Show' && destSec) {
                    const idx = destSec.tareas.findIndex(t => t.id === tareaId);
                    await crearReplicaNoShow(proyectoId, proyecto, destSec, tareaMovida, idx);
                    replicaCreada = true;
                }
            }
            guardarProyectosLocal(proyectos);
            cerrarModal('modal-tarea');
            abrirDetalle(proyectoId);
            refrescarTodo();
            mostrarToast(replicaCreada ? 'Tarea movida — replica creada por No Show' : 'Tarea movida a ' + seccionDestino, 'success');
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
        let replicaCreada = false;
        if (tareaId) {
            const tarea = seccion.tareas.find(t => t.id === tareaId);
            if (tarea) {
                const showAnterior = tarea.show || null;
                tarea.nombre = nombre;
                tarea.fechaEntrega = fechaEntrega;
                tarea.tiempoEstimado = tiempoEstimado;
                tarea.show = showValor;
                tarea.notas = notas;
                // completada se deriva de subtareas, no se cambia manualmente aqui
                await actualizarTareaAPI(proyectoId, seccionNombre, tarea);
                logShowTransicion(proyectoId, proyecto, seccionNombre, tarea, showAnterior, showValor);
                if (showAnterior !== 'No Show' && showValor === 'No Show') {
                    const idx = seccion.tareas.findIndex(t => t.id === tareaId);
                    await crearReplicaNoShow(proyectoId, proyecto, seccion, tarea, idx);
                    replicaCreada = true;
                }
            }
        } else {
            const nuevaTarea = {
                id: generarId(),
                nombre,
                completada: false,
                show: showValor,
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
        mostrarToast(replicaCreada ? 'Tarea guardada — replica creada por No Show' : 'Tarea guardada', 'success');
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
    document.getElementById('tarea-show').value = '';
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
        document.getElementById('subtarea-tiempo-real').value = subtarea.tiempoReal || '';
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
        document.getElementById('subtarea-tiempo-real').value = '';
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
    // Tiempo real: leemos el número tal cual; null si vacío para no
    // forzar 0 (un valor real de 0 minutos no tiene sentido y confundiría
    // el cómputo de desviación vs estimado).
    const _tReal = document.getElementById('subtarea-tiempo-real').value;
    const tiempoReal = _tReal === '' ? null : (parseInt(_tReal) || null);
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
                subtareaObj.tiempoReal = tiempoReal;
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
                tiempoReal,
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
        // Audit log
        if (window.YurestConfig && YurestConfig.logProyectoHistorial) {
            YurestConfig.logProyectoHistorial({
                proyecto_id: proyectoId,
                accion: sub.completada ? 'subtarea_completada' : 'subtarea_reabierta',
                seccion_nombre: seccionNombre,
                tarea_id: tarea.id,
                tarea_nombre: tarea.nombre || '',
                descripcion: sub.completada
                    ? `Subtarea completada: ${sub.nombre || ''} (en "${tarea.nombre || ''}")`
                    : `Subtarea reabierta: ${sub.nombre || ''} (en "${tarea.nombre || ''}")`,
                metadata: {
                    subtarea_id: sub.id,
                    subtarea_nombre: sub.nombre || '',
                    cliente: proyecto.cliente || '',
                    implementador: proyecto.implementador || ''
                }
            });
        }
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
