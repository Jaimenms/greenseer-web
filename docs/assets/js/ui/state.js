/* state.js — caso em edição: carga, persistência (localStorage), importação e exportação. */
import { GAMA } from '../exemplos/gama.js';

const KEY = 'greenseer-caso-v1';
export const clone = o => JSON.parse(JSON.stringify(o));
export const uid = () => 'p' + Math.random().toString(36).slice(2, 8);

export function casoExemplo() { const c = clone(GAMA); c.projetos.forEach(p => { p.id = p.id || uid(); }); return c; }
export function casoVazio() {
  return { nome: 'Novo caso', descricao: '', globais: { tma: 0.12, aliquotaIR: 0.34, taxaReinvestimento: null, metodoHorizonte: 'mmc', k: null, orcamento: null }, projetos: [] };
}
export function novoProjeto(indice) {
  return {
    id: uid(), nome: `P${indice}`, descricao: '', vida: 5, investimento: 100000, aliquotaIR: null, irPrejuizo: 'compensar',
    receitas: [{ nome: 'Receita', spec: { modo: 'produto', fatores: [{ modo: 'constante', valor: 10000 }, { modo: 'constante', valor: 10 }] } }],
    custos: [{ nome: 'Custos', spec: { modo: 'percentual', pct: { modo: 'constante', valor: 0.6 }, de: 'receita' } }],
    depreciacao: { modo: 'linear' }, valorResidual: { modo: 'nenhum' }, capitalDeGiro: { modo: 'nenhum' },
  };
}
export function normalizar(caso) {
  const c = { ...casoVazio(), ...caso };
  c.globais = { ...casoVazio().globais, ...(caso.globais || {}) };
  c.projetos = (caso.projetos || []).map(p => ({ ...novoProjeto(1), ...p, id: p.id || uid(), receitas: p.receitas || [], custos: p.custos || [],
    depreciacao: p.depreciacao || { modo: 'linear' }, valorResidual: p.valorResidual || { modo: 'nenhum' }, capitalDeGiro: p.capitalDeGiro || { modo: 'nenhum' } }));
  return c;
}
export function carregar() {
  try { const s = localStorage.getItem(KEY); if (s) return normalizar(JSON.parse(s)); } catch (e) { /* ignora */ }
  return casoExemplo();
}
export function salvar(caso) { try { localStorage.setItem(KEY, JSON.stringify(caso)); } catch (e) { /* sem armazenamento */ } }
export function exportar(caso) {
  const blob = new Blob([JSON.stringify(caso, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${(caso.nome || 'caso').replace(/[^\w\-]+/g, '_').toLowerCase()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function importar(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { try { const c = JSON.parse(r.result); if (!c || typeof c !== 'object') throw new Error('arquivo inválido'); resolve(normalizar(c)); } catch (e) { reject(e); } };
    r.onerror = () => reject(new Error('não foi possível ler o arquivo'));
    r.readAsText(file);
  });
}
