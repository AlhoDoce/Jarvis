/* Jarvis — núcleo: registro de ferramentas + componentes reutilizáveis.
 *
 * Cada ferramenta é um módulo que chama:
 *   N2.register({
 *     id, title, icon, group, desc, keywords,
 *     render(root, params)  -> desenha a tela (pode retornar função de limpeza)
 *     search(query)         -> opcional: [{title, sub, go()}] para a busca global
 *   });
 *
 * Todo conteúdo do usuário entra no DOM via textContent (helper el), nunca innerHTML,
 * o que evita XSS.
 */
window.N2 = { tools: [], params: null };

N2.register = function (tool) { N2.tools.push(tool); };
N2.tool = function (id) { return N2.tools.find(function (t) { return t.id === id; }); };

(function () {
  /* ---------- helpers de DOM ---------- */
  function el(tag, attrs) {
    var n = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2).flat(Infinity);
    kids.forEach(function (c) {
      if (c == null || c === false) return;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'value') n.value = v;
      else if (k === 'checked') n.checked = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    return n;
  }

  /** Substitui o conteúdo de um nó (aceita arrays aninhados, nós e textos). */
  function fill(node) {
    var kids = Array.prototype.slice.call(arguments, 1).flat(Infinity).filter(function (c) { return c != null && c !== false; });
    node.replaceChildren.apply(node, kids);
    return node;
  }

  function uid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
  }
  function fmtDate(ts) { return ts ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
  function debounce(fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; }
  function has(text, q) { return String(text || '').toLowerCase().indexOf(q.toLowerCase()) >= 0; }
  /** "#cte, sefaz" -> ["CTE","SEFAZ"] */
  function parseTags(s) {
    return Array.from(new Set(String(s || '').split(/[\s,;]+/).map(function (t) { return t.replace(/^#/, '').toUpperCase(); }).filter(Boolean)));
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    var bad = /não|inválid|falh|erro/i.test(msg);
    var t = el('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, el('span', { class: 'toast-dot' }), el('span', { text: msg }));
    document.getElementById('toast-root').append(t);
    setTimeout(function () { t.classList.add('leaving'); setTimeout(function () { t.remove(); }, 220); }, 2200);
  }

  /* ---------- copiar / baixar ---------- */
  function copy(text) {
    text = String(text == null ? '' : text);
    function fallback() {
      var ta = el('textarea', { value: text, style: 'position:fixed;opacity:0' });
      document.body.append(ta); ta.select();
      try { document.execCommand('copy'); toast('Copiado'); } catch (e) { toast('Não foi possível copiar'); }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('Copiado'); }, fallback);
    else fallback();
  }
  function download(name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- Button ---------- */
  function button(label, onClick, variant) {
    return el('button', { class: 'btn ' + (variant || ''), type: 'button', onclick: onClick }, label);
  }
  function copyBtn(getText, label) { return button(label || '📋 Copiar', function () { copy(getText()); }); }

  /* ---------- Modal ---------- */
  var modals = [];
  function modal(opts) {
    var back = el('div', { class: 'modal-back' });
    var api = { close: function () {
      modals = modals.filter(function (m) { return m !== api; });
      back.classList.add('leaving'); setTimeout(function () { back.remove(); }, 170);
    } };
    back.append(el('div', { class: 'modal ' + (opts.wide ? 'wide' : ''), role: 'dialog' },
      el('div', { class: 'modal-head' }, el('span', { text: opts.title || '' }), el('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Fechar', onclick: api.close }, N2.icon('x', 16))),
      el('div', { class: 'modal-body' }, opts.body),
      opts.actions ? el('div', { class: 'modal-foot' }, opts.actions) : null));
    back.addEventListener('mousedown', function (e) { if (e.target === back) api.close(); });
    document.getElementById('modal-root').append(back);
    modals.push(api);
    var f = back.querySelector('input,textarea,select'); if (f) f.focus();
    return api;
  }
  function closeTopModal() { var m = modals[modals.length - 1]; if (m) { m.close(); return true; } return false; }
  function confirmBox(msg, onYes, yesLabel) {
    var m = modal({
      title: 'Confirmação', body: el('p', { text: msg }),
      actions: [button('Cancelar', function () { m.close(); }),
        button(yesLabel || 'Confirmar', function () { m.close(); onYes(); }, 'primary')]
    });
  }
  /** Formulário genérico em modal. fields: [{key,label,type:'text'|'textarea'|'select',options,rows}] */
  function formModal(title, fields, values, onSave) {
    values = values || {};
    var inputs = {};
    var body = el('div', null, fields.map(function (f) {
      var inp;
      if (f.type === 'textarea') inp = el('textarea', { rows: f.rows || 3, placeholder: f.placeholder });
      else if (f.type === 'select') inp = el('select', null, f.options.map(function (o) { return el('option', { value: o, text: o }); }));
      else inp = el('input', { type: 'text', placeholder: f.placeholder });
      if (f.type === 'select' && values[f.key] && f.options.indexOf(values[f.key]) < 0) inp.append(el('option', { value: values[f.key], text: values[f.key] }));
      if (values[f.key] != null) inp.value = values[f.key];
      inputs[f.key] = inp;
      return el('label', { class: 'field' }, el('span', { text: f.label }), inp);
    }));
    var m = modal({
      title: title, body: body, wide: true,
      actions: [button('Cancelar', function () { m.close(); }),
        button('Salvar', function () {
          var out = {};
          Object.keys(inputs).forEach(function (k) { out[k] = inputs[k].value.trim(); });
          if (fields[0] && !out[fields[0].key]) { toast('Preencha: ' + fields[0].label); return; }
          m.close(); onSave(out);
        }, 'primary')]
    });
  }

  /* ---------- Tabs ---------- */
  /** Abas. Cada aba é criada uma vez e mantém seu estado ao alternar. */
  function tabs(items, start) {
    var ink = el('span', { class: 'tab-ink', 'aria-hidden': 'true' });
    var bar = el('div', { class: 'tabs', role: 'tablist' }, ink), content = el('div', { class: 'tab-panel' }), cur = -1;
    function btns() { return Array.from(bar.querySelectorAll('.tab')); }
    function moveInk() {
      var b = btns()[cur]; if (!b || !b.offsetWidth) return;
      ink.style.width = b.offsetWidth + 'px'; ink.style.transform = 'translate(' + b.offsetLeft + 'px,' + b.offsetTop + 'px)';
      ink.style.height = b.offsetHeight + 'px';
    }
    function show(i) {
      btns().forEach(function (c, j) { c.classList.toggle('active', i === j); c.setAttribute('aria-selected', String(i === j)); });
      var it = items[i];
      if (!it.node) it.node = it.render();
      content.replaceChildren(it.node);
      if (i !== cur) { content.classList.remove('swap'); void content.offsetWidth; content.classList.add('swap'); }
      cur = i; moveInk();
    }
    items.forEach(function (it, i) { bar.append(el('button', { class: 'tab', type: 'button', role: 'tab', text: it.label, onclick: function () { show(i); } })); });
    show(start || 0);
    // a barra só tem tamanho depois de entrar na página
    requestAnimationFrame(function () { requestAnimationFrame(moveInk); });
    if (window.ResizeObserver) new ResizeObserver(moveInk).observe(bar);
    return el('div', null, bar, content);
  }

  /* ---------- Card / CodeEditor / Dropdown ---------- */
  function card(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return el('div', { class: 'card' }, title ? el('h2', { text: title }) : null, kids);
  }
  function codeEditor(opts) {
    opts = opts || {};
    return el('textarea', { class: 'code', rows: opts.rows || 14, placeholder: opts.placeholder || '', spellcheck: 'false', readonly: opts.readonly, value: opts.value || '' });
  }
  function dropdown(options, value, onChange) {
    var s = el('select', { onchange: function () { onChange && onChange(s.value); } },
      options.map(function (o) { return el('option', { value: o.value != null ? o.value : o, text: o.label || o }); }));
    if (value != null) s.value = value;
    return s;
  }
  function searchBar(placeholder, onInput) {
    var i = el('input', { type: 'search', placeholder: placeholder, oninput: function () { onInput(i.value.trim()); } });
    return i;
  }

  /* ---------- FileUploader (clique + arrastar) ---------- */
  function fileUploader(opts) {
    var input = el('input', { type: 'file', accept: opts.accept, style: 'display:none', onchange: function () { if (input.files[0]) opts.onFile(input.files[0]); input.value = ''; } });
    var zone = el('div', { class: 'drop', tabindex: '0', onclick: function () { input.click(); } }, el('div', { text: opts.label }), input);
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault(); zone.classList.remove('over');
      if (e.dataTransfer.files[0]) opts.onFile(e.dataTransfer.files[0]);
    });
    return zone;
  }

  /* ---------- destaque de termo e árvore ---------- */
  function highlight(text, q) {
    var frag = document.createDocumentFragment();
    text = String(text);
    if (!q) { frag.append(text); return frag; }
    var low = text.toLowerCase(), ql = q.toLowerCase(), i = 0, j;
    while ((j = low.indexOf(ql, i)) >= 0) {
      frag.append(text.slice(i, j), el('mark', { text: text.slice(j, j + q.length) }));
      i = j + q.length;
    }
    frag.append(text.slice(i));
    return frag;
  }
  /** Visualizador em árvore de qualquer valor JS (objeto/array/primitivo). */
  function tree(value, key, q, depth) {
    depth = depth || 0;
    var k = key != null ? el('span', { class: 'k' }, highlight(key, q)) : null;
    if (value !== null && typeof value === 'object') {
      var isArr = Array.isArray(value), keys = Object.keys(value);
      var d = el('details', depth < 2 ? { open: true } : null,
        el('summary', null, k, k ? ': ' : '', el('span', { class: 'muted', text: isArr ? '[' + keys.length + ']' : '{' + keys.length + '}' })));
      // filhos criados sob demanda para payloads grandes
      var filled = false;
      function fill() { if (filled) return; filled = true; keys.forEach(function (c) { d.append(tree(value[c], c, q, depth + 1)); }); }
      if (depth < 2) fill(); else d.addEventListener('toggle', fill);
      return depth === 0 ? el('div', { class: 'tree' }, d) : d;
    }
    var leaf = el('div', { class: 'leaf' }, k, k ? ': ' : '', el('span', { class: 'v', text: JSON.stringify(value) }));
    return depth === 0 ? el('div', { class: 'tree' }, leaf) : leaf;
  }
  /** Percorre objeto e devolve [{path, value}] das chaves que contêm o termo. */
  function findKeys(value, term, path, out) {
    out = out || []; path = path || '';
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        var p = Array.isArray(value) ? path + '[' + k + ']' : (path ? path + '.' + k : k);
        if (!Array.isArray(value) && has(k, term)) out.push({ path: p, value: value[k] });
        findKeys(value[k], term, p, out);
      });
    }
    return out;
  }
  function renderFound(list, term) {
    if (!list.length) return el('p', { class: 'muted', text: 'Nenhuma ocorrência de "' + term + '".' });
    return el('div', null, el('p', { class: 'small muted', text: list.length + ' ocorrência(s)' }),
      list.map(function (r) {
        var v = typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value);
        return el('div', { class: 'row', style: 'margin-bottom:4px' },
          el('code', { class: 'mono small' }, highlight(r.path, term)),
          el('span', { class: 'mono small grow', text: '= ' + (v.length > 200 ? v.slice(0, 200) + '…' : v) }),
          button('📋', function () { copy(v); }, 'ghost'));
      }));
  }

  /* ---------- tags ---------- */
  function tagBar(items, active, onPick) {
    var all = Array.from(new Set(items.flatMap(function (i) { return i.tags || []; }))).sort();
    if (!all.length) return null;
    return el('div', { class: 'row', style: 'margin:8px 0' }, all.map(function (t) {
      return el('button', { class: 'tag ' + (t === active ? 'active' : ''), type: 'button', text: '#' + t, onclick: function () { onPick(t === active ? '' : t); } });
    }));
  }
  function tagChips(tags) { return (tags || []).map(function (t) { return el('span', { class: 'tag', text: '#' + t }); }); }
  /** Estado vazio amigável. */
  function empty(icon, text) { return el('div', { class: 'empty' }, el('span', { class: 'big', text: icon }), text); }
  function badge(text, variant) { return el('span', { class: 'badge ' + (variant || ''), text: text }); }
  function tagsText(tags) { return (tags || []).map(function (t) { return '#' + t; }).join(' '); }
  /** Lê um arquivo como dataURL (Promise). */
  function readDataURL(file) {
    return new Promise(function (ok, fail) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { fail(r.error); }; r.readAsDataURL(file); });
  }
  /** Campo de texto longo com salvamento automático. */
  function autoArea(value, onSave, opts) {
    opts = opts || {};
    var ta = el('textarea', { rows: opts.rows || 10, placeholder: opts.placeholder || '', value: value || '', class: opts.code ? 'code' : '' });
    ta.addEventListener('input', debounce(function () { onSave(ta.value); }, 400));
    ta.addEventListener('blur', function () { onSave(ta.value); });
    return ta;
  }
  function demoBadge(item) { return item && item.demo ? el('span', { class: 'badge demo', title: 'Dado de demonstração — edite ou exclua', text: 'DEMO' }) : null; }

  /** Conta de 0 até o valor (animação curta em números do painel). */
  function countUp(node, to) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !to) { node.textContent = String(to); return; }
    var t0 = null, dur = 700;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  N2.ui = {
    el: el, fill: fill, uid: uid, fmtDate: fmtDate, debounce: debounce, has: has, parseTags: parseTags,
    toast: toast, copy: copy, download: download, button: button, copyBtn: copyBtn,
    modal: modal, closeTopModal: closeTopModal, confirm: confirmBox, formModal: formModal,
    tabs: tabs, card: card, codeEditor: codeEditor, dropdown: dropdown, searchBar: searchBar,
    fileUploader: fileUploader, highlight: highlight, tree: tree, findKeys: findKeys, renderFound: renderFound,
    tagBar: tagBar, tagChips: tagChips, countUp: countUp, demoBadge: demoBadge, empty: empty, badge: badge, tagsText: tagsText, readDataURL: readDataURL, autoArea: autoArea
  };

  /* Nenhum erro técnico derruba a aplicação: registra no console e avisa de forma amigável. */
  var lastWarn = 0;
  function friendly(e) {
    console.error('[Jarvis]', e);
    if (Date.now() - lastWarn > 3000) { lastWarn = Date.now(); toast('Algo não saiu como esperado nesta ação. O restante continua funcionando.'); }
  }
  window.addEventListener('error', function (ev) { friendly(ev.error || ev.message); });
  window.addEventListener('unhandledrejection', function (ev) { friendly(ev.reason); });

  /* Efeito de onda ao clicar em botões. */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn, .qa, .tile');
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
    var w = el('span', { class: 'ripple', style: 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px' });
    b.append(w); setTimeout(function () { w.remove(); }, 600);
  });

  document.addEventListener('DOMContentLoaded', function () { N2.nav.init(); });
})();
