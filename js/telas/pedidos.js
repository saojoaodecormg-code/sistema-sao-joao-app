// Pedidos (Operations.Orders, OpenOrderEditor, SetOrderStatusSafe, DeleteOrderSafe).
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, modal, formModal, alertBox, confirmBox, toast, friendly, money, num2, fmtDate, toDate, today, statusTag, parseMoney, parseBrDate, isoDay } from "../ui.js";
import { MyManagerPedidosView, MergeMyManagerPedidos, DetalhesTexto } from "../mym_pedidos.js";

const FILTRO = ["TODOS", "ATIVO", "FATURADO", "AGUARDANDO PRODUÇÃO", "EM PRODUÇÃO", "AGUARDANDO MATERIAL", "PRONTO", "AGENDADO", "EM INSTALAÇÃO", "PAUSADO", "ENTREGUE", "FINALIZADO", "CANCELADO"];
const EDIT = ["ATIVO", "AGUARDANDO PRODUÇÃO", "EM PRODUÇÃO", "AGUARDANDO MATERIAL", "PRONTO", "AGENDADO", "EM INSTALAÇÃO", "PAUSADO", "ENTREGUE", "FINALIZADO", "CANCELADO"];
const fechado = (s) => ["ENTREGUE", "FINALIZADO", "CANCELADO"].includes(String(s).toUpperCase());

async function setStatusSafe(ped, status, delivered) {
  if (!(await ctx.beginEdit("PEDIDO", ped))) return;
  try { await api.patchOrder(ped, { status, data_entrega: delivered ? isoDay(today()) : null, ...ctx.editFields() }); await ctx.audit("ALTERAR", "PEDIDO", ped, "Status: " + status); }
  catch (e) { alertBox(friendly(e), "Pedido"); }
  finally { await ctx.endEdit("PEDIDO", ped); }
}

