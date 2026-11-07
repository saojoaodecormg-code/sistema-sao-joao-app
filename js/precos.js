// Cópia do CurtainConfig.cs: a tabela valores_produtos da nuvem é a única fonte de preços e parâmetros.
// Os padrões abaixo só valem para linhas que ainda não existem no cadastro (igual ao PC).
import * as api from "./api.js";

export const G = { Fabric: "TECIDO", Consumption: "CONSUMO CORTINA", CurtainCalc: "CÁLCULO CORTINA", Poly: "COBERTURA POLICARBONATO", CurtainPrice: "FORMAÇÃO PREÇO CORTINA", CurtainRules: "CORTINA REGRAS", Negotiation: "NEGOCIAÇÃO", Blinds: "PERSIANAS", Wallpaper: "PAPEL DE PAREDE", Rug: "TAPETE", Mosquito: "TELA MOSQUITEIRA", AwningHardware: "TOLDO FERRAGEM", AwningWeld: "TOLDO SOLDA", Awning: "TOLDO PARÂMETROS", AwningMaterial: "TOLDO / TELA", Control: "CONTROLE" };
const fmt2 = (v) => v.toFixed(2).replace(".", ",");
export const mosquitoKey = (w, h) => fmt2(w) + " x " + fmt2(h);
export const awningSizeKey = (s) => fmt2(s) + " m";
export const MOSQ_W = [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2], MOSQ_H = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
const MOSQ_P = [[185.31, 204.84, 224.36, 243.89, 263.42, 282.95, 302.48, 322.01], [195.07, 215.24, 235.41, 255.58, 275.75, 295.92, 316.09, 336.26], [204.84, 225.65, 246.46, 267.27, 288.08, 308.89, 329.7, 350.52], [214.6, 236.05, 257.51, 278.96, 300.41, 321.86, 343.32, 364.77], [224.36, 246.46, 268.55, 290.65, 312.74, 334.83, 356.93, 379.02], [234.13, 256.86, 279.6, 302.33, 325.07, 347.81, 370.54, 393.28], [243.89, 267.27, 290.65, 314.02, 337.4, 360.78, 384.15, 407.53], [253.66, 277.68, 301.69, 325.71, 349.73, 373.75, 397.77, 421.78]];

export function num(s) {
  if (typeof s === "number") return s; s = String(s ?? "").trim(); if (!s) return 0;
  const v = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  if (Number.isNaN(v)) throw new Error("Valor numérico inválido: " + s); return v;
}
const safe = (s) => { try { return num(s); } catch { return 0; } };

