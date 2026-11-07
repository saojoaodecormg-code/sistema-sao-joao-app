// Cortina sob medida: MainForm.CurtainInfo + CurtainQuoteEngine (V24.14, aba SALA PRINCIPAL de ORÇAMENTOS CORTINAS.xlsx).
// Mesmo cálculo, mesmas pendências, mesmo texto de resumo e o mesmo rascunho técnico <SJ_CURTAIN_TECH> para a Ordem de Costura.
import { ctx, register } from "../app.js";
import { h, money } from "../ui.js";
import { precos, G } from "../precos.js";
import { APP_VERSION } from "../config.js";
import { quoteScreen } from "./orcamentos.js";

const M = money;
const br2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N = (s) => { const t = String(s ?? "").trim().replace(/\s/g, ""); if (!t) return 0; const v = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return isFinite(v) ? v : 0; };
const CLASSES = ["Econômica", "Básica", "Normal", "Padrão", "Especial"];
const HARDWARE = ["Trilho Suíço Duplo", "Trilho Premium Duplo", "Bastão Deslizante", "Bastão 28 Cromo", "Bastão 28 Tinto", "Trilho Motorizado"];
const SEM2 = "(SEM TECIDO 2)";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const Up = (x) => Math.ceil(Math.round(x * 1e9) / 1e9);
const Even = (x) => { const c = Up(x); return c % 2 === 0 ? c : c + 1; };
const TrackLength = (l) => (l <= 2 ? 2 : l <= 2.5 ? 2.5 : l <= 3 ? 3 : l <= 3.5 ? 3.5 : l <= 4 ? 4 : l <= 6 ? 6 : l <= 12 ? 12 : 18);
const RodLength = (l) => (l <= 2 ? 3 : l <= 4 ? 4 : l <= 6 ? 6 : l <= 12 ? 12 : 18);
const RodSupports = (l) => (l <= 2 ? 1 : l <= 6 ? 2 : l <= 10 ? 3 : l <= 14 ? 4 : 5);
const classIndex = (m) => { const k = norm(m); return CLASSES.findIndex((c) => k.startsWith(norm(c))); };
const hardwareIndex = (f) => HARDWARE.findIndex((x) => norm(x) === norm(f));
function suggestBar(hh, tol, w, barAdd, bar) {
  if (hh + tol >= w) return "Normal";
  if (barAdd < bar || barAdd > bar * 2.5) return "CORRIGIR";
  if (hh + barAdd < w) return "Normal";
  if (hh + barAdd > w) return "Falsa Barra";
  return "CORRIGIR";
}
const Inv = (c) => String(c).toLowerCase() === "invertido";
const Fal = (b) => String(b).toLowerCase() === "falsa barra";
const Desc = (c, b) => "corte " + (Inv(c) ? "invertido" : "normal") + " com " + (Fal(b) ? "falsa barra" : "barra normal");
// Arredondamentos em decimal como no C# (MidpointRounding.AwayFromZero)
const r2 = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9) / 100;
const r6 = (v) => Math.round(v * 1e6) / 1e6;

