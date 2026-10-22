// Louvor Studio (web para celular) — aba Banda (conversas e pessoas), conversa, avisos e novidades (ui/MembersScreen.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var B = { view: 'conversas' };

  L.NEWS = [
    ['1.17.0', [
      'Mais segurança: senha nova com pelo menos 8 caracteres, e a conta nova confirma o e-mail com um código de 6 números (assim ninguém cria conta com o seu e-mail).'
    ]],
    ['1.16.0', [
      'Mensagem lida não volta mais a aparecer como nova, e o que você lê aqui também conta como lido no app (e o contrário).',
      'O número da aba Escalas some depois que você abre a escala. Boas-vindas e parabéns vão uma vez só, de qualquer aparelho.',
      'Repertório: ao adicionar uma música que já existe, aparece o aviso. E dá para escolher várias músicas e apagar de uma vez.'
    ]],
    ['1.15.1', [
      'O painel do líder separado saiu do ar: tudo o que ele fazia está aqui no site e no app.'
    ]],
    ['1.15.0', [
      'Revisão das gravações no site: na ficha da música, "Revisar as gravações da banda" (líder ou quem edita o áudio). Dá para ouvir, aprovar, pedir para refazer, liberar para a banda estudar, marcar a voz e comentar.',
      'Estúdio: o botão Click (para quem edita o áudio) escolhe qual faixa é o click, quando o nome dela não diz "click".'
    ]],
    ['1.14.0', [
      'Partes refeitas: toque numa parte para dar qualquer nome ("Verso 2", "Tag"…), dividir no cursor, juntar com a seguinte, repetir ou apagar. Marcar dentro de uma parte divide ela. Desfazer volta qualquer mudança nas partes.',
      'Detectar partes: a sugestão pode ser corrigida antes de usar (renomear, dividir, juntar, ajustar as pontas).'
    ]],
    ['1.13.2', [
      'Estúdio: o tempo agora fica em cima e as partes embaixo, coladas nas faixas. Com a ferramenta Partes, o líder arrasta as pontas de uma parte para mudar o tamanho, arrasta o meio para mover e toca nela para renomear ou apagar.'
    ]],
    ['1.13.1', [
      'Detectar partes: a sugestão aparece listrada na própria linha do tempo, logo acima dos tempos. E agora funciona também com click sem acento (todos os tics iguais).'
    ]],
    ['1.13.0', [
      'Estúdio › Partes: o líder pode tocar em "Detectar partes automaticamente". O site ouve as faixas e sugere Intro, Verso, Refrão, Ponte…; nada muda até você aplicar, e dá para ajustar à mão depois.'
    ]],
    ['1.12.0', [
      'Faixas em M4A, WAV ou FLAC (e MP3 de bitrate variável) agora são convertidas sozinhas para MP3 320 kbps no envio, sem perder o alinhamento.'
    ]],
    ['1.11.1', [
      'Em Eu › Plano da banda: a situação do pagamento e até quando o plano vale. O líder pode cancelar a assinatura ali mesmo.'
    ]],
    ['1.11.0', [
      'Sair da banda: em Banda, no fim da tela. Você sai das próximas escalas e as suas gravações continuam na banda.',
      'Planos: o botão Assinar abre a cobrança (Pix, boleto ou cartão) e o plano da banda muda sozinho quando o pagamento é confirmado.'
    ]],
    ['1.10.0', [
      'O líder pode remover uma pessoa da banda (Banda › toque na pessoa) e trocar o código de convite.',
      'Funções: "Vocal" saiu; ficaram Ministro(a) de louvor e Backing vocal.'
    ]],
    ['1.9.0', [
      'Aba nova Conversa: a conversa da banda inteira. A aba Banda agora é só das pessoas e do convite.',
      'A conversa de cada escala continua dentro da escala; o cartão da escala avisa quando há mensagem nova.'
    ]],
    ['1.8.0', [
      'O líder pode excluir a banda: Banda › Pessoas › Excluir banda (no fim). Pede para digitar o nome da banda para confirmar.'
    ]],
    ['1.7.3', [
      'Convidar ficou à vista: botão no alto da aba Banda e o código de convite logo no começo de Pessoas.'
    ]],
    ['1.7.2', [
      'Ao entrar na conta, o site mostra "Escolha a banda": toque na sua banda, ou crie uma nova, ou entre com código. A tela de criar banda não pisca mais.'
    ]],
    ['1.7.1', [
      'Novo cartão da próxima escala no Início, no estilo agenda: a data grande, o nome, a hora, o local e os rostos de quem toca com você.'
    ]],
    ['1.7.0', [
      'Gerenciar escalas (em Escalas, para quem monta escala): criar a escala, o mês pela agenda fixa e as equipes num lugar só, e editar várias de uma vez (apagar, hora, local, tipo, lembrar quem não respondeu).',
      'Identidade da igreja: o líder coloca o logo e o papel de parede em Banda › Pessoas.'
    ]],
    ['1.6.0', [
      'Aniversários: coloque o seu em Eu › Meu perfil. No dia, a banda vê no Início e pode te dar parabéns com um toque.',
      'Quem acabou de chegar na banda aparece no Início, com um botão para dar boas-vindas. E o cartão da próxima escala mostra os rostos de quem toca com você.'
    ]],
    ['1.5.1', [
      'Página de entrada: a semana de uma banda como uma multitrack. Cada pessoa é uma faixa, o cursor anda com a rolagem e tudo se junta no culto. E o ícone azul novo na aba do navegador.'
    ]],
    ['1.5.0', [
      'Planos: na página de entrada e em louvorstudio.app.br/planos. Tem plano grátis, e todos os planos têm todos os recursos.',
      'Em Eu, o plano da banda: quantas pessoas, o espaço usado e o botão para ver os planos.'
    ]],
    ['1.4.2', [
      'Mais segurança: os links da música só abrem se forem da web, e o site confere as bibliotecas que carrega.'
    ]],
    ['1.4.1', [
      'Nuvem nova: as multitracks enviadas daqui em diante vão para um armazenamento mais rápido. As antigas continuam funcionando.',
      'Na página de entrada: tem plano grátis para a sua banda começar.'
    ]],
    ['1.4.0', [
      'Estúdio igual ao do app: abre mostrando uns 20 segundos, pinça com dois dedos para o zoom, arrastar anda na música e só o toque parado muda o cursor.',
      'A grade do click aparece nas faixas e na régua (compassos), com o ímã; Repetir: dois toques e arraste.',
      'Escalas: em cada função aparecem só as pessoas que marcaram aquela função no perfil.'
    ]],
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
      U.tabHead('Banda', [(function (b) { b.style.color = 'var(--accent)'; return b; })(U.iconBtn('UserPlus', 'Convidar pessoas', L.openInvite)), U.iconBtn('RefreshCw', 'Atualizar', L.reload)]));
    // A conversa da banda tem aba própria (Conversa); a de cada escala fica dentro da escala.

    // Convidar: primeiro, à vista (antes ficava no fim da lista e ninguém achava)
    root.appendChild(U.panel('Convidar pessoas', 'UserPlus', L.inviteContent()));

    if (L.perm.leader()) root.appendChild(U.body('Toque numa pessoa para mudar as permissões ou remover da banda.', 'var(--muted)', 12));
    root.appendChild(h('div', { class: 'list' }, S.members.map(function (mb) {
      return h('div', { class: 'li', onclick: function () { memberSheet(mb); } }, U.avatar(mb, 42),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, mb.name + (mb.user_id === L.uid() ? ' (você)' : '')),
          h('div', { class: 'muted small ell' }, mb.functions.map(L.fnLabel).join(', ') || 'sem função marcada')),
        mb.role === 'leader' ? U.chip('Líder', 'accent', 'Crown') : mb.can_schedule ? U.chip('Escalas', 'ok', 'CalendarDays') : mb.can_manage_songs ? U.chip('Músicas', 'ok', 'Library') : null);
    })));

    if (m.role === 'leader') root.appendChild(L.igreja.panel());

    var limit = Math.max(1, m.org.storage_limit_bytes || 1073741824);
    var deletePanel = m.role === 'leader' ? U.panel('Excluir banda', 'Trash2',
      U.body('Apaga a banda inteira: músicas, multitracks, gravações, escalas e conversas. As pessoas continuam com a conta delas, só saem da banda.', 'var(--muted)', 12),
      U.btn2('Excluir esta banda', 'Trash2', deleteBand, { full: true, danger: true })) : null;
    var f = S.storageUsed / limit;
    root.appendChild(U.panel('Espaço da banda na nuvem', 'Cloud', U.keyValue('Usado', L.bytes(S.storageUsed) + ' de ' + L.bytes(limit)),
      U.bar(f, f > 0.9 ? 'var(--bad)' : f > 0.75 ? 'var(--warn)' : null)));
    root.appendChild(U.panel('Sair da banda', 'LogOut',
      U.body('Você deixa de ver as músicas, escalas e conversas desta banda e sai das próximas escalas. As suas gravações continuam na banda.', 'var(--muted)', 12),
      U.btn2('Sair desta banda', 'LogOut', leaveBand, { full: true, danger: true })));
    if (deletePanel) root.appendChild(deletePanel);
    return root;
  });

  /** Sair da banda (migração 0026). O único líder recebe a explicação do banco: passar a liderança antes. */
  function leaveBand() {
    var m = S.current, st = { busy: false };
    var next = S.services.filter(function (sv) {
      return sv.starts_on >= L.today() && (sv.people || []).some(function (p) { return p.user_id === L.uid(); });
    }).length;
    return L.dialog({
      title: 'Sair de ' + m.org.name + '?',
      body: function () {
        return [U.body('Você perde o acesso à banda' + (next === 0 ? '' : next === 1 ? ' e sai da próxima escala' : ' e sai das ' + next + ' próximas escalas') +
          '. As suas gravações continuam na banda. Para voltar, peça um código de convite ao líder.', null, 14)];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function (e) {
            if (st.busy) return;
            st.busy = true; e.target.disabled = true; e.target.textContent = 'Saindo…';
            L.run(async function () {
              try {
                L.must(await sb.rpc('leave_organization', { _org: m.org.id }));
                L.store.set('banda', null);
                close();
                S.current = null; S.choosingBand = true; S.stack = [{ name: 'main' }]; S.tab = 'inicio';
                await D.refresh();
                L.toast('Você saiu da banda ' + m.org.name + '.');
                L.render();
              } finally { st.busy = false; e.target.disabled = false; e.target.textContent = 'Sair da banda'; }
            });
          } }, 'Sair da banda')];
      }
    });
  }

  /** Excluir a banda (só o líder): diz o que some e pede para digitar o nome da banda. Migração 0022. */
  function deleteBand() {
    var m = S.current, st = { typed: '', busy: false };
    var others = S.members.filter(function (x) { return x.user_id !== L.uid(); }).length;
    var dlg = L.dialog({
      title: 'Excluir ' + m.org.name + '?',
      live: true,
      body: function () {
        return [
          U.body('Some para sempre: ' + L.plural(S.projects.length, 'música', 'músicas') + ' com as multitracks e gravações, ' + L.plural(S.services.length, 'escala', 'escalas') +
            ', as conversas e o mural.' + (others ? ' ' + L.plural(others, 'pessoa perde', 'pessoas perdem') + ' o acesso à banda.' : ''), null, 14),
          m.org.plan && m.org.plan !== 'free' ? U.body('A banda está num plano pago: a assinatura é cancelada junto e não há novas cobranças.', 'var(--warn)', 13) : null,
          U.body('Para confirmar, digite o nome da banda: ' + m.org.name, 'var(--muted)', 13),
          U.field('', 'Nome da banda', function (v) { st.typed = v; var b = document.getElementById('excluir-ok'); if (b) b.disabled = !match(); }, { max: 80 })
        ];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { id: 'excluir-ok', class: 'textbtn', disabled: true, style: { color: 'var(--bad)' }, onclick: function (e) {
            if (!match() || st.busy) return;
            st.busy = true; e.target.disabled = true; e.target.textContent = 'Excluindo…';
            L.run(async function () {
              try {
                var covers = S.projects.map(function (p) { return p.cover_path; }).filter(Boolean);
                if (covers.length) await sb.storage.from('covers').remove(covers);
                var imgs = [S.church.logoPath, S.church.wallPath].filter(Boolean);
                if (imgs.length) await sb.storage.from('igreja').remove(imgs);
                if (m.org.plan && m.org.plan !== 'free') {
                  try { await sb.functions.invoke((window.LSPlanos && LSPlanos.FN_ASSINAR) || 'smart-processor', { body: { action: 'cancel', org_id: m.org.id } }); } catch (x) { /* segue a exclusão */ }
                }
                L.must(await sb.rpc('delete_organization', { _org: m.org.id, _name: st.typed.trim() }));
                try { await sb.functions.invoke('r2', { body: { action: 'empty_trash' } }); } catch (x) { /* a lixeira espera a função ser atualizada */ }
                L.store.set('banda', null);
                close();
                S.current = null; S.choosingBand = true; S.stack = [{ name: 'main' }]; S.tab = 'inicio';
                await D.refresh();
                L.toast('A banda ' + m.org.name + ' foi excluída.');
                L.render();
              } finally { st.busy = false; }
            });
          } }, 'Excluir para sempre')];
      }
    });
    function match() { return st.typed.trim().toLowerCase() === m.org.name.trim().toLowerCase(); }
    return dlg;
  }

  /** O código de convite com copiar e mandar pelo WhatsApp (aba Banda e a janela de convite). */
  L.inviteContent = function () {
    var m = S.current, code = m.org.invite_code;
    return [
      U.body('Quem tiver este código entra na banda como integrante. Mande pelo WhatsApp ou copie.', 'var(--muted)', 13),
      h('div', { class: 'invitecode' }, h('div', { class: 'grow' }, h('div', { class: 'muted small' }, 'Código de convite'), h('div', { class: 'c' }, code)),
        U.iconBtn('Copy', 'Copiar código', function () { copy(code); L.toast('Código copiado.'); })),
      L.perm.leader() ? h('button', { class: 'textbtn', style: { alignSelf: 'flex-start', fontSize: '13px', padding: '4px 0' }, onclick: function () {
        L.run(async function () { L.must(await sb.rpc('new_invite_code', { _org: S.current.org.id })); await D.refresh(); L.toast('Código de convite trocado. O antigo não vale mais.'); L.render(); });
      } }, 'Trocar o código (o antigo deixa de valer)') : null,
      U.btn('Convidar pelo WhatsApp', 'Share2', function () {
        var text = ['Entre na banda ' + m.org.name + ' no Louvor Studio! 🎶', '', '1. Abra https://louvorstudio.app.br no celular e crie sua conta. Tem plano grátis.',
          '2. Toque em "Entrar com código de convite" e digite o código abaixo.', '', 'Código de convite: ' + code].join('\n');
        if (navigator.share) navigator.share({ text: text }).catch(function () { /* cancelou */ });
        else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
      }, { full: true })];
  };
  L.openInvite = function () {
    L.dialog({
      title: 'Convidar para a banda',
      body: function () { return L.inviteContent(); },
      actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Fechar')]; }
    });
  };

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
            U.switchRow('Líder', 'Pode tudo, inclusive mudar permissões', mb.role === 'leader', function (v) { set({ role: v ? 'leader' : 'member' }, v ? mb.name + ' agora é líder.' : mb.name + ' agora é integrante.', close); }),
            U.btn2('Remover da banda', 'UserMinus', function () { close(); setTimeout(function () { removeMember(mb); }, 60); }, { full: true, danger: true })] : null
        ];
      },
      actions: function (close) { return [h('button', { class: 'textbtn muted', onclick: close }, 'Fechar')]; }
    });
  }

  /** O líder tira a pessoa da banda (e, por padrão, troca o código de convite). Migração 0024. */
  function removeMember(mb) {
    var first = mb.name.split(' ')[0], st = { code: true };
    var next = L.upcoming().filter(function (s) { return s.people.some(function (p) { return p.user_id === mb.user_id; }); }).length;
    L.dialog({
      title: 'Remover ' + first + ' da banda?',
      body: function () {
        return [U.body(first + ' perde o acesso à banda' + (next === 1 ? ' e sai da próxima escala' : next > 1 ? ' e sai das ' + next + ' próximas escalas' : '') + '. As gravações que ' + first + ' fez continuam na banda.', null, 14),
          U.switchRow('Trocar o código de convite', 'Assim ' + first + ' não volta com o código antigo. Quem já está na banda não é afetado.', st.code, function (v) { st.code = v; })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function (e) {
          e.target.disabled = true; e.target.textContent = 'Removendo…';
          L.run(async function () {
            var org = S.current.org.id;
            var r = await sb.rpc('remove_member', { _org: org, _user: mb.user_id });
            if (r.error && /function|não encontrad|schema cache/i.test(r.error.message)) r = await sb.from('memberships').delete().eq('org_id', org).eq('user_id', mb.user_id);
            L.must(r);
            if (st.code) await sb.rpc('new_invite_code', { _org: org });
            close();
            await D.refresh();
            L.toast(first + ' saiu da banda.' + (st.code ? ' O código de convite foi trocado.' : ''));
            L.render();
          });
        } }, 'Remover')];
      }
    });
  }

  // ------------------------------------------------------------------ Conversa
  var C = null; // { ch, msgs, timer, text }
  L.screen('chat', function (r) { return chatView(r.id || null, false); });
  L.screen('tab-conversa', function () { return chatView(null, true); });

  function chatView(serviceId, asTab) {
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
      if (!c.msgs.length) list.appendChild(h('div', { class: 'empty', style: { paddingTop: '40px' } }, service ? 'Nenhuma mensagem ainda. Combine aqui os detalhes desta escala.' : 'A conversa da banda inteira. Nenhuma mensagem ainda: diga um oi!'));
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

    function lastAt() { return c.msgs && c.msgs.length ? c.msgs[c.msgs.length - 1].created_at : null; }
    async function load() {
      try { c.msgs = await D.messages(serviceId); } catch (e) { c.msgs = []; L.toast(L.errorText(e)); }
      D.markRead(ch, lastAt());
      if (C === c) c.paint();
      c.timer = setInterval(async function () {
        var here = asTab ? (L.route().name === 'main' && S.tab === 'conversa') : L.route().name === 'chat';
        if (C !== c || !here) { clearInterval(c.timer); C = null; return; }
        if (document.hidden) return;
        var last = c.msgs.length ? c.msgs[c.msgs.length - 1].created_at : null;
        try {
          var news = await D.messages(serviceId, last);
          var fresh = news.filter(function (n) { return !c.msgs.some(function (x) { return x.id === n.id; }); });
          if (fresh.length) { c.msgs = c.msgs.concat(fresh); D.markRead(ch, lastAt()); c.paint(); }
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
        D.markRead(ch, lastAt());
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
    return h('div', { class: 'chat' + (asTab ? ' astab' : '') },
      asTab ? h('div', { style: { padding: '16px 16px 4px' } }, U.tabHead('Conversa', (function (b) { b.style.color = 'var(--accent)'; return b; })(U.iconBtn('UserPlus', 'Convidar pessoas', L.openInvite))))
        : h('div', { style: { padding: '8px 8px 0' } }, U.topRow(service ? service.title : 'Conversa da banda', service ? L.scheduleLine(service) : 'Todo mundo da banda lê',
          service ? U.iconBtn('CalendarDays', 'Abrir a escala', function () { L.go({ name: 'escala', id: service.id }); }) : null,
          function () { D.markRead(ch, lastAt()); L.back(); })),
      list,
      h('div', { class: 'composer' }, ta, sendBtn));
  }

  /** Segurar a mensagem (como no app): apaga. */
  function holdToDelete(el, fn) {
    var t = null;
    el.addEventListener('touchstart', function () { t = setTimeout(fn, 600); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { el.addEventListener(ev, function () { clearTimeout(t); }, { passive: true }); });
  }

  // ------------------------------------------------------------------ Avisos e novidades
  var N = { tab: 0 };
  L.screen('news', function () {
    if (!N.seen) { N.seen = true; D.markNewsSeen(); D.reloadAnnouncements().then(function () { D.markNewsSeen(); if (L.route().name === 'news') L.render(); }); }
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
