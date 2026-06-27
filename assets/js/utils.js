/**
 * utils.js — Consumo da Vida
 * Funções utilitárias puras: formatação, parsing e helpers de texto.
 * Sem dependências externas. Sem acesso ao DOM.
 */

/** Formata número no locale pt-BR com casas decimais configuráveis. */
function fmt(n, dec = 2) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Escapa HTML para prevenir XSS em conteúdo gerado pelo usuário. */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Aplica máscara de moeda BRL ao input enquanto o usuário digita. */
function applyMask(input) {
  const raw = input.value.replace(/\D/g, '');
  if (!raw) { input.value = ''; return; }
  input.value = 'R$ ' + (parseInt(raw, 10) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

/** Converte string BRL "R$ 1.234,56" em número float. */
function parseMoney(input) {
  return parseFloat(input.value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Converte número de meses em rótulo legível.
 * @example yearsLabel(13) → "1a 1m"
 */
function yearsLabel(m) {
  const y  = Math.floor(m / 12);
  const mo = m % 12;
  if (m === 0)  return 'hoje';
  if (mo === 0) return y + (y === 1 ? ' ano' : ' anos');
  if (y === 0)  return mo + (mo === 1 ? ' mês' : ' meses');
  return y + 'a ' + mo + 'm';
}
