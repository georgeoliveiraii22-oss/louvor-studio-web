// Louvor Studio (web para celular) — roteiro do culto, modelos de roteiro, histórico da escala, faltas, copiar escala,
// compartilhar, quadro do mês, relatórios e lixeira (migração 0043).
// As regras do roteiro são as mesmas de data/Roteiro.kt (Android) e Sources/Data/Roteiro.swift (iPhone): mudou uma, mude as três.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var Rt = L.roteiro = {};
  S.items = {};            // id da escala → itens salvos do roteiro (undefined = ainda não carregou)
  S.planTemplates = null;  // modelos de roteiro da banda
  S.musicOn = true;        // organizations.music_enabled (equipes sem músicas escondem o repertório)

  L.musicOn = function () { return S.musicOn !== false; };

  // ------------------------------------------------------------------ Regras do roteiro
  /** Nomes prontos para os itens que não são música. */
  Rt.QUICK = ['Abertura', 'Oração', 'Leitura bíblica', 'Avisos', 'Ofertas', 'Palavra', 'Ceia', 'Apelo', 'Encerramento', 'Intervalo'];

  /**
   * O roteiro na ordem: os itens salvos (as músicas só se ainda estão na escala, sem repetir) e, no fim, as músicas
   * da escala que ainda não estão no roteiro. Sem nada salvo, o roteiro é só a lista de músicas.
   */
  Rt.plan = function (songIds, saved) {
    var out = [], used = {};
    (saved || []).slice().sort(function (a, b) { return (a.position || 0) - (b.position || 0); }).forEach(function (it) {
      if (it.project_id) {
        if (songIds.indexOf(it.project_id) < 0 || used[it.project_id]) return;
        used[it.project_id] = true;
      }
      out.push({ project_id: it.project_id || null, title: it.project_id ? null : it.title, duration_s: it.duration_s == null ? null : it.duration_s, note: it.note || null });
    });
    songIds.forEach(function (pid) { if (!used[pid]) out.push({ project_id: pid, title: null, duration_s: null, note: null }); });
    return out;
  };
  /** Duração de um item em segundos: a do item, senão a da música (ficha ou multitrack); nulo se não souber. */
  Rt.duration = function (it) {
    if (it.duration_s != null) return it.duration_s;
    var p = it.project_id && L.project(it.project_id);
    if (!p) return null;
    if (p.duration_s) return p.duration_s;
    return p.session_duration_ms ? Math.round(p.session_duration_ms / 1000) : null;
  };
  /** 5:28 (música), 10 min (item redondo), 1h 05min (longo). */
  Rt.fmt = function (sec) {
    if (sec == null) return '';
    sec = Math.max(0, Math.round(sec));
    if (sec >= 3600) { var m = Math.round(sec / 60); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min'; }
    if (sec % 60 === 0) return (sec / 60) + ' min';
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };
  /** "19:00" + segundos → "19:12". */
  Rt.clockAdd = function (hhmm, sec) {
    var p = String(hhmm).split(':');
    var t = (+p[0] * 60 + +p[1]) * 60 + sec;
    var mins = Math.floor(t / 60) % (24 * 60);
    return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  };
  /** Começo de cada item (se a escala tem hora) e o total (soma do que tem duração). */
  Rt.timeline = function (s, plan) {
    var at = 0, unknown = 0;
    var rows = plan.map(function (it) {
      var d = Rt.duration(it);
      var row = { it: it, dur: d, start: s.start_time ? Rt.clockAdd(L.hhmm(s.start_time), at) : null };
      if (d == null) unknown++; else at += d;
      return row;
    });
    return { rows: rows, total: at, unknown: unknown, end: s.start_time && at ? Rt.clockAdd(L.hhmm(s.start_time), at) : null };
  };
  /** "5:28", "5", "5min", "1:02:00" → segundos; nulo se vazio; NaN se não der para ler. */
  Rt.parseDur = function (txt, minutesDefault) {
    var t = String(txt || '').trim().toLowerCase().replace(/\s/g, '');
    if (!t) return null;
    var m = /^(\d{1,3})(?:min|m)?$/.exec(t);
    if (m) return minutesDefault ? +m[1] * 60 : +m[1];
    m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m && +m[2] < 60) return +m[1] * 60 + +m[2];
    m = /^(\d):(\d{2}):(\d{2})$/.exec(t);
    if (m && +m[2] < 60 && +m[3] < 60) return +m[1] * 3600 + +m[2] * 60 + +m[3];
    m = /^(\d{1,2})h(\d{1,2})?(?:min)?$/.exec(t);
    if (m) return +m[1] * 3600 + +(m[2] || 0) * 60;
    return NaN;
  };

  Rt.load = function (sid, force) {
    if (!force && S.items[sid] !== undefined) return;
    S.items[sid] = S.items[sid] || null;
    sb.from('service_items').select('*').eq('service_id', sid).order('position').then(function (r) {
      S.items[sid] = r.error ? [] : (r.data || []);
      L.render();
    }, function () { S.items[sid] = []; });
  };
  Rt.loadTemplates = async function () {
    var r = await sb.from('plan_templates').select('*').eq('org_id', S.current.org.id).order('name');
    S.planTemplates = r.error ? [] : (r.data || []);
  };

  function itemTitle(it) {
    if (it.songs) return 'Músicas da escala';
    if (it.project_id) { var p = L.project(it.project_id); return p ? p.song_title : 'Música'; }
    return it.title || 'Item';
  }

  // ------------------------------------------------------------------ Painel na escala
  Rt.panel = function (s) {
    var can = L.perm.schedule();
    Rt.load(s.id);
    var saved = S.items[s.id];
    var songIds = L.musicOn() ? s.songIds : [];
    var plan = Rt.plan(songIds, saved || []);
    if (!plan.length && !can) return null;
    var tl = Rt.timeline(s, plan);
    var panel = U.panel('Roteiro', 'ListOrdered');
    if (saved === null) panel.appendChild(U.body('Carregando…', 'var(--muted)', 13));
    if (!plan.length) panel.appendChild(U.body('Monte a ordem do culto: abertura, oração, as músicas, avisos, ofertas, a palavra…', 'var(--muted)', 13));
    tl.rows.forEach(function (row, i) {
      var it = row.it, p = it.project_id ? L.project(it.project_id) : null;
      panel.appendChild(h('div', { class: 'rtrow' + (p ? ' song' : ''), role: p ? 'button' : null, onclick: p ? function () {
        L.songSheet(p.id, { ids: songIds, i: songIds.indexOf(p.id) });
      } : null },
        h('span', { class: 'rtt' }, row.start || String(i + 1)),
        h('span', { class: 'rti' }, ic(p ? 'Music2' : 'Mic', 16)),
        h('div', { class: 'grow', style: { minWidth: 0 } },
          h('div', { class: 'hi semi ell' }, itemTitle(it)),
          p || it.note ? h('div', { class: 'muted small ell' }, [p ? p.artist : null, it.note].filter(Boolean).join(' · ')) : null),
        h('span', { class: 'muted small rtd' }, row.dur != null ? Rt.fmt(row.dur) : '—')));
    });
    if (plan.length) {
      panel.appendChild(h('div', { class: 'rttotal' }, ic('Timer', 15, 'muted'),
        h('span', { class: 'grow' }, 'Total: ' + (tl.total ? Rt.fmt(tl.total) : '—') + (tl.unknown ? ' (' + L.plural(tl.unknown, 'item sem duração', 'itens sem duração') + ')' : '')),
        tl.end ? h('span', { class: 'muted' }, 'termina ' + tl.end) : null));
    }
    if (can) panel.appendChild(U.btn2(saved && saved.length ? 'Editar roteiro' : 'Montar o roteiro', 'ListOrdered', function () { L.go({ name: 'roteiro', id: s.id }); }, { full: true }));
    return panel;
  };

  // ------------------------------------------------------------------ Editar roteiro (de uma escala ou de um modelo)
  var Ed = null;
  function startEd(r) {
    if (Ed && Ed.key === r.name + ':' + r.id) return Ed;
    if (r.name === 'roteiro') {
      var s = L.service(r.id);
      Ed = { key: r.name + ':' + r.id, kind: 'escala', s: s, list: Rt.plan(L.musicOn() ? s.songIds : [], S.items[s.id] || []), busy: false };
    } else {
      var t = r.id === 'novo' ? null : (S.planTemplates || []).find(function (x) { return x.id === r.id; });
      Ed = { key: r.name + ':' + r.id, kind: 'modelo', t: t, name: t ? t.name : '', busy: false,
        list: t ? (t.items || []).map(function (x) { return x.songs ? { songs: true } : { title: x.title, duration_s: x.duration_s == null ? null : x.duration_s, note: x.note || null }; })
          : [{ title: 'Abertura', duration_s: 300, note: null }, { songs: true }, { title: 'Palavra', duration_s: 2400, note: null }] };
    }
    return Ed;
  }

  function editorScreen(r) {
    if (r.name === 'roteiro' && !L.service(r.id)) return h('div', { class: 'screen' }, U.topRow('Roteiro'), U.empty('Esta escala não existe mais.'));
    if (r.name === 'roteiro' && S.items[r.id] === undefined) { Rt.load(r.id); return h('div', { class: 'screen' }, U.topRow('Roteiro'), U.spinner('Carregando…')); }
    if (r.name === 'rtmodelo' && S.planTemplates === null) { Rt.loadTemplates().then(L.render); return h('div', { class: 'screen' }, U.topRow('Modelo de roteiro'), U.spinner('Carregando…')); }
    var e = startEd(r);
    var isTpl = e.kind === 'modelo';
    var s = e.s;
    var tl = isTpl ? null : Rt.timeline(s, e.list);
    function move(i, d) { var j = i + d; if (j < 0 || j >= e.list.length) return; var x = e.list[i]; e.list[i] = e.list[j]; e.list[j] = x; L.render(); }
    var root = h('div', { class: 'screen', style: { paddingBottom: '120px' } },
      U.topRow(isTpl ? (e.t ? 'Editar modelo' : 'Novo modelo de roteiro') : 'Roteiro', isTpl ? 'Use em qualquer escala' : s.title + ' · ' + L.fullDate(s.starts_on), null,
        function () { Ed = null; L.back(); }));
    if (isTpl) root.appendChild(U.field(e.name, 'Nome do modelo (ex.: Culto de domingo) *', function (v) { e.name = v.slice(0, 60); }, { max: 60 }));
    root.appendChild(U.body(isTpl ? 'O item "Músicas da escala" vira as músicas de cada escala, na ordem delas.'
      : 'Use as setas para mudar a ordem. As músicas vêm da escala; para tirar uma, tire da escala.', 'var(--muted)', 13));
    var list = h('div', { class: 'col', style: { gap: '6px' } });
    e.list.forEach(function (it, i) {
      var row = tl ? tl.rows[i] : null;
      var d = it.songs ? null : Rt.duration(it);
      list.appendChild(h('div', { class: 'rtedit' + (it.project_id || it.songs ? ' song' : '') },
        h('div', { class: 'col', style: { gap: '2px' } },
          U.iconBtn('ChevronUp', 'Subir', function () { move(i, -1); }, { disabled: i === 0 }),
          U.iconBtn('ChevronDown', 'Descer', function () { move(i, 1); }, { disabled: i === e.list.length - 1 })),
        h('div', { class: 'grow', role: 'button', style: { minWidth: 0, cursor: it.songs ? 'default' : 'pointer' }, onclick: function () { if (!it.songs) itemDialog(e, i); } },
          h('div', { class: 'row', style: { gap: '8px' } }, ic(it.project_id || it.songs ? 'Music2' : 'Mic', 15, 'muted'), h('span', { class: 'hi semi ell' }, itemTitle(it))),
          h('div', { class: 'muted small ell' }, [row && row.start ? row.start : null, it.songs ? 'as músicas de cada escala' : d != null ? Rt.fmt(d) : 'sem duração', it.note].filter(Boolean).join(' · '))),
        !it.project_id && !it.songs ? U.iconBtn('X', 'Tirar do roteiro', function () { e.list.splice(i, 1); L.render(); }, { color: 'var(--muted)' })
          : U.iconBtn('Pencil', 'Duração e observação', function () { if (!it.songs) itemDialog(e, i); }, { color: 'var(--muted)', disabled: !!it.songs })));
    });
    root.appendChild(list);
    if (tl && e.list.length) root.appendChild(h('div', { class: 'rttotal' }, ic('Timer', 15, 'muted'), h('span', { class: 'grow' }, 'Total: ' + (tl.total ? Rt.fmt(tl.total) : '—')), tl.end ? h('span', { class: 'muted' }, 'termina ' + tl.end) : null));
    root.appendChild(U.btn2('Adicionar item', 'Plus', function () { itemDialog(e, -1); }, { full: true }));
    if (isTpl && !e.list.some(function (x) { return x.songs; })) root.appendChild(U.btn2('Pôr "Músicas da escala"', 'Music2', function () { e.list.push({ songs: true }); L.render(); }, { full: true }));
    if (!isTpl) {
      root.appendChild(h('div', { class: 'row', style: { gap: '8px' } },
        U.btn2('Usar um modelo', 'Copy', function () { useTemplate(e); }, { full: true }),
        U.btn2('Salvar como modelo', 'BookmarkPlus', function () { saveAsTemplate(e); }, { full: true })));
    }
    root.appendChild(h('div', { class: 'rtsave' }, U.btn(e.busy ? 'Salvando…' : 'Salvar', 'Check', function () { save(e); }, { full: true, tall: true, disabled: e.busy || (isTpl && !e.name.trim()) })));
    if (isTpl && e.t) root.appendChild(h('button', { class: 'textbtn', style: { color: 'var(--bad)', width: '100%' }, onclick: function () {
      L.confirm('Apagar o modelo "' + e.t.name + '"?', 'As escalas que já usaram o modelo não mudam.', 'Apagar', function () {
        L.run(async function () { L.must(await sb.from('plan_templates').delete().eq('id', e.t.id)); await Rt.loadTemplates(); Ed = null; L.toast('Modelo apagado.'); L.back(); });
      }, true);
    } }, 'Apagar modelo'));
    return root;
  }
  L.screen('roteiro', editorScreen);
  L.screen('rtmodelo', editorScreen);

  function itemDialog(e, i) {
    var it = i >= 0 ? e.list[i] : { title: '', duration_s: null, note: null };
    var song = !!it.project_id;
    var st = { title: it.title || '', dur: it.duration_s != null ? (song ? Rt.fmt(it.duration_s).replace(' min', ':00') : String(Math.round(it.duration_s / 60))) : '', note: it.note || '' };
    var dlg = L.dialog({
      title: song ? itemTitle(it) : i >= 0 ? 'Editar item' : 'Novo item',
      body: function () {
        return [
          !song ? h('div', { class: 'hscroll' }, Rt.QUICK.map(function (q) { return U.toggle(q, st.title === q, null, function () { st.title = q; dlg.rebuild(); }); })) : null,
          !song ? U.field(st.title, 'Nome (ex.: Oração, Palavra) *', function (v) { st.title = v.slice(0, 80); }, { max: 80 }) : null,
          U.field(st.dur, song ? 'Duração (ex.: 5:28). Vazio = a da música' : 'Duração em minutos (ex.: 10)', function (v) { st.dur = v; }, { inputmode: song ? 'text' : 'numeric', max: 8 }),
          U.field(st.note, 'Observação (ex.: quem conduz)', function (v) { st.note = v.slice(0, 300); }, { max: 300 })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () {
          var d = Rt.parseDur(st.dur, !song);
          if (d !== null && (isNaN(d) || d > 14400)) { L.toast(song ? 'Escreva a duração assim: 5:28.' : 'Escreva só os minutos, ex.: 10.'); return; }
          if (!song && !st.title.trim()) { L.toast('Escreva o nome do item.'); return; }
          var next = song ? Object.assign({}, it, { duration_s: d, note: st.note.trim() || null })
            : { title: st.title.trim(), duration_s: d, note: st.note.trim() || null };
          if (i >= 0) e.list[i] = next; else e.list.push(next);
          close(); L.render();
        } }, i >= 0 ? 'Pronto' : 'Adicionar')];
      }
    });
  }

  function useTemplate(e) {
    L.run(async function () {
      await Rt.loadTemplates();
      var ts = S.planTemplates || [];
      L.dialog({
        title: 'Usar um modelo',
        body: function (close) {
          if (!ts.length) return U.body('Nenhum modelo ainda. Monte este roteiro e toque em Salvar como modelo, ou crie em Gerenciar escalas › Modelos de roteiro.', 'var(--muted)', 13);
          return ts.map(function (t) {
            return U.menuRow('ListOrdered', t.name, (t.items || []).map(function (x) { return x.songs ? 'músicas' : x.title; }).join(' · '), function () {
              close();
              var songs = L.musicOn() ? e.s.songIds : [];
              var out = [], placed = false;
              (t.items || []).forEach(function (x) {
                if (x.songs) { if (!placed) { songs.forEach(function (pid) { out.push({ project_id: pid, title: null, duration_s: null, note: null }); }); placed = true; } }
                else out.push({ title: x.title, duration_s: x.duration_s == null ? null : x.duration_s, note: x.note || null });
              });
              e.list = Rt.plan(songs, out.map(function (x, k) { return Object.assign({ position: k }, x); }));
              L.toast('Modelo aplicado. Confira e toque em Salvar.');
              L.render();
            });
          });
        },
        actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Fechar')]; }
      });
    });
  }

  /** As músicas da escala viram um item só ("Músicas da escala") no lugar da primeira. */
  function toTemplateItems(list) {
    var out = [], placed = false;
    list.forEach(function (x) {
      if (x.project_id || x.songs) { if (!placed) { out.push({ songs: true }); placed = true; } return; }
      out.push({ title: x.title, duration_s: x.duration_s, note: x.note || null });
    });
    return out;
  }

  function saveAsTemplate(e) {
    var st = { name: e.s.title };
    L.dialog({
      title: 'Salvar como modelo',
      body: function () { return [U.body('O modelo guarda a ordem e os itens. As músicas viram "Músicas da escala".', 'var(--muted)', 13), U.field(st.name, 'Nome do modelo', function (v) { st.name = v.slice(0, 60); }, { max: 60 })]; },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () {
          if (!st.name.trim()) { L.toast('Dê um nome ao modelo.'); return; }
          close();
          L.run(async function () {
            L.must(await sb.from('plan_templates').insert({ org_id: S.current.org.id, name: st.name.trim(), items: toTemplateItems(e.list) }));
            await Rt.loadTemplates();
            L.toast('Modelo "' + st.name.trim() + '" salvo.');
          });
        } }, 'Salvar')];
      }
    });
  }

  function save(e) {
    if (e.busy) return;
    e.busy = true; L.render();
    L.run(async function () {
      try {
        if (e.kind === 'modelo') {
          var row = { name: e.name.trim(), items: e.list.map(function (x) { return x.songs ? { songs: true } : { title: x.title, duration_s: x.duration_s, note: x.note || null }; }) };
          if (e.t) L.must(await sb.from('plan_templates').update(row).eq('id', e.t.id));
          else L.must(await sb.from('plan_templates').insert(Object.assign({ org_id: S.current.org.id }, row)));
          await Rt.loadTemplates();
          L.toast('Modelo salvo.');
        } else {
          var sid = e.s.id;
          L.must(await sb.from('service_items').delete().eq('service_id', sid));
          // Só a lista de músicas, sem nada mudado: não precisa guardar (o roteiro já é a lista de músicas).
          var plain = e.list.every(function (x) { return x.project_id && x.duration_s == null && !x.note; });
          if (!plain) {
            L.must(await sb.from('service_items').insert(e.list.map(function (x, k) {
              return { service_id: sid, position: k, project_id: x.project_id || null, title: x.project_id ? null : x.title, duration_s: x.duration_s, note: x.note || null };
            })));
          }
          // A ordem das músicas no roteiro vale também para a lista de músicas da escala.
          var order = e.list.filter(function (x) { return x.project_id; }).map(function (x) { return x.project_id; });
          var changed = order.some(function (pid, k) { return e.s.songIds[k] !== pid; });
          if (changed) {
            for (var k = 0; k < order.length; k++) {
              L.must(await sb.from('service_songs').update({ position: k }).eq('service_id', sid).eq('project_id', order[k]));
            }
            await D.reloadServices();
          }
          await Rt.load(sid, true);
          L.toast('Roteiro salvo.');
        }
        Ed = null;
        L.back();
      } finally { if (Ed) { Ed.busy = false; L.render(); } }
    });
  }

  // ------------------------------------------------------------------ Modelos de roteiro
  L.screen('rtmodelos', function () {
    if (S.planTemplates === null) { Rt.loadTemplates().then(L.render); return h('div', { class: 'screen' }, U.topRow('Modelos de roteiro'), U.spinner('Carregando…')); }
    var ts = S.planTemplates;
    return h('div', { class: 'screen', style: { paddingBottom: '96px' } },
      U.topRow('Modelos de roteiro', 'A ordem do culto pronta para usar'),
      U.body('Um modelo guarda a ordem do culto (abertura, oração, músicas, avisos, palavra…). Na escala, toque em Roteiro › Usar um modelo.', 'var(--muted)', 13),
      ts.length ? ts.map(function (t) {
        return U.menuRow('ListOrdered', t.name, (t.items || []).map(function (x) { return x.songs ? 'músicas' : x.title; }).join(' · ') || 'vazio', function () { Ed = null; L.go({ name: 'rtmodelo', id: t.id }); });
      }) : U.empty('Nenhum modelo ainda.'),
      U.fab('Novo modelo', 'Plus', function () { Ed = null; L.go({ name: 'rtmodelo', id: 'novo' }); }));
  });

  // ------------------------------------------------------------------ Histórico da escala
  var KIND_ICON = { dados: 'Pencil', musica_add: 'Music2', musica_del: 'Music2', tom: 'Music4', ordem: 'ListOrdered', cantor: 'Mic', pessoa_add: 'UserPlus',
    pessoa_del: 'UserMinus', resposta: 'Check', troca: 'RefreshCw', falta: 'UserX', roteiro: 'ListOrdered', clonada: 'Copy', restaurada: 'ArchiveRestore' };
  /** Uma linha do histórico em português. */
  Rt.logText = function (l) {
    var d = l.detail || {}, fn = d.funcao ? ' (' + L.fnLabel(d.funcao) + ')' : '';
    switch (l.kind) {
      case 'dados': return 'Mudou ' + (d.campos || []).join(', ');
      case 'musica_add': return 'Pôs a música ' + (d.titulo || '') + (d.tom ? ' (tom ' + d.tom + ')' : '');
      case 'musica_del': return 'Tirou a música ' + (d.titulo || '');
      case 'tom': return d.tom ? 'Tom de ' + d.titulo + ': ' + d.tom : 'Tom de ' + d.titulo + ' voltou ao da ficha';
      case 'ordem': return 'Mudou a ordem das músicas';
      case 'cantor': return (d.nome || '') + ' vai cantar ' + (d.titulo || '');
      case 'pessoa_add': return 'Escalou ' + (d.nome || '') + fn;
      case 'pessoa_del': return 'Tirou ' + (d.nome || '') + fn;
      case 'resposta': return (d.nome || '') + (d.status === 'confirmado' ? ' confirmou' : d.status === 'recusado' ? ' não pode' : ' ficou sem resposta') + fn;
      case 'troca': return (d.nome || '') + ' pediu troca' + fn;
      case 'falta': return d.veio === false ? 'Marcou falta de ' + d.nome : d.veio === true ? 'Marcou presença de ' + d.nome : 'Tirou a marcação de ' + d.nome;
      case 'roteiro': return 'Arrumou o roteiro';
      case 'clonada': return 'Escala copiada de ' + (d.de ? L.dm(d.de + 'T12:00:00') : 'outra');
      case 'restaurada': return 'Escala recuperada da lixeira';
      default: return l.kind;
    }
  };
  /** A pessoa que fez (some quando é a própria pessoa da frase: "Ana confirmou"). */
  Rt.logActor = function (l) {
    if (!l.actor) return null;
    var name = L.nameOf(l.actor);
    if ((l.kind === 'resposta' || l.kind === 'troca') && l.detail && l.detail.nome && name.indexOf(l.detail.nome) === 0) return null;
    return l.actor === L.uid() ? 'você' : name;
  };
  function when(iso) {
    var d = new Date(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  var logs = {};
  L.screen('historico', function (r) {
    var s = L.service(r.id);
    if (!s) return h('div', { class: 'screen' }, U.topRow('Histórico'), U.empty('Esta escala não existe mais.'));
    if (!logs[s.id]) {
      logs[s.id] = 'loading';
      sb.from('service_log').select('*').eq('service_id', s.id).order('at', { ascending: false }).limit(300).then(function (x) {
        logs[s.id] = x.error ? { err: true, rows: [] } : { rows: x.data || [] };
        L.render();
      });
    }
    var st = logs[s.id];
    var root = h('div', { class: 'screen' }, U.topRow('Histórico', s.title + ' · ' + L.fullDate(s.starts_on)));
    if (st === 'loading') root.appendChild(U.spinner('Carregando…'));
    else if (st.err) root.appendChild(U.empty('O histórico ainda não está ligado no servidor.'));
    else if (!st.rows.length) root.appendChild(U.empty('Nada mudou nesta escala desde que o histórico começou a ser guardado.'));
    else {
      var day = null;
      st.rows.forEach(function (l) {
        var dd = new Date(l.at), key = dd.toDateString();
        if (key !== day) { day = key; root.appendChild(U.label(L.cap(L.fullDate(L.iso(dd))))); }
        var who = Rt.logActor(l);
        root.appendChild(h('div', { class: 'logrow' }, h('span', { class: 'circle soft' }, ic(KIND_ICON[l.kind] || 'History', 16)),
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi' }, Rt.logText(l)),
            h('div', { class: 'muted small' }, [who ? 'por ' + who : null, when(l.at).slice(6)].filter(Boolean).join(' · ')))));
      });
    }
    return root;
  });
  /** Abre o histórico buscando de novo (o que está guardado pode ser de antes). */
  L.openHistory = function (s) { delete logs[s.id]; L.go({ name: 'historico', id: s.id }); };

  // ------------------------------------------------------------------ Registrar faltas
  L.screen('faltas', function (r) {
    var s = L.service(r.id);
    if (!s) return h('div', { class: 'screen' }, U.topRow('Faltas'), U.empty('Esta escala não existe mais.'));
    var people = L.uniqPeople(s.people);
    var me = L.uid();
    function stateOf(u) {
      var rows = s.people.filter(function (p) { return p.user_id === u; });
      if (rows.some(function (p) { return p.attended === false; })) return false;
      if (rows.some(function (p) { return p.attended === true; })) return true;
      return null;
    }
    function set(u, v) {
      D.scheduleAction(null, function () { return sb.from('service_members').update({ attended: v }).eq('service_id', s.id).eq('user_id', u); });
    }
    var unmarked = people.filter(function (u) { return stateOf(u) === null; });
    return h('div', { class: 'screen' },
      U.topRow('Registrar faltas', s.title + ' · ' + L.fullDate(s.starts_on)),
      s.starts_on > L.today() ? U.empty('Dá para registrar as faltas a partir do dia da escala.') : [
        U.body('Marque quem veio e quem faltou. Fica no histórico da escala e entra nos relatórios.', 'var(--muted)', 13),
        unmarked.length ? U.btn2('Todos os que faltam marcar vieram (' + unmarked.length + ')', 'CheckCheck', function () {
          D.scheduleAction('Presença marcada.', function () { return sb.from('service_members').update({ attended: true }).eq('service_id', s.id).in('user_id', unmarked).is('attended', null); });
        }, { full: true }) : null,
        people.length ? people.map(function (u) {
          var v = stateOf(u);
          var fns = s.people.filter(function (p) { return p.user_id === u; }).map(function (p) { return L.fnLabel(p.function); }).join(', ');
          return h('div', { class: 'row', style: { minHeight: '56px', gap: '10px' } }, U.avatar(L.member(u), 36),
            h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi ell' }, u === me ? 'Você' : L.nameOf(u)), h('div', { class: 'muted small ell' }, fns)),
            U.toggle('Veio', v === true, 'Check', function () { set(u, v === true ? null : true); }),
            U.toggle('Faltou', v === false, 'X', function () { set(u, v === false ? null : false); }));
        }) : U.empty('Ninguém escalado.')]);
  });

  // ------------------------------------------------------------------ Copiar escala para outro dia
  Rt.cloneDialog = function (s) {
    var st = { day: L.addDays(s.starts_on, 7), people: true };
    var dlg = L.dialog({
      title: 'Copiar para outro dia',
      body: function () {
        var inp = h('input', { type: 'date', value: st.day, class: 'dateinput', 'aria-label': 'Dia' });
        inp.addEventListener('change', function () { st.day = inp.value; });
        return [U.body('Vai junto: nome, hora, local, músicas com o tom, quem canta e o roteiro.', 'var(--muted)', 13),
          h('label', { class: 'field' }, inp, h('span', null, 'Novo dia')),
          U.switchRow('Copiar as pessoas', 'Todas ficam como "sem resposta" e recebem o aviso.', st.people, function (v) { st.people = v; })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(st.day || '')) { L.toast('Escolha o dia.'); return; }
          close();
          L.run(async function () {
            var id = L.must(await sb.rpc('clonar_escala', { _service: s.id, _day: st.day, _pessoas: st.people }));
            await D.reloadServices();
            L.toast('Escala copiada para ' + L.fullDate(st.day) + '.');
            L.go({ name: 'escala', id: id });
          });
        } }, 'Copiar')];
      }
    });
    return dlg;
  };

  // ------------------------------------------------------------------ Compartilhar (WhatsApp)
  Rt.shareText = function (s) {
    var out = ['*' + s.title + '*', L.cap(L.fullDate(s.starts_on)) + (L.timeRange(s) ? ' · ' + L.timeRange(s) : '')];
    if (s.location) out.push('Local: ' + s.location);
    var plan = Rt.plan(L.musicOn() ? s.songIds : [], S.items[s.id] || []);
    var hasItems = plan.some(function (x) { return !x.project_id; });
    if (plan.length) {
      out.push('', hasItems ? '*Roteiro*' : '*Músicas*');
      var tl = Rt.timeline(s, plan);
      var n = 0;
      tl.rows.forEach(function (row) {
        var it = row.it;
        if (it.project_id) {
          var p = L.project(it.project_id), ss = s.songs.find(function (x) { return x.project_id === it.project_id; }) || {};
          var key = ss.key || (p && L.keyToPlay(p));
          n++;
          out.push((hasItems && row.start ? row.start + ' ' : n + '. ') + (p ? p.song_title : 'Música') + (key ? ' (' + key + ')' : '') + (ss.singer ? ' · ' + L.nameOf(ss.singer).split(' ')[0] : ''));
        } else out.push((row.start ? row.start + ' ' : '• ') + it.title + (it.note ? ' · ' + it.note : ''));
      });
    }
    var byFn = {};
    s.people.forEach(function (p) { (byFn[p.function] = byFn[p.function] || []).push(L.nameOf(p.user_id)); });
    var fns = Object.keys(byFn).sort(function (a, b) { return L.fnOrder(a) - L.fnOrder(b); });
    if (fns.length) {
      out.push('', '*Equipe*');
      fns.forEach(function (fn) { out.push(L.fnLabel(fn) + ': ' + byFn[fn].join(', ')); });
    }
    if (s.notes) out.push('', s.notes);
    out.push('', 'Confirme no Louvor Studio: https://louvorstudio.app.br');
    return out.join('\n');
  };
  Rt.share = function (s) {
    Rt.load(s.id);
    var text = Rt.shareText(s);
    L.dialog({
      title: 'Compartilhar a escala',
      body: function () { return h('pre', { class: 'sharetext' }, text); },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Fechar'),
          h('button', { class: 'textbtn', onclick: function () {
            (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { L.toast('Texto copiado.'); }, function () { L.toast('Não deu para copiar. Selecione o texto.'); });
          } }, 'Copiar'),
          h('button', { class: 'textbtn', onclick: function () { close(); window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); } }, 'WhatsApp')];
      }
    });
  };

  // ------------------------------------------------------------------ Quadro do mês (escalas × funções)
  Rt.board = function (ym, onMonth) {
    var can = L.perm.schedule();
    var me = L.uid();
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    function shift(n) { var d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    var svcs = S.services.filter(function (s) { return s.starts_on.slice(0, 7) === ym; }).sort(function (a, b) {
      return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
    var used = {};
    svcs.forEach(function (s) { s.people.forEach(function (p) { used[p.function] = true; }); });
    if (can) S.members.forEach(function (mb) { mb.functions.forEach(function (f) { used[f] = true; }); });
    var fns = Object.keys(used).sort(function (a, b) { return L.fnOrder(a) - L.fnOrder(b); });
    var head = h('div', { class: 'row' }, U.iconBtn('ChevronLeft', 'Mês anterior', function () { onMonth(shift(-1)); }),
      h('div', { class: 'grow center hi semi', style: { fontSize: '16px' } }, L.cap(L.MESES[m - 1]) + ' de ' + y),
      U.iconBtn('ChevronRight', 'Próximo mês', function () { onMonth(shift(1)); }));
    if (!svcs.length) return [head, U.empty('Nenhuma escala neste mês.')];
    var grid = h('div', { class: 'board', style: { gridTemplateColumns: '108px repeat(' + svcs.length + ', minmax(132px, 1fr))' } });
    grid.appendChild(h('div', { class: 'bh corner' }, ic('CalendarDays', 18, 'muted')));
    svcs.forEach(function (s) {
      var d = L.d(s.starts_on);
      grid.appendChild(h('button', { class: 'bh' + (s.starts_on < L.today() ? ' past' : ''), onclick: function () { L.go({ name: 'escala', id: s.id }); } },
        h('div', { class: 'row', style: { gap: '6px' } }, h('b', null, String(d.getDate())), h('span', { class: 'small' }, L.SEMANA_CURTA[L.dow(s.starts_on) - 1].toLowerCase()),
          s.start_time ? h('span', { class: 'muted small' }, L.hhmm(s.start_time)) : null),
        h('div', { class: 'muted tiny ell' }, s.title)));
    });
    fns.forEach(function (fn) {
      grid.appendChild(h('div', { class: 'bf' }, ic(L.fnIcon(fn), 16, 'muted'), h('span', { class: 'small semi' }, L.fnLabel(fn))));
      svcs.forEach(function (s) {
        var ps = s.people.filter(function (p) { return p.function === fn; });
        var editable = can && s.starts_on >= L.today();
        grid.appendChild(h('div', { class: 'bc' + (editable ? ' can' : ''), role: editable ? 'button' : null, onclick: editable ? function () { L.addPersonDialog(s, fn); } : null },
          ps.map(function (p) {
            var st = p.swap_requested ? 'warn' : p.status === 'confirmado' ? 'ok' : p.status === 'recusado' ? 'bad' : 'wait';
            return h('div', { class: 'bp' + (p.user_id === me ? ' me' : '') }, h('i', { class: 'st ' + st }), h('span', { class: 'ell' }, L.nameOf(p.user_id).split(' ').slice(0, 2).join(' ')));
          }),
          !ps.length && editable ? h('span', { class: 'plus' }, ic('Plus', 16)) : null));
      });
    });
    var legend = h('div', { class: 'row wrap muted small', style: { gap: '12px' } },
      [['ok', 'Confirmou'], ['wait', 'Sem resposta'], ['warn', 'Pediu troca'], ['bad', 'Não pode']].map(function (x) { return h('span', { class: 'row', style: { gap: '6px' } }, h('i', { class: 'st ' + x[0] }), x[1]); }));
    return [head, can ? U.body('Toque num quadrinho para escalar alguém naquela função.', 'var(--muted)', 12) : null, h('div', { class: 'boardwrap' }, grid), legend];
  };

  // ------------------------------------------------------------------ Relatórios
  var RANGES = [['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês'], ['90', '3 meses'], ['365', '12 meses']];
  var Rp = { range: '30', dows: [], person: null, data: null, key: null, busy: false };
  function rangeDates(r) {
    var t = L.today();
    if (r === 'mes') return [t.slice(0, 8) + '01', t];
    return [L.addDays(t, -(+r) + 1), t];
  }
  function loadReport() {
    var dates = rangeDates(Rp.range);
    var key = [S.current.org.id, Rp.range, Rp.dows.join(','), Rp.person].join('|');
    if (Rp.key === key || Rp.busy) return;
    Rp.busy = true;
    sb.rpc('relatorio_banda', { _org: S.current.org.id, _de: dates[0], _ate: dates[1], _dias: Rp.dows.length ? Rp.dows : null, _pessoa: Rp.person })
      .then(function (r) { Rp.busy = false; Rp.key = key; Rp.data = r.error ? { err: L.errorText(r.error) } : r.data; L.render(); },
        function (x) { Rp.busy = false; Rp.key = key; Rp.data = { err: L.errorText(x) }; L.render(); });
  }
  function tile(label, value, sub, f, color) {
    return h('div', { class: 'stat' }, h('div', { class: 'v' }, String(value)), h('div', { class: 'k' }, label), sub ? h('div', { class: 'muted tiny' }, sub) : null, f != null ? U.bar(f, color) : null);
  }
  L.screen('relatorios', function () {
    loadReport();
    var d = Rp.data;
    var DOW = [['D', 0], ['S', 1], ['T', 2], ['Q', 3], ['Q', 4], ['S', 5], ['S', 6]];
    var root = h('div', { class: 'screen' }, U.topRow('Relatórios', 'Escalas, músicas e presença da banda'),
      h('div', { class: 'hscroll' }, RANGES.map(function (r) { return U.toggle(r[1], Rp.range === r[0], null, function () { Rp.range = r[0]; L.render(); }); })),
      h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'muted small', style: { marginRight: '4px' } }, 'Dias'),
        DOW.map(function (x) {
          var on = Rp.dows.indexOf(x[1]) >= 0;
          return h('button', { class: 'dowbtn' + (on ? ' on' : ''), 'aria-pressed': String(on), 'aria-label': L.SEMANA[(x[1] + 6) % 7], onclick: function () {
            Rp.dows = on ? Rp.dows.filter(function (v) { return v !== x[1]; }) : Rp.dows.concat([x[1]]).sort();
            L.render();
          } }, x[0]);
        })),
      h('div', { class: 'row' }, U.btn2(Rp.person ? L.nameOf(Rp.person) : 'Todas as pessoas', 'UserRound', personDialog, { full: true }),
        Rp.person ? U.iconBtn('X', 'Todas as pessoas', function () { Rp.person = null; L.render(); }) : null));
    if (!d || Rp.busy) { root.appendChild(U.spinner('Calculando…')); return root; }
    if (d.err) { root.appendChild(U.empty(/function|schema cache|does not exist/i.test(d.err) ? 'Os relatórios ainda não estão ligados no servidor.' : d.err)); return root; }
    var conf = d.escalacoes ? d.confirmadas / d.escalacoes : 0;
    root.appendChild(h('div', { class: 'stats' },
      tile('Escalas', d.escalas),
      tile('Escalações', d.escalacoes, 'pessoa em cada função'),
      tile('Confirmaram', Math.round(conf * 100) + '%', d.confirmadas + ' de ' + d.escalacoes, conf, 'var(--ok)'),
      tile('Não puderam', d.recusadas),
      tile('Faltas', d.faltas, 'registradas depois do culto'),
      tile('Dias indisponíveis', d.indisponibilidades)));
    var mus = d.musicas || [];
    if (mus.length && L.musicOn()) {
      var max = mus[0].vezes || 1;
      root.appendChild(U.panel('Músicas mais tocadas', 'ListMusic', mus.slice(0, 20).map(function (x, i) {
        var p = L.project(x.id);
        return h('div', { class: 'rankrow', role: p ? 'button' : null, onclick: p ? function () { L.songSheet(p.id); } : null },
          h('span', { class: 'muted mono small', style: { width: '22px' } }, '#' + (i + 1)),
          p ? U.cover(p, 36, 4, 15) : null,
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi ell' }, x.titulo), h('div', { class: 'muted small ell' }, [x.artista, 'última: ' + L.dm(x.ultima + 'T12:00:00')].filter(Boolean).join(' · ')),
            U.bar(x.vezes / max)),
          h('span', { class: 'hi semi' }, x.vezes + 'x'));
      }), mus.length > 20 ? U.body('E mais ' + (mus.length - 20) + '.', 'var(--muted)', 12) : null));
      var unused = S.projects.filter(function (p) { return !mus.some(function (x) { return x.id === p.id; }); }).length;
      if (unused && !Rp.person) root.appendChild(U.body(L.plural(unused, 'música do repertório não foi tocada', 'músicas do repertório não foram tocadas') + ' nesse período.', 'var(--muted)', 12));
    }
    var pes = d.pessoas || [];
    if (pes.length) {
      root.appendChild(U.panel('Pessoas', 'UsersRound', pes.map(function (x) {
        var resp = x.escalas ? x.confirmou / (x.confirmou + x.recusou + x.pendente || 1) : 0;
        return h('div', { class: 'rankrow' }, U.avatar(L.member(x.id) || { name: x.nome, user_id: x.id }, 34),
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi ell' }, x.nome),
            h('div', { class: 'muted small' }, [L.plural(x.escalas, 'escala', 'escalas'), 'confirmou ' + x.confirmou, x.recusou ? 'não pôde ' + x.recusou : null,
              x.faltou ? 'faltou ' + x.faltou : null, x.indisponivel ? L.plural(x.indisponivel, 'dia indisponível', 'dias indisponíveis') : null].filter(Boolean).join(' · ')),
            U.bar(resp, 'var(--ok)')),
          h('span', { class: 'hi semi' }, x.escalas));
      })));
    }
    var fns = d.funcoes || [];
    if (fns.length) root.appendChild(U.panel('Funções', 'Guitar', fns.map(function (x) { return U.keyValue(L.fnLabel(x.funcao), L.plural(x.vezes, 'vez', 'vezes')); })));
    var aus = (d.ausentes || []).filter(function (x) { return !pes.some(function (p) { return p.id === x.id; }); });
    if (aus.length) root.appendChild(U.panel('Marcaram dias que não podem', 'CalendarX', aus.map(function (x) { return U.keyValue(x.nome, L.plural(x.dias, 'dia', 'dias')); })));
    if (!d.escalas) root.appendChild(U.empty('Nenhuma escala nesse período.'));
    return root;
  });
  function personDialog() {
    L.dialog({
      title: 'Ver de uma pessoa',
      body: function (close) {
        return S.members.map(function (m) {
          return h('div', { class: 'row', style: { minHeight: '48px', gap: '10px', cursor: 'pointer' }, onclick: function () { close(); Rp.person = m.user_id; L.render(); } },
            U.avatar(m, 32), h('span', { class: 'hi semi grow' }, m.name), Rp.person === m.user_id ? ic('Check', 18) : null);
        });
      },
      actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Fechar')]; }
    });
  }

  // ------------------------------------------------------------------ Lixeira
  var Lx = { rows: null, busy: false };
  function loadTrash() {
    Lx.busy = true;
    sb.rpc('lixeira_listar', { _org: S.current.org.id }).then(function (r) {
      Lx.busy = false; Lx.rows = r.error ? { err: L.errorText(r.error) } : (r.data || []); L.render();
    }, function (x) { Lx.busy = false; Lx.rows = { err: L.errorText(x) }; L.render(); });
  }
  L.openTrash = function () { Lx.rows = null; L.go({ name: 'lixeira' }); };
  L.screen('lixeira', function () {
    if (Lx.rows === null && !Lx.busy) loadTrash();
    var rows = Lx.rows;
    var root = h('div', { class: 'screen' }, U.topRow('Lixeira', 'Escalas e músicas apagadas nos últimos 30 dias'));
    if (rows === null) { root.appendChild(U.spinner('Carregando…')); return root; }
    if (rows.err) { root.appendChild(U.empty(/function|schema cache|does not exist/i.test(rows.err) ? 'A lixeira ainda não está ligada no servidor.' : rows.err)); return root; }
    if (!rows.length) { root.appendChild(U.empty('A lixeira está vazia. O que for apagado fica aqui por 30 dias.')); return root; }
    rows.forEach(function (x) {
      var song = x.kind === 'musica';
      root.appendChild(h('div', { class: 'panel', style: { gap: '8px' } },
        h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'circle soft' }, ic(song ? 'Music2' : 'CalendarDays', 17)),
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi ell' }, x.title),
            h('div', { class: 'muted small' }, (song ? 'Música' : 'Escala') + ' apagada por ' + (x.apagado_por || 'alguém') + ' em ' + when(x.apagado_em)))),
        song && x.com_audio ? U.body('Volta com os dados (tom, links, letra). A multitrack e as gravações não voltam: envie as faixas de novo.', 'var(--warn)', 12) : null,
        h('div', { class: 'row', style: { gap: '8px' } },
          U.btn2('Recuperar', 'ArchiveRestore', function () {
            L.run(async function () {
              var id = L.must(await sb.rpc('lixeira_restaurar', { _id: x.id }));
              if (song) await D.reloadSongs(); else { await D.reloadServices(); delete S.items[id]; }
              Lx.rows = Lx.rows.filter(function (y) { return y.id !== x.id; });
              L.toast(song ? 'Música recuperada.' : 'Escala recuperada.');
              L.render();
            });
          }, { full: true }),
          U.btn2('Apagar de vez', 'Trash2', function () {
            L.confirm('Apagar de vez?', '“' + x.title + '” sai da lixeira e não dá mais para recuperar.', 'Apagar', function () {
              L.run(async function () { L.must(await sb.rpc('lixeira_apagar', { _id: x.id })); Lx.rows = Lx.rows.filter(function (y) { return y.id !== x.id; }); L.render(); });
            }, true);
          }, { full: true, danger: true }))));
    });
    return root;
  });

  // ------------------------------------------------------------------ Equipe sem músicas (Banda, só o líder)
  Rt.loadOrgFlags = async function () {
    S.musicOn = true;
    if (!S.current) return;
    var r = await sb.from('organizations').select('music_enabled').eq('id', S.current.org.id).maybeSingle();
    if (!r.error && r.data && r.data.music_enabled === false) S.musicOn = false;
    if (!S.musicOn && S.tab === 'musicas') S.tab = 'inicio';
  };
  Rt.musicPanel = function () {
    return U.panel('Músicas', 'Music2',
      U.switchRow('Esta equipe usa músicas', S.musicOn ? 'Repertório, músicas nas escalas e estúdio aparecem para todos.'
        : 'Desligado: some o repertório e as músicas das escalas. Bom para mídia, iluminação, recepção, transmissão.', S.musicOn, function (on) {
        L.run(async function () {
          L.must(await sb.from('organizations').update({ music_enabled: on }).eq('id', S.current.org.id));
          S.musicOn = on;
          L.toast(on ? 'Músicas ligadas.' : 'Músicas desligadas para esta equipe.');
          L.render();
        });
      }));
  };
})();
