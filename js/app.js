import { medirTela, RetirarParaEnvio, AcaoNuvem } from "./velocidade.js";
// Sistema São João — app do celular. Estrutura igual ao MainForm.cs: login, escolha da unidade,
// menu em três grupos (Vendas, Operação, Gestão) e as mesmas telas.
import * as api from "./api.js";
import { APP_VERSION, STATION_PREFIX } from "./config.js";
import { h, $, icon, toast, alertBox, friendly, initials, firstName, modal } from "./ui.js";

// ---------- Contexto compartilhado com as telas ----------
export const ctx = {
  session: null, unit: null, perms: new Map(),
  get isAdmin() { return String(this.session?.perfil || "").toLowerCase() === "administrador"; },
  get station() {
    let s = null; try { s = localStorage.getItem("sj_estacao"); } catch {}
    if (!s) { s = STATION_PREFIX + "-" + Math.random().toString(36).slice(2, 7).toUpperCase(); try { localStorage.setItem("sj_estacao", s); } catch {} }
    return s;
  },
  // Igual a BeginCloudEdit/EndCloudEdit: reserva o registro na nuvem antes de editar.
  async beginEdit(entity, key) {
    try {
      const r = await api.acquireRecordLock(entity, key, this.station, 15);
      if (r.acquired) return true;
      const exp = r.expiresAt ? new Date(r.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "em alguns minutos";
      await alertBox("Este registro está sendo editado por " + (r.userName || "outro usuário") + " na estação " + (r.station || "não identificada") + ".\n\nA reserva expira às " + exp + ". Atualize a tela e tente novamente.", "Edição protegida");
      return false;
    } catch (e) {
      await alertBox("Não foi possível confirmar uma edição segura na nuvem. Para evitar perda de dados, a alteração foi bloqueada.\n\n" + friendly(e), "Edição segura indisponível");
      return false;
    }
  },
  async endEdit(entity, key) { try { await api.releaseRecordLock(entity, key, this.station); } catch {} },
  async audit(action, entity, id, details) { try { await api.insertAudit(this.session.legacyId, this.session.nome, action, entity, id, details, this.station); } catch {} },
  editFields() { return { alterado_por: this.session.userId, alterado_por_nome: this.session.nome, sync_origem: this.station }; },
  go(route) { location.hash = "#/" + route; },
};

// ---------- Permissões (MainForm.MenuModule / CanViewMenu) ----------
function menuModule(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("cliente")) return "CLIENTES";
  if (x.includes("inteligência") || x.includes("inteligencia") || x.includes("sj ia") || x.includes("crm") || x.includes("busca")) return "CRM";
  if (["orçamento", "cortina", "persiana", "toldo", "cobertura", "mosquiteira", "papel", "tapete"].some((k) => x.includes(k))) return "ORCAMENTOS";
  if (x === "pedidos") return "PEDIDOS";
  if (x.includes("acompanh") || x.includes("agenda")) return "ACOMPANHAMENTOS";
  if (x.includes("financeiro")) return "FINANCEIRO";
  if (x.includes("relatórios")) return "RELATORIOS";
  if (x.includes("valores")) return "VALORES_PRODUTOS";
  if (x === "usuários") return "USUARIOS";
  if (x.includes("auditoria") || x.includes("lixeira") || x.includes("exclus")) return "AUDITORIA";
  if (x.includes("atualizações do sistema")) return "";
  if (["backup", "estação", "migração", "espelho", "status nuvem", "atualizações", "saúde"].some((k) => x.includes(k))) return "CONFIGURACOES";
  return "";
}
export function canView(title) {
  if (!ctx.session || ctx.isAdmin) return true;
  const m = menuModule(title); if (!m) return true;
  if (ctx.perms.has(m)) return ctx.perms.get(m);
  return !["FINANCEIRO", "RELATORIOS", "VALORES_PRODUTOS", "USUARIOS", "AUDITORIA", "CONFIGURACOES"].includes(m);
}

