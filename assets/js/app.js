/**
 * app.js — Consumo da Vida
 * Ponto de entrada da aplicação. Inicializa todos os módulos,
 * registra event listeners e contém a lógica das ferramentas
 * Calculadora de Vida e Planejador de Compras.
 *
 * Ordem de dependências (via <script> em index.html):
 *   utils → storage → calculator → api → banks → charts → simulator → ui → app
 */

/* ── Estado da Calculadora de Vida ──────────────────────── */
let _lastH = 0, _lastD = 0, _lastP = 0;

/* ── Estado do Planejador ────────────────────────────────── */
let _lastPlanPerc = 0;

/* ── Conteúdo editorial (reflexões e citações) ──────────── */
const reflections = [
  'Você trocaria {h} horas da sua vida por este produto?',
  'Esse produto representa {d} dias do seu esforço profissional.',
  'Imagine trabalhar {d} dias inteiros apenas para adquirir este item.',
  'Vale comprometer {p}% do seu salário mensal com essa compra agora?',
  'Cada hora de trabalho é um pedaço da sua vida. Este produto custa {h} delas.',
  'Você ainda desejaria este produto se pagasse com horas de vida em vez de dinheiro?',
  'Após {h} horas de trabalho, este produto ainda terá o mesmo valor para você?',
  'Pense em {d} dias de trabalho. É quanto este produto custa na moeda mais preciosa: seu tempo.',
  'Será que a satisfação deste produto durará mais do que os {d} dias para conquistá-lo?',
  'Você se lembraria desta compra daqui a um ano? Ela vale {h} horas da sua vida?',
];

const quotes = [
  'Cada compra é uma troca silenciosa entre dinheiro e tempo.',
  'Nem tudo o que desejamos precisa ser adquirido imediatamente.',
  'O valor de um produto não está apenas no preço, mas no tempo para conquistá-lo.',
  'O desejo é imediato. A necessidade costuma ser paciente.',
  'O tempo investido para ganhar dinheiro é parte da sua própria vida.',
  'Consumir conscientemente é respeitar o tempo que você dedicou ao trabalho.',
  'Antes de comprar, pergunte: estou comprando um objeto ou vendendo meu tempo?',
  'A disciplina financeira não é privação. É a arte de escolher o que merece seu tempo.',
  'Desejos passageiros custam horas permanentes.',
  'A autoconsciência sobre o consumo é a primeira forma de liberdade financeira.',
  'O preço real de qualquer coisa é a quantidade de vida que você troca por ela.',
  'Há uma diferença entre o que o marketing cria e o que a vida realmente precisa.',
  'A pausa antes da compra é o exercício mais poderoso da inteligência financeira.',
  'Você não está gastando dinheiro. Você está gastando horas da sua existência.',
  'A satisfação de um desejo nunca dura tanto quanto o esforço para realizá-lo.',
  'O que você possui acaba possuindo você — se você não escolheu com consciência.',
  'Liberdade financeira começa quando você aprende a dizer não ao impulso.',
  'Cada real economizado não é dinheiro guardado — é tempo de vida recuperado.',
  'Valorize seu tempo antes de gastar seu dinheiro — pois um é a origem do outro.',
  'Não existe compra pequena quando você conta em horas de vida.',
];

