/* Jarvis — service worker (PWA / offline).
 * - Arquivos do app: rede primeiro (para receber atualizações), cache quando offline.
 * - Motor e idiomas do OCR (CDN): cache primeiro; depois do 1º uso o OCR funciona offline.
 * Ao adicionar um arquivo novo em /js ou /css, inclua-o em SHELL e aumente VERSION. */
const VERSION = 'jarvis-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/components.css',
  'css/style.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'js/app.js',
  'js/cases.js',
  'js/checklists.js',
  'js/compare.js',
  'js/crud.js',
  'js/diagnosis.js',
  'js/errors.js',
  'js/find.js',
  'js/icons.js',
  'js/json-tools.js',
  'js/knowledge.js',
  'js/logistics.js',
  'js/navigation.js',
  'js/notes.js',
  'js/ocr.js',
  'js/pages.js',
  'js/payload.js',
  'js/storage.js',
  'js/templates.js',
  'js/utilities.js',
  'js/xml-tools.js',
];
const OCR_HOSTS = ['cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'unpkg.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'n2tk-ocr').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (OCR_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open('n2tk-ocr').then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
