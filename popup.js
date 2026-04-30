// ═══════════════════════════════════════════════════════
//  ANDESMAR — Popup Script
// ═══════════════════════════════════════════════════════

let currentTab = null;
const DRIV_URL = 'https://tms.driv.in/app/dashboards/historic';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const url    = tab.url || '';
  const isDriv = url.includes('tms.driv.in');

  document.getElementById('pageUrl').textContent =
    url.length > 55 ? url.slice(0,55)+'...' : url;
  document.getElementById('pageInfo').textContent = isDriv
    ? '✔ Estás en driv.in'
    : '⚠ No estás en driv.in';

  if (!isDriv) {
    showMsg('Abrí driv.in e iniciá sesión. El tablero se conectará automáticamente.', 'warn');
  }
});

function openDriv() {
  chrome.tabs.create({ url: DRIV_URL });
  window.close();
}
