// Orçamentos da São João Personalizados: Impressão e Laser CO² (PersonalizadosOrcamentosTecnicos.cs),
// Laser - Gravação e Bordado (PersonalizadosNovosOrcamentos.cs). As tabelas Personalizados_*.csv ficam no
// computador da loja; a ponte da loja copia cada uma para a nuvem (conjunto "pers_tabela:<arquivo>").
import { ctx, register } from "../app.js";
import { h, alertBox, friendly, money } from "../ui.js";
import { savePending } from "./orcamentos.js";
import { lerEspelho } from "./mymanager.js";

const C2 = money;
const f4 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const f3 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const f2 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const f8 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
const fix2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

// NumeroDigitado.Ler
export function Ler(texto) {
  let s = String(texto ?? "").replace(/R\$/g, "").replace(/%/g, "").replace(/[\s ]/g, "").trim();
  if (!s) return 0;
  const vg = s.lastIndexOf(","), pt = s.lastIndexOf(".");
  if (vg >= 0 && pt >= 0) s = vg > pt ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (vg >= 0) { if (s.indexOf(",") !== vg) { s = s.replace(/,/g, ""); } else s = s.replace(",", "."); }
  else if (pt >= 0 && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return 0;
  return Number(s);
}
// PN: CSVs técnicos gravados com ponto decimal
function PN(s) {
  const raw = String(s ?? "").trim();
  if (raw.includes(".") && !raw.includes(",") && isFinite(Number(raw))) return Number(raw);
  const v = Ler(raw); return isFinite(v) ? v : 0;
}
const Up1 = (v) => Math.ceil(v * 10 - 1e-9) / 10;
const find = (rows, key) => rows.find((r) => r.length && String(r[0] ?? "").trim().toLowerCase() === String(key ?? "").trim().toLowerCase()) || null;
async function tabela(arquivo) {
  const e = await lerEspelho("pers_tabela:" + arquivo, ctx.unit);
  if (!e) return null;
  return e.rows.map((r) => (Array.isArray(r) ? r.map((x) => String(x ?? "")) : Object.values(r).map((x) => String(x ?? "")))).filter((f) => f.length > 1 && !/^(Material|Produto|Grupo)$/i.test(f[0]));
}
async function servicePrice(grupo, item, fallback) {
  const rows = await tabela("Personalizados_Servicos.csv"); if (!rows) return fallback;
  for (const f of rows) if (f.length >= 3 && f[0].trim().toLowerCase() === grupo.toLowerCase() && f[1].trim().toLowerCase() === item.toLowerCase()) { const v = PN(f[2]); if (v >= 0) return v; }
  return fallback;
}
const aviso = (nome) => alertBox("A tabela \"" + nome + "\" fica no computador da loja (Configurações > Valores / Produtos da Personalizados).\n\nAssim que o computador da loja copiar as tabelas para a nuvem, este orçamento calcula aqui igual ao computador.", "Tabela da Personalizados");

// ---------- peças de tela ----------
function form(el, title, info) {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, title), h("div", { class: "sub" }, "São João Personalizados"))));
  const card = h("div", { class: "card" }, info ? h("div", { class: "sub", style: { marginBottom: "8px", color: "#6b7280" } }, info) : null); el.append(card);
  let grid = null;
  const put = (label, inp, half) => { const cell = h("div", {}, h("label", { class: "lbl" }, label), inp); if (half) { if (!grid) { grid = h("div", { class: "row2" }); card.append(grid); } grid.append(cell); } else { grid = null; card.append(cell); } return inp; };
  return {
    card,
    T: (label, value = "", half, mode) => put(label, h("input", { class: "input", value, inputmode: mode || "text" }), half),
    N: (label, value = "", half) => put(label, h("input", { class: "input", value, inputmode: "decimal" }), half),
    RO: (label, half) => put(label, h("input", { class: "input", readOnly: true, style: { background: "#f5f7fa" } }), half),
    CB: (label, opts, sel, half) => put(label, h("select", { class: "select" }, ...opts.map((o) => h("option", { value: o, selected: o === sel }, o))), half),
    TA: (label) => put(label, h("textarea", { class: "input", rows: 2 })),
    note: (t) => { grid = null; card.append(h("div", { class: "sub", style: { color: "#6b7280", fontSize: "12px" } }, t)); },
  };
}
function actions(el, labels) {
  const btns = labels.map(([t, cls]) => h("button", { class: "btn " + (cls || "") }, t));
  el.append(h("div", { class: "btns grid2", style: { margin: "12px 0" } }, ...btns)); return btns;
}

