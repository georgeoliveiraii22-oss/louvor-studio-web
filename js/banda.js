// Louvor Studio (web para celular) — aba Banda (conversas e pessoas), conversa, avisos e novidades (ui/MembersScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var B = { view: 'conversas' };

  L.NEWS = [
    ['1.3.0', [
      'Ferramentas no estúdio do site, como no app: Cursor, Repetir, Mover, Cortar, Aparar, Volume e Partes (só o líder), com Desfazer e Refazer.',
      'Cada um edita a própria gravação; as faixas da banda, o líder ou quem tem permissão. O arquivo original nunca muda.'
    ]],
    ['1.2.0', [
      'Estúdio como uma DAW: cada faixa na sua linha, com a onda dela, o volume, o mudo e o solo. O cursor de tempo atravessa todas e a régua mostra as partes.'
    ]],
    ['1.1.0', [
      'Visual novo, igual ao app: azul, com o passe da próxima escala no Início.',
      'No computador, a tela inteira: menu à esquerda com as próximas escalas, Início em duas colunas e o repertório em lista com tom e BPM.',
      'Estúdio no computador com a letra aberta ao lado das faixas.',
      'Página de entrada nova para quem ainda não tem conta, com uma música de exemplo para ouvir cada instrumento.'
    ]],
    ['1.0.0', [
      'O Louvor Studio agora abre no navegador do celular, com as mesmas telas do app.',
      'Escalas: confirme presença, peça troca, marque os dias que não pode e veja quem toca em cada culto.',
      'Repertório com capa, tom, BPM, letra e o link da versão.',
      'Ouça a multitrack: cada instrumento com mudo, solo e volume, as partes da música e repetir um trecho.',
      'Vozes para estudar: ouça junto a voz que o líder liberou.',
      'Conversa da banda e de cada escala, e o mural de avisos.',
      'Para gravar a sua voz, use o app de Android.'
    ]]
  ];

  // ------------------------------------------------------------------ Aba
  L.screen('tab-membros', function () {
    var m = S.current;
    var unread = L.unreadTotal();
    var root = h('div', { class: 'screen' },
      U.tabHead('Banda', U.iconBtn('RefreshCw', 'Atualizar', L.reload)),
      h('div', { class: 'row' },
        U.toggle('Conversas' + (unread ? ' (' + unread + ')' : ''), B.view === 'conversas', 'MessagesSquare', function () { B.view = 'conversas'; L.render(); }),
        U.toggle('Pessoas (' + S.members.length + ')', B.view === 'pessoas', 'UsersRound', function () { B.view = 'pessoas'; L.render(); })));

    if (B.view === 'conversas') {
      root.appendChild(chatRow(null, 'Conversa da banda', 'Todo mundo da banda'));
      L.upcoming().filter(function (s) { return S.lastMessages.some(function (x) { return x.service_id === s.id; }) || (S.unread[s.id] || 0) > 0; })
        .forEach(function (s) { root.appendChild(chatRow(s.id, s.title, L.scheduleLine(s))); });
      root.appendChild(U.body('Cada escala tem a sua conversa: abra a escala e toque no balão no alto. Ela aparece aqui quando alguém escrever.', 'var(--muted)', 12));
      return root;
    }

    root.appendChild(h('div', { class: 'list' }, S.members.map(function (mb) {
      return h('div', { class: 'li', onclick: function () { memberSheet(mb); } }, U.avatar(mb, 42),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, mb.name + (mb.user_id === L.uid() ? ' (você)' : '')),
          h('div', { class: 'muted small ell' }, mb.functions.map(L.fnLabel).join(', ') || 'sem função marcada')),
        mb.role === 'leader' ? U.chip('Líder', 'accent', 'Crown') : mb.can_schedule ? U.chip('Escalas', 'ok', 'CalendarDays') : mb.can_manage_songs ? U.chip('Músicas', 'ok', 'Library') : null);
    })));

    var code = m.org.invite_code;
    root.appendChild(U.panel('Convidar', 'Share2',
      U.body('Quem tiver este código entra na banda como integrante.', 'var(--muted)', 12),
      h('div', { class: 'row' }, h('span', { class: 'hi mono grow', style: { fontSize: '18px' } }, code),
        U.iconBtn('Copy', 'Copiar código', function () { copy(code); L.toast('Código copiado.'); })),
      U.btn('Convidar pelo WhatsApp (ou outro app)', 'Share2', function () {
        var link = location.origin + location.pathname;
        var text = ['Entre na banda ' + m.org.name + ' no Louvor Studio! 🎶', '', '1. Abra ' + link + ' no celular e crie sua conta.', '2. Toque em "Entrar com código" e digite o código abaixo.', '', 'Código de convite: ' + code].join('\n');
        if (navigator.share) navigator.share({ text: text }).catch(function () { /* cancelou */ });
        else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      }, { full: true })));

    var limit = Math.max(1, m.org.storage_limit_bytes || 5368709120);
    var f = S.storageUsed / limit;
    root.appendChild(U.panel('Espaço da banda na nuvem', 'Cloud', U.keyValue('Usado', L.bytes(S.storageUsed) + ' de ' + L.bytes(limit)),
      U.bar(f, f > 0.9 ? 'var(--bad)' : f > 0.75 ? 'var(--warn)' : null)));
    return root;
  });

  function copy(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).catch(function () { /* sem permissão */ });
  }

  function chatRow(channel, title, sub) {
    var n = S.unread[channel || ''] || 0;
    var last = S.lastMessages.find(function (x) { return (x.service_id || null) === channel; });
    return U.clickRow(function () { L.go({ name: 'chat', id: channel }); },
      h('span', { class: 'circle' + (channel ? '' : ' soft'), style: { width: '42px', height: '42px' } }, ic(channel ? 'CalendarDays' : 'MessagesSquare', 20)),
      h('div', { class: 'grow' }, h('div', { class: 'hi semi ell' }, title),
        h('div', { class: 'small ell', style: { color: n ? 'var(--text)' : 'var(--muted)' } },
          last ? (last.author === L.uid() ? 'Você' : L.nameOf(last.author).split(' ')[0]) + ': ' + last.body : sub)),
      n ? U.badge(n) : ic('ChevronRight', 18, 'muted'));
  }

  /** Ficha de uma pessoa: funções, voz, sobre e (para o líder) as permissões. */
  function memberSheet(mb) {
    var isMe = mb.user_id === L.uid();
    function set(patch, ok, close) {
      close();
      L.run(async function () {
        L.must(await sb.from('memberships').update(patch).eq('org_id', S.current.org.id).eq('user_id', mb.user_id));
        await D.refresh(); L.toast(ok); L.render();
      });
    }
    L.dialog({
      title: h('div', { class: 'row', style: { gap: '12px' } }, U.avatar(mb, 48), h('div', null, h('div', { class: 'hi bold', style: { fontSize: '18px' } }, mb.name), h('div', { class: 'muted small' }, mb.role === 'leader' ? 'Líder' : 'Integrante'))),
      body: function (close) {
        var voice = L.VOICES.find(function (v) { return v[0] && v[0] === mb.voice_type; });
        var next = L.upcoming().filter(function (s) { return s.people.some(function (p) { return p.user_id === mb.user_id; }); }).slice(0, 3);
        return [
          mb.functions.length ? h('div', { class: 'row', style: { gap: '10px' } }, mb.functions.slice(0, 6).map(function (f) { return h('span', { class: 'accent', title: L.fnLabel(f) }, ic(L.fnIcon(f), 18)); })) : null,
          U.body(mb.functions.map(L.fnLabel).join(', ') || 'Ainda não marcou o que faz na banda.', null, 13),
          voice ? U.keyValue('Voz', voice[1]) : null,
          mb.bio ? U.body(mb.bio, 'var(--muted)', 13) : null,
          next.length ? [U.label('Próximas escalas'), next.map(function (s) { return h('div', { style: { fontSize: '13px' } }, s.title + ' · ' + L.serviceWhen(s.starts_on)); })] : null,
          L.perm.leader() && !isMe ? [U.label('Permissões'),
            U.switchRow('Pode editar áudio', 'Aprova gravações e ajusta o estúdio', mb.can_edit_audio || mb.role === 'leader', function (v) { set({ can_edit_audio: v }, v ? mb.name + ' agora pode editar áudio.' : 'Permissão retirada.', close); }, mb.role === 'leader'),
            U.switchRow('Pode montar escalas', 'Cria escalas e chama as pessoas', mb.can_schedule || mb.role === 'leader', function (v) { set({ can_schedule: v }, v ? mb.name + ' agora pode montar escalas.' : 'Permissão retirada.', close); }, mb.role === 'leader'),
            U.switchRow('Pode adicionar músicas', 'Coloca e edita músicas no repertório, com capa e multitrack', mb.can_manage_songs || mb.role === 'leader', function (v) { set({ can_manage_songs: v }, v ? mb.name + ' agora pode adicionar músicas.' : 'Permissão retirada.', close); }, mb.role === 'leader'),
            U.switchRow('Líder', 'Pode tudo, inclusive mudar permissões', mb.role === 'leader', function (v) { set({ role: v ? 'leader' : 'member' }, v ? mb.name + ' agora é líder.' : mb.name + ' agora é integrante.', close); })] : null
        ];
      },
      actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Fechar')]; }
    });
  }

  // ------------------------------------------------------------------ Conversa
  var C = null; // { ch, msgs, timer, text }
  L.screen('chat', function (r) {
    var serviceId = r.id || null;
    var ch = serviceId || '';
    var service = serviceId ? L.service(serviceId) : null;
    var fresh = !C || C.ch !== ch;
    if (fresh) {
      if (C && C.timer) clearInterval(C.timer);
      C = { ch: ch, msgs: null, timer: null, text: '', sending: false };
    }
    var c = C;
    var me = L.uid();
    var list = h('div', { class: 'msgs' });
    var ta = h('textarea', { rows: 1, placeholder: 'Mensagem', maxlength: 2000, 'aria-label': 'Mensagem' });
    ta.value = c.text;
    var sendBtn = h('button', { class: 'sendbtn' + (c.text.trim() ? ' on' : ''), 'aria-label': 'Enviar', onclick: send }, ic('Send', 20));
    ta.addEventListener('input', function () {
      c.text = ta.value;
      sendBtn.classList.toggle('on', !!c.text.trim());
      ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px';
    });

    function paint() {
      list.replaceChildren();
      if (c.msgs === null) { list.appendChild(h('div', { class: 'fill-center', style: { minHeight: '40vh' } }, h('div', { class: 'spinner' }))); return; }
      if (!c.msgs.length) list.appendChild(h('div', { class: 'empty', style: { paddingTop: '40px' } }, service ? 'Nenhuma mensagem ainda. Combine aqui os detalhes desta escala.' : 'Nenhuma mensagem ainda. Diga um oi para a banda!'));
      var prevDay = null, prevAuthor = null;
      c.msgs.forEach(function (msg) {
        var dt = new Date(msg.created_at);
        var day = L.iso(dt);
        if (day !== prevDay) {
          var t0 = L.today();
          list.appendChild(h('div', { class: 'daysep' }, day === t0 ? 'Hoje' : day === L.addDays(t0, -1) ? 'Ontem' : L.cap(L.fullDate(day))));
        }
        var mine = msg.author === me;
        var showName = prevAuthor !== msg.author || day !== prevDay;
        var bubble = h('div', { class: 'bubble' },
          !mine && showName ? h('div', { class: 'who' }, L.nameOf(msg.author)) : null,
          h('div', { class: 'txt' }, msg.body),
          h('div', { class: 'tm' }, String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')));
        if (mine || L.perm.leader()) bubble.addEventListener('contextmenu', function (e) { e.preventDefault(); askDelete(msg); });
        holdToDelete(bubble, function () { if (mine || L.perm.leader()) askDelete(msg); });
        list.appendChild(h('div', { class: 'bubrow' + (mine ? ' mine' : ''), style: { marginTop: showName ? '6px' : 0 } },
          !mine ? (showName ? U.avatar(L.member(msg.author), 30) : h('span', { style: { width: '30px', flex: 'none' } })) : null, bubble));
        prevDay = day; prevAuthor = msg.author;
      });
      setTimeout(function () { list.scrollTop = list.scrollHeight; }, 0);
    }

    async function load() {
      try { c.msgs = await D.messages(serviceId); } catch (e) { c.msgs = []; L.toast(L.errorText(e)); }
      D.markRead(ch);
      if (C === c) c.paint();
      c.timer = setInterval(async function () {
        if (C !== c || L.route().name !== 'chat') { clearInterval(c.timer); return; }
        if (document.hidden) return;
        var last = c.msgs.length ? c.msgs[c.msgs.length - 1].created_at : null;
        try {
          var news = await D.messages(serviceId, last);
          var fresh = news.filter(function (n) { return !c.msgs.some(function (x) { return x.id === n.id; }); });
          if (fresh.length) { c.msgs = c.msgs.concat(fresh); D.markRead(ch); c.paint(); }
        } catch (e) { /* sem internet: tenta de novo */ }
      }, 3000);
    }
    async function send() {
      var body = c.text.trim();
      if (!body || c.sending) return;
      c.sending = true;
      try {
        L.must(await sb.from('messages').insert({ org_id: S.current.org.id, service_id: serviceId, body: body }));
        c.text = ''; ta.value = ''; ta.style.height = 'auto'; sendBtn.classList.remove('on');
        var last = c.msgs.length ? c.msgs[c.msgs.length - 1].created_at : null;
        var news = await D.messages(serviceId, last);
        c.msgs = c.msgs.concat(news.filter(function (n) { return !c.msgs.some(function (x) { return x.id === n.id; }); }));
        D.markRead(ch);
        c.paint();
      } catch (e) { L.toast(L.errorText(e)); } finally { c.sending = false; }
    }
    function askDelete(msg) {
      L.confirm('Apagar mensagem?', '"' + msg.body.slice(0, 120) + '" some para todos.', 'Apagar', function () {
        L.run(async function () { L.must(await sb.from('messages').delete().eq('id', msg.id)); c.msgs = c.msgs.filter(function (x) { return x.id !== msg.id; }); c.paint(); });
      }, true);
    }
    c.paint = paint;
    paint();
    if (fresh) load();
    return h('div', { class: 'chat' },
      h('div', { style: { padding: '8px 8px 0' } }, U.topRow(service ? service.title : 'Conversa da banda', service ? L.scheduleLine(service) : 'Todo mundo da banda lê',
        service ? U.iconBtn('CalendarDays', 'Abrir a escala', function () { L.go({ name: 'escala', id: service.id }); }) : null,
        function () { D.markRead(ch); L.back(); })),
      list,
      h('div', { class: 'composer' }, ta, sendBtn));
  });

  /** Segurar a mensagem (como no app): apaga. */
  function holdToDelete(el, fn) {
    var t = null;
    el.addEventListener('touchstart', function () { t = setTimeout(fn, 600); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { el.addEventListener(ev, function () { clearTimeout(t); }, { passive: true }); });
  }

  // ------------------------------------------------------------------ Avisos e novidades
  var N = { tab: 0 };
  L.screen('news', function () {
    if (!N.seen) { N.seen = true; D.markNewsSeen(); D.reloadAnnouncements().then(function () { if (L.route().name === 'news') L.render(); }); }
    var leader = L.perm.leader();
    var root = h('div', { class: 'screen' },
      U.topRow('Avisos e novidades', null, leader && N.tab === 0 ? U.iconBtn('Plus', 'Escrever aviso', noticeDialog) : null, function () { N.seen = false; L.back(); }),
      h('div', { class: 'row' }, U.toggle('Mural da banda', N.tab === 0, 'Megaphone', function () { N.tab = 0; L.render(); }),
        U.toggle('Novidades', N.tab === 1, 'Sparkles', function () { N.tab = 1; L.render(); })));
    if (N.tab === 0) {
      var list = S.announcements.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1); });
      if (!list.length) root.appendChild(U.empty(leader ? 'Nenhum aviso. Toque em + para escrever o primeiro.' : 'Nenhum aviso do líder por enquanto.'));
      list.forEach(function (n) { root.appendChild(L.noticeCard(n, false)); });
      if (leader && list.length) root.appendChild(U.btn2('Escrever aviso', 'Plus', noticeDialog, { full: true }));
    } else {
      L.NEWS.forEach(function (x, i) {
        root.appendChild(U.panel('Versão ' + x[0] + ' do site', i === 0 ? 'Sparkles' : 'Info', x[1].map(function (line) {
          return h('div', { class: 'row top' }, h('span', { class: 'accent', style: { width: '16px', flex: 'none' } }, '•'), U.body(line, null, 13));
        })));
      });
    }
    return root;
  });

  L.noticeCard = function (n, compact) {
    var leader = L.perm.leader();
    var d = new Date(n.created_at);
    return h('div', { class: 'notice' + (n.pinned ? ' pinned' : ''), onclick: compact ? function () { L.go({ name: 'news' }); } : null, style: compact ? { cursor: 'pointer' } : null },
      h('div', { class: 'row' }, n.pinned ? ic('Pin', 14, 'accent') : null, h('span', { class: 'hi semi grow', style: { fontSize: '15px' } }, n.title),
        leader && !compact ? [U.iconBtn(n.pinned ? 'PinOff' : 'Pin', n.pinned ? 'Desafixar' : 'Fixar no topo', function () {
          L.run(async function () { L.must(await sb.from('announcements').update({ pinned: !n.pinned }).eq('id', n.id)); await D.reloadAnnouncements(); L.render(); });
        }, { color: 'var(--muted)' }), U.iconBtn('Trash2', 'Apagar aviso', function () {
          L.confirm('Apagar aviso?', null, 'Apagar', function () {
            L.run(async function () { L.must(await sb.from('announcements').delete().eq('id', n.id)); await D.reloadAnnouncements(); L.render(); });
          }, true);
        }, { color: 'var(--muted)' })] : null),
      n.body ? h('div', { class: 'body', style: compact ? { display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null }, n.body) : null,
      h('div', { class: 'muted tiny' }, [n.author ? L.nameOf(n.author) : null, String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')].filter(Boolean).join(' · ')));
  };

  function noticeDialog() {
    var st = { title: '', body: '', pinned: false };
    L.dialog({
      sticky: true, title: 'Aviso para a banda',
      body: function () {
        return [U.field('', 'Título', function (v) { st.title = v.slice(0, 100); }, { max: 100 }),
          U.field('', 'Texto (opcional)', function (v) { st.body = v.slice(0, 2000); }, { multiline: true, rows: 3, max: 2000 }),
          U.switchRow('Fixar no topo', 'Fica em cima no Início até você desafixar', false, function (v) { st.pinned = v; })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', onclick: function () {
          if (!st.title.trim()) { L.toast('Escreva um título.'); return; }
          close();
          L.run(async function () {
            L.must(await sb.from('announcements').insert({ org_id: S.current.org.id, title: st.title.trim(), body: st.body.trim() || null, pinned: st.pinned }));
            await D.reloadAnnouncements(); L.toast('Aviso publicado.'); L.render();
          });
        } }, 'Publicar')];
      }
    });
  }
})();
