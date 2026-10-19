// Louvor Studio — Escalas (cultos, ensaios e eventos) e Mural de avisos.
// Quem monta escala (líder ou quem tem "pode montar escalas"): dia, hora, local, músicas com o tom do dia
// e as pessoas em cada função. Todos veem; cada um confirma pelo app. Precisa das migrações 0010 e 0011.
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }

  var ag = {
    loadedFor: null, loading: false, missing: false, old: false,
    services: [], songs: {}, people: {}, off: {}, showPast: false, editing: null
  };

  var KINDS = [['culto', 'Culto'], ['ensaio', 'Ensaio'], ['evento', 'Evento']];
  var FUNCS = [['ministro', 'Ministro(a) de louvor'], ['backing_vocal', 'Backing vocal'], ['violao', 'Violão'],
    ['guitarra', 'Guitarra'], ['baixo', 'Baixo'], ['bateria', 'Bateria'], ['teclado', 'Teclado'], ['percussao', 'Percussão'],
    ['sopro', 'Sopro'], ['cordas', 'Cordas'], ['tecnico_som', 'Técnico(a) de som'], ['projecao', 'Projeção/mídia']];
  var STATUS = { pendente: ['Sem resposta', 'pending', ''], confirmado: ['Confirmado', 'check', 'ok'], recusado: ['Não pode', 'discard', 'bad'] };

  function fnLabel(id) { var f = FUNCS.find(function (x) { return x[0] === id; }); return f ? f[1] : id; }
  function kindLabel(k) { var f = KINDS.find(function (x) { return x[0] === k; }); return f ? f[1] : 'Culto'; }

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return iso(new Date()); }
  function parse(s) { var p = s.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }

  var WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function fmtDay(s) { var p = s.split('-'); return WEEK[parse(s).getDay()] + ', ' + p[2] + '/' + p[1]; }
  function hhmm(t) { return t ? String(t).slice(0, 5) : ''; }
  function timeText(svc) { return [hhmm(svc.start_time), hhmm(svc.end_time)].filter(Boolean).join(' – '); }

  function whenText(s) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var n = Math.round((parse(s) - t) / 86400000);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n > 1 && n < 7) return 'em ' + n + ' dias';
    return '';
  }

  function canSchedule() { var S = A().state(); return S.role === 'leader' || !!S.canSchedule; }

  // ------------------------------------------------------------------ Dados
  function load() {
    var S = A().state();
    if (!S.org) return Promise.resolve();
    var sb = A().client();
    ag.loading = true;
    return sb.from('services').select('*').eq('org_id', S.org.id).order('starts_on').order('start_time', { nullsFirst: true }).then(function (res) {
      if (res.error) {
        var msg = res.error.message || '';
        ag.missing = /does not exist|schema cache/i.test(msg);
        if (!ag.missing) throw res.error;
        ag.services = [];
        return null;
      }
      ag.missing = false;
      ag.services = res.data || [];
      ag.old = ag.services.length > 0 && !('kind' in ag.services[0]);
      var ids = ag.services.map(function (s) { return s.id; });
      return Promise.all([
        ids.length ? sb.from('service_songs').select('*').in('service_id', ids).order('position') : Promise.resolve({ data: [] }),
        ids.length ? sb.from('service_members').select('*').in('service_id', ids) : Promise.resolve({ data: [] }),
        sb.from('unavailability').select('user_id,day').eq('org_id', S.org.id).gte('day', today())
      ]).then(function (r) {
        ag.songs = {}; ag.people = {}; ag.off = {};
        A().must(r[0]).forEach(function (row) { (ag.songs[row.service_id] = ag.songs[row.service_id] || []).push(row); });
        if (r[1].error) { ag.old = true; } else (r[1].data || []).forEach(function (row) { (ag.people[row.service_id] = ag.people[row.service_id] || []).push(row); });
        if (!r[2].error) (r[2].data || []).forEach(function (row) { ag.off[row.user_id + '|' + row.day] = true; });
      });
    }).then(function () {
      ag.loading = false;
      ag.loadedFor = S.org.id;
      A().rerender();
    }).catch(function (e) {
      ag.loading = false;
      ag.loadedFor = S.org.id;
      A().flash('err', A().friendly(e));
      A().rerender();
    });
  }

  function run(promise, okText) {
    return Promise.resolve(promise).then(function (res) {
      (Array.isArray(res) ? res : [res]).forEach(function (r) { if (r && r.error) throw r.error; });
    }).then(load).then(function () {
      if (okText) A().flash('ok', okText);
      A().rerender();
    }).catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
  }

  function project(id) { return A().state().projects.find(function (p) { return p.id === id; }) || null; }
  function member(id) { return A().state().members.find(function (m) { return m.user_id === id; }) || null; }
  function nameOf(id) { var m = member(id); return m ? m.name : 'Alguém'; }

  // ------------------------------------------------------------------ Formulário (nova / editar)
  function serviceForm(svc) {
    var S = A().state();
    var editing = !!svc;
    var kind = h('select', null, KINDS.map(function (k) { return h('option', { value: k[0], selected: (svc ? svc.kind : 'culto') === k[0] }, k[1]); }));
    var title = h('input', { type: 'text', maxlength: '80', placeholder: 'Ex.: Culto de domingo', value: svc ? svc.title : '' });
    var date = h('input', { type: 'date', required: true, value: svc ? svc.starts_on : addDays(today(), 1) });
    var start = h('input', { type: 'time', value: svc ? hhmm(svc.start_time) : '19:00' });
    var end = h('input', { type: 'time', value: svc ? hhmm(svc.end_time) : '' });
    var place = h('input', { type: 'text', maxlength: '120', placeholder: 'Ex.: Templo, sala de ensaio', value: svc && svc.location ? svc.location : '' });
    var notes = h('input', { type: 'text', maxlength: '500', placeholder: 'Opcional', value: svc && svc.notes ? svc.notes : '' });
    var repeat = h('select', null, h('option', { value: '0' }, 'Não repete'), h('option', { value: '7' }, 'Toda semana'), h('option', { value: '14' }, 'A cada 15 dias'));
    var times = h('select', null, [4, 8, 12, 26].map(function (n) { return h('option', { value: String(n), selected: n === 8 }, n + ' vezes'); }));

    function suggested() {
      if (kind.value === 'ensaio') return 'Ensaio';
      if (kind.value === 'evento') return 'Evento';
      var w = WEEK[parse(date.value || today()).getDay()];
      return 'Culto de ' + (w === 'sábado' || w === 'domingo' ? w : w + '-feira');
    }

    return h('form', { class: 'card stack', onsubmit: function (ev) {
      ev.preventDefault();
      var row = { title: title.value.trim() || suggested(), kind: kind.value, start_time: start.value || null, end_time: end.value || null,
        location: place.value.trim() || null, notes: notes.value.trim() || null };
      var sb = A().client();
      if (editing) {
        row.starts_on = date.value;
        ag.editing = null;
        run(sb.from('services').update(row).eq('id', svc.id), 'Escala salva.');
        return;
      }
      var step = Number(repeat.value), n = step ? Number(times.value) : 1;
      var series = n > 1 && window.crypto && crypto.randomUUID ? crypto.randomUUID() : null;
      var rows = [];
      for (var i = 0; i < n; i++) rows.push(Object.assign({ org_id: S.org.id, starts_on: addDays(date.value, step * i), series_id: series }, row));
      run(sb.from('services').insert(rows), n > 1 ? n + ' escalas criadas. Agora escolha músicas e pessoas.' : 'Escala criada. Agora escolha músicas e pessoas.');
    } },
      h('h2', null, editing ? 'Editar escala' : 'Nova escala'),
      h('div', { class: 'row', style: 'gap:12px' },
        h('label', { class: 'f', style: 'flex:0 0 130px' }, 'Tipo', kind),
        h('label', { class: 'f', style: 'flex:2;min-width:180px' }, 'Nome', title),
        h('label', { class: 'f', style: 'flex:1;min-width:150px' }, 'Dia', date)),
      h('div', { class: 'row', style: 'gap:12px' },
        h('label', { class: 'f', style: 'flex:0 0 120px' }, 'Começa', start),
        h('label', { class: 'f', style: 'flex:0 0 120px' }, 'Termina', end),
        h('label', { class: 'f', style: 'flex:1;min-width:180px' }, 'Local', place)),
      h('label', { class: 'f' }, 'Observação para a banda', notes),
      editing ? null : h('div', { class: 'row', style: 'gap:12px' },
        h('label', { class: 'f', style: 'flex:0 0 170px' }, 'Repetir', repeat),
        h('label', { class: 'f', style: 'flex:0 0 130px' }, 'Quantas vezes', times)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'submit' }, Icons.icon(editing ? 'check' : 'add', 15), editing ? 'Salvar' : 'Criar'),
        editing ? h('button', { class: 'btn sec2', type: 'button', onclick: function () { ag.editing = null; A().rerender(); } }, 'Cancelar') : null));
  }

  // ------------------------------------------------------------------ Cartão de uma escala
  function songsBlock(svc, can) {
    var sb = A().client();
    var S = A().state();
    var list = (ag.songs[svc.id] || []).slice().sort(function (a, b) { return a.position - b.position; });
    var inList = {};
    list.forEach(function (r) { inList[r.project_id] = true; });

    function move(i, dir) {
      var a = list[i], b = list[i + dir];
      if (!a || !b) return;
      run(Promise.all([
        sb.from('service_songs').update({ position: b.position }).eq('service_id', svc.id).eq('project_id', a.project_id),
        sb.from('service_songs').update({ position: a.position }).eq('service_id', svc.id).eq('project_id', b.project_id)
      ]));
    }

    var addSel = null;
    if (can) {
      var options = S.projects.filter(function (p) { return !inList[p.id]; }).sort(function (a, b) { return a.song_title.localeCompare(b.song_title); });
      addSel = h('select', { 'aria-label': 'Adicionar música a ' + svc.title, onchange: function () {
        if (!addSel.value) return;
        var pos = list.length ? list[list.length - 1].position + 1 : 1;
        run(sb.from('service_songs').insert({ service_id: svc.id, project_id: addSel.value, position: pos }));
      } },
        h('option', { value: '' }, options.length ? '+ Adicionar música…' : 'Todas as músicas já estão na lista'),
        options.map(function (p) { return h('option', { value: p.id }, p.song_title + (p.artist ? ' · ' + p.artist : '')); }));
    }

    return h('div', { class: 'stack', style: 'gap:8px' },
      h('h3', { style: 'margin:0' }, 'Músicas (' + list.length + ')'),
      list.length ? h('ol', { class: 'ag-list' }, list.map(function (row, i) {
        var p = project(row.project_id);
        var base = p ? (p.band_key || p.musical_key || '') : '';
        var key = can && !ag.old ? h('input', { type: 'text', class: 'ag-key', maxlength: '12', value: row.song_key || '', placeholder: base || 'Tom',
          title: 'Tom neste dia (vazio = tom da ficha)', 'aria-label': 'Tom neste dia',
          onchange: function (ev) {
            run(sb.from('service_songs').update({ song_key: ev.target.value.trim() || null }).eq('service_id', svc.id).eq('project_id', row.project_id), 'Tom salvo.');
          } }) : null;
        return h('li', { class: 'ag-row' },
          h('span', { class: 'ag-n mono' }, String(i + 1)),
          h('div', { class: 'ag-song' },
            h('strong', null, p ? p.song_title : 'Música removida'),
            p ? h('span', { class: 'mu' }, [p.artist, (row.song_key || base) ? 'Tom ' + (row.song_key || base) + (row.song_key ? ' (neste dia)' : '') : null].filter(Boolean).join(' · ')) : null),
          key,
          p ? h('button', { class: 'btn sec2 sm icon-only', title: 'Abrir no estúdio', 'aria-label': 'Abrir ' + p.song_title + ' no estúdio',
            onclick: function () { A().openStudio(p.id, false); } }, Icons.icon('estudio', 14)) : null,
          can ? h('button', { class: 'btn sec2 sm icon-only', title: 'Subir', 'aria-label': 'Subir', disabled: i === 0, onclick: function () { move(i, -1); } }, '↑') : null,
          can ? h('button', { class: 'btn sec2 sm icon-only', title: 'Descer', 'aria-label': 'Descer', disabled: i === list.length - 1, onclick: function () { move(i, 1); } }, '↓') : null,
          can ? h('button', { class: 'btn sec2 sm icon-only', title: 'Tirar da lista', 'aria-label': 'Tirar da lista', onclick: function () {
            run(sb.from('service_songs').delete().eq('service_id', svc.id).eq('project_id', row.project_id));
          } }, Icons.icon('discard', 13)) : null);
      })) : h('p', { class: 'mu', style: 'margin:0' }, can ? 'Nenhuma música ainda. Escolha abaixo.' : 'Ainda sem músicas.'),
      addSel);
  }

  function peopleBlock(svc, can) {
    if (ag.old) return h('div', { class: 'msg info' }, 'Para escalar pessoas, rode a migração 0011_escalas_conversas.sql no SQL Editor do Supabase.');
    var sb = A().client();
    var S = A().state();
    var list = ag.people[svc.id] || [];
    var byFn = {};
    list.forEach(function (p) { (byFn[p.function] = byFn[p.function] || []).push(p); });
    var order = FUNCS.map(function (f) { return f[0]; });
    var fns = Object.keys(byFn).sort(function (a, b) { return (order.indexOf(a) + 100) % 200 - (order.indexOf(b) + 100) % 200; });

    var fnSel = h('select', { 'aria-label': 'Função' }, FUNCS.map(function (f) { return h('option', { value: f[0] }, f[1]); }));
    var who = h('select', { 'aria-label': 'Pessoa' });
    function fillWho() {
      while (who.firstChild) who.removeChild(who.firstChild);
      var f = fnSel.value;
      // Só quem marcou essa função no perfil.
      var ms = S.members.filter(function (m) { return (m.functions || []).indexOf(f) >= 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      who.appendChild(h('option', { value: '' }, ms.length ? 'Quem?' : 'Ninguém marcou esta função no perfil'));
      ms.forEach(function (m) {
        var already = list.some(function (p) { return p.user_id === m.user_id && p.function === f; });
        var off = ag.off[m.user_id + '|' + svc.starts_on];
        who.appendChild(h('option', { value: m.user_id, disabled: already },
          m.name + (already ? ' (já está)' : off ? ' ⚠ não pode neste dia' : '')));
      });
    }
    fnSel.onchange = fillWho;
    fillWho();

    return h('div', { class: 'stack', style: 'gap:8px' },
      h('h3', { style: 'margin:0' }, 'Pessoas (' + list.length + ')'),
      list.length ? h('ul', { class: 'ag-list' }, fns.map(function (fn) {
        return byFn[fn].map(function (p) {
          var st = STATUS[p.status] || STATUS.pendente;
          var m = member(p.user_id);
          return h('li', { class: 'ag-row' },
            m && window.ProfilePage ? window.ProfilePage.avatar(m, 28) : null,
            h('div', { class: 'ag-song' },
              h('strong', null, nameOf(p.user_id)),
              h('span', { class: 'mu' }, fnLabel(fn) + (ag.off[p.user_id + '|' + svc.starts_on] ? ' · ⚠ marcou que não pode' : '') + (p.note ? ' · "' + p.note + '"' : ''))),
            p.swap_requested ? h('span', { class: 'chip warn' }, Icons.icon('redetect', 12), 'Pediu troca') : h('span', { class: 'chip ' + st[2] }, Icons.icon(st[1], 12), st[0]),
            can ? h('button', { class: 'btn sec2 sm icon-only', title: 'Tirar da escala', 'aria-label': 'Tirar ' + nameOf(p.user_id) + ' da escala', onclick: function () {
              run(sb.from('service_members').delete().eq('service_id', svc.id).eq('user_id', p.user_id).eq('function', p.function));
            } }, Icons.icon('discard', 13)) : null);
        });
      })) : h('p', { class: 'mu', style: 'margin:0' }, can ? 'Ninguém escalado ainda. Escolha a função e a pessoa abaixo.' : 'Ninguém escalado ainda.'),
      can ? h('div', { class: 'row', style: 'gap:8px' }, fnSel, who,
        h('button', { class: 'btn sec2 sm', onclick: function () {
          if (!who.value) return;
          run(sb.from('service_members').insert({ service_id: svc.id, user_id: who.value, function: fnSel.value }), nameOf(who.value) + ' escalado(a).');
        } }, Icons.icon('add', 13), 'Escalar')) : null);
  }

  function missingText(svc) {
    var people = ag.people[svc.id] || [];
    var out = [];
    if (!(ag.songs[svc.id] || []).length) out.push('sem músicas');
    if (!ag.old && !people.length) out.push('ninguém escalado');
    var pend = people.filter(function (p) { return p.status === 'pendente' && !p.swap_requested; }).length;
    var no = people.filter(function (p) { return p.status === 'recusado'; }).length;
    var sw = people.filter(function (p) { return p.swap_requested; }).length;
    if (pend) out.push(pend + ' sem resposta');
    if (no) out.push(no + ' não pode');
    if (sw) out.push(sw + ' pediu troca');
    return out;
  }

  function serviceCard(svc, can) {
    var sb = A().client();
    if (ag.editing === svc.id) return serviceForm(svc);
    var when = whenText(svc.starts_on);
    var miss = missingText(svc);
    return h('div', { class: 'card stack ag-card' },
      h('div', { class: 'row sp-b' },
        h('div', null,
          h('div', { class: 'row', style: 'gap:8px' },
            svc.kind ? h('span', { class: 'chip ag-' + svc.kind }, kindLabel(svc.kind)) : null,
            h('h2', { style: 'margin:0' }, svc.title)),
          h('p', { class: 'mu', style: 'margin:2px 0 0' },
            [fmtDay(svc.starts_on) + (when ? ' (' + when + ')' : ''), timeText(svc), svc.location].filter(Boolean).join(' · '))),
        can ? h('div', { class: 'row', style: 'gap:6px' },
          h('button', { class: 'btn sec2 sm', onclick: function () { ag.editing = svc.id; A().rerender(); } }, Icons.icon('edit', 13), 'Editar'),
          h('button', { class: 'btn sec2 sm danger', onclick: function () {
            if (svc.series_id && window.confirm('Esta escala se repete. Apagar também as próximas da mesma série?\nOK = esta e as próximas · Cancelar = escolher só esta')) {
              run(sb.from('services').delete().eq('series_id', svc.series_id).gte('starts_on', svc.starts_on), 'Escalas apagadas.');
            } else if (window.confirm('Apagar "' + svc.title + '" de ' + fmtDay(svc.starts_on) + '? As músicas continuam no repertório.')) {
              run(sb.from('services').delete().eq('id', svc.id), 'Escala apagada.');
            }
          } }, Icons.icon('trash', 13), 'Apagar')) : null),
      svc.notes ? h('p', { style: 'margin:0' }, svc.notes) : null,
      miss.length && can ? h('div', { class: 'msg warn', style: 'margin:0' }, 'Falta: ' + miss.join(', ') + '.') : null,
      h('div', { class: 'ag-cols' }, songsBlock(svc, can), peopleBlock(svc, can)));
  }

  function view() {
    var S = A().state();
    var can = canSchedule();
    if (S.org && ag.loadedFor !== S.org.id && !ag.loading) load();
    var head = h('div', null,
      h('h1', null, 'Escalas'),
      h('p', { class: 'mu', style: 'margin-top:0' }, can
        ? 'Monte cultos, ensaios e eventos: dia, hora, local, as músicas (com o tom do dia) e quem toca e canta. Cada pessoa confirma pelo app do celular.'
        : 'Cultos, ensaios e eventos da banda. Para confirmar presença, use o app do celular.'));
    if (ag.loading && ag.loadedFor !== (S.org && S.org.id)) return h('div', null, head, h('p', { class: 'mu' }, 'Carregando…'));
    if (ag.missing) return h('div', null, head, h('div', { class: 'msg info' }, 'Para usar as escalas, rode a migração 0010_song_details_agenda.sql (e depois a 0011) no SQL Editor do Supabase.'));
    var t = today();
    var upcoming = ag.services.filter(function (s) { return s.starts_on >= t; });
    var past = ag.services.filter(function (s) { return s.starts_on < t; }).reverse();
    return h('div', null, head,
      ag.old ? h('div', { class: 'msg info' }, 'Rode a migração 0011_escalas_conversas.sql no Supabase para liberar hora, local, tipo, repetição e pessoas na escala.') : null,
      can && !ag.editing ? serviceForm(null) : null,
      upcoming.length ? upcoming.map(function (s) { return serviceCard(s, can); })
        : h('p', { class: 'mu' }, 'Nenhuma escala marcada' + (can ? '. Crie a primeira acima.' : '.')),
      past.length ? h('div', null,
        h('button', { class: 'btn link', onclick: function () { ag.showPast = !ag.showPast; A().rerender(); } },
          (ag.showPast ? 'Esconder' : 'Ver') + ' escalas que já passaram (' + past.length + ')'),
        ag.showPast ? past.map(function (s) { return serviceCard(s, false); }) : null) : null);
  }

  function reset() { ag.loadedFor = null; ag.editing = null; mu.loadedFor = null; }

  // ================================================================== Mural de avisos
  var mu = { loadedFor: null, loading: false, missing: false, list: [] };

  function loadMural() {
    var S = A().state();
    if (!S.org) return Promise.resolve();
    mu.loading = true;
    return A().client().from('announcements').select('*').eq('org_id', S.org.id).order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(function (res) {
        mu.loading = false; mu.loadedFor = S.org.id;
        if (res.error) {
          mu.missing = /does not exist|schema cache/i.test(res.error.message || '');
          if (!mu.missing) A().flash('err', A().friendly(res.error));
          mu.list = [];
        } else { mu.missing = false; mu.list = res.data || []; }
        A().rerender();
      });
  }

  function runMural(p, ok) {
    Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; }).then(loadMural).then(function () {
      if (ok) A().flash('ok', ok);
      A().rerender();
    }).catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
  }

  function muralView() {
    var S = A().state();
    var leader = S.role === 'leader';
    if (S.org && mu.loadedFor !== S.org.id && !mu.loading) loadMural();
    var head = h('div', null, h('h1', null, 'Mural'),
      h('p', { class: 'mu', style: 'margin-top:0' }, 'Avisos do líder para a banda. Aparecem na tela de Início do app; os fixados ficam em cima.'));
    if (mu.missing) return h('div', null, head, h('div', { class: 'msg info' }, 'Para usar o mural, rode a migração 0011_escalas_conversas.sql no SQL Editor do Supabase.'));
    var sb = A().client();
    var form = null;
    if (leader) {
      var title = h('input', { type: 'text', maxlength: '100', required: true, placeholder: 'Ex.: Ensaio geral no sábado' });
      var body = h('textarea', { maxlength: '2000', rows: '3', placeholder: 'Opcional' });
      var pin = h('input', { type: 'checkbox', class: 'switch' });
      form = h('form', { class: 'card stack', onsubmit: function (ev) {
        ev.preventDefault();
        runMural(sb.from('announcements').insert({ org_id: S.org.id, title: title.value.trim(), body: body.value.trim() || null, pinned: pin.checked }), 'Aviso publicado.');
      } },
        h('h2', null, 'Novo aviso'),
        h('label', { class: 'f' }, 'Título', title),
        h('label', { class: 'f' }, 'Texto', body),
        h('label', { class: 'row', style: 'gap:8px' }, pin, 'Fixar no topo'),
        h('div', null, h('button', { class: 'btn', type: 'submit' }, Icons.icon('publish', 15), 'Publicar')));
    }
    return h('div', null, head, form,
      mu.list.length ? mu.list.map(function (n) {
        var d = new Date(n.created_at);
        return h('div', { class: 'card stack' + (n.pinned ? ' ag-pinned' : '') },
          h('div', { class: 'row sp-b' },
            h('h2', { style: 'margin:0' }, (n.pinned ? '📌 ' : '') + n.title),
            leader ? h('div', { class: 'row', style: 'gap:6px' },
              h('button', { class: 'btn sec2 sm', onclick: function () { runMural(sb.from('announcements').update({ pinned: !n.pinned }).eq('id', n.id)); } }, n.pinned ? 'Desafixar' : 'Fixar'),
              h('button', { class: 'btn sec2 sm danger', onclick: function () {
                if (window.confirm('Apagar o aviso "' + n.title + '"?')) runMural(sb.from('announcements').delete().eq('id', n.id), 'Aviso apagado.');
              } }, Icons.icon('trash', 13), 'Apagar')) : null),
          n.body ? h('p', { style: 'margin:0;white-space:pre-wrap' }, n.body) : null,
          h('p', { class: 'mu', style: 'margin:0;font-size:12px' }, nameOf(n.author) + ' · ' + d.toLocaleDateString('pt-BR')));
      }) : h('p', { class: 'mu' }, leader ? 'Nenhum aviso ainda.' : 'Nenhum aviso do líder por enquanto.'));
  }

  window.AgendaPage = { view: view, reset: reset };
  window.MuralPage = { view: muralView, reset: function () { mu.loadedFor = null; } };
})();
