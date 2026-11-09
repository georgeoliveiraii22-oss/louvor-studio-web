// Louvor Studio — importar e exportar o repertório em planilha (.xlsx ou .csv), sem bibliotecas de fora.
// Lê as colunas pelo nome; nada aqui fala com o servidor. Testes: web/tests/planilha.test.js.
(function (root) {
  'use strict';

  var MAX_FILE = 8 * 1024 * 1024, MAX_XML = 40 * 1024 * 1024, MAX_ROWS = 3000;

  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  // ------------------------------------------------------------------ ZIP (o .xlsx é um zip de XMLs)
  function u16(d, p) { return d[p] | (d[p + 1] << 8); }
  function u32(d, p) { return (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0; }
  var utf8 = function (b) { return new TextDecoder('utf-8').decode(b); };

  function zipEntries(d) {
    var p = d.length - 22, min = Math.max(0, d.length - 66000);
    while (p >= min && u32(d, p) !== 0x06054b50) p--;
    if (p < min) throw new Error('arquivo');
    var n = u16(d, p + 10), at = u32(d, p + 16), out = {};
    for (var i = 0; i < n; i++) {
      if (at + 46 > d.length || u32(d, at) !== 0x02014b50) throw new Error('arquivo');
      var nameLen = u16(d, at + 28), extra = u16(d, at + 30), comment = u16(d, at + 32);
      out[utf8(d.subarray(at + 46, at + 46 + nameLen))] = { method: u16(d, at + 10), size: u32(d, at + 20), offset: u32(d, at + 42) };
      at += 46 + nameLen + extra + comment;
    }
    return out;
  }

  async function inflate(bytes) {
    var reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    var parts = [], total = 0;
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      total += r.value.length;
      if (total > MAX_XML) { await reader.cancel(); throw new Error('grande'); }
      parts.push(r.value);
    }
    var out = new Uint8Array(total), p = 0;
    parts.forEach(function (x) { out.set(x, p); p += x.length; });
    return out;
  }

  async function zipRead(d, entries, name) {
    var e = entries[name];
    if (!e) return null;
    var nameLen = u16(d, e.offset + 26), extra = u16(d, e.offset + 28), start = e.offset + 30 + nameLen + extra;
    var raw = d.subarray(start, start + e.size);
    if (e.method === 0) return utf8(raw);
    if (e.method === 8) return utf8(await inflate(raw));
    throw new Error('arquivo');
  }

  // ------------------------------------------------------------------ Ler .xlsx
  function unxml(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (m, c) {
      var k = c.toLowerCase();
      if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"'; if (k === 'apos') return "'";
      var n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    });
  }
  function attr(tag, name) { var m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(tag); return m ? unxml(m[1]) : null; }
  // Junta os <t> de um bloco, sem a transcrição fonética (<rPh>).
  function joinT(xml) {
    var s = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''), out = '', re = /<t(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/t>)/g, m;
    while ((m = re.exec(s))) if (m[1]) out += unxml(m[1]);
    return out;
  }
  function colIndex(ref) {
    var m = /^[A-Z]+/.exec(ref || ''), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[0].length; i++) n = n * 26 + m[0].charCodeAt(i) - 64;
    return n - 1;
  }
  function dirOf(path) { return path.slice(0, path.lastIndexOf('/') + 1); }
  function joinPath(base, target) {
    if (target[0] === '/') return target.slice(1);
    var out = [];
    (base + target).split('/').forEach(function (p) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
    return out.join('/');
  }

  async function firstSheet(d, entries) {
    var wb = await zipRead(d, entries, 'xl/workbook.xml');
    var rels = await zipRead(d, entries, 'xl/_rels/workbook.xml.rels');
    var sheet = wb && /<sheet\b[^>]*>/.exec(wb);
    if (sheet && rels) {
      var rid = attr(sheet[0], 'r:id'), re = /<Relationship\b[^>]*>/g, m;
      while ((m = re.exec(rels))) if (attr(m[0], 'Id') === rid) {
        var path = joinPath('xl/', attr(m[0], 'Target'));
        if (entries[path]) return path;
      }
    }
    var names = Object.keys(entries).filter(function (n) { return /^xl\/worksheets\/[^/]+\.xml$/.test(n); }).sort();
    if (!names.length) throw new Error('arquivo');
    return names[0];
  }

  async function readXlsx(buffer) {
    var d = new Uint8Array(buffer);
    if (d.length > MAX_FILE) throw new Error('grande');
    var entries = zipEntries(d);
    var shared = [], ss = await zipRead(d, entries, 'xl/sharedStrings.xml');
    if (ss) { var re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g, m; while ((m = re.exec(ss))) shared.push(m[1] ? joinT(m[1]) : ''); }
    var path = await firstSheet(d, entries), xml = await zipRead(d, entries, path);

    // Células cujo texto é "Ver" mas que têm um link por trás: vale o link.
    var links = {}, relPath = dirOf(path) + '_rels/' + path.slice(path.lastIndexOf('/') + 1) + '.rels', relXml = await zipRead(d, entries, relPath);
    if (relXml) {
      var targets = {}, r1 = /<Relationship\b[^>]*>/g, a;
      while ((a = r1.exec(relXml))) targets[attr(a[0], 'Id')] = attr(a[0], 'Target');
      var r2 = /<hyperlink\b[^>]*>/g, b;
      while ((b = r2.exec(xml))) { var t = targets[attr(b[0], 'r:id')]; if (t) links[attr(b[0], 'ref')] = t; }
    }

    var rows = [], rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
    while ((rm = rowRe.exec(xml))) {
      if (rows.length >= MAX_ROWS + 1) throw new Error('linhas');
      var row = [], cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, next = 0;
      while (rm[1] && (cm = cellRe.exec(rm[1]))) {
        var ref = attr(cm[1], 'r'), i = ref ? colIndex(ref) : next, type = attr(cm[1], 't'), inner = cm[2] || '', val = '';
        var v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner);
        if (type === 's') val = v ? (shared[parseInt(v[1], 10)] || '') : '';
        else if (type === 'inlineStr') val = joinT(inner);
        else if (v) val = unxml(v[1]);
        if (ref && links[ref] && !/^https?:/i.test(val)) val = links[ref];
        row[i] = val;
        next = i + 1;
      }
      for (var k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = '';
      rows.push(row);
    }
    return rows;
  }

  // ------------------------------------------------------------------ Ler .csv
  function decodeText(buffer) {
    var d = new Uint8Array(buffer);
    if (d.length > MAX_FILE) throw new Error('grande');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(d); }
    catch (e) { return new TextDecoder('windows-1252').decode(d); }
  }
  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    var first = text.split(/\r?\n/, 1)[0], best = ',', bestN = -1;
    [';', ',', '\t'].forEach(function (c) { var n = first.split(c).length; if (n > bestN) { bestN = n; best = c; } });
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === best) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
        if (rows.length > MAX_ROWS + 1) throw new Error('linhas');
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  async function readFile(name, buffer) {
    var ext = (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1];
    ext = ext ? ext.toLowerCase() : '';
    if (ext === 'xlsx') return readXlsx(buffer);
    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return readCsv(decodeText(buffer));
    throw new Error('formato');
  }

  // ------------------------------------------------------------------ Colunas
  var ALIASES = {
    title: ['nome da musica', 'musica', 'nome', 'titulo', 'titulo da musica', 'song', 'title', 'louvor', 'hino'],
    artist: ['artista', 'cantor', 'cantora', 'interprete', 'ministerio', 'banda', 'artist'],
    album: ['album'],
    key: ['tom', 'tom original', 'tonalidade', 'key'],
    bandKey: ['tom da banda', 'tom banda'],
    bpm: ['bpm', 'andamento', 'tempo'],
    sig: ['compasso', 'formula de compasso'],
    tags: ['classificacoes', 'classificacao', 'categorias', 'categoria', 'tags', 'momento', 'tipo'],
    video: ['video', 'youtube', 'link do video', 'link da versao', 'link youtube', 'link'],
    lyrics: ['letra', 'link da letra', 'lyrics'],
    lyricsText: ['texto da letra'],
    chart: ['cifra', 'link da cifra', 'chords', 'partitura'],
    audio: ['audio', 'link do audio', 'spotify', 'deezer'],
    note: ['recado', 'recado para a banda', 'observacao', 'observacoes', 'observacao da musica', 'observacao da versao', 'notas']
  };
  var COL_BY_NAME = {};
  Object.keys(ALIASES).forEach(function (f) { ALIASES[f].forEach(function (a) { COL_BY_NAME[a] = f; }); });

  function mapColumns(header) {
    var map = {};
    header.forEach(function (h, i) { var f = COL_BY_NAME[norm(h)]; if (f && map[f] === undefined) map[f] = i; });
    return map;
  }
  // A primeira das 10 primeiras linhas que tem a coluna do nome (há planilhas com título em cima).
  function findHeader(rows) {
    for (var i = 0; i < Math.min(10, rows.length); i++) if (mapColumns(rows[i]).title !== undefined) return i;
    return -1;
  }

  // Colunas comuns em outros apps que o Louvor Studio não guarda: não precisa perguntar sobre elas.
  var IGNORED = ['nome da versao', 'versao', 'duracao', 'referencias', 'id', 'codigo', 'data', 'data de criacao'];
  var FIELDS = [['title', 'Nome da música'], ['artist', 'Artista'], ['album', 'Álbum'], ['key', 'Tom original'], ['bandKey', 'Tom da banda'], ['bpm', 'BPM'], ['sig', 'Compasso'],
    ['tags', 'Classificações'], ['video', 'Vídeo (YouTube)'], ['lyrics', 'Letra (link ou texto)'], ['lyricsText', 'Texto da letra'], ['chart', 'Link da cifra'], ['audio', 'Link do áudio'], ['note', 'Recado']];

  /** O que o app entendeu de cada coluna. Sem título reconhecido, usa a primeira linha preenchida como títulos. */
  function inspect(rows) {
    var at = findHeader(rows);
    if (at < 0) at = rows.findIndex(function (r) { return r.some(function (c) { return clean(c); }); });
    if (at < 0) return { at: -1, cols: [] };
    var header = rows[at], data = rows.slice(at + 1), width = rows.slice(at).reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var used = {}, cols = [];
    for (var i = 0; i < width; i++) {
      var name = clean(header[i]);
      var samples = [];
      for (var y = 0; y < data.length && samples.length < 2; y++) { var v = clean(data[y][i]); if (v) samples.push(v.replace(/\s+/g, ' ').slice(0, 60)); }
      if (!name && !samples.length) continue;
      var field = COL_BY_NAME[norm(name)] || null;
      if (field && used[field]) field = null; else if (field) used[field] = true;
      cols.push({ i: i, name: name || ('Coluna ' + colName(i)), field: field, ignored: !field && (IGNORED.indexOf(norm(name)) >= 0 || !samples.length), samples: samples });
    }
    return { at: at, cols: cols };
  }
  function needsReview(cols) {
    return !cols.some(function (c) { return c.field === 'title'; }) || cols.some(function (c) { return !c.field && !c.ignored; });
  }
  function colMap(cols) { var m = {}; cols.forEach(function (c) { if (c.field) m[c.field] = c.i; }); return m; }

  // ------------------------------------------------------------------ De linhas a músicas
  function isUrl(s) { return /^https?:\/\/\S+$/i.test(s); }
  function youtube(s) {
    var m = /(?:youtu\.be\/|youtube\.com\/.*[?&]v=|youtube\.com\/(?:shorts|embed|live)\/)([A-Za-z0-9_-]{11})/i.exec(s);
    return m ? 'https://www.youtube.com/watch?v=' + m[1] : s;
  }
  function clean(s) { s = String(s == null ? '' : s).trim(); return s === '-' || s === '—' ? '' : s; }

  /** choice (opcional): { at, cols } de inspect(), com o que o líder escolheu. */
  function parseRows(rows, choice) {
    var at = choice ? choice.at : findHeader(rows);
    if (at < 0) return { error: 'colunas', songs: [] };
    var map = choice ? colMap(choice.cols) : mapColumns(rows[at]), songs = [];
    if (map.title === undefined) return { error: 'colunas', songs: [] };
    rows.slice(at + 1).forEach(function (r, i) {
      function get(f) { return map[f] === undefined ? '' : clean(r[map[f]]); }
      var title = get('title');
      if (!title) return;
      var warn = [];
      function link(raw, what) {
        if (!raw) return null;
        if (!isUrl(raw) || raw.length > 500) { warn.push(what + ': link inválido, ficou de fora'); return null; }
        return raw;
      }
      function short(raw, max, what) {
        if (raw.length <= max) return raw || null;
        if (what) warn.push(what + ' muito longo, foi cortado');
        return raw.slice(0, max);
      }
      var bpmRaw = get('bpm'), bpm = null;
      if (bpmRaw) {
        var n = Math.round(parseFloat(bpmRaw.replace(',', '.')));
        if (n >= 20 && n <= 300) bpm = n;
        else if (n !== 0) warn.push('BPM ' + bpmRaw + ' não existe, ficou em branco');
      }
      var sigRaw = get('sig'), sig = /^[0-9]{1,2}\/[0-9]{1,2}$/.test(sigRaw) ? sigRaw : null;
      if (sigRaw && !sig) warn.push('Compasso ' + sigRaw + ' não reconhecido');

      // "Letra" pode trazer o link ou o próprio texto; "Texto da letra" é sempre o texto.
      var l = get('lyrics'), lt = get('lyricsText'), lyricsUrl = null, lyrics = lt || null;
      if (l && isUrl(l)) lyricsUrl = link(l, 'Letra');
      else if (l && !lyrics) lyrics = l;
      if (lyrics && lyrics.length > 20000) { warn.push('Letra longa demais, ficou de fora'); lyrics = null; }

      var c = get('chart'), chart = null;
      if (c) { if (isUrl(c)) chart = link(c, 'Cifra'); else warn.push('Cifra em texto não é guardada, só o link'); }

      var videoRaw = get('video');
      var tags = [];
      get('tags').split(/[,;|/]/).forEach(function (t) { t = t.trim().slice(0, 40); if (t && tags.indexOf(t) < 0 && tags.length < 10) tags.push(t); });

      songs.push({
        line: at + i + 2,
        warnings: warn,
        row: {
          name: short(title, 200), song_title: short(title, 200, 'Nome'), artist: short(get('artist'), 120, 'Artista'), album: short(get('album'), 200, 'Álbum'),
          musical_key: short(get('key'), 12, 'Tom'), band_key: short(get('bandKey'), 12, 'Tom da banda'), bpm: bpm, time_signature: sig,
          version_url: link(videoRaw && youtube(videoRaw), 'Vídeo'), lyrics_url: lyricsUrl, chart_url: chart, audio_url: link(get('audio'), 'Áudio'),
          tags: tags.length ? tags : null, leader_note: short(get('note'), 500, 'Recado'), lyrics: lyrics
        }
      });
    });
    return { songs: songs };
  }

  // Mesma regra de "música repetida" do resto do app: título igual e artista igual; sem artista num dos dois, só o título.
  function songKey(s) { return norm(s); }
  function sameSong(a, b) {
    if (songKey(a.song_title) !== songKey(b.song_title)) return false;
    var x = songKey(a.artist), y = songKey(b.artist);
    return !x || !y || x === y;
  }
  /** Marca cada música: new (nova), dup (já está no repertório) ou repeat (repetida dentro do arquivo). */
  function classify(songs, existing) {
    var seen = [];
    return songs.map(function (s) {
      var status = 'new';
      if ((existing || []).some(function (p) { return sameSong(s.row, p); })) status = 'dup';
      else if (seen.some(function (o) { return sameSong(s.row, o); })) status = 'repeat';
      if (status === 'new') seen.push(s.row);
      return Object.assign({}, s, { status: status });
    });
  }

  // ------------------------------------------------------------------ Escrever .xlsx
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(d) { var c = 0xffffffff; for (var i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipStore(files) {
    var enc = new TextEncoder(), locals = [], central = [], offset = 0;
    function h16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
    function h32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      function common(a) { h16(a, 20); h16(a, 0x0800); h16(a, 0); h16(a, 0); h16(a, 0x21); h32(a, crc); h32(a, data.length); h32(a, data.length); h16(a, name.length); h16(a, 0); }
      var lh = []; h32(lh, 0x04034b50); common(lh);
      locals.push(new Uint8Array(lh), name, data);
      var ch = []; h32(ch, 0x02014b50); h16(ch, 20); common(ch); h16(ch, 0); h16(ch, 0); h16(ch, 0); h32(ch, 0); h32(ch, offset);
      central.push(new Uint8Array(ch), name);
      offset += lh.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, x) { return s + x.length; }, 0);
    var end = []; h32(end, 0x06054b50); h16(end, 0); h16(end, 0); h16(end, files.length); h16(end, files.length); h32(end, cdSize); h32(end, offset); h16(end, 0);
    var all = locals.concat(central, [new Uint8Array(end)]), out = new Uint8Array(all.reduce(function (s, x) { return s + x.length; }, 0)), p = 0;
    all.forEach(function (x) { out.set(x, p); p += x.length; });
    return out;
  }
  function xmlEsc(s) {
    return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function colName(i) { var s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }
  /** Todas as células vão como texto (nunca fórmula): um nome começando com "=" não vira comando no Excel. */
  function writeXlsx(rows) {
    var body = rows.map(function (r, y) {
      return '<row r="' + (y + 1) + '">' + r.map(function (v, x) {
        if (v === null || v === undefined || v === '') return '';
        var ref = colName(x) + (y + 1);
        return typeof v === 'number' ? '<c r="' + ref + '"><v>' + v + '</v></c>'
          : '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    var head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    return zipStore([
      ['[Content_Types].xml', head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ['_rels/.rels', head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Repertório" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', head + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + body + '</sheetData></worksheet>']
    ]);
  }

  var EXPORT = [
    ['Nome da música', 'song_title'], ['Artista', 'artist'], ['Álbum', 'album'], ['Tom', 'musical_key'], ['Tom da banda', 'band_key'], ['BPM', 'bpm'], ['Compasso', 'time_signature'],
    ['Classificações', 'tags'], ['Vídeo', 'version_url'], ['Letra', 'lyrics_url'], ['Cifra', 'chart_url'], ['Áudio', 'audio_url'], ['Recado', 'leader_note'], ['Texto da letra', 'lyrics']
  ];
  function exportRows(projects) {
    var list = projects.slice().sort(function (a, b) { return norm(a.song_title).localeCompare(norm(b.song_title)); });
    return [EXPORT.map(function (c) { return c[0]; })].concat(list.map(function (p) {
      return EXPORT.map(function (c) { var v = p[c[1]]; return Array.isArray(v) ? v.join(', ') : v == null ? '' : v; });
    }));
  }

  var api = { readFile: readFile, readXlsx: readXlsx, readCsv: readCsv, parseRows: parseRows, classify: classify, writeXlsx: writeXlsx, exportRows: exportRows, mapColumns: mapColumns, inspect: inspect, needsReview: needsReview, FIELDS: FIELDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planilha = api;
})(typeof window !== 'undefined' ? window : globalThis);
