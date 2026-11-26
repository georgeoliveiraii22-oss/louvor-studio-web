// Biblioteca do Louvor Studio (migração 0048): multitracks cedidas pelos produtores para as bandas de plano pago.
// Todos veem o catálogo; ouvir e adicionar ao repertório, só banda de plano pago (o servidor confere).
// "Adicionar ao repertório" cria a música na banda apontando para os mesmos arquivos (guardados uma vez só no R2),
// mas o tamanho dela conta no espaço da banda, como se a banda tivesse subido (o servidor confere o espaço livre).
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, D = L.data, sb = L.sb;
  var B = { org: null, list: null, loading: false, q: '' };

  function tamanho(b) { return b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1048576)) + ' MB'; }
  function pago() { var o = S.current && S.current.org; return !!o && (o.plan || 'free') !== 'free'; }

  /** Carrega o catálogo da banda atual (uma vez; `force` busca de novo). Sem a migração 0048, fica vazio. */
  L.biblioteca = function (force) {
    var org = S.current && S.current.org.id;
    if (!org) return Promise.resolve([]);
    if (!force && B.org === org && (B.list || B.loading)) return Promise.resolve(B.list || []);
    B.org = org; B.loading = true;
    return sb.rpc('biblioteca_listar', { _org: org }).then(function (r) {
      B.loading = false;
      if (B.org !== org) return [];
      var antes = B.list ? B.list.length : -1;
      B.list = r.error ? [] : (r.data || []);
      if (antes !== B.list.length) L.render();
      return B.list;
    }, function () { B.loading = false; B.list = []; return []; });
  };
  L.bibliotecaItem = function (id) { return (B.list || []).filter(function (x) { return x.id === id; })[0] || null; };

  /** Cartão no topo do Repertório (só quando há músicas na biblioteca). */
  L.bibliotecaEntrada = function () {
    L.biblioteca();
    var n = B.list ? B.list.length : 0;
    if (!n) return null;
    return U.clickRow(function () { L.go({ name: 'biblioteca' }); },
      h('span', { class: 'circle soft' }, ic('LibraryBig', 19)),
      h('div', { class: 'grow' },
        h('div', { class: 'hi semi', style: { fontSize: '15px' } }, 'Biblioteca do Louvor Studio'),
        h('div', { class: 'muted small' }, L.plural(n, 'multitrack', 'multitracks') + (pago() ? ' para a sua banda' : ' · nos planos pagos'))),
      ic('ChevronRight', 18, 'muted'));
  };

  function adicionar(x) {
    L.run(async function () {
      var r = await sb.rpc('biblioteca_adicionar', { _song: x.id, _org: S.current.org.id });
      if (r.error) throw r.error;
      var id = r.data;
      await D.reloadSongs();
      var u = await sb.rpc('org_storage_used', { _org: S.current.org.id });
      if (!u.error) S.storageUsed = Number(u.data) || S.storageUsed;
      await L.biblioteca(true);
      L.render();
      L.toast(x.titulo + ' está no repertório.', { label: 'Abrir', fn: function () { L.songSheet(id); } });
    });
  }

  function linha(x) {
    var fake = { id: x.id, song_title: x.titulo, version_url: x.version_url };
    var info = [x.tom ? 'Tom ' + x.tom : null, x.bpm ? x.bpm + ' BPM' : null, x.faixas ? L.plural(x.faixas, 'faixa', 'faixas') : null, Number(x.bytes) > 0 ? tamanho(Number(x.bytes)) : null].filter(Boolean).join(' · ');
    var acao;
    var mini = { minHeight: '36px', padding: '0 14px', fontSize: '14px', alignSelf: 'flex-start', marginTop: '6px' };
    if (x.na_banda && L.project(x.na_banda)) acao = U.btn2('No repertório', 'Check', function () { L.songSheet(x.na_banda); }, { style: mini });
    else if (pago() && L.perm.songs()) acao = U.btn('Adicionar ao repertório', 'Plus', function () { adicionar(x); }, { style: mini });
    else acao = null;
    return h('div', { class: 'row', style: { gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' } },
      U.cover(fake, 58, 6, 24),
      h('div', { class: 'grow col', style: { gap: '2px', minWidth: 0 } },
        h('div', { class: 'hi semi ell', style: { fontSize: '16px' } }, x.titulo),
        x.artista ? h('div', { class: 'muted small ell' }, x.artista) : null,
        info ? h('div', { class: 'muted small ell' }, info) : null,
        x.credito ? h('div', { class: 'muted tiny ell' }, x.credito) : null,
        acao));
  }

  L.screen('biblioteca', function () {
    L.biblioteca();
    var lider = S.current && S.current.role === 'leader';
    var lista;
    var box = h('div', { class: 'col', style: { gap: 0 } });
    function fill() {
      lista = (B.list || []).filter(function (x) {
        var q = L.norm(B.q.trim());
        return !q || [x.titulo, x.artista, x.album, x.tom].some(function (f) { return f && L.norm(f).indexOf(q) >= 0; });
      });
      box.replaceChildren.apply(box, B.list === null ? [U.spinner('Carregando a biblioteca…')]
        : lista.length ? lista.map(linha) : [U.empty(B.q.trim() ? 'Nenhuma música encontrada para "' + B.q + '".' : 'A biblioteca ainda está vazia.')]);
    }
    fill();
    return h('div', { class: 'screen', style: { gap: '14px', paddingBottom: '40px' } },
      U.topRow('Biblioteca', 'Multitracks do Louvor Studio'),
      U.body('Multitracks cedidas por autores e produtores para as bandas de plano pago. Adicione ao repertório e ensaie como as suas. Cada música conta no espaço do plano da banda.', 'var(--muted)', 14),
      !pago() ? h('div', { class: 'note' },
        h('div', { class: 'row warn bold tiny', style: { letterSpacing: '1px' } }, ic('Sparkles', 16), 'PLANOS PAGOS'),
        U.body('A Biblioteca é um benefício dos planos pagos. ' + (lider ? 'Assine um plano para a banda ouvir e adicionar estas multitracks.' : 'Fale com o líder da banda.'), 'var(--hi)'),
        h('a', { class: 'btn2 full', href: 'planos/?atual=' + encodeURIComponent((S.current && S.current.org.plan) || 'free'), target: '_blank', rel: 'noopener', style: { textDecoration: 'none', marginTop: '8px' } },
          ic('Sparkles', 18), lider ? 'Ver planos e assinar' : 'Ver os planos')) : null,
      pago() && !L.perm.songs() ? U.body('Quem adiciona é o líder ou quem cuida das músicas da banda.', 'var(--muted)', 13) : null,
      (B.list || []).length > 8 ? U.field(B.q, 'Buscar na biblioteca', function (v) { B.q = v; fill(); }) : null,
      box,
      h('div', { class: 'muted small', style: { marginTop: '8px' } }, 'O Louvor Studio não vende multitracks: a biblioteca é um benefício dos planos pagos. As músicas são para ensaiar e tocar na sua banda, pelo Louvor Studio. ',
        h('a', { href: 'termos/#biblioteca', target: '_blank', rel: 'noopener' }, 'Termos de Uso')));
  });
})();
