// Configuração do painel. A chave abaixo é a chave PÚBLICA (publishable) do Supabase:
// ela pode ficar no código do site, porque o acesso real é controlado pelas regras do banco (RLS).
// NUNCA coloque aqui a chave "secret" / "service_role".
window.LOUVOR_CONFIG = {
  url: 'https://mryuqpnkdkmmhmqrjixy.supabase.co',
  key: 'sb_publishable_kQ5b8gJER45UjhptOIYcpg_Z-dMsI-7'
};

// Segurança: ninguém pode abrir o Louvor Studio escondido dentro de outra página (golpe do "clique escondido").
if (window.top !== window.self) {
  try { window.top.location.replace(window.location.href); } catch (e) { document.documentElement.style.visibility = 'hidden'; }
}
