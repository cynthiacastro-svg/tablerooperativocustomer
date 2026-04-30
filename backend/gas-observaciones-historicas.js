// ══════════════════════════════════════════════════════════════
//  GOOGLE APPS SCRIPT — Web App Observaciones Históricas (NUEVO)
//  Deploy URL: https://script.google.com/macros/s/AKfycbyuxV-0ibb7yq7PYh93rlyBH9kUt_1A3xu63Z1Ky8wFgutmXwE5LBv2F9Me-Wzk9Aw/exec
//
//  Este script gestiona el historial de observaciones en un
//  Google Sheet separado. Cada observación es una fila nueva
//  (append), nunca se sobreescribe.
//
//  INSTRUCCIONES:
//  1. Abrí https://script.google.com
//  2. Creá un nuevo proyecto o abrí el existente vinculado a la URL de arriba
//  3. Pegá este código completo en Code.gs (reemplazando todo)
//  4. Deploy → Manage deployments → Edit → Version: New → Deploy
//  5. Asegurate de que esté como "Web app" con acceso "Anyone"
// ══════════════════════════════════════════════════════════════

// ID del Google Sheet de OBSERVACIONES HISTÓRICAS
var OBS_SHEET_ID = '1BgD_5mYJO--Z8n1_RgiQIvHCY-lgRusTaaGSwGUZDtI';
var OBS_SHEET_NAME = 'Hoja 1'; // Cambiar si la hoja tiene otro nombre

/**
 * Inicializar headers si el Sheet está vacío
 */
