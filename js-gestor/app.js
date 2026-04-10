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
        await cargarPlantillas();
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
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
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

    const proyTipo = document.getElementById('proyecto-tipo');
    TIPOS_PROYECTO.forEach(tipo => {
        proyTipo.innerHTML += `<option value="${tipo}">${tipo}</option>`;
    });

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

    let filtrados;
    if (tipo === 'total') {
        filtrados = proyectos;
    } else {
        const estadoBuscado = ESTADO_MAP[tipo];
        filtrados = proyectos.filter(p => obtenerEstadoDashboard(p) === estadoBuscado);
    }

    mostrarCardsFiltradas(LABELS_FILTRO[tipo], filtrados);
    renderizarEstadisticas(); // re-render to update active state
}

function filtrarDashboardPorImplementador(impl) {
    dashboardFiltroActivo = null;
    const filtrados = proyectos.filter(p => p.implementador === impl);
    mostrarCardsFiltradas(`Proyectos de ${impl}`, filtrados);
    renderizarEstadisticas();
}

function mostrarCardsFiltradas(titulo, lista) {
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
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    // Re-render filtered dashboard cards if active
    if (dashboardFiltroActivo) {
        filtrarDashboard(dashboardFiltroActivo);
    }
}

function obtenerProyectosFiltrados() {
    const implSeleccionados = [...document.querySelectorAll('.filtro-impl-cb:checked')].map(cb => cb.value);
    const tiposSeleccionados = [...document.querySelectorAll('.filtro-tipo-cb:checked')].map(cb => cb.value);
    const estadosSeleccionados = [...document.querySelectorAll('.filtro-estado-cb:checked')].map(cb => cb.value);
    const buscar = (document.getElementById('buscar-proyecto')?.value || '').toLowerCase().trim();

    return proyectos.filter(p => {
        if (implSeleccionados.length > 0 && !implSeleccionados.includes(p.implementador)) return false;
        if (tiposSeleccionados.length > 0 && !tiposSeleccionados.includes(p.tipo)) return false;
        if (estadosSeleccionados.length > 0 && !estadosSeleccionados.includes(p.estado)) return false;
        if (buscar && !p.cliente.toLowerCase().includes(buscar) && !p.implementador.toLowerCase().includes(buscar)) return false;
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
        grid.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                <h3>No hay proyectos</h3>
                <p>Crea un nuevo proyecto para empezar</p>
            </div>`;
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
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ==========================================
// CRUD PROYECTOS
// ==========================================

function abrirModalProyecto(id) {
    const titulo = document.getElementById('modal-proyecto-titulo');
    const inputId = document.getElementById('proyecto-id');
    const inputCliente = document.getElementById('proyecto-cliente');
    const selectImpl = document.getElementById('proyecto-implementador');
    const selectTipo = document.getElementById('proyecto-tipo');
    const selectEstado = document.getElementById('proyecto-estado');
    const inputFecha = document.getElementById('proyecto-fecha');
    const plantillaGroup = document.getElementById('proyecto-plantilla-group');
    const selectPlantilla = document.getElementById('proyecto-plantilla');

    // Populate plantilla dropdown
    selectPlantilla.innerHTML = plantillas.map(p =>
        `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`
    ).join('');

    if (id) {
        const p = proyectos.find(pr => pr.id === id);
        if (!p) return;
        titulo.textContent = 'Editar Proyecto';
        inputId.value = p.id;
        inputCliente.value = p.cliente;
        selectImpl.value = p.implementador;
        selectTipo.value = p.tipo;
        selectEstado.value = p.estado;
        inputFecha.value = p.fechaInicio;
        document.getElementById('proyecto-tpv').value = p.tpv || '';
        plantillaGroup.style.display = 'none';
        window._proyectoParticipantes = [...(p.participantes || [])];
    } else {
        titulo.textContent = 'Nuevo Proyecto';
        inputId.value = '';
        inputCliente.value = '';
        selectImpl.selectedIndex = 0;
        selectTipo.selectedIndex = 0;
        selectEstado.selectedIndex = 0;
        inputFecha.value = new Date().toISOString().split('T')[0];
        document.getElementById('proyecto-tpv').value = '';
        plantillaGroup.style.display = '';
        window._proyectoParticipantes = [];
    }

    renderParticipantesChips();
    abrirModal('modal-proyecto');
    inputCliente.focus();
}

async function guardarProyecto() {
    const id = document.getElementById('proyecto-id').value;
    const cliente = document.getElementById('proyecto-cliente').value.trim();
    const implementador = document.getElementById('proyecto-implementador').value;
    const tipo = document.getElementById('proyecto-tipo').value;
    const estado = document.getElementById('proyecto-estado').value;
    const fechaInicio = document.getElementById('proyecto-fecha').value;
    const plantillaId = document.getElementById('proyecto-plantilla').value;
    const tpv = document.getElementById('proyecto-tpv').value.trim();

    if (!cliente) {
        document.getElementById('proyecto-cliente').focus();
        return;
    }

    showLoading();
    try {
        if (id) {
            const idx = proyectos.findIndex(p => p.id === id);
            if (idx !== -1) {
                proyectos[idx].cliente = cliente;
                proyectos[idx].implementador = implementador;
                proyectos[idx].tipo = tipo;
                proyectos[idx].estado = estado;
                proyectos[idx].fechaInicio = fechaInicio;
                proyectos[idx].tpv = tpv;
                proyectos[idx].participantes = window._proyectoParticipantes || [];
                await actualizarProyectoAPI(proyectos[idx]);
            }
        } else {
            const nuevoProyecto = {
                id: generarId(),
                cliente,
                implementador,
                tipo,
                estado,
                fechaInicio,
                ultimaActividad: new Date().toISOString().split('T')[0],
                tpv,
                participantes: window._proyectoParticipantes || [],
                secciones: plantillaId ? crearEstructuraDesdePlantilla(plantillaId) : crearEstructuraProyecto()
            };
            await crearProyectoAPI(nuevoProyecto);
            proyectos.push(nuevoProyecto);
        }

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
    mostrarConfirmacion('¿Eliminar este proyecto y todas sus tareas?', async () => {
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
    detalleProyectoId = id;
    const proyecto = proyectos.find(p => p.id === id);
    if (!proyecto) return;

    document.getElementById('detalle-titulo').textContent = proyecto.cliente;

    // Reset tabs
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.detail-tab[data-dtab="tareas"]').classList.add('active');
    document.getElementById('detalle-tareas').style.display = '';
    document.getElementById('detalle-contactos').style.display = 'none';
    document.getElementById('detalle-desarrollos').style.display = 'none';
    document.getElementById('detalle-anotaciones').style.display = 'none';

    // Render Tareas tab
    renderDetalleTareas(proyecto);

    abrirModal('modal-detalle');
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

    if (!email || !email.includes('@')) {
        document.getElementById('contacto-email').focus();
        mostrarToast('Email es obligatorio', 'warning');
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

async function renderDetalleDesarrollos(proyecto) {
    const container = document.getElementById('detalle-desarrollos');
    const asanaId = proyecto.asanaProjectId || '';

    container.innerHTML = `
        <div class="desarrollos-config">
            <div class="form-row" style="align-items:flex-end">
                <div class="form-group" style="flex:1">
                    <label>Asana Project ID</label>
                    <input type="text" id="asana-project-id" class="form-control" placeholder="Ej: 1234567890" value="${escapeHtml(asanaId)}">
                </div>
                <button class="btn btn-primary btn-sm" onclick="vincularAsana()" style="margin-bottom:0;height:38px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    Vincular
                </button>
            </div>
        </div>
        <div id="asana-tasks-list" class="desarrollos-list">
            ${asanaId ? '<div class="loading-inline"><div class="spinner"></div> Cargando tareas de Asana...</div>' : '<div style="text-align:center;padding:32px;color:var(--text-muted)">Vincula un proyecto de Asana para ver sus desarrollos</div>'}
        </div>`;

    if (asanaId) {
        const tasks = await obtenerTareasAsana(asanaId);
        const listEl = document.getElementById('asana-tasks-list');
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
    const asanaId = document.getElementById('asana-project-id').value.trim();
    const proyecto = proyectos.find(p => p.id === detalleProyectoId);
    if (!proyecto) return;

    proyecto.asanaProjectId = asanaId;
    guardarProyectosLocal(proyectos);
    try { await actualizarProyectoAPI(proyecto).catch(() => {}); } catch (_) {}

    renderDetalleDesarrollos(proyecto);
    mostrarToast(asanaId ? 'Proyecto Asana vinculado' : 'Vinculacion removida', 'success');
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
        reader.onload = function(e) {
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
    mostrarConfirmacion('¿Eliminar este adjunto?', () => {
        proyecto.adjuntos.splice(index, 1);
        guardarProyectosLocal(proyectos);
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

function mostrarAviso(mensaje) {
    document.getElementById('confirm-mensaje').textContent = mensaje;
    const btn = document.getElementById('confirm-btn');
    btn.textContent = 'Entendido';
    btn.className = 'btn btn-primary';
    btn.onclick = () => {
        cerrarModal('modal-confirm');
        btn.textContent = 'Eliminar';
        btn.className = 'btn btn-danger';
    };
    abrirModal('modal-confirm');
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
    document.getElementById('confirm-mensaje').textContent = mensaje;
    const btn = document.getElementById('confirm-btn');
    btn.onclick = () => {
        cerrarModal('modal-confirm');
        callback();
    };
    abrirModal('modal-confirm');
}

// ==========================================
// RESET
// ==========================================

function resetearYRecargar() {
    mostrarConfirmacion('¿Resetear todos los datos a los valores de ejemplo?', async () => {
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
// PLANTILLAS (Templates CRUD)
// ==========================================

function abrirModalPlantillas() {
    renderListaPlantillas();
    abrirModal('modal-plantillas');
}

function renderListaPlantillas() {
    const container = document.getElementById('plantillas-lista');
    if (plantillas.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted)">No hay plantillas</div>';
        return;
    }

    container.innerHTML = plantillas.map(pl => {
        const totalTareas = pl.secciones.reduce((acc, s) => acc + s.tareas.length, 0);
        const secConTareas = pl.secciones.filter(s => s.tareas.length > 0).length;
        return `
            <div class="plantilla-card">
                <div class="plantilla-card-info">
                    <div class="plantilla-card-name">${escapeHtml(pl.nombre)}</div>
                    <div class="plantilla-card-desc">${escapeHtml(pl.descripcion || '')}</div>
                    <div class="plantilla-card-meta">${totalTareas} tareas en ${secConTareas} secciones</div>
                </div>
                <div class="plantilla-card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="abrirEditorPlantilla('${pl.id}')">Editar</button>
                    <button class="btn btn-secondary btn-sm" onclick="duplicarPlantilla('${pl.id}')">Duplicar</button>
                    ${pl.id !== 'default' ? `<button class="btn btn-danger btn-sm" onclick="eliminarPlantillaConfirm('${pl.id}')">Eliminar</button>` : ''}
                </div>
            </div>`;
    }).join('');
}

function abrirEditorPlantilla(id) {
    const titulo = document.getElementById('editor-plantilla-titulo');
    const inputId = document.getElementById('plantilla-id');
    const inputNombre = document.getElementById('plantilla-nombre');
    const inputDesc = document.getElementById('plantilla-descripcion');
    const seccionesContainer = document.getElementById('plantilla-secciones');

    let seccionesData;

    if (id) {
        const pl = plantillas.find(p => p.id === id);
        if (!pl) return;
        titulo.textContent = 'Editar Plantilla';
        inputId.value = pl.id;
        inputNombre.value = pl.nombre;
        inputDesc.value = pl.descripcion || '';
        seccionesData = pl.secciones;
    } else {
        titulo.textContent = 'Nueva Plantilla';
        inputId.value = '';
        inputNombre.value = '';
        inputDesc.value = '';
        seccionesData = SECCIONES.map(nombre => ({ nombre, tareas: [] }));
    }

    // Render secciones con inputs de tareas
    seccionesContainer.innerHTML = seccionesData.map((sec, i) => `
        <div class="plantilla-seccion-block">
            <div class="plantilla-seccion-header">${escapeHtml(sec.nombre)}</div>
            <div class="plantilla-tareas-list" id="pl-tareas-${i}">
                ${sec.tareas.map((t, ti) => `
                    <div class="plantilla-tarea-chip">
                        <span>${escapeHtml(t)}</span>
                        <button onclick="quitarTareaPlantilla(${i}, ${ti})" title="Quitar">&times;</button>
                    </div>
                `).join('')}
            </div>
            <div class="plantilla-add-tarea">
                <input type="text" class="form-control" placeholder="Nueva tarea..." id="pl-input-${i}"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();agregarTareaPlantilla(${i})}">
                <button class="btn btn-secondary btn-sm" onclick="agregarTareaPlantilla(${i})">+</button>
            </div>
        </div>
    `).join('');

    // Store current secciones data for manipulation
    window._plantillaSeccionesEdit = JSON.parse(JSON.stringify(seccionesData));

    abrirModal('modal-editar-plantilla');
    inputNombre.focus();
}

function agregarTareaPlantilla(secIdx) {
    const input = document.getElementById('pl-input-' + secIdx);
    const nombre = input.value.trim();
    if (!nombre) return;
    window._plantillaSeccionesEdit[secIdx].tareas.push(nombre);
    input.value = '';
    // Re-render just the chips
    renderChipsPlantilla(secIdx);
    input.focus();
}

function quitarTareaPlantilla(secIdx, tareaIdx) {
    window._plantillaSeccionesEdit[secIdx].tareas.splice(tareaIdx, 1);
    renderChipsPlantilla(secIdx);
}

function renderChipsPlantilla(secIdx) {
    const container = document.getElementById('pl-tareas-' + secIdx);
    const tareas = window._plantillaSeccionesEdit[secIdx].tareas;
    container.innerHTML = tareas.map((t, ti) => `
        <div class="plantilla-tarea-chip">
            <span>${escapeHtml(t)}</span>
            <button onclick="quitarTareaPlantilla(${secIdx}, ${ti})" title="Quitar">&times;</button>
        </div>
    `).join('');
}

async function guardarPlantilla() {
    const id = document.getElementById('plantilla-id').value;
    const nombre = document.getElementById('plantilla-nombre').value.trim();
    const descripcion = document.getElementById('plantilla-descripcion').value.trim();

    if (!nombre) {
        document.getElementById('plantilla-nombre').focus();
        return;
    }

    const secciones = window._plantillaSeccionesEdit;

    showLoading();
    try {
        if (id) {
            const idx = plantillas.findIndex(p => p.id === id);
            if (idx !== -1) {
                plantillas[idx].nombre = nombre;
                plantillas[idx].descripcion = descripcion;
                plantillas[idx].secciones = secciones;
                await actualizarPlantillaAPI(plantillas[idx]).catch(() => {});
            }
        } else {
            const nueva = { id: generarId(), nombre, descripcion, secciones };
            plantillas.push(nueva);
            await crearPlantillaAPI(nueva).catch(() => {});
        }

        guardarPlantillasLocal(plantillas);
        cerrarModal('modal-editar-plantilla');
        renderListaPlantillas();
        mostrarToast('Plantilla guardada', 'success');
    } catch (err) {
        mostrarToast('Error al guardar plantilla: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

async function duplicarPlantilla(id) {
    const pl = plantillas.find(p => p.id === id);
    if (!pl) return;
    const copia = {
        id: generarId(),
        nombre: pl.nombre + ' (copia)',
        descripcion: pl.descripcion,
        secciones: JSON.parse(JSON.stringify(pl.secciones))
    };
    plantillas.push(copia);
    guardarPlantillasLocal(plantillas);
    await crearPlantillaAPI(copia).catch(() => {});
    renderListaPlantillas();
    mostrarToast('Plantilla duplicada', 'success');
}

function eliminarPlantillaConfirm(id) {
    mostrarConfirmacion('¿Eliminar esta plantilla?', async () => {
        plantillas = plantillas.filter(p => p.id !== id);
        guardarPlantillasLocal(plantillas);
        await eliminarPlantillaAPI(id).catch(() => {});
        renderListaPlantillas();
        mostrarToast('Plantilla eliminada', 'success');
    });
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
        document.getElementById('subtarea-agendar').checked = false;
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
        const nombresExistentes = new Set(proyectos.map(p => p.cliente.toLowerCase().trim()));
        const sinAsignar = todas.filter(a => !nombresExistentes.has(a.nombre.toLowerCase().trim()));
        badge.textContent = sinAsignar.length > 0 ? sinAsignar.length : '';
    } catch (_) {}
}

// ==========================================
// UTILS
// ==========================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
