/**
 * ui.js — Consumo da Vida
 * Tema, navegação, modal QDP e funções de UI compartilhadas.
 */

/* ── Tema ───────────────────────────────────────────────── */
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('cdv-theme');
// A identidade principal é escura; o modo claro continua disponível pelo botão.
let isDark = savedTheme ? savedTheme === 'dark' : true;

const THEME_ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.3 8.3 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>',
};

function applyTheme() {
  const theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.innerHTML = isDark ? THEME_ICONS.sun : THEME_ICONS.moon;
    btn.setAttribute('aria-label', isDark ? 'Alternar para o tema claro' : 'Alternar para o tema escuro');
    btn.setAttribute('title', isDark ? 'Usar tema claro' : 'Usar tema escuro');
  }
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', isDark ? '#020914' : '#edf5fa');
}

function toggleTheme() {
  isDark = !isDark;
  localStorage.setItem('cdv-theme', isDark ? 'dark' : 'light');
  applyTheme();
  if (chartInstance)     renderChart(_lastH, _lastD, _lastP);
  if (planChartInstance && _lastPlanPerc > 0) {
    const p = Math.min(_lastPlanPerc, 100);
    renderPlanChart(p, Math.max(0, 100 - p), _lastPlanPerc > 100);
  }
  if (document.getElementById('page-sim').classList.contains('active')) renderSim();
}

applyTheme();

/* ── Navegação SPA ──────────────────────────────────────── */
function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  pg.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.nav === page)
  );
  document.getElementById('navLinks').classList.remove('open');
  localStorage.setItem('cdv-page', page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // WCAG SC 2.4.3: mover foco para o heading ao navegar
  requestAnimationFrame(() => {
    const h = pg.querySelector('h1, [role=heading]');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });
  if (page === 'sim' && !simInitialized) initSim();
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

/* ── Modal QDP ──────────────────────────────────────────── */
function openModal(nome, horas, vp, quote) {
  document.getElementById('modal-sub').textContent =
    `${nome}, você está prestes a trocar ${horas} horas da sua vida por um produto de R$ ${vp}. Reflita sobre três perguntas essenciais.`;
  document.getElementById('qdp-p').textContent =
    `Você pode, de forma consciente e tranquila, trocar ${horas} horas da sua vida por este produto agora?`;
  document.getElementById('modal-quote').textContent = `"${quote}"`;
  document.getElementById('qdpOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.querySelector('.modal-close').focus();
}

function closeModal() {
  document.getElementById('qdpOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Share / clipboard ──────────────────────────────────── */
let _shareText = '';

function share() {
  navigator.clipboard.writeText(_shareText)
    .then(() => {
      const el = document.getElementById('copy-ok');
      el.style.display = 'flex';
      setTimeout(() => { el.style.display = 'none'; }, 3000);
    })
    .catch(() => alert(_shareText));
}

/* ── Histórico (renderização) ────────────────────────────── */
function renderHistory() {
  const h    = loadHistory();
  const card = document.getElementById('history-card');
  if (!h.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('history-list').innerHTML = h.map((item, i) => `
    <div class="hist-item">
      <div>
        <div class="hist-main">R$ ${item.produto}</div>
        <div class="hist-sub">${item.horas}h · ${item.dias} dias · ${item.perc}% · ${item.data}</div>
      </div>
      <button class="hist-del" onclick="deleteHistItem(${i})" aria-label="Remover item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>`).join('');
}
