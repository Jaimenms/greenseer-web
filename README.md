# greenseer-web

Ferramenta **interativa, no navegador**, para comparar projetos de investimento: descreva cada projeto pelas suas
premissas e a página monta o fluxo de caixa, calcula todos os indicadores (VPL, TIR, TIRM, RAU, IBC, ROIA,
paybacks), equaliza vidas úteis diferentes, faz a **análise marginal entre todos os pares** de projetos e
ranqueia as **carteiras** possíveis. Nada é enviado a servidores; o caso fica no `localStorage` e pode ser
exportado/importado em JSON.

- Site: https://jaimenms.github.io/greenseer-web/ · [Metodologia](https://jaimenms.github.io/greenseer-web/metodologia.html)
- Caso pré-carregado: estudo de caso da **Empresa Gama** (4 projetos, IR 20%, TMA 18%, escolher 2).
- Projeto irmão: [greenseer](https://github.com/Jaimenms/greenseer) — a biblioteca Python com o mesmo motor de
  cálculo (mais cenários, Monte Carlo e notebooks). O JSON exportado aqui usa o mesmo modelo de dados.

## O que a página faz

| Seção | Conteúdo |
|---|---|
| Premissas | TMA, alíquota de IR, taxa de reinvestimento da TIRM, hipótese para vidas diferentes (empilhar até o MMC ou sem repetição), tamanho e orçamento das carteiras |
| Projetos | Cartões com VPL/TIR/RAU; editor com pré-visualização ao vivo (DRE e diagrama de setas). Receitas e custos aceitam valor constante, crescimento, variações por ano, tabela ano a ano, percentual da receita e quantidade × preço; depreciação linear/explícita; valor residual de mercado (líquido de IR sobre o ganho), por perpetuidade ou contábil; capital de giro |
| Resultados | Tabela de indicadores com a posição em cada critério, painel por indicador, perfil do VPL com taxas de Fisher (zoom), diagrama de fluxo de caixa com componentes empilhados, demonstrativo DRE → FCG |
| Análise marginal | Matriz desafiante × defensor (clique para abrir o par), tabela de todos os pares com todas as TIR marginais, diagrama dos fluxos empilhados + fluxo marginal, VPL marginal em função da taxa, seleção incremental |
| Carteiras | Todas as combinações (ou de *k* projetos, dentro do orçamento) com VPL, soma dos RAU, TIR, TIRM, IBC e payback |

## Estrutura

```
docs/                         site estático (GitHub Pages) — sem build
  index.html                  aplicação
  metodologia.html            como os números são calculados + modelo de dados
  assets/css/style.css        tokens (claro/escuro), layout, componentes
  assets/js/engine/           motor de cálculo puro (sem DOM): series, projeto, metricas, comparacao
  assets/js/ui/               interface: chrome (topo/tema), state (localStorage/JSON), forms (editor), charts (ECharts), app
  assets/js/exemplos/gama.js  caso pré-carregado
tests/engine.test.mjs         testes do motor (node --test), validados contra as notas do curso e a resolução de referência
.github/workflows/pages.yml   publicação manual no GitHub Pages
```

## Rodando localmente

```bash
npm test                       # testes do motor (Node ≥ 20, sem dependências)
python3 -m http.server -d docs 8000   # http://localhost:8000
```

## Publicação

Manual, como no badepi-dashboard: *Actions → Publicar GitHub Pages → Run workflow* (ou
`gh workflow run "Publicar GitHub Pages"`). Em *Settings → Pages* a origem deve ser **GitHub Actions**.

## Licença

MIT.
