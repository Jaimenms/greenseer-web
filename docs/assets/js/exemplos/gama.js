/* Estudo de caso da Empresa Gama (Prof. Geraldo Sardinha Pinto Filho, FDC) — caso pré-carregado. */
export const GAMA = {
  nome: 'Empresa Gama',
  descricao: 'Quatro projetos independentes; só dois podem ser implantados. IR 20%, remuneração exigida pelos acionistas 18% a.a. Premissas de interpretação: P3 cresce 10% nos anos 2–6 e fica estável no ano 7; o valor residual de mercado é tributado sobre o ganho em relação ao valor contábil; P4 usa valor residual por perpetuidade (NOPAT do ano 6 ÷ TMA).',
  globais: { tma: 0.18, aliquotaIR: 0.20, taxaReinvestimento: null, metodoHorizonte: 'mmc', k: 2, orcamento: null },
  projetos: [
    {
      id: 'p1', nome: 'P1', descricao: 'Aquisição de máquinas e equipamentos: +12.500 unidades/ano a $12, custo variável $5,80, sem custo fixo adicional, depreciação linear em 5 anos, sem valor residual.',
      vida: 5, investimento: 200000, aliquotaIR: null,
      receitas: [{ nome: 'Vendas adicionais', spec: { modo: 'produto', fatores: [{ modo: 'constante', valor: 12500 }, { modo: 'constante', valor: 12 }] } }],
      custos: [{ nome: 'Custo variável', spec: { modo: 'produto', fatores: [{ modo: 'constante', valor: 12500 }, { modo: 'constante', valor: 5.8 }] } }],
      depreciacao: { modo: 'linear' }, valorResidual: { modo: 'nenhum' }, capitalDeGiro: { modo: 'nenhum' },
    },
    {
      id: 'p2', nome: 'P2', descricao: 'Acoplamento de novo equipamento: receitas marginais decrescentes; CPV 60%, despesas administrativas 10% e de vendas 9% da receita; despesas gerais projetadas; valor residual nulo.',
      vida: 5, investimento: 200000, aliquotaIR: null,
      receitas: [{ nome: 'Receitas marginais', spec: { modo: 'tabela', valores: [570000, 550000, 510000, 423000, 423000] } }],
      custos: [
        { nome: 'CPV (60%)', spec: { modo: 'percentual', pct: { modo: 'constante', valor: 0.60 }, de: 'receita' } },
        { nome: 'Despesas administrativas (10%)', spec: { modo: 'percentual', pct: { modo: 'constante', valor: 0.10 }, de: 'receita' } },
        { nome: 'Despesas de vendas (9%)', spec: { modo: 'percentual', pct: { modo: 'constante', valor: 0.09 }, de: 'receita' } },
        { nome: 'Despesas gerais', spec: { modo: 'tabela', valores: [17200, 19250, 23350, 36330, 36330] } },
      ],
      depreciacao: { modo: 'linear' }, valorResidual: { modo: 'nenhum' }, capitalDeGiro: { modo: 'nenhum' },
    },
    {
      id: 'p3', nome: 'P3', descricao: 'Nova unidade operacional: 60.000 unidades crescendo 10% a.a. por 5 anos, preço $6; CPV e despesas operacionais em % da receita; vida de 7 anos; depreciação de $30.000/ano; valor residual de mercado $42.000.',
      vida: 7, investimento: 225000, aliquotaIR: null,
      receitas: [{ nome: 'Vendas', spec: { modo: 'produto', fatores: [{ modo: 'crescimento', base: 60000, taxa: 0.10, periodos: 5 }, { modo: 'constante', valor: 6 }] } }],
      custos: [
        { nome: 'CPV', spec: { modo: 'percentual', pct: { modo: 'tabela', valores: [0.67, 0.63, 0.63, 0.61, 0.60, 0.58, 0.58] }, de: 'receita' } },
        { nome: 'Despesas operacionais', spec: { modo: 'percentual', pct: { modo: 'tabela', valores: [0.25, 0.23, 0.23, 0.23, 0.21, 0.17, 0.17] }, de: 'receita' } },
      ],
      depreciacao: { modo: 'explicita', valorAnual: 30000 }, valorResidual: { modo: 'mercado', valor: 42000, tributar: true }, capitalDeGiro: { modo: 'nenhum' },
    },
    {
      id: 'p4', nome: 'P4', descricao: 'Substituição de equipamentos obsoletos: 30.000 unidades com quedas de 2%, 2% e 3% (anos 2–4); preço $20 com −5% no ano 4 e −4% no ano 6; custo fixo $200.000/ano; custo variável $9; vida de 6 anos; valor residual por perpetuidade.',
      vida: 6, investimento: 300000, aliquotaIR: null,
      receitas: [{ nome: 'Vendas', spec: { modo: 'produto', fatores: [{ modo: 'variacoes', base: 30000, variacoes: { 2: -0.02, 3: -0.02, 4: -0.03 } }, { modo: 'variacoes', base: 20, variacoes: { 4: -0.05, 6: -0.04 } }] } }],
      custos: [
        { nome: 'Custo fixo', spec: { modo: 'constante', valor: 200000 } },
        { nome: 'Custo variável', spec: { modo: 'produto', fatores: [{ modo: 'variacoes', base: 30000, variacoes: { 2: -0.02, 3: -0.02, 4: -0.03 } }, { modo: 'constante', valor: 9 }] } },
      ],
      depreciacao: { modo: 'linear' }, valorResidual: { modo: 'perpetuidade', crescimento: 0, taxa: null }, capitalDeGiro: { modo: 'nenhum' },
    },
  ],
};
