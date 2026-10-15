// Louvor Studio (web para celular) — apresentação, entrar/criar conta, criar banda ou entrar com convite.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var A = L.auth = {};

  // ------------------------------------------------------------------ Apresentação (antes de entrar)
  A.landing = function () {
    var canvas = h('canvas', { class: 'wave', 'aria-hidden': 'true' });
    startWave(canvas);
    function feature(icon, title, text) {
      return h('div', { class: 'feature' }, h('span', { class: 'circle' }, ic(icon, 20)),
        h('div', { class: 'col', style: { gap: '3px' } }, h('div', { class: 'hi semi', style: { fontSize: '15px' } }, title), h('div', { class: 'muted', style: { fontSize: '13px', lineHeight: '18px' } }, text)));
    }
    function goEntry(e) { S.entry = e; L.render(); }
    return h('div', { class: 'landing' },
      h('div', { class: 'row' }, h('span', { class: 'logo' }, ic('AudioLines', 20)), h('span', { class: 'brand grow' }, 'LOUVOR STUDIO'),
        U.textBtn('Entrar', function () { goEntry('entrar'); })),
      canvas,
      h('h1', { class: 'hero' }, 'O ensaio da sua banda, em qualquer lugar.'),
      h('p', { class: 'body', style: { fontSize: '15px', lineHeight: '21px' } }, 'Cada um ensaia em casa com a multitrack e chega no culto sabendo a música. As escalas, as músicas e a conversa da banda ficam num lugar só.'),
      feature('Headphones', 'Ensaie com a banda inteira', 'Ouça cada instrumento separado, abaixe ou deixe só o que você precisa.'),
      feature('CalendarDays', 'Escalas sem confusão', 'Quem toca em cada culto, as músicas e o tom do dia. Confirme com um toque.'),
      feature('MessagesSquare', 'A banda conversando', 'A conversa da banda e de cada escala, e os avisos do líder.'),
      U.btn('Criar minha banda', 'Plus', function () { goEntry('criar'); }, { full: true, style: { minHeight: '54px' } }),
      U.btn2('Entrar com convite', 'Users', function () { goEntry('convite'); }, { full: true, style: { minHeight: '52px' } }),
      h('div', { class: 'row', style: { justifyContent: 'center' } }, h('span', { class: 'muted', style: { fontSize: '13px' } }, 'Já tem conta?'),
        U.textBtn('Entrar', function () { goEntry('entrar'); })),
      h('div', { class: 'row muted small', style: { justifyContent: 'center' } }, ic('Smartphone', 14), 'Funciona no navegador do celular. Dá para pôr na tela inicial.'));
  };

  /** Onda de áudio em barras vermelhas (para quieta se o celular pede menos animação). */
  function startWave(canvas) {
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var t0 = performance.now();
    function draw(now) {
      if (!canvas.isConnected && now - t0 > 500) return;
      var w = canvas.clientWidth || 360, hh = canvas.clientHeight || 120;
      var dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
      var g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, hh);
      var phase = still ? 0 : ((now - t0) / 4200) % 1;
      var n = 48, gap = w / n, bw = gap * 0.55, mid = hh / 2, p = phase * 2 * Math.PI;
      for (var i = 0; i < n; i++) {
        var x = i / n;
        var env = Math.pow(Math.sin(x * Math.PI), 2);
        var v = (0.55 * Math.abs(Math.sin(x * 9 - p)) + 0.3 * Math.abs(Math.sin(x * 23 + p * 2)) + 0.15) * env;
        var bh = Math.max(3, v * hh * 0.95);
        g.fillStyle = 'rgba(217,45,54,' + (0.35 + 0.65 * env) + ')';
        var x0 = i * gap + (gap - bw) / 2, y0 = mid - bh / 2, r = bw / 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(x0, y0, bw, bh, r); else g.rect(x0, y0, bw, bh);
        g.fill();
      }
      if (!still) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ------------------------------------------------------------------ Entrar / criar conta
  A.login = function () {
    var st = A.loginState = A.loginState || { mode: S.entry === 'entrar' ? 'entrar' : 'criar', email: '', pass: '', name: '', busy: false };
    var go = h('button', { class: 'btn full' });
    function upd() {
      go.disabled = st.busy || !st.email.trim() || st.pass.length < 6 || (st.mode === 'criar' && !st.name.trim());
      go.textContent = st.busy ? 'Aguarde…' : st.mode === 'entrar' ? 'Entrar' : 'Criar conta';
    }
    go.onclick = submit;
    upd();
    async function submit() {
      if (go.disabled) return;
      st.busy = true; upd();
      try {
        if (st.mode === 'entrar') {
          L.must(await sb.auth.signInWithPassword({ email: st.email.trim(), password: st.pass }));
        } else {
          var res = L.must(await sb.auth.signUp({ email: st.email.trim(), password: st.pass, options: { data: { display_name: st.name.trim() } } }));
          if (!res.session) { L.toast('Conta criada. Confirme seu e-mail e depois entre.'); st.mode = 'entrar'; }
        }
      } catch (e) {
        L.toast(L.errorText(e));
      } finally {
        st.busy = false;
        if (!S.loggedIn) L.render();
      }
    }
    var sub = st.mode === 'entrar' ? 'Entre com o e-mail e a senha da sua conta.'
      : S.entry === 'convite' ? 'Depois você digita o código de convite que o líder mandou.' : 'Depois você dá um nome para a sua banda e convida o pessoal.';
    return h('div', { class: 'screen' },
      h('div', { class: 'row' }, U.iconBtn('ChevronLeft', 'Voltar', function () { S.entry = null; A.loginState = null; L.render(); }),
        h('span', { class: 'logo', style: { width: '36px', height: '36px' } }, ic('AudioLines', 22)), h('span', { class: 'brand', style: { fontSize: '15px' } }, 'LOUVOR STUDIO')),
      h('div', { style: { height: '12px' } }),
      U.title(st.mode === 'entrar' ? 'Que bom te ver de novo.' : 'Crie sua conta', sub),
      h('div', { class: 'row' },
        U.toggle('Entrar', st.mode === 'entrar', null, function () { st.mode = 'entrar'; L.render(); }),
        U.toggle('Criar conta', st.mode === 'criar', null, function () { st.mode = 'criar'; L.render(); })),
      st.mode === 'criar' ? U.field(st.name, 'Seu nome', function (v) { st.name = v; upd(); }, { autocomplete: 'name', max: 80 }) : null,
      U.field(st.email, 'E-mail', function (v) { st.email = v; upd(); }, { type: 'email', autocomplete: 'email', inputmode: 'email' }),
      U.field(st.pass, 'Senha', function (v) { st.pass = v; upd(); }, { type: 'password', autocomplete: st.mode === 'entrar' ? 'current-password' : 'new-password', onenter: submit }),
      go,
      st.mode === 'entrar' ? h('button', { class: 'textbtn', style: { width: '100%' }, onclick: function () { A.forgot(st.email); } }, 'Esqueci minha senha') : null,
      U.body('Suas gravações de voz são dados pessoais. Só a sua banda pode ouvi-las, e só depois que você grava e o líder libera.', 'var(--muted)', 12));
  };

  /** Esqueci a senha: código de 6 números no e-mail, depois a senha nova. */
  A.forgot = function (initial) {
    var st = { email: initial || '', sent: false, code: '', pass: '', busy: false };
    var dlg = L.dialog({
      title: 'Esqueci minha senha', sticky: true,
      body: function () {
        if (!st.sent) return [U.body('Vamos mandar um código de 6 números para o seu e-mail.', null, 13), U.field(st.email, 'E-mail', function (v) { st.email = v; }, { type: 'email' })];
        return [U.body('Mandamos um código para ' + st.email + '. Ele vale por 1 hora. Olhe também a caixa de spam.', null, 13),
          U.field(st.code, 'Código do e-mail', function (v) { st.code = v.replace(/\D/g, '').slice(0, 8); }, { inputmode: 'numeric' }),
          U.field(st.pass, 'Senha nova (mín. 6)', function (v) { st.pass = v; }, { type: 'password', autocomplete: 'new-password' })];
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
    var inviteFirst = S.entry === 'convite';
    var createP = U.panel('Criar banda', 'Plus',
      U.field(st.band, 'Nome da banda', function (v) { st.band = v; }, { max: 80 }),
      U.btn('Criar banda', null, function () {
        if (!st.band.trim()) return;
        L.run(async function () {
          L.must(await sb.rpc('create_organization', { _name: st.band.trim() }));
          await D.refresh(); L.toast('Banda criada. Você é o líder.'); L.render();
        });
      }, { full: true }));
    var joinBtn = inviteFirst ? U.btn : U.btn2;
    var joinP = U.panel('Entrar com código', 'Users',
      U.field(st.code, 'Código de convite', function (v) { st.code = v; }),
      joinBtn('Entrar na banda', null, function () {
        if (!st.code.trim()) return;
        L.run(async function () {
          L.must(await sb.rpc('join_organization', { _code: st.code.trim().toLowerCase() }));
          await D.refresh(); L.toast('Você entrou na banda.'); L.render();
        });
      }, { full: true }));
    return h('div', { class: 'screen' },
      U.title('Comece pela sua banda', 'Crie a banda (você será o líder) ou entre numa que já existe com o código de convite.'),
      inviteFirst ? [joinP, createP] : [createP, joinP],
      U.btn2('Sair da conta', 'LogOut', function () { A.signOut(); }));
  };

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
