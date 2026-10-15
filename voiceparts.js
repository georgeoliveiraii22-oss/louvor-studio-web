// Vozes (naipes) das gravações — os mesmos ids do app Android (data/VoiceParts.kt) e da migração 0016.
(function (root) {
  var ALL = [
    { id: 'principal', label: 'Voz principal' }, { id: 'voz1', label: '1ª voz' }, { id: 'voz2', label: '2ª voz' }, { id: 'voz3', label: '3ª voz' },
    { id: 'soprano', label: 'Soprano' }, { id: 'mezzo', label: 'Mezzo-soprano' }, { id: 'contralto', label: 'Contralto' },
    { id: 'tenor', label: 'Tenor' }, { id: 'baritono', label: 'Barítono' }, { id: 'baixo', label: 'Baixo' }
  ];
  function label(id) {
    var v = ALL.find(function (x) { return x.id === id; });
    return v ? v.label : null;
  }
  root.VoiceParts = { ALL: ALL, label: label };
})(typeof window !== 'undefined' ? window : globalThis);
