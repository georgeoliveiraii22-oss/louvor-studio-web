// Louvor Studio (web) — anúncios do Google: aviso de cookies e a conversão "banda criada".
// Sem o código do Google Ads (ADS.id vazio) nada aparece e nada é carregado.
// Com o código: pergunta uma vez se a pessoa aceita os cookies do Google Ads. Só carrega o
// Google depois do "Aceitar". "Recusar" vale igual e o site funciona do mesmo jeito.
// Na página /cookies/ (elemento #ls-cookie-escolha) só mostra a escolha e deixa mudar.
(function () {
  'use strict';

  // Google Ads › Metas › Conversões › (a conversão "Banda criada") › Configurar a tag › "Instalar a tag você mesmo":
  // id = o AW-… do "send_to"; label = o que vem depois da barra.
  var ADS = { id: 'AW-18595514798', label: 'Yn7KCNz1r78dEK6ThKNF' };

  var KEY = 'ls_cookies_ads';          // 'sim' | 'nao'
  var URL_KEY = 'ls_ad_url';           // endereço de chegada com o código do clique (só nesta visita)

  function get(k, store) { try { return (store || localStorage).getItem(k); } catch (e) { return null; } }
  function set(k, v, store) { try { if (v == null) (store || localStorage).removeItem(k); else (store || localStorage).setItem(k, v); } catch (e) { /* navegador sem armazenamento */ } }

  // O Google põe o código do clique (gclid) no endereço. O site às vezes limpa o endereço depois,
  // então guarda o endereço de chegada até a pessoa decidir (só nesta aba; some ao fechar).
  var landing = location.href;
  if (/[?&](gclid|gbraid|wbraid)=/.test(location.search)) set(URL_KEY, landing, sessionStorage);
  else landing = get(URL_KEY, sessionStorage) || landing;

  var loaded = false;
  function gtag() { window.dataLayer.push(arguments); }
  function load() {
    if (loaded || !ADS.id) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' });
    gtag('js', new Date());
    gtag('config', ADS.id, { page_location: landing });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ADS.id);
    document.head.appendChild(s);
    set(URL_KEY, null, sessionStorage);
  }

  function choose(v) {
    set(KEY, v);
    var bar = document.getElementById('ls-cookiebar');
    if (bar) bar.remove();
    if (v === 'sim') load();
    else set(URL_KEY, null, sessionStorage);
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'onclick') n.addEventListener('click', attrs[k]); else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function showBar() {
    if (document.getElementById('ls-cookiebar')) return;
    var bar = el('div', { id: 'ls-cookiebar', class: 'cookiebar', role: 'dialog', 'aria-label': 'Cookies de anúncios' }, [
      el('p', {}, [
        'Podemos usar cookies do Google para saber se os nossos anúncios trazem bandas? Sem eles, o site funciona igual. ',
        el('a', { href: '/cookies/' }, ['Saiba mais'])
      ]),
      el('div', { class: 'cookiebar-btns' }, [
        el('button', { type: 'button', class: 'btn2', onclick: function () { choose('nao'); } }, ['Recusar']),
        el('button', { type: 'button', class: 'btn2', onclick: function () { choose('sim'); } }, ['Aceitar'])
      ])
    ]);
    document.body.appendChild(bar);
  }

  // Página /cookies/: mostra a escolha atual e deixa mudar (não carrega o Google lá).
  function cookiesPage(box) {
    function paint() {
      var v = get(KEY);
      box.textContent = '';
      box.appendChild(el('p', {}, [
        v === 'sim' ? 'Você aceitou os cookies do Google Ads neste navegador.'
          : v === 'nao' ? 'Você recusou os cookies do Google Ads neste navegador.'
          : 'Você ainda não escolheu. Sem a sua escolha, o Google Ads não é carregado.'
      ]));
      box.appendChild(el('p', {}, [
        el('button', { type: 'button', class: 'cookie-btn', onclick: function () { set(KEY, v === 'sim' ? 'nao' : 'sim'); paint(); } },
          [v === 'sim' ? 'Recusar daqui em diante' : 'Aceitar os cookies do Google Ads'])
      ]));
    }
    paint();
  }

  window.LSAds = {
    /** Chamado quando alguém cria uma banda. Só conta se a pessoa aceitou. */
    bandaCriada: function () {
      if (!ADS.id || !ADS.label || get(KEY) !== 'sim') return;
      load();
      gtag('event', 'conversion', { send_to: ADS.id + '/' + ADS.label });
    }
  };

  function start() {
    var box = document.getElementById('ls-cookie-escolha');
    if (box) { cookiesPage(box); return; }
    if (!ADS.id) return;
    var v = get(KEY);
    if (v === 'sim') load();
    else if (v !== 'nao') showBar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
