/* Jarvis — leitura de XML (N2.xml) com o parser nativo do navegador, sem bibliotecas.
 * Usado pelo Payload Inspector, Comparador e Casos. A tela antiga "XML Tools" foi unida ao Payload Inspector. */
(function () {
  function esc(s, attr) {
    s = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return attr ? s.replace(/"/g, '&quot;') : s;
  }
  function parse(text) {
    var doc = new DOMParser().parseFromString(text.trim(), 'application/xml');
    var err = doc.getElementsByTagName('parsererror')[0];
    if (err) {
      var msg = err.textContent.replace(/\s+/g, ' ');
      console.error('[xml]', msg);
      var m = /line (\d+) at column (\d+): (.*?)(?= Below|$)/i.exec(msg) || /(?:Error: )?(.*?) Location:.*Line Number (\d+), Column (\d+)/i.exec(msg);
      var chrome = m && /^\d+$/.test(m[1]);
      throw new Error('Não foi possível interpretar o XML.' + (m ? ' Verifique a linha ' + (chrome ? m[1] : m[2]) + ', coluna ' + (chrome ? m[2] : m[3]) + '.\nMotivo: ' + (chrome ? m[3] : m[1]) : ' Verifique se todas as tags foram abertas e fechadas.'));
    }
    return doc;
  }
  function meaningful(node) {
    return Array.from(node.childNodes).filter(function (c) { return !(c.nodeType === 3 && !c.nodeValue.trim()); });
  }
  function ser(node, depth, pretty) {
    var pad = pretty ? '  '.repeat(depth) : '', nl = pretty ? '\n' : '';
    switch (node.nodeType) {
      case 1:
        var open = '<' + node.nodeName + Array.from(node.attributes).map(function (a) { return ' ' + a.name + '="' + esc(a.value, true) + '"'; }).join('');
        var kids = meaningful(node);
        if (!kids.length) return pad + open + '/>';
        if (kids.every(function (c) { return c.nodeType === 3; }))
          return pad + open + '>' + esc(kids.map(function (c) { return c.nodeValue; }).join('').trim()) + '</' + node.nodeName + '>';
        return pad + open + '>' + nl + kids.map(function (c) { return ser(c, depth + 1, pretty); }).join(nl) + nl + pad + '</' + node.nodeName + '>';
      case 3: return pad + esc(node.nodeValue.trim());
      case 4: return pad + '<![CDATA[' + node.nodeValue + ']]>';
      case 8: return pad + '<!--' + node.nodeValue + '-->';
      case 7: return pad + '<?' + node.target + ' ' + node.data + '?>';
      default: return pad + new XMLSerializer().serializeToString(node);
    }
  }
  function format(text, pretty) {
    var doc = parse(text), decl = text.match(/^\s*(<\?xml[^?]*\?>)/);
    var parts = Array.from(doc.childNodes).map(function (n) { return ser(n, 0, pretty); });
    if (decl) parts.unshift(decl[1]);
    return parts.join(pretty ? '\n' : '');
  }
  /** Converte elemento em objeto simples: atributos como "@nome", texto como "#text". */
  function toObj(node) {
    var kids = meaningful(node), els = kids.filter(function (c) { return c.nodeType === 1; });
    var text = kids.filter(function (c) { return c.nodeType === 3 || c.nodeType === 4; }).map(function (c) { return c.nodeValue; }).join('').trim();
    if (!els.length && !node.attributes.length) return text;
    var o = {};
    Array.from(node.attributes).forEach(function (a) { o['@' + a.name] = a.value; });
    els.forEach(function (c) {
      var v = toObj(c);
      if (c.nodeName in o) { if (!Array.isArray(o[c.nodeName])) o[c.nodeName] = [o[c.nodeName]]; o[c.nodeName].push(v); }
      else o[c.nodeName] = v;
    });
    if (text) o['#text'] = text;
    return o;
  }
  function toObject(text) { var r = parse(text).documentElement, o = {}; o[r.nodeName] = toObj(r); return o; }

  N2.xml = { parse: parse, format: function (t) { return format(t, true); }, minify: function (t) { return format(t, false); }, toObject: toObject };

})();
