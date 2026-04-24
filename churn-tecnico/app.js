// ── Config ─────────────────────────────────────────────────

const API_URL = 'https://n8n-soporte.data.yurest.dev/webhook/9e0fc21e-f895-42ce-ac92-b710aaa45b25';
const SUMMARY_URL = 'https://n8n-soporte.data.yurest.dev/webhook/2c62e049-ff93-49de-8095-d64db239104f';
const CHURN_LEVELS_URL = 'https://n8n-soporte.data.yurest.dev/webhook/6c6b655b-98c4-4c0a-afae-73ea4cd3964f';
const CHURN_LOOKUP_URL = 'https://n8n-soporte.data.yurest.dev/webhook/buscar-resumen';
const TICKETS_URL = 'https://n8n-soporte.data.yurest.dev/webhook/042f57e0-4391-4d80-a158-b6b8e9fa1084';

// IDs de custom_fields de Zendesk que usamos como filtros en el modal.
const TICKET_FIELD_IDS = {
  tipo:    26672700540829,  // consulta_técnica / incidencia_dev / integracion_tpv / formacion …
  entorno: 27376906089629,  // backoffice_cliente / admin …
  modulo:  27243772817053,  // array: [tpv, cocina, compras, …]
};

const STATUS_LABELS = {
  new: 'Nuevo', open: 'Abierto', pending: 'Pendiente',
  hold: 'En espera', solved: 'Resuelto', closed: 'Cerrado'
};

let clients = [];
let selectedTags = new Set();
// Filtro por nivel de churn (Supabase.nivel). Rango cerrado [0,10]; null
// incluye las organizaciones que aún no tienen fila en churn_tecnico
// (nivel === null) — por defecto se incluyen para no ocultar el backlog.
let churnMin = 0;
let churnMax = 10;
let includeNullChurn = true;

// ── UI Constants ───────────────────────────────────────────

const AVATAR_COLORS = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777'];

// Fixed tag color palette — each tag always gets the same color
const TAG_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af' },  // blue
  { bg: '#dcfce7', text: '#166534' },  // green
  { bg: '#fef3c7', text: '#92400e' },  // amber
  { bg: '#fce7f3', text: '#9d174d' },  // pink
  { bg: '#e0e7ff', text: '#3730a3' },  // indigo
  { bg: '#ccfbf1', text: '#115e59' },  // teal
  { bg: '#fee2e2', text: '#991b1b' },  // red
  { bg: '#f3e8ff', text: '#6b21a8' },  // purple
  { bg: '#fef9c3', text: '#854d0e' },  // yellow
  { bg: '#e0f2fe', text: '#075985' },  // sky
  { bg: '#ede9fe', text: '#5b21b6' },  // violet
  { bg: '#d1fae5', text: '#065f46' },  // emerald
];

const tagColorCache = {};
let tagColorIndex = 0;

function getTagColor(tag) {
  if (!tagColorCache[tag]) {
    tagColorCache[tag] = TAG_PALETTE[tagColorIndex % TAG_PALETTE.length];
    tagColorIndex++;
  }
  return tagColorCache[tag];
}

// Labels legibles para los campos de Zendesk
const FIELD_LABELS = {
  id: 'ID',
  name: 'Nombre',
  url: 'URL API',
  shared_tickets: 'Tickets compartidos',
  shared_comments: 'Comentarios compartidos',
  external_id: 'ID externo',
  created_at: 'Fecha de creación',
  updated_at: 'Última actualización',
  domain_names: 'Dominios',
  details: 'Detalles',
  notes: 'Notas',
  group_id: 'ID de grupo',
  tags: 'Etiquetas',
  organization_fields: 'Campos personalizados'
};

// ── Fetch clientes ─────────────────────────────────────────

