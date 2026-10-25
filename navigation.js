/* Jarvis — Sidebar, Header, rotas (#/id), busca universal, tema, histórico,
 * favoritos, barra inferior (celular), atalhos de teclado e registro do PWA. */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;
  var GROUPS = ['Principal', 'Meu Workspace', 'Ferramentas', 'Diagnóstico', 'Configurações'];
  var SEARCH_GROUPS = ['FERRAMENTAS', 'NOTAS', 'CASOS', 'CONHECIMENTO', 'TEMPLATES', 'CHECKLISTS'];
  var cleanup = null, current = null;
  /* Telas que foram unidas a outras: links e favoritos antigos continuam funcionando. */
  var ALIAS = { json: 'payload', xml: 'payload' };

  /* Dica curta exibida no topo de cada tela ("como usar"). */
  var HELP = {
    notes: 'Escreva e pronto: tudo é salvo automaticamente. Use categorias e #tags para encontrar depois.',
    cases: 'Um caso reúne tudo de uma análise: descrição, evidências, validações, payloads e conclusão.',
    ocr: 'Copie o print e pressione Ctrl+V aqui. O texto sai ao lado, pronto para copiar.',
    utilities: 'Pequenas ferramentas do dia a dia. Os resultados têm botão de copiar.',
    ticket: 'Escolha o sistema, descreva o problema e responda o checklist. No fim, a análise sai pronta para copiar.',
    errors: 'Cadastre as mensagens de erro que você já viu e o que fazer. Depois é só buscar pela mensagem.',
    logistics: 'Clique em um conceito para ver o resumo. Use "Editar" para registrar as regras do seu ambiente.',
    checklists: 'Marque os itens conforme valida. O progresso fica salvo; "Copiar" leva o checklist para o chamado.',
    templates: 'Encontre a mensagem, clique em Copiar e troque os campos entre [COLCHETES].',
    kb: 'Registre o que você aprendeu: conceito, quando ocorre, o que validar. A busca filtra enquanto você digita.',
    compare: 'Cole o conteúdo antigo em A e o novo em B. As diferenças aparecem abaixo enquanto você digita.',
    payload: 'Cole um JSON, XML ou texto: ele é validado e formatado na hora. Busque campos, veja em árvore ou use Ctrl+F.',
    appearance: 'Tema e instalação do aplicativo.',
    backup: 'Exporte tudo para um arquivo e restaure quando precisar.',
    shortcuts: 'Atalhos para ir mais rápido.',
    privacy: 'Onde ficam seus dados e como apagá-los.'
  };

  N2.hue = function (tool) { return (N2.tools.indexOf(tool) * 47 + 215) % 360; };
  /** Ferramentas "de trabalho" (tudo menos início e configurações). */
  N2.isWork = function (t) { return t.group !== 'Principal' && t.group !== 'Configurações'; };

  /* ---------- tema: 'light' | 'dark' | 'system' ---------- */
  function themePref() { return store.get('theme') || 'system'; }
  function theme() {
    var p = themePref();
    return p === 'system' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p;
  }
  function applyTheme() { document.documentElement.setAttribute('data-theme', theme()); }
  function setTheme(p) { store.save('theme', p); applyTheme(); renderHeader(); }

  /* ---------- favoritos / histórico ---------- */
  function favs() { return store.get('favs', []); }
  function toggleFav(id) {
    var f = favs(); var i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    store.save('favs', f); renderHeader();
    ui.toast(i >= 0 ? 'Removida dos favoritos' : '★ Adicionada aos favoritos');
  }
  function track(id) {
    var h = store.get('history', []);
    if (!h[0] || h[0].id !== id) h.unshift({ id: id, ts: Date.now() });
    store.save('history', h.slice(0, 50));
    store.update('usage', function (u) { u[id] = (u[id] || 0) + 1; return u; }, {});
  }

  /* ---------- navegação ---------- */
  function go(id, params) {
    N2.params = params || null;
    if (location.hash === '#/' + id) route(); else location.hash = '#/' + id;
  }
  function route() {
    var id = location.hash.replace(/^#\/?/, '') || 'dashboard';
    id = ALIAS[id] || id;
    var tool = N2.tool(id) || N2.tool('dashboard');
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    N2.activeFind = null; // a tela nova registra a própria busca Ctrl+F, se tiver
    current = tool;
    var view = document.getElementById('view');
    ui.fill(view);
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    document.body.classList.remove('menu-open');
    renderSidebar(); renderHeader(); renderBottom();
    document.title = tool.title + ' — Jarvis';
    if (N2.isWork(tool)) track(tool.id);
    if (tool.id !== 'dashboard') {
      view.append(el('div', { class: 'page-head' },
        el('div', { class: 'chip-ico', style: '--h:' + N2.hue(tool) }, N2.toolIcon(tool, 24)),
        el('div', null, el('div', { class: 'eyebrow', text: tool.group }), el('h1', { text: tool.title }), el('p', { class: 'muted', text: HELP[tool.id] || tool.desc || '' }))));
    }
    var body = el('div'); view.append(body);
    var params = N2.params; N2.params = null;
    try { cleanup = tool.render(body, params || {}) || null; }
    catch (e) {
      console.error(e);
      ui.fill(body, el('div', { class: 'notice warn', text: 'Não foi possível abrir esta tela. As outras ferramentas continuam funcionando.' }));
    }
    stagger(view);
    window.scrollTo(0, 0);
  }
  /** Entrada em cascata dos cartões da tela recém-aberta. */
  function stagger(view) {
    var i = 0;
    view.querySelectorAll('.grid > *, .quick > *, .stats > *, .split > *').forEach(function (c) {
      if (i > 24) return;
      c.style.setProperty('--i', i++); c.classList.add('stagger');
      c.addEventListener('animationend', function done(e) { if (e.target !== c) return; c.classList.remove('stagger'); c.removeEventListener('animationend', done); });
    });
  }

  function renderSidebar() {
    var sb = document.getElementById('sidebar');
    ui.fill(sb, el('a', { class: 'brand', href: '#/dashboard' },
      el('span', { class: 'logo', 'aria-hidden': 'true' }, el('span', { class: 'logo-ring' }), el('span', { class: 'logo-core', text: 'J' })),
      el('span', { class: 'brand-txt' }, el('b', { text: 'JARVIS' }), el('small', { text: 'Suporte N2 · Logística' }))));
    GROUPS.forEach(function (g) {
      var list = N2.tools.filter(function (t) { return t.group === g; });
      if (!list.length) return;
      if (g !== 'Principal') sb.append(el('div', { class: 'nav-group', text: g }));
      list.forEach(function (t) {
        sb.append(el('a', { class: 'nav-link ' + (current && current.id === t.id ? 'active' : ''), href: '#/' + t.id, title: t.desc || t.title },
          el('span', { class: 'i' }, N2.toolIcon(t, 18)), el('span', { class: 'nav-txt', text: t.title })));
      });
    });
    sb.append(el('div', { class: 'sb-foot' }, el('span', { class: 'dot-live' }), 'Dados salvos neste navegador'));
  }

  function renderHeader() {
    var h = document.getElementById('header');
    var isFav = current && favs().indexOf(current.id) >= 0;
    var canFav = current && N2.isWork(current);
    ui.fill(h,
      el('button', { id: 'menu-btn', class: 'btn ghost icon', type: 'button', 'aria-label': 'Menu', onclick: function () { document.body.classList.toggle('menu-open'); } }, N2.icon('menu')),
      el('button', { class: 'search-trigger', type: 'button', onclick: openSearch }, N2.icon('search', 17), el('span', { class: 'lbl', text: 'Pergunte ao Jarvis: o que você precisa fazer?' }), el('kbd', { text: 'Ctrl K' })),
      el('div', { class: 'spacer' }),
      clockEl,
      canFav ? el('button', { class: 'btn ghost icon fav ' + (isFav ? 'on' : ''), type: 'button', title: isFav ? 'Remover dos favoritos' : 'Favoritar esta ferramenta', 'aria-label': 'Favoritar', onclick: function () { toggleFav(current.id); } }, N2.icon('star')) : null,
      el('button', { class: 'btn ghost icon theme-btn', type: 'button', title: 'Alternar tema claro/escuro', 'aria-label': 'Alternar tema', onclick: function () { setTheme(theme() === 'dark' ? 'light' : 'dark'); } }, N2.icon(theme() === 'dark' ? 'sun' : 'moon')));
  }
  /* Relógio discreto no topo. */
  var clockEl = el('span', { class: 'clock', 'aria-hidden': 'true' });
  function tick() {
    var d = new Date(), t = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    clockEl.textContent = t.charAt(0).toUpperCase() + t.slice(1);
  }
  tick(); setInterval(tick, 15000);

  /* Barra inferior: só aparece em telas pequenas (CSS). */
  function renderBottom() {
    var bar = document.getElementById('bottomnav');
    if (!bar) { bar = el('nav', { id: 'bottomnav' }); document.body.append(bar); }
    function link(id, icon, label) {
      return el('a', { href: '#/' + id, class: current && current.id === id ? 'active' : '' }, el('span', { class: 'i' }, N2.icon(icon, 20)), label);
    }
    ui.fill(bar, link('dashboard', 'home', 'Início'), link('notes', 'notes', 'Notas'), link('cases', 'ticket', 'Casos'),
      el('button', { type: 'button', onclick: openSearch }, el('span', { class: 'i' }, N2.icon('search', 20)), 'Buscar'),
      el('button', { type: 'button', onclick: function () { document.body.classList.toggle('menu-open'); } }, el('span', { class: 'i' }, N2.icon('menu', 20)), 'Menu'));
  }

  /* ---------- busca universal (resultados agrupados) ---------- */
  function toolResult(t) { return { group: 'FERRAMENTAS', tool: t, title: t.title, sub: t.desc || 'Ferramenta', go: function () { go(t.id); } }; }
  function searchAll(q) {
    var out = N2.tools.filter(function (t) { return t.id !== 'dashboard' && ui.has(t.title + ' ' + (t.desc || '') + ' ' + (t.keywords || ''), q); }).map(toolResult);
    N2.tools.forEach(function (t) {
      if (!t.search) return;
      try { t.search(q).slice(0, 8).forEach(function (r) { r.group = t.searchGroup || 'CONHECIMENTO'; out.push(r); }); }
      catch (e) { console.error(e); }
    });
    // ordena pelos grupos, mantendo a ordem interna
    return SEARCH_GROUPS.reduce(function (acc, g) { return acc.concat(out.filter(function (r) { return r.group === g; })); }, []);
  }
  function openSearch() {
    var results = el('div', { class: 'list', style: 'margin-top:12px' });
    var found = [], idx = 0, m;
    function pick(i) { if (found[i]) { m.close(); found[i].go(); } }
    function draw() {
      var last = null, nodes = [];
      found.forEach(function (r, i) {
        if (r.group !== last) { nodes.push(el('div', { class: 'search-group', text: r.group })); last = r.group; }
        nodes.push(el('div', { class: 'list-item res ' + (i === idx ? 'active' : ''), onclick: function () { pick(i); }, onmousemove: function () { if (idx !== i) { idx = i; draw(); } } },
          r.tool ? el('span', { class: 'res-ico' }, N2.toolIcon(r.tool, 18)) : null,
          el('div', { class: 'res-txt' }, el('div', { class: 't', text: r.title }), el('div', { class: 'small muted', text: r.sub })),
          i === idx ? el('kbd', { text: 'Enter' }) : null));
      });
      ui.fill(results, nodes.length ? nodes : ui.empty('🔍', 'Nada encontrado.'));
      var a = results.querySelector('.active'); if (a) a.scrollIntoView({ block: 'nearest' });
    }
    var input = ui.searchBar('Digite uma ferramenta, nota, caso, template…', function (q) {
      // sem texto: sugere as ferramentas
      found = q ? searchAll(q) : N2.tools.filter(N2.isWork).map(toolResult);
      idx = 0; draw();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') pick(idx);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % (found.length || 1); draw();
      }
    });
    m = ui.modal({ title: 'Pergunte ao Jarvis', wide: true, body: el('div', null, input, results,
      el('div', { class: 'small muted', style: 'margin-top:10px' }, el('kbd', { text: '↑ ↓' }), ' navegar  ', el('kbd', { text: 'Enter' }), ' abrir  ', el('kbd', { text: 'Esc' }), ' fechar')) });
    input.dispatchEvent(new Event('input'));
  }

  /* ---------- atalhos ---------- */
  var SHIFT = { o: 'ocr', v: 'ocr', j: 'payload', x: 'payload' };
  function onKey(e) {
    var mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (e.key === 'Escape') {
      if (!ui.closeTopModal()) { if (N2.activeFind && N2.activeFind.isOpen()) N2.activeFind.close(); document.body.classList.remove('menu-open'); }
      return;
    }
    if (mod && e.shiftKey && SHIFT[k]) { e.preventDefault(); go(SHIFT[k]); }
    else if (mod && !e.shiftKey && k === 'k') { e.preventDefault(); ui.closeTopModal(); openSearch(); }
    else if (mod && !e.shiftKey && k === 'f' && N2.activeFind && !document.querySelector('.modal-back')) {
      e.preventDefault();
      var ae = document.activeElement, sel = ae && ae.tagName === 'TEXTAREA' ? ae.value.slice(ae.selectionStart, ae.selectionEnd) : String(window.getSelection ? window.getSelection() : '');
      sel = sel.trim();
      N2.activeFind.open(sel && sel.length < 120 && sel.indexOf('\n') < 0 ? sel : '');
    }
    else if ((mod || e.altKey) && !e.shiftKey && k === 'n') { e.preventDefault(); go('notes', { create: true }); }
    else if (mod && !e.shiftKey && k === 's') { e.preventDefault(); if (N2.notes && current && current.id === 'notes') N2.notes.saveNow(); }
  }

  /* ---------- PWA ---------- */
  var installEvt = null;
  function initPwa() {
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
    // service worker só existe em http(s); abrindo por file:// o app funciona, mas sem instalação/offline gerenciado
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('service-worker.js').catch(function (e) { console.error('[pwa] registro falhou', e); });
    }
  }

  N2.nav = {
    go: go, openSearch: openSearch, favs: favs, themePref: themePref, setTheme: setTheme,
    canInstall: function () { return !!installEvt; },
    install: function () { if (!installEvt) return Promise.resolve(false); var e = installEvt; installEvt = null; e.prompt(); return e.userChoice.then(function (c) { return c.outcome === 'accepted'; }); },
    init: function () {
      applyTheme();
      if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { applyTheme(); renderHeader(); });
      document.getElementById('overlay').addEventListener('click', function () { document.body.classList.remove('menu-open'); });
      window.addEventListener('hashchange', route);
      document.addEventListener('keydown', onKey);
      initPwa();
      route();
    }
  };
  N2.go = go;
})();