export function calculateCurtain(cfg, x) {
  const r = { Pendencias: [], Avisos: [], AutoCut1: "", AutoBar1: "", AutoCut2: "", AutoBar2: "" }; const pend = r.Pendencias;
  const f1 = x.Tecido1 && cfg.fabrics.get(x.Tecido1); let f2 = null;
  if (!f1) pend.push("Tecido 1 não cadastrado em Valores / Produtos.");
  const juntos = x.Costura === "Juntos", separados = x.Costura === "Separados", unico = !juntos && !separados;
  const has2 = !unico && !!String(x.Tecido2 || "").trim() && x.Tecido2 !== SEM2;
  if (!unico && !has2) pend.push("Costura com 2 tecidos: selecione o Tecido 2 ou marque \"Somente 1 tecido\".");
  if (has2) { f2 = cfg.fabrics.get(x.Tecido2) || null; if (!f2) pend.push("Tecido 2 não cadastrado em Valores / Produtos."); }
  const w1 = f1 ? f1.width : 0, p1 = f1 ? f1.price : 0, w2 = f2 ? f2.width : 0, p2 = f2 ? f2.price : 0;
  if (f1 && (w1 <= 0 || p1 <= 0)) pend.push("Tecido 1: largura útil ou preço por metro não cadastrado.");
  if (f2 && (w2 <= 0 || p2 <= 0)) pend.push("Tecido 2: largura útil ou preço por metro não cadastrado.");
  const L = x.Largura, hE = x.AltE, hD = x.AltD; if (L <= 0 || hE <= 0 || hD <= 0) pend.push("Informe largura e as duas alturas maiores que zero.");
  const hh = (hE + hD) / 2;
  const dupla = String(x.Barra).toLowerCase() === "dupla", simples = String(x.Barra).toLowerCase() === "simples"; if (!dupla && !simples) pend.push("Selecione barra Dupla ou Simples.");
  const teto = x.Fixacao === "Teto", parede = x.Fixacao === "Parede", gesso = x.Fixacao === "Gesso"; if (!teto && !parede && !gesso) pend.push("Selecione a fixação.");
  let partes = /^\d+$/.test(String(x.Partes)) ? Number(x.Partes) : 0; if (partes < 1 || partes > 3) { pend.push("Selecione 1, 2 ou 3 partes."); partes = 1; }
  const ci = classIndex(x.Modelo); let factor = 0;
  if (ci < 0) pend.push("Selecione a classe de consumo.");
  else { factor = cfg.consumption.get(CLASSES[ci]) || 0; if (!(factor > 0)) pend.push("Fator de consumo \"" + CLASSES[ci] + "\" não cadastrado em Valores / Produtos."); }
  const hw = hardwareIndex(x.Ferragem); if (hw < 0) pend.push("Ferragem inválida: " + x.Ferragem);
  const P = (i) => cfg.param(G.CurtainRules, i);
  const bar = P("Barra acabada (m)"); if (bar < 0.15) pend.push("Barra acabada menor que 0,15 m (regra U30 da planilha).");
  const I26 = dupla ? P("Fator barra dupla") * bar : 0, J26 = simples ? P("Fator barra simples") * bar : 0, barAdd = I26 + J26;
  const tol = P("Folga corte invertido (m)");
  const V = (n) => { const v = cfg.internal.get(n); if (!v) throw new Error("Valor interno não cadastrado: " + n); return v.value; };
  const D82 = V("Trespasso Trilho"), D83 = V("Dobra Lateral");
  r.BarraMetros = bar;
  if (pend.length) { r.Status = "PENDENTE"; return r; }
  r.AutoCut1 = hh + tol > w1 ? "Invertido" : "Normal"; r.AutoBar1 = suggestBar(hh, tol, w1, barAdd, bar);
  r.AutoCut2 = has2 ? (hh + tol > w2 ? "Invertido" : "Normal") : "N/A"; r.AutoBar2 = has2 ? suggestBar(hh, tol, w2, barAdd, bar) : "N/A";
  if (r.AutoBar1 === "CORRIGIR" || (has2 && r.AutoBar2 === "CORRIGIR")) pend.push("Barra fora da faixa aceita pela planilha (E33/H33 = CORRIGIR). Revise a barra acabada ou as medidas.");
  const cut1 = x.UsarSugestao ? r.AutoCut1 : x.Cut1, bar1 = x.UsarSugestao ? r.AutoBar1 : x.Bar1, cut2 = x.UsarSugestao ? r.AutoCut2 : x.Cut2, bar2 = x.UsarSugestao ? r.AutoBar2 : x.Bar2;
  const E = L * factor + L * D82 + D83;
  const fb1 = P("Falsa barra 1 parte (fator)"), fb2 = P("Falsa barra 2 ou mais partes (fator)"), fb3 = P("Falsa barra 3 partes Econômica tecido 1 (fator)");
  const F1 = partes === 1 ? E * fb1 : partes === 3 && ci === 0 ? E * fb3 : E * fb2, F2 = partes === 1 ? E * fb1 : E * fb2;
  const G1 = Up(E / w1) * (hh + I26), G2 = has2 ? Up(E / w2) * (hh + I26) : 0;
  const pick = (cut, b, en, fn, gn) => (!Inv(cut) && !Fal(b) ? en : !Inv(cut) && Fal(b) ? fn : Inv(cut) && !Fal(b) ? gn : 0);
  const R66 = pick(cut1, bar1, E, F1, G1), R67 = has2 ? pick(cut2, bar2, E, F2, G2) : 0;
  if (R66 <= 0) pend.push("Tecido 1: corte invertido com falsa barra não é aceito pela planilha.");
  if (has2 && R67 <= 0) pend.push("Tecido 2: corte invertido com falsa barra não é aceito pela planilha.");
  if (pend.length) { r.Status = "PENDENTE"; return r; }
  if (has2 && Math.abs(R66 - R67) > 1e-7) r.Avisos.push("VERIFICAR ALTURAS: o consumo do tecido 1 (" + br2(R66) + " m) é diferente do tecido 2 (" + br2(R67) + " m).");
  const track = hw === 0 || hw === 1 || hw === 2;
  const rodEsp = P("Espaçamento rodízio (m)"), ilhEsp = P("Espaçamento ilhós (m)"), extra = P("Peças extras rodízio / ilhós (un)"), supEsp = P("Espaçamento suporte trilho (m)"), supRec = P("Recuo suporte trilho (m)");
  const R59 = TrackLength(L), R60 = Up((L - supRec) / supEsp), R61 = Even(L / 2 / rodEsp) * 2 + extra, R62 = RodLength(L), R63 = RodSupports(L), R64 = Even((E - D83) / ilhEsp / 2) * 2 + extra;
  const sep = separados ? 1 : 0;
  r.Tecido1Valor = R66 * p1; r.Tecido2Valor = unico ? 0 : R67 * p2;
  r.FioUrso = V("Fio urso") * (1 + sep); r.Entretela = E * V("Entretela") * (1 + sep);
  r.Rodizio = (track ? R61 * V("Rodízio") : 0) * (1 + sep);
  r.Trilho = hw === 0 ? R59 * V("Trilho Suíço Duplo") : hw === 1 ? R59 * V("Trilho Premium Duplo") : hw === 2 ? R59 * V("Bastão Deslizante") : 0;
  r.SuporteTrilho = parede && track ? R60 * V("Suporte Trilho / Gesso") : 0;
  r.BuchaGesso = gesso && track ? R60 * V("Suporte Trilho / Gesso") : 0;
  r.BuchaNormal = teto && track ? R60 * V("Teto Normal") : 0;
  r.Cordao = (track ? L * (1 + D82) * V("Cordão Wave") : 0) * (1 + sep);
  r.TrilhoMotorizado = hw === 5 ? V("Trilho Motorizado") : 0;
  r.Ilhoes = (hw === 3 ? R64 * V("Ilhós Cromado") : hw === 4 ? R64 * V("Ilhós Tinto") : 0) * (1 + sep);
  r.Bastao = (hw === 3 ? R62 * V("Bastão 28 Cromo") : hw === 4 ? R62 * V("Bastão 28 Tinto") : 0) * (1 + sep);
  r.SuporteBastao = (hw === 3 ? R63 * V("Suporte Bastão Cromado") : hw === 4 ? R63 * V("Suporte Bastão Tinto") : 0) * (1 + sep);
  r.MaoObraInstalacao = V("Instalação") * (1 + sep);
  r.Confeccao = (R66 + R67) * V("Confecção");
  r.Consumo1 = R66; r.Consumo2 = R67;
  const ferragem = r.Trilho + r.SuporteTrilho + r.BuchaGesso + r.BuchaNormal + r.TrilhoMotorizado + r.Bastao + r.SuporteBastao;
  const cortina = r.Tecido1Valor + r.Tecido2Valor + r.FioUrso + r.Entretela + r.Rodizio + r.Cordao + r.Ilhoes + r.Confeccao;
  const instal = r.MaoObraInstalacao;
  r.Subtotal = ferragem + cortina + instal;
  const pct = cfg.param(G.CurtainPrice, "Acréscimo sobre subtotal (%)"), step = cfg.param(G.CurtainPrice, "Arredondamento a prazo (R$)"), disc = cfg.param(G.CurtainPrice, "Desconto à vista (%)");
  const sub = r6(r.Subtotal), mult = 1 + pct / 100, withAdd = r6(sub * mult);
  const prazo = step > 0 ? Math.ceil(Math.round((withAdd / step) * 1e9) / 1e9) * step : r2(withAdd);
  const vista = r2(prazo * (1 - disc / 100));
  r.AcrescimoPct = pct; r.DescontoVistaPct = disc; r.ArredondamentoPrazo = step;
  r.TotalComAcrescimo = r2(withAdd); r.Aprazo = prazo; r.Total = prazo; r.Avista = vista;
  r.Ferragem = ferragem * mult; r.Cortina = cortina * mult; r.Instalacao = instal * mult;
  r.DescricaoCorte = has2 ? "Tecido 1 " + Desc(cut1, bar1) + " e Tecido 2 " + Desc(cut2, bar2) : "Tecido único " + Desc(cut1, bar1);
  r.Status = r.Avisos.length ? "OK COM AVISOS" : "OK";
  return r;
}

