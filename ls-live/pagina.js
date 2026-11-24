// Página do LS Live (louvorstudio.app.br/ls-live/). Fica num arquivo porque a CSP não deixa script dentro do HTML.
// Vídeo de demonstração: quando existir, ponha o arquivo em ls-live/video/demo.mp4 (e a capa em video/capa.webp)
// e preencha VIDEO.src abaixo. Um link do YouTube também serve (VIDEO.youtube = 'id do vídeo').
(function () {
  'use strict';
  var VIDEO = { src: '', capa: '', youtube: '' };

  document.addEventListener('DOMContentLoaded', function () {
    var sec = document.getElementById('video');
    if (!sec || !(VIDEO.src || VIDEO.youtube)) return;
    var box = sec.querySelector('.lsl-video-box');
    if (VIDEO.youtube) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(VIDEO.youtube);
      f.title = 'Vídeo: o LS Live funcionando';
      f.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      f.loading = 'lazy';
      box.appendChild(f);
    } else {
      var v = document.createElement('video');
      v.src = VIDEO.src;
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      if (VIDEO.capa) v.poster = VIDEO.capa;
      box.appendChild(v);
    }
    sec.hidden = false;
  });
})();
