// Louvor Studio (web para celular) — apresentação, entrar/criar conta, criar banda ou entrar com convite.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var A = L.auth = {};
  // Entrar com o Google. Interruptor: se o Google bloquear o projeto de novo (aconteceu em 22/10/2026 e foi liberado no mesmo
  // dia), troque para false, suba a versão do site e publique: o botão some e o resto continua igual.
  var GOOGLE_LOGIN = true;

  // A página de entrada (antes de entrar) fica em landing.js.

  // ------------------------------------------------------------------ Entrar / criar conta
  A.login = function () {
    var st = A.loginState = A.loginState || { mode: S.entry === 'entrar' ? 'entrar' : 'criar', email: '', pass: '', name: '', busy: false };
    if (st.confirm) return confirmScreen(st);
    var minPass = st.mode === 'criar' ? L.MIN_PASS : 6;
    var go = h('button', { class: 'btn full' });
    function upd() {
      go.disabled = st.busy || !st.email.trim() || st.pass.length < minPass || (st.mode === 'criar' && !st.name.trim());
      go.textContent = st.busy ? 'Aguarde…' : st.mode === 'entrar' ? 'Entrar' : 'Criar conta';
    }
    go.onclick = submit;
    upd();
    // Entrar com o Google: a pessoa vai até o Google, volta para cá já logada e o perfil usa o nome da conta Google.
    async function google() {
      if (st.busy) return;
      st.busy = true; upd();
      try {
        L.must(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } }));
      } catch (e) {
        st.busy = false; upd();
        L.toast(L.errorText(e));
      }
    }
    async function submit() {
      if (go.disabled) return;
      st.busy = true; upd();
      try {
        if (st.mode === 'entrar') {
          L.must(await sb.auth.signInWithPassword({ email: st.email.trim(), password: st.pass }));
        } else {
          var res = L.must(await sb.auth.signUp({ email: st.email.trim(), password: st.pass, options: { data: { display_name: st.name.trim() } } }));
          // Com a confirmação de e-mail ligada, o Supabase manda um código de 6 números e não entra na hora.
          if (!res.session) { st.confirm = true; st.code = ''; }
        }
      } catch (e) {
        // Conta criada mas e-mail ainda não confirmado: manda um código novo e pede aqui.
        if (/Email not confirmed/i.test((e && e.message) || '')) {
          try { await sb.auth.resend({ type: 'signup', email: st.email.trim() }); } catch (x) { /* o código anterior ainda vale */ }
          st.confirm = true; st.code = '';
        } else L.toast(L.errorText(e));
      } finally {
        st.busy = false;
        if (!S.loggedIn) L.render();
      }
    }
    var sub = st.mode === 'entrar' ? 'Entre com o e-mail e a senha da sua conta.'
      : S.entry === 'convite' ? 'Depois você digita o código de convite que o líder mandou.' : 'Depois você dá um nome para a sua banda e convida o pessoal.';
    return h('div', { class: 'screen authwrap' },
      h('div', { class: 'row' }, U.iconBtn('ChevronLeft', 'Voltar', function () { S.entry = null; A.loginState = null; L.render(); }),
        h('span', { class: 'logo' }, ic('AudioLines', 20)), h('span', { class: 'brand' }, 'Louvor Studio')),
      h('div', { style: { height: '12px' } }),
      U.title(st.mode === 'entrar' ? 'Que bom te ver de novo.' : 'Crie sua conta', sub),
      h('div', { class: 'row' },
        U.toggle('Entrar', st.mode === 'entrar', null, function () { st.mode = 'entrar'; L.render(); }),
        U.toggle('Criar conta', st.mode === 'criar', null, function () { st.mode = 'criar'; L.render(); })),
      GOOGLE_LOGIN ? h('button', { class: 'btn2 full gbtn', type: 'button', onclick: google },
        h('span', { class: 'glogo', html: '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' }), st.mode === 'entrar' ? 'Entrar com o Google' : 'Criar conta com o Google') : null,
      GOOGLE_LOGIN ? h('div', { class: 'ou', 'aria-hidden': 'true' }, h('span', null, 'ou')) : null,
      st.mode === 'criar' ? U.field(st.name, 'Seu nome', function (v) { st.name = v; upd(); }, { autocomplete: 'name', max: 80 }) : null,
      U.field(st.email, 'E-mail', function (v) { st.email = v; upd(); }, { type: 'email', autocomplete: 'email', inputmode: 'email' }),
      U.field(st.pass, st.mode === 'criar' ? 'Senha (mín. ' + L.MIN_PASS + ', com letras e números)' : 'Senha', function (v) { st.pass = v; upd(); }, { type: 'password', autocomplete: st.mode === 'entrar' ? 'current-password' : 'new-password', onenter: submit }),
      go,
      st.mode === 'entrar' ? h('button', { class: 'textbtn', style: { width: '100%' }, onclick: function () { A.forgot(st.email); } }, 'Esqueci minha senha') : null,
      st.mode === 'criar' ? h('p', { class: 'muted small consent' }, 'Ao criar a conta, você concorda com os ',
        h('a', { href: 'termos/', target: '_blank', rel: 'noopener' }, 'Termos de Uso'), ' e com a ',
        h('a', { href: 'privacidade/', target: '_blank', rel: 'noopener' }, 'Política de Privacidade'), '.') : null,
      U.body('Suas gravações de voz são dados pessoais. Só a sua banda pode ouvi-las, e só depois que você grava e o líder libera.', 'var(--muted)', 12));
  };

  /** Confirmar o e-mail do cadastro: código de 6 números (assim ninguém cria conta com o e-mail dos outros). */
  function confirmScreen(st) {
    var go = h('button', { class: 'btn full' });
    function upd() { go.disabled = st.busy || String(st.code || '').length < 6; go.textContent = st.busy ? 'Aguarde…' : 'Confirmar e entrar'; }
    go.onclick = function () {
      if (go.disabled) return;
      st.busy = true; upd();
      L.run(async function () {
        try {
          L.must(await sb.auth.verifyOtp({ email: st.email.trim(), token: String(st.code).trim(), type: 'signup' }));
          A.loginState = null;
          L.toast('E-mail confirmado. Bem-vindo!');
        } finally { st.busy = false; if (!S.loggedIn) { upd(); } }
      });
    };
    upd();
    return h('div', { class: 'screen authwrap' },
      h('div', { class: 'row' }, U.iconBtn('ChevronLeft', 'Voltar', function () { st.confirm = false; L.render(); }),
        h('span', { class: 'logo' }, ic('AudioLines', 20)), h('span', { class: 'brand' }, 'Louvor Studio')),
      h('div', { style: { height: '12px' } }),
      U.title('Confirme seu e-mail', 'Mandamos um código de 6 números para ' + st.email.trim() + '. Olhe também a caixa de spam.'),
      U.field(st.code || '', 'Código do e-mail', function (v) { st.code = v.replace(/\D/g, '').slice(0, 8); upd(); }, { inputmode: 'numeric', autocomplete: 'one-time-code' }),
      go,
      h('button', { class: 'textbtn', style: { width: '100%' }, onclick: function () {
        L.run(async function () { L.must(await sb.auth.resend({ type: 'signup', email: st.email.trim() })); L.toast('Código novo enviado.'); });
      } }, 'Mandar outro código'));
  }

  /** Esqueci a senha: código de 6 números no e-mail, depois a senha nova. */
  A.forgot = function (initial) {
    var st = { email: initial || '', sent: false, code: '', pass: '', busy: false };
    var dlg = L.dialog({
      title: 'Esqueci minha senha', sticky: true,
      body: function () {
        if (!st.sent) return [U.body('Vamos mandar um código de 6 números para o seu e-mail.', null, 13), U.field(st.email, 'E-mail', function (v) { st.email = v; }, { type: 'email' })];
        return [U.body('Mandamos um código para ' + st.email + '. Ele vale por 1 hora. Olhe também a caixa de spam.', null, 13),
          U.field(st.code, 'Código do e-mail', function (v) { st.code = v.replace(/\D/g, '').slice(0, 8); }, { inputmode: 'numeric' }),
          U.field(st.pass, 'Senha nova (mín. ' + L.MIN_PASS + ')', function (v) { st.pass = v; }, { type: 'password', autocomplete: 'new-password' })];
      },
      actions: function (close) {
        return [h('button', { class: 'textbtn muted', onclick: close }, 'Cancelar'),
          h('button', { class: 'textbtn', onclick: function () {
            if (st.busy) return;
            st.busy = true;
            L.run(async function () {
              try {
                if (!st.sent) {
                  L.must(await sb.auth.resetPasswordForEmail(st.email.trim()));
                  st.sent = true; dlg.rebuild();
                } else {
                  if (st.pass.length < L.MIN_PASS) { L.toast('A senha nova precisa ter pelo menos ' + L.MIN_PASS + ' caracteres.'); return; }
                  L.must(await sb.auth.verifyOtp({ email: st.email.trim(), token: st.code.trim(), type: 'recovery' }));
                  L.must(await sb.auth.updateUser({ password: st.pass }));
                  close();
                  L.toast('Senha trocada. Bem-vindo de volta!');
                }
              } finally { st.busy = false; }
            });
          } }, st.sent ? 'Trocar a senha' : 'Mandar código')];
      }
    });
  };

  // ------------------------------------------------------------------ Criar banda ou entrar com código
  A.onboarding = function () {
    var st = A.obState = A.obState || { band: '', code: '' };
    var inviteFirst = S.entry === 'convite' || A.obMode === 'convite';
    var fromChooser = !!A.obMode;
    var createP = U.panel('Criar banda', 'Plus',
      U.field(st.band, 'Nome da banda', function (v) { st.band = v; }, { max: 80 }),
      U.btn('Criar banda', null, function () {
        if (!st.band.trim()) return;
        L.run(async function () {
          var id = L.must(await sb.rpc('create_organization', { _name: st.band.trim() }));
          await A.enterBand(id); L.toast('Banda criada. Você é o líder.');
        });
      }, { full: true }));
    var joinBtn = inviteFirst ? U.btn : U.btn2;
    var joinP = U.panel('Entrar com código', 'Users',
      U.field(st.code, 'Código de convite', function (v) { st.code = v; }),
      joinBtn('Entrar na banda', null, function () {
        if (!st.code.trim()) return;
        L.run(async function () {
          var id = L.must(await sb.rpc('join_organization', { _code: st.code.trim().toLowerCase() }));
          await A.enterBand(id); L.toast('Você entrou na banda.');
        });
      }, { full: true }));
    return h('div', { class: 'screen narrow' },
      fromChooser ? U.topRow(inviteFirst ? 'Entrar numa banda' : 'Nova banda', null, null, function () { A.obMode = null; L.render(); })
        : U.title('Comece pela sua banda', 'Crie a banda (você será o líder) ou entre numa que já existe com o código de convite.'),
      inviteFirst ? [joinP, createP] : [createP, joinP],
      fromChooser ? null : U.btn2('Sair da conta', 'LogOut', function () { A.signOut(); }));
  };

  /** Criou ou entrou numa banda agora: abre ela. */
  A.enterBand = async function (id) {
    if (typeof id === 'string' && id) L.store.set('banda', id.replace(/"/g, ''));
    S.choosingBand = false; A.obMode = null;
    await D.refresh(); L.render();
  };

  // ------------------------------------------------------------------ Escolha a banda (logo depois de entrar na conta)
  A.bandChooser = function () {
    if (A.obMode) return A.onboarding();
    var last = L.store.get('banda', null);
    var bands = S.memberships.slice().sort(function (a, b) { return (a.org.id === last ? 0 : 1) - (b.org.id === last ? 0 : 1) || a.org.name.localeCompare(b.org.name); });
    return h('div', { class: 'screen narrow chooser' },
      h('span', { class: 'logo big' }, ic('AudioLines', 26)),
      h('h1', { class: 'h1' }, 'Escolha a banda'),
      U.body(bands.length === 1 ? 'Toque na sua banda para entrar.' : 'Você está em ' + bands.length + ' bandas. Toque na que quer abrir agora; dá para trocar depois em Eu › Minhas bandas.', 'var(--text)', 15),
      h('div', { class: 'list' }, bands.map(function (b) {
        var parts = b.org.name.trim().split(/\s+/);
        var ini = (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
        var twin = bands.some(function (o) { return o !== b && o.org.name === b.org.name; });
        return h('div', { class: 'li bandpick', role: 'button', tabindex: '0', onclick: function () { pick(b); },
          onkeydown: function (e) { if (e.key === 'Enter') pick(b); } },
          h('span', { class: 'bico', style: { background: U.colorFor(b.org.id) } }, ini),
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'hi semi ell', style: { fontSize: '17px' } }, b.org.name),
            h('div', { class: 'muted small row', style: { gap: '6px' } }, ic(b.role === 'leader' ? 'Crown' : 'Users', 14), b.role === 'leader' ? 'Líder' : 'Integrante',
              twin && b.people ? ' · ' + L.plural(b.people, 'pessoa', 'pessoas') : null,
              b.org.id === last && bands.length > 1 ? h('span', { class: 'accent' }, '· a última que você abriu') : null)),
          ic('ChevronRight', 20, 'muted'));
      })),
      h('h2', { class: 'gtitle' }, 'Outra banda'),
      U.panel(null, null,
        U.menuRow('Plus', 'Criar uma banda', 'Você será o líder e convida o pessoal.', function () { A.obMode = 'criar'; L.render(); }),
        U.menuRow('UserPlus', 'Entrar com código de convite', 'O líder da banda manda o código.', function () { A.obMode = 'convite'; L.render(); })),
      h('button', { class: 'textbtn muted', style: { alignSelf: 'center' }, onclick: function () { A.signOut(); } }, 'Sair da conta'));
  };
  function pick(b) {
    S.choosingBand = false; S.current = b; L.store.set('banda', b.org.id);
    L.render();
    L.run(async function () { S.loading = true; try { await D.loadOrg(); } finally { S.loading = false; } L.render(); });
  }

  /** Logo depois de entrar na banda: "O que você faz?" */
  A.functionsPrompt = function () {
    var chosen = A.fnChosen = A.fnChosen || [];
    return h('div', { class: 'screen' },
      h('div', { style: { height: '16px' } }),
      U.title('O que você faz na banda?', 'Marque tudo o que você faz. Assim, quem monta as escalas já te encontra na função certa.'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, L.FUNCTIONS.map(function (f) {
        var b = U.toggle(f[1], chosen.indexOf(f[0]) >= 0, L.fnIcon(f[0]), function () {
          var i = chosen.indexOf(f[0]); if (i >= 0) chosen.splice(i, 1); else chosen.push(f[0]); L.render();
        });
        b.style.width = '100%';
        return b;
      })),
      U.btn('Pronto', 'Check', function () {
        L.run(async function () {
          L.must(await sb.from('memberships').update({ functions: chosen }).eq('org_id', S.current.org.id).eq('user_id', S.user.id));
          L.store.set('funcoes_perguntadas.' + S.current.org.id, true);
          await D.refresh(); L.toast('Obrigado! Dá para mudar quando quiser em Eu › Meu perfil.'); L.render();
        });
      }, { full: true, disabled: !chosen.length }),
      h('button', { class: 'textbtn muted', style: { width: '100%' }, onclick: function () { L.store.set('funcoes_perguntadas.' + S.current.org.id, true); L.render(); } }, 'Agora não'));
  };

  A.needsFunctions = function () {
    var me = L.me();
    return !!S.current && !!me && !me.functions.length && !L.store.get('funcoes_perguntadas.' + S.current.org.id, false);
  };

  A.signOut = function () {
    sb.auth.signOut();
  };
})();
