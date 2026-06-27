/**
 * api.js — Consumo da Vida
 * Camada de comunicação com a API do Banco Central do Brasil.
 *
 * Estratégia de tolerância a falhas (3 camadas):
 *   1. API ao vivo (BCB SGS série 432 — Meta da Selic)
 *   2. Cache local (localStorage, última busca bem-sucedida)
 *   3. Fallback hardcoded (SELIC_FALLBACK = 14,5%)
 *
 * Race condition evitada via AbortController: novo fetch cancela o anterior.
 * Timeout de 8 segundos para não travar a UX.
 */

/** Referência para o AbortController ativo (evita fetches sobrepostos). */
let _fetchCtrl = null;

/** URL da API Selic do Banco Central. */
const BCB_SELIC_URL =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';

/**
 * Busca a taxa Selic ao vivo no Banco Central.
 * Em caso de falha: usa cache ou fallback, exibe aviso discreto.
 */
async function fetchSelic() {
  // Cancela fetch anterior (race condition)
  if (_fetchCtrl) { _fetchCtrl.abort(); }
  _fetchCtrl = new AbortController();
  const { signal } = _fetchCtrl;

  const statusEl = document.getElementById('selicStatus');
  const btnEl    = document.getElementById('selicRefresh');

  statusEl.className   = 'selic-status loading';
  statusEl.textContent = 'Buscando no Banco Central…';
  btnEl.classList.add('spin');

  // Timeout de segurança (8s)
  const timeoutId = setTimeout(() => { try { _fetchCtrl.abort(); } catch {} }, 8000);

  try {
    const resp = await fetch(BCB_SELIC_URL, { signal, cache: 'no-store' });
    clearTimeout(timeoutId);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    const last = Array.isArray(json) && json.length ? json[json.length - 1] : null;
    if (!last) throw new Error('Resposta vazia');

    const v = Number(String(last.valor || '').replace(',', '.'));
    if (!isFinite(v) || v <= 0) throw new Error('Valor inválido: ' + last.valor);

    // Sucesso — atualiza cache e estado do simulador
    saveSelicCache(v, last.data || '');
    _applySelicValue(v);

    statusEl.className   = 'selic-status ok';
    statusEl.textContent = 'Selic atualizada' + (last.data ? ' · ' + last.data : '');

  } catch (err) {
    clearTimeout(timeoutId);

    // AbortError por chamada sobreposta — ignorar silenciosamente
    if (err.name === 'AbortError') { btnEl.classList.remove('spin'); return; }

    // Camada 2: tentar cache local
    const cached = loadSelicCache();
    if (cached) {
      _applySelicValue(cached.value);
      const ref = cached.date ? ` (ref. ${cached.date})` : '';
      statusEl.className   = 'selic-status warn';
      statusEl.textContent = `API indisponível — último dado salvo: ${cached.value}%${ref}`;
    } else {
      // Camada 3: fallback hardcoded — simulador continua funcionando
      statusEl.className   = 'selic-status error';
      statusEl.textContent = `API indisponível — usando ${simState.selic}% (padrão). Edite se necessário.`;
    }
  } finally {
    btnEl.classList.remove('spin');
    _fetchCtrl = null;
  }
}

/**
 * Aplica um novo valor de Selic ao estado do simulador
 * sem sobrescrever o input enquanto o usuário está digitando.
 * @param {number} v - Valor da Selic em % a.a.
 */
function _applySelicValue(v) {
  simState.selic = v;
  const inp = document.getElementById('selicInput');
  if (inp && !inp.matches(':focus')) inp.value = String(v);
  syncDerivedRates();
  renderSim();
}

/**
 * Fallback de logo: substitui <img> quebrada por ponto colorido.
 * Chamada via atributo onerror das tags <img> de logo de banco.
 * @param {HTMLImageElement} img
 * @param {string} color - Cor CSS (ex: '#820AD1')
 */
function simLogoFail(img, color) {
  try {
    const dot = document.createElement('span');
    dot.className = 'opt-dot';
    dot.style.background = color;
    img.parentNode.replaceChild(dot, img);
  } catch (_) {}
}