// CurtainBudgetDraft.Serialize + EmbedCurtainTechnical
const b64 = (s) => { const b = new TextEncoder().encode(s ?? ""); let t = ""; for (const c of b) t += String.fromCharCode(c); return btoa(t); };
const D = (v) => { const t = (Math.round(Number(v) * 10000) / 10000).toString(); return t === "-0" ? "0" : t; };
function techTag(d) {
  const keys = [["FrontFabric", d.FrontFabric], ["LiningFabric", d.LiningFabric], ["FrontModel", d.FrontModel], ["LiningModel", d.LiningModel], ["ConsumptionClass", d.ConsumptionClass], ["FinalWidth", D(d.FinalWidth)], ["HeightLeft", D(d.HeightLeft)], ["HeightCenter", D(0)], ["HeightRight", D(d.HeightRight)], ["QuotedFrontMeters", D(d.QuotedFrontMeters)], ["QuotedLiningMeters", D(d.QuotedLiningMeters)], ["CurtainQty", "1"], ["Parts", String(d.Parts)], ["FrontDirection", d.FrontDirection], ["LiningDirection", d.LiningDirection], ["FrontBarType", d.FrontBarType], ["LiningBarType", d.LiningBarType], ["FrontBarConfig", "Normal"], ["LiningBarConfig", "Normal"], ["Fixing", d.Fixing], ["FrontBarCm", D(d.FrontBarCm)], ["LiningBarCm", D(d.LiningBarCm)], ["Observations", ""]];
  let raw = ""; for (const [k, v] of keys) raw += k + "=" + b64(v ?? "") + "\n";
  return "\r\n<SJ_CURTAIN_TECH>" + b64(raw) + "</SJ_CURTAIN_TECH>";
}
function techFactorConfigured(cfg, model) {
  const g = model.toLowerCase() === "reto" ? "MODELO TECNICO" : "TIPO PREGA";
  const row = cfg.get(g, model) || cfg.def(g, model); if (!row) return false; const v = Number(row.v1); return v > 0;
}
function missingFromCatalog(cfg, group) { return cfg.rowsOfGroup(group).filter((r) => !cfg.has(group, r.i)).map((r) => r.i); }