async function fetchClients() {
  const res = await fetch(API_URL, { method: 'GET', credentials: 'omit', cache: 'no-store' });

  if (res.status === 401 || res.status === 403) {
    throw new Error('El webhook requiere autenticación (deshabilita Basic Auth en n8n).');
  }
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.organizations || data.clients || data.data || data.results || []);

  return list.map((item, index) => {
    let zendeskUrl = '';
    if (item.url) {
      const match = item.url.match(/^(https?:\/\/[^/]+)\/api\/v2\/organizations\/(\d+)\.json$/);
      if (match) zendeskUrl = `${match[1]}/agent/organizations/${match[2]}`;
    }

    return {
      id: item.id,
      name: item.name || `Cliente ${index + 1}`,
      tags: Array.isArray(item.tags) ? item.tags : [],
      zendeskUrl,
      nivel: null,           // 0-10 desde Supabase; null si no se ha procesado aún
      fechaResumen: null,    // ISO timestamp del último upsert
      _raw: item
    };
  });
}

// Mapa id_organizacion → { nivel, fecha_resumen } desde la tabla churn_tecnico.
async function fetchChurnLevels() {
  try {
    const res = await fetch(CHURN_LEVELS_URL, { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return new Map();
    const rows = await res.json();
    const list = Array.isArray(rows) ? rows : (rows.data || []);
    const map = new Map();
    for (const r of list) {
      // id_organizacion puede venir como number o string; normalizamos a string
      map.set(String(r.id_organizacion), {
        nivel: typeof r.nivel === 'number' ? r.nivel : (r.nivel != null ? Number(r.nivel) : null),
        fechaResumen: r.fecha_resumen || null
      });
    }
    return map;
  } catch (e) {
    console.warn('No se pudo cargar churn levels:', e);
    return new Map();
  }
}

async function initApp() {
  const grid = document.getElementById('clientsGrid');
  grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><div class="spinner" style="margin-bottom:12px"></div><p>Cargando clientes…</p></div>`;
  try {
    // Lanzamos Zendesk y Supabase en paralelo — el listado no depende
    // de churn levels; si Supabase falla el grid se muestra sin nivel.
    const [list, churnMap] = await Promise.all([fetchClients(), fetchChurnLevels()]);
    for (const c of list) {
      const data = churnMap.get(String(c.id));
      if (data) {
        c.nivel = data.nivel;
        c.fechaResumen = data.fechaResumen;
      }
    }
    clients = list;
    renderTagFilters();
    renderTopChurn();
    applyFilters();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><p style="color:#dc2626">Error al cargar clientes: ${escapeHtml(err.message)}</p></div>`;
  }
}

// ── Churn level helpers ────────────────────────────────────
// Escala 1-10 de Zendesk tickets. 0 se usa como sentinel para "No hay tickets".
function churnBucket(nivel) {
  if (nivel == null || Number.isNaN(nivel)) return { label: '—', cls: 'churn-na', title: 'Sin análisis todavía' };
  if (nivel === 0)            return { label: '0',  cls: 'churn-zero',   title: 'Sin tickets' };
  if (nivel >= 1 && nivel <= 3) return { label: String(nivel), cls: 'churn-low',    title: 'Riesgo bajo' };
  if (nivel >= 4 && nivel <= 6) return { label: String(nivel), cls: 'churn-medium', title: 'Riesgo medio' };
  if (nivel >= 7)             return { label: String(nivel), cls: 'churn-high',   title: 'Riesgo alto' };
  return { label: '—', cls: 'churn-na', title: 'Sin análisis todavía' };
}

function renderChurnBadge(nivel) {
  const b = churnBucket(nivel);
  return `<span class="churn-badge ${b.cls}" title="${b.title}">${b.label}</span>`;
}

// Bloque grande para el modal. Incluye el sufijo "/10" para dejar la escala
// explícita (reporte del usuario: vio "5" y leyó "10" en el texto del resumen).
function renderChurnSummaryBlock(client) {
  const bucket = churnBucket(client.nivel);
  const fechaTxt = formatFecha(client.fechaResumen);
  const showScale = typeof client.nivel === 'number' && client.nivel > 0;
  return `
    <div class="churn-summary ${bucket.cls}" id="modalChurnBlock">
      <div class="churn-summary-number">${bucket.label}${showScale ? '<span class="churn-summary-scale">/10</span>' : ''}</div>
      <div class="churn-summary-meta">
        <div class="churn-summary-label">Nivel de churn</div>
        <div class="churn-summary-sub">${bucket.title}${fechaTxt ? ` · ${escapeHtml(fechaTxt)}` : ''}</div>
      </div>
    </div>
  `;
}

// Tras un generate o cache hit, reflejar nivel/fecha en el state, el modal
// y el card en el grid (si sigue visible). Idempotente si los campos son null.
function applySummaryToClient(client, result) {
  if (result.nivel != null && !Number.isNaN(result.nivel)) client.nivel = result.nivel;
  if (result.fechaResumen) client.fechaResumen = result.fechaResumen;
  // Refleja en la lista maestra (clients) para que futuros renders del grid
  // mantengan el valor aunque se vuelvan a aplicar filtros.
  const master = clients.find(c => c.id === client.id);
  if (master && master !== client) {
    master.nivel = client.nivel;
    master.fechaResumen = client.fechaResumen;
  }
  // Re-pinta el bloque del modal
  const churnEl = document.getElementById('modalChurnBlock');
  if (churnEl) churnEl.outerHTML = renderChurnSummaryBlock(client);
  // Re-pinta el badge del card en el grid
  const idx = lastRenderedList.indexOf(client);
  if (idx >= 0) {
    const cards = document.querySelectorAll('.client-card');
    const card = cards[idx];
    const badge = card && card.querySelector('.churn-badge');
    if (badge) badge.outerHTML = renderChurnBadge(client.nivel);
  }
  // El top churn puede haber cambiado de orden al actualizarse el nivel
  renderTopChurn();
}

// ── Top churn panel ────────────────────────────────────────
// Top 15 clientes con mayor nivel de churn (solo nivel numérico > 0).
function renderTopChurn() {
  const listEl = document.getElementById('topChurnList');
  const emptyEl = document.getElementById('topChurnEmpty');
  if (!listEl || !emptyEl) return;

  const ranked = clients
    .filter(c => typeof c.nivel === 'number' && !Number.isNaN(c.nivel) && c.nivel > 0)
    .sort((a, b) => {
      if (b.nivel !== a.nivel) return b.nivel - a.nivel;
      // Desempate: el resumen más reciente primero
      const ta = a.fechaResumen ? Date.parse(a.fechaResumen) || 0 : 0;
      const tb = b.fechaResumen ? Date.parse(b.fechaResumen) || 0 : 0;
      return tb - ta;
    })
    .slice(0, 15);

  if (ranked.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  listEl.innerHTML = ranked.map((c, i) => {
    const fecha = formatFechaShort(c.fechaResumen);
    return `
      <li class="top-churn-item" onclick="openClientById('${escapeAttr(String(c.id))}')" title="${escapeAttr(c.name)}">
        <span class="top-churn-rank">${i + 1}</span>
        <div class="top-churn-main">
          <span class="top-churn-name">${escapeHtml(c.name)}</span>
          <span class="top-churn-date">${fecha ? escapeHtml(fecha) : 'Sin fecha'}</span>
        </div>
        ${renderChurnBadge(c.nivel)}
      </li>
    `;
  }).join('');
}

function formatFechaShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function openClientById(id) {
  const client = clients.find(c => String(c.id) === String(id));
  if (client) showClientModal(client);
}

function formatFecha(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Tag Filters ────────────────────────────────────────────

function getAllTags() {
  const tagSet = new Set();
  clients.forEach(c => c.tags.forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

function renderTagFilters() {
  const container = document.getElementById('tagFilters');
  const allTags = getAllTags();

  if (allTags.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = allTags.map(tag => {
    const color = getTagColor(tag);
    const active = selectedTags.has(tag);
    return `<button class="tag-filter-chip ${active ? 'active' : ''}"
      style="--tag-bg: ${color.bg}; --tag-text: ${color.text}"
      onclick="toggleTagFilter('${escapeAttr(tag)}')">${escapeHtml(tag)}</button>`;
  }).join('');
}

function toggleTagFilter(tag) {
  if (selectedTags.has(tag)) {
    selectedTags.delete(tag);
  } else {
    selectedTags.add(tag);
  }
  renderTagFilters();
  applyFilters();
}

// ── Filtering ──────────────────────────────────────────────

function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = clients;

  if (q) {
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(q) ||
      String(c.id).toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  if (selectedTags.size > 0) {
    filtered = filtered.filter(c =>
      c.tags.some(tag => selectedTags.has(tag))
    );
  }

  // Filtro por rango de nivel de churn. Los null caen fuera del rango
  // numérico — los dejamos pasar sólo si includeNullChurn === true.
  const hasRange = churnMin > 0 || churnMax < 10;
  if (hasRange || !includeNullChurn) {
    filtered = filtered.filter(c => {
      if (c.nivel == null || Number.isNaN(c.nivel)) return includeNullChurn;
      return c.nivel >= churnMin && c.nivel <= churnMax;
    });
  }

  updateChurnResetVisibility();
  renderClients(filtered);
}

function updateChurnResetVisibility() {
  const btn = document.getElementById('churnFilterReset');
  if (!btn) return;
  const dirty = churnMin !== 0 || churnMax !== 10 || !includeNullChurn;
  btn.classList.toggle('hidden', !dirty);
}

function initChurnFilter() {
  const minSel = document.getElementById('churnMin');
  const maxSel = document.getElementById('churnMax');
  const chk = document.getElementById('churnIncludeNull');
  const reset = document.getElementById('churnFilterReset');
  if (!minSel || !maxSel || !chk || !reset) return;

  // Poblar selects 0..10
  const opts = Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join('');
  minSel.innerHTML = opts;
  maxSel.innerHTML = opts;
  minSel.value = String(churnMin);
  maxSel.value = String(churnMax);
  chk.checked = includeNullChurn;

  minSel.addEventListener('change', () => {
    churnMin = Number(minSel.value);
    // Si el min supera al max, empujamos max para mantener el rango válido.
    if (churnMin > churnMax) { churnMax = churnMin; maxSel.value = String(churnMax); }
    applyFilters();
  });
  maxSel.addEventListener('change', () => {
    churnMax = Number(maxSel.value);
    if (churnMax < churnMin) { churnMin = churnMax; minSel.value = String(churnMin); }
    applyFilters();
  });
  chk.addEventListener('change', () => {
    includeNullChurn = chk.checked;
    applyFilters();
  });
  reset.addEventListener('click', () => {
    churnMin = 0; churnMax = 10; includeNullChurn = true;
    minSel.value = '0'; maxSel.value = '10'; chk.checked = true;
    applyFilters();
  });
}

// ── Render Functions ───────────────────────────────────────

function getInitials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function getAvatarColor(id) {
  return AVATAR_COLORS[(typeof id === 'number' ? id : String(id).length) % AVATAR_COLORS.length];
}

function renderTagBadges(tags) {
  if (!tags.length) return '';
  return `<div class="card-tags">${tags.map(tag => {
    const color = getTagColor(tag);
    return `<span class="card-tag" style="background: ${color.bg}; color: ${color.text}">${escapeHtml(tag)}</span>`;
  }).join('')}</div>`;
}

function createClientCard(client, index) {
  const color = getAvatarColor(client.id);
  const initials = getInitials(client.name);

  return `
    <div class="client-card" style="animation-delay: ${index * 0.05}s" onclick="handleClientClick(${index})">
      <div class="card-top">
        <div class="client-avatar" style="background: ${color}">${initials}</div>
        <div class="client-info">
          <div class="client-name" title="${escapeHtml(client.name)}">${escapeHtml(client.name)}</div>
          <span class="client-org">ID: ${escapeHtml(String(client.id))}</span>
        </div>
        <div class="card-top-actions">
          ${renderChurnBadge(client.nivel)}
          ${client.zendeskUrl ? `<a class="link-zendesk" href="${escapeHtml(client.zendeskUrl)}" target="_blank" rel="noopener noreferrer" title="Ver en Zendesk" onclick="event.stopPropagation()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>` : ''}
        </div>
      </div>
      ${renderTagBadges(client.tags)}
    </div>
  `;
}

let lastRenderedList = [];

function renderClients(list) {
  lastRenderedList = list;
  const grid = document.getElementById('clientsGrid');
  const countEl = document.getElementById('clientCount');

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <p>No se encontraron clientes</p>
      </div>`;
    countEl.textContent = '0 clientes';
    return;
  }

  grid.innerHTML = list.map((c, i) => createClientCard(c, i)).join('');
  countEl.textContent = `${list.length} cliente${list.length !== 1 ? 's' : ''}`;
}

// ── Format helpers ─────────────────────────────────────────

function formatValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
  if (typeof val === 'object') {
    const entries = Object.entries(val).filter(([, v]) => v !== null && v !== '');
    return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '—';
  }
  if (key.endsWith('_at') && typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return String(val);
}

// Normaliza el cuerpo de respuesta de /buscar-resumen o /generar-resumen a
// { summary, nivel, fechaResumen }. Acepta string, object, o array de 1.
function normalizeSummaryResponse(data) {
  if (typeof data === 'string') return { summary: data, nivel: null, fechaResumen: null };
  const row = Array.isArray(data) ? (data[0] || null) : data;
  if (!row || typeof row !== 'object') return { summary: '', nivel: null, fechaResumen: null };
  const summary = row.respuesta_ia || row.summary || row.resumen || row.output || row.result || '';
  const nivel = row.nivel != null && row.nivel !== '' ? Number(row.nivel) : null;
  const fechaResumen = row.fecha_resumen || null;
  return { summary: typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2), nivel, fechaResumen };
}

// Intenta leer el resumen ya guardado en Supabase. Devuelve el objeto
// normalizado si la fila existe y tiene respuesta_ia, o null si 404 o vacío.
async function fetchCachedSummary(orgId) {
  try {
    const res = await fetch(CHURN_LOOKUP_URL, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId })
    });
    if (!res.ok) return null;                     // 404 → no hay fila
    const text = await res.text();
    if (!text.trim()) return null;                // body vacío
    const parsed = normalizeSummaryResponse(JSON.parse(text));
    return parsed.summary ? parsed : null;
  } catch {
    return null;
  }
}

// Dispara el pipeline completo (Zendesk + GPT + upsert). Devuelve el
// resumen ya guardado — el endpoint responde JSON con respuesta_ia, nivel
// y fecha_resumen tras persistir en Supabase.
async function generateSummary(orgId) {
  const res = await fetch(SUMMARY_URL, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_org: orgId })
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const text = await res.text();
  try {
    return normalizeSummaryResponse(JSON.parse(text));
  } catch {
    return { summary: text, nivel: null, fechaResumen: null };
  }
}

