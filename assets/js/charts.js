/**
 * charts.js — Consumo da Vida
 * Gerencia os gráficos Chart.js da Calculadora de Vida e do Planejador.
 * O gráfico SVG do Simulador está em simulator.js por estar fortemente
 * acoplado ao estado do simulador.
 */

/** Instâncias ativas dos gráficos (necessário para destruir antes de recriar). */
let chartInstance     = null; // gráfico de barras da Calculadora
let planChartInstance = null; // gráfico de rosca do Planejador

/**
 * Renderiza o gráfico de barras na Calculadora de Vida.
 * @param {number} horas - Horas necessárias
 * @param {number} dias  - Dias de trabalho
 * @param {number} perc  - Percentual do salário
 */
function renderChart(horas, dias, perc) {
  const ctx = document.getElementById('myChart');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const dark = isDark;
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Horas necessárias', 'Dias de trabalho', '% do salário'],
      datasets: [{
        data: [horas, dias, perc],
        backgroundColor: dark
          ? ['#5AC420', '#2E9D50', '#F5A623']
          : ['#3FA110', '#1A5E30', '#C87800'],
        borderRadius: 8,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.parsed.y}` } },
      },
      scales: {
        y: {
          grid:  { color: dark ? 'rgba(255,255,255,.05)' : 'rgba(37,99,235,.06)' },
          ticks: { color: dark ? '#475569' : '#94A3B8', font: { size: 11 } },
        },
        x: {
          grid:  { display: false },
          ticks: { color: dark ? '#475569' : '#94A3B8', font: { size: 11 }, maxRotation: 0 },
        },
      },
    },
  });
}

/**
 * Renderiza o gráfico de rosca (doughnut) no Planejador de Compras.
 * @param {number}  pp - Percentual do produto (cap. 100%)
 * @param {number}  pr - Percentual restante da renda
 * @param {boolean} ov - Se true, o produto ultrapassa a renda (vermelho)
 */
function renderPlanChart(pp, pr, ov) {
  const ctx = document.getElementById('planChart');
  if (planChartInstance) { planChartInstance.destroy(); planChartInstance = null; }

  const dark = isDark;
  planChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [ov ? 'Produto (supera a renda)' : 'Produto', 'Restante da renda'],
      datasets: [{
        data: [pp, ov ? 0 : pr],
        backgroundColor: [
          ov ? '#DC2626' : (dark ? '#F59E0B' : '#D97706'),
          dark ? '#1A3015' : '#EDF6E5',
        ],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: dark ? '#94A3B8' : '#475569',
            font: { size: 11 },
            padding: 12,
            filter: i => !(ov && i.index === 1),
          },
        },
        tooltip: { callbacks: { label: c => ` ${c.parsed.toFixed(1)}% da renda` } },
      },
    },
  });
}
