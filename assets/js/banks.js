/**
 * banks.js — Consumo da Vida
 * Carrega as definições das instituições financeiras do arquivo
 * assets/data/banks.json e as converte para objetos de opção
 * do simulador.
 *
 * ► Para adicionar um novo banco: edite apenas banks.json.
 * ► Nenhuma alteração de código é necessária.
 */

/** Paleta de cores para bancos personalizados (evita conflito com padrões). */
const CUSTOM_COLORS = [
  '#7C3AED','#DB2777','#059669','#0891B2',
  '#DC2626','#9333EA','#16A34A','#B45309',
  '#0EA5E9','#E11D48',
];

/** Promessa que carrega banks.json — iniciada no startup do app. */
let _banksPromise = null;

/**
 * Carrega e valida banks.json.
 * @returns {Promise<Object[]|null>} Array de bancos ou null em caso de falha.
 */
async function loadBanks() {
  try {
    const resp = await fetch('./assets/data/banks.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    if (!json.banks || !Array.isArray(json.banks)) throw new Error('Formato inválido');
    return json.banks.filter(b => b.enabled !== false);
  } catch (e) {
    console.warn('[CDV] banks.json não disponível, usando fallback interno:', e.message);
    return null;
  }
}

/**
 * Converte um objeto de banco (banks.json) em opção do simulador.
 * @param {Object} bank  - Entrada do banks.json
 * @param {number} selic - Selic atual (% a.a.)
 * @returns {Object} Opção compatível com simState.options
 */
function bankToOption(bank, selic) {
  const rate = round2(deriveRate(bank.derive || {}, selic));
  const sub  = bank.id === 'poupanca' ? poupSub(selic) : _buildSub(bank);
  return {
    id:      bank.id,
    name:    bank.name,
    product: bank.product || bank.name,
    sub,
    rate,
    color:   bank.color   || '#64748B',
    logo:    bank.logo    || null,
    taxable: bank.taxable !== false,
    on:      true,
    derive:  bank.derive  || {},
  };
}

/** Gera o sub-label de taxa para exibição (ex: "108% do CDI"). */
function _buildSub(bank) {
  if (!bank.derive) return '';
  switch (bank.derive.base) {
    case 'cdi':      return ((bank.derive.factor || 1) * 100).toFixed(0) + '% do CDI';
    case 'selicAdd': return 'Selic + ' + (bank.derive.add || 0).toString().replace('.', ',') + '%';
    case 'manual':   return (bank.derive.rate || 0).toFixed(2).replace('.', ',') + '% a.a.';
    case 'poupanca': return poupSub(SELIC_FALLBACK);
    default:         return '';
  }
}

/**
 * Constrói o array de opções dos bancos padrão a partir dos dados carregados.
 * Chamado por initSim() após o carregamento do JSON.
 * @param {Object[]|null} banks - Bancos do JSON (null = usar fallback hardcoded)
 * @param {number} selic
 * @returns {Object[]}
 */
function buildOptionsFromBanks(banks, selic) {
  if (!banks) return _hardcodedFallback(selic);
  return banks.map(b => bankToOption(b, selic));
}

/**
 * Fallback hardcoded caso banks.json não seja acessível
 * (ex: abrir index.html diretamente do filesystem).
 */
function _hardcodedFallback(selic) {
  const s = selic || SELIC_FALLBACK;
  return [
    { id:'picpay',  name:'PicPay',            sub:'150% do CDI',     color:'#21C25E', taxable:true,  on:true, derive:{base:'cdi',factor:1.5},      logo:'https://logo.clearbit.com/picpay.com',        product:'Reserva PicPay — CDB liq. diária',            rate:round2(cdiFromSelic(s)*1.5) },
    { id:'sicredi', name:'Sicredi',            sub:'108% do CDI',     color:'#00843D', taxable:true,  on:true, derive:{base:'cdi',factor:1.08},     logo:'https://logo.clearbit.com/sicredi.com.br',    product:'CDB Sicredi — liq. diária (mín. R$1.000)',    rate:round2(cdiFromSelic(s)*1.08) },
    { id:'nubank',  name:'Nubank',             sub:'100% do CDI',     color:'#820AD1', taxable:true,  on:true, derive:{base:'cdi',factor:1},        logo:'https://logo.clearbit.com/nubank.com.br',     product:'Conta Remunerada Nubank — CDB liq. diária',   rate:round2(cdiFromSelic(s)) },
    { id:'santander',name:'Santander',         sub:'100% do CDI',     color:'#CC0000', taxable:true,  on:true, derive:{base:'cdi',factor:1},        logo:'https://logo.clearbit.com/santander.com.br',  product:'CDB DI Santander — liq. diária',              rate:round2(cdiFromSelic(s)) },
    { id:'itau',    name:'Itaú',               sub:'100% do CDI',     color:'#F47A20', taxable:true,  on:true, derive:{base:'cdi',factor:1},        logo:'https://logo.clearbit.com/itau.com.br',       product:'CDB DI Itaú — liq. diária',                   rate:round2(cdiFromSelic(s)) },
    { id:'selic24', name:'Tesouro Selic 2024', sub:'Selic + 0,1806%', color:'#2563EB', taxable:true,  on:true, derive:{base:'selicAdd',add:0.1806}, logo:'https://logo.clearbit.com/tesourodireto.com.br', product:'Título público federal — Tesouro Direto',   rate:round2(s+0.1806) },
    { id:'selic27', name:'Tesouro Selic 2027', sub:'Selic + 0,3433%', color:'#4F46E5', taxable:true,  on:true, derive:{base:'selicAdd',add:0.3433}, logo:'https://logo.clearbit.com/tesourodireto.com.br', product:'Título público federal — Tesouro Direto',   rate:round2(s+0.3433) },
    { id:'poupanca',name:'Poupança',           sub:poupSub(s),        color:'#D97706', taxable:false, on:true, derive:{base:'poupanca'},            logo:null,                                          product:'Conta poupança — qualquer banco',              rate:round2(deriveRate({base:'poupanca'},s)) },
  ];
}

/**
 * Escolhe a próxima cor disponível para um banco personalizado,
 * evitando repetição com os já em uso.
 */
function nextCustomColor() {
  const used = simState.options.filter(o => o.custom).map(o => o.color);
  return CUSTOM_COLORS.find(c => !used.includes(c))
    || CUSTOM_COLORS[simState.options.filter(o => o.custom).length % CUSTOM_COLORS.length];
}