// ---------- Menu igual ao BuildModuleRoot / flyouts ----------
function menuDef() {
  const u = ctx.unit;
  const orc = u.code === "PERSONALIZADOS"
    ? [["Orçamento Impressão", "orc/impressao"], ["Orçamento Laser CO²", "orc/laser"], ["Orçamento Laser - Gravação", "orc/gravacao"], ["Orçamento Bordado", "orc/bordado"]]
    : u.code === "FA_COLCHOES" ? [["FA Colchões", "orc/fa"], ["Painel FA", "fa/painel"]]
    : [["Cortina sob medida", "orc/cortina"], ["Persianas", "orc/persiana"], ["Toldo retrátil", "orc/toldo"], ["Cobertura policarbonato", "orc/policarbonato"], ["Tela mosquiteira", "orc/mosquiteira"], ["Papel de Parede", "orc/papel"], ["Tapete personalizado", "orc/tapete"], ["Orçamento por ambientes", "orc/ambientes"]];
  orc.push(["Consultar produtos", "consulta-produtos"], ["Histórico de Orçamentos", "historico"]);
  if (u.code === "DECOR") orc.push(["Integração Persol", "persol"]);
  const conf = [["Painel Executivo", "admin/painel"], ["Central Evolução 2026", "admin/evolucao"], ["Usuários e Permissões", "usuarios"], ["Auditoria e Exclusões", "auditoria"], ["Valores / Produtos", "valores"], ["Histórico de Preços", "historico-precos"], ["Sistema e Sincronização", "admin/sistema"], ["Atualizações do Sistema", "atualizacoes"], ["Computadores e Versões", "estacoes"], ["Velocidade do Sistema", "velocidade"], ["Sobre / Versão", "sobre"]];
  const m = [
    { grp: "Vendas" }, ["Início", "home", "inicio"], ["Clientes", "user", null, [["Clientes", "clientes"], ["Ficha Completa do Cliente", "ficha"]]],
    ["Orçamentos", "doc", null, orc], ["Pedidos", "box", "pedidos"], ["Comercial", "chart", "comercial"],
    { grp: "Operação" }, ["Produção", "production", "pedidos"], ["Agenda", "calendar", "agenda"], ["Compras", "cart", "compras"],
    { grp: "Gestão" }, ["Financeiro", "money", "financeiro"], ["Relatórios", "report", "relatorios"], ["Usuários", "users", "usuarios"], ["Configurações", "gear", null, conf],
  ];
  if (ctx.isAdmin) m.push(["Diagnóstico", "health", "diagnostico"]);
  return m;
}

// ---------- Telas ----------
const screens = {};
export function register(route, fn) { screens[route] = fn; }

let shellBuilt = false;
function applyUnitTheme() {
  const u = ctx.unit; const r = document.documentElement.style;
  r.setProperty("--accent", u.accent); r.setProperty("--accent-hover", u.hover);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", "#111316");
  document.title = "Sistema São João — " + u.name;
}

