# PROMPT PARA CLAUDE CODE / VS CODE
# Proyecto: Dashboard Andesmar Cargas — Mejoras Integrales v2

---

## INSTRUCCIÓN PRINCIPAL

Leé TODOS los archivos de la carpeta `andesmar-extension/` antes de hacer cualquier cambio:
- `tablero_derivacion.html` — Dashboard principal (~2400 líneas, HTML + CSS + JS en un solo archivo)
- `gas-datos-principal.js` — Google Apps Script del tablero (ya deployado)
- `gas-observaciones-historicas.js` — Google Apps Script para historial de observaciones (nuevo, hay que integrarlo)
- `README.md` — Documentación completa del proyecto (mapeo de columnas, variables, funciones)

**Archivos que NO se tocan:** `content.js`, `popup.html`, `popup.js`, `manifest.json`, `INSTALAR.md`, `icons/` — son de una extensión Chrome anterior, no tienen relación con el dashboard.

**REGLA FUNDAMENTAL:** No rompas lo que ya funciona. Leé y entendé toda la arquitectura antes de modificar cualquier cosa.

---

## ARQUITECTURA — 4 Google Sheets

### Sheet 1: BASE PRINCIPAL (datos de guías)
- **URL:** https://docs.google.com/spreadsheets/d/1OxzIe1yJHen52DnHjmQYAgo8Etao_oUl1MunUR2MKBA/edit
- **Web App (ya deployado):** `https://script.google.com/macros/s/AKfycbw21ueJCVoSAWe1kLizJGYstLflj_zBdpbbyFHWMhAiE4Qq2mNRRPGUa6Dx2nPZsBDIEg/exec`
- **Función:** Fuente de datos principal. ~90 columnas por fila. El dashboard hace GET para cargar datos y POST para guardar gestiones en columnas CI-CL (índices 86-89).
- **Código GAS:** `gas-datos-principal.js`

### Sheet 2: TRÁNSITOS (novedades PND + hoja de ruta)
- **URL:** https://docs.google.com/spreadsheets/d/1p79gOvS2IyXwF_Hc-IMvGOLBkfpm4pxHV5xkFnnvo6s/edit
- **Función:** Datos de tránsitos/PND. Se cruza por código de barra o det_guía. Se carga con botón "Cargar tránsitos" vía JSONP (Google Visualization API).
- **IMPORTANTE:** Tiene una columna "Hoja de Ruta" que necesitamos mostrar (ver mejora 6).

### Sheet 3: OBSERVACIONES HISTÓRICAS (NUEVO)
- **URL:** https://docs.google.com/spreadsheets/d/1BgD_5mYJO--Z8n1_RgiQIvHCY-lgRusTaaGSwGUZDtI/edit
- **Web App:** `https://script.google.com/macros/s/AKfycbzEnNcBQ0vPrGxrwr8vuTUVEzIlh-MAPt41Ej0DZerqW5bEBfgZ3EIW9Zj2e8UfPWfZ/exec`
- **Estructura:** CodigoBarra | FechaHora | Usuario | Estado | Observacion | Equipo
- **Función:** Cada observación se agrega como fila nueva (append). Nunca se sobreescribe. Historial completo.
- **Código GAS:** `gas-observaciones-historicas.js`

### Sheet 4: USUARIOS Y PERMISOS (NUEVO)
- **URL:** https://docs.google.com/spreadsheets/d/1JZAefIIZ8HY5DQSz_MhWq7j-VRvAzmvBxFeMpq5tO1Q/edit
- **Estructura actual (3 columnas — faltan username y password, hay que generarlos):**

