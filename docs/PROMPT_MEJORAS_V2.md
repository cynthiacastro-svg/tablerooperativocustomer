# PROMPT DE MEJORAS — Tablero de Derivación Andesmar

## CONTEXTO

Este es un dashboard HTML single-file (`tablero_derivacion.html`) para gestión logística de pedidos. Se conecta a Google Sheets vía Web App (Apps Script). Ya funciona: carga de datos, filtros, derivación, gestiones, tránsitos, observaciones históricas, export CSV, login con roles, ordenamiento de columnas, tarjetas resumen, etc.

**NO TOCAR** nada que ya funcione. Solo aplicar las 7 correcciones/mejoras que se detallan abajo. Leer el README.md y el código completo antes de empezar.

---

## CONTEXTO TÉCNICO CLAVE

### Arquitectura de datos
- **Sheet principal** → `WEBAPP_URL` (GET devuelve array de arrays, POST actualiza gestión)
- **Sheet observaciones** → `OBS_WEBAPP_URL` (GET historial por barraId, POST agrega observación)
- **Sheet usuarios** → Existe un Sheet/Web App para CRUD de usuarios
- **Sheet tránsitos** → `transitMap` cargado desde Google Sheets separado
- **Identificador único:** Código de Barra (columna J, índice 9) = `barraId`

### Mapeo de columnas relevantes (índice base 0)
| Índice | Campo |
|--------|-------|
| 0 | Estado Movimiento |
| 1 | **Acciones Call** |
| 9 | Código de Barra (ID único) |
| 26 | Ejecutivo Seguimiento |
| 60 | Obs Tipificada |
| 86 | Estado Gestión |
| 87 | Observación Gestión |
| 88 | Fecha Gestión |
| 89 | Usuario Gestión |

### Variables globales existentes
```javascript
allData, filteredData, currentPage, transitMap, gestionState, 
activeCNDFilter, currentSort, sesionLog, currentUser,
WEBAPP_URL, OBS_WEBAPP_URL, STORAGE_KEY, GCOL, COL
```

### Funciones clave existentes
```javascript
loadFromSheet(), processSheetRows(), applyFilters(), renderTable(),
buildSummary(), saveGestionToSheet(), promptGestion(), 
updateResumenJornada(), showToast(), safeStr(), parseDate(),
loadGoogleSheets(), loadDrivPanel(), saveObservacion(), loadHistorial()
```

---

## MEJORA 1: FILTRO POR "ACCIONES CALL" NO MUESTRA TODOS LOS REGISTROS

### Problema
Cuando filtro por "Acciones Call" en la página, no se ven todos los registros que tienen ese valor. Sin embargo, al exportar CSV sí aparecen todos. Esto indica que el filtro en `applyFilters()` no está matcheando correctamente contra el campo `Acciones Call` (columna índice 1).

### Causa probable
- El dropdown de filtro de Acciones Call se está poblando con valores truncados, normalizados, o con diferencias de espacios/capitalización respecto al valor real en `d.row[COL.ACCIONES_CALL]`.
- O bien el filtro está comparando con `===` contra un valor que no coincide exactamente (espacios extra, saltos de línea, diferencia mayúsculas/minúsculas).
- Puede que `safeStr()` no se esté aplicando consistentemente tanto al poblar el dropdown como al filtrar.

### Solución requerida
1. Revisar cómo se puebla el `<select>` de Acciones Call (función que genera las opciones del dropdown). Asegurar que usa `safeStr(d.row[COL.ACCIONES_CALL]).trim()` para cada valor.
2. Revisar en `applyFilters()` cómo compara el filtro de Acciones Call. Debe usar la misma normalización: `safeStr(d.row[COL.ACCIONES_CALL]).trim()`.
3. Logear en consola: `console.log('[Filtro AccCall] Valor dropdown:', valorFiltro, '| Valor dato:', safeStr(d.row[COL.ACCIONES_CALL]).trim(), '| Match:', match);` para los primeros 5 registros, así se puede debuggear.
4. Si el dropdown tiene valores como "" (vacío), filtrarlos del listado de opciones o ponerlos como "Sin Acciones Call".

