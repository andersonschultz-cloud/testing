# 💰 Consumo da Vida — v5.0

**Hub de Inteligência Financeira para educação financeira consciente.**

🌐 **[consumodavida.com.br](https://consumodavida.com.br)**

## Ferramentas

| | Ferramenta | O que faz |
|---|---|---|
| 🕐 | **Calculadora de Vida** | Converte preço em horas/dias de trabalho. Método QDP. |
| 📊 | **Planejador de Compras** | Avalia peso da compra, plano de economia, desconto à vista. |
| 📈 | **Simulador de Rendimentos** | Juros compostos com Selic ao vivo + 8 instituições + comparison cards. |

## Estrutura do projeto

```
assets/css/        → Design System modular (4 arquivos)
assets/js/         → Módulos JavaScript (9 arquivos)
assets/data/       → banks.json (fonte de dados dos bancos)
assets/img/logo/   → Logo da plataforma
docs/              → Arquitetura e changelog
```

## Adicionar um banco

Edite apenas `assets/data/banks.json` — nenhum código precisa ser alterado.

## Deploy

```bash
git add -A && git commit -m "descrição" && git push origin main
```

---
Desenvolvido por [Anderson Schultz Ribeiro](https://linkedin.com/in/anderson-schultz-ribeiro0001)