// ---------- Orçamento Impressão ----------
register("orc/impressao", async (el) => {
  const mats = (await tabela("Personalizados_Impressao_Materiais.csv")) || [], prods = (await tabela("Personalizados_Impressao_Produtos.csv")) || [];
  const F = form(el, "Orçamento Impressão", "Campos e fórmulas reproduzidos da aba ORÇAMENTOS da planilha Orçamento Impressão.");
  const pn = prods.map((r) => r[0]); const produto = F.CB("Tipo Produto", pn, pn.includes("Impressão") ? "Impressão" : pn[0]);
  const desc = F.T("Descrição"), cliente = F.T("Cliente"); const mat = F.CB("Tipo Material", mats.map((r) => r[0]), mats[0]?.[0]);
  const larg = F.N("Largura Impressão (ml)", "", true), comp = F.N("Comprimento Impressão (ml)", "", true);
  const areaImp = F.RO("Impressão Cliente (m²)", true), areaMat = F.RO("Área Material (m²)", true);
  const pass = F.CB("Quantidade de Passadas", ["2", "4", "6"], "4", true), pct = F.N("Porcentagem Impressão", "1", true);
  F.note("Use 1,00 = 100% | 0,50 = 50%");
  const arte = F.N("Arte (R$)", "0", true), fora = F.N("Serviço fora (R$)", "0", true);
  const cf = F.RO("Consumidor Final", true), rv = F.RO("Revenda", true);
  const valorCob = F.N("VALOR COBRADO", "", true), matInfo = F.RO("Material: largura / compra", true);
  const [calc, useCf, useRv, save] = actions(el, [["CALCULAR", "dark"], ["USAR CONSUMIDOR FINAL", "primary"], ["USAR REVENDA", "primary"], ["SALVAR ORÇAMENTO", "green"]]); save.disabled = true;
  const G2 = form(el, "", null); el.lastChild.previousSibling.remove();
  const valorCalc = G2.RO("VALOR CALCULADO"), acrRs = G2.RO("ACRÉSCIMO (R$)", true), acrPct = G2.RO("ACRÉSCIMO (%)", true);
  const par1 = h("div", { class: "resumo", style: { marginTop: "10px" } }, ""), res = h("div", { class: "resumo", style: { marginTop: "10px" } }, "");
  el.append(h("div", { class: "lbl", style: { marginTop: "10px" } }, "Conferência dos parâmetros usados pela planilha"), par1, res);
  let pending = null;
  const refreshMaterial = () => { const mr = find(mats, mat.value); if (!mr) { matInfo.value = ""; return; } matInfo.value = f3(mr.length > 1 ? PN(mr[1]) : 0) + " m | " + C2(mr.length > 4 ? PN(mr[4]) : 0); };
  mat.addEventListener("change", refreshMaterial); refreshMaterial();
  function doCalc() {
    try {
      if (!mats.length || !prods.length) { pending = null; save.disabled = true; aviso(!mats.length ? "Impressão - Materiais" : "Impressão - Produtos"); return; }
      const wi = Ler(larg.value), le = Ler(comp.value), pc = Ler(pct.value), ar = Ler(arte.value), fo = Ler(fora.value);
      if (wi <= 0 || le <= 0) throw new Error("Informe Largura Impressão e Comprimento Impressão.");
      if (pc < 0 || pc > 1) throw new Error("Porcentagem de Impressão deve ficar entre 0 e 1. Ex.: 1 = 100%, 0,5 = 50%.");
      const mr = find(mats, mat.value), pr = find(prods, produto.value);
      if (!mr) throw new Error("Material não encontrado no Cadastro Material da planilha.");
      if (!pr) throw new Error("Tipo Produto não encontrado no Cadastro Produtos da planilha.");
      const ml = mr.length > 1 ? PN(mr[1]) : 0, q = mr.length > 4 ? PN(mr[4]) : 0;
      if (ml <= 0 || q <= 0) throw new Error("O material selecionado não possui largura/valor de compra válido na planilha.");
      const pa = Number(pass.value), off = pa === 2 ? 1 : pa === 4 ? 4 : 7;
      const uso = pr.length > off ? PN(pr[off]) : 0, tempo = pr.length > off + 1 ? PN(pr[off + 1]) : 0, tinta = pr.length > off + 2 ? PN(pr[off + 2]) : 0;
      const ai = wi * le, am = ml * (le + 0.3), basev = am * q + uso + ai * q * tempo + tinta * ai * pc + ar + fo;
      const cfinal = Up1(basev * 1.6), revenda = Up1(basev * 1.1);
      areaImp.value = f4(ai); areaMat.value = f4(am); cf.value = C2(cfinal); rv.value = C2(revenda);
      if (Ler(valorCob.value) <= 0) valorCob.value = fix2(cfinal);
      const atual = Ler(valorCob.value), acres = atual - cfinal;
      valorCalc.value = C2(cfinal); acrRs.value = C2(acres); acrPct.value = f2(cfinal > 0 ? (acres / cfinal) * 100 : 0) + "%";
      par1.textContent = "Produto: " + produto.value + " | Passadas: " + pa + "\r\nMaterial: largura=" + f3(ml) + " m | Valor compra=" + C2(q) + "\r\nUso máquina=" + f4(uso) + " | Tempo operação=" + f4(tempo) + " | Tinta/m²=" + C2(tinta);
      res.textContent = "ORÇAMENTO IMPRESSÃO — CONFERÊNCIA PLANILHA\r\n\r\nTipo Produto: " + produto.value + "\r\nDescrição: " + desc.value + "\r\nCliente: " + cliente.value + "\r\nTipo Material: " + mat.value + "\r\n" +
        "Largura Impressão: " + f4(wi) + " ml\r\nComprimento Impressão: " + f4(le) + " ml\r\nImpressão Cliente: " + f4(ai) + " m²  [Largura x Comprimento]\r\nÁrea Material: " + f4(am) + " m²  [Largura material x (Comprimento + 0,30)]\r\n" +
        "Passadas: " + pa + " | Porcentagem impressão: " + f4(pc) + "\r\nArte: " + C2(ar) + " | Serviço fora: " + C2(fo) + "\r\n\r\nBase antes do multiplicador: " + C2(basev) + "\r\nCONSUMIDOR FINAL (x1,60 / ROUNDUP 1 casa): " + C2(cfinal) + "\r\nREVENDA (x1,10 / ROUNDUP 1 casa): " + C2(revenda) + "\r\nVALOR COBRADO: " + C2(Ler(valorCob.value));
      let final = Ler(valorCob.value); if (final <= 0) final = cfinal;
      pending = { Cliente: cliente.value.trim() || "SEM CLIENTE", Tipo: "PERSONALIZADOS - IMPRESSÃO", Vendedor: ctx.session.nome, Resumo: res.textContent + "\r\n\r\nParâmetros: " + par1.textContent, Valor: final }; save.disabled = false;
    } catch (e) { pending = null; save.disabled = true; alertBox(friendly(e), "Orçamento Impressão"); }
  }
  valorCob.addEventListener("input", () => { const b = Ler(cf.value), vf = Ler(valorCob.value); if (b > 0) { const ac = vf - b; valorCalc.value = C2(b); acrRs.value = C2(ac); acrPct.value = f2((ac / b) * 100) + "%"; } });
  calc.onclick = () => { valorCob.value = ""; doCalc(); };
  useCf.onclick = () => { if (cf.value.trim()) { valorCob.value = fix2(Ler(cf.value)); doCalc(); } };
  useRv.onclick = () => { if (rv.value.trim()) { valorCob.value = fix2(Ler(rv.value)); doCalc(); } };
  save.onclick = () => { doCalc(); if (!save.disabled && pending) savePending(pending, res, save); };
});

