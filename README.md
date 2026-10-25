# Jarvis

Seu assistente pessoal de suporte N2 e logística (antigo N2 Toolkit): analise, compare, documente e consulte em um só lugar.
HTML, CSS e JavaScript puros — sem build, sem backend, sem dependências para instalar.

## Como executar

**Opção 1 — abrir direto:** dê dois cliques em `index.html`. Funciona pelo protocolo `file://`.

**Opção 2 — servidor local (recomendado para o OCR e para copiar/colar sem restrições):**

```bash
cd jarvis
python -m http.server 8080      # ou: npx serve
```

Abra `http://localhost:8080`.

## OCR 100% offline (opcional)

O OCR usa Tesseract.js e roda no navegador, em Web Worker; a imagem nunca sai da máquina.
Por padrão, na primeira execução o navegador baixa o motor e o idioma de uma CDN pública
(jsDelivr). Para não depender de internet:

1. Baixe `tesseract.min.js` (pacote npm `tesseract.js` v5, pasta `dist/`) e salve em `js/vendor/tesseract.min.js`.
   O toolkit tenta esse arquivo antes da CDN.
2. Para também servir worker, núcleo WASM e idiomas localmente, passe `workerPath`, `corePath`
   e `langPath` em `Tesseract.createWorker(...)` no arquivo `js/ocr.js`.

## Instalar como aplicativo / offline (PWA)

Abrindo por servidor local (`http://localhost:8080`), o navegador registra o `service-worker.js`:
o Jarvis passa a abrir sem internet e pode ser instalado em *Configurações → Aparência* (ou pelo ícone
de instalação na barra de endereço). Aberto direto pelo arquivo (`file://`) tudo funciona, mas o
navegador não permite instalação nem service worker. Depois do primeiro OCR com internet, o motor
e o idioma ficam em cache e o OCR também funciona offline.

## Estrutura

```
index.html  manifest.json  service-worker.js  icons/
css/style.css          tokens de tema (claro/escuro), fundo animado, layout, responsividade
css/components.css     botão, card, modal, toast, tabs, tabela, diff, busca Ctrl+F, animações...
js/app.js              núcleo: N2.register + componentes (N2.ui) + tratamento global de erros
js/icons.js            ícones SVG (N2.icon / N2.toolIcon)
js/storage.js          camada única de dados: LocalStorage (textos), IndexedDB (imagens), backup
js/crud.js             N2.collection: cadastro genérico (lista + busca + formulário)
js/find.js             busca dentro da tela (Ctrl+F): ui.findBar + ui.searchable
js/navigation.js       sidebar, header, rotas, busca universal, tema, atalhos, PWA
js/pages.js            Início + Configurações (Aparência, Atalhos, Backup, Privacidade)
  Meu Workspace        notes.js  cases.js  templates.js  checklists.js  knowledge.js
  Ferramentas          ocr.js  compare.js  payload.js  utilities.js
                       (json-tools.js e xml-tools.js agora só trazem os leitores N2.json / N2.xml)
  Diagnóstico          diagnosis.js  errors.js  logistics.js
```

Ao criar um arquivo novo em `/js` ou `/css`, inclua-o também na lista `SHELL` do
`service-worker.js` e aumente `VERSION`.

## Como adicionar uma ferramenta

1. Crie `js/minha-ferramenta.js`:

```js
(function () {
  var ui = N2.ui, el = ui.el;
  N2.register({
    id: 'minha', title: 'Minha Ferramenta', icon: '⭐', group: 'Ferramentas', // ou 'Meu Workspace', 'Diagnóstico'
    desc: 'Aparece no card do Início', keywords: 'termos para a busca global',
    render: function (root, params) {
      root.append(ui.card('Olá', el('p', { text: 'Conteúdo' })));
      // opcional: return function () { /* limpeza ao sair da tela */ };
    },
    // opcional: itens próprios na busca global
    search: function (q) { return []; } // [{ title, sub, go() }]
  });
})();
```

2. Inclua `<script src="js/minha-ferramenta.js"></script>` no `index.html`, antes de `navigation.js`.

Ela entra sozinha na sidebar, no Início, na busca global, nos recentes e nos favoritos.
Para um ícone SVG próprio, inclua o `id` no mapa `TOOL` de `js/icons.js` (senão aparece o emoji).

## Busca Ctrl+F numa ferramenta

```js
var ta = ui.codeEditor({ rows: 12 }), out = el('div');
var find = ui.findBar([{ label: 'Entrada', el: ta }, { label: 'Resultado', el: out }]);
root.append(find.el, ui.searchable(ta), ui.findButton(find), out);
```

`ui.searchable(textarea)` envolve o campo para os destaques aparecerem por trás do texto; qualquer outro
elemento é buscado no texto renderizado e rebuscado sozinho quando muda. Ctrl+F abre a barra da tela atual.

## Observações

- **Comparador** e **Payload Inspector** têm busca Ctrl+F (Enter/Shift+Enter navegam, Aa diferencia maiúsculas,
  ab| busca palavra inteira, e dá para limitar a A, B ou ao resultado). O Comparador mostra lado a lado ou
  unificado, destaca o trecho que mudou dentro da linha e navega entre as diferenças.
- **Payload Inspector** substitui as antigas telas JSON Tools e XML Tools: valida (com linha/coluna do erro),
  formata, minifica, mostra em árvore e localiza campos. Links antigos `#/json` e `#/xml` abrem o Inspector.
- **Análise N2** é guiada (sistema + checklist cadastrado, respostas Sim/Não/Não verificado). Não usa IA.
- **Central Logística** traz conceitos genéricos e resumidos. Tópicos de uso interno (VG, Pagamento Fixo,
  Tabela de Preço etc.) ficam como "A cadastrar" para você preencher com as regras do seu ambiente.
- **Ctrl+N** é reservado pelo navegador para "nova janela"; use **Alt+N** para nova nota.
- Os dados ficam no LocalStorage do navegador (chaves com prefixo `n2tk:`, mantido do nome antigo para que
  nada se perca na troca para Jarvis). Use *Configurações → Backup* antes de trocar de navegador ou limpar
  dados de navegação. Backups feitos no N2 Toolkit continuam podendo ser importados.
- O código interno continua usando o objeto global `N2` (N2.register, N2.ui...). É só um nome interno.
- Itens marcados com **DEMO** são exemplos fictícios. O projeto não contém credenciais, endpoints
  nem dados de clientes.

## O que ainda não existe

- Seleção de região da imagem no OCR (a função `N2.ocr.recognize` já aceita `rectangle`; falta a interface).
- Sincronização entre navegadores: use Exportar/Importar backup.
