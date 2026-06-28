/**
 * simulator.js — Consumo da Vida
 * Estado, controle e renderização do Simulador de Rendimentos.
 *
 * Funcionalidades:
 *   - Carrega bancos do JSON (banks.js) com fallback hardcoded
 *   - Drag/touch na linha do tempo SVG
 *   - CRUD de bancos personalizados com persistência
 *   - Comparison cards: comparação detalhada por instituição (CORRIGIDO)
 *   - Hero card: destaca o melhor resultado automaticamente
 */

/* ── Estado global do simulador ──────────────────────────── */
let simState = {
  options:     [],      // preenchido em initSim()
  selic:       SELIC_FALLBACK,
  years:       10,
  scrubMonth:  120,
  applyIR:     false,
  dragging:    false,
  assumedIPCA: 5.5,    // % a.a. — premissa para simulação do Tesouro IPCA+
};
let simInitialized = false;
let _editingId     = null;  // ID sendo editado no form de banco custom

/* ── Constantes do gráfico SVG ───────────────────────────── */
const SIM_VBW = 760, SIM_VBH = 340, SIM_PADL = 54, SIM_PADR = 16, SIM_PADT = 22, SIM_PADB = 34;
const SIM_PLOTW = SIM_VBW - SIM_PADL - SIM_PADR;
const SIM_PLOTH = SIM_VBH - SIM_PADT - SIM_PADB;

/* ══════════════════════════════════════════════════════════
   INICIALIZAÇÃO (async — aguarda banks.json)
══════════════════════════════════════════════════════════ */

/**
 * Inicializa o simulador ao navegar para a aba.
 * Chamada apenas uma vez (lazy init em navTo('sim')).
 */
async function initSim() {
  simInitialized = true;

  // Restaurar Selic do cache local (mais preciso que o hardcoded)
  const cachedSelic = loadSelicCache();
  if (cachedSelic) simState.selic = cachedSelic.value;

  // Aguardar banks.json (promessa iniciada em app.js no DOMContentLoaded)
  try {
    const banks = await (_banksPromise || loadBanks());
    simState.options = buildOptionsFromBanks(banks, simState.selic);
  } catch {
    simState.options = buildOptionsFromBanks(null, simState.selic);
  }

  // Reintegrar bancos personalizados salvos
  const saved = loadCustomOpts();
  if (saved.length) simState.options = [...simState.options, ...saved];

  // Inicializar UI
  const inp = document.getElementById('selicInput');
  if (inp) inp.value = String(simState.selic);
  syncDerivedRates();
  renderOptList();
  renderSim();

  // Buscar Selic ao vivo (não-bloqueante)
  fetchSelic();

  // Registrar drag handlers
  _attachDragHandlers();

  // Inicializar dados do Tesouro Direto (não-bloqueante)
  _initTreasuryData();
}

/**
 * Inicializa dados do Tesouro Direto de forma assíncrona.
 * Restaura do cache primeiro, depois tenta API em background.
 */
async function _initTreasuryData() {
  // Restaurar do cache local (resposta imediata)
  const cached = loadTreasuryCache();
  if (cached && cached.bonds && cached.bonds.length > 0) {
    applyTreasuryBondsToSimState(cached.bonds, simState.selic, simState.assumedIPCA);
    setTreasurySuccess(cached.source || 'cache', cached.fetchedAt);
    renderOptList();
  } else {
    // Sem cache: marcar como idle para o usuário clicar em atualizar
  }

  // Busca em background (só se cache expirou ou não existe)
  if (!isTreasuryCacheFresh()) {
    await refreshTreasuryData();
  }
}

