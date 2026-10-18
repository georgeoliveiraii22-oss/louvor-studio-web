// Louvor Studio (web para celular) — base: estado, elementos, ícones, navegação e janelas.
// Mesmas telas e textos do app Android (android/app/src/main/java/br/louvorstudio/app/ui).
(function () {
  'use strict';

  var L = window.L = {};

  // ------------------------------------------------------------------ Estado
  L.S = {
    user: null, loggedIn: false, loading: false, booted: false,
    memberships: [], current: null, members: [], projects: [], tracksIdx: {}, services: [],
    unavailable: {}, announcements: [], lastMessages: [], unread: {}, teams: [], templates: [],
    readiness: {}, storageUsed: 0, avatarUrls: {}, coverUrls: {}, myParts: {},
    tab: 'inicio', stack: [{ name: 'main' }], viewAsMember: false, entry: null
  };
  var S = L.S;

  // ------------------------------------------------------------------ Elementos
  function append(el, c) {
    if (c === null || c === undefined || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  /** h('div', { class: 'x', onclick: fn }, filhos...) */
  L.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { if (p.slice(0, 2) === '--') el.style.setProperty(p, v[p]); else el.style[p] = v[p]; });
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  var h = L.h;
  /** Troca os filhos de um elemento (aceita listas, como o h). */
  L.fill = function (el) {
    el.replaceChildren();
    for (var i = 1; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };

  // ------------------------------------------------------------------ Ícones (Lucide, os mesmos do app)
  L.ic = function (name, size, cls) {
    var lib = window.lucide;
    var node = lib && lib.icons && lib.icons[name];
    var s = size || 20;
    if (!node) return h('span', { style: { width: s + 'px', height: s + 'px', display: 'inline-block', flex: 'none' } });
    var svg = lib.createElement(node);
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  };
  var ic = L.ic;

  // ------------------------------------------------------------------ Textos e datas
  L.FUNCTIONS = [
    ['ministro', 'Ministro(a) de louvor'], ['vocal', 'Vocal'], ['backing_vocal', 'Backing vocal'], ['violao', 'Violão'],
    ['guitarra', 'Guitarra'], ['baixo', 'Baixo'], ['bateria', 'Bateria'], ['teclado', 'Teclado'], ['percussao', 'Percussão'],
    ['sopro', 'Sopro'], ['cordas', 'Cordas'], ['tecnico_som', 'Técnico(a) de som'], ['projecao', 'Projeção/mídia']
  ];
  L.fnLabel = function (id) { var f = L.FUNCTIONS.find(function (x) { return x[0] === id; }); return f ? f[1] : id; };
  L.fnIcon = function (id) {
    return ({ ministro: 'Crown', vocal: 'Mic', backing_vocal: 'UsersRound', violao: 'Guitar', guitarra: 'Guitar', baixo: 'Guitar',
      bateria: 'Drum', percussao: 'Drum', teclado: 'Piano', sopro: 'Music2', cordas: 'Music4', tecnico_som: 'SlidersVertical', projecao: 'Monitor' })[id] || 'Music2';
  };
  L.fnOrder = function (id) { var i = L.FUNCTIONS.findIndex(function (x) { return x[0] === id; }); return i < 0 ? 99 : i; };
  L.VOICES = [['', 'Não informado'], ['soprano', 'Soprano'], ['mezzo', 'Mezzo-soprano'], ['contralto', 'Contralto'], ['tenor', 'Tenor'], ['baritono', 'Barítono'], ['baixo', 'Baixo']];
  L.KINDS = [['culto', 'Culto'], ['ensaio', 'Ensaio'], ['evento', 'Evento']];
  L.kindLabel = function (k) { var f = L.KINDS.find(function (x) { return x[0] === k; }); return f ? f[1] : 'Culto'; };
  L.kindColor = function (k) { return k === 'ensaio' ? '#6CC4B0' : k === 'evento' ? '#C59DE3' : 'var(--accent)'; };

  L.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  L.MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  L.SEMANA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  L.SEMANA_CURTA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

  /** Data "2026-10-15" → Date local (meio-dia, sem problema de fuso). */
  L.d = function (iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
  L.iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  L.today = function () { return L.iso(new Date()); };
  L.addDays = function (iso, n) { var d = L.d(iso); d.setDate(d.getDate() + n); return L.iso(d); };
  L.daysBetween = function (a, b) { return Math.round((L.d(b) - L.d(a)) / 86400000); };
  /** 1 = segunda ... 7 = domingo (como o java.time). */
  L.dow = function (iso) { var g = L.d(iso).getDay(); return g === 0 ? 7 : g; };
  L.fullDate = function (iso) { var d = L.d(iso); return L.SEMANA[L.dow(iso) - 1] + ', ' + d.getDate() + ' de ' + L.MESES[d.getMonth()]; };
  L.cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  L.hhmm = function (t) { return t ? String(t).slice(0, 5) : null; };
  L.timeRange = function (s) { return [L.hhmm(s.start_time), L.hhmm(s.end_time)].filter(Boolean).join(' – '); };
  L.serviceWhen = function (iso) {
    var n = L.daysBetween(L.today(), iso);
    var d = L.d(iso);
    var base = L.SEMANA[L.dow(iso) - 1] + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    if (n === 0) return 'Hoje · ' + base;
    if (n === 1) return 'Amanhã · ' + base;
    if (n >= 2 && n <= 6) return base + ' · em ' + n + ' dias';
    return base;
  };
  L.scheduleLine = function (s) { return L.kindLabel(s.kind) + ' · ' + L.serviceWhen(s.starts_on); };
  L.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
  L.clock = function (sec) { var s = Math.max(0, Math.floor(sec || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  L.clockTenths = function (sec) { var t = Math.floor(Math.max(0, sec) * 10); return Math.floor(t / 600) + ':' + String(Math.floor(t / 10) % 60).padStart(2, '0') + ',' + (t % 10); };
  L.bytes = function (n) {
    if (n >= 1073741824) return (n / 1073741824).toFixed(1).replace('.', ',') + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  };
  L.norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  L.dm = function (iso) { var d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

  // ------------------------------------------------------------------ Permissões (com "ver como membro")
  L.perm = {
    leader: function () { return !S.viewAsMember && !!S.current && S.current.role === 'leader'; },
    edit: function () { return !S.viewAsMember && !!S.current && (S.current.role === 'leader' || !!S.current.can_edit_audio); },
    schedule: function () { return !S.viewAsMember && !!S.current && (S.current.role === 'leader' || !!S.current.can_schedule); },
    songs: function () { return !S.viewAsMember && !!S.current && (S.current.role === 'leader' || !!S.current.can_manage_songs); },
    extra: function () { var c = S.current; return !!c && (c.role === 'leader' || c.can_edit_audio || c.can_schedule || c.can_manage_songs); }
  };
  L.uid = function () { return S.user ? S.user.id : ''; };
  L.me = function () { return S.members.find(function (m) { return m.user_id === L.uid(); }) || null; };
  L.nameOf = function (id) { var m = S.members.find(function (x) { return x.user_id === id; }); return m ? m.name : 'Alguém'; };
  L.member = function (id) { return S.members.find(function (x) { return x.user_id === id; }) || null; };
  L.project = function (id) { return S.projects.find(function (p) { return p.id === id; }) || null; };
  L.service = function (id) { return S.services.find(function (s) { return s.id === id; }) || null; };
  L.hasMulti = function (p) { var t = S.tracksIdx[p.id]; return !!t && t.length > 0; };
  L.keyToPlay = function (p) { return p.band_key || p.musical_key || null; };

  // Escalas derivadas
  L.upcoming = function () {
    var t = L.today();
    return S.services.filter(function (s) { return s.starts_on >= t; }).sort(function (a, b) {
      return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
  };
  L.peopleOf = function (s, uid) { return s.people.filter(function (p) { return p.user_id === uid; }); };
  L.myUpcoming = function () { var me = L.uid(); return L.upcoming().filter(function (s) { return s.people.some(function (p) { return p.user_id === me; }); }); };
  L.isOff = function (uid, day) { var set = S.unavailable[uid]; return !!set && set.indexOf(day) >= 0; };
  L.unreadTotal = function () { return Object.keys(S.unread).reduce(function (a, k) { return a + (S.unread[k] || 0); }, 0); };
  L.pendingMine = function () {
    var me = L.uid();
    return L.myUpcoming().filter(function (s) { return L.peopleOf(s, me).some(function (p) { return p.status === 'pendente' && !p.swap_requested; }); }).length;
  };

  // ------------------------------------------------------------------ Navegação (o botão voltar do celular também funciona)
  var overlays = [];   // janelas abertas: { close: fn }
  var tabPushed = false;
  var scrolls = {};

  function routeKey() {
    var r = S.stack[S.stack.length - 1];
    return r.name === 'main' ? 'tab:' + S.tab : r.name + ':' + (r.id || '') + ':' + (r.step || '');
  }
  L.route = function () { return S.stack[S.stack.length - 1]; };

  L.go = function (r) {
    scrolls[routeKey()] = window.scrollY;
    S.stack.push(r);
    history.pushState({ louvor: S.stack.length }, '');
    L.render();
  };
  /** Voltar (o mesmo que o botão do celular). */
  L.back = function () { history.back(); };
  /** Troca a pilha sem mexer no histórico (ex.: depois de publicar, sai do assistente e abre a escala). */
  L.replace = function (r) { S.stack[S.stack.length - 1] = r; L.render(); };

  L.setTab = function (t) {
    // No computador o menu fica à vista também nas telas de dentro: volta para a aba.
    if (S.stack.length > 1) { scrolls[routeKey()] = window.scrollY; S.stack = [{ name: 'main' }]; S.tab = t; L.render(); return; }
    if (S.tab === t) { window.scrollTo(0, 0); return; }
    scrolls[routeKey()] = window.scrollY;
    S.tab = t;
    if (t !== 'inicio' && !tabPushed) { history.pushState({ louvor: 'tab' }, ''); tabPushed = true; }
    L.render();
  };

  var skipPop = 0;
  window.addEventListener('popstate', function () {
    // Fechou uma janela pela tela: o voltar do histórico já foi feito; ignora uma vez.
    if (skipPop > 0) { skipPop--; return; }
    if (overlays.length) { var o = overlays.pop(); o.close(true); return; }
    if (S.stack.length > 1) { S.stack.pop(); L.render(); return; }
    if (S.tab !== 'inicio') { tabPushed = false; S.tab = 'inicio'; L.render(); }
  });

  // ------------------------------------------------------------------ Desenho
  var renderers = {};
  L.screen = function (name, fn) { renderers[name] = fn; };
  var lastKey = null;

  L.render = function () {
    var root = document.getElementById('app');
    var key = routeKey();
    var sameRoute = key === lastKey;
    var y = window.scrollY;
    var frame = h('div', { class: 'frame' });
    var body;
    var withNav = false;
    var rfn = L.rootView && L.rootView();
    if (rfn) body = rfn;
    else {
      var r = L.route();
      if (r.name === 'main') { body = renderers['tab-' + S.tab](); withNav = true; }
      else body = (renderers[r.name] || function () { return h('div', { class: 'screen' }, 'Tela não encontrada.'); })(r);
    }
    if (S.viewAsMember && S.loggedIn) {
      frame.appendChild(h('div', { class: 'memberbar' }, ic('Eye', 16), h('span', { class: 'grow' }, 'Você está vendo como membro'),
        h('button', { class: 'textbtn', style: { color: 'var(--hi)' }, onclick: function () { S.viewAsMember = false; L.toast('De volta à sua visão normal.'); L.render(); } }, 'Voltar ao normal')));
    }
    var view = h('div', { class: 'view' + (withNav ? ' with-nav' : '') }, body);
    frame.appendChild(view);
    // Abas: embaixo no celular (só nas abas); no computador, menu à esquerda em todas as telas.
    var side = !rfn && S.loggedIn && !!S.current;
    if (side) { frame.classList.add('has-side'); frame.appendChild(L.bottomNav(!withNav)); }
    root.replaceChildren(frame);
    lastKey = key;
    if (sameRoute) window.scrollTo(0, y);
    else window.scrollTo(0, scrolls[key] || 0);
    overlays.forEach(function (o) { if (o.refresh) o.refresh(); });
    if (L.studio) L.studio.check();
  };

  L.bottomNav = function (inner) {
    var items = [
      ['inicio', 'House', 'Início', 0], ['escalas', 'CalendarDays', 'Escalas', L.pendingMine()],
      ['musicas', 'Library', 'Repertório', 0], ['membros', 'UsersRound', 'Banda', L.unreadTotal()], ['eu', 'CircleUserRound', 'Eu', 0]
    ];
    var onMain = L.route().name === 'main';
    var tabs = h('div', { class: 'tabs' }, items.map(function (it) {
      var on = onMain && S.tab === it[0];
      var badge = it[3] > 0 ? h('span', { class: 'badge' }, it[3] > 9 ? '9+' : String(it[3])) : null;
      return h('button', { class: on ? 'on' : '', 'aria-current': on ? 'page' : null, onclick: function () { L.setTab(it[0]); } },
        h('span', { class: 'pill' }, ic(it[1], 22), badge ? badge.cloneNode(true) : null),
        h('span', { class: 'tl' }, it[2]), badge ? h('span', { class: 'side-only' }, badge) : null);
    }));
    // Só no computador: marca, banda, próximas escalas e eu (como o menu do Moises).
    var me = L.me();
    var next = L.upcoming().slice(0, 5);
    var uid = L.uid();
    return h('nav', { class: 'nav' + (inner ? ' inner' : ''), 'aria-label': 'Abas' },
      h('div', { class: 'side-only navbrand' }, h('span', { class: 'logo' }, ic('AudioLines', 20)), h('span', { class: 'brand' }, 'Louvor Studio')),
      S.current ? h('div', { class: 'side-only bandpill navband' }, h('span', null, S.current.org.name)) : null,
      tabs,
      next.length ? h('div', { class: 'side-only navsec' }, h('div', { class: 'label' }, 'Próximas escalas'), next.map(function (s) {
        var d = L.d(s.starts_on);
        var mine = s.people.some(function (p) { return p.user_id === uid; });
        return h('button', { class: 'navsvc' + (mine ? ' mine' : ''), onclick: function () { L.setTab('escalas'); L.go({ name: 'escala', id: s.id }); } },
          h('span', { class: 'dt' }, h('small', null, L.SEMANA_CURTA[L.dow(s.starts_on) - 1]), h('b', null, String(d.getDate()))),
          h('span', { class: 'grow' }, h('div', { class: 'hi semi ell', style: { fontSize: '14px' } }, s.title),
            h('div', { class: 'muted ell', style: { fontSize: '12.5px' } }, [L.hhmm(s.start_time), mine ? 'você está' : null].filter(Boolean).join(' · ') || L.kindLabel(s.kind))));
      })) : null,
      h('span', { class: 'side-only fill' }),
      me ? h('button', { class: 'side-only navme', onclick: function () { L.setTab('eu'); } }, L.ui.avatar(me, 36),
        h('span', { class: 'grow' }, h('div', { class: 'hi semi ell' }, me.name), h('div', { class: 'muted small' }, S.current.role === 'leader' ? 'Líder' : 'Integrante'))) : null);
  };

  // ------------------------------------------------------------------ Avisos e janelas
  var toastTimer = null;
  L.toast = function (msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 4000);
  };
  L.errorText = function (e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Erro inesperado.');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem internet. Tente de novo quando tiver conexão.';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha errados.';
    if (/User already registered/i.test(m)) return 'Já existe uma conta com este e-mail. Toque em Entrar.';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/row-level security|permission denied/i.test(m)) return 'Você não tem permissão para fazer isso.';
    return m;
  };
  /** Roda uma ação mostrando o erro como aviso, sem travar a tela. */
  L.run = function (fn) {
    return Promise.resolve().then(fn).catch(function (e) { console.error(e); L.toast(L.errorText(e)); });
  };

  function pushOverlay(o) {
    overlays.push(o);
    history.pushState({ louvor: 'overlay' }, '');
  }
  /** Fecha pela tela (não pelo botão voltar): tira do histórico também. */
  function closeOverlay(o) {
    var i = overlays.indexOf(o);
    if (i < 0) return;
    overlays.splice(i, 1);
    o.close(true);
    skipPop++;
    history.back();
  }

  /**
   * Janela no meio da tela (AlertDialog). opts: { title, body: fn(close)→nós, actions: fn(close)→nós, onClose }
   * Devolve { close, refresh }.
   */
  L.dialog = function (opts) {
    var scrim = h('div', { class: 'scrim' });
    var o = {};
    function build() {
      var close = function () { closeOverlay(o); };
      var box = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', onclick: function (e) { e.stopPropagation(); } },
        opts.title ? (typeof opts.title === 'string' ? h('div', { class: 'dt' }, opts.title) : opts.title) : null,
        opts.body ? h('div', { class: 'db' }, opts.body(close)) : null,
        opts.actions ? h('div', { class: 'da' }, opts.actions(close)) : null);
      scrim.replaceChildren(box);
    }
    o.close = function () { scrim.remove(); if (opts.onClose) opts.onClose(); };
    o.refresh = function () { if (opts.live) build(); };
    o.rebuild = build;
    scrim.addEventListener('click', function () { if (!opts.sticky) closeOverlay(o); });
    build();
    document.body.appendChild(scrim);
    pushOverlay(o);
    return { close: function () { closeOverlay(o); }, rebuild: build };
  };

  /** Painel que sobe de baixo (ModalBottomSheet). build(close) → nós. */
  L.sheet = function (build, opts) {
    opts = opts || {};
    var wrap = h('div', { class: 'sheetwrap' });
    var o = {};
    var sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', onclick: function (e) { e.stopPropagation(); } });
    function fill() {
      var st = sheet.scrollTop;
      sheet.replaceChildren(h('div', { class: 'grab' }), h('div', { class: 'stack' }, build(function () { closeOverlay(o); })));
      sheet.scrollTop = st;
    }
    o.close = function () { wrap.remove(); if (opts.onClose) opts.onClose(); };
    o.refresh = fill;
    wrap.addEventListener('click', function () { closeOverlay(o); });
    wrap.appendChild(sheet);
    fill();
    document.body.appendChild(wrap);
    pushOverlay(o);
    return { close: function () { closeOverlay(o); }, refresh: fill };
  };

  /** Menu ⋯ ao lado de um botão. items: [[ícone, texto, fn], ...] */
  L.menu = function (anchor, items) {
    var r = anchor.getBoundingClientRect();
    var scrim = h('div', { class: 'scrim', style: { background: 'transparent', padding: 0 } });
    var o = {};
    var m = h('div', { class: 'menu', role: 'menu' }, items.filter(Boolean).map(function (it) {
      return h('button', { role: 'menuitem', onclick: function (e) { e.stopPropagation(); closeOverlay(o); setTimeout(it[2], 0); } }, ic(it[0], 18), it[1]);
    }));
    o.close = function () { scrim.remove(); };
    scrim.addEventListener('click', function () { closeOverlay(o); });
    scrim.appendChild(m);
    document.body.appendChild(scrim);
    var mw = m.offsetWidth, mh = m.offsetHeight;
    var left = Math.min(window.innerWidth - mw - 8, Math.max(8, r.right - mw));
    var top = r.bottom + 4 + mh > window.innerHeight - 8 ? Math.max(8, r.top - mh - 4) : r.bottom + 4;
    m.style.left = left + 'px';
    m.style.top = top + 'px';
    pushOverlay(o);
  };

  /** Pergunta de confirmação. */
  L.confirm = function (title, text, okLabel, onOk, danger) {
    L.dialog({
      title: title,
      body: function () { return text ? h('p', { class: 'body small' }, text) : null; },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', style: danger ? { color: 'var(--bad)' } : null, onclick: function () { close(); onOk(); } }, okLabel)];
      }
    });
  };
})();
