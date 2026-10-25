/* Jarvis — busca dentro da tela (Ctrl+F), usada nos comparadores e inspetores.
 *
 *   var ta = ui.codeEditor(...);
 *   var box = ui.searchable(ta);           // envolve o textarea para poder destacar ocorrências
 *   var find = ui.findBar([
 *     { label: 'A', el: ta },               // textarea (precisa ter passado por ui.searchable)
 *     { label: 'Resultado', el: outDiv }    // qualquer elemento: busca no texto renderizado
 *   ]);
 *   root.append(find.el, box, outDiv);
 *
 * Ctrl+F abre a barra da tela atual (registrada em N2.activeFind). Enter / Shift+Enter
 * navegam, Esc fecha. Elementos que mudam (ex.: o diff refeito enquanto digita) são
 * buscados de novo sozinhos. Nada do texto do usuário entra via innerHTML. */
(function () {
  var ui = N2.ui, el = ui.el;

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function makeRe(q, o) {
    if (!q) return null;
    var src = escRe(q);
    if (o.word) src = '(?<![\\p{L}\\p{N}_])' + src + '(?![\\p{L}\\p{N}_])';
    return new RegExp(src, 'gu' + (o.caseSens ? '' : 'i'));
  }

  /* ---------- textarea com camada de destaque por trás ---------- */
  function searchable(ta) {
    var back = el('div', { class: 'hl-back', 'aria-hidden': 'true' });
    var wrap = el('div', { class: 'hl-wrap' }, back, ta);
    ta.classList.add('hl-ta');
    function sync() {
      var cs = getComputedStyle(ta);
      back.style.left = cs.borderLeftWidth; back.style.top = cs.borderTopWidth;
      back.style.width = ta.clientWidth + 'px'; back.style.height = ta.clientHeight + 'px';
      back.style.padding = cs.padding;
      back.scrollTop = ta.scrollTop; back.scrollLeft = ta.scrollLeft;
    }
    ta.addEventListener('scroll', function () { back.scrollTop = ta.scrollTop; back.scrollLeft = ta.scrollLeft; });
    if (window.ResizeObserver) new ResizeObserver(sync).observe(ta);
    ta._hl = { back: back, wrap: wrap, sync: sync };
    return wrap;
  }

  /** Destaca as ocorrências no textarea. Retorna as marcas (na ordem do texto). */
  function markTextarea(ta, re) {
    var h = ta._hl; if (!h) return [];
    var text = ta.value, frag = document.createDocumentFragment(), marks = [], i = 0, m;
    if (re) {
      re.lastIndex = 0;
      while ((m = re.exec(text)) && marks.length < 5000) {
        if (!m[0]) { re.lastIndex++; continue; }
        var mk = el('mark', { class: 'hit', text: m[0] });
        frag.append(text.slice(i, m.index), mk); marks.push(mk); i = m.index + m[0].length;
      }
    }
    frag.append(text.slice(i), '\n');
    h.back.replaceChildren(re ? frag : '');
    h.sync();
    marks.forEach(function (mk) { mk._ta = ta; });
    return marks;
  }

  /** Destaca as ocorrências nos nós de texto de um elemento. */
  function markDom(root, re) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!n.nodeValue || !p || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(p.nodeName) || p.closest('.findbar, .hl-back')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n, marks = [];
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var text = node.nodeValue, m, i = 0, parts = [];
      re.lastIndex = 0;
      while ((m = re.exec(text)) && marks.length < 5000) {
        if (!m[0]) { re.lastIndex++; continue; }
        var mk = el('mark', { class: 'hit', text: m[0] });
        parts.push(text.slice(i, m.index), mk); marks.push(mk); i = m.index + m[0].length;
      }
      if (!parts.length) return;
      parts.push(text.slice(i));
      node.replaceWith.apply(node, parts.filter(function (p) { return p !== ''; }));
    });
    return marks;
  }
  function clearDom(root) {
    root.querySelectorAll('mark.hit').forEach(function (mk) {
      var p = mk.parentNode; mk.replaceWith(document.createTextNode(mk.textContent)); p.normalize();
    });
  }

  /* ---------- barra de busca ---------- */
  function findBar(targets, opts) {
    opts = opts || {};
    var o = { caseSens: false, word: false }, scope = 'all', marks = [], cur = -1, active = false, busy = false;
    var input = el('input', { type: 'search', class: 'find-input', placeholder: opts.placeholder || 'Buscar nesta tela…', 'aria-label': 'Buscar nesta tela' });
    var count = el('span', { class: 'find-count', text: '' });
    function toggle(label, title, key) {
      var b = el('button', { type: 'button', class: 'find-opt', title: title, 'aria-pressed': 'false', text: label, onclick: function () {
        o[key] = !o[key]; b.classList.toggle('on', o[key]); b.setAttribute('aria-pressed', String(o[key])); run(true); input.focus();
      } });
      return b;
    }
    function iconBtn(name, title, fn) { return el('button', { type: 'button', class: 'find-nav', title: title, 'aria-label': title, onclick: fn }, N2.icon(name, 16)); }
    var scopes = targets.length > 1 ? el('div', { class: 'find-scopes' }) : null;
    function drawScopes() {
      if (!scopes) return;
      ui.fill(scopes, [{ label: 'Tudo', key: 'all' }].concat(targets.map(function (t, i) { return { label: t.label, key: String(i) }; })).map(function (s) {
        return el('button', { type: 'button', class: 'find-scope ' + (scope === s.key ? 'on' : ''), text: s.label, onclick: function () { scope = s.key; drawScopes(); run(true); input.focus(); } });
      }));
    }
    drawScopes();
    var bar = el('div', { class: 'findbar', role: 'search', hidden: true },
      el('span', { class: 'find-ico' }, N2.icon('search', 16)), input, count,
      toggle('Aa', 'Diferenciar maiúsculas e minúsculas', 'caseSens'), toggle('ab|', 'Palavra inteira', 'word'),
      iconBtn('up', 'Anterior (Shift+Enter)', function () { go(cur - 1); }),
      iconBtn('down', 'Próxima (Enter)', function () { go(cur + 1); }),
      scopes,
      iconBtn('x', 'Fechar (Esc)', close));

    function inScope(i) { return scope === 'all' || scope === String(i); }
    function clearAll() {
      targets.forEach(function (t) {
        if (t.el.tagName === 'TEXTAREA') markTextarea(t.el, null); else clearDom(t.el);
      });
      marks = []; cur = -1;
    }
    /** reset=false tenta manter a ocorrência atual (ex.: ao reconstruir após mudança no conteúdo). */
    function run(reset) {
      busy = true;
      var prev = cur;
      clearAll();
      var q = input.value, re = null;
      try { re = active ? makeRe(q, o) : null; } catch (e) { re = null; }
      if (re) targets.forEach(function (t, i) {
        if (!inScope(i)) return;
        var found = t.el.tagName === 'TEXTAREA' ? markTextarea(t.el, re) : markDom(t.el, re);
        found.forEach(function (mk) { mk._label = t.label; });
        marks = marks.concat(found);
      });
      observers.forEach(function (ob) { ob.takeRecords(); });
      busy = false;
      if (!q) { count.textContent = ''; bar.classList.remove('none'); return; }
      bar.classList.toggle('none', !marks.length);
      if (!marks.length) { count.textContent = 'Nenhum resultado'; return; }
      go(reset || prev < 0 ? 0 : Math.min(prev, marks.length - 1), !reset);
    }
    function go(i, quiet) {
      if (!marks.length) return;
      if (marks[cur]) marks[cur].classList.remove('cur');
      cur = (i + marks.length) % marks.length;
      var mk = marks[cur];
      mk.classList.add('cur');
      count.textContent = (cur + 1) + ' de ' + marks.length + (scope === 'all' && targets.length > 1 && mk._label ? ' · ' + mk._label : '');
      if (quiet) return;
      if (mk._ta) { // dentro de um textarea: rola o próprio campo e depois a página
        var ta = mk._ta;
        ta.scrollTop = Math.max(0, mk.offsetTop - ta.clientHeight / 2);
        ta._hl.back.scrollTop = ta.scrollTop;
        ta._hl.wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        for (var d = mk.parentElement; d; d = d.parentElement) if (d.tagName === 'DETAILS' && !d.open) d.open = true;
        mk.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
    var rerun = ui.debounce(function () { if (active) run(false); }, 200);
    input.addEventListener('input', ui.debounce(function () { run(true); }, 120));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? cur - 1 : cur + 1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });

    // conteúdo que muda (diff refeito, campo editado) é buscado de novo
    var observers = [];
    targets.forEach(function (t) {
      if (t.el.tagName === 'TEXTAREA') { t.el.addEventListener('input', rerun); return; }
      if (!window.MutationObserver) return;
      var ob = new MutationObserver(function () { if (!busy) rerun(); });
      ob.observe(t.el, { childList: true, subtree: true, characterData: true });
      observers.push(ob);
    });

    function open(seed) {
      active = true; bar.hidden = false; bar.classList.remove('leaving');
      if (seed) input.value = seed;
      input.focus(); input.select();
      run(true);
    }
    function close() {
      if (!active) return;
      active = false; clearAll(); count.textContent = '';
      bar.classList.add('leaving');
      setTimeout(function () { if (!active) { bar.hidden = true; bar.classList.remove('leaving'); } }, 160);
    }
    var api = { el: bar, open: open, close: close, refresh: function () { if (active) run(false); }, isOpen: function () { return active; } };
    N2.activeFind = api;
    return api;
  }

  ui.searchable = searchable;
  ui.findBar = findBar;
  /** Botão "Buscar (Ctrl+F)" que abre a barra. */
  ui.findButton = function (api) {
    return el('button', { class: 'btn', type: 'button', title: 'Buscar nesta tela (Ctrl+F)', onclick: function () { api.open(); } },
      N2.icon('search', 16), 'Buscar', el('kbd', { text: 'Ctrl F' }));
  };
})();
