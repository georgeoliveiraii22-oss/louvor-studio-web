// Louvor Studio — CRM (louvorstudio.app.br/admin/crm): acompanhar as pessoas e as bandas que usam o app.
// Só abre para o administrador (as funções admin_crm_* da migração 0051 conferem o login). Quatro abas:
// Visão geral (ativos, funil, aberturas por dia, coortes), Pessoas (filtros, ficha, anotações, mensagem para os
// marcados), Bandas (saúde de cada banda) e Acompanhar (listas de quem precisa de contato).
// "Último uso" junta tudo o que o banco registra (abertura do app, leitura, mensagem, gravação, "Ensaiei",
// resposta à escala, música criada, celular registrado, login).
(function () {
  'use strict';
  var cfg = window.LOUVOR_CONFIG;
  var sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'louvor-web-auth' } });
  var Planos = window.LSPlanos;
  var root = document.getElementById('crm');
  var DIA = 86400000, GB = 1073741824;
  var C = { me: null, aba: 'geral', resumo: null, pessoas: null, bandas: null, erro: null,
            q: '', saude: 'todas', etapa: 'todas', filtro: 'todos', ordem: 'uso', sel: {}, ficha: null,
            semEmail: {}, emails: null, avisos: null };
  var FN_EMAILS = 'quick-function';   // função `emails` (mesmo endereço do e-mail de opinião)

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
  var ICONS = {
    lines: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
  };
  function icon(n, s) { return '<svg class="i" width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  function ic(n, s) { return h('span', { class: 'crm-ic', html: icon(n, s) }); }
  function toast(t) { var el = h('div', { class: 'toast show' }, t); document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2600); }
  function num(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
  function bytes(n) { n = Number(n || 0); return n >= GB ? (n / GB).toFixed(1).replace('.', ',') + ' GB' : Math.round(n / 1048576) + ' MB'; }
  function dias(t) { return t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / DIA)) : null; }
  function haDias(t) {
    var d = dias(t);
    if (d === null) return 'nunca';
    if (d === 0) { var hs = Math.floor((Date.now() - new Date(t).getTime()) / 3600000); return hs < 1 ? 'agora há pouco' : 'há ' + hs + ' h'; }
    return d === 1 ? 'ontem' : 'há ' + d + ' dias';
  }
  function data(t) { return t ? new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; }
  function dataHora(t) { return t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function planoNome(p) { return p ? (Planos && Planos.achar ? Planos.achar(p).nome : p) : 'Sem banda'; }

  // Saúde pelo último uso (igual para pessoas e bandas)
  var SAUDE = [['ativa', 'Ativa', 'até 7 dias'], ['esfriando', 'Esfriando', '8 a 21 dias'], ['risco', 'Em risco', '22 a 45 dias'],
               ['parada', 'Parada', 'mais de 45 dias'], ['nunca', 'Nunca usou', 'sem uso registrado']];
  function saudeDe(t) { var d = dias(t); return d === null ? 'nunca' : d <= 7 ? 'ativa' : d <= 21 ? 'esfriando' : d <= 45 ? 'risco' : 'parada'; }
  function saudeChip(t) { var s = saudeDe(t); return h('span', { class: 'crm-saude s-' + s }, (SAUDE.find(function (x) { return x[0] === s; }) || [])[1]); }
  var ETAPAS = [['novo', 'Novo'], ['conhecendo', 'Conhecendo'], ['usando', 'Usando'], ['em_risco', 'Em risco'], ['cliente', 'Cliente'], ['perdido', 'Perdido']];
  function etapaNome(e) { return (ETAPAS.find(function (x) { return x[0] === e; }) || [0, e])[1]; }
  var TIPOS = [['nota', 'Anotação'], ['whatsapp', 'WhatsApp'], ['ligacao', 'Ligação'], ['email', 'E-mail'], ['reuniao', 'Reunião'], ['mensagem', 'Mensagem no app']];
  function tipoNome(t) { return (TIPOS.find(function (x) { return x[0] === t; }) || [0, t])[1]; }

  function msg(title, text, link) {
    root.replaceChildren(h('div', { class: 'adm-msg' }, h('span', { class: 'logo', html: icon('lines', 22) }),
      h('h1', null, title), h('p', null, text), link ? h('a', { class: 'btn', href: link[1] }, link[0]) : null));
  }

  // ------------------------------------------------------------------ Carregar
  var deHash = (location.hash || '').replace('#', '');
  if (['geral', 'pessoas', 'bandas', 'acompanhar', 'comunicar'].indexOf(deHash) >= 0) C.aba = deHash;
  async function load() {
    var s = await sb.auth.getSession();
    if (!s.data.session) { msg('Entre no site primeiro', 'O CRM usa o mesmo login do Louvor Studio. Entre com a sua conta e volte para esta página.', ['Abrir o Louvor Studio', '../../']); return; }
    C.me = s.data.session.user;
    var ok = await sb.rpc('admin_is');
    if (ok.error || ok.data !== true) { msg('Sem acesso', 'O CRM é só para a equipe do Louvor Studio.', ['Voltar ao app', '../../']); return; }
    await recarregar();
  }
  async function recarregar() {
    C.erro = null;
    var r = await Promise.all([sb.rpc('admin_crm_resumo'), sb.rpc('admin_crm_pessoas'), sb.rpc('admin_crm_bandas')]);
    var falha = r.find(function (x) { return x.error; });
    if (falha) {
      C.erro = /admin_crm_/.test(falha.error.message) ? 'Falta rodar a migração 0051 (CRM) no Supabase, no SQL Editor.' : falha.error.message;
    } else { C.resumo = r[0].data; C.pessoas = r[1].data || []; C.bandas = r[2].data || []; }
    // E-mails (0052): sem a migração, o resto do CRM funciona e a aba avisa.
    var se = await sb.rpc('admin_crm_sem_email_ids');
    C.semEmail = {}; (se.data || []).forEach(function (x) { C.semEmail[typeof x === 'string' ? x : x.admin_crm_sem_email_ids] = true; });
    C.emailsErro = se.error ? (/admin_crm_/.test(se.error.message) ? 'Falta rodar a migração 0052 (e-mails do CRM) no Supabase.' : se.error.message) : null;
    var hl = await sb.rpc('admin_crm_emails_lista');
    C.emails = hl.error ? [] : (hl.data || []);
    var av = await sb.rpc('admin_avisos_lista');
    C.avisos = av.error ? [] : (av.data || []);
    render();
  }

  // ------------------------------------------------------------------ Tela
  function render() {
    var abas = [['geral', 'Visão geral'], ['pessoas', 'Pessoas'], ['bandas', 'Bandas'], ['acompanhar', 'Acompanhar'], ['comunicar', 'Comunicar']];
    var pend = C.pessoas ? listasAcompanhar().reduce(function (a, l) { return a + l.itens.length; }, 0) : 0;
    var corpo = C.erro ? h('div', { class: 'crm-vazio' }, h('div', { class: 'semi hi' }, 'Não deu para carregar o CRM'), h('div', { class: 'muted' }, C.erro))
      : !C.pessoas ? h('div', { class: 'crm-esqueleto' }, [1, 2, 3, 4].map(function () { return h('div'); }))
      : C.aba === 'geral' ? visaoGeral() : C.aba === 'pessoas' ? pessoasView() : C.aba === 'bandas' ? bandasView() : C.aba === 'comunicar' ? comunicarView() : acompanharView();
    root.replaceChildren(
      h('header', { class: 'adm-top' }, h('div', { class: 'wrap' },
        h('span', { class: 'logo', html: icon('lines', 20) }),
        h('div', { class: 'grow' }, h('div', { class: 'brand' }, 'CRM'), h('div', { class: 'muted small' }, C.me.email)),
        h('button', { class: 'btn2 crm-btn', title: 'Atualizar', onclick: function () { C.pessoas = null; render(); recarregar(); } }, ic('refresh', 16), h('span', { class: 'crm-hide-sm' }, 'Atualizar')),
        h('a', { class: 'btn2 crm-btn', href: '../' }, 'Administração'))),
      h('nav', { class: 'crm-abas wrap', role: 'tablist' }, abas.map(function (a) {
        return h('button', { role: 'tab', 'aria-selected': String(C.aba === a[0]), class: 'crm-aba' + (C.aba === a[0] ? ' on' : ''),
          onclick: function () { C.aba = a[0]; render(); window.scrollTo(0, 0); } }, a[1], a[0] === 'acompanhar' && pend ? h('span', { class: 'crm-badge' }, String(pend)) : null);
      })),
      h('main', { class: 'wrap crm-main' }, corpo),
      C.ficha ? fichaView() : null);
  }

  // ------------------------------------------------------------------ Visão geral
  function visaoGeral() {
    var r = C.resumo, P = C.pessoas;
    var cont = {}; SAUDE.forEach(function (s) { cont[s[0]] = 0; });
    P.forEach(function (p) { cont[saudeDe(p.ultimo_uso)]++; });
    var f = r.funil || {};
    var passos = [['Criaram a conta', f.contas], ['Entraram numa banda', f.com_banda], ['Banda com música', f.banda_com_musica],
                  ['Foram escalados', f.escalados], ['Responderam a uma escala', f.responderam], ['Marcaram "Ensaiei"', f.ensaiaram], ['Gravaram a voz', f.gravaram]];
    var maxDia = Math.max.apply(null, (r.dias || []).map(function (d) { return d.pessoas; }).concat([1]));
    var semAberturas = !(r.dias || []).some(function (d) { return d.pessoas > 0; });
    return [
      h('section', { class: 'crm-kpis' },
        kpi('Pessoas', num(r.pessoas), '+' + num(r.novas_7) + ' na semana · +' + num(r.novas_30) + ' no mês'),
        kpi('Usaram hoje', num(r.ativas_1), pct(r.ativas_1, r.pessoas) + '% das contas'),
        kpi('Usaram na semana', num(r.ativas_7), pct(r.ativas_7, r.pessoas) + '% das contas'),
        kpi('Usaram no mês', num(r.ativas_30), pct(r.ativas_30, r.pessoas) + '% das contas'),
        kpi('Bandas', num(r.bandas), num(r.bandas_pagas) + ' em plano pago'),
        kpi('Bandas ativas na semana', num(r.bandas_ativas_7), pct(r.bandas_ativas_7, r.bandas) + '% das bandas')),
      h('section', { class: 'crm-painel' },
        h('div', { class: 'crm-tit' }, h('h2', null, 'Saúde das contas'), h('span', { class: 'muted small' }, 'pelo último uso · toque para ver as pessoas')),
        h('div', { class: 'crm-barra' }, SAUDE.map(function (s) {
          var n = cont[s[0]]; if (!n) return null;
          return h('button', { class: 'crm-seg s-' + s[0], style: { flexGrow: String(n) }, title: s[1] + ': ' + n,
            onclick: function () { C.aba = 'pessoas'; C.saude = s[0]; render(); } });
        })),
        h('div', { class: 'crm-legenda' }, SAUDE.map(function (s) {
          return h('button', { class: 'crm-leg', onclick: function () { C.aba = 'pessoas'; C.saude = s[0]; render(); } },
            h('span', { class: 'crm-dot s-' + s[0] }), h('span', { class: 'semi hi' }, num(cont[s[0]])), ' ', s[1], h('span', { class: 'muted' }, ' · ' + s[2]));
        }))),
      h('div', { class: 'crm-duas' },
        h('section', { class: 'crm-painel' },
          h('div', { class: 'crm-tit' }, h('h2', null, 'Funil'), h('span', { class: 'muted small' }, 'quantas contas chegaram a cada passo')),
          h('div', { class: 'crm-funil' }, passos.map(function (p, i) {
            var v = Number(p[1] || 0), base = Number(f.contas || 0), ant = i ? Number(passos[i - 1][1] || 0) : v;
            return h('div', { class: 'crm-passo' },
              h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '8px' } }, h('span', null, p[0]),
                h('span', { class: 'tab' }, h('b', { class: 'hi' }, num(v)), h('span', { class: 'muted' }, ' · ' + pct(v, base) + '%' + (i ? ' · ' + pct(v, ant) + '% do passo anterior' : '')))),
              h('div', { class: 'crm-trilho' }, h('i', { style: { width: Math.max(1.5, pct(v, base)) + '%' } })));
          }))),
        h('section', { class: 'crm-painel' },
          h('div', { class: 'crm-tit' }, h('h2', null, 'Pessoas que abriram o app'), h('span', { class: 'muted small' }, 'por dia, últimos 30 dias')),
          semAberturas ? h('div', { class: 'crm-aviso' }, 'O registro de aberturas começa quando as versões novas do site e dos apps chegarem às pessoas. O "último uso" das outras telas já funciona com o que o banco registra.') : null,
          h('div', { class: 'crm-grafico', role: 'img', 'aria-label': 'Pessoas por dia nos últimos 30 dias' }, (r.dias || []).map(function (d) {
            var dt = new Date(d.dia + 'T12:00:00');
            return h('div', { class: 'crm-col', title: dt.toLocaleDateString('pt-BR') + ': ' + d.pessoas + (d.pessoas === 1 ? ' pessoa' : ' pessoas') },
              h('i', { style: { height: Math.max(d.pessoas ? 4 : 1, 100 * d.pessoas / maxDia) + '%' } }));
          })),
          h('div', { class: 'row muted tiny', style: { justifyContent: 'space-between' } }, h('span', null, 'há 30 dias'), h('span', null, 'hoje')),
          h('div', { class: 'crm-plats' }, [['site', 'Site', 'globe'], ['android', 'Android', 'phone'], ['ios', 'iPhone', 'phone']].map(function (p) {
            return h('span', { class: 'crm-plat' }, ic(p[2], 14), p[1] + ': ', h('b', { class: 'hi' }, num((r.plataformas || {})[p[0]] || 0)));
          })))),
      h('section', { class: 'crm-painel' },
        h('div', { class: 'crm-tit' }, h('h2', null, 'Quem continua usando'), h('span', { class: 'muted small' }, 'contas criadas em cada semana e quantas ainda usam')),
        h('div', { class: 'crm-tabela crm-coortes' },
          h('div', { class: 'crm-th' }, h('span', null, 'Semana'), h('span', null, 'Contas novas'), h('span', null, 'Usaram na semana'), h('span', null, 'Usaram no mês')),
          (r.coortes || []).map(function (c) {
            return h('div', { class: 'crm-tr' }, h('span', null, 'de ' + data(c.semana)), h('span', { class: 'tab' }, num(c.novas)),
              celulaPct(c.ativas_7, c.novas), celulaPct(c.ativas_30, c.novas));
          })))];
    function kpi(k, v, sub) { return h('div', { class: 'crm-kpi' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), h('div', { class: 'muted small' }, sub)); }
    function celulaPct(a, b) {
      var p = pct(a, b);
      return h('span', { class: 'tab crm-pct', style: { '--p': p + '%' } }, num(a) + ' · ' + p + '%');
    }
  }

  // ------------------------------------------------------------------ Pessoas
  function filtradas() {
    var q = C.q.trim().toLowerCase();
    var l = C.pessoas.filter(function (p) {
      if (C.saude !== 'todas' && saudeDe(p.ultimo_uso) !== C.saude) return false;
      if (C.etapa !== 'todas' && (p.etapa || 'novo') !== C.etapa) return false;
      switch (C.filtro) {
        case 'lideres': if (!p.lider) return false; break;
        case 'pagos': if (!p.plano || p.plano === 'free') return false; break;
        case 'gratis': if (p.plano !== 'free') return false; break;
        case 'sem_banda': if ((p.bandas || []).length) return false; break;
        case 'sem_celular': if ((p.celulares || []).length) return false; break;
        case 'contato': if (!p.proximo_contato) return false; break;
      }
      if (!q) return true;
      return [p.nome, p.email, (p.bandas || []).map(function (b) { return b.nome; }).join(' '), (p.etiquetas || []).join(' ')]
        .some(function (x) { return (x || '').toLowerCase().indexOf(q) >= 0; });
    });
    var ord = {
      uso: function (a, b) { return new Date(b.ultimo_uso || 0) - new Date(a.ultimo_uso || 0); },
      parado: function (a, b) { return new Date(a.ultimo_uso || 0) - new Date(b.ultimo_uso || 0); },
      novas: function (a, b) { return new Date(b.criado_em) - new Date(a.criado_em); },
      nome: function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); },
      engajamento: function (a, b) { return engaj(b) - engaj(a); }
    }[C.ordem];
    return l.sort(ord);
  }
  function engaj(p) { return (p.dias_ativos_30 || 0) * 3 + (p.ensaiei_30 || 0) * 2 + (p.gravacoes_30 || 0) * 3 + (p.mensagens_30 || 0) + (p.confirmou_30 || 0) * 2; }

  function pessoasView() {
    var l = filtradas();
    var marcadas = C.pessoas.filter(function (p) { return C.sel[p.id]; });
    var busca = h('input', { type: 'search', value: C.q, placeholder: 'Buscar nome, e-mail, banda ou etiqueta', 'aria-label': 'Buscar pessoas',
      oninput: function (e) { C.q = e.target.value; var pos = e.target.selectionStart; render(); var i = root.querySelector('.crm-busca input'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });
    function sel(rot, val, ops, on) {
      return h('label', { class: 'crm-sel' }, h('span', { class: 'muted small' }, rot),
        h('select', { onchange: function (e) { on(e.target.value); render(); } }, ops.map(function (o) { return h('option', { value: o[0], selected: o[0] === val }, o[1]); })));
    }
    return [
      h('div', { class: 'crm-filtros' },
        h('label', { class: 'adm-search crm-busca' }, h('span', { html: icon('search', 18) }), busca),
        h('div', { class: 'crm-sels' },
          sel('Saúde', C.saude, [['todas', 'Todas']].concat(SAUDE.map(function (s) { return [s[0], s[1]]; })), function (v) { C.saude = v; }),
          sel('Etapa', C.etapa, [['todas', 'Todas']].concat(ETAPAS), function (v) { C.etapa = v; }),
          sel('Mostrar', C.filtro, [['todos', 'Todas as pessoas'], ['lideres', 'Só líderes'], ['pagos', 'Em banda paga'], ['gratis', 'Só no Grátis'],
            ['sem_banda', 'Sem banda'], ['sem_celular', 'Sem notificação no celular'], ['contato', 'Com contato marcado']], function (v) { C.filtro = v; }),
          sel('Ordem', C.ordem, [['uso', 'Usou mais recente'], ['parado', 'Mais tempo parado'], ['engajamento', 'Mais engajados'], ['novas', 'Contas mais novas'], ['nome', 'Nome']], function (v) { C.ordem = v; }))),
      h('div', { class: 'crm-acoes' },
        h('label', { class: 'row small', style: { gap: '8px' } },
          h('input', { type: 'checkbox', checked: l.length > 0 && l.every(function (p) { return C.sel[p.id]; }), 'aria-label': 'Marcar todas da lista',
            onchange: function (e) { l.forEach(function (p) { if (e.target.checked) C.sel[p.id] = true; else delete C.sel[p.id]; }); render(); } }),
          h('span', null, l.length + (l.length === 1 ? ' pessoa' : ' pessoas') + (marcadas.length ? ' · ' + marcadas.length + ' marcada' + (marcadas.length === 1 ? '' : 's') : ''))),
        h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
          marcadas.length ? h('button', { class: 'btn crm-btn', onclick: function () { irComunicar(marcadas); } }, ic('send', 15), 'Comunicar (recado, notificação, e-mail)') : null,
          marcadas.length ? h('button', { class: 'btn2 crm-btn', onclick: function () { copiarEmails(marcadas); } }, ic('copy', 15), 'Copiar e-mails') : null,
          marcadas.length ? h('button', { class: 'btn2 crm-btn', onclick: function () { C.sel = {}; render(); } }, 'Desmarcar') : null,
          h('button', { class: 'btn2 crm-btn', onclick: function () { exportar(l); } }, ic('download', 15), 'Planilha'))),
      l.length ? h('div', { class: 'crm-tabela crm-pessoas' },
        h('div', { class: 'crm-th' }, h('span'), h('span', null, 'Pessoa'), h('span', null, 'Último uso'), h('span', null, 'Uso no mês'),
          h('span', null, 'Escalas'), h('span', null, 'Ensaio e voz'), h('span', null, 'Etapa')),
        l.slice(0, 300).map(linhaPessoa)) : h('div', { class: 'crm-vazio' }, h('div', { class: 'semi hi' }, 'Ninguém com esses filtros'),
          h('button', { class: 'btn2', onclick: function () { C.q = ''; C.saude = 'todas'; C.etapa = 'todas'; C.filtro = 'todos'; render(); } }, 'Limpar os filtros')),
      l.length > 300 ? h('div', { class: 'muted small' }, 'Mostrando 300 de ' + l.length + '. Use a busca ou os filtros para achar alguém.') : null];
  }

  function linhaPessoa(p) {
    var bandas = (p.bandas || []).map(function (b) { return b.nome + (b.papel === 'leader' ? ' (líder)' : ''); }).join(', ');
    var hoje = new Date().toISOString().slice(0, 10);
    return h('div', { class: 'crm-tr crm-click' + (C.sel[p.id] ? ' sel' : ''), tabindex: '0', role: 'button',
      onclick: function (e) { if (e.target.closest('input')) return; abrirFicha(p.id); },
      onkeydown: function (e) { if (e.key === 'Enter') abrirFicha(p.id); } },
      h('span', null, h('input', { type: 'checkbox', checked: !!C.sel[p.id], 'aria-label': 'Marcar ' + p.nome,
        onchange: function (e) { if (e.target.checked) C.sel[p.id] = true; else delete C.sel[p.id]; render(); } })),
      h('span', { class: 'crm-quem' },
        h('span', { class: 'semi hi ell' }, p.nome, p.lider ? h('span', { class: 'crm-lider', title: 'Líder', html: icon('crown', 13) }) : null),
        h('span', { class: 'muted small ell' }, bandas || 'Sem banda'),
        h('span', { class: 'muted tiny ell' }, p.email)),
      h('span', { class: 'crm-col2' }, saudeChip(p.ultimo_uso), h('span', { class: 'muted small' }, haDias(p.ultimo_uso)),
        (p.celulares || []).length ? h('span', { class: 'muted tiny', title: 'Notificação ligada no celular' }, ic('bell', 12), ' ' + p.celulares.map(function (c) { return c === 'ios' ? 'iPhone' : 'Android'; }).join(', ')) : null),
      h('span', { class: 'crm-col2 tab' }, h('span', null, h('b', { class: 'hi' }, String(p.dias_ativos_30 || 0)), ' dias'), h('span', { class: 'muted small' }, (p.mensagens_30 || 0) + ' mensagens')),
      h('span', { class: 'crm-col2 tab' }, h('span', null, (p.confirmou_30 || 0) + ' confirmou'),
        h('span', { class: 'small', style: { color: p.sem_resposta ? 'var(--warn)' : 'var(--muted)' } }, (p.sem_resposta || 0) + ' sem resposta' + (p.recusou_30 ? ' · ' + p.recusou_30 + ' não pôde' : ''))),
      h('span', { class: 'crm-col2 tab' }, h('span', null, (p.ensaiei_30 || 0) + ' ensaiou'), h('span', { class: 'muted small' }, (p.gravacoes_30 || 0) + ' gravou no mês · ' + (p.gravacoes || 0) + ' no total')),
      h('span', { class: 'crm-col2' }, h('span', { class: 'crm-etapa e-' + (p.etapa || 'novo') }, etapaNome(p.etapa || 'novo')),
        p.proximo_contato ? h('span', { class: 'small', style: { color: p.proximo_contato <= hoje ? 'var(--warn)' : 'var(--muted)' } }, 'contato ' + data(p.proximo_contato + 'T12:00:00')) : null,
        (p.etiquetas || []).length ? h('span', { class: 'crm-tags' }, p.etiquetas.map(function (t) { return h('span', null, t); })) : null));
  }

  function copiarEmails(l) {
    var t = l.map(function (p) { return p.email; }).filter(Boolean).join(', ');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast(l.length + ' e-mails copiados.'); }, function () { window.prompt('Copie os e-mails:', t); });
  }
  function exportar(l) {
    var cab = ['Nome', 'E-mail', 'Bandas', 'Plano', 'Líder', 'Saúde', 'Último uso', 'Conta criada', 'Dias de uso (30)', 'Aberturas (30)', 'Escalas (30)', 'Confirmou (30)',
      'Sem resposta', 'Ensaiei (30)', 'Gravações (30)', 'Gravações', 'Mensagens (30)', 'Músicas criadas', 'Celular', 'Etapa', 'Etiquetas', 'Próximo contato', 'Anotações'];
    var linhas = l.map(function (p) {
      return [p.nome, p.email, (p.bandas || []).map(function (b) { return b.nome; }).join(' / '), planoNome(p.plano), p.lider ? 'sim' : 'não',
        (SAUDE.find(function (s) { return s[0] === saudeDe(p.ultimo_uso); }) || [])[1], p.ultimo_uso ? new Date(p.ultimo_uso).toLocaleString('pt-BR') : '',
        data(p.criado_em), p.dias_ativos_30, p.aberturas_30, p.escalas_30, p.confirmou_30, p.sem_resposta, p.ensaiei_30, p.gravacoes_30, p.gravacoes, p.mensagens_30,
        p.musicas_criadas, (p.celulares || []).join(' / '), etapaNome(p.etapa || 'novo'), (p.etiquetas || []).join(' / '), p.proximo_contato || '', p.notas];
    });
    var csv = '﻿' + [cab].concat(linhas).map(function (r) { return r.map(function (c) { c = c === null || c === undefined ? '' : String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(';'); }).join('\n');
    var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'crm-pessoas-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ Ficha de uma pessoa
  async function abrirFicha(id) {
    C.ficha = { id: id, det: null, nota: { tipo: 'whatsapp', texto: '' } };
    render();
    var r = await sb.rpc('admin_crm_pessoa', { _id: id });
    if (!C.ficha || C.ficha.id !== id) return;
    C.ficha.det = r.error ? { erro: r.error.message } : r.data;
    render();
  }
  function fichaView() {
    var F = C.ficha, p = C.pessoas.find(function (x) { return x.id === F.id; });
    if (!p) return null;
    var ed = F.ed || (F.ed = { etapa: p.etapa || 'novo', etiquetas: (p.etiquetas || []).join(', '), proximo: p.proximo_contato || '' });
    function fechar() { C.ficha = null; render(); }
    var det = F.det;
    var mapa = null;
    if (det && det.dias) {
      var porDia = {}; det.dias.forEach(function (d) { porDia[d.dia] = (porDia[d.dia] || 0) + d.aberturas; });
      var cels = [];
      for (var i = 89; i >= 0; i--) {
        var dt = new Date(Date.now() - i * DIA), k = dt.toISOString().slice(0, 10), n = porDia[k] || 0;
        cels.push(h('i', { class: n ? (n > 3 ? 'n3' : n > 1 ? 'n2' : 'n1') : '', title: dt.toLocaleDateString('pt-BR') + (n ? ': abriu ' + n + 'x' : ': não abriu') }));
      }
      mapa = h('div', { class: 'crm-mapa', role: 'img', 'aria-label': 'Dias em que abriu o app nos últimos 90 dias' }, cels);
    }
    return h('div', { class: 'crm-fundo', onclick: function (e) { if (e.target.classList.contains('crm-fundo')) fechar(); }, onkeydown: function (e) { if (e.key === 'Escape') fechar(); } },
      h('aside', { class: 'crm-ficha', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ficha de ' + p.nome },
        h('div', { class: 'crm-ficha-top' },
          h('div', { class: 'grow', style: { minWidth: 0 } },
            h('h2', { class: 'ell' }, p.nome, p.lider ? h('span', { class: 'crm-lider', title: 'Líder', html: icon('crown', 15) }) : null),
            h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, saudeChip(p.ultimo_uso), h('span', { class: 'muted small' }, 'último uso ' + haDias(p.ultimo_uso)))),
          h('button', { class: 'crm-x', 'aria-label': 'Fechar', html: icon('x', 20), onclick: fechar })),
        h('div', { class: 'crm-ficha-corpo' },
          h('div', { class: 'crm-contato' },
            h('button', { class: 'btn crm-btn', onclick: function () { irComunicar([p], { app: true, push: true, email: false }); } }, ic('send', 15), 'Recado no app'),
            h('button', { class: 'btn2 crm-btn', disabled: !!C.semEmail[p.id], title: C.semEmail[p.id] ? 'Esta pessoa não quer receber e-mails' : null, onclick: function () { irComunicar([p], { app: false, push: false, email: true }); } }, ic('mail', 15), 'E-mail'),
            h('button', { class: 'btn2 crm-btn', title: 'Copiar o e-mail', onclick: function () { copiarEmails([p]); } }, ic('copy', 15), p.email)),
          h('label', { class: 'row small', style: { gap: '8px' } },
            h('input', { type: 'checkbox', checked: !!C.semEmail[p.id], onchange: async function (e) {
              var on = e.target.checked;
              var r = await sb.rpc('admin_crm_sem_email', { _user: p.id, _sem: on });
              if (r.error) { e.target.checked = !on; toast(/admin_crm_/.test(r.error.message) ? 'Rode a migração 0052 no Supabase.' : r.error.message); return; }
              if (on) C.semEmail[p.id] = true; else delete C.semEmail[p.id];
              toast(on ? 'Anotado: não recebe mais e-mails do CRM.' : 'Voltou a receber e-mails do CRM.'); render();
            } }), 'Não quer receber e-mails (pediu para sair)'),
          h('dl', { class: 'crm-dados' },
            dado('Conta criada', data(p.criado_em) + ' (' + haDias(p.criado_em) + ')'),
            dado('Último login', p.ultimo_login ? dataHora(p.ultimo_login) : '—'),
            dado('Bandas', (p.bandas || []).length ? (p.bandas || []).map(function (b) { return b.nome + ' · ' + planoNome(b.plano) + (b.papel === 'leader' ? ' · líder' : ''); }).join('\n') : 'Nenhuma'),
            dado('Funções', [].concat.apply([], (p.bandas || []).map(function (b) { return b.funcoes || []; })).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') || '—'),
            dado('Onde usa', ((p.plataformas || []).map(function (x) { return x === 'ios' ? 'iPhone' : x === 'android' ? 'Android' : 'Site'; }).join(', ') || '—') + (p.versao ? ' · versão ' + p.versao : '')),
            dado('Notificação', (p.celulares || []).length ? 'Ligada (' + p.celulares.map(function (c) { return c === 'ios' ? 'iPhone' : 'Android'; }).join(', ') + ')' : 'Não ligada')),
          h('div', { class: 'crm-mini' },
            mini('Dias de uso no mês', p.dias_ativos_30), mini('Aberturas no mês', p.aberturas_30), mini('Escalas no mês', p.escalas_30),
            mini('Confirmou', p.confirmou_30), mini('Sem resposta', p.sem_resposta), mini('Ensaiei', p.ensaiei_30),
            mini('Gravações no mês', p.gravacoes_30), mini('Mensagens no mês', p.mensagens_30), mini('Músicas criadas', p.musicas_criadas)),
          h('section', null, h('h3', null, 'Aberturas nos últimos 90 dias'), mapa || h('div', { class: 'muted small' }, det ? 'Sem registro ainda.' : 'Carregando…')),
          h('section', { class: 'crm-acomp' }, h('h3', null, 'Acompanhamento'),
            h('label', { class: 'crm-sel' }, h('span', { class: 'muted small' }, 'Etapa'),
              h('select', { onchange: function (e) { ed.etapa = e.target.value; } }, ETAPAS.map(function (x) { return h('option', { value: x[0], selected: x[0] === ed.etapa }, x[1]); }))),
            h('label', { class: 'crm-sel' }, h('span', { class: 'muted small' }, 'Próximo contato'),
              h('input', { class: 'crm-in', type: 'date', value: ed.proximo, onchange: function (e) { ed.proximo = e.target.value; } })),
            h('label', { class: 'crm-sel crm-largo' }, h('span', { class: 'muted small' }, 'Etiquetas (separe com vírgula)'),
              h('input', { class: 'crm-in', value: ed.etiquetas, placeholder: 'ex.: pastor, indicou outra banda, quer o plano Igreja', oninput: function (e) { ed.etiquetas = e.target.value; } })),
            h('button', { class: 'btn crm-btn', onclick: async function (e) {
              e.target.disabled = true;
              var r = await sb.rpc('admin_crm_salvar', { _user: p.id, _etapa: ed.etapa, _etiquetas: ed.etiquetas.split(',').map(function (t) { return t.trim(); }).filter(Boolean), _proximo: ed.proximo || null });
              e.target.disabled = false;
              if (r.error) { toast(r.error.message); return; }
              p.etapa = ed.etapa; p.proximo_contato = ed.proximo || null; p.etiquetas = ed.etiquetas.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
              toast('Acompanhamento salvo.'); render();
            } }, 'Salvar')),
          h('section', null, h('h3', null, 'Anotações'),
            h('div', { class: 'crm-nova' },
              h('select', { 'aria-label': 'Tipo', onchange: function (e) { F.nota.tipo = e.target.value; } }, TIPOS.filter(function (t) { return t[0] !== 'mensagem'; }).map(function (t) { return h('option', { value: t[0], selected: t[0] === F.nota.tipo }, t[1]); })),
              h('textarea', { class: 'crm-in', rows: 2, maxlength: 2000, placeholder: 'O que conversaram, o que ficou combinado…', oninput: function (e) { F.nota.texto = e.target.value; } }),
              h('button', { class: 'btn2 crm-btn', onclick: async function () {
                if (!F.nota.texto.trim()) return;
                var r = await sb.rpc('admin_crm_nota', { _user: p.id, _tipo: F.nota.tipo, _texto: F.nota.texto });
                if (r.error) { toast(r.error.message); return; }
                F.nota.texto = ''; p.notas = (p.notas || 0) + 1; abrirFicha(p.id);
              } }, 'Anotar')),
            det && det.notas ? (det.notas.length ? h('ol', { class: 'crm-linha' }, det.notas.map(function (n) {
              return h('li', null, h('span', { class: 'crm-tipo t-' + n.tipo }, tipoNome(n.tipo)),
                h('div', { class: 'grow' }, h('div', { style: { whiteSpace: 'pre-wrap' } }, n.texto), h('div', { class: 'muted tiny' }, dataHora(n.quando) + ' · ' + n.autor)),
                h('button', { class: 'crm-x', 'aria-label': 'Apagar anotação', html: icon('x', 14), onclick: async function () {
                  if (!confirm('Apagar esta anotação?')) return;
                  await sb.rpc('admin_crm_nota_apagar', { _id: n.id }); p.notas = Math.max(0, (p.notas || 1) - 1); abrirFicha(p.id);
                } }));
            })) : h('div', { class: 'muted small' }, 'Nenhuma anotação ainda.')) : null),
          h('section', null, h('h3', null, 'O que a pessoa fez'),
            !det ? h('div', { class: 'muted small' }, 'Carregando…') : det.erro ? h('div', { class: 'small', style: { color: 'var(--bad)' } }, det.erro)
              : h('ol', { class: 'crm-linha' }, (det.eventos || []).slice(0, 80).map(function (e) {
                return h('li', null, h('span', { class: 'crm-tipo t-' + e.tipo }, { conta: 'Conta', banda: 'Banda', escala: 'Escala', ensaio: 'Ensaio', gravacao: 'Gravação', mensagem: 'Conversa', musica: 'Música' }[e.tipo] || e.tipo),
                  h('div', { class: 'grow' }, h('div', null, e.texto), h('div', { class: 'muted tiny' }, dataHora(e.quando))));
              }))))));
    function dado(k, v) { return [h('dt', null, k), h('dd', { style: { whiteSpace: 'pre-line' } }, v)]; }
    function mini(k, v) { return h('div', null, h('b', { class: 'hi tab' }, num(v)), h('span', { class: 'muted tiny' }, k)); }
  }

  // ------------------------------------------------------------------ Bandas
  function bandasView() {
    var B = C.bandas.slice().sort(function (a, b) { return new Date(b.ultimo_uso || 0) - new Date(a.ultimo_uso || 0); });
    return [h('div', { class: 'muted small' }, B.length + ' bandas. Saúde pelo uso mais recente de qualquer pessoa da banda.'),
      h('div', { class: 'crm-tabela crm-bandas' },
        h('div', { class: 'crm-th' }, h('span', null, 'Banda'), h('span', null, 'Plano'), h('span', null, 'Pessoas'), h('span', null, 'Último uso'),
          h('span', null, 'Repertório'), h('span', null, 'Escalas'), h('span', null, 'No mês'), h('span', null, 'Espaço')),
        B.map(function (b) {
          var pago = b.plano && b.plano !== 'free';
          return h('div', { class: 'crm-tr crm-click', tabindex: '0', role: 'button', onclick: function () { C.aba = 'pessoas'; C.q = b.nome; C.saude = 'todas'; C.filtro = 'todos'; render(); } },
            h('span', { class: 'crm-quem' }, h('span', { class: 'semi hi ell' }, b.nome),
              h('span', { class: 'muted small ell' }, (b.lider_nome || 'Sem líder') + (b.lider_email ? ' · ' + b.lider_email : '')),
              h('span', { class: 'muted tiny' }, 'criada ' + data(b.criada_em))),
            h('span', { class: 'crm-col2' }, h('span', { class: 'adm-plan p-' + b.plano }, planoNome(b.plano)),
              pago && b.situacao_pagamento && b.situacao_pagamento !== 'em_dia' && b.situacao_pagamento !== 'gratis' ? h('span', { class: 'small', style: { color: 'var(--warn)' } }, b.situacao_pagamento) : null,
              b.pago_ate ? h('span', { class: 'muted tiny' }, 'até ' + data(b.pago_ate + 'T12:00:00')) : null),
            h('span', { class: 'crm-col2 tab' }, h('span', null, h('b', { class: 'hi' }, String(b.pessoas)), ' pessoas'), h('span', { class: 'muted small' }, b.ativos_7 + ' na semana · ' + b.ativos_30 + ' no mês')),
            h('span', { class: 'crm-col2' }, saudeChip(b.ultimo_uso), h('span', { class: 'muted small' }, haDias(b.ultimo_uso))),
            h('span', { class: 'crm-col2 tab' }, h('span', null, b.musicas + ' músicas'), h('span', { class: 'muted small' }, b.com_multitrack + ' com multitrack' + (b.da_biblioteca ? ' · ' + b.da_biblioteca + ' da biblioteca' : ''))),
            h('span', { class: 'crm-col2 tab' }, h('span', null, b.escalas_30 + ' no mês · ' + b.escalas_futuras + ' futuras'),
              h('span', { class: 'muted small' }, b.confirmacao_30 === null || b.confirmacao_30 === undefined ? 'sem respostas' : b.confirmacao_30 + '% confirmadas')),
            h('span', { class: 'crm-col2 tab' }, h('span', null, b.gravacoes_30 + ' gravações'), h('span', { class: 'muted small' }, b.mensagens_30 + ' mensagens')),
            h('span', { class: 'crm-col2 tab' }, h('span', null, bytes(b.espaco_usado)), h('span', { class: 'muted small' }, 'de ' + bytes(b.espaco_limite))));
        }))];
  }

  // ------------------------------------------------------------------ Acompanhar
  function listasAcompanhar() {
    var hoje = new Date().toISOString().slice(0, 10), em7 = new Date(Date.now() + 7 * DIA).toISOString().slice(0, 10);
    var P = C.pessoas;
    var pagasParadas = (C.bandas || []).filter(function (b) { return b.plano !== 'free' && (dias(b.ultimo_uso) === null || dias(b.ultimo_uso) > 7); });
    return [
      { id: 'contato', tit: 'Contatos marcados', desc: 'Próximo contato para hoje ou nos próximos 7 dias.',
        itens: P.filter(function (p) { return p.proximo_contato && p.proximo_contato <= em7; }).sort(function (a, b) { return a.proximo_contato < b.proximo_contato ? -1 : 1; }),
        extra: function (p) { return (p.proximo_contato <= hoje ? 'para hoje' : 'em ' + data(p.proximo_contato + 'T12:00:00')); } },
      { id: 'lideres', tit: 'Líderes parados', desc: 'Líderes que não usam há mais de 14 dias: a banda inteira depende deles.',
        itens: P.filter(function (p) { return p.lider && (dias(p.ultimo_uso) === null || dias(p.ultimo_uso) > 14); }),
        extra: function (p) { return 'parado ' + haDias(p.ultimo_uso); } },
      { id: 'sembanda', tit: 'Contas novas sem banda', desc: 'Criaram a conta há mais de 1 dia e ainda não entraram nem criaram banda.',
        itens: P.filter(function (p) { return !(p.bandas || []).length && dias(p.criado_em) >= 1 && dias(p.criado_em) <= 60; }),
        extra: function (p) { return 'conta ' + haDias(p.criado_em); } },
      { id: 'esfriando', tit: 'Começando a esfriar', desc: 'Usavam e pararam entre 8 e 21 dias atrás: o melhor momento para um recado.',
        itens: P.filter(function (p) { return saudeDe(p.ultimo_uso) === 'esfriando' && (p.bandas || []).length; }),
        extra: function (p) { return 'último uso ' + haDias(p.ultimo_uso); } },
      { id: 'resposta', tit: 'Escala sem resposta', desc: 'Estão escaladas em escalas futuras e ainda não confirmaram.',
        itens: P.filter(function (p) { return p.sem_resposta > 0; }).sort(function (a, b) { return b.sem_resposta - a.sem_resposta; }),
        extra: function (p) { return p.sem_resposta + (p.sem_resposta === 1 ? ' escala' : ' escalas'); } },
      { id: 'celular', tit: 'Sem notificação no celular', desc: 'Usam o app mas não recebem avisos: não ficam sabendo de escala nem de conversa.',
        itens: P.filter(function (p) { return !(p.celulares || []).length && saudeDe(p.ultimo_uso) === 'ativa'; }),
        extra: function () { return 'ativa, sem aviso'; } },
      { id: 'pagas', tit: 'Bandas pagas sem uso na semana', desc: 'Estão pagando e ninguém da banda usou nos últimos 7 dias.', bandas: true,
        itens: pagasParadas, extra: function (b) { return 'último uso ' + haDias(b.ultimo_uso); } }];
  }
  function acompanharView() {
    var ls = listasAcompanhar();
    ls = ls.filter(function (L) { return L.itens.length; }).concat(ls.filter(function (L) { return !L.itens.length; }));
    return ls.map(function (L) {
      return h('section', { class: 'crm-painel' },
        h('div', { class: 'crm-tit' }, h('h2', null, L.tit, h('span', { class: 'crm-cont' }, String(L.itens.length))),
          !L.bandas && L.itens.length ? h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn2 crm-btn', onclick: function () { irComunicar(L.itens); } }, ic('send', 15), 'Comunicar com todos')) : null),
        h('div', { class: 'muted small' }, L.desc),
        L.itens.length ? h('div', { class: 'crm-lista' }, L.itens.slice(0, 40).map(function (x) {
          return h('button', { class: 'crm-item', onclick: function () {
            if (L.bandas) { C.aba = 'pessoas'; C.q = x.nome; C.saude = 'todas'; C.filtro = 'todos'; render(); } else abrirFicha(x.id);
          } },
            h('span', { class: 'grow', style: { minWidth: 0, textAlign: 'left' } },
              h('span', { class: 'semi hi ell', style: { display: 'block' } }, x.nome),
              h('span', { class: 'muted small ell', style: { display: 'block' } }, L.bandas ? (x.lider_nome || '') + ' · ' + planoNome(x.plano) : ((x.bandas || []).map(function (b) { return b.nome; }).join(', ') || x.email))),
            h('span', { class: 'small', style: { color: 'var(--warn)', whiteSpace: 'nowrap' } }, L.extra(x)));
        }), L.itens.length > 40 ? h('div', { class: 'muted small' }, 'e mais ' + (L.itens.length - 40)) : null)
          : h('div', { class: 'crm-ok small' }, 'Ninguém aqui agora.'));
    });
  }

  // ------------------------------------------------------------------ Comunicar: recado no app, notificação e e-mail
  // Um lugar só para falar com as pessoas: um grupo montado por filtros (que se combinam) ou pessoas escolhidas.
  // Recado no app = janela ao abrir o app (0050, público "pessoas"); notificação = celular (fila da 0041);
  // e-mail = função `emails` (0052). {nome} vira o primeiro nome em todos.
  var FILTROS = [
    { id: 'papel', tit: 'Papel', ops: [['lider', 'Líderes'], ['liderado', 'Liderados (integrantes)']] },
    { id: 'temp', tit: 'Temperatura', ops: [['ativa', 'Quentes · usaram em 7 dias'], ['esfriando', 'Mornos · 8 a 21 dias'], ['risco', 'Frios · 22 a 45 dias'],
      ['parada', 'Gelados · mais de 45 dias'], ['nunca', 'Nunca usaram']] },
    { id: 'plano', tit: 'Plano', ops: [['pago', 'Banda paga'], ['gratis', 'Só no Grátis'], ['sem_banda', 'Sem banda']] },
    { id: 'situacao', tit: 'Situação', ops: [['nova', 'Conta nova (até 7 dias)'], ['sem_resposta', 'Escala sem resposta'], ['nao_ensaiou', 'Escalados que não marcaram Ensaiei'],
      ['sem_celular', 'Sem notificação no celular'], ['contato', 'Com contato marcado']] },
    { id: 'onde', tit: 'Onde usa', ops: [['android', 'Android'], ['ios', 'iPhone'], ['site', 'Site']] }];
  var FUNCOES = [['ministro', 'Ministro(a)'], ['vocal', 'Vocal'], ['backing_vocal', 'Backing vocal'], ['violao', 'Violão'], ['guitarra', 'Guitarra'], ['baixo', 'Baixo'],
    ['bateria', 'Bateria'], ['teclado', 'Teclado'], ['percussao', 'Percussão'], ['sopro', 'Sopro'], ['cordas', 'Cordas'], ['tecnico_som', 'Técnico(a) de som'], ['projecao', 'Projeção/mídia']];
  function novoCm() {
    var f = {}; FILTROS.forEach(function (s) { f[s.id] = {}; });
    return { modo: 'grupo', f: f, banda: '', funcao: '', etapa: '', etiqueta: '', fora: {}, escolhidas: {}, busca: '',
             canais: { app: true, push: true, email: false }, titulo: '', texto: '', link: '', rotulo: '', enviando: false };
  }
  C.cm = novoCm();

  function casa(p, op) {
    switch (op) {
      case 'lider': return !!p.lider;
      case 'liderado': return (p.bandas || []).length > 0 && !p.lider;
      case 'ativa': case 'esfriando': case 'risco': case 'parada': case 'nunca': return saudeDe(p.ultimo_uso) === op;
      case 'pago': return !!p.plano && p.plano !== 'free';
      case 'gratis': return p.plano === 'free';
      case 'sem_banda': return !(p.bandas || []).length;
      case 'nova': return dias(p.criado_em) !== null && dias(p.criado_em) <= 7;
      case 'sem_resposta': return p.sem_resposta > 0;
      case 'nao_ensaiou': return p.escalas_30 > 0 && !p.ensaiei_30;
      case 'sem_celular': return !(p.celulares || []).length;
      case 'contato': return !!p.proximo_contato;
      case 'android': case 'ios': return (p.plataformas || []).indexOf(op) >= 0 || (p.celulares || []).indexOf(op) >= 0;
      case 'site': return (p.plataformas || []).indexOf('site') >= 0;
    }
    return false;
  }
  /** Quem recebe: no grupo, dentro de cada filtro vale qualquer opção marcada (ou); entre filtros, todas (e). */
  function alvo() {
    var M = C.cm, P = C.pessoas || [];
    if (M.modo === 'pessoas') return P.filter(function (p) { return M.escolhidas[p.id]; });
    return P.filter(function (p) {
      if (M.fora[p.id]) return false;
      for (var i = 0; i < FILTROS.length; i++) {
        var on = Object.keys(M.f[FILTROS[i].id]).filter(function (k) { return M.f[FILTROS[i].id][k]; });
        if (on.length && !on.some(function (op) { return casa(p, op); })) return false;
      }
      if (M.banda && !(p.bandas || []).some(function (b) { return b.id === M.banda; })) return false;
      if (M.funcao && !(p.bandas || []).some(function (b) { return (b.funcoes || []).indexOf(M.funcao) >= 0; })) return false;
      if (M.etapa && (p.etapa || 'novo') !== M.etapa) return false;
      if (M.etiqueta && (p.etiquetas || []).indexOf(M.etiqueta) < 0) return false;
      return true;
    });
  }
  function rotuloAlvo() {
    var M = C.cm;
    if (M.modo === 'pessoas') { var l = alvo(); return l.length === 1 ? l[0].nome : l.length + ' pessoas escolhidas'; }
    var partes = [];
    FILTROS.forEach(function (s) { s.ops.forEach(function (o) { if (M.f[s.id][o[0]]) partes.push(o[1].split(' · ')[0]); }); });
    if (M.banda) { var b = (C.bandas || []).find(function (x) { return x.id === M.banda; }); if (b) partes.push('Banda ' + b.nome); }
    if (M.funcao) partes.push((FUNCOES.find(function (f) { return f[0] === M.funcao; }) || [0, M.funcao])[1]);
    if (M.etapa) partes.push('Etapa ' + etapaNome(M.etapa));
    if (M.etiqueta) partes.push('Etiqueta ' + M.etiqueta);
    return partes.length ? partes.join(' · ') : 'Todas as pessoas';
  }
  /** Abrir a aba Comunicar já com estas pessoas (ficha, marcadas, listas de Acompanhar). */
  function irComunicar(lista, canais) {
    var M = C.cm = Object.assign(novoCm(), { titulo: C.cm.titulo, texto: C.cm.texto, link: C.cm.link, rotulo: C.cm.rotulo });
    M.modo = 'pessoas';
    lista.forEach(function (p) { M.escolhidas[p.id] = true; });
    if (canais) M.canais = canais;
    C.ficha = null; C.aba = 'comunicar'; render(); window.scrollTo(0, 0);
  }
  function comNome(t, nome) {
    var n1 = (nome || '').trim().split(/\s+/)[0] || '';
    if (n1) return (t || '').replace(/\{nome\}/g, n1);
    var s = (t || '').replace(/^\s*\{nome\}[,!:]?\s*/, '').replace(/[,]?\s*\{nome\}/g, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  async function chamarEmails(body) {
    var res = await sb.functions.invoke(FN_EMAILS, { body: body });
    if (res.error) {
      var t = res.error.message;
      try { t = (await res.error.context.json()).error || t; } catch (e) { /* sem corpo */ }
      throw new Error(t);
    }
    return res.data;
  }

  function comunicarView() {
    var M = C.cm;
    var lista = alvo();
    var semMail = lista.filter(function (p) { return C.semEmail[p.id]; }).length;
    var comCel = lista.filter(function (p) { return (p.celulares || []).length; }).length;
    var algumCanal = M.canais.app || M.canais.email;
    var pronto = lista.length && algumCanal && M.titulo.trim() && M.texto.trim() && !M.enviando && (!M.canais.email || !C.emailsErro) && (!M.link.trim() || /^https?:\/\/\S+$/i.test(M.link.trim()));
    var exemplo = (lista[0] && lista[0].nome) || 'Ana';

    // ---- 1. Para quem
    var modoBtn = function (m, t) { return h('button', { class: 'crm-seg2' + (M.modo === m ? ' on' : ''), 'aria-pressed': String(M.modo === m), onclick: function () { M.modo = m; render(); } }, t); };
    var paraQuem;
    if (M.modo === 'grupo') {
      var etiquetas = []; (C.pessoas || []).forEach(function (p) { (p.etiquetas || []).forEach(function (t) { if (etiquetas.indexOf(t) < 0) etiquetas.push(t); }); });
      var selF = function (rot, val, ops, on) {
        return h('label', { class: 'crm-sel' }, h('span', { class: 'muted small' }, rot),
          h('select', { onchange: function (e) { on(e.target.value); M.fora = {}; render(); } }, [h('option', { value: '' }, 'Qualquer')].concat(ops.map(function (o) { return h('option', { value: o[0], selected: o[0] === val }, o[1]); }))));
      };
      paraQuem = [
        FILTROS.map(function (s) {
          return h('div', { class: 'crm-filtro' }, h('div', { class: 'muted small semi' }, s.tit),
            h('div', { class: 'crm-chips' }, s.ops.map(function (o) {
              var on = !!M.f[s.id][o[0]];
              var n = (C.pessoas || []).filter(function (p) { return casa(p, o[0]); }).length;
              return h('button', { class: 'chiptog' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: function () { M.f[s.id][o[0]] = !on; M.fora = {}; render(); } },
                o[1], h('span', { class: 'crm-chip-n' }, String(n)));
            })));
        }),
        h('div', { class: 'crm-sels' },
          selF('Banda', M.banda, (C.bandas || []).slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (b) { return [b.id, b.nome]; }), function (v) { M.banda = v; }),
          selF('Função', M.funcao, FUNCOES, function (v) { M.funcao = v; }),
          selF('Etapa', M.etapa, ETAPAS, function (v) { M.etapa = v; }),
          selF('Etiqueta', M.etiqueta, etiquetas.sort().map(function (t) { return [t, t]; }), function (v) { M.etiqueta = v; })),
        h('div', { class: 'muted tiny' }, 'Dentro de cada linha, vale qualquer opção marcada. Entre as linhas, a pessoa precisa atender a todas. Sem nada marcado: todas as pessoas.'),
        h('button', { class: 'crm-link', onclick: function () { var k = M.canais; C.cm = Object.assign(novoCm(), { titulo: M.titulo, texto: M.texto, link: M.link, rotulo: M.rotulo, canais: k }); render(); } }, 'Limpar os filtros')];
    } else {
      var q = M.busca.trim().toLowerCase();
      var achados = q ? (C.pessoas || []).filter(function (p) { return [p.nome, p.email, (p.bandas || []).map(function (b) { return b.nome; }).join(' ')].some(function (x) { return (x || '').toLowerCase().indexOf(q) >= 0; }); }).slice(0, 12) : [];
      var marcadasPessoas = (C.pessoas || []).filter(function (p) { return C.sel[p.id]; });
      var busca = h('input', { class: 'crm-in', type: 'search', value: M.busca, placeholder: 'Buscar por nome, e-mail ou banda', 'aria-label': 'Buscar pessoas',
        oninput: function (e) { M.busca = e.target.value; var pos = e.target.selectionStart; render(); var i = root.querySelector('.crm-busca-pessoa'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });
      busca.classList.add('crm-busca-pessoa');
      paraQuem = [busca,
        achados.length ? h('div', { class: 'crm-lista' }, achados.map(function (p) {
          var on = !!M.escolhidas[p.id];
          return h('label', { class: 'crm-item' }, h('input', { type: 'checkbox', checked: on, onchange: function () { if (on) delete M.escolhidas[p.id]; else M.escolhidas[p.id] = true; render(); } }),
            h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'semi hi ell', style: { display: 'block' } }, p.nome),
              h('span', { class: 'muted small ell', style: { display: 'block' } }, ((p.bandas || []).map(function (b) { return b.nome; }).join(', ') || 'Sem banda') + ' · ' + p.email)),
            saudeChip(p.ultimo_uso));
        })) : q ? h('div', { class: 'muted small' }, 'Ninguém com esse nome.') : null,
        marcadasPessoas.length ? h('button', { class: 'crm-link', onclick: function () { marcadasPessoas.forEach(function (p) { M.escolhidas[p.id] = true; }); render(); } }, 'Usar as ' + marcadasPessoas.length + ' marcadas na aba Pessoas') : null];
    }
    var quem = h('details', { class: 'crm-quem-lista', open: M.modo === 'pessoas' ? true : null },
      h('summary', null, h('b', { class: 'hi' }, lista.length + (lista.length === 1 ? ' pessoa' : ' pessoas')), h('span', { class: 'muted small' }, ' · ' + rotuloAlvo() + (M.modo === 'grupo' ? ' · toque para ver e tirar alguém' : ''))),
      h('div', { class: 'crm-lista' }, lista.slice(0, 200).map(function (p) {
        return h('div', { class: 'crm-item' },
          h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'semi hi ell', style: { display: 'block' } }, p.nome, p.lider ? h('span', { class: 'crm-lider', html: icon('crown', 12) }) : null),
            h('span', { class: 'muted small ell', style: { display: 'block' } }, ((p.bandas || []).map(function (b) { return b.nome; }).join(', ') || 'Sem banda') + (C.semEmail[p.id] ? ' · não quer e-mails' : ''))),
          saudeChip(p.ultimo_uso),
          h('button', { class: 'crm-x', 'aria-label': 'Tirar ' + p.nome, html: icon('x', 14), onclick: function () { if (M.modo === 'pessoas') delete M.escolhidas[p.id]; else M.fora[p.id] = true; render(); } }));
      }), lista.length > 200 ? h('div', { class: 'muted small' }, 'e mais ' + (lista.length - 200)) : null));

    // ---- 2. Como e o quê
    var canal = function (k, tit, sub, dis) {
      return h('label', { class: 'crm-canal' + (M.canais[k] && !dis ? ' on' : '') + (dis ? ' dis' : '') },
        h('input', { type: 'checkbox', checked: M.canais[k] && !dis, disabled: dis, onchange: function (e) { M.canais[k] = e.target.checked; render(); } }),
        h('span', null, h('b', { class: 'hi' }, tit), h('span', { class: 'muted small', style: { display: 'block' } }, sub)));
    };
    var campo = function (rot, el) { return h('label', { class: 'crm-sel' }, h('span', { class: 'muted small' }, rot), el); };
    var titulo = h('input', { class: 'crm-in', maxlength: 80, value: M.titulo, placeholder: 'Ex.: {nome}, uma novidade para a sua banda', oninput: function (e) { M.titulo = e.target.value; atualiza(); } });
    var texto = h('textarea', { class: 'crm-in', rows: 8, maxlength: 1500, placeholder: 'Oi, {nome}!\n\nEscreva aqui. A assinatura "Equipe Louvor Studio" entra sozinha.', oninput: function (e) { M.texto = e.target.value; atualiza(); } });
    texto.value = M.texto;
    var link = h('input', { class: 'crm-in', value: M.link, placeholder: 'https://… (opcional)', oninput: function (e) { M.link = e.target.value; atualiza(); } });
    var rot = h('input', { class: 'crm-in', maxlength: 40, value: M.rotulo, placeholder: 'Ex.: Ver agora', oninput: function (e) { M.rotulo = e.target.value; atualiza(); } });
    var prevs = h('div', { class: 'crm-prevs' });
    var enviar = h('button', { class: 'btn crm-btn crm-enviar', onclick: mandar });
    var teste = M.canais.email ? h('button', { class: 'btn2 crm-btn', onclick: async function () {
      teste.disabled = true;
      try { var d = await chamarEmails({ action: 'crm', modo: 'teste', assunto: M.titulo, corpo: corpoEmail() }); toast('E-mail de teste enviado para ' + d.para + '.'); }
      catch (e) { toast(e.message); }
      teste.disabled = false;
    } }, 'Mandar e-mail de teste para mim') : null;
    function corpoEmail() { return M.texto.trim() + (M.link.trim() ? '\n\n' + (M.rotulo.trim() || 'Veja') + ': ' + M.link.trim() : ''); }
    function atualiza() {
      var ok = lista.length && algumCanal && M.titulo.trim() && M.texto.trim() && !M.enviando && (!M.canais.email || !C.emailsErro) && (!M.link.trim() || /^https?:\/\/\S+$/i.test(M.link.trim()));
      enviar.disabled = !ok;
      var partes = [];
      if (M.canais.app) partes.push('recado');
      if (M.canais.app && M.canais.push) partes.push('notificação');
      if (M.canais.email) partes.push('e-mail');
      enviar.textContent = M.enviando ? 'Enviando…' : !lista.length ? 'Escolha quem recebe' : !algumCanal ? 'Escolha um canal' : 'Enviar ' + partes.join(' + ') + ' para ' + lista.length + (lista.length === 1 ? ' pessoa' : ' pessoas');
      if (teste) teste.disabled = !M.titulo.trim() || !M.texto.trim() || !!C.emailsErro;
      var t = comNome(M.titulo, exemplo), x = comNome(M.texto, exemplo);
      var pars = x.trim().split(/\n\s*\n/).filter(Boolean);
      prevs.replaceChildren(
        M.canais.app ? h('div', null, h('div', { class: 'muted small semi', style: { marginBottom: '6px' } }, 'Como aparece no app (para ' + exemplo.split(' ')[0] + ')'),
          h('div', { class: 'crm-prev-app' }, h('div', { class: 'semi hi', style: { fontSize: '16px' } }, t || 'Título'),
            h('div', { style: { whiteSpace: 'pre-wrap', margin: '8px 0 10px' } }, x || 'O texto aparece aqui.'),
            h('div', { class: 'muted tiny' }, 'Equipe Louvor Studio'),
            h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '14px', marginTop: '10px' } }, M.link.trim() ? h('span', { class: 'accent semi small' }, M.rotulo.trim() || 'Abrir') : null, h('span', { class: 'accent semi small' }, 'Entendi')))) : null,
        M.canais.app && M.canais.push ? h('div', null, h('div', { class: 'muted small semi', style: { margin: '10px 0 6px' } }, 'Notificação no celular'),
          h('div', { class: 'crm-prev-push' }, h('span', { class: 'crm-prev-ic', html: icon('lines', 14) }), h('span', { class: 'grow', style: { minWidth: 0 } },
            h('b', { class: 'ell', style: { display: 'block' } }, t || 'Título'), h('span', { class: 'small ell', style: { display: 'block' } }, x.replace(/\s+/g, ' ').slice(0, 180) || 'Texto')))) : null,
        M.canais.email ? h('div', null, h('div', { class: 'muted small semi', style: { margin: '10px 0 6px' } }, 'Como chega por e-mail'),
          h('div', { class: 'crm-email' },
            h('div', { class: 'crm-email-cab' }, h('span', { class: 'muted small' }, 'De: Louvor Studio <contato@louvorstudio.app.br>'), h('b', null, t || 'Assunto')),
            h('div', { class: 'crm-email-corpo' }, (pars.length ? pars : ['O texto aparece aqui.']).map(function (s) { return h('p', null, s); }),
              M.link.trim() ? h('p', null, (M.rotulo.trim() || 'Veja') + ': ', h('u', null, M.link.trim())) : null,
              h('p', null, 'Deus abençoe,', h('br'), h('b', null, 'Equipe Louvor Studio'))),
            h('div', { class: 'crm-email-rod' }, 'Você recebe este e-mail porque tem uma conta no Louvor Studio. Para não receber mais, responda este e-mail com a palavra SAIR.'))) : null);
    }
    async function mandar() {
      var l = alvo(), ids = l.map(function (p) { return p.id; });
      var resumo = [];
      if (M.canais.app) resumo.push('recado no app' + (M.canais.push ? ' com notificação' : ''));
      if (M.canais.email) resumo.push('e-mail (' + (l.length - semMail) + ' pessoas' + (semMail ? '; ' + semMail + ' pediram para não receber' : '') + ')');
      if (!confirm('Enviar "' + M.titulo.trim() + '" para ' + l.length + (l.length === 1 ? ' pessoa' : ' pessoas') + ' por ' + resumo.join(' e ') + '?\n\nDepois de enviado, não volta atrás.')) return;
      M.enviando = true; atualiza();
      var feito = [];
      try {
        if (M.canais.app) {
          var r = await sb.rpc('admin_aviso_enviar', { _title: M.titulo, _body: M.texto, _link_url: M.link.trim() || null, _link_label: M.rotulo.trim() || null,
            _publico: 'pessoas', _org: null, _push: !!M.canais.push, _para: ids });
          if (r.error) throw new Error(/admin_aviso_enviar|_para|publico/.test(r.error.message) ? 'Rode as migrações 0050 e 0052 no Supabase.' : r.error.message);
          await sb.rpc('admin_crm_notas_lote', { _ids: ids, _tipo: 'mensagem', _texto: 'Recado no app' + (M.canais.push ? ' + notificação' : '') + ': ' + M.titulo.trim() });
          feito.push('recado para ' + l.length);
        }
        if (M.canais.email) {
          var env = 0, fal = 0, comMail = l.filter(function (p) { return !C.semEmail[p.id]; });
          for (var i = 0; i < comMail.length; i += 400) {
            var d = await chamarEmails({ action: 'crm', modo: 'enviar', assunto: M.titulo, corpo: corpoEmail(), grupo: rotuloAlvo(), ids: comMail.slice(i, i + 400).map(function (p) { return p.id; }) });
            env += d.enviados || 0; fal += (d.falhas || []).length;
          }
          feito.push(env + ' e-mails' + (fal ? ' (' + fal + ' com erro)' : ''));
        }
        toast('Enviado: ' + feito.join(' e ') + '.');
        M.titulo = ''; M.texto = ''; M.link = ''; M.rotulo = '';
      } catch (e) {
        toast((feito.length ? 'Enviado: ' + feito.join(' e ') + '. ' : '') + 'Erro: ' + e.message);
      }
      M.enviando = false;
      await recarregar();
    }
    setTimeout(atualiza, 0);

    // ---- Histórico (recados e e-mails juntos)
    var hist = [].concat((C.avisos || []).map(function (a) { return { tipo: 'recado', quando: a.created_at, a: a }; }),
      (C.emails || []).map(function (m) { return { tipo: 'email', quando: m.created_at, m: m }; }))
      .sort(function (x, y) { return new Date(y.quando) - new Date(x.quando); }).slice(0, 60);
    var PUB = { todos: 'Todos', lideres: 'Líderes', pagos: 'Bandas pagas', gratis: 'Grátis', banda: 'Uma banda', pessoas: 'Pessoas escolhidas' };

    return [
      C.emailsErro && M.canais.email ? h('div', { class: 'crm-aviso' }, C.emailsErro) : null,
      h('div', { class: 'crm-com' },
        h('section', { class: 'crm-painel' },
          h('div', { class: 'crm-tit' }, h('h2', null, '1. Para quem')),
          h('div', { class: 'crm-seg2s', role: 'group' }, modoBtn('grupo', 'Um grupo'), modoBtn('pessoas', 'Escolher pessoas')),
          paraQuem, quem),
        h('section', { class: 'crm-painel' },
          h('div', { class: 'crm-tit' }, h('h2', null, '2. Por onde e o quê')),
          h('div', { class: 'crm-canais' },
            canal('app', 'Recado no app', 'Janela ao abrir o app, uma vez só'),
            canal('push', 'Notificação no celular', M.canais.app ? comCel + ' de ' + lista.length + ' têm notificação ligada' : 'Vai junto com o recado', !M.canais.app),
            canal('email', 'E-mail', (lista.length - semMail) + ' de ' + lista.length + ' recebem' + (semMail ? ' (' + semMail + ' pediram para sair)' : ''))),
          campo(M.canais.email ? 'Título / assunto do e-mail' : 'Título', titulo),
          campo('Texto (deixe uma linha em branco entre os parágrafos)', texto),
          h('div', { class: 'crm-sels', style: { gridTemplateColumns: '2fr 1fr' } }, campo('Link (opcional)', link), campo('Texto do botão', rot)),
          h('div', { class: 'muted tiny' }, 'Escreva {nome} onde quiser o primeiro nome de cada pessoa. Sai sempre como Louvor Studio, assinado "Equipe Louvor Studio".'),
          prevs,
          h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, teste, enviar))),
      h('section', { class: 'crm-painel' },
        h('div', { class: 'crm-tit' }, h('h2', null, 'Enviados'), h('span', { class: 'muted small' }, 'recados e e-mails; cada envio também fica anotado na ficha de quem recebeu')),
        hist.length ? h('div', { class: 'crm-lista' }, hist.map(function (x) {
          if (x.tipo === 'recado') {
            var a = x.a;
            return h('div', { class: 'crm-item', style: { opacity: a.ativo ? 1 : 0.6 } },
              h('span', { class: 'crm-tipo t-mensagem' }, a.com_push ? 'Recado + notif.' : 'Recado'),
              h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'semi hi ell', style: { display: 'block' } }, a.title + (a.ativo ? '' : ' (encerrado)')),
                h('span', { class: 'muted small' }, dataHora(a.created_at) + ' · ' + (PUB[a.publico] || a.publico) + (a.banda ? ': ' + a.banda : '') + ' · viram ' + a.vistos + ' de ' + a.alvo)),
              h('button', { class: 'btn2 crm-btn', onclick: async function () {
                if (a.ativo && !confirm('Encerrar "' + a.title + '"? Quem ainda não viu deixa de ver.')) return;
                var r = await sb.rpc('admin_aviso_ativo', { _id: a.id, _ativo: !a.ativo });
                if (r.error) toast(r.error.message); else recarregar();
              } }, a.ativo ? 'Encerrar' : 'Reativar'));
          }
          var m = x.m;
          return h('details', { class: 'crm-enviado' },
            h('summary', null, h('span', { class: 'crm-tipo t-email' }, 'E-mail'),
              h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'semi hi ell', style: { display: 'block' } }, m.assunto),
                h('span', { class: 'muted small' }, dataHora(m.created_at) + ' · ' + (m.grupo || '') + ' · ' + m.enviados + ' de ' + m.pessoas + ' enviados' + (m.falhas ? ' · ' + m.falhas + ' com erro' : '')))),
            h('div', { class: 'small', style: { whiteSpace: 'pre-wrap', padding: '6px 0 10px', color: 'var(--text)' } }, m.corpo));
        })) : h('div', { class: 'muted small' }, 'Nada enviado ainda.'))];
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var m = document.querySelector('.crm-fundo .crm-modal');
    if (m) { m.parentNode.remove(); return; }
    if (C.ficha) { C.ficha = null; render(); }
  });

  load();
})();