---

## MEJORA 2: MULTI-SELECT EN TODOS LOS DESPLEGABLES DE FILTRO

### Problema
Actualmente cada filtro dropdown es un `<select>` simple (single-select). Se necesita poder seleccionar múltiples valores en TODOS los desplegables de filtro.

### Solución requerida
1. Reemplazar cada `<select>` de filtro por un componente multi-select custom (NO usar `<select multiple>` nativo, que es mala UX).
2. Implementar un dropdown con checkboxes: al hacer clic se despliega la lista de opciones con checkbox, el usuario tilda las que quiere, y al cerrar filtra por todas las seleccionadas (OR entre las seleccionadas).
3. Mostrar en el botón/campo cuántos valores hay seleccionados (ej: "Acciones Call (3)") o los nombres si son pocos.
4. Esto aplica a TODOS los filtros dropdown: Estado Movimiento, Acciones Call, Agencia Origen, Agencia Destino, Ejecutivo, Modalidad, Estado Gestión, etc.
5. En `applyFilters()`, donde antes se comparaba `valor === filtro`, ahora se compara `arrayFiltros.length === 0 || arrayFiltros.includes(valor)`.
6. Estilo visual: coherente con la paleta existente (azul petróleo `#0c4a6e`, bordes `#e2e8f0`, fondo blanco).

---

## MEJORA 3: BOTÓN "LIMPIAR FILTROS"

### Problema
No hay forma rápida de resetear todos los filtros a la vez.

### Solución requerida
1. Agregar un botón visible "🧹 Limpiar filtros" en la barra de filtros, junto al buscador o al final de los filtros.
2. Al hacer clic: resetear TODOS los dropdowns multi-select a "sin selección", limpiar el campo de búsqueda, limpiar `activeCNDFilter`, y ejecutar `applyFilters()`.
3. Estilo: botón outline azul petróleo, que se note pero no compita visualmente con los filtros.

---

## MEJORA 4: RESUMEN DE JORNADA — TOMAR OBSERVACIONES HISTÓRICAS DEL SHEET

### Problema
El resumen de jornada está tomando las observaciones del `localStorage` / `sesionLog` (solo sesión actual). Necesita mostrar TODAS las observaciones históricas de cada guía gestionada, trayéndolas del Sheet de observaciones vía `OBS_WEBAPP_URL`.

### Causa probable
`updateResumenJornada()` itera sobre `sesionLog[]` que solo contiene las gestiones de la sesión actual con la obs que escribió el usuario en ese momento. No hace fetch al Sheet de observaciones históricas.

### Solución requerida
1. En `updateResumenJornada()`, para cada entrada de `sesionLog`, hacer fetch a `OBS_WEBAPP_URL?action=getHistorial&barraId=XXXXX` para traer el historial completo de esa guía.
2. Mostrar en el resumen no solo la última obs de la sesión, sino el historial completo de observaciones de cada guía gestionada.
3. Usar `Promise.all()` o un loop async para no bloquear. Mostrar un loader mientras carga.
4. Cachear los resultados para no hacer fetch repetidos si el resumen se actualiza varias veces.

---

## MEJORA 5: USUARIOS — LA PANTALLA NO ESTÁ GRABANDO EN EL SHEET

### Problema
El panel de administración de usuarios carga correctamente los datos del Sheet de usuarios (lee OK), pero cuando se crea o edita un usuario desde la pantalla, NO se escribe/actualiza en el Sheet. Los datos solo quedan en memoria o localStorage.

