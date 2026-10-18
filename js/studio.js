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
    var s = await sb.storage.from('audio').createSignedUrl(tg.objectKey, 3600);
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

  // Desenho de cada faixa (como numa DAW): o pico de cada coluna, na linha do tempo da sessão.
  function computeWave() { st.waves = {}; }
  function waveOf(tg) {
    st.waves = st.waves || {};
    if (st.waves[tg.key]) return st.waves[tg.key];
    var buf = st.buffers[tg.key];
    if (!buf) return null;
    var end = sessionEnd(), wave = new Float32Array(BINS);
    var r = region(tg, editOf(tg.key)), data = buf.getChannelData(0), rate = buf.sampleRate;
    for (var i = 0; i < BINS; i++) {
      var t0 = i / BINS * end, t1 = (i + 1) / BINS * end;
      var a = Math.max(t0, r.start), b = Math.min(t1, r.end);
      if (b <= a) continue;
      var s0 = Math.floor((a - r.shift + r.lead) * rate), s1 = Math.min(data.length, Math.floor((b - r.shift + r.lead) * rate));
      var step = Math.max(1, Math.floor((s1 - s0) / 200)), max = 0;
      for (var j = Math.max(0, s0); j < s1; j += step) { var v = Math.abs(data[j]); if (v > max) max = v; }
      wave[i] = max;
    }
    var peak = 0;
    for (var k = 0; k < BINS; k++) peak = Math.max(peak, wave[k]);
    if (peak > 0) for (var m = 0; m < BINS; m++) wave[m] /= peak;
    st.waves[tg.key] = wave;
    return wave;
  }

  async function load(pid) {
    var p = L.project(pid);
    st = { pid: pid, loading: 'Carregando a música…', done: 0, total: 0, error: null, tracks: [], myTake: null, otherTakes: [], edits: {}, markers: [],
      buffers: {}, leads: {}, voices: L.studyVoices.get(pid), mix: L.store.get('mix.' + pid, {}), solo: {}, playing: false, pos: 0, loop: null,
      nodes: [], vgs: {}, wave: null, lyrics: !!(p && p.lyrics) && L.store.get('estudio_letra', window.innerWidth >= 1024), ui: {} };
    var mine = st;
    try {
      var r = await Promise.all([
        sb.from('tracks').select('id,name,gain,timeline_offset_ms,sort_order,source_file:files(object_key)').eq('project_id', pid).order('sort_order'),
        sb.from('takes').select('*,file:files(object_key)').eq('project_id', pid).order('created_at', { ascending: false }),
        sb.from('audio_edits').select('*').eq('project_id', pid).eq('published', true),
        sb.from('song_markers').select('*').eq('project_id', pid).order('at_ms')
      ]);
      if (st !== mine) return;
      st.tracks = L.must(r[0]);
      var takes = L.must(r[1]).filter(function (t) { return t.file && t.file.object_key; });
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

  function fitCanvas(c) {
    var dpr = window.devicePixelRatio || 1, w = c.clientWidth, hh = c.clientHeight;
    if (!w || !hh) return null;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    return { g: g, w: w, h: hh };
  }

  /** Régua: as partes coloridas, as marcas de tempo e o trecho que está repetindo. */
  function drawRuler() {
    var c = st.ui.ruler;
    var f = c && fitCanvas(c);
    if (!f) return;
    var g = f.g, w = f.w, hh = f.h, end = sessionEnd(), x = function (t) { return t / end * w; };
    sections().forEach(function (sc) {
      g.fillStyle = sc.color; g.globalAlpha = 0.9;
      g.fillRect(x(sc.start) + 0.5, 3, Math.max(1, x(sc.end) - x(sc.start) - 1), 17);
      g.globalAlpha = 1;
      if (x(sc.end) - x(sc.start) > 28) { g.fillStyle = '#050B12'; g.font = '600 10px Geist, system-ui, sans-serif'; g.fillText(sc.name, x(sc.start) + 4, 15, x(sc.end) - x(sc.start) - 6); }
    });
    // Marcas de tempo com espaço para o número (mais espaçadas em tela estreita).
    var stepS = [5, 10, 15, 30, 60, 120].find(function (v) { return v / end * w >= 44; }) || 120;
    g.fillStyle = '#8FA9BF'; g.font = '500 10px "Geist Mono", ui-monospace, monospace';
    for (var t = 0; t <= end; t += stepS) {
      g.fillRect(Math.round(x(t)), hh - 7, 1, 7);
      if (x(t) + 30 < w) g.fillText(L.clock(t), x(t) + 3, hh - 1);
    }
    if (st.loop) { g.fillStyle = 'rgba(8,169,245,0.22)'; g.fillRect(x(st.loop.a), 22, x(st.loop.b) - x(st.loop.a), hh - 22); }
  }

  /** Onda de uma faixa, na cor dela. */
  function drawLane(tg, c) {
    var f = fitCanvas(c);
    if (!f) return;
    var g = f.g, w = f.w, hh = f.h, wave = waveOf(tg);
    var color = tg.kind === 'track' ? U.colorFor(tg.key) : '#63D4FF';
    if (st.loop) { var end = sessionEnd(); g.fillStyle = 'rgba(8,169,245,0.10)'; g.fillRect(st.loop.a / end * w, 0, (st.loop.b - st.loop.a) / end * w, hh); }
    if (!wave) { g.fillStyle = 'rgba(220,232,242,0.08)'; g.fillRect(0, hh / 2 - 1, w, 2); return; }
    var mid = hh / 2, amp = hh / 2 - 4, bw = w / BINS;
    g.fillStyle = color;
    for (var i = 0; i < BINS; i++) {
      var v = Math.max(0.015, wave[i]) * amp;
      g.fillRect(i * bw, mid - v, Math.max(1, bw - 0.5), v * 2);
    }
  }

  function drawDaw() {
    var u = st.ui;
    if (!u.ruler) return;
    drawRuler();
    (u.lanes || []).forEach(function (l) { drawLane(l.tg, l.canvas); });
    placeHead();
  }

  /** Cursor de tempo: uma linha só, que atravessa a régua e todas as faixas. */
  function placeHead() {
    var hd = st.ui.head;
    if (hd) hd.style.left = (Math.max(0, Math.min(1, st.pos / sessionEnd())) * 100) + '%';
  }

  function dawSeek(ev, area) {
    var r = area.getBoundingClientRect();
    var t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * sessionEnd();
    st.pos = t;
    paintPosition();
    return t;
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
      body.appendChild(U.empty('Esta música ainda não tem multitrack. Quem cuida das músicas envia as faixas pelo app ou pelo painel.'));
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

    // Partes: atalhos para pular.
    var list = sections();
    if (list.length) {
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
      return h('div', { class: 'lane' + (off ? ' off' : '') + (tg.kind !== 'track' ? ' voice' : '') }, head, h('div', { class: 'lwave' }, canvas));
    });
    u.ruler = h('canvas');
    u.head = h('span', { class: 'dawhead' });
    var area = h('div', { class: 'dawarea', role: 'slider', 'aria-label': 'Posição na música' }, u.head);
    var dragging = false;
    area.addEventListener('pointerdown', function (ev) { dragging = true; area.setPointerCapture(ev.pointerId); dawSeek(ev, area); });
    area.addEventListener('pointermove', function (ev) { if (dragging) dawSeek(ev, area); });
    area.addEventListener('pointerup', function (ev) { if (!dragging) return; dragging = false; var t = dawSeek(ev, area); if (st.loop) { var sc = sectionAt(t); if (sc) st.loop = { a: sc.start, b: sc.end, name: sc.name }; } seek(t); if (st.loop) L.render(); });
    area.addEventListener('pointercancel', function () { dragging = false; });
    body.appendChild(h('div', { class: 'row' }, U.label('Faixas'), h('span', { class: 'grow' }),
      U.textBtn('Volume original', function () { st.mix = {}; st.solo = {}; saveMix(); applyGains(); L.render(); })));
    body.appendChild(h('div', { class: 'daw' },
      h('div', { class: 'lane rulerlane' }, h('div', { class: 'lhead' }, h('span', { class: 'muted tiny', style: { letterSpacing: '0.06em' } }, 'PARTES · TEMPO')), h('div', { class: 'lwave' }, u.ruler)),
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
