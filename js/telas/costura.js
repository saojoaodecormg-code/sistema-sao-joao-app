// Ordem de Costura (CurtainWorkOrder.cs): CurtainBudgetDraft, CurtainTechnicalEngine, CurtainWorkOrderForm,
// CurtainWorkOrderSnapshot e CurtainPdfWriter. Mesmo cálculo, mesmas pendências, mesmos textos e o mesmo PDF A4.
import { h, alertBox, confirmBox, friendly } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { precos } from "../precos.js";

// ---------- utilidades ----------
const b64 = (s) => { const b = new TextEncoder().encode(s ?? ""); let t = ""; for (const c of b) t += String.fromCharCode(c); return btoa(t); };
const unb64 = (s) => { const t = atob(s); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return new TextDecoder().decode(b); };
const D = (v) => { const t = (Math.round(Number(v) * 10000) / 10000).toString(); return t === "-0" ? "0" : t; };
const rAway = (v, d) => { const m = Math.pow(10, d); return Math.sign(v) * Math.round(Math.abs(v) * m + 1e-9) / m; };
const rBank = (v, d) => { const m = Math.pow(10, d), x = v * m, f = Math.floor(x), diff = x - f; let r; if (Math.abs(diff - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1; else r = Math.round(x); return r / m; };
// .NET Framework formata com 15 dígitos e arredonda o meio para cima (1,575 -> 1,58).
const net = (v, d) => rAway(Number(Number(v).toPrecision(15)), d);
const f2 = (v) => net(v, 2).toFixed(2).replace(".", ",");
const fsh = (v, d) => String(net(v, d)).replace(".", ",");
const F = (v) => (v <= 0 ? "" : fsh(v, 3));
// NumeroDigitado.Ler: aceita vírgula ou ponto; vazio ou inválido = 0.
function N(s) { s = String(s ?? "").trim(); if (!s) return 0; let t = s; if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); const v = Number(t); return isFinite(v) ? v : 0; }
const eqi = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

// ---------- CurtainBudgetDraft ----------
const DRAFT_KEYS = ["FrontFabric", "LiningFabric", "FrontModel", "LiningModel", "ConsumptionClass", "FinalWidth", "HeightLeft", "HeightCenter", "HeightRight", "QuotedFrontMeters", "QuotedLiningMeters", "CurtainQty", "Parts", "FrontDirection", "LiningDirection", "FrontBarType", "LiningBarType", "FrontBarConfig", "LiningBarConfig", "Fixing", "FrontBarCm", "LiningBarCm", "Observations"];
const NUMS = new Set(["FinalWidth", "HeightLeft", "HeightCenter", "HeightRight", "QuotedFrontMeters", "QuotedLiningMeters", "FrontBarCm", "LiningBarCm"]);
export function novoDraft() { return { FrontFabric: "", LiningFabric: "", FrontModel: "Wave", LiningModel: "Reto", ConsumptionClass: "Padrão", FinalWidth: 0, HeightLeft: 0, HeightCenter: 0, HeightRight: 0, QuotedFrontMeters: 0, QuotedLiningMeters: 0, CurtainQty: 1, Parts: 2, FrontDirection: "Normal", LiningDirection: "Normal", FrontBarType: "Dupla", LiningBarType: "Simples", FrontBarConfig: "Normal", LiningBarConfig: "Normal", Fixing: "Trilho", FrontBarCm: 20, LiningBarCm: 20, Observations: "" }; }
export function serializeDraft(d) { let s = ""; for (const k of DRAFT_KEYS) { const v = NUMS.has(k) ? D(d[k]) : String(d[k] ?? ""); s += k + "=" + b64(v) + "\n"; } return s; }
export function parseDraft(s) {
  const m = new Map(); for (const line of String(s || "").split("\n")) { if (!line) continue; const i = line.indexOf("="); if (i < 1) continue; try { m.set(line.slice(0, i).toLowerCase(), unb64(line.slice(i + 1))); } catch {} }
  const G = (k) => m.get(k.toLowerCase()) ?? "", Def = (k, d) => (G(k).trim() ? G(k) : d), Nn = (k) => { const v = Number(G(k)); return G(k).trim() && isFinite(v) ? v : 0; }, I = (k, d) => (/^[-+]?\d+$/.test(G(k).trim()) ? parseInt(G(k), 10) : d);
  return { FrontFabric: G("FrontFabric"), LiningFabric: G("LiningFabric"), FrontModel: Def("FrontModel", "Wave"), LiningModel: Def("LiningModel", "Reto"), ConsumptionClass: Def("ConsumptionClass", "Padrão"), FinalWidth: Nn("FinalWidth"), HeightLeft: Nn("HeightLeft"), HeightCenter: Nn("HeightCenter"), HeightRight: Nn("HeightRight"), QuotedFrontMeters: Nn("QuotedFrontMeters"), QuotedLiningMeters: Nn("QuotedLiningMeters"), CurtainQty: I("CurtainQty", 1), Parts: I("Parts", 2), FrontDirection: Def("FrontDirection", "Normal"), LiningDirection: Def("LiningDirection", "Normal"), FrontBarType: Def("FrontBarType", "Dupla"), LiningBarType: Def("LiningBarType", "Simples"), FrontBarConfig: Def("FrontBarConfig", "Normal"), LiningBarConfig: Def("LiningBarConfig", "Normal"), Fixing: Def("Fixing", "Trilho"), FrontBarCm: Nn("FrontBarCm"), LiningBarCm: Nn("LiningBarCm"), Observations: G("Observations") };
}
export function extractMarker(text, tag) { if (!text) return ""; const a = "<" + tag + ">", b = "</" + tag + ">"; const i = text.indexOf(a); if (i < 0) return ""; const j = text.indexOf(b, i + a.length); if (j < 0) return ""; try { return unb64(text.slice(i + a.length, j)); } catch { return ""; } }
export function upsertMarker(text, tag, raw) { const a = "<" + tag + ">", b = "</" + tag + ">"; const val = b64(raw ?? ""); let src = text ?? ""; const i = src.indexOf(a); if (i >= 0) { const j = src.indexOf(b, i + a.length); if (j >= 0) src = src.slice(0, i) + src.slice(j + b.length); } return src.replace(/\s+$/, "") + "\r\n" + a + val + b; }

// ---------- CurtainConfig: parâmetros técnicos ----------
function tryTech(cfg, group, item) {
  const r = cfg.get(group, item) || cfg.def(group, item); if (r) return { ok: true, v: safeN(r.v1) };
  if (eqi(group, "TECIDO TECNICO")) { const fi = findFabric(cfg, item); if (fi && fi.width > 0) return { ok: true, v: fi.width }; }
  return { ok: false, v: 0 };
}
const safeN = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
function findFabric(cfg, name) { for (const [k, v] of cfg.fabrics) if (k === (name ?? "")) return v; return null; }
function parseInfo(s) { const d = new Map(); for (const x of String(s ?? "").split(";")) { if (!x) continue; const i = x.indexOf("="); if (i > 0) d.set(x.slice(0, i).trim().toLowerCase(), x.slice(i + 1).trim()); } return d; }
const Bool = (d, k, def) => { const v = d.get(k.toLowerCase()); if (v == null) return def; return eqi(v, "SIM") || eqi(v, "TRUE") || v === "1"; };
const InfoNum = (d, k, def) => { const v = d.get(k.toLowerCase()); if (v == null) return def; const s = String(v).trim(); const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s); return isFinite(n) ? n : 0; };
function technicalInfo(cfg, fabric) { const r = cfg.get("TECIDO TECNICO", fabric); if (r) return r.info; return findFabric(cfg, fabric) ? "Normal=SIM;Invertido=SIM;Sentido=NAO;Estampa=NAO;Casamento=NAO;RapportV=0;RapportH=0" : ""; }
export function GetTechnicalParameters(cfg, fabric, model, barType) {
  const t = { Factor: 0, UpperAllowance: 0, LateralMargin: 0, SafetyMargin: 0, BarMultiplier: 0, FabricWidth: 0, RapportV: 0, RapportH: 0, AllowNormal: true, AllowInverted: true, HasDirection: false, HasPrint: false, RequiresMatch: false, FactorConfigured: false, FabricConfigured: false, BarConfigured: false, UpperConfigured: false, SafetyConfigured: false };
  const f = findFabric(cfg, fabric); if (f) { t.FabricWidth = f.width; t.FabricConfigured = f.width > 0; }
  let x;
  if (eqi(model, "Reto")) { x = tryTech(cfg, "MODELO TECNICO", model); if (x.ok) { t.Factor = x.v; t.FactorConfigured = x.v > 0; } }
  else { x = tryTech(cfg, "TIPO PREGA", model); if (x.ok) { t.Factor = x.v; t.FactorConfigured = x.v > 0; } }
  x = tryTech(cfg, "CORTINA TECNICA", "Acabamento superior (m)"); if (x.ok) { t.UpperAllowance = x.v; t.UpperConfigured = true; }
  x = tryTech(cfg, "CORTINA TECNICA", "Margem lateral por folha (m)"); if (x.ok) t.LateralMargin = x.v;
  x = tryTech(cfg, "CORTINA TECNICA", "Margem segurança corte (m)"); if (x.ok) { t.SafetyMargin = x.v; t.SafetyConfigured = true; }
  x = tryTech(cfg, "BARRA TECNICA", barType); if (x.ok) { t.BarMultiplier = x.v; t.BarConfigured = true; }
  const info = technicalInfo(cfg, fabric);
  if (String(info ?? "").trim()) { const m = parseInfo(info); t.AllowNormal = Bool(m, "Normal", true); t.AllowInverted = Bool(m, "Invertido", true); t.HasDirection = Bool(m, "Sentido", false); t.HasPrint = Bool(m, "Estampa", false); t.RequiresMatch = Bool(m, "Casamento", false); t.RapportV = InfoNum(m, "RapportV", 0); t.RapportH = InfoNum(m, "RapportH", 0); const fw = tryTech(cfg, "TECIDO TECNICO", fabric); if (fw.ok && fw.v > 0) { t.FabricWidth = fw.v; t.FabricConfigured = true; } }
  return t;
}
const GetSpecialBarExtra = (cfg, c) => { const x = tryTech(cfg, "BARRA ESPECIAL", c); return x.ok ? x.v : 0; };
const GetTechnicalTolerance = (cfg) => { const x = tryTech(cfg, "CORTINA TECNICA", "Tolerância metragem (m)"); return x.ok ? x.v : 0.10; };

