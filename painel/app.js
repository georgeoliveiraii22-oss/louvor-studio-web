// Louvor Studio — painel do líder (web).
// JavaScript puro, sem etapa de compilação. Toda a interface é montada com `h()` (DOM seguro:
// nomes e textos vindos de outras pessoas entram como texto, nunca como HTML).
(function () {
  'use strict';

  var cfg = window.LOUVOR_CONFIG || {};
  var root = document.getElementById('app');
  var sb = null;

  var S = {
    user: null,
    memberships: [],   // { role, can_edit_audio, org }
    org: null,
    role: null,
    canEdit: false,
    members: [],       // { user_id, role, can_edit_audio, name }
    projects: [],
    used: 0,
    tab: 'repertorio',
    projectId: null,
    flash: null        // { kind: 'err'|'ok'|'info', text }
  };

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function h(tag, props) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'disabled') el.disabled = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (Array.isArray(c)) add(c);
        else if (c === null || c === undefined || c === false) return;
        else if (c.nodeType) el.appendChild(c);
        else el.appendChild(document.createTextNode(String(c)));
      });
    })(kids);
    return el;
  }

  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/User already registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar".';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/código de convite inválido/i.test(m)) return 'Código de convite inválido.';
    if (/limite de armazenamento/i.test(m)) return 'O limite de armazenamento da banda foi atingido.';
    if (/row-level security|violates row-level/i.test(m)) return 'Você não tem permissão para fazer isso.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Confira a internet e a Project URL em config.js.';
    if (/(artist|musical_key|bpm).*(does not exist|schema cache)|(does not exist|schema cache).*(artist|musical_key|bpm)/i.test(m)) {
      return 'Para salvar artista, tom e BPM, rode a migração 0004_song_info.sql no SQL Editor do Supabase.';
    }
    if (/(functions|avatar_path|voice_type|bio).*(does not exist|schema cache)|(does not exist|schema cache).*(functions|avatar_path|voice_type|bio)|Bucket not found/i.test(m)) {
      return 'Para usar foto, funções e naipe, rode a migração 0005_profiles_functions.sql no SQL Editor do Supabase.';
    }
    if (/lyrics.*(does not exist|schema cache)|(does not exist|schema cache).*lyrics/i.test(m)) {
      return 'Para salvar a letra, falta rodar a migração 0015 no Supabase.';
    }
    if (/(band_key|time_signature|version_url|chart_url|leader_note|services|service_songs|start_ms).*(does not exist|schema cache)|(does not exist|schema cache).*(band_key|time_signature|version_url|chart_url|leader_note|services|service_songs|start_ms)/i.test(m)) {
      return 'Para usar a ficha da música e a agenda, rode a migração 0010_song_details_agenda.sql no SQL Editor do Supabase.';
    }
    if (/projects_details_valid/i.test(m)) return 'Confira a ficha: o link precisa começar com https:// e o compasso é como 4/4 ou 6/8.';
    if (/pelo menos um líder/i.test(m)) return 'A banda precisa de pelo menos um líder. Promova outra pessoa antes.';
    if (/só pode alterar as suas funções/i.test(m)) return 'Você só pode alterar as suas funções. Papel e permissões são com o líder.';
    return m;
  }

  function flash(kind, text) { S.flash = { kind: kind, text: text }; }

  function fmtBytes(n) {
    if (n >= 1073741824) return (n / 1073741824).toFixed(1).replace('.', ',') + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  function fmtTime(ms) {
    if (!ms) return '—'; // música sem multitrack (só link, tom e BPM)
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function nameOf(userId) {
    var m = S.members.find(function (x) { return x.user_id === userId; });
    return m ? m.name : 'Alguém';
  }

  function sha256Hex(buf) {
    return crypto.subtle.digest('SHA-256', buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var x = Array.prototype.map.call(b, function (v) { return v.toString(16).padStart(2, '0'); }).join('');
    return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
  }

  // ---------------------------------------------------------------------------
  // Dados
  // ---------------------------------------------------------------------------
  function must(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  // Usado pelo estúdio do líder (studio.js).
  window.LouvorApp = {
    h: h, must: must, friendly: friendly, flash: flash, fmtTime: fmtTime, fmtDate: fmtDate, nameOf: nameOf,
    rerender: function () { render(); },
    refresh: function () { return refresh(); },
    go: function (tabId) {
      if (tabId !== 'estudio' && window.LeaderStudio) window.LeaderStudio.stop();
      if (window.ProfilePage) window.ProfilePage.reset();
      S.tab = tabId;
      S.projectId = null;
      render();
    },
    openStudio: function (projectId, autoplay) {
      if (window.LeaderStudio) window.LeaderStudio.open(projectId, autoplay);
      S.tab = 'estudio';
      S.projectId = null;
      render();
    },
    state: function () { return S; },
    client: function () { return sb; }
  };

  // Adiciona e edita músicas: o líder ou quem ele liberou (migração 0013).
  function canSongs() { return S.role === 'leader' || !!S.canManageSongs; }

  function loadMemberships() {
    return sb.from('memberships')
      .select('*,org:organizations(id,name,invite_code,storage_limit_bytes,plan)')
      .eq('user_id', S.user.id)
      .then(function (res) {
        S.memberships = must(res).filter(function (m) { return m.org; });
        var saved = null;
        try { saved = localStorage.getItem('louvor.org'); } catch (e) { /* sem armazenamento local */ }
        var pick = S.memberships.find(function (m) { return m.org.id === saved; }) || S.memberships[0] || null;
        S.org = pick ? pick.org : null;
        S.role = pick ? pick.role : null;
        S.canEdit = !!pick && (pick.role === 'leader' || pick.can_edit_audio);
        S.canSchedule = !!pick && (pick.role === 'leader' || !!pick.can_schedule);
        S.canManageSongs = !!pick && (pick.role === 'leader' || !!pick.can_manage_songs);
      });
  }

  function loadOrgData() {
    if (!S.org) return Promise.resolve();
    // select('*') para funcionar antes e depois da migração 0005 (funções, foto, naipe, bio).
    return Promise.all([
      sb.from('memberships').select('*').eq('org_id', S.org.id),
      sb.from('projects').select('*').eq('org_id', S.org.id).order('created_at', { ascending: false }),
      sb.rpc('org_storage_used', { _org: S.org.id })
    ]).then(function (r) {
      var ms = must(r[0]);
      S.projects = must(r[1]);
      S.used = Number(must(r[2])) || 0;
      return sb.from('profiles').select('*').in('id', ms.map(function (m) { return m.user_id; }))
        .then(function (pr) {
          var byId = {};
          must(pr).forEach(function (p) { byId[p.id] = p; });
          S.members = ms.map(function (m) {
            var p = byId[m.user_id] || {};
            return {
              user_id: m.user_id, role: m.role, can_edit_audio: m.can_edit_audio, can_schedule: !!m.can_schedule, has_schedule_col: 'can_schedule' in m,
              can_manage_songs: !!m.can_manage_songs, has_songs_col: 'can_manage_songs' in m,
              functions: m.functions || [], name: p.display_name || 'Integrante',
              avatar_path: p.avatar_path || null, voice_type: p.voice_type || null, bio: p.bio || null, avatar_url: null
            };
          }).sort(function (a, b) { return (a.role === 'leader' ? 0 : 1) - (b.role === 'leader' ? 0 : 1) || a.name.localeCompare(b.name); });
          return loadAvatars();
        });
    });
  }

  // Fotos ficam num bucket privado: gera links temporários para quem é da banda.
  function loadAvatars() {
    var paths = S.members.map(function (m) { return m.avatar_path; }).filter(Boolean);
    if (!paths.length) return Promise.resolve();
    return sb.storage.from('avatars').createSignedUrls(paths, 3600).then(function (res) {
      if (res.error || !res.data) return; // sem foto não é erro: mostra as iniciais
      var urls = {};
      res.data.forEach(function (d) { if (d.signedUrl) urls[d.path] = d.signedUrl; });
      S.members.forEach(function (m) { if (m.avatar_path) m.avatar_url = urls[m.avatar_path] || null; });
    }, function () { /* idem */ });
  }

  function refresh() {
    return loadMemberships().then(loadOrgData);
  }

  // ---------------------------------------------------------------------------
  // Telas
  // ---------------------------------------------------------------------------
  function logo() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '34'); svg.setAttribute('height', '34'); svg.setAttribute('viewBox', '0 0 44 44');
    svg.innerHTML = '<rect width="44" height="44" rx="12" fill="#D92D36"/><g fill="#fff"><rect x="9" y="19" width="4" height="6" rx="2"/><rect x="15.5" y="13" width="4" height="18" rx="2"/><rect x="22" y="9" width="4" height="26" rx="2"/><rect x="28.5" y="15" width="4" height="14" rx="2"/><rect x="35" y="20" width="2.5" height="4" rx="1.25"/></g>';
    return svg;
  }

  function flashNode() {
    if (!S.flash) return null;
    var f = S.flash;
    return h('div', { class: 'msg ' + f.kind, role: 'status' }, f.text);
  }

  function mount(node) {
    root.innerHTML = '';
    root.appendChild(node);
  }

  function renderConfigMissing() {
    mount(h('div', { class: 'auth' },
      h('h1', null, 'Falta configurar o painel'),
      h('p', { class: 'mu' }, 'Abra o arquivo web/config.js e cole a Project URL do seu projeto Supabase (Project Settings > API), por exemplo https://abcdefghij.supabase.co. Depois recarregue esta página.')
    ));
  }

  // Login e cadastro -------------------------------------------------------------
  var authMode = 'entrar';

  function renderAuth() {
    var email = h('input', { type: 'email', id: 'em', autocomplete: 'email', required: true });
    var pass = h('input', { type: 'password', id: 'pw', autocomplete: authMode === 'entrar' ? 'current-password' : 'new-password', required: true });
    var nameInput = h('input', { type: 'text', id: 'nm', autocomplete: 'name', maxlength: '80' });
    var submit = h('button', { class: 'btn', type: 'submit' }, authMode === 'entrar' ? 'Entrar' : 'Criar conta');

    var form = h('form', { class: 'stack', onsubmit: function (ev) {
      ev.preventDefault();
      submit.disabled = true;
      var p = authMode === 'entrar'
        ? sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value })
        : sb.auth.signUp({ email: email.value.trim(), password: pass.value, options: { data: { display_name: nameInput.value.trim() } } });
      p.then(function (res) {
        if (res.error) throw res.error;
        if (authMode === 'criar' && !res.data.session) {
          flash('info', 'Conta criada. Confirme seu e-mail para entrar.');
          authMode = 'entrar';
          renderAuth();
        }
      }).catch(function (e) {
        flash('err', friendly(e));
        renderAuth();
      });
    } },
      authMode === 'criar' ? h('label', { class: 'f', for: 'nm' }, 'Seu nome', nameInput) : null,
      h('label', { class: 'f', for: 'em' }, 'E-mail', email),
      h('label', { class: 'f', for: 'pw' }, 'Senha', pass),
      submit,
      authMode === 'entrar' ? h('button', { class: 'btn sec2', type: 'button', onclick: function () { renderForgot(email.value.trim()); } }, 'Esqueci minha senha') : null
    );

    mount(h('div', { class: 'auth' },
      h('div', { class: 'brand', style: 'margin-bottom:28px' }, logo(), 'Louvor Studio'),
      h('h1', null, 'Painel do líder'),
      h('p', { class: 'mu', style: 'margin:0 0 20px' }, 'Gerencie a banda, envie multitracks e revise as gravações.'),
      h('div', { class: 'seg', role: 'tablist' },
        h('button', { class: authMode === 'entrar' ? 'on' : '', onclick: function () { authMode = 'entrar'; S.flash = null; renderAuth(); } }, 'Entrar'),
        h('button', { class: authMode === 'criar' ? 'on' : '', onclick: function () { authMode = 'criar'; S.flash = null; renderAuth(); } }, 'Criar conta')
      ),
      flashNode(),
      form
    ));
    S.flash = null;
  }

  // Esqueci a senha: código de 6 números no e-mail, digitado aqui com a senha nova.
  function renderForgot(prefill) {
    var email = h('input', { type: 'email', id: 'rem', autocomplete: 'email', required: true, value: prefill || '' });
    var code = h('input', { type: 'text', id: 'rcode', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8' });
    var pass = h('input', { type: 'password', id: 'rpw', autocomplete: 'new-password', minlength: '6' });
    var step2 = h('div', { class: 'stack', style: 'display:none' },
      h('p', { class: 'mu', style: 'margin:0' }, 'Mandamos um código para o seu e-mail (vale por 1 hora; olhe também o spam).'),
      h('label', { class: 'f', for: 'rcode' }, 'Código do e-mail', code),
      h('label', { class: 'f', for: 'rpw' }, 'Senha nova (mín. 6)', pass));
    var submit = h('button', { class: 'btn', type: 'submit' }, 'Mandar código');
    var sent = false;
    var form = h('form', { class: 'stack', onsubmit: function (ev) {
      ev.preventDefault();
      submit.disabled = true;
      var p = !sent
        ? sb.auth.resetPasswordForEmail(email.value.trim())
        : sb.auth.verifyOtp({ email: email.value.trim(), token: code.value.trim(), type: 'recovery' }).then(function (res) {
          if (res.error) throw res.error;
          return sb.auth.updateUser({ password: pass.value });
        });
      p.then(function (res) {
        if (res && res.error) throw res.error;
        if (!sent) {
          sent = true;
          step2.style.display = '';
          email.readOnly = true;
          submit.textContent = 'Trocar a senha';
          submit.disabled = false;
        } else {
          flash('ok', 'Senha trocada.');
        }
      }).catch(function (e) {
        submit.disabled = false;
        var m = String((e && e.message) || e);
        alertBox.textContent = /expired|invalid/i.test(m) ? 'Código errado ou vencido. Peça um novo.' : friendly(e);
        alertBox.style.display = '';
      });
    } },
      h('label', { class: 'f', for: 'rem' }, 'E-mail', email),
      step2,
      submit,
      h('button', { class: 'btn sec2', type: 'button', onclick: function () { renderAuth(); } }, 'Voltar'));
    var alertBox = h('div', { class: 'msg err', role: 'status', style: 'display:none' });
    mount(h('div', { class: 'auth' },
      h('div', { class: 'brand', style: 'margin-bottom:28px' }, logo(), 'Louvor Studio'),
      h('h1', null, 'Esqueci minha senha'),
      h('p', { class: 'mu', style: 'margin:0 0 20px' }, 'Vamos mandar um código de 6 números para o seu e-mail.'),
      alertBox,
      form));
  }

  // Sem banda ---------------------------------------------------------------------
  function renderOnboarding() {
    var bandName = h('input', { type: 'text', maxlength: '80', required: true });
    var code = h('input', { type: 'text', required: true, autocomplete: 'off' });

    function doCreate(ev) {
      ev.preventDefault();
      sb.rpc('create_organization', { _name: bandName.value.trim() }).then(function (res) {
        if (res.error) throw res.error;
        return refresh();
      }).then(function () { flash('ok', 'Banda criada. Você é o líder.'); render(); })
        .catch(function (e) { flash('err', friendly(e)); render(); });
    }

    function doJoin(ev) {
      ev.preventDefault();
      sb.rpc('join_organization', { _code: code.value }).then(function (res) {
        if (res.error) throw res.error;
        return refresh();
      }).then(function () { flash('ok', 'Você entrou na banda.'); render(); })
        .catch(function (e) { flash('err', friendly(e)); render(); });
    }

    mount(h('div', { class: 'wrap' }, topBar(),
      h('h1', null, 'Comece pela sua banda'),
      h('p', { class: 'mu' }, 'Crie a banda (você será o líder) ou entre numa que já existe com o código de convite.'),
      flashNode(),
      h('div', { class: 'grid' },
        h('form', { class: 'card stack', onsubmit: doCreate },
          h('h2', null, 'Criar banda'),
          h('label', { class: 'f' }, 'Nome da banda', bandName),
          h('button', { class: 'btn', type: 'submit' }, 'Criar banda')
        ),
        h('form', { class: 'card stack', onsubmit: doJoin },
          h('h2', null, 'Entrar com código'),
          h('label', { class: 'f' }, 'Código de convite', code),
          h('button', { class: 'btn sec2', type: 'submit' }, 'Entrar na banda')
        )
      )
    ));
    S.flash = null;
  }

  function topBar() {
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, logo(), 'Louvor Studio'),
      S.org ? h('span', { class: 'top-band', 'data-hint': 'Banda ativa.' }, S.org.name) : null,
      h('span', { class: 'sp' }),
      meButton(),
      h('button', { class: 'btn sec2 sm icon-only', 'aria-label': 'Sair', title: 'Sair', 'data-hint': 'Sair da conta neste navegador.', onclick: function () { sb.auth.signOut(); } },
        Icons.icon('logout', 15), h('span', { class: 'vh' }, 'Sair'))
    );
  }

  function meButton() {
    if (!S.user) return null;
    var me = S.org && S.members.find(function (m) { return m.user_id === S.user.id; });
    if (!me || !window.ProfilePage) return h('span', { class: 'who' }, S.user.email);
    return h('button', { class: 'me-btn', title: 'Meu perfil', onclick: function () { window.LouvorApp.go('perfil'); } },
      window.ProfilePage.avatar(me, 30), h('span', null, me.name));
  }

  // Estrutura: barra de cima, navegação lateral agrupada e barra de informações -----
  var NAV = [
    { label: 'Música', items: [['repertorio', 'Repertório', 'Todas as músicas da banda, com busca.'], ['estudio', 'Estúdio', 'Ouvir, ensaiar e (com permissão) editar as faixas.'],
      ['agenda', 'Escalas', 'Cultos, ensaios e eventos: músicas, pessoas, dia e hora.'], ['mural', 'Mural', 'Avisos do líder para a banda.'], ['projetos', 'Projetos', 'Criar músicas e enviar a multitrack.'], ['revisao', 'Revisão', 'Ouvir, aprovar e liberar as tomadas.'], ['exportar', 'Exportar', 'Baixar a mix ou as faixas em WAV.']] },
    { label: 'Banda', items: [['equipe', 'Equipe', 'Integrantes, funções, papéis e permissões.'], ['banda', 'Banda e plano', 'Nome, armazenamento, convite e plano.']] },
    { label: 'Conta', items: [['perfil', 'Meu perfil', 'Foto, nome, naipe e funções.'], ['ajustes', 'Ajustes', 'Senha, privacidade e sessão.']] },
    { label: 'Celular', items: [['app', 'App (prévia)', 'Como ficam as telas do app do celular (demonstração).']] }
  ];

  // Menu lateral: por padrão só ícones (como um trilho); o botão de baixo mostra os nomes.
  var navWide = false;
  try { navWide = localStorage.getItem('louvor.navWide') === '1'; } catch (e) { /* sem armazenamento local */ }

  function renderShell(content) {
    function item(entry) {
      var id = entry[0];
      return h('button', {
        class: 'nav-item' + (S.tab === id ? ' on' : ''), 'aria-current': S.tab === id ? 'page' : null,
        'data-hint': entry[1] + ': ' + entry[2], title: navWide ? null : entry[1],
        onclick: function () {
          if (id !== 'estudio' && window.LeaderStudio) window.LeaderStudio.stop();
          if (window.ProfilePage) window.ProfilePage.reset();
          S.tab = id; S.projectId = null; S.flash = null; render();
        }
      }, Icons.icon(id, 18), h('span', { class: 'nav-label' }, entry[1]));
    }
    var toggle = h('button', { class: 'nav-item nav-toggle', 'data-hint': navWide ? 'Esconder os nomes do menu.' : 'Mostrar os nomes do menu.',
      'aria-label': navWide ? 'Esconder os nomes do menu' : 'Mostrar os nomes do menu', onclick: function () {
        navWide = !navWide;
        try { localStorage.setItem('louvor.navWide', navWide ? '1' : '0'); } catch (e) { /* idem */ }
        render();
      } }, Icons.icon(navWide ? 'menuClose' : 'menuOpen', 18), h('span', { class: 'nav-label' }, 'Recolher menu'));
    var info = h('div', { class: 'infobar', 'aria-live': 'polite' }, defaultHint());
    var shell = h('div', { class: 'shell' + (navWide ? ' nav-wide' : '') },
      topBar(),
      h('div', { class: 'shell-body' },
        h('nav', { class: 'side', 'aria-label': 'Navegação' }, NAV.map(function (g) {
          return h('div', { class: 'side-group' }, h('span', { class: 'side-label' }, g.label), g.items.map(item));
        }), h('span', { class: 'side-fill' }), toggle),
        h('main', { class: 'main' }, flashNode(), content)
      ),
      info
    );
    shell.addEventListener('mouseover', function (ev) {
      var hinted = ev.target.closest && ev.target.closest('[data-hint]');
      info.textContent = hinted ? hinted.getAttribute('data-hint') : defaultHint();
    });
    mount(shell);
    S.flash = null;
  }

  function defaultHint() {
    return S.org ? 'Louvor Studio · ' + S.org.name + ' · passe o mouse sobre um controle para ver o que ele faz.' : 'Louvor Studio';
  }

  // Projetos -----------------------------------------------------------------------
  function storageCard() {
    var limit = S.org.storage_limit_bytes;
    var pct = Math.min(100, Math.round((S.used / limit) * 100));
    return h('div', { class: 'card' },
      h('div', { class: 'row sp-b' },
        h('span', { class: 'sec', style: 'margin:0' }, 'Armazenamento da banda'),
        h('span', { class: 'mono' }, fmtBytes(S.used) + ' de ' + fmtBytes(limit))
      ),
      h('div', { class: 'bar', style: 'margin-top:10px' }, h('i', { style: 'width:' + pct + '%' }))
    );
  }

  function renderProjects() {
    var list = S.projects.length
      ? h('div', { class: 'grid' }, S.projects.map(function (p) {
          return h('button', { class: 'card', style: 'text-align:left;cursor:pointer;margin:0', onclick: function () { S.projectId = p.id; render(); } },
            h('div', { class: 'row', style: 'gap:8px;flex-wrap:nowrap' }, Icons.icon('list', 16, 'ic-mu'),
              h('span', { style: 'font:600 14px var(--fd);color:var(--tx-hi)' }, p.name)),
            h('div', { class: 'mu', style: 'margin-left:24px' }, p.song_title),
            h('div', { class: 'row', style: 'margin-top:10px' },
              h('span', { class: 'chip' }, Icons.icon('time', 12), fmtTime(p.session_duration_ms)),
              p.sample_rate ? h('span', { class: 'chip' }, Icons.icon('file', 12), (p.sample_rate / 1000).toString().replace('.', ',') + ' kHz')
                : h('span', { class: 'chip' }, 'Sem multitrack')
            )
          );
        }))
      : h('p', { class: 'mu' }, 'Nenhum projeto ainda.' + (canSongs() ? ' Crie o primeiro abaixo.' : ''));

    return h('div', null,
      h('h1', null, 'Projetos'),
      h('p', { class: 'mu', style: 'margin-top:0' }, 'Cada projeto é uma música com a multitrack da base.'),
      storageCard(),
      list,
      canSongs() ? newProjectForm() : h('p', { class: 'mu', style: 'margin-top:20px' }, 'Só o líder (ou quem ele liberar) cria músicas e envia multitracks.')
    );
  }

  function newProjectForm() {
    var name = h('input', { type: 'text', maxlength: '80', required: true });
    var song = h('input', { type: 'text', maxlength: '80', required: true });
    var artist = h('input', { type: 'text', maxlength: '120' });
    var key = h('input', { type: 'text', maxlength: '12', placeholder: 'Ex.: G, Bb, F#m' });
    var bpm = h('input', { type: 'number', min: '20', max: '300', step: '1' });
    var files = h('input', { type: 'file', accept: '.mp3,.m4a,.wav,.flac,.aif,.aiff,.ogg,audio/*', multiple: true, required: true });
    var log = h('div', { class: 'list-log' });
    var go = h('button', { class: 'btn', type: 'submit' }, Icons.icon('upload', 15), 'Criar projeto e enviar stems');

    function say(t) { log.textContent += t + '\n'; }

    function submit(ev) {
      ev.preventDefault();
      go.disabled = true;
      log.textContent = '';
      createProject(name.value.trim(), song.value.trim(), songInfo(artist.value, key.value, bpm.value), Array.prototype.slice.call(files.files), say)
        .then(function (proj) {
          flash('ok', 'Projeto "' + proj.name + '" criado com ' + files.files.length + ' faixas.');
          return refresh();
        }).then(render)
        .catch(function (e) {
          say('✗ ' + friendly(e));
          go.disabled = false;
        });
    }

    return h('form', { class: 'card stack', style: 'margin-top:20px', onsubmit: submit },
      h('h2', null, 'Novo projeto'),
      h('div', { class: 'grid' },
        h('label', { class: 'f' }, 'Nome do projeto', name),
        h('label', { class: 'f' }, 'Título da música', song),
        h('label', { class: 'f' }, 'Artista (opcional)', artist),
        h('div', { class: 'row', style: 'gap:12px;flex-wrap:nowrap' },
          h('label', { class: 'f', style: 'flex:1' }, 'Tom', key),
          h('label', { class: 'f', style: 'flex:1' }, 'BPM', bpm))
      ),
      h('label', { class: 'f' }, 'Stems (MP3, M4A, WAV ou FLAC), de 1 a 12 arquivos', files),
      h('p', { class: 'mu', style: 'margin:0;font-size:13px' }, 'Todos os stems precisam ter a mesma duração. O que não for MP3 de bitrate constante é convertido aqui para MP3 320 kbps antes de enviar (leva alguns minutos).'),
      go, log
    );
  }

  // Artista, tom e BPM só vão para o banco quando preenchidos (assim o envio funciona
  // mesmo antes da migração 0004).
  function songInfo(artist, key, bpm) {
    var info = {};
    if (artist && artist.trim()) info.artist = artist.trim();
    if (key && key.trim()) info.musical_key = key.trim();
    var n = parseInt(bpm, 10);
    if (n >= 20 && n <= 300) info.bpm = n;
    return info;
  }

  function createProject(name, song, info, fileList, say) {
    if (!fileList.length) return Promise.reject(new Error('Escolha ao menos um arquivo MP3.'));
    if (fileList.length > 12) return Promise.reject(new Error('O limite é de 12 faixas por sessão.'));
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Este navegador não permite calcular o checksum. Abra o painel por https ou localhost.'));

    // O que não é MP3 CBR (M4A, WAV, FLAC, MP3 de bitrate variável ou em outra taxa) é convertido aqui.
    var lastPct = -1;
    return Mp3Encode.prepareStems(fileList, { say: function (text, f) {
      var pct = Math.floor(f * 10);
      if (f > 0 && f < 1 && pct === lastPct) return; // no registro, só de 10 em 10%
      lastPct = pct;
      say(text);
    } }).then(function (prep) {
      var sr = prep.sampleRate;
      var items = prep.items.map(function (it) { return { file: { name: it.name, size: it.size }, blob: it.blob, buf: it.buf, scan: it.scan, converted: it.converted }; });
      items.forEach(function (it) { if (it.converted) say('✓ ' + it.file.name + ' convertido para MP3 320 kbps.'); });
      var frames = items.map(function (it) { return it.scan.expectedPcmFrames; });
      var min = Math.min.apply(null, frames);
      var tol = Math.round(sr * 0.05);
      items.forEach(function (it) {
        if (Math.abs(it.scan.expectedPcmFrames - min) > tol) {
          say('⚠ ' + it.file.name + ': duração difere dos demais em ' + Math.round(((it.scan.expectedPcmFrames - min) / sr) * 1000) + ' ms (tolerância 50 ms).');
        }
        if (!it.scan.hasTag || it.scan.encoderDelay === null) say('⚠ ' + it.file.name + ': sem tag LAME; o alinhamento depende de todos os stems virem do mesmo exportador.');
      });

      return sb.from('projects').insert(Object.assign({
        org_id: S.org.id, name: name, song_title: song,
        session_duration_ms: Math.round((min / sr) * 1000), sample_rate: sr, created_by: S.user.id
      }, info)).select().single().then(function (res) {
        var project = must(res);
        say('Projeto criado. Enviando ' + items.length + ' stems…');
        return items.reduce(function (chain, it, i) {
          return chain.then(function () { return uploadStem(project, it, i, say); });
        }, Promise.resolve()).then(function () { return project; }, function (err) {
          // Falhou no meio: remove o projeto parcial (os registros de arquivos saem em cascata).
          return sb.from('projects').delete().eq('id', project.id).then(function () { throw err; });
        });
      });
    });
  }

  function uploadStem(project, it, index, say) {
    var fileId = uuid();
    var key = S.org.id + '/' + project.id + '/stems/' + fileId + '.mp3';
    say('  ' + it.file.name + ': calculando checksum…');
    return sha256Hex(it.buf).then(function (sum) {
      say('  ' + it.file.name + ': enviando…');
      return Nuvem.uploadAudio(sb, {
        id: fileId, org_id: S.org.id, project_id: project.id, object_key: key,
        size_bytes: it.file.size, checksum_sha256: sum, mime: 'audio/mpeg', uploaded_by: S.user.id
      }, it.blob).then(function () {
        return sb.from('tracks').insert({
          project_id: project.id, name: it.file.name.replace(/\.[^.]+$/, ''), type: 'stem',
          source_file_id: fileId, sort_order: index
        });
      }).then(function (res) {
        if (res.error) throw res.error;
        say('  ✓ ' + it.file.name + ' enviado e conferido pelo servidor');
      });
    });
  }

  // Detalhe do projeto -------------------------------------------------------------
  var detail = { tracks: [], parts: [], takes: 0 };

  function loadProjectDetail(pid) {
    return Promise.all([
      sb.from('tracks').select('id,name,type,sort_order,source_file:files(size_bytes,confirmed_at)').eq('project_id', pid).order('sort_order'),
      sb.from('project_parts').select('*').eq('project_id', pid).order('name'),
      sb.from('takes').select('id', { count: 'exact', head: true }).eq('project_id', pid)
    ]).then(function (r) {
      detail.tracks = must(r[0]);
      detail.parts = must(r[1]);
      detail.takes = r[2].count || 0;
    });
  }

  function renderProjectDetail() {
    var p = S.projects.find(function (x) { return x.id === S.projectId; });
    if (!p) { S.projectId = null; return renderProjects(); }

    var partName = h('input', { type: 'text', maxlength: '40', placeholder: 'Ex.: Voz 2' });

    function addPart(ev) {
      ev.preventDefault();
      sb.from('project_parts').insert({ project_id: p.id, name: partName.value.trim(), kind: 'vocal' })
        .then(function (res) { if (res.error) throw res.error; return loadProjectDetail(p.id); })
        .then(render).catch(function (e) { flash('err', friendly(e)); render(); });
    }

    function assign(part, userId) {
      sb.from('project_parts').update({ assigned_user: userId || null }).eq('id', part.id)
        .then(function (res) { if (res.error) throw res.error; return loadProjectDetail(p.id); })
        .then(function () { flash('ok', 'Parte atualizada.'); render(); })
        .catch(function (e) { flash('err', friendly(e)); render(); });
    }

    var infoCard = null;
    if (canSongs()) {
      var fSong = h('input', { type: 'text', maxlength: '80', value: p.song_title || '', required: true });
      var fArtist = h('input', { type: 'text', maxlength: '120', value: p.artist || '' });
      var fKey = h('input', { type: 'text', maxlength: '12', value: p.musical_key || '', placeholder: 'Ex.: G, Bb, F#m' });
      var fBpm = h('input', { type: 'number', min: '20', max: '300', step: '1', value: p.bpm || '' });
      var fBandKey = h('input', { type: 'text', maxlength: '12', value: p.band_key || '', placeholder: 'Ex.: A (se for diferente do original)' });
      var fSig = h('select', null, ['', '4/4', '3/4', '6/8', '2/4', '12/8', '5/4', '7/8'].map(function (v) {
        return h('option', { value: v, selected: (p.time_signature || '') === v }, v || '—');
      }));
      var fVersion = h('input', { type: 'url', maxlength: '500', value: p.version_url || '', placeholder: 'https://youtube.com/… ou https://open.spotify.com/…' });
      var fChart = h('input', { type: 'url', maxlength: '500', value: p.chart_url || '', placeholder: 'https://… (letra ou cifra)' });
      var fNote = h('textarea', { maxlength: '500', rows: '3', placeholder: 'Ex.: subir meio tom no último refrão; todos cantam a ponte.' }, p.leader_note || '');
      var fLyrics = h('textarea', { maxlength: '20000', rows: '10', placeholder: '[Verso]\nPrimeira linha da letra…\n\n[Refrão]\n…' }, p.lyrics || '');
      function urlOrNull(v) {
        v = v.trim();
        if (!v) return null;
        return /^https?:///i.test(v) ? v : 'https://' + v;
      }
      infoCard = h('form', { class: 'card stack', onsubmit: function (ev) {
        ev.preventDefault();
        var info = songInfo(fArtist.value, fKey.value, fBpm.value);
        var patch = Object.assign({ song_title: fSong.value.trim() }, info);
        // Campos apagados viram vazio no banco (só se já existirem as colunas).
        if (!info.artist && p.artist) patch.artist = null;
        if (!info.musical_key && p.musical_key) patch.musical_key = null;
        if (!info.bpm && p.bpm) patch.bpm = null;
        // Ficha (migração 0010): só manda o que mudou, para não quebrar antes da migração.
        var details = { band_key: fBandKey.value.trim() || null, time_signature: fSig.value || null,
          version_url: urlOrNull(fVersion.value), chart_url: urlOrNull(fChart.value), leader_note: fNote.value.trim() || null,
          lyrics: fLyrics.value.trim() || null };
        Object.keys(details).forEach(function (k) { if ((p[k] || null) !== details[k]) patch[k] = details[k]; });
        sb.from('projects').update(patch).eq('id', p.id)
          .then(function (res) { if (res.error) throw res.error; return refresh(); })
          .then(function () { flash('ok', 'Dados da música salvos.'); render(); })
          .catch(function (e) { flash('err', friendly(e)); render(); });
      } },
        h('h2', null, 'Ficha da música (aparece no app de todos)'),
        h('div', { class: 'grid' },
          h('label', { class: 'f' }, 'Título da música', fSong),
          h('label', { class: 'f' }, 'Artista', fArtist),
          h('div', { class: 'row', style: 'gap:12px;flex-wrap:nowrap' },
            h('label', { class: 'f', style: 'flex:1' }, 'Tom original', fKey),
            h('label', { class: 'f', style: 'flex:1' }, 'BPM', fBpm)),
          h('div', { class: 'row', style: 'gap:12px;flex-wrap:nowrap' },
            h('label', { class: 'f', style: 'flex:1', 'data-hint': 'O tom em que a banda toca, se for diferente do original.' }, 'Tom da banda', fBandKey),
            h('label', { class: 'f', style: 'flex:1' }, 'Compasso', fSig)),
          h('label', { class: 'f', 'data-hint': 'Abre direto no YouTube ou no Spotify do celular.' }, 'Link da versão original', fVersion),
          h('label', { class: 'f' }, 'Link da letra ou cifra', fChart)
        ),
        h('label', { class: 'f', 'data-hint': 'Aparece na ficha da música no app de todos da banda.' }, 'Recado do líder para a banda', fNote),
        h('label', { class: 'f', 'data-hint': 'Escreva o nome de cada parte entre colchetes, numa linha só: [Verso], [Refrão]… Com o mesmo nome das partes marcadas, a letra acompanha o estúdio do app.' },
          'Letra (aparece no estúdio do app, acompanhando as partes)', fLyrics),
        h('div', null, h('button', { class: 'btn sec2', type: 'submit' }, 'Salvar dados'))
      );
    }

    return h('div', null,
      h('button', { class: 'btn link', onclick: function () { S.projectId = null; render(); } }, '← Projetos'),
      h('h1', null, p.name),
      h('p', { class: 'mu', style: 'margin-top:0' }, [p.song_title, p.artist, p.session_duration_ms ? fmtTime(p.session_duration_ms) : 'sem multitrack', p.sample_rate ? p.sample_rate + ' Hz' : null].filter(Boolean).join(' · ')),
      infoCard,
      h('div', { class: 'card' },
        h('h2', null, 'Faixas da base (' + detail.tracks.length + ')'),
        detail.tracks.length ? h('table', { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, 'Faixa'), h('th', null, 'Tamanho'), h('th', null, 'Servidor'))),
          h('tbody', null, detail.tracks.map(function (t) {
            var f = t.source_file;
            return h('tr', null,
              h('td', null, h('span', { class: 'row', style: 'gap:8px;flex-wrap:nowrap' }, Icons.icon(Icons.instrumentFor(t.name), 16, 'ic-mu'), t.name)),
              h('td', { class: 'mono' }, f ? fmtBytes(f.size_bytes) : '—'),
              h('td', null, f && f.confirmed_at
                ? h('span', { class: 'chip ok', 'data-hint': 'O servidor conferiu o checksum deste arquivo.' }, Icons.icon('verified', 12), 'Conferido')
                : h('span', { class: 'chip warn' }, Icons.icon('pending', 12), 'Pendente'))
            );
          }))
        ) : h('p', { class: 'mu' }, 'Sem faixas.')
      ),
      h('div', { class: 'card' },
        h('h2', null, 'Partes vocais'),
        detail.parts.length ? h('table', { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, 'Parte'), h('th', null, 'Quem canta'))),
          h('tbody', null, detail.parts.map(function (part) {
            var sel = h('select', { disabled: !canSongs(), onchange: function () { assign(part, sel.value); } },
              h('option', { value: '' }, '— ninguém —'),
              S.members.map(function (m) { return h('option', { value: m.user_id, selected: m.user_id === part.assigned_user }, m.name); })
            );
            return h('tr', null, h('td', null, part.name), h('td', null, sel));
          }))
        ) : h('p', { class: 'mu' }, 'Nenhuma parte ainda.'),
        canSongs() ? h('form', { class: 'row', style: 'margin-top:12px', onsubmit: addPart },
          h('div', { style: 'flex:1;min-width:180px' }, partName),
          h('button', { class: 'btn sec2', type: 'submit' }, Icons.icon('add', 15), 'Adicionar parte')
        ) : null
      ),
      h('div', { class: 'row' },
        h('span', { class: 'chip' }, detail.takes + ' tomadas gravadas'),
        h('button', { class: 'btn', onclick: function () { S.tab = 'revisao'; render(); } }, Icons.icon('revisao', 15), 'Ir para a revisão')
      )
    );
  }

  // Equipe -------------------------------------------------------------------------
  var teamUi = { editing: null, draft: [] };

  function renderTeam() {
    var leaders = S.members.filter(function (m) { return m.role === 'leader'; }).length;
    var P = window.ProfilePage;

    function functionsCell(m) {
      if (teamUi.editing === m.user_id) {
        return h('div', { class: 'stack', style: 'gap:8px' },
          h('div', { class: 'row', style: 'gap:6px' }, P.FUNCTIONS.map(function (f) {
            var on = teamUi.draft.indexOf(f.id) !== -1;
            return h('button', { class: 'rp-chip sm' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () {
              teamUi.draft = on ? teamUi.draft.filter(function (x) { return x !== f.id; }) : teamUi.draft.concat(f.id);
              render();
            } }, Icons.icon(Icons.forFunction(f.id), 12), f.label);
          })),
          h('div', { class: 'row', style: 'gap:8px' },
            h('button', { class: 'btn sm', onclick: function () {
              var list = teamUi.draft;
              teamUi.editing = null;
              update(m, { functions: list }, 'Funções de ' + m.name + ' atualizadas.');
            } }, 'Salvar'),
            h('button', { class: 'btn sec2 sm', onclick: function () { teamUi.editing = null; render(); } }, 'Cancelar')));
      }
      var chips = P.functionChips(m.functions) || h('span', { class: 'mu' }, '—');
      var canEditFns = S.role === 'leader' || m.user_id === S.user.id;
      return h('div', { class: 'row', style: 'gap:8px' }, chips,
        canEditFns ? h('button', { class: 'btn sec2 sm icon-only', title: 'Editar funções', 'aria-label': 'Editar funções de ' + m.name, 'data-hint': 'Editar as funções de ' + m.name + '.',
          onclick: function () { teamUi.editing = m.user_id; teamUi.draft = (m.functions || []).slice(); render(); } }, Icons.icon('edit', 14), h('span', { class: 'vh' }, 'Editar')) : null);
    }

    function update(m, patch, okText) {
      sb.from('memberships').update(patch).eq('org_id', S.org.id).eq('user_id', m.user_id)
        .then(function (res) { if (res.error) throw res.error; return refresh(); })
        .then(function () { flash('ok', okText); render(); })
        .catch(function (e) { flash('err', friendly(e)); render(); });
    }

    var isLeader = S.role === 'leader';
    var code = h('div', { class: 'code' }, S.org.invite_code);

    return h('div', null,
      h('h1', null, 'Equipe'),
      h('p', { class: 'mu', style: 'margin-top:0' }, 'Quem canta, quem lidera e quem pode editar o áudio.'),
      h('div', { class: 'card' },
        h('h2', null, 'Convidar para a banda'),
        h('p', { class: 'mu', style: 'margin-top:0' }, 'Quem tiver este código entra como membro (só grava e ouve). Você decide abaixo quem recebe mais permissões.'),
        h('div', { class: 'row' }, code,
          h('button', { class: 'btn sec2 sm', onclick: function () {
            if (navigator.clipboard) navigator.clipboard.writeText(S.org.invite_code).then(function () { flash('ok', 'Código copiado.'); render(); });
          } }, Icons.icon('copy', 14), 'Copiar'))
      ),
      h('div', { class: 'card' },
        h('h2', null, 'Integrantes (' + S.members.length + ')'),
        h('table', { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, 'Nome'), h('th', null, 'Funções'), h('th', null, 'Papel'), h('th', null, 'Pode editar o áudio'), h('th', null, 'Pode montar escalas'), h('th', null, 'Pode adicionar músicas'))),
          h('tbody', null, S.members.map(function (m) {
            var self = m.user_id === S.user.id;
            var roleSel = h('select', {
              disabled: !isLeader || (m.role === 'leader' && leaders <= 1),
              onchange: function () { update(m, { role: roleSel.value }, 'Papel atualizado.'); }
            },
              h('option', { value: 'leader', selected: m.role === 'leader' }, 'Líder'),
              h('option', { value: 'member', selected: m.role === 'member' }, 'Membro')
            );
            var perm = m.role === 'leader'
              ? h('span', { class: 'chip ok' }, Icons.icon('leader', 12), 'Sempre')
              : h('label', { class: 'row', style: 'gap:8px' },
                  h('input', { type: 'checkbox', class: 'switch', checked: m.can_edit_audio, disabled: !isLeader, 'aria-label': 'Permitir que ' + m.name + ' edite o áudio',
                    onchange: function (ev) { update(m, { can_edit_audio: ev.target.checked }, 'Permissão atualizada.'); } }),
                  m.can_edit_audio ? 'Liberado' : 'Não'
                );
            var sched = m.role === 'leader'
              ? h('span', { class: 'chip ok' }, Icons.icon('leader', 12), 'Sempre')
              : !m.has_schedule_col ? h('span', { class: 'mu', title: 'Rode a migração 0011 no Supabase' }, '—')
              : h('label', { class: 'row', style: 'gap:8px' },
                  h('input', { type: 'checkbox', class: 'switch', checked: m.can_schedule, disabled: !isLeader, 'aria-label': 'Permitir que ' + m.name + ' monte escalas',
                    onchange: function (ev) { update(m, { can_schedule: ev.target.checked }, 'Permissão atualizada.'); } }),
                  m.can_schedule ? 'Liberado' : 'Não'
                );
            var songsPerm = m.role === 'leader'
              ? h('span', { class: 'chip ok' }, Icons.icon('leader', 12), 'Sempre')
              : !m.has_songs_col ? h('span', { class: 'mu', title: 'Rode a migração 0013 no Supabase' }, '—')
              : h('label', { class: 'row', style: 'gap:8px' },
                  h('input', { type: 'checkbox', class: 'switch', checked: m.can_manage_songs, disabled: !isLeader, 'aria-label': 'Permitir que ' + m.name + ' adicione músicas',
                    onchange: function (ev) { update(m, { can_manage_songs: ev.target.checked }, 'Permissão atualizada.'); } }),
                  m.can_manage_songs ? 'Liberado' : 'Não'
                );
            return h('tr', null,
              h('td', null, h('div', { class: 'row', style: 'gap:10px;flex-wrap:nowrap' }, P.avatar(m, 36),
                h('span', null, m.name, self ? h('span', { class: 'mu' }, ' (você)') : null))),
              h('td', null, functionsCell(m)),
              h('td', null, roleSel),
              h('td', null, perm),
              h('td', null, sched),
              h('td', null, songsPerm)
            );
          }))
        ),
        isLeader ? null : h('p', { class: 'mu' }, 'Só o líder altera papéis e permissões.'),
        h('p', { class: 'mu', style: 'font-size:13px;margin-bottom:0' }, 'A banda precisa de pelo menos um líder: o último líder não pode ser rebaixado.')
      )
    );
  }

  // Revisão ------------------------------------------------------------------------
  var rev = { projectId: null, takes: [], comments: {}, urls: {} };

  function loadReview() {
    var pid = rev.projectId;
    if (!pid) { rev.takes = []; return Promise.resolve(); }
    return sb.from('takes').select('*,file:files(id,object_key,size_bytes,bucket)').eq('project_id', pid).order('created_at', { ascending: false })
      .then(function (res) {
        rev.takes = Nuvem.mark(must(res));
        var ids = rev.takes.map(function (t) { return t.id; });
        if (!ids.length) { rev.comments = {}; return; }
        return sb.from('take_comments').select('*').in('take_id', ids).order('created_at')
          .then(function (cr) {
            rev.comments = {};
            must(cr).forEach(function (c) { (rev.comments[c.take_id] = rev.comments[c.take_id] || []).push(c); });
          });
      });
  }

  function renderReview() {
    var projSel = h('select', { onchange: function () { rev.projectId = projSel.value; rev.urls = {}; loadReview().then(render).catch(function (e) { flash('err', friendly(e)); render(); }); } },
      S.projects.map(function (p) { return h('option', { value: p.id, selected: p.id === rev.projectId }, p.name + ' · ' + p.song_title); })
    );

    function act(take, patch, okText) {
      sb.from('takes').update(patch).eq('id', take.id)
        .then(function (res) { if (res.error) throw res.error; return loadReview(); })
        .then(function () { flash('ok', okText); render(); })
        .catch(function (e) { flash('err', friendly(e)); render(); });
    }

    function loadAudio(take) {
      Nuvem.signedUrl(sb, take.file.object_key, 3600).then(function (res) {
        if (res.error) throw res.error;
        rev.urls[take.id] = res.data.signedUrl;
        render();
      }).catch(function (e) { flash('err', friendly(e)); render(); });
    }

    function addComment(take, input) {
      var text = input.value.trim();
      if (!text) return;
      sb.from('take_comments').insert({ take_id: take.id, author: S.user.id, body: text })
        .then(function (res) { if (res.error) throw res.error; return loadReview(); })
        .then(render).catch(function (e) { flash('err', friendly(e)); render(); });
    }

    var cards = rev.takes.map(function (t) {
      var statusChip = t.review_status === 'aprovada' ? h('span', { class: 'chip ok' }, Icons.icon('approved', 12), 'Aprovada')
        : t.review_status === 'refazer' ? h('span', { class: 'chip bad' }, Icons.icon('redo2', 12), 'Refazer') : h('span', { class: 'chip' }, Icons.icon('pending', 12), 'Pendente');
      var input = h('input', { type: 'text', placeholder: 'Comentário', maxlength: '2000' });
      var comments = rev.comments[t.id] || [];
      return h('div', { class: 'card take' },
        h('div', { class: 'row sp-b' },
          h('div', null,
            h('div', { style: 'font:600 14px var(--fd);color:var(--tx-hi)' }, nameOf(t.user_id) + ' · ' + t.name),
            h('div', { class: 'mu', style: 'font-size:13px' }, fmtDate(t.created_at) + ' · ' + fmtTime(t.duration_ms) + ' · ' + t.sample_rate + ' Hz' +
              (t.rtl_ms !== null ? ' · compensação ' + Number(t.rtl_ms).toFixed(1).replace('.', ',') + ' ms' : ' · sem calibração'))
          ),
          h('div', { class: 'row' }, statusChip,
            h('span', { class: 'chip' + (t.voice_part ? '' : ' warn') }, VoiceParts.label(t.voice_part) || 'Voz não marcada'),
            t.released_for_rehearsal
            ? h('span', { class: 'chip go' }, Icons.icon('released', 12), 'Liberada para estudar')
            : h('span', { class: 'chip' }, Icons.icon('lock', 12), 'Só você e a pessoa ouvem'))
        ),
        rev.urls[t.id]
          ? h('audio', { controls: true, src: rev.urls[t.id], preload: 'metadata' })
          : h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn sec2 sm', onclick: function () { loadAudio(t); } }, Icons.icon('play', 14), 'Carregar áudio')),
        S.canEdit ? h('div', { class: 'row', style: 'margin-top:12px' },
          h('button', { class: 'btn sm', onclick: function () { act(t, { review_status: 'aprovada' }, 'Tomada aprovada.'); } }, Icons.icon('approved', 14), 'Aprovar'),
          h('button', { class: 'btn sec2 sm', onclick: function () { act(t, { review_status: 'refazer' }, 'Pedido de nova gravação enviado.'); } }, Icons.icon('redo2', 14), 'Pedir nova gravação'),
          h('button', { class: 'btn sec2 sm', onclick: function () { act(t, { released_for_rehearsal: !t.released_for_rehearsal }, t.released_for_rehearsal ? 'Tomada recolhida do ensaio.' : 'Tomada liberada para a banda ouvir no ensaio.'); } },
            Icons.icon(t.released_for_rehearsal ? 'lock' : 'released', 14), t.released_for_rehearsal ? 'Recolher do ensaio' : 'Liberar para ensaio'),
          h('label', { class: 'f', style: 'margin:0' }, 'Voz',
            h('select', { onchange: function (ev) { act(t, { voice_part: ev.target.value || null }, 'Voz da gravação atualizada.'); } },
              [h('option', { value: '', selected: !t.voice_part }, 'Não marcada')].concat(VoiceParts.ALL.map(function (v) {
                return h('option', { value: v.id, selected: t.voice_part === v.id }, v.label);
              }))))
        ) : null,
        comments.length ? h('div', { class: 'stack', style: 'margin-top:12px;gap:8px' }, comments.map(function (c) {
          return h('div', { class: 'cm' }, h('b', null, nameOf(c.author)), h('span', { class: 'mu' }, ' · ' + fmtDate(c.created_at)), h('div', null, c.body));
        })) : null,
        h('form', { class: 'row', style: 'margin-top:12px', onsubmit: function (ev) { ev.preventDefault(); addComment(t, input); } },
          h('div', { style: 'flex:1;min-width:180px' }, input),
          h('button', { class: 'btn sec2 sm', type: 'submit' }, Icons.icon('comment', 14), 'Comentar')
        )
      );
    });

    return h('div', null,
      h('h1', null, 'Revisão'),
      h('p', { class: 'mu', style: 'margin-top:0' }, 'Ouça as tomadas, aprove, peça nova gravação e escolha quais ficam disponíveis para o ensaio da banda. A revisão nunca altera nem apaga a gravação original.'),
      S.projects.length ? h('div', { class: 'card' }, h('label', { class: 'f' }, 'Projeto', projSel)) : h('p', { class: 'mu' }, 'Crie um projeto primeiro.'),
      cards.length ? cards : (S.projects.length ? h('p', { class: 'mu' }, 'Nenhuma tomada neste projeto ainda.') : null),
      S.canEdit ? null : h('p', { class: 'mu' }, 'Você pode ouvir e comentar as tomadas que consegue ver. Aprovar e liberar é com o líder.')
    );
  }

  // ---------------------------------------------------------------------------
  // Roteamento
  // ---------------------------------------------------------------------------
  function render() {
    if (!S.user) return renderAuth();
    if (!S.org) return renderOnboarding();

    var body;
    if (S.tab === 'projetos' && S.projectId) {
      loadProjectDetail(S.projectId).then(function () {
        if (S.tab === 'projetos' && S.projectId) renderShell(renderProjectDetail());
      }).catch(function (e) { flash('err', friendly(e)); S.projectId = null; render(); });
      return;
    }
    if (S.tab === 'repertorio') body = window.Repertoire.view();
    else if (S.tab === 'exportar') body = window.ExportPage.view();
    else if (S.tab === 'agenda') body = window.AgendaPage.view();
    else if (S.tab === 'mural') body = window.MuralPage.view();
    else if (S.tab === 'banda') body = window.SettingsPages.band();
    else if (S.tab === 'ajustes') body = window.SettingsPages.settings();
    else if (S.tab === 'app') body = window.AppDemo.view();
    else if (S.tab === 'perfil') body = window.ProfilePage.view();
    else if (S.tab === 'equipe') body = renderTeam();
    else if (S.tab === 'estudio') body = window.LeaderStudio.view();
    else if (S.tab === 'revisao') {
      if (!S.projects.some(function (p) { return p.id === rev.projectId; })) {
        rev.projectId = S.projects.length ? S.projects[0].id : null;
      }
      loadReview().then(function () {
        if (S.tab === 'revisao') renderShell(renderReview());
      }).catch(function (e) { flash('err', friendly(e)); renderShell(h('p', { class: 'mu' }, 'Não foi possível carregar a revisão.')); });
      return;
    } else body = renderProjects();
    renderShell(body);
  }

  // ---------------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------------
  function start() {
    if (!window.supabase || !cfg.url || /COLE_AQUI/.test(cfg.url)) return renderConfigMissing();
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });

    function onSession(session) {
      S.user = session ? session.user : null;
      if (!S.user) { S.org = null; S.memberships = []; return renderAuth(); }
      refresh().then(render).catch(function (e) { flash('err', friendly(e)); render(); });
    }

    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Evita chamar o banco dentro do próprio callback de autenticação.
        setTimeout(function () { onSession(session); }, 0);
      }
    });
  }

  start();
})();
