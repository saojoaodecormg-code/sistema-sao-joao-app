// FA Colchões: orçamento (FaColchoesTela.FaColchoes + FaRules) e Painel FA (FaPainel).
// Produtos, preços, estoque e clientes vêm do myManager; o computador da loja copia para a nuvem
// (conjuntos "mym_produtos" e "mym_clientes") e o app lê a cópia, sem nunca gravar no myManager.
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, modal, alertBox, confirmBox, friendly, money, fmtDate } from "../ui.js";
import { precos } from "../precos.js";
import { savePending, pickMyManagerCustomer } from "./orcamentos.js";
import { SearchProducts, PickPrice, PickStock, mymProductColumns } from "../mym_produtos.js";

const C2 = money;
const g2 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const g4 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const n2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const R2 = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9) / 100;
const Dg = (v) => String(Math.round(v * 100) / 100); // D() invariante "0.##"
const N = (s) => { const t = String(s ?? "").replace(/R\$/g, "").replace(/[\s ]/g, ""); if (!t) return 0; const v = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return isFinite(v) ? v : 0; };
export const norm = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
const terms = (info) => { const r = []; for (const t of String(info ?? "").split(";")) { const s = norm(t); if (s && !r.includes(s)) r.push(s); } return r; };
function Dec(s) { s = String(s ?? "").trim(); if (!s || s === "<null>") return 0; const v = s.lastIndexOf(",") > s.lastIndexOf(".") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/,/g, "")); return isFinite(v) ? v : 0; }