// ---------- CurtainTechnicalEngine ----------
export function GetTrespassPercent(w) { if (w <= 0) return 0; if (w <= 2.5) return 0.06; if (w <= 3.5) return 0.05; if (w <= 4.5) return 0.045; if (w <= 6.0) return 0.04; return 0.03; }
const RoundUp = (v, step) => (step <= 0 ? v : Math.ceil(v / step) * step);
export function Calculate(d, cfg, orderNo, budgetNo, client, heightRule, customLeaves) {
  const trespass = GetTrespassPercent(d.FinalWidth); const technicalWidth = rAway(d.FinalWidth * (1.0 + trespass), 3);
  const p = { OrderNumber: orderNo, BudgetNumber: budgetNo, Client: client, Fixing: d.Fixing, Observations: d.Observations, HeightRule: heightRule, Date: new Date(), CurtainQty: Math.max(1, d.CurtainQty), Parts: Math.max(1, d.Parts), OriginalWidth: d.FinalWidth, FinalWidth: technicalWidth, TrespassPercent: trespass, HeightLeft: d.HeightLeft, HeightCenter: d.HeightCenter, HeightRight: d.HeightRight, HeightUsed: 0, LeafWidths: [], Front: null, Lining: null, Pending: [] };
  if (p.FinalWidth <= 0) p.Pending.push("Largura final da cortina"); if (p.HeightLeft <= 0 && p.HeightCenter <= 0 && p.HeightRight <= 0) p.Pending.push("Altura da cortina");
  p.HeightUsed = Math.max(0, d.HeightLeft, d.HeightCenter, d.HeightRight); if (eqi(heightRule, "Altura definida pelo usuário") && d.HeightCenter > 0) p.HeightUsed = d.HeightCenter;
  if (customLeaves && customLeaves.length === p.Parts) { let sum = 0; for (const v of customLeaves) { p.LeafWidths.push(v); sum += v; } if (Math.abs(sum - p.FinalWidth) > 0.005) p.Pending.push("Soma das folhas deve ser igual à largura final"); }
  else if (p.Parts > 0 && p.FinalWidth > 0) { const baseW = rAway(p.FinalWidth / p.Parts, 3); let sum = 0; for (let i = 0; i < p.Parts; i++) { const w = i === p.Parts - 1 ? rBank(p.FinalWidth - sum, 3) : baseW; p.LeafWidths.push(w); sum += w; } }
  p.Front = CalcLayer("FRENTE", d.FrontFabric, d.FrontModel, d.FrontDirection, d.FrontBarType, d.FrontBarConfig, d.FrontBarCm, d.QuotedFrontMeters, p, cfg);
  if (String(d.LiningFabric ?? "").trim() && d.LiningFabric !== "(SEM TECIDO 2)") p.Lining = CalcLayer("FORRO", d.LiningFabric, d.LiningModel, d.LiningDirection, d.LiningBarType, d.LiningBarConfig, d.LiningBarCm, d.QuotedLiningMeters, p, cfg);
  return p;
}
function CalcLayer(layer, fabric, model, dir, bar, barCfg, barCm, quoted, p, cfg) {
  const r = { LayerName: layer, Fabric: fabric, Model: model, Direction: dir, BarType: bar, BarConfig: barCfg, BarCm: barCm, QuotedMeters: quoted, FabricWidth: 0, Factor: 0, TechnicalHeight: 0, UnitMeters: 0, TotalMeters: 0, TotalCuts: 0, TotalSeams: 0, Leaves: [], Warnings: [] };
  if (!String(fabric ?? "").trim()) { p.Pending.push(layer + ": tecido"); return r; }
  const t = GetTechnicalParameters(cfg, fabric, model, bar);
  r.FabricWidth = t.FabricWidth; r.Factor = t.Factor;
  if (t.FabricWidth <= 0) { p.Pending.push(layer + ": largura útil do tecido não informada"); return r; }
  if (t.Factor <= 0) { p.Pending.push(layer + ": fator do modelo/prega não configurado em Valores / Produtos"); return r; }
  if (!t.UpperConfigured || !t.SafetyConfigured) { p.Pending.push(layer + ": parâmetros de acabamento superior / margem de segurança"); return r; }
  if (!t.BarConfigured) { p.Pending.push(layer + ": regra técnica da barra"); return r; }
  let barAdd = (barCm / 100.0) * t.BarMultiplier; if (eqi(bar, "Sem")) barAdd = 0; if (eqi(bar, "Falsa")) barAdd = 0;
  r.TechnicalHeight = p.HeightUsed + t.UpperAllowance + barAdd + t.SafetyMargin; if (eqi(barCfg, "Invertida")) r.TechnicalHeight += GetSpecialBarExtra(cfg, "Invertida");
  if (eqi(dir, "Normal") && !t.AllowNormal) r.Warnings.push("TECIDO NÃO PERMITE CORTE NORMAL.");
  if (eqi(dir, "Invertido")) {
    if (!t.AllowInverted) r.Warnings.push("TECIDO NÃO PERMITE CORTE INVERTIDO."); if (t.HasDirection) r.Warnings.push("TECIDO POSSUI SENTIDO: conferir orientação antes de validar."); if (r.TechnicalHeight > t.FabricWidth + 0.0001) r.Warnings.push("TECIDO NÃO POSSUI LARGURA SUFICIENTE PARA CORTE INVERTIDO.");
  }
  let idx = 0;
  for (const leaf of p.LeafWidths) {
    idx++; const lp = { Index: idx, FinalWidth: leaf, TechnicalHeight: r.TechnicalHeight, RequiredWidth: leaf * t.Factor + t.LateralMargin, Cuts: 0, Seams: 0, LinearMeters: 0 };
    if (eqi(dir, "Invertido")) { let lm = lp.RequiredWidth; if (t.RequiresMatch && t.RapportH > 0) lm = RoundUp(lm, t.RapportH / 100.0); lp.Cuts = 1; lp.Seams = 0; lp.LinearMeters = lm; }
    else { let hh = r.TechnicalHeight; if (t.RequiresMatch && t.RapportV > 0) hh = RoundUp(hh, t.RapportV / 100.0); lp.TechnicalHeight = hh; lp.Cuts = Math.ceil(lp.RequiredWidth / t.FabricWidth); lp.Seams = Math.max(0, lp.Cuts - 1); lp.LinearMeters = lp.Cuts * hh; }
    r.TotalCuts += lp.Cuts; r.TotalSeams += lp.Seams; r.UnitMeters += lp.LinearMeters; r.Leaves.push(lp);
  }
  r.UnitMeters = rAway(r.UnitMeters, 2); r.TotalMeters = rAway(r.UnitMeters * p.CurtainQty, 2); r.TotalCuts *= p.CurtainQty; r.TotalSeams *= p.CurtainQty; return r;
}
const isValid = (p) => p.Pending.length === 0 && p.Front != null && p.Front.Warnings.length === 0 && (p.Lining == null || p.Lining.Warnings.length === 0);

