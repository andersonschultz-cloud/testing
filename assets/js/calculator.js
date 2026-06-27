/**
 * calculator.js — Consumo da Vida
 * Matemática financeira pura. Sem acesso ao DOM.
 * Suporta: CDI, Selic+spread, taxa fixa (manual), IPCA+, Poupança.
 *
 * Fórmulas validadas — R$1.000 + R$200/mês × 10 anos @ Selic 14,5%:
 *   Nubank (100% CDI = 14,4%): R$54.209,71 ✓
 *   Poupança:                  R$34.595,30 ✓
 */

const SELIC_FALLBACK      = 14.5;  // % a.a., usado quando BCB API não responde
const DEFAULT_ASSUMED_IPCA = 5.5;  // % a.a., premissa padrão para simulação IPCA+
const round2 = (n) => Math.round(n * 10000) / 10000;

const cdiFromSelic = (s) => Math.max(0, s - 0.1);
const poupSub = (s) => (s > 8.5 ? '0,5% a.m. + TR' : '70% da Selic');

/**
 * Calcula a taxa anual do banco/título conforme o tipo de derivação.
 *
 * @param {Object} d           - Objeto derive: { base, factor?, add?, rate?, realRate? }
 * @param {number} selic       - Meta Selic atual (% a.a.)
 * @param {number} [assumedIPCA] - IPCA estimado (% a.a.) para base=ipcaPlus
 * @returns {number} Taxa anual em %
 *
 * Tipos suportados:
 *   cdi:      CDI × factor  (ex: 100% CDI = factor:1, 150% CDI = factor:1.5)
 *   selicAdd: Selic + add   (ex: Tesouro Selic 2031 = add:0.08)
 *   manual:   taxa fixa     (ex: Tesouro Prefixado = rate:14.36)
 *   ipcaPlus: (1+real)*(1+ipca)-1  (ex: Tesouro IPCA+ = realRate:7.56)
 *   poupanca: regra legal   (0,5%/mês + TR se Selic>8,5%, else 70% Selic)
 */
function deriveRate(d, selic, assumedIPCA) {
  const cdi  = cdiFromSelic(selic);
  const ipca = (assumedIPCA != null && isFinite(assumedIPCA))
    ? assumedIPCA : DEFAULT_ASSUMED_IPCA;

  switch (d.base) {
    case 'cdi':
      return cdi * (d.factor || 1);

    case 'selicAdd':
      return selic + (d.add || 0);

    case 'manual':
      return Number(d.rate) || 0;

    case 'ipcaPlus':
      // Taxa nominal = composição de taxa real e inflação estimada
      return round2(((1 + (d.realRate || 0) / 100) * (1 + ipca / 100) - 1) * 100);

    case 'poupanca':
      return selic > 8.5
        ? (Math.pow(1.005, 12) - 1) * 100  // 0,5% a.m. capitalizado = ~6,17% a.a.
        : selic * 0.7;                       // 70% da Selic

    default:
      return 0;
  }
}

/**
 * Alíquota de IR regressiva (Lei 11.033/2004).
 * @param  {number} m - Meses de aplicação
 * @returns {number} Alíquota decimal
 */
function irRate(m) {
  if (m <= 6)  return 0.225;
  if (m <= 12) return 0.200;
  if (m <= 24) return 0.175;
  return 0.150;
}

/**
 * Calcula séries de evolução patrimonial por juros compostos com aportes.
 *
 * @param {Object}  o        - { rate, taxable }
 * @param {number}  principal - Valor inicial
 * @param {number}  monthly   - Aporte mensal
 * @param {number}  months    - Número de meses
 * @param {boolean} applyIR   - Descontar IR regressivo?
 * @returns {{ gross: number[], invested: number[], value: number[] }}
 */
function buildSeries(o, principal, monthly, months, applyIR) {
  const r  = Math.max(0, Number(o.rate) || 0);
  const im = r > 0 ? Math.pow(1 + r / 100, 1 / 12) - 1 : 0;
  const N  = Math.max(0, months);

  const gross    = new Array(N + 1);
  const invested = new Array(N + 1);
  const value    = new Array(N + 1);

  for (let m = 0; m <= N; m++) {
    const fvP = principal * Math.pow(1 + im, m);
    const fvA = im === 0 ? monthly * m : monthly * ((Math.pow(1 + im, m) - 1) / im);
    const inv  = principal + monthly * m;
    const g    = fvP + fvA;
    let   v    = g;
    if (applyIR && o.taxable) {
      v = g - Math.max(0, g - inv) * irRate(m);
    }
    gross[m]    = g;
    invested[m] = inv;
    value[m]    = v;
  }

  return { gross, invested, value };
}
