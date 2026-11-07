// MyManagerPedidosSync.cs: vendas faturadas do mês no myManager (somente leitura), lidas pela ponte da loja.
// Aparecem em Pedidos como MYM-PED-<código>, igual ao computador, e não são gravadas na nuvem.
import { consulta } from "./mym.js";
import { precos } from "./precos.js";

const p2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const q3 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
function MymVal(line) { const p = line.indexOf("="); if (p >= 0) return line.slice(p + 1).trim(); const m = /^\S+\s+(.*)$/.exec(line); return m ? m[1].trim() : ""; }
function MymDec(s) { const t = String(s ?? "").trim(); if (/^[-+]?\d+(\.\d+)?$/.test(t)) return Number(t); const v = Number(t.replace(/\./g, "").replace(",", ".")); return isFinite(v) ? v : 0; }
const I = (s) => { const n = parseInt(String(s).trim(), 10); return isFinite(n) ? n : 0; };
const sw = (l, k) => l.toUpperCase().startsWith(k);
function data(v) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v) || /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v); if (!m) return null; return m[1].length === 4 ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[3], +m[2] - 1, +m[1]); }

export async function LerVendasMyManagerPeriodo(a, b) {
  a = new Date(a.getFullYear(), a.getMonth(), a.getDate()); b = new Date(b.getFullYear(), b.getMonth(), b.getDate()); if (b <= a) b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1);
  const f1 = ymd(a), f2 = ymd(b);
  const sql = "SELECT V.COD_VEN SJ_COD_VEN,V.COD_EMP SJ_COD_EMP,V.COD_VEND SJ_COD_VEND,V.DATA_VEN SJ_DATA,VD.NOME_VEND SJ_VENDEDOR,C.NOME_CLI SJ_CLIENTE,C.TELRES_CLI SJ_TEL1,C.TELCOM_CLI SJ_TEL2,C.ENDRES_CLI SJ_END,C.BAIRES_CLI SJ_BAIRRO,C.CIDRES_CLI SJ_CIDADE,V.TOTAL_VEN SJ_TOTAL,I.COD_PRO SJ_COD_PRO,P.NOME_PRO SJ_PRODUTO,I.QUANT SJ_QUANT,I.VALOR SJ_VALOR FROM VENDAS V JOIN VENDEDOR VD ON VD.COD_VEND=V.COD_VEND LEFT JOIN CLIENTE C ON C.COD_CLI=V.COD_CLI JOIN ITENS_VENDA I ON I.COD_VEN=V.COD_VEN LEFT JOIN PRODUTO P ON P.COD_PRO=I.COD_PRO WHERE ((V.COD_EMP=1 AND V.COD_VEND IN (2,36)) OR V.COD_VEND=38) AND V.FLAGFATURADO='S' AND V.CANCELADA_VEN=0 AND V.DATA_VEN>='" + f1 + "' AND V.DATA_VEN<'" + f2 + "' ORDER BY V.COD_VEN,I.COD_PRO;";
  const output = await consulta(sql, 15000);
  const map = new Map(); let cur = null, item = null;
  for (const raw of output.replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); if (!l) continue; const v = MymVal(l), k0 = l.split(/[ \t=]+/)[0].toUpperCase();
    if (k0 === "SJ_COD_VEN") { const id = parseInt(v, 10); if (!isFinite(id)) continue; cur = map.get(id); if (!cur) { cur = { CodVen: id, CodEmp: 0, CodVend: 0, Data: null, Vendedor: "", Cliente: "", Telefone: "", Endereco: "", Bairro: "", Cidade: "", Total: 0, Itens: [] }; map.set(id, cur); } item = { CodPro: 0, Nome: "", Quant: 0, Valor: 0 }; cur.Itens.push(item); }
    else if (cur) {
      if (sw(l, "SJ_COD_EMP")) cur.CodEmp = I(v); else if (sw(l, "SJ_COD_VEND")) cur.CodVend = I(v); else if (sw(l, "SJ_DATA")) { const d = data(v); if (d) cur.Data = d; }
      else if (sw(l, "SJ_VENDEDOR")) cur.Vendedor = v; else if (sw(l, "SJ_CLIENTE")) cur.Cliente = v === "<null>" ? "" : v;
      else if (sw(l, "SJ_TEL1")) { if (v !== "<null>" && v.length) cur.Telefone = v; } else if (sw(l, "SJ_TEL2")) { if (!cur.Telefone.trim() && v !== "<null>") cur.Telefone = v; }
      else if (sw(l, "SJ_END")) cur.Endereco = v === "<null>" ? "" : v; else if (sw(l, "SJ_BAIRRO")) cur.Bairro = v === "<null>" ? "" : v; else if (sw(l, "SJ_CIDADE")) cur.Cidade = v === "<null>" ? "" : v;
      else if (sw(l, "SJ_TOTAL")) cur.Total = MymDec(v);
      else if (item) { if (sw(l, "SJ_COD_PRO")) item.CodPro = I(v); else if (sw(l, "SJ_PRODUTO")) item.Nome = v === "<null>" ? "Produto " + item.CodPro : v; else if (sw(l, "SJ_QUANT")) item.Quant = MymDec(v); else if (sw(l, "SJ_VALOR")) item.Valor = MymDec(v); }
    }
  }
  return [...map.values()].sort((x, y) => x.CodVen - y.CodVen);
}

