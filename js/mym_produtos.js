// MyManagerProducts (FaColchoes.cs): consulta de produtos direto na tabela PRODUTO do myManager, pela ponte da loja.
import { consulta } from "./mym.js";

export const Normalize = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
const Sql = (s) => String(s ?? "").replace(/'/g, "''");
function CategoryWhere(terms) {
  const inc = [], exc = [];
  for (const t of terms) { if (t.startsWith("-")) { const x = t.slice(1).trim(); if (x) exc.push("UPPER(P.NOME_PRO) NOT LIKE '%" + Sql(x) + "%'"); } else inc.push("UPPER(P.NOME_PRO) LIKE '%" + Sql(t) + "%'"); }
  if (!inc.length) return null; let w = "(" + inc.join(" OR ") + ")"; if (exc.length) w = "(" + w + " AND " + exc.join(" AND ") + ")"; return w;
}
function Where(categories, sizeTerms, typed) {
  const parts = []; for (const c of categories) { const cw = CategoryWhere(c); if (cw != null) parts.push(cw); }
  let w = parts.length === 0 ? "1=1" : parts.length === 1 ? parts[0] : "(" + parts.join(" OR ") + ")";
  for (const word of Normalize(typed).split(" ").filter(Boolean)) w += " AND UPPER(P.NOME_PRO) LIKE '%" + Sql(word) + "%'";
  if (sizeTerms && sizeTerms.length) { const sw = CategoryWhere(sizeTerms); if (sw != null) w += " AND " + sw; }
  return w;
}
const eq = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();
export function PickPrice(cols) {
  for (const p of ["PRECO_VENDA", "PRECO_VEN", "PRECOVENDA", "PRECO_PRO", "VENDA_PRO", "PRECO", "VALOR_PRO", "VALOR_VENDA", "PRVENDA_PRO", "PRECO1"]) for (const c of cols) if (eq(c, p)) return c;
  for (const c of cols) { const u = c.toUpperCase(); if (u.includes("CUSTO") || u.includes("COMPRA")) continue; if (u.includes("PRECO") || u.includes("VENDA") || u.startsWith("PV")) return c; }
  return null;
}
export function PickStock(cols) { for (const c of cols) { const u = c.toUpperCase(); if (u.includes("CONTROL") || u.includes("MIN") || u.includes("MAX") || u.startsWith("FLAG") || u.includes("RESERV")) continue; if (u.includes("ESTOQUE") || u.startsWith("ESTQ") || u.includes("SALDO") || u.startsWith("QTD") || u.startsWith("QUANT")) return c; } return null; }
const PickUnit = (cols) => cols.find((c) => { const u = c.toUpperCase(); return u.startsWith("UNID") || u === "UN_PRO" || u === "UNIDADE_PRO" || u === "UND_PRO"; }) || null;
const PickRef = (cols) => cols.find((c) => { const u = c.toUpperCase(); return u.startsWith("REF") || u.includes("BARRA") || u.startsWith("EAN"); }) || null;
const ColumnsSql = "SELECT TRIM(RDB$FIELD_NAME) SJ_COL FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='PRODUTO' ORDER BY RDB$FIELD_POSITION;";
function ProductsSql(cols, categories, sizeTerms, typed, max) {
  const price = PickPrice(cols), stock = PickStock(cols), unit = PickUnit(cols), refc = PickRef(cols);
  return "SELECT FIRST " + Math.max(1, max) + " P.COD_PRO SJ_COD,P.NOME_PRO SJ_NOME," + (price != null ? "P." + price : "0") + " SJ_PRECO," + (stock != null ? "P." + stock : "NULL") + " SJ_ESTOQUE," + (unit != null ? "P." + unit : "NULL") + " SJ_UNID," + (refc != null ? "P." + refc : "NULL") + " SJ_REF FROM PRODUTO P WHERE " + Where(categories, sizeTerms, typed) + " ORDER BY P.NOME_PRO;";
}
// MyManagerProducts.Dec: a vírgula decimal vale quando é o último separador.
export function Dec(s) {
  s = String(s ?? "").trim(); if (!s || s === "<null>") return 0;
  const br = s.lastIndexOf(",") > s.lastIndexOf(".");
  const pBr = (t) => { const v = Number(t.replace(/\./g, "").replace(",", ".")); return isFinite(v) ? v : null; }, pInv = (t) => { const v = Number(t.replace(/,/g, "")); return isFinite(v) ? v : null; };
  const a = br ? pBr(s) : pInv(s); if (a != null) return a; const b = br ? pInv(s) : pBr(s); return b != null ? b : 0;
}
const Val = (line) => { const m = /^\S+\s+(.*)$/.exec(line); return m ? m[1].trim() : ""; };
function ParseProducts(output) {
  const dt = []; let cur = null;
  for (const raw of String(output ?? "").replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); if (!l) continue; const key = l.split(/[ \t]+/)[0].toUpperCase(); let v = Val(l); if (v === "<null>") v = "";
    if (key === "SJ_COD") { cur = { Codigo: v, Produto: "", Preco: 0, Estoque: "", Unid: "", Ref: "" }; dt.push(cur); }
    else if (!cur) continue;
    else if (key === "SJ_NOME") cur.Produto = v; else if (key === "SJ_PRECO") cur.Preco = Dec(v);
    else if (key === "SJ_ESTOQUE") cur.Estoque = v.length ? Dec(v).toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }) : "";
    else if (key === "SJ_UNID") cur.Unid = v; else if (key === "SJ_REF") cur.Ref = v;
  }
  return dt;
}
const ParseColumns = (output) => String(output ?? "").replace(/\r/g, "").split("\n").map((x) => x.trim()).filter((l) => l.toUpperCase().startsWith("SJ_COL")).map((l) => Val(l)).filter(Boolean);

