/* Jarvis — N2.collection: módulo genérico de cadastro (lista + busca + formulário).
 * Usado pela Base N2 e pelo Catálogo de Erros; evita duplicar a mesma tela.
 *
 *   N2.collection({
 *     id, title, icon, group, desc, keywords, searchGroup,
 *     storeKey,                 chave no armazenamento
 *     noun,                     ex.: 'registro', 'erro'
 *     fields: [{ key, label, type: 'text'|'textarea'|'select', options, meta }],
 *                               o 1º campo é o título; "meta" aparece como badge e vira filtro
 *     seed(), demoOnly,         dados iniciais (opcional)
 *     migrate(item) -> bool     ajusta registros antigos (opcional)
 *   });
 * Tags e favorito são adicionados automaticamente a todo registro. */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;

  N2.collection = function (cfg) {
    var titleKey = cfg.fields[0].key;
    var meta = cfg.fields.filter(function (f) { return f.meta; });
    var body = cfg.fields.filter(function (f) { return f.key !== titleKey && !f.meta; });
    var formFields = cfg.fields.concat({ key: 'tagsText', label: 'Tags (ex.: #CTE #SEFAZ)' });

    function load() {
      var items = store.seed(cfg.storeKey, cfg.seed || function () { return []; }, cfg.demoOnly);
      if (cfg.migrate) {
        var changed = false;
        items.forEach(function (i) { if (cfg.migrate(i)) changed = true; });
        if (changed) store.save(cfg.storeKey, items);
      }
      return items;
    }
    function text(a) { return cfg.fields.map(function (f) { return a[f.key]; }).concat(a.tags || []).join(' '); }
    function sub(a) { return cfg.title + (meta[0] && a[meta[0].key] ? ' · ' + a[meta[0].key] : ''); }
    function result(a) { return { title: cfg.icon + ' ' + a[titleKey], sub: sub(a), go: function () { N2.go(cfg.id, { q: a[titleKey] }); } }; }
    function asText(a) {
      return a[titleKey] + '\n' + meta.filter(function (f) { return a[f.key]; }).map(function (f) { return f.label + ': ' + a[f.key]; }).join('\n') + '\n\n' +
        body.filter(function (f) { return a[f.key]; }).map(function (f) { return f.label.toUpperCase() + ':\n' + a[f.key]; }).join('\n\n');
    }

    N2.register({
      id: cfg.id, title: cfg.title, icon: cfg.icon, group: cfg.group, desc: cfg.desc, keywords: cfg.keywords, searchGroup: cfg.searchGroup,
      search: function (q) { return load().filter(function (a) { return ui.has(text(a), q); }).map(result); },
      favorites: function () { return load().filter(function (a) { return a.fav; }).map(result); },
      render: function (root, params) {
        var items = load(), q = params.q || '', fMeta = '', fTag = '', box = el('div'), tagsBox = el('div');
        function save() { store.save(cfg.storeKey, items); }
        function edit(a) {
          var vals = a ? Object.assign({}, a, { tagsText: ui.tagsText(a.tags) }) : {};
          ui.formModal(a ? 'Editar ' + cfg.noun : 'Novo ' + cfg.noun, formFields, vals, function (v) {
            v.tags = ui.parseTags(v.tagsText); delete v.tagsText; v.updated = Date.now();
            if (a) { Object.assign(a, v); delete a.demo; } else items.push(Object.assign({ id: ui.uid(), fav: false }, v));
            save(); draw();
          });
        }
        function draw() {
          ui.fill(tagsBox, ui.tagBar(items, fTag, function (t) { fTag = t; draw(); }));
          var list = items.filter(function (a) {
            return (!q || ui.has(text(a), q)) && (!fTag || (a.tags || []).indexOf(fTag) >= 0) && (!fMeta || a[meta[0].key] === fMeta);
          }).sort(function (a, b) { return (!!b.fav) - (!!a.fav); });
          ui.fill(box, list.length ? list.map(function (a) {
            return el('details', { class: 'card', open: list.length === 1 },
              el('summary', { style: 'cursor:pointer' }, a.fav ? '★ ' : '', el('strong', null, ui.highlight(a[titleKey], q)), ' ',
                meta.filter(function (f) { return a[f.key]; }).map(function (f) { return [ui.badge(a[f.key]), ' ']; }), ui.tagChips(a.tags), ' ', ui.demoBadge(a)),
              body.filter(function (f) { return a[f.key]; }).map(function (f) {
                return el('div', { style: 'margin-top:10px' }, el('div', { class: 'small muted', style: 'font-weight:650', text: f.label.toUpperCase() }),
                  el('pre', { class: 'out plain', style: 'min-height:0' }, ui.highlight(a[f.key], q)));
              }),
              el('div', { class: 'toolbar' },
                ui.copyBtn(function () { return asText(a); }),
                ui.button(a.fav ? '★' : '☆', function () { a.fav = !a.fav; save(); draw(); }, a.fav ? 'on' : ''),
                ui.button('✏️ Editar', function () { edit(a); }),
                ui.button('⧉ Duplicar', function () { var c = Object.assign({}, a, { id: ui.uid(), fav: false }); c[titleKey] = a[titleKey] + ' (cópia)'; delete c.demo; items.push(c); save(); draw(); }),
                ui.button('🗑️', function () { ui.confirm('Excluir "' + a[titleKey] + '"?', function () { items = items.filter(function (x) { return x !== a; }); save(); draw(); }, 'Excluir'); }, 'danger')));
          }) : ui.empty(cfg.icon, items.length ? 'Nada encontrado para essa busca.' : 'Nenhum ' + cfg.noun + ' cadastrado ainda.'));
        }
        var search = ui.searchBar(cfg.searchPlaceholder || 'Buscar…', function (v) { q = v; draw(); }); search.value = q;
        var filter = meta[0] && meta[0].options ? el('div', { class: 'grow' },
          ui.dropdown([{ value: '', label: meta[0].label + ': todos' }].concat(meta[0].options), '', function (v) { fMeta = v; draw(); })) : null;
        root.append(el('div', { class: 'row', style: 'margin-bottom:12px' }, el('div', { class: 'grow' }, search), filter,
          ui.button('+ Novo ' + cfg.noun, function () { edit(null); }, 'primary')), tagsBox, box);
        draw();
        if (params.create) edit(null);
      }
    });
  };
})();