register("pedidos", async (el, arg) => {
  const init = arg && arg.startsWith("busca/") ? decodeURIComponent(arg.slice(6)) : "";
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Pedidos"), h("div", { class: "sub" }, "Produção, prazos e atrasos"))));
  const q = h("input", { class: "input", placeholder: "Buscar cliente, produto ou PDV", value: init, enterkeyhint: "search", onkeydown: (e) => { if (e.key === "Enter") load(); } });
  const st = h("select", { class: "select", style: { width: "auto", maxWidth: "45%" }, onchange: () => load() }, ...FILTRO.map((s) => h("option", { value: s }, s)));
  el.append(h("div", { class: "toolbar" }, q, st));
  const kp = h("div", { class: "kpis" }); el.append(kp);
  const list = h("div", { class: "list" }); el.append(list);
  el.append(h("p", { style: { color: "#6b7280", fontSize: "13px" } }, "Vermelho = atrasado; amarelo = vence em até 3 dias. Edição protegida entre estações."));
  const card = (t, v) => h("div", { class: "kpi" }, h("div", { class: "t" }, t), h("div", { class: "v" }, v));

  async function indicators() {
    try {
      const cd = await api.fetchOrders("", "", ctx.unit); let ca = 0, cf = 0, cat = 0, cpdv = 0, cvf = 0; const t = today();
      for (const r of cd) { const mym = r.NumeroPedido.toUpperCase().startsWith("MYM-PED-") || r.Status.toUpperCase() === "FATURADO"; if (mym) { cf++; cvf += r.ValorPDV; continue; } if (fechado(r.Status)) continue; ca++; cpdv += r.ValorPDV; const p = toDate(r.PrevisaoEntrega); if (p && p < t) cat++; }
      const my = await MyManagerPedidosView(ctx.unit).catch(() => null);
      if (my) { const seen = new Set(cd.map((r) => r.NumeroPedido.toUpperCase())); for (const r of my) if (!seen.has(r.NumeroPedido.toUpperCase())) { cf++; cvf += r.ValorPDV; } }
      kp.innerHTML = ""; kp.append(card("Pedidos ativos", ca), card("Faturados myManager", cf), card("Valor faturado", money(cvf)), card("Valor pedidos ativos", money(cpdv)), card("Entregas atrasadas", cat));
    } catch {}
  }
  let geracao = 0;
  async function load() {
    const g = ++geracao;
    list.innerHTML = ""; list.append(h("div", { class: "loading" }, "Carregando..."));
    try {
      const status = st.value === "TODOS" ? "" : st.value;
      let rows = await api.fetchOrders(q.value, status, ctx.unit);
      rows = rows.filter((r) => !r.NumeroPedido.toUpperCase().startsWith("MYM-PED-") || !q.value);
      const comMym = !q.value && (!status || status === "FATURADO");
      desenhar(rows, comMym ? "Consultando os faturados do myManager da loja..." : "");
      if (comMym) {
        let aviso = "";
        try { MergeMyManagerPedidos(rows, await MyManagerPedidosView(ctx.unit)); }
        catch (e) { aviso = "Faturados do myManager indisponíveis agora: " + friendly(e).split("\n")[0]; }
        if (g === geracao) desenhar(rows, aviso);
      }
    } catch (e) { list.innerHTML = ""; list.append(h("div", { class: "note" }, friendly(e))); }
    indicators();
  }
  function desenhar(rows, aviso) {
      const t = today(), t3 = new Date(t); t3.setDate(t3.getDate() + 3);
      rows.sort((a, b) => { const la = !a.DataEntrega && toDate(a.PrevisaoEntrega) && toDate(a.PrevisaoEntrega) < t ? 0 : 1, lb = !b.DataEntrega && toDate(b.PrevisaoEntrega) && toDate(b.PrevisaoEntrega) < t ? 0 : 1; return la - lb || String(b.DataAprovacao || "").localeCompare(String(a.DataAprovacao || "")); });
      list.innerHTML = "";
      if (aviso) list.append(h("div", { class: "note" }, aviso));
      if (!rows.length) return list.append(h("div", { class: "empty" }, "Nenhum pedido encontrado."));
      for (const r of rows.slice(0, 400)) {
        const p = toDate(r.PrevisaoEntrega); const aberto = !fechado(r.Status) && !r.DataEntrega;
        const cls = aberto && p && p < t ? " late" : aberto && p && p <= t3 ? " soon" : "";
        list.append(h("button", { class: "item" + cls, onclick: () => detail(r) },
          h("div", { class: "l1" }, h("span", {}, r.Cliente), statusTag(r.Status)),
          h("div", { class: "l2" }, h("span", {}, r.NumeroPedido), h("span", {}, r.Produto), h("span", {}, money(r.ValorPDV)), h("span", {}, "Entrega: " + (fmtDate(r.PrevisaoEntrega) || "–")), r.FaltaReceber > 0 ? h("span", { style: { color: "#b91c1c" } }, "Falta " + money(r.FaltaReceber)) : null)));
      }
      if (init && rows.length === 1 && !aviso) detail(rows[0]);
  }

  async function detail(r) {
    const mym = r.NumeroPedido.toUpperCase().startsWith("MYM-PED-") || r.mym;
    if (mym && r.venda) return modal("Pedido faturado — myManager #" + r.venda.CodVen, ({ body, foot, close }) => { body.append(h("p", { style: { whiteSpace: "pre-line" } }, DetalhesTexto(r.venda))); foot.append(h("button", { class: "btn dark", onclick: () => close() }, "FECHAR")); });
    const act = await modal(r.NumeroPedido, ({ body, foot, close }) => {
      body.append(h("div", { style: { margin: "6px 0 10px" } }, statusTag(r.Status)));
      body.append(h("dl", { class: "kv" }, ...[["Cliente", r.Cliente], ["Produto", r.Produto], ["Orçamento", r.NumeroOrcamento], ["PDV", r.PDV], ["Aprovação", fmtDate(r.DataAprovacao)], ["Valor PDV", money(r.ValorPDV)], ["Custo do produto", money(r.CustoProduto)], ["Valor mão de obra", money(r.ValorMO)], ["Valor recebido", money(r.ValorRecebido)], ["Falta receber", money(r.FaltaReceber)], ["Previsão entrega", fmtDate(r.PrevisaoEntrega) || "–"], ["Data entrega", fmtDate(r.DataEntrega) || "–"], ["Alterado por", r.AlteradoPorNome]].filter(([, v]) => v).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
      foot.style.flexWrap = "wrap";
      if (mym) { body.append(h("p", { class: "info", style: { marginTop: "10px" } }, "Pedido faturado no myManager. Somente consulta.")); return; }
      foot.append(h("button", { class: "btn dark", onclick: () => close("edit") }, "EDITAR PEDIDO"), h("button", { class: "btn", onclick: () => close("entregue") }, "MARCAR ENTREGUE"), h("button", { class: "btn", onclick: () => close("reativar") }, "REATIVAR"));
      if (/cortina sob medida/i.test(r.Produto)) foot.append(h("button", { class: "btn", onclick: () => close("costura") }, "ORDEM DE COSTURA"));
      if (ctx.isAdmin) foot.append(h("button", { class: "btn danger", onclick: () => close("excluir") }, "EXCLUIR PEDIDO"));
    });
    if (act === "edit") { await edit(r.NumeroPedido); load(); }
    else if (act === "entregue") { if (await confirmBox("Marcar o pedido " + r.NumeroPedido + " como ENTREGUE?", "Pedido")) { await setStatusSafe(r.NumeroPedido, "ENTREGUE", true); load(); } }
    else if (act === "reativar") { await setStatusSafe(r.NumeroPedido, "ATIVO", false); load(); }
    else if (act === "costura") { ctx.go("costura/" + encodeURIComponent(r.NumeroPedido)); }
    else if (act === "excluir") { if (await deleteSafe(r)) load(); }
  }
  async function edit(ped) {
    if (!(await ctx.beginEdit("PEDIDO", ped))) return;
    try {
      const found = (await api.fetchOrders(ped, "", ctx.unit)).find((x) => x.NumeroPedido.toLowerCase() === ped.toLowerCase()); if (!found) return;
      const r = found; const n = (v) => (v ? num2(v) : "");
      const v = await formModal("Editar Pedido — " + ped, [
        { type: "note", text: "Cliente: " + r.Cliente + "  ·  Produto: " + r.Produto + "  ·  Orçamento: " + r.NumeroOrcamento },
        { name: "PDV", label: "PDV", value: r.PDV }, { name: "ValorPDV", label: "Valor PDV", value: n(r.ValorPDV), inputmode: "decimal" }, { name: "CustoProduto", label: "Custo do produto", value: n(r.CustoProduto), inputmode: "decimal" }, { name: "ValorMO", label: "Valor mão de obra", value: n(r.ValorMO), inputmode: "decimal" },
        { name: "ValorRecebido", label: "Valor recebido", value: n(r.ValorRecebido), inputmode: "decimal" }, { name: "FaltaReceber", label: "Falta receber (deixe vazio para calcular o saldo)", value: n(r.FaltaReceber), inputmode: "decimal" },
        { name: "PrevisaoEntrega", label: "Previsão entrega", type: "date", value: r.PrevisaoEntrega ? isoDay(toDate(r.PrevisaoEntrega)) : "" }, { name: "DataEntrega", label: "Data entrega", type: "date", value: r.DataEntrega ? isoDay(toDate(r.DataEntrega)) : "" },
        { name: "Status", label: "Status", type: "combo", options: EDIT, value: r.Status || "ATIVO" }],
        { okText: "SALVAR ALTERAÇÕES", validate: async (x) => {
          const vp = parseMoney(x.ValorPDV), cp = parseMoney(x.CustoProduto), mo = parseMoney(x.ValorMO), vr = parseMoney(x.ValorRecebido); let fr = parseMoney(x.FaltaReceber);
          for (const [k, val] of [["Valor PDV", vp], ["Custo do produto", cp], ["Valor mão de obra", mo], ["Valor recebido", vr], ["Falta receber", fr]]) if (val != null && val < 0) throw new Error(k + " não pode ser negativo.");
          if (fr == null && vp != null) fr = Math.max(0, vp - (vr || 0));
          const pe = x.PrevisaoEntrega ? parseBrDate(x.PrevisaoEntrega) : null, de = x.DataEntrega ? parseBrDate(x.DataEntrega) : null;
          await api.patchOrder(ped, { pdv: x.PDV.trim() || null, valor_pdv: vp, custo_produto: cp, valor_mo: mo, previsao_entrega: pe ? isoDay(pe) : null, data_entrega: de ? isoDay(de) : null, valor_recebido: vr, falta_receber: fr, status: String(x.Status || "").trim().toUpperCase(), ...ctx.editFields() }, r.SyncRevisao);
          await ctx.audit("ALTERAR", "PEDIDO", ped, "Dados do pedido atualizados na V20");
        } });
      if (v) toast("Pedido salvo.");
    } catch (e) { alertBox(friendly(e), "Editar pedido"); }
    finally { await ctx.endEdit("PEDIDO", ped); }
  }
  async function deleteSafe(r) {
    if (!ctx.isAdmin) { await alertBox("Somente o Administrador pode excluir pedidos.", "Excluir pedido"); return false; }
    const det = "Pedido: " + r.NumeroPedido + "\nCliente: " + r.Cliente + "\nProduto: " + r.Produto;
    if (!(await confirmBox("EXCLUSÃO DEFINITIVA\n\n" + det + "\n\nO orçamento de origem não será excluído. Deseja continuar?", "Excluir pedido"))) return false;
    if (!(await confirmBox("Confirma a exclusão definitiva do pedido " + r.NumeroPedido + "?\n\nEsta ação não pode ser desfeita.", "Confirmar exclusão"))) return false;
    if (!(await ctx.beginEdit("PEDIDO", r.NumeroPedido))) return false;
    try { await api.deleteOrder(r.NumeroPedido); await ctx.audit("EXCLUIR", "PEDIDO", r.NumeroPedido, "Exclusão definitiva autorizada por " + ctx.session.nome + " | Cliente: " + r.Cliente + " | Produto: " + r.Produto); toast("Pedido excluído."); return true; }
    catch (e) { alertBox(friendly(e), "Excluir pedido"); return false; }
    finally { await ctx.endEdit("PEDIDO", r.NumeroPedido); }
  }
  load();
});
