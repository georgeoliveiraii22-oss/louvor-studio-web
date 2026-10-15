// Louvor Studio (web para celular) — montar escala passo a passo (ui/ScheduleWizard.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;

  var STEPS = [
    { title: 'Quando e onde', icon: 'CalendarDays', fns: [], hint: 'O dia e o horário. Use um horário fixo da igreja para preencher num toque.' },
    { title: 'Músicas', icon: 'ListMusic', fns: [], hint: 'Marque as músicas na ordem em que vão ser tocadas.' },
    { title: 'Ministro(a)', icon: 'Crown', fns: ['ministro'], hint: 'Quem vai conduzir o louvor.' },
    { title: 'Vozes', icon: 'Mic', fns: ['vocal', 'backing_vocal'], hint: 'Quem canta junto.' },
    { title: 'Músicos', icon: 'Guitar', fns: ['violao', 'guitarra', 'baixo', 'bateria', 'teclado', 'percussao', 'sopro', 'cordas'], hint: 'Quem toca. Pule os instrumentos que não vão ter.' },
    { title: 'Técnica', icon: 'SlidersVertical', fns: ['tecnico_som', 'projecao'], hint: 'Som e projeção. Se a banda não usa, pule.' },
    { title: 'Revisar', icon: 'Check', fns: [], hint: 'Confira tudo e publique. Cada pessoa recebe o pedido para confirmar.' }
  ];
  var REVIEW = 6;
  var SEM_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function suggested(d) {
    if (d.kind === 'ensaio') return 'Ensaio';
    if (d.kind === 'evento') return 'Evento';
    return 'Culto de ' + ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'][L.dow(d.date) - 1];
  }
  function finalTitle(d) { return d.title.trim() || suggested(d); }
  function content(d) { var c = Object.assign({}, d); delete c.step; return JSON.stringify(c); }
  function fromService(s) {
    return { kind: s.kind, title: s.title, date: s.starts_on, start: L.hhmm(s.start_time), end: L.hhmm(s.end_time), location: s.location || '', notes: s.notes || '',
      repeat: 0, times: 4, template: s.template_id || null, step: 0,
      songs: s.songs.map(function (x) { return { p: x.project_id, k: x.key }; }),
      people: s.people.map(function (p) { return { u: p.user_id, f: p.function }; }).filter(function (x, i, a) { return a.findIndex(function (y) { return y.u === x.u && y.f === x.f; }) === i; }) };
  }
  function blank(day) {
    return { kind: 'culto', title: '', date: day || L.addDays(L.today(), 1), start: '19:00', end: null, location: '', notes: '', repeat: 0, times: 4, template: null, step: 0, songs: [], people: [] };
  }

  var W = null; // { key, d, baseline, resumed, existing, notify, busy }

  L.screen('wizard', function (r) {
    var key = r.id || 'nova';
    if (!W || W.key !== key) {
      var existing = r.id ? L.service(r.id) : null;
      var saved = L.store.get('rascunho.' + key, null);
      var d = saved || (existing ? fromService(existing) : blank(r.day));
      if (!saved && existing && r.step) d.step = r.step;
      W = { key: key, d: d, existing: existing, resumed: !!saved, baseline: saved ? null : content(d), notify: !existing, busy: false };
    }
    var d = W.d, existing = W.existing;
    function save() { L.store.set('rascunho.' + key, content(d) !== W.baseline ? d : null); }
    function redraw() { save(); L.render(); }
    var step = STEPS[d.step];

    var head = h('div', { class: 'wizhead' },
      h('div', { class: 'row' },
        U.iconBtn('X', 'Fechar', function () { exitDialog(); }),
        h('div', { class: 'grow' }, h('div', { class: 'muted small' }, existing ? 'Editar escala' : 'Nova escala'), h('div', { class: 'hi bold', style: { fontSize: '20px' } }, step.title)),
        h('span', { class: 'muted', style: { fontSize: '13px', paddingRight: '12px' } }, (d.step + 1) + ' de ' + STEPS.length)),
      h('div', { class: 'wizbar' }, STEPS.map(function (_, i) { return h('i', { class: i <= d.step ? 'on' : '', onclick: function () { d.step = i; redraw(); } }); })),
      W.resumed ? h('div', { class: 'row', style: { padding: '0 8px' } }, h('span', { class: 'warn small grow' }, 'Continuando de onde você parou.'),
        h('button', { class: 'textbtn muted', style: { fontSize: '12px' }, onclick: function () {
          L.store.set('rascunho.' + key, null);
          W.d = d = existing ? fromService(existing) : blank(r.day);
          W.resumed = false; W.baseline = content(d); L.render();
        } }, 'Começar de novo')) : null);

    var body = h('div', { class: 'screen', style: { paddingBottom: '24px' } }, step.hint ? U.body(step.hint, 'var(--muted)', 13) : null);
    if (d.step === 0) stepWhen(body, d, !existing, redraw);
    else if (d.step === 1) stepSongs(body, d, existing && existing.id, redraw);
    else if (d.step === REVIEW) stepReview(body, d, existing, redraw);
    else stepPeople(body, d, step, existing && existing.id, d.step === 2, redraw);

    var emptyStep = d.step === 1 ? !d.songs.length : d.step >= 2 && d.step <= 5 ? !d.people.some(function (p) { return step.fns.indexOf(p.f) >= 0; }) : false;
    var foot = h('div', { class: 'wizfoot' },
      d.step > 0 ? U.btn2('Voltar', 'ChevronLeft', function () { d.step--; redraw(); }) : null,
      h('span', { class: 'grow' }),
      d.step >= 1 && d.step <= 5 && emptyStep ? h('button', { class: 'textbtn muted', onclick: function () { d.step++; redraw(); } }, 'Pular') : null,
      d.step < REVIEW ? U.btn('Próximo', 'ChevronRight', function () { d.step++; redraw(); }, { disabled: d.step >= 1 && d.step <= 5 && emptyStep })
        : U.btn(W.busy ? 'Publicando…' : existing ? 'Salvar' : 'Publicar escala', 'Send', function () { publish(); }, { disabled: W.busy }));

    function exitDialog() {
      L.dialog({
        title: 'Sair da escala?',
        body: function () { return U.body('O rascunho fica guardado: quando voltar, continua de onde parou.', null, 13); },
        actions: function (close) {
          return [h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () { close(); L.store.set('rascunho.' + key, null); W = null; setTimeout(L.back, 150); } }, 'Descartar'),
            h('button', { class: 'textbtn muted', onclick: close }, 'Continuar'),
            h('button', { class: 'textbtn', onclick: function () { close(); save(); W = null; setTimeout(L.back, 150); } }, 'Sair e guardar')];
        }
      });
    }

    async function publish() {
      if (W.busy) return;
      W.busy = true; L.render();
      try {
        var org = S.current.org.id;
        var songs = d.songs.map(function (x, i) { return { project_id: x.p, position: i + 1, song_key: x.k || null }; });
        var people = d.people.map(function (x) { return { user_id: x.u, function: x.f }; });
        var row = { title: finalTitle(d), kind: d.kind, start_time: d.start || null, end_time: d.end || null,
          location: d.location.trim() || null, notes: d.notes.trim() || null, template_id: d.template || null };
        var ids;
        if (!existing) {
          var dates = d.repeat === 0 ? [d.date] : Array.from({ length: d.times }, function (_, i) { return L.addDays(d.date, d.repeat * i); });
          var series = dates.length > 1 && window.crypto && crypto.randomUUID ? crypto.randomUUID() : null;
          var created = L.must(await sb.from('services').insert(dates.map(function (dt) { return Object.assign({ org_id: org, starts_on: dt, series_id: series }, row); })).select());
          ids = created.map(function (c) { return c.id; });
          for (var i = 0; i < ids.length; i++) {
            if (songs.length) L.must(await sb.from('service_songs').insert(songs.map(function (x) { return Object.assign({ service_id: ids[i] }, x); })));
            if (people.length) L.must(await sb.from('service_members').insert(people.map(function (x) { return Object.assign({ service_id: ids[i] }, x); })));
          }
        } else {
          ids = [existing.id];
          L.must(await sb.from('services').update(Object.assign({ starts_on: d.date }, row)).eq('id', existing.id));
          var oldSongs = JSON.stringify(existing.songs.map(function (x) { return [x.project_id, x.key || null]; }));
          if (oldSongs !== JSON.stringify(songs.map(function (x) { return [x.project_id, x.song_key]; }))) {
            L.must(await sb.from('service_songs').delete().eq('service_id', existing.id));
            if (songs.length) L.must(await sb.from('service_songs').insert(songs.map(function (x) { return Object.assign({ service_id: existing.id }, x); })));
          }
          var old = existing.people.map(function (p) { return p.user_id + '|' + p.function; });
          var now = people.map(function (p) { return p.user_id + '|' + p.function; });
          for (var j = 0; j < existing.people.length; j++) {
            var p = existing.people[j];
            if (now.indexOf(p.user_id + '|' + p.function) < 0) L.must(await sb.from('service_members').delete().eq('service_id', existing.id).eq('user_id', p.user_id).eq('function', p.function));
          }
          var add = people.filter(function (p) { return old.indexOf(p.user_id + '|' + p.function) < 0; });
          if (add.length) L.must(await sb.from('service_members').insert(add.map(function (x) { return Object.assign({ service_id: existing.id }, x); })));
        }
        if (W.notify && people.length) {
          var by = {};
          people.forEach(function (p) { (by[p.function] = by[p.function] || []).push(L.nameOf(p.user_id).split(' ')[0]); });
          var who = Object.keys(by).sort(function (a, b) { return L.fnOrder(a) - L.fnOrder(b); }).map(function (f) { return '• ' + L.fnLabel(f) + ': ' + by[f].join(', '); }).join('\n');
          var headTxt = (existing ? 'Escala atualizada' : 'Escala publicada') + ': ' + finalTitle(d) + ', ' + L.fullDate(d.date) + (d.start ? ' às ' + d.start : '');
          await sb.from('messages').insert({ org_id: org, service_id: ids[0], body: (headTxt + '\n' + who + '\n\nConfirme sua presença no app, por favor 🙏').slice(0, 2000) });
        }
        L.store.set('rascunho.' + key, null);
        await D.reloadServices();
        W = null;
        L.toast(existing ? 'Escala salva.' : 'Escala publicada. A equipe já pode confirmar.');
        if (existing) L.back();
        else L.replace({ name: 'escala', id: ids[0] });
      } catch (e) {
        L.toast(L.errorText(e));
        if (W) { W.busy = false; L.render(); }
      }
    }

    body.style.flex = '1';
    return h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: '100dvh' } }, head, body, foot);
  });

  // ------------------------------------------------------------------ 1. Quando e onde
  function pickBox(label, value, icon, type, cur, onPick) {
    var input = h('input', { type: type, 'aria-label': label });
    input.value = cur || '';
    input.addEventListener('change', function () { onPick(input.value); });
    return h('label', { class: 'pickbox' }, ic(icon, 18), h('div', null, h('div', { class: 'tiny' }, label), h('div', { class: 'hi ell', style: { fontSize: '15px' } }, value)), input);
  }

  function stepWhen(body, d, isNew, redraw) {
    var tpls = S.templates.filter(function (t) { return t.active !== false; });
    if (tpls.length) {
      body.appendChild(U.label('Horários fixos da igreja'));
      body.appendChild(h('div', { class: 'hscroll' }, tpls.map(function (t) {
        var on = d.template === t.id;
        return h('div', { class: 'tplcard' + (on ? ' on' : ''), onclick: function () {
          d.kind = t.kind; d.title = t.title; d.start = L.hhmm(t.start_time); d.end = L.hhmm(t.end_time); d.location = t.location || ''; d.template = t.id;
          if (isNew) { var dd = L.today(); while (L.dow(dd) !== t.weekday) dd = L.addDays(dd, 1); d.date = dd; }
          var team = S.teams.find(function (tm) { return tm.id === t.team_id; });
          if (team && !d.people.length) team.members.forEach(function (m) { d.people.push({ u: m.user_id, f: m.function }); });
          redraw();
        } }, h('div', { class: 'bold', style: { fontSize: '14px', color: on ? 'var(--accent-text)' : 'var(--hi)' } }, SEM_ABREV[t.weekday - 1] + ' ' + L.hhmm(t.start_time)),
          h('div', { class: 'muted tiny ell', style: { maxWidth: '140px' } }, t.title));
      })));
    } else if (isNew && L.perm.schedule()) {
      body.appendChild(U.clickRow(function () { L.go({ name: 'templates' }); }, ic('CalendarCheck', 20, 'accent'),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, 'Cadastre os cultos fixos da igreja'), h('div', { class: 'muted small' }, 'Ex.: quarta 19h, domingo 9h e 18h. Depois cria o mês inteiro com um toque.')),
        ic('ChevronRight', 18, 'muted')));
    }
    body.appendChild(U.label('Tipo'));
    body.appendChild(h('div', { class: 'row' }, L.KINDS.map(function (k) { return U.toggle(k[1], d.kind === k[0], null, function () { d.kind = k[0]; redraw(); }); })));
    body.appendChild(U.field(d.title, 'Nome (ex.: ' + suggested(d) + ')', function (v) { d.title = v.slice(0, 80); L.store.set('rascunho.' + W.key, d); }, { max: 80 }));
    body.appendChild(pickBox('Dia', L.cap(L.fullDate(d.date)), 'CalendarDays', 'date', d.date, function (v) { if (v) { d.date = v; redraw(); } }));
    body.appendChild(h('div', { class: 'row' },
      h('div', { class: 'grow' }, pickBox('Começa', d.start || 'sem horário', 'Clock', 'time', d.start, function (v) { d.start = v || null; redraw(); })),
      h('div', { class: 'grow' }, pickBox('Termina', d.end || 'opcional', 'Clock', 'time', d.end, function (v) { d.end = v || null; redraw(); }))));
    var off = Object.keys(S.unavailable).filter(function (u) { return S.unavailable[u].indexOf(d.date) >= 0; }).length;
    if (off) body.appendChild(U.body('⚠ ' + off + (off === 1 ? ' pessoa marcou' : ' pessoas marcaram') + ' que não pode neste dia.', 'var(--warn)', 12));
    body.appendChild(U.field(d.location, 'Local (ex.: Templo, sala de ensaio)', function (v) { d.location = v.slice(0, 120); L.store.set('rascunho.' + W.key, d); }, { max: 120 }));
    body.appendChild(U.field(d.notes, 'Observações para a banda', function (v) { d.notes = v.slice(0, 500); L.store.set('rascunho.' + W.key, d); }, { multiline: true, rows: 2, max: 500 }));
    if (isNew) {
      var pn = U.panel('Repetir', 'RefreshCw',
        h('div', { class: 'hscroll' }, [[0, 'Só este dia'], [7, 'Toda semana'], [14, 'A cada 15 dias']].map(function (x) { return U.toggle(x[1], d.repeat === x[0], null, function () { d.repeat = x[0]; redraw(); }); })));
      if (d.repeat) {
        pn.appendChild(h('div', { class: 'row hscroll' }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Quantas vezes:'),
          [2, 4, 8, 12].map(function (n) { return U.toggle(String(n), d.times === n, null, function () { d.times = n; redraw(); }); })));
        pn.appendChild(U.body('Cria ' + d.times + ' escalas iguais (mesmas músicas e equipe), a última em ' + L.fullDate(L.addDays(d.date, d.repeat * (d.times - 1))) + '. Depois dá para mudar cada uma.', 'var(--muted)', 12));
      }
      body.appendChild(pn);
    }
  }

  // ------------------------------------------------------------------ 2. Músicas
  var songQuery = '';
  function stepSongs(body, d, exceptId, redraw) {
    var last = {};
    S.services.forEach(function (s) {
      if (s.id === exceptId || s.starts_on >= d.date) return;
      s.songIds.forEach(function (id) { if (!last[id] || last[id] < s.starts_on) last[id] = s.starts_on; });
    });
    if (d.songs.length) {
      body.appendChild(U.label('Na escala (' + d.songs.length + ') · na ordem'));
      body.appendChild(h('div', { class: 'list' }, d.songs.map(function (ss, i) {
        var p = L.project(ss.p);
        if (!p) return null;
        return h('div', { class: 'row', style: { padding: '4px 0 4px 12px', minHeight: '56px' } },
          h('span', { class: 'accent bold', style: { width: '22px' } }, String(i + 1)),
          h('div', { class: 'grow' }, h('div', { class: 'hi semi ell' }, p.song_title), h('div', { class: 'muted small' }, 'Tom ' + (ss.k || L.keyToPlay(p) || '—') + (ss.k ? ' (neste dia)' : ''))),
          U.iconBtn('Music4', 'Tom neste dia', function () {
            var val = ss.k || '';
            L.dialog({ title: 'Tom neste dia', body: function () { return [U.field(val, 'Ex.: G, Bb, F#m', function (v) { val = v.slice(0, 12); }), U.body('Vazio = o tom da ficha da música.', 'var(--muted)', 12)]; },
              actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () { ss.k = val.trim() || null; close(); redraw(); } }, 'OK')]; } });
          }),
          U.iconBtn('ArrowUp', 'Subir', function () { var x = d.songs.splice(i, 1)[0]; d.songs.splice(i - 1, 0, x); redraw(); }, { disabled: i === 0 }),
          U.iconBtn('X', 'Tirar', function () { d.songs.splice(i, 1); redraw(); }, { color: 'var(--muted)' }));
      })));
    }
    body.appendChild(U.label('Repertório'));
    var listBox = h('div', { class: 'list' });
    function fillList() {
      listBox.replaceChildren();
      var q = L.norm(songQuery.trim());
      var chosen = d.songs.map(function (x) { return x.p; });
      var list = S.projects.filter(function (p) { return !q || L.norm(p.song_title + ' ' + (p.artist || '')).indexOf(q) >= 0; })
        .sort(function (a, b) { return L.norm(a.song_title).localeCompare(L.norm(b.song_title)); });
      if (!list.length) listBox.appendChild(h('div', { class: 'empty' }, 'Nenhuma música encontrada.'));
      list.forEach(function (p) {
        var on = chosen.indexOf(p.id) >= 0;
        var ago = last[p.id] ? L.daysBetween(last[p.id], d.date) : null;
        var info = [L.keyToPlay(p) ? 'Tom ' + L.keyToPlay(p) : null, ago !== null && ago <= 28 ? 'tocada há ' + ago + ' dias' : null].filter(Boolean).join(' · ') || p.artist || '';
        listBox.appendChild(h('div', { class: 'li', onclick: function () {
          if (on) d.songs = d.songs.filter(function (x) { return x.p !== p.id; }); else d.songs.push({ p: p.id, k: null });
          redraw();
        } }, U.cover(p, 36, 4, 16), h('div', { class: 'grow' }, h('div', { class: 'hi ell' }, p.song_title),
          h('div', { class: 'small ell', style: { color: ago !== null && ago <= 14 ? 'var(--warn)' : 'var(--muted)' } }, info)),
          h('span', { class: 'check' + (on ? ' on' : '') }, on ? ic('Check', 16) : null)));
      });
    }
    body.appendChild(U.field(songQuery, 'Buscar música', function (v) { songQuery = v; fillList(); }));
    fillList();
    body.appendChild(listBox);
  }

  // ------------------------------------------------------------------ 3–6. Pessoas
  function timesInMonth(uid, day, except) {
    var ym = day.slice(0, 7);
    return S.services.filter(function (s) { return s.id !== except && s.starts_on.slice(0, 7) === ym && s.people.some(function (p) { return p.user_id === uid; }); }).length;
  }
  function otherOnDay(uid, day, except) {
    return S.services.find(function (s) { return s.id !== except && s.starts_on === day && s.people.some(function (p) { return p.user_id === uid; }); }) || null;
  }
  var showAll = {};
  function stepPeople(body, d, step, exceptId, first, redraw) {
    if (first) {
      var cands = S.services.filter(function (s) { return s.id !== exceptId && s.people.length && s.kind === d.kind && s.starts_on <= d.date; });
      if (!cands.length) cands = S.services.filter(function (s) { return s.id !== exceptId && s.people.length; });
      var lastSvc = cands.sort(function (a, b) { return a.starts_on < b.starts_on ? 1 : -1; })[0];
      var teams = S.teams.filter(function (t) { return t.members.length; });
      if (lastSvc || teams.length) {
        body.appendChild(U.label('Atalhos: escalar todo mundo de uma vez'));
        body.appendChild(h('div', { class: 'hscroll' },
          lastSvc ? U.toggle('Repetir: ' + lastSvc.title + ' ' + L.dm(lastSvc.starts_on + 'T12:00'), false, 'RotateCcw', function () {
            lastSvc.people.forEach(function (p) { addSlot(d, p.user_id, p.function); }); L.toast('Equipe copiada. Confira e ajuste em cada etapa.'); redraw();
          }) : null,
          teams.map(function (t) { return U.toggle(t.name, false, 'UsersRound', function () { t.members.forEach(function (m) { addSlot(d, m.user_id, m.function); }); L.toast(t.name + ' adicionada. Confira em cada etapa.'); redraw(); }); })));
      }
    }
    step.fns.forEach(function (fn) {
      var chosen = d.people.filter(function (p) { return p.f === fn; });
      var withFn = S.members.filter(function (m) { return m.functions.indexOf(fn) >= 0; });
      var list = (showAll[fn] || !withFn.length) ? S.members.slice()
        : withFn.concat(S.members.filter(function (m) { return withFn.indexOf(m) < 0 && chosen.some(function (c) { return c.u === m.user_id; }); }));
      list.sort(function (a, b) {
        return (a.functions.indexOf(fn) >= 0 ? 0 : 1) - (b.functions.indexOf(fn) >= 0 ? 0 : 1) || (L.isOff(a.user_id, d.date) ? 1 : 0) - (L.isOff(b.user_id, d.date) ? 1 : 0) || a.name.localeCompare(b.name);
      });
      body.appendChild(h('div', { class: 'row' }, ic(L.fnIcon(fn), 16, 'accent'), h('span', { class: 'hi semi grow', style: { fontSize: '15px' } }, L.fnLabel(fn)),
        chosen.length ? h('span', { class: 'accent small' }, chosen.length + (chosen.length > 1 ? ' escolhidos' : ' escolhido')) : null));
      if (!withFn.length) body.appendChild(U.body('Ninguém marcou ' + L.fnLabel(fn).toLowerCase() + ' no perfil. Mostrando todos.', 'var(--muted)', 12));
      body.appendChild(h('div', { class: 'list' }, list.map(function (m) {
        var on = d.people.some(function (p) { return p.u === m.user_id && p.f === fn; });
        var off = L.isOff(m.user_id, d.date);
        var other = otherOnDay(m.user_id, d.date, exceptId);
        var elsewhere = d.people.filter(function (p) { return p.u === m.user_id && p.f !== fn; }).map(function (p) { return L.fnLabel(p.f).toLowerCase(); });
        var sub = [off ? '⚠ não pode neste dia' : null, other ? 'já está em ' + other.title + (other.start_time ? ' (' + L.hhmm(other.start_time) + ')' : '') : null,
          elsewhere.length ? 'também ' + elsewhere.join(', ') : null, timesInMonth(m.user_id, d.date, exceptId) + '× este mês'].filter(Boolean).join(' · ');
        return h('div', { class: 'li', onclick: function () {
          if (on) d.people = d.people.filter(function (p) { return !(p.u === m.user_id && p.f === fn); }); else d.people.push({ u: m.user_id, f: fn });
          redraw();
        } }, U.avatar(m, 38), h('div', { class: 'grow' }, h('div', { class: 'semi ell', style: { color: off && !on ? 'var(--muted)' : 'var(--hi)' } }, m.name),
          h('div', { class: 'small', style: { color: off || other ? 'var(--warn)' : 'var(--muted)' } }, sub)),
          h('span', { class: 'check' + (on ? ' on' : '') }, on ? ic('Check', 16) : null));
      })));
      if (!showAll[fn] && withFn.length && S.members.length > list.length) {
        body.appendChild(h('button', { class: 'textbtn muted', style: { alignSelf: 'flex-start', fontSize: '12px' }, onclick: function () { showAll[fn] = true; L.render(); } }, 'Mostrar todos da banda (' + S.members.length + ')'));
      }
    });
  }
  function addSlot(d, u, f) { if (!d.people.some(function (p) { return p.u === u && p.f === f; })) d.people.push({ u: u, f: f }); }

  // ------------------------------------------------------------------ 7. Revisar
  function stepReview(body, d, existing, redraw) {
    function mudar(step) { return h('button', { class: 'textbtn', style: { alignSelf: 'flex-start' }, onclick: function () { d.step = step; redraw(); } }, 'Mudar'); }
    var when = L.kindLabel(d.kind) + ' · ' + L.cap(L.fullDate(d.date)) + ([d.start, d.end].filter(Boolean).length ? ' · ' + [d.start, d.end].filter(Boolean).join(' – ') : '');
    body.appendChild(U.panel(finalTitle(d), 'CalendarDays', h('div', { style: { fontSize: '14px' } }, when),
      d.location ? h('div', { class: 'muted', style: { fontSize: '13px' } }, d.location) : null, d.notes ? U.body(d.notes, 'var(--muted)', 13) : null,
      !existing && d.repeat ? U.body('Repete: ' + d.times + ' vezes, ' + (d.repeat === 7 ? 'toda semana' : 'a cada 15 dias') + '.', 'var(--accent-text)', 13) : null, mudar(0)));
    body.appendChild(U.panel('Músicas (' + d.songs.length + ')', 'ListMusic',
      d.songs.length ? d.songs.map(function (ss, i) { var p = L.project(ss.p); return p ? h('div', { style: { fontSize: '14px' } }, (i + 1) + '. ' + p.song_title + ((ss.k || L.keyToPlay(p)) ? ' · Tom ' + (ss.k || L.keyToPlay(p)) : '')) : null; })
        : U.body('Nenhuma música. Dá para escolher depois.', 'var(--muted)', 13), mudar(1)));
    var by = {};
    d.people.forEach(function (p) { (by[p.f] = by[p.f] || []).push(p); });
    var count = d.people.map(function (p) { return p.u; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
    body.appendChild(U.panel('Equipe (' + count + ' pessoas)', 'UsersRound',
      d.people.length ? Object.keys(by).sort(function (a, b) { return L.fnOrder(a) - L.fnOrder(b); }).map(function (f) {
        return h('div', { class: 'row top' }, ic(L.fnIcon(f), 16, 'muted'), h('span', { style: { fontSize: '14px' } }, L.fnLabel(f) + ': ' + by[f].map(function (p) { return L.nameOf(p.u); }).join(', ')));
      }) : U.body('Ninguém escalado. Dá para escalar depois.', 'var(--muted)', 13), mudar(2)));
    var warn = [];
    d.people.map(function (p) { return p.u; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (u) {
      if (L.isOff(u, d.date)) warn.push(L.nameOf(u) + ' marcou que não pode neste dia.');
      var o = otherOnDay(u, d.date, existing && existing.id);
      if (o) warn.push(L.nameOf(u) + ' já está em ' + o.title + ' neste dia.');
    });
    if (d.kind === 'culto' && !d.people.some(function (p) { return p.f === 'ministro'; })) warn.push('Sem ministro(a) de louvor.');
    if (warn.length) body.appendChild(h('div', { class: 'note' }, h('div', { class: 'row warn semi' }, ic('TriangleAlert', 16), 'Vale conferir'), warn.map(function (w) { return U.body('• ' + w, null, 13); })));
    if (d.people.length) body.appendChild(U.switchRow('Avisar na conversa da escala', 'Manda uma mensagem com a equipe e o pedido para confirmar.', W.notify, function (v) { W.notify = v; }));
  }
})();