// ---------- FaRules ----------
export const FA = {
  PayGroup: "FA COLCHÕES PAGAMENTO", CashItem: "Desconto à vista (%)", NoInterestItem: "Cartão sem juros até (parcelas)", InterestItem: (n) => "Cartão com juros " + String(n).padStart(2, "0") + "x (acréscimo %)",
  DiscGroup: "FA COLCHÕES DESCONTO", SellerMaxItem: "Desconto máximo do vendedor (%)", AuthMaxItem: "Desconto máximo com liberação (%)", SizeGroup: "FA COLCHÕES MEDIDAS", ServiceGroup: "FA COLCHÕES SERVIÇOS", CatGroup: "FA COLCHÕES",
  DefaultSizes: [["Solteiro", "SOLTEIRO;0,88;088;0.88;0,78;078"], ["Solteirão", "SOLTEIRAO;0,96;096;0.96"], ["Viúva", "VIUVA;1,28;128;1.28"], ["Casal", "CASAL;1,38;138;1.38"], ["Queen", "QUEEN;1,58;158;1.58"], ["King", "KING;1,93;193;1.93"]],
  DefaultCategories: [["Colchão", "COLCHAO;-PROTETOR;-CAPA;-LENCOL;-JOGO;-SAIA;-CAMA POSTA"], ["Box Base", "BOX;BASE;-PROTETOR;-LENCOL;-JOGO;-SAIA;-CAMA POSTA;-TAPETE;-BANHEIRO"], ["Cabeceira", "CABECEIRA"], ["Pillow", "PILLOW"], ["Travesseiro", "TRAVESS"], ["Anti Refluxo", "REFLUXO"], ["Casca de Ovo / Manta", "CASCA DE OVO;MANTA;-ACRILICA;-POLIESTER"]],
  MaxInstallments: 18,
};
const DefaultInterest = (n) => { if (n < 1) return 0; const i = 0.0299, f = (n * i) / (1 - Math.pow(1 + i, -n)) - 1; return R2(f * 100); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CashValue = (liq, pct) => R2(liq * (1 - clamp(pct, 0, 100) / 100));
const WithInterest = (liq, pct) => R2(liq * (1 + Math.max(0, pct) / 100));
const Installment = (t, n) => (n < 1 ? t : R2(t / n));
const lineGross = (l) => (l.Kind === "P" ? R2(l.Unit * l.Qty) : 0);
const lineTotal = (l) => (l.Kind === "B" ? 0 : l.Kind === "S" ? R2(l.Unit) : R2(l.Unit * l.Qty * (1 - l.DiscPct / 100)));
const DiscountPercent = (g, n) => (g <= 0 ? 0 : R2((1 - n / g) * 100));
function Compute(lines, generalPct) {
  const t = { ProductsGross: 0, ProductsNet: 0, Services: 0, GiftsValue: 0, GeneralPct: clamp(generalPct, 0, 100) };
  for (const l of lines) { if (l.Kind === "P") { t.ProductsGross += lineGross(l); t.ProductsNet += lineTotal(l); } else if (l.Kind === "S") t.Services += lineTotal(l); else t.GiftsValue += R2(l.Unit * l.Qty); }
  t.GeneralValue = R2((t.ProductsNet * t.GeneralPct) / 100); const products = t.ProductsNet - t.GeneralValue;
  t.Liquid = products + t.Services; t.DiscountValue = t.ProductsGross - products; t.DiscountPct = DiscountPercent(t.ProductsGross, products); return t;
}
const GeneralPctForTarget = (pn, sv, f, target) => (pn <= 0 || f <= 0 ? -1 : (1 - (target / f - sv) / pn) * 100);
function CheckDiscount(pct, sellerMax, authMax, isAuth, already) { if (authMax < sellerMax) authMax = sellerMax; if (pct > authMax) return "ABOVE"; if (pct <= sellerMax || isAuth || pct <= already) return "OK"; return "NEEDS"; }
const Logins = (info) => new Set(String(info ?? "").split(/[;, ]/).map((s) => s.trim().toLowerCase()).filter(Boolean));
function IsAuthorizer(set, login, email) { if (!set.size) return false; if (login && set.has(login.trim().toLowerCase())) return true; if (email) { const e = email.trim().toLowerCase(); if (set.has(e)) return true; const at = e.indexOf("@"); if (at > 0 && set.has(e.slice(0, at))) return true; } return false; }
function NameMatches(name, ts) { const n = norm(name); let any = false, hit = false; for (const t of ts) { if (t.startsWith("-")) { const x = t.slice(1).trim(); if (x && n.includes(x)) return false; } else { any = true; if (n.includes(t)) hit = true; } } return any && hit; }
const DetectSize = (name, sizes) => { for (const [k, v] of sizes) if (NameMatches(name, v)) return k; return null; };
export function Outcome(status) { const s = norm(status); if (!s || s === "ORCAMENTO" || s === "NEGOCIACAO" || s === "ACOMPANHAR" || s === "ENVIADO" || s.startsWith("AGUARDANDO") || s.startsWith("EM ANALISE") || s === "REVISAR") return "ABERTO"; if (s === "NEGADO" || s.startsWith("CANCELAD") || s === "EXPIRADO" || s === "PERDIDO") return "PERDIDO"; return "FECHADO"; }
function LineText(l) {
  if (l.Kind === "S") return "SERVIÇO: " + l.Name + " | Total: " + n2(lineTotal(l));
  let s = (l.Kind === "B" ? "BRINDE: " : "") + l.Name + " | Cód. MyManager: " + l.Code + " | Qtd: " + g2(l.Qty) + " | Unitário: " + n2(l.Unit);
  if (l.Kind === "P" && l.DiscPct !== 0) s += " | Desconto: " + g2(l.DiscPct) + "%";
  return s + " | Total: " + n2(lineTotal(l));
}
const brNum = (v) => { const t = String(v ?? "").replace(/R\$/g, "").trim(); const x = Number(t.replace(/\./g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
export function ParseLines(resumo) {
  const out = [];
  for (const raw of String(resumo ?? "").replace(/\r/g, "").split("\n")) {
    const s = raw.trim(); if (!s.includes(" | ")) continue; const parts = s.split(" | "); const l = { Kind: "P", Code: "", Name: "", Qty: 1, Unit: 0, DiscPct: 0 }; let name = parts[0].trim();
    if (/^SERVIÇO: /i.test(name)) { l.Kind = "S"; name = name.slice(9).trim(); } else if (/^BRINDE: /i.test(name)) { l.Kind = "B"; name = name.slice(8).trim(); }
    l.Name = name; let has = false, total = 0;
    for (let i = 1; i < parts.length; i++) { const c = parts[i].indexOf(":"); if (c < 0) continue; const k = norm(parts[i].slice(0, c)), v = parts[i].slice(c + 1).trim().replace(/%$/, "").trim(); if (k === "COD. MYMANAGER") { l.Code = v; has = true; } else if (k === "QTD") l.Qty = brNum(v); else if (k === "UNITARIO") l.Unit = brNum(v); else if (k === "DESCONTO") l.DiscPct = brNum(v); else if (k === "TOTAL") total = brNum(v); }
    if (l.Kind === "S") { l.Unit = total; l.Qty = 1; out.push(l); } else if (has) out.push(l);
  }
  return out;
}
export function ParsePayment(resumo) {
  const s = String(resumo ?? ""); let a = s.indexOf("<SJ_FA_PAG>"); if (a < 0) return null; a += 11; const b = s.indexOf("</SJ_FA_PAG>", a); if (b < 0) return null;
  const d = {}; for (const kv of s.slice(a, b).split(";")) { const i = kv.indexOf("="); if (i > 0) d[kv.slice(0, i).trim().toLowerCase()] = kv.slice(i + 1).trim(); }
  return { Mode: d.forma || "AVISTA" };
}

// ---------- Tela FA Colchões ----------
register("orc/fa", async (el) => {
  const cfgP = await precos(ctx.unit).ensureFresh();
  const FaCfg = (g, i, def) => { const r = cfgP.rowsOfGroup(g).find((x) => x.i.toLowerCase() === i.toLowerCase()); if (!r) return def; const v = String(r.raw1 ?? r.v1 ?? "").trim(); return v.length === 0 ? def : Dec(v); };
  const FaCfgInfo = (g, i, def) => { const r = cfgP.rowsOfGroup(g).find((x) => x.i.toLowerCase() === i.toLowerCase()); return r ? r.info || "" : def; };
  let sizes = cfgP.rowsOfGroup(FA.SizeGroup).map((r) => [r.i, terms(r.info)]).filter((x) => x[1].length); if (!sizes.length) sizes = FA.DefaultSizes.map(([k, t]) => [k, terms(t)]);
  let cats = cfgP.rowsOfGroup(FA.CatGroup).map((r) => [r.i, terms(r.info)]).filter((x) => x[1].length); if (!cats.length) cats = FA.DefaultCategories.map(([k, t]) => [k, terms(t)]);
  const lines = []; let clienteId = 0, clienteNome = "", authorizedPct = 0, authorizedBy = "";
  const sellerMax = FaCfg(FA.DiscGroup, FA.SellerMaxItem, 10), authMax = Math.max(sellerMax, FaCfg(FA.DiscGroup, FA.AuthMaxItem, 25));
  const authorizers = Logins(FaCfgInfo(FA.DiscGroup, FA.AuthMaxItem, "yuri")); const userIsAuth = IsAuthorizer(authorizers, ctx.session.login, ctx.session.email); const firstAuth = [...authorizers][0] || "";
  const cashPct = FaCfg(FA.PayGroup, FA.CashItem, 5), noIntMax = Math.max(1, Math.min(FA.MaxInstallments, Math.trunc(FaCfg(FA.PayGroup, FA.NoInterestItem, 18))));
  let closeValue = 0, generalExact = -1, lastProducts = null;
  const inp = (v, m) => h("input", { class: "input", value: v, inputmode: m || "text" }), sel = (o, s) => h("select", { class: "select" }, ...o.map((x) => h("option", { value: x, selected: x === s }, x)));
  const lbl = (t, c) => h("div", {}, h("label", { class: "lbl" }, t), c);

  // Cliente
  const cliName = h("div", { style: { fontWeight: "700", fontSize: "15px" } }, "Nenhum cliente escolhido");
  const cliInfo = h("div", { class: "sub", style: { color: "#6b7280" } }, "Obrigatório para a pré-venda: escolha o cliente na lista do myManager.");
  const cliBtn = h("button", { class: "btn primary small" }, "Escolher cliente");
  // Produtos
  const cat = sel(["Todos", ...cats.map((c) => c[0])], "Todos"), med = sel(["Todas", ...sizes.map((s) => s[0])], "Todas"), busca = inp(""), ord = sel(["Nome", "Menor preço", "Maior preço"], "Nome");
  const soEst = h("input", { type: "checkbox" }), buscar = h("button", { class: "btn dark block" }, "Consultar myManager"), info = h("div", { class: "sub", style: { color: "#6b7280", margin: "6px 0" } }, "");
  const prodList = h("div", { class: "list" }), qtd = inp("1", "decimal"), desc = inp("0", "decimal");
  // Itens / totais
  const itensList = h("div", { class: "list" });
  const totBig = h("div", { class: "v" }, "R$ 0,00"), totSub = h("div", { class: "s" }, "Adicione produtos para calcular");
  const sumBox = h("div", { class: "resumo" }, ""); const descGeral = inp("0", "decimal"), discInfo = h("div", { class: "sub" }, "");
  const rbs = ["À vista (" + g2(cashPct) + "% desc.)", "Cartão sem juros (até " + noIntMax + "x)", "Cartão com juros"].map((t, i) => { const r = h("input", { type: "radio", name: "fa-pag", checked: i === 0 }); return [r, h("label", { style: { display: "flex", gap: "8px", alignItems: "center", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "10px", marginTop: "6px" } }, r, h("span", {}, t))]; });
  const parcelas = sel(Array.from({ length: 18 }, (_, i) => i + 1 + "x"), "1x");
  const payInfo = h("div", { style: { fontWeight: "700", color: "#7f1d1d", marginTop: "8px" } }, ""), cond = h("div", { class: "resumo", style: { fontSize: "12px" } }, "");
  const fechar = inp("", "decimal"), aplicar = h("button", { class: "btn dark" }, "Aplicar"), liberar = h("button", { class: "btn", disabled: true }, "Liberar desconto"), save = h("button", { class: "btn green block", disabled: true }, "Salvar orçamento");
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Novo orçamento FA"), h("div", { class: "sub" }, "Criado hoje às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "  ·  vendedor " + String(ctx.session.nome || "").split(" ")[0]))),
    h("div", { class: "card" }, h("div", { class: "lbl" }, "Cliente do myManager"), cliName, cliInfo, h("div", { style: { marginTop: "8px" } }, cliBtn)),
    h("div", { class: "card", style: { marginTop: "10px" } }, h("div", { class: "lbl", style: { fontWeight: "700" } }, "Adicionar produto"),
      lbl("Buscar no nome (opcional)", busca), h("div", { class: "row2" }, lbl("Categoria", cat), lbl("Medida", med)), h("div", { class: "row2" }, lbl("Ordenar", ord), h("label", { style: { display: "flex", gap: "6px", alignItems: "center", marginTop: "26px" } }, soEst, "Só com estoque")),
      h("div", { style: { marginTop: "10px" } }, buscar), info, h("div", { class: "row2" }, lbl("Qtd", qtd), lbl("Desconto do item (%)", desc)), prodList),
    h("div", { class: "card", style: { marginTop: "10px" } }, h("div", { class: "lbl", style: { fontWeight: "700" } }, "Itens do orçamento"), itensList,
      h("div", { class: "btns", style: { marginTop: "8px", flexWrap: "wrap" } }, h("button", { class: "btn small", onclick: () => addService("Frete") }, "+ Frete"), h("button", { class: "btn small", onclick: () => addService("Montagem") }, "+ Montagem"), h("button", { class: "btn small primary", onclick: () => conjunto() }, "Completar conjunto")),
      lbl("Desconto geral (%)", descGeral), discInfo),
    h("div", { class: "kpi", style: { marginTop: "10px" } }, h("div", { class: "t" }, "Valor total"), totBig, totSub), sumBox,
    h("div", { class: "card", style: { marginTop: "10px" } }, h("div", { class: "lbl", style: { fontWeight: "700" } }, "Pagamento"), ...rbs.map((x) => x[1]), lbl("Parcelas", parcelas), payInfo,
      h("div", { class: "row2", style: { marginTop: "8px" } }, lbl("Valor para fechar (R$)", fechar), h("div", { style: { marginTop: "22px" } }, aplicar)), h("div", { class: "btns grid2", style: { marginTop: "10px" } }, liberar, save)),
    h("div", { class: "lbl", style: { marginTop: "10px" } }, "Condições de pagamento"), cond,
    h("div", { class: "sub", style: { color: "#6b7280", margin: "10px 0" } }, "Unidade ativa: " + ctx.unit.name + ". Preços, estoque e clientes lidos do myManager (somente consulta)."));

  const mode = () => (rbs[0][0].checked ? "AVISTA" : rbs[1][0].checked ? "CARTAO_SEM_JUROS" : "CARTAO_COM_JUROS");
  const nParc = () => parcelas.selectedIndex + 1;
  function buildPay(liq) {
    const p = { Liquid: liq, CashPct: cashPct, NoInterestMax: noIntMax, CashValue: CashValue(liq, cashPct), NoInterestInstallment: Installment(liq, noIntMax), InterestPct: 0, InterestTotal: 0 };
    p.MaxInterestTotal = WithInterest(liq, FaCfg(FA.PayGroup, FA.InterestItem(18), DefaultInterest(18))); p.MaxInterestInstallment = Installment(p.MaxInterestTotal, 18);
    const n = nParc(); p.Mode = mode();
    if (p.Mode === "AVISTA") { p.Installments = 1; p.Installment = p.CashValue; }
    else if (p.Mode === "CARTAO_SEM_JUROS") { p.Installments = Math.min(n, noIntMax); p.Installment = Installment(liq, p.Installments); }
    else { p.Installments = n; p.InterestPct = FaCfg(FA.PayGroup, FA.InterestItem(n), DefaultInterest(n)); p.InterestTotal = WithInterest(liq, p.InterestPct); p.Installment = Installment(p.InterestTotal, n); }
    const chosen = () => (p.Mode === "AVISTA" ? p.CashValue : p.Mode === "CARTAO_COM_JUROS" ? p.InterestTotal : p.Liquid);
    if (closeValue > 0 && Math.abs(chosen() - closeValue) <= 0.05) { if (p.Mode === "AVISTA") { p.CashValue = closeValue; p.Installment = closeValue; } else if (p.Mode === "CARTAO_SEM_JUROS") { p.Liquid = closeValue; p.Installment = Installment(closeValue, p.Installments); } else { p.InterestTotal = closeValue; p.Installment = Installment(closeValue, p.Installments); } }
    p.Chosen = chosen(); return p;
  }
  const chosenText = (p) => (p.Mode === "AVISTA" ? "À vista: " + C2(p.CashValue) : p.Mode === "CARTAO_SEM_JUROS" ? "Cartão sem juros: " + p.Installments + "x de " + C2(p.Installment) + " (total " + C2(p.Liquid) + ")" : "Cartão com juros: " + p.Installments + "x de " + C2(p.Installment) + " (total " + C2(p.InterestTotal) + ")");
  const toTag = (p) => "<SJ_FA_PAG>forma=" + p.Mode + ";parcelas=" + p.Installments + ";liquido=" + Dg(p.Liquid) + ";vista_pct=" + Dg(p.CashPct) + ";vista=" + Dg(p.CashValue) + ";sem_max=" + p.NoInterestMax + ";sem_parcela=" + Dg(p.NoInterestInstallment) + ";juros_pct=" + Dg(p.InterestPct) + ";total_juros=" + Dg(p.InterestTotal) + ";parcela=" + Dg(p.Installment) + ";juros12_parcela=" + Dg(p.MaxInterestInstallment) + ";juros12_total=" + Dg(p.MaxInterestTotal) + "</SJ_FA_PAG>";
  function condText(p) {
    let s = "À VISTA (" + g2(p.CashPct) + "% de desconto): " + C2(p.CashValue) + "\r\nCARTÃO SEM JUROS: até " + p.NoInterestMax + "x de " + C2(p.NoInterestInstallment) + " (total " + C2(p.Liquid) + ")\r\nCARTÃO COM JUROS:\r\n";
    for (let n = 1; n <= 18; n++) { const tj = WithInterest(p.Liquid, FaCfg(FA.PayGroup, FA.InterestItem(n), DefaultInterest(n))); s += "  " + n + "x de " + C2(Installment(tj, n)) + " (total " + C2(tj) + ")\r\n"; }
    return s.trimEnd();
  }
  const geral = () => (generalExact >= 0 ? generalExact : Math.max(0, Math.min(100, N(descGeral.value))));
  const resetClose = () => { if (closeValue > 0 || generalExact >= 0) { closeValue = 0; generalExact = -1; fechar.value = ""; } };
  const check = (t) => CheckDiscount(t.DiscountPct, sellerMax, authMax, userIsAuth, authorizedPct);
  function refresh() {
    itensList.innerHTML = "";
    lines.forEach((l, i) => itensList.append(h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, (l.Kind === "B" ? "BRINDE: " : l.Kind === "S" ? "SERVIÇO: " : "") + l.Name), h("span", {}, n2(lineTotal(l)))),
      h("div", { class: "l2" }, l.Kind === "S" ? "" : (l.Code ? "Cód. " + l.Code + " · " : "") + "Qtd " + g2(l.Qty) + " × " + n2(l.Unit) + (l.Kind === "P" ? " · Desc. " + g2(l.DiscPct) + "%" : "")),
      h("div", { style: { marginTop: "6px" } }, h("button", { class: "btn small danger", onclick: () => { lines.splice(i, 1); resetClose(); refresh(); } }, "Remover item")))));
    if (!lines.length) itensList.append(h("div", { class: "empty" }, "Nenhum item."));
    const t = Compute(lines, geral()), ck = check(t);
    discInfo.textContent = "Desconto: " + g2(t.DiscountPct) + "% (vendedor até " + g2(sellerMax) + "%; com liberação até " + g2(authMax) + "%)"; discInfo.style.color = ck === "OK" ? "#6b7280" : "#be1e1e";
    liberar.disabled = ck !== "NEEDS";
    const lib = Math.max(sellerMax, authorizedPct);
    sumBox.textContent = "Subtotal dos produtos: " + (lines.length ? C2(t.ProductsGross) : "—") + "\nDesconto (" + g2(t.DiscountPct) + "%): " + (t.DiscountValue > 0 ? "– " + C2(t.DiscountValue) : "—") + "\nFrete e montagem: " + (t.Services > 0 ? C2(t.Services) : "—") + "\nBrindes (cortesia): " + (t.GiftsValue > 0 ? C2(t.GiftsValue) : "—") + "\n\nDesconto usado: " + g2(t.DiscountPct) + "% de " + g2(lib) + "% liberados para " + String(ctx.session.nome || "").split(" ")[0] + (t.DiscountPct > lib ? "  (precisa liberar, até " + g2(authMax) + "%)" : "");
    if (!lines.length) { totBig.textContent = "R$ 0,00"; totSub.textContent = "Adicione produtos para calcular"; cond.textContent = ""; payInfo.textContent = ""; save.disabled = true; return; }
    const p = buildPay(t.Liquid); cond.textContent = condText(p);
    payInfo.textContent = chosenText(p) + (rbs[1][0].checked && nParc() > noIntMax ? "  (sem juros vai até " + noIntMax + "x)" : "");
    totBig.textContent = C2(p.Chosen); totSub.textContent = lines.length + " item(ns) • " + (p.Mode === "AVISTA" ? "à vista" : p.Installments + "x de " + C2(p.Installment));
    save.disabled = false;
  }
  async function pickClient() {
    const c = await pickMyManagerCustomer(clienteNome); if (!c) return false;
    clienteId = c.Id; clienteNome = c.Nome; cliName.textContent = clienteNome; cliBtn.textContent = "Trocar cliente";
    cliInfo.textContent = "Cód. MyManager " + clienteId + (c.CpfCnpj ? " • " + c.CpfCnpj : "") + (c.Telefone ? " • " + c.Telefone : "") + " — vinculado para a pré-venda."; cliInfo.style.color = "#25844b"; return true;
  }
  async function authorize(pct) {
    return modal("Liberar desconto", ({ body, foot, close }) => {
      const u = inp(firstAuth), pw = h("input", { class: "input", type: "password" }), err = h("div", { style: { color: "#b91c1c", marginTop: "6px" } }, "");
      body.append(h("p", { style: { whiteSpace: "pre-line" } }, "Desconto de " + g2(pct) + "% passa do limite do vendedor (" + g2(sellerMax) + "%).\nQuem libera (até " + g2(authMax) + "%) digita usuário e senha."), lbl("Usuário", u), lbl("Senha", pw), err);
      const ok = h("button", { class: "btn primary" }, "LIBERAR");
      ok.onclick = async () => {
        ok.disabled = true; err.textContent = "";
        try {
          const login = u.value.trim(); if (!login || !pw.value) throw new Error("Informe o usuário e a senha de quem libera o desconto.");
          const email = login.includes("@") ? login : await api.resolveLoginEmail(login); if (!email) throw new Error("Usuário não encontrado no cadastro central.");
          const p = await api.signIn(email, pw.value);
          if (!IsAuthorizer(authorizers, p.login, p.email)) throw new Error("O usuário " + p.login + " não pode liberar desconto. Quem libera fica em Valores e Produtos, grupo " + FA.DiscGroup + ", item \"" + FA.AuthMaxItem + "\", coluna Info.");
          authorizedPct = pct; authorizedBy = (p.nome || p.login) + " (" + p.login + ")";
          ctx.audit("LIBERAR_DESCONTO", "ORCAMENTO_FA", clienteNome || "SEM CLIENTE", "Desconto de " + g2(pct) + "% liberado por " + authorizedBy + " para " + ctx.session.nome);
          refresh(); close(true);
        } catch (e) { err.textContent = friendly(e); pw.value = ""; ok.disabled = false; }
      };
      foot.append(h("button", { class: "btn", onclick: () => close(false) }, "CANCELAR"), ok);
    });
  }
  function buildResumo(t, p) {
    let s = "FA Colchões\r\nCLIENTE MYMANAGER: " + clienteNome + " (Cód. " + clienteId + ")\r\n";
    for (const l of lines) s += LineText(l) + "\r\n";
    s += "SUBTOTAL PRODUTOS: " + C2(t.ProductsGross) + "\r\n";
    if (t.GeneralPct > 0) s += "DESCONTO GERAL: " + g4(t.GeneralPct) + "% (" + C2(t.GeneralValue) + ")\r\n";
    if (closeValue > 0) s += "VALOR PARA FECHAR: " + C2(closeValue) + "\r\n";
    if (t.DiscountValue > 0) s += "DESCONTO TOTAL CONCEDIDO: " + g2(t.DiscountPct) + "% (" + C2(t.DiscountValue) + ")\r\n";
    if (t.DiscountPct > sellerMax) s += "DESCONTO LIBERADO POR: " + (userIsAuth ? ctx.session.nome + " (" + ctx.session.login + ")" : authorizedBy) + "\r\n";
    if (t.GiftsValue > 0) s += "BRINDES: " + C2(t.GiftsValue) + " (sem custo para o cliente)\r\n";
    if (t.Services > 0) s += "SERVIÇOS: " + C2(t.Services) + "\r\n";
    s += "VALOR DOS PRODUTOS E SERVIÇOS: " + C2(t.Liquid) + "\r\nCONDIÇÕES DE PAGAMENTO:\r\n" + condText(p) + "\r\nFORMA ESCOLHIDA: " + chosenText(p) + "\r\nTOTAL: " + C2(p.Chosen) + "\r\n" + toTag(p);
    return s;
  }
  function applyView() {
    if (!lastProducts) return;
    let rows = lastProducts.slice(); if (soEst.checked) rows = rows.filter((r) => r.EstoqueN != null && r.EstoqueN > 0);
    rows.sort(ord.selectedIndex === 1 ? (a, b) => a.Preco - b.Preco : ord.selectedIndex === 2 ? (a, b) => b.Preco - a.Preco : (a, b) => a.Produto.localeCompare(b.Produto, "pt-BR"));
    prodList.innerHTML = "";
    for (const r of rows.slice(0, 200)) {
      const tem = r.EstoqueN != null && r.EstoqueN > 0;
      const tag = r.Estoque === "" ? null : h("span", { style: { fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px", background: tem ? "#dcfce7" : "#fee2e2", color: tem ? "#15803d" : "#b91c1c" } }, tem ? g2(r.EstoqueN) + " un." : "sem estoque");
      prodList.append(h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, r.Produto), h("span", {}, n2(r.Preco))), h("div", { class: "l2" }, h("span", {}, "Cód. " + r.Codigo + (r.Unid ? " · " + r.Unid : "")), tag),
        h("div", { class: "btns", style: { marginTop: "6px" } }, h("button", { class: "btn small green", onclick: () => addProduct(r, "P") }, "Adicionar"), h("button", { class: "btn small", onclick: () => addProduct(r, "B") }, "+ Brinde"))));
    }
  }
  async function consultar() {
    buscar.disabled = true; info.textContent = "Consultando...";
    try {
      const selCats = cat.value === "Todos" ? cats.map((c) => c[1]) : cats.filter((c) => c[0] === cat.value).map((c) => c[1]);
      const sizeTerms = med.selectedIndex > 0 ? sizes[med.selectedIndex - 1][1] : null;
      const dt = await SearchProducts(selCats, sizeTerms, busca.value, 500);
      for (const r of dt) { const s = String(r.Estoque); const v = s.length ? Number(s.replace(/\./g, "").replace(",", ".")) : NaN; r.EstoqueN = s.length && isFinite(v) ? v : null; }
      lastProducts = dt; applyView();
      const stock = PickStock(mymProductColumns); soEst.disabled = stock == null;
      info.textContent = dt.length + " produto(s)" + (med.selectedIndex > 0 ? " " + med.value : "") + (dt.length >= 500 ? " (mostrando os 500 primeiros; refine a busca)" : "") + "." + " Preço: " + (PickPrice(mymProductColumns) ?? "NÃO IDENTIFICADO") + " | Estoque: " + (stock ?? "não identificado (envie a lista de \"Ver colunas\")") + ".";
    } catch (e) { info.textContent = ""; alertBox(friendly(e), "FA Colchões — MyManager"); }
    finally { buscar.disabled = false; }
  }
  async function addProduct(r, kind) {
    const q = Math.max(0, N(qtd.value)); if (q <= 0) return alertBox("Informe a quantidade.", "FA Colchões");
    if (r.EstoqueN != null && r.Estoque !== "" && q > r.EstoqueN && !(await confirmBox("Estoque no MyManager: " + g2(r.EstoqueN) + ". Quantidade pedida: " + g2(q) + ".\nAdicionar mesmo assim?", "FA Colchões — estoque"))) return;
    const l = { Kind: kind, Code: r.Codigo, Name: r.Produto, Qty: q, Unit: r.Preco, Stock: r.Estoque, DiscPct: 0 };
    if (kind === "P") { if (l.Unit <= 0 && !(await confirmBox("Este produto está sem preço no MyManager. Adicionar mesmo assim?", "FA Colchões"))) return; l.DiscPct = Math.max(0, Math.min(100, N(desc.value))); }
    lines.push(l); resetClose(); refresh();
  }
  async function addService(name) {
    const def = FaCfg(FA.ServiceGroup, name, 0);
    const v = await modal(name, ({ body, foot, close }) => { const t = inp(n2(def), "decimal"); body.append(lbl("Valor " + (name === "Frete" ? "do frete" : "da montagem") + " (R$)", t)); foot.append(h("button", { class: "btn", onclick: () => close(null) }, "CANCELAR"), h("button", { class: "btn primary", onclick: () => close(Math.max(0, N(t.value))) }, "ADICIONAR")); setTimeout(() => t.select(), 50); });
    if (v != null && v > 0) { lines.push({ Kind: "S", Name: name, Unit: v, Qty: 1, DiscPct: 0, Code: "" }); resetClose(); refresh(); }
  }
  function conjunto() {
    let base = null; for (let i = lines.length - 1; i >= 0; i--) if (lines[i].Kind === "P") { base = lines[i]; break; }
    if (!base) return alertBox("Adicione primeiro o colchão; depois o sistema procura o box e a cabeceira da mesma medida.", "Completar conjunto");
    const size = DetectSize(base.Name, sizes);
    if (!size) return alertBox("Não identifiquei a medida no nome \"" + base.Name + "\".\nEscolha a medida no filtro ou ajuste os termos em Valores e Produtos, grupo " + FA.SizeGroup + ".", "Completar conjunto");
    let hasBox = false, hasCab = false;
    for (const l of lines) { if (l.Kind !== "P" || DetectSize(l.Name, sizes) !== size) continue; const n = norm(l.Name); if (n.includes("CABECEIRA")) hasCab = true; else if (n.includes("BOX") || n.includes("BASE")) hasBox = true; }
    const want = !hasBox ? "BOX" : !hasCab ? "CABECEIRA" : "BOX";
    const opt = [...cat.options].find((o) => norm(o.value).includes(want)); if (opt) { cat.value = opt.value; busca.value = ""; } else { cat.selectedIndex = 0; busca.value = want; }
    med.value = size; consultar().then(() => { info.textContent = (want === "BOX" ? "Box" : "Cabeceira") + " " + size + " para completar o conjunto. " + info.textContent; });
  }
  cliBtn.onclick = pickClient; buscar.onclick = consultar; busca.addEventListener("keydown", (e) => { if (e.key === "Enter") consultar(); });
  ord.addEventListener("change", applyView); soEst.addEventListener("change", applyView);
  const changed = () => { resetClose(); if (lines.length) refresh(); };
  descGeral.addEventListener("input", changed); for (const [r] of rbs) r.addEventListener("change", changed); parcelas.addEventListener("change", changed);
  aplicar.onclick = () => {
    if (!lines.length) return alertBox("Adicione os produtos primeiro.", "Valor para fechar");
    const target = Math.round(Math.max(0, N(fechar.value)) * 100) / 100; if (target <= 0) return alertBox("Digite o valor para fechar a venda.", "Valor para fechar");
    closeValue = 0; generalExact = -1;
    const t0 = Compute(lines, 0), n = nParc(), m = mode();
    const factor = m === "AVISTA" ? 1 - cashPct / 100 : m === "CARTAO_SEM_JUROS" ? 1 : 1 + FaCfg(FA.PayGroup, FA.InterestItem(n), DefaultInterest(n)) / 100;
    const g = GeneralPctForTarget(t0.ProductsNet, t0.Services, factor, target), sem = buildPay(t0.Liquid);
    if (g < 0) return alertBox("O valor para fechar é maior que o valor sem desconto geral nesta forma de pagamento (" + C2(sem.Chosen) + ").", "Valor para fechar");
    if (g >= 100) return alertBox("O valor para fechar não cobre nem o frete e a montagem.", "Valor para fechar");
    generalExact = g; closeValue = target; descGeral.value = g2(g); refresh();
    const t = Compute(lines, geral()), ck = check(t);
    if (ck === "ABOVE") alertBox("Para fechar em " + C2(target) + " o desconto fica em " + g2(t.DiscountPct) + "%, acima do máximo permitido (" + g2(authMax) + "%).", "Valor para fechar");
    else if (ck === "NEEDS") alertBox("Para fechar em " + C2(target) + " o desconto fica em " + g2(t.DiscountPct) + "%. Precisa de liberação (botão LIBERAR DESCONTO ou ao salvar).", "Valor para fechar");
  };
  fechar.addEventListener("keydown", (e) => { if (e.key === "Enter") aplicar.onclick(); });
  liberar.onclick = () => { const t = Compute(lines, geral()); if (check(t) === "NEEDS") authorize(t.DiscountPct); };
  save.onclick = async () => {
    if (!lines.length) return;
    if (clienteId <= 0 && !(await pickClient())) return alertBox("Para salvar, escolha o cliente na lista do MyManager.", "FA Colchões");
    const t = Compute(lines, geral()), p = buildPay(t.Liquid);
    if (p.Chosen <= 0) return alertBox("O valor do orçamento precisa ser maior que zero.", "FA Colchões");
    const ck = check(t);
    if (ck === "ABOVE") return alertBox("O desconto de " + g2(t.DiscountPct) + "% passa do máximo permitido (" + g2(authMax) + "%).", "FA Colchões");
    if (ck === "NEEDS" && !(await authorize(t.DiscountPct))) return;
    const pend = { Cliente: clienteNome || "SEM CLIENTE", Tipo: "FA Colchões", Vendedor: ctx.session.nome, Resumo: buildResumo(t, p), Valor: p.Chosen, MyManagerClienteId: clienteId };
    savePending(pend, null, save, { valorFechado: p.Chosen });
  };
  refresh();
});

