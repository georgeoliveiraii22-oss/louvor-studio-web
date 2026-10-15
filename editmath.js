// Cálculos do estúdio do líder (sem DOM nem áudio), testáveis com Node.
//
// Convenção de tempo (igual ao app):
//   linha do tempo = tempo dentro do arquivo + deslocamento (`shift`, em segundos)
//   - faixa da base: shift = timeline_offset_ms + offset_ms da edição
//   - tomada:        shift = start_ms (onde a gravação começou) - rtl_ms + offset_ms da tomada + offset_ms da edição
// O corte (trim) é medido dentro do arquivo: só o trecho [a, b] do arquivo toca.
(function (root) {
  'use strict';

  // Quando e de onde tocar um trecho, começando a reprodução na posição P da linha do tempo.
  // Retorna null se nada desse trecho toca a partir de P.
  //   a, b: início e fim do corte, em segundos dentro do arquivo
  //   bufferDur: duração do arquivo; sessionEnd: fim da sessão na linha do tempo
  function playPlan(P, a, b, shift, bufferDur, sessionEnd) {
    var end = Math.min(b, bufferDur);
    if (!(end > a)) return null;
    var regionStart = a + shift;
    var regionEnd = Math.min(end + shift, sessionEnd);
    if (P >= regionEnd || regionEnd <= regionStart) return null;
    var startDelay = Math.max(0, regionStart - P);
    var bufferOffset = Math.max(a, P - shift);
    var duration = (regionEnd - shift) - bufferOffset;
    if (duration <= 0) return null;
    return { startDelay: startDelay, bufferOffset: bufferOffset, duration: duration, regionStart: regionStart, regionEnd: regionEnd };
  }

  // Ganho linear num instante t da linha do tempo, com fades nas pontas do trecho.
  function envelopeAt(t, regionStart, regionEnd, gainDb, fadeIn, fadeOut) {
    var lin = Math.pow(10, gainDb / 20);
    if (t < regionStart || t > regionEnd) return 0;
    var f = 1;
    if (fadeIn > 0) f = Math.min(f, (t - regionStart) / fadeIn);
    if (fadeOut > 0) f = Math.min(f, (regionEnd - t) / fadeOut);
    return lin * Math.max(0, Math.min(1, f));
  }

  // Limita os valores ao que o banco aceita e mantém o corte coerente.
  function clampEdit(e, durationMs) {
    var out = {
      trim_start_ms: Math.max(0, Math.round(e.trim_start_ms || 0)),
      trim_end_ms: e.trim_end_ms === null || e.trim_end_ms === undefined ? null : Math.round(e.trim_end_ms),
      offset_ms: Math.max(-600000, Math.min(600000, Math.round(e.offset_ms || 0))),
      gain_db: Math.max(-60, Math.min(24, Number(e.gain_db) || 0)),
      fade_in_ms: Math.max(0, Math.round(e.fade_in_ms || 0)),
      fade_out_ms: Math.max(0, Math.round(e.fade_out_ms || 0)),
      // Trechos apagados no meio (cortes feitos no app; migração 0014), em ms do arquivo.
      cuts: Array.isArray(e.cuts) ? e.cuts.filter(function (c) { return Array.isArray(c) && c[1] > c[0]; }) : []
    };
    if (out.trim_end_ms !== null && out.trim_end_ms >= durationMs) out.trim_end_ms = null;
    var end = out.trim_end_ms === null ? durationMs : out.trim_end_ms;
    if (out.trim_start_ms > end - 100) out.trim_start_ms = Math.max(0, end - 100);
    var len = end - out.trim_start_ms;
    if (out.fade_in_ms + out.fade_out_ms > len) {
      var k = len / (out.fade_in_ms + out.fade_out_ms);
      out.fade_in_ms = Math.floor(out.fade_in_ms * k);
      out.fade_out_ms = Math.floor(out.fade_out_ms * k);
    }
    return out;
  }

  function sameEdit(x, y) {
    var keys = ['trim_start_ms', 'trim_end_ms', 'offset_ms', 'gain_db', 'fade_in_ms', 'fade_out_ms'];
    return keys.every(function (k) { return (x[k] === undefined ? null : x[k]) === (y[k] === undefined ? null : y[k]); }) &&
      JSON.stringify(x.cuts || []) === JSON.stringify(y.cuts || []);
  }

  function isNeutral(e) {
    return (e.trim_start_ms || 0) === 0 && (e.trim_end_ms === null || e.trim_end_ms === undefined) &&
      (e.offset_ms || 0) === 0 && Number(e.gain_db || 0) === 0 && (e.fade_in_ms || 0) === 0 && (e.fade_out_ms || 0) === 0 &&
      !(e.cuts && e.cuts.length);
  }

  // Janelas de silêncio (na linha do tempo) dos cortes no meio, entre `from` e `to`.
  function cutWindows(cuts, shift, from, to) {
    return (cuts || []).map(function (c) { return [c[0] / 1000 + shift, c[1] / 1000 + shift]; })
      .filter(function (w) { return w[1] > from && w[0] < to; })
      .map(function (w) { return [Math.max(w[0], from), Math.min(w[1], to)]; });
  }

  var api = { cutWindows: cutWindows, playPlan: playPlan, envelopeAt: envelopeAt, clampEdit: clampEdit, sameEdit: sameEdit, isNeutral: isNeutral };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EditMath = api;
})(typeof window !== 'undefined' ? window : globalThis);
