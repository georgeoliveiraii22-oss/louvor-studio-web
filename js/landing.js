// Louvor Studio (web) — página de entrada para quem ainda não entrou (estrutura inspirada no moises.ai):
// topo com Entrar, abertura com as fotos reais do app, um mixer de exemplo que toca no navegador,
// os recursos, como começar, perguntas e o fecho. Nada toca sozinho: só pelo botão Tocar.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui;
  var A = L.auth;

  function goEntry(e) { stopDemo(); S.entry = e; window.scrollTo(0, 0); L.render(); }
  function jump(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }

  // Pose 3D de um aparelho. Sempre as mesmas funções, na mesma ordem: o Motion interpola número a número.
  function tf(p) {
    p = p || {};
    return 'perspective(1600px) translate3d(' + (p.x || 0) + 'px, ' + (p.y || 0) + 'px, ' + (p.z || 0) + 'px) rotateX(' + (p.rx || 0) + 'deg) rotateY(' +
      (p.ry || 0) + 'deg) rotateZ(' + (p.rz || 0) + 'deg) scale(' + (p.s === undefined ? 1 : p.s) + ')';
  }
  /** Embrulho de um aparelho: o de fora anda com a rolagem (profundidade), o de dentro tem a pose e a entrada. */
  function dev(inner, o) {
    inner.style.transform = tf(o.pose);
    inner._anim = { pose: o.pose, from: o.from, delay: o.delay || 0 };
    return h('div', { class: 'dev' + (o.cls ? ' ' + o.cls : ''), 'data-depth': String(o.depth || 0) }, inner);
  }
  // Celular de verdade: Pixel 6 com a foto do app dentro (moldura oficial do Android Studio, licença Apache 2.0).
  function phone(src, alt, o) {
    return dev(h('img', { class: 'device', src: src, alt: alt, loading: 'lazy', width: '640', height: '1351' }), o || {});
  }
  // Computador: a janela do navegador, com o endereço do site.
  function win(src, alt, o) {
    return dev(h('div', { class: 'screenwin' },
      h('div', { class: 'winbar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('span', { class: 'url' }, ic('Lock', 12), 'louvorstudio · no navegador')),
      h('img', { src: src, alt: alt, loading: 'lazy', width: '1440', height: '900' })), Object.assign({ cls: 'winwrap' }, o || {}));
  }

  // Vídeo de apresentação: quando existir, coloque o arquivo em video/apresentacao.mp4 (ou um link do YouTube) aqui.
  var VIDEO = { src: 'video/apresentacao.mp4', poster: 'video/apresentacao.jpg' };

  function videoBlock() {
    var yt = /(?:youtu\.be\/|[?&]v=|\/embed\/)([A-Za-z0-9_-]{11})/.exec(VIDEO.src || '');
    var frame;
    if (yt) {
      frame = h('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + yt[1] + '?rel=0', title: 'Vídeo: como o Louvor Studio funciona', allow: 'encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, loading: 'lazy' });
    } else if (VIDEO.src) {
      frame = h('video', { src: VIDEO.src, poster: VIDEO.poster, controls: true, preload: 'metadata', playsinline: true });
    } else {
      // Ainda sem vídeo: o espaço já fica no lugar, com o aviso de que chega em breve.
      frame = h('div', { class: 'vsoon', role: 'img', 'aria-label': 'Vídeo de apresentação: em breve' },
        h('img', { src: VIDEO.poster, alt: '', loading: 'lazy' }),
        h('div', { class: 'vsoon-in' }, h('span', { class: 'vplay' }, ic('Play', 30)), h('b', null, 'Vídeo de apresentação'), h('span', null, 'Em breve: o Louvor Studio em um minuto.')));
    }
    return h('section', { class: 'video', id: 'video' }, h('div', { class: 'wrap' },
      h('div', { class: 'vhead' }, h('h2', null, 'Veja como funciona'),
        h('p', null, 'Um minuto para entender o Louvor Studio: da escala ao ensaio da sua parte.')),
      h('div', { class: 'vframe' }, frame)));
  }
  // A semana de uma banda = uma multitrack: cada pessoa é uma faixa colorida, o cursor do estúdio anda
  // pela semana conforme a página rola, cada momento acende quando o cursor passa e, no domingo, todas as
  // faixas se juntam no culto. São situações do dia a dia, não depoimentos (o usuário escolheu não inventar avaliações).
  var FAIXAS = [
    { nome: 'Líder', cor: '#FFB547' },
    { nome: 'Vocal', cor: '#63D4FF' },
    { nome: 'Bateria', cor: '#34D399' },
    { nome: 'Teclado', cor: '#A78BFA' },
    { nome: 'Contralto', cor: '#5B8CFF' }
  ];
  // [faixa, posição na semana (0–100), dia, hora, ícone, cena, recurso do app]
  var MOMENTOS = [
    [0, 6, 'Segunda', '21h10', 'CalendarDays', 'Criou as escalas do mês inteiro de uma vez, pela agenda fixa da igreja.', 'Agenda do mês'],
    [1, 21, 'Terça', '23h40', 'Repeat', 'Com as crianças dormindo, repetiu o refrão no fone até a segunda voz sair sem pensar.', 'Repetir uma parte'],
    [2, 36, 'Quarta', '12h15', 'CalendarCheck', 'No almoço, marmita na mão: tocou em Confirmar e voltou pro serviço.', 'Confirmar num toque'],
    [3, 51, 'Quinta', '18h20', 'CloudDownload', 'Baixou as músicas da escala para ouvir no ônibus, sem gastar internet.', 'Música no celular'],
    [4, 66, 'Sexta', '22h05', 'Users', 'Música nova: aprendeu a contralto com a voz que o líder já liberou.', 'Vozes por naipe'],
    [0, 80, 'Sábado', '20h00', 'Megaphone', 'Fixou o recado no mural: todo mundo às 17h30 para a passagem de som.', 'Mural da banda']
  ];
  var CULTO = ['Domingo', '19h00', 'Todo mundo chega sabendo a música, o tom e onde entra. Sobra tempo para orar juntos antes de subir.'];
  var LANE_Y = [10, 30, 50, 70, 90];
  var JUNTA = 84; // onde as faixas começam a se juntar

  function semana() {
    var NS = 'http://www.w3.org/2000/svg';
    function linhas(cls) {
      var s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '0 0 100 100');
      s.setAttribute('preserveAspectRatio', 'none');
      s.setAttribute('class', 'linhas ' + cls);
      s.setAttribute('aria-hidden', 'true');
      FAIXAS.forEach(function (f, i) {
        var y = LANE_Y[i];
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M0 ' + y + ' H' + JUNTA + ' C' + (JUNTA + 9) + ' ' + y + ' ' + (JUNTA + 7) + ' 50 100 50');
        p.setAttribute('stroke', f.cor);
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        s.appendChild(p);
      });
      return s;
    }
    var base = linhas('base'), viva = linhas('viva');
    var cursor = h('span', { class: 'cursor', 'aria-hidden': 'true' });
    var nos = MOMENTOS.map(function (m, i) {
      var f = FAIXAS[m[0]];
      return h('button', { class: 'no', type: 'button', style: { left: m[1] + '%', top: LANE_Y[m[0]] + '%', '--c': f.cor },
        'aria-label': m[2] + ', ' + m[3] + ', ' + f.nome + ': ' + m[5], onclick: function () { mostrar(i, true); } }, ic(m[4], 16));
    });
    var culto = h('button', { class: 'no culto', type: 'button', style: { left: '100%', top: '50%' }, 'aria-label': 'Domingo: o culto',
      onclick: function () { mostrar(MOMENTOS.length, true); } }, ic('AudioLines', 20));
    var dias = h('div', { class: 'dias', 'aria-hidden': 'true' },
      MOMENTOS.map(function (m) { return h('span', { style: { left: m[1] + '%' } }, m[2].slice(0, 3)); })
        .concat([h('span', { class: 'dom', style: { left: '100%' } }, 'Dom')]));
    var trilha = h('div', { class: 'trilha' }, base, viva, nos, culto, cursor);
    var nomes = h('div', { class: 'nomes', 'aria-hidden': 'true' }, FAIXAS.map(function (f, i) {
      return h('span', { style: { top: LANE_Y[i] + '%', '--c': f.cor } }, h('i'), f.nome);
    }));

    // A legenda: a cena do momento em que o cursor está, na cor da faixa.
    var leg = h('div', { class: 'legenda', 'aria-live': 'polite' });
    var atual = -2, fixoEm = null, pAgora = 0;
    function conteudo(i) {
      if (i < 0) return [h('div', { class: 'lq' }, h('b', null, 'Segunda de manhã'), h('span', null, 'a semana começa')),
        h('p', null, 'Cada um tem trabalho, casa, família. Role a página e veja a semana da banda andar até o culto.')];
      if (i >= MOMENTOS.length) return [h('div', { class: 'lq' }, h('b', null, CULTO[0]), h('span', { class: 'mono' }, CULTO[1]), h('span', { class: 'quem' }, 'A banda toda')),
        h('p', { class: 'big' }, 'O culto.'), h('p', null, CULTO[2])];
      var m = MOMENTOS[i], f = FAIXAS[m[0]];
      return [h('div', { class: 'lq' }, h('span', { class: 'li' }, ic(m[4], 20)), h('b', null, m[2]), h('span', { class: 'mono' }, m[3]), h('span', { class: 'quem' }, f.nome)),
        h('p', null, m[5]), h('span', { class: 'rec' }, ic('Check', 15), 'No app: ' + m[6])];
    }
    function mostrar(i, porToque) {
      if (porToque) fixoEm = pAgora;
      if (i === atual) return;
      atual = i;
      var cor = i < 0 ? 'var(--accent)' : i >= MOMENTOS.length ? 'var(--accent-light)' : FAIXAS[MOMENTOS[i][0]].cor;
      leg.style.setProperty('--c', cor);
      leg.classList.toggle('final', i >= MOMENTOS.length);
      leg.replaceChildren.apply(leg, conteudo(i));
      nos.forEach(function (n, k) { n.classList.toggle('agora', k === i); });
      if (!REDUCE) leg.animate([{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }

    var palco = h('div', { class: 'palco' }, h('div', { class: 'mesa' }, nomes, h('div', { class: 'tw' }, trilha, dias)), leg);
    var sec = h('section', { class: 'semana', id: 'semana' },
      h('div', { class: 'sticky' }, h('div', { class: 'wrap' },
        h('h2', null, 'A semana de uma banda de louvor.'),
        h('p', { class: 'sub' }, 'Cada um no seu tempo, como faixas de uma multitrack. No domingo, tudo se encontra.'),
        palco)));

    // O cursor anda com a rolagem (a seção fica presa na tela enquanto a semana passa).
    function andar() {
      if (!sec.isConnected) { window.removeEventListener('scroll', pedir); window.removeEventListener('resize', pedir); return; }
      var r = sec.getBoundingClientRect(), curso = sec.offsetHeight - innerHeight;
      var p = curso > 0 ? Math.min(1, Math.max(0, -r.top / curso)) : 1;
      var x = Math.min(100, p * 108 - 2); // um respiro no começo e chega ao culto antes do fim
      cursor.style.transform = 'translateX(' + (Math.max(0, x) / 100 * trilha.clientWidth) + 'px)';
      cursor.style.opacity = x < 0 || x >= 100 ? '0' : '1';
      viva.style.clipPath = 'inset(0 ' + (100 - Math.max(0, x)) + '% 0 0)';
      var i = -1;
      MOMENTOS.forEach(function (m, k) { var on = x >= m[1]; nos[k].classList.toggle('on', on); if (on) i = k; });
      var fim = x >= 99.5;
      culto.classList.toggle('on', fim);
      palco.classList.toggle('fim', fim);
      if (fim) i = MOMENTOS.length;
      pAgora = p;
      // Tocou num momento: a legenda fica nele até a pessoa rolar um pouco.
      if (fixoEm !== null && Math.abs(p - fixoEm) > 0.03) fixoEm = null;
      if (fixoEm === null) mostrar(i);
    }
    var agendado = false;
    function pedir() {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () { agendado = false; andar(); });
    }
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    requestAnimationFrame(andar);
    return sec;
  }

  function point(icon, text) { return h('li', null, ic(icon, 20), h('span', null, text)); }

  A.landing = function () {
    var top = h('header', { class: 'site-top' }, h('div', { class: 'wrap' },
      h('span', { class: 'logo' }, ic('AudioLines', 20)), h('span', { class: 'brand' }, 'Louvor Studio'),
      h('nav', { 'aria-label': 'Seções' },
        h('a', { href: '#video', onclick: function (e) { e.preventDefault(); jump('video'); } }, 'Vídeo'),
        h('a', { href: '#recursos', onclick: function (e) { e.preventDefault(); jump('recursos'); } }, 'Recursos'),
        h('a', { href: '#como', onclick: function (e) { e.preventDefault(); jump('como'); } }, 'Como começar'),
        h('a', { href: '#planos', onclick: function (e) { e.preventDefault(); jump('planos'); } }, 'Planos'),
        h('a', { href: '#perguntas', onclick: function (e) { e.preventDefault(); jump('perguntas'); } }, 'Perguntas')),
      h('span', { class: 'sp' }),
      h('button', { class: 'textbtn', onclick: function () { goEntry('entrar'); } }, 'Entrar'),
      h('button', { class: 'btn cta', onclick: function () { goEntry('criar'); } }, 'Criar minha banda')));

    var hero = h('section', { class: 'hero' }, h('div', { class: 'wrap hero-in' },
      h('div', null,
        h('h1', { class: 'rise d1' }, 'O ensaio da sua banda, em qualquer lugar.'),
        h('p', { class: 'lede rise d2' }, 'Escalas, repertório, multitrack e a conversa da banda num lugar só. Cada um ensaia em casa e chega no culto sabendo a música.'),
        h('div', { class: 'ctas rise d3' },
          U.btn('Criar minha banda', 'Plus', function () { goEntry('criar'); }),
          U.btn2('Entrar com convite', 'Users', function () { goEntry('convite'); })),
        h('div', { class: 'facts rise d3' },
          h('span', null, ic('Check', 16), 'Tem plano grátis'),
          h('span', null, ic('MonitorSmartphone', 16), 'No celular e no computador'),
          h('span', null, ic('Smartphone', 16), 'App Android em breve'))),
      h('div', { class: 'devices' },
        h('span', { class: 'glow' }),
        h('div', { class: 'stage' },
          win('img/desk-inicio.webp', 'O Louvor Studio no computador: a próxima escala, o que fazer e o mural da banda.',
            { pose: { rx: 5, ry: -14 }, from: { y: 46, rx: 5, ry: -14 }, depth: 24, delay: 0.1 }),
          phone('img/cel-inicio.webp', 'O Louvor Studio no celular: o passe da próxima escala, com Confirmar e Não posso.',
            { cls: 'herophone', pose: { z: 60, rx: 3, ry: 18, rz: -4 }, from: { y: 90, z: 60, rx: 3, ry: 18, rz: -4 }, depth: 70, delay: 0.35 })))),
      h('div', { class: 'wrap waveband', 'aria-hidden': 'true' }, waveCanvas()));

    var demo = h('section', { class: 'demo', id: 'ouvir' }, h('div', { class: 'wrap' },
      h('h2', null, 'Ouça cada instrumento separado.'),
      h('p', { class: 'note2' }, 'Toque no botão: é um trecho de uma música de verdade, com as faixas separadas. Silencie, deixe só um instrumento, mude o volume e repita uma parte, como no estúdio do app.'),
      mixer(),
      h('p', { class: 'credit' }, 'Trecho de “Lá Vou Eu”, do Discopraise.')));

    var feats = h('section', { class: 'feats', id: 'recursos' }, h('div', { class: 'wrap', style: { display: 'flex', flexDirection: 'column', gap: 'inherit' } },
      feat('Ensaie com a banda inteira, em casa.',
        'O líder sobe a multitrack e cada um ensaia com as faixas separadas, no tom e no tempo da banda.',
        [point('SlidersVertical', 'Volume, mudo e solo em cada faixa.'), point('Repeat', 'Pule para o refrão e repita só aquela parte.'), point('FileText', 'A letra acompanha a parte que está tocando.')],
        h('div', { class: 'pic wide' }, win('img/desk-estudio.webp', 'O estúdio no computador: faixas com volume, mudo e solo, as partes da música e a letra ao lado.',
          { pose: { rx: 4, ry: -12 }, from: { y: 60, rx: 4, ry: -12 }, depth: 30 }))),
      feat('Aprenda a sua voz com quem já gravou.',
        'Quem grava diz qual voz cantou: tenor, contralto, 1ª voz. Depois que o líder libera, você escolhe a voz que quer aprender e ela toca junto com a multitrack.',
        [point('Mic', 'Cada um grava a sua parte no celular, com fone.'), point('Users', 'Vozes separadas por naipe, com o nome de quem cantou.'), point('LockKeyhole', 'Só a banda ouve, e só depois que o líder libera.')],
        h('div', { class: 'pic chatpic' }, ouvirDemo())),
      feat('Escalas sem confusão.',
        'Quem toca em cada culto, as músicas e a hora. Cada um confirma com um toque, pede troca ou avisa os dias que não pode.',
        [point('CalendarCheck', 'Confirmar ou Não posso direto na tela inicial.'), point('CalendarDays', 'O mês inteiro de uma vez, pela agenda fixa da igreja.'), point('ListMusic', 'Da escala para o ensaio daquela música em um toque.')],
        h('div', { class: 'pic chatpic' }, escalaDemo())),
      feat('A banda conversando no mesmo lugar.',
        'A conversa da banda, a conversa de cada escala e os avisos do líder no mural. Sem procurar recado perdido no grupo.',
        [point('MessagesSquare', 'Uma conversa para cada escala.'), point('Megaphone', 'Mural com os avisos do líder, fixados no alto.'), point('Bell', 'Avisos de escala nova e de mensagem.')],
        h('div', { class: 'pic chatpic' }, chatDemo()))));

    var how = h('section', { class: 'how', id: 'como' }, h('div', { class: 'wrap' },
      h('h2', null, 'Como a banda começa'),
      h('ol', { class: 'steps' },
        h('li', null, h('h3', null, 'O líder cria a banda'), h('p', null, 'Leva um minuto. Depois é só mandar o código de convite para o pessoal, pelo WhatsApp mesmo.')),
        h('li', null, h('h3', null, 'Sobe as músicas'), h('p', null, 'Com a multitrack em MP3, o tom, o BPM, a letra e as partes: Intro, Verso, Refrão.')),
        h('li', null, h('h3', null, 'Escala e todo mundo ensaia'), h('p', null, 'Cada um confirma a escala e ensaia a sua parte em casa, no celular ou no computador.')))));

    var qa = [
      ['O que é o Louvor Studio?', 'Um app para bandas de louvor: escalas, repertório, ensaio com multitrack, gravação da sua voz e a conversa da banda, num lugar só.'],
      ['É grátis?', 'Sim, tem plano grátis: até 8 pessoas e 1 GB para as músicas, com todos os recursos. Quando a banda crescer, é só escolher um plano maior.'],
      ['Como funciona o pagamento?', 'Os planos pagos são por mês ou por ano (no anual, você paga 10 meses e usa 12). Se um pagamento atrasar, a banda continua usando por 7 dias; depois fica só para consulta até acertar. Nada é apagado.'],
      ['Funciona no navegador ou preciso baixar?', 'Funciona no navegador do celular e do computador, sem instalar nada. No celular, dá para pôr na tela inicial e abrir como um app. O app de Android chega em breve na Play Store.'],
      ['Como o pessoal entra na banda?', 'O líder cria a banda e manda o código de convite. Cada pessoa cria a própria conta e entra com o código.'],
      ['Dá para gravar a minha voz pelo site?', 'Por enquanto, no site você ouve e ensaia. Gravar a sua voz (com o atraso do fone compensado) é no app de Android.'],
      ['Quem ouve as minhas gravações?', 'Só a sua banda, e só depois que o líder libera. Até lá, a gravação fica só com você e com quem cuida do áudio da banda.'],
      ['Preciso de fone?', 'Para ensaiar, qualquer fone ou caixa de som serve. Para gravar a voz, fone com fio é o melhor: o Bluetooth atrasa o som.']
    ];
    var faq = h('section', { class: 'faq', id: 'perguntas' }, h('div', { class: 'wrap' },
      h('h2', null, 'Perguntas frequentes'),
      h('div', null, qa.map(function (x) { return h('details', null, h('summary', null, x[0], ic('Plus', 20)), h('p', null, x[1])); }))));

    var close = h('section', { class: 'close' }, h('div', { class: 'wrap' }, h('div', { class: 'card' },
      h('h2', null, 'Sua banda chega pronta no culto.'),
      h('p', null, 'Crie a banda agora e convide o pessoal. Acesse grátis.'),
      h('div', { class: 'ctas' }, U.btn('Criar minha banda', 'Plus', function () { goEntry('criar'); }), U.btn2('Entrar com convite', 'Users', function () { goEntry('convite'); })))));

    var foot = h('footer', { class: 'site-foot' }, h('div', { class: 'wrap' },
      h('span', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'logo', style: { width: '28px', height: '28px', borderRadius: '8px' } }, ic('AudioLines', 16)), h('span', { class: 'hi semi' }, 'Louvor Studio')),
      h('span', null, 'O ensaio da sua banda, em qualquer lugar.'),
      h('span', { class: 'sp' }),
      h('a', { href: '#', onclick: function (e) { e.preventDefault(); goEntry('entrar'); } }, 'Entrar'),
      h('a', { href: '#', onclick: function (e) { e.preventDefault(); goEntry('convite'); } }, 'Entrar com convite'),
      h('span', null, '© 2026 Louvor Studio')));

    var page = h('div', { class: 'site' }, top, h('main', null, hero, videoBlock(), demo, feats, semana(), how, LSPlanos.secao({ comecar: function () { goEntry('criar'); } }), faq, close), foot);
    watchTop(top, page);
    choreograph(page);
    return page;
  };

  // ------------------------------------------------------------------ Telas do app em movimento (escala, estúdio e conversa)
  // Como um vídeo de demonstração de app, com uma "caixa de ferramentas" de efeitos e um efeito diferente
  // em cada momento: o dedo que viaja até o alvo, círculo e caixa desenhados à mão (Rough.js), grifo de
  // marca-texto, holofote com desfoque, balão de dica, ondas de pulso, câmera que gira em 3D na troca de
  // etapa, desfoque que vira foco, zoom em poucos momentos e confete ao publicar (canvas-confetti).
  // Só roda com a seção na tela; quem pede menos animação vê a tela pronta, parada.
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var EASE_MOVE = 'cubic-bezier(0.77, 0, 0.175, 1)';
  // Cada biblioteca da CDN vem com a impressão digital (SRI): se o arquivo lá fora for trocado, o navegador
  // recusa e o efeito é feito do jeito simples. Ao subir a versão, gerar o hash de novo (sha384).
  var LIBS = {
    rough: ['https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js', 'sha384-1NLkwxMO2sOqcq7rQkFBhIAUJtbt8ziLxhVKVgKfFGMEU8pF+GEq5LVogviveup6'],
    confetti: ['https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.js', 'sha384-/Ko/tqVwPYurnBe+Mj8WWw+39WmyOZn/kU+neqXn4hRxGI575k07mB/hIekAT51+']
  };
  var libLoads = {};
  /** Carrega uma biblioteca uma vez só; sem ela, o efeito é feito do jeito simples. */
  function lib(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!libLoads[name]) {
      libLoads[name] = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = LIBS[name][0]; s.integrity = LIBS[name][1]; s.crossOrigin = 'anonymous'; s.async = true;
        s.onload = function () { resolve(window[name] || null); };
        s.onerror = function () { resolve(null); };
        document.head.appendChild(s);
      });
    }
    return libLoads[name];
  }
  var SVGNS = 'http://www.w3.org/2000/svg';

  /** Câmera: a tela inteira (cam) dentro da moldura (box), com zoom e deslocamento. */
  function makeCam(box, cam) {
    var cs = { s: 1, x: 0, y: 0 };
    function apply(ms) {
      cam.style.transition = 'transform ' + ms + 'ms ' + EASE_CSS + ', filter 360ms ease-out';
      cam.style.transform = 'translate(' + cs.x.toFixed(1) + 'px, ' + cs.y.toFixed(1) + 'px) scale(' + cs.s + ')';
    }
    return {
      scale: function () { return cs.s; },
      zoom: function (el, s, ms) {
        ms = ms || 560;
        var b = box.getBoundingClientRect(), e = el.getBoundingClientRect();
        var cx = (e.left + e.width / 2 - b.left - cs.x) / cs.s, cy = (e.top + e.height / 2 - b.top - cs.y) / cs.s;
        var W = box.clientWidth, H = box.clientHeight;
        var x = Math.min(0, Math.max(W - s * W, W / 2 - s * cx)), y = Math.min(0, Math.max(H - s * H, H / 2 - s * cy));
        cs = { s: s, x: x, y: y };
        apply(ms);
        return new Promise(function (res) { setTimeout(res, ms + 30); });
      },
      out: function (ms) {
        ms = ms || 520;
        cs = { s: 1, x: 0, y: 0 };
        apply(ms);
        return new Promise(function (res) { setTimeout(res, ms + 30); });
      },
      reset: function () { cs = { s: 1, x: 0, y: 0 }; apply(0); }
    };
  }

  function demoRunner(box, cam, play) {
    var visible = false, wake = null;
    var camera = makeCam(box, cam);
    // Camada de efeitos por cima da tela (não é afetada pelo zoom).
    var spot = h('div', { class: 'fx-spot' });
    var ink = document.createElementNS(SVGNS, 'svg'); ink.setAttribute('class', 'fx-ink');
    // O cursor do mouse: o de fora anda (posição); o de dentro "clica" (assim o clique não muda a posição).
    var fingerTip = h('i', { html: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4.5 2.8v16.4l4.3-4.1 2.8 6.3 3-1.3-2.8-6.2h6z" fill="#F5FAFF" stroke="#050B12" stroke-width="1.5" stroke-linejoin="round"/></svg>' });
    var finger = h('span', { class: 'finger' }, fingerTip);
    var tip = h('div', { class: 'fx-tip' });
    var confettiCanvas = h('canvas', { class: 'fx-confetti' });
    box.appendChild(h('div', { class: 'fx', 'aria-hidden': 'true' }, spot, ink, confettiCanvas, tip, finger));
    var shoot = null;
    lib('rough'); lib('confetti').then(function (c) { if (c && c.create) shoot = c.create(confettiCanvas, { resize: true }); });

    function rel(el, pad) {
      pad = pad || 0;
      var b = box.getBoundingClientRect(), e = el.getBoundingClientRect();
      return { x: e.left - b.left - pad, y: e.top - b.top - pad, w: e.width + pad * 2, h: e.height + pad * 2, cx: e.left - b.left + e.width / 2, cy: e.top - b.top + e.height / 2 };
    }
    var fpos = { x: -100, y: -100 }, calmAt = 0;
    /** Põe o dedo no centro do ponto p (com ou sem viagem). */
    function place(p, ms) {
      fpos = { x: p.cx - 5, y: p.cy - 3 };
      finger.style.transition = (ms ? 'transform ' + ms + 'ms ' + EASE_MOVE + ', ' : '') + 'opacity 200ms ease-out';
      finger.style.transform = 'translate(' + fpos.x.toFixed(1) + 'px, ' + fpos.y.toFixed(1) + 'px)';
    }
    function settle(el) {
      var p = rel(el);
      if (Math.abs(p.cx - 5 - fpos.x) < 1 && Math.abs(p.cy - 3 - fpos.y) < 1) return Promise.resolve();
      place(p, 140);
      return new Promise(function (res) { setTimeout(res, 150); });
    }
    function sizeInk() { ink.setAttribute('viewBox', '0 0 ' + box.clientWidth + ' ' + box.clientHeight); }
    /** Desenha (traço que vai aparecendo) e devolve o grupo. */
    function draw(g, ms) {
      ink.appendChild(g);
      [].forEach.call(g.querySelectorAll('path'), function (p, i, all) {
        var len = p.getTotalLength ? p.getTotalLength() : 600;
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ms / all.length, delay: i * ms / all.length, easing: 'ease-out', fill: 'forwards' });
      });
      return g;
    }
    function fade(g, after) {
      setTimeout(function () { g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(function () { g.remove(); }); }, after);
    }
    function wobbleEllipse(cx, cy, w, hh) {
      // Sem a biblioteca: uma elipse com um leve tremido de caneta.
      var d = '', n = 28;
      for (var i = 0; i <= n + 3; i++) {
        var a = i / n * Math.PI * 2 - 0.6, k = 1 + Math.sin(i * 1.7) * 0.03;
        d += (i ? 'L' : 'M') + (cx + Math.cos(a) * w / 2 * k).toFixed(1) + ' ' + (cy + Math.sin(a) * hh / 2 * k).toFixed(1);
      }
      var g = document.createElementNS(SVGNS, 'g'), p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d); g.appendChild(p);
      return g;
    }
    var INK = { stroke: '#63D4FF', strokeWidth: 2.4, roughness: 1.4, bowing: 1.2 };

    var r = {
      cam: camera,
      alive: function () { return box.isConnected; },
      sleep: function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); },
      onScreen: function () { return visible ? Promise.resolve() : new Promise(function (res) { wake = res; }); },
      wait: function (ms) { return r.onScreen().then(function () { return r.sleep(ms); }).then(r.onScreen); },
      /** O dedo viaja até o alvo. */
      move: async function (el, ms) {
        ms = ms || 520;
        // Se a tela ainda está girando (troca de etapa), espera parar antes de sair.
        var still = calmAt - performance.now();
        if (still > 0) await r.sleep(still);
        finger.style.opacity = '1';
        place(rel(el), ms);
        // Ao chegar, confere onde o alvo está agora (a tela pode ter andado no caminho) e acerta.
        return r.sleep(ms + 40).then(function () { return settle(el); });
      },
      /** O dedo aperta: afunda, solta uma onda e o alvo reage. */
      press: function (el) {
        var p = rel(el);
        place(p, 0);
        fingerTip.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
        var ring = h('span', { class: 'fx-ring', style: { left: p.cx + 'px', top: p.cy + 'px' } });
        box.lastChild.appendChild(ring);
        ring.animate([{ opacity: 0.8, transform: 'translate(-50%, -50%) scale(0.4)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.6)' }], { duration: 460, easing: 'ease-out' })
          .finished.then(function () { ring.remove(); });
        el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.93)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
        // O dedo fica um instante em cima do botão antes de seguir.
        return r.sleep(320);
      },
      tap: function (el, ms) { return r.move(el, ms).then(function () { return r.press(el); }); },
      hideFinger: function () { finger.style.opacity = '0'; },
      /** Círculo à mão em volta do alvo. */
      circle: function (el, hold) {
        sizeInk();
        var p = rel(el, 6), rough = window.rough;
        var g = rough ? rough.svg(ink).ellipse(p.cx, p.cy, p.w * 1.22, p.h * 1.5, INK) : wobbleEllipse(p.cx, p.cy, p.w * 1.22, p.h * 1.5);
        g.setAttribute('class', 'fx-pen');
        draw(g, 560); fade(g, hold || 1300);
        return r.sleep(560);
      },
      /** Caixa à mão em volta do alvo. */
      boxAround: function (el, hold) {
        sizeInk();
        var p = rel(el, 5), rough = window.rough;
        var g;
        if (rough) g = rough.svg(ink).rectangle(p.x, p.y, p.w, p.h, INK);
        else { g = document.createElementNS(SVGNS, 'g'); var pa = document.createElementNS(SVGNS, 'path'); pa.setAttribute('d', 'M' + p.x + ' ' + p.y + 'h' + p.w + 'v' + p.h + 'h' + (-p.w) + 'Z'); g.appendChild(pa); }
        g.setAttribute('class', 'fx-pen');
        draw(g, 640); fade(g, hold || 1500);
        return r.sleep(640);
      },
      /** Sublinhado à mão (enquanto digita). */
      underline: function (el, hold) {
        sizeInk();
        var p = rel(el), rough = window.rough;
        var g = rough ? rough.svg(ink).line(p.x + 8, p.y + p.h + 5, p.x + p.w - 8, p.y + p.h + 3, INK) : (function () {
          var gg = document.createElementNS(SVGNS, 'g'), pa = document.createElementNS(SVGNS, 'path');
          pa.setAttribute('d', 'M' + (p.x + 8) + ' ' + (p.y + p.h + 5) + 'Q' + p.cx + ' ' + (p.y + p.h + 9) + ' ' + (p.x + p.w - 8) + ' ' + (p.y + p.h + 3)); gg.appendChild(pa); return gg;
        })();
        g.setAttribute('class', 'fx-pen');
        draw(g, 700); fade(g, hold || 1600);
        return r.sleep(200);
      },
      /** Grifo de marca-texto passando por trás do alvo. */
      highlight: function (el) {
        var p = rel(el, 3);
        var mark = h('span', { class: 'fx-mark', style: { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' } });
        box.lastChild.insertBefore(mark, box.lastChild.firstChild.nextSibling);
        mark.animate([{ clipPath: 'inset(0 100% 0 0 round 6px)' }, { clipPath: 'inset(0 0 0 0 round 6px)' }], { duration: 420, easing: EASE_CSS, fill: 'forwards' });
        setTimeout(function () { mark.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(function () { mark.remove(); }); }, 1500);
        return r.sleep(420);
      },
      /** Holofote: escurece e desfoca tudo, menos o alvo. */
      spot: function (el, radius) {
        var p = rel(el);
        spot.style.setProperty('--sx', p.cx + 'px'); spot.style.setProperty('--sy', p.cy + 'px');
        spot.style.setProperty('--sr', (radius || Math.max(p.w, p.h) / 2 + 18) + 'px');
        spot.classList.add('on');
        return r.sleep(380);
      },
      spotOff: function () { spot.classList.remove('on'); return r.sleep(250); },
      /** Balão de dica apontando para o alvo (em cima ou embaixo). */
      callout: function (el, text, below) {
        var p = rel(el);
        tip.textContent = text;
        tip.className = 'fx-tip' + (below ? ' below' : '');
        var W = box.clientWidth;
        tip.style.left = Math.max(12, Math.min(W - 12 - 220, p.cx - 110)) + 'px';
        tip.style.setProperty('--ax', (p.cx - Math.max(12, Math.min(W - 12 - 220, p.cx - 110))) + 'px');
        tip.style.top = (below ? p.y + p.h + 12 : p.y - 46) + 'px';
        tip.classList.add('on');
        return r.sleep(300);
      },
      calloutOff: function () { tip.classList.remove('on'); },
      /** Ondas saindo do alvo (chamando a atenção). */
      pulse: function (el, n) {
        var p = rel(el);
        for (var i = 0; i < (n || 2); i++) {
          (function (i) {
            var ring = h('span', { class: 'fx-ring wide', style: { left: p.cx + 'px', top: p.cy + 'px', width: p.w + 'px', height: p.h + 'px' } });
            box.lastChild.appendChild(ring);
            ring.animate([{ opacity: 0.7, transform: 'translate(-50%, -50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.45)' }],
              { duration: 700, delay: i * 220, easing: 'ease-out' }).finished.then(function () { ring.remove(); });
          })(i);
        }
        return r.sleep(380);
      },
      /** A câmera gira em 3D (troca de etapa). */
      swing: function (dir) {
        var a = (dir || 1) * 9;
        calmAt = performance.now() + 720;
        box.animate([{ transform: 'perspective(1400px) rotateY(0deg)' }, { transform: 'perspective(1400px) rotateY(' + a + 'deg) scale(0.96)' }, { transform: 'perspective(1400px) rotateY(0deg)' }],
          { duration: 700, easing: EASE_MOVE });
        return r.sleep(250);
      },
      /** Desfoque que vira foco (a tela "acerta o foco"). */
      rack: function () {
        cam.animate([{ filter: 'blur(7px)', opacity: 0.6 }, { filter: 'blur(0px)', opacity: 1 }], { duration: 520, easing: 'ease-out' });
        return r.sleep(300);
      },
      /** Confete saindo do alvo (só na hora de publicar). */
      confetti: function (el) {
        if (!shoot) return Promise.resolve();
        var p = rel(el);
        shoot({ particleCount: 70, spread: 75, startVelocity: 32, gravity: 1.1, ticks: 150, scalar: 0.8,
          origin: { x: p.cx / box.clientWidth, y: p.cy / box.clientHeight }, colors: ['#08A9F5', '#63D4FF', '#F5FAFF', '#34D399', '#FFB547'] });
        return Promise.resolve();
      },
      clear: function () { ink.replaceChildren(); spot.classList.remove('on'); tip.classList.remove('on'); finger.style.opacity = '0'; }
    };
    var io = new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (!box.isConnected) { io.disconnect(); return; }
      if (visible && wake) { var w = wake; wake = null; w(); }
    }, { threshold: 0.35 });
    requestAnimationFrame(function () {
      if (!box.isConnected) return;
      io.observe(box);
      (async function loop() { while (r.alive()) { await r.onScreen(); camera.reset(); r.clear(); await play(r); } })();
    });
    return r;
  }

  function popIn(el, from) {
    el.animate([{ opacity: 0, transform: from || 'translateY(10px) scale(0.94)' }, { opacity: 1, transform: 'translateY(0px) scale(1)' }], { duration: 320, easing: EASE_CSS });
  }
  function tile(letter, color, size) {
    return h('span', { class: 'cover', style: { width: size + 'px', height: size + 'px', borderRadius: '9px', background: color, fontSize: Math.round(size * 0.45) + 'px' } }, letter);
  }
  function face(ini, color, size) {
    return h('span', { class: 'avatar', style: { width: size + 'px', height: size + 'px', background: color, fontSize: Math.round(size * 0.38) + 'px' } }, ini);
  }
  /** Moldura com a câmera dentro. */
  function frame(label, kids, cls) {
    var cam = h('div', { class: 'cam' }, kids);
    return { box: h('div', { class: cls || 'appdemo', role: 'img', 'aria-label': label }, cam), cam: cam };
  }

  // ---------- Montar uma escala (o passo a passo do app)
  var SONGS = [['Em Teus Braços', 'Tom A · 70 BPM', 'E', '#9BA7EC'], ['Ousado Amor', 'Tom D · 72 BPM', 'O', '#B7D46B'],
    ['Bondade de Deus', 'Tom G · 72 BPM', 'B', '#E384AE'], ['Santo Pra Sempre', 'Tom C · 70 BPM', 'S', '#7DBAE4']];
  var TEAM = [['Crown', 'Ministro(a)', 'Rafael Costa', 'RC', '#B7D46B'], ['Mic', 'Vocal', 'Ana Clara', 'AC', '#9BA7EC'],
    ['Drum', 'Bateria', 'Bruno Lima', 'BL', '#E9A863'], ['Piano', 'Teclado', 'Carla Mendes', 'CM', '#E384AE']];

  function escalaDemo() {
    var STEPS = ['Quando e onde', 'Músicas', 'Quem vai', 'Revisar'];
    var sub = h('div', { class: 'cd-sub' });
    var bar = h('div', { class: 'wizbar ad-bar' }, STEPS.map(function () { return h('i'); }));
    var body = h('div', { class: 'ad-body' });
    var next = h('span', { class: 'btn full ad-next' }, 'Próximo');
    var toast = h('div', { class: 'ad-toast' }, ic('CircleCheckBig', 18), 'Escala publicada. A banda foi avisada.');
    var title = h('div', { class: 'cd-title' }, 'Nova escala');
    var f = frame('Montando uma escala no app: dia e hora, as músicas, quem vai tocar e cantar, revisar e publicar; depois as confirmações chegando.',
      [h('div', { class: 'cd-top' }, ic('X', 22), h('div', { class: 'grow' }, title, sub)), bar, body, h('div', { class: 'ad-foot' }, next), toast]);
    var box = f.box;

    function setStep(i) {
      sub.textContent = i < 4 ? 'Passo ' + (i + 1) + ' de 4 · ' + STEPS[i] : 'Domingo, 25/10 · 19:30';
      [].forEach.call(bar.children, function (b, k) { b.classList.toggle('on', k <= i); });
    }
    function show(node) {
      var old = body.firstChild;
      var out = old ? old.animate([{ opacity: 1, transform: 'translateX(0px)' }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 150, easing: 'ease-out' }).finished : Promise.resolve();
      return out.then(function () {
        if (old) old.remove();
        body.appendChild(node);
        node.animate([{ opacity: 0, transform: 'translateX(48px)' }, { opacity: 1, transform: 'translateX(0px)' }], { duration: 300, easing: EASE_CSS });
      });
    }
    function label(t) { return h('div', { class: 'ad-label' }, t); }

    function stepWhen() {
      var typed = h('span', { class: 'cd-typed' });
      var field = h('div', { class: 'cd-field' }, typed);
      var days = [['QUI', '22'], ['SEX', '23'], ['SÁB', '24'], ['DOM', '25'], ['SEG', '26']].map(function (d) { return h('span', { class: 'ad-day' }, h('small', null, d[0]), h('b', null, d[1])); });
      var hours = ['09:00', '18:00', '19:30'].map(function (t) { return h('span', { class: 'chiptog' }, t); });
      var node = h('div', { class: 'ad-step' }, label('Nome'), field, label('Dia'), h('div', { class: 'ad-days' }, days),
        label('Hora'), h('div', { class: 'row', style: { gap: '8px' } }, hours), label('Local'), h('div', { class: 'cd-field' }, 'Templo principal'));
      return { node: node, typed: typed, field: field, day: days[3], hour: hours[2] };
    }
    function stepSongs() {
      var rows = SONGS.map(function (s) {
        var chk = h('span', { class: 'check' });
        var row = h('div', { class: 'ad-row' }, tile(s[2], s[3], 40), h('div', { class: 'grow' }, h('div', { class: 'ad-rt' }, s[0]), h('div', { class: 'ad-rs' }, s[1])), chk);
        row._chk = chk;
        return row;
      });
      var list = h('div', { class: 'ad-list' }, rows);
      return { node: h('div', { class: 'ad-step' }, label('Toque nas músicas, na ordem do culto'), list), rows: rows, list: list };
    }
    function stepTeam() {
      var rows = TEAM.map(function (t) {
        var slot = h('span', { class: 'ad-slot' }, 'Escolher');
        var row = h('div', { class: 'ad-row' }, h('span', { class: 'ad-fn' }, ic(t[0], 18)), h('div', { class: 'grow ad-rt' }, t[1]), slot);
        row._slot = slot; row._t = t;
        return row;
      });
      return { node: h('div', { class: 'ad-step' }, label('Quem toca e canta'), h('div', { class: 'ad-list' }, rows)), rows: rows };
    }
    function passCard() {
      var main = h('div', { class: 'pass-main' },
        h('div', { class: 'pass-head' }, h('span', { class: 'mark' }, ic('AudioLines', 16), h('span', null, 'Ministério Vida Nova')), h('span', { class: 'when' }, 'Em 7 dias')),
        h('div', { class: 'pass-title' }, 'Culto da noite'),
        h('div', { class: 'pass-fields' }, h('div', null, h('small', null, 'Dia'), h('b', null, 'Dom, 25/10')), h('div', null, h('small', null, 'Hora'), h('b', { class: 'n' }, '19:30')),
          h('div', null, h('small', null, 'Equipe'), h('b', null, '4 pessoas'))),
        h('div', { class: 'pass-songs' }, h('span', null, 'Em Teus Braços'), h('span', null, 'Ousado Amor'), h('em', null, '+1')));
      var pass = h('div', { class: 'pass' }, main, h('div', { class: 'pass-stub' }, h('div', { class: 'pass-status' }, ic('MapPin', 16), 'Templo principal')));
      requestAnimationFrame(function () { if (main.offsetHeight) pass.style.setProperty('--cut', main.offsetHeight + 'px'); });
      return h('div', { class: 'passwrap' }, pass);
    }
    function stepReview() { var pc = passCard(); return { node: h('div', { class: 'ad-step' }, pc, h('div', { class: 'ad-note' }, 'Ao publicar, a banda recebe o aviso e cada um confirma.')), pass: pc }; }
    function stepSent() {
      var rows = TEAM.map(function (t) {
        var chip = U.chip('Sem resposta', '', 'Clock');
        var row = h('div', { class: 'ad-row' }, face(t[3], t[4], 34), h('div', { class: 'grow' }, h('div', { class: 'ad-rt' }, t[2]), h('div', { class: 'ad-rs' }, t[1])), chip);
        row._chip = chip;
        return row;
      });
      return { node: h('div', { class: 'ad-step' }, label('Respostas da equipe'), h('div', { class: 'ad-list' }, rows)), rows: rows };
    }

    if (REDUCE) {
      title.textContent = 'Culto da noite'; setStep(4); next.textContent = 'Ver escala';
      var done = stepSent();
      done.rows.forEach(function (r, i) { if (i !== 3) r.replaceChild(U.chip('Confirmado', 'ok', 'Check'), r._chip); });
      body.appendChild(h('div', { class: 'ad-step' }, passCard(), done.node));
      return box;
    }

    demoRunner(box, f.cam, async function (r) {
      title.textContent = 'Nova escala'; next.textContent = 'Próximo';
      body.replaceChildren(); toast.classList.remove('on');
      setStep(0);
      var s1 = stepWhen(); await show(s1.node); await r.rack();
      // 1) Nome: o dedo toca na caixa e a caneta sublinha enquanto digita.
      await r.tap(s1.field, 600);
      r.underline(s1.field, 1500);
      var name = 'Culto da noite';
      for (var c = 1; c <= name.length; c++) { s1.typed.textContent = name.slice(0, c); await r.sleep(c % 5 ? 28 : 60); }
      // 2) Dia: círculo à mão no domingo, depois o toque.
      await r.wait(150); await r.circle(s1.day, 900);
      await r.tap(s1.day, 360); s1.day.classList.add('on');
      // 3) Hora: ondas no 19:30.
      await r.wait(120); await r.move(s1.hour, 380); await r.pulse(s1.hour, 2); await r.press(s1.hour); s1.hour.classList.add('on');
      await r.wait(220); await r.tap(next, 480);
      // Troca de etapa: a câmera gira em 3D.
      setStep(1); r.swing(1);
      var s2 = stepSongs(); await show(s2.node);
      // 4) Músicas: holofote na lista (o resto escurece e desfoca), toques rápidos.
      await r.wait(150); await r.spot(s2.list, 175);
      var pick = [0, 1, 3];
      for (var i = 0; i < pick.length; i++) {
        var row = s2.rows[pick[i]];
        await r.tap(row._chk, 300); row.classList.add('on'); row._chk.classList.add('on'); row._chk.textContent = String(i + 1); popIn(row._chk, 'scale(0.5)');
        await r.wait(120);
      }
      await r.spotOff(); await r.tap(next, 420);
      setStep(2); r.swing(-1);
      var s3 = stepTeam(); await show(s3.node);
      // 5) Equipe: balão de dica no primeiro e o dedo correndo a lista.
      await r.wait(200); await r.callout(s3.rows[0]._slot, 'Toque para escolher quem vai', true);
      for (var k = 0; k < s3.rows.length; k++) {
        var tr = s3.rows[k];
        await r.tap(tr._slot, k ? 300 : 520);
        if (!k) r.calloutOff();
        var pill = h('span', { class: 'ad-person' }, face(tr._t[3], tr._t[4], 24), tr._t[2]);
        tr.replaceChild(pill, tr._slot); popIn(pill, 'translateX(14px) scale(0.92)');
        await r.wait(140);
      }
      await r.wait(200); await r.tap(next, 420);
      setStep(3); next.textContent = 'Publicar escala';
      var s4 = stepReview(); await show(s4.node);
      // 6) Revisar: aqui sim a câmera chega perto do passe; depois afasta.
      await r.wait(300); r.hideFinger(); await r.cam.zoom(s4.pass, 1.22, 700);
      await r.wait(800); await r.cam.out(520);
      // 7) Publicar: caixa à mão no botão, o toque e o confete.
      await r.boxAround(next, 700); await r.tap(next, 480);
      r.confetti(next);
      toast.classList.add('on');
      title.textContent = 'Culto da noite'; setStep(4); next.textContent = 'Ver escala';
      var s5 = stepSent(); await show(s5.node);
      await r.wait(900); toast.classList.remove('on'); r.hideFinger();
      // 8) As respostas chegando: grifo de marca-texto em cada "Confirmado".
      var order = [1, 0, 2];
      for (var j = 0; j < order.length; j++) {
        await r.wait(600);
        var rr = s5.rows[order[j]];
        var ok = U.chip('Confirmado', 'ok', 'Check');
        rr.replaceChild(ok, rr._chip); popIn(ok, 'scale(0.8)');
        r.highlight(ok);
      }
      await r.wait(2400);
    });
    return box;
  }

  // ---------- Ouvir no estúdio e estudar a voz de quem gravou
  var STUDIO_PARTS = [['Intro', 0.12, '#7DBAE4'], ['Verso', 0.24, '#6CC4B0'], ['Refrão', 0.2, '#E9A863'], ['Verso', 0.16, '#6CC4B0'], ['Ponte', 0.12, '#C59DE3'], ['Refrão', 0.16, '#E9A863']];
  var STUDIO_TRACKS = [['Drum', 'Bateria'], ['Guitar', 'Baixo'], ['Piano', 'Teclado'], ['Mic', 'Voz guia']];

  function ouvirDemo() {
    var clock = h('span', { class: 'ad-clock' }, '0:00');
    var partDot = h('span', { class: 'dot', style: { width: '9px', height: '9px', background: STUDIO_PARTS[0][2] } });
    var partName = h('span', { class: 'hi semi' }, STUDIO_PARTS[0][0]);
    var head = h('span', { class: 'ad-playhead' });
    /** Onda de uma faixa (desenho de exemplo, diferente para cada instrumento). */
    function laneWave(seed, color, quiet) {
      var bars = [];
      for (var i = 0; i < 48; i++) {
        var x = i / 48, sec = x < 0.12 ? 0.35 : x > 0.36 && x < 0.56 ? 1 : x > 0.72 && x < 0.84 ? 0.5 : 0.75;
        var v = Math.abs(Math.sin(x * (11 + seed * 3) + seed) * 0.6 + Math.sin(x * (31 + seed * 5)) * 0.4) * sec * (quiet && x < 0.12 ? 0.1 : 1);
        bars.push(h('i', { style: { height: Math.round(3 + v * 22) + 'px', background: color } }));
      }
      return h('span', { class: 'ad-lw' }, bars);
    }
    var ov = h('div', { class: 'ad-daw' },
      h('div', { class: 'ad-lane ruler' }, h('span', { class: 'ad-lh' }, h('span', { class: 'ad-rs' }, 'Partes')),
        h('span', { class: 'ad-parts' }, STUDIO_PARTS.map(function (p) { return h('span', { style: { flex: p[1] + ' 1 0', background: p[2] } }, p[0]); }))));
    var playBtn = h('span', { class: 'ad-play' }, ic('Play', 26));
    var voicesBtn = h('span', { class: 'ad-icon' }, ic('Users', 20));
    var tracks = h('div', { class: 'ad-tracks' });
    ov.appendChild(tracks);
    ov.appendChild(head);
    var COLORS = ['#E9A863', '#B7D46B', '#9BA7EC', '#7DBAE4', '#63D4FF'];
    /** Uma faixa como numa DAW: nome, M e S à esquerda e a onda dela à direita. */
    function trackRow(icon, name, mine, n) {
      var s = h('span', { class: 'mini' }, 'S');
      var nm = h('span', { class: 'ad-rt ell' }, name);
      var row = h('div', { class: 'ad-lane' + (mine ? ' mine' : '') },
        h('span', { class: 'ad-lh' }, h('span', { class: 'row', style: { gap: '5px', minWidth: 0 } }, ic(icon, 14), nm),
          h('span', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'mini' }, 'M'), s, h('span', { class: 'ad-vol' }, h('i')))),
        laneWave(n + 1, COLORS[n % COLORS.length], name === 'Voz guia' || mine));
      row._s = s; row._nm = nm;
      return row;
    }
    var sheetList = h('div', { class: 'ad-list' });
    var chips = ['Soprano · 1', 'Tenor · 1', 'Contralto · 1'].map(function (t) { return h('span', { class: 'chiptog' }, t); });
    var sheet = h('div', { class: 'ad-sheet' }, h('div', { class: 'grab' }),
      h('div', { class: 'row', style: { gap: '8px' } }, ic('Users', 18, 'accent'), h('b', { class: 'hi', style: { fontSize: '17px' } }, 'Vozes para estudar')),
      h('div', { class: 'ad-rs' }, 'Qual voz você quer aprender?'), h('div', { class: 'row', style: { gap: '6px' } }, chips), sheetList);
    var display = h('div', { class: 'ad-display' }, clock, h('span', { class: 'ad-sep' }), partDot, partName);
    var f = frame('O estúdio tocando a música; a pessoa abre Vozes para estudar, escolhe o tenor do Miquéas e ouve só essa voz junto com a multitrack.', [
      h('div', { class: 'cd-top' }, ic('ChevronLeft', 22), h('div', { class: 'grow' }, h('div', { class: 'cd-title' }, 'Em Teus Braços'), h('div', { class: 'cd-sub' }, 'Tom A · 70 BPM · multitrack')), voicesBtn),
      h('div', { class: 'ad-studio' }, display, ov),
      h('div', { class: 'ad-transport' }, h('span', { class: 'ad-tb' }, ic('SkipBack', 20)), playBtn, h('span', { class: 'ad-tb' }, ic('Repeat', 20))), sheet]);
    var box = f.box;

    var DUR = 64, pos = 0, playing = false, last = 0;
    function render() {
      var fr = pos / DUR;
      var lw = ov.clientWidth - 112;
      head.style.transform = 'translateX(' + (112 + fr * (lw - 2)).toFixed(1) + 'px)';
      clock.textContent = Math.floor(pos / 60) + ':' + String(Math.floor(pos % 60)).padStart(2, '0');
      var acc = 0;
      for (var p = 0; p < STUDIO_PARTS.length; p++) { acc += STUDIO_PARTS[p][1]; if (fr < acc) { partDot.style.background = STUDIO_PARTS[p][2]; partName.textContent = STUDIO_PARTS[p][0]; break; } }
    }
    function tick(t) {
      if (!box.isConnected) return;
      if (playing) { pos = Math.min(DUR, pos + (last ? (t - last) / 1000 : 0) * 2.2); render(); }
      last = t;
      requestAnimationFrame(tick);
    }
    function setPlaying(on) {
      playing = on; last = 0;
      playBtn.replaceChildren(ic(on ? 'Pause' : 'Play', 26));
      box.classList.toggle('playing', on);
    }
    function reset() {
      tracks.replaceChildren.apply(tracks, STUDIO_TRACKS.map(function (t, n) { return trackRow(t[0], t[1], false, n); }));
      sheetList.replaceChildren(); chips.forEach(function (c) { c.classList.remove('on'); });
      sheet.classList.remove('up'); pos = 0; setPlaying(false); render();
    }

    if (REDUCE) {
      reset(); pos = 21; render();
      var tn = trackRow('Mic', 'Tenor · Miquéas', true, 4); tn._s.classList.add('s'); tracks.appendChild(tn);
      return box;
    }
    requestAnimationFrame(tick);

    demoRunner(box, f.cam, async function (r) {
      reset();
      // 1) Holofote no Tocar; o dedo toca; o holofote corre para a música andando.
      await r.wait(400); await r.spot(playBtn, 46);
      await r.tap(playBtn, 560); setPlaying(true);
      await r.wait(200); r.hideFinger(); await r.spot(ov, 150);
      await r.wait(1500); await r.spotOff();
      // 2) Vozes para estudar: círculo à mão no botão e o toque.
      await r.circle(voicesBtn, 700); await r.tap(voicesBtn, 420);
      sheet.classList.add('up');
      // 3) Balão de dica no naipe.
      await r.wait(420); await r.callout(chips[1], 'Escolha a voz que quer aprender');
      await r.wait(500); await r.tap(chips[1], 480); r.calloutOff(); chips[1].classList.add('on');
      var who = h('div', { class: 'ad-row pickrow' }, face('MR', '#6CC4B0', 32), h('div', { class: 'grow' }, h('div', { class: 'ad-rt' }, 'Miquéas Rocha'), h('div', { class: 'ad-rs' }, 'Tenor · 1:04 · na nuvem')),
        h('span', { class: 'ad-state' }, ic('CloudDownload', 18)));
      sheetList.replaceChildren(who); popIn(who);
      // 4) Aqui o zoom: chega perto do Miquéas enquanto a voz baixa.
      await r.wait(260); r.hideFinger(); await r.cam.zoom(who, 1.55, 520);
      await r.tap(who, 360);
      var st = who.lastChild; st.replaceChildren(h('span', { class: 'spinner sm' }));
      who.querySelector('.ad-rs').textContent = 'Tenor · 1:04 · baixando…';
      await r.wait(800);
      st.replaceChildren(ic('Volume2', 18)); who.classList.add('on'); who.querySelector('.ad-rs').textContent = 'Tenor · 1:04 · tocando junto';
      popIn(st, 'scale(0.6)');
      await r.wait(500); r.hideFinger(); await r.cam.out(440); sheet.classList.remove('up');
      await r.wait(420);
      var tenor = trackRow('Mic', 'Tenor · Miquéas', true, 4);
      tracks.appendChild(tenor); popIn(tenor, 'translateY(18px) scale(0.96)');
      // 5) A faixa nova chega: caixa à mão em volta dela.
      await r.wait(300); await r.boxAround(tenor, 900);
      // 6) Solo: ondas no S, o toque e o resto apaga.
      await r.wait(200); await r.move(tenor._s, 420); await r.pulse(tenor._s, 2); await r.press(tenor._s); tenor._s.classList.add('s');
      [].forEach.call(tracks.children, function (row) { if (row !== tenor) row.classList.add('dim'); });
      await r.wait(2200); await r.tap(playBtn, 520); setPlaying(false);
      await r.wait(900);
    });
    return box;
  }

  // ------------------------------------------------------------------ Conversa ao vivo (como um vídeo)
  // A tela da conversa do app: "digitando…", a mensagem chega, as antigas sobem; um aviso de escala
  // publicada; a minha mensagem é digitada e enviada. Recomeça no fim.
  var CHAT = [
    { who: 'Ana Clara', ini: 'AC', color: '#9BA7EC', text: 'Gente, o ensaio de sábado vai ter o teclado novo?', time: '10:34' },
    { who: 'Carla Mendes', ini: 'CM', color: '#E384AE', text: 'Vai sim! Já levei para a igreja ontem.', time: '10:42' },
    { event: 'Rafael publicou a escala Ensaio geral · sábado, 19:30' },
    { me: true, text: 'Ótimo! Lembrem de ensaiar as partes no app antes 🙏', time: '10:54' },
    { who: 'Bruno Lima', ini: 'BL', color: '#B7D46B', text: 'Já marquei Ensaiei em duas músicas!', time: '11:12' },
    { who: 'Miquéas Rocha', ini: 'MR', color: '#6CC4B0', text: 'Gravei o tenor de Em Teus Braços para quem quiser estudar 🎧', time: '11:20' }
  ];

  function chatDemo() {
    var list = h('div', { class: 'cd-list', 'aria-hidden': 'true' });
    var typed = h('span', { class: 'cd-typed' });
    var holder = h('span', { class: 'cd-ph' }, 'Mensagem');
    var send = h('span', { class: 'sendbtn cd-send' }, ic('Send', 20));
    var field = h('div', { class: 'cd-field' }, holder, typed);
    var composer = h('div', { class: 'cd-composer' }, field, send);
    var f = frame('A conversa da banda no app: mensagens chegando, um aviso de escala publicada e a resposta do líder.', [
      h('div', { class: 'cd-top' }, ic('ArrowLeft', 22),
        h('div', { class: 'grow' }, h('div', { class: 'cd-title' }, 'Conversa da banda'), h('div', { class: 'cd-sub' }, 'Ministério Vida Nova · 6 pessoas')),
        ic('Users', 20)),
      h('div', { class: 'cd-body' }, h('span', { class: 'daysep' }, 'Hoje'), list),
      composer], 'chatdemo');
    var box = f.box;

    function bubbleRow(m) {
      if (m.event) return h('div', { class: 'cd-event' }, ic('CalendarCheck', 15), m.event);
      if (m.me) return h('div', { class: 'bubrow mine' }, h('div', { class: 'bubble' }, h('span', { class: 'txt' }, m.text), h('span', { class: 'tm' }, m.time)));
      return h('div', { class: 'bubrow' }, h('span', { class: 'avatar', style: { width: '32px', height: '32px', background: m.color, fontSize: '12px' } }, m.ini),
        h('div', { class: 'bubble' }, h('span', { class: 'who' }, m.who), h('span', { class: 'txt' }, m.text), h('span', { class: 'tm' }, m.time)));
    }
    function typingRow(m) {
      return h('div', { class: 'bubrow' }, h('span', { class: 'avatar', style: { width: '32px', height: '32px', background: m.color, fontSize: '12px' } }, m.ini),
        h('div', { class: 'bubble cd-typing' }, h('i'), h('i'), h('i')));
    }

    if (REDUCE) {
      CHAT.forEach(function (m) { list.appendChild(bubbleRow(m)); });
      return box;
    }

    var scale = function () { return 1; };
    /** Põe uma linha nova embaixo; as de cima sobem deslizando (FLIP), em vez de pular. */
    function push(node, mine) {
      var kids = [].slice.call(list.children);
      var before = kids.map(function (k) { return k.getBoundingClientRect().top; });
      list.appendChild(node);
      kids.forEach(function (k, i) {
        var dy = (before[i] - k.getBoundingClientRect().top) / scale();
        if (dy) k.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'translateY(0px)' }], { duration: 380, easing: EASE_CSS });
      });
      node.style.transformOrigin = mine ? '100% 100%' : '0% 100%';
      node.animate([{ opacity: 0, transform: 'translateY(14px) scale(0.96)' }, { opacity: 1, transform: 'translateY(0px) scale(1)' }], { duration: 420, easing: EASE_CSS });
    }
    function drop(node) {
      return node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' }).finished.then(function () { node.remove(); });
    }

    var runner = demoRunner(box, f.cam, async function (r) {
      list.replaceChildren();
      for (var i = 0; i < CHAT.length && r.alive(); i++) {
        var m = CHAT[i];
        await r.onScreen();
        if (m.event) {
          // O aviso de escala chega e a caneta faz um círculo em volta.
          await r.sleep(250);
          var ev = bubbleRow(m); push(ev);
          await r.wait(420); await r.circle(ev, 1100);
        } else if (m.me) {
          // Eu: o dedo toca na caixa, a câmera chega perto e eu digito; ondas no enviar.
          await r.tap(field, 520);
          r.hideFinger(); await r.cam.zoom(composer, 1.5, 480);
          holder.style.display = 'none';
          for (var c = 1; c <= m.text.length && r.alive(); c++) { typed.textContent = Array.from(m.text).slice(0, c).join(''); await r.sleep(c % 6 ? 24 : 55); }
          send.classList.add('on');
          await r.cam.out(420);
          await r.move(send, 380); await r.pulse(send, 1); await r.press(send);
          typed.textContent = ''; holder.style.display = '';
          send.classList.remove('on'); r.hideFinger();
          push(bubbleRow(m), true);
        } else {
          var t = typingRow(m);
          push(t);
          await r.sleep(650 + Math.min(800, m.text.length * 12));
          await drop(t);
          var row = bubbleRow(m); push(row);
          // A última mensagem (o tenor gravado) ganha o grifo de marca-texto.
          if (i === CHAT.length - 1) { await r.wait(420); r.highlight(row.lastChild); }
        }
        await r.wait(650);
      }
      await r.wait(2600);
      await list.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }).finished;
      list.replaceChildren();
      await r.sleep(400);
    });
    scale = runner.cam.scale;
    return box;
  }

  function feat(title, text, points, pic) {
    return h('article', { class: 'feat' + (pic.classList.contains('wide') ? ' widefeat' : '') }, h('div', { class: 'txt' }, h('h2', null, title), h('p', null, text), h('ul', null, points)), pic);
  }

  /** O topo ganha vidro quando a página rola. */
  function watchTop(top, page) {
    function on() {
      if (!page.isConnected) { window.removeEventListener('scroll', on); return; }
      top.classList.toggle('solid', window.scrollY > 8);
    }
    window.addEventListener('scroll', on, { passive: true });
  }

  // ------------------------------------------------------------------ Onda (o símbolo da marca)
  function waveCanvas() {
    var canvas = h('canvas');
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var t0 = performance.now();
    function draw(now) {
      if (!canvas.isConnected && now - t0 > 800) return;
      var w = canvas.clientWidth || 360, hh = canvas.clientHeight || 84;
      var dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
      var g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, hh);
      var level = demoLevel();
      var phase = still ? 0 : ((now - t0) / 5200) % 1;
      var n = Math.max(40, Math.min(110, Math.round(w / 12))), gap = w / n, bw = gap * 0.5, mid = hh / 2, p = phase * 2 * Math.PI;
      var grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#0077C8'); grad.addColorStop(0.55, '#08A9F5'); grad.addColorStop(1, '#63D4FF');
      g.fillStyle = grad;
      for (var i = 0; i < n; i++) {
        var x = i / n;
        var env = Math.pow(Math.sin(x * Math.PI), 1.6);
        var v = (0.5 * Math.abs(Math.sin(x * 11 - p)) + 0.3 * Math.abs(Math.sin(x * 27 + p * 2)) + 0.2) * env;
        v *= 0.55 + 0.45 * level + (level > 0 ? 0.35 * level * Math.abs(Math.sin(x * 40 + now / 140)) : 0);
        var bh = Math.max(3, Math.min(hh, v * hh));
        g.globalAlpha = 0.25 + 0.75 * env;
        var x0 = i * gap + (gap - bw) / 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(x0, mid - bh / 2, bw, bh, bw / 2); else g.rect(x0, mid - bh / 2, bw, bh);
        g.fill();
      }
      g.globalAlpha = 1;
      if (!still || level > 0) requestAnimationFrame(draw);
      else setTimeout(function () { requestAnimationFrame(draw); }, 400);
    }
    requestAnimationFrame(draw);
    return canvas;
  }

  // ------------------------------------------------------------------ Mixer de exemplo (Web Audio, trecho real)
  // 8 compassos (13 s) de "Lá Vou Eu", do Discopraise (Ré menor, 144 BPM), com 5 faixas separadas em
  // mobile/audio/exemplo/*.mp3 (cada uma ~190 KB, ~1 MB no total). Verso = os 4 primeiros compassos (mais
  // leve, o baixo fica de fora); Refrão = os 4 últimos (tudo tocando). O trecho vai do compasso 41 ao 48.
  // Só baixa quando a seção chega perto da tela ou quando a pessoa toca em Tocar.
  var SONG = { title: 'Lá Vou Eu (trecho)', info: 'Ré menor · 144 BPM · Discopraise', bars: 8, base: 'audio/exemplo/' };
  var PARTS = [{ name: 'Verso', from: 0, to: 4, color: '#6CC4B0' }, { name: 'Refrão', from: 4, to: 8, color: '#E9A863' }];
  // (A faixa de piano dessa multitrack é só ruído de fundo, por isso não entra.)
  var LANES = [['bateria', 'Bateria', 'Drum'], ['baixo', 'Baixo', 'Guitar'], ['guitarra', 'Guitarras', 'Guitar'],
    ['outros', 'Outros', 'AudioWaveform'], ['voz', 'Voz', 'Mic']];
  var XFADE = 0.012;   // cruzamento de 12 ms ao voltar ao começo (sem estalo)
  var D = null; // estado do mixer
  var songRaw = null, songBuf = null;   // arquivos baixados e já decodificados (valem para as próximas vezes)

  function demoLevel() { return D && D.playing ? Math.min(1, D.level) : 0; }

  function fetchSong() {
    if (!songRaw) {
      songRaw = Promise.all(LANES.map(function (l) {
        return fetch(SONG.base + l[0] + '.mp3').then(function (r) { if (!r.ok) throw new Error('audio ' + r.status); return r.arrayBuffer(); });
      })).catch(function (e) { songRaw = null; throw e; });
    }
    return songRaw;
  }
  function decodeSong(ctx) {
    if (songBuf) return Promise.resolve(songBuf);
    return fetchSong().then(function (raws) {
      return Promise.all(raws.map(function (ab) {
        return new Promise(function (ok, no) { var p = ctx.decodeAudioData(ab.slice(0), ok, no); if (p && p.then) p.then(ok, no); });
      }));
    }).then(function (list) {
      songBuf = {};
      LANES.forEach(function (l, i) { songBuf[l[0]] = list[i]; });
      return songBuf;
    });
  }

  function stopDemo() {
    if (!D) return;
    D.playing = false;
    D.loading = false;
    clearInterval(D.timer);
    if (D.ctx) { try { D.ctx.close(); } catch (e) { /* já fechado */ } }
    D.ctx = null;
    if (D.ui) D.ui.refresh();
  }

  function mixer() {
    var st = D = { playing: false, loading: false, ctx: null, vol: {}, mute: {}, solo: {}, loop: null, bar: 0, level: 0, ui: null, live: [], segs: [], nextT: 0, hold: {} };
    LANES.forEach(function (l) { st.vol[l[0]] = 0.8; });
    var playBtn = h('button', { class: 'playbig', 'aria-label': 'Tocar a música de exemplo', onclick: toggle }, ic('Play', 26));
    var where = h('span', null, SONG.info);
    var partBtns = PARTS.map(function (p) {
      return h('button', { style: { flex: (p.to - p.from) + ' 1 0', background: p.color }, 'aria-pressed': 'false', onclick: function () {
        st.loop = st.loop === p ? null : p;
        if (st.playing) jumpTo(st.loop ? st.loop.from : st.bar);
        refresh();
      } }, p.name);
    });
    var meters = {};
    var lanes = LANES.map(function (l) {
      var k = l[0];
      var mBtn = h('button', { class: 'mini', 'aria-label': 'Mudo: ' + l[1], 'aria-pressed': 'false', onclick: function () { st.mute[k] = !st.mute[k]; apply(); refresh(); } }, 'M');
      var sBtn = h('button', { class: 'mini', 'aria-label': 'Solo: ' + l[1], 'aria-pressed': 'false', onclick: function () { st.solo[k] = !st.solo[k]; apply(); refresh(); } }, 'S');
      var range = h('input', { type: 'range', class: 'vol', min: '0', max: '1', step: '0.01', value: '0.8', 'aria-label': 'Volume: ' + l[1], style: { '--p': '80%' } });
      range.addEventListener('input', function () { st.vol[k] = +range.value; range.style.setProperty('--p', Math.round(range.value * 100) + '%'); apply(); });
      meters[k] = h('i');
      var lane = h('div', { class: 'lane' }, ic(l[2], 18), h('span', { class: 'nm' }, l[1]), h('span', { class: 'grow' }, range), h('span', { class: 'meter', 'aria-hidden': 'true' }, meters[k]), mBtn, sBtn);
      lane._m = mBtn; lane._s = sBtn; lane._k = k;
      return lane;
    });
    var root = h('div', { class: 'mixer' },
      h('div', { class: 'head' }, playBtn, h('div', { class: 'song' }, h('b', null, SONG.title), where),
        h('button', { class: 'btn2', style: { minHeight: '44px' }, onclick: function () { goEntry('criar'); } }, 'Usar com a minha banda')),
      h('div', { class: 'parts', role: 'group', 'aria-label': 'Partes: toque para repetir' }, partBtns),
      h('div', { class: 'lanes' }, lanes));

    function refresh() {
      playBtn.replaceChildren(ic(st.loading ? 'Loader' : st.playing ? 'Pause' : 'Play', 26));
      playBtn.setAttribute('aria-label', st.loading ? 'Carregando o áudio' : st.playing ? 'Pausar' : 'Tocar a música de exemplo');
      playBtn.setAttribute('aria-busy', st.loading ? 'true' : 'false');
      partBtns.forEach(function (b, i) { var on = st.loop === PARTS[i] || (!st.loop && st.playing && st.bar >= PARTS[i].from && st.bar < PARTS[i].to); b.classList.toggle('on', on); b.setAttribute('aria-pressed', st.loop === PARTS[i] ? 'true' : 'false'); });
      lanes.forEach(function (ln) { ln._m.classList.toggle('m', !!st.mute[ln._k]); ln._m.setAttribute('aria-pressed', st.mute[ln._k] ? 'true' : 'false'); ln._s.classList.toggle('s', !!st.solo[ln._k]); ln._s.setAttribute('aria-pressed', st.solo[ln._k] ? 'true' : 'false'); });
      where.textContent = st.loading ? 'Carregando o áudio…' : st.loop ? 'Repetindo: ' + st.loop.name + ' · toque de novo para soltar' : SONG.info;
    }
    st.ui = { refresh: refresh };

    function gainFor(k) {
      var anySolo = LANES.some(function (l) { return st.solo[l[0]]; });
      if (anySolo) return st.solo[k] ? st.vol[k] : 0;
      return st.mute[k] ? 0 : st.vol[k];
    }
    function apply() {
      if (!st.ctx || !st.bus) return;
      LANES.forEach(function (l) { st.bus[l[0]].gain.setTargetAtTime(gainFor(l[0]) * 1.1, st.ctx.currentTime, 0.02); });
    }

    function toggle() {
      if (st.playing || st.loading) { stopDemo(); return; }
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { L.toast('Este navegador não toca áudio.'); return; }
      var ctx = st.ctx = new Ctx();
      try { ctx.resume(); } catch (e) { /* o navegador libera no toque */ }   // dentro do toque, para o iPhone deixar tocar
      st.loading = true;
      refresh();
      decodeSong(ctx).then(function (bufs) {
        if (st.ctx !== ctx) return;   // pausou ou saiu enquanto carregava
        st.bufs = bufs;
        st.barSec = bufs.bateria.duration / SONG.bars;
        var master = ctx.createDynamicsCompressor();
        master.connect(ctx.destination);
        st.bus = {}; st.an = {};
        LANES.forEach(function (l) {
          var g = ctx.createGain(), an = ctx.createAnalyser();
          an.fftSize = 256; g.connect(an); an.connect(master);
          st.bus[l[0]] = g; st.an[l[0]] = an;
        });
        apply();
        st.loading = false;
        st.playing = true;
        st.segs = []; st.live = [];
        var r = segRange();
        st.nextT = ctx.currentTime + 0.06;
        playSegment(r[0], r[1], st.nextT);
        st.nextT += (r[1] - r[0]) * st.barSec;
        st.timer = setInterval(schedule, 25);
        meter();
        refresh();
      }, function () {
        if (st.ctx !== ctx) return;
        stopDemo();
        L.toast('Não deu para carregar a música de exemplo. Confira a internet e tente de novo.');
      });
    }

    // Um trecho (compassos from..to) de todas as faixas juntas, começando em `when`. Toca um pouquinho a mais
    // (12 ms) com o final sumindo, enquanto o próximo trecho entra: a volta ao começo não estala.
    function segRange() { return st.loop ? [st.loop.from, st.loop.to] : [0, SONG.bars]; }
    function playSegment(from, to, when) {
      var ctx = st.ctx, dur = (to - from) * st.barSec, off = from * st.barSec;
      LANES.forEach(function (l) {
        var src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = st.bufs[l[0]];
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(1, when + XFADE);
        g.gain.setValueAtTime(1, when + dur);
        g.gain.linearRampToValueAtTime(0, when + dur + XFADE);
        src.connect(g); g.connect(st.bus[l[0]]);
        src.start(when, off, dur + XFADE);
        st.live.push({ src: src, g: g, end: when + dur + XFADE });
      });
      st.segs.push({ t0: when, from: from, dur: dur });
    }
    function schedule() {
      if (!root.isConnected) { stopDemo(); return; }
      var ctx = st.ctx;
      if (!ctx || !st.playing) return;
      while (st.nextT < ctx.currentTime + 0.25) {
        var r = segRange();
        playSegment(r[0], r[1], st.nextT);
        st.nextT += (r[1] - r[0]) * st.barSec;
      }
      st.live = st.live.filter(function (x) { return x.end > ctx.currentTime; });
      while (st.segs.length > 2 && st.segs[1].t0 < ctx.currentTime) st.segs.shift();
    }
    // Pular para um compasso (ao trocar de parte, ou ao soltar a repetição): corta o que estava tocando.
    function jumpTo(bar) {
      var ctx = st.ctx, now = ctx.currentTime;
      st.live.forEach(function (x) {
        try { x.g.gain.cancelScheduledValues(now); x.g.gain.setValueAtTime(x.g.gain.value, now); x.g.gain.linearRampToValueAtTime(0, now + XFADE); x.src.stop(now + XFADE + 0.01); } catch (e) { /* já parou */ }
      });
      st.live = []; st.segs = [];
      var r = segRange(), from = st.loop ? r[0] : bar;
      var when = now + 0.03;
      playSegment(from, r[1], when);
      st.nextT = when + (r[1] - from) * st.barSec;
    }
    function currentBar() {
      var ctx = st.ctx;
      if (!ctx) return 0;
      var now = ctx.currentTime, seg = null;
      for (var i = 0; i < st.segs.length; i++) if (st.segs[i].t0 <= now) seg = st.segs[i];
      if (!seg) return st.bar;
      return Math.min(SONG.bars - 1, seg.from + Math.max(0, Math.floor((now - seg.t0) / st.barSec)));
    }

    var buf = new Uint8Array(128);
    function meter() {
      if (!st.playing || !root.isConnected) { Object.keys(meters).forEach(function (k) { meters[k].style.height = '0'; }); st.level = 0; return; }
      var total = 0;
      LANES.forEach(function (l) {
        var an = st.an[l[0]]; an.getByteTimeDomainData(buf);
        var peak = 0; for (var i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
        // Escala que também mostra sons contínuos (voz, guitarras) e cai devagar, sem piscar entre as sílabas.
        var v = Math.max(Math.min(1, Math.sqrt(peak / 128) * 1.15), (st.hold[l[0]] || 0) * 0.9);
        st.hold[l[0]] = v;
        meters[l[0]].style.height = Math.round(v * 100) + '%';
        total += v;
      });
      st.level = st.level * 0.8 + Math.min(1, total / 3) * 0.2;
      st.bar = currentBar();
      if (!st.loop) refreshParts();
      requestAnimationFrame(meter);
    }
    var lastBar = -1;
    function refreshParts() { if (st.bar !== lastBar) { lastBar = st.bar; refresh(); } }

    // Baixa o áudio um pouco antes de a pessoa chegar na seção (1 MB), para o Tocar responder na hora.
    if ('IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { seen.disconnect(); fetchSong().catch(function () { /* tenta de novo no Tocar */ }); }
      }, { rootMargin: '600px 0px' });
      seen.observe(root);
    }

    refresh();
    return root;
  }

  A.stopDemo = stopDemo;

  // ------------------------------------------------------------------ Movimento (Motion, motion.dev)
  // Uma cena na abertura (o computador vem do fundo, o celular chega de lado com mola), os aparelhos
  // de cada recurso entrando um de cada vez, profundidade na rolagem e as listas em sequência.
  // Quem pede menos animação vê os aparelhos já no ângulo, sem movimento. Tudo roda uma vez só.
  var MOTION_URL = 'https://cdn.jsdelivr.net/npm/motion@11.18.2/dist/motion.js';
  var MOTION_SRI = 'sha384-lFfU+kVPBF9H3h8c1O+KQNuTRX7dilL8RZiy/kxQiYulHvYCHv4z+eba37GD2qTC';
  var EASE_OUT = [0.23, 1, 0.32, 1];
  var motionLoad = null;
  function loadMotion() {
    if (window.Motion) return Promise.resolve(window.Motion);
    if (!motionLoad) {
      motionLoad = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = MOTION_URL; s.integrity = MOTION_SRI; s.crossOrigin = 'anonymous'; s.async = true;
        s.onload = function () { window.Motion ? resolve(window.Motion) : reject(new Error('motion')); };
        s.onerror = function () { motionLoad = null; reject(new Error('motion')); };
        document.head.appendChild(s);
      });
    }
    return motionLoad;
  }

  function choreograph(page) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var actors = [].slice.call(page.querySelectorAll('.dev > *'));
    var lists = [].slice.call(page.querySelectorAll('.feat ul, .steps, .mixer .lanes'));
    var frames = [].slice.call(page.querySelectorAll('.vframe'));
    // Escondidos só enquanto esperam a vez; se a biblioteca não carregar, aparecem como estão.
    function hide() {
      actors.concat(frames).forEach(function (el) { el.style.opacity = '0'; });
      lists.forEach(function (l) { [].forEach.call(l.children, function (c) { c.style.opacity = '0'; }); });
    }
    function showAll() {
      actors.concat(frames).forEach(function (el) { el.style.opacity = ''; });
      lists.forEach(function (l) { [].forEach.call(l.children, function (c) { c.style.opacity = ''; }); });
    }
    hide();
    var fallback = setTimeout(showAll, 2500);
    loadMotion().then(function (M) {
      clearTimeout(fallback);
      if (!page.isConnected) return;
      run(M, page, actors, lists, frames);
    }, function () { clearTimeout(fallback); showAll(); });
  }

  function once(M, el, fn, amount) {
    var stop = M.inView(el, function () { stop(); fn(); }, { amount: amount || 0.25 });
  }

  function enter(M, el, extraDelay) {
    var a = el._anim;
    // Chega já no ângulo final (girar no caminho dava a impressão de esticar): só sobe e aparece.
    M.animate(el, { transform: [tf(a.from), tf(a.pose)] }, { duration: 0.9, ease: EASE_OUT, delay: a.delay + (extraDelay || 0) });
    M.animate(el, { opacity: [0, 1] }, { duration: 0.5, ease: EASE_OUT, delay: a.delay + (extraDelay || 0) });
  }

  function run(M, page, actors, lists, frames) {
    // Aparelhos: cada grupo entra quando chega na tela, um de cada vez.
    var groups = [];
    actors.forEach(function (el) {
      var g = el.closest('.stage, .pic');
      if (groups.indexOf(g) < 0) groups.push(g);
    });
    groups.forEach(function (g) {
      var mine = actors.filter(function (el) { return el.closest('.stage, .pic') === g; });
      once(M, g, function () { mine.forEach(function (el) { enter(M, el); }); }, 0.2);
    });

    // Profundidade: o de trás anda menos que o da frente quando a página rola.
    [].forEach.call(page.querySelectorAll('.dev'), function (d) {
      var depth = +d.getAttribute('data-depth') || 0;
      if (!depth) return;
      var target = d.closest('.hero, .feat') || d;
      M.scroll(M.animate(d, { transform: ['translateY(' + depth + 'px)', 'translateY(' + (-depth) + 'px)'] }, { ease: 'linear' }),
        { target: target, offset: ['start end', 'end start'] });
    });

    // Listas que aparecem como lista: itens em sequência curta.
    lists.forEach(function (l) {
      once(M, l, function () {
        M.animate([].slice.call(l.children), { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] },
          { delay: M.stagger(l.classList.contains('steps') ? 0.12 : 0.07), duration: 0.6, ease: EASE_OUT });
      }, 0.3);
    });

    frames.forEach(function (f) {
      once(M, f, function () {
        M.animate(f, { opacity: [0, 1], transform: ['scale(0.96)', 'scale(1)'] }, { duration: 0.8, ease: EASE_OUT });
      }, 0.25);
    });

    // Abertura: a cena se inclina de leve seguindo o mouse (só com mouse; no toque não faz nada).
    var stage = page.querySelector('.stage');
    if (stage && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var box = page.querySelector('.hero');
      var spring = { type: 'spring', stiffness: 90, damping: 20 };
      stage.style.transform = 'perspective(1800px) rotateX(0deg) rotateY(0deg)';
      box.addEventListener('pointermove', function (e) {
        var r = box.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1;
        M.animate(stage, { transform: 'perspective(1800px) rotateX(' + (-ny * 1.5).toFixed(2) + 'deg) rotateY(' + (nx * 2.5).toFixed(2) + 'deg)' }, spring);
      });
      box.addEventListener('pointerleave', function () { M.animate(stage, { transform: 'perspective(1800px) rotateX(0deg) rotateY(0deg)' }, spring); });
    }
  }
})();
