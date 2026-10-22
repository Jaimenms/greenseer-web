/* comparacao.js — vidas diferentes, análise marginal, carteiras e ranking (porta de greenseer/comparacao.py). */

import { vpl, tir, tirTodas, tirm, rau, ibc, payback, indicadores, METRICAS } from './metricas.js';

export const mdc = (a, b) => (b ? mdc(b, a % b) : a);
export const mmc = (...v) => v.reduce((r, x) => (r * x) / mdc(r, x), 1);

export function replicar(v, ciclos) {
  const n = v.length - 1; const out = new Array(n * ciclos + 1).fill(0);
  for (let k = 0; k < ciclos; k++) for (let t = 0; t <= n; t++) out[k * n + t] += v[t];
  return out;
}
export function estender(v, H) { return [...v, ...new Array(Math.max(0, H - (v.length - 1))).fill(0)]; }
export function somar(fluxos) {
  const L = Math.max(...fluxos.map(f => f.length)); const out = new Array(L).fill(0);
  fluxos.forEach(f => f.forEach((x, t) => { out[t] += x; }));
  return out;
}

/* Entradas (≥0) e saídas (≤0) por ano de um fluxo empilhado, sem somar o fim de um ciclo com o início do próximo. */
export function componentesEmpilhadas(v, ciclos) {
  const n = v.length - 1; const H = n * ciclos;
  const entradas = new Array(H + 1).fill(0), saidas = new Array(H + 1).fill(0);
  for (let k = 0; k < ciclos; k++) for (let t = 0; t <= n; t++) { if (v[t] > 0) entradas[k * n + t] += v[t]; else saidas[k * n + t] += v[t]; }
  return { entradas, saidas };
}

/* fluxos: [{nome, fluxo}] → [{nome, fluxo, ciclos}] com o mesmo horizonte */
export function equalizar(fluxos, metodo = 'mmc') {
  const vidas = fluxos.map(f => f.fluxo.length - 1);
  if (metodo === 'mmc') {
    const H = mmc(...vidas);
    return fluxos.map(f => ({ ...f, ciclos: H / (f.fluxo.length - 1), fluxo: replicar(f.fluxo, H / (f.fluxo.length - 1)) }));
  }
  const H = Math.max(...vidas);
  return fluxos.map(f => ({ ...f, ciclos: 1, fluxo: estender(f.fluxo, H) }));
}

export function fluxoMarginal(defensor, desafiante, metodo = 'mmc') {
  const [a, b] = equalizar([defensor, desafiante], metodo);
  return { nome: `${b.nome} − ${a.nome}`, fluxo: b.fluxo.map((x, t) => x - a.fluxo[t]), horizonte: b.fluxo.length - 1, a, b };
}

const porInvestimento = fluxos => [...fluxos].sort((x, y) => (-x.fluxo[0]) - (-y.fluxo[0]) || x.nome.localeCompare(y.nome));

export function analiseMarginal(fluxos, taxa, metodo = 'mmc', taxaReinv = null) {
  const ord = porInvestimento(fluxos); const linhas = [];
  for (let i = 0; i < ord.length; i++) for (let j = i + 1; j < ord.length; j++) {
    const a = ord[i], b = ord[j];
    const m = fluxoMarginal(a, b, metodo);
    const invMarg = -m.fluxo[0];
    const raizes = tirTodas(m.fluxo);
    const mesmoInv = Math.abs(invMarg) < 1e-9;
    const tirMarg = mesmoInv || !raizes.length ? NaN : raizes.reduce((best, x) => (Math.abs(x) < Math.abs(best) ? x : best), raizes[0]);
    const v = vpl(m.fluxo, taxa);
    linhas.push({
      defensor: a.nome, desafiante: b.nome, horizonte: m.horizonte, investimentoMarginal: invMarg,
      vplMarginal: v, tirMarginal: tirMarg, tirs: raizes, mesmoInvestimento: mesmoInv,
      tirmMarginal: tirm(m.fluxo, taxaReinv ?? taxa), rauMarginal: rau(m.fluxo, taxa),
      preferido: v > 0 ? b.nome : a.nome, fluxo: m.fluxo, fluxoA: m.a.fluxo, fluxoB: m.b.fluxo, ciclosA: m.a.ciclos, ciclosB: m.b.ciclos,
    });
  }
  return { ordem: ord.map(f => f.nome), pares: linhas };
}

export function campeaoIncremental(fluxos, taxa, metodo = 'mmc') {
  const ord = porInvestimento(fluxos); let defensor = null; const trilha = [];
  for (const f of ord) {
    if (!defensor) {
      const v = vpl(f.fluxo, taxa);
      trilha.push({ defensor: '—', desafiante: f.nome, vplMarginal: v, tirMarginal: tir(f.fluxo), vence: v > 0 ? f.nome : '—' });
      if (v > 0) defensor = f; continue;
    }
    const m = fluxoMarginal(defensor, f, metodo); const v = vpl(m.fluxo, taxa);
    const vence = v > 0 ? f : defensor;
    trilha.push({ defensor: defensor.nome, desafiante: f.nome, vplMarginal: v, tirMarginal: tir(m.fluxo), vence: vence.nome });
    defensor = vence;
  }
  return { campeao: defensor ? defensor.nome : '—', trilha };
}

function combinacoes(arr, k) {
  const out = [];
  const rec = (start, combo) => { if (combo.length === k) { out.push([...combo]); return; } for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); } };
  rec(0, []); return out;
}

export function carteiras(fluxos, taxa, { k = null, orcamento = null, taxaReinv = null } = {}) {
  const tamanhos = k ? [k] : fluxos.map((_, i) => i + 1);
  const ind = Object.fromEntries(fluxos.map(f => [f.nome, indicadores(f.fluxo, taxa, taxaReinv)]));
  const linhas = [];
  for (const tam of tamanhos) for (const combo of combinacoes(fluxos, tam)) {
    const inv = combo.reduce((s, f) => s - f.fluxo[0], 0);
    if (orcamento !== null && orcamento !== undefined && orcamento !== '' && inv > Number(orcamento) + 1e-9) continue;
    const agg = somar(combo.map(f => f.fluxo));
    linhas.push({
      carteira: combo.map(f => f.nome).join(' + '), projetos: combo.map(f => f.nome), n: combo.length, investimento: inv,
      vpl: vpl(agg, taxa), rauSoma: combo.reduce((s, f) => s + ind[f.nome].rau, 0), tir: tir(agg), tirm: tirm(agg, taxaReinv ?? taxa),
      ibc: ibc(agg, taxa), paybackDescontado: payback(agg, taxa), horizonte: agg.length - 1, fluxo: agg,
    });
  }
  return linhas.sort((a, b) => b.vpl - a.vpl);
}

export function ranking(fluxos, taxa, taxaReinv = null) {
  const linhas = fluxos.map(f => ({ nome: f.nome, ...indicadores(f.fluxo, taxa, taxaReinv) }));
  for (const m of METRICAS) {
    const vals = linhas.map(l => l[m.chave]);
    const ord = linhas.map((_, i) => i).filter(i => Number.isFinite(vals[i])).sort((i, j) => (m.maiorMelhor ? vals[j] - vals[i] : vals[i] - vals[j]));
    linhas.forEach(l => { l[`rank_${m.chave}`] = NaN; });
    ord.forEach((i, pos) => { linhas[i][`rank_${m.chave}`] = pos + 1; });
  }
  return linhas;
}
