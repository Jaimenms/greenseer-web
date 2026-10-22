/* charts.js — gráficos ECharts: diagrama de setas, perfil do VPL, painéis de indicadores, matriz marginal, carteiras. */
import { tokens, onThemeChange, reducedMotion } from './chrome.js';
import { fmt, formatar } from './format.js';
import { vplPerfil, tirTodas, taxaFisher, METRICAS } from '../engine/metricas.js';

const instancias = new Map();
let ro = null;
export function chart(el, option, opts = { notMerge: true }) {
  if (!el) return null;
  let c = instancias.get(el);
  if (!c) { c = echarts.init(el, null, { renderer: 'canvas' }); instancias.set(el, c); if (!ro) ro = new ResizeObserver(es => es.forEach(e => instancias.get(e.target)?.resize())); ro.observe(el); }
  c.setOption(option, opts);
  return c;
}
export function limpar(el) { const c = instancias.get(el); if (c) { c.clear(); } }
export function dispor(el) { const c = instancias.get(el); if (c) { c.dispose(); instancias.delete(el); ro?.unobserve(el); } }
let rerenderAll = null;
export function aoMudarTema(fn) { rerenderAll = fn; }
onThemeChange(() => rerenderAll && rerenderAll());

export const corProjeto = (i, t = tokens()) => t.series[i % t.series.length];

function base(t) {
  return {
    textStyle: { fontFamily: t.font, color: t.ink2 },
    animationDuration: reducedMotion ? 0 : 700, animationDurationUpdate: reducedMotion ? 0 : 400, animationEasing: 'cubicOut',
    tooltip: { backgroundColor: t.surface, borderColor: t.grid, borderWidth: 1, padding: [8, 12], textStyle: { color: t.ink, fontSize: 13, fontFamily: t.font }, extraCssText: 'box-shadow: 0 8px 24px -8px rgba(0,0,0,.25); border-radius: 10px;' },
  };
}
const axVal = (t, extra = {}) => ({ type: 'value', splitNumber: 4, splitLine: { lineStyle: { color: t.grid } }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, hideOverlap: true, formatter: fmt.compact }, ...extra });

