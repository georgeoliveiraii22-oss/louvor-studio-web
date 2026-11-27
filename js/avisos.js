// Louvor Studio — mensagens do app (migração 0050): o administrador escreve no painel e a mensagem aparece numa
// janela quando a pessoa abre o site, uma vez só. "Entendi" (ou abrir o link) marca como vista na conta.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, U = L.ui, sb = L.sb;
  var mostrando = false;

  async function check() {
    if (mostrando || !S.loggedIn || !S.user) return;
    var r;
    try { r = await sb.rpc('app_avisos_pendentes'); } catch (e) { return; }
    if (r.error || !r.data || !r.data.length) return;   // sem a 0050 ou sem avisos: nada
    mostrando = true;
    mostrar(r.data, 0);
  }

  function visto(id) { sb.rpc('app_aviso_visto', { _id: id }).then(function () {}, function () {}); }

  /** {nome} vira o primeiro nome de quem está usando (sem nome, some junto com a vírgula). */
  function comNome(t) {
    var me = L.me && L.me(); var n1 = ((me && me.name) || '').trim().split(/\s+/)[0] || '';
    if (n1) return (t || '').replace(/\{nome\}/g, n1);
    var s = (t || '').replace(/^\s*\{nome\}[,!:]?\s*/, '').replace(/[,]?\s*\{nome\}/g, '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function mostrar(lista, i) {
    if (i >= lista.length) { mostrando = false; return; }
    var a = Object.assign({}, lista[i]);
    a.title = comNome(a.title); a.body = comNome(a.body);
    var proximo = function () { setTimeout(function () { mostrar(lista, i + 1); }, 250); };
    L.dialog({
      sticky: true,   // tocar fora não fecha: a pessoa lê e toca em Entendi
      title: h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
        h('span', { style: { width: '34px', height: '34px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'var(--accent)', color: 'var(--on-accent, #fff)', flex: 'none' } }, L.ic('Megaphone', 18)),
        h('div', { class: 'dt', style: { margin: 0 } }, a.title)),
      body: function () {
        return [h('div', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '15px', color: 'var(--text)' } }, a.body),
          h('div', { class: 'muted tiny', style: { marginTop: '10px' } }, 'Equipe Louvor Studio' + (lista.length > 1 ? ' · ' + (i + 1) + ' de ' + lista.length : ''))];
      },
      actions: function (close) {
        return [
          a.link_url ? h('button', { class: 'textbtn', onclick: function () { visto(a.id); window.open(a.link_url, '_blank', 'noopener'); close(); proximo(); } }, a.link_label || 'Abrir') : null,
          h('button', { class: 'textbtn', style: { fontWeight: 600 }, onclick: function () { visto(a.id); close(); proximo(); } }, 'Entendi')];
      }
    });
  }

  L.avisos = { check: check };
})();