| Usuario | Agrupación | Responsable |
|---|---|---|
| cd Buenos Aires operaciones | Operaciones | Operaciones Sucursal (CND) |
| cd Buenos Aires control de proceso | Operaciones | Operaciones Sucursal (CND) |
| cd Buenos Aires administración | Operaciones | Operaciones Sucursal (CND) |
| cd Buenos Aires distribución | Operaciones | Operaciones Sucursal (CND) |
| cd Mendoza operaciones | Operaciones | Operaciones Sucursal (CND) |
| cd Mendoza control de proceso | Operaciones | Operaciones Sucursal (CND) |
| cd Mendoza administración | Operaciones | Operaciones Sucursal (CND) |
| cd Mendoza distribución | Operaciones | Operaciones Sucursal (CND) |
| cd Córdoba operaciones | Operaciones | Operaciones Sucursal (CND) |
| cd Córdoba administración | Operaciones | Operaciones Sucursal (CND) |
| cd Córdoba distribución | Operaciones | Operaciones Sucursal (CND) |
| cd San Juan operaciones | Operaciones | Operaciones Sucursal (CND) |
| cd San Juan administración | Operaciones | Operaciones Sucursal (CND) |
| cd San Juan distribución | Operaciones | Operaciones Sucursal (CND) |
| cd San Luis operaciones | Operaciones | Operaciones Sucursal (CND) |
| cd San Luis administración | Operaciones | Operaciones Sucursal (CND) |
| cd San Luis distribución | Operaciones | Operaciones Sucursal (CND) |
| cd Neuquén operaciones | Operaciones | Operaciones Sucursal (CND) |
| cd Neuquén administración | Operaciones | Operaciones Sucursal (CND) |
| cd Neuquén distribución | Operaciones | Operaciones Sucursal (CND) |
| Control Procesos | Operaciones | Operaciones Sucursal (CND) |
| Yemina | Customer Service | Ejecutivo Seguimiento |
| Genaro | Customer Service | Ejecutivo Seguimiento |
| Francisco | Customer Service | Ejecutivo Seguimiento |
| Mauricio | Customer Service | Ejecutivo Seguimiento |
| Grupo Corporativos | Customer Service | Ejecutivo Customer |
| Grupo Eventuales | Customer Service | Ejecutivo Customer |

- **TAREA:** Generá columnas de Username (login, minúscula, sin espacios) y Password (inicial simple) para cada usuario. Entregá el listado completo listo para cargar en el Sheet.

---

## MEJORAS A IMPLEMENTAR (9 mejoras + envío por mail)

### MEJORA 1: Link SPK en todos los pendientes
En TODA fila que tenga estado "Pendiente" o "Sin estado" (sin gestionar), agregar un acceso directo visible a:
```
http://spk.andesmar.com.ar/Login.aspx?ReturnUrl=%2fcallcenter.aspx
```
Puede ser un botón circular como los existentes (usando FontAwesome) o un link claro en la columna de acciones. Que esté siempre presente en filas pendientes/sin gestionar.

### MEJORA 2: Unificar "Sin Estado" con "Pendientes"
Actualmente "Sin estado" (guías no gestionadas) y "Pendiente" (estado asignado manualmente) son categorías separadas. **Unificarlas en una sola:**
- En la barra de resumen de gestiones: un solo número "Pendientes: X" que sume ambas.
- En el filtro de gestión: la opción "Pendiente" debe incluir ambas (estado pendiente + sin estado).
- En tarjetas y contadores: tratar "sin estado" como pendiente.

### MEJORA 3: Gestiones ilimitadas por guía
El usuario debe poder cargar múltiples gestiones sobre la misma guía SIN LÍMITE.
- Cada nueva gestión se SUMA al historial (no reemplaza).
- El dropdown de estado siempre habilitado para volver a seleccionar otro estado o el mismo.
- Cada cambio registrado con fecha, hora, usuario y equipo.
- No hay bloqueo ni tope después de gestionar una guía.

### MEJORA 4: Buscador funcional multi-campo
El campo de búsqueda `#filterSearch` ("Buscar guía, destinatario...") debe buscar en TODOS estos campos simultáneamente con coincidencia parcial:
- Guía ID (índice 48)
- Det Guía (índice 18)
- Código de Barra (índice 9)
- Remito Cliente (índice 73)
- Destinatario Nombre + Apellido (índices 16 y 14)
- Nro Seguimiento (índice 58)
- Cliente Comercial (índice 7)

Al escribir cualquier código o nombre, filtra en tiempo real buscando match parcial en cualquiera de esos campos.

### MEJORA 5: Sistema de usuarios desde Google Sheets
Reemplazar el login hardcodeado en localStorage por uno que lea del Sheet 4 (Usuarios y Permisos).
- Al cargar el dashboard, traer la lista de usuarios del Sheet vía GAS (GET).
- Login: el usuario ingresa username y password, se valida contra el Sheet.
- Dos agrupaciones principales: "Operaciones" y "Customer Service".
- **Permisos de gestión LIBERADOS:** Todos los usuarios pueden gestionar cualquier guía sin restricción por ejecutivo asignado. Esto para no entorpecer el trabajo operativo.
- **Trazabilidad:** Toda gestión queda registrada con el nombre completo del usuario que la hizo.
- Crear código GAS para servir la lista de usuarios (endpoint GET).
- Generar listado completo de usernames/passwords para cargar en el Sheet.

### MEJORA 6: Hoja de ruta en tránsitos
En el Sheet de tránsitos (Sheet 2) hay una columna "Hoja de Ruta" (o nombre similar). Cuando se cargan tránsitos y se muestran los datos de una guía:
- Mostrar la **última hoja de ruta** asociada a esa guía.
- Mostrarla como dato visible en el panel de tránsitos o como campo adicional junto al botón de trazabilidad.

