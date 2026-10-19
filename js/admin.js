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
        h('div', { class: 'adm-filters' }, search, chips),
        listBox));
    renderList();
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
