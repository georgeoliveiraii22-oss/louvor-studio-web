// Aparência (Eu › Aparência): aplica antes de desenhar a página, para não piscar o escuro. Padrão: escuro.
try { document.documentElement.setAttribute('data-theme', ({ claro: 'light', auto: 'auto' })[localStorage.getItem('aparencia')] || 'dark'); }
catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