### MEJORA 7: Detalle Incidencia en Export
La columna "Detalle Incidencia" (índice 19 del Sheet principal) actualmente NO se incluye en la exportación CSV. **Agregarla** para que esté disponible cuando exportan desde cualquier vista o filtro.

### MEJORA 8: Observaciones históricas (integración completa con Sheet 3)
Integrar el sistema de observaciones históricas usando el Sheet 3 y `gas-observaciones-historicas.js`:

**8a. Backend (GAS):**
- Verificar/completar `gas-observaciones-historicas.js` con doGet (leer historial) y doPost (agregar observación).

**8b. Frontend (HTML):**
- Agregar constante: `const OBS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzEnNcBQ0vPrGxrwr8vuTUVEzIlh-MAPt41Ej0DZerqW5bEBfgZ3EIW9Zj2e8UfPWfZ/exec';`
- Función `saveObservacion(barraId, estado, obs, equipo)` — POST al Sheet de observaciones (adicional a saveGestionToSheet, no lo reemplaza).
- Función `loadHistorial(barraId)` — GET historial de una guía.

**8c. Modal de gestión:**
- Al gestionar una guía, abrir un MODAL (no prompt/alert) que muestre:
  - **Historial completo** de observaciones anteriores (cargado con loadHistorial). Cada entrada: fecha, usuario, equipo (badge color), estado, observación.
  - **Formulario** para nueva observación: select de equipo OBLIGATORIO [Customer Service | Operaciones] + textarea + botón guardar.
- Al guardar: ejecutar todo lo existente (localStorage + saveGestionToSheet) + ADEMÁS saveObservacion al Sheet de observaciones.

**8d. Botón historial en tabla:**
- Botón circular "📜" (`fa-clock-rotate-left`, color `#0c4a6e`) en cada fila, junto a los botones existentes.
- Al clic: abre modal con historial completo (solo lectura, sin formulario de nueva gestión).

### MEJORA 9: Reporte de gestión diario con envío por mail
Reporte que se genera 2 veces al día (mañana y tarde) para comparar cómo empezó y cómo terminó la jornada.

**9a. Estructura del reporte:**
```
============================================================
  REPORTE DE GESTIÓN - Andesmar Cargas
  [LOGO ANDESMAR]
  Fecha: 09/04/2026 - Turno: Mañana / Tarde
============================================================

RESUMEN GENERAL
                      Sin gestión | Gestionados | Derivados
Pendientes               5.000         850          45
Vencidos                  3.000         500          30
Total Operaciones         2.000         400          25

POR SUCURSAL (Operaciones)
                      Sin gestión | Gestionados | Derivados
CND Buenos Aires            89          30           5
CND Mendoza                120          45           8
CND Córdoba                 67          22           3
CND San Juan                45          15           2
CND San Luis                38          12           1
CND Neuquén                 30          10           1

CUSTOMER SERVICE
                      Sin gestión | Gestionados | Derivados
Yemina                     300          85          12
Mauricio                   280          72          10
Genaro                     250          65           8
Francisco                  220          58           7
Grupo Corporativos         150          40           5
Grupo Eventuales           130          35           4

DETALLE DE GESTIONES REALIZADAS HOY
[Link o listado de todas las gestiones del día]
============================================================
```

**9b. Envío por mail usando Google Apps Script:**
- El dashboard genera los datos del reporte y los envía por POST al GAS.
- El GAS usa `MailApp.sendEmail()` para enviar el mail.
- **Remitente:** calidad@andesmarcargas.com (cuenta Google Workspace de Andesmar)
- **Destinatario:** calidad@andesmarcargas.com (luego ellos redireccionan internamente)
- **Asunto:** `Reporte de Gestión - Andesmar Cargas - [Fecha] - Turno [Mañana/Tarde]`
- **Cuerpo:** El reporte formateado en HTML con logo de Andesmar, tablas estilizadas, y link o adjunto con el detalle de gestiones realizadas.
- Botón en el dashboard: "📧 Enviar Reporte" que pida seleccionar turno (Mañana/Tarde) y envíe.
- Mostrar toast de confirmación: "Reporte enviado con éxito" o error.

**9c. Código GAS necesario (endpoint nuevo o agregar al existente):**
```javascript
function doPost(e) {
  // ... acciones existentes ...
  
  if (payload.action === 'enviarReporte') {
    MailApp.sendEmail({
      to: 'calidad@andesmarcargas.com',
      subject: payload.asunto,
      htmlBody: payload.htmlBody,
      name: 'Dashboard Andesmar Cargas'
    });
    return ok;
  }
}
```

---

## REGLAS TÉCNICAS

