// ══════════════════════════════════════════════════════════════
//  GOOGLE APPS SCRIPT — Sync Drivin PODs por fecha
//  Deploy: Web App → Execute as: Me → Who has access: Anyone
//
//  Endpoints:
//    GET ?action=syncPods[&date=YYYY-MM-DD]
//      → Llama Drivin API, deduplica por alt_code, escribe en hoja DatosDrivin
//      → Retorna { ok, rows, date }
//
//    GET ?action=getDatosDrivin
//      → Lee hoja DatosDrivin y retorna mapa { alt_code: { status, reason } }
//      → Retorna { ok, data, rows }
// ══════════════════════════════════════════════════════════════

var SHEET_ID        = '1OxzIe1yJHen52DnHjmQYAgo8Etao_oUl1MunUR2MKBA';
var DRIVIN_API_KEY  = '6f012560-ffc6-4cc1-abf8-86e3e2328dd0';
var DRIVIN_BASE_URL = 'https://external.driv.in/api/external/v2/pods';
var SHEET_NAME      = 'DatosDrivin';
var TIMEZONE        = 'America/Argentina/Buenos_Aires';

// Prioridad de estados para deduplicación por alt_code
var STATUS_PRIORITY = { approved: 3, rejected: 2, pending: 1 };

// ─────────────────────────────────────────────────────────────
function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';
  try {
    if (action === 'syncPods')      return syncPods(e.parameter.date);
    if (action === 'getDatosDrivin') return getDatosDrivin();
    return json({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  syncPods: llama Drivin por fecha, deduplica, escribe en hoja
// ─────────────────────────────────────────────────────────────
function syncPods(date) {
  if (!date) {
    date = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  }

  var url = DRIVIN_BASE_URL + '?start_date=' + date + '&end_date=' + date;
  var resp = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Token token=' + DRIVIN_API_KEY },
    muteHttpExceptions: true
  });

  var rawText = resp.getContentText();
  var parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return json({ ok: false, error: 'JSON parse error: ' + e.message });
  }

  if (!parsed || parsed.status !== 'OK') {
    return json({ ok: false, error: 'Drivin status: ' + (parsed && parsed.status || 'unknown') });
  }

  // Recorre response[] → orders[] y deduplica por alt_code
  var map = {};
  var routes = parsed.response || [];
  for (var i = 0; i < routes.length; i++) {
    var orders = routes[i].orders || [];
    for (var j = 0; j < orders.length; j++) {
      var order    = orders[j];
      var altCode  = String(order.alt_code || '').trim();
      if (!altCode) continue;
      var status   = String(order.status || 'pending').trim();
      var reason   = order.reason ? String(order.reason).trim() : '';
      var existing = map[altCode];
      var curPrio  = existing ? (STATUS_PRIORITY[existing.status] || 0) : -1;
      var newPrio  = STATUS_PRIORITY[status] || 0;
      if (!existing || newPrio > curPrio) {
        map[altCode] = { alt_code: altCode, status: status, reason: reason };
      }
    }
  }

  var rows = Object.keys(map).map(function(k) { return map[k]; });
  var syncedAt = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm');

  // Crea o limpia la hoja DatosDrivin
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clearContents();

  // Escribe headers + datos en un solo batch
  var output = [['alt_code', 'status', 'reason', 'synced_at']];
  for (var k = 0; k < rows.length; k++) {
    output.push([rows[k].alt_code, rows[k].status, rows[k].reason, syncedAt]);
  }
  if (output.length > 1) {
    sheet.getRange(1, 1, output.length, 4).setValues(output);
  } else {
    // Solo headers si no hay datos
    sheet.getRange(1, 1, 1, 4).setValues(output);
  }

  return json({ ok: true, rows: rows.length, date: date, synced_at: syncedAt });
}

// ─────────────────────────────────────────────────────────────
//  getDatosDrivin: lee la hoja y retorna mapa { alt_code: { status, reason } }
// ─────────────────────────────────────────────────────────────
function getDatosDrivin() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    return json({ ok: true, data: {}, rows: 0, synced_at: null });
  }

  var lastRow = sheet.getLastRow();
  var raw     = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var data    = {};
  var syncedAt = '';

  for (var i = 0; i < raw.length; i++) {
    var altCode = String(raw[i][0] || '').trim();
    var status  = String(raw[i][1] || '').trim();
    var reason  = String(raw[i][2] || '').trim();
    if (!altCode) continue;
    data[altCode] = { status: status, reason: reason };
    if (!syncedAt && raw[i][3]) syncedAt = String(raw[i][3]);
  }

  return json({ ok: true, data: data, rows: Object.keys(data).length, synced_at: syncedAt });
}

// ─────────────────────────────────────────────────────────────
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
