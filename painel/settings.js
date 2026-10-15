// Louvor Studio — telas "Banda e plano" e "Ajustes" (minha conta).
// Funcional: nome da banda, armazenamento, convite, meu nome, senha, sair, sair da banda.
// Demonstração (marcado na tela): planos pagos e excluir conta, que ainda dependem do servidor.
(function () {
  'use strict';

  function A() { return window.LouvorApp; }
  function h() { return A().h.apply(null, arguments); }

  var ui = { confirmDelete: false, confirmLeave: false };

  function demoNote(text) {
    return h('div', { class: 'demo-note' }, h('b', null, 'Demonstração. '), text);
  }

  function fmtBytes(n) {
    if (n >= 1073741824) return (n / 1073741824).toFixed(1).replace('.', ',') + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  function act(promise, okText) {
    promise.then(function (res) {
      if (res && res.error) throw res.error;
      return A().refresh();
    }).then(function () {
      if (okText) A().flash('ok', okText);
      A().rerender();
    }).catch(function (e) {
      A().flash('err', A().friendly(e));
      A().rerender();
    });
  }

  // ---------------------------------------------------------------------------
  // Banda e plano
  // ---------------------------------------------------------------------------
  function bandView() {
    var S = A().state();
    var sb = A().client();
    var isLeader = S.role === 'leader';
    var limit = S.org.storage_limit_bytes;
    var pct = Math.min(100, Math.round((S.used / limit) * 100));
    var leaders = S.members.filter(function (m) { return m.role === 'leader'; }).length;
    var editors = S.members.filter(function (m) { return m.role === 'leader' || m.can_edit_audio; });

    var nameInput = h('input', { type: 'text', maxlength: '80', value: S.org.name, required: true, disabled: !isLeader });

    return h('div', null,
      h('span', { class: 'sec' }, 'Banda'),
      h('h1', null, S.org.name),
      h('p', { class: 'mu', style: 'margin-top:0' }, S.members.length + (S.members.length === 1 ? ' integrante' : ' integrantes') + ' · ' + leaders + (leaders === 1 ? ' líder' : ' líderes') + ' · você é ' + (isLeader ? 'líder' : 'membro')),

      h('div', { class: 'grid' },
        h('div', { class: 'card stack' },
          h('div', { class: 'row sp-b' }, h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('storage', 15), 'Plano gratuito'), h('span', { class: 'mono' }, fmtBytes(S.used) + ' de ' + fmtBytes(limit))),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' })),
          h('p', { class: 'mu', style: 'margin:0;font-size:14px' }, 'O espaço é da banda inteira: multitracks e gravações de todos os integrantes. Nada é apagado automaticamente.'),
          h('div', { class: 'plan-up' },
            h('span', { style: 'font:600 14px var(--fb);color:var(--act)' }, 'Plano Banda · [PREÇO]/mês'),
            h('span', { style: 'font-size:14px' }, 'Mais espaço para a banda toda. A cobrança é por banda, não por pessoa.'),
            h('div', null, h('button', { class: 'btn sm', onclick: function () {
              A().flash('info', 'Demonstração: os planos pagos ainda não existem. Esta tela mostra como vai ficar.');
              A().rerender();
            } }, 'Ver planos'))
          ),
          demoNote('Planos pagos e cobrança ainda não estão implementados.')
        ),

        h('form', { class: 'card stack', onsubmit: function (ev) {
          ev.preventDefault();
          act(sb.from('organizations').update({ name: nameInput.value.trim() }).eq('id', S.org.id), 'Nome da banda atualizado.');
        } },
          h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('banda', 15), 'Dados da banda'),
          h('label', { class: 'f' }, 'Nome da banda', nameInput),
          isLeader ? h('div', null, h('button', { class: 'btn sec2', type: 'submit' }, Icons.icon('check', 14), 'Salvar nome')) : h('p', { class: 'mu', style: 'margin:0' }, 'Só o líder muda o nome da banda.'),
          h('span', { class: 'sec', style: 'margin:8px 0 0' }, 'Código de convite'),
          h('div', { class: 'row' }, h('div', { class: 'code' }, S.org.invite_code),
            h('button', { class: 'btn sec2 sm', type: 'button', onclick: function () {
              if (navigator.clipboard) navigator.clipboard.writeText(S.org.invite_code).then(function () { A().flash('ok', 'Código copiado.'); A().rerender(); });
            } }, Icons.icon('copy', 14), 'Copiar'))
        )
      ),

      h('div', { class: 'card' },
        h('div', { class: 'row sp-b' },
          h('div', null,
            h('h2', { class: 'with-ic', style: 'margin:0 0 4px' }, Icons.icon('unlock', 15), 'Quem pode editar o áudio'),
            h('span', { class: 'mu' }, editors.map(function (m) { return m.name; }).join(', ') || 'Ninguém')),
          h('button', { class: 'btn sec2', onclick: function () { A().go('equipe'); } }, Icons.icon('equipe', 14), 'Gerenciar na Equipe')
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Ajustes (minha conta)
  // ---------------------------------------------------------------------------
  function settingsView() {
    var S = A().state();
    var sb = A().client();
    var me = S.members.find(function (m) { return m.user_id === S.user.id; }) || { name: '' };
    var leaders = S.members.filter(function (m) { return m.role === 'leader'; }).length;
    var lastLeader = S.role === 'leader' && leaders <= 1;

    var nameInput = h('input', { type: 'text', maxlength: '80', value: me.name, required: true });
    var pass1 = h('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: true });
    var pass2 = h('input', { type: 'password', autocomplete: 'new-password', minlength: '6', required: true });

    var deleteArea = ui.confirmDelete
      ? h('div', { class: 'stack' },
          h('p', { style: 'margin:0' }, 'Excluir a conta apaga seu acesso e suas gravações. Isso não pode ser desfeito.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn', onclick: function () {
              ui.confirmDelete = false;
              A().flash('info', 'Demonstração: a exclusão de conta ainda precisa de uma função no servidor. Nada foi apagado.');
              A().rerender();
            } }, 'Sim, excluir minha conta'),
            h('button', { class: 'btn sec2', onclick: function () { ui.confirmDelete = false; A().rerender(); } }, 'Cancelar')))
      : h('div', null, h('button', { class: 'btn sec2 danger', onclick: function () { ui.confirmDelete = true; A().rerender(); } }, Icons.icon('trash', 14), 'Excluir minha conta'));

    var leaveArea = lastLeader
      ? h('p', { class: 'mu', style: 'margin:0' }, 'Você é o único líder. Promova outra pessoa a líder na aba Equipe antes de sair da banda.')
      : ui.confirmLeave
        ? h('div', { class: 'row' },
            h('span', null, 'Sair de ' + S.org.name + '? Suas gravações continuam na banda.'),
            h('button', { class: 'btn sm', onclick: function () {
              ui.confirmLeave = false;
              act(sb.from('memberships').delete().eq('org_id', S.org.id).eq('user_id', S.user.id), 'Você saiu da banda.');
            } }, 'Sair da banda'),
            h('button', { class: 'btn sec2 sm', onclick: function () { ui.confirmLeave = false; A().rerender(); } }, 'Cancelar'))
        : h('div', null, h('button', { class: 'btn sec2', onclick: function () { ui.confirmLeave = true; A().rerender(); } }, Icons.icon('logout', 14), 'Sair desta banda'));

    return h('div', null,
      h('h1', null, 'Ajustes'),
      h('p', { class: 'mu', style: 'margin-top:0' }, S.user.email),

      h('div', { class: 'grid' },
        h('form', { class: 'card stack', onsubmit: function (ev) {
          ev.preventDefault();
          act(sb.from('profiles').update({ display_name: nameInput.value.trim() }).eq('id', S.user.id), 'Nome atualizado.');
        } },
          h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('perfil', 15), 'Meu perfil'),
          h('label', { class: 'f' }, 'Nome que a banda vê', nameInput),
          h('div', null, h('button', { class: 'btn sec2', type: 'submit' }, Icons.icon('check', 14), 'Salvar nome'))
        ),
        h('form', { class: 'card stack', onsubmit: function (ev) {
          ev.preventDefault();
          if (pass1.value !== pass2.value) { A().flash('err', 'As duas senhas não são iguais.'); A().rerender(); return; }
          sb.auth.updateUser({ password: pass1.value }).then(function (res) {
            if (res.error) throw res.error;
            A().flash('ok', 'Senha alterada.');
            A().rerender();
          }).catch(function (e) { A().flash('err', A().friendly(e)); A().rerender(); });
        } },
          h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('lock', 15), 'Senha'),
          h('label', { class: 'f' }, 'Nova senha', pass1),
          h('label', { class: 'f' }, 'Repita a nova senha', pass2),
          h('div', null, h('button', { class: 'btn sec2', type: 'submit' }, Icons.icon('lock', 14), 'Trocar senha'))
        )
      ),

      h('div', { class: 'card stack' },
        h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('verified', 15), 'Privacidade'),
        h('p', { style: 'margin:0' }, 'Suas gravações de voz são dados pessoais. Quem pode ouvi-las:'),
        h('ul', { style: 'margin:0;padding-left:20px;line-height:1.7' },
          h('li', null, 'Você, sempre.'),
          h('li', null, 'O líder e quem tem permissão de editar o áudio, para revisar.'),
          h('li', null, 'Os outros integrantes, só depois que o líder libera a tomada para o ensaio.')),
        h('p', { class: 'mu', style: 'margin:0' }, 'Política de privacidade e termos de uso: [LINK DA POLÍTICA]')
      ),

      h('div', { class: 'card stack' },
        h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('banda', 15), 'Banda'),
        leaveArea
      ),

      h('div', { class: 'card stack' },
        h('h2', { class: 'with-ic', style: 'margin:0' }, Icons.icon('ajustes', 15), 'Sessão e conta'),
        h('div', null, h('button', { class: 'btn sec2', onclick: function () { sb.auth.signOut(); } }, Icons.icon('logout', 14), 'Sair da conta')),
        deleteArea,
        demoNote('Excluir conta ainda não apaga nada: falta a função no servidor (exigência das lojas e da LGPD, já na lista de próximos passos).')
      )
    );
  }

  window.SettingsPages = { band: bandView, settings: settingsView };
})();
