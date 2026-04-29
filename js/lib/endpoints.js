// ============================================================
//  endpoints.js — URLs canónicas de webhooks n8n
//  Módulo ES nativo, sólo data, sin dependencias.
//  ------------------------------------------------------------
//  IMPORTANTE: replicado en config.js. Si cambias o añades un
//  endpoint, actualízalo en AMBOS sitios hasta que la migración
//  del Punto 2.b se complete.
// ============================================================

/**
 * Base URL de los webhooks n8n. Cambia entre entornos (dev/prod)
 * editando esta constante únicamente.
 */
export const WEBHOOK_BASE = 'https://n8n-soporte.data.yurest.dev/webhook';

/**
 * Endpoints del portal agrupados lógicamente. Cualquier llamada de
 * `apiFetch()` debería leer la URL desde este objeto, no hardcodear.
 */
export const ENDPOINTS = {
    // Autenticación y listado general
    login:                `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`,
    altas:                `${WEBHOOK_BASE}/018f3362-7969-4c49-9088-c78e4446c77f`,

    // Fichas
    guardarFicha:         `${WEBHOOK_BASE}/57e04029-bae4-4124-8c43-c535e831a147`,
    completarFicha:       `${WEBHOOK_BASE}/5a304fcd-ae1d-49e6-92d1-c5a5e007bbfd`,
    eliminarFicha:        `${WEBHOOK_BASE}/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`,

    // Solicitudes
    crearSolicitud:       `${WEBHOOK_BASE}/b0629324-e611-47d4-835f-3ac9bcd4dc9b`,
    listaSolicitudes:     `${WEBHOOK_BASE}/1757fdcc-7fa7-4cb9-93b9-eb8118adaa1e`,
    listaRellenado:       `${WEBHOOK_BASE}/fa16b994-5af1-4368-ba6b-592e633937c3`,
    eliminarSolicitud:    `${WEBHOOK_BASE}/a2b1b1d6-a1dc-4366-b60e-b5e4506faa3d`,

    // Drive
    getDrive:             `${WEBHOOK_BASE}/2010bb2b-72e9-4bae-afb1-d5a937c59009`,
    docsSubidos:          `${WEBHOOK_BASE}/bdef8517-9b76-4640-8f82-d940fd0ab96b`,

    // Bajas
    bajas:                `${WEBHOOK_BASE}/84f094b2-9e55-448f-8ad9-f28721841873`,
    bajaCliente:          `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
    bajaLocal:            `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
    bajaModulos:          `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
    bajaEditar:           `${WEBHOOK_BASE}/73ce8d34-9980-4c65-bd82-c0767f1483cf`,
    bajaBorrar:           `${WEBHOOK_BASE}/95d5ed5d-1139-45b9-88c2-3066bc49e45b`,

    // Distribución
    guardarDist:          `${WEBHOOK_BASE}/6d3ed726-c86a-4b86-a2ae-7f07da9630a5`,

    // Gestor de proyectos
    proyectos:            `${WEBHOOK_BASE}/proyectos`,
    proyectosTarea:       `${WEBHOOK_BASE}/proyectos/tarea`,
    proyectosTareaMover:  `${WEBHOOK_BASE}/proyectos/tarea/mover`,

    // Integraciones externas
    asanaTasks:           `${WEBHOOK_BASE}/asana/tasks`,
    asanaStories:         `${WEBHOOK_BASE}/asana/task/stories`,
    calendar:             `${WEBHOOK_BASE}/calendar/event`,

    // Formulario público (cliente rellena desde email)
    responderSolicitud:   `${WEBHOOK_BASE}/6da4274f-5a6d-4981-a92a-f9d7eb734144`,

    // Notificación cuando el comercial completa la ficha
    notificarFichaCompleta: `${WEBHOOK_BASE}/ficha/notificar-completa`,

    // Promociones (Customer Success)
    promociones:          `${WEBHOOK_BASE}/promociones`,

    // Pedidos de hardware
    hardwarePedidos:      `${WEBHOOK_BASE}/hardware/pedidos`,

    // Stock de hardware
    hardwareStock:        `${WEBHOOK_BASE}/hardware/stock`,

    // Presupuestos (Producto)
    presupuestos:         `${WEBHOOK_BASE}/presupuestos`,

    // Contabilidad
    grabadoA3:            `${WEBHOOK_BASE}/yurest-grabado-a3`,

    // Notificaciones automáticas Integraciones
    notifIntConfig:       `${WEBHOOK_BASE}/notif-integraciones/config`,
    notifIntGrupos:       `${WEBHOOK_BASE}/notif-integraciones/grupos`,
    notifIntHistorial:    `${WEBHOOK_BASE}/notif-integraciones/historial`,

    // Auth y gestión de usuarios
    authLogin:            `${WEBHOOK_BASE}/auth/login`,
    authUsuarios:         `${WEBHOOK_BASE}/auth/usuarios`,
    authVerify:           `${WEBHOOK_BASE}/auth/verify`,

    // Historial de acciones
    historial:            `${WEBHOOK_BASE}/historial`,
    proyectoHistorial:    `${WEBHOOK_BASE}/proyectos/historial`,

    // Mapa de calor de tickets Zendesk
    zendeskTicketsHeatmap:    `${WEBHOOK_BASE}/zendesk/tickets-heatmap`,
    zendeskTicketsHeatmapIA:  `${WEBHOOK_BASE}/zendesk/tickets-heatmap-ia`,

    // Escalados de clientes
    escalados:            `${WEBHOOK_BASE}/escalados`,

    // Customer Success Kanban
    csEstado:             `${WEBHOOK_BASE}/cs-estado`,

    // Resúmenes semanal/mensual de incidencias
    zendeskResumenSemanal: `${WEBHOOK_BASE}/zendesk/resumen-semanal`,
    zendeskResumenMensual: `${WEBHOOK_BASE}/zendesk/resumen-mensual`
};