async function pertence(unit) {
  if (unit.code === "PERSONALIZADOS") return (v) => v.CodVend === 38;
  if (unit.code === "FA_COLCHOES") {
    let company = 0; const sellers = new Set();
    try { const p = await precos(unit).ensureFresh(); for (const r of p.rowsOfGroup("FA COLCHÕES VENDAS")) if (String(r.i).toLowerCase() === "vendedores mymanager") { company = Math.trunc(Number(String(r.raw1 ?? r.v1).replace(",", ".")) || 0); for (const t of String(r.info ?? "").split(/[;, ]/)) { const n = I(t); if (n > 0) sellers.add(n); } break; } } catch {}
    return (v) => sellers.size > 0 && !(company > 0 && v.CodEmp !== company) && sellers.has(v.CodVend);
  }
  return (v) => v.CodEmp === 1 && (v.CodVend === 2 || v.CodVend === 36);
}
export async function LerVendasMyManagerMesUnidade(unit) {
  const h = new Date(), a = new Date(h.getFullYear(), h.getMonth(), 1), b = new Date(h.getFullYear(), h.getMonth() + 1, 1);
  const f = await pertence(unit); return (await LerVendasMyManagerPeriodo(a, b)).filter(f);
}

// MyManagerPedidosView: a leitura é guardada por 60 s; a lista e os números de Pedidos usam a mesma leitura.
let cache = null, emAndamento = null;
export async function MyManagerPedidosView(unit) {
  if (cache && cache.u === unit.code && Date.now() - cache.t < 60000) return cache.rows.map((r) => ({ ...r }));
  if (emAndamento && emAndamento.u === unit.code) return (await emAndamento.p).map((r) => ({ ...r }));
  const p = lerView(unit); emAndamento = { u: unit.code, p };
  try { return (await p).map((r) => ({ ...r })); } finally { if (emAndamento && emAndamento.p === p) emAndamento = null; }
}
async function lerView(unit) {
  const rows = (await LerVendasMyManagerMesUnidade(unit)).map((v) => ({
    NumeroPedido: "MYM-PED-" + v.CodVen, NumeroOrcamento: "MYM-" + v.CodVen, DataAprovacao: v.Data ? ymd(v.Data) : null,
    Cliente: v.Cliente.trim() ? v.Cliente : "CLIENTE NÃO INFORMADO NO MYMANAGER",
    Produto: v.Itens.map((it) => it.Nome + " — " + q3(it.Quant) + " x " + brl(it.Valor)).join(" | "), PDV: "myManager • " + v.Vendedor,
    ValorPDV: v.Total, CustoProduto: 0, ValorMO: 0, ValorRecebido: v.Total, FaltaReceber: 0, Status: "FATURADO", AlteradoPorNome: "myManager • " + v.Vendedor,
    PrevisaoEntrega: null, DataEntrega: null, SyncAtualizadoEm: new Date().toISOString(), SyncRevisao: 0, venda: v }));
  cache = { u: unit.code, t: Date.now(), rows }; return rows;
}
export function MergeMyManagerPedidos(base, my) { const seen = new Set(base.map((r) => String(r.NumeroPedido).toUpperCase())); for (const r of my) if (!seen.has(String(r.NumeroPedido).toUpperCase())) base.push(r); return base; }

// ShowMyManagerOrderDetails
export function DetalhesTexto(v) {
  const L = []; L.push("VENDA MYMANAGER #" + v.CodVen); L.push("Data: " + (v.Data ? p2(v.Data.getDate()) + "/" + p2(v.Data.getMonth() + 1) + "/" + v.Data.getFullYear() : "")); L.push("Vendedor: " + v.Vendedor); L.push("Cliente: " + (v.Cliente.trim() ? v.Cliente : "Não informado"));
  if (v.Telefone.trim()) L.push("Telefone: " + v.Telefone); const end = (v.Endereco + " - " + v.Bairro + " - " + v.Cidade).replace(/^[ -]+|[ -]+$/g, ""); if (end.trim()) L.push("Endereço: " + end);
  L.push("", "ITENS:"); for (const it of v.Itens) L.push("• " + it.Nome + " | " + q3(it.Quant) + " x " + brl(it.Valor)); L.push("", "TOTAL FATURADO: " + brl(v.Total), "", "Origem: myManager • somente leitura");
  return L.join("\n");
}
