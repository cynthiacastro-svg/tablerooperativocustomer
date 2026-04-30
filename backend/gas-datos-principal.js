// ══════════════════════════════════════════════════════════════
//  GOOGLE APPS SCRIPT — Web App Principal (Datos del Tablero)
//  Deploy URL: https://script.google.com/macros/s/AKfycby1hJd8RJzAP5kBrcFkhRciyMixb6U-_jLpjDr-xi_CYUAbTBvDK5bzfd6YDV-71OV-/exec
//
//  Este script sirve los datos del Sheet principal al Dashboard
//  y recibe gestiones para escribirlas en columnas CI-CL (87-90)
// ══════════════════════════════════════════════════════════════

// ID del Google Sheet principal con los datos de guías
var SHEET_ID   = '1OxzIe1yJHen52DnHjmQYAgo8Etao_oUl1MunUR2MKBA';
var SHEET_NAME = 'tablero_temp'; // Verificar el nombre real de la pestaña

// Columnas de gestión en el Sheet (1-indexed para Apps Script)
var COL_GESTION_ESTADO  = 87;  // CI
var COL_GESTION_OBS     = 88;  // CJ
var COL_GESTION_FECHA   = 89;  // CK
var COL_GESTION_USUARIO = 90;  // CL

// Destinatarios del resumen diario
var EMAIL_DESTINO = 'calidad@andesmarcargas.com, cynthiacastro@andesmar.com.ar';

// ─────────────────────────────────────────────────────────────
//  doGet — Devuelve todos los datos del Sheet como JSON
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    if (e.parameter.action === 'actualizarDrivin') {
      var res = actualizarDrivin();
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.action === 'resetDrivin') {
      var res = resetDrivinLote();
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter.action === 'syncPods') {
      return syncPods(e.parameter.date);
    }
    if (e.parameter.action === 'getDatosDrivin') {
      return getDatosDrivin();
    }
    if (e.parameter.action === 'diagDrivin') {
      return diagDrivin(e.parameter.date);
    }

    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    var data  = sheet.getDataRange().getValues();

    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────────────