// ── Tickets ────────────────────────────────────────────────

async function fetchTickets(orgId) {
  const res = await fetch(TICKETS_URL, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_org: orgId })
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  const text = await res.text();
  if (!text.trim()) return [];
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : (data.tickets || []);
}

// Lee el valor de un custom_field (busca en `custom_fields` y, si no, en `fields`).
function readCustomField(ticket, fieldId) {
  const arr = ticket.custom_fields || ticket.fields || [];
  const found = arr.find(f => f && Number(f.id) === Number(fieldId));
  return found ? found.value : null;
}

function ticketFacets(ticket) {
  const modulo = readCustomField(ticket, TICKET_FIELD_IDS.modulo);
  return {
    estado: ticket.status || null,
    tipo: readCustomField(ticket, TICKET_FIELD_IDS.tipo),
    entorno: readCustomField(ticket, TICKET_FIELD_IDS.entorno),
    modulos: Array.isArray(modulo) ? modulo.filter(Boolean) : (modulo ? [modulo] : []),
  };
}

// State vivo del panel de tickets — se resetea cada vez que se abre un modal.
let currentTickets = [];
let currentTicketFilters = { estado: '', tipo: '', entorno: '', modulo: '' };

function renderTicketsSection() {
  const container = document.getElementById('ticketsSection');
  if (!container) return;
  const facets = currentTickets.map(ticketFacets);

  // Opciones únicas por facet, conservando orden de aparición.
  const uniq = (arr) => [...new Set(arr.filter(v => v != null && v !== ''))];
  const estados  = uniq(facets.map(f => f.estado));
  const tipos    = uniq(facets.map(f => f.tipo));
  const entornos = uniq(facets.map(f => f.entorno));
  const modulos  = uniq(facets.flatMap(f => f.modulos));

  const optHtml = (list, selected, labelMap) => {
    return ['<option value="">Todos</option>']
      .concat(list.map(v => {
        const label = labelMap ? (labelMap[v] || v) : v;
        const sel = v === selected ? ' selected' : '';
        return `<option value="${escapeAttr(String(v))}"${sel}>${escapeHtml(String(label))}</option>`;
      }))
      .join('');
  };

  container.innerHTML = `
    <div class="tickets-header">
      <div class="section-label">Tickets <span class="tickets-count" id="ticketsCount"></span></div>
    </div>
    <div class="tickets-filters">
      <label>Estado
        <select id="ticketFilterEstado">${optHtml(estados, currentTicketFilters.estado, STATUS_LABELS)}</select>
      </label>
      <label>Tipo
        <select id="ticketFilterTipo">${optHtml(tipos, currentTicketFilters.tipo)}</select>
      </label>
      <label>Entorno
        <select id="ticketFilterEntorno">${optHtml(entornos, currentTicketFilters.entorno)}</select>
      </label>
      <label>Módulo
        <select id="ticketFilterModulo">${optHtml(modulos, currentTicketFilters.modulo)}</select>
      </label>
    </div>
    <ul class="tickets-list" id="ticketsList"></ul>
  `;

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      currentTicketFilters[key] = el.value;
      renderTicketsList();
    });
  };
  bind('ticketFilterEstado', 'estado');
  bind('ticketFilterTipo', 'tipo');
  bind('ticketFilterEntorno', 'entorno');
  bind('ticketFilterModulo', 'modulo');

  renderTicketsList();
}

