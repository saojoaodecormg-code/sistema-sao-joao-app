// Comercial (SalesCenterV249 "Central de Vendas — Meu Dia") e Compras (PurchasesV249 "Compras e Fornecedores").
import { h, alertBox, friendly, toDate } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { operacaoLoja } from "../mym.js";
import { page, table, C2 } from "../relatorios/base.js";

const p2 = (n) => String(n).padStart(2, "0");
const dt = (v, hora = true) => { if (!v) return ""; const d = toDate(v); if (!d || isNaN(d)) return ""; return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + (hora ? " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) : ""); };

register("comercial", (el) => {
  page(el, "Central de Vendas — Meu Dia", ctx.unit.name);
  const refresh = h("button", { class: "btn dark" }, "ATUALIZAR"), area = h("div", {});
  el.append(h("div", { class: "btns", style: { margin: "8px 0" } }, refresh), area);
  const cols = [{ k: "NumeroOrcamento", t: "NumeroOrcamento" }, { k: "Cliente", t: "Cliente" }, { k: "Tipo", t: "Tipo" }, { k: "Valor", t: "Valor", money: true }, { k: "Status", t: "Status" }, { k: "Vendedor", t: "Vendedor" }, { k: "DataCriacao", t: "DataCriacao" }, { k: "DataRetorno", t: "DataRetorno" }];
  const load = async () => {
    try {
      const all = (await api.fetchQuotes("", "TODOS", ctx.unit)).filter((q) => !["APROVADO", "NEGADO", "CANCELADO"].includes(String(q.Status).toUpperCase()));
      const agora = new Date(), hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const pr = (q) => { if (!q.RetornarEm) return 2; const d = toDate(q.RetornarEm); if (d < agora) return 0; const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return +dd === +hoje ? 1 : 2; };
      const tm = (v) => (v ? toDate(v).getTime() : 0);
      const lista = all.sort((a, b) => pr(a) - pr(b) || (a.RetornarEm == null) - (b.RetornarEm == null) || tm(a.RetornarEm) - tm(b.RetornarEm) || tm(b.DataHora) - tm(a.DataHora)).slice(0, 100);
      const rows = lista.map((q) => ({ NumeroOrcamento: q.Numero, Cliente: q.Cliente, Tipo: q.Tipo, Valor: q.Valor, Status: q.Status, Vendedor: q.Vendedor, DataCriacao: dt(q.DataHora), DataRetorno: dt(q.RetornarEm), _n: q.Numero }));
      area.innerHTML = ""; area.append(table(cols, rows, { onRow: (r) => ctx.go("historico/busca/" + encodeURIComponent(r._n)) }));
    } catch (e) { alertBox(friendly(e), "Central de Vendas"); }
  };
  refresh.onclick = load; load();
});

register("compras", (el) => {
  page(el, "Compras e Fornecedores", ctx.unit.name);
  const pedido = h("input", { class: "input" }), forn = h("input", { class: "input" }), item = h("input", { class: "input" });
  const add = h("button", { class: "btn dark" }, "ADICIONAR COMPRA"), rec = h("button", { class: "btn dark", disabled: true }, "MARCAR RECEBIDO");
  el.append(h("div", { class: "card" }, h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Pedido"), pedido), h("div", {}, h("label", { class: "lbl" }, "Fornecedor"), forn)), h("label", { class: "lbl" }, "Item / material"), item, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, add, rec)));
  const sel = h("div", { class: "sub", style: { margin: "6px 0" } }, "Toque numa compra para selecionar."), area = h("div", {});
  el.append(sel, area, h("div", { class: "sub", style: { marginTop: "8px", color: "#5a5e64" } }, "As compras ficam no banco do computador da loja, as mesmas da tela Compras do sistema. O celular lê e grava por ele."));
  const cols = ["Id", "NumeroPedido", "Fornecedor", "Item", "Valor", "Status", "Previsao", "RecebidoEm", "Observacoes"].map((k) => ({ k, t: k, money: k === "Valor" }));
  let atual = null;
  const load = async () => {
    try {
      const r = await operacaoLoja("compras_listar"); const rows = (r || []).map((x) => ({ ...x, Previsao: dt(x.Previsao, false), RecebidoEm: dt(x.RecebidoEm, false) }));
      area.innerHTML = ""; area.append(table(cols, rows, { onRow: (x, i) => { atual = x; rec.disabled = false; sel.textContent = "Selecionada: compra " + x.Id + " — " + x.Item; area.querySelectorAll("tbody tr").forEach((tr, j) => (tr.style.background = j === i ? "#dbeafe" : "")); } }));
    } catch (e) { area.innerHTML = ""; alertBox(friendly(e), "Compras e Fornecedores"); }
  };
  add.onclick = async () => {
    if (!item.value.trim()) return alertBox("Informe o item/material.");
    add.disabled = true;
    try { await operacaoLoja("compras_adicionar", { pedido: pedido.value.trim(), fornecedor: forn.value.trim(), item: item.value.trim() }); await load(); }
    catch (e) { alertBox(friendly(e), "Compras e Fornecedores"); } finally { add.disabled = false; }
  };
  rec.onclick = async () => {
    if (!atual) return; rec.disabled = true;
    try { await operacaoLoja("compras_recebido", { id: Number(atual.Id) }); atual = null; sel.textContent = "Toque numa compra para selecionar."; await load(); }
    catch (e) { alertBox(friendly(e), "Compras e Fornecedores"); rec.disabled = false; }
  };
  load();
});
