/**
 * calculator.js — Consumo da Vida
 * Camada de cálculo financeiro puro. Sem acesso ao DOM.
 * Contém toda a matemática de juros compostos, CDI, IR e Poupança.
 *
 * Fórmulas validadas: R$1.000 + R$200/mês × 10 anos @ Selic 14,5%
 *   → Nubank (100% CDI): R$54.209,71 ✓
 *   → Poupança:          R$34.595,30 ✓
 */

const SELIC_FALLBACK = 14.5; // % a.a., usado quando a API não responde
const round2 = (n) => Math.round(n * 10000) / 10000; // 4 casas para taxa, 2 na exibição

/** CDI estimado: Selic menos 0,10 p.p. (convenção de mercado). */
const cdiFromSelic = (s) => Math.max(0, s - 0.1);

/** Sub-label da Poupança conforme regra legal (Selic > 8,5%: 0,5% a.m. + TR). */
const poupSub = (s) => (s > 8.5 ? '0,5% a.m. + TR' : '70% da Selic');

/**
 * Calcula a taxa anual de um banco dado seu tipo de derivação.
 * @param {Object} d   - Objeto derive: { base, factor?, add?, rate? }
 * @param {number} selic - Selic atual em % a.a.
 * @returns {number} Taxa anual em %
 */
function deriveRate(d, selic) {
  const cdi = cdiFromSelic(selic);
  switch (d.base) {
    case 'cdi':      return cdi * (d.factor || 1);
    case 'selicAdd': return selic + (d.add || 0);
    case 'manual':   return Number(d.rate) || 0;  // taxa fixa % a.a.
    case 'poupanca': return selic > 8.5
        ? (Math.pow(1.005, 12) - 1) * 100  // 0,5% a.m. capitalizado
        : selic * 0.7;                       // 70% da Selic
    default: return 0;
  }
}

/**
 * Alíquota de IR regressiva (Lei 11.033/2004).
 * @param {number} m - meses de aplicação
 * @returns {number} Alíquota decimal (ex: 0.225)
 */
function irRate(m) {
  if (m <= 6)  return 0.225;
  if (m <= 12) return 0.200;
  if (m <= 24) return 0.175;
  return 0.150;
}

/**
 * Calcula séries de evolução patrimonial (juros compostos com aporte mensal).
 *
 * @param {Object}  o        - Opção de banco: { rate, taxable }
 * @param {number}  principal - Valor inicial investido
 * @param {number}  monthly   - Aporte mensal
 * @param {number}  months    - Número de meses
 * @param {boolean} applyIR   - Se true, desconta IR regressivo
 * @returns {{ gross: number[], invested: number[], value: number[] }}
 *   Arrays indexados por mês [0..months].
 *   - gross:    valor bruto (sem IR)
 *   - invested: capital investido acumulado (sem juros)
 *   - value:    valor líquido (após IR se aplicável)
 */
function buildSeries(o, principal, monthly, months, applyIR) {
  const r  = Math.max(0, Number(o.rate) || 0);
  const im = r > 0 ? Math.pow(1 + r / 100, 1 / 12) - 1 : 0; // taxa mensal equivalente
  const N  = Math.max(0, months);

  const gross    = new Array(N + 1);
  const invested = new Array(N + 1);
  const value    = new Array(N + 1);

  for (let m = 0; m <= N; m++) {
    // VF do capital inicial + VF dos aportes (FV de anuidade)
    const fvP = principal * Math.pow(1 + im, m);
    const fvA = im === 0 ? monthly * m : monthly * ((Math.pow(1 + im, m) - 1) / im);
    const inv  = principal + monthly * m;
    const g    = fvP + fvA;

    // IR incide somente sobre o lucro (rendimento bruto)
    let v = g;
    if (applyIR && o.taxable) {
      v = g - Math.max(0, g - inv) * irRate(m);
    }

    gross[m]    = g;
    invested[m] = inv;
    value[m]    = v;
  }

  return { gross, invested, value };
}