### Solución requerida
1. Revisar la función que guarda usuarios. Identificar si hay un `fetch POST` al Web App de usuarios o si falta.
2. Si falta el POST: implementar `saveUsuarioToSheet(userData)` que haga POST al endpoint del Sheet de usuarios con `{ action: 'createUser' | 'updateUser', ...campos }`.
3. Si el POST existe pero falla silenciosamente (probablemente por `mode: 'no-cors'`): agregar feedback con `showToast()` y verificar que el Apps Script del Sheet de usuarios tenga el `doPost` correspondiente.
4. Verificar que el Apps Script del Sheet de usuarios tenga: `doPost(e)` que parsee el JSON y haga `sheet.appendRow()` o `sheet.getRange().setValues()` según sea crear o actualizar.
5. Si no existe el Apps Script de usuarios, crearlo con endpoints GET (listar) y POST (crear/actualizar/eliminar).

---

## MEJORA 6: FILTRO POR TRÁNSITO (SÍ/NO)

### Problema
Actualmente el sistema muestra una alerta/indicador (🚚) en cada pedido que tiene tránsito en `transitMap`, pero no existe un filtro para ver SOLO los pedidos con tránsito o SOLO los que NO tienen tránsito.

### Solución requerida
1. Agregar un nuevo filtro dropdown (o multi-select como los demás) con opciones: "Todos", "Con tránsito", "Sin tránsito".
2. En `applyFilters()`, agregar la condición: si filtro = "Con tránsito" → `d.transit` debe existir (truthy). Si filtro = "Sin tránsito" → `d.transit` debe ser falsy.
3. `d.transit` ya existe en cada registro de `allData` (se asigna en `processSheetRows` cruzando con `transitMap`). Solo falta el filtro en la UI y la condición en `applyFilters()`.
4. Ubicar este filtro junto a los demás filtros existentes.

---

## MEJORA 7: FILTRO "DEVOLVER AL REMITENTE" DESDE TARJETAS TRAE DATOS INCORRECTOS

### Problema URGENTE
Cuando hago clic en la tarjeta/recuadro "Devolver al Remitente", debería filtrar por `Acciones Call === "Devolver al Remitente"`. Pero está trayendo registros que no corresponden.

### Causa probable
El clic en la tarjeta probablemente está seteando un filtro por `derivacion.dest` (la derivación calculada) en lugar de filtrar directamente por el valor del campo `Acciones Call`. O está usando un filtro de búsqueda general (`search`) que matchea parcialmente con otros campos.

### Solución requerida
1. Identificar qué función se ejecuta al hacer clic en la tarjeta "Devolver al Remitente". Buscar el `onclick` de esa card.
2. Verificar si filtra por `derivacion.dest === 'DEVOLVER_REMITENTE'` (lógica de derivación) o por `d.row[COL.ACCIONES_CALL] === 'Devolver al Remitente'` (valor real del campo).
3. **El filtro de la tarjeta DEBE comparar contra `safeStr(d.row[COL.ACCIONES_CALL]).trim()`**, no contra la derivación calculada.
4. Si la tarjeta muestra un conteo, ese conteo también debe basarse en `Acciones Call === "Devolver al Remitente"` exacto.
5. Logear para debug: `console.log('[Tarjeta DevRemit] Filtrando por AccCall. Total allData:', allData.length, '| Matchean:', allData.filter(d => safeStr(d.row[COL.ACCIONES_CALL]).trim() === 'Devolver al Remitente').length);`

---

## REGLAS GENERALES

1. **No romper nada existente.** Cada mejora es quirúrgica.
2. **Usar `safeStr().trim()` siempre** que se compare strings de datos del Sheet.
3. **Mantener la paleta visual:** azul petróleo `#0c4a6e`, bordes `#e2e8f0`, fondo blanco, toast existente.
4. **Todo funciona desde `file://`** — los POST usan `mode: 'no-cors'`.
5. **Probar cada mejora por separado** antes de pasar a la siguiente.
6. **Logear en consola** cualquier comparación sospechosa para facilitar debug.
7. Leer el README.md completo y el código existente antes de hacer cambios.
