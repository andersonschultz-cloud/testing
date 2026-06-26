# 💰 Consumo da Vida · v3.0

**Hub de Inteligência Financeira** — três ferramentas, um ecossistema.

🌐 [consumodavida.com.br](https://consumodavida.com.br)

## Ferramentas

| | Ferramenta | Função |
|---|---|---|
| 🕐 | **Calculadora de Vida** | Converte preço em horas/dias de trabalho. Método QDP. |
| 📊 | **Planejador de Compras** | Avalia peso da compra, plano de economia, desconto à vista. |
| 📈 | **Simulador de Rendimentos** | Juros compostos com Selic ao vivo + instituições personalizadas. |

## Simulador v2.0 — Novidades

- **Tolerância total a falhas da API:** cache local → fallback → continua funcionando
- **AbortController:** cancel automático de fetches sobrepostos (race condition eliminada)
- **Timeout de 8s:** nunca trava aguardando a API
- **Instituições personalizadas:** adicionar, editar, excluir — persiste entre sessões
- **sanitização de HTML:** nomes de banco não causam XSS
- **computeSeries() 1×:** sem recomputação desnecessária por render
- **Y-axis inteligente:** 54.200 → 54k, 1.500.000 → 1.5M

## Deploy

```bash
git add -A && git commit -m "feat: simulador v2.0 + bancos personalizados" && git push origin main
```

GitHub Pages publica em ~1 min. DNS já configurado.

---
Desenvolvido por [Anderson Schultz Ribeiro](https://linkedin.com/in/anderson-schultz-ribeiro0001)
