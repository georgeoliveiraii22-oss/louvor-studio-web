// Louvor Studio (web) — os planos: valores, links de assinatura e a seção que mostra tudo.
// Um lugar só: a página de entrada (landing.js) e a página louvorstudio.app.br/planos/ usam este arquivo.
// O app Android mostra o mesmo (data/Planos.kt): mudou um valor aqui, mude lá também.
// Não depende do resto do site (funciona sozinho na página /planos/).
(function () {
  'use strict';

  var CONTATO = 'contato@louvorstudio.app.br';
  var GB = 1073741824;
  var MUSICAS_POR_GB = 10; // estimativa: uma multitrack completa ocupa em média 100 MB

  // id = o valor de organizations.plan no banco.
  var PLANOS = [
    { id: 'free', nome: 'Grátis', para: 'Para conhecer e começar.', pessoas: 8, gb: 1, mensal: 0 },
    { id: 'banda', nome: 'Banda', para: 'Para a banda da igreja.', pessoas: 20, gb: 20, mensal: 29.90 },
    { id: 'ministerio', nome: 'Ministério', para: 'Para o ministério com várias equipes.', pessoas: 40, gb: 60, mensal: 49.90, destaque: true },
    { id: 'igreja', nome: 'Igreja', para: 'Para a igreja inteira, sem limite de gente.', pessoas: 0, gb: 150, mensal: 89.90 }
  ];
  var EXTRA = { id: 'extra', nome: 'Espaço extra', gb: 50, mensal: 14.90 };
  var MESES_PAGOS_NO_ANO = 10; // no anual, paga 10 meses e usa 12

  // Links de pagamento do Asaas: quando existirem, é só colar aqui (mensal e anual de cada plano).
  // Enquanto estiver vazio, o botão Assinar abre um e-mail pronto para o contato@.
  var CHECKOUT = {
    banda: { mensal: '', anual: '' },
    ministerio: { mensal: '', anual: '' },
    igreja: { mensal: '', anual: '' },
    extra: { mensal: '', anual: '' }
  };

  function reais(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');
  }
  function preco(p, ciclo) {
    if (!p.mensal) return { valor: 'R$ 0', nota: 'Para sempre, sem cartão.' };
    if (ciclo === 'anual') {
      var ano = p.mensal * MESES_PAGOS_NO_ANO;
      return { valor: reais(Math.round(ano / 12 * 100) / 100), nota: reais(ano) + ' por ano. Paga 10 meses, usa 12.' };
    }
    return { valor: reais(p.mensal), nota: 'Cobrado todo mês.' };
  }
  function pessoas(p) { return p.pessoas ? 'Até ' + p.pessoas + ' pessoas' : 'Pessoas sem limite'; }
  function musicas(p) {
    var n = p.gb * MUSICAS_POR_GB;
    return 'Cerca de ' + n.toLocaleString('pt-BR') + ' músicas com multitrack';
  }
  function link(p, ciclo) {
    var url = CHECKOUT[p.id] && CHECKOUT[p.id][ciclo];
    if (url) return url;
    var qual = p.id === 'extra' ? 'o Espaço extra (+50 GB)' : 'o plano ' + p.nome;
    var assunto = 'Quero assinar ' + qual + (ciclo === 'anual' ? ' (anual)' : ' (mensal)');
    var corpo = ['Olá! Quero assinar ' + qual + ', pagando ' + (ciclo === 'anual' ? 'por ano' : 'por mês') + '.', '',
      'Nome da banda:', 'E-mail da minha conta no Louvor Studio:', ''].join('\n');
    return 'mailto:' + CONTATO + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
  }

  // ------------------------------------------------------------------ Desenho
  var PATHS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'
  };
  function svg(name, size) {
    var s = size || 18;
    return '<svg class="i" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PATHS[name] + '</svg>';
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /**
   * A seção de planos, pronta para pôr na página.
   * o.comecar: o que o botão "Começar grátis" faz (função) ou para onde leva (endereço).
   * o.atual: id do plano da banda (vem do app), para marcar "Seu plano".
   */
  function secao(o) {
    o = o || {};
    var ciclo = 'mensal';
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sec = el('section', 'planos');
    sec.id = 'planos';
    var wrap = el('div', 'wrap');
    sec.appendChild(wrap);

    var head = el('div', 'phead');
    head.appendChild(el('h2', null, 'Planos que crescem com a banda'));
    head.appendChild(el('p', null, 'Todos os recursos estão em todos os planos. O que muda é quanta gente cabe na banda e o espaço para as músicas. Tem plano grátis.'));
    wrap.appendChild(head);

    // Mensal ou anual
    var seg = el('div', 'ciclo');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Como pagar');
    var thumb = el('span', 'thumb');
    thumb.setAttribute('aria-hidden', 'true');
    seg.appendChild(thumb);
    var bMensal = el('button', 'on', 'Mensal');
    var bAnual = el('button', null, 'Anual <span class="off">2 meses grátis</span>');
    [bMensal, bAnual].forEach(function (b, i) {
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', i ? 'false' : 'true');
      b.onclick = function () { mudar(i ? 'anual' : 'mensal'); };
      seg.appendChild(b);
    });
    wrap.appendChild(seg);

    var grid = el('div', 'pgrid');
    var vivos = [];
    var maxGb = PLANOS[PLANOS.length - 1].gb;
    PLANOS.forEach(function (p) {
      var card = el('article', 'plano' + (p.destaque ? ' destaque' : '') + (o.atual === p.id ? ' atual' : ''));
      var topo = el('div', 'ptop');
      topo.appendChild(el('h3', null, esc(p.nome)));
      if (o.atual === p.id) topo.appendChild(el('span', 'chip seu', 'Seu plano'));
      else if (p.destaque) topo.appendChild(el('span', 'chip', 'Recomendado'));
      card.appendChild(topo);
      card.appendChild(el('p', 'para', esc(p.para)));

      var pr = el('div', 'preco');
      var valor = el('span', 'v');
      var unid = el('span', 'u', p.mensal ? '/mês' : '');
      pr.appendChild(valor); pr.appendChild(unid);
      card.appendChild(pr);
      var nota = el('p', 'pnota');
      card.appendChild(nota);

      var specs = el('ul', 'specs');
      specs.appendChild(el('li', null, svg('users') + '<span>' + pessoas(p) + '</span>'));
      specs.appendChild(el('li', null, svg('cloud') + '<span><b>' + p.gb + ' GB</b> na nuvem</span>'));
      specs.appendChild(el('li', null, svg('music') + '<span>' + musicas(p) + '</span>'));
      card.appendChild(specs);

      // Medidor do espaço: compara os planos entre si (raiz quadrada, para o Grátis não sumir).
      var meter = el('div', 'meter');
      meter.setAttribute('aria-hidden', 'true');
      var fill = el('i');
      fill.style.transform = 'scaleX(' + Math.max(0.04, Math.sqrt(p.gb / maxGb)).toFixed(3) + ')';
      meter.appendChild(fill);
      card.appendChild(meter);

      var cta;
      if (o.atual === p.id) {
        cta = el('span', 'btn2 full pcta is-current', 'É o plano da sua banda');
      } else if (!p.mensal) {
        cta = el(typeof o.comecar === 'function' ? 'button' : 'a', 'btn2 full pcta', 'Começar grátis');
        if (typeof o.comecar === 'function') { cta.type = 'button'; cta.onclick = o.comecar; }
        else cta.href = o.comecar || '/';
      } else {
        cta = el('a', 'btn full pcta', 'Assinar' + svg('arrow', 18));
        cta.setAttribute('aria-label', 'Assinar o plano ' + p.nome);
      }
      card.appendChild(cta);
      grid.appendChild(card);
      vivos.push({ p: p, valor: valor, nota: nota, cta: cta, unid: unid });
    });
    wrap.appendChild(grid);

    // Espaço extra
    var extra = el('div', 'pextra');
    extra.appendChild(el('span', 'xi', svg('plus', 22)));
    var xt = el('div', 'xt');
    xt.appendChild(el('h3', null, 'Espaço extra'));
    xt.appendChild(el('p', null, 'Mais 50 GB na nuvem (cerca de 500 músicas), em qualquer plano pago. Some quantos precisar.'));
    extra.appendChild(xt);
    var xp = el('div', 'xp');
    var xValor = el('span', 'v');
    xp.appendChild(xValor);
    xp.appendChild(el('span', 'u', '/mês'));
    var xNota = el('p', 'pnota');
    var xpw = el('div', 'xpw');
    xpw.appendChild(xp); xpw.appendChild(xNota);
    extra.appendChild(xpw);
    var xCta = el('a', 'btn2 pcta', 'Pedir espaço extra');
    extra.appendChild(xCta);
    wrap.appendChild(extra);

    // Tudo incluído
    var tudo = el('div', 'ptudo');
    tudo.appendChild(el('h3', null, 'Em todos os planos'));
    var lista = el('ul');
    ['Escalas, agenda do mês e Confirmar ou Não posso', 'Repertório com tom, BPM, letra e partes', 'Estúdio com a multitrack: volume, mudo, solo e repetir parte',
      'Gravar a sua voz por cima (app Android)', 'Vozes separadas por naipe, liberadas pelo líder', 'Conversa da banda, de cada escala e mural de avisos',
      'No celular e no computador'].forEach(function (t) { lista.appendChild(el('li', null, svg('check', 16) + '<span>' + t + '</span>')); });
    tudo.appendChild(lista);
    wrap.appendChild(tudo);

    var fino = el('div', 'pfino');
    fino.appendChild(el('p', null, 'Se um pagamento atrasar, a banda continua usando por mais 7 dias. Depois disso, fica só para ouvir e consultar até acertar. Nada é apagado.'));
    fino.appendChild(el('p', null, 'A quantidade de músicas é uma estimativa: uma multitrack completa ocupa, em média, uns 100 MB.'));
    fino.appendChild(el('p', null, 'Dúvidas sobre os planos: <a href="mailto:' + CONTATO + '">' + CONTATO + '</a>'));
    wrap.appendChild(fino);

    function pintar(animar) {
      vivos.forEach(function (x) {
        var pc = preco(x.p, ciclo);
        x.valor.textContent = pc.valor;
        x.nota.textContent = pc.nota;
        if (x.p.mensal && x.cta.tagName === 'A') x.cta.href = link(x.p, ciclo);
        if (animar && x.p.mensal && !reduce) {
          x.valor.animate([{ opacity: 0.35, filter: 'blur(3px)', transform: 'translateY(4px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }],
            { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
        }
      });
      var xpc = preco(EXTRA, ciclo);
      xValor.textContent = xpc.valor;
      xNota.textContent = xpc.nota;
      xCta.href = link(EXTRA, ciclo);
    }
    function mudar(c) {
      if (c === ciclo) return;
      ciclo = c;
      bMensal.className = c === 'mensal' ? 'on' : '';
      bAnual.className = c === 'anual' ? 'on' : '';
      bMensal.setAttribute('aria-checked', String(c === 'mensal'));
      bAnual.setAttribute('aria-checked', String(c === 'anual'));
      seg.classList.toggle('anual', c === 'anual');
      pintar(true);
    }
    pintar(false);
    return sec;
  }

  function achar(id) {
    return PLANOS.filter(function (p) { return p.id === id; })[0] || PLANOS[0];
  }

  window.LSPlanos = { PLANOS: PLANOS, EXTRA: EXTRA, CHECKOUT: CHECKOUT, GB: GB, secao: secao, achar: achar, reais: reais };
})();
