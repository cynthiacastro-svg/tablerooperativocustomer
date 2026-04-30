// ═══════════════════════════════════════════════════════
//  ANDESMAR — Content Script para tms.driv.in
//  Detecta código pendiente y auto-llena el campo de búsqueda
// ═══════════════════════════════════════════════════════

const PENDING_KEY  = 'andesmar_driv_pending';
const DRIV_URL     = 'https://tms.driv.in/app/dashboards/historic';

// Selector del campo "CONSULTAR SEGUIMIENTO" en driv.in/dashboards/historic
// Es el único input de la página + botón "BUSCAR"
const SEARCH_SELECTORS = [
  'input[type="text"]',
  'input[type="search"]',
  'input:not([type="hidden"])',
];

// ─── Escuchar mensajes del popup ─────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'scan')   { sendResponse(scanPage()); return true; }
  if (msg.action === 'search') { doSearch(msg.code); sendResponse({ ok: true }); return true; }
  if (msg.action === 'ping')   { sendResponse({ ready: true, url: location.href }); return true; }
});

// ─── Al cargar la página, ver si hay código pendiente ────
window.addEventListener('load', () => {
  setTimeout(tryPendingSearch, 1500); // esperar que cargue el SPA
});

// También intentar cuando cambia el DOM (navegación SPA)
const observer = new MutationObserver(() => {
  if (location.href.includes('historic') || location.href.includes('seguimiento')) {
    tryPendingSearch();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

function tryPendingSearch() {
  const pending = localStorage.getItem(PENDING_KEY);
  if (!pending) return;

  try {
    const { code, ts } = JSON.parse(pending);
    // Solo usar si tiene menos de 30 segundos
    if (Date.now() - ts > 30000) {
      localStorage.removeItem(PENDING_KEY);
      return;
    }
    const done = doSearch(code);
    if (done) {
      localStorage.removeItem(PENDING_KEY);
      // Notificar visualmente
      showBanner(`🔍 Buscando: ${code}`);
    }
  } catch(e) {
    localStorage.removeItem(PENDING_KEY);
  }
}

// ─── Buscar el campo e inyectar el código ────────────────
function doSearch(code) {
  let input = null;

  // Intentar cada selector
  for (const sel of SEARCH_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) { // visible
      input = el;
      break;
    }
  }

  // Si no encontramos con selectores, buscar por label/placeholder
  if (!input) {
    const allInputs = [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null);
    input = allInputs.find(i =>
      /código|codigo|dirección|direccion|orden|order|buscar|search|filter/i.test(
        (i.placeholder || '') + (i.name || '') + (i.id || '') +
        (i.getAttribute('aria-label') || '')
      )
    ) || allInputs[0]; // último recurso: primer input visible
  }

  if (!input) return false;

  // Llenar el campo — compatible con frameworks SPA (React/Angular)
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeSetter.call(input, code);
  input.dispatchEvent(new Event('input',  { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();

  // Clickear el botón "BUSCAR" (texto exacto de la página)
  setTimeout(() => {
    const btn =
      [...document.querySelectorAll('button')].find(b =>
        b.textContent.trim().toUpperCase() === 'BUSCAR'
      ) ||
      document.querySelector('button[type="submit"]');
    if (btn) btn.click();
  }, 200);

  return true;
}

// ─── Banner visual en la página ──────────────────────────
function showBanner(text) {
  const existing = document.getElementById('andesmar-banner');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'andesmar-banner';
  div.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 99999;
    background: #1a3a5c; color: white; padding: 10px 16px;
    border-radius: 8px; font-family: Segoe UI, sans-serif;
    font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: fadein 0.3s ease;
  `;
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ─── Escanear tablas (mantener para export si hace falta) ─
function scanPage() {
  const tables = [...document.querySelectorAll('table')];
  const found  = [];
  const KEY_COLS = ['código de dirección','codigo de direccion','cod. dirección','cod direccion'];
  const findKey  = hs => hs.findIndex(h => KEY_COLS.some(k =>
    h.toLowerCase().replace(/\s+/g,' ').trim() === k));

  tables.forEach((table, idx) => {
    const rows = [...table.querySelectorAll('tr')];
    if (rows.length < 2) return;
    const headers = [...rows[0].querySelectorAll('th,td')]
      .map(el => el.textContent.trim()).filter(Boolean);
    if (!headers.length) return;
    const ki = findKey(headers);
    found.push({ index: idx, headers, rowCount: rows.length-1,
      preview: headers.slice(0,5).join(' | '),
      hasKey: ki >= 0, keyCol: ki >= 0 ? headers[ki] : null });
  });

  return { tables: found, url: location.href, title: document.title };
}
