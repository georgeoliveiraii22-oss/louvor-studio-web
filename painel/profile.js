// Louvor Studio — Meu perfil: foto, nome, naipe, bio e funções no ministério.
// Funções valem por banda (ficam em memberships); foto, naipe e bio valem para a pessoa.
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }

  var FUNCTIONS = [
    { id: 'ministro', label: 'Ministro(a) de louvor' },
    { id: 'backing_vocal', label: 'Backing vocal' },
    { id: 'violao', label: 'Violão' },
    { id: 'guitarra', label: 'Guitarra' },
    { id: 'baixo', label: 'Baixo' },
    { id: 'bateria', label: 'Bateria' },
    { id: 'teclado', label: 'Teclado' },
    { id: 'percussao', label: 'Percussão' },
    { id: 'sopro', label: 'Sopro' },
    { id: 'cordas', label: 'Cordas' },
    { id: 'tecnico_som', label: 'Técnico(a) de som' },
    { id: 'projecao', label: 'Projeção/mídia' }
  ];

  var VOICES = [
    { id: '', label: 'Não informado' },
    { id: 'soprano', label: 'Soprano' },
    { id: 'mezzo', label: 'Mezzo-soprano' },
    { id: 'contralto', label: 'Contralto' },
    { id: 'tenor', label: 'Tenor' },
    { id: 'baritono', label: 'Barítono' },
    { id: 'baixo', label: 'Baixo' }
  ];

  var AV_COLORS = ['#E9A863', '#6CC4B0', '#9BA7EC', '#E384AE', '#B7D46B', '#7DBAE4', '#DCC65F', '#C59DE3'];

  var ui = { draftFunctions: null, preview: null, previewBlob: null, busy: false };

  function functionLabel(id) {
    var f = FUNCTIONS.find(function (x) { return x.id === id; });
    return f ? f.label : id;
  }

  function voiceLabel(id) {
    var v = VOICES.find(function (x) { return x.id === id; });
    return v && id ? v.label : '';
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }

  function colorFor(id) {
    var s = String(id || '');
    var n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    return AV_COLORS[n % AV_COLORS.length];
  }

  // Foto (ou iniciais) de um integrante. `member` vem de S.members.
  function avatar(member, size) {
    size = size || 40;
    var style = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.4) + 'px';
    if (member && member.avatar_url) {
      return h('img', { class: 'av-img', src: member.avatar_url, alt: '', style: style });
    }
    return h('span', { class: 'av-ini', style: style + ';background:' + colorFor(member && member.user_id), 'aria-hidden': 'true' }, initials(member && member.name));
  }

  function functionChips(list) {
    if (!list || !list.length) return null;
    return h('span', { class: 'fn-chips' }, list.map(function (f) {
      return h('span', { class: 'chip fn' }, Icons.icon(Icons.forFunction(f), 12), functionLabel(f));
    }));
  }

  // Corta a foto em quadrado no centro e reduz para 320 px (JPEG), antes de enviar.
  function squareJpeg(file, size) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight);
        var c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Não foi possível processar a foto.')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Esse arquivo não parece uma imagem.')); };
      img.src = url;
    });
  }

  function savePhoto(me) {
    var S = A().state();
    var sb = A().client();
    var path = S.user.id + '/avatar-' + Date.now() + '.jpg';
    var old = me.avatar_path;
    ui.busy = true;
    A().rerender();
    sb.storage.from('avatars').upload(path, ui.previewBlob, { contentType: 'image/jpeg', upsert: false }).then(function (res) {
      if (res.error) throw res.error;
      return sb.from('profiles').update({ avatar_path: path }).eq('id', S.user.id);
    }).then(function (res) {
      if (res.error) throw res.error;
      if (old) sb.storage.from('avatars').remove([old]); // limpeza da foto antiga; se falhar, não atrapalha
      ui.preview = null;
      ui.previewBlob = null;
      return A().refresh();
    }).then(function () {
      ui.busy = false;
      A().flash('ok', 'Foto atualizada.');
      A().rerender();
    }).catch(function (e) {
      ui.busy = false;
      A().flash('err', A().friendly(e));
      A().rerender();
    });
  }

  function removePhoto(me) {
    var S = A().state();
    var sb = A().client();
    sb.from('profiles').update({ avatar_path: null }).eq('id', S.user.id).then(function (res) {
      if (res.error) throw res.error;
      if (me.avatar_path) sb.storage.from('avatars').remove([me.avatar_path]);
      return A().refresh();
    }).then(function () {
      A().flash('ok', 'Foto removida.');
      A().rerender();
    }).catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
  }

  function view() {
    var S = A().state();
    var sb = A().client();
    var me = S.members.find(function (m) { return m.user_id === S.user.id; }) || { user_id: S.user.id, name: '', functions: [] };
    if (!ui.draftFunctions) ui.draftFunctions = (me.functions || []).slice();

    var nameInput = h('input', { type: 'text', maxlength: '80', value: me.name, required: true });
    var voiceSel = h('select', null, VOICES.map(function (v) { return h('option', { value: v.id, selected: (me.voice_type || '') === v.id }, v.label); }));
    var bio = h('textarea', { maxlength: '280', placeholder: 'Conte em uma frase como você serve no ministério.' }, me.bio || '');
    var fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', style: 'display:none', onchange: function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      squareJpeg(f, 320).then(function (blob) {
        ui.previewBlob = blob;
        ui.preview = URL.createObjectURL(blob);
        A().rerender();
      }).catch(function (e) { A().flash('err', e.message); A().rerender(); });
    } });

    var big = ui.preview
      ? h('img', { class: 'av-img', src: ui.preview, alt: 'Prévia da nova foto', style: 'width:112px;height:112px' })
      : avatar(me, 112);

    var photoActions = ui.preview
      ? h('div', { class: 'row' },
          h('button', { class: 'btn sm', disabled: ui.busy, onclick: function () { savePhoto(me); } }, ui.busy ? 'Enviando…' : 'Salvar foto'),
          h('button', { class: 'btn sec2 sm', onclick: function () { ui.preview = null; ui.previewBlob = null; A().rerender(); } }, 'Cancelar'))
      : h('div', { class: 'row' },
          h('button', { class: 'btn sec2 sm', onclick: function () { fileInput.click(); } }, Icons.icon('camera', 14), me.avatar_url ? 'Trocar foto' : 'Adicionar foto'),
          me.avatar_url ? h('button', { class: 'btn sec2 sm icon-only', title: 'Remover foto', 'aria-label': 'Remover foto', onclick: function () { removePhoto(me); } },
            Icons.icon('trash', 14), h('span', { class: 'vh' }, 'Remover')) : null);

    var fnButtons = FUNCTIONS.map(function (f) {
      var on = ui.draftFunctions.indexOf(f.id) !== -1;
      return h('button', { type: 'button', class: 'rp-chip fn-pick' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () {
        if (on) ui.draftFunctions = ui.draftFunctions.filter(function (x) { return x !== f.id; });
        else ui.draftFunctions = ui.draftFunctions.concat(f.id);
        A().rerender();
      } }, Icons.icon(Icons.forFunction(f.id), 15), f.label);
    });

    var roleText = S.role === 'leader' ? 'Líder' : 'Membro';
    var extras = [voiceLabel(me.voice_type) ? 'Naipe: ' + voiceLabel(me.voice_type) : null, me.can_edit_audio && S.role !== 'leader' ? 'Pode editar o áudio' : null].filter(Boolean);

    return h('div', null,
      h('div', { class: 'pf-hero card' },
        h('div', { class: 'pf-photo' }, big, fileInput, photoActions),
        h('div', { class: 'stack', style: 'gap:8px;min-width:0' },
          h('span', { class: 'sec with-ic', style: 'margin:0' }, S.role === 'leader' ? Icons.icon('leader', 12) : Icons.icon('perfil', 12), S.org.name + ' · ' + roleText),
          h('h1', { style: 'margin:0' }, me.name || 'Sem nome'),
          h('span', { class: 'mu' }, S.user.email + (extras.length ? ' · ' + extras.join(' · ') : '')),
          functionChips(me.functions) || h('span', { class: 'mu' }, 'Nenhuma função marcada ainda.'),
          me.bio ? h('p', { style: 'margin:4px 0 0' }, me.bio) : null
        )
      ),

      h('form', { class: 'card stack', onsubmit: function (ev) {
        ev.preventDefault();
        sb.from('memberships').update({ functions: ui.draftFunctions }).eq('org_id', S.org.id).eq('user_id', S.user.id)
          .then(function (res) { if (res.error) throw res.error; return A().refresh(); })
          .then(function () { ui.draftFunctions = null; A().flash('ok', 'Funções salvas.'); A().rerender(); })
          .catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
      } },
        h('h2', { style: 'margin:0' }, 'Minhas funções em ' + S.org.name),
        h('p', { class: 'mu', style: 'margin:0;font-size:14px' }, 'Marque tudo o que você faz no ministério. O líder também pode ajustar pela Equipe.'),
        h('div', { class: 'row', style: 'gap:8px' }, fnButtons),
        h('div', null, h('button', { class: 'btn', type: 'submit' }, 'Salvar funções'))
      ),

      h('form', { class: 'card stack', onsubmit: function (ev) {
        ev.preventDefault();
        var patch = { display_name: nameInput.value.trim(), voice_type: voiceSel.value || null, bio: bio.value.trim() || null };
        sb.from('profiles').update(patch).eq('id', S.user.id)
          .then(function (res) { if (res.error) throw res.error; return A().refresh(); })
          .then(function () { A().flash('ok', 'Perfil salvo.'); A().rerender(); })
          .catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
      } },
        h('h2', { style: 'margin:0' }, 'Dados pessoais'),
        h('div', { class: 'grid' },
          h('label', { class: 'f' }, 'Nome que a banda vê', nameInput),
          h('label', { class: 'f' }, 'Naipe de voz', voiceSel)),
        h('label', { class: 'f' }, 'Sobre você (até 280 caracteres)', bio),
        h('p', { class: 'mu', style: 'margin:0;font-size:13px' }, 'Sua foto e seus dados só aparecem para quem é da mesma banda.'),
        h('div', null, h('button', { class: 'btn sec2', type: 'submit' }, 'Salvar perfil'))
      )
    );
  }

  function reset() { ui.draftFunctions = null; ui.preview = null; ui.previewBlob = null; }

  window.ProfilePage = {
    view: view, reset: reset, avatar: avatar, functionChips: functionChips,
    FUNCTIONS: FUNCTIONS, functionLabel: functionLabel
  };
})();
