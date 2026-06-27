# Arquitetura — Consumo da Vida

## Visão geral

Single-Page Application em Vanilla JS puro hospedada no GitHub Pages.
Sem build step, sem frameworks, sem backend — apenas HTML, CSS e JavaScript.

## Estrutura de arquivos

```
/
├── index.html               # Shell HTML — apenas estrutura, sem lógica
├── CNAME                    # Domínio personalizado
├── .nojekyll               # Impede processamento Jekyll do GitHub Pages
│
├── assets/
│   ├── css/
│   │   ├── variables.css   # ÚNICO lugar para cores e tokens de design
│   │   ├── style.css       # Base, reset, layout, nav, home, footer
│   │   ├── components.css  # Todos os componentes reutilizáveis + comparison cards
│   │   └── responsive.css  # Todos os @media queries
│   │
│   ├── js/
│   │   ├── utils.js        # fmt, escHtml, applyMask, parseMoney, yearsLabel
│   │   ├── storage.js      # localStorage: Selic cache, bancos custom, histórico
│   │   ├── calculator.js   # Matemática financeira pura (buildSeries, irRate, etc.)
│   │   ├── api.js          # API do Banco Central + tolerância a falhas
│   │   ├── banks.js        # Carrega banks.json → converte em opções do simulador
│   │   ├── charts.js       # Chart.js wrappers (Calculadora + Planejador)
│   │   ├── simulator.js    # Estado + render do simulador + comparison cards
│   │   ├── ui.js           # Tema, navegação SPA, modal, histórico (render)
│   │   └── app.js          # Entry point: DOMContentLoaded + Calculadora + Planejador
│   │
│   ├── data/
│   │   └── banks.json      # ← EDITE AQUI para adicionar/remover bancos
│   │
│   └── img/
│       ├── logo/logo.png   # Logo principal (143 KB)
│       ├── banks/          # Logos locais de bancos (atualmente via Clearbit CDN)
│       ├── icons/          # Ícones SVG futuros
│       └── favicon/        # Ícones PWA futuros
│
└── docs/
    ├── arquitetura.md      # Este arquivo
    └── changelog.md        # Histórico de versões
```

## Ordem de carregamento dos scripts

```html
utils.js       ← sem dependências
storage.js     ← depende: —
calculator.js  ← depende: —
api.js         ← depende: storage, calculator, simulator (simState, syncDerivedRates, renderSim)
banks.js       ← depende: calculator (deriveRate, round2, cdiFromSelic, poupSub, SELIC_FALLBACK)
charts.js      ← depende: ui (isDark)
simulator.js   ← depende: utils, storage, calculator, api, banks, ui (isDark)
ui.js          ← depende: charts, simulator (simInitialized, initSim)
app.js         ← depende: todos os anteriores
```

## Como adicionar um novo banco

1. Abra `assets/data/banks.json`
2. Adicione um objeto ao array `banks`:

```json
{
  "id": "novo_banco",
  "name": "Novo Banco",
  "category": "fintech",
  "product": "CDB — liquidez diária",
  "derive": { "base": "cdi", "factor": 1.12 },
  "color": "#005CA9",
  "logo": "https://logo.clearbit.com/novobanco.com.br",
  "taxable": true,
  "enabled": true,
  "minInvestment": 1
}
```

3. Faça o deploy. Nenhuma outra alteração de código é necessária.

### Tipos de `derive.base`

| base       | campos extras     | descrição                          |
|------------|-------------------|------------------------------------|
| `cdi`      | `factor` (1.0)    | Percentual do CDI (1.1 = 110% CDI) |
| `selicAdd` | `add` (0.0)       | Selic + spread fixo                |
| `manual`   | `rate` (%)        | Taxa fixa % a.a.                   |
| `poupanca` | —                 | Regra legal da poupança            |

## Tolerância a falhas — API do Banco Central

A taxa Selic é obtida via `fetch()` com 3 camadas:

```
1. API ao vivo   → sempre tentada primeiro
2. Cache local   → localStorage com timestamp
3. Fallback 14,5% → o simulador NUNCA para de funcionar
```

Race condition evitada com `AbortController`: novo fetch cancela o anterior.

## Como hospedar

```bash
git add -A
git commit -m "descrição"
git push origin main
# GitHub Pages publica automaticamente
```

DNS configurado: `consumodavida.com.br` → CNAME `andersonschultz-cloud.github.io`