/* ── Drag na linha do tempo ──────────────────────────────── */
function _attachDragHandlers() {
  const wrap = document.getElementById('simChartWrap');

  const getMonth = (clientX) => {
    const svg  = wrap.querySelector('svg');
    if (!svg) return 0;
    const rect  = svg.getBoundingClientRect();
    const months = simState.years * 12;
    const vbX   = ((clientX - rect.left) / Math.max(rect.width, 1)) * SIM_VBW;
    const frac  = (vbX - SIM_PADL) / SIM_PLOTW;
    return Math.max(0, Math.min(months, Math.round(frac * months)));
  };

  const onStart = (e) => {
    simState.dragging   = true;
    simState.scrubMonth = getMonth(e.touches ? e.touches[0].clientX : e.clientX);
    renderSimChart();
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!simState.dragging) return;
    simState.scrubMonth = getMonth(e.touches ? e.touches[0].clientX : e.clientX);
    renderSimChart();
    e.preventDefault();
  };
  const onEnd = () => { simState.dragging = false; };

  wrap.addEventListener('mousedown',   onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onEnd);
  wrap.addEventListener('touchstart',  onStart, { passive: false });
  wrap.addEventListener('touchmove',   onMove,  { passive: false });
  wrap.addEventListener('touchend',    onEnd);
}

/* ══════════════════════════════════════════════════════════
   HANDLERS DE INPUT
══════════════════════════════════════════════════════════ */

/** Handler para mudança no IPCA estimado (premissa Tesouro IPCA+). */
function onIPCAInput() {
  const v = parseFloat(document.getElementById('assumedIPCA').value.replace(',', '.'));
  if (!isFinite(v) || v < 0) return;
  simState.assumedIPCA = v;
  refreshTreasurySubs(simState.selic, v); // reconstrói sub-labels dos títulos IPCA+
  renderOptList();
  renderSim();
}

function onSelicInput() {
  const v = parseFloat(document.getElementById('selicInput').value.replace(',', '.'));
  if (!isFinite(v) || v < 0) return;
  simState.selic = v;
  syncDerivedRates();
  renderSim();
}

/** Recomputa as taxas derivadas de CDI/Selic após mudança da Selic. */
function syncDerivedRates() {
  const ipca = simState.assumedIPCA != null ? simState.assumedIPCA : DEFAULT_ASSUMED_IPCA;
  simState.options = simState.options.map(o => {
    if (!o.derive) return o;
    if (o.derive.base === 'manual') return o;  // taxa fixa: não recomputa com Selic

    // Títulos Tesouro Direto: delega ao treasuryCalculator
    if (o.treasuryBond) {
      const newRate = round2(deriveRate(o.derive, simState.selic, ipca));
      const bondData = { indexer: o.indexer, spread: o.derive.add, rate: o.derive.rate, realRate: o.derive.realRate };
      return { ...o, rate: newRate, sub: buildTreasurySub(bondData, simState.selic, ipca) };
    }

    // Bancos privados (CDI, Selic, Poupança)
    return {
      ...o,
      rate: round2(deriveRate(o.derive, simState.selic, ipca)),
      sub:  o.id === 'poupanca' ? poupSub(simState.selic) : o.sub,
    };
  });
}

function onYearsInput() {
  const y = parseInt(document.getElementById('yearsSlider').value, 10);
  simState.years      = y;
  simState.scrubMonth = y * 12; // move scrub para o fim ao alterar prazo
  document.getElementById('yearsVal').textContent   = y;
  document.getElementById('yearsLabel').textContent = y === 1 ? 'ano' : 'anos';
  renderSim();
}

function toggleOpt(id) {
  simState.options = simState.options.map(o => o.id === id ? { ...o, on: !o.on } : o);
  renderOptList();
  renderSim();
}

/* ══════════════════════════════════════════════════════════
   CRUD — BANCOS PERSONALIZADOS
══════════════════════════════════════════════════════════ */

function showCustomForm(editId) {
  _editingId = editId || null;
  const form  = document.getElementById('customBankForm');
  const title = document.getElementById('cbFormTitle');
  document.getElementById('cbNameErr').style.display = 'none';
  document.getElementById('cbRateErr').style.display = 'none';

  if (editId) {
    const opt = simState.options.find(o => o.id === editId);
    if (!opt) return;
    title.textContent = 'Editar instituição';
    document.getElementById('cbName').value       = opt.name;
    document.getElementById('cbTaxable').checked  = opt.taxable;
    const isCdi = opt.derive && opt.derive.base === 'cdi';
    document.getElementById('cbType').value = isCdi ? 'pct_cdi' : 'pct_aa';
    document.getElementById('cbRate').value = isCdi
      ? ((opt.derive.factor || 1) * 100).toFixed(1)
      : Number(opt.rate).toFixed(2);
  } else {
    title.textContent = 'Adicionar instituição';
    document.getElementById('cbName').value      = '';
    document.getElementById('cbRate').value      = '';
    document.getElementById('cbType').value      = 'pct_cdi';
    document.getElementById('cbTaxable').checked = true;
  }

  form.style.display = 'block';
  document.getElementById('cbName').focus();
}

