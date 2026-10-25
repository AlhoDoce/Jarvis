/* Jarvis — Checklists reutilizáveis (modelos + criar, editar, duplicar, observações).
 * Também expõe N2.checklists: usado pelo Diagnóstico N2 e pelos Casos. */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;
  var SIS = ['', 'CT-e', 'MDF-e', 'VG', 'Contrato', 'CIOT', 'Pagamento', 'Rota', 'Outro'];

  function mk(title, sistema, items) { return { id: ui.uid(), title: title, sistema: sistema, modelo: true, items: items.map(function (t) { return { t: t, done: false }; }) }; }
  function load() {
    var lists = store.seed('checklists', function () {
      return [
        mk('CT-e NÃO INTEGRADO', 'CT-e', ['CT-e autorizado na SEFAZ', 'Chave validada', 'Status conferido', 'Cliente pagador validado', 'Tomador validado', 'Dados divergentes conferidos', 'Integração verificada', 'Logs consultados', 'Reprocessamento realizado', 'Evidências anexadas', 'Necessário escalar para N3']),
        mk('MDF-e', 'MDF-e', ['CT-es vinculados', 'Veículo', 'Motorista', 'Rota', 'KM', 'CIOT', 'Documentos', 'Status', 'Autorização SEFAZ', 'Erros de integração', 'Evidências']),
        mk('CONTRATO DE FRETE', 'Contrato', ['VG', 'Motorista', 'Proprietário', 'Viagem', 'Pagamento', 'CIOT', 'Status', 'XML', 'Integração', 'Pendências'])
      ];
    });
    // checklists da versão anterior não tinham "sistema": deduz pelo título
    var changed = false;
    lists.forEach(function (c) {
      if (c.sistema != null) return;
      c.sistema = /CT-?e/i.test(c.title) ? 'CT-e' : /MDF/i.test(c.title) ? 'MDF-e' : /CONTRATO/i.test(c.title) ? 'Contrato' : ''; changed = true;
    });
    if (changed) store.save('checklists', lists);
    return lists;
  }
  function asText(c) {
    return 'CHECKLIST — ' + c.title + '\n\n' + c.items.map(function (i) { return (i.done ? '[x] ' : '[ ] ') + i.t; }).join('\n') + (c.obs ? '\n\nObservações:\n' + c.obs : '');
  }

  /* ---------- checklist guiado: Sim / Não / Não verificado + observação ---------- */
  var STATES = [['sim', 'Sim'], ['nao', 'Não'], ['nv', 'Não verificado']];
  var LABEL = { sim: 'Sim', nao: 'Não', nv: 'Não verificado' };
  /** items: [{ t, state, obs }] — altera o próprio array e chama onChange. */
  function guided(items, onChange) {
    return el('div', null, items.map(function (it) {
      var seg = el('div', { class: 'seg' });
      function draw() {
        ui.fill(seg, STATES.map(function (s) {
          return el('button', { type: 'button', class: (it.state === s[0] ? 'on ' + s[0] : ''), text: s[1], onclick: function () { it.state = it.state === s[0] ? '' : s[0]; draw(); onChange(); } });
        }));
      }
      draw();
      var obs = el('input', { type: 'text', placeholder: 'Observação (opcional)', value: it.obs || '' });
      obs.addEventListener('input', function () { it.obs = obs.value; onChange(); });
      return el('div', { class: 'q' }, el('div', { class: 'q-text', text: it.t }), seg, obs);
    }));
  }
  function guidedItems(c) { return c.items.map(function (i) { return { t: i.t, state: '', obs: '' }; }); }
  function line(i) { return '- ' + i.t + ': ' + (LABEL[i.state] || 'Não verificado') + (i.obs ? ' — ' + i.obs : ''); }

  N2.checklists = { all: load, guided: guided, guidedItems: guidedItems, line: line, LABEL: LABEL };

  N2.register({
    id: 'checklists', title: 'Checklists', icon: '📋', group: 'Meu Workspace', desc: 'Roteiros de validação reutilizáveis', searchGroup: 'CHECKLISTS',
    search: function (q) {
      return load().filter(function (c) { return ui.has(c.title + ' ' + c.items.map(function (i) { return i.t; }).join(' '), q); })
        .map(function (c) { return { title: '📋 ' + c.title, sub: 'Checklist', go: function () { N2.go('checklists'); } }; });
    },
    favorites: function () {
      return load().filter(function (c) { return c.fav; }).map(function (c) { return { title: '📋 ' + c.title, sub: 'Checklist', go: function () { N2.go('checklists'); } }; });
    },
    render: function (root, params) {
      var lists = load(), grid = el('div', { class: 'grid wide' });
      function save() { store.save('checklists', lists); }
      var fields = [{ key: 'title', label: 'Título' }, { key: 'sistema', label: 'Sistema (usado no Diagnóstico N2)', type: 'select', options: SIS },
        { key: 'items', label: 'Itens (um por linha)', type: 'textarea', rows: 10 }];
      function edit(c) {
        var vals = c ? { title: c.title, sistema: c.sistema || '', items: c.items.map(function (i) { return i.t; }).join('\n') } : {};
        ui.formModal(c ? 'Editar checklist' : 'Novo checklist', fields, vals, function (v) {
          var old = c ? c.items : [];
          var items = v.items.split('\n').map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) {
            var prev = old.find(function (o) { return o.t === t; }); // mantém o que já estava marcado
            return { t: t, done: !!(prev && prev.done) };
          });
          if (c) { c.title = v.title; c.sistema = v.sistema; c.items = items; }
          else lists.push({ id: ui.uid(), title: v.title, sistema: v.sistema, items: items });
          save(); draw();
        });
      }
      function draw() {
        ui.fill(grid, lists.length ? lists.map(function (c) {
          var done = c.items.filter(function (i) { return i.done; }).length;
          var add = el('input', { type: 'text', placeholder: 'Novo item + Enter' });
          add.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && add.value.trim()) { c.items.push({ t: add.value.trim(), done: false }); save(); draw(); }
          });
          var obs = ui.autoArea(c.obs, function (v) { c.obs = v; save(); }, { rows: 2, placeholder: 'Observações deste checklist…' });
          return el('div', { class: 'card' },
            el('div', { class: 'row' }, el('h2', { class: 'grow', style: 'margin:0' }, c.fav ? '★ ' : '', c.title),
              c.sistema ? ui.badge(c.sistema) : null,
              ui.badge(done + '/' + c.items.length, done === c.items.length && done ? 'ok' : '')),
            el('progress', { max: c.items.length || 1, value: done, style: 'margin:10px 0' }),
            c.items.map(function (i, idx) {
              return el('label', { class: 'check ' + (i.done ? 'done' : '') },
                el('input', { type: 'checkbox', checked: i.done, onchange: function () { i.done = !i.done; save(); draw(); } }),
                el('span', { class: 'grow', text: i.t }),
                el('button', { class: 'btn ghost small', type: 'button', title: 'Remover item', 'aria-label': 'Remover item', onclick: function (e) { e.preventDefault(); c.items.splice(idx, 1); save(); draw(); } }, '✕'));
            }),
            el('div', { style: 'margin:8px 0' }, add), obs,
            el('div', { class: 'toolbar' },
              ui.copyBtn(function () { return asText(c); }),
              ui.button('↺ Desmarcar', function () { c.items.forEach(function (i) { i.done = false; }); save(); draw(); }),
              ui.button(c.fav ? '★' : '☆', function () { c.fav = !c.fav; save(); draw(); }, c.fav ? 'on' : ''),
              ui.button('✏️', function () { edit(c); }),
              ui.button('⧉', function () {
                lists.push({ id: ui.uid(), title: c.title + ' (cópia)', sistema: c.sistema, obs: '', items: c.items.map(function (i) { return { t: i.t, done: false }; }) });
                save(); draw(); ui.toast('Checklist duplicado');
              }),
              ui.button('🗑️', function () { ui.confirm('Excluir o checklist "' + c.title + '"?', function () { lists = lists.filter(function (x) { return x !== c; }); save(); draw(); }, 'Excluir'); }, 'danger')));
        }) : ui.empty('📋', 'Nenhum checklist. Crie o primeiro.'));
        grid.querySelectorAll('.toolbar .btn').forEach(function (b) {
          var t = { '✏️': 'Editar', '⧉': 'Duplicar', '🗑️': 'Excluir', '★': 'Remover dos favoritos', '☆': 'Favoritar' }[b.textContent];
          if (t) { b.title = t; b.setAttribute('aria-label', t); }
        });
      }
      root.append(el('div', { class: 'toolbar top' }, ui.button('+ Novo checklist', function () { edit(null); }, 'primary')), grid);
      draw();
      if (params.create) edit(null);
    }
  });
})();
