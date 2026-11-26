// Louvor Studio — painel de administração (louvorstudio.app.br/admin): todas as bandas e o plano de cada uma.
// Só abre para quem está em private.admins (migração 0023): as funções admin_* do banco conferem o login;
// sem estar lá, o banco responde "sem permissão". Usa o mesmo login do site (mesma sessão salva no navegador).
(function () {
  'use strict';
  var cfg = window.LOUVOR_CONFIG;
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'louvor-web-auth' } });
  var P = window.LSPlanos;
  var GB = 1073741824;
  var root = document.getElementById('adm');
  var A = { orgs: [], q: '', plan: 'todos', me: null };

  // ------------------------------------------------------------------ Ajudantes
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function bytes(n) {
    if (n >= GB) return (n / GB).toFixed(n >= 10 * GB ? 0 : 1).replace('.', ',') + ' GB';
    if (n >= 1048576) return Math.round(n / 1048576) + ' MB';
    return Math.round(n / 1024) + ' KB';
  }
  function plano(id) { return P.achar(id); }
  function extrasOf(o) {
    var base = plano(o.plan).gb * GB;
    return o.plan === 'free' ? 0 : Math.max(0, Math.round((o.storage_limit_bytes - base) / (50 * GB)));
  }
  function mensal(planId, extras) { var p = plano(planId); return p.mensal ? p.mensal + extras * P.EXTRA.mensal : 0; }
  function toast(t) {
    var el = h('div', { class: 'toast show' }, t);
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }
  function msg(title, text, link) {
    root.replaceChildren(h('div', { class: 'adm-msg' }, h('span', { class: 'logo' }, h('span', { html: icon('lines', 22) })),
      h('h1', null, title), h('p', null, text), link ? h('a', { class: 'btn', href: link[1] }, link[0]) : null));
  }
  var ICONS = {
    lines: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', check: '<path d="M20 6 9 17l-5-5"/>'
  };
  function icon(n, s) { return '<svg class="i" width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>'; }

  // ------------------------------------------------------------------ Carregar
  async function load() {
    var s = await sb.auth.getSession();
    if (!s.data.session) { msg('Entre no site primeiro', 'O painel usa o mesmo login do Louvor Studio. Entre com a sua conta e volte para esta página.', ['Abrir o Louvor Studio', '../']); return; }
    A.me = s.data.session.user;
    var ok = await sb.rpc('admin_is');
    if (ok.error) { msg('Painel ainda não instalado', 'Falta rodar a migração 0023 no Supabase (SQL Editor).'); return; }
    if (!ok.data) { msg('Sem acesso', 'Esta conta (' + A.me.email + ') não é administradora do Louvor Studio.', ['Voltar ao app', '../']); return; }
    var r = await sb.rpc('admin_orgs');
    if (r.error) { msg('Não deu para carregar', r.error.message); return; }
    A.orgs = r.data || [];
    render();
  }

  // ------------------------------------------------------------------ Tela
  function render() {
    var list = A.orgs.filter(function (o) {
      if (A.plan !== 'todos' && o.plan !== A.plan) return false;
      var q = A.q.trim().toLowerCase();
      return !q || [o.name, o.leader_name, o.leader_email].some(function (x) { return (x || '').toLowerCase().indexOf(q) >= 0; });
    });
    var pagantes = A.orgs.filter(function (o) { return o.plan !== 'free'; });
    var receita = pagantes.reduce(function (s, o) { return s + mensal(o.plan, extrasOf(o)); }, 0);
    var usado = A.orgs.reduce(function (s, o) { return s + Number(o.storage_used || 0); }, 0);

    var search = h('label', { class: 'adm-search' }, h('span', { html: icon('search', 18) }),
      h('input', { type: 'search', placeholder: 'Buscar banda, líder ou e-mail', value: A.q, 'aria-label': 'Buscar',
        oninput: function (e) { A.q = e.target.value; renderList(); } }));
    var chips = h('div', { class: 'hscroll' }, [['todos', 'Todos']].concat(P.PLANOS.map(function (p) { return [p.id, p.nome]; })).map(function (c) {
      var n = c[0] === 'todos' ? A.orgs.length : A.orgs.filter(function (o) { return o.plan === c[0]; }).length;
      return h('button', { class: 'chiptog' + (A.plan === c[0] ? ' on' : ''), onclick: function () { A.plan = c[0]; render(); } }, c[1] + ' (' + n + ')');
    }));
    var listBox = h('div', { class: 'adm-list' });
    function renderList() {
      var q = A.q.trim().toLowerCase();
      var l = A.orgs.filter(function (o) {
        if (A.plan !== 'todos' && o.plan !== A.plan) return false;
        return !q || [o.name, o.leader_name, o.leader_email].some(function (x) { return (x || '').toLowerCase().indexOf(q) >= 0; });
      });
      listBox.replaceChildren.apply(listBox, l.length ? l.map(row) : [h('div', { class: 'empty' }, 'Nenhuma banda encontrada.')]);
    }

    root.replaceChildren(
      h('header', { class: 'adm-top' }, h('div', { class: 'wrap' },
        h('span', { class: 'logo', html: icon('lines', 20) }),
        h('div', { class: 'grow' }, h('div', { class: 'brand' }, 'Administração'), h('div', { class: 'muted small' }, A.me.email)),
        h('a', { class: 'btn2', href: '../', style: { minHeight: '40px', textDecoration: 'none' } }, 'Voltar ao app'))),
      h('main', { class: 'wrap adm-main' },
        h('section', { class: 'adm-stats' },
          stat('Bandas', String(A.orgs.length)),
          stat('Em plano pago', String(pagantes.length)),
          stat('Receita por mês', P.reais(receita), 'estimada, pelos planos marcados'),
          stat('Espaço usado', bytes(usado))),
        legacyBox(),
        opiniaoBox(),
        bibliotecaBox(),
        h('div', { class: 'adm-filters' }, search, chips),
        listBox));
    renderList();
  }

  // ------------------------------------------------------------------ Áudios antigos → R2 (migração 0039)
  // Cada arquivo: baixa do Supabase, envia ao R2 por um link da função r2, a função confere o tamanho e
  // marca o arquivo como R2; só então a cópia antiga sai do Supabase. Falhou no meio? O arquivo fica onde estava.
  var M = { list: null, busy: false, done: 0, fail: 0, bytes: 0, err: null };
  function legacyBox() {
    if (M.box) return M.box;
    var box = M.box = h('section', { class: 'adm-legacy' });
    function paint() {
      var n = M.list ? M.list.length : 0;
      var total = M.list ? M.list.reduce(function (s, f) { return s + Number(f.size_bytes || 0); }, 0) : 0;
      box.replaceChildren(
        h('div', { class: 'grow' },
          h('div', { class: 'semi' }, 'Áudios antigos no Supabase'),
          h('div', { class: 'muted small' }, M.list === null ? 'Conferindo…'
            : M.busy ? 'Movendo para o R2: ' + (M.done + M.fail) + ' de ' + n + (M.fail ? ' (' + M.fail + ' com erro)' : '') + '. Deixe esta página aberta.'
            : n ? n + (n === 1 ? ' arquivo' : ' arquivos') + ' (' + bytes(total) + ') ainda no Supabase. Mover deixa o download mais barato.'
            : 'Nenhum: todos os áudios estão no R2.'),
          M.err ? h('div', { class: 'small', style: { color: 'var(--bad)' } }, M.err) : null),
        M.list && M.list.length && !M.busy ? h('button', { class: 'btn', onclick: run }, 'Mover para o R2') : null);
    }
    async function check() {
      var r = await sb.rpc('admin_legacy_files', { _limit: 2000 });
      if (r.error) { M.list = []; M.err = /admin_legacy_files/.test(r.error.message) ? 'Rode a migração 0039 no Supabase.' : r.error.message; }
      else M.list = r.data || [];
      paint();
    }
    async function call(body) {
      var res = await sb.functions.invoke('r2', { body: body });
      if (res.error) {
        var t = res.error.message;
        try { t = (await res.error.context.json()).error || t; } catch (e) { /* sem corpo */ }
        throw new Error(t);
      }
      return res.data;
    }
    async function moveOne(f) {
      var got = await sb.storage.from('audio').download(f.object_key);
      if (got.error) throw new Error('baixar: ' + got.error.message);
      var up = await call({ action: 'admin_move_upload', file_id: f.id });
      var put = await fetch(up.url, { method: 'PUT', body: got.data });
      if (!put.ok) throw new Error('enviar ao R2: ' + put.status);
      var ok = await call({ action: 'admin_move_confirm', file_id: f.id });
      if (!ok.ok) throw new Error('confirmar');
      // A cópia antiga só sai depois que o arquivo já aponta para o R2.
      await sb.storage.from('audio').remove([f.object_key]);
    }
    async function run() {
      if (!confirm('Mover ' + M.list.length + ' áudios antigos para o R2? Deixe a página aberta até terminar.')) return;
      M.busy = true; M.done = 0; M.fail = 0; M.err = null; paint();
      for (var i = 0; i < M.list.length; i++) {
        try { await moveOne(M.list[i]); M.done++; } catch (e) { M.fail++; M.err = (M.list[i].object_key.split('/').pop()) + ': ' + e.message; }
        paint();
      }
      M.busy = false;
      toast(M.fail ? M.done + ' movidos, ' + M.fail + ' com erro.' : M.done + ' áudios movidos para o R2.');
      M.list = null; paint(); check();
    }
    if (M.list === null && !M.busy) check(); else paint();
    paint();
    return box;
  }
  // ------------------------------------------------------------------ E-mail de opinião (migração 0047)
  // Quem criou conta nos últimos 7 dias. Primeiro "Mandar só para mim (teste)"; depois "Enviar". Cada pessoa recebe
  // uma vez só (o servidor anota). Quem envia é a função `emails` (endereço quick-function), pelo Brevo.
  var FN_EMAILS = 'quick-function';
  var O = { list: null, busy: false, err: null, testou: false, fora: {}, aberto: false };
  function opiniaoBox() {
    if (O.box) return O.box;
    var box = O.box = h('section', { class: 'adm-legacy adm-opiniao' });
    function quando(iso) { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
    function vaoReceber() { return (O.list || []).filter(function (p) { return !p.enviado && !O.fora[p.user_id]; }); }
    function paint() {
      var l = O.list || [];
      var novos = l.filter(function (p) { return !p.enviado; }).length;
      var n = vaoReceber().length;
      var cab = h('div', { class: 'grow' },
        h('div', { class: 'semi' }, 'E-mail de opinião'),
        h('div', { class: 'muted small' }, O.list === null ? 'Conferindo…'
          : l.length ? l.length + (l.length === 1 ? ' conta nova' : ' contas novas') + ' nos últimos 7 dias · ' + novos + ' ainda não ' + (novos === 1 ? 'recebeu' : 'receberam')
          : 'Nenhuma conta nova nos últimos 7 dias.'),
        O.err ? h('div', { class: 'small', style: { color: 'var(--bad)' } }, O.err) : null);
      var acoes = h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
        l.length ? h('button', { class: 'btn2', onclick: function () { O.aberto = !O.aberto; paint(); } }, O.aberto ? 'Esconder a lista' : 'Ver a lista') : null,
        l.length ? h('button', { class: 'btn2', disabled: O.busy, onclick: teste }, 'Mandar só para mim (teste)') : null,
        n ? h('button', { class: 'btn', disabled: O.busy || !O.testou, title: O.testou ? '' : 'Mande o teste antes',
          onclick: enviar }, 'Enviar para ' + n + (n === 1 ? ' pessoa' : ' pessoas')) : null);
      var kids = [h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' } }, cab, acoes)];
      if (!O.testou && n) kids.push(h('div', { class: 'muted small', style: { width: '100%' } }, 'Mande o teste para você primeiro: o botão Enviar libera depois.'));
      if (O.aberto && l.length) {
        kids.push(h('div', { class: 'adm-op-list', style: { width: '100%', display: 'grid', gap: '6px', marginTop: '8px' } }, l.map(function (p) {
          var fora = !!O.fora[p.user_id];
          return h('label', { class: 'row', style: { gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'var(--control)', opacity: p.enviado ? 0.6 : 1 } },
            h('input', { type: 'checkbox', checked: !p.enviado && !fora, disabled: p.enviado || O.busy,
              onchange: function (e) { if (e.target.checked) delete O.fora[p.user_id]; else O.fora[p.user_id] = true; paint(); } }),
            h('div', { class: 'grow' },
              h('div', { class: 'semi' }, (p.nome || '(sem nome)') + (p.banda ? ' · ' + p.banda : '')),
              h('div', { class: 'muted small' }, p.email + ' · conta de ' + quando(p.criado_em))),
            p.enviado ? h('span', { class: 'chip ok' }, 'Já recebeu') : null);
        })));
      }
      box.replaceChildren.apply(box, kids);
    }
    async function call(body) {
      var res = await sb.functions.invoke(FN_EMAILS, { body: body });
      if (res.error) {
        var t = res.error.message;
        try { t = (await res.error.context.json()).error || t; } catch (e) { /* sem corpo */ }
        throw new Error(t);
      }
      return res.data;
    }
    async function check() {
      var r = await sb.rpc('admin_opiniao_lista', { _dias: 7 });
      if (r.error) { O.list = []; O.err = /admin_opiniao_lista/.test(r.error.message) ? 'Rode a migração 0047 no Supabase.' : r.error.message; }
      else { O.list = r.data || []; O.err = null; }
      paint();
    }
    async function teste() {
      O.busy = true; O.err = null; paint();
      try { var d = await call({ action: 'opiniao', modo: 'teste' }); O.testou = true; toast('Teste enviado para ' + d.para + '. Confira a caixa de entrada.'); }
      catch (e) { O.err = e.message; }
      O.busy = false; paint();
    }
    async function enviar() {
      var alvo = vaoReceber();
      if (!alvo.length || !confirm('Enviar o e-mail de opinião para ' + alvo.length + (alvo.length === 1 ? ' pessoa' : ' pessoas') + '? Cada uma recebe uma vez só.')) return;
      O.busy = true; O.err = null; paint();
      try {
        var d = await call({ action: 'opiniao', modo: 'enviar', ids: alvo.map(function (p) { return p.user_id; }) });
        toast(d.enviados + (d.enviados === 1 ? ' e-mail enviado.' : ' e-mails enviados.') + (d.falhas && d.falhas.length ? ' ' + d.falhas.length + ' com erro.' : ''));
        if (d.falhas && d.falhas.length) O.err = d.falhas.join(' · ');
      } catch (e) { O.err = e.message; }
      O.busy = false;
      check();
    }
    if (O.list === null) check(); else paint();
    paint();
    return box;
  }

  // ------------------------------------------------------------------ Biblioteca do Louvor Studio (migração 0048)
  // As músicas são montadas numa banda da empresa pelo próprio app (enviar a multitrack, partes, click, letra).
  // Aqui: qual banda é a biblioteca, quais músicas dela aparecem para os planos pagos e o crédito de cada uma.
  var B = { list: null, busy: false, err: null, edit: {} };
  function bibliotecaBox() {
    if (B.box) return B.box;
    var box = B.box = h('section', { class: 'adm-legacy adm-biblioteca' });
    function paint() {
      var l = (B.list || []).filter(function (x) { return x.project_id; });
      var org = B.list && B.list.length ? B.list[0].org_id : null;
      var publicadas = l.filter(function (x) { return x.na_biblioteca; }).length;
      var opts = [h('option', { value: '' }, '(nenhuma)')].concat(A.orgs.slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); })
        .map(function (o) { return h('option', { value: o.id, selected: o.id === org }, o.name + (o.leader_name ? ' · ' + o.leader_name : '')); }));
      var kids = [h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' } },
        h('div', { class: 'grow' },
          h('div', { class: 'semi' }, 'Biblioteca do Louvor Studio'),
          h('div', { class: 'muted small' }, B.list === null ? 'Conferindo…'
            : !org ? 'Escolha a banda da empresa onde as músicas da biblioteca são montadas (o espaço dela fica sem limite de plano).'
            : l.length + (l.length === 1 ? ' música na banda' : ' músicas na banda') + ' · ' + publicadas + ' na biblioteca. Monte as músicas nessa banda pelo app (Repertório › Adicionar música › enviar a multitrack). Esta banda não tem limite de espaço (o arquivo fica guardado uma vez só); cada banda que adiciona uma música gasta o tamanho dela no próprio plano.'),
          B.err ? h('div', { class: 'small', style: { color: 'var(--bad)' } }, B.err) : null),
        h('label', { class: 'small', style: { display: 'grid', gap: '4px' } }, 'Banda da biblioteca',
          h('select', { class: 'input', disabled: B.busy, onchange: function (e) { escolher(e.target.value || null); } }, opts)))];
      if (org && l.length) {
        kids.push(h('div', { style: { width: '100%', display: 'grid', gap: '6px', marginTop: '8px' } }, l.map(function (x) {
          var e = B.edit[x.project_id] || (B.edit[x.project_id] = { pub: x.na_biblioteca, cred: x.credito || '' });
          function mudou() { return e.pub !== x.na_biblioteca || e.cred !== (x.credito || ''); }
          var btn = h('button', { class: 'btn2', disabled: true, onclick: function () { salvar(x, e); } }, 'Salvar');
          function marca() { var m = mudou() && !B.busy; btn.disabled = !m; btn.className = m ? 'btn' : 'btn2'; }
          marca();
          return h('div', { class: 'row', style: { gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'var(--control)', flexWrap: 'wrap' } },
            h('label', { class: 'row', style: { gap: '8px' } },
              h('input', { type: 'checkbox', checked: e.pub, disabled: B.busy, onchange: function (ev) { e.pub = ev.target.checked; marca(); } }),
              h('div', null,
                h('div', { class: 'semi' }, x.titulo + (x.artista ? ' · ' + x.artista : '')),
                h('div', { class: 'muted small' }, x.faixas + (x.faixas === 1 ? ' faixa' : ' faixas') + ' · ' + bytes(Number(x.bytes || 0))
                  + (x.bandas_usando ? ' · ' + x.bandas_usando + (x.bandas_usando === 1 ? ' banda usa' : ' bandas usam') : '')))),
            h('input', { class: 'input grow', placeholder: 'Crédito (ex.: Cedida por …)', value: e.cred, maxlength: 160, disabled: B.busy,
              style: { minWidth: '200px' }, oninput: function (ev) { e.cred = ev.target.value; marca(); } }),
            btn);
        })));
      }
      box.replaceChildren.apply(box, kids);
    }
    async function check() {
      var r = await sb.rpc('admin_biblioteca_lista');
      if (r.error) { B.list = []; B.err = /admin_biblioteca_lista/.test(r.error.message) ? 'Rode a migração 0048 no Supabase.' : r.error.message; }
      else { B.list = r.data || []; B.err = null; B.edit = {}; }
      paint();
    }
    async function escolher(id) {
      if (!confirm(id ? 'Usar esta banda como a Biblioteca do Louvor Studio?' : 'Deixar sem banda da biblioteca? As músicas somem do catálogo.')) { paint(); return; }
      B.busy = true; paint();
      var r = await sb.rpc('admin_biblioteca_banda', { _org: id });
      B.busy = false;
      if (r.error) { B.err = r.error.message; paint(); return; }
      check();
    }
    async function salvar(x, e) {
      if (!e.pub && x.na_biblioteca && x.bandas_usando &&
          !confirm('Tirar "' + x.titulo + '" da biblioteca? ' + x.bandas_usando + (x.bandas_usando === 1 ? ' banda usa' : ' bandas usam') + ' esta música: as partes e gravações delas ficam, mas o áudio deixa de abrir.')) return;
      B.busy = true; paint();
      var r = await sb.rpc('admin_biblioteca_salvar', { _project: x.project_id, _publicar: e.pub, _credito: e.cred });
      B.busy = false;
      if (r.error) { B.err = r.error.message; paint(); return; }
      toast(e.pub ? 'Salvo: "' + x.titulo + '" está na biblioteca.' : 'Salvo: "' + x.titulo + '" fora da biblioteca.');
      check();
    }
    if (B.list === null) check(); else paint();
    paint();
    return box;
  }

  function stat(k, v, sub) { return h('div', { class: 'adm-stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), sub ? h('div', { class: 'muted small' }, sub) : null); }

  function row(o) {
    var p = plano(o.plan), ex = extrasOf(o);
    var used = Number(o.storage_used || 0), lim = Number(o.storage_limit_bytes || 1);
    var f = Math.min(1, used / lim);
    var over = p.pessoas && o.people > p.pessoas;
    return h('article', { class: 'adm-row' },
      h('div', { class: 'adm-who' },
        h('div', { class: 'hi semi ell', style: { fontSize: '16px' } }, o.name),
        h('div', { class: 'muted small ell' }, (o.leader_name || 'Sem líder') + (o.leader_email ? ' · ' + o.leader_email : '')),
        h('div', { class: 'muted tiny' }, 'Criada em ' + new Date(o.created_at).toLocaleDateString('pt-BR'))),
      h('span', { class: 'adm-plan p-' + o.plan }, p.nome + (ex ? ' + ' + ex * 50 + ' GB' : '')),
      h('div', { class: 'adm-num' + (over ? ' warn' : '') }, h('span', { html: icon('users', 15) }), o.people + (p.pessoas ? ' de ' + p.pessoas : '')),
      h('div', { class: 'adm-space' }, h('div', { class: 'row', style: { gap: '6px' } }, h('span', { html: icon('cloud', 15) }), h('span', { class: 'small' }, bytes(used) + ' de ' + bytes(lim))),
        h('div', { class: 'bar' }, h('i', { style: { width: (f * 100).toFixed(1) + '%', background: f > 0.9 ? 'var(--bad)' : f > 0.75 ? 'var(--warn)' : null } }))),
      h('button', { class: 'btn2', onclick: function () { editPlan(o); } }, 'Mudar plano'));
  }

  // ------------------------------------------------------------------ Mudar plano
  function editPlan(o) {
    var st = { plan: o.plan, extras: extrasOf(o), busy: false };
    var scrim = h('div', { class: 'scrim', onclick: function () { if (!st.busy) scrim.remove(); } });
    function build() {
      var p = plano(st.plan);
      var gb = p.gb + (st.plan === 'free' ? 0 : st.extras * 50);
      var price = mensal(st.plan, st.plan === 'free' ? 0 : st.extras);
      var box = h('div', { class: 'dialog adm-dialog', role: 'dialog', 'aria-modal': 'true', onclick: function (e) { e.stopPropagation(); } },
        h('div', { class: 'dt' }, 'Plano de ' + o.name),
        h('div', { class: 'db' },
          h('div', { class: 'adm-opts', role: 'radiogroup' }, P.PLANOS.map(function (q) {
            var on = st.plan === q.id;
            return h('button', { class: 'adm-opt' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on), onclick: function () { st.plan = q.id; build(); } },
              h('span', { class: 'dotc', html: on ? icon('check', 14) : '' }),
              h('span', { class: 'grow' }, h('b', null, q.nome), h('span', { class: 'muted small' }, (q.pessoas ? 'até ' + q.pessoas + ' pessoas' : 'pessoas sem limite') + ' · ' + q.gb + ' GB')),
              h('span', { class: 'small' }, q.mensal ? P.reais(q.mensal) : 'R$ 0'));
          })),
          st.plan !== 'free' ? h('div', { class: 'adm-extra' },
            h('div', { class: 'grow' }, h('b', null, 'Espaço extra'), h('div', { class: 'muted small' }, '+50 GB cada, ' + P.reais(P.EXTRA.mensal) + '/mês')),
            h('button', { class: 'iconbtn', 'aria-label': 'Menos', disabled: st.extras <= 0, html: icon('minus', 18), onclick: function () { st.extras--; build(); } }),
            h('span', { class: 'n' }, String(st.extras)),
            h('button', { class: 'iconbtn', 'aria-label': 'Mais', disabled: st.extras >= 20, html: icon('plus', 18), onclick: function () { st.extras++; build(); } })) : null,
          h('div', { class: 'adm-sum' }, 'Fica: ' + gb + ' GB · ' + (p.pessoas ? 'até ' + p.pessoas + ' pessoas' : 'pessoas sem limite') + ' · ' + (price ? P.reais(price) + '/mês' : 'grátis')),
          Number(o.storage_used) > gb * GB ? h('div', { class: 'warn small' }, 'A banda já usa ' + bytes(Number(o.storage_used)) + ': nada é apagado, mas ela não sobe arquivo novo até liberar espaço.') : null),
        h('div', { class: 'da' },
          h('button', { class: 'textbtn muted', disabled: st.busy, onclick: function () { scrim.remove(); } }, 'Cancelar'),
          h('button', { class: 'textbtn', disabled: st.busy, onclick: save }, st.busy ? 'Salvando…' : 'Salvar')));
      scrim.replaceChildren(box);
    }
    async function save() {
      st.busy = true; build();
      var r = await sb.rpc('admin_set_plan', { _org: o.id, _plan: st.plan, _extras: st.plan === 'free' ? 0 : st.extras });
      st.busy = false;
      if (r.error) { toast(r.error.message); build(); return; }
      scrim.remove();
      toast('Plano de ' + o.name + ' mudado para ' + plano(st.plan).nome + '.');
      var again = await sb.rpc('admin_orgs');
      if (!again.error) A.orgs = again.data || [];
      render();
    }
    build();
    document.body.appendChild(scrim);
  }

  document.addEventListener('DOMContentLoaded', function () { load().catch(function (e) { msg('Não deu para carregar', String(e.message || e)); }); });
})();
