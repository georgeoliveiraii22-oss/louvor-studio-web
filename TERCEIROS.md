# Componentes de terceiros do painel

| Componente | Uso | Licença |
|---|---|---|
| [Supabase JS](https://github.com/supabase/supabase-js) 2.49.4 | Login, banco e arquivos | MIT |
| [Lucide](https://lucide.dev) 0.460.0 | Ícones do painel | ISC |
| [Archivo](https://fonts.google.com/specimen/Archivo) e [DM Mono](https://fonts.google.com/specimen/DM+Mono) | Fontes | SIL Open Font License 1.1 |
| [lamejs](https://github.com/zhuker/lamejs) 1.2.1 | Converter faixas M4A, WAV, FLAC ou MP3 de bitrate variável para MP3 320 kbps no envio (carregado sem alteração pela CDN, só quando precisa converter) | LGPL-3.0 |
| [jsdom](https://github.com/jsdom/jsdom) 24.1.0 | Só nos testes | MIT |
| [Motion](https://motion.dev) 11.18.2 ([motiondivision/motion](https://github.com/motiondivision/motion)) | Animações da página de entrada do site (carregado só nela) | MIT |
| [Rough.js](https://roughjs.com) 4.6.6 ([rough-stuff/rough](https://github.com/rough-stuff/rough)) | Círculos e caixas "desenhados à mão" nas telas animadas da página de entrada | MIT |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) 1.9.3 | Confete ao publicar a escala, na página de entrada | ISC |
| [Geist e Geist Mono](https://fonts.google.com/specimen/Geist) | Fontes do site (app para celular) | SIL Open Font License 1.1 |
| Moldura do Pixel 6 ([device art do Android Studio](https://github.com/JetBrains/android/tree/master/artwork/resources/device-art-resources/pixel_6)) | Celulares das fotos da página de entrada (`img/cel-*.webp`) | Apache 2.0 |

Os componentes são carregados por CDN (jsDelivr, Google Fonts) ou pelo npm nos testes; nenhum código deles foi copiado para o repositório. A moldura do Pixel 6 entra só como imagem, já montada com as fotos do app.