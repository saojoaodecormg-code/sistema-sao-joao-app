// Relatórios / Exportação: MainForm.Reports + RelatoriosVendedoresCards + ReportsCloud (ReportsPersonalizados na Personalizados).
import { h, alertBox, friendly } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { page, table, csv, acesso, MESES } from "./base.js";
import "./comissoes.js";
import "./recebidos.js";
import "./desempenho.js";
import "./contas_pagas.js";
import "./gavetas.js";
import "./vendas_pendentes.js";

function cartao(titulo, texto, cor, rota, antes) {
  return h("div", { class: "card", style: { borderLeft: "5px solid " + cor } },
    h("div", { style: { fontWeight: "700", fontSize: "16px", color: cor } }, titulo), h("div", { class: "sub", style: { margin: "4px 0 10px" } }, texto),
    h("button", { class: "btn small", style: { background: cor, color: "#fff", borderColor: cor }, onclick: () => { if (antes && !antes()) return; ctx.go(rota); } }, "ABRIR"));
}
const gerencia = (msg, titulo) => () => { if (!acesso(ctx.session.nome).todos) { alertBox(msg, titulo); return false; } return true; };

register("relatorios", (el) => {
  if (ctx.unit.code === "PERSONALIZADOS") return personalizados(el);
  page(el, "Relatórios / Exportação", ctx.unit.name);
  el.append(h("h3", { style: { margin: "14px 0 6px" } }, "Relatórios dos vendedores"),
    cartao("Comissões e recebimentos", "Vendas líquidas, à vista, crediário, devoluções e total recebido por vendedor.", "#082d4e", "rel/comissoes"),
    cartao("Relatório de recebidos", "Planilha de pagamento: recebido, porcentagem, comissão e salário.", "#a81e2c", "rel/recebidos"),
    cartao("Desempenho dos vendedores", "Vendas líquidas, quantidade de vendas e itens, ticket médio e PA.", "#25844b", "rel/desempenho"),
    h("h3", { style: { margin: "18px 0 6px" } }, "Financeiro e acompanhamento das vendas"),
    cartao("Contas pagas", "Por mês: vendas líquidas, recebidos, total pago e os 8 grupos do plano de contas.", "#784814", "rel/contas-pagas", gerencia("O relatório de contas pagas é liberado só para a gerência.", "Contas pagas")),
    cartao("Custos por gaveta", "Por mês: recebido, pago, fornecedor, custo fixo, variável, investimentos, empréstimos e lucro.", "#1565c0", "rel/gavetas", gerencia("O relatório de custos é liberado só para a gerência.", "Custos por gaveta")),
    cartao("Vendas pendentes", "Vendas aprovadas ainda não entregues: em que etapa estão e o que falta.", "#c2410c", "rel/vendas-pendentes"),
    h("h3", { style: { margin: "18px 0 6px" } }, "Resumo anual de pedidos"));
  // ReportsCloud
  const ano = h("input", { class: "input", value: String(new Date().getFullYear()), inputmode: "numeric" });
  const atualizar = h("button", { class: "btn dark" }, "ATUALIZAR"), exportar = h("button", { class: "btn green" }, "EXPORTAR CSV");
  const area = h("div", {});
  el.append(h("div", { class: "card" }, h("label", { class: "lbl" }, "Ano"), ano, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, atualizar, exportar)), area);
  const cols = [{ k: "Mes", t: "Mes" }, { k: "Pedidos", t: "Pedidos", right: true }, { k: "Vendas", t: "Vendas", money: true }, { k: "Recebido", t: "Recebido", money: true }, { k: "AReceber", t: "AReceber", money: true }, { k: "CustosMaisMO", t: "CustosMaisMO", money: true }, { k: "ResultadoBruto", t: "ResultadoBruto", money: true }];
  let rows = [];
  const load = async () => {
    try {
      const yy = /^\s*\d+\s*$/.test(ano.value) ? Number(ano.value) : NaN; if (Number.isNaN(yy)) throw new Error("Ano inválido.");
      const all = await api.fetchOrders("", "", ctx.unit); rows = [];
      for (let m = 1; m <= 12; m++) {
        let qtd = 0, v = 0, r = 0, f = 0, c = 0;
        for (const x of all) { if (!x.DataAprovacao) continue; const d = new Date(x.DataAprovacao); if (d.getFullYear() !== yy || d.getMonth() + 1 !== m) continue; qtd++; v += x.ValorPDV; r += x.ValorRecebido; f += x.FaltaReceber; c += x.CustoProduto + x.ValorMO; }
        if (qtd > 0) rows.push({ Mes: MESES[m - 1], Pedidos: qtd, Vendas: v, Recebido: r, AReceber: f, CustosMaisMO: c, ResultadoBruto: v - c });
      }
      area.innerHTML = ""; area.append(rows.length ? table(cols, rows) : h("div", { class: "sub", style: { margin: "8px 0" } }, "Nenhum pedido aprovado neste ano."));
    } catch (e) { alertBox(friendly(e), "Relatórios Nuvem"); }
  };
  atualizar.onclick = load; exportar.onclick = () => csv("Relatorio_Mensal_" + ano.value + ".csv", cols, rows);
  load();
});

// ReportsPersonalizados (nuvem): pedidos por ano/mês, na ordem em que aparecem.
async function personalizados(el) {
  page(el, "Relatórios / Exportação — Personalizados", ctx.unit.name);
  const area = h("div", {}); el.append(area, h("div", { class: "sub", style: { marginTop: "8px" } }, "Relatório carregado do Supabase."));
  try {
    const src = await api.fetchOrders("", "", ctx.unit), agg = new Map();
    for (const r of src) { const d = r.DataAprovacao ? new Date(r.DataAprovacao) : new Date(1, 0, 1); const k = String(d.getFullYear()).padStart(4, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0"); if (!agg.has(k)) agg.set(k, [0, 0, 0]); const a = agg.get(k); a[0]++; a[1] += r.ValorPDV; a[2] += r.ValorRecebido; }
    const rows = [...agg].map(([k, v]) => { const z = k.split("-"); return { Ano: z[0], Mes: z[1], Pedidos: v[0], Vendas: v[1].toLocaleString("pt-BR"), Recebido: v[2].toLocaleString("pt-BR") }; });
    const cols = ["Ano", "Mes", "Pedidos", "Vendas", "Recebido"].map((k) => ({ k, t: k }));
    area.append(table(cols, rows), h("div", { class: "btns", style: { marginTop: "8px" } }, h("button", { class: "btn green", onclick: () => csv("Relatorio_Personalizados.csv", cols, rows) }, "EXPORTAR CSV")));
  } catch (e) { alertBox(friendly(e), "Relatórios"); }
}