// ---------- Orçamento Laser CO² ----------
register("orc/laser", async (el) => {
  const mats = (await tabela("Personalizados_Laser_Materiais.csv")) || [], prods = (await tabela("Personalizados_Laser_Produtos.csv")) || [];
  const F = form(el, "Orçamento Laser CO²", "Campos e fórmulas reproduzidos das abas ORÇAMENTOS, CADASTROS e CÁLCULO ÁREA da planilha Laser CO².");
  const prod = F.CB("Tipo Produto", prods.map((r) => r[0]), prods[0]?.[0]); const desc = F.T("Descrição"), cliente = F.T("Cliente");
  const mat = F.CB("Tipo Material", mats.map((r) => r[0]), mats[0]?.[0]);
  const dimensao = F.T("Dimensão (cm)", "", true), area = F.N("Qtde Material (m²)", "", true), tempoLaser = F.N("Tempo Laser CO² (min)", "", true), classe = F.RO("Classificação Produto", true);
  const vmVenda = F.RO("Valor Venda (R$/m²)", true), vmCompra = F.RO("Valor Compra (R$/m²)", true), cf = F.RO("Consumidor Final", true), rv = F.RO("Revenda", true);
  const valorCob = F.N("VALOR COBRADO");
  const [calc, useCf, useRv, save] = actions(el, [["CALCULAR", "dark"], ["USAR CONSUMIDOR FINAL", "primary"], ["USAR REVENDA", "primary"], ["SALVAR ORÇAMENTO", "green"]]); save.disabled = true;
  const G2 = form(el, "", null); el.lastChild.previousSibling.remove();
  const valorCalc = G2.RO("VALOR CALCULADO"), acrRs = G2.RO("ACRÉSCIMO (R$)", true), acrPct = G2.RO("ACRÉSCIMO (%)", true);
  const par1 = h("div", { class: "resumo", style: { marginTop: "6px" } }, "");
  el.append(h("div", { class: "lbl", style: { marginTop: "10px" } }, "Parâmetros automáticos da classificação e Tipo Produto"), par1);
  const A = form(el, "", "Cálculo de Área — caixas (igual à aba Calculo Area)"); el.lastChild.previousSibling.remove();
  const bw = A.N("Caixa Largura (m)", "0,17", true), bl = A.N("Caixa Comprimento", "0,17", true), bh = A.N("Caixa Altura", "0,05", true), lw = A.N("Tampa Largura (m)", "0,18", true), ll = A.N("Tampa Comprimento", "0,18", true), lh = A.N("Tampa Altura", "0,20", true), qw = A.N("Qnd Largura", "0", true), ql = A.N("Qnd Comprimento", "0", true), areaCalc = A.RO("Área (m²)");
  const [calcArea, useArea] = actions(el, [["CALCULAR ÁREA", "dark"], ["USAR NO ORÇAMENTO", "green"]]);
  const res = h("div", { class: "resumo", style: { marginTop: "10px" } }, ""); el.append(res);
  let pending = null;
  const offOf = (cl) => (cl.toLowerCase() === "especial" ? 6 : cl.toLowerCase() === "premium" ? 11 : 1);
  const refreshMaterial = () => { const mr = find(mats, mat.value); if (!mr) { classe.value = vmVenda.value = vmCompra.value = ""; return; } classe.value = mr.length > 5 ? mr[5] : ""; vmCompra.value = C2(mr.length > 3 ? PN(mr[3]) : 0); vmVenda.value = C2(mr.length > 4 ? PN(mr[4]) : 0); };
  const params = (mr, pr) => { const cl = mr.length > 5 ? mr[5] : "Padrão", off = offOf(cl), g = (i) => (pr.length > off + i ? PN(pr[off + i]) : 0); return { cl, uso: g(0), programa: g(1), mont: g(2), tx: g(3), cola: g(4) }; };
  const refreshParams = () => { const mr = find(mats, mat.value), pr = find(prods, prod.value); if (!mr || !pr) { par1.textContent = ""; return; } const p = params(mr, pr); par1.textContent = "Classificação: " + p.cl + " | Uso máquina=" + f4(p.uso) + " | Tempo programa=" + f4(p.programa) + " | Montagem=" + f4(p.mont) + "\r\nTaxa montagem=" + C2(p.tx) + " | Cola=" + C2(p.cola) + " | Valores buscados automaticamente no Cadastro Produtos."; };
  mat.addEventListener("change", () => { refreshMaterial(); refreshParams(); }); prod.addEventListener("change", refreshParams); refreshMaterial(); refreshParams();
  const doArea = () => { const [a, b, c, d, e, f, g, hh] = [bw, bl, bh, lw, ll, lh, qw, ql].map((i) => Ler(i.value)); const x = (a * b + d * e + (a + a + b + b) * c + (d + d + e + e) * f + a * g * 0.05 + b * hh * 0.05) * 1.11112; areaCalc.value = f8(x); };
  calcArea.onclick = doArea; useArea.onclick = () => { doArea(); area.value = areaCalc.value; };
  function doCalc() {
    try {
      if (!mats.length || !prods.length) { pending = null; save.disabled = true; aviso(!mats.length ? "Laser CO² - Materiais" : "Laser CO² - Produtos"); return; }
      const a = Ler(area.value), tl = Ler(tempoLaser.value);
      if (a <= 0) throw new Error("Informe Qtde Material (m²) ou use o Cálculo de Área.");
      if (tl < 0) throw new Error("Tempo Laser CO² não pode ser negativo.");
      const mr = find(mats, mat.value), pr = find(prods, prod.value); if (!mr || !pr) throw new Error("Material ou Tipo Produto não encontrado no cadastro da planilha.");
      const vm = mr.length > 4 ? PN(mr[4]) : 0; if (vm <= 0) throw new Error("O material selecionado não possui Valor Venda/m² válido na planilha.");
      const p = params(mr, pr);
      const material = a * vm, custoUso = a * vm * p.uso, custoPrograma = a * vm * p.programa, custoMont = a * vm * p.mont;
      const basev = material + custoUso + custoPrograma + custoMont + tl + p.tx + p.cola, cfinal = Up1(basev * 1.9), revenda = Up1(basev * 1.2);
      cf.value = C2(cfinal); rv.value = C2(revenda); if (Ler(valorCob.value) <= 0) valorCob.value = fix2(cfinal);
      const atual = Ler(valorCob.value), acres = atual - cfinal; valorCalc.value = C2(cfinal); acrRs.value = C2(acres); acrPct.value = f2(cfinal > 0 ? (acres / cfinal) * 100 : 0) + "%";
      refreshParams();
      res.textContent = "ORÇAMENTO LASER CO² — CONFERÊNCIA PLANILHA\r\n\r\nTipo Produto: " + prod.value + "\r\nDescrição: " + desc.value + "\r\nCliente: " + cliente.value + "\r\nTipo Material: " + mat.value + "\r\n" +
        "Dimensão (cm): " + dimensao.value + "\r\nQtde Material: " + f8(a) + " m²\r\nTempo Laser CO²: " + f4(tl) + " min\r\nClassificação Produto: " + p.cl + "\r\nValor Venda material/m²: " + C2(vm) + "\r\n\r\n" +
        "Material (F x K): " + C2(material) + "\r\nUso máquina (F x K x parâmetro): " + C2(custoUso) + "\r\nTempo Programa (F x K x parâmetro): " + C2(custoPrograma) + "\r\nMontagem (F x K x parâmetro): " + C2(custoMont) + "\r\n" +
        "Tempo Laser (G): " + C2(tl) + " | Tx montagem: " + C2(p.tx) + " | Cola: " + C2(p.cola) + "\r\nBase antes do multiplicador: " + C2(basev) + "\r\n\r\nCONSUMIDOR FINAL (x1,90 / ROUNDUP 1 casa): " + C2(cfinal) + "\r\nREVENDA (x1,20 / ROUNDUP 1 casa): " + C2(revenda) + "\r\nVALOR COBRADO: " + C2(Ler(valorCob.value));
      let final = Ler(valorCob.value); if (final <= 0) final = cfinal;
      pending = { Cliente: cliente.value.trim() || "SEM CLIENTE", Tipo: "PERSONALIZADOS - LASER CO2", Vendedor: ctx.session.nome, Resumo: res.textContent + "\r\n\r\nParâmetros: " + par1.textContent, Valor: final }; save.disabled = false;
    } catch (e) { pending = null; save.disabled = true; alertBox(friendly(e), "Orçamento Laser CO²"); }
  }
  valorCob.addEventListener("input", () => { const b = Ler(cf.value), vf = Ler(valorCob.value); if (b > 0) { const ac = vf - b; valorCalc.value = C2(b); acrRs.value = C2(ac); acrPct.value = f2((ac / b) * 100) + "%"; } });
  calc.onclick = () => { valorCob.value = ""; doCalc(); };
  useCf.onclick = () => { if (cf.value.trim()) { valorCob.value = fix2(Ler(cf.value)); doCalc(); } };
  useRv.onclick = () => { if (rv.value.trim()) { valorCob.value = fix2(Ler(rv.value)); doCalc(); } };
  save.onclick = () => { doCalc(); if (!save.disabled && pending) savePending(pending, res, save); };
});

