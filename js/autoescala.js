// Louvor Studio (web para celular) — escala automática (ui/AutoScheduleScreen.kt): rascunho do mês ou de uma escala,
// "quando eu costumo poder", quantas vezes quero servir, regras da banda e juntos/separados. Regras em lib/autoescala.js.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var AE = function () { return window.AutoEscala; };
  var DIAS3 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  var A = { key: null, seed: 1, locked: {}, rulesOpen: false, busy: false };

  S.availability = S.availability || {};
  S.wishes = S.wishes || {};
  S.pairs = S.pairs || [];
  S.scheduleRules = S.scheduleRules || null;

  function soft(r) { return r && !r.error ? r.data || [] : []; }
  function rules() { return Object.assign({}, AE().DEFAULT_RULES, S.scheduleRules || {}); }
  function failSave(e) {
    L.toast(e && e.code ? 'Não deu para salvar. Peça ao responsável para rodar a migração 0032 no Supabase.' : L.errorText(e));
  }

  /** Carrega disponibilidade, vezes por mês, regras e pares (migração 0032; sem ela, fica tudo vazio). */
  L.auto = {};
  L.auto.load = async function () {
    var org = S.current.org.id;
    var r = await Promise.all([
      sb.from('availability').select('user_id,template_id').eq('org_id', org),
      sb.from('schedule_prefs').select('user_id,wish_per_month').eq('org_id', org),
      sb.from('schedule_rules').select('*').eq('org_id', org),
      sb.from('schedule_pairs').select('*').eq('org_id', org)
    ]);
    S.availability = {};
    soft(r[0]).forEach(function (x) { (S.availability[x.user_id] = S.availability[x.user_id] || []).push(x.template_id); });
    S.wishes = {};
    soft(r[1]).forEach(function (x) { if (x.wish_per_month) S.wishes[x.user_id] = x.wish_per_month; });
    var ru = soft(r[2])[0];
    S.scheduleRules = ru ? { maxPerMonth: ru.max_per_month, avoidBackToBack: ru.avoid_back_to_back, oneFunction: ru.one_function, useHistory: ru.use_history } : null;
    S.pairs = soft(r[3]).map(function (x) { return { a: x.user_a, b: x.user_b, together: x.together }; });
  };

  /** Pessoas do jeito que o sorteio entende ("vocal" antigo conta como backing vocal). */
  function people() {
    return S.members.map(function (m) {
      return { user_id: m.user_id, functions: m.functions.map(function (f) { return f === 'vocal' ? 'backing_vocal' : f; }),
        templates: S.availability[m.user_id] || [], wish: S.wishes[m.user_id] || null };
    });
  }

  /** − número + */
  L.auto.stepper = function (value, min, max, zeroLabel, onchange) {
    return h('div', { class: 'row', style: { gap: '2px', flex: 'none' } },
      U.iconBtn('Minus', 'Menos', function () { if (value > min) onchange(value - 1); }, { disabled: value <= min }),
      h('span', { class: 'hi semi', style: { minWidth: '28px', textAlign: 'center', fontSize: '14px' } }, value === 0 && zeroLabel ? zeroLabel : String(value)),
      U.iconBtn('Plus', 'Mais', function () { if (value < max) onchange(value + 1); }, { disabled: value >= max }));
  };

  function defaultMonth() {
    var d = new Date(), x = d.getDate() > 20 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : d;
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
  }
  L.auto.open = function (serviceId) {
    var s = serviceId ? L.service(serviceId) : null;
    L.go({ name: 'autofill', month: s ? s.starts_on.slice(0, 7) : defaultMonth(), id: serviceId || null });
  };
  function monthsAhead() {
    var out = [], d = new Date();
    for (var i = 0; i < 3; i++) { var x = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
    return out;
  }
  function mes(m) { return L.MESES[+m.slice(5, 7) - 1]; }

  // ------------------------------------------------------------------ Rascunho
  L.screen('autofill', function (r) {
    var key = (r.month || '') + '|' + (r.id || '');
    if (A.key !== key) A = { key: key, month: r.month || defaultMonth(), only: r.id || null, seed: 1, locked: {}, rulesOpen: false, busy: false };
    var X = AE(), today = L.today(), ps = people(), ru = rules();
    var inMonth = S.services.filter(function (s) { return s.starts_on.slice(0, 7) === A.month && s.starts_on >= today && (!A.only || s.id === A.only); })
      .sort(function (a, b) { return a.starts_on.localeCompare(b.starts_on) || String(a.start_time || '').localeCompare(String(b.start_time || '')); });
    var targets = inMonth.map(function (s) {
      return { service: s, needs: X.needsFor(s, S.templates.find(function (t) { return t.id === s.template_id; }), S.teams, ps) };
    });
    var pl = X.plan(S.services, targets, ps, S.unavailable, ru, S.pairs, A.month, A.locked, A.seed);
    var news = X.newPicks(pl);

    var root = h('div', { class: 'screen', style: { paddingBottom: inMonth.length ? '170px' : '40px' } },
      U.topRow(A.only ? 'Gerar a equipe' : 'Preencher o mês', 'Rascunho: só vai para a banda quando você publicar'));
    if (!A.only) root.appendChild(h('div', { class: 'hscroll' }, monthsAhead().map(function (m) {
      return U.toggle(L.cap(mes(m)), A.month === m, null, function () { A.key = null; L.replace({ name: 'autofill', month: m }); });
    })));
    if (!inMonth.length) {
      root.appendChild(U.empty(A.only ? 'Essa escala já passou.' : 'Nenhuma escala em ' + mes(A.month) + ' ainda. Crie as escalas do mês na Agenda fixa da igreja (ou uma a uma) e volte aqui.'));
      return root;
    }
    root.appendChild(U.body((A.only ? 'O app escolheu as pessoas das vagas vazias desta escala, olhando o mês inteiro para equilibrar: ' : 'O app escolheu as pessoas das vagas vazias, de forma equilibrada: ') +
      'quem foi menos escalado vai primeiro. Ninguém entra num dia que marcou que não pode, nem fora dos horários em que costuma poder. Quem já estava escalado continua. Toque numa pessoa para trocar ou travar.', 'var(--muted)', 13));

    // Quantas vezes cada um
    var rows = ps.filter(function (p) { return p.functions.length; }).map(function (p) { return [p, pl.load[p.user_id] || 0]; })
      .sort(function (a, b) { return b[1] - a[1] || L.nameOf(a[0].user_id).localeCompare(L.nameOf(b[0].user_id)); });
    var max = Math.max(1, rows.reduce(function (m, x) { return Math.max(m, x[1]); }, 0));
    root.appendChild(U.panel('Quantas vezes cada um', 'UsersRound', rows.length ? rows.map(function (x) {
      return h('div', { class: 'row', style: { minHeight: '30px', gap: '10px' } },
        h('span', { class: 'hi ell', style: { width: '120px', fontSize: '13px' } }, L.nameOf(x[0].user_id)),
        h('div', { class: 'grow' }, U.bar(x[1] / max)),
        h('span', { class: 'hi semi', style: { width: '72px', fontSize: '13px' } }, x[1] + (x[0].wish ? ' / quer ' + x[0].wish : '')));
    }) : U.body('Ninguém marcou funções no perfil ainda (Eu › Meu perfil, ou o líder em Banda › Pessoas).', 'var(--muted)', 13)));

    // Regras
    function setRules(nr) {
      S.scheduleRules = nr; L.render();
      sb.from('schedule_rules').upsert({ org_id: S.current.org.id, max_per_month: nr.maxPerMonth || null, avoid_back_to_back: nr.avoidBackToBack,
        one_function: nr.oneFunction, use_history: nr.useHistory }, { onConflict: 'org_id' }).then(function (res) { if (res.error) failSave(res.error); });
    }
    var summary = [ru.maxPerMonth ? 'até ' + ru.maxPerMonth + ' por mês' : 'sem limite no mês', ru.avoidBackToBack ? 'evita seguidas' : null,
      ru.oneFunction ? 'uma função por escala' : null, ru.useHistory ? 'conta os meses anteriores' : null,
      S.pairs.length ? L.plural(S.pairs.length, 'par', 'pares') : null].filter(Boolean).join(' · ');
    var rp = U.panel('Regras', 'SlidersHorizontal',
      U.clickRow(function () { A.rulesOpen = !A.rulesOpen; L.render(); }, h('span', { class: 'grow', style: { fontSize: '13px' } }, L.cap(summary)), ic(A.rulesOpen ? 'ChevronDown' : 'ChevronRight', 18, 'muted')));
    if (A.rulesOpen) {
      rp.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, 'Máximo de vezes no mês'), h('div', { class: 'muted small' }, 'Por pessoa, somando todas as funções')),
        L.auto.stepper(ru.maxPerMonth || 0, 0, 10, 'sem limite', function (v) { setRules(Object.assign({}, ru, { maxPerMonth: v || null })); })));
      rp.appendChild(U.switchRow('Evitar escalas seguidas', 'No mesmo dia ou no mesmo horário em semanas seguidas', ru.avoidBackToBack, function (v) { setRules(Object.assign({}, ru, { avoidBackToBack: v })); }));
      rp.appendChild(U.switchRow('Uma função por escala', 'Quem canta e toca não faz as duas coisas no mesmo culto', ru.oneFunction, function (v) { setRules(Object.assign({}, ru, { oneFunction: v })); }));
      rp.appendChild(U.switchRow('Contar os meses anteriores', 'Quem serviu muito nos últimos 2 meses vai um pouco menos', ru.useHistory, function (v) { setRules(Object.assign({}, ru, { useHistory: v })); }));
      rp.appendChild(U.label('Juntos ou separados'));
      if (!S.pairs.length) rp.appendChild(U.body('Ex.: um casal que vai sempre junto, ou duas pessoas que não devem ficar na mesma escala.', 'var(--muted)', 12));
      S.pairs.forEach(function (p) {
        rp.appendChild(h('div', { class: 'row', style: { gap: '8px' } },
          h('span', { style: { color: p.together ? 'var(--ok)' : 'var(--warn)' } }, ic(p.together ? 'HandHeart' : 'X', 16)),
          h('span', { class: 'grow', style: { fontSize: '13px' } }, L.nameOf(p.a) + ' e ' + L.nameOf(p.b) + ': ' + (p.together ? 'sempre juntos' : 'nunca juntos')),
          U.iconBtn('Trash2', 'Tirar', function () {
            S.pairs = S.pairs.filter(function (q) { return q !== p; }); L.render();
            sb.from('schedule_pairs').delete().eq('org_id', S.current.org.id).eq('user_a', p.a).eq('user_b', p.b).then(function (res) { if (res.error) failSave(res.error); });
          }, { color: 'var(--muted)' })));
      });
      rp.appendChild(U.btn2('Adicionar juntos ou separados', 'Plus', pairDialog, { full: true }));
    }
    root.appendChild(rp);

    var empty = X.empty(pl).length;
    if (empty) root.appendChild(h('div', { class: 'panel', style: { borderColor: 'var(--warn)', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', textAlign: 'left', gap: '10px' } }, h('span', { style: { color: 'var(--warn)' } }, ic('TriangleAlert', 18)),
      h('span', { style: { fontSize: '13px' } }, L.plural(empty, 'vaga ficou sem ninguém', 'vagas ficaram sem ninguém') + '. Toque nela para escolher alguém à mão ou deixe vazia.')));

    targets.forEach(function (t) {
      var s = t.service;
      var p = U.panel(s.title, 'CalendarDays', h('div', { class: 'muted small' }, L.cap(L.fullDate(s.starts_on)) + (s.start_time ? ' · ' + L.hhmm(s.start_time) : '')));
      var by = {};
      X.of(pl, s.id).forEach(function (x) { (by[x.seat.function] = by[x.seat.function] || []).push(x); });
      Object.keys(by).sort(function (a, b) { return (X.ORDER.indexOf(a) + 1 || 99) - (X.ORDER.indexOf(b) + 1 || 99); }).forEach(function (fn) {
        p.appendChild(h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '8px' } },
          h('div', { class: 'row muted small', style: { width: '118px', flex: 'none', paddingTop: '8px', gap: '6px' } }, ic(L.fnIcon(fn), 15), h('span', { class: 'ell' }, L.fnLabel(fn))),
          h('div', { class: 'grow', style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, by[fn].sort(function (a, b) { return a.seat.index - b.seat.index; }).map(function (x) {
            return pickChip(x, function () { seatDialog(pl, x.seat, ps, ru); });
          }))));
      });
      root.appendChild(p);
    });

    var n = news.length;
    var nSvc = news.map(function (x) { return x.seat.service_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
    root.appendChild(h('div', { class: 'wizfoot', style: { position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: '880px', margin: '0 auto', flexDirection: 'column', alignItems: 'stretch' } },
      h('div', { class: 'hi semi', style: { fontSize: '14px', paddingLeft: '4px' } }, A.busy ? 'Publicando…' : !n ? 'Nada para publicar: as vagas já estão preenchidas.'
        : L.plural(n, 'pessoa nova', 'pessoas novas') + ' em ' + L.plural(nSvc, 'escala', 'escalas')),
      h('div', { class: 'row' },
        U.btn2('Sortear de novo', 'RefreshCw', function () { A.seed++; L.render(); }, { disabled: A.busy, style: { flex: 1 } }),
        U.btn('Publicar', 'CalendarCheck', function () { publish(news); }, { disabled: A.busy || !n, style: { flex: 1 } }))));
    return root;
  });

  function publish(news) {
    if (A.busy || !news.length) return;
    A.busy = true; L.render();
    var org = S.current.org.id, only = A.only, m = A.month;
    var rows = news.map(function (x) { return { service_id: x.seat.service_id, user_id: x.user_id, function: x.seat.function }; });
    L.run(async function () {
      try {
        L.must(await sb.from('service_members').insert(rows));
        await sb.from('messages').insert({ org_id: org, service_id: only, body: only ? 'A equipe desta escala foi montada. Confira a sua função e confirme a presença 🙏'
          : 'As escalas de ' + mes(m) + ' foram publicadas. Abra Escalas e confirme a sua presença 🙏' });
        await D.reloadServices();
        if (D.refreshMessages) await D.refreshMessages();
        A.key = null;
        L.toast(only ? 'Equipe escalada. Cada pessoa recebe o aviso para confirmar.' : 'Escalas de ' + mes(m) + ' publicadas. Cada pessoa recebe o aviso para confirmar.');
        L.back();
      } finally { A.busy = false; L.render(); }
    });
  }

  function pickChip(x, onclick) {
    var emp = !x.user_id;
    var edge = emp || x.note ? 'var(--warn)' : x.existing ? 'transparent' : 'var(--accent)';
    var bg = x.existing ? 'var(--control)' : emp ? 'transparent' : 'var(--accent-soft)';
    var sub = x.existing ? 'já estava' : x.note ? x.note : x.locked && emp ? 'deixada vazia' : null;
    return h('button', { class: 'pickchip', disabled: x.existing, onclick: x.existing ? null : onclick,
      style: { border: '1px solid ' + edge, background: bg, borderRadius: '12px', padding: '6px 10px', textAlign: 'left', color: 'inherit', cursor: x.existing ? 'default' : 'pointer', font: 'inherit' } },
      h('div', { class: 'row', style: { gap: '4px' } }, x.locked ? h('span', { class: 'accent' }, ic('Lock', 12)) : null,
        h('span', { class: 'semi', style: { fontSize: '13px', color: emp ? 'var(--warn)' : 'var(--hi)' } }, emp ? 'Vazia' : L.nameOf(x.user_id))),
      sub ? h('div', { style: { fontSize: '11px', color: x.existing ? 'var(--muted)' : 'var(--warn)' } }, sub) : null);
  }

  function seatDialog(pl, seat, ps, ru) {
    var X = AE(), k = X.seatKey(seat);
    var s = L.service(seat.service_id);
    var cur = (pl.picks.find(function (x) { return X.seatKey(x.seat) === k; }) || {}).user_id || null;
    var list = X.candidates(pl, S.services, seat, ps, S.unavailable, ru, S.pairs, A.month);
    L.dialog({
      title: h('div', null, h('div', { class: 'dt', style: { padding: 0 } }, L.fnLabel(seat.function)), s ? h('div', { class: 'muted small' }, s.title + ' · ' + L.fullDate(s.starts_on)) : null),
      body: function (close) {
        if (!list.length) return U.body('Ninguém da banda marcou ' + L.fnLabel(seat.function).toLowerCase() + ' no perfil.', 'var(--muted)', 13);
        return list.map(function (c) {
          var m = S.members.find(function (x) { return x.user_id === c.person.user_id; });
          var on = c.person.user_id === cur;
          // Quem respondeu "não posso" nesta escala ou já está nesta função não dá para escolher (o banco não aceita repetir).
          var no = c.why === 'respondeu que não pode nesta escala' || c.why === 'já está nesta função';
          return h('div', { class: 'row', style: { minHeight: '54px', gap: '10px', cursor: no ? 'default' : 'pointer', opacity: no ? 0.55 : 1, borderRadius: '12px', padding: '0 6px', background: on ? 'var(--accent-soft)' : null },
            onclick: no ? null : function () { A.locked[k] = c.person.user_id; close(); L.render(); } },
            U.avatar(m, 34), h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, L.nameOf(c.person.user_id)),
              h('div', { class: 'small', style: { color: c.why ? 'var(--warn)' : 'var(--muted)' } }, L.plural(pl.load[c.person.user_id] || 0, 'vez no mês', 'vezes no mês') + (c.why ? ' · ' + c.why : ''))),
            on ? h('span', { class: 'accent' }, ic('Check', 18)) : null);
        }).concat([U.body('Quem você escolher fica travado nesta vaga, mesmo ao sortear de novo.', 'var(--muted)', 12)]);
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: function () { A.locked[k] = null; close(); L.render(); } }, 'Deixar vazia'),
          k in A.locked ? h('button', { class: 'textbtn', onclick: function () { delete A.locked[k]; close(); L.render(); } }, 'O app escolhe')
            : h('button', { class: 'textbtn', disabled: !cur, onclick: function () { if (cur) A.locked[k] = cur; close(); L.render(); } }, 'Travar')];
      }
    });
  }

  function pairDialog() {
    var st = { a: null, b: null, together: true };
    var dlg = L.dialog({
      title: 'Juntos ou separados',
      body: function () {
        if (st.a && st.b) return [h('div', { class: 'hi semi', style: { fontSize: '15px' } }, L.nameOf(st.a) + ' e ' + L.nameOf(st.b)),
          h('div', { class: 'row' }, U.toggle('Sempre juntos', st.together, 'HandHeart', function () { st.together = true; dlg.rebuild(); }),
            U.toggle('Nunca juntos', !st.together, 'X', function () { st.together = false; dlg.rebuild(); })),
          U.body(st.together ? 'Quando um for escalado, o app tenta colocar o outro na mesma escala (se tiver vaga na função dele).' : 'O app nunca coloca os dois na mesma escala.', 'var(--muted)', 12)];
        return [U.body(st.a ? 'E quem mais?' : 'Escolha a primeira pessoa', 'var(--muted)', 13)].concat(S.members.filter(function (m) { return m.user_id !== st.a; }).map(function (m) {
          return h('div', { class: 'row', style: { minHeight: '50px', gap: '10px', cursor: 'pointer' }, onclick: function () { if (!st.a) st.a = m.user_id; else st.b = m.user_id; dlg.rebuild(); } },
            U.avatar(m, 32), h('span', { class: 'hi' }, m.name));
        }));
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', disabled: !(st.a && st.b), onclick: function () {
            var x = st.a < st.b ? st.a : st.b, y = st.a < st.b ? st.b : st.a;
            S.pairs = S.pairs.filter(function (q) { return !(q.a === x && q.b === y); }).concat([{ a: x, b: y, together: st.together }]);
            close(); L.render();
            sb.from('schedule_pairs').upsert({ org_id: S.current.org.id, user_a: x, user_b: y, together: st.together }, { onConflict: 'org_id,user_a,user_b' })
              .then(function (res) { if (res.error) failSave(res.error); });
          } }, 'Salvar')];
      }
    });
  }

  // ------------------------------------------------------------------ Quando eu costumo poder
  /** Horários da agenda fixa em que a pessoa costuma poder e quantas vezes quer servir. */
  L.auto.panel = function (userId) {
    var org = S.current.org.id, me = userId === L.uid();
    var active = S.templates.filter(function (t) { return t.active !== false; }).sort(function (a, b) { return a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time)); });
    var mine = S.availability[userId] || [];
    var p = U.panel(me ? 'Quando eu costumo poder' : 'Quando costuma poder', 'CalendarCheck');
    if (!active.length) p.appendChild(U.body('A banda ainda não cadastrou a agenda fixa (os cultos de toda semana).', 'var(--muted)', 13));
    else {
      p.appendChild(U.body(mine.length ? 'A escala automática só usa os horários marcados. Os dias que não pode continuam valendo.'
        : 'Nada marcado: pode ser escalado(a) em qualquer horário. Marque só os horários em que costuma poder.', 'var(--muted)', 12));
      active.forEach(function (t) {
        var on = mine.indexOf(t.id) >= 0;
        p.appendChild(h('div', { class: 'row', style: { minHeight: '50px', gap: '12px', cursor: 'pointer' }, onclick: function () {
          var before = mine.slice();
          S.availability[userId] = on ? mine.filter(function (x) { return x !== t.id; }) : mine.concat([t.id]);
          L.render();
          var q = on ? sb.from('availability').delete().eq('org_id', org).eq('user_id', userId).eq('template_id', t.id)
            : sb.from('availability').upsert({ org_id: org, user_id: userId, template_id: t.id }, { onConflict: 'org_id,user_id,template_id' });
          q.then(function (res) { if (res.error) { S.availability[userId] = before; failSave(res.error); L.render(); } });
        } }, h('span', { style: { color: on ? 'var(--ok)' : 'var(--muted)' } }, ic(on ? 'CircleCheckBig' : 'Square', 20)),
          h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, t.title), h('div', { class: 'muted small' }, DIAS3[t.weekday - 1] + ' ' + L.hhmm(t.start_time)))));
      });
    }
    var wish = S.wishes[userId] || 0;
    p.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, me ? 'Quantas vezes quero servir' : 'Quantas vezes quer servir'), h('div', { class: 'muted small' }, 'Por mês (opcional)')),
      L.auto.stepper(wish, 0, 12, 'tanto faz', function (v) {
        var before = S.wishes[userId];
        if (v) S.wishes[userId] = v; else delete S.wishes[userId];
        L.render();
        sb.from('schedule_prefs').upsert({ org_id: org, user_id: userId, wish_per_month: v || null }, { onConflict: 'org_id,user_id' })
          .then(function (res) { if (res.error) { if (before) S.wishes[userId] = before; else delete S.wishes[userId]; failSave(res.error); L.render(); } });
      })));
    return p;
  };

  /** Disponibilidade de outra pessoa (para quem monta escala). */
  L.screen('memberavail', function (r) {
    var off = (S.unavailable[r.id] || []).filter(function (d) { return d >= L.today(); }).sort();
    return h('div', { class: 'screen' }, U.topRow(L.nameOf(r.id), 'Disponibilidade para a escala'), L.auto.panel(r.id), U.label('Dias que não pode'),
      off.length ? off.map(function (d) { return U.keyValue(L.cap(L.fullDate(d)), 'não pode'); }) : U.body('Nenhum dia marcado. Só a própria pessoa marca, em Escalas › Dias que não posso.', 'var(--muted)', 13));
  });
})();