function hideCustomForm() {
  document.getElementById('customBankForm').style.display = 'none';
  _editingId = null;
}

function saveCustomBank() {
  const name    = document.getElementById('cbName').value.trim();
  const rateRaw = parseFloat(document.getElementById('cbRate').value.replace(',', '.'));
  const type    = document.getElementById('cbType').value;
  const taxable = document.getElementById('cbTaxable').checked;

  let valid = true;
  const nameErr = document.getElementById('cbNameErr');
  const rateErr = document.getElementById('cbRateErr');
  nameErr.style.display = 'none'; rateErr.style.display = 'none';
  if (!name)                              { nameErr.style.display = 'block'; valid = false; }
  if (!isFinite(rateRaw) || rateRaw <= 0) { rateErr.style.display = 'block'; valid = false; }
  if (!valid) return;

  let derive, rate, sub;
  if (type === 'pct_cdi') {
    const factor = rateRaw / 100;
    derive = { base: 'cdi', factor };
    rate   = round2(cdiFromSelic(simState.selic) * factor);
    sub    = (rateRaw % 1 === 0 ? rateRaw.toFixed(0) : rateRaw.toFixed(1)) + '% do CDI';
  } else {
    derive = { base: 'manual', rate: rateRaw };
    rate   = round2(rateRaw);
    sub    = rateRaw.toFixed(2).replace('.', ',') + '% a.a.';
  }

  if (_editingId) {
    simState.options = simState.options.map(o =>
      o.id === _editingId ? { ...o, name, rate, sub, derive, taxable } : o
    );
  } else {
    const id    = 'custom_' + Date.now();
    const color = nextCustomColor();
    simState.options = [...simState.options, { id, name, rate, sub, color, taxable, on: true, derive, custom: true, logo: null }];
  }

  saveCustomOpts();
  hideCustomForm();
  renderOptList();
  renderSim();
}

function deleteCustomBank(id) {
  if (!confirm('Remover esta instituição da simulação?')) return;
  simState.options = simState.options.filter(o => o.id !== id);
  saveCustomOpts();
  renderOptList();
  renderSim();
}

/* ══════════════════════════════════════════════════════════
   HELPERS DE RENDERIZAÇÃO
══════════════════════════════════════════════════════════ */

/**
 * Retorna HTML de uma logo de banco ou ponto colorido como fallback.
 * @param {Object} o    - Opção de banco com .logo e .color
 * @param {string} cls  - Classe CSS da imagem
 * @param {number} sz   - Dimensão em px
 */
function mkLogo(o, cls, sz) {
  if (!o.logo) return '<span class="opt-dot" style="background:' + o.color + '"></span>';
  return '<img class="' + cls + '" src="' + o.logo + '" alt="" loading="lazy"'
       + ' width="' + sz + '" height="' + sz + '"'
       + ' onerror="simLogoFail(this,\'' + o.color + '\')">';
}