/* ---------- diagrama de fluxo de caixa com setas ---------- */
/* paineis: [{ titulo, componentes: [{nome, valores(0..H), cor}] }] — positivos empilham para cima, negativos para baixo. */
export function optDiagrama(paineis, t, { legenda = true, altura = 340 } = {}) {
  const H = Math.max(...paineis.map(p => Math.max(...p.componentes.map(c => c.valores.length)))) - 1;
  const n = paineis.length;
  const topPx = legenda ? 46 : 22, bottomPx = 40, gap = 30;
  const hPainel = Math.max(80, (altura - topPx - bottomPx - (n - 1) * gap) / n);
  const grids = [], xAxes = [], yAxes = [], series = [], titles = [];
  const legendaItens = new Map();
  paineis.forEach((p, gi) => {
    const dados = []; const baseCima = new Array(H + 1).fill(0), baseBaixo = new Array(H + 1).fill(0);
    let ymin = 0, ymax = 0;
    for (const comp of p.componentes) {
      comp.valores.forEach((v, tt) => {
        if (!v) return;
        const b = v > 0 ? baseCima : baseBaixo;
        dados.push({ value: [tt, b[tt], b[tt] + v], nome: comp.nome, cor: comp.cor, valor: v, painel: p.titulo });
        b[tt] += v; ymin = Math.min(ymin, baseBaixo[tt]); ymax = Math.max(ymax, baseCima[tt]);
      });
      if (!legendaItens.has(comp.nome)) legendaItens.set(comp.nome, comp.cor);
    }
    const folga = 0.16 * ((ymax - ymin) || 1);
    const top = topPx + gi * (hPainel + gap);
    grids.push({ left: 70, right: 22, top, height: hPainel });
    if (n > 1 || p.titulo) titles.push({ text: p.titulo, left: 70, top: top - 20, textStyle: { fontSize: 12.5, fontWeight: 600, color: t.ink2, fontFamily: t.font } });
    xAxes.push({ type: 'value', gridIndex: gi, min: -0.7, max: H + 0.7, interval: H > 24 ? 5 : 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: t.muted, show: gi === n - 1, formatter: v => (Number.isInteger(v) ? v : '') }, name: gi === n - 1 ? 'Ano' : '', nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: t.muted, fontSize: 11.5, fontWeight: 600 } });
    yAxes.push({ type: 'value', gridIndex: gi, min: ymin - folga, max: ymax + folga, splitNumber: 3, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.muted, formatter: fmt.compact, fontSize: 11 } });
    series.push({
      type: 'custom', xAxisIndex: gi, yAxisIndex: gi, data: dados, clip: true, z: 3,
      renderItem: (params, api) => {
        const x = api.coord([api.value(0), 0])[0]; const y0 = api.coord([0, api.value(1)])[1]; const y1 = api.coord([0, api.value(2)])[1];
        const d = dados[params.dataIndex]; const up = api.value(2) > api.value(1); const head = Math.min(9, Math.abs(y1 - y0)); const dir = up ? 1 : -1;
        return { type: 'group', children: [
          { type: 'line', shape: { x1: x, y1: y0, x2: x, y2: y1 + dir * head }, style: { stroke: d.cor, lineWidth: 2.5 } },
          { type: 'polygon', shape: { points: [[x, y1], [x - 5.5, y1 + dir * head], [x + 5.5, y1 + dir * head]] }, style: { fill: d.cor } },
        ] };
      },
      tooltip: { trigger: 'item', formatter: p => { const d = dados[p.dataIndex]; return `<b>${d.painel}</b> · ano ${d.value[0]}<br><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${d.cor};margin-right:6px"></span>${d.nome}: <b>${fmt.moeda(d.valor)}</b>`; } },
    });
    series.push({ type: 'line', xAxisIndex: gi, yAxisIndex: gi, data: [[-0.7, 0], [H + 0.7, 0]], showSymbol: false, lineStyle: { color: t.ink, width: 1.5 }, silent: true, z: 2, animation: false });
  });
  return {
    ...base(t), tooltip: { ...base(t).tooltip, trigger: 'item' },
    legend: legenda ? { top: 0, left: 0, icon: 'rect', itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: t.ink2, fontSize: 12 }, data: [...legendaItens.keys()].map(nm => ({ name: nm, itemStyle: { color: legendaItens.get(nm) } })), selectedMode: false } : { show: false },
    title: titles, grid: grids, xAxis: xAxes, yAxis: yAxes, series,
  };
}

