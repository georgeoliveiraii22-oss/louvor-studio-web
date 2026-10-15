// Louvor Studio (web para celular) — agenda fixa da igreja, equipes fixas e escolher músicas para a escala
// (ui/TemplatesScreen.kt e ui/SongPickerScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  // ------------------------------------------------------------------ Agenda fixa da igreja
  var T = { month: null, busy: false };
  function monthsAhead() {
    var out = [], d = new Date();
    for (var i = 0; i < 3; i++) { var x = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
    return out;
  }
  L.screen('templates', function () {
    var can = L.perm.schedule();
    if (!T.month) { var ms = monthsAhead(); T.month = new Date().getDate() > 20 ? ms[1] : ms[0]; }
    var root = h('div', { class: 'screen' },
      U.topRow('Agenda fixa da igreja', 'Os cultos de toda semana', can ? U.iconBtn('UsersRound', 'Equipes fixas', function () { L.go({ name: 'teams' }); }) : null),
      U.body('Cadastre uma vez os horários de culto e ensaio que se repetem toda semana. Depois, com um toque, o app cria as escalas do mês inteiro. Se o horário tem uma equipe fixa, ela já entra escalada.', 'var(--muted)', 13));
    var active = S.templates.filter(function (t) { return t.active !== false; });
    if (active.length && can) {
      var y = +T.month.slice(0, 4), m = +T.month.slice(5, 7), len = new Date(y, m, 0).getDate();
      var dates = Array.from({ length: len }, function (_, i) { return T.month + '-' + String(i + 1).padStart(2, '0'); });
      var plan = D.planGenerate(active, dates);
      var box = h('div', { class: 'panel', style: { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } },
        h('div', { class: 'hi bold', style: { fontSize: '16px' } }, 'Criar as escalas do mês'),
        h('div', { class: 'row' }, monthsAhead().map(function (ym) { return U.toggle(L.cap(L.MESES[+ym.slice(5, 7) - 1]), T.month === ym, null, function () { T.month = ym; L.render(); }); })));
      if (!plan.length) box.appendChild(U.body('Todas as escalas de ' + L.MESES[m - 1] + ' já existem (ou os dias já passaram).', 'var(--muted)', 13));
      else {
        var byTpl = {};
        plan.forEach(function (x) { (byTpl[x[0].id] = byTpl[x[0].id] || []).push(x); });
        Object.keys(byTpl).forEach(function (k) {
          var t = byTpl[k][0][0];
          box.appendChild(h('div', { style: { fontSize: '13px' } }, DIAS[t.weekday - 1] + ' ' + L.hhmm(t.start_time) + ' · ' + t.title + ': ' + byTpl[k].map(function (x) { return x[1].slice(8); }).join(', ')));
        });
        box.appendChild(U.btn(T.busy ? 'Criando…' : 'Criar ' + L.plural(plan.length, 'escala', 'escalas') + ' de ' + L.MESES[m - 1], 'CalendarCheck', function () {
          T.busy = true; L.render();
          L.run(async function () {
            try { var n = await D.generate(active, dates); await D.reloadServices(); L.toast(n + ' escalas criadas. Abra cada uma para escolher as músicas e conferir a equipe.'); }
            finally { T.busy = false; L.render(); }
          });
        }, { full: true, tall: true, disabled: T.busy }));
        box.appendChild(U.body('Depois é só abrir cada escala e escolher as músicas. As que já existem não são criadas de novo.', 'var(--muted)', 12));
      }
      root.appendChild(box);
    }
    if (!S.templates.length) root.appendChild(U.empty(can ? 'Nenhum horário ainda. Toque em Adicionar horário (ex.: Quarta 19:00 — Culto de quarta).' : 'O líder ainda não cadastrou a agenda fixa.'));
    var byDay = {};
    S.templates.forEach(function (t) { (byDay[t.weekday] = byDay[t.weekday] || []).push(t); });
    Object.keys(byDay).sort().forEach(function (wd) {
      root.appendChild(U.label(DIAS[wd - 1]));
      root.appendChild(h('div', { class: 'list' }, byDay[wd].map(function (t) {
        var team = S.teams.find(function (x) { return x.id === t.team_id; });
        return h('div', { class: 'li', onclick: can ? function () { tplDialog(t); } : null },
          h('span', { class: 'bold', style: { fontSize: '18px', width: '64px', color: t.active !== false ? 'var(--accent-text)' : 'var(--muted)' } }, L.hhmm(t.start_time)),
          h('div', { class: 'grow' }, h('div', { class: 'semi', style: { color: t.active !== false ? 'var(--hi)' : 'var(--muted)' } }, t.title + (t.active === false ? ' (pausado)' : '')),
            h('div', { class: 'muted small ell' }, [L.kindLabel(t.kind), t.end_time ? 'até ' + L.hhmm(t.end_time) : null, t.location, team ? team.name : null].filter(Boolean).join(' · '))),
          can ? ic('Pencil', 16, 'muted') : null);
      })));
    });
    if (can) root.appendChild(U.btn2('Adicionar horário', 'Plus', function () { tplDialog(null); }, { full: true }));
    return root;
  });

  function tplDialog(t) {
    var st = { weekday: t ? t.weekday : 7, kind: t ? t.kind : 'culto', title: t ? t.title : '', start: t ? L.hhmm(t.start_time) : '19:00', end: t ? L.hhmm(t.end_time) : '',
      location: t ? t.location || '' : '', team: t ? t.team_id : null, active: t ? t.active !== false : true };
    function sug() {
      if (st.kind === 'ensaio') return 'Ensaio de ' + DIAS[st.weekday - 1].toLowerCase();
      if (st.kind === 'evento') return 'Evento';
      var hr = +(st.start || '19').slice(0, 2);
      return 'Culto de ' + DIAS[st.weekday - 1].toLowerCase() + (hr < 12 ? ' de manhã' : hr >= 17 && st.weekday === 7 ? ' à noite' : '');
    }
    var dlg = L.dialog({
      sticky: true, title: t ? 'Horário fixo' : 'Novo horário fixo',
      body: function () {
        var timeIn = function (label, v, set) {
          var i = h('input', { type: 'time' }); i.value = v || '';
          i.addEventListener('change', function () { set(i.value); dlg.rebuild(); });
          return h('label', { class: 'pickbox grow' }, ic('Clock', 18), h('div', null, h('div', { class: 'tiny' }, label), h('div', { class: 'hi' }, v || 'opcional')), i);
        };
        return [U.label('Dia da semana'),
          h('div', { class: 'hscroll' }, DIAS.map(function (dd, i) {
            return h('button', { class: 'chiptog' + (st.weekday === i + 1 ? ' on' : ''), style: { width: '44px', justifyContent: 'center', padding: 0, borderRadius: '50%', height: '44px' },
              onclick: function () { st.weekday = i + 1; dlg.rebuild(); } }, dd.slice(0, 3));
          })),
          h('div', { class: 'row' }, timeIn('Começa', st.start, function (v) { if (v) st.start = v; }), timeIn('Termina', st.end, function (v) { st.end = v; })),
          h('div', { class: 'row' }, L.KINDS.map(function (k) { return U.toggle(k[1], st.kind === k[0], null, function () { st.kind = k[0]; dlg.rebuild(); }); })),
          U.field(st.title, 'Nome (ex.: ' + sug() + ')', function (v) { st.title = v.slice(0, 80); }),
          U.field(st.location, 'Local (opcional)', function (v) { st.location = v.slice(0, 120); }),
          S.teams.length ? [U.label('Equipe que costuma tocar'), h('div', { class: 'hscroll' }, U.toggle('Nenhuma', !st.team, null, function () { st.team = null; dlg.rebuild(); }),
            S.teams.map(function (tm) { return U.toggle(tm.name, st.team === tm.id, 'UsersRound', function () { st.team = tm.id; dlg.rebuild(); }); }))] : null,
          t ? U.switchRow('Ativo', 'Desligue para pausar (ex.: férias) sem apagar.', st.active, function (v) { st.active = v; }) : null,
          t ? h('button', { class: 'textbtn', style: { color: 'var(--bad)', alignSelf: 'flex-start' }, onclick: function () {
            L.confirm('Apagar ' + t.title + '?', 'As escalas já criadas continuam. Só deixa de criar as próximas.', 'Apagar', function () {
              dlg.close();
              L.run(async function () { L.must(await sb.from('service_templates').delete().eq('id', t.id)); await reloadTemplates(); L.render(); });
            }, true);
          } }, 'Apagar este horário') : null];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', onclick: function () {
            var row = { weekday: st.weekday, kind: st.kind, title: st.title.trim() || sug(), start_time: st.start, end_time: st.end || null,
              location: st.location.trim() || null, team_id: st.team || null, active: st.active };
            close();
            L.run(async function () {
              L.must(t ? await sb.from('service_templates').update(row).eq('id', t.id) : await sb.from('service_templates').insert(Object.assign({ org_id: S.current.org.id }, row)));
              await reloadTemplates(); L.toast('Horário salvo.'); L.render();
            });
          } }, 'Salvar')];
      }
    });
  }
  async function reloadTemplates() {
    var r = await sb.from('service_templates').select('*').eq('org_id', S.current.org.id).order('weekday').order('start_time');
    if (!r.error) S.templates = r.data || [];
  }
  async function reloadTeams() {
    var r = await sb.from('teams').select('*,team_members(user_id,function)').eq('org_id', S.current.org.id).order('name');
    if (!r.error) S.teams = (r.data || []).map(function (t) { return { id: t.id, name: t.name, members: (t.team_members || []).map(function (x) { return { user_id: x.user_id, function: x.function }; }) }; });
  }

  // ------------------------------------------------------------------ Equipes fixas
  L.screen('teams', function () {
    var can = L.perm.schedule();
    var root = h('div', { class: 'screen' },
      U.topRow('Equipes fixas', 'Quem costuma tocar junto'),
      U.body('Monte equipes como "Equipe A" e "Equipe B". Ao montar uma escala, um toque na equipe escala todo mundo de uma vez. Também dá para ligar uma equipe a um horário da agenda fixa.', 'var(--muted)', 13));
    if (!S.teams.length) root.appendChild(U.empty(can ? 'Nenhuma equipe ainda.' : 'O líder ainda não montou equipes.'));
    S.teams.forEach(function (t) {
      var by = {};
      t.members.forEach(function (m) { (by[m.function] = by[m.function] || []).push(m); });
      var p = U.panel(t.name, 'UsersRound');
      if (!t.members.length) p.appendChild(U.body('Ninguém ainda.', 'var(--muted)', 13));
      Object.keys(by).sort(function (a, b) { return L.fnOrder(a) - L.fnOrder(b); }).forEach(function (fn) {
        by[fn].forEach(function (sl, i) {
          p.appendChild(h('div', { class: 'row' }, ic(L.fnIcon(fn), 16, 'muted'),
            h('span', { class: 'muted small ell', style: { width: '110px' } }, i === 0 ? L.fnLabel(fn) : ''),
            h('span', { class: 'hi grow' }, L.nameOf(sl.user_id)),
            can ? U.iconBtn('X', 'Tirar da equipe', function () {
              L.run(async function () { L.must(await sb.from('team_members').delete().eq('team_id', t.id).eq('user_id', sl.user_id).eq('function', sl.function)); await reloadTeams(); L.render(); });
            }, { color: 'var(--muted)' }) : null));
        });
      });
      if (can) p.appendChild(h('div', { class: 'row' }, U.btn2('Adicionar pessoa', 'Plus', function () { teamAdd(t.id, null); }, { style: { flex: 1 } }),
        U.iconBtn('Trash2', 'Apagar equipe', function () {
          L.confirm('Apagar ' + t.name + '?', 'As escalas já montadas não mudam.', 'Apagar', function () {
            L.run(async function () { L.must(await sb.from('teams').delete().eq('id', t.id)); await reloadTeams(); L.render(); });
          }, true);
        }, { color: 'var(--muted)' })));
      root.appendChild(p);
    });
    if (can) root.appendChild(U.btn('Nova equipe', 'Plus', function () {
      var name = 'Equipe ' + String.fromCharCode(65 + S.teams.length);
      L.dialog({
        title: 'Nova equipe',
        body: function () { return U.field(name, 'Nome da equipe', function (v) { name = v.slice(0, 60); }); },
        actions: function (close) {
          return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () {
            if (!name.trim()) return;
            close();
            L.run(async function () {
              var row = L.must(await sb.from('teams').insert({ org_id: S.current.org.id, name: name.trim() }).select().single());
              await reloadTeams(); L.render(); setTimeout(function () { teamAdd(row.id, null); }, 200);
            });
          } }, 'Criar')];
        }
      });
    }, { full: true }));
    return root;
  });

  /** Escolhe a função e depois as pessoas (pode marcar várias) para entrar na equipe. */
  function teamAdd(teamId, fn) {
    var dlg = L.dialog({
      title: (function () { var t = S.teams.find(function (x) { return x.id === teamId; }); return (t ? t.name : 'Equipe') + ': ' + (fn ? L.fnLabel(fn) : 'qual função?'); })(),
      body: function (close) {
        var t = S.teams.find(function (x) { return x.id === teamId; });
        if (!t) return null;
        if (!fn) return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } }, L.FUNCTIONS.map(function (f) {
          var b = U.toggle(f[1], false, L.fnIcon(f[0]), function () { close(); setTimeout(function () { teamAdd(teamId, f[0]); }, 150); });
          b.style.width = '100%';
          return b;
        }));
        return S.members.slice().sort(function (a, b) { return (a.functions.indexOf(fn) >= 0 ? 0 : 1) - (b.functions.indexOf(fn) >= 0 ? 0 : 1) || a.name.localeCompare(b.name); }).map(function (m) {
          var on = t.members.some(function (x) { return x.user_id === m.user_id && x.function === fn; });
          return h('div', { class: 'row', style: { minHeight: '52px', gap: '10px', cursor: 'pointer' }, onclick: function () {
            L.run(async function () {
              L.must(on ? await sb.from('team_members').delete().eq('team_id', teamId).eq('user_id', m.user_id).eq('function', fn)
                : await sb.from('team_members').insert({ team_id: teamId, user_id: m.user_id, function: fn }));
              await reloadTeams(); dlg.rebuild(); L.render();
            });
          } }, U.avatar(m, 34), h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, m.name), h('div', { class: 'muted small ell' }, m.functions.map(L.fnLabel).join(', ') || 'sem função marcada')),
            h('span', { style: { color: on ? 'var(--ok)' : 'var(--muted)' } }, ic(on ? 'CircleCheckBig' : 'Plus', 20)));
        });
      },
      actions: function (close) {
        return [fn ? h('button', { class: 'textbtn muted', onclick: function () { close(); setTimeout(function () { teamAdd(teamId, null); }, 150); } }, 'Outra função') : null,
          h('button', { class: 'textbtn', onclick: close }, 'Pronto')];
      }
    });
  }

  // ------------------------------------------------------------------ Escolher músicas do repertório para a escala
  var P = { forId: null, picked: [], query: '', busy: false };
  L.screen('songpick', function (r) {
    var s = L.service(r.id);
    if (!s) return h('div', { class: 'screen' }, U.topRow('Adicionar músicas'), U.empty('Esta escala não existe mais.'));
    if (P.forId !== s.id) { P = { forId: s.id, picked: [], query: '', busy: false }; }
    var already = s.songIds;
    var grid = h('div', { class: 'pickgrid' });
    function fill() {
      grid.replaceChildren();
      var q = L.norm(P.query.trim());
      var list = S.projects.filter(function (p) { return !q || [p.song_title, p.artist, p.musical_key, p.band_key].some(function (f) { return f && L.norm(f).indexOf(q) >= 0; }); })
        .sort(function (a, b) { return L.norm(a.song_title).localeCompare(L.norm(b.song_title)); });
      if (!list.length) grid.appendChild(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'Nenhuma música encontrada.'));
      list.forEach(function (p) {
        var inS = already.indexOf(p.id) >= 0;
        var order = P.picked.indexOf(p.id);
        var on = order >= 0;
        grid.appendChild(h('div', { class: 'pickcard' + (on ? ' on' : '') + (inS ? ' in' : ''), onclick: function () {
          if (inS) return;
          if (on) P.picked.splice(order, 1); else P.picked.push(p.id);
          fill(); updBtn();
        } },
          h('div', { class: 'cv' }, U.cover(p, '100%', 6, 44), (on || inS) ? h('span', { class: 'num' }, inS ? ic('Check', 16) : String(order + 1)) : h('span', { class: 'num', style: { background: '#0009' } })),
          h('div', { class: 'hi semi ell' }, p.song_title),
          h('div', { class: 'muted small ell' }, inS ? 'já está na escala' : [p.artist, L.keyToPlay(p) ? 'Tom ' + L.keyToPlay(p) : null].filter(Boolean).join(' · '))));
      });
    }
    var addBtn = h('button', { class: 'btn grow', style: { minHeight: '52px' } });
    var clearBtn = U.btn2('Limpar', 'X', function () { P.picked = []; fill(); updBtn(); });
    function updBtn() {
      var n = P.picked.length;
      addBtn.disabled = !n || P.busy;
      addBtn.replaceChildren(ic('Plus', 18), P.busy ? 'Adicionando…' : !n ? 'Escolha as músicas' : n === 1 ? 'Adicionar 1 música' : 'Adicionar ' + n + ' músicas');
      clearBtn.style.display = n ? '' : 'none';
    }
    addBtn.onclick = function () {
      if (!P.picked.length || P.busy) return;
      P.busy = true; updBtn();
      var start = s.songs.reduce(function (a, x) { return Math.max(a, x.position); }, 0) + 1;
      var rows = P.picked.map(function (id, i) { return { service_id: s.id, project_id: id, position: start + i }; });
      L.run(async function () {
        try {
          L.must(await sb.from('service_songs').insert(rows));
          await D.reloadServices();
          L.toast(rows.length === 1 ? '1 música adicionada à escala.' : rows.length + ' músicas adicionadas à escala.');
          P = { forId: null, picked: [], query: '', busy: false };
          L.back();
        } finally { P.busy = false; updBtn(); }
      });
    };
    fill(); updBtn();
    return h('div', null,
      h('div', { class: 'screen', style: { paddingBottom: '100px' } },
        U.topRow('Adicionar músicas', s.title),
        U.body('Toque nas músicas para marcar. Elas entram na escala na ordem em que você tocar.', 'var(--muted)', 13),
        S.projects.length > 6 ? U.field(P.query, 'Buscar música, artista ou tom', function (v) { P.query = v; fill(); }) : null,
        grid),
      h('div', { class: 'wizfoot', style: { position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: '480px', margin: '0 auto' } }, clearBtn, addBtn));
  });
})();
