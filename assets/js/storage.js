/**
 * storage.js — Consumo da Vida
 * Camada de acesso ao localStorage: cache da Selic, bancos
 * personalizados e histórico da calculadora.
 * Todas as funções são tolerantes a falhas (try/catch).
 */

const SELIC_CACHE_KEY  = 'cdv-selic-v2';
const CUSTOM_OPTS_KEY  = 'cdv-custom-opts-v2';
const HISTORY_KEY      = 'cdv-hist';

/* ── Cache da taxa Selic ─────────────────────────────────── */

/** Carrega o último valor da Selic do cache local. Retorna null se inexistente. */
function loadSelicCache() {
  try {
    const c = JSON.parse(localStorage.getItem(SELIC_CACHE_KEY) || 'null');
    return (c && isFinite(c.value) && c.value > 0) ? c : null;
  } catch { return null; }
}

/** Persiste o valor da Selic no cache local. */
function saveSelicCache(value, date) {
  try {
    localStorage.setItem(SELIC_CACHE_KEY, JSON.stringify({ value, date: date || '', savedAt: Date.now() }));
  } catch { /* quota exceeded — ignorar silenciosamente */ }
}

/* ── Bancos personalizados ──────────────────────────────── */

/** Carrega bancos personalizados do localStorage com validação básica. */
function loadCustomOpts() {
  try {
    const arr = JSON.parse(localStorage.getItem(CUSTOM_OPTS_KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(o => o && typeof o.id === 'string' && typeof o.name === 'string' && isFinite(o.rate));
  } catch { return []; }
}

/** Persiste apenas os bancos customizados do simState no localStorage. */
function saveCustomOpts() {
  try {
    const custom = simState.options.filter(o => o.custom);
    localStorage.setItem(CUSTOM_OPTS_KEY, JSON.stringify(custom));
  } catch { }
}

/* ── Histórico da Calculadora de Vida ───────────────────── */

/** Insere item no início do histórico (máx 10 itens). */
function saveHistory(item) {
  const h = loadHistory();
  h.unshift(item);
  if (h.length > 10) h.pop();
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { }
}

/** Retorna array do histórico (array vazio se inexistente). */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

/** Remove um item do histórico pelo índice. */
function deleteHistItem(i) {
  const h = loadHistory();
  h.splice(i, 1);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { }
  renderHistory();
}

/** Remove todo o histórico. */
function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { }
  renderHistory();
}
