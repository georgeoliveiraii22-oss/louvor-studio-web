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
      h('div', { class: 't' }, h('span', { class: 'bandpill' }, h('span', null, S.current.org.name)), h('h1', { class: 'h1 ell' }, first ? hello + ', ' + first : hello)),
      U.iconBtn('Newspaper', 'Avisos e novidades', function () { L.go({ name: 'news' }); }, { badge: news }),
      U.iconBtn('RefreshCw', 'Atualizar', L.reload));

    var nextBlock = next ? nextCard(next) : h('div', { class: 'panel', style: { padding: '16px' } },
      h('div', { class: 'hi semi', style: { fontSize: '17px' } }, 'Nenhuma escala marcada'),
      U.body(L.perm.schedule() ? 'Crie a próxima escala: o dia, as músicas e quem vai tocar e cantar.' : 'Quando o líder marcar a próxima escala, ela aparece aqui.', 'var(--muted)', 13),
      L.perm.schedule() ? h('div', null, U.btn('Nova escala', 'Plus', function () { L.go({ name: 'wizard' }); })) : null);

    var todos = buildTodos(me, next && next.id);
    var todoBlock = todos.length ? h('div', { class: 'list' }, todos.map(function (t) {
      return h('div', { class: 'todo', role: 'button', onclick: t.go },
        h('span', { class: 'ic' + (t.warn ? ' warn' : '') }, ic(t.icon, 18)),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, t.title), h('div', { class: 'muted small', style: { display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, t.sub)),
        ic('ChevronRight', 18, 'muted'));
    })) : h('div', { class: 'box row', style: { padding: '16px', gap: '12px' } }, ic('CircleCheckBig', 22, 'ok'), U.body('Tudo em dia. Bom ensaio!'));

    var unread = L.unreadTotal();
    var msgBlock = null;
    if (unread > 0) {
      var last = S.lastMessages.find(function (m) { return m.author !== me; });
      msgBlock = [h('h2', { class: 'gtitle' }, 'Mensagens novas'), U.clickRow(function () { L.setTab('membros'); },
        h('span', { class: 'circle' }, ic('MessagesSquare', 19)),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, (unread === 1 ? '1 mensagem que você não leu' : unread + ' mensagens que você não leu')),
          last ? h('div', { class: 'muted small ell' }, L.nameOf(last.author) + ': ' + last.body) : null),
        U.badge(unread))];
    }

    var notices = S.announcements.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1); }).slice(0, 2);
    // Celular: uma coluna, na ordem. Computador: passe e tarefas à esquerda, conversa e mural à direita.
    return h('div', { class: 'screen' }, head,
      h('div', { class: 'home-grid' },
        h('div', { class: 'home-a' }, nextBlock, h('h2', { class: 'gtitle' }, 'Para você'), todoBlock),
        h('div', { class: 'home-b' }, msgBlock,
          h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('h2', { class: 'gtitle grow' }, 'Mural da banda'),
            h('button', { class: 'textbtn', style: { fontSize: '15px', padding: '6px 4px' }, onclick: function () { L.go({ name: 'news' }); } }, 'Ver tudo')),
          notices.length ? notices.map(function (n) { return L.noticeCard(n, true); })
            : U.body(L.perm.leader() ? 'Nenhum aviso. Toque em Ver tudo para escrever um aviso para a banda.' : 'Nenhum aviso do líder por enquanto.', 'var(--muted)', 13))));
  });

  /** Passe da próxima escala (o mesmo do app): quando, a hora, o que eu faço e a minha resposta. */
  function nextCard(s) {
    var me = L.uid();
    var mine = L.peopleOf(s, me);
    var days = L.daysBetween(L.today(), s.starts_on);
    var d = L.d(s.starts_on);
    var p0 = mine[0];
    var pending = mine.length && p0.status === 'pendente' && !p0.swap_requested;
    function go() { L.go({ name: 'escala', id: s.id }); }
    function field(k, v, num) { return h('div', null, h('small', null, k), h('b', { class: num ? 'n' : null }, v)); }
    var names = s.songIds.map(function (id) { var p = L.project(id); return p ? p.song_title : null; }).filter(Boolean);
    var main = h('div', { class: 'pass-main' },
      h('div', { class: 'pass-head' }, h('span', { class: 'mark' }, ic('AudioLines', 18), h('span', null, S.current.org.name)),
        h('span', { class: 'when' }, days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : 'Em ' + days + ' dias')),
      h('div', { class: 'pass-title' }, s.title),
      h('div', { class: 'pass-fields' },
        field('Dia', L.cap(L.SEMANA_CURTA[L.dow(s.starts_on) - 1].toLowerCase()) + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')),
        field('Hora', L.hhmm(s.start_time) || '—', true),
        mine.length ? field('Você', mine.map(function (p) { return L.fnLabel(p.function); }).join(', ')) : field('Equipe', L.plural(uniq(s.people).length, 'pessoa', 'pessoas'))),
      names.length ? h('div', { class: 'pass-songs' }, names.slice(0, 2).map(function (n) { return h('span', null, n); }),
        names.length > 2 ? h('em', null, '+' + (names.length - 2)) : null) : null);
    var stub = h('div', { class: 'pass-stub', onclick: function (e) { e.stopPropagation(); } },
      pending ? h('div', { class: 'pass-actions' },
        h('button', { class: 'pbtn soft', onclick: function () { D.scheduleAction('O líder vai saber que você não pode.', function () { return D.respond(s.id, { status: 'recusado' }); }); } }, ic('X', 18), 'Não posso'),
        h('button', { class: 'pbtn dark', onclick: function () { D.scheduleAction('Presença confirmada. Obrigado!', function () { return D.respond(s.id, { status: 'confirmado' }); }); } }, ic('Check', 18), 'Confirmar'))
        : h('div', { class: 'row' }, h('div', { class: 'pass-status grow' }, mine.length ? U.statusFor(p0) : h('span', null, L.plural(s.songIds.length, 'música', 'músicas'))),
          h('button', { class: 'pbtn dark', style: { padding: '0 18px' }, onclick: go }, ic('CalendarDays', 18), 'Ver escala')));
    var pass = h('div', { class: 'pass', role: 'button', tabindex: '0', 'aria-label': 'Abrir a escala ' + s.title, onclick: go }, main, stub);
    // Os recortes laterais ficam na linha pontilhada, qualquer que seja a altura do título.
    function cut() { if (main.offsetHeight) pass.style.setProperty('--cut', main.offsetHeight + 'px'); }
    requestAnimationFrame(cut);
    if (window.ResizeObserver) new ResizeObserver(cut).observe(main);
    return h('div', { class: 'passwrap' }, pass);
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
