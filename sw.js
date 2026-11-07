// Atualização automática: cada versão nova do app muda VERSAO. O celular baixa sozinho,
// avisa na barra amarela e troca ao tocar em "Atualizar agora" (ou na próxima abertura).
const VERSAO = "sj-app-24.38.1-16";
const ARQUIVOS = ["./", "index.html", "manifest.webmanifest", "css/app.css", "js/main.js", "js/app.js", "js/api.js", "js/ui.js", "js/config.js",
  "js/telas/pendente.js", "js/telas/inicio.js", "js/telas/clientes.js", "js/telas/historico.js", "js/telas/pedidos.js", "js/telas/agenda.js", "js/telas/mymanager.js", "js/telas/impressao.js", "js/telas/orcamentos.js", "js/telas/orc_cortina.js", "js/telas/orc_mais.js", "js/telas/orc_pers.js", "js/telas/orc_fa.js", "js/planilhas/planilha.js", "js/planilhas/policarbonato.js", "js/planilhas/policarbonato_formulas.js", "js/precos.js", "js/mym.js", "js/telas/financeiro.js", "js/telas/comercial.js", "js/telas/usuarios.js", "js/telas/admin.js", "js/telas/valores.js", "js/telas/gestao.js", "js/telas/produtos.js", "js/telas/persol.js", "js/telas/costura.js", "js/velocidade.js", "js/mym_fat.js", "js/mym_pedidos.js", "js/mym_produtos.js", "js/relatorios/base.js", "js/relatorios/index.js", "js/relatorios/comissoes.js", "js/relatorios/recebidos.js", "js/relatorios/desempenho.js", "js/relatorios/contas_pagas.js", "js/relatorios/gavetas.js", "js/relatorios/vendas_pendentes.js",
  "img/banner_decor.jpg", "img/banner_personalizados.jpg", "img/banner_fa.jpg", "img/login_hero.jpg", "img/logo_decor.png", "img/logo_personalizados.png", "img/logo_fa.png", "img/icon-192.png", "img/icon-512.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // dados do Supabase sempre ao vivo
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
