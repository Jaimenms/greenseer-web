/* componentes.js — decomposição do fluxo de um projeto em componentes para o diagrama de setas. */
export function componentesProjeto(calc, corProjeto, t) {
  const L = calc.linhas;
  const comps = [
    { nome: 'Operacional (NOPAT + depreciação)', valores: L.fco, cor: corProjeto },
    { nome: 'Investimento', valores: L.investimento, cor: t.saida },
    { nome: 'Capital de giro', valores: L.capital_de_giro, cor: t.giro },
    { nome: 'Valor residual (líquido de IR)', valores: L.valor_residual, cor: t.residual },
    { nome: 'Outros fluxos', valores: L.outros, cor: t.muted },
  ];
  return comps.filter(c => c.valores.some(v => v !== 0));
}
