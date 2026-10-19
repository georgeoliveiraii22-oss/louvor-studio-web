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
      h('div', { class: 't' }, L.igreja.pill(S.current.org.name), h('h1', { class: 'h1 ell' }, first ? hello + ', ' + first : hello)),
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
      msgBlock = [h('h2', { class: 'gtitle' }, 'Mensagens novas'), U.clickRow(function () {
        if (S.unread['']) { L.setTab('conversa'); return; }
        var k = Object.keys(S.unread).find(function (x) { return x && S.unread[x] > 0; });
        if (k) L.go({ name: 'chat', id: k }); else L.setTab('conversa');
      },
        h('span', { class: 'circle' }, ic('MessagesSquare', 19)),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, (unread === 1 ? '1 mensagem que você não leu' : unread + ' mensagens que você não leu')),
          last ? h('div', { class: 'muted small ell' }, L.nameOf(last.author) + ': ' + last.body) : null),
        U.badge(unread))];
    }

    var notices = S.announcements.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1); }).slice(0, 2);
    // Celular: uma coluna, na ordem. Computador: passe e tarefas à esquerda, conversa e mural à direita.
    return h('div', { class: 'screen' + (S.church.wall ? ' haswall' : '') }, L.igreja.wallpaper(), head,
      h('div', { class: 'home-grid' },
        h('div', { class: 'home-a' }, nextBlock, h('h2', { class: 'gtitle' }, 'Para você'), todoBlock, L.social.section()),
        h('div', { class: 'home-b' }, msgBlock,
          h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('h2', { class: 'gtitle grow' }, 'Mural da banda'),
            h('button', { class: 'textbtn', style: { fontSize: '15px', padding: '6px 4px' }, onclick: function () { L.go({ name: 'news' }); } }, 'Ver tudo')),
          notices.length ? notices.map(function (n) { return L.noticeCard(n, true); })
            : U.body(L.perm.leader() ? 'Nenhum aviso. Toque em Ver tudo para escrever um aviso para a banda.' : 'Nenhum aviso do líder por enquanto.', 'var(--muted)', 13))));
  });

  /**
   * A próxima escala como uma folha de agenda (o mesmo do app): a data grande à esquerda, uma linha fina azul,
   * o nome, a hora e o local; embaixo, os rostos, o que eu faço e a minha resposta. O azul fica só no Confirmar.
   */
  function nextCard(s) {
    var me = L.uid();
    var mine = L.peopleOf(s, me);
    var days = L.daysBetween(L.today(), s.starts_on);
    var d = L.d(s.starts_on);
    var p0 = mine[0];
    var pending = mine.length && p0.status === 'pendente' && !p0.swap_requested;
    var people = uniq(s.people);
    var songs = s.songIds.map(function (id) { return L.project(id); }).filter(Boolean);
    var whenCls = days === 0 ? 'hoje' : days === 1 ? 'amanha' : '';
    function go() { L.go({ name: 'escala', id: s.id }); }
    var others = people.filter(function (u) { return u !== me; });
    var faces = (others.length ? others : people).slice(0, 4);

    var actions;
    if (pending) {
      actions = [
        U.btn2('Não posso', 'X', function () { D.scheduleAction('O líder vai saber que você não pode.', function () { return D.respond(s.id, { status: 'recusado' }); }); }, { full: true }),
        U.btn('Confirmar', 'Check', function () { D.scheduleAction('Presença confirmada. Obrigado!', function () { return D.respond(s.id, { status: 'confirmado' }); }); }, { full: true })];
    } else if (!mine.length && L.perm.schedule() && (!people.length || !songs.length)) {
      actions = [U.btn('Completar escala', 'Pencil', function () { L.go({ name: 'wizard', id: s.id }); }, { full: true })];
    } else if (!mine.length) {
      actions = [U.btn('Ver escala', 'CalendarDays', go, { full: true })];
    } else {
      actions = [songs.length ? U.btn2('Ensaiar', 'Headphones', go, { full: true }) : null, U.btn2('Ver escala', 'CalendarDays', go, { full: true })];
    }

    return h('div', { class: 'agenda', role: 'button', tabindex: '0', 'aria-label': 'Abrir a escala ' + s.title, onclick: go,
      onkeydown: function (e) { if (e.key === 'Enter' && e.target === this) go(); } },
      h('div', { class: 'folha' },
        h('div', { class: 'data' }, h('b', { class: 'w' }, L.SEMANA_CURTA[L.dow(s.starts_on) - 1]), h('b', { class: 'n' }, String(d.getDate())), h('span', { class: 'm' }, L.MES_CURTO[d.getMonth()].toUpperCase())),
        h('span', { class: 'linha', 'aria-hidden': 'true' }),
        h('div', { class: 'info' },
          h('div', { class: 'titulo' }, s.title),
          h('div', { class: 'onde' }, [L.timeRange(s), s.location].filter(Boolean).join(' · ') || L.kindLabel(s.kind)),
          h('div', { class: 'quando ' + whenCls }, h('i'), days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : 'Em ' + days + ' dias'))),
      h('div', { class: 'sep' }),
      h('div', { class: 'quem' },
        faces.length ? h('span', { class: 'stack' }, faces.map(function (u) { return U.avatar(S.members.find(function (x) { return x.user_id === u; }) || { user_id: u, name: L.nameOf(u) }, 30); }),
          (others.length || people.length) > faces.length ? h('em', null, '+' + ((others.length || people.length) - faces.length)) : null) : null,
        h('div', { class: 'grow', style: { minWidth: 0 } },
          h('div', { class: 'eu ell' }, mine.length ? 'Você: ' + mine.map(function (p) { return L.fnLabel(p.function); }).join(', ') : people.length ? L.plural(people.length, 'pessoa', 'pessoas') : 'Ainda sem equipe'),
          h('div', { class: 'muted small ell' }, songs.length ? L.plural(songs.length, 'música', 'músicas') + ': ' + songs.slice(0, 2).map(function (p) { return p.song_title; }).join(', ') + (songs.length > 2 ? '…' : '') : 'Músicas a definir')),
        mine.length && !pending ? U.statusFor(p0) : null),
      h('div', { class: 'acoes', onclick: function (e) { e.stopPropagation(); } }, actions));
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
    // Banda com pouca gente: convidar o pessoal (só o líder)
    if (L.perm.leader() && S.members.length <= 2) out.push({ icon: 'UserPlus', title: 'Convide o pessoal da banda', sub: 'Mande o código de convite pelo WhatsApp: cada um cria a conta e entra.', go: function () { L.openInvite(); } });
    // Sem foto: um convite gentil (some quando a pessoa põe a foto)
    var mine = L.me();
    if (mine && !mine.avatar_path) out.push({ icon: 'Camera', title: 'Coloque sua foto', sub: 'Para a banda te reconhecer nas escalas e na conversa', go: function () { L.go({ name: 'profile' }); } });
    return out;
  }
})();