/* ══════════════════════════════════════════════════════════
   INICIALIZAÇÃO
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Iniciar carregamento dos bancos imediatamente (não-bloqueante)
  _banksPromise = loadBanks();

  // Restaurar página salva ou abrir home
  const saved = localStorage.getItem('cdv-page');
  if (saved && ['home', 'calc', 'plan', 'sim'].includes(saved)) navTo(saved);
  else navTo('home');

  // Registrar event listeners globais
  _registerEventListeners();

  // Renderizar histórico se houver
  renderHistory();
});

function _registerEventListeners() {
  // Fechar modal ao clicar fora
  document.getElementById('qdpOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  // Fechar modal com Esc
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Máscara de moeda nos inputs de valor
  ['salario', 'produto', 'p-renda', 'p-produto'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () { applyMask(this); });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      this.value = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      applyMask(this);
    });
  });
}

/* ══════════════════════════════════════════════════════════
   CALCULADORA DE VIDA
══════════════════════════════════════════════════════════ */
function calcular() {
  const nome    = document.getElementById('nome').value.trim() || 'Você';
  const salario = parseMoney(document.getElementById('salario'));
  const horas   = parseFloat(document.getElementById('horas').value);
  const produto = parseMoney(document.getElementById('produto'));

  // Validação
  let ok = true;
  [{ id: 'salario', err: 'err-sal', val: salario },
   { id: 'horas',   err: 'err-hor', val: horas   },
   { id: 'produto', err: 'err-pro', val: produto  }]
    .forEach(({ id, err, val }) => {
      const e = document.getElementById(err);
      const i = document.getElementById(id);
      if (!val || val <= 0) { e.style.display = 'block'; i.classList.add('error-field'); ok = false; }
      else                  { e.style.display = 'none';  i.classList.remove('error-field'); }
    });
  if (!ok) return;

  const vh  = salario / horas;
  const hn  = produto / vh;
  const dn  = hn / 8;
  const ps  = (produto / salario) * 100;
  const hR  = Math.round(hn * 10) / 10;
  const dR  = Math.round(dn * 10) / 10;
  const pR  = Math.round(ps * 10) / 10;

  _lastH = hR; _lastD = dR; _lastP = pR;

  // Preencher resultados
  document.getElementById('greeting').textContent    = `Olá, ${nome}!`;
  document.getElementById('greetingSub').textContent = 'Veja o custo real do produto que você deseja adquirir.';
  document.getElementById('m-hora').textContent  = 'R$ ' + fmt(vh);
  document.getElementById('m-horas').textContent = fmt(hR, 1);
  document.getElementById('m-dias').textContent  = fmt(dR, 1);
  document.getElementById('m-perc').textContent  = fmt(pR, 1);

  // Badge de impacto
  let impact, cls;
  if (hn < 8)   { impact = 'Impacto Baixo';      cls = 'low'; }
  else if (hn < 40)  { impact = 'Impacto Moderado';   cls = 'mod'; }
  else if (hn < 160) { impact = 'Impacto Alto';        cls = 'high'; }
  else               { impact = 'Impacto Muito Alto';  cls = 'veryhigh'; }
  document.getElementById('impact-badge-wrap').innerHTML =
    `<span class="impact-badge ${cls}">● ${impact}</span>`;

  // Mensagem contextual
  let msg;
  if (hn < 8)   msg = 'Este produto custa menos de um dia do seu trabalho.';
  else if (hn < 40)  msg = 'Esta compra representa alguns dias da sua vida produtiva.';
  else if (hn < 160) msg = 'Este produto representa uma parcela relevante do seu tempo de trabalho.';
  else if (hn < 320) msg = 'Este produto equivale a aproximadamente um mês inteiro de trabalho.';
  else               msg = 'Esta compra representa mais de um mês de vida produtiva.';
  document.getElementById('msg-strip').textContent = msg;

  // Reflexão aleatória
  const refl = reflections[Math.floor(Math.random() * reflections.length)]
    .replace('{h}', fmt(hR, 1)).replace('{d}', fmt(dR, 1)).replace('{p}', fmt(pR, 1));
  document.getElementById('refl-text').textContent = refl;

  // Gráfico
  renderChart(hR, dR, pR);

  // Texto para compartilhar
  _shareText = `Descobri que preciso trabalhar ${fmt(hR, 1)} horas (${fmt(dR, 1)} dias) para comprar um produto de R$ ${fmt(produto)} no Consumo da Vida. Isso representa ${fmt(pR, 1)}% do meu salário. 💡 consumodavida.com.br`;

  // Mostrar resultados e salvar histórico
  const res = document.getElementById('results');
  res.classList.add('visible');
  saveHistory({
    produto: fmt(produto), horas: fmt(hR, 1), dias: fmt(dR, 1),
    perc: fmt(pR, 1), data: new Date().toLocaleDateString('pt-BR'),
  });
  renderHistory();
  res.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Modal QDP (atraso para não interromper a rolagem)
  setTimeout(() => openModal(nome, fmt(hR, 1), fmt(produto),
    quotes[Math.floor(Math.random() * quotes.length)]), 800);
}

/* ── Cross-tool CTAs ─────────────────────────────────────── */
function prefillFromCalc() {
  const s = document.getElementById('salario');
  const p = document.getElementById('produto');
  if (s.value) document.getElementById('p-renda').value   = s.value;
  if (p.value) document.getElementById('p-produto').value = p.value;
}

