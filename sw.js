// Louvor Studio (web) — guarda o app no celular para abrir rápido.
// Arquivos do site: busca a versão nova na internet e, sem internet, usa a guardada.
// Bibliotecas com versão fixa (CDN): usa a guardada. Dados e áudio da banda nunca ficam aqui.
var CACHE = 'louvor-web-v33';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Sempre pergunta ao servidor se há versão nova (sem usar a cópia velha do navegador); sem internet, usa a guardada.
    e.respondWith(fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(function (res) {
      // /admin → /admin/: o navegador não aceita uma página "já redirecionada" vinda daqui (ERR_FAILED);
      // devolve o redirecionamento para ele seguir sozinho.
      if (res.redirected) return Response.redirect(res.url, 301);
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('./'); }); }));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
});