// ---------- Painel FA ----------
register("fa/painel", (el) => {
  const per = h("select", { class: "select" }, ...["Este mês", "Mês anterior", "Últimos 90 dias", "Este ano"].map((o) => h("option", { value: o }, o)));
  const upd = h("button", { class: "btn dark" }, "ATUALIZAR");
  const card = (cap) => { const v = h("div", { class: "v" }, "—"), n = h("div", { class: "s" }, ""); return [h("div", { class: "kpi" }, h("div", { class: "t" }, cap.toUpperCase()), v, n), v, n]; };
  const cOrc = card("Orçamentos"), cFech = card("Fechados"), cConv = card("Conversão"), cTick = card("Ticket médio");
  const mix = h("div", { class: "sub", style: { color: "#6b7280", margin: "10px 0" } }, ""), top = h("div", { class: "list" }), vend = h("div", { class: "list" });
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Painel FA Colchões"))), h("div", { class: "card" }, h("label", { class: "lbl" }, "Período"), per, h("div", { style: { marginTop: "8px" } }, upd)),
    h("div", { class: "kpis", style: { marginTop: "10px" } }, cOrc[0], cFech[0], cConv[0], cTick[0]), mix,
    h("div", { class: "lbl", style: { fontWeight: "700" } }, "Produtos mais vendidos"), top, h("div", { class: "lbl", style: { fontWeight: "700", marginTop: "12px" } }, "Vendedores"), vend);
  async function load() {
    upd.disabled = true;
    try {
      const td = new Date(); td.setHours(0, 0, 0, 0); let from, to = new Date(td); to.setDate(to.getDate() + 1);
      if (per.selectedIndex === 1) { from = new Date(td.getFullYear(), td.getMonth() - 1, 1); to = new Date(td.getFullYear(), td.getMonth(), 1); }
      else if (per.selectedIndex === 2) { from = new Date(td); from.setDate(from.getDate() - 90); }
      else if (per.selectedIndex === 3) from = new Date(td.getFullYear(), 0, 1); else from = new Date(td.getFullYear(), td.getMonth(), 1);
      const dt = await api.fetchQuotes("", "TODOS", ctx.unit);
      let n = 0, closed = 0, lost = 0, cash = 0, noInt = 0, withInt = 0, discN = 0, sum = 0, closedSum = 0, discSum = 0; const prods = new Map(), sellers = new Map();
      for (const r of dt) {
        const d = r.DataHora ? new Date(r.DataHora) : null; if (!d || isNaN(d) || d < from || d >= to) continue;
        const v = Number(r.Valor || 0), oc = Outcome(r.Status), isC = oc === "FECHADO"; n++; sum += v; if (isC) { closed++; closedSum += v; } else if (oc === "PERDIDO") lost++;
        const pay = ParsePayment(r.Resumo); if (pay) { if (pay.Mode === "AVISTA") cash++; else if (pay.Mode === "CARTAO_SEM_JUROS") noInt++; else withInt++; }
        const md = /DESCONTO TOTAL CONCEDIDO: ([\d\.,]+)%/.exec(r.Resumo || ""); if (md) { discSum += brNum(md[1]); discN++; }
        for (const l of ParseLines(r.Resumo)) { if (l.Kind !== "P") continue; const k = l.Code || l.Name; let a = prods.get(k); if (!a) { a = { name: l.Name, q: 0, qc: 0, vc: 0 }; prods.set(k, a); } a.q += l.Qty; if (isC) { a.qc += l.Qty; a.vc += lineTotal(l); } }
        const s = (r.Vendedor || "").trim() || "—"; let b = sellers.get(s); if (!b) { b = [0, 0, 0]; sellers.set(s, b); } b[0]++; if (isC) { b[1]++; b[2] += v; }
      }
      cOrc[1].textContent = String(n); cOrc[2].textContent = C2(sum);
      cFech[1].textContent = String(closed); cFech[2].textContent = C2(closedSum) + (lost > 0 ? " • " + lost + " perdido(s)" : "");
      cConv[1].textContent = n === 0 ? "—" : (Math.round((closed * 1000) / n) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%"; cConv[2].textContent = closed + " de " + n + " orçamento(s)";
      cTick[1].textContent = closed === 0 ? "—" : C2(closedSum / closed); cTick[2].textContent = discN === 0 ? "" : "Desconto médio: " + (discSum / discN).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
      const end = new Date(to); end.setDate(end.getDate() - 1);
      mix.textContent = "Forma de pagamento escolhida: à vista " + cash + " • cartão sem juros " + noInt + " • cartão com juros " + withInt + ".  Período: " + fmtDate(from) + " a " + fmtDate(end) + ".";
      top.innerHTML = ""; const tp = [...prods.entries()].sort((a, b) => b[1].qc - a[1].qc || b[1].q - a[1].q);
      if (!tp.length) top.append(h("div", { class: "empty" }, "Nenhum produto no período."));
      for (const [k, a] of tp) top.append(h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, a.name), h("span", {}, n2(a.vc))), h("div", { class: "l2" }, "Cód. " + k + " · fechada " + g2(a.qc) + " · orçada " + g2(a.q))));
      vend.innerHTML = ""; const tv = [...sellers.entries()].sort((a, b) => b[1][2] - a[1][2]);
      if (!tv.length) vend.append(h("div", { class: "empty" }, "Nenhum orçamento no período."));
      for (const [s, b] of tv) vend.append(h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, s), h("span", {}, n2(b[2]))), h("div", { class: "l2" }, b[0] + " orçamento(s) · " + b[1] + " fechado(s)")));
    } catch (e) { alertBox("Não foi possível montar o painel.\n\n" + friendly(e), "Painel FA"); }
    finally { upd.disabled = false; }
  }
  upd.onclick = load; per.addEventListener("change", load); load();
});