/* ── Lista de opções (sidebar) ───────────────────────────── */
function renderOptList() {
  const fixed  = simState.options.filter(o => !o.custom);
  const custom = simState.options.filter(o =>  o.custom);

  const rowHtml = (o) => `
    <div class="opt-row ${o.on ? '' : 'off'}">
      <div class="opt-logo-wrap">${mkLogo(o, 'opt-logo', 28)}</div>
      <div class="opt-info">
        <div class="opt-name">${escHtml(o.name)}${o.custom ? '<span class="opt-custom-tag">personalizado</span>' : ''}</div>
        <div class="opt-sub">${escHtml(o.sub)}</div>
      </div>
      <span class="opt-rate">${fmt(o.rate)}%</span>
      ${o.custom ? `
        <button class="opt-action-btn" onclick="showCustomForm('${o.id}')" title="Editar" aria-label="Editar ${escHtml(o.name)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
        </button>
        <button class="opt-action-btn opt-del-btn" onclick="deleteCustomBank('${o.id}')" title="Remover" aria-label="Remover ${escHtml(o.name)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ''}
      <label class="switch opt-toggle">
        <input type="checkbox" ${o.on ? 'checked' : ''} onchange="toggleOpt('${o.id}')">
        <span class="switch-slider"></span>
      </label>
    </div>`;

  const fixedPrivate = fixed.filter(o => !o.treasuryBond);
  const fixedTreasury = fixed.filter(o => o.treasuryBond);

  document.getElementById('optList').innerHTML =
    // Bancos privados
    `<div class="opt-separator"><span>Bancos e Fintechs</span></div>` +
    fixedPrivate.map(rowHtml).join('') +

    // Tesouro Direto (com controles próprios)
    buildTreasurySeparatorHTML() +
    fixedTreasury.map(rowHtml).join('') +

    // Personalizados
    (custom.length
      ? `<div class="opt-separator" style="margin-top:10px"><span>Personalizadas</span></div>` +
        custom.map(rowHtml).join('')
      : '');

  // Atualiza linha de status do Tesouro após re-render
  requestAnimationFrame(renderTreasuryStatus);
}

/* ── Inputs ──────────────────────────────────────────────── */
function simInputs() {
  const principal = Math.max(0, parseFloat(document.getElementById('simPrincipal').value) || 0);
  const monthly   = Math.max(0, parseFloat(document.getElementById('simMonthly').value)   || 0);
  return { principal, monthly };
}

/**
 * Calcula as séries de TODAS as opções ativas — chamado 1× por renderSim().
 * O resultado é repassado a cada sub-render para evitar recomputação.
 */
function computeSeries() {
  const { principal, monthly } = simInputs();
  const months = Math.max(1, simState.years * 12);
  const map    = {};
  simState.options.forEach(o => {
    map[o.id] = buildSeries(o, principal, monthly, months, simState.applyIR);
  });
  return { map, principal, monthly, months };
}

/* ══════════════════════════════════════════════════════════
   RENDER PRINCIPAL (orquestra sub-renders)
══════════════════════════════════════════════════════════ */
function renderSim() {
  document.getElementById('cdiVal').textContent = fmt(cdiFromSelic(simState.selic)) + '%';
  simState.applyIR = document.getElementById('irToggle').checked;
  const computed = computeSeries(); // calcula 1 única vez
  renderSimChart(computed);
  renderSimHero(computed);
  renderComparison(computed); // cards detalhados por instituição
}

/* ── Gráfico SVG (linha do tempo arrastável) ─────────────── */
function renderSimChart(computed) {
  const { map, principal, monthly, months } = computed;
  const enabled = simState.options.filter(o => o.on);
  const s       = Math.min(simState.scrubMonth, months);

  let maxFinal = Math.max(principal + monthly * months, 1);
  enabled.forEach(o => { maxFinal = Math.max(maxFinal, map[o.id].value[months] || 0); });

  const dark = isDark;
  const xOf  = (m) => SIM_PADL + (m / months) * SIM_PLOTW;
  const yOf  = (v) => SIM_PADT + SIM_PLOTH - (v / (maxFinal * 1.06)) * SIM_PLOTH;

  const pathOf = (arr) => {
    if (!arr || !arr.length) return '';
    const step = Math.max(1, Math.round(months / 240));
    let d = '';
    for (let m = 0; m <= months; m += step) {
      d += (m === 0 ? 'M' : 'L') + xOf(m).toFixed(1) + ' ' + yOf(arr[m] || 0).toFixed(1) + ' ';
    }
    return d + 'L' + xOf(months).toFixed(1) + ' ' + yOf(arr[months] || 0).toFixed(1);
  };

  const fmtAxis = (v) => {
    if (v >= 1e6) return (v / 1e6).toFixed(v < 5e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + 'k';
    return v.toFixed(0);
  };

  const investedArr = Array.from({ length: months + 1 }, (_, m) => principal + monthly * m);
  const gridVals    = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxFinal * 1.06);
  const axisColor   = dark ? '#475569' : '#94A3B8';
  const gridColor   = dark ? 'rgba(255,255,255,.06)' : 'rgba(37,99,235,.07)';

  let svg = `<svg viewBox="0 0 ${SIM_VBW} ${SIM_VBH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gráfico de rendimentos comparativos ao longo do tempo">`;
  gridVals.forEach(v => {
    const y = yOf(v);
    svg += `<line x1="${SIM_PADL}" y1="${y.toFixed(1)}" x2="${SIM_VBW - SIM_PADR}" y2="${y.toFixed(1)}" stroke="${gridColor}" stroke-width="1"/>`;
    svg += `<text x="${SIM_PADL - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" font-family="DM Mono,monospace" fill="${axisColor}">${fmtAxis(v)}</text>`;
  });
  const xStep = simState.years <= 12 ? 1 : Math.ceil(simState.years / 10);
  for (let yr = 0; yr <= simState.years; yr += xStep) {
    const m = yr * 12;
    svg += `<text x="${xOf(m).toFixed(1)}" y="${SIM_VBH - 10}" text-anchor="middle" font-size="10" font-family="DM Mono,monospace" fill="${axisColor}">${yr === 0 ? 'hoje' : yr + 'a'}</text>`;
  }
  svg += `<path d="${pathOf(investedArr)}" fill="none" stroke="${dark ? '#475569' : '#CBD5E1'}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  enabled.forEach(o => {
    svg += `<path d="${pathOf(map[o.id].value)}" fill="none" stroke="${o.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  const sx = xOf(s);
  svg += `<line x1="${sx.toFixed(1)}" y1="${SIM_PADT}" x2="${sx.toFixed(1)}" y2="${SIM_PADT + SIM_PLOTH}" stroke="${dark ? '#60A5FA' : '#2563EB'}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  enabled.forEach(o => {
    const cy = yOf(map[o.id].value[s] || 0);
    svg += `<circle cx="${sx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${o.color}" stroke="${dark ? '#1E293B' : '#fff'}" stroke-width="2"/>`;
  });
  svg += '</svg>';
  document.getElementById('simChartWrap').innerHTML = svg;
  document.getElementById('scrubTime').textContent  = yearsLabel(s);
}

