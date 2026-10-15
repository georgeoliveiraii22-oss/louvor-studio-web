// Grade pelo click (sem DOM nem áudio), testável com Node. O app Android usa o mesmo método
// (BeatGrid.kt); a grade detectada é salva em `beat_grids` e vale para web, Android e iPhone.
//
// Não é uma grade matemática (BPM fixo): cada linha cai no ataque de um "tic" do click.
// Se o click acelera, atrasa ou muda de andamento, a grade acompanha.
//
// Como um tic é reconhecido:
//   1. o volume sobe de repente (bem acima do que havia logo antes);
//   2. e some rápido (cai a 30% do pico em até 150 ms).
// Sons longos no click, como uma voz avisando "verso" ou "refrão", não passam no item 2.
// O primeiro tempo do compasso é o tic diferente dos outros: mais forte ("volume") ou
// mais agudo ("tom"). Se nenhum se destaca, a grade fica sem compassos.
(function (root) {
  'use strict';

  var VERSION = 1;
  var MIN_GAP_MS = 60;      // tics mais próximos que isso são o mesmo tic
  var RISE = 3;             // subida mínima em relação aos 12 ms anteriores
  var FLOOR = 0.05;         // ignora o que estiver 26 dB abaixo do tic mais forte
  var DECAY_TO = 0.3;       // um tic cai a 30% do pico...
  var DECAY_MS = 150;       // ...em até 150 ms
  var ATTACK_AT = 0.1;      // o ataque é a primeira amostra com 10% do pico
  var ECHO_MS = 200;        // até 200 ms depois de um tic...
  var ECHO_MIN = 0.35;      // ...outro só conta se tiver 35% do volume dele (senão é eco)
  var CLICK_NAME = /click|metro|clique|clic\b|\bclk\b|\bbpm\b/;

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Acha os tics. `channels`: lista de Float32Array (um por canal); `sr`: taxa de amostragem.
  // Retorna { beats: [segundos no arquivo], downbeats: [índices], beatsPerBar, accent }.
  function detect(channels, sr) {
    var nch = channels.length;
    var n = nch ? channels[0].length : 0;
    var empty = { beats: [], downbeats: [], beatsPerBar: null, accent: null, version: VERSION };
    if (!n || !sr) return empty;

    // Envelope de pico em janelas de 1 ms.
    var hop = Math.max(1, Math.round(sr / 1000));
    var frames = Math.floor(n / hop);
    var env = new Float32Array(frames);
    var gmax = 0;
    var c, i, j, d, v, m;
    for (var f = 0; f < frames; f++) {
      m = 0;
      var s0 = f * hop;
      var s1 = s0 + hop;
      for (c = 0; c < nch; c++) {
        d = channels[c];
        for (i = s0; i < s1; i++) {
          v = d[i] < 0 ? -d[i] : d[i];
          if (v > m) m = v;
        }
      }
      env[f] = m;
      if (m > gmax) gmax = m;
    }
    if (gmax < 0.003) return empty;

    // Primeiro, o critério normal; se achar poucos tics (click com cauda longa, vazamento de
    // outro som), tenta de novo com um critério mais tolerante e fica com o que achou mais.
    var found = scan(channels, sr, env, frames, hop, gmax, STRICT);
    var pass = 'normal';
    var durSec = n / sr;
    if (found.length < Math.max(8, durSec / 4)) {
      var loose = scan(channels, sr, env, frames, hop, gmax, LOOSE);
      // Só aceita se tiver ritmo de click (intervalos parecidos), para não confundir com voz.
      if (loose.length > found.length && steady(loose)) { found = loose; pass = 'tolerante'; }
    }

    var cls = classify(found);
    return {
      beats: found.map(function (b) { return b.t; }),
      downbeats: cls.downbeats,
      beatsPerBar: cls.beatsPerBar,
      accent: cls.accent,
      pass: pass,
      version: VERSION
    };
  }

  // Ritmo constante: a maioria dos intervalos é parecida com o anterior (±15%).
  function steady(found) {
    if (found.length < 8) return false;
    var ok = 0;
    for (var i = 2; i < found.length; i++) {
      var r = (found[i].t - found[i - 1].t) / (found[i - 1].t - found[i - 2].t);
      if (r > 0.85 && r < 1.15) ok++;
    }
    return ok / (found.length - 2) >= 0.6;
  }

  var STRICT = { floor: FLOOR, rise: RISE, decayTo: DECAY_TO, decayMs: DECAY_MS };
  var LOOSE = { floor: 0.02, rise: 2, decayTo: 0.5, decayMs: 300 };

  // Uma passada pelo envelope procurando tics com os critérios `P`.
  function scan(channels, sr, env, frames, hop, gmax, P) {
    var nch = channels.length;
    var n = channels[0].length;
    var c, j, d, v;
    var floor = gmax * P.floor;
    var found = [];
    var last = -1e9;
    var lastPk = -1e9;
    var lastPv = 0;
    var k = 3;
    while (k < frames) {
      v = env[k];
      if (v < floor || k - last < MIN_GAP_MS) { k++; continue; }

      var a = Math.max(0, k - 14);
      var b = Math.max(0, k - 2);
      var sum = 0;
      for (j = a; j < b; j++) sum += env[j];
      var pre = b > a ? sum / (b - a) : 0;
      if (v < pre * P.rise + gmax * 0.01) { k++; continue; }

      var pk = k;
      var pv = v;
      var lim = Math.min(frames, k + 25);
      for (j = k; j < lim; j++) if (env[j] > pv) { pv = env[j]; pk = j; }

      // Eco/reverberação do tic anterior: logo depois de um tic, só vale outro com volume parecido.
      if (pk - lastPk < ECHO_MS && pv < lastPv * ECHO_MIN) { k = pk + 1; continue; }

      var end = -1;
      lim = Math.min(frames, pk + P.decayMs);
      for (j = pk; j < lim; j++) if (env[j] < pv * P.decayTo) { end = j; break; }
      if (end < 0) {
        // Som longo (voz, aviso falado): não é tic. Pula até ele baixar.
        j = pk;
        while (j < frames && env[j] >= pv * P.decayTo) j++;
        k = j;
        continue;
      }

      // Ataque: primeira amostra que chega a 10% do pico.
      var thr = pv * ATTACK_AT;
      var x0 = Math.max(0, (k - 3) * hop);
      var x1 = Math.min(n, (pk + 1) * hop);
      var at = x0;
      search: for (var x = x0; x < x1; x++) {
        for (c = 0; c < nch; c++) {
          d = channels[c][x];
          if (d >= thr || d <= -thr) { at = x; break search; }
        }
      }

      // Brilho do tic: cruzamentos por zero nos primeiros 8 ms (tic agudo cruza mais).
      var w1 = Math.min(n, at + Math.max(1, Math.round(sr * 0.008)));
      var hyst = pv * 0.05;
      var zc = 0;
      var prev = 0;
      var ch0 = channels[0];
      for (x = at; x < w1; x++) {
        var y = ch0[x];
        var sg = y > hyst ? 1 : y < -hyst ? -1 : 0;
        if (sg !== 0) {
          if (prev !== 0 && sg !== prev) zc++;
          prev = sg;
        }
      }
      found.push({ t: at / sr, amp: pv, zcr: zc / Math.max(1e-3, ((w1 - at) / sr) * 1000) });
      last = k;
      lastPk = pk;
      lastPv = pv;
      k = end;
    }
    return found;
  }

  // Separa os valores em dois grupos pelo maior salto. O grupo menor é o acento.
  function split(values, minGap, preferHigh) {
    var s = values.slice().sort(function (p, q) { return p - q; });
    var best = 0;
    var idx = -1;
    for (var i = 0; i + 1 < s.length; i++) {
      var g = s[i + 1] - s[i];
      if (g > best) { best = g; idx = i; }
    }
    if (idx < 0 || best < minGap) return null;
    var thr = (s[idx] + s[idx + 1]) / 2;
    var highFrac = (s.length - idx - 1) / s.length;
    var high;
    if (highFrac <= 0.45) high = true;
    else if (highFrac >= 0.55) high = false;
    else high = preferHigh;
    var frac = high ? highFrac : 1 - highFrac;
    if (frac < 0.05) return null;
    return { thr: thr, high: high, score: best / minGap };
  }

  function classify(found) {
    var none = { downbeats: [], beatsPerBar: null, accent: null };
    if (found.length < 8) return none;
    var opts = [];
    var vol = split(found.map(function (b) { return 20 * Math.log10(b.amp); }), 2.5, true);
    if (vol) opts.push({ accent: 'volume', s: vol, key: function (b) { return 20 * Math.log10(b.amp); } });
    var tone = split(found.map(function (b) { return Math.log2(b.zcr + 0.05); }), 0.2, true);
    if (tone) opts.push({ accent: 'tom', s: tone, key: function (b) { return Math.log2(b.zcr + 0.05); } });
    opts.sort(function (p, q) { return q.s.score - p.s.score; });

    for (var o = 0; o < opts.length; o++) {
      var opt = opts[o];
      var down = [];
      found.forEach(function (b, i) {
        var val = opt.key(b);
        if (opt.s.high ? val > opt.s.thr : val < opt.s.thr) down.push(i);
      });
      var bpb = periodicity(down);
      if (bpb) return { downbeats: down, beatsPerBar: bpb, accent: opt.accent };
    }
    return none;
  }

  // Quantos tempos por compasso (o intervalo mais comum entre acentos), se for consistente.
  function periodicity(down) {
    if (down.length < 3) return null;
    var count = {};
    for (var i = 1; i < down.length; i++) {
      var gap = down[i] - down[i - 1];
      count[gap] = (count[gap] || 0) + 1;
    }
    var best = 0;
    var bestN = 0;
    Object.keys(count).forEach(function (g) {
      if (count[g] > bestN) { bestN = count[g]; best = Number(g); }
    });
    if (best < 2 || best > 16) return null;
    return bestN / (down.length - 1) >= 0.5 ? best : null;
  }

  // Índice do tempo mais perto de t (lista em ordem crescente).
  function nearestIndex(beats, t) {
    var lo = 0;
    var hi = beats.length - 1;
    if (hi < 0) return -1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (beats[mid] <= t) lo = mid; else hi = mid;
    }
    return Math.abs(beats[lo] - t) <= Math.abs(beats[hi] - t) ? lo : hi;
  }

  // Ímã: devolve o tempo da grade se t estiver a até `maxDist`; senão, null.
  function snap(beats, t, maxDist) {
    var i = beats && beats.length ? nearestIndex(beats, t) : -1;
    if (i < 0) return null;
    return Math.abs(beats[i] - t) <= maxDist ? beats[i] : null;
  }

  // Número do compasso de cada início de compasso (1, 2, 3...), na ordem.
  function barStarts(grid) {
    if (!grid || !grid.downbeats || !grid.downbeats.length) return [];
    return grid.downbeats.map(function (idx, n) { return { index: idx, bar: n + 1 }; });
  }

  // Sugere a faixa do click pelo nome.
  function guessClickTrack(tracks) {
    for (var i = 0; i < tracks.length; i++) if (CLICK_NAME.test(norm(tracks[i].name))) return tracks[i];
    return null;
  }

  // Linha do banco <-> grade em segundos.
  function fromRow(row) {
    if (!row) return null;
    return {
      trackId: row.track_id,
      beats: (row.beats_ms || []).map(function (ms) { return Number(ms) / 1000; }),
      downbeats: row.downbeats || [],
      beatsPerBar: row.beats_per_bar || null,
      accent: row.accent || null,
      saved: true
    };
  }

  function toRow(projectId, trackId, grid) {
    return {
      project_id: projectId,
      track_id: trackId,
      beats_ms: grid.beats.map(function (s) { return Math.round(s * 10000) / 10; }),
      downbeats: grid.downbeats,
      beats_per_bar: grid.beatsPerBar,
      accent: grid.accent,
      detector_version: VERSION
    };
  }

  // Quanto o navegador deixou de atraso do codificador MP3 no começo do áudio decodificado.
  // A grade é guardada no tempo do decodificador do app (dr_mp3, que remove esse atraso);
  // no navegador, somamos este valor de volta para as linhas caírem sobre a forma de onda.
  function decoderLead(scan, decodedSec) {
    if (!scan || scan.encoderDelay === null || scan.encoderDelay === undefined || !scan.sampleRate) return 0;
    var expected = scan.expectedPcmFrames / scan.sampleRate;
    var extra = decodedSec - expected;
    var head = (scan.encoderDelay + 529) / scan.sampleRate;
    var tail = Math.max((scan.encoderPadding || 0) - 529, 0) / scan.sampleRate;
    var tol = 0.004;
    if (Math.abs(extra - (head + tail)) < tol) return head;   // não cortou nada
    if (Math.abs(extra - tail) < tol) return 0;               // cortou só o começo (ou ambíguo)
    if (Math.abs(extra - head) < tol) return head;            // cortou só o fim
    return 0;
  }

  var api = {
    VERSION: VERSION, detect: detect, nearestIndex: nearestIndex, snap: snap, barStarts: barStarts,
    guessClickTrack: guessClickTrack, fromRow: fromRow, toRow: toRow, decoderLead: decoderLead
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeatGrid = api;
})(typeof window !== 'undefined' ? window : globalThis);