function calcToPlanejador() {
  prefillFromCalc();
  navTo('plan');
}

function planToSimulador() {
  const prod = parseMoney(document.getElementById('p-produto'));
  if (prod > 0) document.getElementById('simPrincipal').value = Math.round(prod);
  navTo('sim');
  if (simInitialized) renderSim();
}

/* ══════════════════════════════════════════════════════════
   PLANEJADOR DE COMPRAS
══════════════════════════════════════════════════════════ */
function planejar() {
  const renda   = parseMoney(document.getElementById('p-renda'));
  const produto = parseMoney(document.getElementById('p-produto'));
  const prazo   = parseInt(document.getElementById('p-prazo').value) || 0;
  const cat     = document.getElementById('p-categoria').value;

  let ok = true;
  [{ id: 'p-renda', err: 'p-err-renda', val: renda },
   { id: 'p-produto', err: 'p-err-prod', val: produto }]
    .forEach(({ id, err, val }) => {
      const e = document.getElementById(err);
      const i = document.getElementById(id);
      if (!val || val <= 0) { e.style.display = 'block'; i.classList.add('error-field'); ok = false; }
      else                  { e.style.display = 'none';  i.classList.remove('error-field'); }
    });
  if (!ok) return;

  const percRenda = (produto / renda) * 100;
  _lastPlanPerc   = percRenda;

  let peso, pClass, pIcon, pDesc;
  if (percRenda < 10) {
    peso = 'Muito Leve'; pClass = 'muito-leve'; pIcon = '💚';
    pDesc = 'Compra de baixo impacto financeiro. Pode ser adquirida com tranquilidade se for necessária ao seu cotidiano.';
  } else if (percRenda < 30) {
    peso = 'Leve'; pClass = 'leve'; pIcon = '🔵';
    pDesc = 'Compra acessível. Vale pesquisar e comparar preços antes de decidir.';
  } else if (percRenda < 75) {
    peso = 'Moderada'; pClass = 'moderada'; pIcon = '🟡';
    pDesc = 'Compra que merece planejamento. Considere guardar por alguns meses para maior poder de negociação à vista.';
  } else if (percRenda < 150) {
    peso = 'Pesada'; pClass = 'pesada'; pIcon = '🟠';
    pDesc = 'Compra de alto impacto. Planejamento cuidadoso é essencial para não comprometer seu orçamento mensal.';
  } else {
    peso = 'Muito Pesada'; pClass = 'muito-pesada'; pIcon = '🔴';
    pDesc = 'Compra de impacto muito elevado. Exige planejamento de longo prazo. Avalie alternativas antes de decidir.';
  }

  document.getElementById('peso-badge-wrap').innerHTML =
    `<span class="peso-badge ${pClass}">${pIcon} Compra ${peso}</span>`;

  document.getElementById('plan-summary').innerHTML = `
    <div class="plan-metrics">
      <div class="plan-metric"><div class="m-label">Renda mensal</div><div class="m-val azul">R$ ${fmt(renda)}</div></div>
      <div class="plan-metric"><div class="m-label">Valor do produto</div><div class="m-val">R$ ${fmt(produto)}</div></div>
      <div class="plan-metric"><div class="m-label">Impacto na renda</div><div class="m-val teal">${fmt(percRenda, 1)}%</div></div>
    </div>
    <p class="peso-desc">${pDesc}</p>`;

  const p  = Math.min(percRenda, 100);
  renderPlanChart(p, Math.max(0, 100 - p), percRenda > 100);

  // Cenários de economia
  const sc = [
    { label: 'Econômico',   perc: 10, monthly: renda * 0.10 },
    { label: 'Equilibrado', perc: 20, monthly: renda * 0.20 },
    { label: 'Acelerado',   perc: 30, monthly: renda * 0.30 },
  ];
  if (prazo > 0) {
    sc.push({ label: `Seu prazo (${prazo}m)`, perc: (produto / prazo / renda) * 100, monthly: produto / prazo, custom: true, months: prazo });
  }

  document.getElementById('scenario-grid').innerHTML = sc.map(s => {
    const months = s.custom ? s.months : Math.ceil(produto / s.monthly);
    return `<div class="scenario-card ${s.custom ? 'scenario-custom' : ''}">
      <div class="sc-label">${s.label}</div>
      <div class="sc-amount">R$ ${fmt(s.monthly)}<span style="font-size:11px;font-weight:500;color:var(--text3)">/mês</span></div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(s.perc, 100).toFixed(0)}%"></div></div>
        <span class="progress-label">${s.perc.toFixed(1)}% da renda mensal</span>
      </div>
      <div class="sc-months">${months} ${months === 1 ? 'mês' : 'meses'} para realizar</div>
    </div>`;
  }).join('');

  // Projeções de desconto
  document.getElementById('discount-section').innerHTML = `
    <p class="discount-intro">Negociando à vista, você pode economizar significativamente:</p>
    <div class="discount-grid">${[5, 10, 15].map(p => `
      <div class="discount-card">
        <div class="d-label">${p}% de desconto</div>
        <div class="d-price">R$ ${fmt(produto * (1 - p / 100))}</div>
        <div class="d-saving">+ R$ ${fmt(produto * (p / 100))} de economia</div>
      </div>`).join('')}</div>
    <p class="discount-tip">💡 Compras à vista costumam garantir descontos de 5% a 15%. Pesquise em pelo menos 3 lojas antes de decidir.</p>`;

  // Recomendações
  document.getElementById('recommendations').innerHTML = buildRecs(percRenda, prazo, cat)
    .map(r => `<div class="rec-item"><span class="rec-icon">${r.icon}</span><span>${r.text}</span></div>`)
    .join('');

  const pr = document.getElementById('plan-results');
  pr.classList.add('visible');
  pr.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Gera lista de recomendações financeiras baseadas no peso e categoria. */
function buildRecs(p, prazo, cat) {
  const r = [{ icon: '💡', text: 'Compras à vista costumam garantir descontos de 5% a 15% com boa negociação.' }];

  if (p < 10)        r.push({ icon: '✅', text: 'Compra de baixo impacto. Pode adquirir sem grandes preocupações.' }, { icon: '🔍', text: 'Comparar preços entre lojas gera economia acumulada relevante.' });
  else if (p < 30)   r.push({ icon: '🔍', text: 'Pesquise em pelo menos 3 lojas antes de fechar negócio.' }, { icon: '📅', text: 'Se não for urgente, aguardar datas promocionais pode gerar economia expressiva.' });
  else if (p < 75)   r.push({ icon: '📅', text: 'Considere guardar por 2 a 3 meses para ter maior poder de negociação à vista.' }, { icon: '⚠️', text: 'Evite parcelamentos superiores a 6x — o custo total pode aumentar consideravelmente.' }, { icon: '🏷️', text: 'Busque versões seminovas que ofereçam a mesma funcionalidade por menos.' });
  else if (p < 150)  r.push({ icon: '📅', text: 'Planejamento de médio prazo é essencial. Defina uma meta mensal e mantenha-a.' }, { icon: '⚠️', text: 'Evite comprometer mais de 30% da renda total em parcelas.' }, { icon: '🎯', text: 'Esperar alguns meses pode gerar economia real e mais tranquilidade na decisão.' });
  else               r.push({ icon: '🚨', text: 'Compra de impacto muito elevado. Planejamento de longo prazo é fundamental.' }, { icon: '📅', text: 'Defina um plano de economia de 6 a 12 meses antes de realizar a compra.' }, { icon: '⚠️', text: 'Evite parcelamentos longos — o custo total pode superar 20% do valor original.' });

  const tips = {
    eletronicos: { icon: '📱', text: 'Eletrônicos tendem a reduzir de preço. Aguardar 3 a 6 meses após lançamento pode gerar economia significativa.' },
    veiculo:     { icon: '🚗', text: 'Para veículos, considere o custo total de propriedade: seguro, IPVA, manutenção e combustível.' },
    imovel:      { icon: '🏠', text: 'Para imóveis, analise os custos de cartório, ITBI e eventuais reformas.' },
    educacao:    { icon: '📚', text: 'Investimentos em educação geram retorno de longo prazo. Verifique bolsas e financiamentos.' },
    viagem:      { icon: '✈️', text: 'Planejar viagens com 3 a 6 meses de antecedência pode gerar economias de 20% a 40%.' },
    saude:       { icon: '⚕️', text: 'Pesquise planos com cobertura equivalente a menor custo antes de pagar à vista.' },
  };
  if (tips[cat]) r.push(tips[cat]);
  return r;
}
