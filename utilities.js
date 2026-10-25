/* Jarvis — Ferramentas rápidas (UUID, timestamp, texto, regex, URL, Base64). */
(function () {
  var ui = N2.ui, el = ui.el;

  function outLine(label, value) {
    return el('div', { class: 'row', style: 'margin-bottom:4px' }, el('span', { class: 'small muted', style: 'width:92px', text: label }),
      el('code', { class: 'mono grow', text: value }), ui.button('📋', function () { ui.copy(value); }, 'ghost'));
  }

  function uuidCard() {
    var box = el('div');
    function gen() { ui.fill(box, [1, 2, 3].map(function () { return outLine('UUID v4', ui.uid()); })); }
    gen();
    return ui.card('Gerador de UUID', box, ui.button('Gerar novos', gen, 'primary'));
  }

  function tsCard() {
    var now = el('div'), conv = el('div');
    var inp = el('input', { type: 'text', placeholder: 'Ex.: 1767225600, 1767225600000 ou 2026-01-01T00:00:00Z' });
    function drawNow() { var d = new Date(); ui.fill(now, outLine('Unix (s)', String(Math.floor(d / 1000))), outLine('Unix (ms)', String(+d)), outLine('ISO 8601', d.toISOString())); }
    function convert() {
      var v = inp.value.trim(), d;
      if (/^-?\d+$/.test(v)) d = new Date(v.length <= 11 ? +v * 1000 : +v); else d = new Date(v);
      if (!v || isNaN(d)) { ui.fill(conv, el('p', { class: 'muted small', text: v ? 'Valor não reconhecido.' : '' })); return; }
      ui.fill(conv, outLine('Local', d.toLocaleString('pt-BR')), outLine('ISO (UTC)', d.toISOString()),
        outLine('Unix (s)', String(Math.floor(d / 1000))), outLine('Unix (ms)', String(+d)));
    }
    inp.addEventListener('input', convert); drawNow();
    return ui.card('Timestamp', now, ui.button('Gerar agora', drawNow, 'primary'),
      el('h3', { style: 'margin-top:12px', text: 'Conversor' }), inp, el('div', { style: 'margin-top:8px' }, conv));
  }

  function textCard() {
    var ta = el('textarea', { rows: 8, placeholder: 'Cole o texto aqui…' }), count = el('div', { class: 'small muted' });
    function upd() {
      var t = ta.value;
      count.textContent = t.length + ' caracteres · ' + t.replace(/\s/g, '').length + ' sem espaços · ' +
        (t.trim() ? t.trim().split(/\s+/).length : 0) + ' palavras · ' + (t ? t.split('\n').length : 0) + ' linhas';
    }
    function op(label, fn) { return ui.button(label, function () { ta.value = fn(ta.value); upd(); }); }
    ta.addEventListener('input', upd); upd();
    return ui.card('Texto: contador e formatador', ta, count,
      el('div', { class: 'toolbar' },
        op('MAIÚSCULAS', function (t) { return t.toUpperCase(); }),
        op('minúsculas', function (t) { return t.toLowerCase(); }),
        op('Capitalizar', function (t) { return t.toLowerCase().replace(/(^|[\s.!?]\s*)(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); }); }),
        op('Remover espaços duplicados', function (t) { return t.replace(/[ \t]{2,}/g, ' '); }),
        op('Remover quebras de linha', function (t) { return t.replace(/\r?\n/g, ''); }),
        op('Texto para uma linha', function (t) { return t.replace(/\s+/g, ' ').trim(); }),
        op('Aparar linhas', function (t) { return t.split('\n').map(function (l) { return l.trim(); }).join('\n'); }),
        ui.copyBtn(function () { return ta.value; })));
  }

  function regexCard() {
    var pat = el('input', { type: 'text', class: 'mono', placeholder: 'Expressão, ex.: \\d{44}' });
    var flags = el('input', { type: 'text', class: 'mono', value: 'g', style: 'width:70px' });
    var ta = el('textarea', { rows: 5, placeholder: 'Texto de teste…' }), out = el('pre', { class: 'out' }), info = el('div', { class: 'small muted' });
    function run() {
      ui.fill(out); info.textContent = '';
      if (!pat.value) { out.textContent = ta.value; return; }
      var re;
      try { re = new RegExp(pat.value, flags.value.indexOf('g') < 0 ? flags.value + 'g' : flags.value); }
      catch (e) { info.textContent = 'Regex inválida: ' + e.message; return; }
      var text = ta.value, i = 0, n = 0, m;
      while ((m = re.exec(text)) && n < 5000) {
        if (m[0] === '') { re.lastIndex++; continue; }
        out.append(text.slice(i, m.index), el('mark', { text: m[0] })); i = m.index + m[0].length; n++;
      }
      out.append(text.slice(i));
      info.textContent = n + ' ocorrência(s)';
    }
    [pat, flags, ta].forEach(function (i) { i.addEventListener('input', run); });
    return ui.card('Regex Tester', el('div', { class: 'row' }, el('div', { class: 'grow' }, pat), flags), el('div', { style: 'margin:8px 0' }, ta), info, out);
  }

  function b64enc(s) { var b = new TextEncoder().encode(s), r = ''; b.forEach(function (c) { r += String.fromCharCode(c); }); return btoa(r); }
  function b64dec(s) { var r = atob(s.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(r, function (c) { return c.charCodeAt(0); })); }

  function encCard() {
    var inp = el('textarea', { rows: 5, placeholder: 'Entrada…' }), out = el('textarea', { rows: 5, readonly: true, placeholder: 'Resultado' });
    function op(label, fn) { return ui.button(label, function () { try { out.value = fn(inp.value); } catch (e) { out.value = ''; ui.toast('Entrada inválida para esta operação'); } }); }
    return ui.card('URL e Base64', inp,
      el('div', { class: 'toolbar' }, op('URL Encode', encodeURIComponent), op('URL Decode', decodeURIComponent),
        op('Base64 Encode', b64enc), op('Base64 Decode', b64dec)),
      out, el('div', { class: 'toolbar' }, ui.copyBtn(function () { return out.value; })));
  }

  N2.register({
    id: 'utilities', title: 'Utilidades', icon: '🔧', group: 'Ferramentas', desc: 'UUID, timestamp, texto, regex, URL, Base64',
    keywords: 'uuid timestamp contador caracteres palavras maiúsculas minúsculas espaços quebras regex url encoder decoder base64',
    render: function (root) {
      root.append(el('div', { class: 'grid wide' }, uuidCard(), tsCard(), textCard(), regexCard(), encCard()));
    }
  });
})();
