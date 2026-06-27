/**
 * treasuryCache.js — Consumo da Vida
 * Camada de persistência para dados do Tesouro Direto.
 * Armazena e recupera o último retorno válido da API no localStorage.
 * TTL de 24 horas para evitar dados muito desatualizados.
 */

const TREASURY_CACHE_KEY = 'cdv-treasury-v1';
const TREASURY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em ms

/**
 * @typedef {Object} TreasuryBondData
 * @property {string} id           - Identificador (ex: 'selic31')
 * @property {string} name         - Nome completo do título
 * @property {string} indexer      - 'SELIC' | 'PRE' | 'IPCA'
 * @property {number} spread       - Spread sobre indexador (Selic)
 * @property {number} rate         - Taxa anual (Prefixado)
 * @property {number} realRate     - Taxa real (IPCA+)
 * @property {string} maturityDate - Data de vencimento ISO
 * @property {string} fetchedAt    - ISO timestamp da busca
 */

/**
 * @typedef {Object} TreasuryCache
 * @property {TreasuryBondData[]} bonds     - Lista de títulos
 * @property {string}             fetchedAt - ISO timestamp da última busca
 * @property {string}             source    - Origem dos dados ('api' | 'fallback')
 */

/**
 * Carrega o cache do Tesouro Direto do localStorage.
 * Valida TTL e formato antes de retornar.
 * @returns {TreasuryCache|null}
 */
function loadTreasuryCache() {
  try {
    const raw = localStorage.getItem(TREASURY_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!cache || !Array.isArray(cache.bonds) || !cache.fetchedAt) return null;

    // Verificar TTL
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (age > TREASURY_CACHE_TTL) {
      console.info('[Treasury] Cache expirado (%dh). Buscando atualização...', Math.round(age / 3.6e6));
      // Retorna mesmo assim (usado como fallback se API falhar)
    }

    return cache;
  } catch (e) {
    console.warn('[Treasury] Erro ao ler cache:', e.message);
    return null;
  }
}

/**
 * Persiste dados do Tesouro Direto no localStorage.
 * @param {TreasuryBondData[]} bonds  - Títulos normalizados
 * @param {string}             source - 'api' | 'fallback'
 */
function saveTreasuryCache(bonds, source) {
  try {
    const cache = {
      bonds,
      fetchedAt: new Date().toISOString(),
      source: source || 'api',
    };
    localStorage.setItem(TREASURY_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[Treasury] Não foi possível salvar cache (quota?):', e.message);
  }
}

/**
 * Verifica se o cache está dentro do TTL (fresh).
 * @returns {boolean}
 */
function isTreasuryCacheFresh() {
  try {
    const raw = localStorage.getItem(TREASURY_CACHE_KEY);
    if (!raw) return false;
    const cache = JSON.parse(raw);
    if (!cache || !cache.fetchedAt) return false;
    return (Date.now() - new Date(cache.fetchedAt).getTime()) < TREASURY_CACHE_TTL;
  } catch { return false; }
}

/**
 * Formata o timestamp do cache para exibição ao usuário.
 * @param {string} isoDate
 * @returns {string} Ex: "18/06/2026 às 14h32"
 */
function formatTreasuryCacheDate(isoDate) {
  try {
    const d = new Date(isoDate);
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} às ${time}`;
  } catch { return isoDate || '—'; }
}
