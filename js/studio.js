// Louvor Studio (web para celular) — Estúdio só para ouvir (ui/StudioScreen.kt sem gravação).
//
// Toca a multitrack com as edições publicadas pelo líder, a minha última gravação e as vozes
// escolhidas para estudar. A música só começa ou pausa pelo botão Tocar: tocar na linha do tempo
// ou numa parte só muda o lugar do cursor.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, sb = L.sb;
  var M = window.EditMath, G = window.BeatGrid, SEC = window.Sections;

  var st = null;     // estado do estúdio aberto (um por vez)
  var ctx = null;    // AudioContext compartilhado
  var BINS = 360;    // colunas do desenho da música

  function blankEdit() { return { trim_start_ms: 0, trim_end_ms: null, offset_ms: 0, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, cuts: [] }; }

  function audioCtx() {
    if (!ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      // 32 kHz: metade da memória de 44,1/48 kHz, e para ensaiar soa bem.
      try { ctx = new Ctx({ sampleRate: 32000, latencyHint: 'playback' }); } catch (e) { ctx = new Ctx(); }
      // iPhone: toca mesmo com a chave de silencioso ligada.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* sem suporte */ }
    }
    return ctx;
  }

  // ------------------------------------------------------------------ Faixas
  function targets() {
    var list = st.tracks.map(function (t) {
      return { key: 'track:' + t.id, kind: 'track', label: t.name, objectKey: t.source_file && t.source_file.object_key, row: t };
    });
    if (st.myTake) list.push({ key: 'take:' + st.myTake.id, kind: 'mine', label: 'Minha voz', objectKey: st.myTake.file && st.myTake.file.object_key, row: st.myTake });
    st.voices.forEach(function (id) {
      var t = st.otherTakes.find(function (x) { return x.id === id; });
      if (t) list.push({ key: 'take:' + t.id, kind: 'voice', label: L.nameOf(t.user_id) + (t.voice_part ? ' · ' + VoiceParts.label(t.voice_part) : ''), objectKey: t.file && t.file.object_key, row: t });
    });
    return list;
  }

  function shiftOf(tg, e) {
    if (tg.kind === 'track') return ((tg.row.timeline_offset_ms || 0) + e.offset_ms) / 1000;
    return ((tg.row.start_ms || 0) - (Number(tg.row.rtl_ms) || 0) + (tg.row.offset_ms || 0) + e.offset_ms) / 1000;
  }

  function editOf(key) {
    var b = st.buffers[key];
    var dur = b ? Math.round((b.duration - (st.leads[key] || 0)) * 1000) : Infinity;
    return M.clampEdit(st.edits[key] || blankEdit(), dur);
  }

  function region(tg, e) {
    var buf = st.buffers[tg.key], lead = st.leads[tg.key] || 0;
    var dur = buf ? buf.duration - lead : 0;
    var a = e.trim_start_ms / 1000;
    var b = e.trim_end_ms === null || e.trim_end_ms === undefined ? dur : e.trim_end_ms / 1000;
    var s = shiftOf(tg, e);
    return { a: a, b: b, shift: s, start: a + s, end: b + s, lead: lead };
  }

  function sessionEnd() {
    var p = L.project(st.pid);
    var end = p && p.session_duration_ms ? p.session_duration_ms / 1000 : 0;
    if (!end) targets().forEach(function (t) { if (st.buffers[t.key]) end = Math.max(end, region(t, editOf(t.key)).end); });
    return end || 1;
  }

  function sections() { return SEC.build(st.markers, sessionEnd()); }
  function sectionAt(t) { var l = sections(), i = SEC.containing(l, t); return i >= 0 ? l[i] : null; }

  // ------------------------------------------------------------------ Baixar e decodificar
  async function decode(tg) {
    if (st.buffers[tg.key] || !tg.objectKey) return;
    var s = await Nuvem.signedUrl(sb, tg.objectKey, 3600);
    if (s.error) throw s.error;
    var r = await fetch(s.data.signedUrl);
    if (!r.ok) throw new Error('Falha ao baixar o áudio (' + r.status + ').');
    var bytes = await r.arrayBuffer();
    var scan = null;
    try { scan = Mp3Scan.scanMp3(new Uint8Array(bytes)); } catch (e) { scan = null; }
    var audio = await new Promise(function (res, rej) { audioCtx().decodeAudioData(bytes, res, function () { rej(new Error('O navegador não conseguiu ler este áudio.')); }); });
    // Muitas faixas longas em estéreo não cabem na memória do celular: vira mono.
    if (audio.numberOfChannels > 1 && st.tracks.length > 4) audio = toMono(audio);
    st.buffers[tg.key] = audio;
    st.leads[tg.key] = G.decoderLead(scan, audio.duration);
  }

  function toMono(a) {
    var out = ctx.createBuffer(1, a.length, a.sampleRate);
    var o = out.getChannelData(0), n = a.numberOfChannels;
    for (var c = 0; c < n; c++) { var d = a.getChannelData(c); for (var i = 0; i < d.length; i++) o[i] += d[i] / n; }
    return out;
  }

  async function load(pid) {
    var p = L.project(pid);
    st = { pid: pid, loading: 'Carregando a música…', done: 0, total: 0, error: null, tracks: [], myTake: null, otherTakes: [], edits: {}, markers: [],
      buffers: {}, leads: {}, voices: L.studyVoices.get(pid), mix: L.store.get('mix.' + pid, {}), solo: {}, playing: false, pos: 0, loop: null,
      nodes: [], vgs: {}, wave: null, tool: 'cursor', sel: null, undo: [], redo: [], split: null, zoom: 0, view0: 0, magnet: L.store.get('estudio_ima', true), grid: null, lyrics: !!(p && p.lyrics) && L.store.get('estudio_letra', window.innerWidth >= 1024), ui: {} };
    var mine = st;
    try {
      var r = await Promise.all([
        sb.from('tracks').select('id,name,gain,timeline_offset_ms,sort_order,source_file:files(id,object_key,bucket)').eq('project_id', pid).order('sort_order'),
        sb.from('takes').select('*,file:files(id,object_key,bucket)').eq('project_id', pid).order('created_at', { ascending: false }),
        sb.from('audio_edits').select('*').eq('project_id', pid).eq('published', true),
        sb.from('song_markers').select('*').eq('project_id', pid).order('at_ms'),
        sb.from('beat_grids').select('*').eq('project_id', pid)
      ]);
      if (st !== mine) return;
      st.tracks = Nuvem.mark(L.must(r[0]));
      var takes = Nuvem.mark(L.must(r[1])).filter(function (t) { return t.file && t.file.object_key; });
      st.myTake = takes.find(function (t) { return t.user_id === S.user.id; }) || null;
      st.otherTakes = takes.filter(function (t) { return t.user_id !== S.user.id && (t.released_for_rehearsal || L.perm.edit()); });
      st.voices = st.voices.filter(function (id) { return st.otherTakes.some(function (t) { return t.id === id; }); });
      L.must(r[2]).forEach(function (e) { st.edits[e.take_id ? 'take:' + e.take_id : 'track:' + e.track_id] = e; });
      st.markers = r[3].error ? [] : r[3].data || [];
      var all = targets();
      st.total = all.length;
      for (var i = 0; i < all.length; i++) {
        st.loading = 'Baixando o áudio: ' + i + ' de ' + all.length;
        paintLoading();
        await decode(all[i]);
        if (st !== mine) return;
        st.done = i + 1;
      }
      st.loading = '';
      computeWave();
      try { prepareGrid(r[4] && !r[4].error && r[4].data ? r[4].data[0] : null); } catch (e) { st.grid = null; }
    } catch (e) {
      if (st !== mine) return;
      st.loading = ''; st.error = L.errorText(e);
    }
    L.render();
  }

  function paintLoading() {
    var u = st.ui;
    if (u.loadText) u.loadText.textContent = st.loading;
    if (u.loadBar) u.loadBar.style.width = (st.total ? st.done / st.total * 100 : 5) + '%';
  }

  // ------------------------------------------------------------------ Tocar
  function master() {
    if (!st.master) { st.master = ctx.createGain(); st.master.connect(ctx.destination); }
    return st.master;
  }
  function anySolo() { return Object.keys(st.solo).some(function (k) { return st.solo[k]; }); }
  function volOf(key) { var v = st.mix[key]; return v === undefined ? 100 : v; }
  function mutedOf(key) { return !!(st.mix['m:' + key]); }
  function liveGain(key) {
    if (mutedOf(key)) return 0;
    if (anySolo() && !st.solo[key]) return 0;
    return volOf(key) / 100;
  }
  function applyGains() {
    Object.keys(st.vgs).forEach(function (k) { st.vgs[k].gain.setTargetAtTime(liveGain(k), ctx.currentTime, 0.015); });
  }
  function saveMix() { L.store.set('mix.' + st.pid, st.mix); }

  function scheduleOne(tg, P, when, until) {
    var buf = st.buffers[tg.key];
    if (!buf) return;
    var e = editOf(tg.key), r = region(tg, e);
    var plan = M.playPlan(P, r.a + r.lead, r.b + r.lead, r.shift - r.lead, buf.duration, until);
    if (!plan) return;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain(), vg = ctx.createGain();
    vg.gain.value = liveGain(tg.key);
    src.connect(g); g.connect(vg); vg.connect(master());
    st.vgs[tg.key] = vg;
    var baseGain = tg.kind === 'track' ? (Number(tg.row.gain) || 1) : 1;
    var fi = e.fade_in_ms / 1000, fo = e.fade_out_ms / 1000, fullEnd = r.end;
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
    M.cutWindows(e.cuts, r.shift, t1, plan.regionEnd).forEach(function (w) {
      g.gain.setValueAtTime(env(w[0]), at(w[0]));
      g.gain.linearRampToValueAtTime(0, at(w[0]) + 0.006);
      g.gain.setValueAtTime(0, at(w[1]));
      g.gain.linearRampToValueAtTime(env(w[1]), at(w[1]) + 0.006);
    });
    src.start(when + plan.startDelay, plan.bufferOffset, plan.duration);
    st.nodes.push(src);
  }

  function stopNodes() {
    st.nodes.forEach(function (n) { try { n.stop(); } catch (e) { /* já parou */ } });
    st.nodes = []; st.vgs = {};
  }

  var wakeLock = null;
  function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {});
      if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch (e) { /* sem suporte */ }
  }

  function play() {
    audioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    stopNodes();
    var end = sessionEnd();
    var until = st.loop ? st.loop.b : end;
    var P = st.pos;
    if (st.loop && (P < st.loop.a || P >= st.loop.b)) P = st.loop.a;
    if (P >= until) P = 0;
    var when = ctx.currentTime + 0.08;
    targets().forEach(function (t) { scheduleOne(t, P, when, until); });
    st.playing = true; st.t0 = when; st.pos0 = P; st.pos = P;
    keepAwake(true);
    cancelAnimationFrame(st.raf);
    tick();
  }

  function pause() {
    if (!st) return;
    stopNodes();
    cancelAnimationFrame(st.raf);
    st.playing = false;
    keepAwake(false);
  }

  function tick() {
    if (!st || !st.playing) return;
    st.pos = Math.max(st.pos0, st.pos0 + (ctx.currentTime - st.t0));
    if (st.loop && st.pos >= st.loop.b) { st.pos = st.loop.a; play(); return; }
    if (st.pos >= sessionEnd()) { pause(); st.pos = 0; L.render(); return; }
    paintPosition();
    st.raf = requestAnimationFrame(tick);
  }

  function restartIfPlaying() { if (st.playing) play(); }

  function seek(t) {
    st.pos = Math.max(0, Math.min(sessionEnd(), t));
    if (st.playing) play(); else paintPosition();
  }

  function togglePlay() {
    if (st.loading) return;
    if (st.playing) { pause(); L.render(); } else { play(); L.render(); }
  }

  /** Repetir: a parte onde o cursor está; sem partes, a música toda. Tocar de novo desliga. */
  function toggleLoop() {
    if (st.loop) { st.loop = null; L.render(); restartIfPlaying(); return; }
    var s = sectionAt(st.pos);
    st.loop = s ? { a: s.start, b: s.end, name: s.name } : { a: 0, b: sessionEnd(), name: 'a música toda' };
    L.toast('Repetindo ' + (s ? s.name : 'a música toda') + '.');
    L.render();
    restartIfPlaying();
  }

  function jump(dir) {
    var l = sections();
    if (!l.length) { seek(dir < 0 ? 0 : Math.min(sessionEnd(), st.pos + 10)); return; }
    var t = dir < 0 ? SEC.prevStart(l, st.pos) : null;
    if (dir > 0) { var nx = l.find(function (s) { return s.start > st.pos + 0.05; }); t = nx ? nx.start : st.pos; }
    goTo(t);
  }
  function goTo(t) {
    if (st.loop) { var s = sectionAt(t); st.loop = s ? { a: s.start, b: s.end, name: s.name } : st.loop; }
    seek(t);
    L.render();
  }

  // ------------------------------------------------------------------ Desenho ao vivo
  function paintPosition() {
    var u = st.ui;
    if (!u.clock) return;
    u.clock.textContent = L.clock(st.pos);
    var s = sectionAt(st.pos);
    var name = s ? s.name : '—';
    if (u.secName.textContent !== name) {
      u.secName.textContent = name;
      u.secDot.style.background = s ? s.color : 'transparent';
      if (u.lyric) L.fill(u.lyric, lyricNodes());
      highlightPart(s);
    }
    placeHead();
  }

  function highlightPart(s) {
    (st.ui.parts || []).forEach(function (b) { b.classList.toggle('on', !!s && b.dataset.id === s.id); });
  }

  // ------------------------------------------------------------------ Linha do tempo (as mesmas regras do app: ui/StudioTimeline.kt)
  // Zoom e rolagem como numa DAW: abre mostrando ~20 s; pinça muda o zoom; um dedo arrastando rola;
  // só o toque parado muda o cursor (com ímã na grade do click). Desenha só o que está na tela.
  var PART_H = 18;   // altura da faixa das partes, embaixo da régua
  var OPEN_VISIBLE_SEC = 20, MIN_VISIBLE_SEC = 3, MAGNET_PX = 24, SLOP = 8, EDGE_PX = 22, HANDLE_PX = 34, AUTOSCROLL_PX = 36;

  function maxZoom() { return Math.max(8, sessionEnd() / MIN_VISIBLE_SEC); }
  function openZoom() { return Math.max(1, Math.min(maxZoom(), sessionEnd() / OPEN_VISIBLE_SEC)); }
  function viewW() { var a = st.ui.area; return (a && a.clientWidth) || 300; }
  function pps() { return viewW() * st.zoom / sessionEnd(); }
  function visibleSec() { return sessionEnd() / st.zoom; }
  function clampView() { st.view0 = Math.max(0, Math.min(sessionEnd() - visibleSec(), st.view0 || 0)); }
  function xOf(t) { return (t - st.view0) * pps(); }
  function tAtX(x) { return st.view0 + x / pps(); }

  /** Zoom mantendo parado o ponto que está em `ax` (pixels na área das faixas). */
  function zoomTo(z, ax) {
    var t = tAtX(ax);
    st.zoom = Math.max(1, Math.min(maxZoom(), z));
    st.view0 = t - ax / pps();
    clampView();
    requestDraw();
  }
  function zoomButton(f) {
    var x = xOf(st.pos), w = viewW();
    zoomTo(st.zoom * f, x >= 0 && x <= w ? x : w / 2);
  }

  // ---------- Grade do click (beat_grids), na linha do tempo
  function gridBeats() {
    var g = st.grid;
    if (!g) return null;
    var tg = targets().find(function (t) { return t.key === 'track:' + g.trackId; });
    if (!tg) return null;
    var shift = region(tg, editOf(tg.key)).shift;
    if (st.gridCache && st.gridCache.g === g && st.gridCache.shift === shift) return st.gridCache.beats;
    var beats = g.beats.map(function (b) { return b + shift; });
    st.gridCache = { g: g, shift: shift, beats: beats };
    return beats;
  }
  function barTimes() {
    var b = gridBeats(), d = st.grid && st.grid.downbeats;
    if (!b || !b.length) return [];
    if (!d || !d.length) return b;
    return d.filter(function (i) { return i >= 0 && i < b.length; }).map(function (i) { return b[i]; });
  }
  function meanSpacing(a) { return a.length > 1 ? (a[a.length - 1] - a[0]) / (a.length - 1) : 0; }
  function barStride(barPx, minPx) { var s = 1; while (barPx * s < minPx && s < 4096) s *= 2; return s; }
  /** Ímã do cursor: o tempo do click mais perto (se o ímã estiver ligado e houver grade). */
  function snapped(t) {
    var b = gridBeats();
    if (!st.magnet || !b) return t;
    var v = G.snap(b, t, MAGNET_PX / pps());
    return v === null ? t : v;
  }
  /** Ímã das pontas (trecho, cortes): prefere o início do compasso. */
  function snapEdge(t) {
    var b = gridBeats();
    if (!st.magnet || !b) return t;
    var v = SEC.snapEdge(b, st.grid.downbeats, t, MAGNET_PX * 0.6 / pps());
    return v === null ? t : v;
  }
  /** Grade da banda; sem ela, procura a faixa do click pelo nome e monta a grade (como o app). */
  function prepareGrid(row) {
    st.grid = G.fromRow(row);
    if (st.grid) return;
    var tr = G.guessClickTrack(st.tracks);
    var g = tr && gridFrom(tr);
    if (!g) return;
    st.grid = g;
    // Quem edita o áudio já deixa a grade salva para a banda (o app faz igual).
    if (L.perm.edit()) sb.from('beat_grids').upsert(G.toRow(st.pid, tr.id, st.grid), { onConflict: 'project_id' }).then(function () {}, function () {});
  }
  /** Grade a partir dos tics de uma faixa (null se não achar um click nela). */
  function gridFrom(tr) {
    var buf = st.buffers['track:' + tr.id];
    if (!buf) return null;
    var chans = [];
    for (var c = 0; c < (buf.numberOfChannels || 1); c++) chans.push(buf.getChannelData(c));
    var res = G.detect(chans, buf.sampleRate || 44100);
    if (res.beats.length < 4) return null;
    var lead = st.leads['track:' + tr.id] || 0;
    return { trackId: tr.id, beats: res.beats.map(function (b) { return Math.max(0, b - lead); }), downbeats: res.downbeats, beatsPerBar: res.beatsPerBar, accent: res.accent, saved: false };
  }
  /** Quem edita o áudio escolhe à mão a faixa do click (quando o nome dela não diz "click"). */
  function chooseClick() {
    L.sheet(function (close) {
      return [h('div', { class: 'hi semi', style: { fontSize: '17px' } }, 'Qual faixa é o click?'),
        U.body('A grade dos tempos (e o ímã) sai dos tics dessa faixa. Vale para a banda toda.', 'var(--muted)', 13),
        h('div', { class: 'col', style: { gap: '6px' } }, st.tracks.map(function (tr) {
          var on = st.grid && st.grid.trackId === tr.id;
          return h('button', { class: 'chiptog' + (on ? ' on' : ''), style: { justifyContent: 'flex-start', minHeight: '44px' }, onclick: function () {
            close();
            var g = gridFrom(tr);
            if (!g) { L.toast('Não achei os tics de um click em "' + tr.name + '". Escolha a faixa que tem o metrônomo.'); return; }
            st.grid = g; st.gridCache = null;
            sb.from('beat_grids').upsert(G.toRow(st.pid, tr.id, g), { onConflict: 'project_id' }).then(function (res) {
              if (res.error) L.toast(L.errorText(res.error));
            });
            L.toast('Grade pelo click de "' + tr.name + '": ' + g.beats.length + ' tempos' + (g.downbeats.length ? '.' : ' (o 1 do compasso não se destaca nesse click).'));
            L.render();
          } }, ic(instrumentIcon(tr.name), 16), tr.name, on ? h('span', { class: 'muted small', style: { marginLeft: 'auto' } }, 'em uso') : null);
        }))];
    });
  }

  // ---------- Forma de onda: picos a cada 10 ms do arquivo (não depende das edições)
  function computeWave() { st.peaks = {}; }
  function peaksOf(key) {
    st.peaks = st.peaks || {};
    if (st.peaks[key]) return st.peaks[key];
    var buf = st.buffers[key];
    if (!buf) return null;
    var data = buf.getChannelData(0), rate = buf.sampleRate, per = Math.max(1, Math.round(rate / 100));
    var n = Math.ceil(data.length / per), out = new Float32Array(n), peak = 0;
    for (var i = 0; i < n; i++) {
      var s0 = i * per, s1 = Math.min(data.length, s0 + per), m = 0;
      for (var j = s0; j < s1; j += 3) { var v = data[j] < 0 ? -data[j] : data[j]; if (v > m) m = v; }
      out[i] = m; if (m > peak) peak = m;
    }
    if (peak > 0) for (var k = 0; k < n; k++) out[k] /= peak;
    st.peaks[key] = out;
    return out;
  }

  function fitCanvas(c) {
    var dpr = window.devicePixelRatio || 1, w = c.clientWidth, hh = c.clientHeight;
    if (!w || !hh) return null;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    return { g: g, w: w, h: hh };
  }

  /** Linhas da grade por trás de uma faixa (tempos com zoom; compassos sempre, de N em N se apertar). */
  function drawGrid(g, w, hh) {
    var beats = gridBeats();
    if (!beats) return;
    var bars = barTimes(), p = pps();
    var hasDown = st.grid.downbeats && st.grid.downbeats.length;
    if (hasDown && meanSpacing(beats) * p >= 10) {
      g.fillStyle = '#0F2F47';
      beats.forEach(function (b) { var x = xOf(b); if (x >= -1 && x <= w) g.fillRect(Math.round(x), 0, 1, hh); });
    }
    var stride = barStride(meanSpacing(bars) * p, 12);
    g.fillStyle = '#284660';
    for (var i = 0; i < bars.length; i += stride) { var x = xOf(bars[i]); if (x >= -2 && x <= w) g.fillRect(Math.round(x), 0, 1.5, hh); }
  }
  function drawLoop(g, w, hh, strong) {
    if (!st.loop) return;
    var a = xOf(st.loop.a), b = xOf(st.loop.b);
    if (b < 0 || a > w) return;
    g.fillStyle = strong ? 'rgba(99,212,255,0.22)' : 'rgba(99,212,255,0.10)';
    g.fillRect(a, 0, b - a, hh);
    g.fillStyle = 'rgba(99,212,255,0.75)';
    g.fillRect(a - 1, 0, 2, hh); g.fillRect(b - 1, 0, 2, hh);
  }

  /** Régua: o tempo em cima (compassos numerados com grade, ou minutos); embaixo, colada nas faixas, as partes. */
  function drawRuler() {
    var c = st.ui.ruler;
    var f = c && fitCanvas(c);
    if (!f) return;
    var g = f.g, w = f.w, hh = f.h, p = pps();
    var SY = hh - PART_H - 1, top = SY - 3;   // faixa das partes (embaixo) e o fim da área do tempo
    // Partes. A sugestão de "Detectar partes" em revisão aparece no lugar delas, listrada (ainda não marcada).
    var auto = reviewing();
    var shown = viewParts();
    var editing = st.tool === 'partes' && L.perm.leader();
    shown.forEach(function (sc) {
      var a = xOf(sc.start), b = xOf(sc.end);
      if (b < 0 || a > w) return;
      g.fillStyle = sc.color; g.globalAlpha = 0.9;
      g.fillRect(a + 0.5, SY, Math.max(1, b - a - 1), PART_H);
      g.globalAlpha = 1;
      if (auto) {
        g.save();
        g.beginPath(); g.rect(a + 0.5, SY, Math.max(1, b - a - 1), PART_H); g.clip();
        g.strokeStyle = 'rgba(5,11,18,0.28)'; g.lineWidth = 3;
        for (var sx = a - 20; sx < b; sx += 9) { g.beginPath(); g.moveTo(sx, SY + PART_H); g.lineTo(sx + PART_H, SY); g.stroke(); }
        g.restore();
        g.fillStyle = '#050B12'; g.fillRect(Math.round(a), SY, 1.5, PART_H);
      }
      if (editing) {
        // Pegadores nas pontas: dá para arrastar.
        g.fillStyle = 'rgba(5,11,18,0.45)';
        g.fillRect(a + 0.5, SY, 5, PART_H); g.fillRect(b - 5.5, SY, 5, PART_H);
        if (sc.id === st.selPart) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.strokeRect(a + 1.5, SY + 1, Math.max(1, b - a - 3), PART_H - 2); }
      }
      if (b - a > 28) { g.fillStyle = '#050B12'; g.font = '600 10px Geist, system-ui, sans-serif'; g.fillText(sc.name, Math.max(a, 0) + (editing ? 8 : 4), SY + PART_H - 5, b - Math.max(a, 0) - (editing ? 14 : 6)); }
    });
    if (st.partDraft) {
      var da = xOf(st.partDraft.a), db = xOf(st.partDraft.b);
      g.fillStyle = 'rgba(8,169,245,0.35)'; g.fillRect(da, SY, Math.max(1, db - da), PART_H);
      g.strokeStyle = '#7FD3FF'; g.lineWidth = 1.5; g.strokeRect(da + 0.75, SY + 0.75, Math.max(1, db - da - 1.5), PART_H - 1.5);
    }
    // Tempo: números no alto; as marcas descem até a faixa das partes.
    g.font = '600 10px "Geist Mono", ui-monospace, monospace';
    var bars = barTimes(), LY = 12;
    if (st.grid && st.grid.downbeats && st.grid.downbeats.length && bars.length > 1) {
      var beats = gridBeats();
      if (meanSpacing(beats) * p >= 7) { g.fillStyle = '#2A4863'; beats.forEach(function (b) { var x = xOf(b); if (x >= 0 && x <= w) g.fillRect(Math.round(x), top - 5, 1, 5); }); }
      var labelStride = barStride(meanSpacing(bars) * p, 30), tickStride = barStride(meanSpacing(bars) * p, 7);
      for (var n = 0; n < bars.length; n += tickStride) {
        var x = xOf(bars[n]);
        if (x < -30 || x > w) continue;
        var label = n % labelStride === 0;
        g.fillStyle = label ? '#6A86A0' : '#34536C';
        g.fillRect(Math.round(x), label ? 2 : top - 8, 1, label ? top - 2 : 8);
        if (label) { g.fillStyle = '#CADAE7'; g.fillText(String(n + 1), x + 3, LY); }
      }
    } else {
      var step = [1, 2, 5, 10, 15, 30, 60, 120].find(function (v) { return v * p >= 46; }) || 120;
      g.fillStyle = '#385872';
      for (var t = Math.floor(st.view0 / step) * step; t <= st.view0 + visibleSec() + step; t += step) {
        var xx = xOf(t);
        if (xx < -40 || xx > w) continue;
        g.fillRect(Math.round(xx), 2, 1, top - 2);
        g.fillStyle = '#CADAE7'; g.fillText(L.clock(t), xx + 3, LY); g.fillStyle = '#385872';
      }
    }
    drawLoop(g, w, hh, true);
  }

  /** Uma faixa: grade, os blocos que tocam (cortes viram buracos), a onda e as pontas. */
  function drawLane(tg, c) {
    var f = fitCanvas(c);
    if (!f) return;
    var g = f.g, w = f.w, hh = f.h, p = pps();
    drawGrid(g, w, hh);
    var peaks = peaksOf(tg.key);
    var e = editOf(tg.key), r = region(tg, e), dur = durMs(tg.key);
    var color = tg.kind === 'track' ? U.colorFor(tg.key) : tg.kind === 'mine' ? '#08A9F5' : '#6CC4B0';
    var off = mutedOf(tg.key) || (anySolo() && !st.solo[tg.key]);
    if (!peaks) { g.fillStyle = 'rgba(220,232,242,0.08)'; g.fillRect(0, hh / 2 - 1, w, 2); return; }
    var segs = pieces(e, dur);
    segs.forEach(function (sg) {
      var a = xOf(sg[0] / 1000 + r.shift), b = xOf(sg[1] / 1000 + r.shift);
      if (b < 0 || a > w || b - a < 0.5) return;
      g.globalAlpha = off ? 0.08 : 0.18; g.fillStyle = color;
      roundRect(g, a, 3, b - a, hh - 6, 6); g.fill();
      g.globalAlpha = off ? 0.3 : 1;
      roundRect(g, a, 3, b - a, 4, 2); g.fill();
      g.globalAlpha = 1;
    });
    // Onda: para cada coluna da tela, o pico daquele pedaço do arquivo (só onde toca).
    var mid = hh / 2 + 2, amp = hh / 2 - 8;
    g.fillStyle = off ? '#4F6B82' : mixColor(color, '#DCE8F2', 0.35);
    var x0 = Math.max(0, Math.floor(xOf(r.start))), x1 = Math.min(w, Math.ceil(xOf(r.end)));
    for (var x = x0; x < x1; x++) {
      var fa = (tAtX(x) - r.shift) * 1000, fb = (tAtX(x + 1) - r.shift) * 1000;
      var fm = (fa + fb) / 2;
      if (!segs.some(function (sg) { return fm >= sg[0] && fm < sg[1]; })) continue;
      var i0 = Math.max(0, Math.floor((fa + r.lead * 1000) / 10)), i1 = Math.min(peaks.length, Math.ceil((fb + r.lead * 1000) / 10));
      var m = 0;
      for (var i = i0; i < Math.max(i1, i0 + 1) && i < peaks.length; i++) if (peaks[i] > m) m = peaks[i];
      var v = Math.max(0.02, m) * amp;
      g.fillRect(x, mid - v, 1, v * 2);
    }
    var sel = st.sel === tg.key && (st.tool === 'mover' || st.tool === 'cortar' || st.tool === 'aparar' || st.tool === 'volume');
    if (sel) {
      g.fillStyle = 'rgba(99,212,255,0.9)';
      var sa = xOf(r.start), sb2 = xOf(r.end);
      g.fillRect(sa, 0, 2, hh); g.fillRect(sb2 - 2, 0, 2, hh);
      if (st.tool === 'aparar') { g.fillRect(sa, hh / 2 - 12, 6, 24); g.fillRect(sb2 - 6, hh / 2 - 12, 6, 24); }
    }
    if (st.split && st.split.key === tg.key) {
      var sx = xOf(st.split.at / 1000 + r.shift);
      g.fillStyle = '#FFB547';
      for (var yy = 0; yy < hh; yy += 8) g.fillRect(sx - 1, yy, 2, 5);
    }
    drawLoop(g, w, hh, false);
  }
  function roundRect(g, x, y, w, hh, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hh, Math.min(r, w / 2)); else g.rect(x, y, w, hh);
  }
  function mixColor(a, b, t) {
    function rgb(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
    var x = rgb(a), y = rgb(b);
    return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); }).join(',') + ')';
  }

  var drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; if (st && st.ui && st.ui.ruler) drawDaw(); });
  }
  function drawDaw() {
    var u = st.ui;
    if (!u.ruler) return;
    if (!st.zoom) { st.zoom = openZoom(); st.view0 = 0; }
    clampView();
    drawRuler();
    (u.lanes || []).forEach(function (l) { drawLane(l.tg, l.canvas); });
    placeHead();
    if (u.zoomOut) { u.zoomOut.disabled = st.zoom <= 1; u.zoomIn.disabled = st.zoom >= maxZoom(); }
  }

  /** Cursor de tempo: uma linha só, que atravessa a régua e todas as faixas. Tocando, a tela acompanha. */
  function placeHead() {
    var hd = st.ui.head;
    if (!hd) return;
    var x = xOf(st.pos), w = viewW();
    if (st.playing && (x < 0 || x > w * 0.92)) { st.view0 = st.pos - visibleSec() * 0.1; clampView(); requestDraw(); x = xOf(st.pos); }
    hd.style.display = x < -1 || x > w + 1 ? 'none' : '';
    hd.style.left = x + 'px';
  }

  function lyricNodes() {
    var p = L.project(st.pid);
    var blocks = L.parseLyrics(p && p.lyrics);
    if (!blocks.length) return [h('div', { class: 'muted small' }, 'Esta música está sem letra.')];
    var s = sectionAt(st.pos);
    var pick = null;
    if (s) {
      var n = L.norm(s.name).replace(/\s*\d+$/, '');
      pick = blocks.filter(function (b) { return b.title && L.norm(b.title).indexOf(n) >= 0; });
      // "Verso 2": o segundo bloco de verso.
      var num = /(\d+)\s*$/.exec(s.name);
      if (pick.length > 1 && num) pick = [pick[Math.min(pick.length - 1, Number(num[1]) - 1)]];
      else if (pick.length > 1) pick = [pick[0]];
    }
    if (!pick || !pick.length) pick = blocks;
    var out = [];
    pick.forEach(function (b) {
      if (b.title) out.push(h('div', { class: 'bt' }, b.title));
      b.lines.forEach(function (ln) { out.push(h('div', { class: 'ln' }, ln || ' ')); });
    });
    return out;
  }

  // ------------------------------------------------------------------ Ferramentas (as mesmas do app: ui/StudioTools.kt)
  // Barra em cima das partes, como numa DAW: Cursor, Repetir, Mover, Cortar, Aparar, Volume e Partes (só o líder),
  // com Desfazer e Refazer. Cada um edita a própria gravação; as faixas da banda e as vozes dos outros, só quem
  // edita o áudio. Nada apaga o arquivo original: a edição fica salva para a banda (audio_edits, publicada).
  var TOOLS = [['cursor', 'MousePointer2', 'Cursor'], ['repetir', 'Repeat', 'Repetir'], ['mover', 'Move', 'Mover'], ['cortar', 'Scissors', 'Cortar'],
    ['aparar', 'Crop', 'Aparar'], ['volume', 'Volume2', 'Volume'], ['partes', 'Flag', 'Partes']];
  var PART_NAMES = ['Intro', 'Verso', 'Pré-refrão', 'Refrão', 'Ponte', 'Solo', 'Final'];
  var MAX_OFFSET_MS = 600000;

  function canEditKey(key) {
    if (st.myTake && key === 'take:' + st.myTake.id) return true;
    return L.perm.edit();
  }
  function selTarget() {
    var list = targets();
    var t = list.find(function (x) { return x.key === st.sel; });
    if (t) return t;
    // Começa pela própria gravação (a que todo mundo pode editar); senão, a primeira faixa.
    t = list.find(function (x) { return x.kind === 'mine'; }) || list[0] || null;
    st.sel = t ? t.key : null;
    return t;
  }
  function rawEdit(key) { var e = st.edits[key]; return Object.assign(blankEdit(), e || {}, { cuts: ((e && e.cuts) || []).map(function (c) { return [c[0], c[1]]; }) }); }
  function durMs(key) { var b = st.buffers[key]; return b ? Math.round((b.duration - (st.leads[key] || 0)) * 1000) : 0; }

  /** Muda a edição de uma faixa na hora (sem entrar no desfazer); redesenha só aquela faixa. */
  function previewEdit(key, e) {
    st.edits[key] = e;
    if (st.grid && key === 'track:' + st.grid.trackId) st.gridCache = null;
    var lane = (st.ui.lanes || []).find(function (l) { return l.tg.key === key; });
    if (lane) drawLane(lane.tg, lane.canvas);
  }
  /** Confirma: entra no desfazer, salva para a banda e volta a tocar com a edição. */
  function commitEdit(key, before, after) {
    previewEdit(key, after);
    if (M.sameEdit(before, after)) return;
    st.undo.push({ key: key, before: before, after: after });
    if (st.undo.length > 100) st.undo.shift();
    st.redo = [];
    queueSave(key);
    restartIfPlaying();
    L.render();
  }
  function undoEdit() {
    var x = st.undo.pop(); if (!x) return;
    st.redo.push(x);
    if (x.parts) { restoreParts(x, x.before); return; }
    previewEdit(x.key, x.before); queueSave(x.key); restartIfPlaying(); L.render();
  }
  function redoEdit() {
    var x = st.redo.pop(); if (!x) return;
    st.undo.push(x);
    if (x.parts) { restoreParts(x, x.after); return; }
    previewEdit(x.key, x.after); queueSave(x.key); restartIfPlaying(); L.render();
  }
  var saveTimers = {};
  function queueSave(key) {
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(function () { saveEdit(key); }, 900);
  }
  async function saveEdit(key) {
    var e = st.edits[key], isTake = key.indexOf('take:') === 0, id = key.slice(isTake ? 5 : 6), col = isTake ? 'take_id' : 'track_id';
    try {
      if (!e || M.isNeutral(e)) { L.must(await sb.from('audio_edits').delete().eq(col, id)); return; }
      L.must(await sb.from('audio_edits').upsert({
        project_id: st.pid, take_id: isTake ? id : null, track_id: isTake ? null : id,
        trim_start_ms: Math.round(e.trim_start_ms || 0), trim_end_ms: e.trim_end_ms === null || e.trim_end_ms === undefined ? null : Math.round(e.trim_end_ms),
        offset_ms: Math.round(e.offset_ms || 0), gain_db: Number(e.gain_db || 0), fade_in_ms: Math.round(e.fade_in_ms || 0), fade_out_ms: Math.round(e.fade_out_ms || 0),
        cuts: e.cuts || [], published: true
      }, { onConflict: col }));
    } catch (err) {
      L.toast('O ajuste ficou só neste aparelho; não foi salvo para a banda: ' + L.errorText(err));
    }
  }

  /** Trechos que tocam (ms no arquivo): do começo ao fim aparados, menos os cortes. */
  function pieces(e, dur) {
    var a = e.trim_start_ms || 0, b = e.trim_end_ms === null || e.trim_end_ms === undefined ? dur : e.trim_end_ms;
    var out = [], cur = a;
    (e.cuts || []).slice().sort(function (x, y) { return x[0] - y[0]; }).forEach(function (c) {
      if (c[1] <= cur || c[0] >= b) return;
      if (c[0] > cur) out.push([cur, c[0]]);
      cur = Math.max(cur, c[1]);
    });
    if (cur < b) out.push([cur, b]);
    return out;
  }
  function addCut(key, from, to) {
    var before = rawEdit(key), after = rawEdit(key);
    after.cuts.push([Math.round(from), Math.round(to)]);
    after.cuts.sort(function (x, y) { return x[0] - y[0]; });
    st.split = null;
    commitEdit(key, before, after);
  }

  function toolbar() {
    var leader = L.perm.leader();
    var tools = TOOLS.filter(function (t) { return t[0] !== 'partes' || leader; }).map(function (t) {
      var on = st.tool === t[0];
      return h('button', { class: 'tool' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { st.tool = t[0]; st.split = null; L.render(); } },
        ic(t[1], 19), h('span', null, t[2]));
    });
    var magnet = st.grid ? h('button', { class: 'tool' + (st.magnet ? ' on' : ''), 'aria-pressed': st.magnet ? 'true' : 'false', onclick: function () {
      st.magnet = !st.magnet; L.store.set('estudio_ima', st.magnet); L.toast(st.magnet ? 'Ímã ligado: gruda no tempo do click.' : 'Ímã desligado.'); L.render();
    } }, ic('Magnet', 19), h('span', null, 'Ímã')) : null;
    var clickBtn = L.perm.edit() && st.tracks.length ? h('button', { class: 'tool', onclick: chooseClick, title: 'Escolher qual faixa é o click' }, ic('Timer', 19), h('span', null, 'Click')) : null;
    return h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Ferramentas do estúdio' }, tools, h('span', { class: 'tsep' }), magnet, clickBtn,
      h('button', { class: 'tool', disabled: !st.undo.length, onclick: undoEdit }, ic('Undo2', 19), h('span', null, 'Desfazer')),
      h('button', { class: 'tool', disabled: !st.redo.length, onclick: redoEdit }, ic('Redo2', 19), h('span', null, 'Refazer')));
  }

  function toolPanel() {
    var tg = selTarget();
    var can = !!tg && canEditKey(tg.key);
    var chip = tg ? h('span', { class: 'tgt' }, ic(tg.kind === 'track' ? instrumentIcon(tg.label) : 'Mic', 14), tg.label) : null;
    function hint(t) { return h('span', { class: 'thint' }, t); }
    function b(text, fn, icon, cls) { return h('button', { class: 'chiptog tbtn2' + (cls ? ' ' + cls : ''), onclick: fn }, icon ? ic(icon, 15) : null, text); }
    var noPerm = hint('Toque no nome de uma faixa para escolher. Você edita a sua gravação; as faixas da banda, só o líder ou quem tem permissão.');
    var kids;
    switch (st.tool) {
      case 'repetir':
        kids = [hint(st.loop ? 'Repetindo ' + st.loop.name + '. Arraste as pontas para ajustar; dois toques dentro apagam.' : 'Arraste nas faixas para marcar o trecho (nas outras ferramentas: dois toques e arraste).'),
          st.loop ? b('Parar de repetir', function () { st.loop = null; L.render(); restartIfPlaying(); }, 'X') : null];
        break;
      case 'mover':
        if (!can) { kids = [chip, noPerm]; break; }
        var e = rawEdit(tg.key);
        var nudge = function (ms) { var bf = rawEdit(tg.key), af = rawEdit(tg.key); af.offset_ms = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, (af.offset_ms || 0) + ms)); commitEdit(tg.key, bf, af); };
        kids = [chip, h('span', { class: 'mono hi', style: { fontSize: '13px' } }, ((e.offset_ms || 0) > 0 ? '+' : '') + (e.offset_ms || 0) + ' ms'),
          b('−100', function () { nudge(-100); }), b('−10', function () { nudge(-10); }), b('+10', function () { nudge(10); }), b('+100', function () { nudge(100); }),
          (e.offset_ms || 0) ? b('Original', function () { var bf = rawEdit(tg.key), af = rawEdit(tg.key); af.offset_ms = 0; commitEdit(tg.key, bf, af); }, 'RotateCcw') : null,
          hint('Arraste a faixa para os lados, ou use os botões para o ajuste fino.')];
        break;
      case 'cortar':
        if (!can) { kids = [chip, noPerm]; break; }
        if (st.split && st.split.key === tg.key) {
          var sp = st.split;
          kids = [chip, b('Apagar antes', function () { addCut(sp.key, sp.piece[0], sp.at); }, 'ChevronsLeft', 'danger'),
            b('Apagar depois', function () { addCut(sp.key, sp.at, sp.piece[1]); }, 'ChevronsRight', 'danger'),
            b('Cancelar', function () { st.split = null; L.render(); })];
        } else {
          var hasCuts = rawEdit(tg.key).cuts.length > 0;
          kids = [chip, hint('Toque na faixa no ponto do corte; depois escolha o pedaço que sai.'),
            hasCuts ? b('Voltar os pedaços', function () { var bf = rawEdit(tg.key), af = rawEdit(tg.key); af.cuts = []; commitEdit(tg.key, bf, af); }, 'RotateCcw') : null];
        }
        break;
      case 'aparar':
        if (!can) { kids = [chip, noPerm]; break; }
        var ea = rawEdit(tg.key);
        kids = [chip, hint('Arraste perto do começo ou do fim da faixa para aparar as pontas.'),
          (ea.trim_start_ms || ea.trim_end_ms !== null) ? b('Pontas originais', function () { var bf = rawEdit(tg.key), af = rawEdit(tg.key); af.trim_start_ms = 0; af.trim_end_ms = null; commitEdit(tg.key, bf, af); }, 'RotateCcw') : null];
        break;
      case 'volume':
        if (!can) { kids = [chip, hint('Para você, o volume vale só no seu fone: use a barrinha de cada faixa.')]; break; }
        var ev = rawEdit(tg.key);
        var slider = function (label, val, min, max, step, fmt, field, scale) {
          var out = h('span', { class: 'mono hi', style: { fontSize: '12px', minWidth: '52px' } }, fmt(val));
          var r = h('input', { type: 'range', class: 'vol', min: String(min), max: String(max), step: String(step), value: String(val), 'aria-label': label });
          var before = null;
          r.addEventListener('pointerdown', function () { before = rawEdit(tg.key); });
          r.addEventListener('input', function () { var e2 = rawEdit(tg.key); e2[field] = Number(r.value) * scale; out.textContent = fmt(Number(r.value)); previewEdit(tg.key, e2); });
          r.addEventListener('change', function () { commitEdit(tg.key, before || rawEdit(tg.key), rawEdit(tg.key)); before = null; });
          return h('label', { class: 'tslider' }, h('span', { class: 'muted small' }, label), r, out);
        };
        kids = [chip,
          slider('Volume da faixa', Number(ev.gain_db || 0), -24, 12, 0.5, function (v) { return (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' dB'; }, 'gain_db', 1),
          slider('Entrada suave', (ev.fade_in_ms || 0) / 1000, 0, 8, 0.1, function (v) { return v.toFixed(1).replace('.', ',') + ' s'; }, 'fade_in_ms', 1000),
          slider('Saída suave', (ev.fade_out_ms || 0) / 1000, 0, 8, 0.1, function (v) { return v.toFixed(1).replace('.', ',') + ' s'; }, 'fade_out_ms', 1000),
          hint('Vale para a banda inteira.')];
        break;
      case 'partes':
        kids = partsPanel(b, hint);
        break;
      default:
        kids = [hint('Toque para escolher de onde tocar. Arraste para andar na música; pinça com dois dedos muda o zoom. Dois toques e arraste: trecho para repetir.')];
    }
    return h('div', { class: 'toolpanel' }, kids);
  }

  // ---------- Partes (só o líder edita). Uma lista só para editar: as partes marcadas ou, enquanto o líder
  // revisa o "Detectar partes", a sugestão. Toda mudança passa por setParts: entra no Desfazer e, fora da
  // revisão, é salva para a banda. As regras de dividir, juntar e marcar no cursor estão em lib/sections.js.
  function reviewing() { return !!(st.auto && st.auto.parts); }
  function partList() { return reviewing() ? st.auto.parts : st.markers; }
  function viewParts() { return SEC.build(partList(), sessionEnd()); }
  function marker(id) { return partList().find(function (m) { return m.id === id; }) || null; }
  var sugSeq = 0;
  function newPartId() {
    if (reviewing()) return 'sug-' + (++sugSeq);
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function replaceParts(list) { if (reviewing()) st.auto.parts = list; else st.markers = list; }

  function setParts(after, opts) {
    opts = opts || {};
    var before = opts.before || SEC.copyMarkers(partList());
    after = SEC.copyMarkers(after).sort(function (a, b) { return a.at_ms - b.at_ms; });
    var d = SEC.diff(before, after);
    replaceParts(after);
    if (st.selPart && !after.some(function (m) { return m.id === st.selPart; })) st.selPart = null;
    if (!d.del.length && !d.ins.length && !d.upd.length) { L.render(); return; }
    if (opts.record !== false) {
      st.undo.push({ parts: true, review: reviewing(), before: before, after: after });
      if (st.undo.length > 100) st.undo.shift();
      st.redo = [];
    }
    if (!reviewing()) persistParts(d);
    L.render();
  }

  // Salva em ordem (uma mudança de cada vez). Se algo falhar, mostra o que ficou salvo de verdade.
  var partsQueue = Promise.resolve();
  function persistParts(d) {
    var pid = st.pid, mine = st;
    partsQueue = partsQueue.then(async function () {
      if (d.del.length) L.must(await sb.from('song_markers').delete().in('id', d.del));
      if (d.ins.length) L.must(await sb.from('song_markers').insert(d.ins.map(function (m) {
        return { id: m.id, project_id: pid, at_ms: m.at_ms, end_ms: m.end_ms, name: m.name };
      })));
      for (var i = 0; i < d.upd.length; i++) {
        var m = d.upd[i];
        L.must(await sb.from('song_markers').update({ at_ms: m.at_ms, end_ms: m.end_ms, name: m.name }).eq('id', m.id));
      }
    }).catch(async function (e) {
      L.toast('Não deu para salvar as partes: ' + L.errorText(e));
      var r = await sb.from('song_markers').select('*').eq('project_id', pid).order('at_ms');
      if (st !== mine || r.error || !r.data) return;
      st.markers = r.data;
      st.undo = st.undo.filter(function (x) { return !x.parts; });
      st.redo = st.redo.filter(function (x) { return !x.parts; });
      L.render();
    });
  }

  // Desfazer/refazer de partes (chamado pelo Desfazer da barra de ferramentas).
  function restoreParts(x, target) {
    if (x.review !== reviewing()) { L.toast('Essa mudança era da sugestão, que já foi fechada.'); L.render(); return; }
    setParts(target, { record: false });
  }

  // Fecha a revisão: o que foi feito nela sai do Desfazer (a sugestão não existe mais).
  function endReview() {
    st.auto = null;
    st.selPart = null;
    st.undo = st.undo.filter(function (x) { return !(x.parts && x.review); });
    st.redo = st.redo.filter(function (x) { return !(x.parts && x.review); });
  }

  // Ações sobre uma parte (marcada ou da sugestão).
  function addPart(name) {
    var t = snapEdge(st.pos), id = newPartId();
    var list = viewParts(), ci = SEC.containing(list, t), cur = ci >= 0 ? list[ci] : null;
    // Cursor no começo de uma parte: ela passa a ter esse nome. Colado no fim: a nova começa logo depois.
    if (cur && t - cur.start < SEC.MIN_LEN) {
      renamePart(cur.id, name);
      st.selPart = cur.id;
      L.toast('Esta parte agora se chama ' + name + '.');
      L.render();
      return;
    }
    if (cur && cur.end - t < SEC.MIN_LEN) t = cur.end;
    var after = SEC.addAt(partList(), t, sessionEnd(), name, id, gridBeats(), st.grid && st.grid.downbeats);
    if (!after) { L.toast('Não cabe uma parte nova aqui. Leve o cursor um pouco para o lado ou diminua a parte vizinha.'); return; }
    setParts(after);
    st.selPart = id;
    L.toast(name + ' marcado em ' + L.clock(t) + '. Arraste as pontas na régua para ajustar.');
    L.render();
  }
  function renamePart(id, name) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) return;
    setParts(partList().map(function (m) { return m.id === id ? Object.assign({}, m, { name: name }) : m; }));
  }
  function delPart(id) {
    var m = marker(id);
    setParts(partList().filter(function (x) { return x.id !== id; }));
    if (m) L.toast(m.name + ' apagado. Se foi sem querer, toque em Desfazer.');
  }
  function setPartEdge(id, edge) {
    var list = viewParts(), sc = list.find(function (x) { return x.id === id; });
    if (!sc) return;
    var t = snapEdge(st.pos);
    if ((edge === 'start' && t >= sc.end - SEC.MIN_LEN) || (edge === 'end' && t <= sc.start + SEC.MIN_LEN)) {
      L.toast(edge === 'start' ? 'Leve o cursor para antes do fim da parte.' : 'Leve o cursor para depois do começo da parte.');
      return;
    }
    var rr = SEC.clampRange(list, id, edge === 'start' ? t : sc.start, edge === 'end' ? t : sc.end, sessionEnd(), edge);
    setParts(SEC.withEnds(partList(), sessionEnd()).map(function (m) {
      return m.id === id ? Object.assign({}, m, { at_ms: Math.round(rr.start * 1000), end_ms: Math.round(rr.end * 1000) }) : m;
    }));
  }
  /** Setas: a ponta anda um compasso (ou meio segundo, sem a grade), sem invadir as vizinhas. */
  function nudgePart(id, edge, dir) {
    var list = viewParts(), sc = list.find(function (x) { return x.id === id; });
    if (!sc) return;
    var v = edge === 'start' ? sc.start : sc.end, bars = barTimes(), t = v + dir * 0.5;
    if (bars.length) {
      var nx = dir > 0 ? bars.find(function (b) { return b > v + 0.05; }) : bars.slice().reverse().find(function (b) { return b < v - 0.05; });
      t = nx === undefined ? (dir > 0 ? sessionEnd() : 0) : nx;
    }
    var rr = SEC.clampRange(list, id, edge === 'start' ? t : sc.start, edge === 'end' ? t : sc.end, sessionEnd(), edge);
    setParts(SEC.withEnds(partList(), sessionEnd()).map(function (m) {
      return m.id === id ? Object.assign({}, m, { at_ms: Math.round(rr.start * 1000), end_ms: Math.round(rr.end * 1000) }) : m;
    }));
  }
  function splitPart(id) {
    var nid = newPartId(), sc = viewParts().find(function (x) { return x.id === id; });
    var after = sc && SEC.splitMarker(partList(), id, snapEdge(st.pos), sessionEnd(), nid, sc.name);
    if (!after) { L.toast('Leve o cursor para dentro da parte, onde ela deve ser dividida.'); return; }
    setParts(after);
    st.selPart = nid;
    L.toast('Dividida em ' + L.clock(snapEdge(st.pos)) + '. A parte nova está escolhida: dê o nome dela.');
    L.render();
  }
  function mergePart(id) {
    var after = SEC.mergeNext(partList(), id, sessionEnd());
    if (!after) { L.toast('Esta é a última parte: não há uma seguinte para juntar.'); return; }
    setParts(after);
  }
  function loopPart(sc) {
    st.loop = { a: sc.start, b: sc.end, name: sc.name };
    seek(sc.start);
    L.toast('Repetindo ' + sc.name + '.' + (st.playing ? '' : ' Toque em Tocar.'));
    restartIfPlaying();
    L.render();
  }
  function choosePart(id, seekTo) {
    st.selPart = id;
    var sc = viewParts().find(function (x) { return x.id === id; });
    if (sc && seekTo) seek(sc.start);
    L.render();
  }

  // Painel da ferramenta Partes.
  function partsPanel(b, hint) {
    var leader = L.perm.leader(), review = reviewing(), list = viewParts();
    var sel = st.selPart && list.find(function (x) { return x.id === st.selPart; });
    var out = [];
    if (st.auto && st.auto.busy) {
      out.push(h('button', { class: 'chiptog tbtn2 autobtn', disabled: true }, ic('WandSparkles', 15), 'Analisando a música…'));
      return out;
    }
    if (review) out.push(reviewBox(b));
    else out.push(h('button', { class: 'chiptog tbtn2 autobtn', onclick: detectParts }, ic('WandSparkles', 15), 'Detectar partes automaticamente'));

    if (sel) {
      var nameIn = h('input', { class: 'partname', type: 'text', maxlength: '40', value: sel.name, 'aria-label': 'Nome da parte', placeholder: 'Nome da parte',
        onkeydown: function (ev) { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') { ev.target.value = sel.name; ev.target.blur(); } },
        onchange: function (ev) { renamePart(sel.id, ev.target.value); } });
      var idx = list.indexOf(sel);
      out.push(h('div', { class: 'partedit' },
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
          h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: sel.color, flex: 'none' } }),
          nameIn,
          h('span', { class: 'muted mono small' }, L.clock(sel.start) + ' – ' + L.clock(sel.end))),
        h('div', { class: 'row wrap', style: { gap: '6px' } }, PART_NAMES.map(function (n) {
          return h('button', { class: 'chiptog tbtn2' + (n === sel.name ? ' on' : ''), onclick: function () { renamePart(sel.id, n); } }, n);
        })),
        h('div', { class: 'row wrap', style: { gap: '6px' } },
          b('Ouvir', function () { seek(sel.start); if (!st.playing) togglePlay(); else L.render(); }, 'Play'),
          b('Repetir', function () { loopPart(sel); }, 'Repeat'),
          b('Início no cursor', function () { setPartEdge(sel.id, 'start'); }, 'ArrowRightToLine'),
          b('Fim no cursor', function () { setPartEdge(sel.id, 'end'); }, 'ArrowLeftToLine'),
          b('Início ◀', function () { nudgePart(sel.id, 'start', -1); }),
          b('Início ▶', function () { nudgePart(sel.id, 'start', 1); }),
          b('Fim ◀', function () { nudgePart(sel.id, 'end', -1); }),
          b('Fim ▶', function () { nudgePart(sel.id, 'end', 1); }),
          b('Dividir no cursor', function () { splitPart(sel.id); }, 'Scissors'),
          idx < list.length - 1 ? b('Juntar com a seguinte', function () { mergePart(sel.id); }, 'Merge') : null,
          b('Apagar', function () { delPart(sel.id); }, 'Trash2', 'danger'),
          b('Pronto', function () { st.selPart = null; L.render(); }, 'Check')),
        hint('Arraste as pontas da parte na régua para mudar o tamanho, ou o meio para mover (gruda no click).')));
    }

    // Marcar uma parte nova no cursor: sempre à mão, mesmo com uma parte escolhida.
    var custom = h('input', { class: 'partname', type: 'text', maxlength: '40', placeholder: 'Outro nome', 'aria-label': 'Nome de uma parte nova',
      onkeydown: function (ev) { if (ev.key === 'Enter' && ev.target.value.trim()) addPart(ev.target.value.trim()); } });
    out.push(h('div', { class: 'partadd' },
      h('span', { class: 'thint' }, 'Marcar parte nova no cursor (' + L.clock(st.pos) + '). Dentro de uma parte, ela é dividida ali.'),
      h('div', { class: 'row wrap', style: { gap: '6px' } },
        PART_NAMES.map(function (n) { return b(n, function () { addPart(n); }, 'Plus'); }),
        h('span', { class: 'row', style: { gap: '6px' } }, custom, b('Marcar', function () { if (custom.value.trim()) addPart(custom.value.trim()); }, 'Plus')))));

    // Todas as partes: toque para escolher.
    if (list.length) {
      out.push(h('div', { class: 'hscroll autolist', style: { width: '100%' } }, list.map(function (sc) {
        return h('button', { class: 'partchip' + (sel && sel.id === sc.id ? ' on' : ''), style: { borderColor: sc.color, cursor: 'pointer' }, onclick: function () { choosePart(sc.id, true); } },
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: sc.color } }), sc.name,
          h('span', { class: 'muted mono', style: { fontWeight: 500 } }, L.clock(sc.start)));
      })));
    }
    if (!leader) return [hint('Só o líder marca as partes.')];
    return out;
  }

  // Caixa da revisão: o que foi detectado e como aplicar.
  function reviewBox(b) {
    var au = st.auto, info = au.info || {}, mine = sections(), sug = viewParts();
    var free = AutoParts.gaps(sug, mine);
    var note = (sug.length === 1 ? '1 parte sugerida' : sug.length + ' partes sugeridas') +
      (info.gridded ? (info.barsInferred ? ', nos tempos do click (o 1 do compasso deduzido pela música)' : ', nos compassos do click') : ', sem grade do click (bordas aproximadas)') +
      (info.lyrics ? ', nomes pela letra' : '') + (info.vocalStem ? '' : '. Sem faixa de voz, os nomes são palpites') +
      '. Elas aparecem listradas na régua. Antes de usar, corrija o que precisar: toque numa parte para renomear, dividir, juntar ou apagar, e arraste as pontas para ajustar.' +
      (au.cmp ? ' Bate com as suas: ' + au.cmp.bordersHit + ' de ' + au.cmp.bordersManual + ' bordas, ' + au.cmp.namesHit + ' de ' + au.cmp.namesChecked + ' nomes.' : '');
    var acts = mine.length
      ? [b('Preencher só onde não há parte', function () { applyAuto('fill'); }, 'Check', free.length ? 'on' : ''),
         b('Substituir as atuais', function () { applyAuto('replace'); }, 'Replace', 'danger')]
      : [b('Usar estas partes', function () { applyAuto('fill'); }, 'Check', 'on')];
    acts.push(b('Descartar', function () { endReview(); L.render(); }, 'X'));
    return h('div', { class: 'reviewbox' }, h('span', { class: 'thint' }, note), h('div', { class: 'row wrap', style: { gap: '8px' } }, acts));
  }

  // ---------- Detectar partes (lib/autoparts.js, o mesmo do painel): sugestão que o líder revisa antes de aplicar
  function detectParts() {
    if (!L.perm.leader() || (st.auto && st.auto.busy)) return;
    var tracks = targets().filter(function (tg) { return tg.kind === 'track'; });
    if (tracks.some(function (tg) { return tg.objectKey && !st.buffers[tg.key]; })) {
      L.toast('Espere todas as faixas carregarem para detectar as partes.');
      return;
    }
    endReview();
    st.auto = { busy: true };
    L.render();
    // Deixa a tela mostrar "Analisando…" antes da conta (alguns segundos numa música longa).
    setTimeout(function () {
      try {
        var stems = tracks.filter(function (tg) { return st.buffers[tg.key]; }).map(function (tg) {
          var buf = st.buffers[tg.key], rg = region(tg, editOf(tg.key)), sr = buf.sampleRate;
          var a = Math.max(0, Math.round((rg.a + rg.lead) * sr)), z = Math.min(buf.length, Math.round((rg.b + rg.lead) * sr));
          var data = new Float32Array(Math.max(0, z - a)), chans = Math.min(2, buf.numberOfChannels);
          for (var c = 0; c < chans; c++) { var ch = buf.getChannelData(c); for (var i = 0; i < data.length; i++) data[i] += ch[a + i] / chans; }
          return { name: tg.label, data: data, sr: sr, start: rg.start };
        });
        var beats = gridBeats();
        // Click sem acento (sem o 1 do compasso): vão só os tempos e o detector acha o 1 pela música.
        var grid = beats && beats.length ? { beats: beats, downbeats: st.grid.downbeats || [] } : null;
        var p = L.project(st.pid);
        var res = AutoParts.analyze({ stems: stems, duration: sessionEnd(), grid: grid, lyrics: p && p.lyrics });
        var mine = sections();
        if (!res.sections.length) {
          st.auto = null;
          L.toast('Não deu para achar as partes desta música (curta demais ou sem som).');
        } else {
          st.auto = { busy: false, info: res.info, cmp: mine.length ? AutoParts.compare(res.sections, mine, grid ? 1.0 : 2.0) : null,
            parts: res.sections.map(function (s) { return { id: 'sug-' + (++sugSeq), at_ms: Math.round(s.start * 1000), end_ms: Math.round(s.end * 1000), name: s.name }; }) };
          st.tool = 'partes';
        }
      } catch (e) {
        st.auto = null;
        L.toast('Não foi possível analisar a música: ' + ((e && e.message) || e));
      }
      L.render();
    }, 40);
  }

  // mode 'fill': só onde não há parte; 'replace': troca as atuais (depois de confirmar). Dá para desfazer.
  function applyAuto(mode) {
    if (!L.perm.leader() || !reviewing()) return;
    var sug = viewParts().map(function (s) { return { name: s.name, start: s.start, end: s.end }; });
    var mine = sections();
    var list = mode === 'replace' ? sug : AutoParts.gaps(sug, mine);
    if (!list.length) { L.toast('Todas as partes da música já estão marcadas. Use "Substituir as atuais" se quiser trocar.'); return; }
    var run = function () {
      endReview();
      var keep = mode === 'replace' ? [] : SEC.withEnds(st.markers, sessionEnd());
      setParts(keep.concat(list.map(function (s) {
        return { id: newPartId(), at_ms: Math.round(s.start * 1000), end_ms: Math.round(s.end * 1000), name: s.name };
      })));
      L.toast((list.length === 1 ? '1 parte marcada.' : list.length + ' partes marcadas.') + ' Toque numa parte para ajustar; Desfazer volta como estava.');
    };
    if (mode !== 'replace' || !mine.length) { run(); return; }
    L.dialog({
      title: 'Substituir as partes?',
      body: function () { return U.body('As ' + mine.length + ' partes marcadas agora saem e entram as ' + list.length + ' sugeridas. Se não gostar, Desfazer volta como estava.', null, 14); },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Manter as atuais'),
          h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () { close(); run(); } }, 'Substituir')];
      }
    });
  }

  /** Linha (faixa) embaixo do dedo; null = régua. */
  function laneAt(clientY) {
    return (st.ui.lanes || []).find(function (l) { var r = l.canvas.parentNode.parentNode.getBoundingClientRect(); return clientY >= r.top && clientY < r.bottom; }) || null;
  }
  /** Faixa colorida das partes, embaixo da régua (com folga para o dedo). */
  function inPartStrip(clientY) {
    var c = st.ui.ruler;
    if (!c) return false;
    var r = c.getBoundingClientRect();
    return clientY >= r.bottom - PART_H - 10 && clientY < r.bottom + 4;
  }
  /** Parte embaixo do dedo (só o líder): ponta ou meio. Vale também para a sugestão em revisão. */
  function partAt(x) {
    if (!L.perm.leader()) return null;
    var best = null;
    viewParts().forEach(function (sc) {
      var xa = xOf(sc.start), xb = xOf(sc.end), inside = x > xa && x < xb;
      // Parte estreita: as pontas pegam menos, para sobrar o meio.
      var reach = Math.min(HANDLE_PX / 2, Math.max(6, (xb - xa) / 3));
      [['start', Math.abs(x - xa)], ['end', Math.abs(x - xb)]].forEach(function (c) {
        if (c[1] > reach) return;
        var score = c[1] - (inside ? 0.5 : 0); // na divisa entre duas partes, ganha a que está sob o dedo
        if (!best || score < best.score) best = { id: sc.id, mode: c[0], start: sc.start, end: sc.end, score: score };
      });
      if (!best && inside) best = { id: sc.id, mode: 'move', start: sc.start, end: sc.end, score: 1e9 };
    });
    return best;
  }
  function inRuler(clientY) {
    var r = st.ui.ruler && st.ui.ruler.parentNode.parentNode.getBoundingClientRect();
    return !!r && clientY >= r.top && clientY < r.bottom;
  }

  /** Toque parado (sem arrastar), como o onToolTap do app. */
  function toolTap(lane, t, ruler) {
    var tool = st.tool, key = lane && lane.tg.key;
    var editTool = tool === 'mover' || tool === 'cortar' || tool === 'aparar';
    if (!ruler && editTool && key && !canEditKey(key)) {
      L.toast('Aqui você edita a sua voz. As faixas da banda e as vozes dos outros, só quem o líder liberou para editar o áudio.');
      return;
    }
    if (!ruler && key && (editTool || tool === 'volume') && st.sel !== key) { st.sel = key; st.split = null; L.render(); }
    if (!ruler && tool === 'cortar' && key) {
      var r = region(lane.tg, editOf(key)), at = (snapEdge(t) - r.shift) * 1000;
      var piece = pieces(rawEdit(key), durMs(key)).find(function (p) { return at > p[0] + 30 && at < p[1] - 30; });
      if (piece) { st.split = { key: key, at: Math.round(at), piece: piece }; L.render(); return; }
    }
    if (!ruler && tool === 'volume') return;
    seek(Math.max(0, Math.min(sessionEnd(), snapped(t))));
  }

  function wireArea(area) {
    var ptrs = {}, g = null, pinch = null, lastTap = { t: 0, x: -999 };
    function rel(ev) { var r = area.getBoundingClientRect(); return ev.clientX - r.left; }
    function count() { return Object.keys(ptrs).length; }
    function endGesture(revert) {
      if (g && revert && g.before && g.key) previewEdit(g.key, g.before);
      g = null; st.dragLabel = null;
    }
    // Perto da borda, arrastando algo, a música rola sozinha.
    function autoScroll(x) {
      var w = viewW(), d = 0;
      if (x < AUTOSCROLL_PX) d = -(AUTOSCROLL_PX - x); else if (x > w - AUTOSCROLL_PX) d = x - (w - AUTOSCROLL_PX);
      if (d) { st.view0 += d * 0.15 / pps(); clampView(); requestDraw(); }
    }

    area.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      try { area.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ }
      if (count() === 2) {
        // Segundo dedo: pinça (desfaz o que o primeiro dedo estava arrastando).
        endGesture(true);
        var ps = Object.keys(ptrs).map(function (k) { return ptrs[k]; });
        var cx = (ps[0].x + ps[1].x) / 2 - area.getBoundingClientRect().left;
        pinch = { d0: Math.max(20, Math.abs(ps[0].x - ps[1].x)), z0: st.zoom, t: tAtX(cx) };
        return;
      }
      if (count() > 2) return;
      var x = rel(ev), t = tAtX(x), ruler = inRuler(ev.clientY), lane = ruler ? null : laneAt(ev.clientY);
      var key = lane && lane.tg.key, tool = st.tool;
      var editsClips = tool === 'mover' || tool === 'cortar' || tool === 'aparar';
      var second = ev.timeStamp - lastTap.t < 380 && Math.abs(x - lastTap.x) < 40;
      var kind = null, extra = {};
      // Ferramenta Partes (líder): na faixa colorida da régua, as pontas de uma parte mudam o tamanho
      // e o meio move a parte. Um toque parado escolhe a parte.
      var hitPart = tool === 'partes' && ruler && inPartStrip(ev.clientY) ? partAt(x) : null;
      if (hitPart) {
        kind = 'part';
        extra = { id: hitPart.id, mode: hitPart.mode, s0: hitPart.start, e0: hitPart.end, before: SEC.copyMarkers(partList()) };
      } else if (tool === 'partes' && ruler && inPartStrip(ev.clientY) && second && L.perm.leader()) {
        var a0 = snapEdge(t), room = SEC.freeAround(viewParts(), a0, sessionEnd(), null);
        kind = 'partnew';
        extra = { a: Math.max(room.lo, Math.min(a0, room.hi)), lo: room.lo, hi: room.hi };
      }
      // Pontas do trecho de repetir: prioridade (menos quando a ferramenta edita a gravação).
      if (!kind && !editsClips && st.loop) {
        var da = Math.abs(x - xOf(st.loop.a)), db = Math.abs(x - xOf(st.loop.b));
        if (Math.min(da, db) <= HANDLE_PX / 2) { kind = 'edge'; extra.fixed = da <= db ? st.loop.b : st.loop.a; }
      }
      if (!kind && !editsClips && (second || (tool === 'repetir' && !ruler))) kind = 'create';
      if (!kind && !ruler && key && canEditKey(key)) {
        var r = region(lane.tg, editOf(key));
        if (tool === 'mover' && t >= r.start - EDGE_PX / pps() && t <= r.end + EDGE_PX / pps()) kind = 'move';
        if (tool === 'aparar') {
          var ds = Math.abs(x - xOf(r.start)), de = Math.abs(x - xOf(r.end));
          if (Math.min(ds, de) <= HANDLE_PX) { kind = 'trim'; extra.edge = ds <= de ? 1 : 2; extra.shift = r.shift; }
        }
      }
      g = { kind: kind, pending: true, x0: x, cx0: ev.clientX, view0: st.view0, t0: t, lane: lane, key: key, ruler: ruler, second: second, extra: extra,
        before: kind === 'move' || kind === 'trim' ? rawEdit(key) : null, inLoop: st.loop && t > st.loop.a && t < st.loop.b };
    });

    area.addEventListener('pointermove', function (ev) {
      if (!ptrs[ev.pointerId]) return;
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (pinch && count() >= 2) {
        var ps = Object.keys(ptrs).map(function (k) { return ptrs[k]; });
        var cx = (ps[0].x + ps[1].x) / 2 - area.getBoundingClientRect().left;
        st.zoom = Math.max(1, Math.min(maxZoom(), pinch.z0 * Math.abs(ps[0].x - ps[1].x) / pinch.d0));
        st.view0 = pinch.t - cx / pps();
        clampView(); requestDraw();
        return;
      }
      if (!g) return;
      var x = rel(ev);
      if (g.pending) {
        if (Math.abs(ev.clientX - g.cx0) < SLOP) return;
        g.pending = false;
        if (!g.kind) g.kind = 'pan';
      }
      var t = Math.max(0, Math.min(sessionEnd(), tAtX(x)));
      if (g.kind === 'pan') {
        st.view0 = g.view0 - (ev.clientX - g.cx0) / pps();
        clampView(); requestDraw();
        return;
      }
      autoScroll(x);
      if (g.kind === 'part') {
        var pe = g.extra, pm = marker(pe.id), total = sessionEnd(), rr;
        if (!pm) return;
        if (pe.mode === 'move') {
          var ns = snapEdge(pe.s0 + (t - g.t0));
          rr = SEC.clampRange(viewParts(), pe.id, ns, ns + (pe.e0 - pe.s0), total, 'move');
        } else if (pe.mode === 'start') rr = SEC.clampRange(viewParts(), pe.id, snapEdge(t), pe.e0, total, 'start');
        else rr = SEC.clampRange(viewParts(), pe.id, pe.s0, snapEdge(t), total, 'end');
        pm.at_ms = Math.round(rr.start * 1000); pm.end_ms = Math.round(rr.end * 1000);
        st.dragLabel = pe.mode === 'end' ? rr.end : rr.start;
        requestDraw();
        return;
      }
      if (g.kind === 'partnew') {
        var pb = Math.max(g.extra.lo, Math.min(g.extra.hi, snapEdge(t)));
        st.partDraft = { a: Math.min(g.extra.a, pb), b: Math.max(g.extra.a, pb) };
        st.dragLabel = pb; requestDraw();
        return;
      }
      if (g.kind === 'edge') {
        var v = snapEdge(t); st.loop = { a: Math.min(g.extra.fixed, v), b: Math.max(g.extra.fixed, v), name: 'o trecho escolhido' }; st.dragLabel = v; requestDraw();
      } else if (g.kind === 'create') {
        var a0 = snapEdge(g.t0), v2 = snapEdge(t);
        if (Math.abs(v2 - a0) > 0.05) st.loop = { a: Math.min(a0, v2), b: Math.max(a0, v2), name: 'o trecho escolhido' };
        st.dragLabel = v2; requestDraw();
      } else if (g.kind === 'move') {
        // A gravação anda com o dedo; o começo gruda no tempo do click (ímã).
        var e = rawEdit(g.key), r0 = region(g.lane.tg, Object.assign(blankEdit(), g.before, { offset_ms: g.before.offset_ms || 0 }));
        var start = snapEdge(r0.start + (t - g.t0));
        e.offset_ms = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round((g.before.offset_ms || 0) + (start - r0.start) * 1000)));
        previewEdit(g.key, e); st.dragLabel = start;
      } else if (g.kind === 'trim') {
        var e2 = rawEdit(g.key), fileMs = (snapEdge(t) - g.extra.shift) * 1000, dur = durMs(g.key);
        var endMs = e2.trim_end_ms === null || e2.trim_end_ms === undefined ? dur : e2.trim_end_ms;
        if (g.extra.edge === 1) e2.trim_start_ms = Math.round(Math.max(0, Math.min(endMs - 250, fileMs)));
        else { var vv = Math.round(Math.min(dur, Math.max((e2.trim_start_ms || 0) + 250, fileMs))); e2.trim_end_ms = vv >= dur ? null : vv; }
        previewEdit(g.key, e2); st.dragLabel = snapEdge(t);
      }
    });

    function up(ev, cancel) {
      if (!ptrs[ev.pointerId]) return;
      delete ptrs[ev.pointerId];
      if (pinch) { if (count() < 2) pinch = null; g = null; return; }
      if (!g) return;
      var d = g; g = null; st.dragLabel = null;
      if (d.kind === 'partnew') {
        var dr = st.partDraft; st.partDraft = null;
        if (!cancel && !d.pending && dr && dr.b - dr.a >= SEC.MIN_LEN) {
          var nid = newPartId(), nm = SEC.suggestName(viewParts(), dr.a);
          setParts(SEC.withEnds(partList(), sessionEnd()).concat([{ id: nid, at_ms: Math.round(dr.a * 1000), end_ms: Math.round(dr.b * 1000), name: nm }]));
          st.selPart = nid;
          L.toast(nm + ' marcado. Escolha o nome certo no painel.');
          L.render();
        } else requestDraw();
        return;
      }
      if (d.kind === 'part') {
        if (cancel) { replaceParts(d.extra.before); requestDraw(); return; }
        st.selPart = d.extra.id;
        if (d.pending) { L.render(); return; }   // toque parado: escolhe a parte
        setParts(SEC.copyMarkers(partList()), { before: d.extra.before });
        return;
      }
      if (cancel) { if (d.before && d.key) previewEdit(d.key, d.before); requestDraw(); return; }
      var x = rel(ev), t = tAtX(x);
      if (d.pending) {
        // Toque parado. Dois toques dentro do trecho: apaga o trecho.
        if (d.second && d.inLoop && st.tool !== 'mover' && st.tool !== 'cortar' && st.tool !== 'aparar') { st.loop = null; lastTap = { t: 0, x: -999 }; L.render(); restartIfPlaying(); return; }
        lastTap = { t: ev.timeStamp, x: x };
        toolTap(d.lane, t, d.ruler);
        return;
      }
      lastTap = { t: 0, x: -999 };
      if (d.kind === 'edge' || d.kind === 'create') {
        if (st.loop && st.loop.b - st.loop.a < 0.25) st.loop = null;
        L.render(); restartIfPlaying();
      } else if (d.kind === 'move' || d.kind === 'trim') {
        st.sel = d.key;
        commitEdit(d.key, d.before, rawEdit(d.key));
      }
    }
    area.addEventListener('pointerup', function (ev) { up(ev, false); });
    area.addEventListener('pointercancel', function (ev) { up(ev, true); });
    // Computador: roda do mouse com Ctrl (ou pinça do touchpad) = zoom; Shift ou rolagem lateral = andar.
    area.addEventListener('wheel', function (ev) {
      if (ev.ctrlKey || ev.metaKey) { ev.preventDefault(); zoomTo(st.zoom * Math.exp(-ev.deltaY * 0.0025), rel(ev)); return; }
      var dx = ev.shiftKey ? ev.deltaY : ev.deltaX;
      if (Math.abs(dx) > Math.abs(ev.shiftKey ? 0 : ev.deltaY) || ev.shiftKey) { ev.preventDefault(); st.view0 += dx / pps(); clampView(); requestDraw(); }
    }, { passive: false });
  }
  function markSelected() {
    (st.ui.lanes || []).forEach(function (l) { l.canvas.parentNode.parentNode.classList.toggle('sel', l.tg.key === st.sel); });
  }

  // ------------------------------------------------------------------ Tela
  L.screen('studio', function (route) {
    if (!st || st.pid !== route.id) { if (st) pause(); load(route.id); }
    var p = L.project(route.id);
    var u = st.ui = {};
    var top = h('div', { class: 'top' }, U.iconBtn('ChevronLeft', 'Voltar', L.back),
      h('div', { class: 'grow', style: { minWidth: 0, padding: '0 4px' } },
        h('div', { class: 'hi semi ell', style: { fontSize: '16px' } }, p ? p.song_title : 'Estúdio'),
        h('div', { class: 'muted small ell' }, p ? [p.artist, L.keyToPlay(p) ? 'Tom ' + L.keyToPlay(p) : null, p.bpm ? p.bpm + ' BPM' : null].filter(Boolean).join(' · ') : '')),
      p && p.lyrics ? U.iconBtn('FileText', st.lyrics ? 'Esconder a letra' : 'Mostrar a letra', function () { st.lyrics = !st.lyrics; L.store.set('estudio_letra', st.lyrics); L.render(); }, { color: st.lyrics ? 'var(--accent-text)' : null }) : null,
      U.iconBtn('Users', 'Vozes para estudar', voicesSheet, { color: st.voices.length ? 'var(--accent-text)' : null, badge: st.voices.length || null }),
      U.iconBtn('CircleHelp', 'Como usar', helpDialog));
    var root = h('div', { class: 'studio' }, top);
    var body = h('div', { class: 'scroll' });
    root.appendChild(body);

    if (st.error) {
      body.appendChild(U.empty(st.error));
      body.appendChild(U.btn2('Tentar de novo', 'RotateCcw', function () { st = null; L.render(); }));
      return root;
    }
    if (st.loading) {
      u.loadText = h('div', { class: 'muted small' }, st.loading);
      u.loadBar = h('i', { style: { width: (st.total ? st.done / st.total * 100 : 5) + '%' } });
      body.appendChild(h('div', { class: 'col', style: { gap: '10px', padding: '40px 8px' } }, h('div', { class: 'hi semi' }, 'Preparando o estúdio'),
        h('div', { class: 'loading-bar' }, u.loadBar), u.loadText,
        U.body('Na primeira vez demora um pouco: o áudio de cada instrumento vem da nuvem. Use Wi-Fi se puder.', 'var(--muted)', 12)));
      return root;
    }
    if (!st.tracks.length) {
      body.appendChild(U.empty('Esta música ainda não tem multitrack. Quem cuida das músicas envia as faixas pelo app ou aqui no site, em Repertório › a música › Editar música.'));
      return root;
    }

    // Visor: tempo e parte.
    var s = sectionAt(st.pos);
    u.clock = h('span', { class: 'mono hi', style: { fontSize: '26px', fontWeight: 600 } }, L.clock(st.pos));
    u.secDot = h('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: s ? s.color : 'transparent', flex: 'none' } });
    u.secName = h('span', { class: 'hi semi ell' }, s ? s.name : '—');
    body.appendChild(h('div', { class: 'row display', style: { gap: '14px' } },
      h('div', { class: 'col', style: { gap: 0 } }, u.clock, h('span', { class: 'tiny muted', style: { letterSpacing: '1px' } }, 'TEMPO · ' + L.clock(sessionEnd()))),
      h('div', { style: { width: '1px', alignSelf: 'stretch', background: 'var(--line)' } }),
      h('div', { class: 'col grow', style: { gap: '2px', minWidth: 0 } }, h('div', { class: 'row', style: { gap: '6px' } }, u.secDot, u.secName),
        h('span', { class: 'tiny', style: { letterSpacing: '1px', color: st.loop ? 'var(--accent-text)' : 'var(--muted)' } }, st.loop ? 'REPETINDO · ' + st.loop.name.toUpperCase() : 'PARTE'))));

    // Ferramentas (como numa DAW), em cima das partes.
    selTarget();
    body.appendChild(toolbar());
    body.appendChild(toolPanel());

    // Partes: atalhos para pular.
    var list = sections();
    if (st.tool === 'partes') u.parts = [];   // a lista das partes já está no painel da ferramenta
    else if (list.length) {
      u.parts = list.map(function (sc) {
        var b = h('button', { class: 'chiptog' + (s && s.id === sc.id ? ' on' : ''), 'data-id': sc.id, onclick: function () { goTo(sc.start); } },
          h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: sc.color, flex: 'none' } }), sc.name);
        return b;
      });
      body.appendChild(h('div', { class: 'hscroll' }, u.parts));
    } else body.appendChild(U.body('O líder ainda não marcou as partes (Intro, Verso, Refrão…) desta música.', 'var(--muted)', 12));

    if (st.lyrics) { u.lyric = h('div', { class: 'lyric col', style: { gap: '2px' } }, lyricNodes()); body.appendChild(u.lyric); }

    // Faixas como numa DAW: uma linha para cada faixa, com a onda dela e o volume dela.
    // Tocar ou arrastar na régua ou nas ondas muda o cursor (não começa a tocar).
    var gone = anySolo();
    u.lanes = [];
    var laneRows = targets().map(function (tg) {
      var vol = volOf(tg.key), muted = mutedOf(tg.key), solo = !!st.solo[tg.key];
      var pct = h('span', { class: 'mono muted pct', style: { fontSize: '11px', width: '34px', textAlign: 'right', flex: 'none' } }, vol + '%');
      var range = h('input', { type: 'range', class: 'vol', min: '0', max: '150', step: '1', value: String(vol), 'aria-label': 'Volume de ' + tg.label, style: { '--p': (vol / 150 * 100) + '%' } });
      range.addEventListener('input', function () {
        var v = Number(range.value);
        st.mix[tg.key] = v; pct.textContent = v + '%'; range.style.setProperty('--p', (v / 150 * 100) + '%');
        if (st.vgs[tg.key]) applyGains();
      });
      range.addEventListener('change', saveMix);
      var loaded = !!st.buffers[tg.key];
      var canvas = h('canvas');
      u.lanes.push({ tg: tg, canvas: canvas });
      var off = muted || (gone && !solo);
      var head = h('div', { class: 'lhead' },
        h('div', { class: 'row', style: { gap: '6px', minWidth: 0 } },
          h('span', { style: { color: tg.kind === 'track' ? U.colorFor(tg.key) : 'var(--accent-light)', flex: 'none' } }, ic(tg.kind === 'track' ? instrumentIcon(tg.label) : 'Mic', 15)),
          h('span', { class: 'nm ell grow' }, tg.label)),
        h('div', { class: 'row', style: { gap: '5px' } },
          h('button', { class: 'mini' + (muted ? ' m' : ''), 'aria-pressed': muted ? 'true' : 'false', 'aria-label': 'Mudo de ' + tg.label, onclick: function () {
            if (muted) delete st.mix['m:' + tg.key]; else st.mix['m:' + tg.key] = 1;
            saveMix(); applyGains(); L.render();
          } }, 'M'),
          h('button', { class: 'mini' + (solo ? ' s' : ''), 'aria-pressed': solo ? 'true' : 'false', 'aria-label': 'Solo de ' + tg.label, onclick: function () {
            st.solo[tg.key] = !solo; applyGains(); L.render();
          } }, 'S'),
          range, loaded ? pct : h('span', { class: 'muted pct', style: { fontSize: '11px', flex: 'none' } }, '…')));
      // Tocar no nome escolhe a faixa que as ferramentas vão editar.
      head.addEventListener('click', function (ev) { if (ev.target.closest('button, input')) return; st.sel = tg.key; st.split = null; L.render(); });
      return h('div', { class: 'lane' + (off ? ' off' : '') + (tg.kind !== 'track' ? ' voice' : '') + (st.sel === tg.key ? ' sel' : '') }, head, h('div', { class: 'lwave' }, canvas));
    });
    u.ruler = h('canvas');
    u.head = h('span', { class: 'dawhead' });
    var area = h('div', { class: 'dawarea', role: 'slider', 'aria-label': 'Posição na música' }, u.head);
    u.area = area;
    wireArea(area);
    u.zoomOut = h('button', { class: 'zbtn', 'aria-label': 'Afastar', onclick: function () { zoomButton(0.5); } }, ic('ZoomOut', 16));
    u.zoomIn = h('button', { class: 'zbtn', 'aria-label': 'Aproximar', onclick: function () { zoomButton(2); } }, ic('ZoomIn', 16));
    area.dataset.tool = st.tool;
    body.appendChild(h('div', { class: 'row' }, U.label('Faixas'), h('span', { class: 'grow' }),
      U.textBtn('Volume original', function () { st.mix = {}; st.solo = {}; saveMix(); applyGains(); L.render(); })));
    body.appendChild(h('div', { class: 'daw' },
      h('div', { class: 'lane rulerlane' }, h('div', { class: 'lhead' }, h('div', { class: 'row', style: { gap: '6px' } },
        h('span', { class: 'muted tiny grow', style: { letterSpacing: '0.06em' } }, st.grid && st.grid.downbeats && st.grid.downbeats.length ? 'COMPASSOS' : 'TEMPO'), u.zoomOut, u.zoomIn),
        h('span', { class: 'tiny partlbl' + (st.tool === 'partes' && L.perm.leader() ? ' on' : '') }, 'PARTES')), h('div', { class: 'lwave' }, u.ruler)),
      laneRows, area));
    if (st.otherTakes.length && !st.voices.length) {
      body.appendChild(U.btn2('Ouvir as vozes para estudar', 'Users', voicesSheet, { full: true }));
    }
    body.appendChild(U.body('Para gravar a sua voz por cima, use o app de Android.', 'var(--muted)', 12));

    // Transporte.
    root.appendChild(h('div', { class: 'transport' },
      tbtn('SkipBack', 'Início', function () { goTo(st.loop ? st.loop.a : 0); }),
      tbtn('ChevronsLeft', 'Voltar', function () { jump(-1); }),
      tbtn(st.playing ? 'Pause' : 'Play', st.playing ? 'Pausar' : 'Tocar', togglePlay, 'big'),
      tbtn('ChevronsRight', 'Avançar', function () { jump(1); }),
      tbtn('Repeat', 'Repetir', toggleLoop, st.loop ? 'on' : '')));

    requestAnimationFrame(function () { if (st && st.ui === u) drawDaw(); });
    return root;
  });

  function tbtn(icon, label, fn, cls) {
    return h('button', { class: 'tbtn' + (cls ? ' ' + cls : ''), onclick: fn, 'aria-label': label }, h('span', { class: 'c' }, ic(icon, cls === 'big' ? 28 : 22)), label);
  }

  function instrumentIcon(name) {
    var n = L.norm(name);
    if (/click|metro|guia|cue/.test(n)) return 'Timer';
    if (/bater|drum|kick|snare|bumbo|caixa|prato|perc/.test(n)) return 'Drum';
    if (/baix|bass/.test(n)) return 'AudioWaveform';
    if (/guit|viol|gtr/.test(n)) return 'Guitar';
    if (/tecl|key|piano|synth|pad|org/.test(n)) return 'Piano';
    if (/voz|vox|vocal|coro|choir|bv/.test(n)) return 'Mic';
    return 'AudioLines';
  }

  function voicesSheet() {
    if (!st || st.loading) return;
    if (!st.otherTakes.length) {
      L.toast('Ainda não tem voz liberada para estudar nesta música.');
      return;
    }
    var groups = L.studyGroups(st.otherTakes);
    var part = L.store.get('naipe.' + st.pid, null);
    var me = L.me();
    if (part !== null && !groups.some(function (g) { return g[0] === part; })) part = null;
    if (part === null && me && groups.some(function (g) { return g[0] === me.voice_type; })) part = me.voice_type;
    var busy = null;
    var sheet = L.sheet(function () {
      var shown = groups.filter(function (g) { return part === null || g[0] === part; });
      return [h('div', { class: 'row' }, ic('Users', 20, 'accent'), h('div', { class: 'hi bold', style: { fontSize: '19px' } }, 'Vozes para estudar')),
        U.body('Escolha a voz que você quer aprender e toque na gravação de quem cantou. Ela toca junto com a multitrack. Dá para ligar mais de uma.', 'var(--muted)', 13),
        h('div', { class: 'hscroll' }, [U.toggle('Todas', part === null, null, function () { part = null; L.store.set('naipe.' + st.pid, null); sheet.refresh(); })].concat(groups.map(function (g) {
          return U.toggle((g[0] ? VoiceParts.label(g[0]) : 'Sem voz marcada') + ' · ' + g[1].length, part === g[0], null, function () { part = g[0]; L.store.set('naipe.' + st.pid, part); sheet.refresh(); });
        }))),
        shown.map(function (g) {
          return [U.label(g[0] ? VoiceParts.label(g[0]) : 'Sem voz marcada'), g[1].map(function (t) {
            var on = st.voices.indexOf(t.id) >= 0;
            return h('div', { class: 'pickrow' + (on ? ' on' : ''), style: { minHeight: '60px' },
              onclick: function () { if (!busy) toggleVoice(t, !on); } },
              U.avatar(L.member(t.user_id), 36),
              h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi ell' }, L.nameOf(t.user_id)),
                h('div', { class: 'muted small' }, [t.voice_part ? VoiceParts.label(t.voice_part) : null, L.clock(t.duration_ms / 1000), busy === t.id ? 'baixando…' : null, t.released_for_rehearsal ? null : 'ainda não liberada'].filter(Boolean).join(' · '))),
              busy === t.id ? h('div', { class: 'spinner', style: { width: '20px', height: '20px' } }) : h('span', { style: { color: on ? 'var(--accent-text)' : 'var(--muted)' } }, ic(on ? 'Volume2' : 'Play', 20)));
          })];
        })];
    });
    function toggleVoice(t, on) {
      if (!on) {
        st.voices = st.voices.filter(function (x) { return x !== t.id; });
        L.studyVoices.set(st.pid, st.voices);
        sheet.refresh(); L.render(); restartIfPlaying();
        return;
      }
      busy = t.id; sheet.refresh();
      decode({ key: 'take:' + t.id, objectKey: t.file.object_key }).then(function () {
        st.voices = st.voices.concat([t.id]);
        L.studyVoices.set(st.pid, st.voices);
      }).catch(function (e) { L.toast(L.errorText(e)); }).finally(function () {
        busy = null; sheet.refresh(); L.render(); restartIfPlaying();
      });
    }
  }

  function helpDialog() {
    L.dialog({
      title: 'Como usar o estúdio',
      body: function () {
        return [
          U.body('▶ Tocar começa a música. Ela só toca ou pausa por esse botão.', null, 14),
          U.body('Toque ou arraste na linha do tempo para escolher de onde tocar. As cores no alto são as partes (Intro, Verso, Refrão…).', null, 14),
          U.body('Os botões com as partes levam direto para cada uma. ⏪ e ⏩ vão para a parte anterior ou a próxima.', null, 14),
          U.body('Repetir: fica repetindo a parte onde o cursor está, até você tocar de novo em Repetir.', null, 14),
          U.body('Em cada faixa: arraste para mudar o volume, M deixa muda e S toca só ela. Vale só no seu celular.', null, 14),
          U.body('👥 no alto: ligue a voz de quem já gravou para aprender a sua parte.', null, 14)
        ];
      },
      actions: function (close) { return [h('button', { class: 'textbtn', onclick: close }, 'Entendi')]; }
    });
  }

  // Tecla de espaço no computador: tocar/pausar.
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' || !st || L.route().name !== 'studio') return;
    if (/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
    e.preventDefault(); togglePlay();
  });

  L.studio = {
    /** Chamado a cada desenho: saiu do estúdio, a música para e a memória do áudio é liberada. */
    check: function () { if (st && L.route().name !== 'studio') L.studio.stopAll(); },
    stopAll: function () { if (!st) return; pause(); st = null; }
  };
})();