/* ── Hero card (melhor resultado no fim do período) ──────── */
function renderSimHero(computed) {
  const { map, principal, monthly, months } = computed;
  const enabled = simState.options.filter(o => o.on);

  if (!enabled.length) {
    document.getElementById('simHeroValue').textContent = 'R$ 0,00';
    document.getElementById('simLeader').textContent    = '—';
    document.getElementById('simHeroSub').textContent   = 'Selecione ao menos uma opção.';
    return;
  }

  const ranked   = enabled.map(o => ({ ...o, value: map[o.id].value[months] || 0 })).sort((a, b) => b.value - a.value);
  const leader   = ranked[0];
  const poup     = ranked.find(r => r.id === 'poupanca') || ranked[ranked.length - 1];
  const invested = principal + monthly * months;
  const juros    = leader.value - invested;
  const delta    = leader.value - poup.value;

  document.getElementById('simLeader').textContent    = '🏆 ' + leader.name;
  document.getElementById('simHeroValue').textContent = 'R$ ' + fmt(leader.value);
  document.getElementById('simHeroSub').innerHTML =
    `Você investiria <b>R$ ${fmt(invested)}</b> e teria <b>R$ ${fmt(juros)}</b> de juros em ` +
    `${simState.years} ${simState.years === 1 ? 'ano' : 'anos'}.` +
    (delta > 0.5 && leader.id !== poup.id ? ` São <b>R$ ${fmt(delta)}</b> a mais que a Poupança.` : '');
}

/* ══════════════════════════════════════════════════════════
   COMPARISON CARDS — visão expandida por instituição (CORRIGIDO)
   Exibe TODAS as instituições com cálculo completo e individual.
   Cada banco usa seu próprio percentual do CDI.
   O líder é destacado com borda teal.
══════════════════════════════════════════════════════════ */

