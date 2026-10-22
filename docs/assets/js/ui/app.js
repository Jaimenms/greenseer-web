/* app.js — orquestração: estado → cálculo → render das seções. */
import { chrome, tokens, toast } from './chrome.js';
import { fmt, formatar, esc } from './format.js';
import { carregar, salvar, exportar, importar, casoExemplo, casoVazio, novoProjeto, clone } from './state.js';
import { calcular, demonstrativo } from '../engine/projeto.js';
import { indicadores, METRICAS, vplPerfil, tirTodas } from '../engine/metricas.js';
import { ranking, analiseMarginal, campeaoIncremental, carteiras, componentesEmpilhadas } from '../engine/comparacao.js';
import { chart, dispor, corProjeto, optDiagrama, optPerfil, optIndicador, optMatriz, optCarteiras, aoMudarTema } from './charts.js';
import { abrirEditor } from './forms.js';
import { componentesProjeto } from './componentes.js';
import { num } from '../engine/series.js';

let caso = carregar();
const ui = { fluxoSel: null, parSel: null, sort: { col: 'vpl', asc: false }, tabelaPerfil: false };
let R = null; // resultados calculados

chrome({ active: 'app' });
const $ = id => document.getElementById(id);

/* ---------- premissas globais ---------- */
function renderGlobais() {
  const g = caso.globais;
  $('g-nome').value = caso.nome || '';
  $('g-tma').value = g.tma == null ? '' : Math.round(g.tma * 1e4) / 100;
  $('g-ir').value = g.aliquotaIR == null ? '' : Math.round(g.aliquotaIR * 1e4) / 100;
  $('g-reinv').value = g.taxaReinvestimento == null ? '' : Math.round(g.taxaReinvestimento * 1e4) / 100;
  $('g-k').value = g.k ?? ''; $('g-orc').value = g.orcamento ?? '';
  document.querySelectorAll('[data-g="metodoHorizonte"] button').forEach(b => b.classList.toggle('active', b.dataset.value === (g.metodoHorizonte || 'mmc')));
  $('caso-desc').textContent = caso.descricao || '';
}
function wireGlobais() {
  $('form-globais').addEventListener('input', e => {
    const el = e.target; if (!el.dataset.g) return;
    if (el.dataset.g === 'nome') caso.nome = el.value;
    else if (el.hasAttribute('data-pct')) caso.globais[el.dataset.g] = el.value === '' ? null : num(el.value) / 100;
    else caso.globais[el.dataset.g] = el.value === '' ? null : num(el.value);
    if (caso.globais.tma == null) caso.globais.tma = 0;
    recalcular(false);
  });
  document.querySelector('[data-g="metodoHorizonte"]').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; caso.globais.metodoHorizonte = b.dataset.value; recalcular(); });
  $('btn-exemplo').onclick = () => { caso = casoExemplo(); toast('Exemplo da Empresa Gama carregado'); recalcular(); };
  $('btn-novo').onclick = () => { if (confirm('Começar um caso em branco? O caso atual continua exportável antes disso.')) { caso = casoVazio(); recalcular(); } };
  $('btn-exportar').onclick = () => exportar(caso);
  $('btn-importar').onclick = () => $('file-importar').click();
  $('file-importar').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { caso = await importar(f); toast('Caso importado'); recalcular(); } catch (err) { alert('Não foi possível importar: ' + err.message); } e.target.value = ''; };
}

