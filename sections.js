// Seções da música (Intro, Verso, Refrão...) na linha do tempo, sem DOM, testável com Node.
// Cada seção tem início e fim próprios (dá para mover e mudar o tamanho) e as seções não se
// sobrepõem. Marcadores antigos, sem fim, vão até a próxima seção ou até o fim da música.
// O app Android usa as mesmas regras (Sections.kt).
(function (root) {
  'use strict';

  var QUICK_NAMES = ['Intro', 'Verso', 'Pré-refrão', 'Refrão', 'Ponte', 'Solo', 'Instrumental', 'Final'];
  var MIN_LEN = 0.5;          // seção mais curta: meio segundo
  var DEFAULT_BARS = 8;       // seção nova: 8 compassos (com a grade do click)
  var DEFAULT_SEC = 15;       // ...ou 15 segundos (sem grade)

  // Cor pelo tipo da seção (o nome decide): verso, refrão, ponte...
  var COLORS = [
    [/intro|abertura|entrada/, '#7DBAE4'],
    [/pre|pré/, '#DCC65F'],
    [/refr|coro|chorus/, '#FF6B73'],
    [/vers|estrofe|verse/, '#6CC4B0'],
    [/ponte|bridge/, '#C59DE3'],
    [/solo|instrument|interl|virada/, '#E9A863'],
    [/final|outro|fim|tag|encerr/, '#9BA7EC']
  ];

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function colorFor(name) {
    var n = norm(name);
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i][0].test(n)) return COLORS[i][1];
    return '#A0A0A0';
  }

  // Marcadores (linhas do banco) -> seções em ordem, em segundos.
  function build(markers, endSec) {
    var list = (markers || []).slice().sort(function (a, b) { return a.at_ms - b.at_ms; });
    return list.map(function (m, i) {
      var start = m.at_ms / 1000;
      var next = i + 1 < list.length ? list[i + 1].at_ms / 1000 : endSec;
      var end = m.end_ms !== null && m.end_ms !== undefined ? m.end_ms / 1000 : next;
      end = Math.min(end, endSec);
      return { id: m.id, name: m.name, start: start, end: Math.max(start, end), color: colorFor(m.name), index: i };
    });
  }

  // Seção que começa antes de t (a última), ou -1.
  function indexAt(sections, t) {
    var idx = -1;
    for (var i = 0; i < sections.length; i++) if (sections[i].start <= t + 1e-6) idx = i;
    return idx;
  }

  // Seção que contém t (entre o início e o fim), ou -1.
  function containing(sections, t) {
    for (var i = 0; i < sections.length; i++) if (sections[i].start <= t + 1e-6 && t < sections[i].end) return i;
    return -1;
  }

  // Voltando: se já passou mais de 1 s do início da seção atual, volta ao começo dela.
  function prevStart(sections, t) {
    var i = indexAt(sections, t);
    if (i < 0) return null;
    if (t - sections[i].start > 1) return i;
    return i > 0 ? i - 1 : i;
  }

  function nextStart(sections, t) {
    for (var i = 0; i < sections.length; i++) if (sections[i].start > t + 1e-3) return i;
    return null;
  }

  // Ímã das seções: o início de compasso puxa de mais longe; os outros tempos, de perto.
  function snapEdge(beats, downbeats, t, maxDist) {
    if (!beats || !beats.length) return null;
    var best = null;
    var bestD = Infinity;
    (downbeats || []).forEach(function (i) {
      var d = Math.abs(beats[i] - t);
      if (i >= 0 && i < beats.length && d <= maxDist * 2 && d < bestD) { best = beats[i]; bestD = d; }
    });
    if (best !== null) return best;
    for (var j = 0; j < beats.length; j++) {
      var dj = Math.abs(beats[j] - t);
      if (dj <= maxDist && dj < bestD) { best = beats[j]; bestD = dj; }
    }
    return best;
  }

  // Compatível com a versão anterior: prefere o início do compasso.
  function snapToBar(beats, downbeats, t, maxDist) {
    if (!beats || !beats.length) return null;
    var cands = downbeats && downbeats.length ? downbeats.map(function (i) { return beats[i]; }) : beats;
    var best = null;
    for (var i = 0; i < cands.length; i++) {
      var d = Math.abs(cands[i] - t);
      if (d <= maxDist && (best === null || d < Math.abs(best - t))) best = cands[i];
    }
    return best;
  }

  // Espaço livre ao redor de t (entre a seção anterior e a seguinte), ignorando a seção `exceptId`.
  function freeAround(sections, t, endSec, exceptId) {
    var lo = 0;
    var hi = endSec;
    sections.forEach(function (s) {
      if (s.id === exceptId) return;
      if (s.end <= t + 1e-6) lo = Math.max(lo, s.end);
      else if (s.start >= t - 1e-6) hi = Math.min(hi, s.start);
      else { lo = Math.max(lo, s.end); }   // t está dentro de outra seção
    });
    return { lo: lo, hi: Math.max(lo, hi) };
  }

  // Fim sugerido para uma seção nova que começa em t: 8 compassos (ou 15 s), sem invadir a próxima.
  function defaultEnd(sections, t, endSec, beats, downbeats) {
    var end = t + DEFAULT_SEC;
    if (beats && downbeats && downbeats.length) {
      var after = downbeats.map(function (i) { return beats[i]; }).filter(function (b) { return b > t + 0.05; });
      if (after.length >= DEFAULT_BARS) end = after[DEFAULT_BARS - 1];
      else if (after.length) end = endSec;
    }
    var room = freeAround(sections, t, endSec, null);
    return Math.max(t + MIN_LEN, Math.min(end, room.hi, endSec));
  }

  // Limita início e fim de uma seção para não invadir as vizinhas nem sair da música.
  // mode: 'move' (mantém o tamanho), 'start' ou 'end' (só aquela ponta muda).
  function clampRange(sections, id, start, end, endSec, mode) {
    var others = sections.filter(function (s) { return s.id !== id; });
    var cur = sections.find(function (s) { return s.id === id; });
    var ref = cur ? (cur.start + cur.end) / 2 : (start + end) / 2;
    var lo = 0;
    var hi = endSec;
    others.forEach(function (s) {
      if (s.end <= ref) lo = Math.max(lo, s.end);
      else if (s.start >= ref) hi = Math.min(hi, s.start);
    });
    if (mode === 'move') {
      var len = Math.min(end - start, hi - lo);
      start = Math.max(lo, Math.min(start, hi - len));
      return { start: start, end: start + len };
    }
    if (mode === 'start') return { start: Math.max(lo, Math.min(start, end - MIN_LEN)), end: end };
    return { start: start, end: Math.min(hi, Math.max(end, start + MIN_LEN)) };
  }

  // Nome sugerido para uma seção nova: o próximo da sequência mais comum.
  function suggestName(sections, t) {
    if (!sections.length) return t < 1 ? 'Intro' : 'Verso';
    var i = indexAt(sections, t);
    var prev = i >= 0 ? norm(sections[i].name) : '';
    if (/intro|abertura/.test(prev)) return 'Verso';
    if (/pre/.test(prev)) return 'Refrão';
    if (/vers|estrofe/.test(prev)) return 'Refrão';
    if (/refr|coro/.test(prev)) return 'Verso';
    if (/ponte/.test(prev)) return 'Refrão';
    return 'Nova seção';
  }

  var api = {
    QUICK_NAMES: QUICK_NAMES, MIN_LEN: MIN_LEN, colorFor: colorFor, build: build, indexAt: indexAt, containing: containing,
    prevStart: prevStart, nextStart: nextStart, snapEdge: snapEdge, snapToBar: snapToBar, freeAround: freeAround,
    defaultEnd: defaultEnd, clampRange: clampRange, suggestName: suggestName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sections = api;
})(typeof window !== 'undefined' ? window : globalThis);
