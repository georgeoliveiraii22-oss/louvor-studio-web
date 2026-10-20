// Detectar as partes da música automaticamente (Intro, Verso, Refrão, Ponte…), sem DOM e sem serviço
// externo: tudo é calculado aqui, a partir das faixas da multitrack. Testável com Node.
//
// Como funciona (análise de estrutura musical clássica):
//  1. A música é dividida em compassos (pela grade do click; sem grade, em blocos de ~2 s).
//  2. Em cada compasso: as notas que soam (croma), o "colorido" do som (bandas de frequência) e a
//     energia de cada faixa (voz, bateria, baixo…). A faixa de click e a guia não entram na mistura.
//  3. A música é comparada com ela mesma (matriz de autossimilaridade): onde ela muda, nasce uma
//     borda; os trechos que se repetem viram o mesmo grupo (o refrão é o que mais se repete).
//  4. As bordas grudam em frases de 4 compassos; a faixa guia ("Refrão!") e as marcações da letra
//     ([Verso], [Refrão]) ajudam quando existem.
//  5. Os nomes saem por regras: sem voz no começo = Intro, no fim = Final; o grupo com voz que mais
//     se repete e é mais cheio = Refrão; e assim por diante.
// O resultado é sempre uma sugestão: o líder revisa e ajusta na faixa de seções, como hoje.
(function (root) {
  'use strict';

  var TARGET_SR = 11025;   // análise em 11 kHz (bastante para notas e timbre, e rápido)
  var FFT_N = 4096;
  var HOP = 2048;

  // ------------------------------------------------------------------ Papéis das faixas pelo nome
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function roleOf(name) {
    var n = norm(name);
    if (/click|metro|clique/.test(n)) return 'click';
    if (/guia|guide|cue|vozguia|count|contagem/.test(n)) return 'guide';
    if (/voz|vocal|vox|lead|ministr|back|bv|coro|choir|harmon|soprano|contralto|tenor/.test(n)) return 'vocal';
    if (/drum|bateria|bat\b|kick|bumbo|snare|caixa|tom|perc|loop/.test(n)) return 'drums';
    if (/bass|baixo/.test(n)) return 'bass';
    return 'inst';
  }

  // ------------------------------------------------------------------ Áudio → 11 kHz mono
  function downsample(data, sr) {
    var f = Math.max(1, Math.round(sr / TARGET_SR));
    var n = Math.floor(data.length / f);
    var out = new Float32Array(n);
    for (var i = 0, j = 0; i < n; i++) {
      var s = 0;
      for (var k = 0; k < f; k++) s += data[j++];
      out[i] = s / f;
    }
    return { data: out, sr: sr / f };
  }

  // FFT real (radix-2, no lugar). re/im de tamanho N.
  function fft(re, im) {
    var n = re.length, i, j = 0, k, m, t;
    for (i = 1; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (m = 2; m <= n; m <<= 1) {
      var ang = -2 * Math.PI / m, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += m) {
        var cr = 1, ci = 0;
        for (k = 0; k < m / 2; k++) {
          var a = i + k, b = a + m / 2;
          var tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  // Croma (12 notas) e 8 bandas de timbre por quadro de análise.
  function spectralFrames(x, sr) {
    var n = Math.max(0, Math.floor((x.length - FFT_N) / HOP) + 1);
    var win = new Float32Array(FFT_N);
    for (var i = 0; i < FFT_N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_N - 1));
    // Para cada posição do espectro: qual nota e qual banda.
    var half = FFT_N / 2, pc = new Int8Array(half), band = new Int8Array(half);
    var edges = [60, 150, 300, 600, 1200, 2400, 4000, 5500];
    for (var b = 0; b < half; b++) {
      var hz = b * sr / FFT_N;
      pc[b] = hz >= 55 && hz <= 2000 ? ((Math.round(12 * Math.log2(hz / 440)) % 12) + 12 + 9) % 12 : -1; // 0 = Dó
      var bi = -1;
      for (var e = 0; e < edges.length - 1; e++) if (hz >= edges[e] && hz < edges[e + 1]) bi = e;
      band[b] = bi;
    }
    var chroma = [], tim = [], re = new Float32Array(FFT_N), im = new Float32Array(FFT_N);
    for (var f = 0; f < n; f++) {
      var off = f * HOP;
      for (i = 0; i < FFT_N; i++) { re[i] = x[off + i] * win[i]; im[i] = 0; }
      fft(re, im);
      var c = new Float32Array(12), t = new Float32Array(7);
      for (b = 1; b < half; b++) {
        var mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
        if (pc[b] >= 0) c[pc[b]] += mag;
        if (band[b] >= 0) t[band[b]] += mag * mag;
      }
      chroma.push(c); tim.push(t);
    }
    return { chroma: chroma, tim: tim, hopSec: HOP / sr, winSec: FFT_N / sr };
  }

  // ------------------------------------------------------------------ Unidades (compassos)
  // grid: { beats: [s na linha do tempo], downbeats: [índices] } ou nulo.
  function units(grid, duration) {
    var out = [];
    if (grid && grid.beats && grid.beats.length > 8 && grid.downbeats && grid.downbeats.length > 2) {
      var starts = grid.downbeats.map(function (i) { return grid.beats[i]; }).filter(function (t) { return t >= 0 && t < duration; });
      var barLen = (starts[starts.length - 1] - starts[0]) / Math.max(1, starts.length - 1);
      // Antes do primeiro compasso (contagem, silêncio) e depois do último: blocos do mesmo tamanho.
      var pre = [];
      for (var t = starts[0] - barLen; t > -barLen * .5; t -= barLen) pre.unshift(Math.max(0, t));
      if (pre.length && pre[0] > 0.05) pre.unshift(0);
      starts = pre.concat(starts);
      var last = starts[starts.length - 1];
      while (last + barLen < duration - barLen * .25) { last += barLen; starts.push(last); }
      for (var i = 0; i < starts.length; i++) out.push({ start: starts[i], end: i + 1 < starts.length ? starts[i + 1] : duration, bar: true });
      return { list: out.filter(function (u) { return u.end - u.start > 0.2; }), barLen: barLen, gridded: true };
    }
    var len = 2.0;
    for (var s = 0; s < duration - 0.3; s += len) out.push({ start: s, end: Math.min(duration, s + len), bar: false });
    return { list: out, barLen: len, gridded: false };
  }

  // ------------------------------------------------------------------ Letra: [Verso], [Refrão]…
  function lyricLabels(lyrics) {
    var out = [];
    String(lyrics || '').split(/\r?\n/).forEach(function (ln) {
      var m = /^\s*\[([^\]]{1,30})\]\s*$/.exec(ln);
      if (m) out.push(canonical(m[1]) || m[1].trim());
    });
    return out;
  }
  function canonical(name) {
    var n = norm(name);
    if (/^pre|pre-?refr|pre-?coro/.test(n)) return 'Pré-refrão';
    if (/refr|coro|chorus/.test(n)) return 'Refrão';
    if (/vers|estrofe|verse/.test(n)) return 'Verso';
    if (/ponte|bridge/.test(n)) return 'Ponte';
    if (/intro|abertura|entrada/.test(n)) return 'Intro';
    if (/solo/.test(n)) return 'Solo';
    if (/instrument|interl/.test(n)) return 'Instrumental';
    if (/final|outro|fim|encerr|tag/.test(n)) return 'Final';
    return null;
  }

  // ------------------------------------------------------------------ Matemática pequena
  function cos(a, b) {
    var s = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na > 0 && nb > 0 ? s / Math.sqrt(na * nb) : 0;
  }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
  function std(a) { var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return a.length ? Math.sqrt(s / a.length) : 0; }
  function db(x) { return 10 * Math.log10(x + 1e-10); }

  /**
   * Analisa a música e devolve as partes sugeridas.
   * opts: {
   *   stems: [{ name, data: Float32Array (mono, já no tempo da linha do tempo: amostra 0 = segundo `start`), sr, start }],
   *   duration (s), grid ({beats, downbeats} na linha do tempo, ou nulo), lyrics (texto, opcional)
   * }
   * Volta: { sections: [{ name, start, end, conf }], info: {...} }
   */
  function analyze(opts) {
    var duration = opts.duration;
    var U = units(opts.grid, duration);
    var list = U.list, nU = list.length;
    if (nU < 4) return { sections: [], info: { reason: 'música curta demais' } };

    // Energia de cada faixa por unidade, e a mistura (sem click e guia) para croma/timbre.
    var mixSr = TARGET_SR, mixLen = Math.ceil(duration * mixSr), mix = new Float32Array(mixLen);
    var roles = {}, energy = {}, guide = null;
    opts.stems.forEach(function (s) {
      var role = roleOf(s.name);
      var d = downsample(s.data, s.sr), off = Math.round((s.start || 0) * d.sr);
      var e = new Float32Array(nU);
      for (var u = 0; u < nU; u++) {
        var a = Math.max(0, Math.round(list[u].start * d.sr) - off), b = Math.min(d.data.length, Math.round(list[u].end * d.sr) - off);
        var acc = 0;
        for (var i = a; i < b; i++) acc += d.data[i] * d.data[i];
        e[u] = b > a ? acc / (b - a) : 0;
      }
      if (role === 'guide') { guide = { d: d, off: off }; return; }
      if (role === 'click') return;
      roles[role] = roles[role] || [];
      roles[role].push(e);
      energy[s.name] = e;
      for (var j = 0; j < d.data.length; j++) { var k = j + off; if (k >= 0 && k < mixLen) mix[k] += d.data[j]; }
    });
    var sumRole = function (r) {
      var out = new Float32Array(nU);
      (roles[r] || []).forEach(function (e) { for (var u = 0; u < nU; u++) out[u] += e[u]; });
      return out;
    };
    var vocalE = sumRole('vocal'), drumE = sumRole('drums');
    var totalE = new Float32Array(nU);
    Object.keys(roles).forEach(function (r) { var e = sumRole(r); for (var u = 0; u < nU; u++) totalE[u] += e[u]; });
    var hasVocalStem = (roles.vocal || []).length > 0;

    // Voz presente em cada unidade: comparada com a parte mais alta da voz na música.
    var vDb = Array.prototype.map.call(vocalE, db), vRef = Math.max.apply(null, vDb);
    var vocalOn = vDb.map(function (v) { return hasVocalStem && v > vRef - 22; });
    var tDb = Array.prototype.map.call(totalE, db), tRef = Math.max.apply(null, tDb);
    var dDb = Array.prototype.map.call(drumE, db), dRef = Math.max.apply(null, dDb);

    // Croma e timbre por unidade.
    var sp = spectralFrames(mix, mixSr);
    var feat = [];
    for (var u = 0; u < nU; u++) {
      var fa = Math.max(0, Math.floor(list[u].start / sp.hopSec)), fb = Math.min(sp.chroma.length, Math.ceil(list[u].end / sp.hopSec));
      var c = new Float32Array(12), t = new Float32Array(7);
      for (var f = fa; f < fb; f++) { for (var q = 0; q < 12; q++) c[q] += sp.chroma[f][q]; for (q = 0; q < 7; q++) t[q] += sp.tim[f][q]; }
      var cm = Math.max.apply(null, c) || 1;
      var v = [];
      for (q = 0; q < 12; q++) v.push(c[q] / cm);
      var ts = 0;
      for (q = 0; q < 7; q++) ts += t[q];
      for (q = 0; q < 7; q++) v.push(0.6 * (ts > 0 ? Math.sqrt(t[q] / ts) : 0));
      v.push(vocalOn[u] ? 0.9 : 0);                                    // voz ou não
      v.push(Math.max(0, (dDb[u] - dRef + 30) / 30) * 0.7);            // bateria
      v.push(Math.max(0, (tDb[u] - tRef + 30) / 30) * 0.7);            // volume geral
      feat.push(v);
    }

    // Autossimilaridade e curva de "novidade" (Foote): onde a música muda.
    var S = [];
    for (var i = 0; i < nU; i++) { S.push(new Float32Array(nU)); for (var j = 0; j < nU; j++) S[i][j] = i === j ? 1 : (j < i ? S[j][i] : cos(feat[i], feat[j])); }
    var K = Math.min(8, Math.max(2, Math.floor(nU / 8)));
    var nov = new Float32Array(nU);
    for (i = 1; i < nU; i++) {
      var s1 = 0, n1 = 0;
      for (var a = -K; a < K; a++) for (var b = -K; b < K; b++) {
        var x = i + a, y = i + b;
        if (x < 0 || y < 0 || x >= nU || y >= nU) continue;
        var w = ((a < 0) === (b < 0) ? 1 : -1) * Math.exp(-((a + .5) * (a + .5) + (b + .5) * (b + .5)) / (2 * K * K * .45));
        s1 += w * S[x][y]; n1 += Math.abs(w);
      }
      nov[i] = n1 ? Math.max(0, s1 / n1) : 0;
    }
    // Mudanças de voz e de volume também contam.
    for (i = 1; i < nU; i++) {
      if (vocalOn[i] !== vocalOn[i - 1]) nov[i] += 0.12;
      nov[i] += Math.min(0.15, Math.abs(tDb[i] - tDb[i - 1]) / 60) + Math.min(0.12, Math.abs(dDb[i] - dDb[i - 1]) / 60);
    }

    // Avisos falados na faixa guia: a parte começa no compasso seguinte ao aviso.
    var cueBoost = new Float32Array(nU), cues = 0;
    if (guide) {
      var gd = guide.d, hop = Math.round(gd.sr * 0.05), env = [];
      for (i = 0; i + hop <= gd.data.length; i += hop) { var acc = 0; for (j = i; j < i + hop; j++) acc += gd.data[j] * gd.data[j]; env.push(db(acc / hop)); }
      var gRef = Math.max.apply(null, env), on = false, startAt = 0;
      for (i = 0; i < env.length; i++) {
        var loud = env[i] > gRef - 18;
        if (loud && !on) { on = true; startAt = i; }
        if (!loud && on) {
          on = false;
          var dur = (i - startAt) * 0.05;
          if (dur > 0.15 && dur < 2.5) { // fala curta (não é o click)
            var tCue = (i * hop - guide.off) / gd.sr;
            for (u = 0; u < nU; u++) if (list[u].start >= tCue - 0.05) { cueBoost[u] = 1; cues++; break; }
          }
        }
      }
    }

    // Bordas: picos da novidade, pelo menos 4 compassos de distância, de preferência em frase de 4.
    var minGap = U.gridded ? 4 : 4;
    var thr = mean(nov) + 0.35 * std(nov);
    var cand = [];
    for (i = 1; i < nU; i++) {
      var score = nov[i] + cueBoost[i] * 0.6;
      var peak = (i === nU - 1 || nov[i] >= nov[i + 1]) && nov[i] >= nov[i - 1];
      if ((peak && nov[i] > thr) || cueBoost[i]) cand.push({ i: i, s: score });
    }
    cand.sort(function (p, q) { return q.s - p.s; });
    var cuts = [0];
    cand.forEach(function (c) {
      if (cuts.every(function (k) { return Math.abs(k - c.i) >= minGap; })) cuts.push(c.i);
    });
    cuts.sort(function (p, q) { return p - q; });
    // Frase de 4 compassos: puxa a borda para o múltiplo de 4 mais perto (contado do primeiro com voz ou música).
    if (U.gridded) {
      var first = 0;
      for (u = 0; u < nU; u++) if (tDb[u] > tRef - 30) { first = u; break; }
      cuts = cuts.map(function (k) {
        if (k === 0 || cueBoost[k]) return k;
        var r = (k - first) % 4, alt = r <= 2 ? k - r : k + (4 - r);
        return Math.abs(nov[alt] || 0) >= 0.6 * nov[k] && alt > 0 && alt < nU ? alt : k;
      }).filter(function (k, idx, arr) { return arr.indexOf(k) === idx; }).sort(function (p, q) { return p - q; });
    }

    // Segmentos e seus grupos (o que se repete).
    var segs = [];
    for (i = 0; i < cuts.length; i++) segs.push({ a: cuts[i], b: i + 1 < cuts.length ? cuts[i + 1] : nU });
    segs = segs.filter(function (s) { return s.b > s.a; });
    function segSim(p, q) {
      var L = Math.min(p.b - p.a, q.b - q.a), s = 0;
      for (var k = 0; k < L; k++) s += S[p.a + k][q.a + k];
      var lenPen = Math.min(p.b - p.a, q.b - q.a) / Math.max(p.b - p.a, q.b - q.a);
      return (s / Math.max(1, L)) * (0.75 + 0.25 * lenPen);
    }
    segs.forEach(function (s) {
      var vs = 0, en = 0, dr = 0;
      for (var k = s.a; k < s.b; k++) { vs += vocalOn[k] ? 1 : 0; en += tDb[k]; dr += dDb[k]; }
      s.vocal = vs / (s.b - s.a); s.energy = en / (s.b - s.a) - tRef; s.drums = dr / (s.b - s.a) - dRef; s.group = -1;
    });
    var groups = 0;
    segs.forEach(function (s, idx) {
      if (s.group >= 0) return;
      s.group = groups++;
      for (var k = idx + 1; k < segs.length; k++) if (segs[k].group < 0 && (s.vocal > .4) === (segs[k].vocal > .4) && segSim(s, segs[k]) > 0.86) segs[k].group = s.group;
    });

    // Nomes.
    var vocalSegs = segs.filter(function (s) { return s.vocal > .4; });
    var stat = {};
    vocalSegs.forEach(function (s) {
      var g = stat[s.group] = stat[s.group] || { n: 0, energy: 0, first: s.a, segs: [] };
      g.n++; g.energy += s.energy; g.segs.push(s);
    });
    var chorus = null, best = -Infinity;
    Object.keys(stat).forEach(function (g) {
      var st = stat[g]; st.energy /= st.n;
      var sc = st.n * 1.2 + st.energy / 4 + (st.first > nU * .15 ? 0.5 : 0);
      if (st.n >= 2 && sc > best) { best = sc; chorus = Number(g); }
    });
    if (chorus === null && vocalSegs.length) { // nada se repete: a parte com voz mais cheia
      chorus = vocalSegs.slice().sort(function (p, q) { return q.energy - p.energy; })[0].group;
    }
    var firstChorusAt = segs.find(function (s) { return s.group === chorus; });
    firstChorusAt = firstChorusAt ? firstChorusAt.a : nU;
    var lastChorusAt = segs.filter(function (s) { return s.group === chorus; }).pop();
    lastChorusAt = lastChorusAt ? lastChorusAt.a : nU;
    var lastVocal = -1;
    segs.forEach(function (s, idx) { if (s.vocal > .4) lastVocal = idx; });
    segs.forEach(function (s, idx) {
      if (s.vocal <= .4) {
        s.name = lastVocal < 0 || idx < segs.indexOf(vocalSegs[0]) ? 'Intro' : idx > lastVocal ? 'Final' : 'Instrumental';
        return;
      }
      if (s.group === chorus) { s.name = 'Refrão'; return; }
      var gst = stat[s.group];
      var next = segs[idx + 1], prev = segs[idx - 1];
      // Pré-refrão: trecho curto com voz, sempre entre uma outra parte cantada (o verso) e o refrão.
      var between = function (x) {
        var i = segs.indexOf(x), nx = segs[i + 1], pv = segs[i - 1];
        return nx && nx.group === chorus && pv && pv.vocal > .4 && pv.group !== chorus && pv.group !== x.group;
      };
      if (next && prev && (s.b - s.a) <= 8 && gst && gst.segs.every(between))
        { s.name = 'Pré-refrão'; return; }
      if (gst && gst.n === 1 && s.a > firstChorusAt && s.a >= lastChorusAt - 16 && s.a < nU - 2) { s.name = 'Ponte'; return; }
      s.name = s.a < firstChorusAt || (gst && gst.first < firstChorusAt) ? 'Verso' : (gst && gst.n === 1 ? 'Ponte' : 'Verso');
    });

    // A letra manda nos nomes, se o número de partes com voz bater.
    var labels = lyricLabels(opts.lyrics).filter(function (l) { return ['Intro', 'Instrumental', 'Final', 'Solo'].indexOf(l) < 0; });
    var usedLyrics = false;
    if (labels.length && labels.length === vocalSegs.length) {
      vocalSegs.forEach(function (s, i) { s.name = labels[i]; });
      usedLyrics = true;
    }

    // Junta vizinhos com o mesmo nome (dois refrões seguidos viram um) e monta a resposta.
    var out = [];
    segs.forEach(function (s) {
      var prev = out[out.length - 1];
      var start = list[s.a].start, end = s.b < nU ? list[s.b].start : duration;
      var conf = Math.min(1, 0.45 + (nov[s.a] || 0) + (cueBoost[s.a] ? 0.3 : 0));
      if (prev && prev.name === s.name) { prev.end = end; return; }
      out.push({ name: s.name, start: start, end: end, conf: s.a === 0 ? 1 : conf });
    });
    // Silêncio no começo (antes da música): a Intro começa onde o som começa.
    if (out.length && out[0].name === 'Intro') {
      for (u = 0; u < nU; u++) if (tDb[u] > tRef - 35) { out[0].start = Math.max(out[0].start, list[u].start); break; }
    }
    return {
      sections: out.filter(function (s) { return s.end - s.start >= 1; }),
      info: { units: nU, gridded: U.gridded, bars: U.barLen, vocalStem: hasVocalStem, guideCues: cues, lyrics: usedLyrics }
    };
  }

  /**
   * Compara a sugestão com as partes marcadas à mão (o gabarito): quantas bordas batem (até `tol` s)
   * e quantos nomes coincidem. Serve para medir e melhorar a detecção com as músicas reais.
   */
  function compare(found, manual, tol) {
    tol = tol || 1.0;
    var mb = manual.map(function (s) { return s.start; }).filter(function (t) { return t > 0.5; });
    var fb = found.map(function (s) { return s.start; }).filter(function (t) { return t > 0.5; });
    var hit = 0;
    var used = {};
    mb.forEach(function (t) {
      var bi = -1, bd = tol;
      fb.forEach(function (x, i) { var d = Math.abs(x - t); if (!used[i] && d <= bd) { bd = d; bi = i; } });
      if (bi >= 0) { used[bi] = true; hit++; }
    });
    var names = 0, checked = 0;
    manual.forEach(function (m) {
      var mid = (m.start + m.end) / 2;
      var f = found.find(function (s) { return s.start <= mid && mid < s.end; });
      var cm = canonical(m.name);
      if (!cm) return;
      checked++;
      if (f && canonical(f.name) === cm) names++;
    });
    return {
      bordersHit: hit, bordersManual: mb.length, bordersFound: fb.length,
      precision: fb.length ? hit / fb.length : 0, recall: mb.length ? hit / mb.length : 0,
      namesHit: names, namesChecked: checked
    };
  }

  var AutoParts = { analyze: analyze, compare: compare, roleOf: roleOf, lyricLabels: lyricLabels, canonical: canonical };
  if (typeof module !== 'undefined' && module.exports) module.exports = AutoParts;
  else root.AutoParts = AutoParts;
})(this);
