/* Jarvis — Casos de suporte.
 * Um caso reúne descrição, evidências, validações, payloads, notas, checklist e conclusão.
 * Tudo local: textos no LocalStorage, imagens no IndexedDB (N2.store.files). */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;

  var STATUS = [
    { k: 'analise', label: '🟡 Em análise' }, { k: 'aguardando', label: '🔵 Aguardando informação' }, { k: 'n3', label: '🟣 Escalado N3' },
    { k: 'resolvido', label: '🟢 Resolvido' }, { k: 'encerrado', label: '⚪ Encerrado' }
  ];
  var PRIO = ['Baixa', 'Média', 'Alta', 'Crítica'];
  var SIS = ['CT-e', 'MDF-e', 'VG', 'Contrato de Frete', 'CIOT', 'Pagamento', 'Rota', 'Integração', 'SEFAZ', 'Outro'];
  var CATS = ['Erro', 'Dúvida', 'Integração', 'Fiscal', 'Cadastro', 'Financeiro', 'Outros'];
  var EV_TYPES = [['Texto', '📝'], ['JSON', '{ }'], ['XML', '</>'], ['Observação', '💬']];

  function statusLabel(k) { var s = STATUS.find(function (x) { return x.k === k; }); return s ? s.label : k; }
  function load() { return store.get('cases', []); }
  function blank(d) {
    var now = Date.now();
    return Object.assign({ id: ui.uid(), title: 'Novo caso', sistema: 'Outro', cat: 'Erro', status: 'analise', prio: 'Média', tags: [], fav: false,
      created: now, updated: now, accessed: now, descricao: '', evidencias: [], validacoes: '', payloads: [], notas: '', checklist: null, conclusao: '' }, d || {});
  }
  function result(c) { return { title: '🎫 ' + c.title, sub: 'Caso · ' + statusLabel(c.status) + ' · ' + c.sistema, ts: c.accessed, go: function () { N2.go('cases', { open: c.id }); } }; }

  /** Texto completo do caso, pronto para colar no chamado. Só inclui o que foi preenchido. */
  function fullText(c) {
    var out = ['CASO: ' + c.title,
      'Sistema: ' + c.sistema + ' | Categoria: ' + c.cat + ' | Status: ' + statusLabel(c.status).replace(/^\S+\s/, '') + ' | Prioridade: ' + c.prio,
      'Aberto em: ' + ui.fmtDate(c.created) + (c.tags.length ? ' | Tags: ' + ui.tagsText(c.tags) : '')];
    function sec(t, body) { if (body && body.trim()) out.push('', t + ':', body.trim()); }
    sec('DESCRIÇÃO', c.descricao);
    sec('EVIDÊNCIAS', c.evidencias.map(function (e) {
      var body = e.type === 'Imagem' ? (e.ocr ? 'Texto extraído da imagem:\n' + e.ocr : '(imagem anexada ao caso)') : e.content;
      return '- [' + e.type + '] ' + e.title + (body ? '\n' + body : '');
    }).join('\n'));
    sec('VALIDAÇÕES', c.validacoes);
    if (c.checklist) sec('CHECKLIST — ' + c.checklist.title, c.checklist.items.map(N2.checklists.line).join('\n'));
    sec('PAYLOADS', c.payloads.map(function (p) { return '- ' + p.title + '\n' + p.content; }).join('\n'));
    sec('NOTAS', c.notas);
    sec('CONCLUSÃO', c.conclusao);
    return out.join('\n');
  }

  /** Usado por outras ferramentas (ex.: Análise N2) para abrir um caso já preenchido. */
  N2.cases = {
    create: function (data) { var c = blank(data); store.update('cases', function (l) { l.push(c); return l; }, []); return c.id; }
  };

  N2.register({
    id: 'cases', title: 'Casos', icon: '🎫', group: 'Meu Workspace', desc: 'Acompanhe suas análises do início ao fim', keywords: 'caso chamado análise evidência ticket', searchGroup: 'CASOS',
    search: function (q) {
      return load().filter(function (c) { return ui.has([c.title, c.sistema, c.cat, c.descricao, c.conclusao, c.notas, c.tags.join(' ')].join(' '), q); }).map(result);
    },
    favorites: function () { return load().filter(function (c) { return c.fav; }).map(result); },
    recent: function () { return load().map(function (c) { var r = result(c); r.sub = 'Caso acessado'; return r; }); },

    render: function (root, params) {
      var cases = load(), onPaste = null;
      function save() { store.save('cases', cases); }
      function touch(c) { c.updated = Date.now(); save(); }
      function formFields() {
        return [{ key: 'title', label: 'Título' }, { key: 'sistema', label: 'Sistema', type: 'select', options: SIS }, { key: 'cat', label: 'Categoria', type: 'select', options: CATS },
          { key: 'prio', label: 'Prioridade', type: 'select', options: PRIO }, { key: 'descricao', label: 'Descrição', type: 'textarea', rows: 5 }, { key: 'tagsText', label: 'Tags (ex.: #CTE #SEFAZ)' }];
      }
      function create() {
        ui.formModal('Novo caso', formFields(), { sistema: 'CT-e', cat: 'Erro', prio: 'Média' }, function (v) {
          v.tags = ui.parseTags(v.tagsText); delete v.tagsText;
          var c = blank(v); cases.push(c); save(); detail(c);
        });
      }

      /* ---------------- lista ---------------- */
      function list() {
        if (onPaste) { document.removeEventListener('paste', onPaste); onPaste = null; }
        var q = '', fStatus = '', box = el('div');
        function draw() {
          var rows = cases.filter(function (c) {
            return (!fStatus || c.status === fStatus) && (!q || ui.has([c.title, c.sistema, c.cat, c.descricao, c.tags.join(' ')].join(' '), q));
          }).sort(function (a, b) { return b.updated - a.updated; });
          ui.fill(box, rows.length ? el('div', { class: 'card table-wrap' }, el('table', { class: 'table' },
            el('thead', null, el('tr', null, ['Caso', 'Sistema', 'Status', 'Prioridade', 'Atualizado'].map(function (h) { return el('th', { text: h }); }))),
            el('tbody', null, rows.map(function (c) {
              return el('tr', { tabindex: '0', onclick: function () { detail(c); }, onkeydown: function (e) { if (e.key === 'Enter') detail(c); } },
                el('td', null, el('strong', null, c.fav ? '★ ' : '', c.title), el('div', null, ui.tagChips(c.tags))),
                el('td', { text: c.sistema }), el('td', null, ui.badge(statusLabel(c.status), 'st-' + c.status)),
                el('td', { text: c.prio }), el('td', { class: 'small muted', text: ui.fmtDate(c.updated) }));
            }))))
            : ui.empty('🎫', cases.length ? 'Nenhum caso para esse filtro.' : 'Nenhum caso ainda. Crie o primeiro para organizar uma análise.'));
        }
        ui.fill(root, el('div', { class: 'row', style: 'margin-bottom:12px' },
          el('div', { class: 'grow' }, ui.searchBar('Buscar casos…', function (v) { q = v; draw(); })),
          el('div', { class: 'grow' }, ui.dropdown([{ value: '', label: 'Todos os status' }].concat(STATUS.map(function (s) { return { value: s.k, label: s.label }; })), '', function (v) { fStatus = v; draw(); })),
          ui.button('+ Novo caso', create, 'primary')), box);
        draw();
      }

      /* ---------------- detalhe ---------------- */
      function detail(c) {
        c.accessed = Date.now(); save();
        var head = el('div', { class: 'card' });

        function drawHead() {
          var st = ui.dropdown(STATUS.map(function (s) { return { value: s.k, label: s.label }; }), c.status, function (v) { c.status = v; touch(c); drawHead(); });
          var pr = ui.dropdown(PRIO, c.prio, function (v) { c.prio = v; touch(c); });
          st.style.width = pr.style.width = 'auto'; st.setAttribute('aria-label', 'Status'); pr.setAttribute('aria-label', 'Prioridade');
          ui.fill(head,
            el('div', { class: 'row' }, ui.button('← Casos', list, 'ghost'), el('h2', { class: 'grow', style: 'margin:0;font-size:18px', text: c.title }),
              ui.badge(statusLabel(c.status), 'st-' + c.status)),
            el('div', { class: 'small muted', style: 'margin:6px 0' }, c.sistema + ' · ' + c.cat + ' · aberto em ' + ui.fmtDate(c.created) + ' ', ui.tagChips(c.tags)),
            el('div', { class: 'toolbar' }, st, pr,
              ui.button('📋 Copiar análise completa', function () { ui.copy(fullText(c)); }, 'primary'),
              ui.button(c.fav ? '★ Favorito' : '☆ Favoritar', function () { c.fav = !c.fav; save(); drawHead(); }, c.fav ? 'on' : ''),
              ui.button('✏️ Editar dados', function () {
                ui.formModal('Editar caso', formFields().filter(function (f) { return f.key !== 'descricao'; }), Object.assign({}, c, { tagsText: ui.tagsText(c.tags) }), function (v) {
                  v.tags = ui.parseTags(v.tagsText); delete v.tagsText; Object.assign(c, v); touch(c); drawHead();
                });
              }),
              ui.button('🗑️ Excluir', function () {
                ui.confirm('Excluir o caso "' + c.title + '" e todas as suas evidências?', function () {
                  c.evidencias.forEach(function (e) { if (e.fileId) store.files.remove(e.fileId); });
                  cases = cases.filter(function (x) { return x !== c; }); save(); list();
                }, 'Excluir');
              }, 'danger')));
        }
        function area(key, placeholder, rows) { return ui.autoArea(c[key], function (v) { if (c[key] !== v) { c[key] = v; touch(c); } }, { rows: rows || 12, placeholder: placeholder }); }

        /* ----- evidências ----- */
        function evidences() {
          var box = el('div');
          function addImage(f) {
            var err = N2.ocr.validate(f); if (err) { ui.toast(err); return; }
            ui.readDataURL(f).then(function (data) {
              var id = ui.uid();
              return store.files.put({ id: id, name: f.name || 'imagem', type: f.type, data: data }).then(function () {
                c.evidencias.push({ id: ui.uid(), type: 'Imagem', title: f.name || 'Imagem colada', fileId: id, ocr: '', ts: Date.now() });
                touch(c); draw(); ui.toast('Imagem adicionada às evidências');
              });
            }).catch(function (e) { console.error(e); ui.toast('Não foi possível ler a imagem.'); });
          }
          function addText(type) {
            ui.formModal('Nova evidência — ' + type, [{ key: 'title', label: 'Título' }, { key: 'content', label: 'Conteúdo', type: 'textarea', rows: 10 }], {}, function (v) {
              if (type === 'JSON') { try { v.content = N2.json.format(v.content); } catch (e) { ui.toast('JSON inválido: salvo como foi colado'); } }
              if (type === 'XML') { try { v.content = N2.xml.format(v.content); } catch (e) { ui.toast('XML inválido: salvo como foi colado'); } }
              c.evidencias.push({ id: ui.uid(), type: type, title: v.title, content: v.content, ts: Date.now() }); touch(c); draw();
            });
          }
          function card(e) {
            var bodyBox = el('div', { style: 'margin-top:8px' }), tools = [];
            if (e.type === 'Imagem') {
              var img = el('img', { alt: e.title, class: 'ev-img' }), status = el('div', { class: 'small muted' }), ocrBox = el('div');
              var data = null;
              store.files.get(e.fileId).then(function (f) { if (f) { data = f.data; img.src = f.data; } else status.textContent = 'Arquivo da imagem não encontrado neste navegador.'; });
              function showOcr() {
                ui.fill(ocrBox, e.ocr ? [el('div', { class: 'small muted', style: 'font-weight:650;margin-top:8px', text: 'TEXTO EXTRAÍDO' }), el('pre', { class: 'out plain', text: e.ocr }), N2.ocr.infoPanel(e.ocr)] : null);
              }
              showOcr();
              bodyBox.append(img, status, ocrBox);
              tools.push(ui.button('🔤 Extrair texto (OCR)', function () {
                if (!data) { ui.toast('Imagem ainda carregando'); return; }
                status.textContent = 'Processando localmente…';
                N2.ocr.recognize(data, 'por', function (st, p) { status.textContent = st + (p != null ? ' ' + Math.round(p * 100) + '%' : '…'); })
                  .then(function (r) { e.ocr = r.text; touch(c); status.textContent = 'Concluído · confiança média ' + r.confidence + '%'; showOcr(); },
                    function (err) { console.error(err); status.textContent = N2.ocr.FAIL; });
              }));
              tools.push(ui.copyBtn(function () { return e.ocr || ''; }, '📋 Copiar texto'));
            } else {
              bodyBox.append(el('pre', { class: 'out ' + (e.type === 'JSON' || e.type === 'XML' ? '' : 'plain'), text: e.content || '' }));
              tools.push(ui.copyBtn(function () { return e.content || ''; }));
              if (e.type === 'JSON' || e.type === 'XML') tools.push(ui.button('🔬 Abrir no Inspector', function () { N2.go('payload', { text: e.content }); }));
            }
            tools.push(ui.button('🗑️ Remover', function () {
              ui.confirm('Remover a evidência "' + e.title + '"?', function () {
                if (e.fileId) store.files.remove(e.fileId);
                c.evidencias = c.evidencias.filter(function (x) { return x !== e; }); touch(c); draw();
              }, 'Remover');
            }, 'danger'));
            return el('div', { class: 'card' }, el('div', { class: 'row' }, ui.badge(e.type), el('strong', { class: 'grow', text: e.title }), el('span', { class: 'small muted', text: ui.fmtDate(e.ts) })),
              bodyBox, el('div', { class: 'toolbar' }, tools));
          }
          function draw() {
            ui.fill(box, c.evidencias.length ? c.evidencias.map(card) : ui.empty('📎', 'Nenhuma evidência. Adicione um print (Ctrl+V), um texto, um JSON ou um XML.'));
          }
          var file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: function () { if (file.files[0]) addImage(file.files[0]); file.value = ''; } });
          onPaste = function (ev) {
            var items = (ev.clipboardData && ev.clipboardData.items) || [];
            for (var i = 0; i < items.length; i++) if (items[i].type.indexOf('image/') === 0) { ev.preventDefault(); addImage(items[i].getAsFile()); return; }
          };
          document.addEventListener('paste', onPaste);
          draw();
          return el('div', null,
            el('div', { class: 'toolbar top' }, ui.button('🖼️ Imagem', function () { file.click(); }, 'primary'), file,
              EV_TYPES.map(function (t) { return ui.button(t[1] + ' ' + t[0], function () { addText(t[0]); }); }),
              el('span', { class: 'small muted', text: 'ou cole um print com Ctrl+V' })),
            box);
        }

        /* ----- payloads ----- */
        function payloads() {
          var box = el('div');
          function draw() {
            ui.fill(box, c.payloads.length ? c.payloads.map(function (p) {
              return el('div', { class: 'card' }, el('div', { class: 'row' }, el('strong', { class: 'grow', text: p.title }), el('span', { class: 'small muted', text: ui.fmtDate(p.ts) })),
                el('pre', { class: 'out', style: 'margin-top:8px;max-height:260px', text: p.content }),
                el('div', { class: 'toolbar' }, ui.copyBtn(function () { return p.content; }),
                  ui.button('🔬 Abrir no Inspector', function () { N2.go('payload', { text: p.content }); }),
                  ui.button('🗑️ Remover', function () { ui.confirm('Remover o payload "' + p.title + '"?', function () { c.payloads = c.payloads.filter(function (x) { return x !== p; }); touch(c); draw(); }, 'Remover'); }, 'danger')));
            }) : ui.empty('🔬', 'Nenhum payload registrado neste caso.'));
          }
          draw();
          return el('div', null, el('div', { class: 'toolbar top' }, ui.button('+ Adicionar payload', function () {
            ui.formModal('Novo payload', [{ key: 'title', label: 'Título (ex.: requisição de integração)' }, { key: 'content', label: 'Conteúdo (JSON, XML ou texto)', type: 'textarea', rows: 12 }], {}, function (v) {
              try { // formata se for JSON ou XML válido; senão guarda como texto
                if (/^\s*[\[{]/.test(v.content)) v.content = JSON.stringify(JSON.parse(v.content), null, 2);
                else if (/^\s*</.test(v.content)) v.content = N2.xml.format(v.content);
              } catch (e) { /* mantém como foi colado */ }
              c.payloads.push({ id: ui.uid(), title: v.title, content: v.content, ts: Date.now() }); touch(c); draw();
            });
          }, 'primary')), box);
        }

        /* ----- checklist do caso ----- */
        function checklist() {
          var box = el('div');
          function draw() {
            if (c.checklist) {
              ui.fill(box, el('div', { class: 'row', style: 'margin-bottom:8px' }, el('strong', { class: 'grow', text: c.checklist.title }),
                ui.button('Trocar checklist', function () { ui.confirm('Remover o checklist deste caso? As respostas serão perdidas.', function () { c.checklist = null; touch(c); draw(); }, 'Remover'); })),
                N2.checklists.guided(c.checklist.items, function () { touch(c); }));
              return;
            }
            var all = N2.checklists.all();
            if (!all.length) { ui.fill(box, ui.empty('📋', 'Nenhum checklist cadastrado. Crie um em Checklists.')); return; }
            var pre = all.find(function (x) { return x.sistema && c.sistema.indexOf(x.sistema) === 0; }) || all[0];
            var sel = ui.dropdown(all.map(function (x) { return { value: x.id, label: x.title }; }), pre.id);
            ui.fill(box, el('p', { class: 'muted', text: 'Escolha um dos seus checklists para responder dentro deste caso.' }),
              el('div', { class: 'row' }, el('div', { class: 'grow' }, sel), ui.button('Usar este checklist', function () {
                var ck = all.find(function (x) { return x.id === sel.value; });
                c.checklist = { title: ck.title, items: N2.checklists.guidedItems(ck) }; touch(c); draw();
              }, 'primary')));
          }
          draw();
          return box;
        }

        drawHead();
        ui.fill(root, head, el('div', { style: 'margin-top:16px' }, ui.tabs([
          { label: 'Descrição', render: function () { return area('descricao', 'O que foi relatado? Em que cenário acontece?'); } },
          { label: 'Evidências', render: evidences },
          { label: 'Validações', render: function () { return area('validacoes', 'O que você já validou e qual foi o resultado?'); } },
          { label: 'Payloads', render: payloads },
          { label: 'Notas', render: function () { return area('notas', 'Anotações livres sobre o caso…'); } },
          { label: 'Checklist', render: checklist },
          { label: 'Conclusão', render: function () {
            return el('div', null, area('conclusao', 'Causa identificada, solução aplicada ou motivo do escalonamento.', 8),
              el('div', { class: 'toolbar' }, ui.button('📋 Copiar análise completa', function () { ui.copy(fullText(c)); }, 'primary'),
                ui.button('⬇️ TXT', function () { ui.download('caso-' + c.title.replace(/[^\w\-]+/g, '_').slice(0, 40) + '.txt', fullText(c)); })));
          } }
        ], params.tab || 0)));
        params = {};
      }

      var target = params.open && cases.find(function (c) { return c.id === params.open; });
      if (target) detail(target); else list();
      if (params.create) create();
      return function () { if (onPaste) document.removeEventListener('paste', onPaste); };
    }
  });
})();
