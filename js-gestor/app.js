// ==========================================
// APP - Gestor de Proyectos
// ==========================================

let proyectos = [];
let vistaActual = 'dashboard';
let dashboardFiltroActivo = null; // null, 'parados', 'avanzando', 'terminados', 'inicio'

// ==========================================
// INIT
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    try {
        proyectos = await cargarProyectos();
    } catch (err) {
        mostrarToast('Error cargando proyectos: ' + err.message, 'error');
        proyectos = [];
    } finally {
        hideLoading();
    }
    inicializarFiltros();
    refrescarTodo();

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
    const filtroImpl = document.getElementById('filtro-implementador');
    IMPLEMENTADORES.forEach(impl => {
        filtroImpl.innerHTML += `<option value="${impl}">${impl}</option>`;
    });

    const filtroTipo = document.getElementById('filtro-tipo');
    TIPOS_PROYECTO.forEach(tipo => {
        filtroTipo.innerHTML += `<option value="${tipo}">${tipo}</option>`;
    });

    const filtroEstado = document.getElementById('filtro-estado');
    ESTADOS_PROYECTO.forEach(estado => {
        filtroEstado.innerHTML += `<option value="${estado}">${capitalizar(estado)}</option>`;
    });

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
    // Update pill active states
    document.querySelectorAll('.filter-pill').forEach(pill => {
        const select = pill.querySelector('.filter-select');
        if (select.value) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    // Show/hide clear button
    const impl = document.getElementById('filtro-implementador').value;
    const tipo = document.getElementById('filtro-tipo').value;
    const estado = document.getElementById('filtro-estado').value;
    const clearBtn = document.getElementById('filter-clear-btn');
    clearBtn.style.display = (impl || tipo || estado) ? 'inline-flex' : 'none';

    renderizarDashboard();
}

function limpiarFiltros() {
    document.getElementById('filtro-implementador').value = '';
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-estado').value = '';
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
    const container = document.getElementById('dashboard-stats');

    container.innerHTML = `
        <div class="kpi-row">
            <div class="kpi-card kpi-total ${dashboardFiltroActivo === 'total' ? 'kpi-active' : ''}" onclick="filtrarDashboard('total')">
                <div class="kpi-value">${stats.totales.total}</div>
                <div class="kpi-label">Total clientes</div>
            </div>
            <div class="kpi-card kpi-parados ${dashboardFiltroActivo === 'parados' ? 'kpi-active' : ''}" onclick="filtrarDashboard('parados')">
                <div class="kpi-value">${stats.totales.parados}</div>
                <div class="kpi-label">Parados</div>
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
            <div class="kpi-card kpi-pendientes">
                <div class="kpi-value">${stats.totales.totalPendientes}</div>
                <div class="kpi-label">Total pendientes</div>
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
                            <th>Parados</th>
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
                                <td class="td-parados">${d.parados || '—'}</td>
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
                    Clientes parados — sin reducción de pendientes en 3+ semanas
                </div>
                <table class="parados-table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Implementador</th>
                            <th>Pendientes</th>
                            <th>Semanas parado</th>
                        </tr>
                    </thead>
                </table>
                <div class="parados-scroll">
                    <table class="parados-table">
                        <tbody>
                            ${stats.clientesParados.length > 0 ? stats.clientesParados.map(cp => `
                                <tr onclick="abrirDetalle('${cp.id}')">
                                    <td class="parados-cliente">${escapeHtml(cp.cliente)}</td>
                                    <td class="parados-impl">${cp.implementador.split(' ')[0]}</td>
                                    <td class="parados-pendientes">${cp.pendientes}</td>
                                    <td class="parados-semanas">${cp.semanasParado !== null ? cp.semanasParado : '—'}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">No hay clientes parados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// DASHBOARD KPI FILTERING
// ==========================================

const LABELS_FILTRO = {
    total: 'Todos los clientes',
    parados: 'Clientes parados',
    avanzando: 'Clientes avanzando',
    terminados: 'Clientes terminados',
    inicio: 'Clientes en inicio / sin datos'
};

const ESTADO_MAP = {
    parados: 'parado',
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
    const impl = document.getElementById('filtro-implementador').value;
    const tipo = document.getElementById('filtro-tipo').value;
    const estado = document.getElementById('filtro-estado').value;

    return proyectos.filter(p => {
        if (impl && p.implementador !== impl) return false;
        if (tipo && p.tipo !== tipo) return false;
        if (estado && p.estado !== estado) return false;
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

    grid.innerHTML = filtrados.map(p => renderCard(p)).join('');
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
                <div class="card-show-stats">
                    ${resumen.sesionesShow > 0 ? `<span class="show-badge show">Show: ${resumen.sesionesShow}</span>` : ''}
                    ${resumen.sesionesNoShow > 0 ? `<span class="show-badge no-show">No Show: ${resumen.sesionesNoShow}</span>` : ''}
                </div>
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
    } else {
        titulo.textContent = 'Nuevo Proyecto';
        inputId.value = '';
        inputCliente.value = '';
        selectImpl.selectedIndex = 0;
        selectTipo.selectedIndex = 0;
        selectEstado.selectedIndex = 0;
        inputFecha.value = new Date().toISOString().split('T')[0];
    }

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
                secciones: crearEstructuraProyecto()
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

    const color = COLORES_IMPLEMENTADOR[proyecto.implementador] || '#6366f1';
    const iniciales = INICIALES_IMPLEMENTADOR[proyecto.implementador] || '??';
    const resumen = obtenerResumenProyecto(proyecto);

    document.getElementById('detalle-titulo').textContent = proyecto.cliente;

    const body = document.getElementById('detalle-body');
    body.innerHTML = `
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
        </div>

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

    abrirModal('modal-detalle');
}

function renderSeccion(proyectoId, seccion, seccionIndex) {
    const completadas = seccion.tareas.filter(t => t.completada).length;
    const total = seccion.tareas.length;
    const isOpen = seccion.nombre === 'Planificación de sesiones' || total > 0;

    return `
        <div class="section-block ${isOpen ? 'open' : ''}" id="section-${seccionIndex}">
            <div class="section-header" onclick="toggleSeccion(${seccionIndex})">
                <div class="section-header-left">
                    <svg class="section-toggle" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <span class="section-name">${escapeHtml(seccion.nombre)}</span>
                </div>
                <span class="section-count">${completadas}/${total}</span>
            </div>
            <div class="section-body">
                ${total > 0 ? `
                    <div class="task-header-row">
                        <span></span>
                        <span>Tarea</span>
                        <span>Show</span>
                        <span>Entrega</span>
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
    const showClass = tarea.show === 'Show' ? 'show' : tarea.show === 'No Show' ? 'no-show' : 'none';
    const showText = tarea.show || '—';

    return `
        <div class="task-row">
            <div class="task-check ${tarea.completada ? 'checked' : ''}"
                 onclick="toggleTareaCompletada('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')"></div>
            <span class="task-name ${tarea.completada ? 'completed' : ''}">${escapeHtml(tarea.nombre)}</span>
            <span class="task-show-badge ${showClass}">${showText}</span>
            <span class="task-date">${tarea.fechaEntrega ? formatearFechaCorta(tarea.fechaEntrega) : '—'}</span>
            <span class="task-time">${tarea.tiempoEstimado ? tarea.tiempoEstimado + ' min' : '—'}</span>
            <button class="task-edit-btn" onclick="abrirModalTarea('${proyectoId}', '${escapeAttr(seccionNombre)}', '${tarea.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
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

    // No se puede completar sin marcar Show primero
    if (!tarea.completada && !tarea.show) {
        mostrarAviso('Debes asignar Show o No Show antes de completar la tarea');
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

    document.getElementById('modal-tarea-titulo').textContent = 'Editar Tarea';
    document.getElementById('tarea-proyecto-id').value = proyectoId;
    document.getElementById('tarea-seccion-nombre').value = seccionNombre;
    document.getElementById('tarea-id').value = tareaId;
    document.getElementById('tarea-nombre').value = tarea.nombre;
    document.getElementById('tarea-show').value = tarea.show || '';
    document.getElementById('tarea-fecha').value = tarea.fechaEntrega || '';
    document.getElementById('tarea-tiempo').value = tarea.tiempoEstimado || '';
    document.getElementById('tarea-completada').value = tarea.completada ? 'true' : 'false';
    document.getElementById('tarea-notas').value = tarea.notas || '';

    abrirModal('modal-tarea');
}

async function guardarTarea() {
    const proyectoId = document.getElementById('tarea-proyecto-id').value;
    const seccionNombre = document.getElementById('tarea-seccion-nombre').value;
    const tareaId = document.getElementById('tarea-id').value;
    const nombre = document.getElementById('tarea-nombre').value.trim();
    const show = document.getElementById('tarea-show').value || null;
    const fechaEntrega = document.getElementById('tarea-fecha').value || null;
    const tiempoEstimado = parseInt(document.getElementById('tarea-tiempo').value) || null;
    const completada = document.getElementById('tarea-completada').value === 'true';
    const notas = document.getElementById('tarea-notas').value.trim();

    if (!nombre) {
        document.getElementById('tarea-nombre').focus();
        return;
    }

    if (completada && !show) {
        mostrarAviso('Debes asignar Show o No Show antes de completar la tarea');
        return;
    }

    const proyecto = proyectos.find(p => p.id === proyectoId);
    if (!proyecto) return;
    const seccion = proyecto.secciones.find(s => s.nombre === seccionNombre);
    if (!seccion) return;

    showLoading();
    try {
        if (tareaId) {
            const tarea = seccion.tareas.find(t => t.id === tareaId);
            if (tarea) {
                const showAnterior = tarea.show;
                tarea.nombre = nombre;
                tarea.show = show;
                tarea.fechaEntrega = fechaEntrega;
                tarea.tiempoEstimado = tiempoEstimado;
                tarea.notas = notas;

                // Auto-logic: Show -> completada, No Show -> no completada + duplicar
                if (show === 'Show') {
                    tarea.completada = true;
                } else if (show === 'No Show') {
                    tarea.completada = false;
                    // Solo crear duplicado si el show cambio a "No Show" ahora
                    if (showAnterior !== 'No Show') {
                        const tareaIdx = seccion.tareas.indexOf(tarea);
                        const nuevaTarea = {
                            id: generarId(),
                            nombre: nombre,
                            completada: false,
                            show: null,
                            fechaEntrega: null,
                            tiempoEstimado: tiempoEstimado,
                            notas: ''
                        };
                        seccion.tareas.splice(tareaIdx + 1, 0, nuevaTarea);
                        // Sync duplicada al backend
                        await actualizarTareaAPI(proyectoId, seccionNombre, nuevaTarea).catch(() => {});
                    }
                } else {
                    tarea.completada = completada;
                }

                await actualizarTareaAPI(proyectoId, seccionNombre, tarea);
            }
        } else {
            // Auto-logic para tareas nuevas
            let autoCompletada = completada;
            if (show === 'Show') autoCompletada = true;
            if (show === 'No Show') autoCompletada = false;

            const nuevaTarea = {
                id: generarId(),
                nombre,
                completada: autoCompletada,
                show,
                fechaEntrega,
                tiempoEstimado,
                notas
            };
            seccion.tareas.push(nuevaTarea);
            await actualizarTareaAPI(proyectoId, seccionNombre, nuevaTarea);

            // Si nueva tarea con No Show, crear duplicado vacio
            if (show === 'No Show') {
                const dupTarea = {
                    id: generarId(),
                    nombre: nombre,
                    completada: false,
                    show: null,
                    fechaEntrega: null,
                    tiempoEstimado: tiempoEstimado,
                    notas: ''
                };
                seccion.tareas.push(dupTarea);
                await actualizarTareaAPI(proyectoId, seccionNombre, dupTarea).catch(() => {});
            }
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
    document.getElementById('modal-tarea-titulo').textContent = 'Nueva Tarea';
    document.getElementById('tarea-proyecto-id').value = proyectoId;
    document.getElementById('tarea-seccion-nombre').value = seccionNombre;
    document.getElementById('tarea-id').value = '';
    document.getElementById('tarea-nombre').value = '';
    document.getElementById('tarea-show').value = '';
    document.getElementById('tarea-fecha').value = '';
    document.getElementById('tarea-tiempo').value = '';
    document.getElementById('tarea-completada').value = 'false';
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
// IMPORT FROM ALTAS
// ==========================================

const WEBHOOK_ALTAS = 'https://n8n-soporte.data.yurest.dev/webhook/018f3362-7969-4c49-9088-c78e4446c77f';

let altasData = [];

async function importarDesdeAltas() {
    abrirModal('modal-import');
    document.getElementById('import-loading').style.display = '';
    document.getElementById('import-content').style.display = 'none';

    const session = JSON.parse(sessionStorage.getItem('yurest_auth') || '{}');

    try {
        const res = await fetch(WEBHOOK_ALTAS, {
            method: 'GET',
            headers: session.basicAuth ? { 'Authorization': 'Basic ' + session.basicAuth } : {}
        });
        if (!res.ok) throw new Error('Error ' + res.status);
        let data = {};
        try { data = await res.json(); } catch (_) {}
        const raw = Array.isArray(data) ? data
            : Array.isArray(data.clientes) ? data.clientes
            : Array.isArray(data.data) ? data.data : [];

        altasData = raw.map(normalizarAlta).filter(a => a.nombre);
        renderImportList();
    } catch (err) {
        document.getElementById('import-loading').style.display = 'none';
        document.getElementById('import-content').style.display = '';
        document.getElementById('import-content').innerHTML = `
            <div class="import-error">
                <p>No se pudieron cargar los datos de Altas</p>
                <p style="font-size:12px;color:var(--text-muted);margin-top:8px">${escapeHtml(err.message)}</p>
                <button class="btn btn-secondary" style="margin-top:12px" onclick="cerrarModal('modal-import')">Cerrar</button>
            </div>`;
    }
}

function normalizarAlta(f) {
    const get = (keys) => {
        for (const k of keys) {
            const val = (f[k] || '').toString().trim();
            if (val) return val;
        }
        return '';
    };

    const nombre = get(['Denominación Social', 'Denominacion Social', 'denominacion', 'Nombre Sociedad']);
    const comercial = get(['Nombre Comercial', 'nombreComercial', 'Nombre']);
    const tipo = get(['Tipo Cliente', 'Tipo de Cliente', 'tipoCliente']);
    const implementador = get(['Implementador']);
    const id = get(['ID', 'id']);
    const fecha = get(['Fecha', 'fecha']);
    const estado = get(['Estado', 'estado']);

    // Normalize tipo to match our TIPOS_PROYECTO
    let tipoNorm = 'Corporate sin cocina';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('lite') || tipoLower.includes('planes') || tipoLower === 'planes') {
        tipoNorm = 'Planes';
    } else if (tipoLower.includes('corporate') || tipoLower.includes('corp')) {
        // Check if has cocina modules
        const modulos = get(['Módulos', 'modulos']);
        if (modulos.toLowerCase().includes('cocina')) {
            tipoNorm = 'Corporate con cocina';
        } else {
            tipoNorm = 'Corporate sin cocina';
        }
    }

    return {
        altaId: id,
        nombre: nombre || comercial,
        nombreComercial: comercial,
        tipo: tipoNorm,
        tipoOriginal: tipo,
        implementador: IMPLEMENTADORES.includes(implementador) ? implementador : '',
        fecha,
        estado
    };
}

function renderImportList() {
    document.getElementById('import-loading').style.display = 'none';
    const content = document.getElementById('import-content');
    content.style.display = '';

    // Check which altas already exist as projects
    const nombresExistentes = new Set(proyectos.map(p => p.cliente.toLowerCase().trim()));

    const nuevas = altasData.filter(a => !nombresExistentes.has(a.nombre.toLowerCase().trim()));
    const existentes = altasData.filter(a => nombresExistentes.has(a.nombre.toLowerCase().trim()));

    content.innerHTML = `
        <div class="import-summary">
            <span class="count">${nuevas.length}</span>
            <span>clientes nuevos para importar (de ${altasData.length} totales, ${existentes.length} ya existen)</span>
        </div>

        ${nuevas.length > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <button class="import-select-all" onclick="toggleSelectAllImport()">Seleccionar / Deseleccionar todos</button>
            </div>
            <div class="import-scroll">
                <table class="import-table">
                    <thead>
                        <tr>
                            <th class="import-check"></th>
                            <th>Cliente</th>
                            <th>Tipo</th>
                            <th>Implementador</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${nuevas.map((a, i) => `
                            <tr>
                                <td class="import-check"><input type="checkbox" checked data-import-idx="${altasData.indexOf(a)}"></td>
                                <td><strong>${escapeHtml(a.nombre)}</strong>${a.nombreComercial && a.nombreComercial !== a.nombre ? `<br><span style="font-size:11px;color:var(--text-muted)">${escapeHtml(a.nombreComercial)}</span>` : ''}</td>
                                <td><span class="card-tipo">${escapeHtml(a.tipoOriginal || a.tipo)}</span></td>
                                <td>${a.implementador ? escapeHtml(a.implementador) : '<span style="color:var(--text-muted)">Sin asignar</span>'}</td>
                                <td><span class="import-new">NUEVO</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="import-actions">
                <span style="font-size:13px;color:var(--text-muted)"><span id="import-selected-count">${nuevas.length}</span> seleccionados</span>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-secondary" onclick="cerrarModal('modal-import')">Cancelar</button>
                    <button class="btn btn-primary" onclick="ejecutarImport()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Importar seleccionados
                    </button>
                </div>
            </div>
        ` : `
            <div style="text-align:center;padding:24px;color:var(--text-muted)">
                <p>Todos los clientes de Altas ya tienen proyecto creado.</p>
                <button class="btn btn-secondary" style="margin-top:12px" onclick="cerrarModal('modal-import')">Cerrar</button>
            </div>
        `}
    `;

    // Update selected count on checkbox change
    content.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateImportCount);
    });
}

function toggleSelectAllImport() {
    const checkboxes = document.querySelectorAll('#import-content input[type="checkbox"]');
    const allChecked = [...checkboxes].every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateImportCount();
}

function updateImportCount() {
    const checked = document.querySelectorAll('#import-content input[type="checkbox"]:checked').length;
    const el = document.getElementById('import-selected-count');
    if (el) el.textContent = checked;
}

async function ejecutarImport() {
    const checkboxes = document.querySelectorAll('#import-content input[type="checkbox"]:checked');
    let importados = 0;
    let errores = 0;

    showLoading();
    try {
        for (const cb of checkboxes) {
            const idx = parseInt(cb.dataset.importIdx);
            const alta = altasData[idx];
            if (!alta) continue;

            const nuevoProyecto = {
                id: generarId(),
                cliente: alta.nombre,
                implementador: alta.implementador || IMPLEMENTADORES[0],
                tipo: alta.tipo,
                estado: 'activo',
                fechaInicio: alta.fecha ? formatearFechaISO(alta.fecha) : new Date().toISOString().split('T')[0],
                ultimaActividad: new Date().toISOString().split('T')[0],
                secciones: crearEstructuraProyecto()
            };

            try {
                await crearProyectoAPI(nuevoProyecto);
                proyectos.push(nuevoProyecto);
                importados++;
            } catch (err) {
                console.warn('Error importando', alta.nombre, err);
                errores++;
            }
        }

        if (importados > 0) {
            guardarProyectosLocal(proyectos);
            refrescarTodo();
        }

        cerrarModal('modal-import');
        let msg = `Se importaron ${importados} proyecto${importados !== 1 ? 's' : ''} correctamente`;
        if (errores > 0) msg += ` (${errores} con error)`;
        mostrarToast(msg, errores > 0 ? 'warning' : 'success');
    } catch (err) {
        mostrarToast('Error durante la importacion: ' + err.message, 'error');
    } finally {
        hideLoading();
    }
}

function formatearFechaISO(fechaStr) {
    if (!fechaStr) return new Date().toISOString().split('T')[0];
    // Try parsing various formats
    const d = new Date(fechaStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    // Try dd/mm/yyyy
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
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
