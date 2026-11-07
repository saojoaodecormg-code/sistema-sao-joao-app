// Cobertura em policarbonato: no computador o cálculo é feito pela planilha Policarbonato.xlsx (aba ORC 01)
// pelo LegacyExcelBridge.ps1. Aqui as mesmas fórmulas rodam no celular, preenchidas nas mesmas células.
import * as mod from "./policarbonato_formulas.js";
import { planilha, XErr } from "./planilha.js";
const W = "ORC 01!";
export function polySets(polyValues, x) {
  const s = {};
  const T = (a, v) => (s[W + a] = String(v ?? "")), Nn = (a, v) => (s[W + a] = Number(v) || 0), X = (a) => (s[W + a] = "X"), CL = (a) => (s[W + a] = null);
  T("D4", x.cliente); T("P4", x.vendedor); T("C10", x.obs);
  Nn("D14", Math.max(1, x.qtdEstrut)); Nn("F15", x.fundo); Nn("F16", x.frente); Nn("F17", x.le); Nn("F18", x.ld);
  Nn("H16", Math.max(0, x.trelicaQtd)); Nn("H18", x.trelicaTam); Nn("I16", Math.max(0, x.posteQtd)); Nn("I18", x.posteTam);
  for (const { cell, value } of polyValues) if (cell) Nn(cell, value);
  for (const c of ["J16", "K16", "L16"]) CL(c); X(x.estrutura === "Reta" ? "J16" : x.estrutura === "Curva" ? "K16" : "L16");
  for (const c of ["J19", "K19", "L19"]) CL(c); X(x.inclinacao === "Padrão" ? "J19" : x.inclinacao === "Média" ? "K19" : "L19");
  for (const c of ["M16", "N16", "O16", "P16"]) CL(c); X(x.rufo === "LD" ? "N16" : x.rufo === "LE" ? "O16" : x.rufo === "Fundo" ? "P16" : "M16");
  for (const c of ["M19", "N19", "O19", "P19"]) CL(c); X(x.calha === "LD" ? "N19" : x.calha === "LE" ? "O19" : x.calha === "Frente" ? "P19" : "M19");
  for (const c of ["AQ16", "AR16", "AS16"]) CL(c); if (x.corP === "Cinza") X("AQ16"); else if (x.corP === "Branca") X("AR16"); else { T("AS15", x.corP); X("AS16"); }
  for (const c of ["AQ19", "AR19", "AS19"]) CL(c); if (x.corE === "Cinza") X("AQ19"); else if (x.corE === "Branca") X("AR19"); else { T("AS18", x.corE); X("AS19"); }
  return s;
}
export function calculatePoly(polyValues, x) {
  const p = planilha(mod, polySets(polyValues, x));
  const num = (a) => { const v = p.get(W + a); if (v instanceof XErr) throw new Error("A planilha de policarbonato devolveu " + v.code + " em " + a + ". Confira as medidas e os valores em Valores / Produtos."); return typeof v === "number" ? v : Number(v) || 0; };
  return { Final: num("P53"), Materiais: num("AR43"), Estrutura: num("AR47"), Adm: num("AR52"), CalhaRufo: num("AR49"), Area: num("E60"), Peso: num("P64"), Cor: String(p.get(W + "D62") ?? ""), get: p.get };
}
