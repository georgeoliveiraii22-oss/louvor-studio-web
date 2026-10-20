// Converte uma faixa que não é MP3 CBR (M4A, WAV, FLAC, MP3 de bitrate variável…) para MP3 320 kbps CBR,
// no próprio aparelho, antes de enviar. O codificador é o lamejs (LAME em JavaScript, LGPL-3.0, carregado
// sem alteração pela CDN só quando precisa).
//
// O MP3 sai com a tag Info/LAME (atraso e padding do codificador), a mesma que o mp3scan.js e o app leem:
// assim o áudio convertido começa no mesmo ponto que o original e fica alinhado com as outras faixas.
(function (root) {
  'use strict';

  var LAME_URL = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
  var LAME_SRI = 'sha384-xuasJXVcyv3hZq0eYpelEkBC8l4yufatZXDsKuyCU2rqfhDCb+ftuE/mSfZAteiK';
  var KBPS = 320;
  var DELAY = 576;          // atraso do codificador LAME (o decodificador soma os 529 dele)
  var BLOCK = 1152;
  var RATE_INDEX = { 44100: 0, 48000: 1, 32000: 2 };

  // Endereço deste arquivo (para montar os "workers", que convertem em paralelo fora da tela).
  var SELF_URL = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : null;

  // Baixa o lamejs uma vez (conferido pelo hash, como os outros scripts da CDN) e o código deste arquivo.
  var sources = null;
  function loadSources() {
    if (sources) return sources;
    sources = Promise.all([
      fetch(LAME_URL, { integrity: LAME_SRI, mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error(); return r.text(); }),
      SELF_URL ? fetch(SELF_URL).then(function (r) { if (!r.ok) throw new Error(); return r.text(); }) : Promise.resolve(null)
    ]).catch(function () {
      sources = null;
      throw new Error('Sem internet para carregar o conversor de MP3. Tente de novo.');
    });
    return sources;
  }

  // O lamejs na própria tela (quando não dá para usar worker).
  var loading = null;
  function loadLame() {
    if (root.lamejs) return Promise.resolve(root.lamejs);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = LAME_URL;
      s.integrity = LAME_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = function () { root.lamejs ? resolve(root.lamejs) : reject(new Error('O conversor de MP3 não carregou.')); };
      s.onerror = function () { loading = null; reject(new Error('Sem internet para carregar o conversor de MP3. Tente de novo.')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function toInt16(f32, a, b) {
    var out = new Int16Array(b - a);
    for (var i = a; i < b; i++) {
      var x = f32[i];
      x = x > 1 ? 1 : x < -1 ? -1 : x;
      out[i - a] = x < 0 ? x * 0x8000 : x * 0x7fff;
    }
    return out;
  }

  // Primeiro quadro: "Info" (CBR) com a tag LAME. Mesmo formato dos quadros de áudio (taxa, modo).
  function infoFrame(sampleRate, mono, frames, padding) {
    var size = Math.floor(144 * KBPS * 1000 / sampleRate);
    var f = new Uint8Array(size);
    f[0] = 0xff; f[1] = 0xfb;                                  // MPEG-1 Layer III, sem CRC
    f[2] = (14 << 4) | (RATE_INDEX[sampleRate] << 2);          // 320 kbps, sem padding
    f[3] = mono ? 0xc4 : 0x44;                                 // mono ou joint stereo
    var t = 4 + (mono ? 17 : 32);
    f.set([0x49, 0x6e, 0x66, 0x6f], t);                        // "Info"
    f.set([0, 0, 0, 1], t + 4);                                // flags: só a contagem de quadros
    f.set([(frames >>> 24) & 255, (frames >>> 16) & 255, (frames >>> 8) & 255, frames & 255], t + 8);
    var l = t + 12;
    f.set([0x4c, 0x41, 0x4d, 0x45, 0x33, 0x2e, 0x39, 0x38], l); // "LAME3.98"
    f[l + 21] = (DELAY >> 4) & 255;
    f[l + 22] = ((DELAY & 15) << 4) | ((padding >> 8) & 15);
    f[l + 23] = padding & 255;
    return f;
  }

  function concat(parts, extra) {
    var n = extra ? extra.length : 0;
    parts.forEach(function (p) { n += p.length; });
    var out = new Uint8Array(n), o = 0;
    if (extra) { out.set(extra, 0); o = extra.length; }
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  /**
   * PCM → MP3 320 kbps CBR com a tag Info/LAME.
   * channels: [Float32Array] (1 ou 2, mesmo tamanho); sampleRate: 44100, 48000 ou 32000.
   * lame: o objeto lamejs. onProgress(0..1) opcional. Devolve Promise<Uint8Array>.
   * Trabalha em pedaços e devolve o controle à tela entre eles (o aparelho não trava).
   */
  function encodePcm(channels, sampleRate, lame, onProgress) {
    if (!(sampleRate in RATE_INDEX)) return Promise.reject(new Error('Taxa de ' + sampleRate + ' Hz não serve para MP3.'));
    var mono = channels.length === 1;
    var L = channels[0], R = mono ? null : channels[1];
    var n = L.length;
    var enc = new lame.Mp3Encoder(mono ? 1 : 2, sampleRate, KBPS);
    var parts = [];
    var pos = 0, STEP = BLOCK * 64;
    return new Promise(function (resolve, reject) {
      function chunk() {
        try {
          var end = Math.min(n, pos + STEP);
          for (var p = pos; p < end; p += BLOCK) {
            var e = Math.min(end, p + BLOCK);
            var out = mono ? enc.encodeBuffer(toInt16(L, p, e)) : enc.encodeBuffer(toInt16(L, p, e), toInt16(R, p, e));
            if (out.length) parts.push(new Uint8Array(out));
          }
          pos = end;
          if (onProgress) onProgress(n ? pos / n : 1);
          if (pos < n) { setTimeout(chunk, 0); return; }
          var last = enc.flush();
          if (last.length) parts.push(new Uint8Array(last));
          var body = concat(parts);
          var frames = countFrames(body);
          var padding = frames * BLOCK - DELAY - n;
          resolve(concat([body], infoFrame(sampleRate, mono, frames, padding)));
        } catch (x) { reject(x); }
      }
      chunk();
    });
  }

  // Quadros de áudio no MP3 que o codificador gerou (todos CBR, com ou sem byte de padding).
  function countFrames(b) {
    var c = 0, p = 0;
    while (p + 4 <= b.length) {
      if (b[p] !== 0xff || (b[p + 1] & 0xe0) !== 0xe0) { p++; continue; }
      var rate = [44100, 48000, 32000][(b[p + 2] >> 2) & 3];
      var pad = (b[p + 2] >> 1) & 1;
      var size = Math.floor(144 * KBPS * 1000 / rate) + pad;
      c++; p += size;
    }
    return c;
  }

  // Decodifica o arquivo (M4A, WAV, FLAC, MP3…) já na taxa das outras faixas: [Float32Array] por canal.
  function decode(file, sampleRate) {
    var Ctx = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!Ctx) return Promise.reject(new Error('Este navegador não converte áudio. Envie as faixas em MP3.'));
    return file.arrayBuffer().then(function (buf) {
      var ctx = new Ctx(2, sampleRate, sampleRate); // só para decodificar; a taxa do contexto é a de saída
      return new Promise(function (resolve, reject) {
        ctx.decodeAudioData(buf, resolve, function () { reject(new Error(file.name + ': o navegador não conseguiu ler este áudio. Exporte em MP3 ou WAV.')); });
      });
    }).then(function (audio) {
      var ch = [audio.getChannelData(0).slice()];
      if (audio.numberOfChannels > 1) ch.push(audio.getChannelData(1).slice());
      return ch;
    });
  }

  // Worker: recebe { channels, sampleRate }, devolve { progress } e no fim { mp3 } ou { error }.
  function workerMain() {
    self.onmessage = function (ev) {
      self.Mp3Encode.encodePcm(ev.data.channels, ev.data.sampleRate, self.lamejs, function (f) { self.postMessage({ progress: f }); })
        .then(function (mp3) { self.postMessage({ mp3: mp3 }, [mp3.buffer]); })
        .catch(function (e) { self.postMessage({ error: String((e && e.message) || e) }); });
    };
  }

  var workerUrl = null;
  function makeWorker() {
    return loadSources().then(function (src) {
      if (!src[1] || typeof Worker === 'undefined' || typeof Blob === 'undefined') return null;
      if (!workerUrl) {
        var code = src[0] + '\n;self.lamejs = lamejs;\n' + src[1] + '\n;(' + workerMain.toString() + ')();';
        workerUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      }
      try { return new Worker(workerUrl); } catch (e) { return null; }
    }).catch(function () { return null; }); // sem worker: converte na própria tela (loadLame avisa se faltar internet)
  }

  function encodeWithWorker(channels, sampleRate, onProgress) {
    return makeWorker().then(function (w) {
      if (!w) return loadLame().then(function (lame) { return encodePcm(channels, sampleRate, lame, onProgress); });
      return new Promise(function (resolve, reject) {
        w.onmessage = function (ev) {
          var d = ev.data;
          if (d.progress !== undefined) { if (onProgress) onProgress(d.progress); return; }
          w.terminate();
          if (d.error) reject(new Error(d.error)); else resolve(d.mp3);
        };
        w.onerror = function (e) { w.terminate(); reject(new Error('O conversor de MP3 parou: ' + (e.message || 'erro'))); };
        w.postMessage({ channels: channels, sampleRate: sampleRate }, channels.map(function (c) { return c.buffer; }));
      });
    });
  }

  /**
   * Converte vários arquivos para MP3 CBR na taxa `sampleRate`, alguns ao mesmo tempo (um por núcleo,
   * no máximo 3, para não faltar memória no celular). onProgress(0..1) do conjunto.
   * Devolve Promise<[Uint8Array]> na mesma ordem dos arquivos.
   */
  function convertFiles(files, sampleRate, onProgress) {
    var cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
    var lanes = Math.max(1, Math.min(3, cores - 1, files.length));
    var done = files.map(function () { return 0; });
    var out = new Array(files.length);
    var next = 0;
    function tell() { if (onProgress) onProgress(done.reduce(function (a, b) { return a + b; }, 0) / files.length); }
    function lane() {
      if (next >= files.length) return Promise.resolve();
      var i = next++;
      return decode(files[i], sampleRate).then(function (ch) {
        return encodeWithWorker(ch, sampleRate, function (f) { done[i] = f; tell(); });
      }).then(function (mp3) { out[i] = mp3; done[i] = 1; tell(); return lane(); });
    }
    var all = [];
    for (var k = 0; k < lanes; k++) all.push(lane());
    return Promise.all(all).then(function () { return out; });
  }

  /**
   * Prepara as faixas para o envio: o que já é MP3 CBR na taxa certa vai como está; o resto (M4A, WAV, FLAC,
   * MP3 de bitrate variável ou em outra taxa) é convertido aqui para MP3 320 kbps CBR.
   * opts.sampleRate: a taxa da música (quando ela já tem faixas); sem ela, vale a do primeiro MP3 CBR
   * escolhido, ou 48 kHz. opts.say(texto, 0..1) conta o andamento.
   * Devolve Promise<{ sampleRate, items: [{ name, buf (ArrayBuffer), blob, size, scan, converted }] }>.
   */
  function prepareStems(files, opts) {
    opts = opts || {};
    var say = opts.say || function () {};
    var Scan = root.Mp3Scan;
    say('Conferindo os arquivos…', 0);
    return Promise.all(files.map(function (f) {
      return f.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf), scan = null;
        if (!Scan.otherFormat(bytes)) { try { scan = Scan.scanMp3(bytes); } catch (e) { scan = null; } }
        return { file: f, buf: buf, scan: scan };
      });
    })).then(function (list) {
      var firstGood = list.find(function (x) { return x.scan && x.scan.isCBR && x.scan.sampleRate in RATE_INDEX; });
      var sr = opts.sampleRate || (firstGood ? firstGood.scan.sampleRate : 48000);
      var todo = list.filter(function (x) { return !(x.scan && x.scan.isCBR && x.scan.sampleRate === sr); });
      var ready = function () {
        return {
          sampleRate: sr,
          items: list.map(function (x) {
            return { name: x.file.name, buf: x.buf, scan: x.scan, converted: !!x.converted, size: x.buf.byteLength,
              blob: x.converted ? new Blob([x.buf], { type: 'audio/mpeg' }) : x.file };
          })
        };
      };
      if (!todo.length) return ready();
      if (!(sr in RATE_INDEX)) throw new Error('A música está em ' + sr + ' Hz, e a conversão só sai em 44.100 ou 48.000 Hz. Envie as faixas em MP3 nessa taxa.');
      var names = todo.map(function (x) { return x.file.name; }).join(', ');
      say('Convertendo para MP3: ' + names + '. Pode levar alguns minutos; deixe esta tela aberta.', 0);
      return convertFiles(todo.map(function (x) { return x.file; }), sr, function (f) {
        say('Convertendo para MP3 (' + Math.round(f * 100) + '%): ' + names, f);
      }).then(function (mp3s) {
        todo.forEach(function (x, i) {
          x.buf = mp3s[i].buffer.slice(mp3s[i].byteOffset, mp3s[i].byteOffset + mp3s[i].byteLength);
          x.scan = Scan.scanMp3(new Uint8Array(x.buf));
          x.converted = true;
        });
        return ready();
      });
    });
  }

  var api = { encodePcm: encodePcm, convertFiles: convertFiles, prepareStems: prepareStems, KBPS: KBPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mp3Encode = api;
})(typeof window !== 'undefined' ? window : globalThis);
