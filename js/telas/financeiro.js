// Financeiro / Resultados: MainForm.Financial → FinancialCloud (FinancialPersonalizados na Personalizados).
import { h, alertBox, friendly, toDate } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { page, table, csv, C2, MESES } from "../relatorios/base.js";

const N2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const p2 = (n) => String(n).padStart(2, "0");
const dt = (v, hora) => { if (!v) return ""; const d = toDate(v); if (!d || isNaN(d)) return ""; return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + (hora ? " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) : ""); };

register("financeiro", (el) => {
  if (ctx.unit.code === "PERSONALIZADOS") return personalizados(el);
  page(el, "Financeiro / Resultados", ctx.unit.name);
  const per = h("select", { class: "select" }, ...["MÊS ATUAL", "MÊS ANTERIOR", "ANO ATUAL", "TODOS"].map((x) => h("option", { value: x }, x)));
  const st = h("select", { class: "select" }, ...["TODOS", "ATIVO", "APROVADO", "EM PRODUÇÃO", "PRONTO", "ENTREGUE", "FINALIZADO", "CANCELADO"].map((x) => h("option", { value: x }, x)));
  const atualizar = h("button", { class: "btn dark" }, "ATUALIZAR"), exportar = h("button", { class: "btn green" }, "EXPORTAR CSV");
  el.append(h("div", { class: "card" }, h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Período"), per), h("div", {}, h("label", { class: "lbl" }, "Status"), st)), h("div", { class: "btns grid2", style: { marginTop: "8px" } }, atualizar, exportar)));
  const tit = ["VENDAS / PDV", "RECEBIDO", "A RECEBER", "CUSTOS + M.O.", "RESULTADO BRUTO"], vals = tit.map(() => h("div", { class: "v" }, "R$ 0,00"));
  const margemPct = h("div", { style: { color: "#25844b", fontWeight: "700", marginTop: "4px" } }, "Margem: 0,00%");
  el.append(h("div", { class: "kpis", style: { marginTop: "10px" } }, ...tit.map((t, i) => h("div", { class: "kpi" }, h("div", { class: "t" }, t), vals[i], i === 4 ? margemPct : null))),
    h("div", { class: "sub", style: { margin: "8px 0", color: "#696969" } }, "Resultado bruto = Valor PDV - Custo do produto - Mão de obra. Margem % = resultado bruto ÷ valor vendido. Não inclui impostos e despesas gerais."));
  const abaP = h("button", { class: "btn small dark" }, "Resultado por Pedido"), abaM = h("button", { class: "btn small" }, "Resumo Mensal");
  const area = h("div", {}); el.append(h("div", { style: { display: "flex", gap: "6px", margin: "10px 0 6px" } }, abaP, abaM), area);
  const colsP = [{ k: "NumeroPedido", t: "NumeroPedido" }, { k: "Cliente", t: "Cliente" }, { k: "Produto", t: "Produto" }, { k: "PDV", t: "PDV" }, { k: "ValorPDV", t: "ValorPDV", money: true }, { k: "CustoProduto", t: "CustoProduto", money: true }, { k: "ValorMO", t: "ValorMO", money: true }, { k: "ValorRecebido", t: "ValorRecebido", money: true }, { k: "FaltaReceber", t: "FaltaReceber", money: true }, { k: "Status", t: "Status" }, { k: "Aprov", t: "DataAprovacao" }, { k: "Prev", t: "PrevisaoEntrega" }, { k: "Ent", t: "DataEntrega" }, { k: "ResultadoBruto", t: "ResultadoBruto", money: true }, { k: "MargemPercentual", t: "Margem %", right: true, fmt: N2 }];
  const colsM = [{ k: "Ano", t: "Ano" }, { k: "Mes", t: "Mês" }, { k: "Pedidos", t: "Pedidos", right: true }, { k: "Vendas", t: "Vendas", money: true }, { k: "Recebido", t: "Recebido", money: true }, { k: "AReceber", t: "AReceber", money: true }, { k: "Custos", t: "Custos", money: true }, { k: "ResultadoBruto", t: "ResultadoBruto", money: true }, { k: "MargemPercentual", t: "Margem %", right: true, fmt: N2 }];
  let view = [], md = [], aba = "P";
  const desenhar = () => {
    abaP.className = "btn small" + (aba === "P" ? " dark" : ""); abaM.className = "btn small" + (aba === "M" ? " dark" : "");
    area.innerHTML = ""; area.append(aba === "P" ? table(colsP, view) : table(colsM, md));
    if (aba === "P") { const hoje = new Date(); hoje.setHours(0, 0, 0, 0); const em3 = new Date(hoje); em3.setDate(em3.getDate() + 3);
      area.querySelectorAll("tbody tr").forEach((tr, i) => { const r = view[i], s = String(r.Status).toUpperCase(), pv = r._prev; if (s === "ENTREGUE" || s === "FINALIZADO") tr.style.background = "#ebf8ef"; else if (pv && pv < hoje) tr.style.background = "#fceeee"; else if (pv && pv <= em3) tr.style.background = "#fff8e2"; }); }
  };
  abaP.onclick = () => { aba = "P"; desenhar(); }; abaM.onclick = () => { aba = "M"; desenhar(); };
  const load = async () => {
    try {
      const all = await api.fetchOrders("", "", ctx.unit), n = new Date(), ant = new Date(n.getFullYear(), n.getMonth() - 1, 1), periodo = per.value, status = st.value; view = [];
      for (const r of all) {
        const d = r.DataAprovacao ? toDate(r.DataAprovacao) : null;
        const ok = periodo === "TODOS" || (d && ((periodo === "MÊS ATUAL" && d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()) || (periodo === "ANO ATUAL" && d.getFullYear() === n.getFullYear()) || (periodo === "MÊS ANTERIOR" && d.getFullYear() === ant.getFullYear() && d.getMonth() === ant.getMonth())));
        if (!ok) continue; if (status !== "TODOS" && String(r.Status).toUpperCase() !== status) continue;
        const rb = r.ValorPDV - r.CustoProduto - r.ValorMO;
        view.push({ ...r, Aprov: dt(r.DataAprovacao, true), Prev: dt(r.PrevisaoEntrega), Ent: dt(r.DataEntrega), _prev: r.PrevisaoEntrega ? toDate(r.PrevisaoEntrega) : null, _d: d, ResultadoBruto: rb, MargemPercentual: r.ValorPDV === 0 ? 0 : rb / r.ValorPDV * 100 });
      }
      let vv = 0, rr = 0, ff = 0, cc = 0; for (const r of view) { vv += r.ValorPDV; rr += r.ValorRecebido; ff += r.FaltaReceber; cc += r.CustoProduto + r.ValorMO; }
      const res = vv - cc; [vv, rr, ff, cc, res].forEach((v, i) => (vals[i].textContent = C2(v))); margemPct.textContent = "Margem: " + N2(vv === 0 ? 0 : res / vv * 100) + "%";
      const map = new Map();
      for (const r of view) { if (!r._d) continue; const k = r._d.getFullYear() + "-" + p2(r._d.getMonth() + 1); if (!map.has(k)) map.set(k, [0, 0, 0, 0, 0, 0]); const a = map.get(k), cs = r.CustoProduto + r.ValorMO; a[0]++; a[1] += r.ValorPDV; a[2] += r.ValorRecebido; a[3] += r.FaltaReceber; a[4] += cs; a[5] += r.ValorPDV - cs; }
      md = [...map.keys()].sort().reverse().map((k) => { const a = map.get(k), [y, m] = k.split("-").map(Number); return { Ano: y, Mes: MESES[m - 1], Pedidos: a[0], Vendas: a[1], Recebido: a[2], AReceber: a[3], Custos: a[4], ResultadoBruto: a[5], MargemPercentual: a[1] === 0 ? 0 : a[5] / a[1] * 100 }; });
      desenhar();
    } catch (e) { alertBox(friendly(e), "Financeiro Nuvem"); }
  };
  atualizar.onclick = load; per.onchange = load; st.onchange = load;
  const st2 = () => { const d = new Date(); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + "_" + p2(d.getHours()) + p2(d.getMinutes()); };
  exportar.onclick = () => csv("Financeiro_Pedidos_" + st2() + ".csv", colsP, view);
  load();
});

async function personalizados(el) {
  page(el, "Financeiro / Resultados — Personalizados", ctx.unit.name);
  let venda = 0, rec = 0, falta = 0, custo = 0;
  try { for (const r of await api.fetchOrders("", "", ctx.unit)) { venda += r.ValorPDV; rec += r.ValorRecebido; falta += r.FaltaReceber; custo += r.CustoProduto + r.ValorMO; } } catch {}
  el.append(h("div", { class: "card", style: { fontSize: "18px", lineHeight: "1.8", whiteSpace: "pre-line" } }, "Vendas: " + C2(venda) + "\nRecebido: " + C2(rec) + "\nFalta receber: " + C2(falta) + "\nCustos: " + C2(custo) + "\nResultado bruto: " + C2(venda - custo) + "\n\nFonte: Supabase"));
}
