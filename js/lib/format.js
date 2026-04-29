// ============================================================
//  format.js — formato de fechas + generación de IDs
//  Módulo ES nativo, sin dependencias.
//  ------------------------------------------------------------
//  IMPORTANTE: este código está REPLICADO en config.js. Cualquier
//  cambio aquí debe replicarse también allí hasta que la migración
//  del Punto 2.b se complete.
// ============================================================

/**
 * Formatea una fecha para los listados de UI con un par de modos
 * estandarizados — antes cada página tenía su propio toLocaleDateString
 * con opciones distintas. Ahora todo el portal pasa por aquí.
 *
 * Devuelve '—' si la entrada es null/undefined/'' o no parsea como
 * fecha válida — el listado nunca debería pintar "Invalid Date".
 *
 * @param {Date|string|number|null|undefined} v
 * @param {'short'|'numeric'|'datetime'|'long'} [modo]
 *   - 'short'    → "23 abr 2026"           (default — listados generales)
 *   - 'numeric'  → "23/04/2026"            (tablas densas)
 *   - 'datetime' → "23 abr 2026, 13:45"    (auditoría, timestamps)
 *   - 'long'     → "sábado, 23 de abril de 2026"  (encabezados)
 * @returns {string}
 */
export function formatDate(v, modo) {
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

/**
 * Genera un identificador único usando crypto.randomUUID cuando está
 * disponible (Chrome 92+, Firefox 95+, Safari 15.4+, todos los
 * navegadores que usa el equipo). Fallback a timestamp + random.
 * @returns {string}
 */
export function generarId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
}
