// Gera um arquivo WAV (PCM 16 ou 24 bits) a partir de canais em Float32 (-1..1).
// Usado pela exportação; testável com Node.
(function (root) {
  'use strict';

  // channels: array de Float32Array, todos com o mesmo tamanho.
  function encodeWav(channels, sampleRate, bits) {
    var ch = channels.length;
    var n = ch ? channels[0].length : 0;
    var bps = bits === 24 ? 3 : 2;
    var dataLen = n * ch * bps;
    var buf = new ArrayBuffer(44 + dataLen);
    var v = new DataView(buf);

    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF');
    v.setUint32(4, 36 + dataLen, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);            // PCM
    v.setUint16(22, ch, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * ch * bps, true);
    v.setUint16(32, ch * bps, true);
    v.setUint16(34, bps * 8, true);
    str(36, 'data');
    v.setUint32(40, dataLen, true);

    var o = 44;
    for (var i = 0; i < n; i++) {
      for (var c = 0; c < ch; c++) {
        var x = Math.max(-1, Math.min(1, channels[c][i]));
        if (bps === 2) {
          v.setInt16(o, Math.round(x * 32767), true);
          o += 2;
        } else {
          var s = Math.round(x * 8388607);
          v.setUint8(o, s & 255);
          v.setUint8(o + 1, (s >> 8) & 255);
          v.setUint8(o + 2, (s >> 16) & 255);
          o += 3;
        }
      }
    }
    return buf;
  }

  // Lê o cabeçalho de volta para conferir o arquivo gerado.
  function inspectWav(buf) {
    var v = new DataView(buf);
    var ch = v.getUint16(22, true);
    var bits = v.getUint16(34, true);
    var dataLen = v.getUint32(40, true);
    return { channels: ch, sampleRate: v.getUint32(24, true), bits: bits, frames: dataLen / (ch * (bits / 8)) };
  }

  function estimateBytes(frames, channels, bits) {
    return 44 + frames * channels * (bits / 8);
  }

  var api = { encodeWav: encodeWav, inspectWav: inspectWav, estimateBytes: estimateBytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Wav = api;
})(typeof window !== 'undefined' ? window : globalThis);
