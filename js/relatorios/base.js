// Peças comuns dos relatórios: tabela com rolagem lateral, exportar CSV e imprimir (mesmo conteúdo das telas do computador).
import { h, money, alertBox } from "../ui.js";
import { ctx } from "../app.js";

export const C2 = money;
export const pct = (v, d = 2) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
export const num0 = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function page(el, title, sub) {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, title), sub ? h("div", { class: "sub" }, sub) : null)));
}
// Mês/ano/percentual como os NumericUpDown do computador.
export function monthYear(card, { mes, ano }) {
  const m = h("select", { class: "select" }, ...Array.from({ length: 12 }, (_, i) => h("option", { value: i + 1, selected: i + 1 === mes }, String(i + 1).padStart(2, "0"))));
  const a = h("input", { class: "input", value: String(ano), inputmode: "numeric" });
  card.append(h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Mês"), m), h("div", {}, h("label", { class: "lbl" }, "Ano"), a)));
  return { mes: () => Number(m.value), ano: () => Number(a.value), m, a };
}
export function cards(titles) {
  const vals = titles.map(() => h("div", { class: "v" }, "R$ 0,00"));
  return { el: h("div", { class: "kpis", style: { marginTop: "10px" } }, ...titles.map((t, i) => h("div", { class: "kpi" }, h("div", { class: "t" }, t), vals[i]))), vals };
}
// cols: [{k,t,money?,pct?,bold?,align?}] ; rows: [{...}] ; opts.totalLast
export function table(cols, rows, { totalLast = false, onRow } = {}) {
  const fmt = (c, v) => (v == null || v === "" ? "" : c.money ? C2(v) : c.pct ? pct(v) : c.n2 ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : c.fmt ? c.fmt(v) : String(v));
  const thead = h("tr", {}, ...cols.map((c) => h("th", { style: { textAlign: c.money || c.pct || c.right ? "right" : "left" } }, c.t)));
  const body = rows.map((r, i) => h("tr", { class: (totalLast && i === rows.length - 1 ? "tot" : "") + (onRow ? " click" : ""), onclick: onRow ? () => onRow(r, i) : null },
    ...cols.map((c) => h("td", { style: { textAlign: c.money || c.pct || c.right ? "right" : "left", fontWeight: c.bold ? "700" : "", color: c.color || "" } }, fmt(c, r[c.k])))));
  return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" }, h("thead", {}, thead), h("tbody", {}, ...body)));
}
export function csv(nome, cols, rows) {
  if (!rows.length) return alertBox("Não há dados para exportar.", "Exportar CSV");
  const cell = (c, v) => (v == null ? "" : typeof v === "number" && (c.money || c.n2 || c.pct) ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) : String(v).replace(/;/g, ","));
  const txt = "﻿" + cols.map((c) => c.t).join(";") + "\r\n" + rows.map((r) => cols.map((c) => cell(c, r[c.k])).join(";")).join("\r\n") + "\r\n";
  const a = h("a", { href: URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })), download: nome }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  ctx.audit("EXPORTAR", "RELATORIO", nome, "CSV exportado no celular");
}
export function printTable(titulo, cols, rows, { totalLast = false, landscape = true, extra = "" } = {}) {
  const w = window.open("", "_blank"); if (!w) return alertBox("O celular bloqueou a janela de impressão. Permita pop-ups para este app.");
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const fmt = (c, v) => (v == null || v === "" ? "" : c.money ? C2(v) : c.pct ? pct(v) : c.fmt ? c.fmt(v) : String(v));
  w.document.write("<!doctype html><meta charset=utf-8><title>" + esc(titulo) + "</title><style>@page{size:" + (landscape ? "landscape" : "portrait") + ";margin:12mm}body{font-family:Segoe UI,Arial,sans-serif;font-size:11px;color:#000}h1{font-size:15px}table{border-collapse:collapse;width:100%}th,td{padding:4px 6px;border-bottom:1px solid #ccc}th{font-size:10px;text-transform:uppercase}tr.tot td{font-weight:700;border-top:2px solid #000}.r{text-align:right}footer{margin-top:14px;color:#555;font-size:10px}</style>" +
    "<h1>" + esc(titulo) + "</h1>" + extra + "<table><thead><tr>" + cols.map((c) => "<th class=" + (c.money || c.pct || c.right ? "r" : "") + ">" + esc(c.t) + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((r, i) => "<tr class=" + (totalLast && i === rows.length - 1 ? "tot" : "") + ">" + cols.map((c) => "<td class=" + (c.money || c.pct || c.right ? "r" : "") + ">" + esc(fmt(c, r[c.k])) + "</td>").join("") + "</tr>").join("") + "</tbody></table><footer>Sistema São João — impresso em " + new Date().toLocaleString("pt-BR") + "</footer><script>setTimeout(()=>print(),300)<\/script>");
  w.document.close();
}
// RelatorioAcesso
const LIB = ["MARINA", "CARLOS", "ELAINE", "YURI", "ALIRIO"], NAO = ["DECOR", "LOJA", "VENDAS"];
export const normalizar = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, " ").split(" ").filter(Boolean).join(" ");
export function acesso(nomeUsuario) {
  const n = normalizar(nomeUsuario), p = n.split(" ");
  const todos = p.length > 0 && LIB.includes(p[0]) && !p.slice(1).some((x) => NAO.includes(x));
  return {
    usuario: String(nomeUsuario ?? "").trim(), todos,
    vendedor(vends) {
      const u = normalizar(this.usuario); if (!u) return 0;
      const lista = vends.filter(([k]) => k > 0).map(([k, v]) => [k, normalizar(v)]);
      const igual = [...new Set(lista.filter(([, v]) => v === u).map(([k]) => k))]; if (igual.length === 1) return igual[0];
      const pr = u.split(" ")[0]; const mesmo = [...new Set(lista.filter(([, v]) => v.split(" ")[0] === pr).map(([k]) => k))];
      return mesmo.length === 1 ? mesmo[0] : 0;
    },
    aviso(cod, nome) { return cod > 0 ? "Acesso individual: mostrando só " + nome + "." : "Acesso individual: o usuário " + this.usuario + " não foi encontrado entre os vendedores do MyManager (ou o nome combina com mais de um). Peça à gerência para conferir o nome do usuário."; },
  };
}
export const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = on ? "Consultando..." : label; };