function buildShell() {
  const root = $("#app"); root.innerHTML = ""; applyUnitTheme();
  const drawerBg = h("div", { class: "drawer-bg", onclick: () => toggleDrawer(false) });
  const brandImg = { DECOR: "img/banner_decor.jpg", PERSONALIZADOS: "img/banner_personalizados.jpg", FA_COLCHOES: "img/banner_fa.jpg" }[ctx.unit.code];
  const menu = h("nav", { class: "menu", id: "menu" });
  for (const it of menuDef()) {
    if (it.grp) { menu.append(h("div", { class: "grp" }, it.grp)); continue; }
    const [title, ic, route, subs] = it;
    if (!canView(title)) continue;
    const btn = h("button", { "data-route": route || "", "data-title": title }, icon(ic, 19), title, subs ? h("span", { class: "arr" }, "›") : null);
    menu.append(btn);
    if (subs) {
      const sub = h("div", { class: "sub hidden" });
      for (const [st, sr] of subs) if (canView(st)) sub.append(h("button", { "data-route": sr, onclick: () => { ctx.go(sr); toggleDrawer(false); } }, st));
      menu.append(sub);
      btn.addEventListener("click", () => { sub.classList.toggle("hidden"); btn.querySelector(".arr").textContent = sub.classList.contains("hidden") ? "›" : "⌄"; });
    } else btn.addEventListener("click", () => { ctx.go(route); toggleDrawer(false); });
  }
  const foot = h("div", { class: "menu-foot", onclick: () => { ctx.go("diagnostico"); toggleDrawer(false); } },
    h("div", { class: "l" }, h("span", { class: "d", id: "cloudDot", style: { background: "var(--ok)" } }), h("span", { id: "cloudTxt" }, "Nuvem conectada")),
    h("div", { class: "l" }, h("span", {}, "versão " + APP_VERSION + " · celular · suporte")));
  const drawer = h("aside", { class: "drawer", id: "drawer" }, h("div", { class: "brand" }, h("img", { src: brandImg, alt: ctx.unit.name })), menu, foot);

  const unitPill = h("button", { class: "unit-pill", onclick: chooseUnitMenu }, h("span", { class: "dot", style: { background: ctx.unit.code === "FA_COLCHOES" ? "#fff" : ctx.unit.accent } }), ctx.unit.name, " ▾");
  const avatar = h("button", { class: "avatar", title: "Trocar usuário", onclick: userMenu }, initials(ctx.session.nome));
  const top = h("header", { class: "topbar" },
    h("button", { class: "hamb", "aria-label": "Menu", onclick: () => toggleDrawer(true) }, icon("menu", 24, "#fff")),
    h("div", { class: "brand-top", onclick: () => ctx.go("inicio") }, h("div", { class: "sj-mark" }, "SJ"), h("div", {}, h("b", {}, "Loja São João"))),
    h("div", { class: "top-right" }, unitPill, avatar));
  const search = h("input", { placeholder: "Buscar cliente, orçamento ou pedido", enterkeyhint: "search", onkeydown: (e) => { if (e.key === "Enter" && search.value.trim()) { ctx.go("busca/" + encodeURIComponent(search.value.trim())); search.blur(); } } });
  const sbar = h("div", { class: "searchbar" }, h("div", { class: "search-shell" }, icon("search", 18, "#9ca3af"), search));
  const upd = h("div", { class: "update-bar hidden", id: "updateBar" });
  root.append(upd, top, sbar, h("main", { class: "content", id: "content" }), drawerBg, drawer);
  shellBuilt = true;
  heartbeat(); setInterval(heartbeat, 60000);
}
function toggleDrawer(open) { $("#drawer")?.classList.toggle("open", open); document.querySelector(".drawer-bg")?.classList.toggle("open", open); }
function markActive(route) {
  for (const b of document.querySelectorAll("#menu button")) b.classList.toggle("active", !!route && b.dataset.route === route && !b.closest(".sub"));
}

function chooseUnitMenu() {
  modal("Trocar unidade", ({ body, close }) => {
    for (const u of Object.values(api.UNIDADES)) body.append(h("button", { class: "btn block", style: { margin: "6px 0", justifyContent: "flex-start", gap: "10px" }, onclick: () => { close(); if (u.code !== ctx.unit.code) switchUnit(u); } },
      h("span", { class: "dot", style: { width: "10px", height: "10px", borderRadius: "50%", background: u.accent, display: "inline-block" } }), u.short + (u.code === ctx.unit.code ? "  ✓" : "")));
  });
}
async function switchUnit(u) {
  ctx.unit = u; try { localStorage.setItem("sj_ultima_unidade", u.code); } catch {}
  api.clearOperationalCache(); await ctx.audit("TROCAR_UNIDADE", "USUARIO", String(ctx.session.legacyId), "Celular | Unidade: " + u.code);
  buildShell(); route();
}
function userMenu() {
  modal(ctx.session.nome || "Usuário", ({ body, close }) => {
    body.append(h("p", { style: { color: "#6b7280" } }, (ctx.session.perfil || "") + " · " + (ctx.session.login || "")));
    body.append(h("button", { class: "btn block", style: { marginBottom: "8px" }, onclick: () => { close(); logout(true); } }, "Trocar usuário"));
    body.append(h("button", { class: "btn block danger", onclick: () => { close(); logout(false); } }, "Sair do sistema"));
  });
}
async function logout(switchUser) {
  await ctx.audit(switchUser ? "TROCAR_USUARIO_SAIDA" : "LOGOUT", "USUARIO", String(ctx.session.legacyId), APP_VERSION + " | Celular | Unidade: " + (ctx.unit?.code || ""));
  api.sessao.clear(); ctx.session = null; ctx.unit = null; shellBuilt = false; location.hash = ""; showLogin();
}

