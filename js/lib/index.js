// ============================================================
//  /js/lib/index.js — Punto de entrada de las utilidades modulares.
//
//  Carpeta nueva (Punto 2.a — Ruta A) con utilidades extraídas de
//  config.js como módulos ES nativos. Sin dependencias externas,
//  sin paso de build. Pensado para que páginas nuevas o
//  modernizadas puedan importar selectivamente sólo lo que usan:
//
//    <script type="module">
//        import { escHtml, formatDate } from './js/lib/index.js';
//        // o más fino:
//        // import { escHtml } from './js/lib/escape.js';
//    </script>
//
//  ESTADO ACTUAL (Fase 2.a):
//    · Las funciones aquí ESTÁN REPLICADAS en config.js para no
//      romper los HTMLs viejos cargados con `<script src>`.
//    · Mantener AMBOS sitios sincronizados al editar.
//    · La Fase 2.b (config.js → module wrapper + 28 HTMLs migrados a
//      `<script type="module">`) eliminará la duplicación.
//
//  Módulos disponibles:
//    · escape.js        — escHtml, escAttr, escJsInAttr
//    · format.js        — formatDate, generarId
//    · permisos-defs.js — PERMISOS_DISPONIBLES (catálogo PageIds)
//    · endpoints.js     — WEBHOOK_BASE, ENDPOINTS
// ============================================================

export { escHtml, escAttr, escJsInAttr } from './escape.js';
export { formatDate, generarId }         from './format.js';
export { PERMISOS_DISPONIBLES }          from './permisos-defs.js';
export { WEBHOOK_BASE, ENDPOINTS }       from './endpoints.js';
