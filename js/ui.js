// Louvor Studio (web para celular) — peças da tela (as mesmas de ui/Components.kt do app).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic;
  var U = L.ui = {};

  U.label = function (text, color) { return h('div', { class: 'label', style: color ? { color: color } : null }, text); };
  U.body = function (text, color, size) {
    return h('p', { class: 'body', style: { color: color || null, fontSize: size ? size + 'px' : null, lineHeight: size ? (size + 5) + 'px' : null } }, text);
  };
  U.title = function (text, sub) { return h('div', { class: 'col', style: { gap: '2px' } }, h('div', { class: 'title' }, text), sub ? h('div', { class: 'sub' }, sub) : null); };
  U.empty = function (text) { return h('div', { class: 'empty' }, text); };

  U.panel = function (title, icon) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return h('section', { class: 'panel' }, title ? h('div', { class: 'ph' }, icon ? ic(icon, 15) : null, U.label(title)) : null, kids);
  };
  U.keyValue = function (k, v, mono) {
    return h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'muted grow', style: { fontSize: '13px' } }, k),
      h('span', { class: 'hi' + (mono ? ' mono' : ''), style: { fontSize: '13px' } }, v));
  };

  /** Botão vermelho (PrimaryButton). opts: { full, tall, disabled, cls } */
  U.btn = function (text, icon, onclick, opts) {
    opts = opts || {};
    return h('button', { class: 'btn' + (opts.full ? ' full' : '') + (opts.tall ? ' tall' : '') + (opts.cls ? ' ' + opts.cls : ''), disabled: !!opts.disabled, onclick: onclick, style: opts.style },
      icon ? ic(icon, 18) : null, text);
  };
  /** Botão cinza (SecondaryButton). opts: { full, danger, disabled } */
  U.btn2 = function (text, icon, onclick, opts) {
    opts = opts || {};
    return h('button', { class: 'btn2' + (opts.full ? ' full' : '') + (opts.danger ? ' danger' : ''), disabled: !!opts.disabled, onclick: onclick, style: opts.style },
      icon ? ic(icon, 18) : null, text);
  };
  U.iconBtn = function (icon, label, onclick, opts) {
    opts = opts || {};
    return h('button', { class: 'iconbtn', 'aria-label': label, title: label, disabled: !!opts.disabled, onclick: onclick, style: opts.color ? { color: opts.color } : null },
      ic(icon, 20), opts.badge ? h('span', { class: 'badge' }, opts.badge > 9 ? '9+' : String(opts.badge)) : null);
  };
  U.textBtn = function (text, onclick, color) { return h('button', { class: 'textbtn', style: color ? { color: color } : null, onclick: onclick }, text); };

  /** Chip de situação. kind: '' | ok | warn | bad | accent */
  U.chip = function (text, kind, icon) { return h('span', { class: 'chip' + (kind ? ' ' + kind : '') }, icon ? ic(icon, 12) : null, text); };
  U.statusFor = function (p) {
    if (p.swap_requested) return U.chip('Pediu troca', 'warn', 'RefreshCw');
    if (p.status === 'confirmado') return U.chip('Confirmado', 'ok', 'Check');
    if (p.status === 'recusado') return U.chip('Não pode', 'bad', 'X');
    return U.chip('Sem resposta', '', 'Clock');
  };
  U.toggle = function (text, on, icon, onclick) {
    return h('button', { class: 'chiptog' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: onclick }, icon ? ic(icon, 15) : null, text);
  };
  U.bar = function (f, color) { return h('div', { class: 'bar' }, h('i', { style: { width: Math.max(0, Math.min(1, f)) * 100 + '%', background: color || null } })); };
  U.badge = function (n) { return h('span', { class: 'badge inline' }, n > 9 ? '9+' : String(n)); };
  U.neon = function (icon, on, label, size) { return h('span', { class: 'neon' + (on ? ' on' : ''), title: label, 'aria-label': label }, ic(icon, size || 18)); };

  // ------------------------------------------------------------------ Capas e avatares
  var COLORS = ['#e9a863', '#6cc4b0', '#9ba7ec', '#e384ae', '#b7d46b', '#7dbae4', '#dcc65f', '#c59de3'];
  U.colorFor = function (id) {
    var n = 0;
    for (var i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
    return COLORS[n % COLORS.length];
  };
  U.youtubeId = function (url) {
    var m = url && /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(url);
    return m ? m[1] : null;
  };
  U.youtubeThumb = function (url) { var id = U.youtubeId(url); return id ? 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg' : null; };

  /** Capa da música: a enviada pela banda, a miniatura do YouTube, ou a cor com a inicial. */
  U.cover = function (p, size, corner, letter) {
    var url = S.coverUrls[p.id] || U.youtubeThumb(p.version_url);
    var sz = typeof size === 'number' ? size + 'px' : size;
    var el = h('span', { class: 'cover', style: { width: sz, height: sz, borderRadius: (corner || 6) + 'px', background: U.colorFor(p.id), fontSize: (letter || (typeof size === 'number' ? size * 0.45 : 44)) + 'px' } },
      (p.song_title || '?').trim().charAt(0).toUpperCase());
    if (url) {
      var img = h('img', { alt: '', loading: 'lazy', src: url, style: { position: 'absolute', inset: '0' } });
      img.onerror = function () { img.remove(); };
      el.appendChild(img);
    }
    return el;
  };

  U.avatar = function (m, size) {
    var s = size || 40;
    var name = (m && m.name) || '?';
    var parts = name.trim().split(/\s+/);
    var ini = (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
    var el = h('span', { class: 'avatar', style: { width: s + 'px', height: s + 'px', background: U.colorFor((m && m.user_id) || name), fontSize: Math.round(s * 0.38) + 'px' } }, ini);
    var url = m && S.avatarUrls[m.user_id];
    if (url) { el.textContent = ''; var img = h('img', { alt: '', src: url }); img.onerror = function () { el.textContent = ini; }; el.appendChild(img); }
    return el;
  };

  // ------------------------------------------------------------------ Campos
  /** Campo com o nome dentro (como o OutlinedTextField). opts: { type, multiline, max, rows, inputmode, autocomplete } */
  U.field = function (value, label, oninput, opts) {
    opts = opts || {};
    var input = opts.multiline
      ? h('textarea', { placeholder: ' ', rows: opts.rows || 3, maxlength: opts.max || null })
      : h('input', { type: opts.type || 'text', placeholder: ' ', maxlength: opts.max || null, inputmode: opts.inputmode || null, autocomplete: opts.autocomplete || 'off', enterkeyhint: opts.enter || null });
    input.value = value || '';
    input.addEventListener('input', function () { oninput(input.value); });
    if (opts.onenter) input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !opts.multiline) opts.onenter(); });
    return h('label', { class: 'field' }, input, h('span', null, label));
  };

  U.switchRow = function (title, sub, checked, onchange, disabled) {
    var sw = h('input', { type: 'checkbox', class: 'switch', checked: checked, disabled: !!disabled, 'aria-label': title });
    sw.addEventListener('change', function () { onchange(sw.checked); });
    return h('label', { class: 'switchrow' }, h('div', { class: 'grow col', style: { gap: '2px' } }, h('div', { class: 't' }, title), sub ? h('div', { class: 'muted small' }, sub) : null), sw);
  };

  U.clickRow = function (onclick) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('div', { class: 'clickrow', role: 'button', tabindex: '0', onclick: onclick }, kids);
  };
  /** Linha de menu grande: ícone, título, explicação e seta. */
  U.menuRow = function (icon, title, sub, onclick, warn) {
    return U.clickRow(onclick,
      h('span', { class: 'circle', style: warn ? { color: 'var(--warn)' } : null }, ic(icon, 19)),
      h('div', { class: 'grow' }, h('div', { class: 'hi semi', style: { fontSize: '15px' } }, title), h('div', { class: 'small', style: { color: warn ? 'var(--warn)' : 'var(--muted)' } }, sub)),
      ic('ChevronRight', 18, 'muted'));
  };

  /** Topo das telas de dentro: voltar, título e ações. */
  U.topRow = function (title, sub, actions, onBack) {
    return h('div', { class: 'toprow' }, U.iconBtn('ChevronLeft', 'Voltar', onBack || L.back),
      h('div', { class: 't' }, U.title(title, sub)), actions || null);
  };
  /** Topo das abas: nome da banda, título grande e ações. */
  U.tabHead = function (title, actions, label) {
    var band = label !== undefined ? label : (S.current ? S.current.org.name : '');
    return h('div', { class: 'tabhead' }, h('div', { class: 't' }, band ? L.igreja.pill(band) : null, h('h1', { class: 'h1' }, title)), actions || null);
  };

  U.spinner = function (text) { return h('div', { class: 'fill-center' }, h('div', { class: 'spinner' }), text ? h('div', null, text) : null); };

  /** Botão flutuante ("Nova escala", "Adicionar música"): encolhe para só o + quando a pessoa rola. */
  U.fab = function (text, icon, onclick) {
    var b = h('button', { class: 'btn fab', onclick: onclick, 'aria-label': text }, ic(icon, 18), h('span', null, text));
    setTimeout(fabScroll, 0);
    return b;
  };

  function fabScroll() {
    var b = document.querySelector(".fab");
    if (!b) return;
    var round = window.scrollY > 80;
    b.classList.toggle("round", round);
    b.lastChild.style.display = round ? "none" : "";
  }
  window.addEventListener("scroll", fabScroll, { passive: true });

  /** Escolhe uma foto e devolve um JPEG quadrado (centro da imagem). */
  U.pickSquareJpeg = function (size) {
    return new Promise(function (resolve, reject) {
      var inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        inp.remove();
        if (!f) return resolve(null);
        var img = new Image();
        img.onload = function () {
          var side = Math.min(img.width, img.height);
          var c = document.createElement('canvas');
          c.width = c.height = size;
          c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          URL.revokeObjectURL(img.src);
          c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Não deu para ler a imagem.')); }, 'image/jpeg', 0.85);
        };
        img.onerror = function () { reject(new Error('Não deu para ler a imagem.')); };
        img.src = URL.createObjectURL(f);
      };
      document.body.appendChild(inp);
      inp.click();
    });
  };

  // Só abre links da web: um link "javascript:" salvo numa música rodaria dentro do site.
  U.openUrl = function (url) { if (/^https?:\/\//i.test(String(url || '').trim())) window.open(String(url).trim(), '_blank', 'noopener'); };
})();
