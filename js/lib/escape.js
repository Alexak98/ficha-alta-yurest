// ============================================================
//  escape.js — helpers de escape para HTML/attr/JS
//  Módulo ES nativo, sin dependencias.
//  ------------------------------------------------------------
//  IMPORTANTE: este código está REPLICADO en config.js (que sirve
//  a HTMLs cargados con `<script src>`). Cualquier cambio aquí
//  debe replicarse también allí hasta que la migración del Punto
//  2.b (config.js → module + HTMLs a type="module") se complete.
// ============================================================

/**
 * Escapa texto para insertar como contenido HTML. Seguro frente a XSS.
 * Convierte null/undefined a string vacío.
 * @param {*} text
 * @returns {string}
 */
export function escHtml(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Escapa texto para un atributo HTML entrecomillado con ".
 * Equivale a escHtml — el escape de atributo y contenido coincide
 * cuando se usan comillas dobles para delimitar el atributo.
 * @param {*} text
 * @returns {string}
 */
export function escAttr(text) {
    return escHtml(text);
}

/**
 * Escapa un string para ser inyectado dentro de un literal JavaScript
 * entrecomillado con ' que vive dentro de un atributo HTML
 * (p.ej. onclick="foo('...')"). No es la opción preferida — es mejor
 * usar addEventListener — pero evita romper cuando no queda más remedio.
 * @param {*} text
 * @returns {string}
 */
export function escJsInAttr(text) {
    return String(text == null ? '' : text)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\x27')
        .replace(/"/g, '&quot;')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e')
        .replace(/&/g, '&amp;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}