async function heartbeat() {
  if (!ctx.session) return;
  const dot = $("#cloudDot"), txt = $("#cloudTxt");
  try {
    await api.upsertStationHeartbeat(ctx.station, "Celular (" + (navigator.userAgentData?.platform || navigator.platform || "") + ")", ctx.session.nome, ctx.session.perfil, ctx.unit.code, APP_VERSION + "-APP");
    if (dot) { dot.style.background = "var(--ok)"; txt.textContent = "Nuvem conectada"; }
  } catch (e) {
    if (e.semSessao || e.status === 401) { await alertBox("Sua sessão terminou. Entre novamente."); return logout(false); }
    if (dot) { dot.style.background = "var(--warn)"; txt.textContent = "Sem conexão"; }
  }
}

// ---------- Roteador ----------
export function route() {
  if (!ctx.session) return showLogin();
  if (!ctx.unit) return showUnits();
  if (!shellBuilt) buildShell();
  const raw = decodeURIComponent((location.hash || "#/inicio").slice(2)) || "inicio";
  const parts = raw.split("/");
  let key = parts[0], arg = parts.slice(1).join("/");
  if (screens[parts[0] + "/" + parts[1]]) { key = parts[0] + "/" + parts[1]; arg = parts.slice(2).join("/"); }
  const fn = screens[key] || screens["pendente"];
  const content = $("#content"); content.innerHTML = ""; window.scrollTo(0, 0);
  markActive(key);
  const pr = Promise.resolve(fn(content, arg, key)).catch((e) => { content.append(h("div", { class: "note" }, friendly(e))); });
  medirTela(content, pr);
  const vel = RetirarParaEnvio(2 * 3600000, 5, false); if (vel) ctx.audit(AcaoNuvem, "DESEMPENHO", ctx.station, vel);
}
window.addEventListener("hashchange", route);

