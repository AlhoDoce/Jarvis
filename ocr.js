/* Jarvis — OCR local (Tesseract.js, executa em Web Worker no próprio navegador).
 * A biblioteca só é carregada quando o usuário roda o primeiro OCR.
 * Ordem de carga: js/vendor/tesseract.min.js (cópia local, opcional) -> CDN.
 *
 * N2.ocr.recognize(file, lang, onProgress, opts) é reutilizado pelos Casos.
 * opts.rectangle = { left, top, width, height } já é repassado ao motor: basta uma
 * interface de seleção para ativar o OCR por região no futuro. */
(function () {
  var ui = N2.ui, el = ui.el;
  var MAX_BYTES = 10 * 1024 * 1024;
  var TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];
  var LANGS = [{ value: 'por', label: 'Português' }, { value: 'eng', label: 'Inglês' }, { value: 'spa', label: 'Espanhol' }];
  var LOCAL = 'js/vendor/tesseract.min.js';
  var CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  var loading = null;

  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { s.remove(); fail(new Error('Não foi possível carregar ' + src)); };
      document.head.append(s);
    });
  }
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!loading) loading = loadScript(LOCAL).catch(function () { return loadScript(CDN); }).catch(function (e) { loading = null; throw e; });
    return loading;
  }

  /** Retorna mensagem de erro (string) ou null se o arquivo é aceitável. */
  function validate(f) {
    if (!f || TYPES.indexOf(f.type) < 0) return 'Formato não suportado. Use PNG, JPG, WEBP, BMP ou GIF.';
    if (f.size > MAX_BYTES) return 'Imagem maior que 10 MB.';
    return null;
  }

  /** file: File/Blob/dataURL. Promise<{ text, confidence }>. */
  function recognize(file, lang, onProgress, opts) {
    var worker;
    return loadTesseract().then(function () {
      return Tesseract.createWorker(lang || 'por', 1, { logger: function (m) { if (onProgress) onProgress(m.status, m.status === 'recognizing text' ? m.progress : null); } });
    }).then(function (w) { worker = w; return w.recognize(file, opts && opts.rectangle ? { rectangle: opts.rectangle } : {}); })
      .then(function (r) { worker.terminate(); return { text: r.data.text.trim(), confidence: Math.round(r.data.confidence) }; },
        function (e) { if (worker) worker.terminate(); throw e; });
  }
  var FAIL = 'Não foi possível executar o OCR. Na primeira execução é preciso internet para baixar o motor e o idioma (depois funciona offline).';

  /* ---------- OCR inteligente: só identifica o que está escrito no texto ---------- */
  function extractInfo(text) {
    var out = [], seen = {};
    function add(label, value) { var k = label + '|' + value; if (!seen[k]) { seen[k] = 1; out.push({ label: label, value: value }); } }
    var m, re;
    re = /(?:\d[ .]?){43}\d/g;                                   // chave de acesso: 44 dígitos (com ou sem espaços)
    while ((m = re.exec(text))) add('Chave de acesso', m[0].replace(/\D/g, ''));
    var rest = text.replace(/(?:\d[ .]?){43}\d/g, ' ');
    re = /\b(NFS-?e|NF-?e|CT-?e|MDF-?e|CIOT)\b\s*(?:n[ºo°.]{0,2}|n[uú]mero|nro\.?|#)?\s*[:\-]?\s*(\d{3,15})(?!\d)/gi;
    while ((m = re.exec(rest))) add(m[1].toUpperCase().replace(/^(NFS|NF|CT|MDF)-?E$/, '$1-e'), m[2]);
    re = /\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g;
    while ((m = re.exec(rest))) add('CNPJ', m[0]);
    re = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
    while ((m = re.exec(rest))) add('CPF', m[0]);
    re = /\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/g;
    while ((m = re.exec(rest))) add('Placa', m[0]);
    re = /\b\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2}(?::\d{2})?)?\b/g;
    while ((m = re.exec(rest))) add('Data', m[0]);
    return out;
  }
  function infoPanel(text) {
    var info = extractInfo(text || '');
    return el('div', null, el('div', { class: 'section-title', style: 'margin-top:14px', text: 'Informações encontradas' }),
      info.length ? info.map(function (i) {
        return el('div', { class: 'row', style: 'padding:3px 0' }, el('span', { class: 'small muted', style: 'width:118px', text: i.label }),
          el('code', { class: 'mono grow', text: i.value }), ui.button('Copiar', function () { ui.copy(i.value); }));
      }) : el('p', { class: 'small muted', text: 'Nenhuma chave, número de documento, CNPJ/CPF, placa ou data identificado no texto.' }),
      info.length ? el('p', { class: 'small muted', style: 'margin-top:6px', text: 'Identificado apenas pelo formato do texto extraído. Confira antes de usar: o OCR pode trocar caracteres.' }) : null);
  }

  N2.ocr = { recognize: recognize, validate: validate, extractInfo: extractInfo, infoPanel: infoPanel, LANGS: LANGS, FAIL: FAIL };

  N2.register({
    id: 'ocr', title: 'OCR', icon: '🖼️', group: 'Ferramentas', desc: 'Extrair texto da imagem', keywords: 'imagem print texto tesseract',
    render: function (root) {
      var file = null, url = null, busy = false, HINT = 'Clique, arraste uma imagem ou pressione Ctrl+V para colar';
      var lang = ui.dropdown(LANGS, 'por'); lang.style.width = 'auto';
      var out = el('textarea', { rows: 14, placeholder: 'O texto extraído aparece aqui.' });
      var bar = el('progress', { max: 1, value: 0 }), status = el('div', { class: 'small muted', text: 'Aguardando imagem.' }), infoBox = el('div');
      var drop = ui.fileUploader({ accept: TYPES.join(','), label: HINT, onFile: setFile });
      var hint = drop.firstChild;
      function showInfo() { ui.fill(infoBox, out.value.trim() ? infoPanel(out.value) : null); }
      out.addEventListener('input', ui.debounce(showInfo, 400));

      function setFile(f, auto) {
        var err = validate(f); if (err) { ui.toast(err); return; }
        file = f;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(f);
        ui.fill(hint, el('img', { src: url, alt: 'Pré-visualização' }));
        status.textContent = 'Imagem carregada (' + Math.round(f.size / 1024) + ' KB).';
        bar.value = 0;
        if (auto) run();
      }
      function run() {
        if (!file) { ui.toast('Selecione uma imagem primeiro'); return; }
        if (busy) return;
        busy = true; status.textContent = 'Carregando motor de OCR…'; bar.removeAttribute('value');
        recognize(file, lang.value, function (st, p) { status.textContent = st + '…'; if (p != null) bar.value = p; })
          .then(function (r) {
            out.value = r.text; bar.value = 1; showInfo();
            status.textContent = 'Concluído · confiança média ' + r.confidence + '%';
          }, function (e) { console.error(e); bar.value = 0; status.textContent = FAIL; })
          .then(function () { busy = false; });
      }
      function clear() {
        file = null; if (url) URL.revokeObjectURL(url); url = null;
        ui.fill(hint, HINT); out.value = ''; bar.value = 0; status.textContent = 'Aguardando imagem.'; showInfo();
      }
      // Ctrl+V com imagem na área de transferência -> carrega e já extrai
      function onPaste(e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image/') === 0) { e.preventDefault(); setFile(items[i].getAsFile(), true); return; }
        }
      }
      document.addEventListener('paste', onPaste);

      root.append(
        el('div', { class: 'notice', text: '🔒 Processamento local — a imagem não é enviada para servidores.' }),
        el('div', { class: 'split' },
          ui.card('Imagem', drop,
            el('div', { class: 'toolbar' }, lang, ui.button('▶ Extrair texto', run, 'primary'), ui.button('Limpar', clear)),
            el('div', { style: 'margin-top:10px' }, bar), status),
          ui.card('Texto extraído', out,
            el('div', { class: 'toolbar' },
              ui.copyBtn(function () { return out.value; }),
              ui.button('⬇️ TXT', function () { ui.download('ocr.txt', out.value); }),
              ui.button('🎫 Usar na Análise N2', function () { N2.go('ticket', { text: out.value }); })),
            infoBox)));

      return function () { document.removeEventListener('paste', onPaste); if (url) URL.revokeObjectURL(url); };
    }
  });
})();
