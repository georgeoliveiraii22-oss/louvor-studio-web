// Louvor Studio (web para celular) — aba Início (ui/HomeScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data;

  L.screen('tab-inicio', function () {
    var me = L.uid();
    var mine = L.me();
    var first = mine && mine.name ? mine.name.trim().split(' ')[0] : null;
    var hour = new Date().getHours();
    var hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    var next = L.myUpcoming()[0] || L.upcoming()[0] || null;
    var news = D.unseenNews();

    var head = h('div', { class: 'tabhead' },
      h('div', { class: 't' }, U.label(S.current.org.name), h('h1', { class: 'h1 ell' }, first ? hello + ', ' + first : hello)),
      U.iconBtn('Newspaper', 'Avisos e novidades', function () { L.go({ name: 'news' }); }, { badge: news }),
      U.iconBtn('RefreshCw', 'Atualizar', L.reload));

    var nextBlock = next ? nextCard(next) : h('div', { class: 'panel', style: { borderRadius: '12px', padding: '16px' } },
      h('div', { class: 'hi semi', style: { fontSize: '17px' } }, 'Nenhuma escala marcada'),
      U.body(L.perm.schedule() ? 'Crie a próxima escala: o dia, as músicas e quem vai tocar e cantar.' : 'Quando o líder marcar a próxima escala, ela aparece aqui.', 'var(--muted)', 13),
      L.perm.schedule() ? h('div', null, U.btn('Nova escala', 'Plus', function () { L.go({ name: 'wizard' }); })) : null);

    var todos = buildTodos(me, next && next.id);
    var todoBlock = todos.length ? h('div', { class: 'list' }, todos.map(function (t) {
      return h('div', { class: 'todo', role: 'button', onclick: t.go },
        h('span', { class: 'ic' + (t.warn ? ' warn' : '') }, ic(t.icon, 17)),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, t.title), h('div', { class: 'muted small', style: { display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, t.sub)),
        ic('ChevronRight', 18, 'muted'));
    })) : h('div', { class: 'box row', style: { padding: '14px', gap: '12px' } }, ic('CircleCheckBig', 22, 'ok'), U.body('Tudo em dia. Bom ensaio!'));

    var unread = L.unreadTotal();
    var msgBlock = null;
    if (unread > 0) {
      var last = S.lastMessages.find(function (m) { return m.author !== me; });
      msgBlock = [U.label('Mensagens novas'), U.clickRow(function () { L.setTab('membros'); },
        h('span', { class: 'circle' }, ic('MessagesSquare', 19)),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, (unread === 1 ? '1 mensagem que você não leu' : unread + ' mensagens que você não leu')),
          last ? h('div', { class: 'muted small ell' }, L.nameOf(last.author) + ': ' + last.body) : null),
        U.badge(unread))];
    }

    var notices = S.announcements.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1); }).slice(0, 2);
    return h('div', { class: 'screen' }, head, nextBlock,
      U.label('Para você fazer'), todoBlock,
      msgBlock,
      h('div', { class: 'row' }, h('div', { class: 'grow' }, U.label('Mural da banda')), h('button', { class: 'textbtn', style: { fontSize: '12px', padding: '6px' }, onclick: function () { L.go({ name: 'news' }); } }, 'ver tudo')),
      notices.length ? notices.map(function (n) { return L.noticeCard(n, true); })
        : U.body(L.perm.leader() ? 'Nenhum aviso. Toque em ver tudo para escrever um aviso para a banda.' : 'Nenhum aviso do líder por enquanto.', 'var(--muted)', 13));
  });

  function nextCard(s) {
    var me = L.uid();
    var mine = L.peopleOf(s, me);
    var days = L.daysBetween(L.today(), s.starts_on);
    var multi = s.songIds.filter(function (id) { var p = L.project(id); return p && L.hasMulti(p); }).length;
    var p0 = mine[0];
    return h('div', { class: 'nextcard', onclick: function () { L.go({ name: 'escala', id: s.id }); } },
      h('div', { class: 'row' }, h('span', { class: 'label grow', style: { color: 'var(--accent-text)', fontWeight: 700 } }, mine.length ? 'Sua próxima escala' : 'Próxima escala da banda'),
        h('span', { class: 'bold', style: { fontSize: '12px', color: days <= 1 ? 'var(--hi)' : 'var(--muted)' } }, days === 0 ? 'HOJE' : days === 1 ? 'AMANHÃ' : 'em ' + days + ' dias')),
      h('div', { class: 'hi bold', style: { fontSize: '22px', lineHeight: 1.2 } }, s.title),
      h('div', { style: { fontSize: '14px' } }, [L.cap(L.fullDate(s.starts_on)), L.timeRange(s)].filter(Boolean).join(' · ')),
      s.location ? h('div', { class: 'row muted', style: { gap: '6px', fontSize: '13px' } }, ic('MapPin', 14), s.location) : null,
      h('div', { class: 'row wrap', style: { gap: '14px' } },
        h('span', { class: 'ministat' }, ic('ListMusic', 14), L.plural(s.songIds.length, 'música', 'músicas')),
        s.songIds.length ? h('span', { class: 'ministat' }, ic('AudioWaveform', 14), multi + ' com multitrack') : null,
        h('span', { class: 'ministat' }, ic('UsersRound', 14), L.plural(uniq(s.people).length, 'pessoa', 'pessoas'))),
      mine.length ? h('div', { class: 'row' }, h('span', { class: 'hi semi grow', style: { fontSize: '14px' } }, 'Você: ' + mine.map(function (p) { return L.fnLabel(p.function); }).join(', ')), U.statusFor(p0)) : null,
      mine.length && p0.status === 'pendente' && !p0.swap_requested ? h('div', { class: 'row', onclick: function (e) { e.stopPropagation(); } },
        U.btn('Confirmar', 'Check', function () { D.scheduleAction('Presença confirmada. Obrigado!', function () { return D.respond(s.id, { status: 'confirmado' }); }); }, { style: { flex: 1 } }),
        U.btn2('Não posso', 'X', function () { D.scheduleAction('O líder vai saber que você não pode.', function () { return D.respond(s.id, { status: 'recusado' }); }); }, { style: { flex: 1 } })) : null,
      h('div', { class: 'row', onclick: function (e) { e.stopPropagation(); } },
        U.btn2('Ver escala', 'CalendarDays', function () { L.go({ name: 'escala', id: s.id }); }, { style: { flex: 1 } })));
  }

  function uniq(people) { return people.map(function (p) { return p.user_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; }); }
  L.uniqPeople = uniq;

  function buildTodos(me, shownId) {
    var out = [];
    var t0 = L.today();
    L.myUpcoming().filter(function (s) { return s.id !== shownId; }).forEach(function (s) {
      var mine = L.peopleOf(s, me);
      if (mine.some(function (p) { return p.status === 'pendente' && !p.swap_requested; })) {
        out.push({ icon: 'CalendarCheck', warn: true, title: 'Confirmar presença', sub: s.title + ' · ' + L.serviceWhen(s.starts_on) + ' · ' + mine.map(function (p) { return L.fnLabel(p.function); }).join(', '),
          go: function () { L.go({ name: 'escala', id: s.id }); } });
      }
    });
    // Músicas das minhas escalas (até 14 dias) que ainda não ensaiei
    L.myUpcoming().filter(function (s) { return L.daysBetween(t0, s.starts_on) <= 14; }).slice(0, 2).forEach(function (s) {
      var marks = S.readiness[s.id] || {};
      var left = s.songIds.filter(function (id) { return (marks[id] || []).indexOf(me) < 0 && L.project(id); });
      if (left.length && s.songIds.length) {
        out.push({ icon: 'Headphones', title: 'Ensaiar ' + L.plural(left.length, 'música', 'músicas'), sub: 'Para ' + s.title + ' (' + L.serviceWhen(s.starts_on) + '). Marque "Ensaiei" em cada uma.',
          go: function () { L.go({ name: 'escala', id: s.id }); } });
      }
    });
    if (L.perm.schedule()) {
      L.upcoming().filter(function (s) { return s.people.some(function (p) { return p.swap_requested; }); }).slice(0, 3).forEach(function (s) {
        out.push({ icon: 'RefreshCw', warn: true, title: 'Pedido de troca', sub: s.title + ' · ' + L.serviceWhen(s.starts_on) + ': ' + s.people.filter(function (p) { return p.swap_requested; }).map(function (p) { return L.nameOf(p.user_id); }).join(', '),
          go: function () { L.go({ name: 'escala', id: s.id }); } });
      });
      L.upcoming().filter(function (s) { return !s.people.length && L.daysBetween(t0, s.starts_on) <= 10; }).slice(0, 2).forEach(function (s) {
        out.push({ icon: 'UsersRound', title: 'Escalar a equipe', sub: s.title + ' · ' + L.serviceWhen(s.starts_on) + ' ainda está sem ninguém.', go: function () { L.go({ name: 'escala', id: s.id }); } });
      });
    }
    return out;
  }
})();
