// Agenda Integrada (AgendaIntegrada.cs): hoje, 7 dias, todos; novo agendamento; marcar concluído.
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, modal, formModal, alertBox, toast, friendly, toDate, today, tag, isoDay, parseBrDate, whatsappLink } from "../ui.js";

register("agenda", async (el) => {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Agenda Integrada"), h("div", { class: "sub" }, "Medições, Instalações, Entregas e Retornos"))));
  let mode = 1; const modes = ["HOJE", "7 DIAS", "TODOS"];
  const chips = h("div", { class: "chips" }); el.append(chips);
  el.append(h("p", { style: { color: "#6b7280", fontSize: "13px", margin: "0 0 8px" } }, "Vermelho = atrasado | Amarelo = hoje | Azul = próximos dias | Verde = concluído."));
  const list = h("div", { class: "list" }); el.append(list);
  el.append(h("button", { class: "fab", style: { background: "#25844b" }, onclick: novo }, "+ NOVO AGENDAMENTO"));
  const drawChips = () => { chips.innerHTML = ""; modes.forEach((m, i) => chips.append(h("button", { class: "chipf" + (i === mode ? " on" : ""), onclick: () => { mode = i; drawChips(); load(); } }, m))); chips.append(h("button", { class: "chipf", onclick: () => load() }, "ATUALIZAR")); };
  drawChips();
  async function load() {
    list.innerHTML = ""; list.append(h("div", { class: "loading" }, "Carregando..."));
    try {
      let d = await api.fetchAgenda(ctx.unit.code); const ini = today(), fim = new Date(ini); fim.setDate(fim.getDate() + (mode === 0 ? 1 : 8));
      if (mode < 2) d = d.filter((r) => { const x = toDate(r.DataHora); return x && x >= ini && x < fim; });
      list.innerHTML = ""; if (!d.length) return list.append(h("div", { class: "empty" }, "Nenhum compromisso neste período."));
      for (const r of d) {
        const dh = toDate(r.DataHora); const done = /CONCLU/i.test(r.Status); const isToday = dh && +new Date(dh.getFullYear(), dh.getMonth(), dh.getDate()) === +today();
        const cls = done ? " done" : dh && dh < new Date() && !isToday ? " late" : isToday ? " soon" : " next";
        list.append(h("button", { class: "item" + cls, onclick: () => detail(r) },
          h("div", { class: "l1" }, h("span", {}, (dh ? dh.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + dh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "") + "  " + r.Tipo), tag(r.Status || "AGENDADO", done ? [10, 122, 65] : [61, 82, 102])),
          h("div", { class: "l2" }, h("span", {}, r.Titulo), r.Cliente ? h("span", {}, r.Cliente) : null, r.Responsavel ? h("span", {}, "Resp.: " + r.Responsavel) : null)));
      }
    } catch (e) { list.innerHTML = ""; list.append(h("div", { class: "note" }, friendly(e))); }
  }
  async function detail(r) {
    const act = await modal(r.Tipo + " — " + r.Titulo, ({ body, foot, close }) => {
      body.append(h("dl", { class: "kv" }, ...[["Data/hora", toDate(r.DataHora)?.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })], ["Status", r.Status], ["Cliente", r.Cliente], ["Responsável", r.Responsavel], ["Telefone", r.Telefone], ["Endereço", r.Endereco], ["Orçamento", r.Orcamento], ["Pedido", r.Pedido]].filter(([, v]) => v).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
      if (r.Observacoes) body.append(h("div", { class: "resumo", style: { marginTop: "10px" } }, r.Observacoes));
      foot.style.flexWrap = "wrap";
      if (r.Endereco) foot.append(h("a", { class: "btn", href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(r.Endereco), target: "_blank" }, "Abrir no mapa"));
      const w = whatsappLink(r.Telefone); if (w) foot.append(h("a", { class: "btn green", href: w, target: "_blank" }, "WhatsApp"));
      if (!/CONCLU/i.test(r.Status)) foot.append(h("button", { class: "btn dark", onclick: () => close("ok") }, "MARCAR CONCLUÍDO"));
    });
    if (act === "ok") { try { await api.patchAgendaStatus(r.Id, "CONCLUIDO"); toast("Marcado como concluído."); load(); } catch (e) { alertBox(friendly(e), "Agenda"); } }
  }
  async function novo() {
    const v = await formModal("Novo Agendamento", [
      { name: "Tipo", label: "Tipo", type: "select", options: ["MEDICAO", "INSTALACAO", "ENTREGA", "RETORNO", "OUTRO"] },
      { name: "Titulo", label: "Título / Serviço" }, { name: "Cliente", label: "Cliente" }, { name: "Responsavel", label: "Responsável" },
      { name: "Data", label: "Data", type: "date", value: isoDay(today()) }, { name: "Hora", label: "Hora", type: "time", value: "09:00" },
      { name: "Telefone", label: "Telefone / WhatsApp", type: "tel" }, { name: "Endereco", label: "Endereço" },
      { name: "Orcamento", label: "Nº Orçamento" }, { name: "Pedido", label: "Nº Pedido" }, { name: "Observacoes", label: "Observações", type: "textarea" }],
      { okText: "SALVAR", validate: async (x) => {
        if (!x.Titulo.trim()) throw new Error("Informe o título / serviço.");
        const d = parseBrDate(x.Data) || today(); const [hh, mm] = String(x.Hora || "09:00").split(":").map(Number); d.setHours(hh || 0, mm || 0, 0, 0); x.DataHora = d;
        await api.createAgendaEvent(ctx.unit.code, x, ctx.session.nome);
        await ctx.audit("CRIAR", "AGENDA", x.Titulo, x.Tipo + " em " + d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }));
      } });
    if (v) { toast("Agendamento salvo."); load(); }
  }
  load();
});
