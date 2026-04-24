// ── Config ─────────────────────────────────────────────────

const API_URL = 'https://n8n-soporte.data.yurest.dev/webhook/9e0fc21e-f895-42ce-ac92-b710aaa45b25';
const SUMMARY_URL = 'https://n8n-soporte.data.yurest.dev/webhook/2c62e049-ff93-49de-8095-d64db239104f';

let clients = [];
let selectedTags = new Set();

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
      _raw: item
    };
  });
}

async function initApp() {
  const grid = document.getElementById('clientsGrid');
  grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><div class="spinner" style="margin-bottom:12px"></div><p>Cargando clientes…</p></div>`;
  try {
    clients = await fetchClients();
    renderTagFilters();
    applyFilters();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><p style="color:#dc2626">Error al cargar clientes: ${escapeHtml(err.message)}</p></div>`;
  }
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

  renderClients(filtered);
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
        ${client.zendeskUrl ? `<a class="link-zendesk" href="${escapeHtml(client.zendeskUrl)}" target="_blank" rel="noopener noreferrer" title="Ver en Zendesk" onclick="event.stopPropagation()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>` : ''}
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

async function fetchSummary(orgId) {
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
    const data = JSON.parse(text);
    return data.summary || data.resumen || data.output || data.result || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } catch {
    return text;
  }
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
  startProgress();

  fetchSummary(client.id).then(summary => {
    finishProgress();
    const el = document.getElementById('summaryContent');
    const btn = document.getElementById('btnCopySummary');
    if (el) {
      el.innerHTML = marked.parse(summary);
      btn.setAttribute('data-summary', summary);
      btn.classList.remove('hidden');
    }
  }).catch(err => {
    finishProgress();
    const el = document.getElementById('summaryContent');
    if (el) {
      el.innerHTML = `<span style="color: #dc2626;">Error al obtener el resumen: ${escapeHtml(err.message)}</span>`;
    }
  });
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

initApp();