/* ---------- cálculo ---------- */
function calcularTudo() {
  const g = { ...caso.globais, tma: num(caso.globais.tma), aliquotaIR: num(caso.globais.aliquotaIR) };
  const tr = g.taxaReinvestimento == null ? null : num(g.taxaReinvestimento);
  const projetos = caso.projetos.map((p, i) => {
    try { const calc = calcular(p, g); return { p, i, calc, fluxo: calc.fluxo, ind: indicadores(calc.fluxo, g.tma, tr), erro: null }; }
    catch (e) { return { p, i, calc: null, fluxo: null, ind: null, erro: e.message }; }
  });
  const validos = projetos.filter(x => !x.erro);
  const fluxos = validos.map(x => ({ nome: x.p.nome, fluxo: x.fluxo }));
  const metodo = g.metodoHorizonte || 'mmc';
  return {
    g, tr, projetos, validos, fluxos, metodo,
    ranking: fluxos.length ? ranking(fluxos, g.tma, tr) : [],
    marginal: fluxos.length > 1 ? analiseMarginal(fluxos, g.tma, metodo, tr) : null,
    campeao: fluxos.length > 1 ? campeaoIncremental(fluxos, g.tma, metodo) : null,
    carteiras: fluxos.length ? carteiras(fluxos, g.tma, { k: g.k ? Math.round(num(g.k)) : null, orcamento: g.orcamento, taxaReinv: tr }) : [],
  };
}
function recalcular(renderGl = true) {
  salvar(caso);
  R = calcularTudo();
  if (renderGl) renderGlobais();
  renderHero(); renderProjetos(); renderIndicadores(); renderPainel(); renderPerfil(); renderFluxo(); renderDRE(); renderMarginal(); renderCarteiras();
}
aoMudarTema(() => { renderPainel(); renderPerfil(); renderFluxo(); renderMarginal(); renderCarteiras(); });

/* ---------- hero ---------- */
function renderHero() {
  const rk = R.ranking; const best = (k, maior = true) => rk.length ? rk.reduce((a, b) => (maior ? (b[k] > a[k] ? b : a) : (b[k] < a[k] ? b : a))) : null;
  const bv = best('vpl'), br = best('rau');
  const tiles = [
    ['Projetos', String(caso.projetos.length)],
    ['TMA', fmt.pct(R.g.tma)],
    ['Maior VPL', bv ? `${bv.nome} · ${fmt.moeda(bv.vpl)}` : '—'],
    ['Maior RAU', br ? `${br.nome} · ${fmt.moeda(br.rau)}` : '—'],
    ['Campeão marginal', R.campeao ? R.campeao.campeao : '—'],
  ];
  $('hero-stats').innerHTML = tiles.map(([l, v]) => `<div class="hero-stat"><div class="v">${esc(v)}</div><div class="l">${l}</div></div>`).join('');
}

/* ---------- projetos ---------- */
function renderProjetos() {
  const host = $('lista-projetos'); const t = tokens();
  host.innerHTML = R.projetos.map(x => {
    const cor = corProjeto(x.i, t); const p = x.p;
    const mini = x.ind ? `<div class="mini"><div><div class="v ${x.ind.vpl < 0 ? 'neg' : ''}">${fmt.compact(x.ind.vpl)}</div><div class="l">VPL</div></div><div><div class="v">${fmt.pct(x.ind.tir)}</div><div class="l">TIR</div></div><div><div class="v ${x.ind.rau < 0 ? 'neg' : ''}">${fmt.compact(x.ind.rau)}</div><div class="l">RAU</div></div></div>` : `<div class="pill bad">erro: ${esc(x.erro)}</div>`;
    return `<div class="proj" style="border-left-color:${cor}"><h3>${esc(p.nome)}</h3><div class="desc">${esc(p.descricao || 'Sem descrição')}</div><div class="meta"><span>Investimento ${fmt.moeda(num(p.investimento))}</span><span>${p.vida} anos</span></div>${mini}<div class="acts"><button class="btn small" data-act="editar" data-id="${p.id}">Editar</button><button class="btn small" data-act="duplicar" data-id="${p.id}">Duplicar</button><button class="btn small danger" data-act="excluir" data-id="${p.id}">Excluir</button></div></div>`;
  }).join('') + `<div class="proj add" data-act="adicionar">＋ Adicionar projeto</div>`;
}
$('lista-projetos').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, id = b.dataset.id; const idx = caso.projetos.findIndex(p => p.id === id);
  if (act === 'adicionar') { const p = novoProjeto(caso.projetos.length + 1); editar(p, true); }
  else if (act === 'editar') editar(caso.projetos[idx], false);
  else if (act === 'duplicar') { const c = clone(caso.projetos[idx]); c.id = novoProjeto(1).id; c.nome = c.nome + ' (cópia)'; caso.projetos.splice(idx + 1, 0, c); recalcular(); }
  else if (act === 'excluir') { if (confirm(`Excluir o projeto ${caso.projetos[idx].nome}?`)) { caso.projetos.splice(idx, 1); recalcular(); } }
});
function editar(p, novo) {
  const i = novo ? caso.projetos.length : caso.projetos.findIndex(x => x.id === p.id);
  abrirEditor(p, { globais: R.g, cor: corProjeto(i), onSalvar: atualizado => { if (novo) caso.projetos.push(atualizado); else caso.projetos[i] = atualizado; toast(`${atualizado.nome} salvo`); recalcular(); } });
}