// ---------- Orçamento Laser - Gravação ----------
register("orc/gravacao", async (el) => {
  const F = form(el, "Orçamento Laser - Gravação", "Orçamento rápido para serviços de gravação a laser por unidade.");
  const cliente = F.T("Cliente"), produto = F.CB("Produto", ["COPO", "CANETA", "PORTA JOIA", "ESPELHO", "KIT FACA", "AGENDA", "TABUA DE MADEIRA"], "COPO"), tipo = F.CB("Tipo de gravação", []), descricao = F.T("Nome / desenho / descrição");
  const qtd = F.N("Quantidade", "1", true), unit = F.RO("Valor unitário tabela", true), totalCalc = F.RO("VALOR CALCULADO", true), valorFinal = F.N("VALOR FINAL / COBRADO", "", true), acrRs = F.RO("ACRÉSCIMO (R$)", true), acrPct = F.RO("ACRÉSCIMO (%)", true);
  const obs = F.TA("Observações");
  const [calc, tabelaB, save] = actions(el, [["CALCULAR", "dark"], ["USAR VALOR TABELA", "primary"], ["SALVAR ORÇAMENTO", "green"]]); save.disabled = true;
  const res = h("div", { class: "resumo" }, ""); el.append(res);
  let pending = null;
  const refreshTipo = () => { tipo.innerHTML = ""; for (const o of produto.value === "COPO" ? ["Somente o nome", "Desenho já pronto", "Desenho que não tem / criar arte"] : ["Gravação padrão"]) tipo.append(h("option", { value: o }, o)); tipo.selectedIndex = 0; };
  const showAdd = (b) => { let vf = Ler(valorFinal.value); if (vf <= 0) vf = b; const ac = vf - b; acrRs.value = C2(ac); acrPct.value = f2(b > 0 ? (ac / b) * 100 : 0) + "%"; };
  const unitPrice = () => produto.value === "COPO" ? (tipo.value.startsWith("Somente") ? servicePrice("LASER_GRAVACAO", "COPO - SOMENTE NOME", 20) : tipo.value.startsWith("Desenho já") ? servicePrice("LASER_GRAVACAO", "COPO - DESENHO PRONTO", 25) : servicePrice("LASER_GRAVACAO", "COPO - ARTE NOVA", 30)) : servicePrice("LASER_GRAVACAO", produto.value, 5);
  async function doCalc(silent) {
    try {
      const q = Ler(qtd.value); if (q <= 0) throw new Error("Informe uma quantidade válida.");
      const vu = await unitPrice(), total = q * vu; unit.value = C2(vu); totalCalc.value = C2(total);
      if (Ler(valorFinal.value) <= 0) valorFinal.value = fix2(total); showAdd(total);
      let vf = Ler(valorFinal.value); if (vf <= 0) vf = total;
      res.textContent = "ORÇAMENTO LASER - GRAVAÇÃO\r\n\r\nCliente: " + cliente.value + "\r\nProduto: " + produto.value + "\r\nTipo de gravação: " + tipo.value + "\r\nPersonalização: " + descricao.value + "\r\nQuantidade: " + f2(q) + "\r\nValor unitário tabela: " + C2(vu) + "\r\nVALOR CALCULADO: " + C2(total) + "\r\nVALOR FINAL / COBRADO: " + C2(vf) + "\r\nACRÉSCIMO: " + C2(vf - total) + " (" + f2(total > 0 ? ((vf - total) / total) * 100 : 0) + "%)\r\n\r\nObservações: " + obs.value;
      pending = { Cliente: cliente.value.trim() || "SEM CLIENTE", Tipo: "PERSONALIZADOS - LASER GRAVACAO", Vendedor: ctx.session.nome, Resumo: res.textContent, Valor: vf }; save.disabled = false;
    } catch (e) { pending = null; save.disabled = true; if (!silent) alertBox(friendly(e), "Orçamento Laser - Gravação"); }
  }
  produto.addEventListener("change", () => { refreshTipo(); valorFinal.value = ""; doCalc(); });
  tipo.addEventListener("change", () => { valorFinal.value = ""; doCalc(); });
  valorFinal.addEventListener("input", () => { const b = Ler(totalCalc.value); if (b > 0) showAdd(b); });
  calc.onclick = () => { valorFinal.value = ""; doCalc(); };
  tabelaB.onclick = async () => { let b = Ler(totalCalc.value); if (b <= 0) { await doCalc(); b = Ler(totalCalc.value); } valorFinal.value = fix2(b); doCalc(); };
  save.onclick = async () => { await doCalc(); if (!save.disabled && pending) savePending(pending, res, save); };
  refreshTipo(); doCalc(true);
});

