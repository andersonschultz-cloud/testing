/**
 * treasuryApi.js — Consumo da Vida
 * Comunicação com a API do Tesouro Direto (B3/Tesouro).
 *
 * Fonte primária: endpoint público do site tesourodireto.com.br (sem auth).
 * Tolerância a falhas em 3 camadas:
 *   1. API ao vivo  → sempre tentada primeiro
 *   2. Cache local  → último retorno válido (localStorage)
 *   3. Fallback     → taxas de referência hardcoded (jun/2026)
 *
 * Race condition evitada: AbortController cancela fetch anterior.
 * Timeout: 10 segundos.
 */

/** URL pública do Tesouro Direto — usada pelo próprio site da B3 */
const TREASURY_API_URL =
  'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondsv2.json';

/** AbortController ativo para evitar fetches sobrepostos */
let _treasuryCtrl = null;

/**
 * Taxas de referência (jun/2026) — usadas quando API e cache falham.
 * Fontes: brapi.dev (Tesouro Selic 2031 = 0.08% spread sobre Selic) e
 *         dados de mercado de jun/2026 para Prefixado e IPCA+.
 */
const TREASURY_FALLBACK_BONDS = [
  {
    id:           'selic31',
    name:         'Tesouro Selic 2031',
    indexer:      'SELIC',
    spread:       0.08,      // % a.a. acima da Selic (0.08 = 8 bps)
    rate:         null,
    realRate:     null,
    maturityDate: '2031-03-01',
    fetchedAt:    '2026-06-01T00:00:00.000Z',
  },
  {
    id:           'prefixado31',
    name:         'Tesouro Prefixado 2031',
    indexer:      'PRE',
    spread:       null,
    rate:         14.36,     // % a.a. (referência jun/2026)
    realRate:     null,
    maturityDate: '2031-01-01',
    fetchedAt:    '2026-06-01T00:00:00.000Z',
  },
  {
    id:           'ipcaplus35',
    name:         'Tesouro IPCA+ 2035',
    indexer:      'IPCA',
    spread:       null,
    rate:         null,
    realRate:     7.56,      // % real a.a. acima do IPCA (referência jun/2026)
    maturityDate: '2035-05-15',
    fetchedAt:    '2026-06-01T00:00:00.000Z',
  },
];

/* ── IDs que queremos mapear da API ──────────────────────── */
const TREASURY_BOND_MATCHERS = {
  SELIC: { id: 'selic31',     yearRange: [2030, 2033] },
  PRE:   { id: 'prefixado31', yearRange: [2029, 2033], coupon: false },
  IPCA:  { id: 'ipcaplus35',  yearRange: [2033, 2037], coupon: false },
};

/**
 * Busca títulos do Tesouro Direto na API oficial.
 * Retorna os títulos normalizados ou lança erro.
 *
 * @returns {Promise<import('./treasuryCache.js').TreasuryBondData[]>}
 */
async function _fetchFromAPI() {
  if (_treasuryCtrl) { _treasuryCtrl.abort(); }
  _treasuryCtrl = new AbortController();
  const { signal } = _treasuryCtrl;

  const timeout = setTimeout(() => { try { _treasuryCtrl.abort(); } catch {} }, 10000);

  try {
    const resp = await fetch(TREASURY_API_URL, { signal, cache: 'no-store' });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const json = await resp.json();
    return _parseAPIResponse(json);
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  } finally {
    _treasuryCtrl = null;
  }
}

/**
 * Normaliza a resposta da API B3 para o formato interno.
 * Filtra apenas os títulos sem juros semestrais mais adequados para simulação.
 *
 * @param {Object} json - Resposta bruta da API
 * @returns {import('./treasuryCache.js').TreasuryBondData[]}
 */
