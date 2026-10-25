/* Jarvis — camada central de armazenamento.
 *
 *  Dados (JSON)   -> LocalStorage, prefixo "n2tk:"      N2.store.get/save/update/remove
 *  Arquivos       -> IndexedDB (imagens de evidências)  N2.store.files.put/get/remove
 *  Backup         -> N2.store.backup() / validateBackup() / restore()
 *
 * Nenhum outro arquivo acessa localStorage/indexedDB diretamente.
 * Nada é enviado para servidores: tudo fica neste navegador. */
(function () {
  // Prefixo herdado do nome antigo (N2 Toolkit): mantido para não perder os dados já salvos.
  var P = 'n2tk:';
  var mem = {}; // fallback se o LocalStorage estiver bloqueado

  function get(key, def) {
    try {
      var raw = localStorage.getItem(P + key);
      return raw == null ? (key in mem ? mem[key] : def) : JSON.parse(raw);
    } catch (e) { return key in mem ? mem[key] : def; }
  }
  function set(key, val) {
    mem[key] = val;
    try { localStorage.setItem(P + key, JSON.stringify(val)); return true; }
    catch (e) { console.error('[storage] falha ao gravar', key, e); return false; } // cota/privado: mantém em memória
  }
  /** Lê, aplica fn e grava. */
  function update(key, fn, def) { var v = fn(get(key, def)); set(key, v); return v; }
  function remove(key) { delete mem[key]; try { localStorage.removeItem(P + key); } catch (e) {} }
  function keys() {
    var out = Object.keys(mem);
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(P) === 0 && out.indexOf(k.slice(P.length)) < 0) out.push(k.slice(P.length)); } } catch (e) {}
    return out;
  }
  function exportAll() { var o = {}; keys().forEach(function (k) { o[k] = get(k); }); return o; }
  function importAll(obj) { Object.keys(obj || {}).forEach(function (k) { set(k, obj[k]); }); }

  /** Carrega uma coleção; na primeira vez grava os dados iniciais.
   *  demoOnly=true: dados puramente de demonstração, não voltam após "limpar tudo". */
  function seed(key, makeDefault, demoOnly) {
    var v = get(key, null);
    if (v == null) { v = (demoOnly && get('cleared')) ? [] : makeDefault(); set(key, v); }
    return v;
  }

  /* ---------- arquivos (IndexedDB) ---------- */
  var dbp = null, memFiles = {};
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, fail) {
      if (!window.indexedDB) return fail(new Error('IndexedDB indisponível'));
      var r = indexedDB.open('n2tk', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('files', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { fail(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, fail) {
        var t = d.transaction('files', mode), req = fn(t.objectStore('files'));
        t.oncomplete = function () { ok(req && req.result); };
        t.onerror = t.onabort = function () { fail(t.error); };
      });
    });
  }
  var files = {
    /** rec: { id, name, type, data (dataURL) } */
    put: function (rec) { memFiles[rec.id] = rec; return tx('readwrite', function (s) { return s.put(rec); }).catch(function (e) { console.error('[storage] arquivo só em memória', e); }); },
    get: function (id) { return tx('readonly', function (s) { return s.get(id); }).catch(function () { return memFiles[id]; }).then(function (r) { return r || memFiles[id] || null; }); },
    remove: function (id) { delete memFiles[id]; return tx('readwrite', function (s) { return s.delete(id); }).catch(function () {}); },
    all: function () { return tx('readonly', function (s) { return s.getAll(); }).catch(function () { return Object.keys(memFiles).map(function (k) { return memFiles[k]; }); }); },
    clear: function () { memFiles = {}; return tx('readwrite', function (s) { return s.clear(); }).catch(function () {}); }
  };

  /** Apaga tudo. Marca "cleared" para não recriar os dados de demonstração. */
  function clearAll() {
    var theme = get('theme');
    keys().forEach(remove);
    mem = {};
    set('cleared', true);
    if (theme) set('theme', theme);
    return files.clear();
  }

  /* ---------- backup ---------- */
  var COLLECTIONS = { notes: 'Notas', cases: 'Casos', templates: 'Templates', checklists: 'Checklists', kb: 'Base N2', errors: 'Catálogo de erros', logistics: 'Central Logística' };

  function backup() {
    return files.all().then(function (f) {
      return { app: 'jarvis', version: 3, exportedAt: new Date().toISOString(), data: exportAll(), files: f || [] };
    });
  }
  /** Confere o arquivo antes de importar. Retorna { ok, error, data, files, summary }. */
  function validateBackup(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'O arquivo não é um backup do Jarvis.' };
    var ours = o.app === 'jarvis' || o.app === 'n2-toolkit'; // backups do N2 Toolkit continuam válidos
    var data = ours ? o.data : o; // versão 1 exportava só os dados
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'O backup não contém dados.' };
    var known = Object.keys(COLLECTIONS).filter(function (k) { return k in data; });
    if (!ours && !known.length) return { ok: false, error: 'O arquivo não é um backup do Jarvis.' };
    var bad = known.filter(function (k) { return !Array.isArray(data[k]); });
    if (bad.length) return { ok: false, error: 'Backup corrompido: "' + COLLECTIONS[bad[0]] + '" está em formato inesperado.' };
    var fl = Array.isArray(o.files) ? o.files.filter(function (f) { return f && typeof f.id === 'string' && typeof f.data === 'string' && /^data:image\//.test(f.data); }) : [];
    return { ok: true, data: data, files: fl, exportedAt: o.exportedAt || null,
      summary: known.map(function (k) { return COLLECTIONS[k] + ': ' + data[k].length; }) };
  }
  /** Substitui os dados atuais pelos do backup (já validado). */
  function restore(v) {
    return clearAll().then(function () {
      remove('cleared');
      importAll(v.data);
      return Promise.all(v.files.map(files.put));
    });
  }

  N2.store = {
    get: get, set: set, save: set, update: update, remove: remove, seed: seed,
    clearAll: clearAll, clear: clearAll, exportAll: exportAll, export: exportAll, importAll: importAll, import: importAll,
    files: files, backup: backup, validateBackup: validateBackup, restore: restore
  };
})();
