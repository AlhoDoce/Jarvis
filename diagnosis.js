/* Jarvis — Análise N2 (assistente de diagnóstico).
 * Análise guiada: sistema + problema + checklist cadastrado (Sim / Não / Não verificado).
 * Texto vindo do OCR (params.text) entra no campo de evidências.
 * O assistente NÃO diagnostica nem sugere causas: só organiza o que o usuário informou. */
(function () {
  var ui = N2.ui, el = ui.el;
  var SIS = ['CT-e', 'MDF-e', 'VG', 'Contrato', 'CIOT', 'Pagamento', 'Rota', 'Outro'];
  var NONE = 'Não informado';

  function guidedTab(params) {
    var all = N2.checklists.all(), items = [], ckTitle = '';
    var sistema = ui.dropdown(SIS, 'CT-e'), ck = el('select'), questions = el('div');
    var problema = el('textarea', { rows: 3, placeholder: 'Descreva o problema observado…' });
    var evid = el('textarea', { rows: params.text ? 6 : 3, placeholder: 'Prints, chaves, números de documento, mensagens de erro…', value: params.text || '' });
    var acao = el('textarea', { rows: 2, placeholder: 'O que será feito a seguir?' });
    var obs = el('textarea', { rows: 2, placeholder: 'Algo mais que valha registrar.' });
    var out = el('pre', { class: 'out plain' }), resultBox = el('div');

    function fillCk() {
      ui.fill(ck, [el('option', { value: '', text: 'Sem checklist' })].concat(all.map(function (c) { return el('option', { value: c.id, text: c.title }); })));
      var match = all.find(function (c) { return c.sistema === sistema.value; });
      ck.value = match ? match.id : '';
      pickCk();
    }
    function pickCk() {
      var c = all.find(function (x) { return x.id === ck.value; });
      items = c ? N2.checklists.guidedItems(c) : []; ckTitle = c ? c.title : '';
      ui.fill(questions, c ? N2.checklists.guided(items, function () {})
        : el('p', { class: 'muted', text: 'Nenhum checklist selecionado. Você pode cadastrar checklists por sistema em Meu Workspace → Checklists.' }));
    }
    sistema.addEventListener('change', fillCk); ck.addEventListener('change', pickCk);

    function build() {
      var done = items.filter(function (i) { return i.state === 'sim' || i.state === 'nao'; });
      var pend = items.filter(function (i) { return i.state !== 'sim' && i.state !== 'nao'; });
      return ['ANÁLISE N2 — ' + sistema.value, 'Data: ' + new Date().toLocaleString('pt-BR'), '',
        'PROBLEMA:', problema.value.trim() || NONE, '',
        'EVIDÊNCIAS:', evid.value.trim() || NONE, '',
        'VALIDAÇÕES' + (ckTitle ? ' (' + ckTitle + ')' : '') + ':', done.length ? done.map(N2.checklists.line).join('\n') : 'Nenhuma validação registrada.', '',
        'PENDÊNCIAS:', pend.length ? pend.map(function (i) { return '- ' + i.t + ' (não verificado)' + (i.obs ? ' — ' + i.obs : ''); }).join('\n') : 'Nenhuma.', '',
        'PRÓXIMA AÇÃO:', acao.value.trim() || NONE, '',
        'OBSERVAÇÕES:', obs.value.trim() || NONE].join('\n');
    }
    function generate() {
      if (!problema.value.trim()) { ui.toast('Descreva o problema observado'); problema.focus(); return; }
      out.textContent = build();
      ui.fill(resultBox, out, el('div', { class: 'toolbar' },
        ui.copyBtn(function () { return out.textContent; }, '📋 Copiar análise'),
        ui.button('🎫 Salvar como caso', function () {
          var id = N2.cases.create({
            title: sistema.value + ' — ' + problema.value.trim().split('\n')[0].slice(0, 70), sistema: sistema.value === 'Contrato' ? 'Contrato de Frete' : sistema.value,
            descricao: problema.value.trim(), notas: obs.value.trim(), conclusao: '',
            validacoes: acao.value.trim() ? 'Próxima ação: ' + acao.value.trim() : '',
            evidencias: evid.value.trim() ? [{ id: ui.uid(), type: 'Texto', title: 'Evidências informadas na análise', content: evid.value.trim(), ts: Date.now() }] : [],
            checklist: ckTitle ? { title: ckTitle, items: items.map(function (i) { return { t: i.t, state: i.state, obs: i.obs }; }) } : null
          });
          ui.toast('Caso criado'); N2.go('cases', { open: id });
        }),
        ui.button('📝 Salvar como nota', function () {
          var now = Date.now();
          N2.store.update('notes', function (n) { n.push({ id: ui.uid(), title: 'Análise N2 — ' + sistema.value + ' ' + new Date().toLocaleDateString('pt-BR'), cat: 'Geral', tags: [], pinned: false, body: out.textContent, created: now, updated: now }); return n; }, []);
          ui.toast('Salvo em Notas');
        })));
      resultBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function step(n, title) { return el('h2', null, el('span', { class: 'step', text: n }), title); }
    fillCk();
    ui.fill(resultBox, ui.empty('🩺', 'Preencha os passos e clique em "Gerar análise".'));

    return el('div', { class: 'split' },
      el('div', null,
        el('div', { class: 'card' }, step(1, 'Sistema e problema'),
          el('label', { class: 'field' }, el('span', { text: 'SISTEMA' }), sistema),
          el('label', { class: 'field' }, el('span', { text: 'PROBLEMA OBSERVADO' }), problema)),
        el('div', { class: 'card' }, step(2, 'Checklist guiado'),
          el('label', { class: 'field' }, el('span', { text: 'CHECKLIST' }), ck), questions),
        el('div', { class: 'card' }, step(3, 'Complementos'),
          el('label', { class: 'field' }, el('span', { text: 'EVIDÊNCIAS' }), evid),
          el('label', { class: 'field' }, el('span', { text: 'PRÓXIMA AÇÃO' }), acao),
          el('label', { class: 'field' }, el('span', { text: 'OBSERVAÇÕES' }), obs),
          ui.button('Gerar análise', generate, 'primary'))),
      el('div', { class: 'card sticky' }, step(4, 'Análise pronta'),
        el('p', { class: 'small muted', text: 'O texto abaixo apenas organiza o que você informou. Nada é deduzido ou acrescentado.' }), resultBox));
  }

  N2.register({
    id: 'ticket', title: 'Análise N2', icon: '🩺', group: 'Diagnóstico', desc: 'Diagnóstico guiado por checklist', keywords: 'chamado ticket nota técnica análise diagnóstico',
    render: function (root, params) {
      if (params.text) root.append(el('div', { class: 'notice', text: 'O texto extraído do print foi colocado em "Evidências". Revise antes de gerar a análise.' }));
      root.append(guidedTab(params));
    }
  });
})();
