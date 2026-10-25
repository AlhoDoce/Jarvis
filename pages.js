/* Jarvis — Início e Configurações (Aparência, Atalhos, Backup, Privacidade). */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;

  function tile(t, sub) {
    return el('a', { class: 'card tile', href: '#/' + t.id, style: '--h:' + N2.hue(t) },
      el('div', { class: 'ico' }, N2.toolIcon(t, 20)),
      el('div', null, el('div', { class: 'name', text: t.title }), el('div', { class: 'small muted', text: sub || t.desc || '' })),
      el('span', { class: 'tile-go', 'aria-hidden': 'true', text: '→' }));
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
  /** Linha clicável (favoritos / recentes). */
  function row(r) {
    return el('div', { class: 'list-item', tabindex: '0', onclick: r.go, onkeydown: function (e) { if (e.key === 'Enter') r.go(); } },
      el('div', { class: 't', text: r.title }), el('div', { class: 'small muted', text: r.sub + (r.ts ? ' · ' + ui.fmtDate(r.ts) : '') }));
  }
  function collect(method) {
    var out = [];
    N2.tools.forEach(function (t) { if (t[method]) try { out = out.concat(t[method]()); } catch (e) { console.error(e); } });
    return out;
  }

  var QUICK = [
    { id: 'notes', icon: 'notes', name: 'Nova nota', params: { create: true }, h: 200 },
    { id: 'cases', icon: 'ticket', name: 'Novo caso', params: { create: true }, h: 265 },
    { id: 'compare', icon: 'compare', name: 'Comparar', h: 185 },
    { id: 'payload', icon: 'inspect', name: 'Inspecionar payload', h: 225 },
    { id: 'ocr', icon: 'scan', name: 'Ler print (OCR)', h: 300 },
    { id: 'ticket', icon: 'pulse', name: 'Análise N2', h: 160 }
  ];
  var PHRASES = ['comparar dois XMLs de CT-e?', 'inspecionar o payload de uma integração?', 'registrar as evidências de um caso?',
    'extrair o texto de um print?', 'montar a análise de um chamado?', 'encontrar aquele template de escalonamento?'];

  /** Frases que se escrevem sozinhas no topo do Início. Retorna a função que para a animação. */
  function typewriter(node) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { node.textContent = PHRASES[0]; return function () {}; }
    var p = 0, i = 0, del = false, t = null;
    function step() {
      var full = PHRASES[p];
      i += del ? -1 : 1;
      node.textContent = full.slice(0, i);
      var wait = del ? 22 : 45;
      if (!del && i >= full.length) { del = true; wait = 1800; }
      else if (del && i <= 0) { del = false; p = (p + 1) % PHRASES.length; wait = 350; }
      t = setTimeout(step, wait);
    }
    step();
    return function () { clearTimeout(t); };
  }

  N2.register({
    id: 'dashboard', title: 'Início', icon: '🏠', group: 'Principal',
    render: function (root) {
      var favIds = N2.nav.favs();
      var favTools = N2.tools.filter(function (t) { return favIds.indexOf(t.id) >= 0; });
      var favItems = collect('favorites');
      // recentes: ferramentas abertas (sem repetir) + últimas notas modificadas + últimos casos acessados
      var seen = {}, recent = [];
      store.get('history', []).forEach(function (h) {
        var t = N2.tool(h.id); if (!t || seen[h.id]) return; seen[h.id] = 1;
        recent.push({ title: t.icon + ' ' + t.title, sub: 'Ferramenta', ts: h.ts, go: function () { N2.go(t.id); } });
      });
      recent = recent.slice(0, 5).concat(collect('recent')).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 8);
      var cases = store.get('cases', []);
      var open = cases.filter(function (c) { return c.status !== 'resolvido' && c.status !== 'encerrado'; }).length;

      var STATS = [
        { id: 'cases', icon: 'ticket', label: 'Casos em aberto', value: open, h: 265 },
        { id: 'notes', icon: 'notes', label: 'Notas', value: store.get('notes', []).length, h: 200 },
        { id: 'checklists', icon: 'checks', label: 'Checklists', value: store.get('checklists', []).length, h: 150 },
        { id: 'kb', icon: 'book', label: 'Artigos na Base N2', value: store.get('kb', []).length, h: 290 }
      ].filter(function (st) { return N2.tool(st.id); });

      var typed = el('span', { class: 'typed' });
      var stop = typewriter(typed);
      var groups = ['Meu Workspace', 'Ferramentas', 'Diagnóstico'];

      ui.fill(root,
        el('div', { class: 'hero' },
          el('div', { class: 'hero-orb', 'aria-hidden': 'true' }),
          el('div', { class: 'eyebrow', text: greeting() + ' · ' + new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }),
          el('h1', null, 'Olá, eu sou o ', el('b', { text: 'Jarvis' }), '.'),
          el('div', { class: 'hero-sub' }, 'Vamos ', typed, el('span', { class: 'caret', 'aria-hidden': 'true' })),
          el('button', { class: 'search-trigger big', type: 'button', onclick: N2.nav.openSearch }, N2.icon('search', 19),
            el('span', { class: 'lbl', text: 'Buscar ferramentas, notas, casos, templates…' }), el('kbd', { text: 'Ctrl K' }))),
        el('div', { class: 'stats' }, STATS.map(function (st) {
          var n = el('b', { class: 'stat-n', text: '0' });
          ui.countUp(n, st.value);
          return el('a', { class: 'card stat', href: '#/' + st.id, style: '--h:' + st.h },
            el('span', { class: 'ico' }, N2.icon(st.icon, 20)), el('div', null, n, el('div', { class: 'small muted', text: st.label })));
        })),
        el('div', { class: 'section-title', text: 'Ações rápidas' }),
        el('div', { class: 'quick' }, QUICK.filter(function (q) { return N2.tool(q.id); }).map(function (q) {
          return el('a', { class: 'card qa', href: '#/' + q.id, style: '--h:' + q.h, onclick: function (e) { if (q.params) { e.preventDefault(); N2.go(q.id, q.params); } } },
            el('span', { class: 'ico' }, N2.icon(q.icon, 18)), el('span', { class: 'name', text: q.name }));
        })),
        el('div', { class: 'split', style: 'margin-top:26px' },
          el('div', { class: 'card' }, el('h2', null, N2.icon('star', 16), ' Favoritos'),
            favTools.length || favItems.length
              ? el('div', { class: 'list' }, favTools.map(function (t) { return row({ title: t.icon + ' ' + t.title, sub: 'Ferramenta', go: function () { N2.go(t.id); } }); }), favItems.map(row))
              : el('p', { class: 'muted small', text: 'Use a estrela no topo de uma ferramenta, ou em notas, casos, templates, checklists e artigos, para fixá-los aqui.' })),
          el('div', { class: 'card' }, el('div', { class: 'row' }, el('h2', { class: 'grow', style: 'margin:0' }, N2.icon('clock', 16), ' Recentes'),
              open ? el('a', { href: '#/cases' }, ui.badge(open + ' caso(s) em aberto', 'st-analise')) : null,
              store.get('history', []).length ? ui.button('Limpar', function () { store.save('history', []); store.save('usage', {}); N2.go('dashboard'); }, 'ghost') : null),
            recent.length ? el('div', { class: 'list', style: 'margin-top:8px' }, recent.map(row))
              : el('p', { class: 'muted small', style: 'margin-top:8px', text: 'O que você abrir aparece aqui.' }))),
        groups.map(function (g) {
          var list = N2.tools.filter(function (t) { return t.group === g; });
          return list.length ? [el('div', { class: 'section-title', text: g }), el('div', { class: 'grid' }, list.map(function (t) { return tile(t); }))] : null;
        }),
        el('p', { class: 'small muted', style: 'margin-top:20px', text: 'Itens marcados com DEMO são exemplos fictícios para você conhecer as telas. Edite ou exclua à vontade.' }));
      return stop;
    }
  });

  /* ---------------- Configurações ---------------- */
  N2.register({
    id: 'appearance', title: 'Aparência', icon: '🎨', group: 'Configurações', desc: 'Tema e instalação', keywords: 'tema claro escuro instalar pwa aplicativo',
    render: function (root) {
      var opts = [['light', '☀️ Claro'], ['dark', '🌙 Escuro'], ['system', '💻 Seguir o sistema']];
      var seg = el('div', { class: 'seg' });
      function draw() {
        ui.fill(seg, opts.map(function (o) {
          return el('button', { type: 'button', class: N2.nav.themePref() === o[0] ? 'on' : '', text: o[1], onclick: function () { N2.nav.setTheme(o[0]); draw(); } });
        }));
      }
      draw();
      var http = /^https?:$/.test(location.protocol);
      var installMsg = el('p', { class: 'muted', text: !http
        ? 'Para instalar como aplicativo e usar offline, abra o projeto por um servidor local (veja o README). Aberto direto pelo arquivo, ele funciona normalmente, mas o navegador não permite a instalação.'
        : 'Instale o Jarvis como aplicativo do computador. Depois de aberto uma vez, ele funciona sem internet.' });
      root.append(
        ui.card('Tema', seg, el('p', { class: 'small muted', style: 'margin-top:10px', text: 'A preferência fica salva neste navegador.' })),
        ui.card('Instalar como aplicativo', installMsg, http ? ui.button('⬇️ Instalar Jarvis', function () {
          if (!N2.nav.canInstall()) { ui.toast('Use o ícone de instalação na barra de endereço do navegador (ou o app já está instalado).'); return; }
          N2.nav.install().then(function (ok) { if (ok) ui.toast('Aplicativo instalado'); });
        }, 'primary') : null));
    }
  });

  N2.register({
    id: 'shortcuts', title: 'Atalhos', icon: '⌨️', group: 'Configurações', desc: 'Atalhos de teclado',
    render: function (root) {
      var rows = [
        ['Ctrl + K', 'Busca global'],
        ['Ctrl + N  /  Alt + N', 'Nova nota'],
        ['Ctrl + F', 'No Comparador e no Payload Inspector: buscar dentro da tela (Enter / Shift+Enter navegam)'],
        ['Ctrl + Shift + O', 'OCR'],
        ['Ctrl + Shift + J  /  X', 'Payload Inspector (JSON / XML)'],
        ['Ctrl + V', 'No OCR e nas evidências de um caso: cola a imagem'],
        ['Ctrl + S', 'Salvar nota (o salvamento já é automático)'],
        ['↑ ↓ Enter', 'Navegar e abrir resultados da busca'],
        ['Esc', 'Fechar janela / menu']
      ];
      root.append(el('div', { class: 'card' }, rows.map(function (r) {
        return el('div', { class: 'row', style: 'padding:7px 0' }, el('span', { style: 'width:190px' }, el('kbd', { text: r[0] })), el('span', { class: 'grow', text: r[1] }));
      })),
      el('div', { class: 'notice', style: 'margin-top:14px', text: 'Alguns navegadores reservam Ctrl+N (nova janela) e Ctrl+Shift+J (console) e não deixam um site substituí-los. Nesses casos use Alt+N e a busca (Ctrl+K → "payload").' }));
    }
  });

  N2.register({
    id: 'backup', title: 'Backup', icon: '💾', group: 'Configurações', desc: 'Exportar e importar seus dados', keywords: 'backup exportar importar restaurar',
    render: function (root) {
      var imp = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: function () {
        var f = imp.files[0]; imp.value = ''; if (!f) return;
        if (f.size > 200 * 1024 * 1024) { ui.toast('Arquivo grande demais para ser um backup.'); return; }
        f.text().then(function (t) {
          var parsed;
          try { parsed = JSON.parse(t); } catch (e) { console.error(e); ui.toast('O arquivo não é um JSON válido.'); return; }
          var v = store.validateBackup(parsed);
          if (!v.ok) { ui.toast(v.error); return; }
          ui.confirm('Importar este backup' + (v.exportedAt ? ' de ' + ui.fmtDate(v.exportedAt) : '') + '?\n\n' + (v.summary.join(' · ') || 'Sem coleções') +
            (v.files.length ? ' · Imagens: ' + v.files.length : '') + '\n\nOs dados atuais deste navegador serão SUBSTITUÍDOS.', function () {
            store.restore(v).then(function () { location.hash = '#/dashboard'; location.reload(); });
          }, 'Substituir meus dados');
        });
      } });
      root.append(
        ui.card('Exportar', el('p', { class: 'muted', text: 'Gera o arquivo Jarvis-Backup.json com notas, casos (e imagens), templates, checklists, Base N2, catálogo de erros e configurações.' }),
          ui.button('⬇️ EXPORTAR BACKUP', function () {
            store.backup().then(function (b) { ui.download('Jarvis-Backup.json', JSON.stringify(b, null, 2), 'application/json'); ui.toast('Backup exportado'); });
          }, 'primary')),
        ui.card('Importar', el('p', { class: 'muted', text: 'O arquivo é conferido antes de importar e você confirma antes de qualquer dado ser sobrescrito.' }),
          ui.button('⬆️ IMPORTAR BACKUP', function () { imp.click(); }), imp));
    }
  });

  N2.register({
    id: 'privacy', title: 'Privacidade', icon: '🔒', group: 'Configurações', desc: 'Onde ficam seus dados', keywords: 'privacidade limpar apagar dados',
    render: function (root) {
      var points = [
        'Seus dados são armazenados localmente, neste navegador: textos no LocalStorage e imagens de evidências no IndexedDB.',
        'O OCR é processado localmente. As imagens não são enviadas para servidores.',
        'Na primeira utilização do OCR o navegador baixa o motor (Tesseract.js) e o idioma de uma CDN pública. É um download de programa, não um envio dos seus dados.',
        'Nenhuma ferramenta envia dados para fora. Não há backend, telemetria, cookies nem IA externa.',
        'O conteúdo colado no Payload Inspector, Comparador e Utilidades fica só na memória da página.',
        'Você pode apagar tudo a qualquer momento no botão abaixo.',
        'Qualquer pessoa com acesso a este perfil do navegador consegue ler os dados locais. Evite registrar senhas, tokens e dados pessoais de clientes.'
      ];
      root.append(
        el('div', { class: 'card' }, el('ul', { style: 'margin:0;padding-left:18px' }, points.map(function (p) { return el('li', { style: 'margin-bottom:8px', text: p }); }))),
        ui.card('Apagar dados', el('p', { class: 'muted', text: 'Remove notas, casos, evidências, templates, checklists, Base N2, catálogo de erros, histórico e favoritos deste navegador.' }),
          el('div', { class: 'toolbar' },
            ui.button('💾 Fazer backup antes', function () { N2.go('backup'); }),
            ui.button('🗑️ LIMPAR TODOS OS DADOS', function () {
              ui.confirm('Apagar todos os dados locais do Jarvis?', function () {
                ui.confirm('Tem certeza? Esta ação não pode ser desfeita e não há cópia em nenhum servidor.', function () {
                  store.clearAll().then(function () { location.hash = '#/dashboard'; location.reload(); });
                }, 'Sim, apagar tudo');
              }, 'Continuar');
            }, 'danger'))));
    }
  });
})();
