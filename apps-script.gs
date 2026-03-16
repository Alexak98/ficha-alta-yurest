// ============================================================
//  Google Apps Script – Backend para formulario de altas
//  Instrucciones de despliegue:
//  1. Abre Google Sheets y crea una hoja nueva
//  2. Ve a Extensiones → Apps Script
//  3. Pega este código y guarda (Ctrl+S)
//  4. Haz clic en "Implementar" → "Nueva implementación"
//  5. Tipo: Aplicación web
//     · Ejecutar como: Yo
//     · Quién tiene acceso: Cualquier persona
//  6. Copia la URL generada y pégala en index.html (APPS_SCRIPT_URL)
// ============================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Hoja: Clientes ──────────────────────────────────────
    let clientesSheet = ss.getSheetByName('Clientes');
    if (!clientesSheet) {
      clientesSheet = ss.insertSheet('Clientes');
      clientesSheet.appendRow([
        'ID', 'Fecha', 'Denominación Social', 'Nombre Comercial', 'CIF/NIF', 'Email', 'Email Factura', 'Email CC',
        'JP Nombre', 'JP Apellidos', 'JP Rol', 'JP Teléfono', 'JP Mail',
        'Firmante Nombre', 'Firmante Apellidos', 'Firmante Mail', 'Firmante DNI', 'Firmante Puesto', 'Firmante Mensualidad',
        'Calle', 'Número', 'CP', 'Municipio', 'Provincia', 'Firmas Contratadas', 'OCR Activo',
        'TPV', 'TPV Contacto', 'TPV Email', 'Lite',
        'Entrega Calle', 'Entrega Número', 'Entrega CP', 'Entrega Municipio', 'Entrega Provincia',
        'Contacto Nombre', 'Contacto Email', 'Contacto Teléfono', 'Módulos',
        'IBAN', 'Mensualidad Total Locales',
        'Proyecto de Implementación', 'Plan Producto BASIC', 'Plan Producto PRO',
        'Plan RRHH', 'Plan Operaciones', 'Yurest Lite', 'Integraciones', 'Mensualidad Anualizada',
        'Distribuidor', 'Dist. Empresa', 'Dist. CIF', 'Dist. Dirección', 'Dist. CP',
        'Dist. Contacto', 'Dist. Mail', 'Dist. Teléfono', 'Dist. Comisión (€)',
        'Credencial Master', 'Credencial Yurest',
        'Tipo de Cliente', 'Paquetes Carrito', 'Comentarios'
      ]);
      clientesSheet.getRange(1, 1, 1, 63).setFontWeight('bold');
    }

    const fechaHoy = new Date();
    clientesSheet.appendRow([
      data.id            || '',
      fechaHoy,
      data.denominacion     || '',
      data.nombreComercial  || '',
      data.cif              || '',
      data.email            || '',
      data.emailFactura     || '',
      data.emailCc          || '',
      data.jpNombre         || '',
      data.jpApellidos      || '',
      data.jpRol            || '',
      data.jpTelefono       || '',
      data.jpMail           || '',
      data.firmNombre       || '',
      data.firmApellidos    || '',
      data.firmMail         || '',
      data.firmDni          || '',
      data.firmPuesto       || '',
      data.firmMensualidad  || 0,
      data.calle            || '',
      data.numero       || '',
      data.cp           || '',
      data.municipio    || '',
      data.provincia    || '',
      data.firmas ? data.firmas + ' firmas' : '',
      data.ocr ? 'Sí' : 'No',
      data.tpv          || '',
      data.tpvContacto  || '',
      data.tpvEmail     || '',
      data.lite ? 'Sí' : 'No',
      data.entregaCalle     || '',
      data.entregaNumero    || '',
      data.entregaCp        || '',
      data.entregaMunicipio || '',
      data.entregaProvincia || '',
      data.contactoNombre   || '',
      data.contactoEmail    || '',
      data.contactoTelefono || '',
      (data.modulos && data.modulos.length > 0) ? data.modulos.join(', ') : '',
      data.iban                  || '',
      data.mensualidadTotal      || 0,
      data.finImplementacion     || 0,
      data.finBasic              || 0,
      data.finPro                || 0,
      data.finRrhh               || 0,
      data.finOperaciones        || 0,
      data.finLite               || 0,
      data.finIntegraciones      || 0,
      data.finMensualidadAnual   || 0,
      data.distribuidor ? 'Sí' : 'No',
      data.distEmpresa   || '',
      data.distCif       || '',
      data.distDireccion || '',
      data.distCp        || '',
      data.distContacto  || '',
      data.distMail      || '',
      data.distTelefono  || '',
      data.distComision  || 0,
      data.credMaster    || '',
      data.credYurest    || '',
      data.tipoCliente   || '',
      (data.paquetesCarrito && data.paquetesCarrito.length > 0) ? data.paquetesCarrito.join(', ') : '',
      data.comentarios   || ''
    ]);

    // ── Hoja: Locales ───────────────────────────────────────
    if (data.locales && data.locales.length > 0) {
      let localesSheet = ss.getSheetByName('Locales');
      if (!localesSheet) {
        localesSheet = ss.insertSheet('Locales');
        localesSheet.appendRow([
          'Fecha', 'Cliente (Denominación)', 'Nombre Local', 'Email',
          'Calle', 'Número', 'CP',
          'Sociedad CIF', 'Sociedad Denominación', 'Sociedad Calle', 'Sociedad Número', 'Sociedad CP', 'Sociedad Municipio', 'Sociedad Provincia'
        ]);
        localesSheet.getRange(1, 1, 1, 14).setFontWeight('bold');
      }

      data.locales.forEach(function(local) {
        localesSheet.appendRow([
          fechaHoy,
          data.denominacion          || '',
          local.nombre               || '',
          local.email                || '',
          local.calle                || '',
          local.numero               || '',
          local.cp                   || '',
          local.sociedad_cif         || '',
          local.sociedad_denominacion|| '',
          local.sociedad_calle       || '',
          local.sociedad_numero      || '',
          local.sociedad_cp          || '',
          local.sociedad_municipio   || '',
          local.sociedad_provincia   || ''
        ]);
      });
    }

    return buildResponse({ success: true });

  } catch (err) {
    return buildResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Clientes');

    // ── Acción: siguiente ID disponible ─────────────────────────────────────
    if (e && e.parameter && e.parameter.action === 'nextId') {
      if (!sheet || sheet.getLastRow() <= 1) {
        return buildResponse({ success: true, nextId: 1 });
      }
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const idCol = headers.indexOf('ID');
      if (idCol === -1) {
        // Sin columna ID: usar recuento de filas (fila 1 = cabecera, siguientes = datos)
        return buildResponse({ success: true, nextId: sheet.getLastRow() });
      }
      const idValues = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
      var maxId = 0;
      idValues.forEach(function(row) {
        var v = parseInt(row[0]);
        if (!isNaN(v) && v > maxId) maxId = v;
      });
      return buildResponse({ success: true, nextId: maxId + 1 });
    }

    // ── Acción por defecto: listar clientes ──────────────────────────────────
    if (!sheet || sheet.getLastRow() <= 1) {
      return buildResponse({ success: true, clientes: [] });
    }
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const clientes = rows.slice(1).map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
    return buildResponse({ success: true, clientes: clientes });
  } catch(err) {
    return buildResponse({ success: false, error: err.message });
  }
}

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Función de prueba – ejecutar manualmente desde el editor
function testDoPost() {
  const mockData = {
    denominacion: 'Empresa de Prueba SL',
    cif: 'B12345678',
    calle: 'Calle Mayor',
    numero: '10',
    cp: '46001',
    municipio: 'Valencia',
    provincia: 'Valencia',
    ocr: true,
    locales: [
      {
        nombre: 'Local Centro',
        email: 'centro@prueba.com',
        calle: 'Gran Vía',
        numero: '5',
        cp: '46001',
        cierreAutomatico: false,
        favoritos: true
      }
    ]
  };

  const mockEvent = { postData: { contents: JSON.stringify(mockData) } };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
