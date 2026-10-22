/* chrome.js — topo, rodapé, tema claro/escuro e tokens de cor (mesmo padrão do badepi-dashboard). */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const listeners = new Set();

export function isDark() { const t = root.getAttribute('data-theme'); if (t) return t === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
export function setTheme(mode) {
  if (mode) root.setAttribute('data-theme', mode); else root.removeAttribute('data-theme');
  try { mode ? localStorage.setItem('greenseer-theme', mode) : localStorage.removeItem('greenseer-theme'); } catch (e) { /* sem armazenamento */ }
  listeners.forEach(fn => fn(isDark()));
}
export function onThemeChange(fn) { listeners.add(fn); }
export function tokens() {
  const cs = getComputedStyle(root); const v = n => cs.getPropertyValue(n).trim(); const dark = isDark();
  return { dark, surface: v('--surface'), page: v('--page'), ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), grid: v('--grid'), axis: v('--axis'), accent: v('--accent'),
    saida: v('--saida'), residual: v('--residual'), giro: v('--giro'), good: v('--good'), bad: v('--bad'), deemph: v('--deemph'),
    series: dark ? SERIES_DARK : SERIES_LIGHT, font: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif' };
}

const LINKS = [['premissas', 'Premissas'], ['projetos', 'Projetos'], ['resultados', 'Resultados'], ['marginal', 'Análise marginal'], ['carteiras', 'Carteiras']];

export function chrome({ active = 'app' } = {}) {
  const header = document.getElementById('topbar');
  const base = active === 'metodologia' ? 'index.html' : '';
  if (header) header.innerHTML = `<div class="container"><a class="brand" href="./"><span class="logo">g</span>greenseer<small>comparação de projetos</small></a>
    <nav class="primary" aria-label="Seções">${LINKS.map(([id, l]) => `<a href="${base}#${id}">${l}</a>`).join('')}<a href="metodologia.html" class="${active === 'metodologia' ? 'active' : ''}">Metodologia</a></nav>
    <button class="icon-btn" id="theme-toggle" aria-label="Alternar tema">🌙 <span>Escuro</span></button></div>`;
  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = `<div class="container"><div>greenseer · ferramenta de comparação de projetos de investimento · código MIT · <a href="https://github.com/Jaimenms/greenseer-web" target="_blank" rel="noopener">GitHub</a> · motor de cálculo validado com a biblioteca Python <a href="https://github.com/Jaimenms/greenseer" target="_blank" rel="noopener">greenseer</a>.</div>
    <div style="margin-top:6px">Os dados ficam apenas no seu navegador (localStorage). Exporte o JSON para guardar ou compartilhar um caso.</div></div>`;
  try { const saved = localStorage.getItem('greenseer-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) { /* ignora */ }
  const btn = document.getElementById('theme-toggle');
  const paint = () => { if (btn) btn.innerHTML = isDark() ? '☀️ <span>Claro</span>' : '🌙 <span>Escuro</span>'; };
  paint();
  btn?.addEventListener('click', () => { setTheme(isDark() ? 'light' : 'dark'); paint(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!root.getAttribute('data-theme')) { paint(); listeners.forEach(fn => fn(isDark())); } });
  // realce da seção visível
  const links = [...(header?.querySelectorAll('nav.primary a[href^="#"]') || [])];
  if (links.length) {
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id)); }); }, { rootMargin: '-40% 0px -55% 0px' });
    LINKS.forEach(([id]) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