// ---------- CurtainWorkOrderSnapshot ----------
function snapshot(p, d) {
  let s = serializeDraft(d) + "#PLAN\n" + "HeightUsed=" + D(p.HeightUsed) + "\n";
  const L = (k, x) => { s += k + "UnitMeters=" + D(x.UnitMeters) + "\n" + k + "Meters=" + D(x.TotalMeters) + "\n" + k + "Factor=" + D(x.Factor) + "\n" + k + "FabricWidth=" + D(x.FabricWidth) + "\n" + k + "TechnicalHeight=" + D(x.TechnicalHeight) + "\n" + k + "Cuts=" + x.TotalCuts + "\n" + k + "Seams=" + x.TotalSeams + "\n"; };
  if (p.Front) L("Front", p.Front); if (p.Lining) L("Lining", p.Lining); return s;
}

// ---------- textos das abas (RenderTab) ----------
function textoAba(plan, p, cfg) {
  if (!p) return "Sem forro configurado.";
  const L = [];
  L.push("Largura informada: " + f2(plan.OriginalWidth) + " m | Trespasse: " + fsh(plan.TrespassPercent * 100, 2) + "% | Largura técnica: " + f2(plan.FinalWidth) + " m");
  L.push("Tecido: " + p.Fabric); L.push("Modelo: " + p.Model + "   |   Fator aplicado: " + f2(p.Factor)); L.push("Sentido: " + p.Direction + "   |   Largura útil: " + f2(p.FabricWidth) + " m");
  L.push("Altura técnica: " + f2(p.TechnicalHeight) + " m"); L.push("Barra: " + p.BarType + " " + String(rAway(p.BarCm, 0)) + " cm   |   Configuração: " + p.BarConfig); L.push("");
  for (const l of p.Leaves) L.push("Folha " + l.Index + ": final " + f2(l.FinalWidth) + " m | tecido " + f2(l.RequiredWidth) + " m | cortes " + l.Cuts + " | emendas " + l.Seams + " | consumo " + f2(l.LinearMeters) + " m");
  L.push("");
  if (plan.CurtainQty > 1) L.push("Consumo por cortina: " + f2(p.UnitMeters) + " m | Quantidade: " + plan.CurtainQty);
  L.push("TOTAL PRODUÇÃO: " + f2(p.TotalMeters) + " m | Cortes: " + p.TotalCuts + " | Emendas: " + p.TotalSeams);
  if (p.QuotedMeters > 0) { const dif = p.TotalMeters - p.QuotedMeters; L.push("Metragem orçada: " + f2(p.QuotedMeters) + " m | Diferença: " + (Math.abs(dif) < 0.005 ? "0,00" : (dif > 0 ? "+" : "-") + f2(Math.abs(dif))) + " m"); if (Math.abs(dif) > GetTechnicalTolerance(cfg)) L.push("ATENÇÃO – METRAGEM TÉCNICA DIFERENTE DA METRAGEM ORÇADA."); }
  for (const w of p.Warnings) L.push("ATENÇÃO: " + w);
  return L.join("\n");
}
function planoCorte(plan) {
  const box = h("div", { style: { background: "#fff", padding: "6px 0" } });
  const camada = (layer) => {
    if (!layer) return;
    box.append(h("div", { style: { fontWeight: "700", fontSize: "15px", margin: "8px 0" } }, layer.LayerName + " — " + layer.Fabric + " — " + layer.Direction));
    for (const leaf of layer.Leaves) {
      const pct = Math.max(45, Math.min(100, (leaf.FinalWidth / Math.max(0.01, plan.FinalWidth)) * 100));
      const r = h("div", { style: { position: "relative", border: "1px solid #000", width: pct + "%", minHeight: "90px", padding: "8px", marginBottom: "18px", boxSizing: "border-box", fontSize: "13px" } },
        h("div", {}, "Folha " + leaf.Index + "  " + f2(leaf.FinalWidth) + " m x " + f2(leaf.TechnicalHeight) + " m"), h("div", { style: { marginTop: "6px" } }, "Tecido: " + f2(leaf.RequiredWidth) + " m | Cortes: " + leaf.Cuts + " | Emendas: " + leaf.Seams));
      for (let i = 1; i <= leaf.Seams; i++) r.append(h("div", { style: { position: "absolute", left: (100 * i / leaf.Cuts) + "%", bottom: "2px", height: "33px", borderLeft: "1px dashed gray" } }));
      box.append(r);
    }
    box.append(h("div", { style: { fontSize: "13px" } }, "Total: " + f2(layer.TotalMeters) + " m | Cortes: " + layer.TotalCuts + " | Emendas: " + layer.TotalSeams));
  };
  camada(plan.Front); if (plan.Lining) { box.append(h("div", { style: { height: "20px" } })); camada(plan.Lining); }
  return box;
}