//  doPost — Recibe gestiones y las escribe en el Sheet
//
//  Soporta dos formatos de payload:
//
//  Formato dashboard (nuevo):
//    { action: 'updateGestion', barraId, estado, obs, fecha, usuario }
//
//  Formato legacy:
//    { codigoBarra, estado, observacion, usuario, equipo }
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var ss     = SpreadsheetApp.openById(SHEET_ID);
    var sheet  = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    var data   = sheet.getDataRange().getValues();

    // Normalizar campos — acepta ambos formatos
    var barraId      = String(params.barraId || params.codigoBarra || '').trim();
    var estado       = String(params.estado       || '');
    var obs          = String(params.obs          || params.observacion || '');
    var fecha        = String(params.fecha        || new Date().toLocaleString('es-AR'));
    var usuario      = String(params.usuario      || '');
    var equipo       = String(params.equipo       || '');
    // Si viene equipo lo incluye en la columna CL para identificación
    var usuarioFinal = equipo ? usuario + ' (' + equipo + ')' : usuario;

    // ── Envío de reporte por mail ────────────────────────────
    if (params.action === 'enviarReporte') {
      MailApp.sendEmail({
        to:       EMAIL_DESTINO,
        subject:  String(params.asunto  || 'Reporte de Gestión — Andesmar Cargas'),
        htmlBody: String(params.htmlBody || ''),
        name:     'Dashboard Andesmar Cargas'
      });
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, message: 'Reporte enviado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!barraId) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Falta barraId / codigoBarra' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var found = false;
    for (var i = 1; i < data.length; i++) {
      var cellBarra = String(data[i][9] || '').trim(); // Columna J (índice 9)
      if (cellBarra === barraId) {
        sheet.getRange(i + 1, COL_GESTION_ESTADO).setValue(estado);
        sheet.getRange(i + 1, COL_GESTION_OBS).setValue(obs);
        sheet.getRange(i + 1, COL_GESTION_FECHA).setValue(fecha);
        sheet.getRange(i + 1, COL_GESTION_USUARIO).setValue(usuarioFinal);
        found = true;
        break;
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, found: found, barraId: barraId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────────────
//  syncPods — Llama Drivin API por fecha, deduplica, escribe en DatosDrivin
// ─────────────────────────────────────────────────────────────
var DRIVIN_API_KEY  = '6f012560-ffc6-4cc1-abf8-86e3e2328dd0';
var DRIVIN_BASE_URL = 'https://external.driv.in/api/external/v2/pods';
var DRIVIN_SHEET    = 'DatosDrivin';
var TIMEZONE        = 'America/Argentina/Buenos_Aires';
var STATUS_PRIORITY = { approved: 3, rejected: 2, pending: 1 };

function syncPods(date) {
  try {
    if (!date) {
      date = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    }

    var resp    = UrlFetchApp.fetch(
      DRIVIN_BASE_URL + '?start_date=' + date + '&end_date=' + date,
      { headers: { 'X-API-Key': DRIVIN_API_KEY, 'Content-Type': 'application/json' }, muteHttpExceptions: true }
    );
    var rawText = resp.getContentText();
    var httpCode = resp.getResponseCode();

    var parsed;
    try { parsed = JSON.parse(rawText); }
    catch (e) {
      return _json({ ok: false, error: 'JSON parse error: ' + e.message, http_code: httpCode, raw: rawText.substring(0, 300) });
    }

    var drivinStatus = parsed && (parsed.status || parsed.Status || '');
    if (!parsed || String(drivinStatus).toUpperCase() !== 'OK') {
      return _json({ ok: false, error: 'Drivin status: ' + (drivinStatus || 'unknown'), http_code: httpCode, raw: rawText.substring(0, 300) });
    }

    var map = {};
    var routes = parsed.response || parsed.routes || parsed.data || [];
    for (var i = 0; i < routes.length; i++) {
      var orders = routes[i].orders || routes[i].stops || (Array.isArray(routes[i]) ? routes[i] : []);
      for (var j = 0; j < orders.length; j++) {
        var o = orders[j];
        // Solo procesar entregas (delivery) — excluir pickups y otros tipos
        var cat = String(o.category || o.type || o.order_type || '').trim().toLowerCase();
        if (cat && cat !== 'delivery') continue;
        var code = String(o.alt_code || o.reference || o.code || '').trim();
        if (!code) continue;
        var st  = String(o.status || o.state || 'pending').trim();
        var rs  = o.reason ? String(o.reason).trim() : '';
        var ex  = map[code];
        if (!ex || (STATUS_PRIORITY[st] || 0) > (STATUS_PRIORITY[ex.status] || 0)) {
          map[code] = { alt_code: code, status: st, reason: rs };
        }
      }
    }

    var rows     = Object.keys(map).map(function(k) { return map[k]; });
    var syncedAt = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm');
    var ss       = SpreadsheetApp.openById(SHEET_ID);
    var sheet    = ss.getSheetByName(DRIVIN_SHEET) || ss.insertSheet(DRIVIN_SHEET);
    sheet.clearContents();

    var output = [['alt_code', 'status', 'reason', 'synced_at']];
    for (var k = 0; k < rows.length; k++) {
      output.push([rows[k].alt_code, rows[k].status, rows[k].reason, syncedAt]);
    }
    sheet.getRange(1, 1, output.length, 4).setValues(output);

    // Muestra una muestra de alt_codes para diagnóstico
    var sample = rows.slice(0, 3).map(function(r) { return r.alt_code; });
    return _json({ ok: true, rows: rows.length, date: date, synced_at: syncedAt, sample: sample });

  } catch (err) {
    return _json({ ok: false, error: 'syncPods exception: ' + err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  diagDrivin — Diagnóstico: muestra key parcial, URL, raw response
// ─────────────────────────────────────────────────────────────
function diagDrivin(date) {
  try {
    if (!date) {
      date = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    }
    var keyLen    = DRIVIN_API_KEY.length;
    var keyMasked = DRIVIN_API_KEY.substring(0, 4) + '****' + DRIVIN_API_KEY.substring(keyLen - 4);
    var url       = DRIVIN_BASE_URL + '?start_date=' + date + '&end_date=' + date;
    var resp     = UrlFetchApp.fetch(url, {
      headers: { 'X-API-Key': DRIVIN_API_KEY, 'Content-Type': 'application/json' },
      muteHttpExceptions: true
    });
    var httpCode = resp.getResponseCode();
    var rawText  = resp.getContentText();

    return _json({
      ok: true,
      diag: true,
      key_masked: keyMasked,
      key_length: keyLen,
      auth_header_format: 'X-API-Key: ****',
      url: url,
      http_code: httpCode,
      raw_response: rawText.substring(0, 500)
    });
  } catch (err) {
    return _json({ ok: false, error: 'diagDrivin exception: ' + err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  getDatosDrivin — Lee DatosDrivin y devuelve mapa { alt_code: { status, reason } }
// ─────────────────────────────────────────────────────────────
function getDatosDrivin() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(DRIVIN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return _json({ ok: true, data: {}, rows: 0, synced_at: null });
  }

  var raw  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  var data = {};
  var syncedAt = '';
  for (var i = 0; i < raw.length; i++) {
    var code = String(raw[i][0] || '').trim();
    if (!code) continue;
    data[code] = { status: String(raw[i][1] || '').trim(), reason: String(raw[i][2] || '').trim() };
    if (!syncedAt && raw[i][3]) syncedAt = String(raw[i][3]);
  }
  return _json({ ok: true, data: data, rows: Object.keys(data).length, synced_at: syncedAt });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────
//  enviarResumenDiario — Programar con trigger diario (reloj)
//  Envía email con todas las gestiones registradas hoy
// ─────────────────────────────────────────────────────────────
function enviarResumenDiario() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  var data  = sheet.getDataRange().getValues();
  var hoy   = new Date().toLocaleDateString('es-AR');

  var resumen = '<h3>Resumen de Gestiones Andesmar - ' + hoy + '</h3>';
  resumen += '<table border="1" style="border-collapse:collapse; width:100%">';
  resumen += '<tr style="background:#0f172a; color:white">';
  resumen += '<th>Cliente</th><th>Barra</th><th>Gestión</th><th>Usuario</th></tr>';

  var conteo = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Columna CK (índice 88) puede ser Date (legacy) o string "DD/MM/YYYY HH:MM"
    var fechaFila = row[88] instanceof Date
      ? row[88].toLocaleDateString('es-AR')
      : String(row[88] || '');
    // Comparar: la fecha puede incluir hora, así que buscamos hoy como substring
    if (fechaFila === hoy || fechaFila.indexOf(hoy) === 0) {
      conteo++;
      resumen += '<tr>';
      resumen += '<td>' + (row[8]  || '') + '</td>';   // Col I  — Cliente
      resumen += '<td>' + (row[9]  || '') + '</td>';   // Col J  — Barra
      resumen += '<td>' + (row[87] || '') + '</td>';   // Col CJ — Observación
      resumen += '<td>' + (row[89] || '') + '</td>';   // Col CL — Usuario
      resumen += '</tr>';
    }
  }

  if (conteo > 0) {
    resumen += '</table><p>Total de movimientos hoy: ' + conteo + '</p>';
    MailApp.sendEmail({
      to:       EMAIL_DESTINO,
      subject:  '📊 Reporte Diario de Críticos - ' + hoy,
      htmlBody: resumen
    });
  }
}
