/* Jarvis — Central Logística (conteúdo educativo, editável).
 * O conteúdo inicial é genérico (conceitos públicos de documentos fiscais de transporte).
 * Regras específicas do ambiente da empresa NÃO são assumidas: devem ser cadastradas
 * pelo usuário em "Editar". */
(function () {
  var ui = N2.ui, el = ui.el, store = N2.store;
  var SECTIONS = [
    ['oque', 'O QUE É'], ['serve', 'PARA QUE SERVE'], ['quando', 'QUANDO É GERADO'], ['depende', 'DEPENDE DE'], ['status', 'PRINCIPAIS STATUS'],
    ['erros', 'PRINCIPAIS ERROS'], ['validar', 'O QUE VALIDAR NO N2'], ['escalar', 'QUANDO ESCALAR PARA N3'], ['obs', 'OBSERVAÇÕES']
  ];
  var TODO = 'A cadastrar: descreva aqui a regra do seu ambiente.';
  var N3 = 'Quando as validações de N2 estiverem concluídas e evidenciadas e o comportamento indicar falha de sistema (erro não tratado, dado inconsistente em banco, integração parada).';

  function T(name, icon, v) {
    var o = { id: ui.uid(), name: name, icon: icon, base: true };
    SECTIONS.forEach(function (s, i) { o[s[0]] = v[i] || TODO; });
    return o;
  }
  function defaults() {
    return [
      T('CT-e', '📄', ['Conhecimento de Transporte Eletrônico (modelo 57): documento fiscal digital que registra a prestação de serviço de transporte de cargas.',
        'Documentar a prestação para fins fiscais, amparar o transporte e servir de base para cobrança do frete.',
        'Antes do início da prestação do serviço de transporte, a partir dos dados da carga e das notas transportadas.',
        'Documentos de origem (NF-e ou outros), cadastro de remetente, destinatário e tomador, dados fiscais (CFOP, tributação) e certificado digital válido.',
        'Em digitação/pendente, enviado, autorizado, rejeitado, denegado, cancelado, inutilizado. Eventos comuns: carta de correção, cancelamento.',
        'Rejeições da SEFAZ por cadastro/IE, CFOP ou tributação incompatível, duplicidade de chave, falha de schema, certificado vencido, falha de comunicação.',
        'Chave de acesso e status na SEFAZ; código e mensagem de rejeição; tomador/pagador; documentos vinculados; se o status interno bate com o da SEFAZ; logs de integração.',
        N3, 'Prazos e regras de cancelamento e de carta de correção variam; confirme a regra vigente e a política interna.']),
      T('MDF-e', '🧾', ['Manifesto Eletrônico de Documentos Fiscais (modelo 58): documento que agrupa os documentos fiscais transportados em um veículo/viagem.',
        'Vincular CT-es/NF-es a uma unidade de carga e agilizar o registro em fiscalizações durante o trânsito.',
        'Após a emissão dos documentos da carga e antes do início da viagem.',
        'CT-es/NF-es autorizados, veículo, condutor, UFs de percurso e, quando aplicável, dados de seguro e CIOT.',
        'Pendente, autorizado, rejeitado, encerrado, cancelado.',
        'MDF-e anterior não encerrado para o mesmo veículo/UF, documento vinculado inválido, dados de veículo/condutor inconsistentes, percurso incorreto.',
        'Documentos vinculados e seus status; veículo e motorista; percurso; existência de MDF-e em aberto; retorno da SEFAZ.',
        N3, 'O encerramento do MDF-e ao final da viagem é ponto frequente de pendência.']),
      T('NFS-e', '🏷️', ['Nota Fiscal de Serviços Eletrônica: documento fiscal de prestação de serviços sujeitos ao ISS.',
        'Registrar serviços tributados pelo município (ex.: transporte dentro do mesmo município e serviços acessórios).',
        'Na prestação/faturamento do serviço, conforme regra municipal.',
        'Cadastro do tomador, código de serviço, alíquota e integração com a prefeitura ou ambiente nacional.',
        'Em geral: pendente/RPS, emitida, cancelada, substituída. Os nomes variam por município.',
        'Rejeição por código de serviço/alíquota, cadastro do tomador, lote com erro, indisponibilidade do webservice municipal.',
        'Município emissor, RPS x número da nota, retorno do webservice, dados do tomador e do serviço.',
        N3, 'Cada município pode ter layout e regras próprias.']),
      T('NF-e', '📦', ['Nota Fiscal Eletrônica (modelo 55): documento fiscal digital de circulação de mercadorias.',
        'Documentar a operação com a mercadoria; no transporte, é o documento de origem da carga referenciado no CT-e.',
        'Pelo emitente da mercadoria, antes da saída da carga.',
        'Emissão pelo embarcador. Para a transportadora, depende do recebimento/importação do XML ou da chave.',
        'Autorizada, cancelada, denegada. Eventos: carta de correção, manifestação do destinatário.',
        'Chave inválida ou não localizada, nota cancelada após a emissão do CT-e, XML não recebido, divergência de peso/valor.',
        'Chave de acesso, situação da nota, se o XML foi importado, vínculo com o CT-e.',
        N3, '']),
      T('VG', '🚛', ['Sigla de uso interno. O significado e o fluxo dependem do sistema da sua empresa.']),
      T('Contrato de Frete', '📑', ['Documento que formaliza a contratação de um transportador terceiro/agregado para executar uma viagem, com valores e condições.',
        'Registrar o valor combinado, adiantamentos, saldo, descontos e dar base ao pagamento do contratado.',
        TODO, 'Em geral: viagem, motorista, proprietário do veículo, valores negociados e, quando aplicável, CIOT.',
        TODO, TODO, 'Viagem vinculada, motorista e proprietário, valores, CIOT, status e integrações relacionadas.', N3, '']),
      T('CIOT', '🔢', ['Código Identificador da Operação de Transporte: código gerado no registro da operação de transporte rodoviário de cargas, exigido pela ANTT nos casos previstos na regulamentação.',
        'Identificar a operação e comprovar o registro do pagamento do frete ao contratado.',
        'Na contratação do transportador, antes do início da viagem, por meio de uma instituição de pagamento/administradora habilitada.',
        'Dados do contratado (RNTRC), veículo, valores do frete, origem/destino e integração com a administradora.',
        'Em geral: gerado/aberto, encerrado, cancelado. Os nomes variam conforme a administradora.',
        'RNTRC inválido ou vencido, dados cadastrais divergentes, falha de comunicação com a administradora, CIOT não encerrado.',
        'Retorno da administradora, RNTRC, dados do contratado e do veículo, vínculo com contrato/MDF-e.',
        N3, 'Confirme a regulamentação vigente da ANTT e as regras da administradora utilizada.']),
      T('Pagamento Fixo', '💵', ['Nome de uso interno para uma modalidade de pagamento. As regras dependem do seu ambiente.']),
      T('Rota', '🗺️', ['Trajeto planejado entre origem e destino, com distância (KM) e, eventualmente, pontos de parada e pedágios.',
        'Base para cálculo de frete, percurso do MDF-e, prazos e custos de viagem.']),
      T('Tabela de Preço', '💲', ['Conjunto de regras comerciais usado para calcular o valor do frete (por peso, distância, faixa, cliente, etc.).',
        'Padronizar e automatizar o cálculo do frete nos documentos.']),
      T('Faturamento', '🧮', ['Processo de consolidar os documentos de transporte emitidos em faturas/títulos de cobrança para o cliente pagador.',
        'Gerar a cobrança dos serviços prestados e alimentar o financeiro.']),
      T('Integração', '🔗', ['Troca automática de dados entre sistemas (ERP, TMS, SEFAZ, administradoras, clientes) por API, arquivos ou filas.',
        'Evitar redigitação e manter os sistemas sincronizados.',
        'A cada evento de negócio configurado (emissão, autorização, baixa, etc.).',
        'Disponibilidade dos sistemas envolvidos, credenciais/certificados válidos e dados no formato esperado.',
        'Em geral: pendente, processando, integrado, erro, reprocessado.',
        'Timeout, payload inválido, campo obrigatório ausente, cadastro inexistente no destino, credencial expirada, fila parada.',
        'Mensagem de erro e log, payload enviado e resposta, data/hora, se o reprocessamento resolve, se o problema é pontual ou generalizado.',
        N3, 'Use o Payload Inspector e o Comparador para analisar requisições e respostas.']),
      T('SEFAZ', '🏛️', ['Secretaria da Fazenda: órgão estadual que autoriza e armazena os documentos fiscais eletrônicos (NF-e, CT-e, MDF-e).',
        'Validar e autorizar os documentos e seus eventos, retornando protocolo ou rejeição.',
        'A comunicação ocorre a cada envio de documento ou evento (autorização, cancelamento, consulta).',
        'Certificado digital válido, webservices disponíveis e XML dentro do schema.',
        'Retornos típicos: autorizado, rejeitado (com código e motivo), denegado, em processamento; ambiente normal ou contingência.',
        'Indisponibilidade/instabilidade do webservice, rejeições de validação, certificado vencido, uso indevido de contingência.',
        'Código e descrição do retorno, disponibilidade dos serviços da UF, ambiente (produção/homologação), situação do documento em consulta pela chave.',
        'Quando a rejeição não se explica pelos dados do documento ou há divergência entre o status interno e o da SEFAZ que o reprocessamento não resolve.', ''])
    ];
  }
  function load() { return store.seed('logistics', defaults); }

  N2.register({
    id: 'logistics', title: 'Central Logística', icon: '🚚', group: 'Diagnóstico', desc: 'Conceitos: CT-e, MDF-e, CIOT, SEFAZ…', keywords: 'conceitos cte mdfe nfe nfse ciot sefaz base de conhecimento',
    search: function (q) {
      return load().filter(function (t) { return ui.has(t.name + ' ' + SECTIONS.map(function (s) { return t[s[0]]; }).join(' '), q); })
        .map(function (t) { return { title: t.icon + ' ' + t.name, sub: 'Central Logística', go: function () { N2.go('logistics', { open: t.id }); } }; });
    },
    render: function (root, params) {
      var topics = load(), grid = el('div', { class: 'grid' }), detail = el('div', { style: 'margin-top:12px' });
      function save() { store.set('logistics', topics); }
      function fields() { return [{ key: 'name', label: 'Nome do tópico' }, { key: 'icon', label: 'Ícone (emoji)' }].concat(SECTIONS.map(function (s) { return { key: s[0], label: s[1], type: 'textarea' }; })); }
      function edit(t) {
        ui.formModal(t ? 'Editar: ' + t.name : 'Novo tópico', fields(), t || { icon: '📌' }, function (v) {
          if (t) Object.assign(t, v); else { t = Object.assign({ id: ui.uid() }, v); topics.push(t); }
          save(); draw(); show(t);
        });
      }
      function show(t) {
        ui.fill(detail, el('div', { class: 'card' },
          el('div', { class: 'row' }, el('h1', { class: 'grow', style: 'margin:0', text: (t.icon || '') + ' ' + t.name }),
            ui.button('✏️ Editar', function () { edit(t); }),
            ui.button('🗑️', function () { ui.confirm('Excluir o tópico "' + t.name + '"?', function () { topics = topics.filter(function (x) { return x !== t; }); save(); draw(); ui.fill(detail); }, 'Excluir'); }, 'danger')),
          SECTIONS.map(function (s) {
            var v = t[s[0]] || TODO;
            return el('div', { style: 'margin-top:12px' }, el('div', { class: 'small', style: 'font-weight:700;color:var(--accent)', text: s[1] }),
              el('div', { class: v === TODO ? 'muted' : '', style: 'white-space:pre-wrap', text: v }));
          })));
        detail.scrollIntoView({ block: 'nearest' });
      }
      function draw() {
        ui.fill(grid, topics.map(function (t) {
          return el('a', { class: 'card tile', href: '#/logistics', onclick: function (e) { e.preventDefault(); show(t); } },
            el('div', { class: 'ico', text: t.icon || '📌' }), el('div', { class: 'name', text: t.name }));
        }));
      }
      root.append(
        el('div', { class: 'notice', text: 'Conteúdo inicial genérico e resumido, para referência rápida. Regras específicas do seu ambiente não são assumidas — cadastre-as em "Editar". Confirme normas fiscais em fontes oficiais.' }),
        el('div', { class: 'toolbar top' }, ui.button('+ Novo tópico', function () { edit(null); }, 'primary')), grid, detail);
      draw();
      var open = params.open && topics.find(function (t) { return t.id === params.open; });
      if (open) show(open);
    }
  });
})();
