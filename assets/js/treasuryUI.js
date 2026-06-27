/**
 * treasuryUI.js — Consumo da Vida
 * Atualiza a interface com o status e dados do Tesouro Direto.
 * Renderiza indicadores de fonte, data de atualização e avisos
 * quando os dados vêm do cache ou fallback.
 */

/* ── Estado da UI do Tesouro ─────────────────────────────── */
let _treasuryUIState = {
  status:    'idle',     // 'idle' | 'loading' | 'ok' | 'cache' | 'error'
  source:    null,       // 'api' | 'cache' | 'fallback'
  fetchedAt: null,       // ISO timestamp
  message:   '',
};

/**
 * Renderiza o indicador de status do Tesouro Direto no DOM.
 * Inserido dinamicamente na área do opt-list pelo renderOptList().
 */
function renderTreasuryStatus() {
  const el = document.getElementById('treasuryStatusLine');
  if (!el) return;

  const { status, source, fetchedAt, message } = _treasuryUIState;
  let text = '', cls = '';

  switch (status) {
    case 'loading':
      cls  = 'treasury-status loading';
      text = '↻ Buscando dados no Tesouro Direto…';
      break;

    case 'ok':
      cls  = 'treasury-status ok';
      text = `✓ Dados atualizados · ${formatTreasuryCacheDate(fetchedAt)}`;
      break;

    case 'cache': {
      const dateStr = fetchedAt ? formatTreasuryCacheDate(fetchedAt) : '—';
      cls  = 'treasury-status warn';
      text = `⚠ API indisponível — exibindo último dado salvo (${dateStr})`;
      break;
    }

    case 'error':
      cls  = 'treasury-status error';
      text = `⚠ ${message || 'Usando taxas de referência (jun/2026). Clique em atualizar.'}`;
      break;

    default:
      cls  = 'treasury-status idle';
      text = '○ Clique em ↻ para buscar taxas atualizadas do Tesouro Direto.';
  }

  el.className = cls;
  el.textContent = text;
}

/**
 * Define o estado de carregamento e atualiza a UI.
 */
function setTreasuryLoading() {
  _treasuryUIState = { status: 'loading', source: null, fetchedAt: null, message: '' };
  renderTreasuryStatus();

  // Animação de spin no botão de atualizar Tesouro
  const btn = document.getElementById('treasuryRefreshBtn');
  if (btn) btn.classList.add('spin');
}

/**
 * Atualiza a UI com sucesso (dados da API ou cache válido).
 * @param {string} source    - 'api' | 'cache' | 'fallback'
 * @param {string} fetchedAt - ISO timestamp
 */
function setTreasurySuccess(source, fetchedAt) {
  _treasuryUIState = {
    status:    source === 'cache' ? 'cache' : 'ok',
    source,
    fetchedAt,
    message:   '',
  };
  renderTreasuryStatus();

  const btn = document.getElementById('treasuryRefreshBtn');
  if (btn) btn.classList.remove('spin');
}

/**
 * Atualiza a UI com erro (fallback hardcoded em uso).
 * @param {string} message - Mensagem de erro
 */
function setTreasuryError(message) {
  _treasuryUIState = {
    status:    'error',
    source:    'fallback',
    fetchedAt: null,
    message,
  };
  renderTreasuryStatus();

  const btn = document.getElementById('treasuryRefreshBtn');
  if (btn) btn.classList.remove('spin');
}

/**
 * Constrói o HTML do separador do Tesouro Direto para o opt-list.
 * Inclui botão de refresh e linha de status.
 * @returns {string} HTML
 */
function buildTreasurySeparatorHTML() {
  return `
    <div class="opt-separator treasury-separator">
      <span>Tesouro Direto</span>
      <button class="btn-refresh" id="treasuryRefreshBtn"
        onclick="refreshTreasuryData()"
        title="Atualizar taxas do Tesouro Direto"
        aria-label="Atualizar taxas do Tesouro Direto">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
        </svg>
      </button>
    </div>
    <div class="treasury-status-line idle" id="treasuryStatusLine"
      aria-live="polite" aria-atomic="true">
      ○ Clique em ↻ para buscar taxas atualizadas do Tesouro Direto.
    </div>`;
}

/**
 * Gatilho público: atualiza dados do Tesouro ao clicar no botão.
 * Integrado ao fluxo principal do simulator.js.
 */
async function refreshTreasuryData() {
  setTreasuryLoading();

  await fetchTreasuryBonds(
    // onLoading (já chamado acima)
    null,

    // onSuccess
    (bonds, source, fetchedAt) => {
      applyTreasuryBondsToSimState(bonds, simState.selic, simState.assumedIPCA);
      setTreasurySuccess(source, fetchedAt);
      renderOptList();
      renderSim();
    },

    // onError (fallback em uso)
    (message) => {
      setTreasuryError(message);
      renderOptList();
    }
  );
}