export let mymProductColumns = null;
export async function SearchProducts(categories, sizeTerms, typed, max) {
  if (!mymProductColumns || !mymProductColumns.length) {
    const c = ParseColumns(await consulta(ColumnsSql));
    if (!c.includes("COD_PRO") || !c.includes("NOME_PRO")) throw new Error("A tabela PRODUTO do MyManager não tem as colunas esperadas (COD_PRO, NOME_PRO). Colunas encontradas: " + c.join(", "));
    mymProductColumns = c;
  }
  return ParseProducts(await consulta(ProductsSql(mymProductColumns, categories, sizeTerms, typed, max)));
}

// ConsultaProdutos (Orçamentos > Consultar Produtos): todos os produtos do myManager, sem categoria.
export async function Colunas() {
  if (!mymProductColumns || !mymProductColumns.length) {
    const c = ParseColumns(await consulta(ColumnsSql));
    if (!c.includes("COD_PRO") || !c.includes("NOME_PRO")) throw new Error("A tabela PRODUTO do MyManager não tem as colunas esperadas (COD_PRO, NOME_PRO). Colunas encontradas: " + c.join(", "));
    mymProductColumns = c;
  }
  return mymProductColumns;
}
function WhereConsulta(cols, typed, soEstoque) {
  const refc = PickRef(cols), stock = PickStock(cols), words = Normalize(typed).split(" ").filter(Boolean);
  let w = "1=1";
  if (words.length) {
    w = words.map((x) => "UPPER(P.NOME_PRO) LIKE '%" + Sql(x) + "%'").join(" AND ");
    if (words.length > 1) w = "(" + w + ")";
    else { w += " OR TRIM(CAST(P.COD_PRO AS VARCHAR(30)))='" + Sql(words[0]) + "'"; if (refc != null) w += " OR UPPER(CAST(P." + refc + " AS VARCHAR(60))) LIKE '%" + Sql(words[0]) + "%'"; w = "(" + w + ")"; }
  }
  if (soEstoque && stock != null) w += " AND P." + stock + ">0";
  return w;
}
export async function ConsultarTodos(typed, soEstoque, max = 500) {
  const cols = await Colunas();
  const price = PickPrice(cols), stock = PickStock(cols), unit = PickUnit(cols), refc = PickRef(cols);
  const sql = "SELECT FIRST " + Math.max(1, max) + " P.COD_PRO SJ_COD,P.NOME_PRO SJ_NOME," + (price != null ? "P." + price : "0") + " SJ_PRECO," + (stock != null ? "P." + stock : "NULL") + " SJ_ESTOQUE," + (unit != null ? "P." + unit : "NULL") + " SJ_UNID," + (refc != null ? "P." + refc : "NULL") + " SJ_REF FROM PRODUTO P WHERE " + WhereConsulta(cols, typed, soEstoque) + " ORDER BY P.NOME_PRO;";
  return ParseProducts(await consulta(sql));
}