function renderTicketsList() {
  const listEl = document.getElementById('ticketsList');
  const countEl = document.getElementById('ticketsCount');
  if (!listEl) return;
  const f = currentTicketFilters;
  const filtered = currentTickets.filter(t => {
    const fc = ticketFacets(t);
    if (f.estado  && fc.estado  !== f.estado)  return false;
    if (f.tipo    && fc.tipo    !== f.tipo)    return false;
    if (f.entorno && fc.entorno !== f.entorno) return false;
    if (f.modulo  && !fc.modulos.includes(f.modulo)) return false;
    return true;
  });

  if (countEl) countEl.textContent = `(${filtered.length}${filtered.length !== currentTickets.length ? ` de ${currentTickets.length}` : ''})`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<li class="tickets-empty">Sin tickets con estos filtros</li>`;
    return;
  }

  // Orden: más recientes primero (por updated_at o created_at).
  const sorted = [...filtered].sort((a, b) => {
    const ta = Date.parse(a.updated_at || a.created_at || 0) || 0;
    const tb = Date.parse(b.updated_at || b.created_at || 0) || 0;
    return tb - ta;
  });

  listEl.innerHTML = sorted.map(t => {
    const fc = ticketFacets(t);
    const estadoLabel = STATUS_LABELS[fc.estado] || fc.estado || '—';
    const fecha = formatFechaShort(t.updated_at || t.created_at);
    const subject = t.subject || t.raw_subject || `Ticket #${t.id}`;
    const zdUrl = ticketZendeskUrl(t);
    const chips = [
      fc.tipo && `<span class="ticket-chip chip-tipo">${escapeHtml(fc.tipo)}</span>`,
      fc.entorno && `<span class="ticket-chip chip-entorno">${escapeHtml(fc.entorno)}</span>`,
      ...fc.modulos.map(m => `<span class="ticket-chip chip-modulo">${escapeHtml(m)}</span>`),
    ].filter(Boolean).join('');
    return `
      <li class="ticket-item">
        <div class="ticket-row-top">
          <span class="ticket-status ticket-status-${escapeAttr(fc.estado || 'na')}">${escapeHtml(estadoLabel)}</span>
          <a class="ticket-subject" href="${escapeAttr(zdUrl)}" target="_blank" rel="noopener noreferrer" title="Abrir en Zendesk">#${escapeHtml(String(t.id))} · ${escapeHtml(subject)}</a>
        </div>
        ${chips ? `<div class="ticket-chips">${chips}</div>` : ''}
        ${fecha ? `<div class="ticket-date">${escapeHtml(fecha)}</div>` : ''}
      </li>
    `;
  }).join('');
}