register("orc/cortina", async (el) => {
  const cfg = await precos(ctx.unit).ensureFresh();
  const names = [...cfg.fabrics.keys()];
  const fc = (c) => { const v = cfg.consumption.get(c); return v != null ? v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "?"; };
  const classLabels = CLASSES.map((c) => c + " - " + fc(c));
  const o = (opts, sel) => ({ type: "select", options: opts, value: sel });
  quoteScreen(el, { title: "Cortina sob medida", tipo: "Cortina sob medida", calcLabel: "CALCULAR CORTINA",
    fields: [
      { name: "vend", label: "Vendedor", value: ctx.session.nome, text: true, half: true }, { name: "tel", label: "Telefone", value: "", text: true, half: true },
      { name: "end", label: "Endereço", value: "", text: true },
      { name: "t1", label: "Tecido 1", ...o(names, names[0]) },
      { name: "t2", label: "Tecido 2 / Forro", ...o([SEM2, ...names], SEM2) },
      { name: "cost", label: "Costura dos tecidos", ...o(["Juntos", "Separados", "Somente 1 tecido"], "Juntos") },
      { name: "larg", label: "Largura total (m)", value: "4,00" },
      { name: "ae", label: "Altura esquerda", value: "3,08", half: true }, { name: "ad", label: "Altura direita", value: "3,08", half: true },
      { name: "barra", label: "Barra", ...o(["Dupla", "Simples"], "Dupla"), half: true }, { name: "fix", label: "Fixação", ...o(["Teto", "Parede", "Gesso"], "Gesso"), half: true },
      { name: "partes", label: "Partes", ...o(["1", "2", "3"], "1"), half: true }, { name: "modelo", label: "Consumo", ...o(classLabels, classLabels[4]), half: true },
      { name: "modelF", label: "Modelo Frente", ...o(["Prega Macho", "Prega Fêmea", "Wave", "Prega Batida", "Prega Tripla Americana"], "Wave"), half: true },
      { name: "modelL", label: "Modelo Forro", ...o(["Reto", "Prega Macho", "Prega Fêmea", "Wave", "Prega Batida", "Prega Tripla Americana"], "Reto"), half: true },
      { name: "ferr", label: "Ferragem", ...o(HARDWARE, "Trilho Suíço Duplo"), half: true }, { name: "sug", label: "Sugestão?", ...o(["SIM", "NÃO"], "NÃO"), half: true },
      { name: "c1", label: "T1 Corte", ...o(["Normal", "Invertido"], "Normal"), half: true }, { name: "b1", label: "T1 Barra técnica", ...o(["Normal", "Falsa Barra"], "Normal"), half: true },
      { name: "c2", label: "T2 Corte", ...o(["Normal", "Invertido"], "Normal"), half: true }, { name: "b2", label: "T2 Barra técnica", ...o(["Normal", "Falsa Barra"], "Normal"), half: true },
    ],
    after: (inp) => {
      inp.vend.readOnly = true;
      const info = (sel) => { const d = h("div", { class: "sub", style: { margin: "4px 0 2px", color: "#4b5563", fontSize: "13px" } }); sel.after(d); return d; };
      const i1 = info(inp.t1), i2 = info(inp.t2);
      const show = (d, n) => { const f = cfg.fabrics.get(n); d.textContent = f ? "Largura " + br2(f.width) + " · Preço/m " + br2(f.price) + (f.category ? " · " + f.category : "") : ""; };
      const upd1 = () => show(i1, inp.t1.value);
      const upd2 = () => { if (inp.t2.value === SEM2) { i2.textContent = ""; inp.cost.value = "Somente 1 tecido"; } else { show(i2, inp.t2.value); if (inp.cost.value === "Somente 1 tecido") inp.cost.value = "Juntos"; } };
      inp.t1.addEventListener("change", upd1); inp.t2.addEventListener("change", upd2); upd1(); upd2();
    },
    calc: (v, cfg) => {
      const input = { Tecido1: v.t1, Tecido2: v.t2, Costura: v.cost, Largura: N(v.larg), AltE: N(v.ae), AltD: N(v.ad), Barra: v.barra, Fixacao: v.fix, Partes: v.partes, Modelo: v.modelo, Ferragem: v.ferr, Cut1: v.c1, Bar1: v.b1, Cut2: v.c2, Bar2: v.b2, UsarSugestao: v.sug === "SIM" };
      const x = calculateCurtain(cfg, input);
      const entradas = "Entradas: Consumo " + v.modelo + " | Costura " + v.cost + " | Ferragem " + v.ferr + " | Barra acabada " + v.barra + " (" + br2(x.BarraMetros) + " m) | " + v.fix + " | " + v.partes + " parte(s) | Sugestão " + v.sug;
      if (x.Pendencias.length) return { blocked: "ORÇAMENTO BLOQUEADO — PENDÊNCIAS:\r\n• " + x.Pendencias.join("\r\n• ") + "\r\n\r\n" + entradas + "\r\n\r\nCorrija os dados ou cadastre os valores em Configurações > Valores / Produtos." };
      const avisos = [...x.Avisos];
      for (const pm of [v.modelF, v.modelL]) if (!techFactorConfigured(cfg, pm) && !avisos.includes(pm)) avisos.push("Ordem de Costura: fator de \"" + pm + "\" não configurado (a ordem ficará bloqueada até o cadastro).");
      const falt = [...missingFromCatalog(cfg, G.CurtainPrice), ...missingFromCatalog(cfg, G.CurtainRules)];
      if (falt.length) avisos.push("Parâmetros ainda não gravados no cadastro (usando o valor da planilha de referência): " + falt.join(", ") + ". Abra Valores / Produtos e salve para registrar.");
      const pt = (p) => (Math.round(p * 100) / 100).toLocaleString("pt-BR") + "%";
      const text = "Status: " + x.Status + "\r\nMotor: CÁLCULO NATIVO DE CORTINA V" + APP_VERSION + " (planilha ORÇAMENTOS CORTINAS)\r\nSugestão da planilha: T1 " + x.AutoCut1 + " / " + x.AutoBar1 + " | T2 " + x.AutoCut2 + " / " + x.AutoBar2 + "\r\n" + entradas + "\r\nManual: T1 " + v.c1 + " / " + v.b1 + " | T2 " + v.c2 + " / " + v.b2 +
        "\r\n\r\nÀ VISTA (" + pt(x.DescontoVistaPct) + " de desconto): " + M(x.Avista) + "\r\nA PRAZO: " + M(x.Aprazo) + "\r\nFerragem: " + M(x.Ferragem) + "\r\nCortina: " + M(x.Cortina) + "\r\nInstalação: " + M(x.Instalacao) + "\r\nConsumo Tecido 1: " + br2(x.Consumo1) + " m\r\nConsumo Tecido 2: " + br2(x.Consumo2) + " m\r\nCorte: " + x.DescricaoCorte +
        "\r\n\r\n--- CONFERÊNCIA ITEM A ITEM ---\r\nTecido 1: " + M(x.Tecido1Valor) + " | Tecido 2: " + M(x.Tecido2Valor) + "\r\nFio urso: " + M(x.FioUrso) + " | Entretela: " + M(x.Entretela) + " | Rodízio: " + M(x.Rodizio) + "\r\nTrilho: " + M(x.Trilho) + " | Suporte trilho: " + M(x.SuporteTrilho) + " | Buchas: " + M(x.BuchaGesso + x.BuchaNormal) + "\r\nCordão: " + M(x.Cordao) + " | Motorizado: " + M(x.TrilhoMotorizado) + "\r\nIlhós: " + M(x.Ilhoes) + " | Bastão: " + M(x.Bastao) + " | Suporte bastão: " + M(x.SuporteBastao) + "\r\nM.O. instalação: " + M(x.MaoObraInstalacao) + " | Confecção: " + M(x.Confeccao) +
        "\r\nSubtotal: " + M(x.Subtotal) + " | Com acréscimo de " + pt(x.AcrescimoPct) + ": " + M(x.TotalComAcrescimo) + " | Arredondado a prazo (múltiplo de " + M(x.ArredondamentoPrazo) + "): " + M(x.Aprazo) + (avisos.length ? "\r\n\r\nAVISOS:\r\n• " + avisos.join("\r\n• ") : "") + "\r\n\r\nConfiguração: Valores / Produtos (nuvem)";
      const sug = input.UsarSugestao;
      const draft = { FrontFabric: v.t1, LiningFabric: v.t2, FrontModel: v.modelF, LiningModel: v.modelL, ConsumptionClass: v.modelo, FinalWidth: input.Largura, HeightLeft: input.AltE, HeightRight: input.AltD, QuotedFrontMeters: x.Consumo1, QuotedLiningMeters: x.Consumo2, Parts: Math.max(1, Math.trunc(N(v.partes))),
        FrontDirection: sug ? x.AutoCut1 : input.Cut1, LiningDirection: sug ? (x.AutoCut2 === "N/A" ? "Normal" : x.AutoCut2) : input.Cut2,
        FrontBarType: (sug ? x.AutoBar1 : input.Bar1) === "Falsa Barra" ? "Falsa" : v.barra, LiningBarType: (sug ? x.AutoBar2 : input.Bar2) === "Falsa Barra" ? "Falsa" : "Simples",
        FrontBarCm: x.BarraMetros * 100, LiningBarCm: x.BarraMetros * 100, Fixing: v.ferr.toLowerCase().includes("bastão") ? "Varão" : "Trilho" };
      return { total: x.Total, card: x.Avista, totalNote: "A prazo: " + M(x.Aprazo), text, tech: techTag(draft) };
    } });
});
