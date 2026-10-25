/* Jarvis — Respostas rápidas (biblioteca de mensagens profissionais). */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;
  var CATS = ['Solicitação de evidências', 'Escalonamento N3', 'Solicitação de aprovação', 'Aprovação da diretoria', 'Retorno para operação', 'Encerramento', 'Erro não reproduzido',
    'Solicitação de teste', 'Orientação via Teams', 'Validação SEFAZ', 'Duplicidade', 'Pendência operacional'];

  function load() {
    return store.seed('templates', function () {
      var seed = [
        ['Solicitação de evidências', 'Olá, [NOME].\n\nPara darmos continuidade à análise, precisamos das seguintes evidências:\n- Print da tela com a mensagem de erro completa;\n- Número do documento/viagem envolvido;\n- Data e horário aproximados da ocorrência;\n- Passo a passo realizado até o erro.\n\nAssim que recebermos, retomamos a análise.'],
        ['Escalonamento N3', 'Olá, [NOME].\n\nConcluímos a análise em N2 e identificamos a necessidade de atuação do N3. O chamado foi escalonado com as evidências e validações realizadas.\n\nResumo: [RESUMO]\n\nManteremos você informado sobre o andamento.'],
        ['Aprovação da diretoria', 'Olá, [NOME].\n\nA ação solicitada depende de aprovação formal da diretoria responsável. Por gentileza, anexe a aprovação ao chamado para que possamos prosseguir.'],
        ['Retorno para operação', 'Olá, [NOME].\n\nApós análise, verificamos que a situação decorre de procedimento operacional: [DESCRIÇÃO].\n\nOrientação: [ORIENTAÇÃO].\n\nPermanecemos à disposição.'],
        ['Encerramento', 'Olá, [NOME].\n\nConforme validado, a situação foi regularizada: [SOLUÇÃO APLICADA].\n\nEstamos encerrando o chamado. Caso o cenário volte a ocorrer, fique à vontade para reabrir ou registrar um novo chamado.'],
        ['Erro não reproduzido', 'Olá, [NOME].\n\nRealizamos testes no cenário informado e não foi possível reproduzir o erro.\n\nPoderia, por gentileza, repetir o processo e nos enviar um print atualizado, com data e horário, caso o erro persista?'],
        ['Solicitação de teste', 'Olá, [NOME].\n\nRealizamos o ajuste referente ao cenário relatado. Poderia, por gentileza, realizar um novo teste e nos confirmar o resultado?'],
        ['Orientação via Teams', 'Olá, [NOME].\n\nConforme alinhado via Teams em [DATA], registramos aqui a orientação repassada: [ORIENTAÇÃO].'],
        ['Validação SEFAZ', 'Olá, [NOME].\n\nConsultamos o documento na SEFAZ e o status retornado foi: [STATUS/CÓDIGO].\n\nCom base nesse retorno, [PRÓXIMA AÇÃO].'],
        ['Duplicidade', 'Olá, [NOME].\n\nIdentificamos que este chamado trata do mesmo cenário do chamado [NÚMERO], já em análise. Para centralizar o atendimento, seguiremos pelo chamado original e este será encerrado como duplicidade.'],
        ['Pendência operacional', 'Olá, [NOME].\n\nA continuidade da análise depende da seguinte pendência operacional: [PENDÊNCIA].\n\nAssim que for regularizada, por gentileza nos sinalize para prosseguirmos.']
      ];
      return seed.map(function (s) { return { id: ui.uid(), cat: s[0], title: s[0] + ' — modelo padrão', body: s[1], fav: false, demo: true }; });
    });
  }

  N2.register({
    id: 'templates', title: 'Templates', icon: '💬', group: 'Meu Workspace', desc: 'Respostas rápidas prontas para copiar', keywords: 'templates mensagens modelos', searchGroup: 'TEMPLATES',
    favorites: function () {
      return load().filter(function (t) { return t.fav; }).map(function (t) { return { title: '💬 ' + t.title, sub: 'Template · ' + t.cat, go: function () { N2.go('templates', { q: t.title }); } }; });
    },
    search: function (q) {
      return load().filter(function (t) { return ui.has(t.title + ' ' + t.cat + ' ' + t.body + ' ' + (t.tags || []).join(' '), q); })
        .map(function (t) { return { title: '💬 ' + t.title, sub: 'Template · ' + t.cat, go: function () { N2.go('templates', { q: t.title }); } }; });
    },
    render: function (root, params) {
      var items = load(), q = params.q || '', fCat = '', box = el('div', { class: 'grid wide' });
      function save() { store.set('templates', items); }
      function fromForm(v) { v.tags = ui.parseTags(v.tagsText); delete v.tagsText; return v; }
      var fields = function () {
        return [{ key: 'title', label: 'Título' }, { key: 'cat', label: 'Categoria', type: 'select', options: Array.from(new Set(CATS.concat(items.map(function (i) { return i.cat; })))) },
          { key: 'body', label: 'Conteúdo', type: 'textarea', rows: 10 }, { key: 'tagsText', label: 'Tags (ex.: #SEFAZ #N3)' }];
      };
      function draw() {
        var list = items.filter(function (t) { return (!q || ui.has(t.title + ' ' + t.cat + ' ' + t.body + ' ' + (t.tags || []).join(' '), q)) && (!fCat || t.cat === fCat); })
          .sort(function (a, b) { return (b.fav - a.fav) || a.cat.localeCompare(b.cat); });
        ui.fill(box, list.length ? list.map(function (t) {
          return el('div', { class: 'card' },
            el('div', { class: 'row' }, el('h3', { class: 'grow', style: 'margin:0', text: t.title }), ui.demoBadge(t)),
            el('div', { class: 'small muted', style: 'margin-bottom:6px' }, t.cat, ' ', ui.tagChips(t.tags)),
            el('pre', { class: 'out plain', style: 'max-height:180px', text: t.body }),
            el('div', { class: 'toolbar' },
              ui.button('📋 Copiar', function () { ui.copy(t.body); }, 'primary'),
              ui.button(t.fav ? '★' : '☆', function () { t.fav = !t.fav; save(); draw(); }, t.fav ? 'on' : ''),
              ui.button('✏️ Editar', function () { ui.formModal('Editar template', fields(), Object.assign({}, t, { tagsText: ui.tagsText(t.tags) }), function (v) { Object.assign(t, fromForm(v)); delete t.demo; save(); draw(); }); }),
              ui.button('⧉ Duplicar', function () { var c = Object.assign({}, t, { id: ui.uid(), title: t.title + ' (cópia)', fav: false }); delete c.demo; items.push(c); save(); draw(); ui.toast('Template duplicado'); }),
              ui.button('🗑️', function () { ui.confirm('Excluir "' + t.title + '"?', function () { items = items.filter(function (x) { return x !== t; }); save(); draw(); }, 'Excluir'); }, 'danger')));
        }) : el('p', { class: 'muted', text: 'Nenhum template encontrado.' }));
      }
      var search = ui.searchBar('Pesquisar templates…', function (v) { q = v; draw(); }); search.value = q;
      root.append(el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('div', { class: 'grow' }, search),
        el('div', { class: 'grow' }, ui.dropdown([{ value: '', label: 'Todas as categorias' }].concat(CATS), '', function (v) { fCat = v; draw(); })),
        ui.button('+ Novo template', function () {
          ui.formModal('Novo template', fields(), { cat: CATS[0] }, function (v) { items.push(Object.assign({ id: ui.uid(), fav: false }, fromForm(v))); save(); draw(); });
        }, 'primary')), box);
      draw();
    }
  });
})();
