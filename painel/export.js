// Louvor Studio — Exportação em WAV (seção 3.5 do documento).
// Renderiza fora de tempo real (OfflineAudioContext) com as edições publicadas, na taxa da
// sessão e com a duração oficial da sessão (silêncios preservados). MP3 fica para depois
// (licença do codificador a verificar).
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }
  var M = window.EditMath;

  var ex = {
    el: null,
    projectId: null,
    loadedFor: null,
    loading: '',
    items: [],        // { key, kind, label, objectKey, row, edit, selected }
    mode: 'mix',
    bits: 24,
    busy: false,
    log: []
  };

  function project() {
    return A().state().projects.find(function (p) { return p.id === ex.projectId; }) || null;
  }

  function blank() {
    return { trim_start_ms: 0, trim_end_ms: null, offset_ms: 0, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0 };
  }

  function load() {
    var sb = A().client();
    var pid = ex.projectId;
    ex.loadedFor = pid;
    ex.loading = 'Carregando faixas…';
    paint();
    return Promise.all([
      sb.from('tracks').select('id,name,gain,timeline_offset_ms,sort_order,source_file:files(object_key)').eq('project_id', pid).order('sort_order'),
      sb.from('takes').select('*,file:files(object_key)').eq('project_id', pid).order('created_at', { ascending: false }),
      sb.from('audio_edits').select('*').eq('project_id', pid)
    ]).then(function (r) {
      var must = A().must;
      var edits = {};
      must(r[2]).forEach(function (e) {
        // Exporta o que a equipe ouve: só edições publicadas.
        if (e.published) edits[e.take_id ? 'take:' + e.take_id : 'track:' + e.track_id] = e;
      });
      ex.items = must(r[0]).map(function (t) {
        return { key: 'track:' + t.id, kind: 'track', label: t.name, objectKey: t.source_file && t.source_file.object_key, row: t, edit: edits['track:' + t.id] || null, selected: true };
      }).concat(must(r[1]).map(function (t) {
        return { key: 'take:' + t.id, kind: 'take', label: A().nameOf(t.user_id) + ' · ' + t.name, objectKey: t.file && t.file.object_key, row: t, edit: edits['take:' + t.id] || null,
          selected: t.review_status === 'aprovada' };
      }));
      ex.loading = '';
      paint();
    }).catch(function (e) {
      ex.loading = '';
      A().flash('err', A().friendly(e));
      A().rerender();
    });
  }

  function decodeAll(items, sampleRate, say) {
    var sb = A().client();
    var buffers = {};
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var decoder = new Off(2, 1, sampleRate);
    ex.leads = {};
    return items.reduce(function (chain, it, i) {
      return chain.then(function () {
        say('Baixando ' + (i + 1) + ' de ' + items.length + ': ' + it.label);
        return sb.storage.from('audio').createSignedUrl(it.objectKey, 3600);
      }).then(function (res) {
        if (res.error) throw res.error;
        return fetch(res.data.signedUrl);
      }).then(function (r) {
        if (!r.ok) throw new Error('Falha ao baixar ' + it.label + ' (' + r.status + ').');
        return r.arrayBuffer();
      }).then(function (data) {
        var scan = null;
        try { scan = window.Mp3Scan ? Mp3Scan.scanMp3(new Uint8Array(data)) : null; } catch (e) { scan = null; }
        return new Promise(function (resolve, reject) {
          decoder.decodeAudioData(data, resolve, function () { reject(new Error('O navegador não conseguiu ler ' + it.label + '.')); });
        }).then(function (audio) { return { audio: audio, scan: scan }; });
      }).then(function (r) {
        buffers[it.key] = r.audio;
        ex.leads[it.key] = window.BeatGrid ? BeatGrid.decoderLead(r.scan, r.audio.duration) : 0;
      });
    }, Promise.resolve()).then(function () { return buffers; });
  }

  function shiftOf(it, e) {
    if (it.kind === 'track') return ((it.row.timeline_offset_ms || 0) + e.offset_ms) / 1000;
    return ((it.row.start_ms || 0) - (Number(it.row.rtl_ms) || 0) + (it.row.offset_ms || 0) + e.offset_ms) / 1000;
  }

  // Mesmo posicionamento e envelope do estúdio, começando do zero da sessão.
  function scheduleInto(ctx, it, buf, sessionSec) {
    // `lead`: atraso do codificador MP3 que o navegador deixou no começo (o app não tem).
    var lead = (ex.leads && ex.leads[it.key]) || 0;
    var refDur = buf.duration - lead;
    var e = it.edit ? M.clampEdit(it.edit, Math.round(refDur * 1000)) : blank();
    var a = e.trim_start_ms / 1000;
    var b = e.trim_end_ms === null ? refDur : e.trim_end_ms / 1000;
    var shift = shiftOf(it, e);
    var plan = M.playPlan(0, a + lead, b + lead, shift - lead, buf.duration, sessionSec);
    if (!plan) return;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    src.connect(g);
    g.connect(ctx.destination);
    var base = it.kind === 'track' ? (Number(it.row.gain) || 1) : 1;
    var start = a + shift;
    var end = b + shift;
    var fi = e.fade_in_ms / 1000;
    var fo = e.fade_out_ms / 1000;
    function env(t) { return base * M.envelopeAt(t, start, end, e.gain_db, fi, fo); }
    var t1 = Math.max(0, plan.regionStart);
    g.gain.setValueAtTime(env(t1), t1);
    if (fi > 0) g.gain.linearRampToValueAtTime(env(start + fi), start + fi);
    if (fo > 0 && end - fo < plan.regionEnd) {
      var foStart = Math.max(t1, end - fo);
      g.gain.setValueAtTime(env(foStart), foStart);
      g.gain.linearRampToValueAtTime(env(plan.regionEnd), plan.regionEnd);
    }
    M.cutWindows(e.cuts, shift, t1, plan.regionEnd).forEach(function (w) {
      g.gain.setValueAtTime(env(w[0]), w[0]);
      g.gain.linearRampToValueAtTime(0, w[0] + 0.006);
      g.gain.setValueAtTime(0, w[1]);
      g.gain.linearRampToValueAtTime(env(w[1]), w[1] + 0.006);
    });
    src.start(plan.startDelay, plan.bufferOffset, plan.duration);
  }

  function render(items, buffers, sessionSec, sampleRate) {
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var frames = Math.round(sessionSec * sampleRate);
    var ctx = new Off(2, frames, sampleRate);
    items.forEach(function (it) { scheduleInto(ctx, it, buffers[it.key], sessionSec); });
    return ctx.startRendering();
  }

  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'audio';
  }

  function download(buf, name) {
    var url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function run() {
    var p = project();
    var chosen = ex.items.filter(function (it) { return it.selected && it.objectKey; });
    if (!p || !chosen.length || ex.busy) return;
    var sessionSec = p.session_duration_ms / 1000;
    var sr = p.sample_rate;
    var expected = Math.round(sessionSec * sr);
    ex.busy = true;
    ex.log = [];
    function say(t) { ex.log.push(t); paintLog(); }
    paint();

    decodeAll(chosen, sr, say).then(function (buffers) {
      var jobs = ex.mode === 'mix'
        ? [{ name: slug(p.song_title) + '-mix-' + ex.bits + 'bit.wav', items: chosen }]
        : chosen.map(function (it) { return { name: slug(p.song_title) + '-' + slug(it.label) + '-' + ex.bits + 'bit.wav', items: [it] }; });
      return jobs.reduce(function (chain, job) {
        return chain.then(function () {
          say('Renderizando ' + job.name + '…');
          return render(job.items, buffers, sessionSec, sr);
        }).then(function (out) {
          var chans = [out.getChannelData(0), out.numberOfChannels > 1 ? out.getChannelData(1) : out.getChannelData(0)];
          var wav = window.Wav.encodeWav(chans, sr, ex.bits);
          var info = window.Wav.inspectWav(wav);
          var ok = info.frames === expected && info.sampleRate === sr;
          say((ok ? '✓ ' : '⚠ ') + job.name + ': ' + A().fmtTime(info.frames / sr * 1000) + ', ' + info.frames + ' quadros' +
            (ok ? ' (duração da sessão conferida)' : ' (esperado ' + expected + ')'));
          download(wav, job.name);
        });
      }, Promise.resolve());
    }).then(function () {
      ex.busy = false;
      say('Pronto. Os arquivos foram para a pasta de downloads do navegador.');
      paint();
    }).catch(function (e) {
      ex.busy = false;
      say('✗ ' + A().friendly(e));
      paint();
    });
  }

  var logEl = null;
  function paintLog() {
    if (logEl) logEl.textContent = ex.log.join('\n');
  }

  function paint() {
    if (!ex.el) return;
    var S = A().state();
    var el = ex.el;
    el.innerHTML = '';
    var p = project();

    var projSel = h('select', { 'aria-label': 'Projeto', onchange: function () { ex.projectId = projSel.value; load(); } },
      S.projects.map(function (x) { return h('option', { value: x.id, selected: x.id === ex.projectId }, x.song_title + ' · ' + x.name); }));

    el.appendChild(h('h1', null, 'Exportar'));
    el.appendChild(h('p', { class: 'mu', style: 'margin-top:0' }, 'Baixe a mix ou cada faixa em WAV, com as edições publicadas e a duração exata da música. A gravação original nunca é alterada.'));
    el.appendChild(h('div', { class: 'card' }, h('label', { class: 'f' }, 'Música', projSel)));
    if (ex.loading) { el.appendChild(h('div', { class: 'msg info' }, ex.loading)); return; }
    if (!p) return;

    function seg(options, current, onPick) {
      return h('div', { class: 'seg', role: 'group', style: 'margin:0' }, options.map(function (o) {
        return h('button', { class: o.value === current ? 'on' : '', disabled: o.disabled, title: o.title || null, onclick: function () { if (!o.disabled) onPick(o.value); } }, o.label);
      }));
    }

    var chosen = ex.items.filter(function (it) { return it.selected; });
    var frames = Math.round(p.session_duration_ms / 1000 * p.sample_rate);
    var perFile = window.Wav.estimateBytes(frames, 2, ex.bits);
    var total = ex.mode === 'mix' ? perFile : perFile * chosen.length;

    el.appendChild(h('div', { class: 'grid' },
      h('div', { class: 'card stack' },
        h('span', { class: 'sec', style: 'margin:0' }, 'O que exportar'),
        seg([{ value: 'mix', label: 'Mix completa' }, { value: 'separadas', label: 'Faixas separadas' }], ex.mode, function (v) { ex.mode = v; paint(); }),
        h('p', { class: 'mu', style: 'margin:0;font-size:13px' }, ex.mode === 'mix'
          ? 'Um arquivo com tudo o que estiver marcado abaixo, somado.'
          : 'Um arquivo por faixa marcada, todos com a mesma duração e alinhados na linha do tempo.')
      ),
      h('div', { class: 'card stack' },
        h('span', { class: 'sec', style: 'margin:0' }, 'Formato'),
        seg([{ value: 'wav', label: 'WAV' }, { value: 'mp3', label: 'MP3 (em breve)', disabled: true, title: 'A licença do codificador MP3 ainda precisa ser verificada.' }], 'wav', function () {}),
        seg([{ value: 16, label: '16 bits' }, { value: 24, label: '24 bits' }], ex.bits, function (v) { ex.bits = v; paint(); }),
        h('p', { class: 'mu', style: 'margin:0;font-size:13px' }, p.sample_rate + ' Hz (taxa da sessão) · ' + A().fmtTime(p.session_duration_ms) + ' · cerca de ' + (total / 1048576).toFixed(1).replace('.', ',') + ' MB no total')
      )
    ));

    var tracks = ex.items.filter(function (it) { return it.kind === 'track'; });
    var takes = ex.items.filter(function (it) { return it.kind === 'take'; });
    function checkRow(it) {
      return h('label', { class: 'row', style: 'gap:10px;min-height:40px' },
        h('input', { type: 'checkbox', checked: it.selected, onchange: function (ev) { it.selected = ev.target.checked; paint(); } }),
        Icons.icon(it.kind === 'take' ? 'take' : Icons.instrumentFor(it.label), 15, 'ic-mu'),
        h('span', { style: 'flex:1' }, it.label),
        it.edit ? h('span', { class: 'chip go', title: 'Com edição publicada' }, Icons.icon('edit', 11), 'editada') : null,
        it.kind === 'take'
          ? (it.row.review_status === 'aprovada' ? h('span', { class: 'chip ok' }, Icons.icon('approved', 11), 'Aprovada')
            : it.row.review_status === 'refazer' ? h('span', { class: 'chip bad' }, Icons.icon('redo2', 11), 'Refazer')
            : h('span', { class: 'chip' }, Icons.icon('pending', 11), 'Pendente'))
          : null
      );
    }
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row sp-b' }, h('h2', { style: 'margin:0' }, 'Faixas incluídas'),
        h('div', { class: 'row', style: 'gap:6px' },
          h('button', { class: 'btn link', onclick: function () { ex.items.forEach(function (it) { it.selected = true; }); paint(); } }, 'Marcar todas'),
          h('button', { class: 'btn link', onclick: function () { ex.items.forEach(function (it) { it.selected = false; }); paint(); } }, 'Desmarcar'))),
      tracks.length ? h('div', null, h('p', { class: 'sec', style: 'margin:12px 0 4px' }, 'Base'), tracks.map(checkRow)) : null,
      takes.length ? h('div', null, h('p', { class: 'sec', style: 'margin:12px 0 4px' }, 'Vozes'), takes.map(checkRow)) : null
    ));

    el.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn', disabled: ex.busy || !chosen.length, onclick: run }, Icons.icon('download', 15), ex.busy ? 'Exportando…' : (ex.mode === 'mix' ? 'Exportar mix' : 'Exportar ' + chosen.length + ' arquivos'))
    ));
    logEl = h('div', { class: 'list-log', style: 'margin-top:14px' });
    el.appendChild(logEl);
    paintLog();
  }

  function view() {
    var S = A().state();
    if (!S.projects.length) return h('div', null, h('h1', null, 'Exportar'), h('p', { class: 'mu' }, 'Ainda não há músicas para exportar.'));
    if (!ex.el) ex.el = h('div');
    if (!ex.projectId || !S.projects.some(function (p) { return p.id === ex.projectId; })) ex.projectId = S.projects[0].id;
    if (ex.loadedFor !== ex.projectId) load();
    else paint();
    return ex.el;
  }

  window.ExportPage = { view: view };
})();
