// Louvor Studio (web para celular) — o lado "gente" do Início (ui/SocialCards.kt e data/Social.kt):
// aniversário de hoje, aniversários da semana, quem acabou de chegar e os rostos da próxima escala.
// Os botões mandam uma mensagem pronta na conversa da banda, uma vez só (confere na própria conversa).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, sb = L.sb;
  var SC = L.social = {};
  SC.MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIA = 86400000;

  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  /** O aniversário num ano (29/02 cai em 28/02 nos anos que não são bissextos). */
  function birthdayIn(year, day, month) {
    var last = new Date(year, month, 0).getDate();
    return new Date(year, month - 1, Math.min(day, last));
  }
  /** Daqui a quantos dias é o próximo aniversário (0 = hoje); nulo se a pessoa não colocou. */
  SC.daysUntil = function (m, today) {
    if (!m.birth_day || !m.birth_month) return null;
    var t = midnight(today);
    var next = birthdayIn(t.getFullYear(), m.birth_day, m.birth_month);
    if (next < t) next = birthdayIn(t.getFullYear() + 1, m.birth_day, m.birth_month);
    return Math.round((next - t) / DIA);
  };
  SC.today = function (members, today) { return members.filter(function (m) { return SC.daysUntil(m, today) === 0; }); };
  SC.soon = function (members, today, days) {
    days = days || 7;
    return members.map(function (m) { var n = SC.daysUntil(m, today); return n >= 1 && n <= days ? { m: m, n: n } : null; })
      .filter(Boolean).sort(function (a, b) { return a.n - b.n; });
  };
  /** Quem entrou nos últimos dias (menos eu e menos quem já estava quando eu cheguei). */
  SC.newcomers = function (members, me, now, days) {
    days = days || 7;
    var mine = members.find(function (m) { return m.user_id === me; });
    var mineAt = mine && mine.joined_at ? Date.parse(mine.joined_at) : 0;
    return members.filter(function (m) {
      if (!m.joined_at || m.user_id === me) return false;
      var j = Date.parse(m.joined_at);
      return j > now.getTime() - days * DIA && j > mineAt;
    }).sort(function (a, b) { return Date.parse(b.joined_at) - Date.parse(a.joined_at); });
  };
  function first(m) { return (m.name || '').trim().split(' ')[0] || m.name; }

  // "Já mandei?" vale em qualquer aparelho: confere na própria conversa da banda se eu já mandei esta
  // mensagem (desde `since`), além do que este navegador lembra. Antes de enviar, confere no servidor.
  function sentHere(prefix, since) {
    var me = L.uid();
    return S.lastMessages.some(function (m) { return !m.service_id && m.author === me && m.created_at >= since && m.body.indexOf(prefix) === 0; });
  }
  SC.alreadySent = function (key, prefix, since) { return !!L.store.get(key, false) || sentHere(prefix, since); };
  var sending = {};
  function sendOnce(key, prefix, text, since, btn) {
    if (sending[key]) return;
    sending[key] = true;
    btn.disabled = true;
    L.run(async function () {
      try {
        var dup = await sb.from('messages').select('id').eq('org_id', S.current.org.id).eq('author', L.uid()).is('service_id', null)
          .like('body', prefix.replace(/[%_]/g, '') + '%').gte('created_at', since).limit(1);
        if (!dup.error && dup.data && dup.data.length) { L.store.set(key, true); L.toast('Você já tinha mandado essa mensagem.'); L.render(); return; }
        L.must(await sb.from('messages').insert({ org_id: S.current.org.id, service_id: null, body: text }));
        L.store.set(key, true);
        L.toast('Mensagem enviada na conversa da banda.');
        L.data.refreshMessages().then(function () { L.render(); });
        L.render();
      } finally { sending[key] = false; btn.disabled = false; }
    });
  }
  function doneLine(text) { return h('div', { class: 'soc-done' }, ic('CircleCheckBig', 18), text); }

  /** A seção "A banda" do Início; nulo quando não há nada para mostrar. */
  SC.section = function () {
    var me = L.uid(), now = new Date(), year = now.getFullYear(), org = S.current.org.id;
    var today = SC.today(S.members, now).sort(function (a, b) { return (a.user_id === me ? 0 : 1) - (b.user_id === me ? 0 : 1); });
    var soon = SC.soon(S.members, now);
    var news = SC.newcomers(S.members, me, now).slice(0, 2);
    if (!today.length && !soon.length && !news.length) return null;
    var out = [h('h2', { class: 'gtitle' }, 'A banda')];

    today.forEach(function (m) {
      var isMe = m.user_id === me;
      var key = 'parabens.' + org + '.' + m.user_id + '.' + year;
      var action = isMe ? U.body('A banda toda vê o seu aniversário no Início hoje. Que Deus abençoe o seu novo ano!', 'var(--text)', 13)
        : SC.alreadySent(key, 'Feliz aniversário, ' + first(m) + '!', midnight(now).toISOString()) ? doneLine('Você deu parabéns na conversa da banda')
        : (function () {
          var b = U.btn('Dar parabéns para ' + first(m), 'PartyPopper', function () {
            sendOnce(key, 'Feliz aniversário, ' + first(m) + '!', 'Feliz aniversário, ' + first(m) + '! 🎉 Que Deus te abençoe muito. A banda tem alegria de ter você com a gente!', midnight(now).toISOString(), b);
          }, { full: true });
          return b;
        })();
      out.push(h('section', { class: 'soc-bday' },
        h('span', { class: 'confete', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6].map(function (i) { return h('i', { class: 'c' + i }); })),
        h('div', { class: 'row', style: { gap: '14px' } },
          h('span', { class: 'ring' }, U.avatar(m, 50)),
          h('div', { class: 'grow' },
            h('div', { class: 'tag' }, ic('Cake', 15), isMe ? 'Hoje é o seu dia' : 'Hoje é aniversário'),
            h('div', { class: 'nm' }, isMe ? 'Feliz aniversário, ' + first(m) + '!' : m.name))),
        action));
    });

    if (soon.length) {
      out.push(h('section', { class: 'panel soc-soon' },
        h('div', { class: 'row', style: { gap: '8px' } }, ic('Gift', 16, 'festa'), h('span', { class: 'hi semi' }, 'Aniversários da semana')),
        h('div', { class: 'hscroll' }, soon.map(function (x) {
          var d = new Date(now.getTime() + x.n * DIA);
          return h('div', { class: 'soc-chip' }, U.avatar(x.m, 36),
            h('div', null, h('div', { class: 'hi semi' }, first(x.m)),
              h('div', { class: 'muted small' }, x.n === 1 ? 'amanhã' : L.SEMANA_CURTA[(d.getDay() + 6) % 7].toLowerCase() + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'))));
        }))));
    }

    news.forEach(function (m) {
      var key = 'boasvindas.' + org + '.' + m.user_id;
      var days = Math.floor((midnight(now) - midnight(new Date(m.joined_at))) / DIA);
      var what = m.functions.slice(0, 2).map(L.fnLabel).join(', ');
      var b = null;
      var hello = 'Boas-vindas à banda, ' + first(m) + '!';
      var action = SC.alreadySent(key, hello, m.joined_at) ? doneLine('Boas-vindas enviadas')
        : (b = U.btn2('Dar boas-vindas', 'HandHeart', function () { sendOnce(key, hello, hello + ' 👋 Que alegria ter você com a gente.', m.joined_at, b); }, { full: true }));
      out.push(h('section', { class: 'panel soc-new' },
        h('div', { class: 'row', style: { gap: '12px' } },
          h('span', { class: 'newav' }, U.avatar(m, 46), h('i', null, ic('Plus', 12))),
          h('div', { class: 'grow' }, h('div', { class: 'hi semi ell', style: { fontSize: '16px' } }, first(m) + ' chegou na banda'),
            h('div', { class: 'muted small ell' }, [days <= 0 ? 'Hoje' : days === 1 ? 'Ontem' : 'Há ' + days + ' dias', what].filter(Boolean).join(' · ')))),
        action));
    });
    return out;
  };

})();
