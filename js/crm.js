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
            q: '', saude: 'todas', etapa: 'todas', filtro: 'todos', ordem: 'uso', sel: {}, ficha: null };

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
    render();
  }

  // ------------------------------------------------------------------ Tela
  function render() {
    var abas = [['geral', 'Visão geral'], ['pessoas', 'Pessoas'], ['bandas', 'Bandas'], ['acompanhar', 'Acompanhar']];
    var pend = C.pessoas ? listasAcompanhar().reduce(function (a, l) { return a + l.itens.length; }, 0) : 0;
    var corpo = C.erro ? h('div', { class: 'crm-vazio' }, h('div', { class: 'semi hi' }, 'Não deu para carregar o CRM'), h('div', { class: 'muted' }, C.erro))
      : !C.pessoas ? h('div', { class: 'crm-esqueleto' }, [1, 2, 3, 4].map(function () { return h('div'); }))
      : C.aba === 'geral' ? visaoGeral() : C.aba === 'pessoas' ? pessoasView() : C.aba === 'bandas' ? bandasView() : acompanharView();
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
          marcadas.length ? h('button', { class: 'btn crm-btn', onclick: function () { compor(marcadas); } }, ic('send', 15), 'Mensagem no app') : null,
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

  // Mensagem no app para as pessoas marcadas (0050, público "pessoas")
  function compor(l) {
    var f = { title: '', body: '', push: true, busy: false };
    var fundo = h('div', { class: 'crm-fundo', onclick: function (e) { if (e.target === fundo && !f.busy) fundo.remove(); } });
    var titulo = h('input', { class: 'crm-in', maxlength: 80, placeholder: 'Título (ex.: Sentimos sua falta!)', oninput: function (e) { f.title = e.target.value; marca(); } });
    var texto = h('textarea', { class: 'crm-in', maxlength: 1500, rows: 6, placeholder: 'O que você quer dizer', oninput: function (e) { f.body = e.target.value; marca(); } });
    var enviar = h('button', { class: 'btn', disabled: true, onclick: async function () {
      f.busy = true; marca();
      var r = await sb.rpc('admin_aviso_enviar', { _title: f.title, _body: f.body, _link_url: null, _link_label: null, _publico: 'pessoas', _org: null,
        _push: f.push, _para: l.map(function (p) { return p.id; }) });
      if (r.error) { f.busy = false; marca(); toast(/admin_aviso_enviar|_para/.test(r.error.message) ? 'Rode a migração 0050 (versão nova) no Supabase.' : r.error.message); return; }
      // fica registrado na ficha de cada pessoa
      await Promise.all(l.map(function (p) { return sb.rpc('admin_crm_nota', { _user: p.id, _tipo: 'mensagem', _texto: 'Mensagem no app: ' + f.title.trim() }); }));
      fundo.remove(); toast('Mensagem enviada para ' + l.length + (l.length === 1 ? ' pessoa.' : ' pessoas.')); C.sel = {}; recarregar();
    } }, 'Enviar para ' + l.length);
    function marca() { enviar.disabled = f.busy || !f.title.trim() || !f.body.trim(); enviar.textContent = f.busy ? 'Enviando…' : 'Enviar para ' + l.length; }
    fundo.appendChild(h('div', { class: 'crm-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mensagem no app' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h2', null, 'Mensagem no app'),
        h('button', { class: 'crm-x', 'aria-label': 'Fechar', html: icon('x', 18), onclick: function () { if (!f.busy) fundo.remove(); } })),
      h('div', { class: 'muted small' }, 'Para ' + l.slice(0, 4).map(function (p) { return p.nome; }).join(', ') + (l.length > 4 ? ' e mais ' + (l.length - 4) : '') +
        '. Aparece numa janela quando abrirem o app, uma vez só, assinada "Equipe Louvor Studio".'),
      titulo, texto,
      h('label', { class: 'row small', style: { gap: '8px' } }, h('input', { type: 'checkbox', checked: true, onchange: function (e) { f.push = e.target.checked; } }), 'Mandar também como notificação no celular'),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '8px' } }, h('button', { class: 'btn2', onclick: function () { if (!f.busy) fundo.remove(); } }, 'Cancelar'), enviar)));
    document.body.appendChild(fundo);
    titulo.focus();
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
            h('a', { class: 'btn2 crm-btn', href: 'mailto:' + p.email + '?subject=' + encodeURIComponent('Louvor Studio') }, ic('mail', 15), p.email),
            h('button', { class: 'btn2 crm-btn', onclick: function () { compor([p]); } }, ic('send', 15), 'Mensagem no app')),
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
          !L.bandas && L.itens.length ? h('button', { class: 'btn2 crm-btn', onclick: function () { compor(L.itens); } }, ic('send', 15), 'Mensagem para todos') : null),
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

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var m = document.querySelector('.crm-fundo .crm-modal');
    if (m) { m.parentNode.remove(); return; }
    if (C.ficha) { C.ficha = null; render(); }
  });

  load();
})();
