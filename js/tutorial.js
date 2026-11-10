// Tutorial do site com fotos de verdade (mobile/img/tutorial, tiradas por mobile/tests/steps-tutfotos.js).
// Cada passo: a foto com uma marcação piscando onde tocar, o título e a explicação. Marcações em fração da foto
// [x, y, largura, altura], medidas na própria tela (veja a saída "MARCAS" do roteiro de fotos).
(function () {
  var L = window.L, h = L.h, ic = L.ic, U = L.ui;

  var CH = [
    { icon: 'House', title: 'Começando', sub: 'A tela de Início e as abas', tab: 'inicio', steps: [
      ['inicio', 'Sua próxima escala', 'Assim que você entra, aparece a próxima escala em que você está: o dia, a hora, o local e a sua função. Ensaiar abre as músicas; Ver escala abre tudo.', [[0.03, 0.123, 0.94, 0.275]]],
      ['inicio', 'Ver todas as escalas', 'O Início mostra só as escalas em que você está. Toque aqui para ver as da banda inteira.', [[0.03, 0.394, 0.468, 0.051]]],
      ['inicio', 'Avisos e novidades', 'O ícone de jornal abre o mural do líder e as novidades do site.', [[0.7, 0.056, 0.14, 0.063]]],
      ['inicio', 'As abas', 'Embaixo ficam as seis partes: Início, Escalas, Repertório, Conversa, Banda e Eu. Os números mostram o que está esperando por você. No computador, as abas ficam no menu da esquerda.', [[0, 0.913, 1, 0.087]]]
    ] },
    { icon: 'CalendarDays', title: 'Escalas', sub: 'Ver, confirmar e se preparar', tab: 'escalas', steps: [
      ['escalas', 'Suas escalas', 'Cada cartão é um culto, ensaio ou evento. A borda colorida quer dizer que você está nela; embaixo aparecem a sua função e a sua resposta.', [[0.03, 0.4, 0.94, 0.115]]],
      ['escalas', 'Próximas, Minhas e Calendário', '"Minhas" mostra só as escalas em que você está. "Calendário" mostra o mês inteiro.', [[0.03, 0.227, 0.94, 0.054]]],
      ['calendario', 'O calendário', 'Os pontinhos marcam os dias com escala. Toque num dia para ver o que tem.', [[0.03, 0.285, 0.94, 0.447]]],
      ['escala', 'Confirme a presença', 'Dentro da escala, logo abaixo de quando e onde, toque em Confirmar ou em Não posso. Depois de confirmar, aparece também "Pedir troca".', [[0.03, 0.286, 0.94, 0.153]]],
      ['escala', 'Ensaiei', 'Ensaiou uma música? Toque em Ensaiei nela. A barra mostra quanto a banda toda já está pronta.', [[0.595, 0.656, 0.2, 0.047]]],
      ['escala_menu', 'Mais opções da música', 'Os três pontinhos abrem a música no estúdio ou a ficha. Quem monta a escala também muda o tom do dia e escolhe quem canta: aparece "Canta: …" embaixo do nome.', [[0.315, 0.865, 0.62, 0.06]]],
      ['escala', 'Conversa da escala', 'O balão no alto abre a conversa só desta escala.', [[0.7, 0.013, 0.14, 0.063]]],
      ['naoposso', 'Dias que não posso', 'Em Eu (ou em Escalas › Minhas), Dias que não posso: toque nos dias em que você não pode. Quem monta a escala já vê.', [[0.03, 0.155, 0.94, 0.447]]]
    ] },
    { icon: 'Sparkles', title: 'Montar escalas', sub: 'Quem monta escalas', onlyIf: function () { return L.perm.schedule(); }, tab: 'escalas', steps: [
      ['escalas', 'Nova escala', 'O botão Nova escala abre o passo a passo: dia, músicas, ministro, vozes, músicos e técnica.', [[0.566, 0.829, 0.404, 0.072]]],
      ['wiz1', 'As etapas', 'A barra mostra em qual das 7 etapas você está. Um horário fixo da igreja preenche o dia, a hora e o local num toque.', [[0.01, 0.058, 0.98, 0.027], [0.06, 0.198, 0.242, 0.031]]],
      ['escalas', 'Gerenciar escalas', 'Criar o mês inteiro pela agenda fixa, preencher as vagas automaticamente, equipes fixas e mudar várias escalas de uma vez.', [[0.03, 0.123, 0.94, 0.099]]]
    ] },
    { icon: 'Library', title: 'Repertório', sub: 'As músicas da banda', tab: 'musicas', steps: [
      ['repertorio', 'As músicas', 'Cada linha é uma música, com o tom e se tem multitrack. Toque nela para abrir a ficha.', [[0.03, 0.2, 0.94, 0.095]]],
      ['repertorio', 'Buscar e filtrar', 'Procure por nome, artista ou tom. O botão ao lado mostra os filtros, como "Das próximas escalas".', [[0.03, 0.123, 0.94, 0.072]]],
      ['ficha', 'A ficha da música', 'Tom da banda (e o original), BPM e compasso. "Ouvir com multitrack" abre o estúdio.', [[0.035, 0.502, 0.93, 0.098], [0.035, 0.606, 0.93, 0.07]]],
      ['repertorio', 'Planilha', 'Para quem cuida do repertório: importe muitas músicas de uma vez por uma planilha (.xlsx ou .csv) ou exporte o repertório.', [[0.521, 0.056, 0.319, 0.063]]],
      ['repertorio', 'Adicionar música', 'Aparece para o líder e para quem ele liberou: nome, link do YouTube, tom, BPM e as faixas (multitrack).', [[0.477, 0.829, 0.493, 0.072]]]
    ] },
    { icon: 'SlidersHorizontal', title: 'Estúdio', sub: 'Ouvir e ensaiar', tab: 'musicas', steps: [
      ['estudio', 'Tocar', 'A música só toca e pausa pelo botão Tocar.', [[0.397, 0.88, 0.205, 0.104]]],
      ['estudio', 'Partes da música', 'Toque numa parte (Intro, Verso, Refrão…) para ir até ela. Com Repetir ligado, ela fica repetindo.', [[0.02, 0.337, 0.96, 0.056]]],
      ['estudio', 'De onde tocar', 'Toque na régua ou numa faixa para pôr o cursor ali. Dois toques e arrastar marca um trecho para repetir.', [[0.02, 0.456, 0.96, 0.07]]],
      ['estudio', 'Cada faixa', 'M silencia a faixa, S deixa só ela tocando, e o controle muda o volume.', [[0.02, 0.517, 0.96, 0.081]]],
      ['estudio', 'Ferramentas', 'Mover, cortar, aparar, volume e partes, como num editor. Cada um edita a própria voz; quem o líder liberou edita também as faixas da banda.', [[0.02, 0.162, 0.96, 0.078]]]
    ] },
    { icon: 'MessagesSquare', title: 'Banda e conversas', sub: 'A banda junta', tab: 'conversa', steps: [
      ['conversa', 'Conversa da banda', 'Todo mundo da banda lê e escreve aqui. Segure (ou clique com o botão direito) numa mensagem para apagar, denunciar ou bloquear.', [[0, 0.838, 1, 0.081]]],
      ['banda', 'Convidar e as pessoas', 'Na aba Banda fica o código de convite (mande pelo WhatsApp) e a lista das pessoas. O líder toca numa pessoa para mudar as permissões.', [[0.03, 0.123, 0.94, 0.297]]]
    ] },
    { icon: 'CircleUserRound', title: 'Eu', sub: 'Perfil e plano', tab: 'eu', steps: [
      ['eu', 'Dias que não posso', 'Marque os dias em que você não pode e os horários em que costuma poder.', [[0.03, 0.164, 0.94, 0.135]]],
      ['eu', 'Plano da banda', 'O plano, quantas pessoas e o espaço que a banda usa na nuvem.', [[0.03, 0.303, 0.94, 0.384]]]
    ] }
  ];
  var IDX = { inicio: 0, escalas: 1, montar: 2, repertorio: 3, estudio: 4, banda: 5, eu: 6 };
  L.TUT = IDX;

  function visible(i) { return !CH[i].onlyIf || CH[i].onlyIf(); }

  /** "?" no alto de cada aba: abre o tutorial daquela parte. */
  U.helpBtn = function (key) {
    return U.iconBtn('CircleHelp', 'Como usar esta tela', function () { L.go({ name: 'tutorial', chapter: IDX[key] }); });
  };

  var T = { step: 0, chapter: null };

  L.screen('tutorial', function (r) {
    if (r.chapter == null) return list();
    if (T.chapter !== r.chapter) { T.chapter = r.chapter; T.step = 0; }
    return view(r.chapter);
  });

  function list() {
    return h('div', { class: 'screen' },
      U.topRow('Tutorial', 'Como usar cada parte do site'),
      U.body('Escolha um assunto. Cada passo mostra a tela de verdade, com a marcação piscando onde tocar.', 'var(--muted)', 13),
      CH.map(function (c, i) {
        if (!visible(i)) return null;
        return h('button', { class: 'tutch', onclick: function () { L.go({ name: 'tutorial', chapter: i }); } },
          h('span', { class: 'tutico' }, ic(c.icon, 22)),
          h('span', { class: 'grow' }, h('span', { class: 'hi semi' }, c.title), h('span', { class: 'muted small' }, c.sub + ' · ' + c.steps.length + ' passos')),
          ic('ChevronRight', 18));
      }),
      U.body('As fotos usam uma banda de exemplo.', 'var(--muted)', 11));
  }

  function view(i) {
    var c = CH[i];
    var n = c.steps.length;
    var st = c.steps[Math.min(T.step, n - 1)];
    var marks = st[3].map(function (m) {
      return h('span', { class: 'tutmark', style: { left: m[0] * 100 + '%', top: m[1] * 100 + '%', width: m[2] * 100 + '%', height: m[3] * 100 + '%' } });
    });
    var next = null;
    for (var j = i + 1; j < CH.length; j++) if (visible(j)) { next = j; break; }
    function go(d) { T.step = Math.max(0, Math.min(n - 1, T.step + d)); L.render(); }
    var last = T.step >= n - 1;
    return h('div', { class: 'screen tutview' },
      U.topRow(c.title, 'Passo ' + (T.step + 1) + ' de ' + n),
      h('div', { class: 'tutdots' }, c.steps.map(function (_, k) { return h('span', { class: k === T.step ? 'on' : '' }); })),
      h('div', { class: 'tutphone' }, h('img', { src: 'img/tutorial/' + st[0] + '.jpg', alt: 'Tela: ' + st[1] }), marks),
      h('div', { class: 'tuttext' }, h('h2', { class: 'semi' }, st[1]), h('p', null, st[2])),
      h('div', { class: 'row tutnav' },
        T.step > 0 ? U.btn2('Voltar', 'ChevronLeft', function () { go(-1); }) : h('span', { class: 'grow' }),
        h('span', { class: 'grow' }),
        last
          ? (next != null
            ? U.btn('Próximo assunto', 'ChevronRight', function () { L.back(); setTimeout(function () { L.go({ name: 'tutorial', chapter: next }); }, 30); })
            : U.btn('Concluir', 'Check', function () { L.back(); }))
          : U.btn('Próximo', 'ChevronRight', function () { go(1); })));
  }
})();
