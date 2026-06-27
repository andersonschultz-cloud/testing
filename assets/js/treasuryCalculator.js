/**
 * treasuryCalculator.js — Consumo da Vida
 * Converte dados brutos dos títulos do Tesouro Direto em opções
 * prontas para uso no simulador. Responsável por calcular e formatar
 * as taxas de cada tipo de título.
 *
 * Mantido separado dos bancos privados para isolamento de lógica.
 */

/* ── Mapeamento de cores por tipo de título ──────────────── */
const TREASURY_COLORS = {
  selic31:     '#2563EB',  // azul — Tesouro Selic
  prefixado31: '#4F46E5',  // índigo — Tesouro Prefixado
  ipcaplus35:  '#7C3AED',  // roxo — Tesouro IPCA+
};

/**
 * Sub-label formatado de acordo com o tipo e taxa do título.
 * Reflete dados atualizados após busca na API.
 *
 * @param {import('./treasuryApi.js').TreasuryBondData} bond
 * @param {number} selic       - Selic atual (% a.a.)
 * @param {number} assumedIPCA - IPCA estimado (% a.a.) para IPCA+
 * @returns {string}
 */
function buildTreasurySub(bond, selic, assumedIPCA) {
  const ipca = assumedIPCA != null ? assumedIPCA : DEFAULT_ASSUMED_IPCA;

  switch (bond.indexer) {
    case 'SELIC': {
      const spread  = bond.spread || 0;
      const nominal = round2(selic + spread);
      return `Selic + ${spread.toFixed(2).replace('.', ',')}% ≈ ${nominal.toFixed(2).replace('.', ',')}% a.a.`;
    }
    case 'PRE': {
      return `${(bond.rate || 0).toFixed(2).replace('.', ',')}% a.a. (prefixado)`;
    }
    case 'IPCA': {
      const real    = bond.realRate || 0;
      const nominal = round2(((1 + real / 100) * (1 + ipca / 100) - 1) * 100);
      return `IPCA (${ipca}%) + ${real.toFixed(2).replace('.', ',')}% real ≈ ${nominal.toFixed(2).replace('.', ',')}% a.a.`;
    }
    default:
      return bond.name;
  }
}

/**
 * Deriva-object para uso em deriveRate() / buildSeries().
 * @param {import('./treasuryApi.js').TreasuryBondData} bond
 * @returns {Object}
 */
function buildTreasuryDerive(bond) {
  switch (bond.indexer) {
    case 'SELIC': return { base: 'selicAdd', add: bond.spread || 0 };
    case 'PRE':   return { base: 'manual',   rate: bond.rate   || 0 };
    case 'IPCA':  return { base: 'ipcaPlus', realRate: bond.realRate || 0 };
    default:      return { base: 'manual',   rate: 0 };
  }
}

/**
 * Converte um TreasuryBondData em uma opção do simulador.
 * O formato resultante é idêntico ao das opções de banco privado.
 *
 * @param {import('./treasuryApi.js').TreasuryBondData} bond
 * @param {number} selic
 * @param {number} assumedIPCA
 * @returns {Object} SimOption compatível com simState.options
 */
function treasuryBondToSimOption(bond, selic, assumedIPCA) {
  const derive  = buildTreasuryDerive(bond);
  const rate    = round2(deriveRate(derive, selic, assumedIPCA));
  const sub     = buildTreasurySub(bond, selic, assumedIPCA);

  return {
    id:           bond.id,
    name:         bond.name,
    product:      bond.name,
    sub,
    rate,
    color:        TREASURY_COLORS[bond.id] || '#6E7BE0',
    logo:         'https://logo.clearbit.com/tesourodireto.com.br',
    taxable:      true,
    on:           true,
    derive,
    treasuryBond: true,
    maturityDate: bond.maturityDate,
    indexer:      bond.indexer,
  };
}

/**
 * Atualiza as opções do Tesouro Direto em simState.options com os
 * dados mais recentes (da API ou fallback), mantendo o estado on/off
 * que o usuário configurou.
 *
 * @param {import('./treasuryApi.js').TreasuryBondData[]} bonds
 * @param {number} selic
 * @param {number} assumedIPCA
 */
function applyTreasuryBondsToSimState(bonds, selic, assumedIPCA) {
  if (!bonds || bonds.length === 0) return;

  bonds.forEach(bond => {
    const newOpt = treasuryBondToSimOption(bond, selic, assumedIPCA);

    const existing = simState.options.find(o => o.id === bond.id);
    if (existing) {
      // Atualiza taxa e sub-label, preserva estado on/off e cor
      Object.assign(existing, {
        rate:         newOpt.rate,
        sub:          newOpt.sub,
        derive:       newOpt.derive,
        maturityDate: newOpt.maturityDate,
        indexer:      newOpt.indexer,
      });
    } else {
      // Título novo (API retornou algo não esperado)
      simState.options.push(newOpt);
    }
  });
}

/**
 * Reconstrói o sub-label de todos os títulos do Tesouro após mudança
 * de Selic ou IPCA estimado.
 * @param {number} selic
 * @param {number} assumedIPCA
 */
function refreshTreasurySubs(selic, assumedIPCA) {
  simState.options = simState.options.map(o => {
    if (!o.treasuryBond) return o;
    const ipca = assumedIPCA != null ? assumedIPCA : DEFAULT_ASSUMED_IPCA;
    return {
      ...o,
      rate: round2(deriveRate(o.derive, selic, ipca)),
      sub:  buildTreasurySub(
        { indexer: o.indexer, spread: o.derive.add, rate: o.derive.rate, realRate: o.derive.realRate },
        selic,
        ipca
      ),
    };
  });
}
