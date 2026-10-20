// Louvor Studio (web para celular) — Revisão das gravações de uma música (ui/TakeScreens.kt › ReviewScreen).
// Para quem edita o áudio (líder ou liberado): ouvir cada gravação, aprovar ou pedir para refazer,
// liberar para a banda estudar, marcar qual voz é e comentar.
(function () {
  'use strict';
  var L = window.L, S = L.S, h = L.h, ic = L.ic, U = L.ui, sb = L.sb;

  var R = null;          // { pid, takes, comments, drafts, loading, error }
  var player = null;     // { id, audio }

  function stopPlayer() {
    if (player) { try { player.audio.pause(); } catch (e) { /* já parou */ } player = null; }
  }

  async function load(pid) {
    R = { pid: pid, takes: [], comments: [], drafts: R && R.pid === pid ? R.drafts : {}, loading: true, error: null };
    L.render();
    try {
      var t = await sb.from('takes').select('*,file:files(id,object_key,bucket)').eq('project_id', pid).order('created_at', { ascending: false });
      var takes = Nuvem.mark(L.must(t));
      var ids = takes.map(function (x) { return x.id; });
      var c = ids.length ? await sb.from('take_comments').select('*').in('take_id', ids).order('created_at') : { data: [] };
      if (!R || R.pid !== pid) return;
      R.takes = takes;
      R.comments = c.error ? [] : c.data || [];
    } catch (e) {
      if (R && R.pid === pid) R.error = L.errorText(e);
    }
    if (R && R.pid === pid) { R.loading = false; L.render(); }
  }

  async function play(t) {
    if (player && player.id === t.id) { stopPlayer(); L.render(); return; }
    stopPlayer();
    var key = t.file && t.file.object_key;
    if (!key) { L.toast('Esta gravação ainda não chegou na nuvem.'); return; }
    player = { id: t.id, audio: new Audio() };
    L.render();
    try {
      var s = await Nuvem.signedUrl(sb, key, 3600);
      if (s.error) throw s.error;
      if (!player || player.id !== t.id) return;
      player.audio.src = s.data.signedUrl;
      player.audio.onended = function () { if (player && player.id === t.id) { player = null; L.render(); } };
      await player.audio.play();
    } catch (e) {
      stopPlayer();
      L.toast('Não deu para tocar: ' + L.errorText(e));
      L.render();
    }
  }

  async function patch(t, fields, msg) {
    var old = {};
    Object.keys(fields).forEach(function (k) { old[k] = t[k]; t[k] = fields[k]; });
    L.render();
    try {
      L.must(await sb.from('takes').update(fields).eq('id', t.id));
      L.toast(msg);
    } catch (e) {
      Object.keys(old).forEach(function (k) { t[k] = old[k]; });
      L.toast(L.errorText(e));
      L.render();
    }
  }

  async function sendComment(t) {
    var body = String(R.drafts[t.id] || '').trim();
    if (!body) return;
    try {
      var row = L.must(await sb.from('take_comments').insert({ take_id: t.id, author: S.user.id, body: body }).select().single());
      R.comments.push(row);
      delete R.drafts[t.id];
      L.render();
    } catch (e) { L.toast(L.errorText(e)); }
  }

  function pickVoice(t) {
    L.sheet(function (close) {
      var opt = function (v) {
        var on = t.voice_part === v.id;
        return h('button', { class: 'chiptog' + (on ? ' on' : ''), onclick: function () { close(); patch(t, { voice_part: v.id }, 'Marcada como ' + v.label + '.'); } }, v.label);
      };
      return [h('div', { class: 'hi semi', style: { fontSize: '17px' } }, 'Qual voz é a ' + t.name + ' de ' + L.nameOf(t.user_id) + '?'),
        U.label('Vozes'), h('div', { class: 'row wrap', style: { gap: '8px' } }, VoiceParts.ALL.map(opt)),
        U.label('Instrumentos'), h('div', { class: 'row wrap', style: { gap: '8px' } }, VoiceParts.INSTRUMENTS.map(opt))];
    });
  }

  function statusChip(st) {
    if (st === 'aprovada') return U.chip('Aprovada', 'ok', 'BadgeCheck');
    if (st === 'refazer') return U.chip('Refazer', 'bad', 'RotateCcw');
    return U.chip('Pendente', 'warn', 'Clock');
  }

  function takeCard(t) {
    var playing = player && player.id === t.id;
    var cs = R.comments.filter(function (c) { return c.take_id === t.id; });
    var input = U.field(R.drafts[t.id] || '', 'Comentário', function (v) { R.drafts[t.id] = v; }, { max: 1000, onenter: function () { sendComment(t); } });
    return h('section', { class: 'panel' },
      h('div', { class: 'row', style: { gap: '10px' } },
        U.iconBtn(playing ? 'Square' : 'Play', playing ? 'Parar' : 'Ouvir', function () { play(t); }, { color: 'var(--accent-text)', disabled: !(t.file && t.file.object_key) }),
        h('div', { class: 'grow' }, h('div', { class: 'hi semi' }, t.name),
          h('div', { class: 'muted small' }, L.dm(t.created_at) + ' · ' + L.clock((t.duration_ms || 0) / 1000) + ' · ' + (t.rtl_ms != null ? 'RTL ' + Math.round(t.rtl_ms) + ' ms' : 'sem calibração')))),
      h('div', { class: 'row wrap', style: { gap: '6px' } }, statusChip(t.review_status),
        t.released_for_rehearsal ? U.chip('Liberada p/ estudar', 'accent', 'LockOpen') : U.chip('Privada', '', 'Lock')),
      U.clickRow(function () { pickVoice(t); }, ic('Mic', 16, t.voice_part ? 'accent' : 'warn'),
        h('span', { class: 'hi semi grow', style: { fontSize: '13px' } }, t.voice_part ? 'Voz: ' + VoiceParts.label(t.voice_part) : 'Voz não marcada'),
        h('span', { class: 'small', style: { color: 'var(--accent-text)' } }, 'mudar')),
      h('div', { class: 'row wrap', style: { gap: '8px' } },
        U.toggle('Aprovar', t.review_status === 'aprovada', 'Check', function () { patch(t, { review_status: 'aprovada' }, t.name + ' aprovada.'); }),
        U.toggle('Refazer', t.review_status === 'refazer', 'RotateCcw', function () { patch(t, { review_status: 'refazer' }, 'Pedido de refazer enviado.'); }),
        U.toggle(t.released_for_rehearsal ? 'Liberada' : 'Liberar', !!t.released_for_rehearsal, 'Share2', function () {
          var v = !t.released_for_rehearsal;
          patch(t, { released_for_rehearsal: v }, v ? 'Liberada: a banda já pode estudar ' + (t.voice_part ? 'o ' + VoiceParts.label(t.voice_part).toLowerCase() : 'esta voz') + ' de ' + L.nameOf(t.user_id) + '.' : 'Gravação voltou a ser privada.');
        })),
      cs.map(function (c) {
        return h('div', { class: 'col', style: { gap: '2px' } }, h('span', { class: 'muted tiny' }, L.nameOf(c.author) + ' · ' + L.dm(c.created_at)), U.body(c.body, null, 13));
      }),
      h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, h('div', { class: 'grow' }, input),
        U.iconBtn('Send', 'Enviar comentário', function () { sendComment(t); }, { color: 'var(--accent-text)' })));
  }

  // Saiu da tela (voltar do celular ou do navegador): a gravação para de tocar.
  window.addEventListener('popstate', function () { setTimeout(function () { if (L.route().name !== 'review') stopPlayer(); }, 0); });

  L.screen('review', function (r) {
    var p = L.project(r.id);
    if (!R || R.pid !== r.id) { stopPlayer(); load(r.id); }
    var head = U.topRow('Revisão', p ? p.song_title : null, U.iconBtn('RefreshCw', 'Atualizar', function () { load(r.id); }), function () { stopPlayer(); R = null; L.back(); });
    var body = [U.body('Ouça, aprove ou peça para refazer. Só as gravações liberadas aparecem para a banda estudar, em Vozes para estudar (separadas por voz: tenor, contralto…).', 'var(--muted)', 12)];
    if (!L.perm.edit()) body = [U.empty('Só o líder ou quem ele liberou para editar o áudio revisa as gravações.')];
    else if (R.loading) body.push(U.spinner('Carregando as gravações…'));
    else if (R.error) body.push(U.empty(R.error));
    else if (!R.takes.length) body.push(U.empty('Ninguém enviou gravações desta música ainda.'));
    else {
      var by = {};
      R.takes.forEach(function (t) { (by[t.user_id] = by[t.user_id] || []).push(t); });
      Object.keys(by).forEach(function (uid) {
        body.push(h('div', { class: 'row', style: { gap: '10px', marginTop: '6px' } }, U.avatar(L.member(uid), 30), h('span', { class: 'hi semi', style: { fontSize: '15px' } }, L.nameOf(uid))));
        by[uid].forEach(function (t) { body.push(takeCard(t)); });
      });
    }
    return h('div', { class: 'screen' }, head, body);
  });
})();
