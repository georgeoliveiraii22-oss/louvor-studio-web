// Louvor Studio — Repertório: todas as músicas da banda num lugar só, com busca,
// filtros e "ensaiadas recentemente". Escolher uma música abre o Estúdio com ela.
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }

  var COVER_COLORS = ['#E9A863', '#6CC4B0', '#9BA7EC', '#E384AE', '#B7D46B', '#7DBAE4', '#DCC65F', '#C59DE3'];

  var rp = {
    loadedFor: null,     // id da banda já carregada
    loading: false,
    tracks: {},          // project_id -> quantidade de faixas
    voices: {},          // project_id -> quantidade de vozes liberadas
    myParts: {},         // project_id -> [nomes das minhas partes]
    query: '',
    filter: 'todas',
    sort: 'az',
    el: null,
    listEl: null
  };

  // Busca sem diferenciar acentos nem maiúsculas: "rendicao" acha "Rendição".
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function coverColor(p) {
    var s = p.id || '';
    var n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return COVER_COLORS[n % COVER_COLORS.length];
  }

  function cover(p, size) {
    var letter = (p.song_title || p.name || '?').trim().charAt(0).toUpperCase();
    return h('div', { class: 'rp-cover', style: 'background:' + coverColor(p) + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px', 'aria-hidden': 'true' }, letter);
  }

  function recentIds() {
    try {
      var v = JSON.parse(localStorage.getItem('louvor.recentes') || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function remember(pid) {
    try {
      var list = recentIds().filter(function (x) { return x !== pid; });
      list.unshift(pid);
      localStorage.setItem('louvor.recentes', JSON.stringify(list.slice(0, 8)));
    } catch (e) { /* sem armazenamento local: só não guarda os recentes */ }
  }

  function rehearse(p, autoplay) {
    remember(p.id);
    A().openStudio(p.id, autoplay);
  }

  function load() {
    var S = A().state();
    var sb = A().client();
    var ids = S.projects.map(function (p) { return p.id; });
    rp.loadedFor = S.org.id + ':' + ids.join(',');
    if (!ids.length) { rp.tracks = {}; rp.voices = {}; rp.myParts = {}; return Promise.resolve(); }
    rp.loading = true;
    return Promise.all([
      sb.from('tracks').select('project_id').in('project_id', ids),
      sb.from('takes').select('project_id').in('project_id', ids).eq('released_for_rehearsal', true),
      sb.from('project_parts').select('project_id,name,assigned_user').in('project_id', ids)
    ]).then(function (r) {
      var must = A().must;
      rp.tracks = {};
      must(r[0]).forEach(function (t) { rp.tracks[t.project_id] = (rp.tracks[t.project_id] || 0) + 1; });
      rp.voices = {};
      must(r[1]).forEach(function (t) { rp.voices[t.project_id] = (rp.voices[t.project_id] || 0) + 1; });
      rp.myParts = {};
      must(r[2]).forEach(function (pt) {
        if (pt.assigned_user === S.user.id) (rp.myParts[pt.project_id] = rp.myParts[pt.project_id] || []).push(pt.name);
      });
    }).then(function () {
      rp.loading = false;
    }, function (e) {
      rp.loading = false;
      throw e;
    });
  }

  function visible() {
    var S = A().state();
    var q = norm(rp.query);
    var list = S.projects.filter(function (p) {
      if (rp.filter === 'minhas' && !rp.myParts[p.id]) return false;
      if (!q) return true;
      return [p.song_title, p.artist, p.name, p.musical_key].some(function (f) { return norm(f).indexOf(q) !== -1; });
    });
    list.sort(function (a, b) {
      if (rp.sort === 'recentes') return String(b.created_at).localeCompare(String(a.created_at));
      if (rp.sort === 'duracao') return b.session_duration_ms - a.session_duration_ms;
      return norm(a.song_title).localeCompare(norm(b.song_title));
    });
    return list;
  }

  function meta(p) {
    var bits = [];
    if (p.musical_key) bits.push(h('span', { class: 'rp-kv', title: 'Tom' }, Icons.icon('key', 12), 'Tom ' + p.musical_key));
    if (p.bpm) bits.push(h('span', { class: 'rp-kv', title: 'Andamento' }, Icons.icon('tempo', 12), p.bpm + ' BPM'));
    return bits;
  }

  function row(p, i) {
    var mine = rp.myParts[p.id];
    var playBtn = h('button', { class: 'rp-play', 'aria-label': 'Ensaiar ' + p.song_title + ' agora', title: 'Ensaiar agora',
      onclick: function (ev) { ev.stopPropagation(); rehearse(p, true); } }, Icons.icon('play', 16, 'ic-fill'));

    return h('li', { class: 'rp-row' },
      h('span', { class: 'rp-num mono' }, String(i + 1)),
      h('div', { class: 'rp-cover-wrap' }, cover(p, 44), playBtn),
      h('div', { class: 'rp-title' },
        h('span', { class: 'rp-song' }, p.song_title),
        h('span', { class: 'rp-sub' }, [p.artist || null, p.name !== p.song_title ? p.name : null].filter(Boolean).join(' · ') || 'Sem artista informado')
      ),
      h('span', { class: 'rp-meta' }, meta(p)),
      h('span', { class: 'rp-meta' },
        mine ? h('span', { class: 'chip go', title: 'Sua parte nesta música' }, Icons.icon('vocal', 12), 'Você: ' + mine.join(', ')) : null,
        rp.voices[p.id] ? h('span', { class: 'chip', title: 'Vozes liberadas para ensaio' }, Icons.icon('voices', 12), rp.voices[p.id] + (rp.voices[p.id] === 1 ? ' voz' : ' vozes')) : null
      ),
      h('span', { class: 'rp-dur mono' }, A().fmtTime(p.session_duration_ms)),
      h('button', { class: 'btn sec2 sm', onclick: function () { rehearse(p, false); } }, Icons.icon('rehearse', 14), 'Ensaiar')
    );
  }

  function paintList() {
    if (!rp.listEl) return;
    var list = visible();
    if (rp.countEl) rp.countEl.textContent = list.length + (list.length === 1 ? ' música' : ' músicas');
    rp.listEl.innerHTML = '';
    if (!list.length) {
      rp.listEl.appendChild(h('li', { class: 'rp-empty' },
        rp.query ? 'Nenhuma música encontrada para "' + rp.query + '".' :
        rp.filter === 'minhas' ? 'Você ainda não tem parte atribuída em nenhuma música.' : 'Ainda não há músicas no repertório.'));
      return;
    }
    list.forEach(function (p, i) { rp.listEl.appendChild(row(p, i)); });
  }

  function paint() {
    var S = A().state();
    var el = rp.el;
    el.innerHTML = '';

    var search = h('input', { type: 'search', class: 'rp-search', placeholder: 'Buscar por música, artista ou tom', value: rp.query, 'aria-label': 'Buscar no repertório',
      oninput: function (ev) { rp.query = ev.target.value; paintList(); } });

    function chip(id, label, iconKey) {
      return h('button', { class: 'rp-chip' + (rp.filter === id ? ' on' : ''), 'aria-pressed': rp.filter === id ? 'true' : 'false',
        onclick: function () { rp.filter = id; paint(); } }, Icons.icon(iconKey, 13), label);
    }
    var sortSel = h('select', { class: 'rp-sort', 'aria-label': 'Ordenar', onchange: function () { rp.sort = sortSel.value; paintList(); } },
      h('option', { value: 'az', selected: rp.sort === 'az' }, 'Título (A–Z)'),
      h('option', { value: 'recentes', selected: rp.sort === 'recentes' }, 'Adicionadas recentemente'),
      h('option', { value: 'duracao', selected: rp.sort === 'duracao' }, 'Duração'));

    rp.countEl = h('span', { class: 'mu' });
    el.appendChild(h('div', { class: 'rp-hero' },
      h('div', null,
        h('span', { class: 'sec' }, S.org.name),
        h('h1', { style: 'margin:4px 0 0' }, 'Repertório'),
        rp.countEl
      ),
      h('div', { class: 'rp-search-wrap' }, Icons.icon('search', 15, 'rp-search-ic'), search)
    ));

    var recent = recentIds().map(function (id) { return S.projects.find(function (p) { return p.id === id; }); }).filter(Boolean).slice(0, 4);
    if (recent.length && !rp.query) {
      el.appendChild(h('h2', { class: 'with-ic', style: 'margin:22px 0 12px' }, Icons.icon('pending', 15), 'Ensaiadas recentemente'));
      el.appendChild(h('div', { class: 'rp-recent' }, recent.map(function (p) {
        return h('button', { class: 'rp-card', onclick: function () { rehearse(p, false); } },
          cover(p, 56),
          h('span', { class: 'rp-card-text' }, h('span', { class: 'rp-song' }, p.song_title), h('span', { class: 'rp-sub' }, p.artist || A().fmtTime(p.session_duration_ms))));
      })));
    }

    el.appendChild(h('div', { class: 'row sp-b', style: 'margin:22px 0 10px' },
      h('div', { class: 'row', style: 'gap:8px' }, chip('todas', 'Todas', 'list'), chip('minhas', 'Minhas partes', 'vocal')),
      sortSel));

    rp.listEl = h('ol', { class: 'rp-list' });
    el.appendChild(rp.listEl);
    if (rp.loading) rp.listEl.appendChild(h('li', { class: 'rp-empty' }, 'Carregando o repertório…'));
    else paintList();
  }

  function view() {
    var S = A().state();
    if (!rp.el) rp.el = h('div');
    var key = S.org.id + ':' + S.projects.map(function (p) { return p.id; }).join(',');
    if (rp.loadedFor !== key) {
      load().then(paint).catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
    }
    paint();
    return rp.el;
  }

  window.Repertoire = { view: view, norm: norm };
})();
