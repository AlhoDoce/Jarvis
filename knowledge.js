/* Jarvis — Minha Base N2 (conhecimento pessoal). Usa N2.collection (crud.js). */
(function () {
  var CATS = ['CT-e', 'MDF-e', 'NFS-e', 'NF-e', 'VG', 'Contrato', 'CIOT', 'Pagamento', 'Rota', 'SEFAZ', 'Integração', 'Faturamento', 'Outros'];

  N2.collection({
    id: 'kb', title: 'Base N2', icon: '📚', group: 'Meu Workspace', desc: 'Sua base de conhecimento pessoal', keywords: 'base conhecimento artigos conceito procedimento',
    searchGroup: 'CONHECIMENTO', storeKey: 'kb', noun: 'artigo', searchPlaceholder: 'Busca instantânea na base…', demoOnly: true,
    fields: [
      { key: 'title', label: 'Título' },
      { key: 'cat', label: 'Categoria', type: 'select', options: CATS, meta: true },
      { key: 'conceito', label: 'Conceito', type: 'textarea' },
      { key: 'quando', label: 'Quando ocorre', type: 'textarea' },
      { key: 'validar', label: 'O que validar', type: 'textarea' },
      { key: 'procedimento', label: 'Procedimento', type: 'textarea' },
      { key: 'obs', label: 'Observações', type: 'textarea' }
    ],
    seed: function () {
      return [{ id: N2.ui.uid(), demo: true, fav: false, title: 'Fluxo de análise de CT-e', cat: 'CT-e', tags: ['CTE', 'INTEGRACAO'],
        conceito: 'Artigo de exemplo (fictício). Roteiro pessoal para analisar chamados de CT-e.',
        quando: 'Sempre que um chamado relatar CT-e que não aparece, não integra ou foi rejeitado.',
        validar: 'Chave de acesso, status na SEFAZ, tomador/pagador, logs de integração, tentativa de reprocessamento.',
        procedimento: '', obs: 'Substitua pelo procedimento real do seu ambiente.', updated: Date.now() }];
    },
    /* Registros da versão anterior (descrição/sintoma/causa/solução...) passam para a estrutura nova sem perder texto. */
    migrate: function (a) {
      if ('conceito' in a) return false;
      function join() { return Array.prototype.slice.call(arguments).filter(function (p) { return p[1]; }).map(function (p) { return p[0] ? p[0] + ': ' + p[1] : p[1]; }).join('\n'); }
      a.conceito = a.descricao || '';
      a.quando = join(['', a.sintoma], ['Causa', a.causa]);
      a.validar = a.validacoes || '';
      a.procedimento = join(['', a.solucao], ['Comandos', a.comandos], ['Consultas', a.consultas]);
      a.obs = join(['', a.obs], ['Evidências', a.evidencias]);
      ['descricao', 'sintoma', 'causa', 'validacoes', 'solucao', 'comandos', 'consultas', 'evidencias'].forEach(function (k) { delete a[k]; });
      return true;
    }
  });
})();
