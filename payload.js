/* Jarvis — Payload Inspector (JSON / XML / Texto).
 * Reúne o que antes eram três telas (JSON Tools, XML Tools e Payload Inspector):
 * detecta o tipo, valida com linha/coluna do erro, formata, minifica, mostra em árvore,
 * localiza campos (com caminho e valor) e tem busca Ctrl+F no payload e na visualização. */
(function () {
  var ui = N2.ui, el = ui.el;
  var SAMPLE = '{"idViagem":10234,"status":"PENDENTE","motorista":{"nome":"Motorista Exemplo","documento":"000.000.000-00"},"documentos":[{"tipo":"CT-e","numero":1001,"idViagem":10234,"status":"AUTORIZADO"},{"tipo":"MDF-e","numero":501,"idViagem":10234,"status":"REJEITADO"}]}';
  var SAMPLE_XML = '<viagem id="10234"><status>PENDENTE</status><documentos><documento tipo="CT-e"><numero>1001</numero><status>AUTORIZADO</status></documento><documento tipo="MDF-e"><numero>501</numero><status>REJEITADO</status></documento></documentos></viagem>';

  /** { type: 'JSON'|'XML'|'Texto', error } — error quando parece JSON/XML mas não é válido. */
  function detect(t) {
    t = t.trim();
    if (/^[\[{]/.test(t)) { try { N2.json.parse(t); return { type: 'JSON' }; } catch (e) { return { type: 'JSON', error: e.message }; } }
    if (/^</.test(t)) { try { N2.xml.parse(t); return { type: 'XML' }; } catch (e) { return { type: 'XML', error: e.message }; } }
    return { type: 'Texto' };
  }

  N2.register({
    id: 'payload', title: 'Payload Inspector', icon: '🔬', group: 'Ferramentas', desc: 'JSON, XML ou texto: validar, formatar, árvore e busca',
    keywords: 'payload api request response campo idViagem json xml formatador minificador validador árvore',
    render: function (root, params) {
      var input = ui.codeEditor({ placeholder: 'Cole o payload (JSON, XML ou texto)…', rows: 18, value: params.text || '' });
      var kind = ui.badge('aguardando');
      var field = el('input', { type: 'text', placeholder: 'Campo, ex.: idViagem', style: 'max-width:240px' });
      var view = el('div');
      var ext = { JSON: 'json', XML: 'xml', Texto: 'txt' };

      /** Atualiza o selo de tipo/validade e devolve a detecção. */
      function type() {
        if (!input.value.trim()) { kind.className = 'badge'; kind.textContent = 'aguardando'; return { type: 'Texto' }; }
        var d = detect(input.value);
        kind.className = 'badge ' + (d.error ? 'bad' : d.type === 'Texto' ? '' : 'ok');
        kind.textContent = d.type === 'Texto' ? 'texto' : d.type + (d.error ? ' inválido' : ' válido');
        return d;
      }
      function obj(t) { return t === 'JSON' ? JSON.parse(input.value) : N2.xml.toObject(input.value); }
      function term() { return field.value.replace(/^\s*campo\s*=\s*/i, '').trim(); }
      function need() { if (!input.value.trim()) { ui.toast('Cole o payload primeiro'); return false; } return true; }
      function invalid(d) { ui.fill(view, ui.card(null, el('div', { class: 'notice warn', style: 'margin:0;white-space:pre-line', text: d.error }))); }

      function rewrite(fn) {
        if (!need()) return;
        var d = type();
        if (d.error) { invalid(d); return; }
        if (d.type === 'JSON') input.value = fn === 'min' ? N2.json.minify(input.value) : N2.json.format(input.value);
        else if (d.type === 'XML') input.value = fn === 'min' ? N2.xml.minify(input.value) : N2.xml.format(input.value);
        show();
        fb.refresh();
      }
      function format() { rewrite('fmt'); }
      function show(tab) {
        if (!need()) return;
        var d = type(), q = term();
        if (d.error) { invalid(d); return; }
        ui.fill(view, ui.card(null, ui.tabs([
          { label: 'Texto', render: function () { return el('pre', { class: 'out' }, ui.highlight(input.value, q)); } },
          { label: 'Árvore', render: function () {
            return d.type === 'Texto' ? el('p', { class: 'muted', text: 'Disponível para JSON e XML válidos.' }) : ui.tree(obj(d.type), null, q);
          } }
        ], tab || 0)));
      }
      /* Encontrar campo: conta as ocorrências no texto e permite navegar entre elas. */
      function find() {
        if (!need()) return;
        var q = term(); if (!q) { ui.toast('Informe o campo'); field.focus(); return; }
        var d = type(), cur = -1;
        var pre = el('pre', { class: 'out' }, ui.highlight(input.value, q));
        var marks = pre.querySelectorAll('mark'), count = el('strong'), pos = el('span', { class: 'small muted' });
        function goTo(i) {
          if (!marks.length) return;
          if (marks[cur]) marks[cur].classList.remove('cur');
          cur = (i + marks.length) % marks.length;
          marks[cur].classList.add('cur');
          marks[cur].scrollIntoView({ block: 'center', behavior: 'smooth' });
          pos.textContent = (cur + 1) + ' de ' + marks.length;
        }
        count.textContent = marks.length ? 'Encontrada(s) ' + marks.length + ' ocorrência(s) de "' + q + '".' : 'Nenhuma ocorrência de "' + q + '".';
        var paths = d.type === 'Texto' || d.error ? null : ui.findKeys(obj(d.type), q);
        ui.fill(view,
          ui.card(null,
            el('div', { class: 'row' }, el('span', { class: 'grow' }, count), pos,
              marks.length ? ui.button('↑ Anterior', function () { goTo(cur - 1); }) : null,
              marks.length ? ui.button('Próxima ↓', function () { goTo(cur + 1); }, 'primary') : null),
            el('div', { style: 'margin-top:10px' }, pre)),
          paths && paths.length ? ui.card('Campos e valores', ui.renderFound(paths, q)) : null);
        if (marks.length) { cur = -1; goTo(0); }
      }
      input.addEventListener('input', ui.debounce(type, 300));
      input.addEventListener('paste', function () { setTimeout(format, 0); }); // colou: valida, formata e mostra
      field.addEventListener('keydown', function (e) { if (e.key === 'Enter') find(); });
      function blank() { ui.fill(view, ui.card(null, ui.empty('🔬', 'Cole um JSON, XML ou texto ao lado. Ele é validado, formatado e exibido aqui.'))); }

      var fb = ui.findBar([{ label: 'Payload', el: input }, { label: 'Visualização', el: view }], { placeholder: 'Buscar no payload e na visualização…' });
      root.append(fb.el, el('div', { class: 'split' },
        ui.card('Payload', ui.searchable(input),
          el('div', { class: 'toolbar' }, field, ui.button('🔎 Encontrar campo', find, 'primary'), ui.findButton(fb)),
          el('div', { class: 'toolbar' }, kind, ui.button('Formatar', format), ui.button('Minificar', function () { rewrite('min'); }),
            ui.button('Árvore', function () { show(1); }),
            ui.copyBtn(function () { return input.value; }),
            ui.button('⇄ Comparar', function () { if (need()) N2.go('compare', { a: input.value, type: type().type }); }),
            ui.button('⬇️ Download', function () { if (need()) ui.download('payload.' + ext[type().type], input.value); }),
            ui.button('Limpar', function () { input.value = ''; blank(); type(); fb.refresh(); })),
          el('div', { class: 'toolbar' },
            ui.button('💡 Exemplo JSON', function () { input.value = SAMPLE; field.value = 'idViagem'; format(); find(); }, 'ghost'),
            ui.button('💡 Exemplo XML', function () { input.value = SAMPLE_XML; field.value = 'status'; format(); find(); }, 'ghost'))),
        el('div', null, view)));
      if (params.text) format(); else blank();
    }
  });
})();
