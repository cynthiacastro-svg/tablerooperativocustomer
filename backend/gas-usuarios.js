// ══════════════════════════════════════════════════════════════
//  GOOGLE APPS SCRIPT — Web App Usuarios y Permisos (Sheet 4)
//  Deploy URL: https://script.google.com/macros/s/AKfycbxHVI9ChViETY4q38_ynuvzcGqinAzcSqTn1r-u2AEG7AENdgUDt2f3KVarMF2dDC7Z/exec
//  Sheet: https://docs.google.com/spreadsheets/d/1JZAefIIZ8HY5DQSz_MhWq7j-VRvAzmvBxFeMpq5tO1Q
//
//  ESTRUCTURA del Sheet (8 columnas):
//    Col A: Label (nombre visible, ej: "cd Buenos Aires operaciones")
//    Col B: Agrupación ("Operaciones" | "Customer Service")
//    Col C: Responsable
//    Col D: Username (ej: bsas_ops)
//    Col E: Password (ej: andesmar2025)
//    Col F: Role (admin | sucursal | ejecutivo)  ← NUEVA
//    Col G: sucursal_filtro (ej: CND BUENOS AIRES, * para todas)  ← NUEVA
//    Col H: ejecutivo_filtro (ej: Yemina)  ← NUEVA
//    Col I: ver_todo (SI | NO)  ← NUEVA
//
//  Deploy: Ejecutar como "Yo", Acceso "Cualquiera"
//  Copiar la URL del deploy en USUARIOS_WEBAPP_URL del HTML
// ══════════════════════════════════════════════════════════════

var SHEET_ID_USUARIOS   = '1JZAefIIZ8HY5DQSz_MhWq7j-VRvAzmvBxFeMpq5tO1Q';
var SHEET_NAME_USUARIOS = 'Hoja 1'; // Ajustar si el nombre de la pestaña es diferente

function doGet(e) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID_USUARIOS);
    var sheet = ss.getSheetByName(SHEET_NAME_USUARIOS) || ss.getSheets()[0];
    var data  = sheet.getDataRange().getValues();

    var users = [];
    for (var i = 1; i < data.length; i++) {
      var row      = data[i];
      var label    = String(row[0] || '').trim();
      var agrup    = String(row[1] || '').trim();
      var username = String(row[3] || '').trim().toLowerCase();
      var password = String(row[4] || '').trim();
      var role     = String(row[5] || 'sucursal').trim().toLowerCase();
      var sucFiltro = String(row[6] || '').trim();
      var ejeFiltro = String(row[7] || '').trim();
      var verTodo  = String(row[8] || 'NO').trim().toUpperCase();

      if (!username || !password) continue;

      users.push({
        label:            label,
        agrupacion:       agrup,
        username:         username,
        password:         password,
        role:             role,
        sucursal_filtro:  sucFiltro,
        ejecutivo_filtro: ejeFiltro,
        ver_todo:         verTodo
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, users: users }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── doPost — Crea o actualiza usuario en el Sheet ────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss    = SpreadsheetApp.openById(SHEET_ID_USUARIOS);
    var sheet = ss.getSheetByName(SHEET_NAME_USUARIOS) || ss.getSheets()[0];

    if (payload.action === 'createUser') {
      var username = String(payload.username || '').trim().toLowerCase();
      var password = String(payload.password || '').trim();
      var label    = String(payload.label    || '').trim();

      if (!username || !password) {
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: 'Faltan username o password' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][3] || '').trim().toLowerCase() === username) {
          // Actualizar contraseña en fila existente
          sheet.getRange(i + 1, 5).setValue(password);
          return ContentService
            .createTextOutput(JSON.stringify({ ok: true, updated: true, username: username }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      // Agregar nueva fila: Label | Agrupacion | Responsable | Username | Password | Role | SucFiltro | EjeFiltro | VerTodo
      var newLabel2  = String(payload.label    || '').trim();
      var newSuc    = String(payload.sucursal_filtro  || '').trim();
      var newEje    = String(payload.ejecutivo_filtro || '').trim();
      var newVerTodo = String(payload.ver_todo || 'NO').trim().toUpperCase();
      var newRole2   = String(payload.role || 'sucursal').trim().toLowerCase();
      sheet.appendRow([newLabel2, '', '', username, password, newRole2, newSuc, newEje, newVerTodo]);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, created: true, username: username }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Acción no reconocida' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════
//  LISTADO DE USUARIOS PARA CARGAR EN EL SHEET
//  Pegar en columnas D y E a partir de la fila 2
//
//  | Usuario (A)                      | Agrupación (B)   | D: Username          | E: Password   |
//  |----------------------------------|------------------|----------------------|---------------|
//  | cd Buenos Aires operaciones      | Operaciones      | bsas_ops             | andesmar2025  |
//  | cd Buenos Aires control proceso  | Operaciones      | bsas_ctrl            | andesmar2025  |
//  | cd Buenos Aires administración   | Operaciones      | bsas_adm             | andesmar2025  |
//  | cd Buenos Aires distribución     | Operaciones      | bsas_dist            | andesmar2025  |
//  | cd Mendoza operaciones           | Operaciones      | mza_ops              | andesmar2025  |
//  | cd Mendoza control de proceso    | Operaciones      | mza_ctrl             | andesmar2025  |
//  | cd Mendoza administración        | Operaciones      | mza_adm              | andesmar2025  |
//  | cd Mendoza distribución          | Operaciones      | mza_dist             | andesmar2025  |
//  | cd Córdoba operaciones           | Operaciones      | cba_ops              | andesmar2025  |
//  | cd Córdoba administración        | Operaciones      | cba_adm              | andesmar2025  |
//  | cd Córdoba distribución          | Operaciones      | cba_dist             | andesmar2025  |
//  | cd San Juan operaciones          | Operaciones      | sju_ops              | andesmar2025  |
//  | cd San Juan administración       | Operaciones      | sju_adm              | andesmar2025  |
//  | cd San Juan distribución         | Operaciones      | sju_dist             | andesmar2025  |
//  | cd San Luis operaciones          | Operaciones      | slu_ops              | andesmar2025  |
//  | cd San Luis administración       | Operaciones      | slu_adm              | andesmar2025  |
//  | cd San Luis distribución         | Operaciones      | slu_dist             | andesmar2025  |
//  | cd Neuquén operaciones           | Operaciones      | nqn_ops              | andesmar2025  |
//  | cd Neuquén administración        | Operaciones      | nqn_adm              | andesmar2025  |
//  | cd Neuquén distribución          | Operaciones      | nqn_dist             | andesmar2025  |
//  | Control Procesos                 | Operaciones      | controlprocesos      | andesmar2025  |
//  | Yemina                           | Customer Service | yemina               | andesmar2025  |
//  | Genaro                           | Customer Service | genaro               | andesmar2025  |
//  | Francisco                        | Customer Service | francisco            | andesmar2025  |
//  | Mauricio                         | Customer Service | mauricio             | andesmar2025  |
//  | Grupo Corporativos               | Customer Service | grupocorp            | andesmar2025  |
//  | Grupo Eventuales                 | Customer Service | grupoevent           | andesmar2025  |
//
//  NOTA: El usuario "admin" / "andesmar2025" está hardcodeado en el dashboard.
//  Las contraseñas iniciales son andesmar2025. Se recomienda cambiarlas.
// ══════════════════════════════════════════════════════════════
