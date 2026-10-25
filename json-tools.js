/* Jarvis — leitura de JSON (N2.json): parse com mensagem de erro por linha/coluna, formatar, minificar.
 * Usado pelo Payload Inspector, Comparador e Casos. A tela antiga "JSON Tools" foi unida ao Payload Inspector. */
(function () {
  /** Posição (índice) do primeiro problema de sintaxe, ou null. Os navegadores nem sempre informam
   *  onde está o erro, então um verificador simples percorre o texto. Não executa nada do conteúdo. */
  function locate(s) {
    var i = 0, n = s.length;
    function ws() { while (i < n && /\s/.test(s[i])) i++; }
    function lit(w) { if (s.substr(i, w.length) !== w) throw i; i += w.length; }
    function str() {
      var start = i; i++;
      for (; i < n; i++) { if (s[i] === '\\') i++; else if (s[i] === '"') { i++; return; } else if (s[i] === '\n') throw i; }
      throw start;
    }
    function value() {
      ws(); var c = s[i];
      if (c === '{') { i++; ws(); if (s[i] === '}') { i++; return; }
        for (;;) { ws(); if (s[i] !== '"') throw i; str(); ws(); if (s[i] !== ':') throw i; i++; value(); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === '}') { i++; return; } throw i; } }
      if (c === '[') { i++; ws(); if (s[i] === ']') { i++; return; }
        for (;;) { value(); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ']') { i++; return; } throw i; } }
      if (c === '"') return str();
      if (c === 't') return lit('true'); if (c === 'f') return lit('false'); if (c === 'n') return lit('null');
      var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i, i + 400));
      if (!m) throw i; i += m[0].length;
    }
    try { value(); ws(); if (i < n) throw i; return null; }
    catch (p) { return typeof p === 'number' ? Math.min(p, n) : null; }
  }

  /** JSON.parse com mensagem compreensível (linha/coluna) em vez do erro técnico. */
  function parse(text) {
    try { return JSON.parse(text); }
    catch (e) {
      console.error(e);
      var at = locate(text), line, col;
      if (at != null) { var pre = text.slice(0, at).split('\n'); line = pre.length; col = pre[pre.length - 1].length + 1; }
      throw new Error('Não foi possível interpretar o JSON.' + (line ? ' Verifique a linha ' + line + ', coluna ' + col + '.' : ' Verifique aspas, vírgulas e chaves.'));
    }
  }

  N2.json = {
    parse: parse,
    format: function (t) { return JSON.stringify(parse(t), null, 2); },
    minify: function (t) { return JSON.stringify(parse(t)); },
    /** ordena as chaves para comparar conteúdo independentemente da ordem */
    sorted: function sorted(v) {
      if (Array.isArray(v)) return v.map(sorted);
      if (v && typeof v === 'object') { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = sorted(v[k]); }); return o; }
      return v;
    }
  };

})();
