// ══════════════════════════════════════════════════════════════
//  GOOGLE APPS SCRIPT — Proxy Driv.in API con caché en Sheets
//  Deploy URL: https://script.google.com/macros/s/AKfycbxjP3eyGoHn2xx4K2zwuJei1fqxcfIvW9ExHYqdaIy-r87wbCGU9eVsTz7aWqWiGqQ/exec
//
//  INSTRUCCIONES:
//  1. Ir a https://script.google.com y abrir el proyecto del proxy
//  2. Reemplazar todo el contenido de Code.gs con este código
//  3. Deploy → Manage deployments → Edit → New version → Deploy
//     · Execute as: Me  ·  Who has access: Anyone
//
//  CACHÉ: usa la pestaña "DrivinCache" en el Sheet de observaciones.
//  Se crea automáticamente si no existe. No requiere configuración.
//
//  ENDPOINTS:
//  · GET ?order_code=REF            → búsqueda individual (con caché)
//  · GET ?action=batchSearch&references=ref1,ref2,...  → lote (con caché)
// ══════════════════════════════════════════════════════════════

var DRIVIN_API_KEY  = '6f012560-ffc6-4cc1-abf8-86e3e2328dd0';
var DRIVIN_BASE_URL = 'https://external.driv.in/api/external/v2/pods';

// Sheet de observaciones — se agrega pestaña DrivinCache
var CACHE_SHEET_ID   = '1BgD_5mYJO--Z8n1_RgiQIvHCY-lgRusTaaGSwGUZDtI';
var CACHE_SHEET_NAME = 'DrivinCache';

// TTL en milisegundos (approved = nunca vence)
var TTL_PENDING_MS   = 4 * 3600 * 1000;
var TTL_NOT_FOUND_MS = 6 * 3600 * 1000;

// ── Helpers de caché ──────────────────────────────────────────

function _getCacheSheet() {
  try {
    var ss    = SpreadsheetApp.openById(CACHE_SHEET_ID);
    var sheet = ss.getSheetByName(CACHE_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CACHE_SHEET_NAME);
      sheet.getRange(1, 1, 1, 4).setValues([['SearchVal', 'Status', 'Timestamp', 'ResponseJSON']]);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#0c4a6e').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(4, 400);
    }
    return sheet;
  } catch(e) {
    return null; // Si falla el acceso al Sheet, se continúa sin caché
  }
}

function _loadCache(sheet) {
  if (!sheet) return {};
  try {
    var data  = sheet.getDataRange().getValues();
    var cache = {};
    var now   = Date.now();
    for (var i = 1; i < data.length; i++) {
      var sv = String(data[i][0] || '').trim();
      var st = String(data[i][1] || '').trim();
      var ts = data[i][2] ? new Date(data[i][2]).getTime() : 0;
      var rj = String(data[i][3] || '');
      if (!sv || !st || !rj) continue;
      var ttl = (st === 'approved') ? Infinity : (st === 'pending' ? TTL_PENDING_MS : TTL_NOT_FOUND_MS);
      if ((now - ts) < ttl) {
        cache[sv] = { status: st, responseJSON: rj };
      }
    }
    return cache;
  } catch(e) {
    return {};
  }
}

function _appendToCache(sheet, entries) {
  if (!sheet || !entries.length) return;
  try {
    var now  = new Date().toISOString();
    var rows = entries.map(function(e) {
      return [e.sv, e.status, now, e.responseJSON];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  } catch(e) {
    // ignorar errores de escritura en caché
  }
}

function _parseStatus(responseText) {
  try {
    var parsed = JSON.parse(responseText);
    var pods   = parsed.response || [];
    var pod    = pods[0] || null;
    var hasProof = pods.length > 0 && !!(pod && (pod.pdf_pod || (pod.images && pod.images.length > 0)));
    return hasProof ? 'approved' : (pods.length > 0 ? 'pending' : 'not_found');
  } catch(e) {
    return 'not_found';
  }
}

// ── doGet ─────────────────────────────────────────────────────

function doGet(e) {
  try {
    var action = (e.parameter.action || '').trim();

    // ── Búsqueda por lotes ────────────────────────────────────
    if (action === 'batchSearch') {
      var refs = (e.parameter.references || '').split(',')
        .map(function(r) { return r.trim(); })
        .filter(Boolean)
        .slice(0, 20);

      if (!refs.length) {
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: 'Falta parámetro references' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var sheet   = _getCacheSheet();
      var cache   = _loadCache(sheet);
      var results = {};
      var toFetch = [];

      refs.forEach(function(ref) {
        if (cache[ref]) {
          try {
            results[ref] = JSON.parse(cache[ref].responseJSON);
          } catch(_) {
            toFetch.push(ref);
          }
        } else {
          toFetch.push(ref);
        }
      });

      if (toFetch.length) {
        var requests = toFetch.map(function(ref) {
          return {
            url:     DRIVIN_BASE_URL + '?order_code[]=' + encodeURIComponent(ref),
            headers: { 'X-API-Key': DRIVIN_API_KEY },
            muteHttpExceptions: true
          };
        });

        var responses  = UrlFetchApp.fetchAll(requests);
        var newEntries = [];

        toFetch.forEach(function(ref, i) {
          var text = responses[i].getContentText();
          try {
            results[ref] = JSON.parse(text);
            newEntries.push({ sv: ref, status: _parseStatus(text), responseJSON: text });
          } catch(err) {
            results[ref] = { error: err.message };
          }
        });

        _appendToCache(sheet, newEntries);
      }

      var fromCache = refs.length - toFetch.length;
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, results: results, _cache: { hit: fromCache, miss: toFetch.length } }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Búsqueda individual ───────────────────────────────────
    var orderCode = (e.parameter.order_code || '').trim();

    if (!orderCode) {
      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          message: 'Proxy Driv.in con caché — Andesmar Cargas',
          usage: '?order_code=REF | ?action=batchSearch&references=ref1,ref2,...'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet2 = _getCacheSheet();
    var cache2 = _loadCache(sheet2);
    if (cache2[orderCode]) {
      return ContentService
        .createTextOutput(cache2[orderCode].responseJSON)
        .setMimeType(ContentService.MimeType.JSON);
    }

    var url      = DRIVIN_BASE_URL + '?order_code[]=' + encodeURIComponent(orderCode);
    var response = UrlFetchApp.fetch(url, {
      headers: { 'X-API-Key': DRIVIN_API_KEY },
      muteHttpExceptions: true
    });
    var text = response.getContentText();

    _appendToCache(sheet2, [{ sv: orderCode, status: _parseStatus(text), responseJSON: text }]);

    return ContentService
      .createTextOutput(text)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (fatal) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: fatal.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
