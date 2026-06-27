# Changelog — Consumo da Vida

## v5.0.0 — Refatoração Modular (2026-06)

### Breaking changes
- Projeto migrado de single-file (`index.html` ~520KB) para arquitetura modular
- Logo extraída do base64 inline para `assets/img/logo/logo.png`
- Bancos movidos de código JavaScript para `assets/data/banks.json`

### Novo
- `assets/css/variables.css` — tokens centralizados (cores, espaçamentos)
- `assets/css/style.css` — base, layout, navegação, home, footer
- `assets/css/components.css` — todos os componentes + comparison cards
- `assets/css/responsive.css` — todos os media queries centralizados
- `assets/js/utils.js` — utilitários puros sem side effects
- `assets/js/storage.js` — camada de localStorage isolada e documentada
- `assets/js/calculator.js` — matemática financeira pura e testável
- `assets/js/api.js` — integração BCB com tolerância a falhas completa
- `assets/js/banks.js` — carregamento de banks.json com fallback hardcoded
- `assets/js/charts.js` — Chart.js wrappers isolados
- `assets/js/simulator.js` — estado + CRUD + renders do simulador
- `assets/js/ui.js` — tema, navegação, modal
- `assets/js/app.js` — entry point com Calculadora e Planejador
- `assets/data/banks.json` — definições das instituições financeiras

### Corrigido
- **Comparison cards**: simulador agora exibe TODAS as instituições com cálculo detalhado
  individual (investido, bruto, juros, líquido, IR) no ponto do scrub atual
- Cada banco usa corretamente seu próprio percentual do CDI
- Líder destacado com borda teal + badge "Melhor resultado"
- `computeSeries()` chamado apenas 1× por ciclo de render (sem recomputação)

---

## v4.0.0 — Sicredi, Santander, Itaú + Logos (2026-06)

- 3 novas instituições adicionadas ao simulador
- Logos via Clearbit API com fallback gracioso
- Cores de marca para todas as instituições

## v3.0.0 — Simulador v2 (2026-06)

- Cache Selic com AbortController
- CRUD de bancos personalizados com persistência
- Escaping HTML (XSS prevention)

## v2.0.0 — Hub Integrado (2026-06)

- Calculadora + Planejador + Simulador em uma SPA
- Navegação fluida entre ferramentas
- Cross-tool CTAs
- Design System v4.0

## v1.0.0 — Lançamento (2026)

- Calculadora de Vida com Método QDP
- Simulador de Rendimentos standalone
