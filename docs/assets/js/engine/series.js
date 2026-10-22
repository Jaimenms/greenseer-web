/* series.js — especificações flexíveis de séries por período (porta de greenseer/series.py).
   Uma especificação pode ser:
   - número                         → constante em todos os períodos 1..n
   - array de comprimento n         → valores explícitos
   - {modo:'constante', valor}
   - {modo:'tabela', valores:[...]}  (comprimento n; faltantes repetem o último valor)
   - {modo:'crescimento', base, taxa, periodos}   base no período 1, cresce à taxa do 2º período em diante
                                                  (periodos limita quantos períodos crescem; null = todos)
   - {modo:'variacoes', base, variacoes:{ano: pct}} variações percentuais encadeadas em anos específicos
   - {modo:'percentual', pct: spec, de:'receita'}   percentual de outra linha do contexto
   - {modo:'produto', fatores:[spec, spec, ...]}     ex.: unidades × preço
   - {modo:'soma', parcelas:[spec, ...]}
   - {modo:'degraus', degraus:{ano: valor}}         mantém o valor até o próximo degrau
*/

export function num(x, padrao = 0) {
  if (x === null || x === undefined || x === '') return padrao;
  if (typeof x === 'string') {
    x = x.trim();
    if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');   // "1.234,5" (pt-BR) → 1234.5
    // só ponto: notação JS/HTML ("5.8") — mantém
  }
  const v = Number(x);
  return Number.isFinite(v) ? v : padrao;
}

function tabela(valores, n) {
  const out = new Array(n).fill(0);
  let ultimo = 0;
  for (let i = 0; i < n; i++) {
    const v = valores && valores[i] !== undefined && valores[i] !== null && valores[i] !== '' ? num(valores[i]) : (i < (valores?.length || 0) ? 0 : ultimo);
    out[i] = v; ultimo = v;
  }
  return out;
}

export function resolver(spec, n, ctx = {}) {
  if (spec === null || spec === undefined) return new Array(n).fill(0);
  if (typeof spec === 'number' || typeof spec === 'string') return new Array(n).fill(num(spec));
  if (Array.isArray(spec)) return tabela(spec, n);
  switch (spec.modo) {
    case 'constante': return new Array(n).fill(num(spec.valor));
    case 'tabela': return tabela(spec.valores, n);
    case 'crescimento': {
      const base = num(spec.base), taxa = num(spec.taxa);
      const periodos = (spec.periodos === null || spec.periodos === undefined || spec.periodos === '') ? n - 1 : num(spec.periodos);
      const out = new Array(n); let v = base;
      for (let t = 1; t <= n; t++) { if (t >= 2 && t - 1 <= periodos) v *= 1 + taxa; out[t - 1] = v; }
      return out;
    }
    case 'variacoes': {
      const base = num(spec.base); const vars = spec.variacoes || {};
      const out = new Array(n); let v = base;
      for (let t = 1; t <= n; t++) { if (t >= 2 && vars[t] !== undefined) v *= 1 + num(vars[t]); out[t - 1] = v; }
      return out;
    }
    case 'percentual': {
      const de = spec.de || 'receita';
      const ref = ctx[de];
      if (!ref) throw new Error(`linha '${de}' ainda não calculada no contexto`);
      const pct = resolver(spec.pct, n, ctx);
      return pct.map((p, i) => p * ref[i]);
    }
    case 'produto': {
      let out = new Array(n).fill(1);
      for (const f of spec.fatores || []) { const r = resolver(f, n, ctx); out = out.map((x, i) => x * r[i]); }
      return out;
    }
    case 'soma': {
      let out = new Array(n).fill(0);
      for (const p of spec.parcelas || []) { const r = resolver(p, n, ctx); out = out.map((x, i) => x + r[i]); }
      return out;
    }
    case 'degraus': {
      const chaves = Object.keys(spec.degraus || {}).map(Number).sort((a, b) => a - b);
      const out = new Array(n).fill(0); let v = 0;
      for (let t = 1; t <= n; t++) { if (chaves.includes(t)) v = num(spec.degraus[t]); out[t - 1] = v; }
      return out;
    }
    default: throw new Error(`modo de série desconhecido: ${spec.modo}`);
  }
}

/* Descrição legível de uma especificação (para tabelas e resumos). */
export function descrever(spec, fmt = v => String(v)) {
  if (spec === null || spec === undefined) return '—';
  if (typeof spec === 'number' || typeof spec === 'string') return fmt(num(spec));
  if (Array.isArray(spec)) return 'tabela por ano';
  switch (spec.modo) {
    case 'constante': return fmt(num(spec.valor));
    case 'tabela': return 'tabela por ano';
    case 'crescimento': return `${fmt(num(spec.base))} crescendo ${(num(spec.taxa) * 100).toLocaleString('pt-BR')}% a.a.` + (spec.periodos ? ` por ${spec.periodos} períodos` : '');
    case 'variacoes': return `${fmt(num(spec.base))} com variações em ${Object.keys(spec.variacoes || {}).join(', ')}`;
    case 'percentual': return `${descrever(spec.pct, v => (v * 100).toLocaleString('pt-BR') + '%')} da ${spec.de || 'receita'}`;
    case 'produto': return (spec.fatores || []).map(f => descrever(f, fmt)).join(' × ');
    case 'soma': return (spec.parcelas || []).map(f => descrever(f, fmt)).join(' + ');
    case 'degraus': return 'degraus';
    default: return spec.modo;
  }
}