function _parseAPIResponse(json) {
  const group = json?.TrsrBdTradgList?.TrsrBdTradgGrp;
  if (!Array.isArray(group) || group.length === 0) {
    throw new Error('Formato de resposta inválido ou sem títulos disponíveis');
  }

  const now = new Date().toISOString();
  const bonds = [];

  for (const item of group) {
    const bd  = item?.TrsrBd;
    if (!bd) continue;

    const name      = bd.nm || '';
    const indexerNm = bd.FinIndxs?.nm || '';
    const hasCoupon = bd.semiAnulIntrstInd === true;
    const mtrtyDt   = bd.mtrtyDt ? new Date(bd.mtrtyDt) : null;
    const year      = mtrtyDt ? mtrtyDt.getFullYear() : 0;
    const rate      = Number(bd.anulInvstmtRate) || 0;

    // Ignorar títulos encerrados (sem taxa de compra)
    if (!bd.minInvstmtAmt && !bd.untrInvstmtVal) continue;

    // Mapear Selic: sem cupom, vencimento 2030-2033
    if (indexerNm === 'SELIC' && !hasCoupon && year >= 2030 && year <= 2033) {
      bonds.push({
        id:           'selic31',
        name,
        indexer:      'SELIC',
        spread:       rate,    // spread em % a.a. sobre Selic
        rate:         null,
        realRate:     null,
        maturityDate: mtrtyDt ? mtrtyDt.toISOString().split('T')[0] : '2031-03-01',
        fetchedAt:    now,
      });
    }

    // Mapear Prefixado simples (sem cupom semestral), vencimento 2029-2033
    if (indexerNm === 'PRE' && !hasCoupon && year >= 2029 && year <= 2033) {
      if (!bonds.find(b => b.id === 'prefixado31')) {
        bonds.push({
          id:           'prefixado31',
          name,
          indexer:      'PRE',
          spread:       null,
          rate,          // taxa nominal anual em % a.a.
          realRate:     null,
          maturityDate: mtrtyDt ? mtrtyDt.toISOString().split('T')[0] : '2031-01-01',
          fetchedAt:    now,
        });
      }
    }

    // Mapear IPCA+ simples (sem cupom semestral), vencimento 2033-2037
    if (indexerNm === 'IPCA' && !hasCoupon && year >= 2033 && year <= 2037) {
      if (!bonds.find(b => b.id === 'ipcaplus35')) {
        bonds.push({
          id:           'ipcaplus35',
          name,
          indexer:      'IPCA',
          spread:       null,
          rate:         null,
          realRate:     rate,  // spread real em % a.a. acima do IPCA
          maturityDate: mtrtyDt ? mtrtyDt.toISOString().split('T')[0] : '2035-05-15',
          fetchedAt:    now,
        });
      }
    }
  }

  if (bonds.length === 0) {
    throw new Error('Nenhum título relevante encontrado na resposta da API');
  }

  return bonds;
}

/**
 * Ponto de entrada principal — orquestra as 3 camadas de tolerância.
 * Atualiza o cache com dados frescos quando a API responde.
 *
 * @param {Function} onSuccess - Callback(bonds, source, date) quando dados disponíveis
 * @param {Function} onError   - Callback(message) quando falha total
 * @param {Function} onLoading - Callback() quando fetch iniciado
 */
async function fetchTreasuryBonds(onLoading, onSuccess, onError) {
  if (typeof onLoading === 'function') onLoading();

  try {
    // CAMADA 1: API ao vivo
    const bonds = await _fetchFromAPI();
    saveTreasuryCache(bonds, 'api');
    if (typeof onSuccess === 'function') {
      onSuccess(bonds, 'api', bonds[0]?.fetchedAt || new Date().toISOString());
    }
    return bonds;

  } catch (err) {
    // AbortError por chamada sobreposta: ignorar
    if (err.name === 'AbortError') return null;

    console.warn('[Treasury] API indisponível:', err.message);

    // CAMADA 2: Cache local (aceita mesmo expirado em caso de falha da API)
    const cached = loadTreasuryCache();
    if (cached && cached.bonds && cached.bonds.length > 0) {
      if (typeof onSuccess === 'function') {
        onSuccess(cached.bonds, 'cache', cached.fetchedAt);
      }
      return cached.bonds;
    }

    // CAMADA 3: Fallback hardcoded
    console.warn('[Treasury] Usando fallback hardcoded (jun/2026).');
    saveTreasuryCache(TREASURY_FALLBACK_BONDS, 'fallback');
    if (typeof onError === 'function') {
      onError('API indisponível e sem cache local. Usando taxas de referência (jun/2026).');
    }
    return TREASURY_FALLBACK_BONDS;
  }
}