// ---------- Login (LoginForm.cs) ----------
function recentUsers() { try { return JSON.parse(localStorage.getItem("sj_recentes") || "[]"); } catch { return []; } }
function saveRecent(s) {
  const l = recentUsers().filter((x) => x.login.toLowerCase() !== s.login.toLowerCase()); l.unshift({ login: s.login, nome: s.nome });
  try { localStorage.setItem("sj_recentes", JSON.stringify(l.slice(0, 3))); } catch {}
}
function showLogin() {
  shellBuilt = false; document.documentElement.style.removeProperty("--accent");
  const root = $("#app"); root.innerHTML = "";
  const rec = recentUsers();
  const user = h("input", { placeholder: "Usuário", autocomplete: "username", autocapitalize: "none", spellcheck: "false" });
  const pass = h("input", { placeholder: "Senha", type: "password", autocomplete: "current-password" });
  const caps = h("div", { class: "caps hidden" }, "Caps Lock está ligado");
  let remembered = null; try { remembered = JSON.parse(localStorage.getItem("sj_lembrar") || "null"); } catch {}
  const remember = h("input", { type: "checkbox", checked: !!remembered });
  if (remembered) user.value = remembered.login || "";
  const err = h("div", { class: "login-err hidden" });
  const status = h("span", {}, "Verificando conexão...");
  const btn = h("button", { class: "btn-login", type: "submit" }, "Entrar   →");
  const form = h("form", { class: "login-box", onsubmit: (e) => { e.preventDefault(); doLogin(); } },
    h("h1", {}, "Entrar no sistema"), h("p", { class: "sub" }, rec.length ? "Escolha seu usuário ou digite abaixo" : "Digite seu usuário e senha"),
    rec.length ? h("div", { class: "recent" }, rec.map((r) => h("button", { type: "button", class: "chip-user", onclick: () => { user.value = r.login; pass.value = ""; pass.focus(); } }, h("span", { class: "ini" }, initials(firstName(r.nome || r.login))), firstName(r.nome || r.login)))) : null,
    h("label", { class: "field" }, icon("person", 20), user),
    h("label", { class: "field" }, icon("lock", 20), pass, h("button", { type: "button", class: "show", onclick: (e) => { pass.type = pass.type === "password" ? "text" : "password"; e.target.textContent = pass.type === "password" ? "mostrar" : "ocultar"; } }, "mostrar")),
    caps,
    h("div", { class: "login-row" }, h("label", {}, remember, "Lembrar meu usuário"), h("a", { href: "#", onclick: (e) => { e.preventDefault(); recover(user.value); } }, "Esqueci minha senha")),
    btn, err);
  pass.addEventListener("keyup", (e) => caps.classList.toggle("hidden", !(e.getModifierState && e.getModifierState("CapsLock"))));
  user.addEventListener("input", () => err.classList.add("hidden")); pass.addEventListener("input", () => err.classList.add("hidden"));
  root.append(h("div", { class: "login" }, h("div", { class: "login-hero" }), form,
    h("div", { class: "login-foot" }, status, h("span", {}, "Versão " + APP_VERSION))));
  api.testar().then(() => { status.textContent = "● Nuvem protegida"; status.style.color = "#1f8b4b"; })
    .catch(() => { status.textContent = "● Nuvem indisponível"; status.style.color = "#d97706"; });

  async function doLogin() {
    err.classList.add("hidden"); btn.disabled = true; btn.textContent = "Entrando...";
    try {
      const identity = user.value.trim();
      if (!identity) throw new Error("Informe o usuário.");
      let email = identity;
      if (identity.indexOf("@") < 0) {
        try { email = await api.resolveLoginEmail(identity); }
        catch (e) { if (e instanceof api.ConexaoIndisponivel) throw new Error("A nuvem está indisponível e o celular não possui contingência local. Verifique a internet e tente de novo."); throw e; }
        if (!email) throw new Error("Usuário não encontrado no cadastro central. Verifique o usuário ou peça ao Administrador para cadastrá-lo.");
      }
      const p = await api.signIn(email, pass.value);
      ctx.session = p; api.sessao.set(p);
      if (remember.checked) { try { localStorage.setItem("sj_lembrar", JSON.stringify({ login: identity })); } catch {} } else { try { localStorage.removeItem("sj_lembrar"); } catch {} }
      saveRecent(p);
      await loadPerms();
      try { await api.insertAudit(p.legacyId, p.nome, "LOGIN_SUPABASE", "USUARIO", String(p.legacyId), "Login autenticado pelo Supabase V" + APP_VERSION + " (celular)", ctx.station); } catch {}
      showUnits();
    } catch (e) {
      err.textContent = friendly(e); err.classList.remove("hidden"); if (navigator.vibrate) navigator.vibrate(120);
    } finally { btn.disabled = false; btn.textContent = "Entrar   →"; }
  }
  async function recover(cur) {
    const { formModal } = await import("./ui.js");
    const v = await formModal("Esqueci minha senha", [{ type: "note", text: "Informe seu usuário ou e-mail cadastrado. Você receberá as instruções de recuperação no e-mail." }, { name: "id", label: "Usuário ou e-mail", value: cur || "" }],
      { okText: "ENVIAR RECUPERAÇÃO", validate: async (x) => { x.msg = await api.requestPasswordRecovery(x.id); } });
    if (v) alertBox(v.msg, "Recuperação de senha");
  }
}
async function loadPerms() {
  ctx.perms = new Map();
  if (ctx.isAdmin) return;
  try { for (const r of await api.fetchUserPermissions(ctx.session.userId)) ctx.perms.set(r.Modulo, r.Visualizar); } catch {}
}

