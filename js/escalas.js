// Louvor Studio (web para celular) — aba Escalas, escala aberta e "dias que não posso" (ui/SchedulesScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var E = L.escalas = { view: 'proximas', month: null, day: null, showPast: false };

  // ------------------------------------------------------------------ Grupos por mês e semana (data/DateGroups.kt)
  function weekStart(iso) { return L.addDays(iso, -(L.dow(iso) - 1)); }
  function weekLabel(start) {
    var tw = weekStart(L.today());
    if (start === tw) return 'Esta semana';
    if (start === L.addDays(tw, 7)) return 'Semana que vem';
    if (start === L.addDays(tw, -7)) return 'Semana passada';
    var end = L.addDays(start, 6), a = L.d(start), b = L.d(end);
    if (a.getMonth() === b.getMonth()) return a.getDate() + ' a ' + b.getDate() + ' de ' + L.MES_CURTO[a.getMonth()];
    return a.getDate() + ' ' + L.MES_CURTO[a.getMonth()] + ' a ' + b.getDate() + ' ' + L.MES_CURTO[b.getMonth()];
  }
  function groups(list) {
    var out = [];
    list.forEach(function (s) {
      var ym = s.starts_on.slice(0, 7);
      var m = out[out.length - 1];
      if (!m || m.ym !== ym) { m = { ym: ym, weeks: [] }; out.push(m); }
      var ws = weekStart(s.starts_on);
      var w = m.weeks[m.weeks.length - 1];
      if (!w || w.start !== ws) { w = { start: ws, label: weekLabel(ws), items: [] }; m.weeks.push(w); }
      w.items.push(s);
    });
    return out;
  }

  // ------------------------------------------------------------------ Aba
  L.screen('tab-escalas', function () {
    var me = L.uid();
    var can = L.perm.schedule();
    var root = h('div', { class: 'screen', style: { paddingBottom: '96px' } },
      U.tabHead('Escalas'),
      h('div', { class: 'row' }, [['proximas', 'Próximas'], ['minhas', 'Minhas'], ['calendario', 'Calendário']].map(function (v) {
        return U.toggle(v[1], E.view === v[0], null, function () { E.view = v[0]; L.render(); });
      })));

    if (E.view === 'calendario') {
      if (!E.month) E.month = L.today().slice(0, 7);
      if (!E.day) E.day = L.today();
      root.appendChild(L.monthCalendar(E.month, function (m) { E.month = m; L.render(); }, E.day, function (d) { E.day = d; L.render(); }, function (d) {
        var list = S.services.filter(function (s) { return s.starts_on === d; });
        if (list.some(function (s) { return s.people.some(function (p) { return p.user_id === me; }); })) return 'mine';
        if (list.length) return 'some';
        if (L.isOff(me, d)) return 'off';
        return '';
      }));
      var day = E.day;
      var list = S.services.filter(function (s) { return s.starts_on === day; });
      root.appendChild(U.label(L.fullDate(day)));
      if (!list.length) root.appendChild(U.empty('Nada marcado neste dia.'));
      if (list.length) root.appendChild(h('div', { class: 'cardgrid' }, list.map(function (s) { return L.scheduleCard(s); })));
      if (can && day >= L.today()) root.appendChild(U.btn2('Nova escala neste dia', 'Plus', function () { L.go({ name: 'wizard', day: day }); }, { full: true }));
      root.appendChild(U.btn2('Dias que não posso', 'CalendarX', function () { L.go({ name: 'availability' }); }, { full: true }));
    } else {
      var list2 = E.view === 'minhas' ? L.myUpcoming() : L.upcoming();
      if (E.view === 'minhas') root.appendChild(U.btn2('Dias que não posso', 'CalendarX', function () { L.go({ name: 'availability' }); }, { full: true }));
      if (!list2.length) root.appendChild(U.empty(E.view === 'minhas' ? 'Você não está em nenhuma escala por enquanto.'
        : can ? 'Nenhuma escala marcada. Toque em + Nova escala para criar a primeira.' : 'O líder ainda não marcou as próximas escalas.'));
      var thisYear = L.today().slice(0, 4);
      groups(list2).forEach(function (mg) {
        var y = mg.ym.slice(0, 4), m = +mg.ym.slice(5, 7);
        var count = mg.weeks.reduce(function (a, w) { return a + w.items.length; }, 0);
        root.appendChild(h('div', { class: 'monthhead' }, h('span', { class: 'm' }, L.cap(L.MESES[m - 1]) + (y !== thisYear ? ' ' + y : '')),
          h('span', { class: 'grow' }), h('span', { class: 'muted', style: { fontSize: '13px', paddingBottom: '3px' } }, L.plural(count, 'escala', 'escalas'))));
        mg.weeks.forEach(function (w) {
          root.appendChild(h('div', { class: 'weekhead' + (w.label === 'Esta semana' ? ' cur' : '') }, w.label));
          root.appendChild(h('div', { class: 'cardgrid' }, w.items.map(function (s) { return L.scheduleCard(s); })));
        });
      });
      var past = S.services.filter(function (s) { return s.starts_on < L.today(); }).sort(function (a, b) { return a.starts_on < b.starts_on ? 1 : -1; });
      if (past.length && E.view === 'proximas') {
        root.appendChild(h('button', { class: 'textbtn muted', style: { alignSelf: 'flex-start' }, onclick: function () { E.showPast = !E.showPast; L.render(); } },
          (E.showPast ? 'Esconder' : 'Ver') + ' escalas que já passaram (' + past.length + ')'));
        if (E.showPast) root.appendChild(h('div', { class: 'cardgrid' }, past.slice(0, 30).map(function (s) { return L.scheduleCard(s, true); })));
      }
    }
    if (can) root.appendChild(U.fab('Nova escala', 'Plus', function () { newMenu(E.view === 'calendario' ? E.day : null); }));
    return root;
  });

  function newMenu(day) {
    L.dialog({
      title: 'Nova escala',
      body: function (close) {
        return [
          U.menuRow('CalendarDays', 'Uma escala', 'Passo a passo: dia, músicas, ministro, vozes, músicos e técnica.', function () { close(); setTimeout(function () { L.go({ name: 'wizard', day: day }); }, 60); }),
          U.menuRow('CalendarCheck', 'O mês inteiro', S.templates.length ? 'Cria as escalas do mês pela agenda fixa da igreja (' + S.templates.filter(function (t) { return t.active !== false; }).length + ' horários).'
            : 'Cadastre os cultos fixos da igreja (ex.: quarta 19h, domingo 9h) e crie o mês num toque.', function () { close(); setTimeout(function () { L.go({ name: 'templates' }); }, 60); }),
          U.menuRow('UsersRound', 'Equipes fixas', 'Equipe A, Equipe B…: escale a equipe inteira com um toque.', function () { close(); setTimeout(function () { L.go({ name: 'teams' }); }, 60); })
        ];
      },
      actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar')]; }
    });
  }

  /** Cartão de uma escala: data à esquerda, nome, hora, local e a minha situação. */
  L.scheduleCard = function (s, faded) {
    var mine = L.peopleOf(s, L.uid());
    var pending = s.people.filter(function (p) { return p.status === 'pendente' && !p.swap_requested; }).length;
    var swaps = s.people.filter(function (p) { return p.swap_requested; }).length;
    return h('div', { class: 'scard' + (mine.length && !faded ? ' mine' : '') + (faded ? ' faded' : ''), role: 'button', onclick: function () { L.go({ name: 'escala', id: s.id }); } },
      h('div', { class: 'd' }, h('div', { class: 'w' }, L.SEMANA_CURTA[L.dow(s.starts_on) - 1]), h('div', { class: 'n' }, String(L.d(s.starts_on).getDate()))),
      h('div', { class: 'grow col', style: { gap: '3px' } },
        h('div', { class: 'semi ell st', style: { fontSize: '16px', color: faded ? 'var(--muted)' : 'var(--hi)' } }, s.title),
        h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'dot', style: { background: faded ? 'var(--muted)' : L.kindColor(s.kind) } }),
          h('span', { class: 'muted small ell' }, [L.kindLabel(s.kind), L.timeRange(s), s.location].filter(Boolean).join(' · '))),
        mine.length ? h('div', { class: 'row wrap', style: { gap: '6px' } }, h('span', { class: 'accent semi small' }, 'Você: ' + mine.map(function (p) { return L.fnLabel(p.function); }).join(', ')), U.statusFor(mine[0]))
          : h('div', { class: 'muted small' }, L.plural(s.songIds.length, 'música', 'músicas') + ' · ' + L.plural(L.uniqPeople(s.people).length, 'pessoa', 'pessoas')),
        L.perm.schedule() && !faded && (pending || swaps) ? h('div', { class: 'warn tiny' }, [pending ? pending + ' sem resposta' : null, swaps ? swaps + ' pediu troca' : null].filter(Boolean).join(' · ')) : null),
      ic('ChevronRight', 18, 'muted'));
  };

  // ------------------------------------------------------------------ Calendário do mês
  /** mark(dia) → '' | some | mine | off */
  L.monthCalendar = function (ym, onMonth, selected, onDay, mark) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    function shift(n) { var d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    var first = ym + '-01';
    var offset = L.dow(first) - 1;
    var len = new Date(y, m, 0).getDate();
    var t0 = L.today();
    var grid = h('div', { class: 'grid' }, L.SEMANA_CURTA.map(function (w) { return h('div', { class: 'wd' }, w.charAt(0)); }));
    for (var i = 0; i < offset; i++) grid.appendChild(h('span'));
    for (var n = 1; n <= len; n++) {
      (function (n) {
        var d = ym + '-' + String(n).padStart(2, '0');
        var mk = mark(d);
        var sel = d === selected;
        var cls = 'day' + (sel ? ' sel' : '') + (mk === 'off' ? ' off' : '') + (mk === 'mine' ? ' mine' : '') + (d === t0 && !sel ? ' today' : '') + (d < t0 ? ' past' : '');
        grid.appendChild(h('button', { class: cls, onclick: function () { onDay(d); }, 'aria-label': L.fullDate(d) },
          String(n), mk === 'mine' || mk === 'some' ? h('i') : null, mk === 'off' ? h('span', { class: 'x' }, ic('X', 26)) : null));
      })(n);
    }
    return h('div', { class: 'cal' },
      h('div', { class: 'row' }, U.iconBtn('ChevronLeft', 'Mês anterior', function () { onMonth(shift(-1)); }),
        h('div', { class: 'grow center hi semi', style: { fontSize: '16px' } }, L.cap(L.MESES[m - 1]) + ' de ' + y),
        U.iconBtn('ChevronRight', 'Próximo mês', function () { onMonth(shift(1)); })),
      grid);
  };

  // ------------------------------------------------------------------ Escala aberta
  L.screen('escala', function (r) {
    var s = L.service(r.id);
    if (!s) return h('div', { class: 'screen' }, U.topRow('Escala'), U.empty('Esta escala não existe mais.'));
    var me = L.uid();
    var mine = L.peopleOf(s, me);
    var can = L.perm.schedule();
    var unread = S.unread[s.id] || 0;
    var root = h('div', { class: 'screen' });

    root.appendChild(U.topRow(s.title, L.kindLabel(s.kind), [
      U.iconBtn('MessageSquare', 'Conversa da escala', function () { L.go({ name: 'chat', id: s.id }); }, { badge: unread }),
      can ? U.iconBtn('Pencil', 'Editar escala', function () { L.go({ name: 'wizard', id: s.id }); }) : null
    ]));

    // Quando e onde
    root.appendChild(U.panel(null, null,
      h('div', { class: 'row', style: { gap: '10px' } }, h('span', { style: { color: L.kindColor(s.kind) } }, ic('CalendarDays', 18)), h('span', { class: 'hi semi', style: { fontSize: '16px' } }, L.cap(L.fullDate(s.starts_on)))),
      L.timeRange(s) ? h('div', { class: 'row', style: { gap: '10px' } }, ic('Clock', 18, 'muted'), h('span', { style: { fontSize: '15px' } }, L.timeRange(s))) : null,
      s.location ? h('a', { class: 'row', style: { gap: '10px', textDecoration: 'none', color: 'var(--text)' }, target: '_blank', rel: 'noopener', href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.location) },
        ic('MapPin', 18, 'muted'), h('span', { class: 'grow', style: { fontSize: '15px' } }, s.location), h('span', { class: 'accent', style: { fontSize: '12px' } }, 'mapa')) : null,
      s.notes ? U.body(s.notes) : null,
      U.btn2('Adicionar à agenda do celular', 'CalendarCheck', function () { addToCalendar(s); }, { full: true })));

    // Minha resposta
    if (mine.length) {
      var p = mine[0];
      var actions;
      if (p.swap_requested) {
        actions = [U.body('Você pediu troca. O líder vai ver e chamar outra pessoa.', 'var(--warn)', 13),
          U.btn2('Desistir da troca', 'RotateCcw', function () { D.scheduleAction('Pedido de troca cancelado.', function () { return D.respond(s.id, { swap_requested: false }); }); }, { full: true })];
      } else {
        actions = h('div', { class: 'row' },
          p.status !== 'confirmado' ? U.btn('Confirmar', 'Check', function () { D.scheduleAction('Presença confirmada. Obrigado!', function () { return D.respond(s.id, { status: 'confirmado', swap_requested: false }); }); }, { style: { flex: 1 } }) : null,
          p.status === 'pendente' ? U.btn2('Não posso', 'X', function () { D.scheduleAction('O líder vai saber que você não pode.', function () { return D.respond(s.id, { status: 'recusado' }); }); }, { style: { flex: 1 } }) : null,
          p.status === 'confirmado' ? U.btn2('Pedir troca', 'RefreshCw', function () { D.scheduleAction('Pedido de troca enviado ao líder.', function () { return D.respond(s.id, { swap_requested: true }); }); }, { style: { flex: 1 } }) : null);
      }
      root.appendChild(h('div', { class: 'myresp' },
        h('div', { class: 'row' }, h('span', { class: 'hi semi grow', style: { fontSize: '15px' } }, 'Você está como ' + mine.map(function (x) { return L.fnLabel(x.function); }).join(' e ')), U.statusFor(p)),
        actions));
    }

    if (can && (!s.songs.length || !s.people.length)) {
      root.appendChild(U.btn(!s.songs.length && !s.people.length ? 'Montar esta escala passo a passo' : !s.songs.length ? 'Escolher as músicas' : 'Escalar a equipe', 'Sparkles',
        function () { L.go({ name: 'wizard', id: s.id, step: !s.songs.length ? 1 : 2 }); }, { full: true, tall: true }));
    }

    // Músicas
    var crew = L.uniqPeople(s.people);
    var marks = S.readiness[s.id] || {};
    var songsPanel = U.panel('Músicas (' + s.songs.length + ')', 'ListMusic');
    if (s.songs.length && crew.length) {
      var done = s.songs.reduce(function (a, ss) { return a + (marks[ss.project_id] || []).filter(function (u) { return crew.indexOf(u) >= 0; }).length; }, 0);
      var total = s.songs.length * crew.length;
      var f = done / total;
      songsPanel.appendChild(h('div', { class: 'row' }, h('span', { class: 'grow', style: { fontSize: '13px', color: f >= 0.99 ? 'var(--ok)' : 'var(--text)' } }, 'A banda está ' + Math.floor(f * 100) + '% pronta'),
        h('span', { class: 'muted small' }, done + ' de ' + total)));
      songsPanel.appendChild(U.bar(f, f >= 0.99 ? 'var(--ok)' : null));
      if (mine.length) songsPanel.appendChild(U.body('Ensaiou uma música? Toque em Ensaiei nela.', 'var(--muted)', 12));
    }
    if (!s.songs.length) songsPanel.appendChild(U.body(can ? 'Nenhuma música ainda. Adicione as que a banda vai ensaiar.' : 'O líder ainda não escolheu as músicas.', 'var(--muted)', 13));
    s.songs.forEach(function (ss, i) {
      var pr = L.project(ss.project_id);
      if (!pr) return;
      var key = ss.key || L.keyToPlay(pr);
      var multi = L.hasMulti(pr);
      var ready = (marks[pr.id] || []).indexOf(me) >= 0;
      var more = U.iconBtn('Ellipsis', 'Mais opções de ' + pr.song_title, function (e) {
        e.stopPropagation();
        L.menu(more, [
          multi ? ['Headphones', 'Ouvir no estúdio', function () { L.go({ name: 'studio', id: pr.id }); }] : null,
          ['Music2', 'Ver a ficha da música', function () { L.songSheet(pr.id); }],
          can ? ['Music4', 'Tom neste dia', function () { keyDialog(s, pr); }] : null
        ]);
      });
      songsPanel.appendChild(h('div', { class: 'row', style: { minHeight: '56px', cursor: 'pointer' }, onclick: function () { L.songSheet(pr.id); } },
        h('span', { class: 'muted', style: { width: '20px', fontSize: '13px' } }, String(i + 1)),
        U.cover(pr, 38, 4, 17),
        h('div', { class: 'grow', style: { marginLeft: '2px' } },
          h('div', { class: 'hi semi ell' }, pr.song_title),
          h('div', { class: 'muted small ell' }, key ? 'Tom ' + key + (ss.key ? ' (neste dia)' : '') : (pr.artist || '')),
          h('div', { class: 'tiny semi', style: { color: multi ? 'var(--accent-text)' : 'var(--muted)' } }, multi ? 'Com multitrack' : 'Sem multitrack')),
        mine.length ? h('button', { class: 'readychip' + (ready ? ' on' : ''), onclick: function (e) { e.stopPropagation(); D.toggleReady(s.id, pr.id); } }, ready ? ic('Check', 14) : null, ready ? 'Ensaiei' : 'Ensaiei?') : null,
        more));
    });
    if (can) songsPanel.appendChild(U.btn2('Adicionar', 'Plus', function () { L.go({ name: 'songpick', id: s.id }); }, { full: true }));
    root.appendChild(songsPanel);

    // Pessoas
    var peoplePanel = U.panel('Pessoas (' + crew.length + ')', 'UsersRound');
    if (!s.people.length) peoplePanel.appendChild(U.body(can ? 'Ninguém escalado ainda.' : 'O líder ainda não escalou as pessoas.', 'var(--muted)', 13));
    var byFn = {};
    s.people.forEach(function (p) { (byFn[p.function] = byFn[p.function] || []).push(p); });
    Object.keys(byFn).sort(function (a, b) { return L.fnOrder(a) - L.fnOrder(b); }).forEach(function (fn) {
      peoplePanel.appendChild(h('div', { class: 'row', style: { gap: '6px' } }, ic(L.fnIcon(fn), 14, 'muted'), U.label(L.fnLabel(fn))));
      byFn[fn].forEach(function (p) {
        peoplePanel.appendChild(h('div', { class: 'row', style: { minHeight: '48px', gap: '10px' } },
          U.avatar(L.member(p.user_id), 34),
          h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, p.user_id === me ? 'Você' : L.nameOf(p.user_id)),
            L.isOff(p.user_id, s.starts_on) ? h('div', { class: 'warn tiny' }, 'marcou que não pode neste dia') : null),
          U.statusFor(p),
          can && (p.swap_requested || p.status === 'recusado') ? U.iconBtn('RefreshCw', 'Trocar ' + L.nameOf(p.user_id), function () {
            D.scheduleAction(null, function () { return sb.from('service_members').delete().eq('service_id', s.id).eq('user_id', p.user_id).eq('function', p.function); })
              .then(function () { addPerson(s, p.function); });
          }, { color: 'var(--warn)' }) : null,
          can ? U.iconBtn('X', 'Tirar da escala', function () {
            D.scheduleAction(null, function () { return sb.from('service_members').delete().eq('service_id', s.id).eq('user_id', p.user_id).eq('function', p.function); });
          }, { color: 'var(--muted)' }) : null));
      });
    });
    if (can) peoplePanel.appendChild(U.btn2('Escalar pessoa', 'Plus', function () { addPerson(s, null); }, { full: true }));
    var waiting = L.uniqPeople(s.people.filter(function (p) { return p.status === 'pendente' && !p.swap_requested; })).filter(function (u) { return u !== me; });
    if (can && waiting.length) peoplePanel.appendChild(U.btn2('Lembrar quem não respondeu (' + waiting.length + ')', 'Bell', function () {
      D.scheduleAction('Lembrete enviado na conversa da escala.', async function () {
        var res = await sb.from('messages').insert({ org_id: S.current.org.id, service_id: s.id,
          body: 'Lembrete: ' + waiting.map(function (u) { return L.nameOf(u).split(' ')[0]; }).join(', ') + ', confirmem a presença em ' + s.title + ' (' + L.fullDate(s.starts_on) + '), por favor 🙏' });
        await D.refreshMessages();
        return res;
      });
    }, { full: true }));
    root.appendChild(peoplePanel);

    root.appendChild(U.btn2(unread ? 'Conversa da escala (' + unread + ' novas)' : 'Conversa da escala', 'MessageSquare', function () { L.go({ name: 'chat', id: s.id }); }, { full: true }));
    if (can) root.appendChild(U.btn2('Apagar escala', 'Trash2', function () { deleteDialog(s); }, { full: true, danger: true }));
    return root;
  });

  function keyDialog(s, pr) {
    var cur = (s.songs.find(function (x) { return x.project_id === pr.id; }) || {}).key || '';
    var val = cur;
    L.dialog({
      title: 'Tom neste dia',
      body: function () { return [U.field(val, 'Ex.: G, Bb, F#m', function (v) { val = v.slice(0, 12); }), U.body('Deixe vazio para usar o tom da ficha da música.', 'var(--muted)', 12)]; },
      actions: function (close) {
        return [
          h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () { close(); D.scheduleAction('Música tirada da escala.', function () { return sb.from('service_songs').delete().eq('service_id', s.id).eq('project_id', pr.id); }); } }, 'Tirar da escala'),
          h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', onclick: function () { close(); D.scheduleAction(null, function () { return sb.from('service_songs').update({ song_key: val.trim() || null }).eq('service_id', s.id).eq('project_id', pr.id); }); } }, 'Salvar')];
      }
    });
  }

  function deleteDialog(s) {
    L.dialog({
      title: 'Apagar "' + s.title + '"?',
      body: function () { return U.body(s.series_id ? 'Esta escala se repete. Apagar só esta ou esta e as próximas?' : 'A escala some para toda a banda. As músicas continuam no repertório.', null, 13); },
      actions: function (close) {
        function done(q, msg) {
          close();
          L.run(async function () { L.must(await q); await D.reloadServices(); L.toast(msg); setTimeout(L.back, 80); });
        }
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          s.series_id ? h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () { done(sb.from('services').delete().eq('series_id', s.series_id).gte('starts_on', s.starts_on), 'Escalas apagadas.'); } }, 'Esta e as próximas') : null,
          h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () { done(sb.from('services').delete().eq('id', s.id), 'Escala apagada.'); } }, s.series_id ? 'Só esta' : 'Apagar')];
      }
    });
  }

  function addPerson(s, preset) {
    var fn = preset;
    var dlg = L.dialog({
      live: true,
      title: h('div', { class: 'dt' }, fn ? 'Quem vai de ' + L.fnLabel(fn) + '?' : 'Qual função?'),
      body: function (close) {
        if (!fn) {
          return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } }, L.FUNCTIONS.map(function (f) {
            var b = U.toggle(f[1], false, L.fnIcon(f[0]), function () { close(); setTimeout(function () { addPerson(s, f[0]); }, 60); });
            b.style.width = '100%';
            return b;
          }));
        }
        return S.members.slice().sort(function (a, b) { return (a.functions.indexOf(fn) >= 0 ? 0 : 1) - (b.functions.indexOf(fn) >= 0 ? 0 : 1) || a.name.localeCompare(b.name); }).map(function (m) {
          var already = s.people.some(function (p) { return p.user_id === m.user_id && p.function === fn; });
          var off = L.isOff(m.user_id, s.starts_on);
          return h('div', { class: 'row', style: { minHeight: '52px', gap: '10px', cursor: already ? 'default' : 'pointer' }, onclick: function () {
            if (already) return;
            close();
            D.scheduleAction(m.name + ' escalado(a) como ' + L.fnLabel(fn) + '.', function () { return sb.from('service_members').insert({ service_id: s.id, user_id: m.user_id, function: fn }); });
          } },
            U.avatar(m, 34),
            h('div', { class: 'grow' }, h('div', { class: 'semi', style: { color: already ? 'var(--muted)' : 'var(--hi)' } }, m.name),
              h('div', { class: 'small', style: { color: off && !already ? 'var(--warn)' : 'var(--muted)' } },
                already ? 'já está nesta função' : off ? '⚠ marcou que não pode neste dia' : m.functions.indexOf(fn) >= 0 ? L.fnLabel(fn) : (m.functions.map(L.fnLabel).join(', ') || 'sem função marcada'))));
        });
      },
      actions: function (close) {
        return [fn && !preset ? h('button', { class: 'textbtn muted', onclick: function () { close(); setTimeout(function () { addPerson(s, null); }, 60); } }, 'Outra função') : null,
          h('button', { class: 'textbtn muted', onclick: close }, 'Fechar')];
      }
    });
    return dlg;
  }

  /** Baixa um arquivo .ics: o celular abre na agenda. */
  function addToCalendar(s) {
    function stamp(day, time) { return day.replace(/-/g, '') + 'T' + (time ? time.slice(0, 5).replace(':', '') + '00' : '090000'); }
    var start = stamp(s.starts_on, s.start_time);
    var endT = s.end_time || (s.start_time ? String((+s.start_time.slice(0, 2) + 2) % 24).padStart(2, '0') + s.start_time.slice(2, 5) : '11:00');
    var esc = function (t) { return String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Louvor Studio//PT', 'BEGIN:VEVENT', 'UID:' + s.id + '@louvorstudio',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + start, 'DTEND:' + stamp(s.starts_on, endT),
      'SUMMARY:' + esc(L.kindLabel(s.kind) + ': ' + s.title), s.location ? 'LOCATION:' + esc(s.location) : null,
      'DESCRIPTION:' + esc(s.notes || 'Escala do Louvor Studio'), 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
    var a = h('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'escala.ics' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ Dias que não posso
  L.screen('availability', function () {
    var me = L.uid();
    var mine = S.unavailable[me] || [];
    if (!E.availMonth) E.availMonth = L.today().slice(0, 7);
    var next = mine.filter(function (d) { return d >= L.today(); }).sort();
    return h('div', { class: 'screen' },
      U.topRow('Dias que não posso', 'Toque num dia para marcar ou desmarcar'),
      U.body('Assim, quem monta a escala já vê que você não pode nesse dia. Os dias com ponto vermelho são escalas em que você já está.', 'var(--muted)', 13),
      L.monthCalendar(E.availMonth, function (m) { E.availMonth = m; L.render(); }, null, function (d) {
        if (d < L.today()) return;
        D.setUnavailable(d, mine.indexOf(d) < 0);
      }, function (d) {
        if (mine.indexOf(d) >= 0) return 'off';
        if (S.services.some(function (s) { return s.starts_on === d && s.people.some(function (p) { return p.user_id === me; }); })) return 'mine';
        return '';
      }),
      next.length ? [U.label('Marcados'), next.map(function (d) { return U.keyValue(L.cap(L.fullDate(d)), 'não posso'); })] : null);
  });
})();