function buildDefaults() {
  const d = []; const D = (g, i, v1, v2, info) => d.push({ g, i, v1, v2, info });
  for (const s of ["Linhão Corttex|3|62,5|FLAME / LINHO", "Voil Flame Corttex - Marfim|3,3|32|FLAME / LINHO", "Voil Flame Corttex - Prata|3,3|32|FLAME / LINHO", "Voil Flame Corttex - Bege|3,3|32|FLAME / LINHO", "Voil Flame Monaco Duma - Bege|3|32|FLAME / LINHO", "Voil Flame Monaco - Cinza|3,3|32|FLAME / LINHO", "Voil Flame Monaco - Areia|3,3|32|FLAME / LINHO", "Voil Flame Monaco - Linho|3,3|32|FLAME / LINHO", "Corta Luz Bella/Corttex - Branco|3|45|CORTA LUZ 70%", "Corta Luz Bella/Corttex - Bege|3|45|CORTA LUZ 70%", "Blackout Bella/Corttex - Branco/Branco|2,8|55|BLACKOUT", "Blackout Bella/Corttex - Branco/Bege|2,8|55|BLACKOUT", "Microfibra Bella/Corttex - Cinza|3|16|MICROFIBRA", "Microfibra Bella/Corttex - Off White|3|16|MICROFIBRA", "Microfibra Bella/Corttex - Marfim|3|16|MICROFIBRA", "Microfibra Bella/Corttex - Cinza Escuro|3|16|MICROFIBRA", "Microfibra Bella/Corttex - Areia|3|16|MICROFIBRA"]) { const p = s.split("|"); D(G.Fabric, p[0], num(p[1]), num(p[2]), p[3]); }
  D(G.Consumption, "Econômica", 1.8, 0, ""); D(G.Consumption, "Básica", 2.0, 0, ""); D(G.Consumption, "Normal", 2.2, 0, ""); D(G.Consumption, "Padrão", 2.6, 0, ""); D(G.Consumption, "Especial", 3.3, 0, "");
  for (const s of ["Fio urso|D73|2,5|un", "Entretela|D74|3,25|m", "Cordão Wave|D75|9,5|m", "Rodízio|D76|0,5|un", "Ilhós Cromado|D77|3,95|un", "Ilhós Tinto|D78|1,65|un", "Confecção|D79|20|m", "Instalação|D80|65|serviço por cortina (planilha E101)", "Trespasso Trilho|D82|0,06|m", "Dobra Lateral|D83|0,36|m", "Trilho Suíço Duplo|H71|60|m", "Trilho Premium Duplo|H72|78|m", "Bastão Deslizante|H73|60|m", "Suporte Trilho / Gesso|H74|8|un", "Teto Normal|H75|3|un", "Trilho Motorizado|H76|0|valor por cortina", "Bastão 28 Cromo|H77|39,9|m", "Bastão 28 Tinto|H78|38,25|m", "Suporte Bastão Cromado|H79|14,2|un", "Suporte Bastão Tinto|H80|12,4|un"]) { const p = s.split("|"); D(G.CurtainCalc, p[0], num(p[2]), 0, p[3] + " | " + p[1]); }
  for (const s of ["Policarbonato placa|F31|1800|placa", "Capa barra 6m|F32|67,1025|barra", "Borracha base 1m|F33|9,75|m", "Borracha dupla 1m|F34|4,940208333333333|m", "Brocante und|F35|1,4|un", "Vedação superior|F36|6,66|m", "Vedação inferior|F37|5,4|m", "Acabamento ponta|F38|99|barra", "Acabamento arremate|F39|99|barra", "Dupla F|F40|7,5|m", "Cola / silicone|F41|30|un", "Montagem HH|F42|30|hora", "Instalação|F43|4,5|unidade cálculo", "Administração|F44|0,05|percentual decimal (0,05 = 5%)", "Distância entrega KM|F45|1|km", "Metalon KG|F46|28,6|kg", "Pintura ML|F47|10|m linear", "Rufo ML|F50|50|m linear", "Calha ML|F51|85|m linear", "Ponto de solda|F52|5|ponto", "Frete estrutura KM|F53|2,2|km"]) { const p = s.split("|"); D(G.Poly, p[0], num(p[2]), 0, p[3] + " | " + p[1]); }
  D(G.CurtainPrice, "Acréscimo sobre subtotal (%)", 11, 0); D(G.CurtainPrice, "Arredondamento a prazo (R$)", 10, 0); D(G.CurtainPrice, "Desconto à vista (%)", 5, 0);
  D(G.CurtainRules, "Barra acabada (m)", 0.2, 0); D(G.CurtainRules, "Fator barra dupla", 2.1, 0); D(G.CurtainRules, "Fator barra simples", 1.1, 0); D(G.CurtainRules, "Folga corte invertido (m)", 0.03, 0);
  D(G.CurtainRules, "Espaçamento suporte trilho (m)", 0.6, 0); D(G.CurtainRules, "Recuo suporte trilho (m)", 0.2, 0); D(G.CurtainRules, "Espaçamento rodízio (m)", 0.05, 0); D(G.CurtainRules, "Espaçamento ilhós (m)", 0.14, 0);
  D(G.CurtainRules, "Peças extras rodízio / ilhós (un)", 4, 0); D(G.CurtainRules, "Falsa barra 1 parte (fator)", 2, 0); D(G.CurtainRules, "Falsa barra 2 ou mais partes (fator)", 1.5, 0); D(G.CurtainRules, "Falsa barra 3 partes Econômica tecido 1 (fator)", 1.33, 0);
  for (const m of ["Persianas", "Toldo retrátil", "Cobertura policarbonato", "Tela mosquiteira", "Papel de parede", "Tapete personalizado"]) D(G.Negotiation, m + " (%)", 11.5, 0);
  D(G.Blinds, "Fator administração Persol", 1.65, 0); D(G.Blinds, "Instalação por unidade (R$)", 65, 0);
  D(G.Wallpaper, "Fator venda sobre custo", 2, 0); D(G.Wallpaper, "Montagem por bobina (R$)", 90, 0);
  D(G.Rug, "Liso padrão (R$/m²)", 558, 0); D(G.Rug, "Liso fora do padrão (R$/m²)", 620, 0); D(G.Rug, "Fusão padrão (R$/m²)", 757, 0); D(G.Rug, "Fusão fora do padrão (R$/m²)", 890, 0); D(G.Rug, "Frete padrão (R$)", 110, 0);
  for (let hi = 0; hi < MOSQ_H.length; hi++) for (let wi = 0; wi < MOSQ_W.length; wi++) D(G.Mosquito, mosquitoKey(MOSQ_W[wi], MOSQ_H[hi]), MOSQ_P[hi][wi], 0);
  const fs = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6], fv = [515, 572, 627, 682, 736, 813, 868, 1294, 1371, 1642], fp = [574, 638, 699, 761, 821, 907, 968, 1443, 1529, 1831];
  fs.forEach((s, i) => D(G.AwningHardware, awningSizeKey(s), fv[i], fp[i]));
  for (const s of ["Até 1,50 m|135", "Até 2,50 m|145", "Até 3,50 m|163", "Até 4,50 m|228", "5,00 m|319", "6,00 m|484"]) { const p = s.split("|"); D(G.AwningWeld, p[0], num(p[1]), 0); }
  D(G.Awning, "Frete ferragem até 3,50 m (R$)", 300, 0); D(G.Awning, "Frete ferragem acima de 3,50 m (R$)", 380, 0); D(G.Awning, "Frete material (R$)", 130, 0); D(G.Awning, "Montagem por m² (R$)", 27, 0); D(G.Awning, "Mão de obra por toldo (R$)", 50, 0);
  for (const s of ["Lona PVC - 1,40 m|25|42", "Lona PVC - 2,00 m|36|60", "Tela Solar 3% - 2,50 m|87,5|145", "Tela Solar 3% - 3,00 m|104|172", "Tela Solar 5% - 2,50 m|69|114", "Tela Solar 5% - 3,00 m|82|136"]) { const p = s.split("|"); D(G.AwningMaterial, p[0], num(p[1]), num(p[2])); }
  D("TIPO PREGA", "Wave", 2.6, 0); for (const pr of ["Prega Macho", "Prega Fêmea", "Prega Batida", "Prega Tripla Americana"]) D("TIPO PREGA", pr, 0, 0);
  D("MODELO TECNICO", "Reto", 1, 0); D("CORTINA TECNICA", "Acabamento superior (m)", 0.1, 0); D("CORTINA TECNICA", "Margem lateral por folha (m)", 0, 0); D("CORTINA TECNICA", "Margem segurança corte (m)", 0.05, 0); D("CORTINA TECNICA", "Tolerância metragem (m)", 0.1, 0);
  D("BARRA TECNICA", "Sem", 0, 0); D("BARRA TECNICA", "Simples", 1, 0); D("BARRA TECNICA", "Dupla", 2, 0); D("BARRA TECNICA", "Falsa", 0, 0); D("BARRA ESPECIAL", "Invertida", 0, 0);
  return d;
}
export const DEFAULTS = buildDefaults();
const key = (g, i) => (String(g || "").trim() + "|" + String(i || "").trim()).toLowerCase();

