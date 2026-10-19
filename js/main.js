// Louvor Studio (web para celular) — início: sessão, primeira carga e qual tela mostrar.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, U = L.ui, D = L.data, A = L.auth;

  L.VERSION = '1.10.0';

  /** Antes das abas: apresentação, entrar, carregando, criar banda, "o que você faz". Nulo = abas normais. */
  L.rootView = function () {
    if (!S.booted) return U.spinner();
    if (!S.loggedIn) return S.entry ? A.login() : A.landing();
    if (S.loading && !S.memberships.length) return U.spinner('Carregando a sua banda…');
    if (S.choosingBand && S.memberships.length && !S.current) return A.bandChooser();
    if (!S.current) return A.onboarding();
    if (A.needsFunctions()) return A.functionsPrompt();
    return null;
  };

  // Veio da página de planos ("Começar grátis"): abre direto o criar conta.
  if (/[?&]criar=1/.test(location.search)) {
    S.entry = 'criar';
    history.replaceState(null, '', location.pathname + location.hash);
  }

  var loadedFor = null;
  async function onSession(session) {
    var uid = session && session.user ? session.user.id : null;
    S.booted = true;
    if (!uid) {
      if (S.loggedIn) {
        // Saiu: limpa tudo.
        S.loggedIn = false; S.user = null; S.memberships = []; S.current = null; S.members = []; S.projects = []; S.services = [];
        S.stack = [{ name: 'main' }]; S.tab = 'inicio'; S.viewAsMember = false; S.entry = null; S.choosingBand = false; loadedFor = null;
        if (L.studio) L.studio.stopAll();
      }
      L.render();
      return;
    }
    S.user = session.user;
    S.loggedIn = true;
    if (loadedFor === uid) return;
    loadedFor = uid;
    // Entrou agora pela tela de login (não é só o site abrindo já logado): escolhe a banda primeiro.
    if (S.entry) S.choosingBand = true;
    S.entry = null;
    S.loading = true; // senão a tela de criar banda pisca antes de carregar
    if (A.loginState) A.loginState = null;
    L.render();
    try { await D.refresh(); } catch (e) { L.toast(L.errorText(e)); }
    L.render();
  }

  L.sb.auth.onAuthStateChange(function (event, session) {
    // O Supabase pede para não chamar a API dentro do aviso: agenda para logo depois.
    setTimeout(function () { onSession(session); }, 0);
  });

  // Enquanto o site está aberto, confere mensagens novas a cada 30 s (para os contadores).
  setInterval(function () {
    if (!S.loggedIn || !S.current || document.hidden) return;
    D.refreshMessages().then(function () {
      var r = L.route();
      // Só redesenha nas abas (não atrapalha quem está digitando ou ouvindo).
      // Na aba Conversa não redesenha (a pessoa pode estar digitando; a conversa se atualiza sozinha).
      if (r.name === 'main' && S.tab !== 'conversa' && !document.querySelector('.scrim,.sheetwrap')) L.render();
    });
  }, 30000);

  // Voltou para o site depois de um tempo: atualiza.
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (S.loggedIn && S.current && Date.now() - hiddenAt > 120000 && L.route().name === 'main') {
      D.refresh().then(L.render).catch(function () { /* sem internet */ });
    }
  });

  /** Recarregar tudo (botão de atualizar). */
  L.reload = function () {
    L.run(async function () { await D.refresh(); L.render(); L.toast('Atualizado.'); });
  };

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sem cache offline */ }); });
  }

  history.replaceState({ louvor: 1 }, '');
  L.render();
})();
