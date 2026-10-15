// Louvor Studio — prévia das telas que só existem no app do celular
// (gravar, minhas tomadas, áudio e calibração, preparar offline, envios).
// Tudo aqui é DEMONSTRAÇÃO com dados de exemplo: nada grava, mede ou envia de verdade.
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }

  var SCREENS = [
    { id: 'gravar', label: 'Gravar' },
    { id: 'tomadas', label: 'Minhas tomadas' },
    { id: 'audio', label: 'Áudio e calibração' },
    { id: 'offline', label: 'Preparar offline' },
    { id: 'envios', label: 'Envios' }
  ];

  var demo = { screen: 'gravar', recording: false };

  function tap() {
    A().flash('info', 'Demonstração: no app do celular este botão funciona de verdade. Aqui é só para você ver como fica.');
    A().rerender();
  }

  function waveBars(n, seed, color, fill) {
    var bars = [];
    for (var i = 0; i < n; i++) {
      var hgt = Math.round(6 + Math.abs(Math.sin(i * 0.55 + seed) + 0.7 * Math.sin(i * 0.2 + seed * 0.6)) * 12);
      bars.push(h('i', { style: 'height:' + hgt + 'px;background:' + color + ';opacity:' + (i / n < fill ? 1 : 0.4) }));
    }
    return h('div', { class: 'ph-wave' }, bars);
  }

  function chip(text, kind) {
    return h('span', { class: 'chip' + (kind ? ' ' + kind : '') }, text);
  }

  function gravar() {
    var lanes = [['Bateria', '#A39A8C', 1], ['Baixo', '#9AA7B0', 2], ['Teclado', '#A59CB5', 3], ['Guia vocal', '#B09A8E', 5], ['Voz 2 · você', '#FF5760', 7]];
    return h('div', { class: 'ph-body' },
      h('div', { class: 'row', style: 'gap:6px' }, chip('Offline', 'ok'), chip('Fone Bluetooth · sync estável', 'ok')),
      h('div', { class: 'stack', style: 'gap:6px' }, lanes.map(function (l, i) {
        return h('div', { class: 'ph-lane' },
          h('button', { class: 'ph-ms', onclick: tap }, 'M'), h('button', { class: 'ph-ms', onclick: tap }, 'S'),
          h('div', { class: 'ph-strip' }, h('span', { style: 'color:' + l[1] }, l[0]), waveBars(22, l[2], l[1], i === 4 && !demo.recording ? 0 : 0.37)));
      })),
      h('div', { style: 'text-align:center;margin-top:14px' },
        h('div', { class: 'mono', style: 'font-size:38px' }, '1:32', h('span', { class: 'mu', style: 'font-size:15px' }, ' / 4:12')),
        h('p', { class: 'mu', style: 'margin:6px 0 14px;font-size:13px' }, demo.recording ? 'Gravando a tomada 4 · Voz 2 (simulação)' : 'Compensação desta rota: 187 ms · 3 tomadas suas')),
      h('div', { class: 'row', style: 'justify-content:center;gap:22px' },
        h('button', { class: 'ph-round', 'aria-label': 'Voltar ao início', onclick: tap }, '⏮'),
        h('button', { class: 'ph-round big', 'aria-label': 'Tocar', onclick: tap }, '▶'),
        h('button', { class: 'ph-round rec' + (demo.recording ? ' on' : ''), 'aria-label': 'Gravar (simulação)', onclick: function () {
          demo.recording = !demo.recording;
          A().rerender();
        } }, h('i', null)))
    );
  }

  function tomadas() {
    var list = [['Tomada 4', 'Hoje, 14:31 · compensação 187 ms', 'Só no aparelho', 'warn'], ['Tomada 3', 'Hoje, 14:12 · Ana: “ficou ótima”', 'Aprovada', 'ok'],
      ['Tomada 2', 'Hoje, 13:58 · enviada', 'Enviada', 'ok'], ['Tomada 1', 'Hoje, 13:41 · pedido de nova gravação', 'Refazer', 'bad']];
    return h('div', { class: 'ph-body' },
      h('div', { class: 'ph-card' }, h('div', { class: 'row', style: 'gap:12px;flex-wrap:nowrap' },
        h('button', { class: 'ph-round big', 'aria-label': 'Ouvir', onclick: tap }, '▶'), waveBars(34, 1.3, '#FF5760', 1))),
      list.map(function (t, i) {
        return h('div', { class: 'ph-take' + (i === 0 ? ' on' : '') },
          h('div', { style: 'flex:1;min-width:0' }, h('b', null, t[0]), h('div', { class: 'mu', style: 'font-size:12px' }, t[1])), chip(t[2], t[3]));
      }),
      h('div', { class: 'row', style: 'gap:8px;justify-content:center' },
        h('span', { class: 'mu', style: 'font-size:13px' }, 'Ajuste fino'), h('button', { class: 'ph-ms', onclick: tap }, '−'),
        h('span', { class: 'mono' }, '+0 ms'), h('button', { class: 'ph-ms', onclick: tap }, '+')),
      h('button', { class: 'btn', style: 'width:100%', onclick: function () { demo.screen = 'gravar'; A().rerender(); } }, 'Gravar nova tomada')
    );
  }

  function audio() {
    return h('div', { class: 'ph-body' },
      h('div', { class: 'ph-card stack' },
        h('div', { class: 'row sp-b' }, h('span', { class: 'sec', style: 'margin:0' }, 'Em uso agora'), chip('Automático', 'go')),
        h('div', { class: 'row sp-b' }, h('span', { class: 'mu' }, 'Gravando com'), h('b', null, 'Microfone do iPhone')),
        h('div', { class: 'row sp-b' }, h('span', { class: 'mu' }, 'Ouvindo em'), h('b', null, 'Fone Bluetooth')),
        h('p', { class: 'mu', style: 'margin:0;font-size:13px' }, 'O fone só toca a base e o celular grava a sua voz. Mantenha o celular perto da boca.')),
      h('div', { class: 'ph-card stack' },
        h('span', { class: 'sec', style: 'margin:0' }, 'Calibração desta sessão'),
        h('div', { class: 'row', style: 'align-items:baseline;gap:8px' }, h('span', { class: 'mono', style: 'font-size:42px' }, '187'), h('span', { class: 'mu mono' }, 'ms'), h('span', { class: 'mu mono', style: 'margin-left:auto' }, '± 1,4 ms')),
        h('div', { class: 'msg ok', style: 'margin:0' }, 'Estável. Pode gravar com esta rota.'),
        h('button', { class: 'btn', onclick: tap }, 'Medir de novo (5 s)')),
      h('div', { class: 'ph-card stack' },
        h('div', { class: 'row sp-b' }, h('b', null, 'Modo à distância (AirPods)'), chip('Desligado')),
        h('div', { class: 'row sp-b' }, h('b', null, 'Interface de áudio USB'), h('span', { class: 'mu' }, 'Nenhuma conectada')))
    );
  }

  function offline() {
    var items = [['Bateria', 'Pronta', 100], ['Baixo', 'Pronta', 100], ['Teclado', '62%', 62], ['Guitarra', 'Na fila', 0], ['Guia vocal', 'Na fila', 0]];
    return h('div', { class: 'ph-body' },
      h('div', { class: 'ph-card row sp-b' }, h('div', null, h('span', { class: 'mu' }, 'Vai ocupar'), h('div', { style: 'font:700 22px var(--fd)' }, '286 MB')),
        h('div', { style: 'text-align:right' }, h('span', { class: 'mu' }, 'Livre no aparelho'), h('div', { style: 'font:700 22px var(--fd)' }, '14,2 GB'))),
      items.map(function (it) {
        return h('div', { class: 'ph-take' },
          h('input', { type: 'checkbox', checked: true, onclick: function (ev) { ev.preventDefault(); tap(); } }),
          h('div', { style: 'flex:1' }, h('b', null, it[0]), it[2] > 0 && it[2] < 100 ? h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: 'width:' + it[2] + '%' })) : null),
          h('span', { class: 'mono', style: 'font-size:12px;color:' + (it[2] === 100 ? 'var(--ok)' : 'var(--mu)') }, it[1]));
      }),
      h('button', { class: 'btn', style: 'width:100%', onclick: tap }, 'Continuar baixando')
    );
  }

  function envios() {
    var jobs = [['Tudo é Teu · Tomada 4', 'FLAC · 46 MB', 'Enviando 38%', 'go', 38], ['Rendição · Tomada 2', 'Não conseguiu confirmar o envio', 'Falha no envio', 'bad', 0],
      ['Tudo é Teu · Tomada 3', 'FLAC · 44 MB', 'Aguardando Wi-Fi', 'warn', 0], ['Tudo é Teu · Tomada 2', 'Recebida e conferida pelo servidor', 'Sincronizado', 'ok', 0]];
    return h('div', { class: 'ph-body' },
      h('div', { class: 'ph-card stack' }, h('div', { class: 'row sp-b' }, h('b', null, 'Enviar só no Wi-Fi'), chip('Ligado', 'ok'))),
      jobs.map(function (j) {
        return h('div', { class: 'ph-card stack' },
          h('div', { class: 'row sp-b', style: 'flex-wrap:nowrap' }, h('div', null, h('b', null, j[0]), h('div', { class: 'mu', style: 'font-size:12px' }, j[1])), chip(j[2], j[3])),
          j[4] ? h('div', { class: 'bar' }, h('i', { style: 'width:' + j[4] + '%' })) : null,
          j[3] === 'bad' ? h('div', null, h('button', { class: 'btn sec2 sm', onclick: tap }, 'Tentar de novo')) : null);
      })
    );
  }

  var RENDER = { gravar: gravar, tomadas: tomadas, audio: audio, offline: offline, envios: envios };

  function view() {
    var current = SCREENS.find(function (s) { return s.id === demo.screen; });
    return h('div', null,
      h('h1', null, 'App do celular (prévia)'),
      h('div', { class: 'demo-note', style: 'margin-bottom:18px' },
        h('b', null, 'Demonstração. '),
        'Estas telas só funcionam de verdade no app do iPhone, que usa o microfone, o fone e o armazenamento do celular. Aqui elas mostram como vão ficar, com dados de exemplo: nada é gravado, medido ou enviado.'),
      h('div', { class: 'row', style: 'gap:8px;margin-bottom:18px' }, SCREENS.map(function (s) {
        return h('button', { class: 'rp-chip' + (s.id === demo.screen ? ' on' : ''), 'aria-pressed': s.id === demo.screen ? 'true' : 'false',
          onclick: function () { demo.screen = s.id; demo.recording = false; A().rerender(); } }, s.label);
      })),
      h('div', { class: 'phone', 'aria-label': 'Prévia da tela ' + current.label + ' no celular' },
        h('div', { class: 'ph-head' }, h('span', { class: 'mu', style: 'font-size:12px' }, 'Tudo é Teu · Voz 2'), h('b', { style: 'font:700 22px var(--fd)' }, current.label)),
        RENDER[demo.screen]())
    );
  }

  window.AppDemo = { view: view };
})();
