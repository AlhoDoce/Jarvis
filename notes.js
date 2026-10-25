/* Jarvis — Bloco de notas local (categorias, tags, fixar, busca, salvamento automático). */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;
  var CATS = ['Geral', 'CT-e', 'MDF-e', 'VG', 'Contrato de Frete', 'CIOT', 'Pagamento', 'Rota', 'Integração', 'SEFAZ', 'N3', 'Outros'];

  function load() {
    return store.seed('notes', function () {
      var now = Date.now();
      return [
        { id: ui.uid(), title: 'Exemplo: pendências do dia', cat: 'Geral', tags: ['N3'], pinned: true, demo: true, created: now, updated: now,
          body: 'Esta é uma nota de demonstração.\n\n- Retornar chamado de exemplo 0001\n- Conferir reprocessamento\n- Atualizar escalonamento' },
        { id: ui.uid(), title: 'Exemplo: validação de integração', cat: 'CT-e', tags: ['CTE', 'INTEGRACAO', 'SEFAZ'], pinned: false, demo: true, created: now, updated: now,
          body: 'Nota de demonstração.\n\nPassos que costumo seguir:\n1. Validar chave e status\n2. Consultar logs de integração\n3. Reprocessar\n4. Registrar evidências' }
      ];
    }, true);
  }
  function save(notes) { store.set('notes', notes); }
  function cats() { return CATS.concat(store.get('noteCats', [])); }

  var flush = null; // grava imediatamente a nota em edição (Ctrl+S)
  N2.notes = { saveNow: function () { if (flush) { flush(); ui.toast('Nota salva'); } } };

  N2.register({
    id: 'notes', title: 'Notas', icon: '📝', group: 'Meu Workspace', desc: 'Bloco de notas com categorias e tags', keywords: 'bloco anotações', searchGroup: 'NOTAS',
    favorites: function () {
      return load().filter(function (n) { return n.fav; }).map(function (n) { return { title: '📝 ' + (n.title || 'Sem título'), sub: 'Nota · ' + n.cat, go: function () { N2.go('notes', { open: n.id }); } }; });
    },
    recent: function () {
      return load().filter(function (n) { return !n.demo; }).map(function (n) { return { title: '📝 ' + (n.title || 'Sem título'), sub: 'Nota modificada', ts: n.updated, go: function () { N2.go('notes', { open: n.id }); } }; });
    },
    search: function (q) {
      return load().filter(function (n) { return ui.has(n.title + ' ' + n.body + ' ' + n.tags.join(' '), q); }).map(function (n) {
        return { title: '📝 ' + (n.title || 'Sem título'), sub: 'Nota · ' + n.cat, go: function () { N2.go('notes', { open: n.id }); } };
      });
    },
    render: function (root, params) {
      var notes = load(), sel = null, q = '', fCat = '', fTag = '';
      var listBox = el('div', { class: 'list' }), editor = el('div', { class: 'card' }), tagsBox = el('div');

      function sorted() {
        return notes.filter(function (n) {
          return (!q || ui.has(n.title + ' ' + n.body + ' ' + n.tags.join(' '), q)) && (!fCat || n.cat === fCat) && (!fTag || n.tags.indexOf(fTag) >= 0);
        }).sort(function (a, b) { return (b.pinned - a.pinned) || (b.updated - a.updated); });
      }
      function drawList() {
        var list = sorted();
        ui.fill(listBox, list.length ? list.map(function (n) {
          return el('div', { class: 'list-item ' + (sel && sel.id === n.id ? 'active' : ''), onclick: function () { open(n.id); } },
            el('div', { class: 't' }, n.pinned ? '📌 ' : '', n.fav ? '★ ' : '', n.title || 'Sem título', ' ', ui.demoBadge(n)),
            el('div', { class: 'small muted', text: n.cat + ' · ' + ui.fmtDate(n.updated) }));
        }) : el('p', { class: 'muted small', text: 'Nenhuma nota.' }));
        ui.fill(tagsBox, ui.tagBar(notes, fTag, function (t) { fTag = t; drawList(); }) || '');
      }
      function create() {
        if (flush) flush();
        var now = Date.now();
        var n = { id: ui.uid(), title: '', cat: fCat || 'Geral', tags: [], pinned: false, body: '', created: now, updated: now };
        notes.push(n); save(notes); open(n.id, true);
      }
      function open(id, focusTitle) {
        if (flush) flush();
        sel = notes.find(function (n) { return n.id === id; }) || null;
        drawList(); drawEditor(focusTitle);
      }
      function drawEditor(focusTitle) {
        flush = null;
        if (!sel) { ui.fill(editor, ui.empty('📝', 'Selecione uma nota na lista ou crie uma nova (Alt+N).'), el('div', { class: 'row', style: 'justify-content:center' }, ui.button('+ Nova nota', create, 'primary'))); return; }
        var n = sel;
        var title = el('input', { type: 'text', placeholder: 'Título', value: n.title, style: 'font-weight:600;font-size:15px' });
        var cat = ui.dropdown(cats().indexOf(n.cat) < 0 ? cats().concat(n.cat) : cats(), n.cat);
        var tags = el('input', { type: 'text', placeholder: 'Tags: #CTE #SEFAZ', value: n.tags.map(function (t) { return '#' + t; }).join(' ') });
        var body = el('textarea', { rows: 18, placeholder: 'Escreva aqui…', value: n.body });
        var meta = el('div', { class: 'small muted' });
        function drawMeta(saved) { meta.textContent = 'Criada: ' + ui.fmtDate(n.created) + ' · Alterada: ' + ui.fmtDate(n.updated) + (saved ? ' · salvo automaticamente' : ''); }
        function commit() {
          var changed = n.title !== title.value || n.body !== body.value || n.cat !== cat.value || n.tags.join() !== ui.parseTags(tags.value).join();
          if (!changed) return;
          n.title = title.value; n.body = body.value; n.cat = cat.value; n.tags = ui.parseTags(tags.value);
          n.updated = Date.now(); delete n.demo;
          save(notes); drawList(); drawMeta(true);
        }
        var auto = ui.debounce(commit, 400);
        [title, tags, body].forEach(function (i) { i.addEventListener('input', auto); });
        cat.addEventListener('change', commit);
        flush = commit;
        drawMeta();

        ui.fill(editor, 
          title,
          el('div', { class: 'row', style: 'margin:8px 0' },
            el('div', { class: 'grow' }, cat),
            ui.button('+ Categoria', function () {
              ui.formModal('Nova categoria', [{ key: 'name', label: 'Nome da categoria' }], {}, function (v) {
                if (cats().indexOf(v.name) < 0) store.set('noteCats', store.get('noteCats', []).concat(v.name));
                commit(); flush = null; n.cat = v.name; n.updated = Date.now(); save(notes); N2.go('notes', { open: n.id });
              });
            }),
            el('div', { class: 'grow' }, tags)),
          body,
          el('div', { class: 'toolbar' },
            ui.button(n.pinned ? '📌 Desafixar' : '📌 Fixar', function () { commit(); n.pinned = !n.pinned; save(notes); drawList(); drawEditor(); }),
            ui.button(n.fav ? '★ Favorita' : '☆ Favoritar', function () { commit(); n.fav = !n.fav; save(notes); drawList(); drawEditor(); }, n.fav ? 'on' : ''),
            ui.button('⧉ Duplicar', function () {
              commit(); var now = Date.now();
              var c = Object.assign({}, n, { id: ui.uid(), title: (n.title || 'Sem título') + ' (cópia)', pinned: false, fav: false, created: now, updated: now, tags: n.tags.slice() });
              delete c.demo; notes.push(c); save(notes); open(c.id);
            }),
            ui.copyBtn(function () { return body.value; }),
            ui.button('⬇️ TXT', function () { commit(); ui.download((n.title || 'nota') + '.txt', (n.title ? n.title + '\n\n' : '') + n.body); }),
            ui.button('🗑️ Excluir', function () {
              ui.confirm('Excluir a nota "' + (n.title || 'Sem título') + '"?', function () {
                notes = notes.filter(function (x) { return x.id !== n.id; }); save(notes); sel = null; drawList(); drawEditor();
              }, 'Excluir');
            }, 'danger')),
          meta);
        if (focusTitle) title.focus();
      }

      var catFilter = ui.dropdown([{ value: '', label: 'Todas as categorias' }].concat(cats()), '', function (v) { fCat = v; drawList(); });
      root.append(el('div', { class: 'split side' },
        el('div', { class: 'card' },
          el('div', { class: 'row' }, ui.button('+ Nova nota', create, 'primary'),
            ui.button('⬇️ Todas (JSON)', function () { if (flush) flush(); ui.download('notas.json', JSON.stringify(notes, null, 2), 'application/json'); })),
          el('div', { style: 'margin:8px 0' }, ui.searchBar('Pesquisar notas…', function (v) { q = v; drawList(); })),
          catFilter, tagsBox, listBox),
        editor));

      if (params.create) create();
      else if (params.open) open(params.open);
      else { drawList(); drawEditor(); }
      return function () { if (flush) flush(); flush = null; };
    }
  });
})();
