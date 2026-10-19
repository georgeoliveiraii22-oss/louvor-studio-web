// Louvor Studio (web para celular) — leitura e escrita no banco (mesmas consultas do app: data/Repo.kt e data/Schedules.kt).
(function () {
  'use strict';
  var L = window.L, S = L.S;
  var cfg = window.LOUVOR_CONFIG;
  var sb = L.sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'louvor-web-auth' } });

  /** Resposta do Supabase → dados (ou erro). */
  function must(res) { if (res.error) throw res.error; return res.data; }
  /** Tabelas que ainda não existem (migração não rodada) viram lista vazia. */
  function soft(res) { return res.error ? [] : (res.data || []); }
  L.must = must;

  var D = L.data = {};

  // ------------------------------------------------------------------ Local (preferências deste navegador)
  L.store = {
    get: function (k, d) { try { var v = localStorage.getItem('louvor.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { if (v === null || v === undefined) localStorage.removeItem('louvor.' + k); else localStorage.setItem('louvor.' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  };

  // ------------------------------------------------------------------ Carregar tudo da banda
  D.refresh = async function () {
    if (!S.user) return;
    S.loading = true;
    try {
      var ms = must(await sb.from('memberships').select('*,org:organizations(id,name,invite_code,storage_limit_bytes,plan)').eq('user_id', S.user.id));
      S.memberships = ms.filter(function (m) { return m.org; });
      // Quantas pessoas em cada banda: sem escolha salva, abre a banda com mais gente (não uma vazia criada por engano).
      if (S.memberships.length > 1) {
        var all = await sb.from('memberships').select('org_id').in('org_id', S.memberships.map(function (m) { return m.org.id; }));
        var count = {};
        (all.data || []).forEach(function (x) { count[x.org_id] = (count[x.org_id] || 0) + 1; });
        S.memberships.forEach(function (m) { m.people = count[m.org.id] || 1; });
      }
      if (S.choosingBand && S.memberships.length) {
        // Acabou de entrar na conta: espera a pessoa tocar na banda (tela "Escolha a banda").
        S.current = null;
      } else {
        S.choosingBand = false;
        var saved = L.store.get('banda', null);
        var biggest = S.memberships.slice().sort(function (a, b) { return (b.people || 1) - (a.people || 1); })[0];
        S.current = S.memberships.find(function (m) { return m.org.id === saved; }) || biggest || null;
        if (S.current) await D.loadOrg();
      }
    } finally {
      S.loading = false;
    }
  };

  D.loadOrg = async function () {
    var org = S.current.org.id;
    var r = await Promise.all([
      sb.from('memberships').select('*').eq('org_id', org),
      sb.from('projects').select('*').eq('org_id', org).order('created_at', { ascending: false })
    ]);
    var ms = must(r[0]);
    S.projects = must(r[1]);
    var profs = ms.length ? must(await sb.from('profiles').select('*').in('id', ms.map(function (m) { return m.user_id; }))) : [];
    var byId = {};
    profs.forEach(function (p) { byId[p.id] = p; });
    S.members = ms.map(function (m) {
      var p = byId[m.user_id] || {};
      return {
        user_id: m.user_id, role: m.role, can_edit_audio: !!m.can_edit_audio, can_schedule: !!m.can_schedule, can_manage_songs: !!m.can_manage_songs,
        functions: m.functions || [], name: p.display_name || 'Integrante', avatar_path: p.avatar_path || null, voice_type: p.voice_type || null, bio: p.bio || null,
        birth_day: p.birth_day || null, birth_month: p.birth_month || null, joined_at: m.joined_at || null
      };
    }).sort(function (a, b) { return (a.role === 'leader' ? 0 : 1) - (b.role === 'leader' ? 0 : 1) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
    // A pessoa atual (as permissões podem ter mudado).
    var mine = ms.find(function (m) { return m.user_id === S.user.id; });
    if (mine) Object.assign(S.current, mine, { org: S.current.org });

    var ids = S.projects.map(function (p) { return p.id; });
    var more = await Promise.all([
      ids.length ? sb.from('tracks').select('id,project_id').in('project_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? sb.from('project_parts').select('project_id,name,assigned_user').eq('assigned_user', S.user.id).in('project_id', ids) : Promise.resolve({ data: [] }),
      D.services(org),
      sb.from('unavailability').select('user_id,day').eq('org_id', org),
      sb.from('announcements').select('*').eq('org_id', org).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      sb.from('teams').select('*,team_members(user_id,function)').eq('org_id', org).order('name'),
      sb.from('service_templates').select('*').eq('org_id', org).order('weekday').order('start_time'),
      sb.rpc('org_storage_used', { _org: org })
    ]);
    S.tracksIdx = {};
    soft(more[0]).forEach(function (t) { (S.tracksIdx[t.project_id] = S.tracksIdx[t.project_id] || []).push(t.id); });
    S.myParts = {};
    soft(more[1]).forEach(function (p) { (S.myParts[p.project_id] = S.myParts[p.project_id] || []).push(p.name); });
    S.services = more[2];
    S.unavailable = {};
    soft(more[3]).forEach(function (u) { (S.unavailable[u.user_id] = S.unavailable[u.user_id] || []).push(u.day); });
    S.announcements = soft(more[4]);
    S.teams = soft(more[5]).map(function (t) { return { id: t.id, name: t.name, members: (t.team_members || []).map(function (x) { return { user_id: x.user_id, function: x.function }; }) }; });
    S.templates = soft(more[6]);
    S.storageUsed = Number(more[7].data) || 0;
    await Promise.all([D.readiness(), D.refreshMessages(), D.loadImages(), L.igreja.load().catch(function () { /* sem a migração 0021 */ })]);
  };

  D.loadImages = async function () {
    var av = S.members.map(function (m) { return m.avatar_path; }).filter(Boolean);
    var cv = S.projects.map(function (p) { return p.cover_path; }).filter(Boolean);
    var r = await Promise.all([
      av.length ? sb.storage.from('avatars').createSignedUrls(av, 3600 * 6) : Promise.resolve({ data: [] }),
      cv.length ? sb.storage.from('covers').createSignedUrls(cv, 3600 * 6) : Promise.resolve({ data: [] })
    ]);
    var a = {}, c = {};
    (r[0].data || []).forEach(function (x) { if (x.signedUrl) a[x.path] = x.signedUrl; });
    (r[1].data || []).forEach(function (x) { if (x.signedUrl) c[x.path] = x.signedUrl; });
    S.avatarUrls = {};
    S.members.forEach(function (m) { if (m.avatar_path && a[m.avatar_path]) S.avatarUrls[m.user_id] = a[m.avatar_path]; });
    S.coverUrls = {};
    S.projects.forEach(function (p) { if (p.cover_path && c[p.cover_path]) S.coverUrls[p.id] = c[p.cover_path]; });
  };

  D.reloadSongs = async function () {
    var org = S.current.org.id;
    S.projects = must(await sb.from('projects').select('*').eq('org_id', org).order('created_at', { ascending: false }));
    var ids = S.projects.map(function (p) { return p.id; });
    S.tracksIdx = {};
    if (ids.length) soft(await sb.from('tracks').select('id,project_id').in('project_id', ids)).forEach(function (t) { (S.tracksIdx[t.project_id] = S.tracksIdx[t.project_id] || []).push(t.id); });
    await D.loadImages();
  };

  // ------------------------------------------------------------------ Escalas
  D.services = async function (org) {
    var res = await sb.from('services').select('*').eq('org_id', org).order('starts_on').order('start_time', { nullsFirst: true });
    if (res.error) return [];
    var svc = res.data || [];
    var ids = svc.map(function (s) { return s.id; });
    var r = ids.length ? await Promise.all([
      sb.from('service_songs').select('*').in('service_id', ids).order('position'),
      sb.from('service_members').select('*').in('service_id', ids)
    ]) : [{ data: [] }, { data: [] }];
    var songs = {}, people = {};
    soft(r[0]).forEach(function (x) { (songs[x.service_id] = songs[x.service_id] || []).push({ project_id: x.project_id, position: x.position, key: x.song_key || null }); });
    soft(r[1]).forEach(function (x) {
      (people[x.service_id] = people[x.service_id] || []).push({ user_id: x.user_id, function: x.function, status: x.status || 'pendente', swap_requested: !!x.swap_requested, note: x.note || null });
    });
    return svc.map(function (s) {
      var ss = (songs[s.id] || []).sort(function (a, b) { return a.position - b.position; });
      return Object.assign({}, s, { kind: s.kind || 'culto', songs: ss, songIds: ss.map(function (x) { return x.project_id; }), people: people[s.id] || [] });
    });
  };

  D.reloadServices = async function () {
    S.services = await D.services(S.current.org.id);
    await D.readiness();
  };

  D.readiness = async function () {
    var ids = L.upcoming().map(function (s) { return s.id; });
    S.readiness = {};
    if (!ids.length) return;
    soft(await sb.from('song_ready').select('service_id,project_id,user_id').in('service_id', ids)).forEach(function (x) {
      var a = S.readiness[x.service_id] = S.readiness[x.service_id] || {};
      (a[x.project_id] = a[x.project_id] || []).push(x.user_id);
    });
  };

  /** Uma alteração de escala, depois recarrega e (opcional) avisa. */
  D.scheduleAction = function (ok, fn) {
    return L.run(async function () {
      var res = await fn();
      if (res && res.error) throw res.error;
      await D.reloadServices();
      if (ok) L.toast(ok);
      L.render();
    });
  };

  D.respond = function (serviceId, patch) {
    return sb.from('service_members').update(patch).eq('service_id', serviceId).eq('user_id', S.user.id);
  };

  D.toggleReady = function (serviceId, projectId) {
    var me = S.user.id;
    var map = S.readiness[serviceId] = S.readiness[serviceId] || {};
    var cur = map[projectId] || [];
    var on = cur.indexOf(me) < 0;
    map[projectId] = on ? cur.concat([me]) : cur.filter(function (x) { return x !== me; });
    L.render();
    var q = on ? sb.from('song_ready').insert({ service_id: serviceId, project_id: projectId })
      : sb.from('song_ready').delete().eq('service_id', serviceId).eq('project_id', projectId).eq('user_id', me);
    q.then(function (res) { if (res.error) { map[projectId] = cur; L.toast(L.errorText(res.error)); L.render(); } });
  };

  D.setUnavailable = function (day, on) {
    var me = S.user.id;
    var org = S.current.org.id;
    var cur = (S.unavailable[me] || []).slice();
    S.unavailable[me] = on ? cur.concat([day]) : cur.filter(function (d) { return d !== day; });
    L.render();
    var q = on ? sb.from('unavailability').insert({ org_id: org, day: day })
      : sb.from('unavailability').delete().eq('org_id', org).eq('user_id', me).eq('day', day);
    q.then(function (res) { if (res.error) { S.unavailable[me] = cur; L.toast(L.errorText(res.error)); L.render(); } });
  };

  /** Escalas que a agenda fixa criaria nesses dias (sem repetir as que já existem; só de hoje em diante). */
  D.planGenerate = function (templates, dates) {
    var t0 = L.today();
    var out = [];
    dates.forEach(function (d) {
      if (d < t0) return;
      templates.filter(function (t) { return t.active !== false && t.weekday === L.dow(d); }).forEach(function (t) {
        var dup = S.services.some(function (e) {
          return e.starts_on === d && (e.template_id === t.id || (L.hhmm(e.start_time) === L.hhmm(t.start_time) && e.kind === t.kind));
        });
        if (!dup) out.push([t, d]);
      });
    });
    return out;
  };

  D.generate = async function (templates, dates) {
    var todo = D.planGenerate(templates, dates);
    if (!todo.length) return 0;
    var org = S.current.org.id;
    var rows = todo.map(function (x) {
      var t = x[0];
      return { org_id: org, title: t.title, kind: t.kind, starts_on: x[1], start_time: L.hhmm(t.start_time), end_time: L.hhmm(t.end_time),
        location: t.location || null, template_id: t.id };
    });
    var created = must(await sb.from('services').insert(rows).select());
    var people = [];
    created.forEach(function (c) {
      var tpl = templates.find(function (t) { return t.id === c.template_id; });
      var team = tpl && S.teams.find(function (tm) { return tm.id === tpl.team_id; });
      if (team) team.members.forEach(function (m) { people.push({ service_id: c.id, user_id: m.user_id, function: m.function }); });
    });
    if (people.length) must(await sb.from('service_members').insert(people));
    return created.length;
  };

  // ------------------------------------------------------------------ Conversas e mural
  function readKey(ch) { return 'lida.' + (S.current ? S.current.org.id : '') + '.' + ch; }
  D.markRead = function (ch) { L.store.set(readKey(ch), new Date().toISOString()); S.unread[ch] = 0; };

  D.refreshMessages = async function () {
    if (!S.current) return;
    var res = await sb.from('messages').select('id,service_id,author,body,created_at').eq('org_id', S.current.org.id).order('created_at', { ascending: false }).limit(300);
    if (res.error) return;
    S.lastMessages = res.data || [];
    var me = S.user.id;
    S.unread = {};
    var by = {};
    S.lastMessages.forEach(function (m) { (by[m.service_id || ''] = by[m.service_id || ''] || []).push(m); });
    Object.keys(by).forEach(function (ch) {
      var read = L.store.get(readKey(ch), null);
      S.unread[ch] = by[ch].filter(function (m) { return m.author !== me && (!read || m.created_at > read); }).length;
    });
  };

  D.messages = async function (serviceId, after) {
    var q = sb.from('messages').select('*').eq('org_id', S.current.org.id).order('created_at', { ascending: false }).limit(200);
    q = serviceId ? q.eq('service_id', serviceId) : q.is('service_id', null);
    if (after) q = q.gt('created_at', after);
    return must(await q).reverse();
  };

  D.reloadAnnouncements = async function () {
    S.announcements = soft(await sb.from('announcements').select('*').eq('org_id', S.current.org.id).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50));
  };

  // Avisos e novidades vistos
  D.unseenNews = function () {
    var seen = L.store.get('avisos_vistos', null);
    var n = S.announcements.filter(function (a) { return a.author !== L.uid() && (!seen || a.created_at > seen); }).length;
    return n + (L.store.get('novidades_vistas', null) !== L.VERSION ? 1 : 0);
  };
  D.markNewsSeen = function () { L.store.set('avisos_vistos', new Date().toISOString()); L.store.set('novidades_vistas', L.VERSION); };

  // ------------------------------------------------------------------ Repertório
  D.signed = async function (bucket, path, secs) {
    var res = await sb.storage.from(bucket).createSignedUrl(path, secs || 3600);
    return must(res).signedUrl;
  };
})();
