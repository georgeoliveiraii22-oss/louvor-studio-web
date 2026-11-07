// Escala automática do mês, sem DOM, testável com Node. Mesmas regras do app Android (data/AutoSchedule.kt)
// e do iPhone (Data/AutoSchedule.swift): mudou um, mude os três.
//
// Preenche as vagas vazias das escalas de forma equilibrada. Nunca quebra: a pessoa precisa ter a função;
// "dias que não posso" vence tudo; quem marcou "quando costumo poder" só entra nesses horários (sem marcar = todos).
// Regras da banda: máximo no mês, evitar seguidas, uma função por escala, meses anteriores, juntos/separados.
// Se ninguém cabe, afrouxa "seguidas" e depois o máximo, e avisa na vaga. Quem já está na escala não sai.
//
// Escala: { id, starts_on: 'AAAA-MM-DD', start_time: 'HH:MM[:SS]', template_id, people: [{ user_id, function, status }] }
// Pessoa: { user_id, functions: [...], templates: [...] (vazio = todos), wish: número ou null }
(function (root) {
  'use strict';

  var ORDER = ['ministro', 'backing_vocal', 'violao', 'guitarra', 'baixo', 'bateria', 'teclado', 'percussao', 'sopro', 'cordas', 'tecnico_som', 'projecao'];
  var DEFAULT_RULES = { maxPerMonth: 3, avoidBackToBack: true, oneFunction: true, useHistory: true };
  var LEVEL_NOTE = { 1: 'escala seguida (não havia outra pessoa)', 2: 'passou do máximo do mês (não havia outra pessoa)' };

  function day(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function ym(s) { return s.slice(0, 7); }
  function dow(s) { var d = new Date(day(s) * 86400000).getUTCDay(); return d === 0 ? 7 : d; }
  function seatKey(seat) { return seat.service_id + '|' + seat.function + '|' + seat.index; }
  function declined(p) { return p.status === 'recusado'; }
  function slotKey(s) { return s.template_id || dow(s.starts_on) + '-' + (s.start_time || '').slice(0, 5); }
  function orderOf(f) { var i = ORDER.indexOf(f); return i < 0 ? 99 : i; }
  function rng(seed) {   // mulberry32: o mesmo sorteio para a mesma semente
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Quantas pessoas a escala precisa: o horário da agenda fixa; senão a equipe fixa; senão 1 por função (2 vozes). */
  function needsFor(service, template, teams, people) {
    var n = {};
    var src = template && template.needs ? template.needs : {};
    Object.keys(src).forEach(function (k) { if (src[k] > 0) n[k] = src[k]; });
    if (Object.keys(n).length) return n;
    var team = template && template.team_id ? (teams || []).find(function (t) { return t.id === template.team_id; }) : null;
    if (team && team.members.length) {
      team.members.forEach(function (m) { n[m.function] = (n[m.function] || 0) + 1; });
      return n;
    }
    var have = {};
    people.forEach(function (p) { p.functions.forEach(function (f) { have[f] = (have[f] || 0) + 1; }); });
    ORDER.forEach(function (f) { if (have[f] && f !== 'projecao') n[f] = f === 'backing_vocal' ? Math.min(2, have[f]) : 1; });
    return n;
  }

  function State(all, month) {
    var self = this;
    this.services = {};
    this.by = {};
    this.month = month;
    all.forEach(function (s) {
      self.services[s.id] = s;
      self.by[s.id] = s.people.filter(function (p) { return !declined(p); }).map(function (p) { return [p.user_id, p.function]; });
    });
  }
  State.prototype.inService = function (sid, u) { return (this.by[sid] || []).some(function (x) { return x[0] === u; }); };
  State.prototype.load = function (u) {
    var n = 0, self = this;
    Object.keys(this.by).forEach(function (sid) {
      var s = self.services[sid];
      if (s && ym(s.starts_on) === self.month && self.by[sid].some(function (x) { return x[0] === u; })) n++;
    });
    return n;
  };
  State.prototype.add = function (sid, u, f) { (this.by[sid] = this.by[sid] || []).push([u, f]); };

  function other(p, u) { return p.a === u ? p.b : p.a; }
  function has(p, u) { return p.a === u || p.b === u; }

  /** Por que a pessoa não pode nesta vaga (null = pode). level 0 = todas as regras, 1 = sem "seguidas", 2 = sem máximo. */
  function block(p, s, fn, st, rules, pairs, unavailable, level) {
    if (p.functions.indexOf(fn) < 0) return 'não tem essa função no perfil';
    if ((unavailable[p.user_id] || []).indexOf(s.starts_on) >= 0) return 'marcou que não pode neste dia';
    if (s.people.some(function (x) { return x.user_id === p.user_id && declined(x); })) return 'respondeu que não pode nesta escala';
    if (p.templates && p.templates.length && s.template_id && p.templates.indexOf(s.template_id) < 0) return 'não costuma poder neste horário';
    if ((st.by[s.id] || []).some(function (x) { return x[0] === p.user_id && x[1] === fn; })) return 'já está nesta função';
    if (rules.oneFunction && st.inService(s.id, p.user_id)) return 'já está nesta escala em outra função';
    if (pairs.some(function (q) { return !q.together && has(q, p.user_id) && st.inService(s.id, other(q, p.user_id)); })) return 'não fica junto de quem já está';
    if (level < 2 && rules.maxPerMonth != null && st.load(p.user_id) >= rules.maxPerMonth) return 'já tem ' + rules.maxPerMonth + ' no mês';
    if (level < 1 && rules.avoidBackToBack) {
      var key = slotKey(s), d = day(s.starts_on);
      var near = Object.keys(st.by).some(function (sid) {
        var o = st.services[sid];
        return o && sid !== s.id && st.by[sid].some(function (x) { return x[0] === p.user_id; }) &&
          (o.starts_on === s.starts_on || (slotKey(o) === key && Math.abs(day(o.starts_on) - d) <= 7));
      });
      if (near) return 'escala seguida';
    }
    return null;
  }

  /**
   * Monta o rascunho. all = todas as escalas da banda; targets = [{ service, needs }]; month = 'AAAA-MM';
   * locked = { 'serviço|função|n': user_id ou null (deixar vazia) }.
   * Devolve { picks: [{ seat, user_id, existing, locked, note }], load: { user_id: n } }.
   */
  function plan(all, targets, people, unavailable, rules, pairs, month, locked, seed) {
    rules = Object.assign({}, DEFAULT_RULES, rules || {});
    pairs = pairs || []; locked = locked || {}; unavailable = unavailable || {};
    var rnd = rng(seed == null ? 1 : seed);
    var st = new State(all, month);
    var tie = {};
    people.forEach(function (p) { tie[p.user_id] = rnd(); });
    var y = +month.slice(0, 4), m = +month.slice(5, 7);
    var from = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10), to = month + '-01';
    var past = {};
    people.forEach(function (p) {
      past[p.user_id] = all.filter(function (s) {
        return s.starts_on >= from && s.starts_on < to && s.people.some(function (x) { return x.user_id === p.user_id && !declined(x); });
      }).length / 2;
    });
    var picks = [];
    var sorted = targets.slice().sort(function (a, b) {
      return a.service.starts_on < b.service.starts_on ? -1 : a.service.starts_on > b.service.starts_on ? 1 : String(a.service.start_time || '').localeCompare(String(b.service.start_time || ''));
    });
    function have(s, fn) { return s.people.filter(function (x) { return x.function === fn && !declined(x); }).length; }

    sorted.forEach(function (t) {
      Object.keys(t.needs).forEach(function (fn) {
        for (var i = have(t.service, fn); i < t.needs[fn]; i++) {
          var k = seatKey({ service_id: t.service.id, function: fn, index: i });
          if (k in locked && locked[k]) st.add(t.service.id, locked[k], fn);
        }
      });
    });

    sorted.forEach(function (t) {
      var s = t.service;
      var byFn = {};
      s.people.filter(function (x) { return !declined(x); }).forEach(function (x) { (byFn[x.function] = byFn[x.function] || []).push(x); });
      Object.keys(byFn).forEach(function (fn) {
        byFn[fn].forEach(function (x, i) { picks.push({ seat: { service_id: s.id, function: fn, index: i }, user_id: x.user_id, existing: true, locked: false, note: null }); });
      });
      var fns = Object.keys(t.needs).sort(function (a, b) {
        var ca = people.filter(function (p) { return p.functions.indexOf(a) >= 0; }).length;
        var cb = people.filter(function (p) { return p.functions.indexOf(b) >= 0; }).length;
        return ca - cb || orderOf(a) - orderOf(b);
      });
      fns.forEach(function (fn) {
        for (var i = have(s, fn); i < t.needs[fn]; i++) {
          var seat = { service_id: s.id, function: fn, index: i };
          var k = seatKey(seat);
          if (k in locked) { picks.push({ seat: seat, user_id: locked[k], existing: false, locked: true, note: null }); continue; }
          var chosen = null, lvl = 0;
          for (var level = 0; level <= 2 && !chosen; level++) {
            var ok = people.filter(function (p) { return block(p, s, fn, st, rules, pairs, unavailable, level) === null; });
            if (!ok.length) continue;
            var best = null, bestScore = Infinity;
            ok.forEach(function (p) {
              var load = st.load(p.user_id);
              var score = load * 10 + (rules.useHistory ? (past[p.user_id] || 0) * 4 : 0);
              if (p.wish != null) score += load >= p.wish ? 30 : -3;
              if (pairs.some(function (q) { return q.together && has(q, p.user_id) && st.inService(s.id, other(q, p.user_id)); })) score -= 25;
              score += (tie[p.user_id] || 0) * 3;
              if (score < bestScore) { bestScore = score; best = p; }
            });
            chosen = best; lvl = level;
          }
          if (!chosen) {
            var anyone = people.some(function (p) { return p.functions.indexOf(fn) >= 0; });
            picks.push({ seat: seat, user_id: null, existing: false, locked: false, note: anyone ? 'ninguém disponível' : 'ninguém tem essa função no perfil' });
          } else {
            st.add(s.id, chosen.user_id, fn);
            picks.push({ seat: seat, user_id: chosen.user_id, existing: false, locked: false, note: LEVEL_NOTE[lvl] || null });
          }
        }
      });
    });
    var load = {};
    people.forEach(function (p) { load[p.user_id] = st.load(p.user_id); });
    return { picks: picks, load: load };
  }

  function newPicks(pl) { return pl.picks.filter(function (p) { return !p.existing && p.user_id; }); }
  function empty(pl) { return pl.picks.filter(function (p) { return !p.user_id; }); }
  function of(pl, sid) { return pl.picks.filter(function (p) { return p.seat.service_id === sid; }); }

  /** Para trocar a pessoa de uma vaga à mão: [{ person, why }] (why null = pode), quem pode primeiro. */
  function candidates(pl, all, seat, people, unavailable, rules, pairs, month) {
    rules = Object.assign({}, DEFAULT_RULES, rules || {});
    var k = seatKey(seat);
    var withPlan = all.map(function (s) {
      var extra = pl.picks.filter(function (p) { return p.seat.service_id === s.id && !p.existing && p.user_id && seatKey(p.seat) !== k; })
        .map(function (p) { return { user_id: p.user_id, function: p.seat.function, status: 'pendente' }; });
      return Object.assign({}, s, { people: s.people.concat(extra) });
    });
    var st = new State(withPlan, month);
    var s = withPlan.find(function (x) { return x.id === seat.service_id; });
    if (!s) return [];
    return people.filter(function (p) { return p.functions.indexOf(seat.function) >= 0; })
      .map(function (p) { return { person: p, why: block(p, s, seat.function, st, rules, pairs || [], unavailable || {}, 0) }; })
      .sort(function (a, b) { return (a.why ? 1 : 0) - (b.why ? 1 : 0) || st.load(a.person.user_id) - st.load(b.person.user_id); });
  }

  var api = { ORDER: ORDER, DEFAULT_RULES: DEFAULT_RULES, needsFor: needsFor, plan: plan, candidates: candidates, seatKey: seatKey, newPicks: newPicks, empty: empty, of: of };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoEscala = api;
})(typeof window !== 'undefined' ? window : globalThis);