function ticketZendeskUrl(t) {
  if (t.url) {
    const m = t.url.match(/^(https?:\/\/[^/]+)\/api\/v2\/tickets\/(\d+)\.json$/);
    if (m) return `${m[1]}/agent/tickets/${m[2]}`;
  }
  return '#';
}

// ── Handlers ───────────────────────────────────────────────

function handleClientClick(index) {
  const client = lastRenderedList[index];
  if (client) showClientModal(client);
}

// ── Progress bar ───────────────────────────────────────────

let progressInterval = null;
let progressValue = 0;

function startProgress() {
  const container = document.getElementById('progressContainer');
  const bar = document.getElementById('progressBar');
  container.classList.remove('hidden');
  bar.classList.remove('done');
  progressValue = 0;
  bar.style.width = '0%';

  // Reach 99% in 25 seconds with easing (slows down as it approaches 99)
  const totalMs = 25000;
  const tick = 200;
  const totalTicks = totalMs / tick;
  let currentTick = 0;

  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    currentTick++;
    // Easing: fast at start, slows toward 99
    const t = currentTick / totalTicks;
    progressValue = 99 * (1 - Math.pow(1 - t, 2.5));
    if (progressValue >= 99) progressValue = 99;
    bar.style.width = progressValue + '%';

    if (currentTick >= totalTicks) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }, tick);
}