// ---------- Escolha da unidade (UnitSelectionForm.cs) ----------
function showUnits() {
  shellBuilt = false; document.documentElement.style.removeProperty("--accent");
  let last = null, auto = false; try { last = localStorage.getItem("sj_ultima_unidade"); auto = localStorage.getItem("sj_unidade_auto") === "1"; } catch {}
  if (auto && last && api.UNIDADES[last]) { ctx.unit = api.UNIDADES[last]; return route(); }
  const root = $("#app"); root.innerHTML = "";
  const d = new Date(); const dia = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const cards = [
    [api.UNIDADES.DECOR, "img/banner_decor.jpg", "Cortinas, persianas, papel de parede e projetos", "Entrar na Decor", "#e72a30", 1],
    [api.UNIDADES.PERSONALIZADOS, "img/banner_personalizados.jpg", "Brindes, canecas, presentes e lembrancinhas", "Entrar no Personalizados", "#009b52", 2],
    [api.UNIDADES.FA_COLCHOES, "img/banner_fa.jpg", "Colchões, box, cabeceiras e travesseiros", "Entrar na FA", "#3f3f46", 3],
  ];
  const autoChk = h("input", { type: "checkbox", checked: auto, onchange: (e) => { try { localStorage.setItem("sj_unidade_auto", e.target.checked ? "1" : "0"); } catch {} } });
  root.append(h("div", { class: "units" },
    h("div", { class: "units-head" }, h("div", {}, h("h1", {}, "Olá, " + firstName(ctx.session.nome) + ". Em qual unidade vamos trabalhar?"), h("div", { class: "meta" }, dia[0].toUpperCase() + dia.slice(1) + "  ·  Loja São João")),
      h("button", { class: "btn", onclick: () => logout(true) }, "Trocar usuário")),
    h("div", { class: "unit-cards" }, cards.map(([u, img, desc, txt, col, n]) => h("div", { class: "unit-card" + (u.code === last ? " sel" : "") },
      h("div", { class: "ban", style: { backgroundImage: "url(" + img + ")" } }),
      h("div", { class: "body" }, h("h2", {}, u.name), h("p", {}, desc),
        h("button", { style: { background: col }, onclick: () => { ctx.unit = u; try { localStorage.setItem("sj_ultima_unidade", u.code); } catch {} ctx.audit("ESCOLHER_UNIDADE", "USUARIO", String(ctx.session.legacyId), "Celular | Unidade: " + u.code); location.hash = "#/inicio"; route(); } }, txt, h("span", { class: "n" }, n)))))),
    h("label", { class: "auto" }, autoChk, "Abrir direto na última unidade usada")));
}

// ---------- Atualização automática ----------
export function showUpdateBar(text, action) {
  const b = $("#updateBar"); if (!b) return;
  b.innerHTML = ""; b.append(h("span", {}, text), action ? h("button", { class: "btn", style: { height: "32px" }, onclick: action }, "Atualizar agora") : null);
  b.classList.remove("hidden");
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    reg.update();
    setInterval(() => reg.update(), 30 * 60 * 1000);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdateBar("Nova versão do app disponível.", () => { w.postMessage("skipWaiting"); }); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

// ---------- Início ----------
export async function boot() {
  const s = api.sessao.get();
  if (s && s.accessToken) {
    ctx.session = s;
    try { const r = await api.refreshSession(s.refreshToken); s.accessToken = r.accessToken; s.refreshToken = r.refreshToken; api.sessao.set(s); }
    catch (e) { if (!(e instanceof api.ConexaoIndisponivel)) { api.sessao.clear(); ctx.session = null; return showLogin(); } }
    await loadPerms();
    let last = null; try { last = sessionStorage.getItem("sj_unidade_sessao") || localStorage.getItem("sj_ultima_unidade"); } catch {}
    if (last && api.UNIDADES[last] && location.hash.length > 2) ctx.unit = api.UNIDADES[last];
    return ctx.unit ? route() : showUnits();
  }
  showLogin();
}
