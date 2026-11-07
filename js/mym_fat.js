// MyManagerFaturamento.Ler: faturamento do mês e do dia direto no myManager da loja (pela ponte), igual ao Início do PC.
import { consulta } from "./mym.js";
import { precos } from "./precos.js";

const p2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
function Dec(s) { const t = String(s ?? "").trim(); if (/^[-+]?\d+(\.\d+)?$/.test(t)) return Number(t); const v = Number(t.replace(/\./g, "").replace(",", ".")); return isFinite(v) ? v : 0; }
const Int = (s) => { const t = String(s ?? "").trim(); return /^[-+]?\d+$/.test(t) ? Number(t) : 0; };
function AfterEq(line) { const p = line.indexOf("="); if (p >= 0) return line.slice(p + 1).trim(); const m = /^\S+\s+(.*)$/.exec(line); return m ? m[1].trim() : ""; }

// FaSalesConfig: empresa e vendedores do myManager da FA Colchões (Valores / Produtos).
async function faConfig(unit) {
  const p = await precos(unit).ensureFresh();
  for (const r of p.rowsOfGroup("FA COLCHÕES VENDAS")) if (String(r.i).toLowerCase() === "vendedores mymanager") {
    const company = Math.trunc(Number(String(r.raw1 ?? r.v1).replace(",", ".")) || 0), sellers = [];
    for (const t of String(r.info ?? "").split(/[;, ]/)) { const n = Int(t.trim()); if (n > 0 && !sellers.includes(n)) sellers.push(n); }
    return { company, sellers };
  }
  return { company: 0, sellers: [] };
}

export async function lerFaturamento(unit, referencia = new Date(), timeoutMs = 12000) {
  const r = { Ok: false, TotalMes: 0, TotalHoje: 0, QuantidadeMes: 0, Diario: new Array(31).fill(0), Fonte: "", Erro: "" };
  try {
    let ids, fonte, empresa = 0;
    if (unit.code === "FA_COLCHOES") { const c = await faConfig(unit); if (!c.sellers.length) throw new Error("Vendedores do myManager da FA Colchões não cadastrados em Valores / Produtos."); ids = c.sellers.join(","); fonte = "myManager • FA Colchões"; empresa = c.company; }
    else if (unit.code === "PERSONALIZADOS") { ids = "38"; fonte = "myManager • Junior Loja"; }
    else { ids = "36,2"; fonte = "myManager • Yuri Decor + Nelson"; }
    const idList = []; for (const t of ids.split(/[,; ]/)) { const n = Int(t.trim()); if (n > 0) idList.push(String(n)); }
    if (!idList.length) throw new Error("Nenhum vendedor do myManager cadastrado para esta unidade.");
    ids = idList.join(","); const emp = empresa > 0 ? " AND COD_EMP=" + empresa : "";
    const iniMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1), fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 1);
    const f1 = ymd(iniMes), f2 = ymd(fim), hoje = ymd(referencia);
    const sql = "SELECT COUNT(*) AS SJ_QTD, COALESCE(SUM(TOTAL_VEN),0) AS SJ_TOTAL FROM VENDAS WHERE COD_VEND IN (" + ids + ")" + emp + " AND FLAGFATURADO='S' AND CANCELADA_VEN=0 AND DATA_VEN >= '" + f1 + "' AND DATA_VEN < '" + f2 + "';\r\n" +
      "SELECT COALESCE(SUM(TOTAL_VEN),0) AS SJ_HOJE FROM VENDAS WHERE COD_VEND IN (" + ids + ")" + emp + " AND FLAGFATURADO='S' AND CANCELADA_VEN=0 AND DATA_VEN='" + hoje + "';\r\n" +
      "SELECT EXTRACT(DAY FROM DATA_VEN) AS SJ_DIA, COALESCE(SUM(TOTAL_VEN),0) AS SJ_DIA_TOTAL FROM VENDAS WHERE COD_VEND IN (" + ids + ")" + emp + " AND FLAGFATURADO='S' AND CANCELADA_VEN=0 AND DATA_VEN >= '" + f1 + "' AND DATA_VEN < '" + f2 + "' GROUP BY EXTRACT(DAY FROM DATA_VEN) ORDER BY 1;";
    const output = await consulta(sql, timeoutMs);
    if (/SQLSTATE/i.test(output)) throw new Error(output.trim());
    let dia = 0;
    for (const raw of output.replace(/\r/g, "").split("\n")) { const line = raw.trim(), up = line.toUpperCase();
      if (up.startsWith("SJ_QTD")) r.QuantidadeMes = Int(AfterEq(line));
      else if (up.startsWith("SJ_TOTAL")) r.TotalMes = Dec(AfterEq(line));
      else if (up.startsWith("SJ_HOJE")) r.TotalHoje = Dec(AfterEq(line));
      else if (up.startsWith("SJ_DIA ") || up.startsWith("SJ_DIA=")) dia = Int(AfterEq(line));
      else if (up.startsWith("SJ_DIA_TOTAL") && dia >= 1 && dia <= 31) r.Diario[dia - 1] = Dec(AfterEq(line)); }
    r.Ok = true; r.Fonte = fonte; return r;
  } catch (e) { r.Ok = false; r.Erro = e.message; return r; }
}
