# Andesmar Cargas — Dashboard de Gestión de Críticos

## Estructura del Proyecto

```
andesmar-extension/
├── tablero_derivacion.html          ← Dashboard principal (HTML + CSS + JS, ~2400 líneas)
├── gas-datos-principal.js           ← Google Apps Script - Datos del tablero (ya deployado)
├── gas-observaciones-historicas.js  ← Google Apps Script - Historial de observaciones (NUEVO)
├── PROMPT_MEJORA.md                 ← Prompt para implementar mejora de observaciones
└── README.md                        ← Este archivo
```

## Archivos y sus funciones

### `tablero_derivacion.html`
Archivo principal del dashboard. Se abre desde el navegador (file:// o servidor).
Contiene todo: HTML, CSS y JavaScript en un solo archivo.

**Funcionalidades:**
- Carga datos desde Google Sheets automáticamente al loguearse
- Sistema de login con roles (admin, ejecutivo, sucursal, agencia)
- Tarjetas de resumen (Siniestro, Operaciones, Ejecutivo, Devolución, Customer)
- Tabla con filtros por destino, modalidad, ejecutivo, gestión, vencidas
- Ordenamiento por columnas clickeables
- Derivación entre equipos (Operaciones ↔ Ejecutivo)
- Botones circulares: Trazabilidad, WhatsApp, SPK, PND
- Panel de trazabilidad Driv.in inline
- PND con toggle CSS puro (sin JavaScript)
- Export CSV con todas las columnas
- Resumen del día descargable (.txt)
- Resumen de jornada al pie (sessionStorage)
- Toast notifications
- Sincronización de gestiones con Google Sheets

### `gas-datos-principal.js`
Google Apps Script ya deployado que sirve los datos del tablero.

**Deploy URL:** `https://script.google.com/macros/s/AKfycbw21ueJCVoSAWe1kLizJGYstLflj_zBdpbyFHWMhAiE4Qq2mNRRPGUa6Dx2nPZsBDIEg/exec`

**Sheet ID:** `1p79gOvS2IyXwF_Hc-IMvGOLBkfpm4pxHV5xkFnnvo6s`

**Endpoints:**
- `GET` → Devuelve array de arrays con todos los datos
- `POST { action: 'updateGestion', barraId, estado, obs, fecha, usuario }` → Escribe gestión en columnas CI-CL

### `gas-observaciones-historicas.js`
Google Apps Script NUEVO para historial de observaciones.

**Deploy URL:** `https://script.google.com/macros/s/AKfycbzEnNcBQ0vPrGxrwr8vuTUVEzIlh-MAPt41Ej0DZerqW5bEBfgZ3EIW9Zj2e8UfPWfZ/exec`

**Sheet ID:** `1BgD_5mYJO--Z8n1_RgiQIvHCY-lgRusTaaGSwGUZDtI`

**Endpoints:**
- `GET ?action=getHistorial&barraId=XXXXX` → Historial de observaciones de una guía
- `POST { action: 'addObservacion', barraId, fecha, usuario, estado, observacion, equipo }` → Agrega observación

## Mapeo de Columnas del Sheet Principal (índice base 0)

| Índice | Columna | Campo |
|--------|---------|-------|
| 0 | A | Estado Movimiento |
| 1 | B | Acciones Call |
| 2 | C | Agencia (código) |
| 3 | D | Agencia Nombre |
| 4 | E | Agencia Destino (código) |
| 5 | F | Agencia Destino Nombre |
| 7 | H | Cliente Comercial |
| 9 | J | **Código de Barra** (ID único) |
| 10 | K | Corporativo |
| 12 | M | Dest Localidad |
| 13 | N | Dest Provincia |
| 14 | O | Destinatario Apellido |
| 16 | Q | Destinatario Nombre |
| 17 | R | Destinatario Tel |
| 18 | S | Det Guía |
| 20 | U | Días de Desvío |
| 26 | AA | Ejecutivo Seguimiento |
| 29 | AD | Estado Incidencia |
| 33 | AH | Estado Entrega |
| 34 | AI | Estado Estático |
| 36 | AK | Fecha Emisión |
| 41 | AP | Fecha Estado Movimiento |
| 48 | AW | Guía ID |
| 50 | AY | Kilos |
| 55 | BD | Modalidad |
| 58 | BG | Nro Seguimiento |
| 60 | BI | Obs Tipificada |
| 73 | BV | Remito Cliente |
| 83 | CF | Valor Declarado |
| 86 | CI | Estado Gestión |
| 87 | CJ | Observación Gestión |
| 88 | CK | Fecha Gestión |
| 89 | CL | Usuario Gestión |

## Lógica de Derivación

1. **En destino +30d** → Devolver Remitente / Customer Service
2. **+15d sin movimiento (SINIESTRO):**
   - Con Acciones Call → Operaciones Urgente
   - Sin Acciones Call + con Obs Tipificada → Ejecutivo Seguimiento
   - Sin Acciones Call + sin Obs Tipificada → Operaciones Urgente
3. **General (no siniestro):**
   - Con Acciones Call → Operaciones Urgente
   - Sin Acciones Call + con Obs Tipificada → Ejecutivo Seguimiento
   - Sin Acciones Call + sin Obs Tipificada → Operaciones Urgente

## Variables Globales del Dashboard

```javascript
WEBAPP_URL        // URL del Web App principal (datos)
OBS_WEBAPP_URL    // URL del Web App de observaciones (pendiente de agregar)
STORAGE_KEY       // Key de localStorage para gestiones
GCOL              // Índices de columnas de gestión en Sheet
gestionState      // Objeto { barraId: { estado, obs, fecha, usuario } }
sesionLog         // Array de gestiones de la sesión actual
currentUser       // Usuario logueado { username, role, label, filterValue }
allData           // Todos los datos cargados del Sheet
filteredData      // Datos después de aplicar filtros
transitMap        // Mapa de tránsitos Google Sheets
currentSort       // Ordenamiento actual { field, dir }
```

## Funciones Clave

```javascript
loadFromSheet()           // Carga datos del Sheet principal
processSheetRows(rows)    // Procesa array de arrays del Sheet
saveGestionToSheet()      // Sincroniza gestión con Sheet (POST no-cors)
promptGestion()           // Abre diálogo de gestión (historial + nueva obs)
updateResumenJornada()    // Actualiza panel de resumen al pie
showToast(msg, type)      // Muestra notificación
safeStr(val)              // Convierte cualquier valor a string seguro
parseDate(str)            // Parsea fechas en múltiples formatos
parseMoneda(val)          // Parsea moneda argentina
loadGoogleSheets()        // Carga tránsitos desde Sheet de tránsitos
loadDrivPanel()           // Carga trazabilidad Driv.in
```

## Usuarios por defecto

```
admin / andesmar2025 → Administrador (acceso total)
```
Desde el panel de admin se crean usuarios con roles: ejecutivo, sucursal, agencia.

## Diseño

- **Paleta:** Azul Petróleo (#0c4a6e), Grises Slate, Blanco
- **Tarjeta Siniestro:** Fondo petróleo + texto blanco
- **Filas críticas:** Fondo petróleo + texto blanco + links celestes
- **Badge de días:** Negro (crítico), gris oscuro, gris medio, gris claro
- **Fuente:** Inter (Google Fonts)
- **Iconos:** FontAwesome 6.5.1
- **Logo:** Andesmar 65px