// ---------- CurtainPdfWriter ----------
const CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f };
const enc1252 = (s) => { const out = []; for (const ch of String(s ?? "")) { const c = ch.codePointAt(0); out.push(c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP1252[c] ?? 0x3f); } return out; };
const I2 = (v) => fsh(v, 2).replace(",", "."), I4 = (v) => fsh(v, 4).replace(",", ".");
function Esc(s) { let o = ""; for (const by of enc1252(s)) { const ch = String.fromCharCode(by); if (ch === "(" || ch === ")" || ch === "\\") o += "\\" + ch; else if (by < 32 || by > 126) o += "\\" + by.toString(8).padStart(3, "0"); else o += ch; } return o; }
function pdfOrdem(p, validator) {
  let c = "";
  const Text = (x, y, size, s, bold) => { c += "BT /" + (bold ? "F2" : "F1") + " " + I2(size) + " Tf " + I2(x) + " " + I2(y) + " Td (" + Esc(s) + ") Tj ET\n"; };
  const TextRotated = (x, y, size, s, deg) => { const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a); c += "BT /F1 " + I2(size) + " Tf " + I4(co) + " " + I4(si) + " " + I4(-si) + " " + I4(co) + " " + I2(x) + " " + I2(y) + " Tm (" + Esc(s) + ") Tj ET\n"; };
  const Rect = (x, y, w, hh) => { c += "0.65 w " + I2(x) + " " + I2(y) + " " + I2(w) + " " + I2(hh) + " re S\n"; };
  const Line = (x1, y1, x2, y2) => { c += "0.7 w " + I2(x1) + " " + I2(y1) + " m " + I2(x2) + " " + I2(y2) + " l S\n"; };
  const DashLine = (x1, y1, x2, y2) => { c += "[3 3] 0 d "; Line(x1, y1, x2, y2); c += "[] 0 d\n"; };
  const Circle = (x, y, r) => { const k = 0.5522847498 * r; c += "0.7 w " + I2(x + r) + " " + I2(y) + " m " + I2(x + r) + " " + I2(y + k) + " " + I2(x + k) + " " + I2(y + r) + " " + I2(x) + " " + I2(y + r) + " c " + I2(x - k) + " " + I2(y + r) + " " + I2(x - r) + " " + I2(y + k) + " " + I2(x - r) + " " + I2(y) + " c " + I2(x - r) + " " + I2(y - k) + " " + I2(x - k) + " " + I2(y - r) + " " + I2(x) + " " + I2(y - r) + " c " + I2(x + k) + " " + I2(y - r) + " " + I2(x + r) + " " + I2(y - k) + " " + I2(x + r) + " " + I2(y) + " c S\n"; };
  const Radio = (x, y, on) => { Circle(x, y, 5); if (on) { Line(x - 3, y - 3, x + 3, y + 3); Line(x - 3, y + 3, x + 3, y - 3); } };
  const Fmt = (v) => (v <= 0 ? "" : f2(v));
  const Short = (s, n) => (!s || s.length <= n ? s : s.slice(0, n - 3) + "...");
  const pad2 = (n) => String(n).padStart(2, "0");
  const DrawLayerPlan = (layer, x, y, w, hh) => {
    Text(x + w / 2 - 24, y + hh + 21, 10, Fmt(p.FinalWidth)); Line(x + 20, y + hh + 12, x + w - 10, y + hh + 12); Line(x + 20, y + hh + 6, x + 20, y + hh + 18); Line(x + w - 10, y + hh + 6, x + w - 10, y + hh + 18);
    const n = Math.max(1, layer.Leaves.length); const gap = n <= 2 ? 16 : 8; const slot = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const leaf = layer.Leaves[i]; if (!leaf) continue; const fx = x + i * (slot + gap); const baseY = y + 24, topY = y + hh - 8; const topW = slot * 0.64; const lx = fx + (slot - topW) / 2, rx = lx + topW;
      Line(lx, topY, rx, topY); Line(fx + 2, baseY, fx + slot - 2, baseY); Line(lx, topY, fx + 2, baseY); Line(rx, topY, fx + slot - 2, baseY); Line(lx, topY - 7, rx, topY - 7); Line(fx + 2, baseY + 7, fx + slot - 2, baseY + 7);
      Text(fx + slot / 2 - 16, topY - 21, 8.5, Fmt(leaf.FinalWidth)); Text(fx + slot / 2 - 17, baseY - 15, 9, Fmt(leaf.RequiredWidth));
      if (i === 0) TextRotated(fx - 6, baseY + 55, 8, Fmt(leaf.TechnicalHeight), 90); else if (i === n - 1) TextRotated(fx + slot + 7, baseY + 55, 8, Fmt(leaf.TechnicalHeight), 90);
      for (let sm = 1; sm <= leaf.Seams; sm++) { const sx = fx + 2 + (slot - 4) * sm / (leaf.Seams + 1); DashLine(sx, baseY + 8, sx, topY - 8); }
    }
  };
  const Section = (layer, front, x, y, w, hh) => {
    Rect(x, y, w, hh); const top = y + hh;
    Text(x + w / 2 - 78, top - 18, 13, "Ordem de Costura Cortina", true); Text(x + w - 92, top - 18, 9, pad2(p.Date.getDate()) + "/" + pad2(p.Date.getMonth() + 1) + "/" + pad2(p.Date.getFullYear() % 100));
    let row = top - 50;
    Text(x + 18, row, 9, "Cliente:", true); Line(x + 68, row - 2, x + 390, row - 2); Text(x + 72, row + 1, 9, p.Client);
    const fx = String(p.Fixing ?? "").toLowerCase(); const isVarao = fx.includes("varão") || fx.includes("bastão");
    Radio(x + 410, row + 2, !isVarao); Text(x + 420, row, 9, "Trilho"); Radio(x + 475, row + 2, isVarao); Text(x + 485, row, 9, "Varão");
    row -= 28;
    Text(x + 18, row, 9, "Frente:", true); Line(x + 62, row - 2, x + 260, row - 2); Text(x + 270, row, 9, "Modelo:", true); Line(x + 318, row - 2, x + 430, row - 2); Text(x + 452, row, 9, "Mts.:", true); Line(x + 482, row - 2, x + 540, row - 2);
    if (front && layer) { Text(x + 66, row + 1, 8.5, layer.Fabric); Text(x + 322, row + 1, 8.5, layer.Model); Text(x + 487, row + 1, 9, Fmt(layer.TotalMeters)); }
    row -= 26;
    Text(x + 18, row, 9, "Forro:", true); Line(x + 55, row - 2, x + 260, row - 2); Text(x + 270, row, 9, "Modelo:", true); Line(x + 318, row - 2, x + 430, row - 2); Text(x + 452, row, 9, "Mts.:", true); Line(x + 482, row - 2, x + 540, row - 2);
    if (!front && layer) { Text(x + 59, row + 1, 8.5, layer.Fabric); Text(x + 322, row + 1, 8.5, layer.Model); Text(x + 487, row + 1, 9, Fmt(layer.TotalMeters)); }
    const bx = x + 18, by = y + 174, bw = 168, bh = 105;
    Rect(bx, by, bw, bh); Line(bx + 62, by + 42, bx + 62, by + bh); Line(bx, by + 42, bx + bw, by + 42);
    Text(bx + 6, by + bh - 18, 7.5, "Qtde de", true); Text(bx + 6, by + bh - 31, 7.5, "Cortina", true); Text(bx + 72, by + bh - 18, 7.5, "Medida final", true); Text(bx + 72, by + bh - 31, 7.5, "da cortina", true);
    Text(bx + 15, by + 54, 10, pad2(p.CurtainQty)); Text(bx + 72, by + 54, 8, "L = " + Fmt(p.FinalWidth)); Text(bx + 72, by + 43, 8, "A = " + Fmt(p.HeightUsed));
    Text(bx + 5, by + 24, 7.5, "Nº partes por", true); Text(bx + 5, by + 12, 7.5, "cortina", true); Text(bx + 116, by + 15, 9, pad2(p.Parts));
    let fy = by - 24;
    Text(bx, fy, 8, "Largura parede =", true); Line(bx + 92, fy - 2, bx + 157, fy - 2); Text(bx + 98, fy + 1, 8, Fmt(p.OriginalWidth)); fy -= 18; Text(bx, fy, 8, "Trespasse =", true); Text(bx + 75, fy, 8, fsh(p.TrespassPercent * 100, 2) + "%  |  Largura técnica = " + Fmt(p.FinalWidth)); fy -= 25;
    Text(bx, fy, 8, "Altura parede =", true); Line(bx + 86, fy - 2, bx + 157, fy - 2); Text(bx + 94, fy + 1, 8, Fmt(p.HeightUsed)); fy -= 28;
    const normal = layer == null || eqi(layer.Direction, "Normal");
    Radio(bx + 6, fy + 2, normal); Text(bx + 16, fy, 8, "Normal"); Radio(bx + 68, fy + 2, !normal); Text(bx + 78, fy, 8, "Invertido"); fy -= 29;
    Text(bx, fy, 8, "Numero de corte:", true); Line(bx + 91, fy - 2, bx + 142, fy - 2); if (layer) Text(bx + 101, fy + 1, 9, pad2(layer.TotalCuts)); fy -= 40;
    Text(bx, fy, 8, "Barra", true); Line(bx + 34, fy - 2, bx + 111, fy - 2); Text(bx + 115, fy, 8, ","); Line(bx + 124, fy - 2, bx + 151, fy - 2); Text(bx + 153, fy, 8, "cm");
    if (layer) { Text(bx + 40, fy + 1, 8.5, String(layer.BarType).toUpperCase()); Text(bx + 126, fy + 1, 8.5, String(rAway(layer.BarCm, 0))); }
    if (layer) DrawLayerPlan(layer, x + 205, y + 78, 330, 190);
    let obs = p.Observations ?? "";
    if (layer && eqi(layer.BarConfig, "Invertida")) obs = (obs.length > 0 ? obs + " | " : "") + "BARRA INVERTIDA";
    if (String(obs).trim()) Text(x + 205, y + 24, 7.5, "Obs.: " + Short(obs, 72));
  };
  Section(p.Front, true, 20, 424, 555, 398);
  Section(p.Lining, false, 20, 22, 555, 398);
  Text(24, 9, 6.5, "Validado por: " + validator + " | Pedido: " + p.OrderNumber + " | Orçamento: " + p.BudgetNumber);
  // BuildPdf: o conteúdo já é ASCII (Esc converte os acentos para octal).
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>", "<< /Length " + c.length + " >>\nstream\n" + c + "\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  const bytes = []; const W = (s) => { for (const b of enc1252(s)) bytes.push(b); };
  W("%PDF-1.4\n%âãÏÓ\n"); const off = [];
  objs.forEach((o, i) => { off.push(bytes.length); W((i + 1) + " 0 obj\n"); W(o); W("\nendobj\n"); });
  const xr = bytes.length; W("xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n"); for (const o of off) W(String(o).padStart(10, "0") + " 00000 n \n");
  W("trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF");
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

