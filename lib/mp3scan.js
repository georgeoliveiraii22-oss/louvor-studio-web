// Leitor de cabeçalhos MP3 (sem decodificar), igual ao Mp3Scanner.swift do app.
// Valida CBR, lê taxa de amostragem, conta quadros e lê o atraso/padding da tag Xing/Info/LAME.
(function (root) {
  'use strict';

  var BITRATES_1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  var BITRATES_2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  var BASE_RATES = [44100, 48000, 32000];

  function header(b, p) {
    if (p + 4 > b.length || b[p] !== 0xff || (b[p + 1] & 0xe0) !== 0xe0) return null;
    var versionBits = (b[p + 1] >> 3) & 3;
    var layerBits = (b[p + 1] >> 1) & 3;
    if (versionBits === 1 || layerBits !== 1) return null; // somente Layer III
    var bitrateIndex = b[p + 2] >> 4;
    var rateIndex = (b[p + 2] >> 2) & 3;
    if (bitrateIndex === 0 || bitrateIndex >= 15 || rateIndex >= 3) return null;

    var mpeg1 = versionBits === 3;
    var bitrate = mpeg1 ? BITRATES_1[bitrateIndex] : BITRATES_2[bitrateIndex];
    var divisor = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 4;
    var sampleRate = Math.floor(BASE_RATES[rateIndex] / divisor);
    var padding = (b[p + 2] >> 1) & 1;
    var channels = ((b[p + 3] >> 6) & 3) === 3 ? 1 : 2;
    var size = Math.floor(((mpeg1 ? 144 : 72) * bitrate * 1000) / sampleRate) + padding;
    if (size <= 4) return null;
    return {
      sampleRate: sampleRate,
      bitrate: bitrate,
      channels: channels,
      frameSize: size,
      samplesPerFrame: mpeg1 ? 1152 : 576,
      mpeg1: mpeg1,
      hasCRC: (b[p + 1] & 1) === 0
    };
  }

  function be32(b, p) {
    return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
  }

  function parseTag(b, p, h) {
    var sideInfo = h.mpeg1 ? (h.channels === 1 ? 17 : 32) : h.channels === 1 ? 9 : 17;
    var t = p + 4 + (h.hasCRC ? 2 : 0) + sideInfo;
    var end = p + h.frameSize;
    if (t + 8 > end) return null;
    var isXing = b[t] === 0x58 && b[t + 1] === 0x69 && b[t + 2] === 0x6e && b[t + 3] === 0x67; // "Xing"
    var isInfo = b[t] === 0x49 && b[t + 1] === 0x6e && b[t + 2] === 0x66 && b[t + 3] === 0x6f; // "Info"
    if (!isXing && !isInfo) return null;

    var tag = { frames: null, delay: null, padding: null };
    var flags = b[t + 7];
    t += 8;
    if (flags & 0x01) {
      if (t + 4 > end) return tag;
      tag.frames = be32(b, t);
      t += 4;
    }
    if (flags & 0x02) t += 4;
    if (flags & 0x04) t += 100;
    if (flags & 0x08) t += 4;

    if (t + 24 <= end && b[t] !== 0) {
      var x = t + 21;
      tag.delay = (b[x] << 4) | (b[x + 1] >> 4);
      tag.padding = ((b[x + 1] & 0x0f) << 8) | b[x + 2];
    }
    return tag;
  }

  // `bytes`: Uint8Array com o arquivo inteiro.
  function scanMp3(bytes) {
    var r = {
      sampleRate: 0, channels: 0, bitrateKbps: 0, isCBR: true,
      audioFrames: 0, samplesPerFrame: 1152, hasTag: false,
      tagFrames: null, encoderDelay: null, encoderPadding: null,
      expectedPcmFrames: 0
    };
    var bitrates = {};
    var pos = 0;

    // Pula a tag ID3v2, se houver.
    if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      var size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
      pos = 10 + size;
    }

    var foundFirst = false;
    while (pos + 4 <= bytes.length) {
      var h = header(bytes, pos);
      if (!h) { pos += 1; continue; }
      if (foundFirst && h.sampleRate !== r.sampleRate) { pos += 1; continue; }
      if (pos + h.frameSize > bytes.length) break;

      if (!foundFirst) {
        foundFirst = true;
        r.sampleRate = h.sampleRate;
        r.channels = h.channels;
        r.samplesPerFrame = h.samplesPerFrame;
        var tag = parseTag(bytes, pos, h);
        if (tag) {
          r.hasTag = true;
          r.tagFrames = tag.frames;
          r.encoderDelay = tag.delay;
          r.encoderPadding = tag.padding;
          pos += h.frameSize;
          continue;
        }
      }
      bitrates[h.bitrate] = true;
      r.audioFrames += 1;
      pos += h.frameSize;
    }

    if (r.audioFrames === 0) throw new Error('Arquivo não parece um MP3 Layer III válido.');
    var keys = Object.keys(bitrates);
    r.bitrateKbps = Number(keys[0]);
    r.isCBR = keys.length === 1;

    // Quadros PCM esperados depois de remover atraso e padding, igual ao decodificador do app.
    var frames = (r.tagFrames !== null ? r.tagFrames : r.audioFrames) * r.samplesPerFrame;
    if (r.encoderDelay !== null && r.encoderPadding !== null) {
      frames -= r.encoderDelay + 529;
      frames -= Math.max(r.encoderPadding - 529, 0);
    }
    r.expectedPcmFrames = Math.max(frames, 0);
    return r;
  }

  // Arquivos de áudio que não são MP3 (pela assinatura do começo do arquivo): o nome do formato, ou null.
  // Sem isso, um M4A ou WAV às vezes "parece" um MP3 quebrado e a mensagem falava em bitrate variável.
  function otherFormat(bytes) {
    function at(o, s) { for (var i = 0; i < s.length; i++) if (bytes[o + i] !== s.charCodeAt(i)) return false; return true; }
    if (bytes.length < 12) return null;
    if (at(4, 'ftyp')) return 'M4A/AAC';
    if (at(0, 'RIFF') && at(8, 'WAVE')) return 'WAV';
    if (at(0, 'FORM') && (at(8, 'AIFF') || at(8, 'AIFC'))) return 'AIFF';
    if (at(0, 'fLaC')) return 'FLAC';
    if (at(0, 'OggS')) return 'OGG';
    return null;
  }

  // Mensagem para quem enviou um arquivo que não serve como faixa.
  function notMp3Message(name, format) {
    return name + ' está em ' + format + ', e as faixas precisam ser MP3. Converta para MP3 320 kbps (bitrate constante, CBR) e envie de novo.';
  }

  var api = { scanMp3: scanMp3, otherFormat: otherFormat, notMp3Message: notMp3Message };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mp3Scan = api;
})(typeof window !== 'undefined' ? window : globalThis);
