// Louvor Studio (web para celular) — Repertório, ficha da música e adicionar/editar música (ui/SongsScreen.kt e ui/SongEditorScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var R = { query: '', filter: 'todas', showFilters: false, sel: null };   // sel: músicas escolhidas para apagar (null = sem seleção)
  var FILTERS = [['todas', 'Todas'], ['escala', 'Das próximas escalas'], ['multi', 'Com multitrack']];

  function tagList() {
    var seen = {};
    S.projects.forEach(function (p) { (p.tags || []).forEach(function (t) { seen[t] = true; }); });
    return Object.keys(seen).sort(function (a, b) { return L.norm(a).localeCompare(L.norm(b)); });
  }
  function filterLabel() {
    if (R.filter.indexOf('tag:') === 0) return R.filter.slice(4);
    var f = FILTERS.find(function (x) { return x[0] === R.filter; });
    return f ? f[1] : 'Todas';
  }
  function matchesFilter(p, soon) {
    if (R.filter === 'todas') return true;
    if (R.filter === 'escala') return !!soon[p.id];
    if (R.filter === 'multi') return L.hasMulti(p);
    return (p.tags || []).indexOf(R.filter.slice(4)) >= 0;
  }

  function soonSet() {
    var out = {};
    L.myUpcoming().filter(function (s) { return L.daysBetween(L.today(), s.starts_on) <= 21; }).forEach(function (s) { s.songIds.forEach(function (id) { out[id] = true; }); });
    return out;
  }

  // ------------------------------------------------------------------ Música repetida
  // Mesmo título (sem acento, maiúscula nem pontuação) e mesmo artista; sem artista num dos dois, só o título.
  function songKey(s) { return L.norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  L.findSongDup = function (title, artist, exceptId) {
    var t = songKey(title), a = songKey(artist);
    if (!t) return null;
    return S.projects.find(function (p) {
      if (p.id === exceptId || songKey(p.song_title) !== t) return false;
      var pa = songKey(p.artist);
      return !a || !pa || a === pa;
    }) || null;
  };
  function dupDialog(p) {
    L.dialog({
      title: 'Essa música já existe',
      body: function () {
        return U.body('“' + p.song_title + '”' + (p.artist ? ' (' + p.artist + ')' : '') + ' já está no repertório da banda. Para mudar alguma coisa nela, abra a que já existe e toque em Editar música.', null, 14);
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Voltar'),
          h('button', { class: 'textbtn', onclick: function () { close(); Ed = null; L.back(); setTimeout(function () { L.songSheet(p.id); }, 200); } }, 'Abrir a que já existe')];
      }
    });
  }

  // ------------------------------------------------------------------ Apagar várias músicas
  function deleteChosen(list) {
    var ids = list.map(function (p) { return p.id; });
    var today = L.today();
    var inSchedules = S.services.filter(function (sv) { return sv.starts_on >= today && sv.songIds.some(function (id) { return ids.indexOf(id) >= 0; }); });
    var names = list.slice(0, 6).map(function (p) { return p.song_title; }).join(', ') + (list.length > 6 ? ' e mais ' + (list.length - 6) : '');
    L.dialog({
      title: list.length === 1 ? 'Apagar 1 música?' : 'Apagar ' + list.length + ' músicas?',
      body: function () {
        return [U.body(names + '.', 'var(--hi)', 14),
          U.body('Vão junto a multitrack, as gravações e as partes marcadas. Isso não dá para desfazer.', null, 14),
          inSchedules.length ? U.body('Atenção: ' + L.plural(inSchedules.length, 'escala que ainda vai acontecer usa', 'escalas que ainda vão acontecer usam') + ' essas músicas; elas saem dessas escalas.', 'var(--warn)', 13) : null];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function (ev) {
            var btn = ev.target;
            btn.disabled = true;
            L.run(async function () {
              try {
                L.must(await sb.from('projects').delete().in('id', ids));
                close();
                R.sel = null;
                await D.reloadSongs(); await D.reloadServices();
                if (Nuvem.emptyTrash) Nuvem.emptyTrash(sb);   // os áudios saem do R2 (migração 0027)
                L.toast(list.length === 1 ? list[0].song_title + ' apagada.' : list.length + ' músicas apagadas.');
                L.render();
              } finally { btn.disabled = false; }
            });
          } }, 'Apagar')];
      }
    });
  }

  function pickRow(p) {
    var on = !!R.sel[p.id];
    return h('div', { class: 'bulkrow' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': String(on), tabindex: '0',
      onclick: function () { if (on) delete R.sel[p.id]; else R.sel[p.id] = true; L.render(); },
      onkeydown: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.click(); } } },
      h('span', { class: 'chk' }, on ? ic('Check', 15) : null),
      U.cover(p, 44, 6, 20),
      h('div', { class: 'grow col', style: { gap: '2px', minWidth: 0 } },
        h('div', { class: 'hi semi ell', style: { fontSize: '15px' } }, p.song_title),
        h('div', { class: 'muted small ell' }, [p.artist, L.hasMulti(p) ? 'com multitrack' : null].filter(Boolean).join(' · ') || ' ')));
  }

  // ------------------------------------------------------------------ Aba
  // ------------------------------------------------------------------ Buscar no YouTube (função youtube)
  /** Título do vídeo → nome da música e artista. Tira (Ao Vivo), [Clipe Oficial], "Official Video"… e separa "Artista - Música". */
  L.ytParse = function (title, channel) {
    var artist = (channel || '').replace(/\s*-\s*Topic$/i, '').replace(/\s*(VEVO|Oficial|Official)$/i, '').trim();
    var t = (title || '').replace(/[([][^)\]]*(ao vivo|clipe|official|oficial|video|vídeo|lyric|letra|playback|legendado|live|áudio|audio|visualizer|acústico)[^)\]]*[)\]]/gi, '')
      .replace(/\b(clipe oficial|official (music )?video|vídeo oficial|lyric video|com letra)\b/gi, '').replace(/\s{2,}/g, ' ').trim().replace(/^[-–|\s]+|[-–|\s]+$/g, '');
    var parts = t.split(/\s+[-–|]\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var song = parts[0] || t;
    if (parts.length >= 2) {
      var a = L.norm(artist);
      var i = parts.findIndex(function (x) { var n = L.norm(x); return a && (n.indexOf(a) >= 0 || a.indexOf(n) >= 0); });
      if (i >= 0) { song = parts[i === 0 ? 1 : 0]; artist = parts[i]; }
      else { song = parts[0]; if (!artist) artist = parts[1]; }
    }
    return { song: song.replace(/^["“]|["”]$/g, '').trim(), artist: artist };
  };

  function ytSearch(e) {
    var st = { q: e.title || '', busy: false, items: null, err: null };
    var dlg = L.sheet(function (close) {
      async function go() {
        if (st.q.trim().length < 2 || st.busy) return;
        st.busy = true; st.err = null; dlg.refresh();
        try {
          var res = await sb.functions.invoke('dynamic-task', { body: { q: st.q.trim() } });
          if (res.error) {
            var msg = res.error.message;
            try { msg = (await res.error.context.json()).error || msg; } catch (x) { /* sem corpo */ }
            throw new Error(msg);
          }
          st.items = (res.data && res.data.items) || [];
        } catch (x) { st.err = /Failed to send|404|not found/i.test(x.message) ? 'A busca no YouTube ainda não foi ligada no servidor.' : x.message; st.items = null; }
        st.busy = false; dlg.refresh();
      }
      var input = U.field(st.q, 'Nome da música (e o artista, se souber)', function (v) { st.q = v; }, { max: 120 });
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
      return [
        h('div', { class: 'hi semi', style: { fontSize: '18px' } }, 'Buscar no YouTube'),
        input,
        U.btn(st.busy ? 'Buscando…' : 'Buscar', 'Search', go, { full: true, disabled: st.busy }),
        st.err ? U.body(st.err, 'var(--bad)', 13) : null,
        st.items && !st.items.length ? U.body('Nada encontrado. Tente outro nome.', 'var(--muted)', 13) : null,
        (st.items || []).map(function (it) {
          return U.clickRow(function () {
            var r = L.ytParse(it.title, it.channel);
            e.title = r.song.slice(0, 80); e.artist = (r.artist || '').slice(0, 120); e.link = it.url;
            close(); L.render(); L.toast('Preenchido pelo YouTube. Confira o nome e o artista.');
          },
            h('img', { src: it.thumb, alt: '', style: { width: '96px', height: '54px', objectFit: 'cover', borderRadius: '6px', flex: 'none' } }),
            h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi small', style: { lineHeight: 1.3 } }, it.title), h('div', { class: 'muted small ell' }, it.channel)));
        }),
        U.body('O app só usa o nome, o artista, o link e a imagem do vídeo. O áudio do YouTube não é baixado.', 'var(--muted)', 11)
      ];
    });
    setTimeout(function () { var i = document.querySelector('.sheet input'); if (i) i.focus(); if (st.q.trim().length >= 2) go2(); }, 50);
    function go2() { var b = [].slice.call(document.querySelectorAll('.sheet button')).find(function (x) { return x.textContent.trim() === 'Buscar'; }); if (b) b.click(); }
  }

  L.screen('tab-musicas', function () {
    var soon = soonSet();
    var listBox = h('div', { class: 'songlist' });
    function fill() {
      listBox.replaceChildren();
      var q = L.norm(R.query.trim());
      var list = S.projects.filter(function (p) { return !q || [p.song_title, p.artist, p.name, p.musical_key, p.band_key, p.album, (p.tags || []).join(' ')].some(function (f) { return f && L.norm(f).indexOf(q) >= 0; }); })
        .filter(function (p) { return matchesFilter(p, soon); })
        .sort(function (a, b) { return L.norm(a.song_title).localeCompare(L.norm(b.song_title)); });
      if (!list.length) listBox.appendChild(U.empty(R.query.trim() ? 'Nenhuma música encontrada para "' + R.query + '".'
        : R.filter === 'escala' ? 'Nenhuma música nas suas escalas das próximas 3 semanas.' : R.filter === 'multi' ? 'Nenhuma música com multitrack ainda.' : R.filter !== 'todas' ? 'Nenhuma música em "' + filterLabel() + '".'
          : L.perm.songs() ? 'O repertório está vazio. Toque em Adicionar música para colocar a primeira, ou em Planilha para trazer várias de uma vez.' : 'O repertório está vazio. Quem cuida das músicas da banda adiciona aqui.'));
      // No computador a lista ganha colunas (como a setlist do Moises).
      if (list.length) listBox.appendChild(h('div', { class: 'songrow songhead', 'aria-hidden': 'true', style: { display: 'none', cursor: 'default', gridTemplateColumns: '1fr auto', background: 'none' } },
        h('span', { class: 'label', style: { paddingLeft: '70px' } }, 'Música'),
        h('span', { class: 'cols label' }, h('span', null, 'Tom'), h('span', null, 'BPM'), h('span', null, 'Multitrack'))));
      if (R.sel) {
        var allOn = list.length && list.every(function (p) { return R.sel[p.id]; });
        if (list.length) listBox.appendChild(h('div', { class: 'row' }, h('span', { class: 'muted small grow' }, 'Toque nas músicas que vão sair do repertório.'),
          h('button', { class: 'textbtn', style: { fontSize: '14px' }, onclick: function () { list.forEach(function (p) { if (allOn) delete R.sel[p.id]; else R.sel[p.id] = true; }); L.render(); } },
            allOn ? 'Tirar todas' : 'Escolher todas (' + list.length + ')')));
        list.forEach(function (p) { listBox.appendChild(pickRow(p)); });
        return;
      }
      list.forEach(function (p) { listBox.appendChild(songRow(p, soon[p.id])); });
    }
    if (R.sel && !L.perm.songs()) R.sel = null;
    if (R.filter.indexOf('tag:') === 0 && tagList().indexOf(R.filter.slice(4)) < 0) R.filter = 'todas';
    fill();
    var active = R.filter !== 'todas';
    var root = h('div', { class: 'screen', style: { paddingBottom: '96px', gap: '12px' } },
      U.tabHead('Repertório', L.perm.songs()
        ? (R.sel ? U.textBtn('Cancelar', function () { R.sel = null; L.render(); })
          : h('div', { class: 'row', style: { gap: '4px' } },
            U.btn2('Planilha', 'FileSpreadsheet', sheetMenu),
            S.projects.length ? U.iconBtn('ListChecks', 'Escolher músicas para apagar', function () { R.sel = {}; L.render(); }) : null,
            U.helpBtn('repertorio')))
        : U.helpBtn('repertorio')),
      h('div', { class: 'row', style: { alignItems: 'flex-end' } },
        h('div', { class: 'grow' }, U.field(R.query, 'Buscar música, artista ou tom', function (v) { R.query = v; fill(); })),
        h('button', { class: 'filterbtn' + (R.showFilters || active ? ' on' : ''), 'aria-label': R.showFilters ? 'Esconder os filtros' : active ? 'Filtros (um filtro ligado)' : 'Mostrar os filtros',
          onclick: function () { R.showFilters = !R.showFilters; L.render(); } }, ic('ListFilter', 22), active ? h('span', { class: 'd' }) : null)),
      R.showFilters ? h('div', { class: 'hscroll' }, FILTERS.concat(tagList().map(function (t) { return ['tag:' + t, t]; })).map(function (f) { return U.toggle(f[1], R.filter === f[0], null, function () { R.filter = f[0]; L.render(); }); })) : null,
      !R.showFilters && active ? h('button', { class: 'filterpill', onclick: function () { R.filter = 'todas'; L.render(); } },
        'Mostrando: ' + filterLabel(), ic('X', 14, 'accent')) : null,
      listBox);
    if (R.sel) {
      var chosen = S.projects.filter(function (p) { return R.sel[p.id]; });
      root.appendChild(h('div', { class: 'bulkbar' },
        h('div', { class: 'hi semi', style: { fontSize: '14px', padding: '0 4px' } }, chosen.length ? L.plural(chosen.length, 'música escolhida', 'músicas escolhidas') : 'Nenhuma música escolhida'),
        h('div', { class: 'row', style: { gap: '8px' } },
          U.btn2('Cancelar', 'X', function () { R.sel = null; L.render(); }, { full: true }),
          U.btn2(chosen.length ? 'Apagar (' + chosen.length + ')' : 'Apagar', 'Trash2', function () { deleteChosen(chosen); }, { full: true, danger: true, disabled: !chosen.length }))));
    } else if (L.perm.songs()) root.appendChild(U.fab('Adicionar música', 'Plus', function () { L.go({ name: 'songedit' }); }));
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
      p.album ? h('div', { class: 'muted small' }, p.album) : null,
      p.tags && p.tags.length ? h('div', { class: 'muted small' }, p.tags.join(' · ')) : null,
      h('div', { class: 'row' }, U.neon('AudioWaveform', multi, ''), h('span', { class: 'small', style: { color: multi ? 'var(--accent-text)' : 'var(--muted)' } }, multi ? 'Multitrack' : 'Sem multitrack'))));
    out.push(h('div', { class: 'row', style: { gap: '8px' } },
      infoBox('Tom', key || '—', p.band_key && p.musical_key && p.band_key !== p.musical_key ? 'original ' + p.musical_key : null),
      infoBox('BPM', p.bpm ? String(p.bpm) : '—'), infoBox('Compasso', p.time_signature || '—')));
    if (p.version_url) out.push(U.clickRow(function () { U.openUrl(p.version_url); }, h('span', { class: 'circle soft' }, ic('Play', 18)),
      h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, 'Ouvir a versão'), h('div', { class: 'muted small ell' }, p.version_url.replace(/^https?:\/\/(www\.)?/, ''))), ic('ExternalLink', 16, 'muted')));
    if (p.chart_url) out.push(U.clickRow(function () { U.openUrl(p.chart_url); }, h('span', { class: 'circle', style: { color: 'var(--text)' } }, ic('FileText', 18)),
      h('div', { class: 'hi semi grow' }, p.lyrics_url ? 'Cifra' : 'Letra / cifra'), ic('ExternalLink', 16, 'muted')));
    if (p.lyrics_url) out.push(U.clickRow(function () { U.openUrl(p.lyrics_url); }, h('span', { class: 'circle', style: { color: 'var(--text)' } }, ic('AlignLeft', 18)),
      h('div', { class: 'hi semi grow' }, 'Letra'), ic('ExternalLink', 16, 'muted')));
    if (p.audio_url) out.push(U.clickRow(function () { U.openUrl(p.audio_url); }, h('span', { class: 'circle', style: { color: 'var(--text)' } }, ic('Music', 18)),
      h('div', { class: 'hi semi grow' }, 'Ouvir o áudio'), ic('ExternalLink', 16, 'muted')));
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
    if (L.perm.edit() && multi) out.push(U.btn2('Revisar as gravações da banda', 'Headphones', function () { close(); setTimeout(function () { L.go({ name: 'review', id: p.id }); }, 150); }, { full: true }));
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

  // ------------------------------------------------------------------ Importar e exportar planilha
  var Imp = null;
  var IMP_ERR = {
    formato: 'Use um arquivo .xlsx ou .csv. No Excel: Arquivo › Salvar como › Pasta de Trabalho do Excel (.xlsx).',
    colunas: 'Não achei a coluna com o nome das músicas. A primeira linha precisa ter um título como "Nome da música" ou "Música".',
    grande: 'Esse arquivo é grande demais. O limite é 8 MB.',
    linhas: 'Essa planilha tem linhas demais. O limite é 3.000 músicas.',
    arquivo: 'Não consegui ler esse arquivo. Confira se ele abre no Excel e salve de novo como .xlsx.'
  };
  function sheetMenu() {
    L.sheet(function (close) {
      return [h('div', { class: 'hi bold', style: { fontSize: '20px' } }, 'Planilha do repertório'),
        U.clickRow(function () { close(); setTimeout(pickSheet, 150); }, h('span', { class: 'circle soft' }, ic('Upload', 18)),
          h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, 'Importar músicas'), h('div', { class: 'muted small' }, 'Excel (.xlsx) ou CSV. Você confere tudo antes de entrar.'))),
        U.clickRow(function () { close(); setTimeout(exportSheet, 150); }, h('span', { class: 'circle soft' }, ic('Download', 18)),
          h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, 'Exportar repertório'), h('div', { class: 'muted small' }, S.projects.length ? L.plural(S.projects.length, 'música', 'músicas') + ' em Excel, para outra banda importar.' : 'O repertório ainda está vazio.'))),
        U.body('A planilha leva só os dados, os links e as letras. A multitrack não sai do app.', 'var(--muted)', 13)];
    });
  }
  function pickSheet() {
    var inp = h('input', { type: 'file', accept: '.xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv', style: { display: 'none' } });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (f) readSheet(f);
    });
    inp.click();
  }
  async function readSheet(f) {
    try {
      var rows = await Planilha.readFile(f.name, await f.arrayBuffer()), info = Planilha.inspect(rows);
      if (info.at < 0 || !info.cols.length) { L.toast('Não encontrei músicas nesse arquivo.'); return; }
      var m = { file: f.name, rows: rows, at: info.at, cols: info.cols, items: null, sel: {}, step: 'cols', busy: false, progress: null };
      if (!Planilha.needsReview(info.cols)) { var n = buildItems(m); if (!n) { L.toast('Não encontrei músicas nesse arquivo.'); return; } }
      Imp = m;
      L.go({ name: 'songimport' });
    } catch (x) { L.dialog({ title: 'Não deu para importar', body: function () { return U.body(IMP_ERR[x.message] || IMP_ERR.arquivo, null, 14); }, actions: function (close) { return [h('button', { class: 'textbtn', onclick: close }, 'Entendi')]; } }); }
  }
  function buildItems(m) {
    var parsed = Planilha.parseRows(m.rows, { at: m.at, cols: m.cols });
    if (parsed.error || !parsed.songs.length) return 0;
    m.items = Planilha.classify(parsed.songs, S.projects);
    m.sel = {};
    m.items.forEach(function (it, i) { if (it.status === 'new') m.sel[i] = true; });
    m.step = 'list';
    return m.items.length;
  }
  function columnCard(m, c) {
    var unknown = !c.field && !c.ignored;
    var sel = h('select', { 'aria-label': 'O que é a coluna ' + c.name, style: { width: '100%', minHeight: '44px', padding: '0 10px', borderRadius: '10px', fontSize: '16px', background: 'var(--bg)', color: 'var(--hi)', border: '1px solid var(--outline)' },
      onchange: function () {
        var v = this.value;
        if (v) m.cols.forEach(function (o) { if (o !== c && o.field === v) o.field = null; });   // cada campo vem de uma coluna só
        c.field = v || null; c.ignored = !v;
        L.render();
      } },
      h('option', { value: '' }, 'Não importar'),
      Planilha.FIELDS.map(function (f) { return h('option', { value: f[0] }, f[1]); }));
    sel.value = c.field || '';
    return h('div', { class: 'col', style: { gap: '8px', padding: '12px', borderRadius: 'var(--r-group)', background: 'var(--panel)', boxShadow: unknown ? 'inset 0 0 0 1px var(--warn)' : null } },
      h('div', { class: 'hi semi ell', style: { fontSize: '15px' } }, c.name),
      c.samples.length ? h('div', { class: 'muted small ell' }, 'Ex.: ' + c.samples.join(' · ')) : null,
      unknown ? h('div', { class: 'small', style: { color: 'var(--warn)' } }, 'Não reconheci esta coluna. Se não escolher, ela fica de fora.') : null,
      sel);
  }
  function columnsStep(m) {
    var hasTitle = m.cols.some(function (c) { return c.field === 'title'; });
    return h('div', { class: 'screen', style: { paddingBottom: '120px', gap: '10px' } },
      U.topRow('O que é cada coluna?', m.file, null, function () { if (m.items) { m.step = 'list'; L.render(); } else { Imp = null; L.back(); } }),
      U.body('A primeira linha da tabela precisa ter os títulos. Confira o que cada coluna traz antes de continuar.', 'var(--muted)', 13),
      m.cols.map(function (c) { return columnCard(m, c); }),
      h('div', { class: 'bulkbar' },
        U.btn(hasTitle ? 'Continuar' : 'Escolha a coluna do nome da música', 'ArrowRight', function () {
          if (!buildItems(m)) L.toast('Não encontrei músicas com essa coluna de nome. Confira a escolha.');
          L.render();
        }, { full: true, tall: true, disabled: !hasTitle })));
  }
  function importRow(it, i) {
    var free = it.status === 'new', on = free && !!Imp.sel[i], r = it.row;
    var info = [r.artist, r.musical_key ? 'Tom ' + r.musical_key : null, r.bpm ? r.bpm + ' BPM' : null].filter(Boolean).join(' · ');
    var has = [r.version_url ? 'Vídeo' : null, r.lyrics || r.lyrics_url ? 'Letra' : null, r.chart_url ? 'Cifra' : null, r.audio_url ? 'Áudio' : null, r.tags ? r.tags.join(', ') : null].filter(Boolean).join(' · ');
    return h('div', { class: 'bulkrow' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': String(on), 'aria-disabled': String(!free), tabindex: free ? '0' : '-1', style: free ? null : { opacity: 0.55 },
      onclick: function () { if (!free || Imp.busy) return; if (on) delete Imp.sel[i]; else Imp.sel[i] = true; L.render(); },
      onkeydown: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.click(); } } },
      h('span', { class: 'chk' }, on ? ic('Check', 15) : null),
      h('div', { class: 'grow col', style: { gap: '2px', minWidth: 0 } },
        h('div', { class: 'hi semi ell', style: { fontSize: '15px' } }, r.song_title),
        h('div', { class: 'muted small ell' }, info || ' '),
        has ? h('div', { class: 'muted small ell' }, has) : null,
        !free ? h('div', { class: 'small semi' }, it.status === 'dup' ? 'Já está no repertório' : 'Repetida na planilha') : null,
        it.warnings.map(function (w) { return h('div', { class: 'small', style: { color: 'var(--warn)' } }, w); })));
  }
  L.screen('songimport', function () {
    if (!Imp) { setTimeout(function () { L.back(); }, 0); return h('div', { class: 'screen' }); }
    if (Imp.step === 'cols') return columnsStep(Imp);
    var m = Imp, count = function (st) { return m.items.filter(function (x) { return x.status === st; }).length; };
    var nw = count('new'), dup = count('dup'), rep = count('repeat'), chosen = Object.keys(m.sel).length, warned = m.items.filter(function (x) { return x.status === 'new' && x.warnings.length; }).length;
    var parts = [L.plural(nw, 'música nova', 'músicas novas'), dup ? dup + ' já no repertório' : null, rep ? L.plural(rep, 'repetida', 'repetidas') + ' na planilha' : null, warned ? L.plural(warned, 'com aviso', 'com aviso') : null].filter(Boolean);
    var allOn = nw && chosen === nw;
    return h('div', { class: 'screen', style: { paddingBottom: '120px', gap: '10px' } },
      U.topRow('Importar músicas', m.file, null, function () { if (!m.busy) { Imp = null; L.back(); } }),
      U.body(parts.join(' · '), 'var(--hi)', 14),
      U.body('Toque em uma música para deixar de fora. Depois, é só abrir a música e editar.', 'var(--muted)', 13),
      h('div', { class: 'row' }, h('button', { class: 'textbtn', style: { fontSize: '14px' }, disabled: m.busy, onclick: function () { m.step = 'cols'; L.render(); } }, 'Ajustar colunas'), h('span', { class: 'grow' }),
        nw ? h('button', { class: 'textbtn', style: { fontSize: '14px' }, disabled: m.busy, onclick: function () {
          m.sel = {}; if (!allOn) m.items.forEach(function (x, i) { if (x.status === 'new') m.sel[i] = true; }); L.render();
        } }, allOn ? 'Tirar todas' : 'Escolher todas') : null),
      m.items.map(importRow),
      h('div', { class: 'bulkbar' },
        m.progress ? [U.body(m.progress[0], null, 13), h('div', { class: 'loading-bar' }, h('i', { style: { width: Math.round(m.progress[1] * 100) + '%' } }))]
          : U.btn(chosen ? 'Importar ' + L.plural(chosen, 'música', 'músicas') : 'Nenhuma música escolhida', 'Check', runImport, { full: true, tall: true, disabled: !chosen })));
  });
  async function runImport() {
    var m = Imp;
    if (!m || m.busy) return;
    m.busy = true; m.progress = ['Conferindo o repertório…', 0]; L.render();
    var done = 0;
    try {
      await D.reloadSongs();   // alguém pode ter adicionado música enquanto a lista estava aberta
      var todo = Planilha.classify(Object.keys(m.sel).map(function (i) { return m.items[i]; }), S.projects).filter(function (x) { return x.status === 'new'; });
      var org = S.current.org.id, me = L.uid(), STEP = 50;
      for (var i = 0; i < todo.length; i += STEP) {
        L.must(await sb.from('projects').insert(todo.slice(i, i + STEP).map(function (x) { return Object.assign({ org_id: org, created_by: me }, x.row); })));
        done += Math.min(STEP, todo.length - i);
        m.progress = ['Importando ' + done + ' de ' + todo.length + '…', done / todo.length]; L.render();
      }
      await D.reloadSongs();
      Imp = null;
      L.toast(done ? L.plural(done, 'música adicionada', 'músicas adicionadas') + ' ao repertório.' : 'Essas músicas já estavam no repertório.');
      L.back();
    } catch (x) {
      await D.reloadSongs().catch(function () {});
      m.items = Planilha.classify(m.items.map(function (it) { return { line: it.line, warnings: it.warnings, row: it.row }; }), S.projects);
      m.sel = {}; m.items.forEach(function (it, n) { if (it.status === 'new') m.sel[n] = true; });
      m.busy = false; m.progress = null; L.render();
      L.toast((done ? done + ' entraram, mas o resto não. ' : 'Não deu para importar. ') + L.errorText(x) + ' Toque em Importar para tentar de novo.');
    }
  }
  function exportSheet() {
    if (!S.projects.length) { L.toast('O repertório ainda está vazio.'); return; }
    var bytes = Planilha.writeXlsx(Planilha.exportRows(S.projects));
    var type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    var name = 'Repertorio_' + L.norm(S.current.org.name).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + L.today() + '.xlsx';
    if (window.navigator.standalone === true && window.File && navigator.canShare) {   // no iPhone instalado, baixar não funciona
      var file = new File([bytes], name, { type: type });
      if (navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Repertório' }).catch(function () {}); return; }
    }
    var a = h('a', { href: URL.createObjectURL(new Blob([bytes], { type: type })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    L.toast(L.plural(S.projects.length, 'música exportada', 'músicas exportadas') + '.');
  }

  // ------------------------------------------------------------------ Adicionar / editar música
  var SIGS = ['4/4', '3/4', '6/8', '2/4', '12/8'];
  var Ed = null;
  L.screen('songedit', function (r) {
    var p = r.id ? L.project(r.id) : null;
    if (!Ed || Ed.id !== (r.id || null)) {
      Ed = { id: r.id || null, title: p ? p.song_title : '', artist: p ? p.artist || '' : '', link: p ? p.version_url || '' : '', key: p ? p.musical_key || '' : '',
        bandKey: p ? p.band_key || '' : '', bpm: p && p.bpm ? String(p.bpm) : '', sig: p ? p.time_signature || '' : '', chart: p ? p.chart_url || '' : '',
        note: p ? p.leader_note || '' : '', lyrics: p ? p.lyrics || '' : '', album: p ? p.album || '' : '', tags: p && p.tags ? p.tags.join(', ') : '', lyricsUrl: p ? p.lyrics_url || '' : '', audio: p ? p.audio_url || '' : '', cover: null, coverUrl: null, stems: [], tracks: null, cloud: null, hidden: {}, prev: null, busy: false, progress: null, taps: [] };
      if (p) loadCloud(Ed);
    }
    var e = Ed;
    function linkOk(s) { return !s.trim() || /^https?:\/\/\S+$/i.test(s.trim()); }
    var bpmN = parseInt(e.bpm, 10);
    function linksOk() { return linkOk(e.link) && linkOk(e.chart) && linkOk(e.lyricsUrl) && linkOk(e.audio); }
    var valid = e.title.trim() && linksOk() && (!e.bpm || (bpmN >= 20 && bpmN <= 300));
    var preview = Object.assign({ id: p ? p.id : 'nova', song_title: e.title || '?', version_url: e.link }, p ? { cover_path: p.cover_path } : {});
    var coverEl = e.coverUrl ? h('span', { class: 'cover', style: { width: '120px', height: '120px', borderRadius: '6px' } }, h('img', { src: e.coverUrl, alt: '' })) : U.cover(preview, 120, 6, 52);
    var saveBtn = U.btn(e.busy ? 'Salvando…' : p ? 'Salvar' : 'Adicionar ao repertório', 'Check', save, { full: true, tall: true, disabled: !valid || e.busy });
    function setVal(k) { return function (v) { e[k] = v; var bn = parseInt(e.bpm, 10); saveBtn.disabled = e.busy || !(e.title.trim() && linksOk() && (!e.bpm || (bn >= 20 && bn <= 300))); }; }

    var cloudList = e.cloud ? cloudVisible(e).map(function (t) { return cloudRow(e, p, t); }) : [];
    var stemsList = h('div', { class: 'col' }, e.stems.map(function (f, i) {
      return h('div', { class: 'row' }, ic('FileAudio', 16, 'muted'), h('span', { class: 'grow ell small' }, f.name), h('span', { class: 'muted small' }, L.bytes(f.size)),
        U.iconBtn('X', 'Tirar', function () { e.stems.splice(i, 1); L.render(); }, { color: 'var(--muted)', disabled: e.busy }));
    }));
    return h('div', { class: 'screen' },
      U.topRow(p ? 'Editar música' : 'Adicionar música', null, null, function () { if (!e.busy) { dropEd(); L.back(); } }),
      h('div', { class: 'row', style: { gap: '14px' } }, coverEl, h('div', { class: 'col' },
        U.btn2('Escolher capa', 'Camera', function () {
          U.pickSquareJpeg(600).then(function (b) { if (b) { e.cover = b; e.coverUrl = URL.createObjectURL(b); L.render(); } }).catch(function (x) { L.toast(L.errorText(x)); });
        }),
        U.body(!e.cover && !(p && p.cover_path) ? 'Sem capa, usamos a imagem do vídeo do link (YouTube).' : 'Capa escolhida.', 'var(--muted)', 12))),
      !p ? U.btn2('Buscar no YouTube', 'Search', function () { ytSearch(e); }, { full: true }) : null,
      U.field(e.title, 'Nome da música *', setVal('title'), { max: 80 }),
      U.field(e.artist, 'Artista / ministério', setVal('artist'), { max: 120 }),
      U.field(e.album, 'Álbum (opcional)', setVal('album'), { max: 200 }),
      U.field(e.tags, 'Classificações, separadas por vírgula (ex.: Louvor, Santa Ceia)', setVal('tags'), { max: 400 }),
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
      U.field(e.chart, 'Link da cifra (opcional)', setVal('chart'), { type: 'url', inputmode: 'url', max: 500 }),
      U.field(e.lyricsUrl, 'Link da letra (opcional)', setVal('lyricsUrl'), { type: 'url', inputmode: 'url', max: 500 }),
      U.field(e.audio, 'Link do áudio: Spotify, Deezer… (opcional)', setVal('audio'), { type: 'url', inputmode: 'url', max: 500 }),
      U.field(e.note, 'Recado para a banda (opcional)', setVal('note'), { multiline: true, rows: 2, max: 500 }),
      U.field(e.lyrics, 'Letra (opcional). Use [Verso], [Refrão]… para as partes', setVal('lyrics'), { multiline: true, rows: 6, max: 20000 }),
      U.panel('Multitrack (opcional)', 'AudioWaveform',
        e.cloud && cloudVisible(e).length ? h('div', { class: 'row' }, U.neon('AudioWaveform', true, ''), h('span', { class: 'hi' }, L.plural(cloudVisible(e).length, 'faixa na nuvem', 'faixas na nuvem'))) : null,
        cloudList.length ? h('div', { class: 'col', style: { gap: '6px' } }, cloudList) : null,
        U.body(cloudList.length ? 'Toque em ⋯ numa faixa para renomear, trocar o arquivo ou apagar só ela. Dá para acrescentar mais (mesma taxa e duração das que já estão).' : 'Sem multitrack a música fica só com link, tom e BPM. Para ensaiar, envie as faixas separadas (até 24): MP3, M4A, WAV ou FLAC. O que não for MP3 de bitrate constante é convertido no aparelho.', 'var(--muted)', 12),
        dropZone(e, stemsList)),
      e.progress ? [U.body(e.progress[0], null, 13), h('div', { class: 'loading-bar' }, h('i', { style: { width: Math.round(e.progress[1] * 100) + '%' } }))] : null,
      saveBtn,
      p ? h('button', { class: 'textbtn', style: { color: 'var(--bad)', width: '100%' }, disabled: e.busy, onclick: function () {
        L.confirm('Apagar ' + p.song_title + '?', 'A música sai do repertório e das escalas, com as faixas e as gravações dela. Não dá para desfazer.', 'Apagar', function () {
          L.run(async function () { L.must(await sb.from('projects').delete().eq('id', p.id)); Nuvem.emptyTrash(sb); await D.reloadSongs(); await D.reloadServices(); dropEd(); L.toast(p.song_title + ' apagada.'); L.back(); });
        }, true);
      } }, 'Apagar música do repertório') : null);

    async function save() {
      if (e.busy) return;
      var dup = L.findSongDup(e.title, e.artist, p ? p.id : null);
      if (dup) { dupDialog(dup); return; }
      e.busy = true; L.render();
      try {
        var org = S.current.org.id;
        var opt = function (s) { return s.trim() || null; };
        var row = { song_title: e.title.trim(), name: e.title.trim(), artist: opt(e.artist), version_url: (function (v) { v = opt(v); return v && !/^https?:\/\//i.test(v) ? 'https://' + v : v; })(e.link), musical_key: opt(e.key), band_key: opt(e.bandKey),
          bpm: e.bpm ? parseInt(e.bpm, 10) : null, time_signature: e.sig || null, chart_url: opt(e.chart), leader_note: opt(e.note), album: opt(e.album), lyrics_url: opt(e.lyricsUrl), audio_url: opt(e.audio),
          tags: (function () { var t = []; e.tags.split(/[,;]/).forEach(function (x) { x = x.trim().slice(0, 40); if (x && t.indexOf(x) < 0 && t.length < 10) t.push(x); }); return t.length ? t : null; })() };
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
          try { await uploadStems(org, pid, e.stems, p ? cloudVisible(e).length : 0, p, function (t, f) { e.progress = [t, f]; L.render(); }, function (left) { e.stems = left; }); }
          catch (x) {
            await D.reloadSongs();
            if (!p) {   // música nova: ela já existe; segue para a edição dela, onde dá para mandar de novo as faixas que faltam
              var why = L.errorText(x);
              dropEd(); L.toast('A música foi salva, mas a multitrack não: ' + why + ' Escolha de novo as faixas que faltam.'); L.back(); L.go({ name: 'songedit', id: pid });
              return;
            }
            loadCloud(e);
            throw new Error('A música foi salva, mas a multitrack não: ' + L.errorText(x));
          }
        }
        await D.reloadSongs();
        var title = e.title.trim();
        dropEd();
        L.toast(p ? 'Música salva.' : title + ' adicionada ao repertório.');
        L.back();
      } catch (x) {
        L.toast(L.errorText(x));
        if (Ed) { Ed.busy = false; Ed.progress = null; L.render(); }
      }
    }
  });

  /** Confere e envia a multitrack (MP3 CBR), como o painel web: cadastra, envia, o servidor confere, vira faixa. */
  async function uploadStems(org, pid, files, existing, p, say, leftover) {
    if (existing + files.length > 24) throw new Error('O limite é de 24 faixas por música.');
    if (!window.crypto || !crypto.subtle) throw new Error('Este navegador não permite conferir os arquivos. Abra o site por https.');
    // O que não é MP3 CBR (M4A, WAV, FLAC, MP3 de bitrate variável ou em outra taxa) é convertido aqui.
    var prep = await Mp3Encode.prepareStems(files, { sampleRate: p && p.sample_rate && existing ? p.sample_rate : null, say: say });
    var sr = prep.sampleRate;
    var items = prep.items.map(function (it) { return { file: { name: it.name, size: it.size }, blob: it.blob, buf: it.buf, scan: it.scan }; });
    if (!p || !p.session_duration_ms || !existing) {
      var min = Math.min.apply(null, items.map(function (it) { return it.scan.expectedPcmFrames; }));
      L.must(await sb.from('projects').update({ session_duration_ms: Math.max(1, Math.round(min / sr * 1000)), sample_rate: sr }).eq('id', pid));
    }
    var made = [], failed = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      try {
      say('Enviando ' + it.file.name + ' (' + (j + 1) + ' de ' + items.length + ')…', j / items.length);
      var fileId = crypto.randomUUID();
      var key = org + '/' + pid + '/stems/' + fileId + '.mp3';
      var hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', it.buf))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      await Nuvem.uploadAudio(sb, { id: fileId, org_id: org, project_id: pid, object_key: key, size_bytes: it.file.size, checksum_sha256: hash, mime: 'audio/mpeg', uploaded_by: S.user.id }, it.blob);
      made.push(L.must(await sb.from('tracks').insert({ project_id: pid, name: it.file.name.replace(/\.[^.]+$/, '').slice(0, 60), type: 'stem', source_file_id: fileId, sort_order: existing + j }).select('id').single()).id);
      } catch (x) {
        if (!leftover) throw x;
        failed.push({ name: it.file.name, why: L.errorText(x) });
      }
    }
    if (failed.length) {
      // Fica na tela só o que falhou: tocar em Salvar de novo tenta de novo apenas essas.
      leftover(files.filter(function (f) { return failed.some(function (x) { return x.name === f.name; }); }));
      throw new Error(failed.length + (failed.length === 1 ? ' faixa não foi enviada' : ' faixas não foram enviadas') + ' (' + failed.map(function (x) { return x.name; }).join(', ') + '): ' + failed[0].why + ' Toque em Salvar para tentar de novo.');
    }
    say('Pronto!', 1);
    return made;
  }

  // ------------------------------------------------------------------ Faixas já enviadas (editar música)
  var AUDIO_EXT = /\.(mp3|m4a|wav|flac|aif|aiff|ogg)$/i;
  function trimExt(n) { return String(n).replace(/\.[^.]+$/, ''); }
  function cloudVisible(e) { return (e.cloud || []).filter(function (t) { return !e.hidden[t.id]; }); }
  function loadCloud(e) {
    sb.from('tracks').select('id,name,sort_order,source_file:files(id,size_bytes,object_key,bucket)').eq('project_id', e.id).order('sort_order').then(function (res) {
      if (Ed !== e) return;
      e.cloud = Nuvem.mark(res.data || []);
      e.tracks = e.cloud.length;
      L.render();
    });
  }
  function stopPrev(e) { e = e || Ed; if (e && e.prev) { try { e.prev.audio.pause(); } catch (x) { /* já parou */ } e.prev = null; } }
  function dropEd() { stopPrev(); Ed = null; }

  async function preview(e, t) {
    if (e.prev && e.prev.id === t.id) { stopPrev(e); L.render(); return; }
    stopPrev(e);
    try {
      var key = t.source_file && t.source_file.object_key;
      if (!key) throw new Error('Esta faixa não tem arquivo.');
      var s = await Nuvem.signedUrl(sb, key, 3600);
      if (s.error) throw s.error;
      var a = new Audio(s.data.signedUrl);
      a.onended = function () { if (e.prev && e.prev.audio === a) { e.prev = null; if (Ed === e) L.render(); } };
      a.onerror = function () { if (e.prev && e.prev.audio === a) { e.prev = null; L.toast('Não deu para tocar esta faixa.'); if (Ed === e) L.render(); } };
      e.prev = { id: t.id, audio: a };
      await a.play();
      L.render();
    } catch (x) { e.prev = null; L.toast(L.errorText(x)); L.render(); }
  }

  function cloudRow(e, p, t) {
    var playing = e.prev && e.prev.id === t.id;
    var size = t.source_file && t.source_file.size_bytes;
    var more = U.iconBtn('Ellipsis', 'Mais opções da faixa ' + t.name, function (ev) {
      ev.stopPropagation();
      L.menu(more, [
        ['Pencil', 'Renomear', function () { renameTrack(e, t); }],
        ['Replace', 'Trocar o arquivo', function () { pickReplacement(e, p, t); }],
        ['Trash2', 'Apagar só esta faixa', function () { askDeleteTrack(e, t); }]
      ]);
    }, { disabled: e.busy });
    return h('div', { class: 'row trackrow' },
      U.iconBtn(playing ? 'Pause' : 'Play', playing ? 'Parar de ouvir' : 'Ouvir a faixa ' + t.name, function () { preview(e, t); }, { color: playing ? 'var(--accent-text)' : null }),
      h('div', { class: 'grow tn' }, h('div', { class: 'hi semi ell', style: { fontSize: '15px' } }, t.name), size ? h('div', { class: 'muted tiny' }, L.bytes(size)) : null),
      more);
  }

  function askDeleteTrack(e, t) {
    L.confirm('Apagar a faixa “' + t.name + '”?', 'Só esta faixa sai da multitrack. A música e as outras faixas continuam. Você tem alguns segundos para desfazer.', 'Apagar a faixa', function () { deleteTrack(e, t); }, true);
  }
  function deleteTrack(e, t) {
    if (e.prev && e.prev.id === t.id) stopPrev(e);
    e.hidden[t.id] = true;
    if (Ed === e) L.render();
    var timer = setTimeout(async function () {
      try {
        L.must(await sb.rpc('delete_track', { _track: t.id }));
        e.cloud = (e.cloud || []).filter(function (x) { return x.id !== t.id; });
        delete e.hidden[t.id];
        e.tracks = e.cloud.length;
        Nuvem.emptyTrash(sb);
        await D.reloadSongs();
        if (Ed === e) L.render();
      } catch (x) {
        delete e.hidden[t.id];
        L.toast(L.errorText(x));
        if (Ed === e) L.render();
      }
    }, 6000);
    L.toast('Faixa “' + t.name + '” apagada.', { label: 'Desfazer', ms: 6000, fn: function () { clearTimeout(timer); delete e.hidden[t.id]; if (Ed === e) L.render(); } });
  }

  function renameTrack(e, t) {
    var val = t.name;
    var field = U.field(val, 'Nome da faixa', function (v) { val = v; }, { max: 60 });
    L.dialog({
      title: 'Renomear a faixa',
      body: function () { return field; },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', onclick: function () {
            var name = val.trim().slice(0, 60);
            if (!name || name === t.name) { close(); return; }
            if (e.cloud.some(function (x) { return x.id !== t.id && L.norm(x.name) === L.norm(name); })) { L.toast('Já existe uma faixa com este nome.'); return; }
            close();
            L.run(async function () {
              L.must(await sb.from('tracks').update({ name: name }).eq('id', t.id));
              t.name = name;
              await D.reloadSongs();
              L.toast('Faixa renomeada.');
              if (Ed === e) L.render();
            });
          } }, 'Salvar')];
      }
    });
  }

  function pickReplacement(e, p, t) {
    var inp = h('input', { type: 'file', accept: '.mp3,.m4a,.wav,.flac,.aif,.aiff,.ogg,audio/*', style: { display: 'none' } });
    inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) replaceTrack(e, p, t, f); };
    document.body.appendChild(inp); inp.click();
  }
  /** Envia o arquivo novo, passa o nome e o lugar da faixa velha para ele e só então apaga a velha. Se algo falhar, a velha fica. */
  async function replaceTrack(e, p, t, file) {
    if (e.busy) return;
    e.busy = true; e.progress = ['Preparando ' + file.name + '…', 0]; L.render();
    try {
      var org = S.current.org.id;
      var made = await uploadStems(org, p.id, [file], cloudVisible(e).length, p, function (txt, f) { e.progress = [txt, f]; if (Ed === e) L.render(); });
      var fresh = made && made[0];
      if (!fresh) throw new Error('O arquivo novo não foi enviado.');
      L.must(await sb.from('tracks').update({ name: t.name, sort_order: t.sort_order }).eq('id', fresh));
      L.must(await sb.rpc('delete_track', { _track: t.id }));
      Nuvem.emptyTrash(sb);
      await D.reloadSongs();
      loadCloud(e);
      L.toast('Arquivo da faixa “' + t.name + '” trocado.');
    } catch (x) { L.toast(L.errorText(x)); }
    e.busy = false; e.progress = null;
    if (Ed === e) L.render();
  }

  /** Aceita arquivos escolhidos ou soltos: tira o que não é áudio, repetido ou passa de 12. */
  function addStems(e, list) {
    var files = Array.prototype.slice.call(list || []);
    var notAudio = files.filter(function (f) { return !AUDIO_EXT.test(f.name) && !/^audio\//.test(f.type); });
    files = files.filter(function (f) { return notAudio.indexOf(f) < 0; });
    var msgs = [];
    if (notAudio.length) msgs.push(notAudio.length === 1 ? '“' + notAudio[0].name + '” não é um arquivo de áudio.' : notAudio.length + ' arquivos não eram de áudio.');
    files.forEach(function (f) {
      var base = L.norm(trimExt(f.name));
      if (e.stems.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
      if ((e.cloud || []).some(function (t) { return L.norm(t.name) === base && !e.hidden[t.id]; })) { msgs.push('Já existe uma faixa chamada “' + trimExt(f.name) + '”. Para trocar o arquivo dela, toque em ⋯ › Trocar o arquivo.'); return; }
      if (cloudVisible(e).length + e.stems.length >= 24) { if (msgs.indexOf('O limite é de 24 faixas por música.') < 0) msgs.push('O limite é de 24 faixas por música.'); return; }
      e.stems.push(f);
    });
    if (msgs.length) L.toast(msgs[0]);
    L.render();
  }

  /** Quadro que aceita arquivos arrastados (no computador) e traz o botão de escolher. */
  function dropZone(e, stemsList) {
    var depth = 0;
    var zone = h('div', { class: 'dropzone' });
    function has(ev) { var t = ev.dataTransfer && ev.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; }
    zone.addEventListener('dragenter', function (ev) { if (!has(ev) || e.busy) return; ev.preventDefault(); depth++; zone.classList.add('dragging'); });
    zone.addEventListener('dragover', function (ev) { if (!has(ev) || e.busy) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', function (ev) { if (!has(ev)) return; depth = Math.max(0, depth - 1); if (!depth) zone.classList.remove('dragging'); });
    zone.addEventListener('drop', function (ev) {
      if (!has(ev)) return;
      ev.preventDefault(); depth = 0; zone.classList.remove('dragging');
      if (!e.busy) addStems(e, ev.dataTransfer.files);
    });
    L.fill(zone,
      stemsList,
      U.btn2(e.stems.length ? 'Escolher mais faixas' : 'Escolher as faixas', 'Upload', function () {
        var inp = h('input', { type: 'file', accept: '.mp3,.m4a,.wav,.flac,.aif,.aiff,.ogg,audio/*', multiple: true, style: { display: 'none' } });
        inp.onchange = function () { addStems(e, inp.files); inp.remove(); };
        document.body.appendChild(inp); inp.click();
      }, { full: true, disabled: e.busy }),
      h('div', { class: 'drophint' }, 'ou arraste os arquivos para cá'));
    return zone;
  }
})();
