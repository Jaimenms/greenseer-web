/* metricas.js — indicadores de avaliação (porta de greenseer/metricas.py).
   Todas as funções recebem um array de fluxos v[0..n] (instante zero na posição 0). */

export const LIMITES_TIR = [-0.9, 10];

export function horner(v, taxa) {           // VPL por Horner em x = 1/(1+i)
  const x = 1 / (1 + taxa); let acc = 0;
  for (let k = v.length - 1; k >= 0; k--) acc = acc * x + v[k];
  return acc;
}
export const vpl = (v, taxa) => horner(v, taxa);
export function vp(v, taxa, aPartirDe = 1) { const w = v.map((x, t) => (t >= aPartirDe ? x : 0)); return horner(w, taxa); }
export function vplPerfil(v, taxas) { return taxas.map(r => horner(v, r)); }

export function fatorValorAtual(taxa, n) { return taxa === 0 ? n : (1 - Math.pow(1 + taxa, -n)) / taxa; }
export function fatorRecuperacaoCapital(taxa, n) { return 1 / fatorValorAtual(taxa, n); }

function bissecao(v, lo, hi, flo) {
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi), fm = horner(v, mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
    if (hi - lo < 1e-13) break;
  }
  return 0.5 * (lo + hi);
}

/* Todas as TIR reais no intervalo (varredura + bissecção). */
export function tirTodas(v, limites = LIMITES_TIR) {
  const [lo, hi] = limites;
  const grade = [];
  for (let i = 0; i < 60; i++) grade.push(lo + (-0.01 - lo) * i / 59);
  for (let i = 0; i <= 400; i++) grade.push(i / 400);
  for (let i = 0; i < 150; i++) grade.push(1.02 + (hi - 1.02) * i / 149);
  const f = grade.map(r => horner(v, r));
  const raizes = [];
  for (let i = 0; i < grade.length - 1; i++) {
    if (f[i] === 0) raizes.push(grade[i]);
    else if (f[i] * f[i + 1] < 0) raizes.push(bissecao(v, grade[i], grade[i + 1], f[i]));
  }
  const uniq = [];
  for (const r of raizes) if (!uniq.some(u => Math.abs(u - r) < 1e-9)) uniq.push(r);
  return uniq.sort((a, b) => a - b);
}
export function tir(v) {
  const r = tirTodas(v);
  if (!r.length) return NaN;
  return r.reduce((best, x) => (Math.abs(x) < Math.abs(best) ? x : best), r[0]);
}

export function tirm(v, taxaReinv, taxaFin = null) {
  const n = v.length - 1; const tf = taxaFin ?? taxaReinv;
  let vf = 0, vpn = 0;
  v.forEach((x, t) => { if (x > 0) vf += x * Math.pow(1 + taxaReinv, n - t); else if (x < 0) vpn -= x * Math.pow(1 + tf, -t); });
  if (vpn <= 0 || n <= 0) return NaN;
  return Math.pow(vf / vpn, 1 / n) - 1;
}

export function payback(v, taxa = null) {
  const w = taxa === null ? v : v.map((x, t) => x * Math.pow(1 + taxa, -t));
  let cum = w[0];
  if (cum >= 0) return 0;
  for (let t = 1; t < w.length; t++) {
    const prev = cum; cum += w[t];
    if (prev < 0 && cum >= 0) return (t - 1) + (w[t] !== 0 ? -prev / w[t] : 0);
  }
  return NaN;
}

export function ibc(v, taxa) {
  const pos = v.map(x => (x > 0 ? x : 0)), neg = v.map(x => (x < 0 ? -x : 0));
  const d = horner(neg, taxa); return d > 0 ? horner(pos, taxa) / d : NaN;
}
export function rau(v, taxa, n = null) { const m = n ?? v.length - 1; return vpl(v, taxa) * fatorRecuperacaoCapital(taxa, m); }
export function roia(v, taxa) { const n = v.length - 1; return Math.pow(ibc(v, taxa), 1 / n) - 1; }

export function alinhar(a, b) {
  const L = Math.max(a.length, b.length);
  const pad = x => [...x, ...new Array(L - x.length).fill(0)];
  return [pad(a), pad(b)];
}
export function taxaFisher(a, b) { const [x, y] = alinhar(a, b); return tirTodas(y.map((v, i) => v - x[i])); }

export function indicadores(v, taxa, taxaReinv = null) {
  const tr = taxaReinv ?? taxa;
  const raizes = tirTodas(v);
  return {
    investimento: -v[0], vida: v.length - 1,
    vpl: vpl(v, taxa), tir: raizes.length ? raizes.reduce((b, x) => (Math.abs(x) < Math.abs(b) ? x : b), raizes[0]) : NaN, tirs: raizes,
    tirm: tirm(v, tr), rau: rau(v, taxa), ibc: ibc(v, taxa), roia: roia(v, taxa),
    payback: payback(v), payback_descontado: payback(v, taxa),
  };
}

export const METRICAS = [
  { chave: 'vpl', rotulo: 'VPL', formato: 'moeda', maiorMelhor: true, descricao: 'Valor presente líquido à TMA' },
  { chave: 'rau', rotulo: 'RAU', formato: 'moeda', maiorMelhor: true, descricao: 'Resultado anual uniforme (VPL anualizado na vida do projeto)' },
  { chave: 'tir', rotulo: 'TIR', formato: 'pct', maiorMelhor: true, descricao: 'Taxa interna de retorno' },
  { chave: 'tirm', rotulo: 'TIRM', formato: 'pct', maiorMelhor: true, descricao: 'TIR modificada (reinvestimento à taxa informada)' },
  { chave: 'ibc', rotulo: 'IBC', formato: 'num', maiorMelhor: true, descricao: 'Índice benefício/custo' },
  { chave: 'roia', rotulo: 'ROIA', formato: 'pct', maiorMelhor: true, descricao: 'Retorno adicional sobre o investimento, por ano' },
  { chave: 'payback', rotulo: 'Payback simples', formato: 'anos', maiorMelhor: false, descricao: 'Tempo de recuperação sem desconto' },
  { chave: 'payback_descontado', rotulo: 'Payback ajustado', formato: 'anos', maiorMelhor: false, descricao: 'Tempo de recuperação com desconto à TMA' },
];
