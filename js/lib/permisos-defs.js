// ============================================================
//  permisos-defs.js — Catálogo de PageIds del portal
//  Módulo ES nativo, sólo data, sin dependencias.
//  ------------------------------------------------------------
//  IMPORTANTE: replicado en config.js. Si añades una página nueva,
//  acuérdate de actualizar AMBOS sitios hasta que la migración del
//  Punto 2.b se complete.
// ============================================================

/**
 * @typedef {Object} PermisoDef
 * @property {string} id    PageId — coincide con sidebar.js y permisos.read/write/delete
 * @property {string} label Etiqueta legible para admin de usuarios
 * @property {string} grupo Categoría visual (Informes, Comercial, …)
 */

/**
 * Lista canónica de páginas que admiten permiso. La administración
 * de usuarios renderiza esta lista para asignar lectura / escritura /
 * borrado por página. El orden importa: el grid del admin lo respeta.
 * @type {PermisoDef[]}
 */
export const PERMISOS_DISPONIBLES = [
    { id: 'ventas',          label: 'Ventas',                  grupo: 'Informes'         },
    { id: 'distribucion',    label: 'Implementadores',         grupo: 'Informes'         },
    { id: 'informe_tickets',    label: 'Mapa de calor de tickets',     grupo: 'Informes'        },
    { id: 'informe_tickets_ia', label: 'Mapa de calor — Agente IA',    grupo: 'Informes'        },
    { id: 'lista',         label: 'Fichas de cliente',    grupo: 'Comercial'        },
    { id: 'escalados',     label: 'Escalados de clientes', grupo: 'Comercial'       },
    { id: 'sinasignar',    label: 'Sin asignar',          grupo: 'Implementación'   },
    { id: 'proyectos',     label: 'Proyectos',            grupo: 'Implementación'   },
    { id: 'contabilidad',  label: 'Grabar en A3',         grupo: 'Contabilidad'     },
    { id: 'proformas',     label: 'Solicitud de proformas', grupo: 'Contabilidad'   },
    { id: 'clientes',      label: 'Clientes',             grupo: 'Customer Success' },
    { id: 'cs_kanban',     label: 'Kanban CS',             grupo: 'Customer Success' },
    { id: 'bajas',         label: 'Bajas',                grupo: 'Customer Success' },
    { id: 'promociones',   label: 'Promociones',          grupo: 'Customer Success' },
    { id: 'presupuestos',  label: 'Presupuestos',         grupo: 'Producto'         },
    { id: 'integraciones', label: 'Integraciones',        grupo: 'Soporte'          },
    { id: 'hardware',      label: 'Hardware envíos',      grupo: 'Soporte'          },
    { id: 'stock',         label: 'Stock hardware',       grupo: 'Soporte'          },
    { id: 'resumen_semanal',             label: 'Resumen semanal',                grupo: 'Soporte' },
    { id: 'resumen_mensual',             label: 'Resumen mensual',                grupo: 'Soporte' },
    { id: 'documentacion_integraciones', label: 'Documentación de integraciones', grupo: 'Soporte' },
    { id: 'admin',         label: 'Administración',       grupo: 'Admin'            },
    { id: 'docs',          label: 'Documentación',        grupo: 'Otros'            }
];
