import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolver } from '../docs/assets/js/engine/series.js';
import { calcular } from '../docs/assets/js/engine/projeto.js';
import { vpl, tir, tirTodas, tirm, payback, ibc, rau, taxaFisher, indicadores } from '../docs/assets/js/engine/metricas.js';
import { mmc, replicar, equalizar, fluxoMarginal, analiseMarginal, campeaoIncremental, carteiras, ranking, componentesEmpilhadas } from '../docs/assets/js/engine/comparacao.js';
import { GAMA } from '../docs/assets/js/exemplos/gama.js';

const perto = (a, b, tol = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} esperado ${b}, obtido ${a}`);
const A = [-60000, 20000, 20000, 20000, 20000, 20000, 20000];
const B = [-72000, 45000, 22000, 20000, 13000, 13000, 13000];
const A2 = [-64000, 21000, 21000, 21000, 21000];
const B2 = [-122000, 29000, 28000, 27000, 26000, 25000, 44000];
const T = [-180000, 26200, 61200, 138200, 103200, 129200];

test('séries: crescimento, variações, percentual, produto', () => {
  assert.deepEqual(resolver({ modo: 'crescimento', base: 100, taxa: 0.1, periodos: 2 }, 4).map(x => +x.toFixed(2)), [100, 110, 121, 121]);
  assert.deepEqual(resolver({ modo: 'variacoes', base: 20, variacoes: { 4: -0.05, 6: -0.04 } }, 6).map(x => +x.toFixed(2)), [20, 20, 20, 19, 19, 18.24]);
  const ctx = { receita: [100, 200] };
  assert.deepEqual(resolver({ modo: 'percentual', pct: [0.5, 0.25], de: 'receita' }, 2, ctx), [50, 50]);
  assert.deepEqual(resolver({ modo: 'produto', fatores: [{ modo: 'constante', valor: 2 }, [3, 4]] }, 2), [6, 8]);
  assert.deepEqual(resolver({ modo: 'tabela', valores: [1, 2] }, 4), [1, 2, 2, 2]);
});

test('indicadores dos slides (Análise de Investimentos)', () => {
  perto(vpl(A, 0.10), 27105, 1); perto(payback(A, 0.10), 3.75, 0.01); perto(ibc(A, 0.10), 1.45, 0.01);
  perto(vpl(B, 0.10), 26407, 1); perto(payback(B, 0.10), 2.86, 0.01);
  perto(rau(A2, 0.10), 810, 1); perto(rau(B2, 0.10), 1356, 1);
  perto(tir(A2), 0.1184, 5e-4); perto(tir(B2), 0.1156, 5e-4);
  perto(tir(T), 0.323, 1e-3); perto(tirm(T, 0.25), 0.296, 1e-3); perto(tirm(T, 0.18), 0.270, 1e-3);
});

test('empilhamento, TIR marginal e taxa de Fisher', () => {
  assert.equal(mmc(4, 6), 12); assert.equal(mmc(5, 6, 7), 210);
  const a = replicar(A2, 3), b = replicar(B2, 2);
  assert.equal(a.length, 13); assert.equal(a[4], 21000 - 64000);
  const m = b.map((x, i) => x - a[i]);
  assert.equal(m[0], -58000); assert.equal(m[6], -99000);
  perto(tir(m), 0.1128, 1e-3); perto(vpl(m, 0.10), 3724, 1);
  perto(rau(a, 0.10), rau(A2, 0.10), 1e-6, 'RAU invariante ao empilhamento');
  const r = taxaFisher(a, b)[0]; perto(vpl(a, r), vpl(b, r), 1e-5);
  const { entradas, saidas } = componentesEmpilhadas(A2, 3);
  assert.equal(entradas[4], 21000); assert.equal(saidas[4], -64000);
});

test('múltiplas TIR', () => {
  const r = tirTodas([-100, 230, -132]);
  perto(r[0], 0.10, 1e-6); perto(r[1], 0.20, 1e-6);
});

test('caso Gama reproduz a resolução de referência', () => {
  const g = GAMA.globais; const calc = GAMA.projetos.map(p => calcular(p, g));
  const [p1, p2, p3, p4] = calc;
  assert.deepEqual(p1.fluxo, [-200000, 70000, 70000, 70000, 70000, 70000]);
  assert.deepEqual(p2.fluxo.map(x => +x.toFixed(6)), [-200000, 90000, 85000, 75000, 50000, 50000]);
  [-225000, 29040, 50352, 54787.2, 67332.48, 86115.552, 121956.72, 158556.72].forEach((v, i) => perto(p3.fluxo[i], v, 1e-3));
  [-300000, 114000, 108720, 103545.6, 73581.12, 73581.12, 93194.2598].forEach((v, i) => perto(p4.fluxo[i], v, 1e-3));
  const ind = calc.map(c => indicadores(c.fluxo, g.tma));
  perto(ind[0].vpl, 18901.97, 0.01); perto(ind[1].vpl, 30609.08, 0.01); perto(ind[2].vpl, 36440.16, 0.01); perto(ind[3].vpl, 42349.63, 0.01);
  perto(ind[3].rau, 12108.19, 0.01); perto(ind[2].rau, 9560.51, 0.01);
  perto(ind[1].tir, 0.25456, 1e-5); perto(ind[3].tir, 0.23816, 1e-5);
  perto(ind[0].payback_descontado, 4.3822, 1e-3); perto(ind[2].payback_descontado, 6.2679, 1e-3);
  perto(ind[2].ibc, 1.16196, 1e-4);
  assert.equal(p3.linhas.valor_contabil[7], 15000); perto(p3.linhas.valor_residual[7], 36600, 1e-9);
});

test('análise marginal, campeão e carteiras (Gama)', () => {
  const g = GAMA.globais;
  const fluxos = GAMA.projetos.map(p => ({ nome: p.nome, fluxo: calcular(p, g).fluxo }));
  const m23 = fluxoMarginal(fluxos[1], fluxos[2], 'mmc');
  assert.equal(m23.horizonte, 35); perto(tir(m23.fluxo), 0.17774, 1e-4); perto(vpl(m23.fluxo, g.tma), -1260.56, 0.05);
  const am = analiseMarginal(fluxos, g.tma, 'mmc');
  assert.equal(am.pares.length, 6);
  const p12 = am.pares.find(p => p.defensor === 'P1' && p.desafiante === 'P2');
  assert.ok(p12.mesmoInvestimento && Number.isNaN(p12.tirMarginal) && p12.preferido === 'P2');
  const p34 = am.pares.find(p => p.defensor === 'P3' && p.desafiante === 'P4');
  assert.equal(p34.tirs.length, 2); assert.equal(p34.preferido, 'P4'); perto(p34.vplMarginal, 14140.2, 0.5);
  const { campeao, trilha } = campeaoIncremental(fluxos, g.tma);
  assert.equal(campeao, 'P4'); assert.deepEqual(trilha.map(t => t.vence), ['P1', 'P2', 'P2', 'P4']);
  const cart = carteiras(fluxos, g.tma, { k: 2 });
  assert.equal(cart.length, 6); assert.equal(cart[0].carteira, 'P3 + P4'); perto(cart[0].vpl, 36440.16 + 42349.63, 0.05);
  const c2 = carteiras(fluxos, g.tma, { k: 2, orcamento: 450000 });
  assert.deepEqual(c2.map(c => c.carteira).sort(), ['P1 + P2', 'P1 + P3', 'P2 + P3']);
  const rk = ranking(fluxos, g.tma);
  assert.equal(rk.find(r => r.nome === 'P4').rank_vpl, 1); assert.equal(rk.find(r => r.nome === 'P2').rank_tir, 1); assert.equal(rk.find(r => r.nome === 'P3').rank_rau, 3);
});

test('equalizar estende ou empilha', () => {
  const fs = [{ nome: 'a', fluxo: A2 }, { nome: 'b', fluxo: B2 }];
  assert.ok(equalizar(fs, 'mmc').every(f => f.fluxo.length === 13));
  assert.ok(equalizar(fs, 'estender').every(f => f.fluxo.length === 7));
});

test('valor residual, capital de giro e perpetuidade', () => {
  const base = { nome: 'x', vida: 4, investimento: 100000, receitas: [{ nome: 'R', spec: 60000 }], custos: [{ nome: 'C', spec: 20000 }], aliquotaIR: 0.25 };
  const merc = calcular({ ...base, valorResidual: { modo: 'mercado', valor: 30000 } }, { tma: 0.1 });
  perto(merc.linhas.valor_residual[4], 30000 * 0.75);
  const semIR = calcular({ ...base, valorResidual: { modo: 'mercado', valor: 30000, tributar: false } }, { tma: 0.1 });
  perto(semIR.linhas.valor_residual[4], 30000);
  const perp = calcular({ ...base, valorResidual: { modo: 'perpetuidade', crescimento: 0.02 } }, { tma: 0.10 });
  perto(perp.linhas.valor_residual[4], perp.linhas.nopat[4] / 0.08);
  const cg = calcular({ nome: 'g', vida: 3, investimento: 10000, receitas: [{ nome: 'R', spec: [100, 120, 150] }], aliquotaIR: 0, capitalDeGiro: { modo: 'tabela', valores: [10, 12, 15] } }, { tma: 0.1 });
  assert.deepEqual(cg.linhas.capital_de_giro, [-10, -2, -3, 15]);
});
