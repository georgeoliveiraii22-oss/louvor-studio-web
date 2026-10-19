// Louvor Studio (web para celular) — aba Eu e Meu perfil (ui/MeScreens.kt e ui/BandScreens.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;

  L.screen('tab-eu', function () {
    var me = L.me();
    var root = h('div', { class: 'screen narrow' },
      h('div', { class: 'tabhead' }, h('h1', { class: 'h1 t' }, 'Eu')),
      U.clickRow(function () { L.go({ name: 'profile' }); }, U.avatar(me, 56),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi', style: { fontSize: '17px' } }, me ? me.name : 'Meu perfil'),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, me && me.functions.length ? me.functions.map(L.fnLabel).join(', ') : 'Toque para colocar foto e o que você faz na banda')),
        ic('ChevronRight', 18, 'muted')));

    root.appendChild(U.panel('Escalas', 'CalendarDays',
      U.menuRow('CalendarX', 'Dias que não posso', 'Marque para quem monta a escala já saber', function () { L.go({ name: 'availability' }); })));

    if (S.memberships.length > 1) {
      root.appendChild(U.panel('Minhas bandas', 'Users', h('div', { class: 'row wrap' }, S.memberships.map(function (b) {
        var twin = S.memberships.some(function (o) { return o !== b && o.org.name === b.org.name; });
        return U.toggle(b.org.name + (twin && b.people ? ' · ' + L.plural(b.people, 'pessoa', 'pessoas') : ''), b.org.id === S.current.org.id, b.role === 'leader' ? 'Crown' : null, function () {
          if (b.org.id === S.current.org.id) return;
          S.current = b; L.store.set('banda', b.org.id);
          L.run(async function () { await D.loadOrg(); L.render(); });
        });
      }))));
    }

    if (L.perm.extra() || S.viewAsMember) {
      root.appendChild(U.panel('Ver como membro', 'Eye',
        U.switchRow('Ver o app como membro', 'Mostra as telas como um integrante comum vê, sem as opções de líder. Não muda nada para a banda.', S.viewAsMember, function (v) {
          S.viewAsMember = v; L.toast(v ? 'Agora você vê o app como membro.' : 'De volta à sua visão normal.'); L.render();
        })));
    }

    root.appendChild(U.panel('Este site', 'Smartphone',
      U.menuRow('House', 'Pôr na tela inicial', 'Abre como um app, sem a barra do navegador', installHelp),
      U.menuRow('Newspaper', 'Novidades', 'O que tem nesta versão do site', function () { L.go({ name: 'news' }); }),
      U.body('Para gravar a sua voz por cima da multitrack, use o app de Android. Aqui dá para ouvir, ensaiar e cuidar das escalas.', 'var(--muted)', 12)));

    root.appendChild(U.panel('Conta', 'UserRound',
      U.keyValue('E-mail', S.user.email || '—'),
      U.btn2('Sair da conta', 'LogOut', function () { L.auth.signOut(); }, { full: true }),
      U.btn2('Excluir conta', 'Trash2', deleteAccount, { full: true, danger: true })));

    root.appendChild(U.panel('Privacidade', 'ShieldCheck',
      U.body('Suas gravações ficam na nuvem da sua banda. Só você e quem cuida do áudio da banda ouvem uma gravação, até o líder liberar para o ensaio.', 'var(--muted)', 12)));
    root.appendChild(h('div', { class: 'center muted small' }, 'Louvor Studio (web) ' + L.VERSION));
    return root;
  });

  function installHelp() {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (L.installPrompt && !ios) {
      L.installPrompt.prompt();
      L.installPrompt.userChoice.finally(function () { L.installPrompt = null; });
      return;
    }
    L.dialog({
      title: 'Pôr na tela inicial',
      body: function () {
        return ios ? [U.body('No iPhone (Safari):', null, 14), U.body('1. Toque no botão Compartilhar (o quadrado com a seta para cima).\n2. Escolha "Adicionar à Tela de Início".\n3. Toque em Adicionar.', null, 14)]
          : [U.body('No Android (Chrome):', null, 14), U.body('1. Toque nos três pontinhos ⋮ no alto.\n2. Escolha "Instalar app" ou "Adicionar à tela inicial".\n3. Confirme.', null, 14)];
      },
      actions: function (close) { return [h('button', { class: 'textbtn', onclick: close }, 'Entendi')]; }
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); L.installPrompt = e; });

  function deleteAccount() {
    L.dialog({
      title: 'Excluir conta',
      body: function () { return U.body('Sua conta, suas gravações e sua foto são apagadas para sempre. Se você é o único líder de uma banda com mais gente, passe a liderança para alguém antes.', null, 13); },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'), h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, onclick: function () {
          close();
          L.run(async function () {
            var b = await sb.rpc('account_deletion_blocker', {});
            if (b.error) throw b.error;
            if (b.data) { L.toast(String(b.data)); return; }
            var takes = await sb.from('takes').select('file:files(id,object_key,bucket)').eq('user_id', S.user.id);
            await Nuvem.removeMine(sb, (takes.data || []).map(function (t) { return t.file; }));
            var me = L.me();
            if (me && me.avatar_path) await sb.storage.from('avatars').remove([me.avatar_path]);
            L.must(await sb.rpc('delete_my_account', {}));
            await sb.auth.signOut();
            L.toast('Sua conta foi excluída.');
          });
        } }, 'Excluir para sempre')];
      }
    });
  }

  // ------------------------------------------------------------------ Meu perfil
  var P = null;
  L.screen('profile', function () {
    var me = L.me();
    if (!P) P = { name: me ? me.name : '', bio: me && me.bio || '', voice: me && me.voice_type || '', functions: (S.current.functions || (me && me.functions) || []).slice(), pass: '', busy: false };
    var root = h('div', { class: 'screen' },
      U.topRow('Meu perfil', null, null, function () { P = null; L.back(); }),
      h('div', { class: 'row', style: { gap: '16px' } }, U.avatar(me, 84), h('div', { class: 'col' },
        U.btn2(P.busy ? 'Enviando…' : 'Trocar foto', 'Camera', function () {
          U.pickSquareJpeg(320).then(function (blob) {
            if (!blob) return;
            P.busy = true; L.render();
            return L.run(async function () {
              try {
                var path = S.user.id + '/avatar-' + Date.now() + '.jpg';
                L.must(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' }));
                L.must(await sb.from('profiles').update({ avatar_path: path }).eq('id', S.user.id));
                if (me && me.avatar_path) sb.storage.from('avatars').remove([me.avatar_path]);
                await D.refresh(); L.toast('Foto atualizada.');
              } finally { P.busy = false; L.render(); }
            });
          }).catch(function (e) { L.toast(L.errorText(e)); });
        }, { disabled: P.busy }),
        h('div', { class: 'muted small' }, S.user.email))));
    root.appendChild(U.panel('Dados', 'UserRound',
      U.field(P.name, 'Nome', function (v) { P.name = v.slice(0, 80); }, { max: 80 }),
      U.field(P.bio, 'Sobre você', function (v) { P.bio = v.slice(0, 280); }, { multiline: true, rows: 2, max: 280 }),
      U.label('Tipo de voz'),
      h('div', { class: 'row wrap' }, L.VOICES.map(function (v) { return U.toggle(v[0] ? v[1] : '—', P.voice === v[0], null, function () { P.voice = v[0]; L.render(); }); }))));
    root.appendChild(U.panel('Funções na banda', 'Music2',
      U.body('Marque o que você faz. Aparece para a banda toda.', 'var(--muted)', 12),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } }, L.FUNCTIONS.map(function (f) {
        var b = U.toggle(f[1], P.functions.indexOf(f[0]) >= 0, L.fnIcon(f[0]), function () {
          var i = P.functions.indexOf(f[0]); if (i >= 0) P.functions.splice(i, 1); else P.functions.push(f[0]); L.render();
        });
        b.style.width = '100%';
        return b;
      }))));
    root.appendChild(U.btn(P.busy ? 'Salvando…' : 'Salvar perfil', 'Check', function () {
      if (!P.name.trim()) { L.toast('Escreva o seu nome.'); return; }
      P.busy = true; L.render();
      L.run(async function () {
        try {
          L.must(await sb.from('profiles').update({ display_name: P.name.trim(), bio: P.bio.trim() || null, voice_type: P.voice || null }).eq('id', S.user.id));
          L.must(await sb.from('memberships').update({ functions: P.functions }).eq('org_id', S.current.org.id).eq('user_id', S.user.id));
          await D.refresh(); L.toast('Perfil salvo.');
        } finally { P.busy = false; L.render(); }
      });
    }, { full: true, disabled: P.busy }));
    root.appendChild(U.panel('Senha', 'Lock',
      U.field('', 'Nova senha (mín. 6)', function (v) { P.pass = v; }, { type: 'password', autocomplete: 'new-password' }),
      U.btn2('Trocar senha', 'ShieldCheck', function () {
        if (P.pass.length < 6) { L.toast('A senha precisa ter pelo menos 6 caracteres.'); return; }
        L.run(async function () { L.must(await sb.auth.updateUser({ password: P.pass })); P.pass = ''; L.toast('Senha alterada.'); L.render(); });
      })));
    return root;
  });
})();
