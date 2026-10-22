// Página de planos (louvorstudio.app.br/planos/). Fica num arquivo porque a CSP não deixa script dentro do HTML.
document.addEventListener('DOMContentLoaded', function () {
  // ?atual=banda (vem do app): marca o plano que a banda já tem.
  var q = new URLSearchParams(location.search);
  document.getElementById('conteudo').appendChild(LSPlanos.secao({ comecar: '../?criar=1', atual: q.get('atual') || null }));
});