function finishProgress() {
  clearInterval(progressInterval);
  progressInterval = null;
  const bar = document.getElementById('progressBar');
  bar.classList.add('done');
  bar.style.width = '100%';
  // Hide after animation
  setTimeout(() => {
    document.getElementById('progressContainer').classList.add('hidden');
  }, 500);
}

// ── Modal ──────────────────────────────────────────────────

function showClientModal(client) {
  const overlay = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  const raw = client._raw;

  title.textContent = client.name;

  const skipFields = ['url', 'name'];
  const infoRows = Object.entries(raw)
    .filter(([key]) => !skipFields.includes(key))
    .map(([key, val]) => {
      const label = FIELD_LABELS[key] || key.replace(/_/g, ' ');
      const formatted = formatValue(key, val);
      return `
        <div class="info-row">
          <span class="info-label">${escapeHtml(label)}</span>
          <span class="info-value">${escapeHtml(formatted)}</span>
        </div>
      `;
    }).join('');

  body.innerHTML = `
    <div class="modal-columns">
      <div class="modal-col-left">
        ${renderChurnSummaryBlock(client)}
        <section class="tickets-section" id="ticketsSection">
          <div class="section-label">Tickets</div>
          <div class="tickets-loading"><div class="spinner-summary"></div> Cargando tickets…</div>
        </section>
        <div class="section-label">Información de la organización</div>
        <div class="info-table">
          ${infoRows}
        </div>
        ${client.zendeskUrl ? `
        <a class="modal-zendesk-link" href="${escapeHtml(client.zendeskUrl)}" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Abrir en Zendesk
        </a>` : ''}
      </div>
      <div class="modal-col-right">
        <div class="summary-header">
          <div class="section-label">Resumen</div>
          <button class="btn-copy hidden" id="btnCopySummary" onclick="copySummary(this)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copiar
          </button>
        </div>
        <div class="summary-text" id="summaryContent">
          <div class="summary-loading">
            <div class="spinner-summary"></div>
            Generando resumen...
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active');

  // Reset de filtros y carga de tickets en paralelo al lookup del resumen.
  currentTickets = [];
  currentTicketFilters = { estado: '', tipo: '', entorno: '', modulo: '' };
  fetchTickets(client.id)
    .then(list => { currentTickets = list; renderTicketsSection(); })
    .catch(err => {
      const el = document.getElementById('ticketsSection');
      if (el) el.innerHTML = `<div class="section-label">Tickets</div><div class="tickets-error">Error: ${escapeHtml(err.message)}</div>`;
    });

  // Estrategia en dos pasos:
  //  1. Lookup a Supabase (/buscar-resumen). Si hay fila con respuesta_ia
  //     la pintamos inmediatamente, sin progress bar. Evita regenerar GPT
  //     cada vez que el usuario abre una ficha ya analizada.
  //  2. Si no hay cache → startProgress() + /generar-resumen (pipeline
  //     completo que a su vez hace upsert en Supabase y responde con el
  //     nivel + fecha nuevos). Actualizamos el state y re-pintamos.
  const renderResult = (result) => {
    const el = document.getElementById('summaryContent');
    const btn = document.getElementById('btnCopySummary');
    if (el) {
      // El summary viene del webhook IA (n8n). Aunque el contenido se
      // genera por GPT, no lo tratamos como confiable: lo pasamos por
      // DOMPurify para neutralizar cualquier <img onerror>, <script>, etc.
      const rawHtml = marked.parse(result.summary);
      el.innerHTML = (window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml);
    }
    if (btn) {
      btn.setAttribute('data-summary', result.summary);
      btn.classList.remove('hidden');
    }
    applySummaryToClient(client, result);
  };

  const renderError = (err) => {
    const el = document.getElementById('summaryContent');
    if (el) {
      el.innerHTML = `<span style="color: #dc2626;">Error al obtener el resumen: ${escapeHtml(err.message)}</span>`;
    }
  };

  fetchCachedSummary(client.id).then(cached => {
    if (cached) {
      // Cache hit: instantáneo, sin progress bar.
      renderResult(cached);
      return;
    }
    // Cache miss: generar en vivo.
    startProgress();
    return generateSummary(client.id)
      .then(result => { finishProgress(); renderResult(result); })
      .catch(err => { finishProgress(); renderError(err); });
  }).catch(renderError);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function copySummary(btn) {
  const text = btn.getAttribute('data-summary');
  try {
    await navigator.clipboard.writeText(text);
    btn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      Copiado
    `;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      `;
      btn.classList.remove('copied');
    }, 2000);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  clearInterval(progressInterval);
  progressInterval = null;
  document.getElementById('progressContainer').classList.add('hidden');
  document.getElementById('progressBar').style.width = '0%';
}

// ── Init ───────────────────────────────────────────────────

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('searchInput').addEventListener('input', () => applyFilters());
initChurnFilter();

initApp();