function initHeaders() {
  var ss = SpreadsheetApp.openById(OBS_SHEET_ID);
  var sheet = ss.getSheetByName(OBS_SHEET_NAME) || ss.getSheets()[0];
  var firstRow = sheet.getRange(1, 1, 1, 6).getValues()[0];
  
  // Si la primera celda está vacía, agregar headers
  if (!firstRow[0]) {
    sheet.getRange(1, 1, 1, 6).setValues([
      ['CodigoBarra', 'FechaHora', 'Usuario', 'Estado', 'Observacion', 'Equipo']
    ]);
    // Formato de headers
    sheet.getRange(1, 1, 1, 6)
      .setFontWeight('bold')
      .setBackground('#0c4a6e')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
}

/**
 * doGet — Devuelve el historial de observaciones de un código de barra
 * 
 * Parámetros URL:
 *   ?action=getHistorial&barraId=953082360046
 * 
 * Respuesta:
 *   { ok: true, data: [ { fecha, usuario, estado, observacion, equipo }, ... ] }
 *   Ordenado de más reciente a más antiguo
 */
function doGet(e) {
  try {
    var action = (e.parameter.action || '').trim();
    var barraId = (e.parameter.barraId || '').trim();
    
    if (action === 'getHistorial' && barraId) {
      var ss = SpreadsheetApp.openById(OBS_SHEET_ID);
      var sheet = ss.getSheetByName(OBS_SHEET_NAME) || ss.getSheets()[0];
      var data = sheet.getDataRange().getValues();
      
      var historial = [];
      
      // Recorrer desde fila 2 (saltar headers)
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var cellBarra = String(row[0] || '').trim();
        
        if (cellBarra === barraId) {
          historial.push({
            fecha: String(row[1] || ''),
            usuario: String(row[2] || ''),
            estado: String(row[3] || ''),
            observacion: String(row[4] || ''),
            equipo: String(row[5] || '')
          });
        }
      }
      
      // Ordenar de más reciente a más antiguo
      historial.reverse();
      
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, data: historial, count: historial.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getUltimaObsPorGuia') {
      var ss3 = SpreadsheetApp.openById(OBS_SHEET_ID);
      var sheet3 = ss3.getSheetByName(OBS_SHEET_NAME) || ss3.getSheets()[0];
      var data3 = sheet3.getDataRange().getValues();
      // Recorre una sola vez y guarda la ÚLTIMA fila por barraId
      // (el Sheet está en orden cronológico ascendente → la última fila es la más reciente)
      var mapaUltima = {};
      for (var k = 1; k < data3.length; k++) {
        var rk = data3[k];
        var bk = String(rk[0] || '').trim();
        if (!bk) continue;
        var fhk = rk[1] instanceof Date
          ? rk[1].toLocaleDateString('es-AR') + ' ' + rk[1].toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})
          : String(rk[1] || '');
        mapaUltima[bk] = {
          fecha:       fhk,
          usuario:     String(rk[2] || '').trim(),
          estado:      String(rk[3] || '').trim(),
          observacion: String(rk[4] || '').trim(),
          equipo:      String(rk[5] || '').trim()
        };
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, data: mapaUltima }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getObservacionesDelDia') {
      var fecha = (e.parameter.fecha || '').trim(); // esperado: "dd/mm/yyyy"
      if (!fecha) {
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: 'Falta parámetro fecha (dd/mm/yyyy)' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var ss2 = SpreadsheetApp.openById(OBS_SHEET_ID);
      var sheet2 = ss2.getSheetByName(OBS_SHEET_NAME) || ss2.getSheets()[0];
      var data2 = sheet2.getDataRange().getValues();

      var result = [];
      for (var j = 1; j < data2.length; j++) {
        var row2 = data2[j];
        // Col B puede ser Date (auto-conversión Sheets) o string
        var fhStr = row2[1] instanceof Date
          ? row2[1].toLocaleDateString('es-AR') + ' ' + row2[1].toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})
          : String(row2[1] || '');
        if (fhStr.indexOf(fecha) === 0) {
          result.push({
            barraId:     String(row2[0] || ''),
            fecha:       fhStr,
            usuario:     String(row2[2] || ''),
            estado:      String(row2[3] || ''),
            observacion: String(row2[4] || ''),
            equipo:      String(row2[5] || '')
          });
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, data: result, count: result.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Si no hay action, devolver info del Sheet
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        message: 'Web App de Observaciones Históricas - Andesmar Cargas',
        usage: '?action=getHistorial&barraId=CODIGO_BARRA | ?action=getObservacionesDelDia&fecha=dd/mm/yyyy | ?action=getUltimaObsPorGuia'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * doPost — Agrega una nueva observación al historial
 * 
 * Payload esperado:
 * {
 *   action: 'addObservacion',
 *   barraId: '953082360046',
 *   fecha: '06/04/2026 18:30',
 *   usuario: 'Francisco',
 *   estado: 'gestionado-cliente',
 *   observacion: 'Se contactó al destinatario, queda pendiente retiro',
 *   equipo: 'Customer Service'
 * }
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    
    if (payload.action === 'addObservacion') {
      // Validar campos obligatorios
      if (!payload.barraId || !payload.observacion) {
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: 'Faltan campos obligatorios (barraId, observacion)' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var ss = SpreadsheetApp.openById(OBS_SHEET_ID);
      var sheet = ss.getSheetByName(OBS_SHEET_NAME) || ss.getSheets()[0];
      
      // Inicializar headers si es necesario
      var firstCell = sheet.getRange(1, 1).getValue();
      if (!firstCell) {
        sheet.getRange(1, 1, 1, 6).setValues([
          ['CodigoBarra', 'FechaHora', 'Usuario', 'Estado', 'Observacion', 'Equipo']
        ]);
      }
      
      // Agregar nueva fila (append)
      var newRow = [
        String(payload.barraId || ''),
        String(payload.fecha || new Date().toLocaleString('es-AR')),
        String(payload.usuario || ''),
        String(payload.estado || ''),
        String(payload.observacion || ''),
        String(payload.equipo || '')
      ];
      
      sheet.appendRow(newRow);
      
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, message: 'Observación guardada', barraId: payload.barraId }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Acción no reconocida. Usar action: addObservacion' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función de prueba — ejecutar manualmente para verificar que el Sheet funciona
 */
function testAppend() {
  var ss = SpreadsheetApp.openById(OBS_SHEET_ID);
  var sheet = ss.getSheetByName(OBS_SHEET_NAME) || ss.getSheets()[0];
  
  initHeaders();
  
  sheet.appendRow([
    '999999999999',                          // CodigoBarra (test)
    new Date().toLocaleString('es-AR'),      // FechaHora
    'Test Usuario',                          // Usuario
    'pendiente',                             // Estado
    'Esta es una observación de prueba',     // Observacion
    'Customer Service'                       // Equipo
  ]);
  
  Logger.log('Fila de prueba agregada OK');
}