/* ---------- indicadores ---------- */
function renderIndicadores() {
  const host = $('tab-indicadores'); const rk = R.ranking; const t = tokens();
  if (!rk.length) { host.innerHTML = '<div class="empty">Adicione projetos para ver os indicadores.</div>'; return; }
  const cols = [['investimento', 'Investimento', 'moeda', null], ['vida', 'Vida', 'int', null], ...METRICAS.map(m => [m.chave, m.rotulo, m.formato, m])];
  const { col, asc } = ui.sort;
  const linhas = [...rk].sort((a, b) => { const x = a[col], y = b[col]; if (!Number.isFinite(x)) return 1; if (!Number.isFinite(y)) return -1; return asc ? x - y : y - x; });
  host.innerHTML = `<table class="data"><thead><tr><th>Projeto</th>${cols.map(([k, l]) => `<th class="sortable ${col === k ? 'sorted ' + (asc ? 'asc' : '') : ''}" data-col="${k}" title="${esc(cols.find(c => c[0] === k)[3]?.descricao || '')}">${l}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => {
    const i = caso.projetos.findIndex(p => p.nome === l.nome);
    return `<tr><td><span class="swatch" style="background:${corProjeto(i, t)}"></span>${esc(l.nome)}</td>${cols.map(([k, , f, m]) => { const r = l[`rank_${k}`]; const best = m && r === 1; return `<td class="${best ? 'best' : ''} ${l[k] < 0 && f === 'moeda' ? 'neg' : ''}">${formatar(l[k], f)}${m && Number.isFinite(r) ? `<span class="rank ${r === 1 ? 'r1' : ''}">${r}º</span>` : ''}${best ? ' ★' : ''}</td>`; }).join('')}</tr>`;
  }).join('')}</tbody></table>`;
  host.querySelectorAll('th.sortable').forEach(th => th.onclick = () => { const k = th.dataset.col; ui.sort = { col: k, asc: ui.sort.col === k ? !ui.sort.asc : !(METRICAS.find(m => m.chave === k)?.maiorMelhor ?? true) }; renderIndicadores(); });
}
function renderPainel() {
  const host = $('painel-indicadores'); const t = tokens(); const rk = R.ranking;
  host.querySelectorAll('.chart').forEach(dispor);
  if (!rk.length) { host.innerHTML = ''; return; }
  const cores = rk.map(l => corProjeto(caso.projetos.findIndex(p => p.nome === l.nome), t));
  const ref = { tir: R.g.tma, tirm: R.g.tma, ibc: 1 };
  host.innerHTML = METRICAS.map(m => `<div class="mini-card"><h4 title="${esc(m.descricao)}">${m.rotulo}${ref[m.chave] !== undefined ? ` <span class="muted">· ref. ${formatar(ref[m.chave], m.formato)}</span>` : ''}</h4><div class="chart" data-metrica="${m.chave}"></div></div>`).join('');
  host.querySelectorAll('.chart').forEach(el => chart(el, optIndicador(rk, el.dataset.metrica, cores, t, { referencia: ref[el.dataset.metrica] ?? null })));
}

/* ---------- perfil do VPL ---------- */
function renderPerfil() {
  const el = $('ch-perfil'), tb = $('tb-perfil'); const t = tokens();
  if (!R.fluxos.length) { dispor(el); tb.innerHTML = ''; return; }
  const cores = R.validos.map(x => corProjeto(x.i, t));
  const maxTir = Math.max(0.3, ...R.validos.map(x => Math.max(...(x.ind.tirs || [0]).filter(r => r < 2), 0)) ) * 1.25;
  chart(el, optPerfil(R.fluxos, R.g.tma, cores, t, { max: Math.min(1, Math.ceil(maxTir * 20) / 20) }));
  const taxas = Array.from({ length: 11 }, (_, i) => i * 0.05);
  tb.innerHTML = `<table class="data"><thead><tr><th>Taxa</th>${R.fluxos.map(f => `<th>${esc(f.nome)}</th>`).join('')}</tr></thead><tbody>${taxas.map(r => `<tr><td>${fmt.pct(r)}</td>${R.fluxos.map(f => `<td class="${vplPerfil(f.fluxo, [r])[0] < 0 ? 'neg' : ''}">${fmt.moeda(vplPerfil(f.fluxo, [r])[0])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
document.querySelector('[data-for="perfil"]').onclick = e => { ui.tabelaPerfil = !ui.tabelaPerfil; e.target.textContent = ui.tabelaPerfil ? 'Gráfico' : 'Tabela'; $('ch-perfil').classList.toggle('hidden', ui.tabelaPerfil); $('tb-perfil').classList.toggle('hidden', !ui.tabelaPerfil); if (!ui.tabelaPerfil) renderPerfil(); };

/* ---------- diagrama de fluxo e DRE ---------- */
function projetoSel() { if (!R.validos.length) return null; return R.validos.find(x => x.p.id === ui.fluxoSel) || R.validos[0]; }
function renderFluxo() {
  const sel = $('sel-projeto-fluxo'); const el = $('ch-fluxo'); const t = tokens();
  sel.innerHTML = R.validos.map(x => `<option value="${x.p.id}">${esc(x.p.nome)}</option>`).join('');
  const x = projetoSel(); if (!x) { dispor(el); $('nota-fluxo').textContent = ''; return; }
  sel.value = x.p.id; ui.fluxoSel = x.p.id;
  chart(el, optDiagrama([{ titulo: x.p.nome, componentes: componentesProjeto(x.calc, corProjeto(x.i, t), t) }], t, { altura: el.clientHeight }));
  const vr = x.calc.linhas.valor_residual[x.calc.n];
  $('nota-fluxo').textContent = vr ? `Valor residual no ano ${x.calc.n}: ${fmt.moeda(x.calc.valorResidualBruto)} bruto` + (x.calc.irResidual ? `, menos IR de ${fmt.moeda(x.calc.irResidual)} sobre o ganho em relação ao valor contábil de ${fmt.moeda(x.calc.linhas.valor_contabil[x.calc.n])} = ${fmt.moeda(vr)} líquido.` : ` (${fmt.moeda(vr)} líquido).`) : 'Sem valor residual ao fim da vida útil.';
}
$('sel-projeto-fluxo').onchange = e => { ui.fluxoSel = e.target.value; renderFluxo(); renderDRE(); };
function renderDRE() {
  const host = $('tab-dre'); const x = projetoSel();
  if (!x) { host.innerHTML = '<div class="empty">Sem projeto selecionado.</div>'; $('dre-sub').textContent = ''; return; }
  $('dre-sub').textContent = `${x.p.nome} · alíquota de IR ${fmt.pct(x.calc.aliquotaIR)} · valores em $`;
  const n = x.calc.n; const dre = demonstrativo(x.calc, true);
  host.innerHTML = `<table class="data"><thead><tr><th>Ano</th>${Array.from({ length: n + 1 }, (_, i) => `<th>${i}</th>`).join('')}</tr></thead><tbody>${dre.map(([r, v, tipo]) => `<tr class="${tipo}"><td>${esc(r)}</td>${v.map(val => `<td class="${val < 0 ? 'neg' : ''}">${val === 0 ? '–' : fmt.moeda(val)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/* ---------- análise marginal ---------- */
function parSel() { if (!R.marginal) return null; return R.marginal.pares.find(p => `${p.defensor}|${p.desafiante}` === ui.parSel) || R.marginal.pares[0]; }
function renderMarginal() {
  const t = tokens(); const elM = $('ch-matriz'), elP = $('ch-par'), elPP = $('ch-par-perfil'); const host = $('tab-pares');
  if (!R.marginal) { [elM, elP, elPP].forEach(dispor); host.innerHTML = '<div class="empty">A análise marginal precisa de pelo menos dois projetos.</div>'; $('nota-campeao').textContent = ''; $('par-titulo').textContent = 'Par selecionado'; $('nota-par').textContent = ''; return; }
  const am = R.marginal;
  const c = chart(elM, optMatriz(am, t)); c.off('click'); c.on('click', ev => { if (ev.data?.par) { ui.parSel = `${ev.data.par.defensor}|${ev.data.par.desafiante}`; renderPar(); renderPares(); } });
  renderPares(); renderPar();
  $('nota-campeao').innerHTML = `<b>Seleção incremental:</b> ${R.campeao.trilha.map(s => `${s.defensor === '—' ? '' : s.defensor + ' × '}${s.desafiante} → <b>${s.vence}</b>`).join(' · ')}. Campeão entre projetos excludentes: <b>${esc(R.campeao.campeao)}</b>.`;
  function renderPares() {
    const sel = parSel();
    host.innerHTML = `<table class="data"><thead><tr><th>Defensor</th><th>Desafiante</th><th>Horizonte</th><th>Invest. marginal</th><th>VPL marginal</th><th>TIR(s) marginal</th><th>RAU marginal</th><th>Preferido</th></tr></thead><tbody>${am.pares.map(p => `<tr class="clickable ${p === sel ? 'sel' : ''}" data-par="${p.defensor}|${p.desafiante}"><td>${esc(p.defensor)}</td><td>${esc(p.desafiante)}</td><td>${p.horizonte} anos</td><td>${fmt.moeda(p.investimentoMarginal)}</td><td class="${p.vplMarginal < 0 ? 'neg' : ''}">${fmt.moeda(p.vplMarginal)}</td><td>${p.mesmoInvestimento ? '— (mesmo investimento)' : (p.tirs.length ? p.tirs.map(r => fmt.pct(r)).join(' e ') + (p.tirs.length > 1 ? ' *' : '') : 'nenhuma')}</td><td class="${p.rauMarginal < 0 ? 'neg' : ''}">${fmt.moeda(p.rauMarginal)}</td><td><span class="pill ${p.preferido === p.desafiante ? 'good' : ''}">${esc(p.preferido)}</span></td></tr>`).join('')}</tbody></table>`;
    host.querySelectorAll('tr[data-par]').forEach(tr => tr.onclick = () => { ui.parSel = tr.dataset.par; renderPar(); renderPares(); });
  }
  function renderPar() {
    const p = parSel(); if (!p) return;
    const ia = caso.projetos.findIndex(x => x.nome === p.defensor), ib = caso.projetos.findIndex(x => x.nome === p.desafiante);
    const xa = R.validos.find(x => x.p.nome === p.defensor), xb = R.validos.find(x => x.p.nome === p.desafiante);
    const painel = (x, i, ciclos) => { const { entradas, saidas } = componentesEmpilhadas(x.fluxo, ciclos); return { titulo: `${x.p.nome}${ciclos > 1 ? ` · ${ciclos} ciclos de ${x.calc.n} anos` : ''}`, componentes: [{ nome: `${x.p.nome} · entradas`, valores: entradas, cor: corProjeto(i, t) }, { nome: 'Investimentos / saídas', valores: saidas, cor: t.saida }] }; };
    const marg = { titulo: `Marginal: ${p.desafiante} − ${p.defensor}`, componentes: [{ nome: 'Marginal positivo', valores: p.fluxo.map(v => (v > 0 ? v : 0)), cor: t.ink2 }, { nome: 'Marginal negativo', valores: p.fluxo.map(v => (v < 0 ? v : 0)), cor: t.saida }] };
    chart(elP, optDiagrama([painel(xa, ia, p.ciclosA), painel(xb, ib, p.ciclosB), marg], t, { altura: elP.clientHeight }));
    const max = Math.min(1.0, Math.max(0.3, ...p.tirs.filter(r => r < 1).map(r => r * 1.3)));
    chart(elPP, optPerfil([{ nome: `${p.desafiante} − ${p.defensor}`, fluxo: p.fluxo }], R.g.tma, [t.ink2], t, { max, fisher: false }));
    $('par-titulo').textContent = `${p.desafiante} (desafiante) × ${p.defensor} (defensor) — horizonte de ${p.horizonte} anos`;
    const sinais = p.fluxo.reduce((s, v, i, a) => s + (i > 0 && Math.sign(v) * Math.sign(a[i - 1]) < 0 ? 1 : 0), 0);
    $('nota-par').innerHTML = `Investimento marginal ${fmt.moeda(p.investimentoMarginal)} · VPL marginal à TMA <b class="${p.vplMarginal < 0 ? 'neg' : ''}">${fmt.moeda(p.vplMarginal)}</b> · RAU marginal ${fmt.moeda(p.rauMarginal)} · o fluxo marginal muda de sinal ${sinais} vez(es)` +
      (p.tirs.length > 1 ? ` e tem ${p.tirs.length} TIR (${p.tirs.map(r => fmt.pct(r)).join(', ')}): "TIR marginal > TMA" deixa de ser critério; vale o sinal do VPL marginal à TMA.` : (p.mesmoInvestimento ? '; sem investimento marginal, compare os VPL diretamente.' : '.')) + ` <b>Preferido: ${esc(p.preferido)}.</b>`;
  }
}

/* ---------- carteiras ---------- */
function renderCarteiras() {
  const host = $('tab-carteiras'); const el = $('ch-carteiras'); const t = tokens(); const cart = R.carteiras;
  const k = R.g.k ? Math.round(num(R.g.k)) : null;
  $('cart-sub').textContent = cart.length ? `${cart.length} carteira(s)${k ? ` com ${k} projeto(s)` : ''}${R.g.orcamento ? ` até ${fmt.moeda(num(R.g.orcamento))} de investimento` : ''} · ordenadas por VPL` : '';
  if (!cart.length) { host.innerHTML = '<div class="empty">Nenhuma carteira possível com as restrições atuais.</div>'; dispor(el); return; }
  const melhorRau = cart.reduce((a, b) => (b.rauSoma > a.rauSoma ? b : a));
  host.innerHTML = `<table class="data"><thead><tr><th>Carteira</th><th>Projetos</th><th>Investimento</th><th>VPL</th><th>RAU (soma)</th><th>TIR</th><th>TIRM</th><th>IBC</th><th>Payback ajustado</th></tr></thead><tbody>${cart.map((c, i) => `<tr><td>${esc(c.carteira)}</td><td>${c.n}</td><td>${fmt.moeda(c.investimento)}</td><td class="${i === 0 ? 'best' : ''} ${c.vpl < 0 ? 'neg' : ''}">${fmt.moeda(c.vpl)}${i === 0 ? ' ★' : ''}</td><td class="${c === melhorRau ? 'best' : ''}">${fmt.moeda(c.rauSoma)}${c === melhorRau ? ' ★' : ''}</td><td>${fmt.pct(c.tir)}</td><td>${fmt.pct(c.tirm)}</td><td>${fmt.num(c.ibc)}</td><td>${fmt.anos(c.paybackDescontado)}</td></tr>`).join('')}</tbody></table>`;
  const top = cart.slice(0, 12);
  el.style.height = `${Math.max(260, 60 + 40 * top.length)}px`;
  chart(el, optCarteiras(top, t));
}

/* ---------- início ---------- */
wireGlobais();
recalcular();