/* ---------- perfil do VPL ---------- */
export function optPerfil(fluxos, tma, cores, t, { max = 0.45, fisher = true, tituloMarg = null } = {}) {
  const taxas = Array.from({ length: 181 }, (_, i) => (i / 180) * max);
  const series = fluxos.map((f, i) => {
    const ys = vplPerfil(f.fluxo, taxas);
    const tirs = tirTodas(f.fluxo).filter(r => r >= 0 && r <= max);
    return { name: f.nome, type: 'line', data: taxas.map((r, k) => [r, ys[k]]), showSymbol: false, symbol: 'circle', symbolSize: 8, lineStyle: { width: 2, color: cores[i] }, itemStyle: { color: cores[i] }, emphasis: { focus: 'series' },
      markPoint: { symbol: 'circle', symbolSize: 10, itemStyle: { color: cores[i], borderColor: t.surface, borderWidth: 2 }, label: { show: false }, data: tirs.map(r => ({ coord: [r, 0], value: r, name: `TIR ${fmt.pct(r)}` })), tooltip: { formatter: p => `<b>${f.nome}</b> · TIR ${fmt.pct2(p.data.value)}` } } };
  });
  const pontos = [];
  if (fisher && fluxos.length > 1) for (let i = 0; i < fluxos.length; i++) for (let j = i + 1; j < fluxos.length; j++) {
    for (const r of taxaFisher(fluxos[i].fluxo, fluxos[j].fluxo)) if (r > 1e-6 && r <= max) {
      const L = Math.max(fluxos[i].fluxo.length, fluxos[j].fluxo.length); const fi = [...fluxos[i].fluxo, ...new Array(L - fluxos[i].fluxo.length).fill(0)];
      pontos.push({ value: [r, vplPerfil(fi, [r])[0]], par: `${fluxos[i].nome} × ${fluxos[j].nome}` });
    }
  }
  if (pontos.length) series.push({ name: 'Taxa de Fisher', type: 'scatter', data: pontos, symbol: 'diamond', symbolSize: 12, itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 }, z: 5, tooltip: { formatter: p => `<b>Fisher ${p.data.par}</b><br>taxa ${fmt.pct2(p.value[0])} · VPL ${fmt.moeda(p.value[1])}` } });
  series[0].markLine = { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed', width: 1 }, label: { color: t.ink2, fontSize: 11, formatter: p => (p.data.xAxis !== undefined ? `TMA ${fmt.pct(p.data.xAxis)}` : ''), position: 'insideEndTop' }, data: [{ xAxis: tma }, { yAxis: 0, label: { show: false }, lineStyle: { color: t.axis, type: 'solid' } }] };
  return {
    ...base(t), color: cores,
    tooltip: { ...base(t).tooltip, trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: t.ink2 } }, formatter: ps => { const r = ps[0].value[0]; return `<b>taxa ${fmt.pct2(r)}</b><br>` + ps.filter(p => p.seriesType === 'line').map(p => `${p.marker} ${p.seriesName}: <b>${fmt.moeda(p.value[1])}</b>`).join('<br>'); } },
    legend: { top: 0, left: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { color: t.ink2, fontSize: 12.5 }, data: fluxos.map(f => f.nome).concat(pontos.length ? ['Taxa de Fisher'] : []) },
    grid: { left: 10, right: 20, top: 44, bottom: 56, containLabel: true },
    xAxis: { type: 'value', min: 0, max, axisLabel: { color: t.muted, formatter: v => fmt.pct(v) }, axisLine: { lineStyle: { color: t.axis } }, splitLine: { show: false }, name: 'Taxa de desconto', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 11.5, fontWeight: 600 } },
    yAxis: axVal(t, { name: 'VPL', nameTextStyle: { color: t.muted, fontSize: 11 } }),
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }, { type: 'slider', xAxisIndex: 0, height: 16, bottom: 6, borderColor: t.grid, fillerColor: 'rgba(42,120,214,.15)', handleStyle: { color: t.surface, borderColor: t.axis }, textStyle: { color: t.muted, fontSize: 10 }, labelFormatter: v => fmt.pct(v), filterMode: 'none' }],
    series,
  };
}

