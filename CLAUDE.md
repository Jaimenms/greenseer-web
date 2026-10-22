# CLAUDE.md — guia para evoluir o greenseer-web

Site estático (GitHub Pages, pasta `docs/`) que compara projetos de investimento no navegador. É a interface de
divulgação do projeto Python [greenseer](https://github.com/Jaimenms/greenseer); os dois são repositórios
separados de propósito: a biblioteca é o arcabouço analítico (com cenários, Monte Carlo e notebooks), o site é
a ferramenta interativa sem Monte Carlo.

## Comandos

```bash
npm test                                  # motor de cálculo (node --test tests/)
python3 -m http.server -d docs 8000       # site local
gh workflow run "Publicar GitHub Pages"   # publicação é MANUAL (cota de Actions); origem do Pages = GitHub Actions
```

## Arquitetura

- **Sem build.** HTML + módulos ES; ECharts 5.6 via cdnjs (versão fixa). Fonte Inter via Google Fonts.
- `assets/js/engine/` é **puro** (sem DOM) e é uma porta fiel de `greenseer/{series,projeto,metricas,comparacao}.py`.
  Mesmas convenções: fluxo `v[0..n]` com o investimento em `t=0`; sinais positivos = entradas; especificações de
  série (`constante`, `crescimento`, `variacoes`, `tabela`, `percentual`, `produto`, `soma`, `degraus`);
  decisão marginal pelo **sinal do VPL marginal à TMA** (fluxos empilhados podem ter várias TIR; projetos com o mesmo
  investimento não têm TIR marginal). Ao mudar uma regra, mude nos dois repositórios e nos dois conjuntos de testes.
- `assets/js/ui/state.js` guarda o caso em `localStorage` (`greenseer-caso-v1`); o JSON exportado é o modelo de dados
  documentado em `metodologia.html` e legível pela biblioteca Python.
- `assets/js/ui/forms.js`: o editor lê **apenas** `input/select/textarea[data-path]` (botões também têm `data-path`
  para ações — não os leia). `data-kind`: `num` | `pct` (exibido ×100) | `int` | `text` | `bool`. Trocar o modo de uma
  série (`data-serie-modo`) ou um campo `data-rerender` (vida útil, método de depreciação…) re-renderiza o formulário;
  os demais campos só atualizam a pré-visualização (debounce de 150 ms).
- `assets/js/ui/charts.js`: `optDiagrama` desenha setas com uma série `custom` (linha + triângulo); positivos empilham
  para cima e negativos para baixo; as grades dos painéis são posicionadas em **pixels** a partir da altura do
  contêiner (ECharts não aceita `calc()`), por isso os chamadores passam `{ altura: el.clientHeight }`.
- Cores: cada projeto tem a cor do seu índice na paleta (8 tons validados para daltonismo, igual ao badepi-dashboard);
  saídas em vermelho, valor residual em violeta, capital de giro em magenta. Modo escuro tem valores próprios em
  `style.css` (não é inversão automática).

## Verificação visual (obrigatória após mudanças no site)

Usar Playwright com o Chrome instalado (`channel="chrome"`), servir `docs/` com `python3 -m http.server`, capturar a
página em fatias de ~1000 px, abrir o editor (`[data-act="editar"][data-id="p3"]`), disparar um `input` num campo e
conferir que a pré-visualização muda, alternar o tema e testar uma largura de 420 px; coletar erros de console e
**olhar as capturas**. Foi assim que se achou o bug dos botões com `data-path` zerando as listas e o posicionamento
das grades do diagrama. Os scripts ficaram no scratchpad; recrie-os a partir desta descrição.

## Decisões do autor

- Caso pré-carregado = Empresa Gama (`assets/js/exemplos/gama.js`), com as premissas de interpretação da resolução de
  referência (P3 cresce nos anos 2–6; VR de mercado tributado sobre o ganho; P4 com perpetuidade NOPAT₆ ÷ TMA).
- Sem Monte Carlo no site (fica na biblioteca). Foco: entrada de dados fácil sem perder flexibilidade, interatividade
  e responsividade dos gráficos, ranking por vários critérios e análise marginal entre todos os pares.
- Publicação só por disparo manual (cota de Actions).
