/**
 * ui.js — Consumo da Vida
 * Tema, navegação, modal QDP e funções de UI compartilhadas.
 */

/* ── Tema ───────────────────────────────────────────────── */
const savedTheme = localStorage.getItem('cdv-theme');
const THEMES = ['dark', 'light', 'cooperative'];
let currentTheme = THEMES.includes(savedTheme) ? savedTheme : 'dark';
// Mantém compatibilidade com os gráficos existentes: dark=true só no tema escuro.
let isDark = currentTheme === 'dark';

const THEME_ICONS = {
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.3 8.3 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>',
  cooperative: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12c-3-3-2.6-6.5.8-8.8C15.7 6.1 15.4 9.1 12 12Z"/><path d="M12 12c3-3 6.5-2.6 8.8.8-2.9 2.9-5.9 2.6-8.8-.8Z"/><path d="M12 12c3 3 2.6 6.5-.8 8.8-2.9-2.9-2.6-5.9.8-8.8Z"/><path d="M12 12c-3 3-6.5 2.6-8.8-.8 2.9-2.9 5.9-2.6 8.8.8Z"/><circle cx="12" cy="12" r="1.4"/></svg>',
};

const THEME_LABELS = {
  dark: 'escuro',
  light: 'claro',
  cooperative: 'cooperativo',
};

function refreshThemeDependents() {
  if (typeof chartInstance !== 'undefined' && chartInstance) renderChart(_lastH, _lastD, _lastP);
  if (typeof planChartInstance !== 'undefined' && planChartInstance && _lastPlanPerc > 0) {
    const p = Math.min(_lastPlanPerc, 100);
    renderPlanChart(p, Math.max(0, 100 - p), _lastPlanPerc > 100);
  }
  const simPage = document.getElementById('page-sim');
  if (simPage && simPage.classList.contains('active')) renderSim();
}

function applyTheme() {
  isDark = currentTheme === 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const btn = document.getElementById('themeBtn');
  if (btn) {
    const nextTheme = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
    btn.innerHTML = THEME_ICONS[currentTheme];
    btn.setAttribute('aria-label', `Tema atual: ${THEME_LABELS[currentTheme]}. Alternar para o tema ${THEME_LABELS[nextTheme]}`);
    btn.setAttribute('title', `Tema atual: ${THEME_LABELS[currentTheme]}. Próximo: ${THEME_LABELS[nextTheme]}`);
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const metaColors = { dark: '#020914', light: '#edf5fa', cooperative: '#3FA110' };
    themeMeta.setAttribute('content', metaColors[currentTheme]);
  }
}

function toggleTheme() {
  const index = THEMES.indexOf(currentTheme);
  currentTheme = THEMES[(index + 1) % THEMES.length];
  localStorage.setItem('cdv-theme', currentTheme);
  applyTheme();
  refreshThemeDependents();
}

applyTheme();

/* ── Navegação SPA ──────────────────────────────────────── */
function navTo(page) {
  const navLinks = document.getElementById('navLinks');
  const navToggle = document.querySelector('.nav-toggle');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + page);
  pg.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.nav === page)
  );
  if (navLinks) navLinks.classList.remove('open');
  if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
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
  const navLinks = document.getElementById('navLinks');
  const navToggle = document.querySelector('.nav-toggle');
  if (!navLinks) return;

  const isOpen = navLinks.classList.toggle('open');
  if (navToggle) navToggle.setAttribute('aria-expanded', String(isOpen));
}

// Fecha o menu mobile ao tocar fora dele ou ao pressionar ESC.
document.addEventListener('click', (event) => {
  const navLinks = document.getElementById('navLinks');
  const navToggle = document.querySelector('.nav-toggle');
  if (!navLinks || !navLinks.classList.contains('open')) return;

  const clickedInsideMenu = navLinks.contains(event.target);
  const clickedToggle = navToggle && navToggle.contains(event.target);

  if (!clickedInsideMenu && !clickedToggle) {
    navLinks.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const navLinks = document.getElementById('navLinks');
  const navToggle = document.querySelector('.nav-toggle');
  if (navLinks) navLinks.classList.remove('open');
  if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
});

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
