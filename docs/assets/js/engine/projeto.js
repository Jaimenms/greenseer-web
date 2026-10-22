/* projeto.js — do DRE ao fluxo de caixa global (porta de greenseer/projeto.py).
   Projeto (JSON):
   { id, nome, descricao, vida, investimento, aliquotaIR (null → global),
     receitas: [{nome, spec}], custos: [{nome, spec}],
     depreciacao: {modo:'linear'|'explicita'|'nenhuma', anos, valorAnual},
     valorResidual: {modo:'nenhum'|'mercado'|'perpetuidade'|'contabil', valor, tributar, crescimento},
     capitalDeGiro: {modo:'nenhum'|'constante'|'percentual'|'tabela', valor, pct, valores},
     irPrejuizo: 'compensar'|'zero' }
   Globais: { tma, aliquotaIR, taxaReinvestimento } */

import { resolver, num } from './series.js';

const zeros = n => new Array(n).fill(0);
const comZero = a => [0, ...a];

export function calcularIR(lucro, aliq, modo = 'compensar') {
  if (modo === 'zero') return lucro.map(l => Math.max(l, 0) * aliq);
  return lucro.map(l => l * aliq);
}

export function calcular(projeto, globais = {}) {
  const n = Math.max(1, Math.round(num(projeto.vida, 1)));
  const aliq = (projeto.aliquotaIR === null || projeto.aliquotaIR === undefined || projeto.aliquotaIR === '') ? num(globais.aliquotaIR) : num(projeto.aliquotaIR);
  const tma = num(globais.tma);
  const ctx = { n };

  // receitas e custos (itens nomeados; o total parcial fica no contexto para Percentual)
  const resolverItens = (itens, chave) => {
    const out = {}; let total = zeros(n); ctx[chave] = total;
    for (const it of itens || []) {
      const arr = resolver(it.spec, n, ctx);
      out[it.nome || chave] = arr; ctx[it.nome] = arr;
      total = total.map((x, i) => x + arr[i]); ctx[chave] = total;
    }
    return [out, total];
  };
  const [itensReceita, receita] = resolverItens(projeto.receitas, 'receita');
  const [itensCusto, custo] = resolverItens(projeto.custos, 'custo');
  const ebitda = receita.map((r, i) => r - custo[i]);

  // investimento sobre 0..n
  const investimento = zeros(n + 1);
  if (Array.isArray(projeto.investimento)) projeto.investimento.forEach((v, t) => { if (t <= n) investimento[t] = num(v); });
  else if (projeto.investimento && typeof projeto.investimento === 'object') Object.entries(projeto.investimento).forEach(([t, v]) => { if (+t <= n) investimento[+t] = num(v); });
  else investimento[0] = num(projeto.investimento);
  const invTotal = investimento.reduce((a, b) => a + b, 0);

  // depreciação e valor contábil
  const dep = projeto.depreciacao || { modo: 'linear' };
  let depreciacao;
  const base = (dep.base === null || dep.base === undefined || dep.base === '') ? invTotal : num(dep.base);
  if (dep.modo === 'nenhuma') depreciacao = zeros(n);
  else if (dep.modo === 'explicita') depreciacao = resolver(dep.valorAnual ?? 0, n, ctx);
  else {
    const anos = (dep.anos === null || dep.anos === undefined || dep.anos === '') ? n : Math.max(1, Math.round(num(dep.anos)));
    const anual = (base - num(dep.residualContabil)) / anos;
    depreciacao = Array.from({ length: n }, (_, i) => (i + 1 <= anos ? anual : 0));
  }
  const valorContabil = [base]; for (let t = 0; t < n; t++) valorContabil.push(valorContabil[t] - depreciacao[t]);

  const ebit = ebitda.map((e, i) => e - depreciacao[i]);
  const ir = calcularIR(ebit, aliq, projeto.irPrejuizo || 'compensar');
  const nopat = ebit.map((e, i) => e - ir[i]);
  const fco = nopat.map((x, i) => x + depreciacao[i]);
  ctx.ebit = ebit; ctx.nopat = nopat; ctx.fco = fco;

  // capital de giro: nível por período 1..n, investido no período anterior, recuperado em n
  const cg = projeto.capitalDeGiro || { modo: 'nenhum' };
  const ncg = zeros(n + 1);
  if (cg.modo && cg.modo !== 'nenhum') {
    let nivel;
    if (cg.modo === 'constante') nivel = new Array(n).fill(num(cg.valor));
    else if (cg.modo === 'percentual') nivel = receita.map(r => r * num(cg.pct));
    else nivel = resolver(cg.valores || 0, n, ctx);
    ncg[0] = -nivel[0];
    for (let t = 1; t < n; t++) ncg[t] = -(nivel[t] - nivel[t - 1]);
    ncg[n] += nivel[n - 1];
  }

  // valor residual (no último ano)
  const vr = projeto.valorResidual || { modo: 'nenhum' };
  const valorResidual = zeros(n + 1);
  let irResidual = 0;
  if (vr.modo === 'mercado') {
    const valor = num(vr.valor);
    irResidual = (vr.tributar === false) ? 0 : (valor - valorContabil[n]) * aliq;
    valorResidual[n] = valor - irResidual;
  } else if (vr.modo === 'perpetuidade') {
    const k = (vr.taxa === null || vr.taxa === undefined || vr.taxa === '') ? tma : num(vr.taxa);
    const g = num(vr.crescimento);
    const baseVr = vr.base === 'fco' ? fco[n - 1] : nopat[n - 1];
    valorResidual[n] = k - g > 0 ? baseVr / (k - g) : 0;
  } else if (vr.modo === 'contabil') valorResidual[n] = valorContabil[n];

  const outros = zeros(n + 1);
  for (const o of projeto.outrosFluxos || []) {
    const t = Math.round(num(o.ano)); if (t >= 0 && t <= n) outros[t] += num(o.valor);
  }

  const fco0 = comZero(fco);
  const fcg = fco0.map((x, t) => x - investimento[t] + ncg[t] + valorResidual[t] + outros[t]);

  return {
    nome: projeto.nome, n, aliquotaIR: aliq, irResidual, valorResidualBruto: vr.modo === 'mercado' ? num(vr.valor) : valorResidual[n],
    itensReceita: Object.fromEntries(Object.entries(itensReceita).map(([k, v]) => [k, comZero(v)])),
    itensCusto: Object.fromEntries(Object.entries(itensCusto).map(([k, v]) => [k, comZero(v)])),
    linhas: {
      receita: comZero(receita), custo: comZero(custo), ebitda: comZero(ebitda), depreciacao: comZero(depreciacao),
      ebit: comZero(ebit), ir: comZero(ir), nopat: comZero(nopat), fco: fco0,
      investimento: investimento.map(v => -v), capital_de_giro: ncg, valor_residual: valorResidual, outros, fcg,
      valor_contabil: valorContabil,
    },
    fluxo: fcg,
  };
}