1. **Identificador único:** Código de Barra (`barraId`, índice 9)
2. **Null safety:** Usar `safeStr(val)` que ya existe en el proyecto
3. **Notificaciones:** Usar `showToast(msg, type)` que ya existe
4. **POST al Web App:** Siempre con `mode: 'no-cors'`
5. **Funciona desde `file://`** — sin servidor local
6. **Paleta de diseño:** Azul Petróleo `#0c4a6e`, Grises Slate `#f1f5f9` `#e2e8f0`, Logo Andesmar 65px
7. **FontAwesome 6.5.1** ya cargado por CDN
8. **Fuente Inter** ya cargada por Google Fonts
9. **Variables existentes:** `safeStr()`, `showToast()`, `loadGestionState()`, `parseDate()`, `parseMoneda()`, `currentUser`, `gestionState`, `sesionLog`, `allData`, `filteredData`, `WEBAPP_URL`, `GCOL`, `COL`

## ENTREGABLES

1. **Modificaciones en `tablero_derivacion.html`** — indicando exactamente dónde van los cambios (después de qué función/línea)
2. **Código actualizado de `gas-observaciones-historicas.js`** si necesita ajustes
3. **Código GAS nuevo para leer usuarios** del Sheet 4 (puede ser un endpoint nuevo en el GAS principal o un script separado)
4. **Código GAS para envío de mail** del reporte (agregar al GAS principal o script separado)
5. **Listado completo de usernames/passwords** para cargar en el Sheet de usuarios
6. **CSS nuevo** para modal de historial y reporte
7. **HTML nuevo** si hace falta (div de modal, etc.)

NO entregues el HTML completo de 2400 líneas — solo los bloques nuevos/modificados con instrucciones claras de ubicación.

---
## ACTUALIZACIÓN DE REQUERIMIENTOS - 20/04/2026

### 1. RESTRUCTURACIÓN DE REPORTE DE GESTIÓN (Andesmar Cargas)
- **Cambio de Lógica:** En las tablas "POR SUCURSAL" y "CUSTOMER SERVICE", los valores mostrados deben corresponder exclusivamente a lo **VENCIDO** y no a lo pendiente.
- **Métricas a cruzar:** Filtrar el universo de datos por `vencido = true` antes de realizar el conteo por Sucursal (CND) y por Ejecutivo (Yemina, Mauricio, Genaro, etc.).
- **Visualización:** Mantener las columnas: Sin gestión | Gestionados | Derivados.

### 2. AJUSTES DE INTERFAZ Y ACCESIBILIDAD
- **Contraste:** En `tablero_derivacion.html`, siempre que un fondo sea azul, forzar el color de fuente a blanco (#FFFFFF). Esto aplica específicamente a los labels/datos de: *vencido, cantidad de días y datos de tránsito*.

### 3. SISTEMA DE FILTROS (RE-IMPLEMENTACIÓN)
- **HTML (`tablero_derivacion.html`):** - Insertar obligatoriamente selectores con IDs: `f_estado_estatico` y `f_accion_call`.
    - Opciones para Acción Call: Sin acción call, Adicionar datos, Devolver al remitente, Indicar nueva fecha de entrega, Reclamo.
- **JS (`gas-datos-principal.js`):** - Vincular estos IDs a la lógica de filtrado acumulativo.
    - **IMPORTANTE:** El cuadro "Devolver al Remitente" debe usar un filtro ESTRICTO sobre el campo real. 
    - **Filtro exacto:** `item['acciones call'] === 'Devolver al remitente'`. 
    - No debe traer otros tipos de registros que no coincidan exactamente con ese string.

### 4. SINCRONIZACIÓN: RIESGO DE SINIESTRO
- **Corrección:** El conteo del cuadro debe ser idéntico al listado.
- **Acción:** Unificar la lógica de conteo y la de filtrado `onClick` en `gas-datos-principal.js`. 
- **Regla:** Ambos deben apuntar a la misma función de filtrado para asegurar que si el cuadro muestra "X", el listado despliegue "X" registros.

### 5. UI & ACCESIBILIDAD (Contrast Fix)
- **Regla Fondo Azul:** IF `background-color: blue` OR `.bg-blue` THEN `color: #FFFFFF !important`. (Aplica a Vencidos, Días, Tránsito).
- **Nuevo Fix (Fondo Claro):** IF fondo es claro (como el cuadro de Novedad PND) AND el texto actual es blanco (`color: white` o `#FFFFFF`) THEN forzar texto oscuro (`color: #333333 !important`).
    - **Ubicación:** Buscar los estilos de los labels dentro de `.box-novedad-pnd` (o la clase que corresponda a ese cuadro).
    - **Objetivo:** Forzar texto oscuro en los labels: `Observacion:`, `Detalle:`, y sus valores.