export class Precos {
  constructor(unit) { this.unit = unit; this.rows = new Map(); this.order = []; this.loadedAt = 0; this.fabrics = new Map(); this.consumption = new Map(); this.internal = new Map(); this.polyInternal = new Map(); }
  async ensureFresh() { if (Date.now() - this.loadedAt > 60000) await this.reload(); return this; }
  async reload() {
    const arr = await api.fetchPriceRows(this.unit === "PERSONALIZADOS" ? "PERSONALIZADOS" : "DECOR");
    this.rows.clear(); this.order = [];
    for (const r of arr || []) { const k = key(r.grupo, r.item); if (!this.rows.has(k)) this.order.push(k); this.rows.set(k, { g: r.grupo.trim(), i: r.item.trim(), raw1: r.valor1 == null ? "" : String(r.valor1), v1: Number(r.valor1 || 0), v2: Number(r.valor2 || 0), info: r.info || "" }); }
    this.loadedAt = Date.now(); this.project();
  }
  get(g, i) { return this.rows.get(key(g, i)) || null; }
  def(g, i) { return DEFAULTS.find((d) => key(d.g, d.i) === key(g, i)) || null; }
  has(g, i) { return !!this.get(g, i); }
  param(g, i) { const r = this.get(g, i) || this.def(g, i); if (!r) throw new Error("Parâmetro não cadastrado em Valores / Produtos: " + g + " / " + i); return safe(r.v1); }
  param2(g, i) { const r = this.get(g, i) || this.def(g, i); if (!r) throw new Error("Parâmetro não cadastrado em Valores / Produtos: " + g + " / " + i); return safe(r.v2); }
  rowsOfGroup(g) { const out = [], seen = new Set(); for (const k of this.order) { const r = this.rows.get(k); if (r.g.toLowerCase() === g.toLowerCase()) { out.push(r); seen.add(r.i.toLowerCase()); } } for (const d of DEFAULTS) if (d.g.toLowerCase() === g.toLowerCase() && !seen.has(d.i.toLowerCase())) out.push(d); return out; }
  project() {
    this.fabrics.clear(); this.consumption.clear(); this.internal.clear(); this.polyInternal.clear();
    const hasFabric = this.order.some((k) => this.rows.get(k).g.toLowerCase() === G.Fabric.toLowerCase());
    const cellOf = (info) => { const i = String(info || "").lastIndexOf("|"); return i >= 0 ? info.slice(i + 1).trim() : ""; };
    for (const d of DEFAULTS) {
      const r = this.get(d.g, d.i) || d;
      if (d.g === G.Fabric) { if (!hasFabric) this.fabrics.set(d.i, { width: safe(r.v1), price: safe(r.v2), category: r.info }); }
      else if (d.g === G.Consumption) this.consumption.set(d.i, safe(r.v1));
      else if (d.g === G.CurtainCalc) this.internal.set(d.i, { cell: cellOf(d.info), value: safe(r.v1) });
      else if (d.g === G.Poly) this.polyInternal.set(d.i, { cell: cellOf(d.info), value: safe(r.v1), info: d.info });
    }
    for (const k of this.order) { const r = this.rows.get(k);
      if (r.g.toLowerCase() === G.Fabric.toLowerCase()) this.fabrics.set(r.i, { width: safe(r.v1), price: safe(r.v2), category: r.info });
      else if (r.g.toLowerCase() === G.Consumption.toLowerCase()) this.consumption.set(r.i, safe(r.v1)); }
  }
  negotiationPct(module) { return this.param(G.Negotiation, module + " (%)"); }
}
const cache = new Map();
export function precos(unit) { const c = unit.code === "PERSONALIZADOS" ? "PERSONALIZADOS" : "DECOR"; if (!cache.has(c)) cache.set(c, new Precos(c)); return cache.get(c); }
export const pctText = (p) => (Math.round(p * 100) / 100).toLocaleString("pt-BR") + "%";