/* Linhas do demonstrativo no formato do curso: [rótulo, valores(0..n), tipo] */
export function demonstrativo(calc, detalhar = true) {
  const L = calc.linhas; const out = [];
  const itR = Object.entries(calc.itensReceita), itC = Object.entries(calc.itensCusto);
  if (detalhar && itR.length > 1) itR.forEach(([k, v]) => out.push([`   Receita · ${k}`, v, 'item']));
  out.push(['Receitas', L.receita, 'linha']);
  if (detalhar && itC.length > 1) itC.forEach(([k, v]) => out.push([`   Custo · ${k}`, v, 'item']));
  out.push(['(−) Custos e despesas', L.custo, 'linha']);
  out.push(['(=) EBITDA', L.ebitda, 'total']);
  out.push(['(−) Depreciação', L.depreciacao, 'linha']);
  out.push(['(=) Lucro operacional (EBIT)', L.ebit, 'total']);
  out.push(['(−) IR', L.ir, 'linha']);
  out.push(['(=) NOPAT', L.nopat, 'total']);
  out.push(['(+) Depreciação', L.depreciacao, 'linha']);
  out.push(['(=) Fluxo de caixa operacional', L.fco, 'total']);
  out.push(['(−) Investimento', L.investimento, 'linha']);
  if (L.capital_de_giro.some(v => v !== 0)) out.push(['(∓) Capital de giro', L.capital_de_giro, 'linha']);
  if (L.valor_residual.some(v => v !== 0)) out.push(['(+) Valor residual (líquido de IR)', L.valor_residual, 'linha']);
  if (L.outros.some(v => v !== 0)) out.push(['(+) Outros fluxos', L.outros, 'linha']);
  out.push(['(=) Fluxo de caixa global', L.fcg, 'total']);
  out.push(['Memo: valor contábil do ativo', L.valor_contabil, 'memo']);
  return out;
}
