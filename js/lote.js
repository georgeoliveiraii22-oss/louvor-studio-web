// Louvor Studio (site) — Repertório › "Enviar uma pasta de músicas": o líder (ou quem cuida das músicas) escolhe uma
// pasta no computador (ARTISTA › Música › faixas.mp3) e o site cria todas as músicas de uma vez na banda dele.
// Mesmas regras do envio em lote do painel da Biblioteca (mobile/js/admin.js › enviarLote): MP3 de taxa fixa, mais de
// 24 faixas ficam as principais, a duração é a da faixa mais longa, pula as músicas que já estão na banda com faixas,
// e uma música que não subiu inteira é apagada para tentar de novo. Conta no espaço da banda (o banco confere o limite).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;

  /** O computador deixa escolher uma pasta inteira (no celular, não). */
  L.lotePossivel = function () {
    var i = document.createElement('input');
    return 'webkitdirectory' in i && window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  };

  function bonito(s) {
    s = String(s).replace(/\s+/g, ' ').trim();
    if (s !== s.toUpperCase()) return s;   // só arruma o que veio TODO EM MAIÚSCULAS
    var peq = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, a: 1, o: 1, as: 1, os: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, ao: 1, aos: 1, por: 1, pra: 1, para: 1, com: 1, um: 1, uma: 1 };
    return s.toLowerCase().split(' ').map(function (w, i) { return i > 0 && peq[w] ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }
  // Mais de 24 faixas: ficam sempre click, guia, piano/teclas, guitarras/violão, baixo e bateria (igual ao painel).
  var ESSENCIAL = /^(click|clique|metronom\w*|met|guia|guide|cue|cues|piano|pno|keys?|teclad\w*|teclas?|rhodes|wurli\w*|guit\w*|gtr\w*|guita\w*|eg|ag|violao|violão|bass|baixo|bx|drums?|bateria|bat|kick|bumbo|snare|caixa|hats?|hh|hihat|tom|toms|overheads?|oh|room|ride|crash|pratos?|cymbals?)\d*$/;
  function prioridade(nome) {
    var ws = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
    var tem = function (re) { return ws.some(function (w) { return re.test(w); }); };
    if (tem(ESSENCIAL)) return 4;
    if (tem(/^(s?fx\w*|efeitos?|riser|swell|noise|reverse|rev|impact\w*|sweep|whoosh)\d*$/)) return 0;
    if (tem(/^(perc\w*|shaker|tamb\w*|pandeiro|conga\w*|clap\w*|snap\w*|loops?)\d*$/)) return 1;
    if (tem(/^(strings?|cordas?|synth\w*|pads?|arp\w*|orq\w*|orch\w*|brass|metais|sinth\w*)\d*$/)) return 2;
    return 3;
  }
  function caber24(files) {
    if (files.length <= 24) return { ficam: files, fora: [] };
    var idx = files.map(function (f, i) { return { f: f, i: i, p: prioridade(f.name.replace(/\.[^.]+$/, '')) }; });
    var manter = idx.slice().sort(function (a, b) { return b.p - a.p || a.i - b.i; }).slice(0, 24);
    manter.sort(function (a, b) { return a.i - b.i; });
    var set = manter.map(function (x) { return x.f; });
    return { ficam: set, fora: files.filter(function (f) { return set.indexOf(f) < 0; }) };
  }
  // Sem acento, pontuação nem espaços: "Moisés\Cântico" (a pasta não aceita "\") casa com "MoisésCântico".
  function so(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ''); }
  function chave(t, a) { return so(t) + '|' + so(a); }
  L.lote = { bonito: bonito, caber24: caber24, prioridade: prioridade, conferir: function (fs) { conferir(fs); } };

  /** Abre a escolha da pasta. */
  L.enviarPasta = function () {
    var input = h('input', { type: 'file', multiple: true, webkitdirectory: true, style: { display: 'none' } });
    input.addEventListener('change', function () {
      var fs = Array.prototype.slice.call(input.files || []);
      input.remove();
      if (fs.length) conferir(fs);
    });
    document.body.appendChild(input);
    input.click();
  };

  /** Agrupa os arquivos em músicas (…/ARTISTA/Música/faixa.mp3) e mostra o resumo antes de enviar. */
  function conferir(files) {
    var grupos = {}, ordem = [], outros = 0;
    files.forEach(function (f) {
      if (!/\.mp3$/i.test(f.name)) { if (!/^\.|desktop\.ini|thumbs\.db/i.test(f.name)) outros++; return; }
      var p = String(f.webkitRelativePath || f.name).split('/');
      if (p.length < 3) return;
      var artista = bonito(p[p.length - 3]), musica = bonito(p[p.length - 2]), k = chave(musica, artista);
      if (!grupos[k]) { grupos[k] = { titulo: musica, artista: artista, files: [], bytes: 0 }; ordem.push(k); }
      grupos[k].files.push(f); grupos[k].bytes += f.size;
    });
    if (!ordem.length) {
      L.toast('Não encontrei músicas. A pasta precisa ter ARTISTA › Música › faixas em MP3.');
      return;
    }
    var ja = {}, semFaixa = {};
    S.projects.forEach(function (p) { if ((S.tracksIdx[p.id] || []).length) ja[chave(p.song_title, p.artist)] = true; else semFaixa[chave(p.song_title, p.artist)] = true; });
    var novas = ordem.filter(function (k) { return !ja[k]; });
    var completar = novas.filter(function (k) { return semFaixa[k]; }).length;
    var bytes = novas.reduce(function (a, k) { return a + grupos[k].bytes; }, 0);
    var limite = Number(S.current.org.storage_limit_bytes || 0), livre = Math.max(0, limite - Number(S.storageUsed || 0));
    var cabe = !limite || bytes <= livre;
    L.dialog({
      title: 'Enviar ' + L.plural(novas.length, 'música', 'músicas'),
      body: function () {
        return [
          U.body(L.plural(ordem.length, 'música encontrada', 'músicas encontradas') + (ordem.length - novas.length ? ' · ' + (ordem.length - novas.length) + ' já estão no repertório (ficam como estão)' : '') + '.', null, 14),
          completar ? U.body(L.plural(completar, 'música do repertório que estava sem multitrack ganha', 'músicas do repertório que estavam sem multitrack ganham') + ' as faixas (o nome, a escala e o resto ficam como estão)' + (novas.length > completar ? '; ' + L.plural(novas.length - completar, 'é nova', 'são novas') : '') + '.', null, 13) : null,
          U.keyValue('Tamanho das novas', L.bytes(bytes)),
          limite ? U.keyValue('Espaço livre da banda', L.bytes(livre)) : null,
          !cabe ? U.body('Não cabe tudo no espaço da banda: o envio vai até onde couber. Para caber todas, aumente o plano em Banda › Plano.', 'var(--warn)', 13) : null,
          outros ? U.body(L.plural(outros, 'arquivo que não é MP3 fica', 'arquivos que não são MP3 ficam') + ' de fora.', 'var(--muted)', 12) : null,
          U.body('Deixe esta página aberta até terminar. Dá para parar e escolher a mesma pasta depois: o que já subiu é pulado.', 'var(--muted)', 12)
        ];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', disabled: !novas.length, onclick: function () { close(); enviar(grupos, novas); } }, 'Enviar')];
      }
    });
  }

  async function enviar(grupos, ordem) {
    var org = S.current.org.id, me = L.uid();
    var E = { i: 0, total: ordem.length, msg: 'Começando…', frac: 0, falhas: [], cortes: [], parar: false, feitas: 0, fim: false };
    var dlg = L.dialog({
      sticky: true, title: 'Enviando as músicas',
      body: function () {
        return [
          h('div', { class: 'small semi' }, E.msg),
          h('div', { style: { height: '6px', borderRadius: '3px', background: 'var(--control)', overflow: 'hidden' } },
            h('div', { style: { height: '100%', width: Math.round(E.frac * 100) + '%', background: 'var(--accent)' } })),
          E.falhas.length ? h('details', { class: 'small' }, h('summary', null, L.plural(E.falhas.length, 'música não foi enviada', 'músicas não foram enviadas')),
            h('div', { style: { display: 'grid', gap: '2px', marginTop: '4px' } }, E.falhas.map(function (f) { return h('div', { class: 'muted' }, f); }))) : null,
          E.cortes.length ? h('details', { class: 'small' }, h('summary', null, L.plural(E.cortes.length, 'música tinha', 'músicas tinham') + ' mais de 24 faixas (ficaram as principais)'),
            h('div', { style: { display: 'grid', gap: '2px', marginTop: '4px' } }, E.cortes.map(function (f) { return h('div', { class: 'muted' }, f); }))) : null
        ];
      },
      actions: function (close) {
        return E.fim ? [h('button', { class: 'textbtn', onclick: close }, 'Fechar')]
          : [h('button', { class: 'textbtn muted', disabled: E.parar, onclick: function () { E.parar = true; dlg.rebuild(); } }, E.parar ? 'Parando depois desta música…' : 'Parar')];
      }
    });
    function pintar() { dlg.rebuild(); }
    var ex = await sb.from('projects').select('id,song_title,artist,tracks(id)').eq('org_id', org);
    var existentes = {};
    (ex.data || []).forEach(function (p) { existentes[chave(p.song_title, p.artist)] = p; });
    for (var i = 0; i < ordem.length && !E.parar; i++) {
      var g = grupos[ordem[i]], antes = existentes[ordem[i]];
      var rotulo = 'Música ' + (i + 1) + ' de ' + ordem.length + ': ' + g.titulo + ' · ' + g.artista;
      if (antes && antes.tracks && antes.tracks.length) continue;
      var pid = antes ? antes.id : null, criei = false;
      try {
        g.files.sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR', { numeric: true }); });
        var cabe = caber24(g.files);
        if (cabe.fora.length) { g.files = cabe.ficam; E.cortes.push(g.titulo + ': ficaram de fora ' + cabe.fora.map(function (f) { return f.name.replace(/\.[^.]+$/, ''); }).join(', ')); }
        E.msg = rotulo + ' — conferindo as faixas'; E.frac = i / ordem.length; pintar();
        var itens = [];
        for (var j = 0; j < g.files.length; j++) {
          var buf = await g.files[j].arrayBuffer(), sc = Mp3Scan.scanMp3(new Uint8Array(buf));
          if (!sc.isCBR || !sc.expectedPcmFrames) throw new Error(g.files[j].name + ' não é MP3 de taxa fixa');
          itens.push({ f: g.files[j], buf: buf, scan: sc });
        }
        var sr = itens[0].scan.sampleRate;
        if (itens.some(function (x) { return x.scan.sampleRate !== sr; })) throw new Error('faixas com taxas de amostragem diferentes');
        var max = Math.max.apply(null, itens.map(function (x) { return x.scan.expectedPcmFrames; }));
        var row = { song_title: g.titulo, name: g.titulo, artist: g.artista, session_duration_ms: Math.max(1, Math.round(max / sr * 1000)), sample_rate: sr };
        if (pid) {   // música do repertório sem faixas: só a duração e a taxa; o nome e o artista ficam os dela
          var up = await sb.from('projects').update({ session_duration_ms: row.session_duration_ms, sample_rate: sr }).eq('id', pid);
          if (up.error) throw up.error;
        }
        else {
          var ins = await sb.from('projects').insert(Object.assign({ org_id: org, created_by: me }, row)).select('id').single();
          if (ins.error) throw ins.error;
          pid = ins.data.id; criei = true;
        }
        for (var t = 0; t < itens.length; t++) {
          var it = itens[t];
          E.msg = rotulo + ' — faixa ' + (t + 1) + ' de ' + itens.length; E.frac = (i + t / itens.length) / ordem.length; pintar();
          var fileId = crypto.randomUUID(), key = org + '/' + pid + '/stems/' + fileId + '.mp3';
          var hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', it.buf))).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
          await Nuvem.uploadAudio(sb, { id: fileId, org_id: org, project_id: pid, object_key: key, size_bytes: it.buf.byteLength, checksum_sha256: hash, mime: 'audio/mpeg', uploaded_by: me }, new Blob([it.buf], { type: 'audio/mpeg' }));
          var tr = await sb.from('tracks').insert({ project_id: pid, name: it.f.name.replace(/\.[^.]+$/, '').slice(0, 60), type: 'stem', source_file_id: fileId, sort_order: t });
          if (tr.error) throw tr.error;
        }
        E.feitas++;
      } catch (e) {
        var m = e && e.message || String(e);
        if (/limite de armazenamento/i.test(m)) m = 'não coube no espaço da banda';
        E.falhas.push(g.titulo + ' · ' + g.artista + ': ' + m);
        if (criei && pid) { try { await sb.from('projects').delete().eq('id', pid); if (Nuvem.emptyTrash) Nuvem.emptyTrash(sb); } catch (x) { /* fica para a próxima */ } }
        if (/espaço da banda/.test(m)) break;   // sem espaço: não adianta tentar as próximas
      }
    }
    E.fim = true; E.frac = 1;
    E.msg = (E.parar ? 'Parado. ' : 'Pronto. ') + L.plural(E.feitas, 'música enviada', 'músicas enviadas') + (E.falhas.length ? ', ' + E.falhas.length + ' com problema (veja abaixo)' : '') + '.';
    pintar();
    try {
      await D.reloadSongs();
      var u = await sb.rpc('org_storage_used', { _org: org });
      if (!u.error) S.storageUsed = Number(u.data) || S.storageUsed;
    } catch (x) { /* a lista atualiza na próxima vez */ }
    L.render();
  }
})();
