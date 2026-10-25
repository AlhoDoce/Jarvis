/* Jarvis — Catálogo de Erros. Usa N2.collection (crud.js).
 * O conteúdo é cadastrado pelo usuário: o projeto não traz soluções prontas. */
(function () {
  var SIS = ['CT-e', 'MDF-e', 'NFS-e', 'NF-e', 'VG', 'Contrato de Frete', 'CIOT', 'Pagamento', 'Rota', 'SEFAZ', 'Integração', 'Outro'];

  N2.collection({
    id: 'errors', title: 'Catálogo de Erros', icon: '🚨', group: 'Diagnóstico', desc: 'Mensagens de erro e o que fazer', keywords: 'erro mensagem rejeição falha catálogo',
    searchGroup: 'CONHECIMENTO', storeKey: 'errors', noun: 'erro', searchPlaceholder: 'Cole ou digite a mensagem de erro…', demoOnly: true,
    fields: [
      { key: 'title', label: 'Título' },
      { key: 'sistema', label: 'Sistema', type: 'select', options: SIS, meta: true },
      { key: 'mensagem', label: 'Mensagem', type: 'textarea', rows: 2 },
      { key: 'contexto', label: 'Contexto', type: 'textarea' },
      { key: 'sintoma', label: 'Sintoma', type: 'textarea' },
      { key: 'causas', label: 'Possíveis causas', type: 'textarea' },
      { key: 'validacoes', label: 'Validações', type: 'textarea' },
      { key: 'procedimento', label: 'Procedimento', type: 'textarea' },
      { key: 'escalar', label: 'Quando escalar', type: 'textarea' },
      { key: 'obs', label: 'Observações', type: 'textarea' }
    ],
    seed: function () {
      return [{ id: N2.ui.uid(), demo: true, fav: false, title: 'Erro de integração', sistema: 'Integração', tags: ['INTEGRACAO'],
        mensagem: 'Exemplo fictício: "Falha ao integrar o documento."',
        contexto: '', sintoma: '', causas: '', validacoes: '', procedimento: '', escalar: '',
        obs: 'Registro de exemplo. Edite e preencha com a mensagem real, as causas e o procedimento do seu ambiente.', updated: Date.now() }];
    }
  });
})();