/* ---------- mini painel de um indicador ---------- */
export function optIndicador(linhas, metrica, cores, t, { referencia = null } = {}) {
  const m = METRICAS.find(x => x.chave === metrica);
  const vals = linhas.map(l => l[metrica]);
  const fin = vals.filter(Number.isFinite);
  const melhor = fin.length ? (m.maiorMelhor ? Math.max(...fin) : Math.min(...fin)) : null;
  const lo = Math.min(0, ...fin, referencia ?? 0), hi = Math.max(0, ...fin, referencia ?? 0);
  return {
    ...base(t), tooltip: { ...base(t).tooltip, trigger: 'item', formatter: p => `<b>${p.name}</b><br>${m.rotulo}: ${formatar(p.value, m.formato)}` },
    grid: { left: 6, right: 70, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: 'value', min: lo - 0.05 * (hi - lo || 1), max: hi + 0.35 * (hi - lo || 1), show: false },
    yAxis: { type: 'category', data: linhas.map(l => l.nome), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: 12 } },
    series: [{ type: 'bar', data: vals.map((v, i) => ({ value: Number.isFinite(v) ? v : 0, itemStyle: { color: cores[i], borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 18, barCategoryGap: '35%',
      label: { show: true, position: 'right', color: t.ink2, fontSize: 11.5, formatter: p => formatar(vals[p.dataIndex], m.formato) + (vals[p.dataIndex] === melhor ? ' ★' : '') },
      markLine: referencia === null ? undefined : { silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' }, label: { show: false }, data: [{ xAxis: referencia }] } }],
  };
}

/* ---------- matriz marginal ---------- */
export function optMatriz(analise, t) {
  const linhasN = analise.ordem.slice(1), colunasN = analise.ordem.slice(0, -1);
  const dados = analise.pares.map(p => ({ value: [colunasN.indexOf(p.defensor), linhasN.indexOf(p.desafiante), p.vplMarginal], par: p }));
  const amp = Math.max(1, ...analise.pares.map(p => Math.abs(p.vplMarginal)));
  const rot = p => p.mesmoInvestimento ? 'TIR —' : `TIR ${fmt.pct(p.tirMarginal)}${p.tirs.length > 1 ? '*' : ''}`;
  return {
    ...base(t), tooltip: { ...base(t).tooltip, trigger: 'item', formatter: x => { const p = x.data.par; return `<b>${p.desafiante}</b> (desafiante) × <b>${p.defensor}</b> (defensor)<br>horizonte ${p.horizonte} anos · investimento marginal ${fmt.moeda(p.investimentoMarginal)}<br>VPL marginal <b>${fmt.moeda(p.vplMarginal)}</b> · RAU marginal ${fmt.moeda(p.rauMarginal)}<br>TIR(s): ${p.mesmoInvestimento ? 'sem investimento marginal' : (p.tirs.map(r => fmt.pct(r)).join(', ') || 'nenhuma')}<br>→ preferido: <b>${p.preferido}</b>`; } },
    grid: { left: 10, right: 10, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: colunasN, position: 'bottom', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontWeight: 600 }, name: 'Defensor (menor investimento)', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 11.5, fontWeight: 600 }, splitArea: { show: false } },
    yAxis: { type: 'category', data: linhasN, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontWeight: 600 }, name: 'Desafiante (maior investimento)', nameLocation: 'middle', nameGap: 44, nameTextStyle: { color: t.muted, fontSize: 11.5, fontWeight: 600 } },
    visualMap: { show: false, min: -amp, max: amp, inRange: { color: [t.dark ? '#e66767' : '#e34948', t.dark ? '#383835' : '#f0efec', t.dark ? '#3987e5' : '#2a78d6'] } },
    series: [{ type: 'heatmap', data: dados, label: { show: true, color: t.ink, fontSize: 12, lineHeight: 17, formatter: x => `${rot(x.data.par)}\nVPL ${fmt.compact(x.data.par.vplMarginal)}\n→ ${x.data.par.preferido}` }, itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 6 }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.25)' } } }],
  };
}

/* ---------- carteiras ---------- */
export function optCarteiras(cart, t) {
  const nomes = cart.map(c => c.carteira);
  return {
    ...base(t), tooltip: { ...base(t).tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].name}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: <b>${fmt.moeda(p.value)}</b>`).join('<br>') },
    legend: { top: 0, left: 0, icon: 'rect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 12.5 } },
    grid: { left: 10, right: 80, top: 34, bottom: 6, containLabel: true },
    xAxis: axVal(t), yAxis: { type: 'category', data: nomes, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: 12 } },
    series: [
      { name: 'VPL', type: 'bar', data: cart.map(c => c.vpl), itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16, label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: p => fmt.moeda(p.value) } },
      { name: 'RAU (soma, por ano)', type: 'bar', data: cart.map(c => c.rauSoma), itemStyle: { color: t.series[2], borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16, label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: p => fmt.moeda(p.value) } },
    ],
  };
}
