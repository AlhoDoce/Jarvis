/* Jarvis — Comparador (Texto / JSON / XML) com diff por linhas (LCS),
 * visão lado a lado ou unificada, destaque do trecho alterado, navegação entre
 * diferenças e busca Ctrl+F em A, B e no resultado. */
(function () {
  var ui = N2.ui, el = ui.el;
  var MAX_CELLS = 6000000;

  /** Retorna [{type:'eq'|'add'|'del'|'chg', a, b, na, nb}] (na/nb = nº da linha em A/B). */
  function diff(A, B) {
    var n = A.length, m = B.length, w = m + 1, i, j;
    if ((n + 1) * w > MAX_CELLS) throw new Error('Conteúdo muito grande para comparar no navegador (reduza para alguns milhares de linhas).');
    var dp = new Uint32Array((n + 1) * w);
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      dp[i * w + j] = A[i] === B[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push({ type: 'eq', a: A[i], b: B[j], na: ++i, nb: ++j }); }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) ops.push({ type: 'del', a: A[i], na: ++i });
      else ops.push({ type: 'add', b: B[j], nb: ++j });
    }
    while (i < n) ops.push({ type: 'del', a: A[i], na: ++i });
    while (j < m) ops.push({ type: 'add', b: B[j], nb: ++j });
    // blocos removido+adicionado adjacentes viram "alterado"
    var out = [], k = 0;
    while (k < ops.length) {
      if (ops[k].type === 'eq') { out.push(ops[k++]); continue; }
      var dels = [], adds = [];
      while (k < ops.length && ops[k].type !== 'eq') { (ops[k].type === 'del' ? dels : adds).push(ops[k]); k++; }
      var p = Math.min(dels.length, adds.length);
      for (var x = 0; x < p; x++) out.push({ type: 'chg', a: dels[x].a, b: adds[x].b, na: dels[x].na, nb: adds[x].nb });
      out = out.concat(dels.slice(p), adds.slice(p));
    }
    return out;
  }
  N2.diff = diff;

  /** Trecho que mudou numa linha alterada: prefixo e sufixo em comum ficam neutros. */
  function inline(a, b) {
    var s = 0, ea = a.length, eb = b.length;
    while (s < ea && s < eb && a[s] === b[s]) s++;
    while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    function part(t, e) { return [t.slice(0, s), e > s ? el('span', { class: 'ich', text: t.slice(s, e) }) : null, t.slice(e)]; }
    return { a: part(a, ea), b: part(b, eb) };
  }

  function normalize(text, type, label) {
    try {
      if (type === 'JSON') return JSON.stringify(N2.json.sorted(N2.json.parse(text)), null, 2);
      if (type === 'XML') return N2.xml.format(text);
    } catch (e) { throw new Error(label + ': ' + e.message); }
    return text.replace(/\r/g, '');
  }

  var SAMPLE_A = '{"idViagem":10234,"status":"PENDENTE","motorista":{"nome":"Motorista Exemplo","documento":"000.000.000-00"},"documentos":[{"tipo":"CT-e","numero":1001,"idViagem":10234,"status":"AUTORIZADO"},{"tipo":"MDF-e","numero":501,"status":"REJEITADO"}]}';

  N2.register({
    id: 'compare', title: 'Comparador', icon: '⇄', group: 'Ferramentas', desc: 'Compare texto, JSON ou XML', keywords: 'diff comparar payload log diferença',
    render: function (root, params) {
      var a = ui.codeEditor({ placeholder: 'Cole aqui o conteúdo original…', rows: 12, value: params.a || '' });
      var b = ui.codeEditor({ placeholder: 'Cole aqui o conteúdo novo…', rows: 12 });
      var type = ui.dropdown(['Texto', 'JSON', 'XML'], params.type || 'Texto'); type.style.width = 'auto'; type.setAttribute('aria-label', 'Tipo de conteúdo');
      var onlyDiff = el('input', { type: 'checkbox' }), out = el('div', { class: 'cmp-out' }), last = '';
      var mode = 'side', modeSeg = el('div', { class: 'seg' }), changes = [], curChange = -1, navInfo = el('span', { class: 'small muted' });

      var find = ui.findBar([{ label: 'A', el: a }, { label: 'B', el: b }, { label: 'Resultado', el: out }], { placeholder: 'Buscar em A, B e no resultado…' });

      function drawMode() {
        ui.fill(modeSeg, [['side', 'Lado a lado'], ['unified', 'Unificado']].map(function (m) {
          return el('button', { type: 'button', class: mode === m[0] ? 'on' : '', text: m[1], onclick: function () { mode = m[0]; drawMode(); if (a.value.trim() && b.value.trim()) run(); } });
        }));
      }
      drawMode();

      function num(n) { return el('span', { class: 'ln', text: n == null ? '' : String(n) }); }
      function sideRow(o) {
        var cls = o.type, L, R;
        if (o.type === 'chg') { var p = inline(o.a, o.b); L = p.a; R = p.b; }
        else { L = o.a; R = o.b; }
        return el('div', { class: 'srow ' + cls },
          num(o.na), el('div', { class: 'cell l ' + (o.type === 'add' ? 'void' : '') }, L == null ? '' : L),
          num(o.nb), el('div', { class: 'cell r ' + (o.type === 'del' ? 'void' : '') }, R == null ? '' : R));
      }
      function uniRows(o) {
        if (o.type === 'eq') return [el('div', { class: 'urow' }, num(o.na), num(o.nb), el('span', { class: 'sym', text: ' ' }), el('span', { class: 'txt', text: o.a }))];
        if (o.type === 'chg') {
          var p = inline(o.a, o.b);
          return [el('div', { class: 'urow del' }, num(o.na), num(null), el('span', { class: 'sym', text: '−' }), el('span', { class: 'txt' }, p.a)),
            el('div', { class: 'urow add' }, num(null), num(o.nb), el('span', { class: 'sym', text: '+' }), el('span', { class: 'txt' }, p.b))];
        }
        return [el('div', { class: 'urow ' + o.type }, num(o.na), num(o.nb), el('span', { class: 'sym', text: o.type === 'add' ? '+' : '−' }), el('span', { class: 'txt', text: o.type === 'add' ? o.b : o.a }))];
      }

      function run() {
        var ops;
        try { ops = diff(normalize(a.value, type.value, 'Entrada A').split('\n'), normalize(b.value, type.value, 'Entrada B').split('\n')); }
        catch (e) { ui.fill(out, el('div', { class: 'notice warn', text: e.message })); return; }
        var c = { add: 0, del: 0, chg: 0 }, txt = [], rows = [];
        changes = []; curChange = -1;
        var box = el('div', { class: 'diff ' + (mode === 'side' ? 'side' : 'unified') });
        if (mode === 'side') box.append(el('div', { class: 'srow head' }, el('span', { class: 'ln' }), el('div', { class: 'cell', text: 'A — original' }), el('span', { class: 'ln' }), el('div', { class: 'cell', text: 'B — novo' })));
        var prevEq = true;
        ops.forEach(function (o) {
          if (o.type === 'eq') { prevEq = true; if (!onlyDiff.checked) { rows = rows.concat(mode === 'side' ? [sideRow(o)] : uniRows(o)); txt.push('  ' + o.a); } return; }
          c[o.type]++;
          var made = mode === 'side' ? [sideRow(o)] : uniRows(o);
          if (prevEq) changes.push(made[0]); // início de cada bloco de diferença
          prevEq = false;
          rows = rows.concat(made);
          if (o.type === 'chg') txt.push('~ ' + o.a, '→ ' + o.b); else txt.push(o.type === 'add' ? '+ ' + o.b : '- ' + o.a);
        });
        box.append.apply(box, rows);
        last = txt.join('\n');
        var same = !(c.add + c.del + c.chg);
        navInfo.textContent = changes.length ? changes.length + ' bloco(s) de diferença' : '';
        ui.fill(out,
          el('div', { class: 'cmp-summary' },
            same ? el('span', { class: 'pill ok' }, '✓ Conteúdos idênticos') : [
              el('span', { class: 'pill add' }, el('b', { text: String(c.add) }), ' adicionada(s)'),
              el('span', { class: 'pill del' }, el('b', { text: String(c.del) }), ' removida(s)'),
              el('span', { class: 'pill chg' }, el('b', { text: String(c.chg) }), ' alterada(s)')],
            el('span', { class: 'grow' }),
            changes.length ? [navInfo,
              el('button', { class: 'btn', type: 'button', title: 'Diferença anterior', onclick: function () { jump(-1); } }, N2.icon('up', 16)),
              el('button', { class: 'btn', type: 'button', title: 'Próxima diferença', onclick: function () { jump(1); } }, N2.icon('down', 16), 'Próxima diferença')] : null,
            ui.copyBtn(function () { return last; }, '📋 Copiar diff')),
          box);
      }
      function jump(d) {
        if (!changes.length) return;
        if (changes[curChange]) changes[curChange].classList.remove('focus');
        curChange = (curChange + d + changes.length) % changes.length;
        var r = changes[curChange];
        r.classList.add('focus'); r.scrollIntoView({ block: 'center', behavior: 'smooth' });
        navInfo.textContent = 'Diferença ' + (curChange + 1) + ' de ' + changes.length;
      }

      // compara sozinho enquanto o usuário digita/cola
      var auto = ui.debounce(function () { if (a.value.trim() && b.value.trim()) run(); }, 350);
      a.addEventListener('input', auto); b.addEventListener('input', auto); type.addEventListener('change', auto); onlyDiff.addEventListener('change', auto);
      function blank() { ui.fill(out, ui.empty('⇄', 'Preencha A e B: as diferenças aparecem aqui automaticamente.')); }
      blank();
      root.append(
        find.el,
        el('div', { class: 'split' },
          ui.card('A — original', ui.searchable(a)),
          ui.card('B — novo', ui.searchable(b))),
        el('div', { class: 'toolbar' }, type, ui.button('Comparar', run, 'primary'), modeSeg,
          el('label', { class: 'row switch' }, onlyDiff, el('span', { text: 'Só diferenças' })),
          ui.findButton(find),
          ui.button('⇅ Inverter', function () { var t = a.value; a.value = b.value; b.value = t; auto(); find.refresh(); }),
          ui.button('Limpar', function () { a.value = b.value = ''; blank(); find.refresh(); }),
          ui.button('💡 Exemplo', function () { type.value = 'JSON'; a.value = SAMPLE_A; b.value = a.value.replace('PENDENTE', 'CONCLUIDA').replace('"numero":501,', '"numero":501,"protocolo":"000123",'); run(); find.refresh(); }, 'ghost')),
        el('div', { class: 'small muted', style: 'margin:4px 0 10px', text: 'JSON: as chaves são ordenadas e o conteúdo é formatado antes de comparar. XML: é formatado antes de comparar. O trecho que mudou dentro de uma linha fica destacado.' }),
        out);
      if (params.a && params.b) { b.value = params.b; run(); }
    }
  });
})();