// ---------- tela (CurtainWorkOrderForm) ----------
const MODELOS = ["Prega Macho", "Prega Fêmea", "Wave", "Prega Batida", "Prega Tripla Americana"];
const FIX = ["Trilho", "Varão", "Trilho simples", "Trilho duplo", "Trilho suíço", "Varão deslizante", "Outra configuração"];
function combo(id, opts, value) { const inp = h("input", { class: "input", list: "dl_" + id, value: value ?? "", autocomplete: "off" }); return { inp, dl: h("datalist", { id: "dl_" + id }, ...opts.map((o) => h("option", { value: o }))) }; }

register("costura", async (el, arg) => {
  const pedido = decodeURIComponent(arg || "");
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Conferência Técnica — Ordem de Costura " + pedido), h("div", { class: "sub" }, ctx.unit.name))));
  if (!pedido) { el.append(h("div", { class: "card" }, "Selecione um pedido de Cortina sob medida em Pedidos.")); return; }
  const ped = (await api.fetchOrders(pedido, "", ctx.unit)).find((x) => x.NumeroPedido.toLowerCase() === pedido.toLowerCase());
  if (!ped) { el.append(h("div", { class: "card" }, "Pedido " + pedido + " não encontrado.")); return; }
  if (!/cortina sob medida/i.test(ped.Produto)) { await alertBox("A Ordem de Costura está disponível somente para pedidos originados de Cortina sob medida.", "Ordem de Costura"); history.back(); return; }
  const orcamento = ped.NumeroOrcamento, cliente = ped.Cliente;
  if (!(await ctx.beginEdit("ORDEM_COSTURA", orcamento))) { history.back(); return; }
  const sair = () => { window.removeEventListener("hashchange", sair); ctx.endEdit("ORDEM_COSTURA", orcamento); };
  window.addEventListener("hashchange", sair);

  const cfg = await precos(ctx.unit).ensureFresh();
  const lerResumo = async () => { api.clearCachePrefix("quotes:"); const q = (await api.fetchQuotes(orcamento, "TODOS", ctx.unit)).find((x) => x.Numero.toLowerCase() === String(orcamento).toLowerCase()); return q ? q.Resumo : ""; };
  let draft; try { const raw = extractMarker(await lerResumo(), "SJ_CURTAIN_TECH"); draft = raw.trim() ? parseDraft(raw) : novoDraft(); } catch { draft = novoDraft(); }

  const T = (v, im = "decimal") => h("input", { class: "input", value: v ?? "", inputmode: im, autocomplete: "off" });
  const ro = (v) => h("input", { class: "input", value: v ?? "", readonly: true });
  const lbl = (t, x) => h("label", { class: "lbl" }, t, x);
  const width = T(F(draft.FinalWidth)), hl = T(F(draft.HeightLeft)), hc = T(F(draft.HeightCenter)), hr = T(F(draft.HeightRight)), qty = T(String(draft.CurtainQty), "numeric"), leafs = T("", "text");
  const heightRule = combo("hrule", ["Maior altura", "Altura definida pelo usuário"], "Maior altura"), parts = combo("parts", ["1", "2", "3", "4"], String(draft.Parts)), fixing = combo("fix", FIX, draft.Fixing);
  const fabNames = [...cfg.fabrics.keys()];
  const frontFabric = combo("ffab", fabNames, draft.FrontFabric), liningFabric = combo("lfab", fabNames, draft.LiningFabric);
  const frontModel = combo("fmod", MODELOS, draft.FrontModel), liningModel = combo("lmod", ["Reto", ...MODELOS], draft.LiningModel);
  const frontDir = combo("fdir", ["Normal", "Invertido"], draft.FrontDirection), liningDir = combo("ldir", ["Normal", "Invertido"], draft.LiningDirection);
  const frontBar = combo("fbar", ["Sem", "Simples", "Dupla", "Falsa"], draft.FrontBarType), liningBar = combo("lbar", ["Sem", "Simples", "Dupla", "Falsa"], draft.LiningBarType);
  const frontBarCm = T(F(draft.FrontBarCm)), liningBarCm = T(F(draft.LiningBarCm));
  const frontBarCfg = combo("fbcfg", ["Normal", "Invertida"], draft.FrontBarConfig), liningBarCfg = combo("lbcfg", ["Normal", "Invertida"], draft.LiningBarConfig);
  const obs = h("textarea", { class: "input", rows: 2 }, draft.Observations || "");
  const g2 = (...k) => h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } }, ...k);
  const dls = [heightRule, parts, fixing, frontFabric, liningFabric, frontModel, liningModel, frontDir, liningDir, frontBar, liningBar, frontBarCfg, liningBarCfg].map((x) => x.dl);
  el.append(h("div", { class: "card" }, ...dls,
    g2(lbl("Cliente", ro(cliente)), lbl("Pedido", ro(pedido))), lbl("Orçamento", ro(orcamento)),
    g2(lbl("Largura final", width), lbl("Regra altura", heightRule.inp)), g2(lbl("Alt. Esq.", hl), lbl("Alt. Centro", hc)), g2(lbl("Alt. Dir.", hr), lbl("Qtd. cortinas", qty)),
    g2(lbl("Partes", parts.inp), lbl("Larguras folhas", leafs)), lbl("Fixação", fixing.inp),
    h("h3", { style: { margin: "12px 0 0" } }, "Frente"), lbl("Tecido", frontFabric.inp), g2(lbl("Modelo", frontModel.inp), lbl("Sentido", frontDir.inp)), g2(lbl("Barra", frontBar.inp), lbl("Barra (cm)", frontBarCm)), lbl("Configuração da barra", frontBarCfg.inp),
    h("h3", { style: { margin: "12px 0 0" } }, "Forro"), lbl("Tecido", liningFabric.inp), g2(lbl("Modelo", liningModel.inp), lbl("Sentido", liningDir.inp)), g2(lbl("Barra", liningBar.inp), lbl("Barra (cm)", liningBarCm)), lbl("Configuração da barra", liningBarCfg.inp),
    lbl("Observações", obs)));

  const tabNames = ["FRENTE", "FORRO", "PLANO DE CORTE"]; let tabAtual = 0;
  const tabBtns = tabNames.map((n, i) => h("button", { class: "btn" + (i === 0 ? " dark" : ""), onclick: () => mostrar(i) }, n));
  const pagina = h("div", { class: "card", style: { overflowX: "auto" } });
  const status = h("div", { style: { color: "darkred", fontWeight: "600", margin: "8px 0", whiteSpace: "pre-line" } });
  const calc = h("button", { class: "btn" }, "CALCULAR / ATUALIZAR"), validate = h("button", { class: "btn", style: { background: "rgb(37,132,75)", color: "#fff" } }, "VALIDAR ORDEM"), pdf = h("button", { class: "btn dark", disabled: true }, "GERAR PDF");
  el.append(h("div", { class: "btns grid2", style: { marginTop: "10px" } }, ...tabBtns), pagina, status, h("div", { class: "btns grid2" }, calc, validate, pdf));

  let plan = null, orderValidated = false;
  function mostrar(i) {
    tabAtual = i; tabBtns.forEach((b, k) => b.classList.toggle("dark", k === i)); pagina.innerHTML = ""; if (!plan) return;
    if (i === 2) pagina.append(planoCorte(plan));
    else pagina.append(h("pre", { style: { whiteSpace: "pre-wrap", fontFamily: "Consolas, ui-monospace, monospace", fontSize: "13px", margin: 0 } }, textoAba(plan, i === 0 ? plan.Front : plan.Lining, cfg)));
  }
  function readDraft() {
    Object.assign(draft, { FinalWidth: N(width.value), HeightLeft: N(hl.value), HeightCenter: N(hc.value), HeightRight: N(hr.value), CurtainQty: Math.max(1, Math.trunc(N(qty.value))), Parts: Math.max(1, Math.trunc(N(parts.inp.value))), FrontFabric: frontFabric.inp.value.trim(), LiningFabric: liningFabric.inp.value.trim(), FrontModel: frontModel.inp.value, LiningModel: liningModel.inp.value, FrontDirection: frontDir.inp.value, LiningDirection: liningDir.inp.value, FrontBarType: frontBar.inp.value, LiningBarType: liningBar.inp.value, FrontBarCm: N(frontBarCm.value), LiningBarCm: N(liningBarCm.value), FrontBarConfig: frontBarCfg.inp.value, LiningBarConfig: liningBarCfg.inp.value, Fixing: fixing.inp.value, Observations: obs.value });
  }
  const parseLeaves = () => { const s = leafs.value.trim(); if (!s) return null; return s.split(/[;/|]/).filter(Boolean).map(N).filter((v) => v > 0); };
  async function recalc() {
    try {
      readDraft(); orderValidated = false; plan = Calculate(draft, cfg, pedido, orcamento, cliente, heightRule.inp.value, parseLeaves()); mostrar(tabAtual);
      const hasNumbers = plan.Front != null && plan.Front.TotalMeters > 0 && (plan.Lining == null || plan.Lining.TotalMeters > 0);
      validate.disabled = !(plan.Pending.length === 0 && hasNumbers); pdf.disabled = true;
      status.textContent = plan.Pending.length ? "PENDENTE: " + plan.Pending.join("; ") : !isValid(plan) ? "CALCULADO COM ALERTA — confira e valide manualmente se tecnicamente correto." : "Plano calculado. Confira e valide antes do PDF.";
    } catch (ex) { plan = null; orderValidated = false; validate.disabled = true; pdf.disabled = true; status.textContent = "ERRO NO CÁLCULO: " + friendly(ex); await alertBox("Não foi possível calcular a Ordem de Costura.\n\n" + friendly(ex), "Ordem de Costura"); }
  }
  calc.onclick = recalc;
  validate.onclick = async () => {
    await recalc();
    if (!plan) return alertBox("O cálculo não foi concluído. Verifique os campos da conferência.", "Ordem de Costura");
    if (plan.Pending.length) return alertBox("NÃO FOI POSSÍVEL CALCULAR ESTE PLANO POR FALTA DE DADOS.\n\nPendências:\n- " + plan.Pending.join("\n- "), "Ordem de Costura");
    const manual = !isValid(plan);
    if (manual) { const av = [...(plan.Front?.Warnings || []), ...(plan.Lining?.Warnings || [])]; if (!(await confirmBox("O plano FOI CALCULADO, mas possui alerta técnico:\n\n- " + av.join("\n- ") + "\n\nSe você conferiu tecnicamente e deseja assumir o corte, clique SIM para VALIDAR MANUALMENTE e liberar o PDF.", "Validação manual da Ordem"))) return; }
    validate.disabled = true;
    try {
      const resumo = await lerResumo(); const agora = new Date();
      const payload = "Status=" + (manual ? "VALIDADA_MANUAL" : "VALIDADA") + "\nValidadoPor=" + ctx.session.nome + "\nValidadoEm=" + agora.toISOString() + "\n" + snapshot(plan, draft);
      await api.patchQuote(orcamento, { resumo: upsertMarker(resumo, "SJ_CURTAIN_ORDER", payload), alterado_por_nome: ctx.session.nome, alterado_em: agora.toISOString() });
      const p2 = (n) => String(n).padStart(2, "0");
      orderValidated = true; pdf.disabled = false; status.textContent = (manual ? "ORDEM VALIDADA MANUALMENTE por " : "ORDEM VALIDADA por ") + ctx.session.nome + " em " + p2(agora.getDate()) + "/" + p2(agora.getMonth() + 1) + "/" + agora.getFullYear() + " " + p2(agora.getHours()) + ":" + p2(agora.getMinutes()) + ".";
    } catch (ex) { await alertBox("Não foi possível validar a Ordem de Costura.\n\n" + friendly(ex), "Ordem de Costura"); }
    finally { validate.disabled = !plan || plan.Pending.length > 0; }
  };
  pdf.onclick = async () => {
    if (!plan || !orderValidated) return alertBox("Valide a ordem antes de gerar o PDF.");
    const nome = "Ordem_Costura_" + pedido + ".pdf"; const blob = pdfOrdem(plan, ctx.session.nome); const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: nome }); document.body.append(a); a.click(); a.remove();
    if (await confirmBox("PDF gerado com sucesso:\n\n" + nome + "\n\nDeseja abrir o PDF agora para imprimir (escolhendo a impressora e as páginas)?", "Ordem de Costura")) {
      try { const f = new File([blob], nome, { type: "application/pdf" }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: nome }); else window.open(url, "_blank"); } catch {}
    }
  };
  await recalc();
});
