/* forms.js — editor de projeto (diálogo) com editor de séries e pré-visualização ao vivo. */
import { calcular, demonstrativo } from '../engine/projeto.js';
import { indicadores } from '../engine/metricas.js';
import { num } from '../engine/series.js';
import { fmt, esc } from './format.js';
import { tokens } from './chrome.js';
import { chart, optDiagrama, dispor } from './charts.js';
import { clone } from './state.js';
import { componentesProjeto } from './componentes.js';

const MODOS = {
  constante: 'Valor constante', crescimento: 'Crescimento anual', variacoes: 'Variações em anos específicos', tabela: 'Tabela ano a ano',
  percentual: 'Percentual da receita', produto: 'Quantidade × preço unitário',
};
function specPadrao(modo, anterior = {}) {
  const v = num(anterior.valor ?? anterior.base ?? (anterior.valores || [])[0] ?? 0);
  switch (modo) {
    case 'constante': return { modo, valor: v };
    case 'crescimento': return { modo, base: v, taxa: 0.05, periodos: null };
    case 'variacoes': return { modo, base: v, variacoes: {} };
    case 'tabela': return { modo, valores: [] };
    case 'percentual': return { modo, pct: { modo: 'constante', valor: 0.5 }, de: 'receita' };
    case 'produto': return { modo, fatores: [{ modo: 'constante', valor: 1000 }, { modo: 'constante', valor: 10 }] };
    default: return { modo: 'constante', valor: v };
  }
}
const pctIn = v => (v === null || v === undefined || v === '' ? '' : Math.round(num(v) * 1e6) / 1e4);
const numIn = v => (v === null || v === undefined || v === '' ? '' : num(v));
const campo = (label, inner, hint = '') => `<div class="field"><label>${label}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const inp = (path, value, { kind = 'num', step = 'any', placeholder = '' } = {}) => kind === 'pct'
  ? `<div class="suffix"><input type="number" step="${step}" data-path="${path}" data-kind="pct" value="${pctIn(value)}" placeholder="${placeholder}"><span>%</span></div>`
  : `<input type="number" step="${step}" data-path="${path}" data-kind="${kind}" value="${numIn(value)}" placeholder="${placeholder}">`;

/* Editor de série. kind: 'num' (valores) ou 'pct' (percentuais, exibidos ×100). permitidos: modos oferecidos. */
export function serieHTML(spec, path, n, { rotulo = 'Série', kind = 'num', permitidos = ['constante', 'crescimento', 'variacoes', 'tabela', 'percentual', 'produto'], nivel = 0 } = {}) {
  spec = spec && typeof spec === 'object' && !Array.isArray(spec) ? spec : (Array.isArray(spec) ? { modo: 'tabela', valores: spec } : { modo: 'constante', valor: spec });
  const modo = permitidos.includes(spec.modo) ? spec.modo : permitidos[0];
  const sel = `<select class="modo" data-path="${path}.modo" data-serie-modo>${permitidos.map(m => `<option value="${m}" ${m === modo ? 'selected' : ''}>${MODOS[m]}</option>`).join('')}</select>`;
  let campos = '';
  const anosGrid = itens => `<div class="campos anos">${itens}</div>`;
  if (modo === 'constante') campos = `<div class="campos">${campo(kind === 'pct' ? 'Percentual' : 'Valor por ano', inp(`${path}.valor`, spec.valor, { kind }))}</div>`;
  else if (modo === 'crescimento') campos = `<div class="campos">${campo(kind === 'pct' ? 'Percentual no ano 1' : 'Valor no ano 1', inp(`${path}.base`, spec.base, { kind }))}${campo('Crescimento a.a.', inp(`${path}.taxa`, spec.taxa, { kind: 'pct', step: 0.1 }))}${campo('Nº de anos com crescimento', inp(`${path}.periodos`, spec.periodos, { kind: 'int', step: 1, placeholder: 'todos' }), 'em branco: cresce até o fim')}</div>`;
  else if (modo === 'variacoes') {
    const vars = spec.variacoes || {};
    campos = `<div class="campos">${campo(kind === 'pct' ? 'Percentual no ano 1' : 'Valor no ano 1', inp(`${path}.base`, spec.base, { kind }))}</div><div class="serie-help">Variação percentual aplicada em cada ano (em branco = sem mudança; o valor é encadeado):</div>` +
      anosGrid(Array.from({ length: n - 1 }, (_, i) => campo(`Ano ${i + 2}`, inp(`${path}.variacoes.${i + 2}`, vars[i + 2], { kind: 'pct', step: 0.1, placeholder: '0' }))).join(''));
  } else if (modo === 'tabela') {
    const vals = spec.valores || [];
    campos = anosGrid(Array.from({ length: n }, (_, i) => campo(`Ano ${i + 1}`, inp(`${path}.valores.${i}`, vals[i], { kind }))).join('')) +
      `<div class="tab-tools"><button type="button" class="btn small" data-act="tab-repetir" data-path="${path}">Repetir o ano 1 em todos</button><button type="button" class="btn small" data-act="tab-crescer" data-path="${path}">Crescer 10% a.a. a partir do ano 1</button></div>`;
  } else if (modo === 'percentual') {
    campos = `<div class="serie-help">Percentual aplicado sobre a receita total do ano.</div>` + serieHTML(spec.pct, `${path}.pct`, n, { rotulo: 'Percentual', kind: 'pct', permitidos: ['constante', 'tabela', 'crescimento'], nivel: nivel + 1 });
  } else if (modo === 'produto') {
    const f = spec.fatores || [];
    campos = serieHTML(f[0], `${path}.fatores.0`, n, { rotulo: 'Quantidade', kind: 'num', permitidos: ['constante', 'crescimento', 'variacoes', 'tabela'], nivel: nivel + 1 }) +
      serieHTML(f[1], `${path}.fatores.1`, n, { rotulo: 'Preço unitário', kind: 'num', permitidos: ['constante', 'crescimento', 'variacoes', 'tabela'], nivel: nivel + 1 });
  }
  return `<div class="serie" data-serie="${path}"><div class="serie-head"><span class="label">${rotulo}</span>${sel}</div>${campos}</div>`;
}

function itensHTML(lista, chave, n, rotuloItem) {
  const permitidos = chave === 'custos' ? ['constante', 'percentual', 'produto', 'crescimento', 'variacoes', 'tabela'] : ['produto', 'constante', 'crescimento', 'variacoes', 'tabela'];
  return (lista || []).map((it, i) => `<div class="item" data-item="${chave}.${i}"><div class="item-head"><input type="text" data-path="${chave}.${i}.nome" data-kind="text" value="${esc(it.nome)}" placeholder="${rotuloItem}"><button type="button" class="icon-btn danger" data-act="remover" data-path="${chave}.${i}" title="Remover">✕</button></div>${serieHTML(it.spec, `${chave}.${i}.spec`, n, { rotulo: 'Como varia', permitidos })}</div>`).join('') +
    `<button type="button" class="btn small" data-act="adicionar" data-path="${chave}">+ Adicionar ${rotuloItem.toLowerCase()}</button>`;
}

function formHTML(p, globais) {
  const n = Math.max(1, Math.round(num(p.vida, 1)));
  const dep = p.depreciacao || { modo: 'linear' }, vr = p.valorResidual || { modo: 'nenhum' }, cg = p.capitalDeGiro || { modo: 'nenhum' };
  return `
  <fieldset><legend>Identificação</legend><div class="form-grid">
    ${campo('Nome', `<input type="text" data-path="nome" data-kind="text" value="${esc(p.nome)}">`)}
    ${campo('Vida útil (anos)', `<input type="number" min="1" max="60" step="1" data-path="vida" data-kind="int" data-rerender value="${n}">`)}
    ${campo('Investimento inicial (ano 0)', inp('investimento', p.investimento))}
    ${campo('Alíquota de IR', inp('aliquotaIR', p.aliquotaIR, { kind: 'pct', step: 0.1, placeholder: `global ${pctIn(globais.aliquotaIR)}%` }), 'em branco usa a global')}
    <div class="field" style="grid-column: 1 / -1"><label>Descrição</label><textarea data-path="descricao" data-kind="text" rows="2">${esc(p.descricao || '')}</textarea></div>
  </div></fieldset>
  <fieldset><legend>Receitas</legend>${itensHTML(p.receitas, 'receitas', n, 'Receita')}</fieldset>
  <fieldset><legend>Custos e despesas (desembolsáveis)</legend>${itensHTML(p.custos, 'custos', n, 'Custo')}</fieldset>
  <fieldset><legend>Depreciação</legend><div class="form-grid">
    ${campo('Método', `<select data-path="depreciacao.modo" data-rerender><option value="linear" ${dep.modo === 'linear' ? 'selected' : ''}>Linear (investimento ÷ prazo)</option><option value="explicita" ${dep.modo === 'explicita' ? 'selected' : ''}>Valor anual informado</option><option value="nenhuma" ${dep.modo === 'nenhuma' ? 'selected' : ''}>Sem depreciação</option></select>`)}
    ${dep.modo === 'linear' ? campo('Prazo (anos)', inp('depreciacao.anos', dep.anos, { kind: 'int', step: 1, placeholder: `vida útil (${n})` })) + campo('Valor residual contábil', inp('depreciacao.residualContabil', dep.residualContabil, { placeholder: '0' }), 'parcela não depreciada') : ''}
    ${dep.modo === 'explicita' ? campo('Depreciação por ano', inp('depreciacao.valorAnual', dep.valorAnual)) : ''}
  </div></fieldset>
  <fieldset><legend>Valor residual (último ano)</legend><div class="form-grid">
    ${campo('Tipo', `<select data-path="valorResidual.modo" data-rerender><option value="nenhum" ${vr.modo === 'nenhum' ? 'selected' : ''}>Nenhum</option><option value="mercado" ${vr.modo === 'mercado' ? 'selected' : ''}>Valor de mercado (venda do ativo)</option><option value="perpetuidade" ${vr.modo === 'perpetuidade' ? 'selected' : ''}>Perpetuidade (NOPAT ÷ (TMA − g))</option><option value="contabil" ${vr.modo === 'contabil' ? 'selected' : ''}>Valor contábil</option></select>`)}
    ${vr.modo === 'mercado' ? campo('Valor de mercado', inp('valorResidual.valor', vr.valor)) + `<div class="field"><label>IR sobre o ganho</label><label class="inline"><input type="checkbox" data-path="valorResidual.tributar" data-kind="bool" ${vr.tributar === false ? '' : 'checked'}> tributar o ganho sobre o valor contábil</label></div>` : ''}
    ${vr.modo === 'perpetuidade' ? campo('Crescimento g na perpetuidade', inp('valorResidual.crescimento', vr.crescimento, { kind: 'pct', step: 0.1, placeholder: '0' })) + campo('Taxa de desconto', inp('valorResidual.taxa', vr.taxa, { kind: 'pct', step: 0.1, placeholder: `TMA ${pctIn(globais.tma)}%` }), 'em branco usa a TMA') : ''}
  </div></fieldset>
  <fieldset><legend>Capital de giro e IR</legend><div class="form-grid">
    ${campo('Necessidade de capital de giro', `<select data-path="capitalDeGiro.modo" data-rerender><option value="nenhum" ${cg.modo === 'nenhum' ? 'selected' : ''}>Nenhuma</option><option value="constante" ${cg.modo === 'constante' ? 'selected' : ''}>Valor constante</option><option value="percentual" ${cg.modo === 'percentual' ? 'selected' : ''}>% da receita do ano</option></select>`, 'investida no ano anterior e recuperada no último ano')}
    ${cg.modo === 'constante' ? campo('Valor', inp('capitalDeGiro.valor', cg.valor)) : ''}
    ${cg.modo === 'percentual' ? campo('Percentual da receita', inp('capitalDeGiro.pct', cg.pct, { kind: 'pct', step: 0.1 })) : ''}
    ${campo('IR em anos de prejuízo', `<select data-path="irPrejuizo"><option value="compensar" ${p.irPrejuizo !== 'zero' ? 'selected' : ''}>Benefício fiscal (compensa com outros lucros)</option><option value="zero" ${p.irPrejuizo === 'zero' ? 'selected' : ''}>Sem compensação (IR = 0)</option></select>`)}
  </div></fieldset>`;
}

/* lê todos os campos [data-path] e devolve um novo objeto projeto */
function setPath(obj, path, value) {
  const parts = path.split('.'); let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]; const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (o[k] === undefined || o[k] === null || typeof o[k] !== 'object') o[k] = nextIsIndex ? [] : {};
    o = o[k];
  }
  o[parts[parts.length - 1]] = value;
}
export function lerFormulario(form, base) {
  const p = clone(base);
  form.querySelectorAll('input[data-path], select[data-path], textarea[data-path]').forEach(el => {
    const kind = el.dataset.kind || (el.tagName === 'SELECT' ? 'text' : 'num');
    let v;
    if (kind === 'bool') v = el.checked;
    else if (kind === 'text') v = el.value;
    else if (el.value === '') v = null;
    else if (kind === 'pct') v = num(el.value) / 100;
    else if (kind === 'int') v = Math.round(num(el.value));
    else v = num(el.value);
    setPath(p, el.dataset.path, v);
  });
  // tabelas: converte objetos {0:..,1:..} em arrays
  const fixArrays = o => { if (Array.isArray(o)) o.forEach(fixArrays); else if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k === 'valores' && o[k] && !Array.isArray(o[k])) o[k] = Object.keys(o[k]).sort((a, b) => a - b).map(i => o[k][i]); fixArrays(o[k]); } };
  fixArrays(p);
  return p;
}

function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

function previewHTML(p, globais) {
  try {
    const calc = calcular(p, globais); const ind = indicadores(calc.fluxo, num(globais.tma), globais.taxaReinvestimento ?? null);
    const kpi = (l, v, cls = '') => `<div class="kpi"><div class="v ${cls}">${v}</div><div class="l">${l}</div></div>`;
    const dre = demonstrativo(calc, false);
    const n = calc.n;
    const tabela = `<div class="table-view" style="max-height:320px"><table class="data"><thead><tr><th></th>${Array.from({ length: n + 1 }, (_, i) => `<th>${i}</th>`).join('')}</tr></thead><tbody>${dre.map(([r, v, tipo]) => `<tr class="${tipo}"><td>${esc(r)}</td>${v.map(x => `<td class="${x < 0 ? 'neg' : ''}">${x === 0 ? '–' : fmt.moeda(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return { html: `<div class="kpis">${kpi('VPL à TMA', fmt.moeda(ind.vpl), ind.vpl < 0 ? 'neg' : '')}${kpi('TIR', fmt.pct(ind.tir))}${kpi('RAU', fmt.moeda(ind.rau), ind.rau < 0 ? 'neg' : '')}${kpi('Payback ajustado', fmt.anos(ind.payback_descontado))}${kpi('IBC', fmt.num(ind.ibc))}</div><div class="chart" id="ed-chart"></div><h4 style="margin:10px 0 6px;font-size:13px">Do DRE ao fluxo de caixa global</h4>${tabela}`, calc };
  } catch (e) {
    return { html: `<div class="empty">Não foi possível calcular: ${esc(e.message)}</div>`, calc: null };
  }
}

export function abrirEditor(projeto, { globais, cor, onSalvar }) {
  const dlg = document.getElementById('editor');
  let temp = clone(projeto);
  const render = () => {
    dlg.innerHTML = `<div class="ed-head"><span class="swatch" style="background:${cor};width:14px;height:14px"></span><h3>${esc(temp.nome || 'Projeto')}</h3><span class="muted small">a pré-visualização atualiza enquanto você digita</span><button class="icon-btn" style="margin-left:auto" data-act="fechar" aria-label="Fechar">✕</button></div>
      <div class="ed-body"><form class="ed-form" id="ed-form" autocomplete="off">${formHTML(temp, globais)}</form><div class="ed-preview" id="ed-preview"></div></div>
      <div class="ed-foot"><button class="btn" data-act="fechar">Cancelar</button><button class="btn primary" data-act="salvar">Salvar projeto</button></div>`;
    preview();
  };
  const preview = () => {
    dlg.__temp = temp; // inspeção/depuração
    const host = dlg.querySelector('#ed-preview'); const { html, calc } = previewHTML(temp, globais);
    host.innerHTML = html;
    if (calc) { const t = tokens(); const comps = componentesProjeto(calc, cor, t); const el = host.querySelector('#ed-chart'); chart(el, optDiagrama([{ titulo: temp.nome, componentes: comps }], t, { altura: el.clientHeight || 260 })); }
  };
  render();
  const form = () => dlg.querySelector('#ed-form');
  let timer;
  dlg.oninput = e => {
    if (!e.target.matches('[data-path]') || e.target.hasAttribute('data-rerender')) return;
    temp = lerFormulario(form(), temp); dlg.querySelector('.ed-head h3').textContent = temp.nome || 'Projeto';
    clearTimeout(timer); timer = setTimeout(preview, 150);
  };
  dlg.onchange = e => {
    const el = e.target;
    if (el.matches('[data-serie-modo]')) {
      temp = lerFormulario(form(), temp);
      const path = el.dataset.path.replace(/\.modo$/, ''); const atual = getPath(temp, path) || {};
      setPath(temp, path, specPadrao(el.value, atual)); render(); return;
    }
    if (el.hasAttribute('data-rerender')) { temp = lerFormulario(form(), temp); render(); return; }
    if (el.matches('[data-path]')) { temp = lerFormulario(form(), temp); preview(); }
  };
  dlg.onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, path = b.dataset.path;
    if (act === 'fechar') { dlg.close(); return; }
    if (act === 'salvar') { temp = lerFormulario(form(), temp); if (!temp.nome?.trim()) { alert('Informe o nome do projeto.'); return; } dlg.close(); onSalvar(temp); return; }
    temp = lerFormulario(form(), temp);
    const n = Math.max(1, Math.round(num(temp.vida, 1)));
    if (act === 'adicionar') { const lista = getPath(temp, path) || []; lista.push(path === 'custos' ? { nome: `Custo ${lista.length + 1}`, spec: { modo: 'constante', valor: 0 } } : { nome: `Receita ${lista.length + 1}`, spec: { modo: 'constante', valor: 0 } }); setPath(temp, path, lista); render(); }
    else if (act === 'remover') { const parts = path.split('.'); const lista = getPath(temp, parts[0]); lista.splice(+parts[1], 1); render(); }
    else if (act === 'tab-repetir') { const s = getPath(temp, path); const v0 = num((s.valores || [])[0]); s.valores = new Array(n).fill(v0); render(); }
    else if (act === 'tab-crescer') { const s = getPath(temp, path); const v0 = num((s.valores || [])[0]); s.valores = Array.from({ length: n }, (_, i) => v0 * Math.pow(1.1, i)); render(); }
  };
  dlg.addEventListener('close', () => { const c = dlg.querySelector('#ed-chart'); if (c) dispor(c); }, { once: true });
  dlg.showModal();
}
