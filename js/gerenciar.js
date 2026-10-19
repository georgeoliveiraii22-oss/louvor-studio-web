// Louvor Studio (web para celular) — Gerenciar escalas (ui/ManageSchedulesScreen.kt e data/BulkSchedules.kt):
// criar (uma, o mês pela agenda fixa, equipes) e editar várias de uma vez (apagar, hora, local, tipo, lembrar).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var G = L.gerenciar = { range: 'proximas', sel: {} };
  var RANGES = [['proximas', 'Próximas'], ['estemes', 'Este mês'], ['proximomes', 'Próximo mês'], ['passadas', 'Já passaram']];

  function ym(iso) { return iso.slice(0, 7); }
  function nextYm(m) { var d = new Date(+m.slice(0, 4), +m.slice(5, 7), 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function byDate(a, b) { return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : (a.start_time || '') < (b.start_time || '') ? -1 : 1; }
  G.filter = function (all, range, today) {
    var m = ym(today);
    if (range === 'estemes') return all.filter(function (s) { return ym(s.starts_on) === m; }).sort(byDate);
    if (range === 'proximomes') return all.filter(function (s) { return ym(s.starts_on) === nextYm(m); }).sort(byDate);
    if (range === 'passadas') return all.filter(function (s) { return s.starts_on < today; }).sort(function (a, b) { return -byDate(a, b); });
    return all.filter(function (s) { return s.starts_on >= today; }).sort(byDate);
  };
  /** "19:30", "19h30", "19h", "19", "7:05" → "19:30"; nulo se não for hora. */
  G.parseTime = function (t) {
    var m = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(String(t || '').trim().toLowerCase().replace(/\s/g, ''));
    if (!m) return null;
    var hh = +m[1], mm = +(m[2] || 0);
    return hh <= 23 && mm <= 59 ? String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') : null;
  };
  function waiting(s) { return L.uniqPeople(s.people.filter(function (p) { return p.status === 'pendente' && !p.swap_requested; })); }

  L.screen('gerenciar', function () {
    var today = L.today();
    var list = G.filter(S.services, G.range, today);
    var ids = list.filter(function (s) { return G.sel[s.id]; }).map(function (s) { return s.id; });
    var allOn = list.length && ids.length === list.length;
    var root = h('div', { class: 'screen', style: { paddingBottom: ids.length ? '170px' : '40px' } },
      U.topRow('Gerenciar escalas', 'Criar e editar várias de uma vez'));

    root.appendChild(U.panel('Criar', 'CalendarPlus',
      U.menuRow('CalendarDays', 'Uma escala', 'Passo a passo: dia, músicas, ministro, vozes, músicos e técnica.', function () { L.go({ name: 'wizard' }); }),
      U.menuRow('CalendarCheck', 'O mês inteiro e a agenda fixa', S.templates.length
        ? 'Agenda fixa da igreja: ' + L.plural(S.templates.filter(function (t) { return t.active !== false; }).length, 'horário', 'horários') + '. Crie o mês inteiro de uma vez.'
        : 'Cadastre os cultos fixos da igreja (ex.: quarta 19h, domingo 9h) e crie o mês num toque.', function () { L.go({ name: 'templates' }); }),
      U.menuRow('UsersRound', 'Equipes fixas', S.teams.length ? L.plural(S.teams.length, 'equipe', 'equipes') + ': ' + S.teams.slice(0, 3).map(function (t) { return t.name; }).join(', ')
        : 'Equipe A, Equipe B…: escale a equipe inteira com um toque.', function () { L.go({ name: 'teams' }); })));

    root.appendChild(h('h2', { class: 'gtitle' }, 'Editar várias de uma vez'));
    root.appendChild(h('div', { class: 'hscroll' }, RANGES.map(function (r) {
      return U.toggle(r[1], G.range === r[0], null, function () { G.range = r[0]; L.render(); });
    })));
    if (list.length) root.appendChild(h('div', { class: 'row' },
      h('span', { class: 'muted small grow' }, ids.length ? L.plural(ids.length, 'escolhida', 'escolhidas') + ' de ' + list.length : 'Toque nas escalas para escolher'),
      h('button', { class: 'textbtn', onclick: function () {
        if (allOn) G.sel = {}; else { G.sel = {}; list.forEach(function (s) { G.sel[s.id] = true; }); }
        L.render();
      } }, allOn ? 'Limpar' : 'Escolher todas')));
    else root.appendChild(U.empty(G.range === 'passadas' ? 'Nenhuma escala que já passou.' : 'Nenhuma escala nesse período.'));

    var thisYear = today.slice(0, 4), last = null;
    list.forEach(function (s) {
      var m = ym(s.starts_on);
      if (m !== last) {
        last = m;
        var inMonth = list.filter(function (x) { return ym(x.starts_on) === m; });
        var monthOn = inMonth.every(function (x) { return G.sel[x.id]; });
        root.appendChild(h('div', { class: 'row', style: { marginTop: '6px' } },
          h('span', { class: 'hi', style: { fontSize: '17px', fontWeight: '700' } }, L.cap(L.MESES[+m.slice(5, 7) - 1]) + (m.slice(0, 4) !== thisYear ? ' de ' + m.slice(0, 4) : '')),
          h('span', { class: 'grow' }),
          h('button', { class: 'textbtn', style: { fontSize: '14px' }, onclick: function () { inMonth.forEach(function (x) { if (monthOn) delete G.sel[x.id]; else G.sel[x.id] = true; }); L.render(); } },
            monthOn ? 'Tirar o mês' : 'Escolher o mês')));
      }
      var on = !!G.sel[s.id], w = waiting(s).length;
      root.appendChild(h('div', { class: 'bulkrow' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': String(on), tabindex: '0',
        onclick: function () { if (on) delete G.sel[s.id]; else G.sel[s.id] = true; L.render(); },
        onkeydown: function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.click(); } } },
        h('span', { class: 'chk' }, on ? ic('Check', 15) : null),
        h('div', { class: 'd' }, h('div', { class: 'w' }, L.SEMANA_CURTA[L.dow(s.starts_on) - 1]), h('div', { class: 'n' }, String(L.d(s.starts_on).getDate()))),
        h('div', { class: 'grow col', style: { gap: '2px', minWidth: 0 } },
          h('div', { class: 'hi semi ell', style: { fontSize: '15px' } }, s.title),
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'dot', style: { background: L.kindColor(s.kind) } }),
            h('span', { class: 'muted small ell' }, [L.kindLabel(s.kind), L.timeRange(s), s.location].filter(Boolean).join(' · '))),
          h('div', { class: 'small ' + (w ? 'warn' : 'muted') }, L.plural(L.uniqPeople(s.people).length, 'pessoa', 'pessoas') + ' · ' + L.plural(s.songIds.length, 'música', 'músicas') + (w ? ' · ' + w + ' sem resposta' : '')))));
    });

    if (ids.length) {
      var chosen = list.filter(function (s) { return G.sel[s.id]; });
      var remind = chosen.filter(function (s) { return waiting(s).length && s.starts_on >= today; });
      root.appendChild(h('div', { class: 'bulkbar' },
        h('div', { class: 'hi semi', style: { fontSize: '14px', padding: '0 4px' } }, L.plural(ids.length, 'escala escolhida', 'escalas escolhidas')),
        h('div', { class: 'row wrap', style: { gap: '8px' } },
          action('Clock', 'Hora', function () { timeDialog(ids); }),
          action('MapPin', 'Local', function () { placeDialog(ids); }),
          action('ListFilter', 'Tipo', function () { kindDialog(ids); }),
          remind.length ? action('BellRing', 'Lembrar (' + remind.length + ')', function () {
            L.run(async function () {
              for (var i = 0; i < remind.length; i++) {
                var s = remind[i];
                var names = waiting(s).map(function (u) { return L.nameOf(u).split(' ')[0]; }).join(', ');
                L.must(await sb.from('messages').insert({ org_id: S.current.org.id, service_id: s.id,
                  body: 'Lembrete: ' + names + ', confirmem a presença em ' + s.title + ' (' + L.fullDate(s.starts_on) + '), por favor 🙏' }));
              }
              await D.refreshMessages();
              G.sel = {};
              L.toast('Lembrete enviado na conversa de ' + L.plural(remind.length, 'escala', 'escalas') + '.');
              L.render();
            });
          }) : null,
          action('Trash2', 'Apagar', function () { deleteDialog(ids); }, true))));
    }
    return root;
  });

  function action(icon, text, onclick, danger) {
    return h('button', { class: 'bulkbtn' + (danger ? ' danger' : ''), onclick: onclick }, ic(icon, 17), text);
  }
  function apply(ok, patch, ids) {
    return D.scheduleAction(ok, async function () {
      var r = patch ? await sb.from('services').update(patch).in('id', ids) : await sb.from('services').delete().in('id', ids);
      if (!r.error) G.sel = {};
      return r;
    });
  }
  function count(ids) { return L.plural(ids.length, 'escala escolhida', 'escalas escolhidas'); }

  function deleteDialog(ids) {
    L.dialog({
      title: 'Apagar ' + L.plural(ids.length, 'escala', 'escalas') + '?',
      body: function () { return U.body('As músicas, as pessoas escaladas e a conversa de cada uma também somem. Não dá para desfazer.', null, 14); },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () { close(); apply(L.plural(ids.length, 'escala apagada', 'escalas apagadas') + '.', null, ids); } }, 'Apagar')];
      }
    });
  }
  function timeDialog(ids) {
    var st = { a: '', b: '' };
    L.dialog({
      title: 'Mudar a hora',
      body: function () {
        return [U.body('Vale para as ' + count(ids) + '. O dia não muda.', 'var(--muted)', 13),
          U.field('', 'Começa (ex.: 19:30)', function (v) { st.a = v; }, { inputmode: 'numeric', max: 5 }),
          U.field('', 'Termina (opcional)', function (v) { st.b = v; }, { inputmode: 'numeric', max: 5 })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () {
          var a = G.parseTime(st.a), b = st.b.trim() ? G.parseTime(st.b) : null;
          if (!a || (st.b.trim() && !b)) { L.toast('Escreva a hora assim: 19:30.'); return; }
          close(); apply('Hora mudada.', { start_time: a, end_time: b }, ids);
        } }, 'Mudar')];
      }
    });
  }
  function placeDialog(ids) {
    var st = { v: '' };
    L.dialog({
      title: 'Mudar o local',
      body: function () {
        return [U.body('Vale para as ' + count(ids) + '. Deixe vazio para tirar o local.', 'var(--muted)', 13),
          U.field('', 'Local (ex.: Templo central)', function (v) { st.v = v.slice(0, 120); }, { max: 120 })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', onclick: function () { close(); apply('Local mudado.', { location: st.v.trim() || null }, ids); } }, 'Mudar')];
      }
    });
  }
  function kindDialog(ids) {
    L.dialog({
      title: 'Mudar o tipo',
      body: function (close) {
        return [U.body('Vale para as ' + count(ids) + '.', 'var(--muted)', 13)].concat(L.KINDS.map(function (k) {
          return U.menuRow('CalendarDays', k[1], k[0] === 'ensaio' ? 'Ensaio da banda' : k[0] === 'evento' ? 'Evento, conferência, casamento…' : 'Culto da igreja',
            function () { close(); apply('Tipo mudado para ' + k[1] + '.', { kind: k[0] }, ids); });
        }));
      },
      actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar')]; }
    });
  }
})();
