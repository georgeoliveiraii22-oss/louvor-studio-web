// Louvor Studio — Estúdio (web), em formato de DAW com barra de ferramentas.
//
// Todo integrante abre o estúdio para ouvir: tocar, loop, mudo, solo e volume master.
// Quem tem permissão de editar o áudio (líder ou liberado) também usa as ferramentas:
// Mover, Aparar e Fade, a grade, desfazer/refazer, o volume de cada faixa e "Publicar".
//
// Edição não destrutiva: os ajustes vão para `audio_edits`; o arquivo original nunca muda.
// Mudo, solo, loop e volume master servem só para ouvir aqui e não são salvos.
// A prévia toca no navegador com Web Audio; o alinhamento exato da reprodução é o do app.
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }
  var M = window.EditMath;

  var HEAD_W = 232;
  var ROW_H = 72;
  var ZOOMS = [1, 2, 4, 8, 16];
  var PEAKS = 6000;
  var CLIP_COLORS = ['#E9A863', '#6CC4B0', '#9BA7EC', '#E384AE', '#B7D46B', '#7DBAE4', '#DCC65F', '#C59DE3'];
  var TAKE_COLOR = '#FF6B73';
  var TOOLS = [
    { id: 'move', label: 'Mover', key: 'v', hint: 'Mover (V): arraste o bloco para atrasar ou adiantar a faixa. As pontas cortam e os cantos de cima fazem fade.' },
    { id: 'trim', label: 'Aparar', key: 't', hint: 'Aparar (T): clique ou arraste dentro do bloco; a metade esquerda corta o início e a direita, o fim.' },
    { id: 'fade', label: 'Fade', key: 'f', hint: 'Fade (F): clique ou arraste dentro do bloco; a metade esquerda faz o fade in e a direita, o fade out.' }
  ];
  // "Click" (-1): ímã nos tempos da grade do click; nos outros, arredonda para o passo.
  var SNAPS = [{ ms: -1, label: 'Click' }, { ms: 0, label: 'Livre' }, { ms: 1, label: '1 ms' }, { ms: 10, label: '10 ms' }, { ms: 100, label: '100 ms' }, { ms: 1000, label: '1 s' }];
  var MAGNET_PX = 10;   // distância (na tela) em que o ímã puxa para o tempo
  var G = window.BeatGrid;
  var SEC = window.Sections;

  var st = {
    el: null,
    projectId: null,
    loadedFor: null,
    loading: '',
    tracks: [],
    takes: [],
    edits: {},
    drafts: {},
    log: [],
    buffers: {},
    peaks: {},
    leads: {},         // atraso do codificador MP3 que o navegador deixou no começo, por faixa
    gridRow: null,     // grade salva no banco (beat_grids)
    grid: null,        // grade em uso: { trackId, beats (s, no arquivo do click), downbeats, beatsPerBar, accent, saved }
    gridCache: null,
    gridBusy: false,
    markers: [],       // marcadores de seção (song_markers)
    selMarker: null,   // seção escolhida (id do marcador)
    auto: null,        // sugestão de "Detectar partes": { busy, sections, info, cmp } (só na tela, até o líder aplicar)
    muted: {},
    solo: {},
    zoom: 0,
    tool: 'move',
    snap: 10,
    loop: false,
    loopA: null,
    loopB: null,
    masterDb: 0,
    master: null,
    selKey: null,
    voiceSel: {},      // user_id -> id da tomada escolhida, ou 'off'
    showVoices: false,
    undo: [],
    redo: [],
    faderActive: false,
    ctx: null,
    playing: false,
    t0: 0,
    pos0: 0,
    pos: 0,
    nodes: [],
    raf: 0,
    restartTimer: 0,
    busy: false,
    confirmDiscard: false,
    refs: null
  };

  // ---------------------------------------------------------------------------
  // Faixas e edições
  // ---------------------------------------------------------------------------
  function editable() { return !!A().state().canEdit; }
  // Seções (Intro, Verso...): só o líder marca, move e apaga; todos veem e fazem loop.
  function marksEditable() { return A().state().role === 'leader'; }

  // Todas as faixas e tomadas do projeto (inclusive vozes escondidas na escolha de vozes).
  function allTargets() {
    var list = st.tracks.map(function (t, i) {
      return { key: 'track:' + t.id, kind: 'track', id: t.id, label: t.name, objectKey: t.source_file && t.source_file.object_key, row: t, color: CLIP_COLORS[i % CLIP_COLORS.length] };
    });
    st.takes.forEach(function (t) {
      list.push({ key: 'take:' + t.id, kind: 'take', id: t.id, label: A().nameOf(t.user_id) + ' · ' + t.name, objectKey: t.file && t.file.object_key, row: t, color: TAKE_COLOR });
    });
    return list;
  }

  // O que aparece e toca: a base inteira e, de cada cantor, só a tomada escolhida em "Vozes".
  function targets() {
    return allTargets().filter(function (t) {
      return t.kind === 'track' || st.voiceSel[t.row.user_id] === t.id;
    });
  }

  function target(key) {
    return allTargets().find(function (x) { return x.key === key; }) || null;
  }

  // ---------------------------------------------------------------------------
  // Vozes: qual tomada de cada cantor ouvir
  // ---------------------------------------------------------------------------
  function singers() {
    var by = {};
    st.takes.forEach(function (t) { (by[t.user_id] = by[t.user_id] || []).push(t); });
    return Object.keys(by).map(function (uid) { return { userId: uid, name: A().nameOf(uid), takes: by[uid] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  // Tomadas vêm da mais nova para a mais antiga.
  function preferred(takes) {
    return takes.find(function (t) { return t.review_status === 'aprovada'; }) || takes[0] || null;
  }

  function voicesPreset(kind) {
    st.voiceSel = {};
    singers().forEach(function (s) {
      var pick = kind === 'base' ? null
        : kind === 'aprovadas' ? s.takes.find(function (t) { return t.review_status === 'aprovada'; })
        : kind === 'recentes' ? s.takes[0]
        : preferred(s.takes);
      st.voiceSel[s.userId] = pick ? pick.id : 'off';
    });
  }

  function takeLabel(t) {
    var status = t.review_status === 'aprovada' ? 'aprovada' : t.review_status === 'refazer' ? 'refazer' : 'pendente';
    var part = window.VoiceParts && VoiceParts.label(t.voice_part);
    return (part ? part + ' · ' : '') + t.name + ' · ' + status;
  }

  function voicesPanel() {
    var list = singers();
    var presets = h('div', { class: 'lv-group', style: 'border:0;padding-left:0' },
      h('span', { class: 'lv-label' }, 'Atalhos'),
      h('button', { class: 'lv-btn', 'data-hint': 'Ouvir só a base, sem nenhuma voz.', onclick: function () { voicesPreset('base'); paint(); restartSoon(); } }, 'Só a base'),
      h('button', { class: 'lv-btn', 'data-hint': 'De cada cantor, a tomada aprovada (quem não tem aprovada fica desligado).', onclick: function () { voicesPreset('aprovadas'); paint(); restartSoon(); } }, 'Aprovadas'),
      h('button', { class: 'lv-btn', 'data-hint': 'De cada cantor, a tomada mais recente.', onclick: function () { voicesPreset('recentes'); paint(); restartSoon(); } }, 'Mais recentes'));
    if (!list.length) {
      return h('div', { class: 'lv-voices' }, presets,
        h('span', { class: 'lv-label', style: 'text-transform:none' }, 'Ainda não há vozes gravadas que você possa ouvir nesta música. Elas aparecem quando alguém grava pelo app e o líder libera para o ensaio.'));
    }
    return h('div', { class: 'lv-voices' }, presets,
      h('div', { class: 'lv-voice-list' }, list.map(function (s) {
        var sel = h('select', { class: 'lv-select', 'aria-label': 'Tomada de ' + s.name, onchange: function () {
          st.voiceSel[s.userId] = sel.value;
          paint();
          restartSoon();
        } },
          h('option', { value: 'off', selected: st.voiceSel[s.userId] === 'off' }, 'Desligada'),
          s.takes.map(function (t) { return h('option', { value: t.id, selected: st.voiceSel[s.userId] === t.id }, takeLabel(t)); }));
        return h('label', { class: 'lv-voice', 'data-hint': 'Escolha qual tomada de ' + s.name + ' tocar junto com a base (ou desligue a voz).' },
          h('span', { class: 'lv-name' }, s.name), sel);
      })));
  }

  function project() {
    return A().state().projects.find(function (p) { return p.id === st.projectId; }) || null;
  }

  function blank() {
    return { trim_start_ms: 0, trim_end_ms: null, offset_ms: 0, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 };
  }

  // Duração no tempo do app (sem o atraso de MP3 que o navegador possa ter deixado).
  function durationMs(key) {
    var b = st.buffers[key];
    return b ? Math.round((b.duration - (st.leads[key] || 0)) * 1000) : Infinity;
  }

  function draft(key) {
    if (st.drafts[key]) return st.drafts[key];
    return M.clampEdit(st.edits[key] || blank(), durationMs(key));
  }

  function isDirty(key) {
    if (!editable()) return false;
    var saved = st.edits[key];
    if (saved && !saved.published) return true;
    return !M.sameEdit(draft(key), saved ? M.clampEdit(saved, durationMs(key)) : blank());
  }

  function dirtyKeys() {
    return allTargets().map(function (t) { return t.key; }).filter(isDirty);
  }

  function shiftOf(tg, e) {
    if (tg.kind === 'track') return ((tg.row.timeline_offset_ms || 0) + e.offset_ms) / 1000;
    return ((tg.row.start_ms || 0) - (Number(tg.row.rtl_ms) || 0) + (tg.row.offset_ms || 0) + e.offset_ms) / 1000;
  }

  // Trecho do arquivo que toca e onde ele cai na linha do tempo.
  // a, b e dur estão no tempo do app; no buffer do navegador, somar `lead`.
  function region(tg, e) {
    var buf = st.buffers[tg.key];
    var lead = st.leads[tg.key] || 0;
    var bufDur = buf ? buf.duration : 0;
    var dur = buf ? bufDur - lead : 0;
    var a = e.trim_start_ms / 1000;
    var b = e.trim_end_ms === null || e.trim_end_ms === undefined ? dur : e.trim_end_ms / 1000;
    var s = shiftOf(tg, e);
    return { a: a, b: b, shift: s, start: a + s, end: b + s, dur: dur, lead: lead, bufDur: bufDur };
  }

  // ---------------------------------------------------------------------------
  // Grade pelo click
  // ---------------------------------------------------------------------------
  // Tempos da grade na linha do tempo (acompanham o deslocamento da faixa de click).
  function gridBeats() {
    var g = st.grid;
    if (!g) return null;
    var key = 'track:' + g.trackId;
    var tg = target(key);
    if (!tg) return null;
    var shift = shiftOf(tg, draft(key));
    if (st.gridCache && st.gridCache.g === g && st.gridCache.shift === shift) return st.gridCache.beats;
    var beats = g.beats.map(function (b) { return b + shift; });
    st.gridCache = { g: g, shift: shift, beats: beats };
    return beats;
  }

  function magnetOn(ev) {
    return st.snap === -1 && !!gridBeats() && !(ev && ev.altKey);
  }

  // Ímã: se t (segundos na linha do tempo) estiver perto de um tempo, devolve o tempo.
  function magnet(t, ev) {
    if (!magnetOn(ev)) return null;
    return G.snap(gridBeats(), t, MAGNET_PX / pps());
  }

  function useGridFromRow() {
    var row = st.gridRow;
    var ok = row && st.tracks.some(function (t) { return t.id === row.track_id; });
    st.grid = ok ? G.fromRow(row) : null;
    st.gridCache = null;
  }

  function detectGrid(trackId, auto) {
    var key = 'track:' + trackId;
    var buf = st.buffers[key];
    var tr = st.tracks.find(function (t) { return t.id === trackId; });
    if (!buf || !tr) return;
    var chans = [];
    for (var c = 0; c < (buf.numberOfChannels || 1); c++) chans.push(buf.getChannelData(c));
    var res = G.detect(chans, buf.sampleRate || 44100);
    var lead = st.leads[key] || 0;
    st.gridCache = null;
    if (res.beats.length < 4) {
      st.grid = null;
      A().flash(auto ? 'info' : 'err', (auto ? 'A faixa "' + tr.name + '" parece ser o click, mas ' : '') +
        'não achei os tics do click em "' + tr.name + '"' + (res.beats.length ? ' (só ' + res.beats.length + ')' : '') +
        '. Confira se é a faixa certa no campo "Faixa do click". Se for, me mande esse arquivo para eu ajustar o detector.');
      return;
    }
    st.grid = {
      trackId: trackId,
      beats: res.beats.map(function (b) { return Math.max(0, b - lead); }),
      downbeats: res.downbeats, beatsPerBar: res.beatsPerBar, accent: res.accent, saved: false
    };
    if (st.snap !== -1 && editable()) st.snap = -1;
    if (editable()) saveGrid(auto);
    else if (!auto) A().flash('info', 'Grade montada só para você ver. Quem edita o áudio salva a grade para a banda.');
  }

  function gridSummary(g) {
    if (!g) return '';
    var s = g.beats.length + ' tempos';
    if (g.beatsPerBar) s += ' · compasso de ' + g.beatsPerBar + (g.accent === 'tom' ? ' (tic agudo no 1)' : ' (tic forte no 1)');
    else s += ' · compasso não identificado';
    return s;
  }

  function saveGrid(auto) {
    var sb = A().client();
    var g = st.grid;
    var pid = st.projectId;
    var q = g ? sb.from('beat_grids').upsert(G.toRow(pid, g.trackId, g), { onConflict: 'project_id' })
      : sb.from('beat_grids').delete().eq('project_id', pid);
    st.gridBusy = true;
    return q.then(function (res) {
      st.gridBusy = false;
      if (res && res.error) throw res.error;
      if (st.projectId !== pid) return;
      st.gridRow = g ? G.toRow(pid, g.trackId, g) : null;
      if (g) g.saved = true;
      A().flash('ok', g ? 'Grade do click salva para a banda: ' + gridSummary(g) + '.' : 'Grade removida.');
      A().rerender();
    }).catch(function (e) {
      st.gridBusy = false;
      A().flash('err', A().friendly(e));
      A().rerender();
    });
  }

  function chooseClick(value) {
    if (value === 'none') {
      st.grid = null;
      st.gridCache = null;
      if (st.snap === -1) st.snap = 10;
      if (editable() && st.gridRow) saveGrid(false);
      A().rerender();
      return;
    }
    detectGrid(value, false);
    A().rerender();
  }

  function sessionEnd() {
    var p = project();
    return p ? p.session_duration_ms / 1000 : 0;
  }

  function laneWidth() {
    var w = (st.el && st.el.clientWidth) || 1200;
    return Math.max(320, w - HEAD_W - 2) * ZOOMS[st.zoom];
  }

  function pps() {
    return laneWidth() / Math.max(1, sessionEnd());
  }

  function anySolo() {
    return Object.keys(st.solo).some(function (k) { return st.solo[k]; });
  }

  function audible(key) {
    if (st.muted[key]) return false;
    return !anySolo() || !!st.solo[key];
  }

  function snapMs(v) {
    return st.snap > 0 ? Math.round(v / st.snap) * st.snap : Math.round(v);
  }

  function loopValid() {
    return st.loopA !== null && st.loopB !== null && st.loopB - st.loopA >= 0.25;
  }

  // ---------------------------------------------------------------------------
  // Desfazer / refazer
  // ---------------------------------------------------------------------------
  function snapshot() { return JSON.stringify(st.drafts); }

  function pushUndo() {
    st.undo.push(snapshot());
    if (st.undo.length > 100) st.undo.shift();
    st.redo = [];
  }

  function undo() {
    if (!st.undo.length) return;
    st.redo.push(snapshot());
    st.drafts = JSON.parse(st.undo.pop());
    relayoutAll();
  }

  function redo() {
    if (!st.redo.length) return;
    st.undo.push(snapshot());
    st.drafts = JSON.parse(st.redo.pop());
    relayoutAll();
  }

  function relayoutAll() {
    targets().forEach(function (t) { layoutRow(t.key); });
    layoutGrid();
    refreshChrome();
    restartSoon();
  }

  // ---------------------------------------------------------------------------
  // Carregamento
  // ---------------------------------------------------------------------------
  function audioCtx() {
    if (!st.ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      st.ctx = new Ctx();
    }
    return st.ctx;
  }

  function decode(key, objectKey) {
    if (st.buffers[key] || !objectKey) return Promise.resolve();
    return Nuvem.signedUrl(A().client(), objectKey, 3600).then(function (res) {
      if (res.error) throw res.error;
      return fetch(res.data.signedUrl);
    }).then(function (r) {
      if (!r.ok) throw new Error('Falha ao baixar o áudio (' + r.status + ').');
      return r.arrayBuffer();
    }).then(function (buf) {
      // Lê o cabeçalho do MP3 antes de decodificar (a decodificação consome o buffer).
      var scan = null;
      try { scan = window.Mp3Scan ? Mp3Scan.scanMp3(new Uint8Array(buf)) : null; } catch (e) { scan = null; }
      return new Promise(function (resolve, reject) {
        audioCtx().decodeAudioData(buf, resolve, function () { reject(new Error('O navegador não conseguiu ler este áudio.')); });
      }).then(function (audio) { return { audio: audio, scan: scan }; });
    }).then(function (r) {
      st.buffers[key] = r.audio;
      st.leads[key] = G.decoderLead(r.scan, r.audio.duration);
      st.peaks[key] = computePeaks(r.audio, PEAKS);
    });
  }

  function computePeaks(audio, n) {
    var data = audio.getChannelData(0);
    var step = Math.max(1, Math.floor(data.length / n));
    var out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var max = 0;
      var start = i * step;
      var end = Math.min(data.length, start + step);
      for (var j = start; j < end; j += 2) {
        var v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      out[i] = max;
    }
    return out;
  }

  function loadMeta() {
    var sb = A().client();
    var pid = st.projectId;
    var queries = [
      sb.from('tracks').select('id,name,gain,timeline_offset_ms,sort_order,source_file:files(id,object_key,bucket)').eq('project_id', pid).order('sort_order'),
      sb.from('takes').select('*,file:files(id,object_key,bucket)').eq('project_id', pid).order('created_at', { ascending: false }),
      sb.from('audio_edits').select('*').eq('project_id', pid),
      sb.from('beat_grids').select('*').eq('project_id', pid),
      sb.from('song_markers').select('*').eq('project_id', pid).order('at_ms')
    ];
    if (editable()) queries.push(sb.from('edit_log').select('*').eq('project_id', pid).order('created_at', { ascending: false }).limit(15));
    return Promise.all(queries).then(function (r) {
      var must = A().must;
      st.tracks = Nuvem.mark(must(r[0]));
      st.takes = Nuvem.mark(must(r[1]));
      st.edits = {};
      must(r[2]).forEach(function (e) {
        st.edits[e.take_id ? 'take:' + e.take_id : 'track:' + e.track_id] = e;
      });
      // Sem a migração 0006 a tabela não existe: o estúdio segue sem grade.
      st.gridRow = r[3] && !r[3].error && r[3].data && r[3].data.length ? r[3].data[0] : null;
      // Idem para os marcadores (migração 0007).
      st.markers = r[4] && !r[4].error && r[4].data ? r[4].data.slice() : [];
      if (st.selMarker && !st.markers.some(function (m) { return m.id === st.selMarker; })) st.selMarker = null;
      st.log = r[5] ? must(r[5]) : [];
    });
  }

  function load() {
    stop();
    st.loadedFor = st.projectId;
    st.buffers = {};
    st.peaks = {};
    st.leads = {};
    st.grid = null;
    st.gridRow = null;
    st.gridCache = null;
    st.markers = [];
    st.selMarker = null;
    st.auto = null;
    st.drafts = {};
    st.muted = {};
    st.solo = {};
    st.undo = [];
    st.redo = [];
    st.selKey = null;
    st.loop = false;
    st.loopA = null;
    st.loopB = null;
    st.pos = 0;
    st.loading = 'Carregando o projeto…';
    paint();
    loadMeta().then(function () {
      voicesPreset('padrao');
      var all = allTargets();
      var done = 0;
      st.loading = 'Baixando o áudio: 0 de ' + all.length;
      paint();
      return all.reduce(function (chain, t) {
        return chain.then(function () { return decode(t.key, t.objectKey); }).then(function () {
          done += 1;
          st.loading = 'Baixando o áudio: ' + done + ' de ' + all.length;
          paint();
        });
      }, Promise.resolve());
    }).then(function () {
      st.loading = '';
      // Grade: a salva no banco; sem ela, tenta achar a faixa de click pelo nome.
      useGridFromRow();
      if (!st.grid) {
        var guess = G.guessClickTrack(st.tracks);
        if (guess) detectGrid(guess.id, true);
      }
      if (st.grid && editable()) st.snap = -1;
      else if (st.snap === -1) st.snap = 10;
      A().rerender(); // redesenha e mostra o aviso da grade, se houver
      if (st.autoplay) { st.autoplay = false; play(); }
    }).catch(function (e) {
      st.loading = '';
      st.autoplay = false;
      A().flash('err', A().friendly(e));
      A().rerender();
    });
  }

  // ---------------------------------------------------------------------------
  // Reprodução
  // ---------------------------------------------------------------------------
  function masterNode() {
    var ctx = audioCtx();
    if (!st.master) {
      st.master = ctx.createGain();
      st.master.connect(ctx.destination);
    }
    st.master.gain.value = Math.pow(10, st.masterDb / 20);
    return st.master;
  }

  function scheduleOne(tg, P, when, out, until) {
    var buf = st.buffers[tg.key];
    if (!buf) return;
    var e = draft(tg.key);
    var r = region(tg, e);
    // No buffer do navegador, o tempo do app está `lead` adiante (atraso do MP3 não removido).
    var plan = M.playPlan(P, r.a + r.lead, r.b + r.lead, r.shift - r.lead, buf.duration, until);
    if (!plan) return;

    var ctx = st.ctx;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    src.connect(g);
    g.connect(out);

    var baseGain = tg.kind === 'track' ? (Number(tg.row.gain) || 1) : 1;
    var fi = e.fade_in_ms / 1000;
    var fo = e.fade_out_ms / 1000;
    var fullEnd = r.end;
    function at(t) { return when + (t - P); }
    function env(t) { return baseGain * M.envelopeAt(t, r.start, fullEnd, e.gain_db, fi, fo); }

    var t1 = Math.max(P, plan.regionStart);
    g.gain.setValueAtTime(env(t1), at(t1));
    if (fi > 0 && t1 < r.start + fi) g.gain.linearRampToValueAtTime(env(r.start + fi), at(r.start + fi));
    if (fo > 0 && fullEnd - fo < plan.regionEnd) {
      var foStart = Math.max(t1, fullEnd - fo);
      g.gain.setValueAtTime(env(foStart), at(foStart));
      g.gain.linearRampToValueAtTime(env(plan.regionEnd), at(plan.regionEnd));
    }
    // Cortes no meio (feitos no app): silêncio nesses trechos, com uma rampa curtinha.
    M.cutWindows(e.cuts, r.shift, t1, plan.regionEnd).forEach(function (w) {
      g.gain.setValueAtTime(env(w[0]), at(w[0]));
      g.gain.linearRampToValueAtTime(0, at(w[0]) + 0.006);
      g.gain.setValueAtTime(0, at(w[1]));
      g.gain.linearRampToValueAtTime(env(w[1]), at(w[1]) + 0.006);
    });
    src.start(when + plan.startDelay, plan.bufferOffset, plan.duration);
    st.nodes.push(src);
  }

  function play() {
    var ctx = audioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    stopNodes();
    var until = st.loop && loopValid() ? st.loopB : sessionEnd();
    var P = st.pos;
    if (st.loop && loopValid() && (P < st.loopA || P >= st.loopB)) P = st.loopA;
    if (P >= until) P = 0;
    var when = ctx.currentTime + 0.06;
    var out = masterNode();
    targets().forEach(function (t) { if (audible(t.key)) scheduleOne(t, P, when, out, until); });
    st.playing = true;
    st.t0 = when;
    st.pos0 = P;
    st.pos = P;
    if (st.raf) cancelAnimationFrame(st.raf);
    tick();
    refreshChrome();
  }

  function stopNodes() {
    st.nodes.forEach(function (n) { try { n.stop(); } catch (e) { /* já parou */ } });
    st.nodes = [];
  }

  function stop() {
    stopNodes();
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.playing = false;
  }

  function tick() {
    if (!st.playing) return;
    st.pos = Math.max(st.pos0, st.pos0 + (st.ctx.currentTime - st.t0));
    if (st.loop && loopValid() && st.pos >= st.loopB) {
      st.pos = st.loopA;
      play();
      return;
    }
    if (st.pos >= sessionEnd()) {
      stop();
      st.pos = 0;
      refreshChrome();
      return;
    }
    movePlayhead();
    st.raf = requestAnimationFrame(tick);
  }

  function restartSoon() {
    if (!st.playing) return;
    clearTimeout(st.restartTimer);
    st.restartTimer = setTimeout(function () { if (st.playing) play(); }, 110);
  }

  function togglePlay() {
    if (st.playing) { stop(); refreshChrome(); } else play();
  }

  function seek(seconds) {
    st.pos = Math.max(0, Math.min(sessionEnd(), seconds));
    if (st.playing) play(); else { movePlayhead(); refreshChrome(); }
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  function fmtClock(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2).replace('.', ',');
  }

  function movePlayhead() {
    var r = st.refs;
    if (!r) return;
    if (r.playhead) r.playhead.style.left = (st.pos * pps()) + 'px';
    if (r.clock) r.clock.textContent = fmtClock(st.pos);
  }

  function drawClip(key) {
    var row = st.refs && st.refs.rows[key];
    var tg = target(key);
    if (!row || !tg) return;
    var c = row.canvas;
    var peaks = st.peaks[key];
    var e = draft(key);
    var r = region(tg, e);
    var w = Math.max(1, Math.round((r.b - r.a) * pps()));
    var hgt = ROW_H - 2 - 16;
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(hgt * dpr);
    c.style.width = w + 'px';
    c.style.height = hgt + 'px';
    var g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    if (!peaks || !r.bufDur) return;

    var n = peaks.length;
    var i0 = Math.floor(((r.a + r.lead) / r.bufDur) * n);
    var i1 = Math.ceil(((r.b + r.lead) / r.bufDur) * n);
    var mid = hgt / 2;
    g.fillStyle = 'rgba(20,20,20,.62)';
    for (var x = 0; x < w; x++) {
      var i = Math.min(n - 1, Math.floor(i0 + (x / w) * (i1 - i0)));
      var t = r.start + (x / w) * (r.end - r.start);
      var env = M.envelopeAt(t, r.start, r.end, e.gain_db, e.fade_in_ms / 1000, e.fade_out_ms / 1000);
      var amp = Math.min(1, peaks[i] * env);
      var bh = Math.max(1, amp * (hgt - 4));
      g.fillRect(x, mid - bh / 2, 1, bh);
    }

    g.strokeStyle = 'rgba(20,20,20,.9)';
    g.lineWidth = 1.5;
    var fi = (e.fade_in_ms / 1000) * pps();
    var fo = (e.fade_out_ms / 1000) * pps();
    if (fi > 0) { g.beginPath(); g.moveTo(0, hgt); g.lineTo(fi, 0); g.stroke(); }
    if (fo > 0) { g.beginPath(); g.moveTo(w - fo, 0); g.lineTo(w, hgt); g.stroke(); }
  }

  function describe(e) {
    var parts = [];
    if (e.offset_ms) parts.push((e.offset_ms > 0 ? '+' : '') + e.offset_ms + ' ms');
    if (e.gain_db) parts.push((e.gain_db > 0 ? '+' : '') + Number(e.gain_db).toFixed(1).replace('.', ',') + ' dB');
    if (e.trim_start_ms || e.trim_end_ms !== null) parts.push('aparada');
    if (e.fade_in_ms || e.fade_out_ms) parts.push('fade');
    return parts.join(' · ');
  }

  function dbText(v) {
    return (v > 0 ? '+' : '') + Number(v).toFixed(1).replace('.', ',') + ' dB';
  }

  function layoutRow(key) {
    var row = st.refs && st.refs.rows[key];
    var tg = target(key);
    if (!row || !tg) return;
    var e = draft(key);
    var r = region(tg, e);
    var p = pps();
    row.clip.style.left = (r.start * p) + 'px';
    row.clip.style.width = Math.max(4, (r.b - r.a) * p) + 'px';
    row.clip.classList.toggle('sel', st.selKey === key);
    if (row.fadeIn) row.fadeIn.style.left = Math.max(0, (e.fade_in_ms / 1000) * p - 5) + 'px';
    if (row.fadeOut) row.fadeOut.style.right = Math.max(0, (e.fade_out_ms / 1000) * p - 5) + 'px';
    if (row.vol) row.vol.value = e.gain_db;
    row.volLabel.textContent = dbText(e.gain_db);
    row.dirty.style.visibility = isDirty(key) ? 'visible' : 'hidden';
    row.info.textContent = describe(e);
    row.lane.classList.toggle('off', !audible(key));
    row.act.classList.toggle('on', !st.muted[key]);
    row.act.setAttribute('aria-pressed', st.muted[key] ? 'false' : 'true');
    row.solo.classList.toggle('on', !!st.solo[key]);
    row.solo.setAttribute('aria-pressed', st.solo[key] ? 'true' : 'false');
    drawClip(key);
  }

  function refreshChrome() {
    var r = st.refs;
    if (!r) return;
    r.play.classList.toggle('on', st.playing);
    r.play.setAttribute('aria-label', st.playing ? 'Parar' : 'Tocar');
    r.play.innerHTML = '';
    playContent().forEach(function (n) { r.play.appendChild(n); });
    r.loopBtn.classList.toggle('on', st.loop);
    r.loopBtn.setAttribute('aria-pressed', st.loop ? 'true' : 'false');
    if (r.loopBrace) {
      var show = loopValid();
      r.loopBrace.style.display = show ? 'block' : 'none';
      if (show) {
        r.loopBrace.style.left = (st.loopA * pps()) + 'px';
        r.loopBrace.style.width = ((st.loopB - st.loopA) * pps()) + 'px';
        r.loopBrace.classList.toggle('on', st.loop);
      }
    }
    if (editable()) {
      var n = dirtyKeys().length;
      r.publishLabel.textContent = n ? 'Publicar (' + n + ')' : 'Publicado';
      r.publish.disabled = st.busy || n === 0;
      if (r.discard) r.discard.disabled = st.busy || n === 0;
      r.undoBtn.disabled = !st.undo.length;
      r.redoBtn.disabled = !st.redo.length;
      r.toolBtns.forEach(function (b) {
        var on = b.getAttribute('data-tool') === st.tool;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var toolHint = TOOLS.find(function (t) { return t.id === st.tool; }).hint;
      Object.keys(r.rows).forEach(function (k) {
        var c = r.rows[k].clip;
        c.classList.remove('tool-move', 'tool-trim', 'tool-fade');
        c.classList.add('tool-' + st.tool);
        c.setAttribute('data-hint', toolHint);
      });
    }
    movePlayhead();
  }

  // ---------------------------------------------------------------------------
  // Edição com o mouse e o teclado
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Seções (marcadores na régua): navegar, loop e, para quem edita, marcar
  // ---------------------------------------------------------------------------
  function sections() { return SEC.build(st.markers, sessionEnd()); }

  function section(id) { return sections().find(function (s) { return s.id === id; }) || null; }

  // Atualiza só a faixa de seções e a barra da seção (sem redesenhar o estúdio: mantém a rolagem).
  function refreshSections(focusName) {
    layoutSections();
    renderSecBar(focusName);
    renderAutoBar();
  }

  function selectSection(id, seekTo) {
    st.selMarker = id;
    var s = section(id);
    if (s && seekTo) seek(s.start);
    refreshSections(false);
  }

  function loopSection(id) {
    var s = section(id);
    if (!s || s.end - s.start < 0.25) return;
    st.selMarker = id;
    st.loopA = s.start;
    st.loopB = s.end;
    st.loop = true;
    if (!st.playing || st.pos < s.start || st.pos >= s.end) st.pos = s.start;
    refreshSections(false);
    play();
  }

  function jumpSection(dir) {
    var list = sections();
    var i = dir < 0 ? SEC.prevStart(list, st.pos) : SEC.nextStart(list, st.pos);
    if (i === null || i < 0) return;
    selectSection(list[i].id, true);
  }

  // Ímã das seções: gruda na grade do click (o início do compasso puxa de mais longe). Alt solta.
  function snapSec(t, ev) {
    if (!magnetOn(ev)) return t;
    var s = SEC.snapEdge(gridBeats(), st.grid.downbeats, t, MAGNET_PX / pps());
    return s === null ? t : s;
  }

  function markerFail(e) {
    A().flash('err', A().friendly(e));
    A().rerender();
  }

  function marker(id) { return st.markers.find(function (x) { return x.id === id; }) || null; }

  // Cria uma seção de `start` a `end` (segundos). Sem `end`: 8 compassos (ou 15 s) sem invadir a próxima.
  function createSection(start, end) {
    if (!editable()) return;
    var list = sections();
    var total = sessionEnd();
    start = Math.max(0, Math.min(total - SEC.MIN_LEN, start));
    var room = SEC.freeAround(list, start, total, null);
    if (start < room.lo) start = room.lo;
    if (room.hi - start < SEC.MIN_LEN) {
      A().flash('info', 'Não há espaço livre aqui para uma seção nova. Diminua ou mova a seção vizinha.');
      A().rerender();
      return;
    }
    if (end === undefined || end === null) end = SEC.defaultEnd(list, start, total, gridBeats(), st.grid ? st.grid.downbeats : null);
    end = Math.max(start + SEC.MIN_LEN, Math.min(end, room.hi));
    var row = { project_id: st.projectId, at_ms: Math.round(start * 1000), end_ms: Math.round(end * 1000), name: SEC.suggestName(list, start) };
    A().client().from('song_markers').insert(row).select().single().then(function (res) {
      if (res.error) throw res.error;
      st.markers.push(res.data);
      st.selMarker = res.data.id;
      refreshSections(true);
    }).catch(markerFail);
  }

  // Tecla M / botão "+ Seção": seção nova a partir do cursor (com ímã no compasso).
  // Com o cursor no meio de uma seção, ela é dividida ali: a nova vai do cursor até o fim dela.
  function addMarker() {
    if (!marksEditable()) return;
    var t = snapSec(st.pos, null);
    var list = sections();
    var i = SEC.containing(list, t);
    if (i < 0) { createSection(t, null); return; }
    var cur = list[i];
    var m = marker(cur.id);
    if (!m || t - cur.start < SEC.MIN_LEN || cur.end - t < SEC.MIN_LEN) {
      A().flash('info', 'Leve o cursor para onde a nova seção começa (pelo menos meio segundo depois do início da seção atual).');
      A().rerender();
      return;
    }
    var old = { at_ms: m.at_ms, end_ms: m.end_ms };
    var end = cur.end;
    m.end_ms = Math.round(t * 1000);
    refreshSections(false);
    saveRange(cur.id, old);
    createSection(t, end);
  }

  function renameMarker(id, name) {
    var m = marker(id);
    name = String(name || '').trim().slice(0, 40);
    if (!m || !name || name === m.name) { renderSecBar(false); return; }
    var old = m.name;
    m.name = name;
    refreshSections(false);
    A().client().from('song_markers').update({ name: name }).eq('id', id).then(function (res) {
      if (res.error) throw res.error;
    }).catch(function (e) { m.name = old; refreshSections(false); markerFail(e); });
  }

  // Salva início e fim de uma seção (desfaz na tela se o banco recusar).
  function saveRange(id, old) {
    var m = marker(id);
    if (!m) return;
    A().client().from('song_markers').update({ at_ms: m.at_ms, end_ms: m.end_ms }).eq('id', id).then(function (res) {
      if (res.error) throw res.error;
    }).catch(function (e) {
      m.at_ms = old.at_ms;
      m.end_ms = old.end_ms;
      refreshSections(false);
      markerFail(e);
    });
  }

  // Muda início/fim de uma seção pelo cursor (botões da barra da seção).
  function setEdgeAtCursor(id, edge) {
    var s = section(id);
    var m = marker(id);
    if (!s || !m) return;
    var t = snapSec(st.pos, null);
    var r = SEC.clampRange(sections(), id, edge === 'start' ? t : s.start, edge === 'end' ? t : s.end, sessionEnd(), edge);
    var old = { at_ms: m.at_ms, end_ms: m.end_ms };
    m.at_ms = Math.round(r.start * 1000);
    m.end_ms = Math.round(r.end * 1000);
    refreshSections(false);
    saveRange(id, old);
  }

  function deleteMarker(id) {
    var keep = st.markers;
    st.markers = st.markers.filter(function (m) { return m.id !== id; });
    st.selMarker = null;
    refreshSections(false);
    A().client().from('song_markers').delete().eq('id', id).then(function (res) {
      if (res.error) throw res.error;
    }).catch(function (e) { st.markers = keep; refreshSections(false); markerFail(e); });
  }

  // ---------------------------------------------------------------------------
  // Detectar partes (autoparts.js): sugestão que o líder revisa antes de aplicar
  // ---------------------------------------------------------------------------
  // As faixas da base (sem as tomadas dos cantores) já no tempo da linha do tempo, só o trecho que toca.
  function autoStems() {
    return allTargets().filter(function (tg) { return tg.kind === 'track' && st.buffers[tg.key]; }).map(function (tg) {
      var buf = st.buffers[tg.key];
      var rg = region(tg, draft(tg.key));
      var len = buf.getChannelData(0).length;
      var sr = buf.sampleRate || len / buf.duration;
      var a = Math.max(0, Math.round((rg.a + rg.lead) * sr)), b = Math.min(len, Math.round((rg.b + rg.lead) * sr));
      var data = new Float32Array(Math.max(0, b - a));
      var chans = Math.max(1, Math.min(2, buf.numberOfChannels || 1));
      for (var c = 0; c < chans; c++) {
        var ch = buf.getChannelData(c);
        for (var i = 0; i < data.length; i++) data[i] += ch[a + i] / chans;
      }
      return { name: tg.label, data: data, sr: sr, start: rg.start };
    }).filter(function (s) { return s.data.length > 0; });
  }

  function detectParts() {
    if (!marksEditable() || (st.auto && st.auto.busy)) return;
    var stems = autoStems();
    if (!stems.length) {
      A().flash('info', 'Espere as faixas carregarem para detectar as partes.');
      A().rerender();
      return;
    }
    st.auto = { busy: true };
    A().rerender();
    // Deixa a tela mostrar "Analisando…" antes da conta (leva alguns segundos numa música longa).
    setTimeout(function () {
      try {
        var beats = gridBeats();
        var grid = beats ? { beats: beats, downbeats: st.grid.downbeats } : null;
        var p = project();
        var res = window.AutoParts.analyze({ stems: stems, duration: sessionEnd(), grid: grid, lyrics: p && p.lyrics });
        var mine = sections();
        st.auto = { busy: false, sections: res.sections, info: res.info,
          cmp: mine.length ? window.AutoParts.compare(res.sections, mine, grid ? 1.0 : 2.0) : null };
        if (!res.sections.length) {
          st.auto = null;
          A().flash('info', 'Não deu para achar as partes desta música (curta demais ou sem som).');
        }
      } catch (e) {
        st.auto = null;
        A().flash('err', 'Não foi possível analisar a música: ' + ((e && e.message) || e));
      }
      A().rerender();
    }, 30);
  }

  // mode 'fill': só onde não há seção; 'replace': apaga as atuais (depois de confirmar) e usa a sugestão.
  function applyAuto(mode) {
    if (!marksEditable() || !st.auto || !st.auto.sections) return;
    var mine = sections();
    var list = mode === 'replace' ? st.auto.sections : window.AutoParts.gaps(st.auto.sections, mine);
    if (!list.length) {
      A().flash('info', 'Não sobrou espaço livre: todas as partes da música já estão marcadas. Use "Substituir as atuais" se quiser trocar.');
      A().rerender();
      return;
    }
    if (mode === 'replace' && mine.length &&
        !window.confirm('Apagar as ' + mine.length + ' seções marcadas agora e usar as ' + list.length + ' sugeridas?\nDepois dá para ajustar cada uma à mão.')) return;
    var sb = A().client();
    var rows = list.map(function (s) {
      return { project_id: st.projectId, at_ms: Math.round(s.start * 1000), end_ms: Math.round(s.end * 1000), name: s.name };
    });
    var del = mode === 'replace' && mine.length
      ? sb.from('song_markers').delete().eq('project_id', st.projectId).then(function (res) { if (res.error) throw res.error; })
      : Promise.resolve();
    st.auto.busy = true;
    renderAutoBar();
    del.then(function () {
      if (mode === 'replace') st.markers = [];
      return sb.from('song_markers').insert(rows).select();
    }).then(function (res) {
      if (res.error) throw res.error;
      st.markers = st.markers.concat(res.data || []);
      st.auto = null;
      st.selMarker = null;
      A().flash('ok', rows.length === 1 ? '1 seção adicionada.' : rows.length + ' seções adicionadas. Ajuste o que precisar na faixa de seções.');
      A().rerender();
    }).catch(function (e) {
      if (st.auto) st.auto.busy = false;
      // Recarrega para mostrar o que ficou salvo de verdade.
      sb.from('song_markers').select('*').eq('project_id', st.projectId).order('at_ms').then(function (res) {
        if (!res.error && res.data) st.markers = res.data.slice();
        markerFail(e);
      });
    });
  }

  // Barra da sugestão: um mapa da música com as partes sugeridas e os botões para aplicar.
  function renderAutoBar() {
    var bar = st.refs && st.refs.autoBar;
    if (!bar) return;
    bar.innerHTML = '';
    var au = st.auto;
    var show = !!(au && au.sections && marksEditable());
    bar.style.display = show ? 'flex' : 'none';
    if (!show) return;
    var total = Math.max(1, sessionEnd());
    var mine = sections();
    var free = window.AutoParts.gaps(au.sections, mine);
    var info = au.info || {};
    var head = h('div', { class: 'lv-auto-head' },
      h('span', { class: 'lv-auto-title' }, Icons.icon('autoParts', 14), 'Partes sugeridas'),
      h('span', { class: 'lv-auto-note' }, (au.sections.length === 1 ? '1 parte' : au.sections.length + ' partes') +
        (info.gridded ? ', nos compassos do click' : ', sem grade do click (bordas aproximadas)') +
        (info.lyrics ? ', nomes pela letra' : '') +
        (info.guideCues ? ', com os avisos da guia' : '') +
        (info.vocalStem ? '' : '. Sem faixa de voz, os nomes são palpites') + '.'),
      au.cmp ? h('span', { class: 'lv-auto-note', 'data-hint': 'Comparação com as seções que você já marcou: quantas bordas e quantos nomes coincidem.' },
        'Bate com as suas: ' + au.cmp.bordersHit + ' de ' + au.cmp.bordersManual + ' bordas, ' + au.cmp.namesHit + ' de ' + au.cmp.namesChecked + ' nomes.') : null);
    var map = h('div', { class: 'lv-auto-map' }, au.sections.map(function (s) {
      var when = fmtClock(s.start) + ' – ' + fmtClock(s.end);
      return h('button', {
        class: 'lv-auto-part' + (s.conf < 0.6 ? ' unsure' : ''),
        style: 'left:' + (s.start / total * 100).toFixed(3) + '%;width:' + ((s.end - s.start) / total * 100).toFixed(3) + '%;--sec:' + SEC.colorFor(s.name),
        title: s.name + ' · ' + when,
        'data-hint': s.name + ' (' + when + '): clique para ouvir daqui.' + (s.conf < 0.6 ? ' Borda menos certa: confira.' : ''),
        onclick: function () { st.pos = s.start; play(); }
      }, h('span', null, s.name));
    }));
    var acts = h('div', { class: 'lv-auto-acts' });
    if (!mine.length) {
      acts.appendChild(btn([Icons.icon('check', 13), 'Usar estas partes'], 'Cria as seções sugeridas. Depois dá para mover, renomear e apagar cada uma.',
        function () { applyAuto('fill'); }, { class: 'lv-btn on', disabled: !!au.busy }));
    } else {
      acts.appendChild(btn([Icons.icon('check', 13), 'Preencher só onde não há parte'],
        free.length ? 'Cria ' + free.length + ' seções só nos espaços vazios. As que você marcou ficam como estão.' : 'Todas as partes já estão marcadas: não há espaço vazio.',
        function () { applyAuto('fill'); }, { class: 'lv-btn on', disabled: !!au.busy || !free.length }));
      acts.appendChild(btn('Substituir as atuais', 'Apaga as ' + mine.length + ' seções marcadas e usa a sugestão (pede confirmação).',
        function () { applyAuto('replace'); }, { disabled: !!au.busy }));
    }
    acts.appendChild(btn('Descartar', 'Fecha a sugestão sem mudar nada.', function () { st.auto = null; renderAutoBar(); }, { disabled: !!au.busy }));
    bar.appendChild(head);
    bar.appendChild(map);
    bar.appendChild(acts);
  }

  // Arrastar uma seção: pelo meio move (mantém o tamanho); pelas pontas muda o início ou o fim.
  // Tudo gruda na grade do click e nunca invade a seção vizinha.
  function dragSection(ev, id, mode) {
    if (!marksEditable() || (ev.button !== undefined && ev.button !== 0)) return;
    ev.preventDefault();
    ev.stopPropagation();
    var s0 = section(id);
    var m = marker(id);
    if (!s0 || !m) return;
    var p = pps();
    var total = sessionEnd();
    var startX = ev.clientX;
    var old = { at_ms: m.at_ms, end_ms: m.end_ms };
    var moved = false;
    if (st.selMarker !== id) { st.selMarker = id; refreshSections(false); }
    function move(e) {
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      var dt = dx / p;
      var a = s0.start;
      var b = s0.end;
      if (mode === 'move') {
        a = s0.start + dt;
        b = s0.end + dt;
        // Gruda a ponta que estiver mais perto de um tempo.
        var sa = snapSec(a, e) - a;
        var sb = snapSec(b, e) - b;
        var d = Math.abs(sa) > 1e-9 && (Math.abs(sb) < 1e-9 || Math.abs(sa) <= Math.abs(sb)) ? sa : sb;
        a += d;
        b += d;
      } else if (mode === 'start') a = snapSec(Math.max(0, s0.start + dt), e);
      else b = snapSec(Math.min(total, s0.end + dt), e);
      var r = SEC.clampRange(sections(), id, a, b, total, mode);
      m.at_ms = Math.round(r.start * 1000);
      m.end_ms = Math.round(r.end * 1000);
      layoutSections();
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        st.sectionDragged = true; // o "click" que vem depois não deve pular o cursor
        if (m.at_ms !== old.at_ms || m.end_ms !== old.end_ms) saveRange(id, old);
      }
      refreshSections(false);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Arrastar no espaço vazio da faixa de seções cria uma seção daquele tamanho.
  function dragCreate(ev) {
    if (!marksEditable() || ev.target !== st.refs.sections || (ev.button !== undefined && ev.button !== 0)) return;
    ev.preventDefault();
    var rect = st.refs.sections.getBoundingClientRect();
    var p = pps();
    var total = sessionEnd();
    var t0 = snapSec(Math.max(0, Math.min(total, (ev.clientX - rect.left) / p)), ev);
    var room = SEC.freeAround(sections(), t0, total, null);
    var t1 = t0;
    var ghost = null;
    function move(e) {
      t1 = snapSec(Math.max(room.lo, Math.min(room.hi, (e.clientX - rect.left) / p)), e);
      if (!ghost) {
        ghost = h('div', { class: 'lv-sec ghost' });
        st.refs.sections.appendChild(ghost);
      }
      var a = Math.min(t0, t1);
      ghost.style.left = (a * p).toFixed(1) + 'px';
      ghost.style.width = Math.max(2, Math.abs(t1 - t0) * p).toFixed(1) + 'px';
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (ghost) ghost.remove();
      if (Math.abs(t1 - t0) >= SEC.MIN_LEN) createSection(Math.min(t0, t1), Math.max(t0, t1));
      else if (st.selMarker) { st.selMarker = null; refreshSections(false); }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function layoutSections() {
    var r = st.refs;
    if (!r || !r.sections) return;
    var p = pps();
    var list = sections();
    var canEdit = marksEditable();
    r.sections.innerHTML = '';
    r.sections.classList.toggle('editable', canEdit);
    list.forEach(function (s) {
      var block = h('div', {
        class: 'lv-sec' + (s.id === st.selMarker ? ' sel' : '') + (canEdit ? ' editable' : ''),
        style: 'left:' + (s.start * p).toFixed(1) + 'px;width:' + Math.max(3, (s.end - s.start) * p).toFixed(1) + 'px;--sec:' + s.color,
        title: s.name + ' · ' + fmtClock(s.start) + ' – ' + fmtClock(s.end),
        'data-hint': s.name + ': clique para ir ao início; dois cliques fazem loop.' +
          (canEdit ? ' Arraste pelo meio para mover e pelas pontas para mudar o tamanho (gruda no click; Alt solta).' : '')
      }, h('span', { class: 'lv-sec-name' }, s.name));
      if (canEdit) {
        var gl = h('i', { class: 'lv-sec-grip l', 'aria-hidden': 'true' });
        var gr = h('i', { class: 'lv-sec-grip r', 'aria-hidden': 'true' });
        gl.addEventListener('pointerdown', function (ev) { dragSection(ev, s.id, 'start'); });
        gr.addEventListener('pointerdown', function (ev) { dragSection(ev, s.id, 'end'); });
        block.appendChild(gl);
        block.appendChild(gr);
        block.addEventListener('pointerdown', function (ev) { if (ev.target === block || ev.target.classList.contains('lv-sec-name')) dragSection(ev, s.id, 'move'); });
      }
      block.addEventListener('click', function (ev) {
        if (st.sectionDragged) { st.sectionDragged = false; return; }
        if (ev.detail < 2) selectSection(s.id, true);
      });
      block.addEventListener('dblclick', function () { loopSection(s.id); });
      r.sections.appendChild(block);
    });
    if (r.gotoSel) {
      r.gotoSel.innerHTML = '';
      r.gotoSel.appendChild(h('option', { value: '' }, list.length ? 'Ir para…' : 'Sem seções'));
      list.forEach(function (s, i) { r.gotoSel.appendChild(h('option', { value: s.id }, (i + 1) + '. ' + s.name + ' (' + fmtClock(s.start).replace(/,\d+$/, '') + ')')); });
      r.gotoSel.value = '';
      r.gotoSel.disabled = !list.length;
    }
  }

  // Barra da seção escolhida: nome (com sugestões), início/fim no cursor, loop, tocar e apagar.
  function renderSecBar(focusName) {
    var bar = st.refs && st.refs.secBar;
    if (!bar) return;
    bar.innerHTML = '';
    var s = section(st.selMarker);
    bar.style.display = s ? 'flex' : 'none';
    if (!s) return;
    var input = null;
    var canEdit = marksEditable();
    bar.appendChild(h('i', { class: 'lv-sec-dot', style: 'background:' + s.color }));
    if (canEdit) {
      input = h('input', { class: 'lv-input', value: s.name, maxlength: 40, 'aria-label': 'Nome da seção',
        'data-hint': 'Nome da seção (Enter salva).',
        onchange: function () { renameMarker(s.id, input.value); },
        onkeydown: function (ev) { if (ev.key === 'Enter') input.blur(); if (ev.key === 'Escape') { input.value = s.name; input.blur(); } } });
      bar.appendChild(input);
      bar.appendChild(h('div', { class: 'lv-chips', role: 'group', 'aria-label': 'Nomes sugeridos' }, SEC.QUICK_NAMES.map(function (n) {
        return h('button', { class: 'lv-btn mini', 'data-hint': 'Chamar esta seção de "' + n + '".', onclick: function () { renameMarker(s.id, n); } }, n);
      })));
    } else {
      bar.appendChild(h('span', { class: 'lv-sec-title' }, s.name));
    }
    var len = s.end - s.start;
    bar.appendChild(h('span', { class: 'lv-num', style: 'min-width:0' }, fmtClock(s.start) + ' – ' + fmtClock(s.end) + ' (' + len.toFixed(1).replace('.', ',') + ' s)'));
    if (canEdit) {
      bar.appendChild(btn('Início no cursor', 'Começar esta seção onde está o cursor (gruda no click).', function () { setEdgeAtCursor(s.id, 'start'); }));
      bar.appendChild(btn('Fim no cursor', 'Terminar esta seção onde está o cursor (gruda no click).', function () { setEdgeAtCursor(s.id, 'end'); }));
    }
    bar.appendChild(btn([Icons.icon('loop', 13), 'Loop'], 'Repetir esta seção (dois cliques na seção também).', function () { loopSection(s.id); },
      { class: 'lv-btn' + (st.loop && st.loopA === s.start && st.loopB === s.end ? ' on' : '') }));
    bar.appendChild(btn([Icons.icon('play', 13, 'ic-fill'), 'Tocar daqui'], 'Tocar a partir do início desta seção.', function () {
      st.pos = s.start;
      play();
    }));
    if (canEdit) bar.appendChild(iconBtn('trash', 'Apagar seção', 'Apagar esta seção (Delete).', function () { deleteMarker(s.id); }));
    bar.appendChild(h('span', { class: 'lv-spacer' }));
    bar.appendChild(iconBtn('discard', 'Fechar', 'Fechar a barra da seção.', function () { st.selMarker = null; refreshSections(false); }));
    if (focusName && input) { input.focus(); input.select(); }
  }

  function setDraft(key, patch) {
    st.drafts[key] = M.clampEdit(Object.assign({}, draft(key), patch), durationMs(key));
    layoutRow(key);
    if (st.grid && key === 'track:' + st.grid.trackId) layoutGrid(); // a grade anda com o click
  }

  function select(key) {
    var prev = st.selKey;
    st.selKey = key;
    if (prev && prev !== key) layoutRow(prev);
    if (key) layoutRow(key);
  }

  function clipTimeAt(key, clientX) {
    var row = st.refs.rows[key];
    var rect = row.lane.getBoundingClientRect();
    return (clientX - rect.left) / pps();
  }

  // Ímã para um ponto da faixa `key` que cai em t (linha do tempo). A própria faixa de click
  // não gruda na grade dela mesma (a grade anda junto com ela).
  function snapAt(key, t, ev) {
    if (st.grid && key === 'track:' + st.grid.trackId) return t;
    var s = magnet(t, ev);
    return s === null ? t : s;
  }

  // Mover: gruda o início ou o fim do bloco (o que estiver mais perto de um tempo).
  function snapMove(key, orig, offMs, ev) {
    if (!magnetOn(ev) || (st.grid && key === 'track:' + st.grid.trackId)) return snapMs(offMs);
    var tg = target(key);
    var r = region(tg, Object.assign({}, orig, { offset_ms: offMs }));
    var best = null;
    [r.start, r.end].forEach(function (t) {
      var s = magnet(t, ev);
      if (s !== null && (best === null || Math.abs(s - t) < Math.abs(best))) best = s - t;
    });
    return Math.round(offMs + (best === null ? 0 : best * 1000));
  }

  function startDrag(ev, key, mode) {
    if (ev.button !== undefined && ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    select(key);
    if (!editable()) return;

    var tg = target(key);
    var dur = durationMs(key);
    var p = pps();

    // Ferramentas Aparar e Fade: o clique já aplica o ponto e o arrasto continua dali.
    if (mode === 'tool') {
      var e0 = draft(key);
      var r0 = region(tg, e0);
      var t = clipTimeAt(key, ev.clientX);
      var leftHalf = t < (r0.start + r0.end) / 2;
      t = snapAt(key, t, ev);
      pushUndo();
      if (st.tool === 'trim') {
        mode = leftHalf ? 'trimL' : 'trimR';
        var fileMs = snapMs((t - r0.shift) * 1000);
        setDraft(key, leftHalf ? { trim_start_ms: fileMs } : { trim_end_ms: fileMs });
      } else if (st.tool === 'fade') {
        mode = leftHalf ? 'fadeIn' : 'fadeOut';
        setDraft(key, leftHalf ? { fade_in_ms: snapMs((t - r0.start) * 1000) } : { fade_out_ms: snapMs((r0.end - t) * 1000) });
      } else {
        mode = 'move';
      }
    } else {
      pushUndo();
    }

    var startX = ev.clientX;
    var orig = Object.assign({}, draft(key));
    var moved = false;
    var row = st.refs.rows[key];
    if (row) row.clip.classList.add('dragging');

    function move(e) {
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 1) moved = true;
      var dms = (dx / p) * 1000;
      var r = region(tg, orig);
      var patch;
      // Com a grade do click, cada ponto gruda no tempo mais perto; nos outros modos, arredonda.
      function edge(ms, toTime, fromTime) {
        if (!magnetOn(e)) return snapMs(ms);
        return Math.round(fromTime(snapAt(key, toTime(ms), e)));
      }
      if (mode === 'move') patch = { offset_ms: snapMove(key, orig, orig.offset_ms + dms, e) };
      else if (mode === 'trimL') {
        patch = { trim_start_ms: edge(orig.trim_start_ms + dms, function (ms) { return ms / 1000 + r.shift; }, function (t) { return (t - r.shift) * 1000; }) };
      } else if (mode === 'trimR') {
        patch = { trim_end_ms: edge((orig.trim_end_ms === null ? dur : orig.trim_end_ms) + dms, function (ms) { return ms / 1000 + r.shift; }, function (t) { return (t - r.shift) * 1000; }) };
      } else if (mode === 'fadeIn') {
        patch = { fade_in_ms: edge(orig.fade_in_ms + dms, function (ms) { return r.start + ms / 1000; }, function (t) { return (t - r.start) * 1000; }) };
      } else {
        patch = { fade_out_ms: edge(orig.fade_out_ms - dms, function (ms) { return r.end - ms / 1000; }, function (t) { return (r.end - t) * 1000; }) };
      }
      setDraft(key, patch);
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (row) row.clip.classList.remove('dragging');
      // Clique simples com Mover não altera nada: não guarda um "desfazer" vazio.
      if (!moved && mode === 'move' && st.undo.length) st.undo.pop();
      refreshChrome();
      restartSoon();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function nudgeSelected(direction, big) {
    if (!editable() || !st.selKey) return;
    var step = (st.snap > 0 ? st.snap : 1) * (big ? 10 : 1);
    pushUndo();
    setDraft(st.selKey, { offset_ms: draft(st.selKey).offset_ms + direction * step });
    refreshChrome();
    restartSoon();
  }

  function onKey(ev) {
    if (!st.el || !st.el.isConnected || st.loading) return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) && ev.target.type !== 'range') return;
    var k = ev.key.toLowerCase();
    var mod = ev.ctrlKey || ev.metaKey;
    if (k === ' ') { ev.preventDefault(); togglePlay(); return; }
    if (k === 'home') { ev.preventDefault(); seek(0); return; }
    if (k === 'l' && !mod) { toggleLoop(); return; }
    if (k === '[' || k === ']') { ev.preventDefault(); jumpSection(k === '[' ? -1 : 1); return; }
    if (marksEditable() && k === 'm' && !mod) { ev.preventDefault(); addMarker(); return; }
    if (marksEditable() && (k === 'delete' || k === 'backspace') && st.selMarker && !mod) { ev.preventDefault(); deleteMarker(st.selMarker); return; }
    if (!editable()) return;
    if (mod && k === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { ev.preventDefault(); redo(); return; }
    if (!mod && (k === 'v' || k === 't' || k === 'f')) {
      st.tool = k === 'v' ? 'move' : k === 't' ? 'trim' : 'fade';
      refreshChrome();
      return;
    }
    if (k === 'arrowleft' || k === 'arrowright') {
      if (!st.selKey) return;
      ev.preventDefault();
      nudgeSelected(k === 'arrowright' ? 1 : -1, ev.shiftKey);
    }
  }
  window.addEventListener('keydown', onKey);

  function toggleLoop() {
    if (!loopValid()) {
      // Sem trecho marcado: o loop vale para a música inteira.
      st.loopA = 0;
      st.loopB = sessionEnd();
    }
    st.loop = !st.loop;
    refreshChrome();
    restartSoon();
  }

  // ---------------------------------------------------------------------------
  // Publicar, descartar
  // ---------------------------------------------------------------------------
  function publishAll() {
    var keys = dirtyKeys();
    if (!keys.length || st.busy) return;
    var sb = A().client();
    st.busy = true;
    refreshChrome();
    keys.reduce(function (chain, key) {
      return chain.then(function () {
        var tg = target(key);
        var saved = st.edits[key];
        var e = M.clampEdit(draft(key), durationMs(key));
        if (M.isNeutral(e)) {
          return saved ? sb.from('audio_edits').delete().eq('id', saved.id).then(check) : null;
        }
        var row = Object.assign({ project_id: st.projectId, published: true }, e);
        // Só manda os cortes quando existem (funciona antes da migração 0014).
        if (!row.cuts.length && !(saved && saved.cuts && saved.cuts.length)) delete row.cuts;
        if (tg.kind === 'take') row.take_id = tg.id; else row.track_id = tg.id;
        return (saved ? sb.from('audio_edits').update(row).eq('id', saved.id) : sb.from('audio_edits').insert(row)).then(check);
      });
    }, Promise.resolve()).then(loadMeta).then(function () {
      st.busy = false;
      st.drafts = {};
      st.undo = [];
      st.redo = [];
      A().flash('ok', keys.length === 1 ? '1 faixa publicada: a equipe já ouve esta versão.' : keys.length + ' faixas publicadas: a equipe já ouve esta versão.');
      A().rerender();
    }).catch(function (e) {
      st.busy = false;
      A().flash('err', A().friendly(e));
      A().rerender();
    });

    function check(res) { if (res && res.error) throw res.error; }
  }

  function discardAll() {
    pushUndo();
    st.drafts = {};
    st.confirmDiscard = false;
    paint();
    restartSoon();
  }

  // ---------------------------------------------------------------------------
  // Tela
  // ---------------------------------------------------------------------------
  function btn(label, hint, onclick, extra) {
    return h('button', Object.assign({ class: 'lv-btn', 'data-hint': hint, onclick: onclick }, extra || {}), label);
  }

  // Botão só com ícone: o nome fica escondido para leitores de tela e aparece como dica.
  function iconBtn(iconKey, name, hint, onclick, extra) {
    return btn([Icons.icon(iconKey, 14), h('span', { class: 'vh' }, name)], hint, onclick,
      Object.assign({ 'aria-label': name, title: name }, extra || {}));
  }

  function playContent() {
    return [Icons.icon(st.playing ? 'stop' : 'play', 14, 'ic-fill'), h('span', { class: 'vh' }, st.playing ? 'Parar' : 'Tocar')];
  }

  function controlBar() {
    var r = st.refs;
    var canEdit = editable();

    r.play = btn(playContent(), 'Tocar / parar (Espaço).', togglePlay, { class: 'lv-btn play', 'aria-label': 'Tocar', title: 'Tocar / parar' });
    r.loopBtn = iconBtn('loop', 'Loop', 'Loop (L): repete o trecho marcado na régua. Arraste na régua para marcar o trecho; sem trecho, repete a música inteira.', toggleLoop);
    r.clock = h('span', { class: 'lv-clock', 'data-hint': 'Posição atual (minutos:segundos).' });

    var transport = h('div', { class: 'lv-group' },
      iconBtn('rewind', 'Voltar ao início', 'Voltar ao início (Home).', function () { seek(0); }),
      r.play,
      r.loopBtn,
      r.clock
    );

    var zoom = h('div', { class: 'lv-group' },
      iconBtn('zoomOut', 'Diminuir zoom', 'Diminuir o zoom.', function () { st.zoom = Math.max(0, st.zoom - 1); paint(); }, { disabled: st.zoom === 0 }),
      h('span', { class: 'lv-label', 'data-hint': 'Zoom da linha do tempo.' }, ZOOMS[st.zoom] + 'x'),
      iconBtn('zoomIn', 'Aumentar zoom', 'Aumentar o zoom.', function () { st.zoom = Math.min(ZOOMS.length - 1, st.zoom + 1); paint(); }, { disabled: st.zoom === ZOOMS.length - 1 })
    );

    var masterLabel = h('span', { class: 'lv-num' }, dbText(st.masterDb));
    var master = h('div', { class: 'lv-group', 'data-hint': 'Volume master: só para você ouvir aqui; não é salvo nem muda o que a equipe ouve.' },
      h('span', { class: 'lv-label', title: 'Volume master' }, Icons.icon('volume', 14)),
      h('input', { type: 'range', min: -30, max: 6, step: 0.5, value: st.masterDb, class: 'lv-range', 'aria-label': 'Volume master',
        oninput: function (ev) {
          st.masterDb = Number(ev.target.value);
          masterLabel.textContent = dbText(st.masterDb);
          if (st.master) st.master.gain.value = Math.pow(10, st.masterDb / 20);
        } }),
      masterLabel
    );

    var groups = [transport];
    groups.push(h('div', { class: 'lv-group' },
      iconBtn('voices', 'Vozes', 'Vozes: escolha qual tomada de cada cantor ouvir junto com a base.', function () { st.showVoices = !st.showVoices; paint(); },
        { class: 'lv-btn' + (st.showVoices ? ' on' : ''), 'aria-pressed': st.showVoices ? 'true' : 'false' })));

    // Grade pelo click: qual faixa é o click (o app sugere pelo nome; dá para trocar).
    var clickSel = h('select', { class: 'lv-select', 'aria-label': 'Faixa do click', disabled: st.gridBusy,
      onchange: function () { chooseClick(clickSel.value); } },
      h('option', { value: 'none', selected: !st.grid }, 'Sem click'),
      st.tracks.map(function (t) { return h('option', { value: t.id, selected: !!st.grid && st.grid.trackId === t.id }, t.name); }));
    var gridHint = 'Grade pelo click: escolha a faixa do click e as linhas caem em cada tic dele, acompanhando o andamento. ' +
      (st.grid ? gridSummary(st.grid) + (st.grid.saved ? ' (salva para a banda).' : ' (só neste navegador).') : 'Sem grade nesta música.');
    var gridGroup = h('div', { class: 'lv-group', 'data-hint': gridHint },
      h('span', { class: 'lv-label', title: 'Grade' }, Icons.icon('grid', 14)), clickSel,
      h('span', { class: 'lv-gridinfo' + (st.grid ? '' : ' off') },
        st.gridBusy ? 'salvando…' : st.grid ? (st.grid.beats.length + ' tempos' + (st.grid.beatsPerBar ? ' · ' + st.grid.beatsPerBar + '/compasso' : '')) : 'escolha a faixa do click'));
    if (canEdit) {
      var snapSel = h('select', { class: 'lv-select', 'aria-label': 'Ímã', onchange: function () { st.snap = Number(snapSel.value); } },
        SNAPS.map(function (s) { return h('option', { value: s.ms, selected: s.ms === st.snap, disabled: s.ms === -1 && !st.grid }, s.label); }));
      gridGroup.appendChild(h('span', { class: 'lv-label', title: 'Ímã',
        'data-hint': 'Ímã: com "Click", mover, cortar e fazer fade grudam no tempo mais perto (segure Alt para soltar). Nos outros, arredonda para o passo. As setas movem o bloco selecionado em 1 ms ou no passo (Shift: dez vezes).' },
        Icons.icon('snap', 14)));
      gridGroup.appendChild(snapSel);
      if (st.grid) {
        gridGroup.appendChild(iconBtn('redetect', 'Detectar de novo', 'Detectar a grade de novo a partir da faixa do click.',
          function () { detectGrid(st.grid.trackId, false); A().rerender(); }, { disabled: st.gridBusy }));
      }
    }
    groups.push(gridGroup);

    // Seções: ir para, anterior/seguinte e (quem edita) marcar no cursor.
    r.gotoSel = h('select', { class: 'lv-select', 'aria-label': 'Ir para a seção', onchange: function () {
      if (r.gotoSel.value) selectSection(r.gotoSel.value, true);
    } });
    var secGroup = h('div', { class: 'lv-group', 'data-hint': 'Seções da música: [ e ] vão para a anterior e a seguinte; dois cliques numa seção da régua fazem loop dela.' },
      h('span', { class: 'lv-label', title: 'Seções' }, Icons.icon('flag', 14)),
      iconBtn('secPrev', 'Seção anterior', 'Seção anterior ([).', function () { jumpSection(-1); }),
      r.gotoSel,
      iconBtn('secNext', 'Próxima seção', 'Próxima seção (]).', function () { jumpSection(1); }));
    if (marksEditable()) {
      secGroup.appendChild(btn([Icons.icon('add', 13), 'Seção'], 'Nova seção a partir do cursor (M). Também dá para arrastar no espaço vazio da faixa de seções. Gruda no click.', addMarker,
        { 'aria-label': 'Adicionar seção' }));
      secGroup.appendChild(btn([Icons.icon('autoParts', 13), st.auto && st.auto.busy ? 'Analisando…' : 'Detectar partes'],
        'Ouve as faixas e sugere as partes (Intro, Verso, Refrão…). Nada muda até você aplicar, e tudo continua editável à mão.', detectParts,
        { 'aria-label': 'Detectar partes automaticamente', disabled: !!(st.auto && st.auto.busy) }));
    }
    groups.push(secGroup);

    if (canEdit) {
      var TOOL_ICONS = { move: 'move', trim: 'trim', fade: 'fade' };
      r.toolBtns = TOOLS.map(function (t) {
        return iconBtn(TOOL_ICONS[t.id], t.label, t.hint, function () { st.tool = t.id; refreshChrome(); }, { 'data-tool': t.id, 'aria-pressed': 'false' });
      });
      groups.push(h('div', { class: 'lv-group', role: 'group', 'aria-label': 'Ferramentas' }, r.toolBtns));

      r.undoBtn = iconBtn('undo', 'Desfazer', 'Desfazer (Ctrl+Z).', undo);
      r.redoBtn = iconBtn('redo', 'Refazer', 'Refazer (Ctrl+Shift+Z).', redo);
      groups.push(h('div', { class: 'lv-group' }, r.undoBtn, r.redoBtn));
    }

    groups.push(zoom, master);
    groups.push(h('span', { class: 'lv-spacer' }));

    if (canEdit) {
      r.publishLabel = h('span', null, 'Publicar');
      r.publish = h('button', { class: 'lv-btn publish', 'data-hint': 'Publicar: salva as alterações de todas as faixas e a equipe passa a ouvir esta versão. A gravação original nunca muda.', onclick: publishAll },
        Icons.icon('publish', 13), r.publishLabel);
      if (st.confirmDiscard) {
        groups.push(h('div', { class: 'lv-group' },
          h('span', { class: 'lv-label', style: 'text-transform:none' }, 'Descartar o que não foi publicado?'),
          btn([Icons.icon('discard', 13), 'Descartar'], 'Confirma o descarte.', discardAll),
          btn('Cancelar', 'Mantém as alterações.', function () { st.confirmDiscard = false; paint(); })));
      } else {
        r.discard = iconBtn('discard', 'Descartar', 'Descartar: volta todas as faixas para a última versão publicada.', function () { st.confirmDiscard = true; paint(); });
        groups.push(h('div', { class: 'lv-group' }, r.discard));
      }
      groups.push(h('div', { class: 'lv-group' }, r.publish));
    } else {
      groups.push(h('span', { class: 'lv-badge', 'data-hint': 'Você está no modo de ouvir: mudo, solo, loop e master servem só para o seu ensaio. Editar o áudio é com o líder.' },
        Icons.icon('listen', 13), 'Modo ouvir'));
    }

    return h('div', { class: 'lv-bar', role: 'toolbar', 'aria-label': 'Barra de ferramentas do estúdio' }, groups);
  }

  function ruler(width) {
    var r = st.refs;
    var total = sessionEnd();
    var p = pps();
    var steps = [0.5, 1, 2, 5, 10, 15, 30, 60];
    var step = steps.find(function (s) { return s * p >= 70; }) || 60;
    var bars = !!(st.grid && st.grid.downbeats.length);
    var lane = h('div', { class: 'lv-ruler', style: 'width:' + width + 'px',
      'data-hint': bars ? 'Régua com os compassos do click: clique para posicionar; arraste para marcar o trecho do loop.' : 'Régua: clique para posicionar; arraste para marcar o trecho do loop.' });
    // Com compassos do click, a régua mostra os compassos (1, 2, 3...); sem, o tempo.
    if (!bars) {
      for (var t = 0; t <= total + 1e-6; t += step) {
        lane.appendChild(h('span', { class: 'lv-tick', style: 'left:' + (t * p) + 'px' }, fmtClock(t).replace(/,\d+$/, '')));
      }
    }
    r.rulerBars = h('div', { class: 'lv-rulerbars' });
    lane.appendChild(r.rulerBars);
    r.loopBrace = h('div', { class: 'lv-loop' });
    lane.appendChild(r.loopBrace);
    // Faixa das seções (Intro, Verso, Refrão...), embaixo da régua.
    r.sections = h('div', { class: 'lv-sections' });
    r.sections.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); dragCreate(ev); });
    lane.appendChild(r.sections);

    lane.addEventListener('pointerdown', function (ev) {
      var rect = lane.getBoundingClientRect();
      var t0 = Math.max(0, (ev.clientX - rect.left) / p);
      var s0 = magnet(t0, ev);
      if (s0 !== null) t0 = s0;
      var dragging = false;
      function move(e) {
        var t1 = Math.max(0, Math.min(total, (e.clientX - rect.left) / p));
        var s1 = magnet(t1, e);
        if (s1 !== null) t1 = s1;
        if (!dragging && Math.abs(t1 - t0) * p < 4) return;
        dragging = true;
        st.loopA = Math.min(t0, t1);
        st.loopB = Math.max(t0, t1);
        refreshChrome();
      }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (dragging) {
          if (loopValid()) { st.loop = true; refreshChrome(); restartSoon(); }
        } else {
          seek(t0);
        }
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    return lane;
  }

  function trackRow(tg, width, index) {
    var key = tg.key;
    var canEdit = editable();
    var row = {};

    row.act = h('button', { class: 'lv-act', 'data-hint': 'Ligar/desligar a faixa (mudo). Só para ouvir aqui; não é salvo.', 'aria-label': 'Ligar ou desligar ' + tg.label,
      onclick: function () { st.muted[key] = !st.muted[key]; relayoutAudible(); } }, String(index + 1));
    row.solo = h('button', { class: 'lv-solo', 'data-hint': 'Solo: ouvir só esta faixa (pode ligar em várias). Só para ouvir aqui; não é salvo.', 'aria-label': 'Solo em ' + tg.label,
      onclick: function () { st.solo[key] = !st.solo[key]; relayoutAudible(); } }, 'S');
    row.volLabel = h('span', { class: 'lv-num' });
    row.dirty = h('i', { class: 'lv-dirty', 'data-hint': 'Alteração ainda não publicada.' });
    row.info = h('span', { class: 'lv-clip-info' });

    var headKids = [
      h('div', { class: 'lv-head-top' },
        Icons.icon(tg.kind === 'take' ? 'take' : Icons.instrumentFor(tg.label), 14, 'lv-inst'),
        h('span', { class: 'lv-name', title: tg.label }, tg.label),
        row.dirty
      )
    ];
    if (canEdit) {
      row.vol = h('input', { type: 'range', min: -24, max: 12, step: 0.5, class: 'lv-range', 'aria-label': 'Volume de ' + tg.label,
        'data-hint': 'Volume desta faixa (salvo ao publicar). Dois cliques voltam para 0 dB.',
        oninput: function (ev) {
          if (!st.faderActive) { pushUndo(); st.faderActive = true; }
          setDraft(key, { gain_db: Number(ev.target.value) });
        },
        onchange: function () { st.faderActive = false; refreshChrome(); restartSoon(); },
        ondblclick: function () { pushUndo(); setDraft(key, { gain_db: 0 }); refreshChrome(); restartSoon(); } });
      var reset = h('button', { class: 'lv-btn mini', 'data-hint': 'Voltar esta faixa ao original (sem cortes, deslocamento, volume ou fade).', 'aria-label': 'Voltar ' + tg.label + ' ao original',
        onclick: function () { pushUndo(); st.drafts[key] = blank(); layoutRow(key); refreshChrome(); restartSoon(); } },
        Icons.icon('reset', 12), h('span', { class: 'vh' }, 'Voltar ao original'));
      headKids.push(h('div', { class: 'lv-head-ctl' }, row.act, row.solo, row.vol, row.volLabel, reset));
    } else {
      headKids.push(h('div', { class: 'lv-head-ctl' }, row.act, row.solo, h('span', { class: 'lv-label', style: 'flex:1' }, 'Volume'), row.volLabel));
    }
    var head = h('div', { class: 'lv-head' }, h('i', { class: 'lv-swatch', style: 'background:' + tg.color }), h('div', { class: 'lv-head-body' }, headKids));

    row.canvas = h('canvas', { class: 'lv-wave', 'aria-hidden': 'true' });
    var clipKids = [h('div', { class: 'lv-clip-title' }, Icons.icon(tg.kind === 'take' ? 'take' : Icons.instrumentFor(tg.label), 11), tg.label), row.canvas, row.info];
    if (canEdit) {
      var trimL = h('div', { class: 'lv-trim l', 'data-hint': 'Arraste para cortar o início.' });
      var trimR = h('div', { class: 'lv-trim r', 'data-hint': 'Arraste para cortar o fim.' });
      row.fadeIn = h('div', { class: 'lv-fade in', 'data-hint': 'Arraste para o fade in.' });
      row.fadeOut = h('div', { class: 'lv-fade out', 'data-hint': 'Arraste para o fade out.' });
      clipKids.push(trimL, trimR, row.fadeIn, row.fadeOut);
      trimL.addEventListener('pointerdown', function (ev) { startDrag(ev, key, 'trimL'); });
      trimR.addEventListener('pointerdown', function (ev) { startDrag(ev, key, 'trimR'); });
      row.fadeIn.addEventListener('pointerdown', function (ev) { startDrag(ev, key, 'fadeIn'); });
      row.fadeOut.addEventListener('pointerdown', function (ev) { startDrag(ev, key, 'fadeOut'); });
    }
    row.clip = h('div', {
      class: 'lv-clip ' + tg.kind + (canEdit ? ' editable tool-' + st.tool : ''),
      style: '--clip:' + tg.color,
      'data-hint': canEdit ? TOOLS.find(function (t) { return t.id === st.tool; }).hint : 'Clique para posicionar a reprodução aqui.'
    }, clipKids);
    row.clip.addEventListener('pointerdown', function (ev) {
      if (canEdit) startDrag(ev, key, 'tool');
      else seek(clipTimeAt(key, ev.clientX));
    });

    row.lane = h('div', { class: 'lv-lane', style: 'width:' + width + 'px' }, row.clip);
    row.lane.addEventListener('pointerdown', function (ev) {
      if (ev.target !== row.lane) return;
      select(null);
      var t = clipTimeAt(key, ev.clientX);
      var s = magnet(t, ev);
      seek(s === null ? t : s);
    });

    st.refs.rows[key] = row;
    return h('div', { class: 'lv-row' }, row.lane, head);
  }

  // Linhas da grade sobre as faixas e números dos compassos na régua.
  function layoutGrid() {
    var r = st.refs;
    if (!r || !r.grid) return;
    r.grid.innerHTML = '';
    if (r.rulerBars) r.rulerBars.innerHTML = '';
    var beats = gridBeats();
    r.grid.style.display = beats ? 'block' : 'none';
    if (!beats || !beats.length) return;
    var p = pps();
    var end = sessionEnd();
    var isDown = {};
    st.grid.downbeats.forEach(function (i) { isDown[i] = true; });
    // Muito apertado (zoom pequeno): mostra só o início dos compassos.
    var spacing = beats.length > 1 ? ((beats[beats.length - 1] - beats[0]) / (beats.length - 1)) * p : 999;
    var showBeats = spacing >= 6;
    var lines = document.createDocumentFragment();
    var labels = document.createDocumentFragment();
    var bar = 0;
    var lastLabel = -1e9;
    for (var i = 0; i < beats.length; i++) {
      var down = !!isDown[i];
      if (down) bar += 1;
      if (beats[i] < 0 || beats[i] > end) continue;
      if (!down && !showBeats) continue;
      var x = beats[i] * p;
      lines.appendChild(h('i', { class: down ? 'lv-beat bar' : 'lv-beat', style: 'left:' + x.toFixed(1) + 'px' }));
      if (down && x - lastLabel >= 22) {
        lastLabel = x;
        labels.appendChild(h('span', { class: 'lv-barnum', style: 'left:' + x.toFixed(1) + 'px' }, String(bar)));
      }
    }
    r.grid.appendChild(lines);
    if (r.rulerBars) r.rulerBars.appendChild(labels);
  }

  function relayoutAudible() {
    targets().forEach(function (t) { layoutRow(t.key); });
    restartSoon();
  }

  function paint() {
    if (!st.el) return;
    var S = A().state();
    var el = st.el;
    el.innerHTML = '';
    st.refs = { rows: {}, toolBtns: [] };

    var projSel = h('select', { 'aria-label': 'Projeto', onchange: function () {
      if (dirtyKeys().length) {
        A().flash('info', 'Há alterações não publicadas. Publique ou descarte antes de trocar de projeto.');
        projSel.value = st.projectId;
        A().rerender();
        return;
      }
      st.projectId = projSel.value;
      load();
    } }, S.projects.map(function (p) { return h('option', { value: p.id, selected: p.id === st.projectId }, p.name + ' · ' + p.song_title); }));

    el.appendChild(h('div', { class: 'row sp-b', style: 'margin-bottom:12px' },
      h('h1', { style: 'margin:0' }, 'Estúdio'),
      h('div', { style: 'min-width:260px' }, projSel)
    ));

    if (st.loading) {
      el.appendChild(h('div', { class: 'msg info' }, st.loading));
      return;
    }

    var list = targets();
    if (!list.length) {
      el.appendChild(h('p', { class: 'mu' }, 'Este projeto ainda não tem faixas nem tomadas.'));
      return;
    }

    var lv = h('div', { class: 'lv' });
    lv.appendChild(controlBar());
    if (st.showVoices) lv.appendChild(voicesPanel());
    st.refs.secBar = h('div', { class: 'lv-secbar' });
    lv.appendChild(st.refs.secBar);
    st.refs.autoBar = h('div', { class: 'lv-autobar', role: 'region', 'aria-label': 'Partes sugeridas' });
    lv.appendChild(st.refs.autoBar);

    var width = laneWidth();
    var arr = h('div', { class: 'lv-arr' });
    var content = h('div', { class: 'lv-content', style: 'width:' + (width + HEAD_W) + 'px' });
    content.appendChild(h('div', { class: 'lv-row ruler' }, ruler(width), h('div', { class: 'lv-head ruler' }, h('span', { class: 'lv-label' }, 'Faixas'))));

    var stems = list.filter(function (t) { return t.kind === 'track'; });
    var takes = list.filter(function (t) { return t.kind === 'take'; });
    var idx = 0;
    if (stems.length) content.appendChild(h('div', { class: 'lv-group-row' }, h('span', null, Icons.icon('list', 11), 'Base')));
    stems.forEach(function (t) { content.appendChild(trackRow(t, width, idx++)); });
    if (takes.length) content.appendChild(h('div', { class: 'lv-group-row' }, h('span', null, Icons.icon('vocal', 11), 'Vozes')));
    takes.forEach(function (t) { content.appendChild(trackRow(t, width, idx++)); });

    st.refs.grid = h('div', { class: 'lv-grid', style: 'width:' + width + 'px', 'aria-hidden': 'true' });
    content.appendChild(st.refs.grid);
    st.refs.playhead = h('div', { class: 'lv-playhead' });
    content.appendChild(st.refs.playhead);
    content.appendChild(h('div', { class: 'lv-end', style: 'left:' + (sessionEnd() * pps()) + 'px' }));
    arr.appendChild(content);
    lv.appendChild(arr);

    // As dicas (data-hint) aparecem na barra de informações global do painel.

    el.appendChild(lv);

    if (editable() && st.log.length) {
      el.appendChild(h('details', { class: 'card', style: 'margin-top:16px' },
        h('summary', { style: 'cursor:pointer;font:600 14px var(--fd);color:var(--tx-hi)' }, 'Histórico de edições'),
        h('div', { class: 'stack', style: 'gap:6px;margin-top:12px' }, st.log.map(function (row) {
          return h('div', { style: 'font-size:14px' }, h('span', { class: 'mu mono' }, A().fmtDate(row.created_at) + '  '), historyLabel(row));
        }))
      ));
    }

    list.forEach(function (t) { layoutRow(t.key); });
    layoutGrid();
    refreshSections(false);
    refreshChrome();
    requestAnimationFrame(function () { list.forEach(function (t) { drawClip(t.key); }); });
  }

  function historyLabel(row) {
    var who = A().nameOf(row.actor);
    var tg = row.take_id ? target('take:' + row.take_id) : target('track:' + row.track_id);
    var what = tg ? tg.label : 'item removido';
    var verb = row.action === 'publicar' ? 'publicou' : row.action === 'remover_edicao' ? 'voltou ao original' : 'salvou';
    var d = row.details || {};
    var parts = [];
    if (d.offset_ms) parts.push((d.offset_ms > 0 ? '+' : '') + d.offset_ms + ' ms');
    if (d.gain_db) parts.push((d.gain_db > 0 ? '+' : '') + d.gain_db + ' dB');
    if (d.trim_start_ms || d.trim_end_ms) parts.push('corte');
    if (d.fade_in_ms || d.fade_out_ms) parts.push('fade');
    return who + ' ' + verb + ' · ' + what + (parts.length && row.action !== 'remover_edicao' ? ' (' + parts.join(', ') + ')' : '');
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (st.el && st.el.isConnected && !st.loading) paint(); }, 150);
  });

  function view() {
    var S = A().state();
    if (!S.projects.length) return h('div', null, h('h1', null, 'Estúdio'), h('p', { class: 'mu' }, 'Ainda não há projetos nesta banda.'));
    if (!st.el) st.el = h('div');
    if (!st.projectId || !S.projects.some(function (p) { return p.id === st.projectId; })) st.projectId = S.projects[0].id;
    if (st.loadedFor !== st.projectId) load();
    else {
      paint();
      if (st.autoplay && !st.loading) { st.autoplay = false; st.pos = 0; play(); }
    }
    return st.el;
  }

  // Abre o estúdio já numa música (usado pelo repertório). Com `autoplay`, começa a tocar.
  function open(projectId, autoplay) {
    if (projectId !== st.projectId) {
      if (dirtyKeys().length) {
        A().flash('info', 'Há alterações não publicadas no estúdio. Publique ou descarte antes de trocar de música.');
        return;
      }
      stop();
      st.projectId = projectId;
    }
    st.autoplay = !!autoplay;
  }

  window.LeaderStudio = { view: view, stop: stop, open: open };
})();