// ---------- Orçamento Bordado ----------
register("orc/bordado", async (el) => {
  const F = form(el, "Orçamento Bordado", "Valor da peça + custo do bordado por pontos. Regra: cada 1.000 pontos = R$ 2,00 por unidade.");
  const cliente = F.T("Cliente");
  const produto = F.T("Produto", "BONÉ"); produto.setAttribute("list", "sj-bord-prod"); el.append(h("datalist", { id: "sj-bord-prod" }, ...["BONÉ", "TOALHA", "OUTRO"].map((o) => h("option", { value: o }))));
  const descricao = F.T("Nome / desenho / descrição"), qtd = F.N("Quantidade", "1", true), baseUnit = F.N("Valor base da peça (R$ / un)", fix2(await servicePrice("BORDADO", "BONE", 20)), true);
  const pontos = F.N("Pontos bordados por peça", "0", true), valor1000 = F.RO("Valor por 1.000 pontos", true); valor1000.value = C2(await servicePrice("BORDADO", "VALOR 1000 PONTOS", 2));
  const bordUnit = F.RO("Bordado por unidade", true), unitTotal = F.RO("Total por unidade", true), totalCalc = F.RO("VALOR CALCULADO", true), valorFinal = F.N("VALOR FINAL / COBRADO", "", true), acrRs = F.RO("ACRÉSCIMO (R$)", true), acrPct = F.RO("ACRÉSCIMO (%)", true);
  const obs = F.TA("Observações"); F.note("BONÉ: valor base automático de R$ 20,00. TOALHA/OUTRO: digite o produto e o valor base da peça.");
  const [calc, tabelaB, save] = actions(el, [["CALCULAR", "dark"], ["USAR VALOR CALCULADO", "primary"], ["SALVAR ORÇAMENTO", "green"]]); save.disabled = true;
  const res = h("div", { class: "resumo" }, ""); el.append(res);
  let pending = null;
  const showAdd = (t) => { let vf = Ler(valorFinal.value); if (vf <= 0) vf = t; const ac = vf - t; acrRs.value = C2(ac); acrPct.value = f2(t > 0 ? (ac / t) * 100 : 0) + "%"; };
  async function doCalc(silent) {
    try {
      const q = Ler(qtd.value); if (q <= 0) throw new Error("Informe uma quantidade válida.");
      const vb = Ler(baseUnit.value); if (vb < 0) throw new Error("Valor base da peça inválido.");
      const pts = Ler(pontos.value); if (pts < 0) throw new Error("Quantidade de pontos inválida.");
      const vp = await servicePrice("BORDADO", "VALOR 1000 PONTOS", 2), bord = (pts / 1000) * vp, vu = vb + bord, total = q * vu;
      bordUnit.value = C2(bord); unitTotal.value = C2(vu); totalCalc.value = C2(total);
      if (Ler(valorFinal.value) <= 0) valorFinal.value = fix2(total); showAdd(total);
      let vf = Ler(valorFinal.value); if (vf <= 0) vf = total;
      res.textContent = "ORÇAMENTO BORDADO\r\n\r\nCliente: " + cliente.value + "\r\nProduto: " + produto.value + "\r\nPersonalização: " + descricao.value + "\r\nQuantidade: " + f2(q) + "\r\nValor base da peça: " + C2(vb) + " por unidade\r\nPontos bordados por peça: " + Math.round(pts).toLocaleString("pt-BR", { useGrouping: false }) + "\r\nCusto bordado: " + C2(bord) + " por unidade (" + C2(vp) + " / 1.000 pontos)\r\nTotal por unidade: " + C2(vu) + "\r\nVALOR CALCULADO: " + C2(total) + "\r\nVALOR FINAL / COBRADO: " + C2(vf) + "\r\nACRÉSCIMO: " + C2(vf - total) + " (" + f2(total > 0 ? ((vf - total) / total) * 100 : 0) + "%)\r\n\r\nObservações: " + obs.value;
      pending = { Cliente: cliente.value.trim() || "SEM CLIENTE", Tipo: "PERSONALIZADOS - BORDADO", Vendedor: ctx.session.nome, Resumo: res.textContent, Valor: vf }; save.disabled = false;
    } catch (e) { pending = null; save.disabled = true; if (!silent) alertBox(friendly(e), "Orçamento Bordado"); }
  }
  produto.addEventListener("input", async () => { const p = produto.value.toLowerCase(); if (p === "boné") baseUnit.value = fix2(await servicePrice("BORDADO", "BONE", 20)); else if (p === "toalha" || p === "outro") baseUnit.value = ""; valorFinal.value = ""; });
  valorFinal.addEventListener("input", () => { const b = Ler(totalCalc.value); if (b > 0) showAdd(b); });
  calc.onclick = () => { valorFinal.value = ""; doCalc(); };
  tabelaB.onclick = async () => { let b = Ler(totalCalc.value); if (b <= 0) { await doCalc(); b = Ler(totalCalc.value); } valorFinal.value = fix2(b); doCalc(); };
  save.onclick = async () => { await doCalc(); if (!save.disabled && pending) savePending(pending, res, save); };
  doCalc(true);
});
