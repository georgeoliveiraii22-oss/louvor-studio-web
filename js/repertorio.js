// Louvor Studio (web para celular) — Repertório, ficha da música e adicionar/editar música (ui/SongsScreen.kt e ui/SongEditorScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var R = { query: '', filter: 'todas', showFilters: false };
  var FILTERS = [['todas', 'Todas'], ['escala', 'Das próximas escalas'], ['multi', 'Com multitrack']];

  function soonSet() {
    var out = {};
    L.myUpcoming().filter(function (s) { return L.daysBetween(L.today(), s.starts_on) <= 21; }).forEach(function (s) { s.songIds.forEach(function (id) { out[id] = true; }); });
    return out;
  }

  // ------------------------------------------------------------------ Aba
  L.screen('tab-musicas', function () {
    var soon = soonSet();
    var listBox = h('div', { class: 'songlist' });
    function fill() {
      listBox.replaceChildren();
      var q = L.norm(R.query.trim());
      var list = S.projects.filter(function (p) { return !q || [p.song_title, p.artist, p.name, p.musical_key, p.band_key].some(function (f) { return f && L.norm(f).indexOf(q) >= 0; }); })
        .filter(function (p) { return R.filter === 'todas' || (R.filter === 'escala' ? soon[p.id] : L.hasMulti(p)); })
        .sort(function (a, b) { return L.norm(a.song_title).localeCompare(L.norm(b.song_title)); });
      if (!list.length) listBox.appendChild(U.empty(R.query.trim() ? 'Nenhuma música encontrada para "' + R.query + '".'
        : R.filter === 'escala' ? 'Nenhuma música nas suas escalas das próximas 3 semanas.' : R.filter === 'multi' ? 'Nenhuma música com multitrack ainda.'
          : L.perm.songs() ? 'O repertório está vazio. Toque em Adicionar música para colocar a primeira.' : 'O repertório está vazio. Quem cuida das músicas da banda adiciona aqui.'));
      // No computador a lista ganha colunas (como a setlist do Moises).
      if (list.length) listBox.appendChild(h('div', { class: 'songrow songhead', 'aria-hidden': 'true', style: { display: 'none', cursor: 'default', gridTemplateColumns: '1fr auto', background: 'none' } },
        h('span', { class: 'label', style: { paddingLeft: '70px' } }, 'Música'),
        h('span', { class: 'cols label' }, h('span', null, 'Tom'), h('span', null, 'BPM'), h('span', null, 'Multitrack'))));
      list.forEach(function (p) { listBox.appendChild(songRow(p, soon[p.id])); });
    }
    fill();
    var active = R.filter !== 'todas';
    var root = h('div', { class: 'screen', style: { paddingBottom: '96px', gap: '12px' } },
      U.tabHead('Repertório'),
      h('div', { class: 'row', style: { alignItems: 'flex-end' } },
        h('div', { class: 'grow' }, U.field(R.query, 'Buscar música, artista ou tom', function (v) { R.query = v; fill(); })),
        h('button', { class: 'filterbtn' + (R.showFilters || active ? ' on' : ''), 'aria-label': R.showFilters ? 'Esconder os filtros' : active ? 'Filtros (um filtro ligado)' : 'Mostrar os filtros',
          onclick: function () { R.showFilters = !R.showFilters; L.render(); } }, ic('ListFilter', 22), active ? h('span', { class: 'd' }) : null)),
      R.showFilters ? h('div', { class: 'hscroll' }, FILTERS.map(function (f) { return U.toggle(f[1], R.filter === f[0], null, function () { R.filter = f[0]; L.render(); }); })) : null,
      !R.showFilters && active ? h('button', { class: 'filterpill', onclick: function () { R.filter = 'todas'; L.render(); } },
        'Mostrando: ' + FILTERS.find(function (f) { return f[0] === R.filter; })[1], ic('X', 14, 'accent')) : null,
      listBox);
    if (L.perm.songs()) root.appendChild(U.fab('Adicionar música', 'Plus', function () { L.go({ name: 'songedit' }); }));
    return root;
  });

  function songRow(p, inSchedule) {
    var multi = L.hasMulti(p);
    var key = L.keyToPlay(p);
    return h('div', { class: 'songrow', role: 'button', onclick: function () { L.songSheet(p.id); } },
      U.cover(p, 58, 6, 24),
      h('div', { class: 'grow col', style: { gap: '2px' } },
        h('div', { class: 'hi semi ell', style: { fontSize: '16px' } }, p.song_title),
        h('div', { class: 'muted small ell' }, [key ? 'Tom ' + key : null, p.artist].filter(Boolean).join(' · ') || ' '),
        h('div', { class: 'row', style: { gap: 0 } }, h('span', { class: 'small semi', style: { color: multi ? 'var(--accent-text)' : 'var(--muted)' } }, multi ? 'Com multitrack' : 'Sem multitrack'),
          inSchedule ? h('span', { class: 'accent small semi ell' }, ' · na sua escala') : null)),
      h('span', { class: 'cols' }, h('span', { class: 'hi' }, key || '—'), h('span', null, p.bpm ? String(p.bpm) : '—'),
        h('span', { class: 'row', style: { gap: '6px', color: multi ? 'var(--accent)' : 'var(--muted)' } }, ic(multi ? 'AudioWaveform' : 'Minus', 16), multi ? 'Tem' : 'Não tem')),
      U.neon('AudioWaveform', multi, multi ? 'Tem multitrack' : 'Sem multitrack'));
  }

  // ------------------------------------------------------------------ Ficha da música
  L.songSheet = function (id) {
    var p = L.project(id);
    if (!p) return;
    var extra = { parts: null, takes: null, markers: null };
    var sheet = L.sheet(function (close) { return sheetBody(p, extra, close); });
    Promise.all([
      sb.from('project_parts').select('*').eq('project_id', p.id).order('name'),
      sb.from('takes').select('*,file:files(id,object_key,bucket)').eq('project_id', p.id).order('created_at', { ascending: false }),
      sb.from('song_markers').select('*').eq('project_id', p.id).order('at_ms')
    ]).then(function (r) {
      extra.parts = r[0].error ? [] : r[0].data;
      extra.takes = r[1].error ? [] : Nuvem.mark(r[1].data);
      extra.markers = r[2].error ? [] : r[2].data;
      sheet.refresh();
    });
  };

  function sheetBody(p, extra, close) {
    var me = L.uid();
    var multi = L.hasMulti(p);
    var key = L.keyToPlay(p);
    var out = [];
    out.push(h('div', { class: 'center' }, U.cover(p, 'min(62vw, 280px)', 10, 64)));
    out.push(h('div', { class: 'col center', style: { alignItems: 'center', gap: '4px' } },
      h('div', { class: 'hi bold', style: { fontSize: '22px', lineHeight: 1.2 } }, p.song_title),
      p.artist ? h('div', { class: 'muted' }, p.artist) : null,
      h('div', { class: 'row' }, U.neon('AudioWaveform', multi, ''), h('span', { class: 'small', style: { color: multi ? 'var(--accent-text)' : 'var(--muted)' } }, multi ? 'Multitrack' : 'Sem multitrack'))));
    out.push(h('div', { class: 'row', style: { gap: '8px' } },
      infoBox('Tom', key || '—', p.band_key && p.musical_key && p.band_key !== p.musical_key ? 'original ' + p.musical_key : null),
      infoBox('BPM', p.bpm ? String(p.bpm) : '—'), infoBox('Compasso', p.time_signature || '—')));
    if (p.version_url) out.push(U.clickRow(function () { U.openUrl(p.version_url); }, h('span', { class: 'circle soft' }, ic('Play', 18)),
      h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, 'Ouvir a versão'), h('div', { class: 'muted small ell' }, p.version_url.replace(/^https?:\/\/(www\.)?/, ''))), ic('ExternalLink', 16, 'muted')));
    if (p.chart_url) out.push(U.clickRow(function () { U.openUrl(p.chart_url); }, h('span', { class: 'circle', style: { color: 'var(--text)' } }, ic('FileText', 18)),
      h('div', { class: 'hi semi grow' }, 'Letra / cifra'), ic('ExternalLink', 16, 'muted')));
    out.push(U.btn('Ouvir com multitrack', 'Headphones', function () { close(); setTimeout(function () { L.go({ name: 'studio', id: p.id }); }, 150); }, { full: true, tall: true, disabled: !multi }));
    if (!multi) out.push(U.body(L.perm.songs() ? 'Esta música ainda não tem multitrack. Toque em Editar música para enviar as faixas.' : 'Esta música ainda não tem multitrack. Por enquanto dá para ouvir pelo link.', 'var(--muted)', 12));

    // Vozes para estudar
    if (multi && extra.takes) {
      var others = extra.takes.filter(function (t) { return t.user_id !== me && t.released_for_rehearsal && t.file && t.file.object_key; });
      if (others.length) out.push(studyPanel(p, others, close));
    }
    if (p.leader_note) out.push(h('div', { class: 'note' }, h('div', { class: 'row warn bold tiny', style: { letterSpacing: '1px' } }, ic('Megaphone', 16), 'RECADO'), U.body(p.leader_note, 'var(--hi)')));
    if (p.lyrics && p.lyrics.trim()) out.push(lyricsBox(p));
    if (extra.markers && extra.markers.length) {
      var secs = Sections.build(extra.markers, (p.session_duration_ms || 0) / 1000 || 9999);
      out.push(U.label('Partes da música'));
      out.push(h('div', { class: 'hscroll' }, secs.map(function (s) {
        return h('span', { class: 'partchip', style: { borderColor: s.color, background: s.color + '33' } }, s.name, h('span', { class: 'muted tiny' }, L.clock(s.start)));
      })));
    }
    if (extra.parts && extra.parts.length) {
      out.push(U.panel('Quem canta o quê', 'UsersRound', extra.parts.map(function (part) {
        var mine = part.assigned_user === me;
        return h('div', { class: 'row', style: { gap: '10px' } }, U.avatar(part.assigned_user ? L.member(part.assigned_user) : null, 32),
          h('span', { class: 'semi grow', style: { color: mine ? 'var(--accent-text)' : 'var(--hi)' } }, part.name),
          h('span', { class: 'muted', style: { fontSize: '13px' } }, mine ? 'Você' : part.assigned_user ? L.nameOf(part.assigned_user) : 'ninguém ainda'));
      })));
    }
    if (extra.takes) {
      var mineT = extra.takes.filter(function (t) { return t.user_id === me; });
      if (mineT.length) out.push(U.panel('Minhas gravações', 'Mic', mineT.map(function (t) {
        return h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, t.name), h('div', { class: 'muted small' }, L.dm(t.created_at) + ' · ' + L.clock(t.duration_ms / 1000))), reviewChip(t.review_status));
      })));
    }
    if (L.perm.songs()) out.push(U.btn2('Editar música', 'Pencil', function () { close(); setTimeout(function () { L.go({ name: 'songedit', id: p.id }); }, 150); }, { full: true }));
    return out;
  }

  function reviewChip(st) {
    if (st === 'aprovada') return U.chip('Aprovada', 'ok', 'BadgeCheck');
    if (st === 'refazer') return U.chip('Pediu para refazer', 'bad', 'RotateCcw');
    return U.chip('Esperando o líder', '', 'Clock');
  }
  function infoBox(k, v, sub) {
    return h('div', { class: 'infobox' }, h('div', { class: 'k' }, k.toUpperCase()), h('div', { class: 'v ell' }, v), sub ? h('div', { class: 'muted tiny' }, sub) : null);
  }

  /** Letra dividida pelas marcações [Verso], [Refrão]... */
  L.parseLyrics = function (text) {
    var out = [], title = null, lines = [];
    function flush() {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      while (lines.length && !lines[0].trim()) lines.shift();
      if (title !== null || lines.length) out.push({ title: title, lines: lines });
    }
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (raw) {
      var m = /^\s*\[(.+?)]\s*$/.exec(raw);
      if (m) { flush(); title = m[1].trim(); lines = []; } else lines.push(raw.replace(/\s+$/, ''));
    });
    flush();
    return out;
  };
  function lyricsBox(p) {
    var blocks = L.parseLyrics(p.lyrics);
    var all = false;
    var box = h('div', { class: 'box col', style: { padding: '12px', gap: '6px' } });
    function fill() {
      box.replaceChildren(h('div', { class: 'row' }, ic('FileText', 16, 'muted'), h('span', { class: 'label grow', style: { fontWeight: 700 } }, 'Letra'),
        h('button', { class: 'textbtn', style: { fontSize: '12px', padding: '4px' }, onclick: function () { all = !all; fill(); } }, all ? 'mostrar menos' : 'ver tudo')));
      (all ? blocks : blocks.slice(0, 1)).forEach(function (b) {
        if (b.title) box.appendChild(h('div', { class: 'accent bold tiny', style: { letterSpacing: '1px', textTransform: 'uppercase' } }, b.title));
        b.lines.forEach(function (ln) { box.appendChild(h('div', { class: 'hi', style: { fontSize: '15px', lineHeight: '21px', minHeight: '10px' } }, ln || ' ')); });
      });
    }
    fill();
    return box;
  }

  // ------------------------------------------------------------------ Vozes para estudar
  /** Agrupa por naipe (os sem naipe no fim); de cada pessoa, em cada naipe, só a mais nova. */
  L.studyGroups = function (takes) {
    var ids = VoiceParts.ALL.map(function (v) { return v.id; });
    var seen = {}, groups = {};
    takes.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).forEach(function (t) {
      var k = ids.indexOf(t.voice_part) >= 0 ? t.voice_part : '';
      var dedupe = t.user_id + '|' + (t.voice_part || '');
      if (seen[dedupe]) return;
      seen[dedupe] = true;
      (groups[k] = groups[k] || []).push(t);
    });
    return Object.keys(groups).sort(function (a, b) { return (a ? ids.indexOf(a) : 99) - (b ? ids.indexOf(b) : 99); }).map(function (k) { return [k, groups[k]]; });
  };
  L.studyVoices = { get: function (pid) { return L.store.get('vozes.' + pid, []); }, set: function (pid, ids) { L.store.set('vozes.' + pid, ids); } };

  function studyPanel(p, takes, close) {
    var groups = L.studyGroups(takes);
    var me = L.me();
    var part = L.store.get('naipe.' + p.id, null);
    if (!groups.some(function (g) { return g[0] === part; })) part = me && groups.some(function (g) { return g[0] === me.voice_type; }) ? me.voice_type : groups[0][0];
    var chosen = L.studyVoices.get(p.id);
    var panel = h('section', { class: 'panel' });
    function fill() {
      var count = chosen.filter(function (id) { return takes.some(function (t) { return t.id === id; }); }).length;
      var g = groups.find(function (x) { return x[0] === part; });
      L.fill(panel, h('div', { class: 'ph' }, ic('Users', 15), U.label('Vozes para estudar')),
        U.body('Qual voz você quer aprender? Escolha e toque na gravação de quem cantou: no estúdio, ela toca junto com a multitrack.', 'var(--muted)', 12),
        h('div', { class: 'hscroll' }, groups.map(function (x) {
          return U.toggle((x[0] ? VoiceParts.label(x[0]) : 'Sem voz marcada') + ' · ' + x[1].length, part === x[0], null, function () { part = x[0]; L.store.set('naipe.' + p.id, part); fill(); });
        })),
        (g ? g[1] : []).map(function (t) {
          var on = chosen.indexOf(t.id) >= 0;
          return h('div', { class: 'pickrow' + (on ? ' on' : ''),
            onclick: function () { chosen = on ? chosen.filter(function (x) { return x !== t.id; }) : chosen.concat([t.id]); L.studyVoices.set(p.id, chosen); fill(); } },
            U.avatar(L.member(t.user_id), 32),
            h('div', { class: 'grow', style: { marginLeft: '2px' } }, h('div', { class: 'hi semi ell' }, L.nameOf(t.user_id)),
              h('div', { class: 'muted small' }, [t.voice_part ? VoiceParts.label(t.voice_part) : null, L.clock(t.duration_ms / 1000)].filter(Boolean).join(' · '))),
            h('span', { style: { color: on ? 'var(--accent-text)' : 'var(--muted)' } }, ic(on ? 'Check' : 'Plus', 20)));
        }),
        count ? U.btn(count === 1 ? 'Estudar com esta voz' : 'Estudar com estas ' + count + ' vozes', 'Headphones', function () { close(); setTimeout(function () { L.go({ name: 'studio', id: p.id }); }, 150); }, { full: true }) : null);
    }
    fill();
    return panel;
  }

  // ------------------------------------------------------------------ Adicionar / editar música
  var SIGS = ['4/4', '3/4', '6/8', '2/4', '12/8'];
  var Ed = null;
  L.screen('songedit', function (r) {
    var p = r.id ? L.project(r.id) : null;
    if (!Ed || Ed.id !== (r.id || null)) {
      Ed = { id: r.id || null, title: p ? p.song_title : '', artist: p ? p.artist || '' : '', link: p ? p.version_url || '' : '', key: p ? p.musical_key || '' : '',
        bandKey: p ? p.band_key || '' : '', bpm: p && p.bpm ? String(p.bpm) : '', sig: p ? p.time_signature || '' : '', chart: p ? p.chart_url || '' : '',
        note: p ? p.leader_note || '' : '', lyrics: p ? p.lyrics || '' : '', cover: null, coverUrl: null, stems: [], tracks: null, busy: false, progress: null, taps: [] };
      if (p) sb.from('tracks').select('id').eq('project_id', p.id).then(function (res) { if (Ed && Ed.id === p.id) { Ed.tracks = (res.data || []).length; L.render(); } });
    }
    var e = Ed;
    function linkOk(s) { return !s.trim() || /^https?:\/\/\S+$/i.test(s.trim()); }
    var bpmN = parseInt(e.bpm, 10);
    var valid = e.title.trim() && linkOk(e.link) && linkOk(e.chart) && (!e.bpm || (bpmN >= 20 && bpmN <= 300));
    var preview = Object.assign({ id: p ? p.id : 'nova', song_title: e.title || '?', version_url: e.link }, p ? { cover_path: p.cover_path } : {});
    var coverEl = e.coverUrl ? h('span', { class: 'cover', style: { width: '120px', height: '120px', borderRadius: '6px' } }, h('img', { src: e.coverUrl, alt: '' })) : U.cover(preview, 120, 6, 52);
    var saveBtn = U.btn(e.busy ? 'Salvando…' : p ? 'Salvar' : 'Adicionar ao repertório', 'Check', save, { full: true, tall: true, disabled: !valid || e.busy });
    function setVal(k) { return function (v) { e[k] = v; var bn = parseInt(e.bpm, 10); saveBtn.disabled = e.busy || !(e.title.trim() && linkOk(e.link) && linkOk(e.chart) && (!e.bpm || (bn >= 20 && bn <= 300))); }; }

    var stemsList = h('div', { class: 'col' }, e.stems.map(function (f, i) {
      return h('div', { class: 'row' }, ic('FileAudio', 16, 'muted'), h('span', { class: 'grow ell small' }, f.name), h('span', { class: 'muted small' }, L.bytes(f.size)),
        U.iconBtn('X', 'Tirar', function () { e.stems.splice(i, 1); L.render(); }, { color: 'var(--muted)', disabled: e.busy }));
    }));
    return h('div', { class: 'screen' },
      U.topRow(p ? 'Editar música' : 'Adicionar música', null, null, function () { if (!e.busy) { Ed = null; L.back(); } }),
      h('div', { class: 'row', style: { gap: '14px' } }, coverEl, h('div', { class: 'col' },
        U.btn2('Escolher capa', 'Camera', function () {
          U.pickSquareJpeg(600).then(function (b) { if (b) { e.cover = b; e.coverUrl = URL.createObjectURL(b); L.render(); } }).catch(function (x) { L.toast(L.errorText(x)); });
        }),
        U.body(!e.cover && !(p && p.cover_path) ? 'Sem capa, usamos a imagem do vídeo do link (YouTube).' : 'Capa escolhida.', 'var(--muted)', 12))),
      U.field(e.title, 'Nome da música *', setVal('title'), { max: 80 }),
      U.field(e.artist, 'Artista / ministério', setVal('artist'), { max: 120 }),
      U.field(e.link, 'Link da versão (YouTube)', setVal('link'), { type: 'url', inputmode: 'url', max: 500 }),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, U.field(e.key, 'Tom original', setVal('key'), { max: 12 })), h('div', { class: 'grow' }, U.field(e.bandKey, 'Tom da banda', setVal('bandKey'), { max: 12 }))),
      h('div', { class: 'row', style: { alignItems: 'stretch' } }, h('div', { class: 'grow' }, U.field(e.bpm, 'BPM', function (v) { setVal('bpm')(v.replace(/\D/g, '').slice(0, 3)); }, { inputmode: 'numeric' })),
        U.btn2('Bater o tempo', 'Hand', function () {
          var now = Date.now();
          if (e.taps.length && now - e.taps[e.taps.length - 1] > 2000) e.taps = [];
          e.taps.push(now);
          if (e.taps.length > 8) e.taps.shift();
          if (e.taps.length >= 3) { var avg = (e.taps[e.taps.length - 1] - e.taps[0]) / (e.taps.length - 1); e.bpm = String(Math.min(300, Math.max(20, Math.round(60000 / avg)))); L.render(); }
        }, { style: { minHeight: '56px' } })),
      U.label('Compasso'),
      h('div', { class: 'hscroll' }, U.toggle('—', !e.sig, null, function () { e.sig = ''; L.render(); }), SIGS.map(function (s) { return U.toggle(s, e.sig === s, null, function () { e.sig = s; L.render(); }); })),
      U.field(e.chart, 'Link da letra / cifra (opcional)', setVal('chart'), { type: 'url', inputmode: 'url', max: 500 }),
      U.field(e.note, 'Recado para a banda (opcional)', setVal('note'), { multiline: true, rows: 2, max: 500 }),
      U.field(e.lyrics, 'Letra (opcional). Use [Verso], [Refrão]… para as partes', setVal('lyrics'), { multiline: true, rows: 6, max: 20000 }),
      U.panel('Multitrack (opcional)', 'AudioWaveform',
        e.tracks ? h('div', { class: 'row' }, U.neon('AudioWaveform', true, ''), h('span', { class: 'hi' }, e.tracks + ' faixas na nuvem')) : null,
        U.body(e.tracks ? 'Dá para acrescentar mais faixas (mesma taxa e duração das que já estão).' : 'Sem multitrack a música fica só com link, tom e BPM. Para ensaiar, envie as faixas separadas em MP3 (bitrate constante, até 12).', 'var(--muted)', 12),
        stemsList,
        U.btn2(e.stems.length ? 'Escolher mais faixas' : 'Escolher as faixas (MP3)', 'Upload', function () {
          var inp = h('input', { type: 'file', accept: '.mp3,audio/mpeg', multiple: true, style: { display: 'none' } });
          inp.onchange = function () { Array.prototype.forEach.call(inp.files, function (f) { if (!e.stems.some(function (x) { return x.name === f.name && x.size === f.size; })) e.stems.push(f); }); inp.remove(); L.render(); };
          document.body.appendChild(inp); inp.click();
        }, { full: true, disabled: e.busy })),
      e.progress ? [U.body(e.progress[0], null, 13), h('div', { class: 'loading-bar' }, h('i', { style: { width: Math.round(e.progress[1] * 100) + '%' } }))] : null,
      saveBtn,
      p ? h('button', { class: 'textbtn', style: { color: 'var(--bad)', width: '100%' }, disabled: e.busy, onclick: function () {
        L.confirm('Apagar ' + p.song_title + '?', 'A música sai do repertório e das escalas, com as faixas e as gravações dela. Não dá para desfazer.', 'Apagar', function () {
          L.run(async function () { L.must(await sb.from('projects').delete().eq('id', p.id)); await D.reloadSongs(); await D.reloadServices(); Ed = null; L.toast(p.song_title + ' apagada.'); L.back(); });
        }, true);
      } }, 'Apagar música do repertório') : null);

    async function save() {
      if (e.busy) return;
      e.busy = true; L.render();
      try {
        var org = S.current.org.id;
        var opt = function (s) { return s.trim() || null; };
        var row = { song_title: e.title.trim(), name: e.title.trim(), artist: opt(e.artist), version_url: (function (v) { v = opt(v); return v && !/^https?:\/\//i.test(v) ? 'https://' + v : v; })(e.link), musical_key: opt(e.key), band_key: opt(e.bandKey),
          bpm: e.bpm ? parseInt(e.bpm, 10) : null, time_signature: e.sig || null, chart_url: opt(e.chart), leader_note: opt(e.note) };
        if (e.lyrics.trim() || (p && p.lyrics)) row.lyrics = opt(e.lyrics);
        var pid;
        if (p) { L.must(await sb.from('projects').update(row).eq('id', p.id)); pid = p.id; }
        else pid = L.must(await sb.from('projects').insert(Object.assign({ org_id: org, created_by: S.user.id }, row)).select('id').single()).id;
        if (e.cover) {
          e.progress = ['Enviando a capa…', 0]; L.render();
          var path = org + '/' + pid + '-' + Date.now() + '.jpg';
          L.must(await sb.storage.from('covers').upload(path, e.cover, { contentType: 'image/jpeg' }));
          L.must(await sb.from('projects').update({ cover_path: path }).eq('id', pid));
          if (p && p.cover_path) sb.storage.from('covers').remove([p.cover_path]);
        }
        if (e.stems.length) {
          try { await uploadStems(org, pid, e.stems, e.tracks || 0, p, function (t, f) { e.progress = [t, f]; L.render(); }); }
          catch (x) { await D.reloadSongs(); throw new Error('A música foi salva, mas a multitrack não: ' + L.errorText(x)); }
        }
        await D.reloadSongs();
        var title = e.title.trim();
        Ed = null;
        L.toast(p ? 'Música salva.' : title + ' adicionada ao repertório.');
        L.back();
      } catch (x) {
        L.toast(L.errorText(x));
        if (Ed) { Ed.busy = false; Ed.progress = null; L.render(); }
      }
    }
  });

  /** Confere e envia a multitrack (MP3 CBR), como o painel web: cadastra, envia, o servidor confere, vira faixa. */
  async function uploadStems(org, pid, files, existing, p, say) {
    if (existing + files.length > 12) throw new Error('O limite é de 12 faixas por música.');
    if (!window.crypto || !crypto.subtle) throw new Error('Este navegador não permite conferir os arquivos. Abra o site por https.');
    say('Conferindo os arquivos…', 0);
    var items = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var buf = await f.arrayBuffer();
      var scan;
      try { scan = Mp3Scan.scanMp3(new Uint8Array(buf)); } catch (x) { throw new Error(f.name + ': não é um MP3 válido. Envie as faixas em MP3.'); }
      if (!scan.isCBR) throw new Error(f.name + ': MP3 de bitrate variável (VBR). Exporte em bitrate constante (CBR), por exemplo 320 kbps.');
      items.push({ file: f, buf: buf, scan: scan });
    }
    var sr = p && p.sample_rate && existing ? p.sample_rate : items[0].scan.sampleRate;
    items.forEach(function (it) { if (it.scan.sampleRate !== sr) throw new Error(it.file.name + ': taxa de ' + it.scan.sampleRate + ' Hz, diferente das outras faixas (' + sr + ' Hz). Exporte todas iguais.'); });
    if (!p || !p.session_duration_ms || !existing) {
      var min = Math.min.apply(null, items.map(function (it) { return it.scan.expectedPcmFrames; }));
      L.must(await sb.from('projects').update({ session_duration_ms: Math.max(1, Math.round(min / sr * 1000)), sample_rate: sr }).eq('id', pid));
    }
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      say('Enviando ' + it.file.name + ' (' + (j + 1) + ' de ' + items.length + ')…', j / items.length);
      var fileId = crypto.randomUUID();
      var key = org + '/' + pid + '/stems/' + fileId + '.mp3';
      var hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', it.buf))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      await Nuvem.uploadAudio(sb, { id: fileId, org_id: org, project_id: pid, object_key: key, size_bytes: it.file.size, checksum_sha256: hash, mime: 'audio/mpeg', uploaded_by: S.user.id }, it.file);
      L.must(await sb.from('tracks').insert({ project_id: pid, name: it.file.name.replace(/\.[^.]+$/, '').slice(0, 60), type: 'stem', source_file_id: fileId, sort_order: existing + j }));
    }
    say('Pronto!', 1);
  }
})();
