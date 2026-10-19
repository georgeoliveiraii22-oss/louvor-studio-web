// Louvor Studio (web para celular) — logo e papel de parede da igreja (ui/ChurchIdentity.kt).
// O logo aparece no nome da banda e o papel de parede no alto do Início. O líder troca em Banda › Pessoas.
// Bucket privado `igreja` (migração 0021); sem a migração, nada aparece e nada quebra.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, sb = L.sb;
  var C = L.igreja = {};
  S.church = { logo: null, wall: null, logoPath: null, wallPath: null };

  C.load = async function () {
    S.church = { logo: null, wall: null, logoPath: null, wallPath: null };
    if (!S.current) return;
    var r = await sb.from('organizations').select('logo_path,wallpaper_path').eq('id', S.current.org.id).maybeSingle();
    if (r.error || !r.data) return;
    var paths = [r.data.logo_path, r.data.wallpaper_path].filter(Boolean);
    var u = {};
    if (paths.length) {
      var s = await sb.storage.from('igreja').createSignedUrls(paths, 86400);
      (s.data || []).forEach(function (x) { if (x.signedUrl) u[x.path] = x.signedUrl; });
    }
    S.church = { logoPath: r.data.logo_path, wallPath: r.data.wallpaper_path, logo: u[r.data.logo_path] || null, wall: u[r.data.wallpaper_path] || null };
  };

  /** O nome da banda com o logo na frente (quando há logo). */
  C.pill = function (name, extra) {
    return h('span', { class: 'bandpill' + (S.church.logo ? ' withlogo' : '') + (extra ? ' ' + extra : '') },
      S.church.logo ? h('img', { class: 'blogo', src: S.church.logo, alt: '' }) : null, h('span', null, name));
  };

  /** O papel de parede atrás do alto do Início. */
  C.wallpaper = function () {
    return S.church.wall ? h('div', { class: 'wallpaper', 'aria-hidden': 'true' }, h('img', { src: S.church.wall, alt: '' })) : null;
  };

  /** Foto deitada reduzida (o lado maior até `max`), em JPEG. */
  function pickWideJpeg(max) {
    return new Promise(function (resolve, reject) {
      var inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        inp.remove();
        if (!f) return resolve(null);
        var img = new Image();
        img.onload = function () {
          var k = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(img.src);
          c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Não deu para ler a imagem.')); }, 'image/jpeg', 0.82);
        };
        img.onerror = function () { reject(new Error('Não deu para ler a imagem.')); };
        img.src = URL.createObjectURL(f);
      };
      document.body.appendChild(inp);
      inp.click();
    });
  }

  var busy = null;
  /** Troca (blob) ou tira (nulo) o logo ('logo') ou o fundo ('fundo'). */
  async function save(kind, blob) {
    var org = S.current.org.id;
    var col = kind === 'logo' ? 'logo_path' : 'wallpaper_path';
    var old = kind === 'logo' ? S.church.logoPath : S.church.wallPath;
    var path = blob ? org + '/' + kind + '-' + Date.now() + '.jpg' : null;
    if (path) L.must(await sb.storage.from('igreja').upload(path, blob, { contentType: 'image/jpeg' }));
    var patch = {}; patch[col] = path;
    L.must(await sb.from('organizations').update(patch).eq('id', org));
    if (old) sb.storage.from('igreja').remove([old]);
    await C.load();
  }
  function change(kind) {
    var pick = kind === 'logo' ? U.pickSquareJpeg(512) : pickWideJpeg(1600);
    pick.then(function (blob) {
      if (!blob) return;
      busy = kind; L.render();
      return L.run(async function () {
        try { await save(kind, blob); L.toast(kind === 'logo' ? 'Logo da igreja atualizado.' : 'Papel de parede atualizado.'); }
        finally { busy = null; L.render(); }
      });
    }).catch(function (e) { L.toast(L.errorText(e)); });
  }
  function remove(kind) {
    busy = kind; L.render();
    L.run(async function () { try { await save(kind, null); } finally { busy = null; L.render(); } });
  }

  /** Banda › Identidade da igreja (só o líder). */
  C.panel = function () {
    var c = S.church;
    var preview = h('div', { class: 'church-prev' },
      c.wall ? h('img', { class: 'bg', src: c.wall, alt: '' }) : h('div', { class: 'empty-bg' }, ic('Camera', 26), h('span', null, 'Sem papel de parede')),
      h('div', { class: 'shade' }),
      h('div', { class: 'who' }, h('span', { class: 'lg' }, c.logo ? h('img', { src: c.logo, alt: '' }) : ic('AudioLines', 20)), h('b', null, S.current.org.name)));
    return U.panel('Identidade da igreja', 'Sparkles',
      U.body('O logo aparece no nome da banda e o papel de parede no alto do Início, para todo mundo da banda.', 'var(--muted)', 12),
      preview,
      h('div', { class: 'row', style: { gap: '8px' } },
        U.btn2(busy === 'logo' ? 'Enviando…' : c.logo ? 'Trocar logo' : 'Pôr logo', 'Camera', function () { change('logo'); }, { disabled: !!busy, full: true }),
        U.btn2(busy === 'fundo' ? 'Enviando…' : c.wall ? 'Trocar fundo' : 'Pôr fundo', 'Camera', function () { change('fundo'); }, { disabled: !!busy, full: true })),
      c.logo || c.wall ? h('div', { class: 'row', style: { gap: '16px' } },
        c.logo ? h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, disabled: !!busy, onclick: function () { remove('logo'); } }, 'Tirar o logo') : null,
        c.wall ? h('button', { class: 'textbtn', style: { color: 'var(--bad)' }, disabled: !!busy, onclick: function () { remove('fundo'); } }, 'Tirar o fundo') : null) : null,
      U.body('Dica: logo quadrado; para o fundo, uma foto deitada da igreja ou do culto.', 'var(--muted)', 12));
  };
})();
