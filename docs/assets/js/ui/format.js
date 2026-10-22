/* format.js — formatação pt-BR. */
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ok = v => v !== null && v !== undefined && Number.isFinite(v);
export const fmt = {
  moeda: v => (ok(v) ? (v < 0 ? '−$ ' : '$ ') + nf0.format(Math.abs(v)) : '—'),
  moeda2: v => (ok(v) ? (v < 0 ? '−$ ' : '$ ') + nf2.format(Math.abs(v)) : '—'),
  pct: v => (ok(v) ? nf1.format(v * 100) + '%' : '—'),
  pct2: v => (ok(v) ? nf2.format(v * 100) + '%' : '—'),
  anos: v => (ok(v) ? nf1.format(v) + ' anos' : 'não recupera'),
  num: v => (ok(v) ? nf2.format(v) : '—'),
  int: v => (ok(v) ? nf0.format(v) : '—'),
  compact: v => { if (!ok(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e6) return s + nf1.format(a / 1e6).replace(',0', '') + ' mi'; if (a >= 1e3) return s + nf0.format(Math.round(a / 1e3)) + ' mil'; return s + nf0.format(a); },
};
export function formatar(v, formato) {
  switch (formato) { case 'moeda': return fmt.moeda(v); case 'pct': return fmt.pct(v); case 'anos': return fmt.anos(v); case 'num': return fmt.num(v); case 'int': return fmt.int(v); default: return String(v ?? '—'); }
}
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
