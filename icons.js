// Louvor Studio — ícones do painel (Lucide, licença ISC: https://lucide.dev).
// Um lugar só para escolher o ícone de cada tela, ação, estado, instrumento e função.
// Se a biblioteca não carregar (sem internet), o painel continua funcionando só com texto.
(function (root) {
  'use strict';

  var NAMES = {
    // Telas
    repertorio: 'Library', estudio: 'SlidersHorizontal', projetos: 'FolderOpen', revisao: 'Headphones',
    exportar: 'Download', agenda: 'CalendarDays', mural: 'Megaphone', equipe: 'Users', banda: 'Speaker', perfil: 'UserRound', ajustes: 'Settings', app: 'Smartphone',
    // Ações
    play: 'Play', stop: 'Square', pause: 'Pause', rewind: 'SkipBack', loop: 'Repeat', undo: 'Undo2', redo: 'Redo2',
    zoomIn: 'ZoomIn', zoomOut: 'ZoomOut', volume: 'Volume2', search: 'Search', copy: 'Copy', logout: 'LogOut',
    edit: 'Pencil', trash: 'Trash2', upload: 'Upload', download: 'Download', publish: 'Send', discard: 'X', reset: 'RotateCcw',
    add: 'Plus', comment: 'MessageSquare', camera: 'Camera', voices: 'Users', rehearse: 'Headphones', listen: 'Ear',
    move: 'Move', trim: 'Scissors', fade: 'Spline', snap: 'Magnet', menuOpen: 'PanelLeftOpen', menuClose: 'PanelLeftClose',
    grid: 'Grid3x3', redetect: 'RefreshCw', flag: 'Flag', secPrev: 'ChevronLeft', secNext: 'ChevronRight',
    // Estados
    check: 'Check', ok: 'CircleCheckBig', approved: 'BadgeCheck', redo2: 'RotateCcw', pending: 'Clock', verified: 'ShieldCheck',
    warn: 'TriangleAlert', error: 'CircleX', lock: 'Lock', unlock: 'LockOpen', released: 'Headphones', leader: 'Crown',
    storage: 'HardDrive', song: 'Music2', list: 'ListMusic', file: 'FileAudio', time: 'Timer', key: 'Music4', tempo: 'Gauge',
    // Instrumentos
    drums: 'Drum', bass: 'Guitar', guitar: 'Guitar', acoustic: 'Guitar', keys: 'Piano', synth: 'KeyboardMusic',
    pad: 'AudioWaveform', vocal: 'Mic', guide: 'Megaphone', click: 'Timer', perc: 'Drum', strings: 'Music4',
    brass: 'Music2', other: 'AudioLines', take: 'Mic',
    // Funções no ministério
    fn_ministro: 'Crown', fn_vocal: 'Mic', fn_backing_vocal: 'UsersRound', fn_violao: 'Guitar', fn_guitarra: 'Guitar',
    fn_baixo: 'Guitar', fn_bateria: 'Drum', fn_teclado: 'Piano', fn_percussao: 'Drum', fn_sopro: 'Music2',
    fn_cordas: 'Music4', fn_tecnico_som: 'SlidersVertical', fn_projecao: 'Monitor'
  };

  function lib() {
    var L = root.lucide;
    return L && typeof L.createElement === 'function' ? L : null;
  }

  // Ícone como elemento SVG (decorativo: o texto ou aria-label do botão é que dá o nome).
  function icon(key, size, extraClass) {
    var L = lib();
    var name = NAMES[key] || key;
    var node = L && (L.icons ? L.icons[name] : L[name]);
    var s = size || 16;
    if (!node) {
      var blank = document.createElement('span');
      blank.className = 'ic ic-missing' + (extraClass ? ' ' + extraClass : '');
      blank.setAttribute('aria-hidden', 'true');
      return blank;
    }
    var el = L.createElement(node);
    el.setAttribute('width', String(s));
    el.setAttribute('height', String(s));
    el.setAttribute('stroke-width', s <= 14 ? '2' : '1.75');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    el.setAttribute('class', 'ic' + (extraClass ? ' ' + extraClass : ''));
    el.setAttribute('data-icon', name); // nome do ícone na biblioteca (ajuda a depurar e a testar)
    return el;
  }

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Descobre o instrumento pelo nome da faixa ("Bateria", "Baixo", "Guia vocal"...).
  var RULES = [
    [/bater|drum|kick|caixa|snare|tom\b|prato|overhead/, 'drums'],
    [/baix|bass/, 'bass'],
    [/viol[aã]o|acust|acoust/, 'acoustic'],
    [/guit|gtr/, 'guitar'],
    [/tecl|key|piano|rhodes|orgao|organ/, 'keys'],
    [/synth|sint/, 'synth'],
    [/\bpad|ambien|atmos|textur/, 'pad'],
    [/guia|guide|cue/, 'guide'],
    [/voz|vocal|vox|voice|coro|choir|back/, 'vocal'],
    [/click|metro|clique/, 'click'],
    [/perc|shaker|conga|cajon|pandeiro|tamb/, 'perc'],
    [/cord|string|violino|violin|cello|viola\b/, 'strings'],
    [/sopro|metai|brass|sax|trompete|trumpet|trombone|flaut/, 'brass']
  ];

  function instrumentFor(name) {
    var n = norm(name);
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(n)) return RULES[i][1];
    return 'other';
  }

  function forFunction(fnId) {
    return 'fn_' + fnId;
  }

  root.Icons = { icon: icon, instrumentFor: instrumentFor, forFunction: forFunction, NAMES: NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