/**
 * Renderiza os comparison cards no ponto do scrub atual.
 * Cada card mostra: logo, nome, % CDI, investido, bruto, juros, líquido.
 * O líder (maior valor líquido) recebe destaque visual.
 *
 * @param {Object} computed - Resultado de computeSeries()
 */
function renderComparison(computed) {
  const { map, months } = computed;
  const enabled = simState.options.filter(o => o.on);
  const s       = Math.min(simState.scrubMonth, months);

  if (!enabled.length) {
    document.getElementById('rankingList').innerHTML =
      '<p style="color:var(--text3);font-size:14px;padding:16px 0">Selecione ao menos uma instituição para ver a comparação.</p>';
    return;
  }

  // Calcula resultados individuais — cada banco usa SUA própria taxa
  const results = enabled.map(o => {
    const ser       = map[o.id];                  // série correta do banco
    const value     = ser.value[s]    || 0;        // valor líquido (após IR se aplicável)
    const grossVal  = ser.gross[s]    || 0;        // valor bruto (sem IR)
    const inv       = ser.invested[s] || 0;        // capital investido até o mês s
    const grossEarn = Math.max(0, grossVal - inv); // juros brutos
    const ir        = simState.applyIR && o.taxable ? grossEarn * irRate(s) : 0;
    const juros     = Math.max(0, value - inv);    // juros líquidos
    const pct       = inv > 0 ? (value / inv - 1) * 100 : 0;
    return { ...o, value, grossVal, inv, grossEarn, juros, ir, pct };
  }).sort((a, b) => b.value - a.value);

  // Badge do % CDI ou tipo de derivação
  const pctLabel = (r) => {
    if (!r.derive) return r.sub || '';
    switch (r.derive.base) {
      case 'cdi':      return ((r.derive.factor || 1) * 100).toFixed(0) + '% CDI';
      case 'selicAdd': return 'Selic+' + (r.derive.add || 0).toString().replace('.', ',') + '%';
      case 'manual':   return (r.derive.rate || 0).toFixed(2).replace('.', ',') + '% a.a.';
      case 'poupanca': return poupSub(simState.selic);
      default: return r.sub || '';
    }
  };

  const cardHtml = (r, i) => {
    const isLeader = i === 0;
    return `
      <div class="cmp-card ${isLeader ? 'leader' : ''}">
        <div class="cmp-header">
          <div class="cmp-logo-wrap">${mkLogo(r, 'cmp-logo', 32)}</div>
          <div class="cmp-name-wrap">
            <div class="cmp-name">${escHtml(r.name)}</div>
            <div class="cmp-product">${escHtml(r.product || r.sub)}</div>
          </div>
          <span class="cmp-pct-badge">${escHtml(pctLabel(r))}</span>
        </div>
        <div class="cmp-metrics">
          <div class="cmp-metric">
            <span class="cmp-lbl">Investido</span>
            <span class="cmp-val">R$ ${fmt(r.inv)}</span>
          </div>
          <div class="cmp-metric">
            <span class="cmp-lbl">Bruto</span>
            <span class="cmp-val">R$ ${fmt(r.grossVal)}</span>
          </div>
          <div class="cmp-metric">
            <span class="cmp-lbl">Juros</span>
            <span class="cmp-val">R$ ${fmt(r.grossEarn)}</span>
          </div>
          <div class="cmp-metric">
            <span class="cmp-lbl">${r.ir > 0 ? 'Líquido (c/IR)' : 'Líquido'}</span>
            <span class="cmp-val accent">R$ ${fmt(r.value)}</span>
          </div>
        </div>
        ${r.ir > 0 ? `<div class="cmp-ir-note">IR descontado: ~R$ ${fmt(r.ir)}</div>` : ''}
        <div class="cmp-footer">
          <span class="cmp-pct-gain">+${fmt(r.pct, 1)}% de rendimento</span>
          ${isLeader ? '<span class="cmp-leader-badge">🏆 Melhor resultado</span>' : ''}
        </div>
      </div>`;
  };

  document.getElementById('rankingList').innerHTML =
    `<div class="cmp-grid">${results.map(cardHtml).join('')}</div>`;
}
