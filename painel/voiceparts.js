// Vozes (naipes) das gravações — os mesmos ids do app Android (data/VoiceParts.kt) e da migração 0016.
(function (root) {
  var ALL = [
    { id: 'principal', label: 'Voz principal' }, { id: 'voz1', label: '1ª voz' }, { id: 'voz2', label: '2ª voz' }, { id: 'voz3', label: '3ª voz' },
    { id: 'soprano', label: 'Soprano' }, { id: 'mezzo', label: 'Mezzo-soprano' }, { id: 'contralto', label: 'Contralto' },
    { id: 'tenor', label: 'Tenor' }, { id: 'baritono', label: 'Barítono' }, { id: 'baixo', label: 'Baixo' }
  ];
  // Instrumentos gravados no app (migração 0025): o id começa com "inst_".
  var INSTRUMENTS = [
    { id: 'inst_violao', label: 'Violão' }, { id: 'inst_guitarra', label: 'Guitarra' }, { id: 'inst_baixo', label: 'Baixo (instrumento)' },
    { id: 'inst_teclado', label: 'Teclado' }, { id: 'inst_bateria', label: 'Bateria' }, { id: 'inst_percussao', label: 'Percussão' },
    { id: 'inst_sopro', label: 'Sopro' }, { id: 'inst_cordas', label: 'Cordas' }, { id: 'inst_outro', label: 'Outro instrumento' }
  ];
  function label(id) {
    var v = ALL.concat(INSTRUMENTS).find(function (x) { return x.id === id; });
    return v ? v.label : null;
  }
  root.VoiceParts = { ALL: ALL, INSTRUMENTS: INSTRUMENTS, label: label };
})(typeof window !== 'undefined' ? window : globalThis);
