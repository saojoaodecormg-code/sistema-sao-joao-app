// Histórico de orçamentos (Operations.History): filtros rápidos, período, vendedor, status, retorno.
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, modal, formModal, alertBox, toast, friendly, money, fmtDate, toDate, today, statusTag, tag, isoDay, parseBrDate } from "../ui.js";

const STATUS = ["ORÇAMENTO", "ENVIADO", "ACOMPANHAR", "AGUARDANDO CLIENTE", "AGUARDANDO MEDIÇÃO", "NEGOCIAÇÃO", "APROVADO", "NEGADO", "CANCELADO", "EXPIRADO"];
const MOTIVOS = ["Preço", "Prazo", "Concorrência", "Falta de retorno", "Cliente desistiu", "Projeto adiado", "Falta de orçamento/budget", "Optou por outra solução", "Outro"];
const persolTag = (r) => String(r.Resumo || "").includes("<SJ_PERSOL_PEDIDO>");
const aberto = (r) => !["APROVADO", "FATURADO", "NEGADO", "CANCELADO", "EXPIRADO"].includes(String(r.Status).trim().toUpperCase());

export async function changeStatus(r, novo) {
  novo = String(novo || "").trim().toUpperCase();
  if (!novo) throw new Error("Informe o status.");
  if (novo.length > 30) throw new Error("O status deve ter no máximo 30 caracteres.");
  if (novo === "APROVADO") {
    // No PC a aprovação pede a forma de pagamento e envia a pré-venda ao myManager, que só existe na loja.
    throw new Error("A aprovação envia a pré-venda ao myManager da loja. Enquanto a ponte do myManager com a nuvem não estiver ligada, aprove este orçamento pelo computador da loja.");
  }
  let motivo = "";
  if (novo === "NEGADO" || novo === "CANCELADO") {
    const m = await formModal("Motivo da perda", [{ name: "m", label: "Motivo da perda *", type: "select", options: ["", ...MOTIVOS] }, { name: "o", label: "Observações", type: "textarea" }],
      { okText: "CONFIRMAR", validate: (x) => { if (!x.m) throw new Error("Informe o motivo da perda."); } });
    if (!m) throw new Error("Alteração cancelada: informe o motivo da perda.");
    motivo = m.m + (m.o.trim() ? " — " + m.o.trim() : "");
  }
  if (!(await ctx.beginEdit("ORCAMENTO", r.Numero))) throw new Error("O orçamento está em edição em outra estação.");
  try {
    await api.patchQuote(r.Numero, { status: novo, ...ctx.editFields() });
    await ctx.audit("STATUS", "ORCAMENTO", r.Numero, "Status remoto -> " + novo + (motivo ? " | Motivo da perda: " + motivo : ""));
  } finally { await ctx.endEdit("ORCAMENTO", r.Numero); }
}
export async function changeReturn(r, d) {
  if (!(await ctx.beginEdit("ORCAMENTO", r.Numero))) throw new Error("O orçamento está em edição em outra estação.");
  try {
    await api.patchQuote(r.Numero, { retornar_em: isoDay(d), ...ctx.editFields() });
    await ctx.audit("RETORNO", "ORCAMENTO", r.Numero, "Próximo contato: " + d.toLocaleDateString("pt-BR"));
  } finally { await ctx.endEdit("ORCAMENTO", r.Numero); }
}

// QuoteSafeEdit.cs: EditSelectedQuote + QuoteEditForm (nuvem).
const N2 = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (v) => { const d = toDate(v); return d ? d.toLocaleDateString("pt-BR") : ""; };
function lerData(s) { s = String(s || "").trim(); if (!s) return null; const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); if (d.getMonth() === +m[2] - 1) return d; } throw new Error("Data inválida. Use dd/mm/aaaa."); }
function lerValor(s) { const t = String(s || "").trim().replace(/R\$\s*/, ""); const v = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t); if (!t || !isFinite(v)) throw new Error("Valor inválido."); return v; }
const snapshotDe = (c, t, v, val) => "Cliente=" + c + " | Tipo=" + t + " | Vendedor=" + v + " | Valor=" + N2(val);
async function garantirClienteMyManager(numero, row) {
  const m = /<SJ_MYM_CLIENTE>(\d+)<\/SJ_MYM_CLIENTE>/i.exec(row.Resumo || ""); if (m && Number(m[1]) > 0) return;
  const { pickMyManagerCustomer } = await import("./orcamentos.js");
  const cf = await pickMyManagerCustomer(row.Cliente);
  if (!cf) throw new Error("Este orçamento antigo ainda não possui cliente myManager vinculado. Selecione o cliente para continuar.");
  const id = Number(cf.Id); if (!(id > 0)) throw new Error("Cliente myManager inválido.");
  const novoResumo = String(row.Resumo || "").replace(/\s+$/, "") + "\r\n<SJ_MYM_CLIENTE>" + id + "</SJ_MYM_CLIENTE>";
  await api.patchQuote(numero, { cliente: cf.Nome, resumo: novoResumo, mymanager_cliente_id: id, integracao_elegivel: true, integracao_status: "AGUARDANDO_APROVACAO", integracao_atualizada_em: new Date().toISOString(), ...ctx.editFields() });
  row.Cliente = cf.Nome; row.Resumo = novoResumo;
  await ctx.audit("VINCULAR_MYMANAGER", "ORCAMENTO", numero, "Cliente myManager vinculado: " + cf.Nome + " (ID " + id + ")");
  await alertBox("Cliente do myManager vinculado ao orçamento com sucesso.\n\nAgora este orçamento pode seguir para aprovação e integração.", "myManager");
}
export async function editQuote(r) {
  const numero = r.Numero, status = String(r.Status || "").toUpperCase();
  if (numero.toUpperCase().startsWith("PERSOL-")) { await alertBox("O orçamento da Persol é ajustado pela tela própria da Integração Persol (frete, deslocamento e valor Persol), no computador que roda a integração.", "Integração Persol"); return false; }
  if (!(await ctx.beginEdit("ORCAMENTO", numero))) return false;
  try {
    api.clearCachePrefix("quotes:");
    const row = (await api.fetchQuotes(numero, "TODOS", ctx.unit)).find((x) => x.Numero.toLowerCase() === numero.toLowerCase());
    if (!row) throw new Error("Orçamento não encontrado.");
    await garantirClienteMyManager(numero, row);
    const approved = status === "APROVADO";
    const f = await formModal(approved ? "Revisar orçamento aprovado" : "Editar orçamento", [
      { name: "c", label: "Cliente", value: row.Cliente }, { name: "t", label: "Tipo", value: row.Tipo }, { name: "v", label: "Vendedor", value: row.Vendedor },
      { name: "val", label: "Valor", value: N2(row.Valor), inputmode: "decimal" }, { name: "ret", label: "Retornar em", value: dataBr(row.RetornarEm), placeholder: "dd/mm/aaaa", inputmode: "numeric" }, { name: "vld", label: "Validade até", value: dataBr(row.ValidadeAte), placeholder: "dd/mm/aaaa", inputmode: "numeric" },
      { name: "res", label: "Resumo / observações", type: "textarea", rows: 6, value: row.Resumo },
      { name: "rev", label: "Salvar como nova versão e preservar o orçamento original", type: "checkbox", value: approved },
      ...(approved ? [{ type: "note", text: "Este orçamento já está APROVADO. Por segurança, qualquer alteração deve gerar uma nova revisão." }] : []),
    ], { okText: approved ? "CRIAR REVISÃO" : "SALVAR ALTERAÇÕES", validate: (x) => { lerValor(x.val); lerData(x.ret); lerData(x.vld); } });
    if (!f) return false;
    f.res = String(f.res).replace(/\r?\n/g, "\r\n"); const val = lerValor(f.val), ret = lerData(f.ret), vld = lerData(f.vld), cli = f.c.trim(), tipo = f.t.trim(), vend = f.v.trim();
    if (approved && !f.rev) throw new Error("Orçamento aprovado só pode ser alterado criando uma nova revisão.");
    const before = snapshotDe(row.Cliente, row.Tipo, row.Vendedor, row.Valor) + " | Status=" + row.Status, depois = snapshotDe(cli, tipo, vend, val);
    if (f.rev) {
      const novo = await api.nextCommercialNumber(ctx.unit, "ORC", new Date().getFullYear()); const now = new Date().toISOString();
      await api.upsertQuote({ numero: novo, data_hora: now, cliente: cli, tipo, vendedor: vend, resumo: "REVISÃO DE " + numero + "\r\n" + f.res, valor: val, status: "ORÇAMENTO", retornar_em: ret ? isoDay(ret) : null, validade_ate: vld ? isoDay(vld) : null,
        criado_por_legacy_id: ctx.session.legacyId || null, criado_por_nome: ctx.session.nome, criado_em: now, alterado_por_legacy_id: ctx.session.legacyId || null, alterado_por_nome: ctx.session.nome, alterado_em: now });
      await ctx.audit("REVISAO", "ORCAMENTO", novo, "Revisão criada a partir de " + numero + " | " + before + " -> " + depois);
      await alertBox("Nova revisão criada com sucesso:\n" + novo + "\n\nO orçamento original foi preservado.", "Revisão");
    } else {
      await api.patchQuote(numero, { cliente: cli, tipo, vendedor: vend, resumo: f.res, valor: val, retornar_em: ret ? isoDay(ret) : null, validade_ate: vld ? isoDay(vld) : null, ...ctx.editFields() });
      await ctx.audit("EDITAR", "ORCAMENTO", numero, before + " -> " + depois);
      await alertBox("Alterações salvas. O histórico foi registrado na Auditoria.", "Editar orçamento");
    }
    return true;
  } catch (e) { await alertBox(friendly(e), "Editar orçamento"); return false; }
  finally { await ctx.endEdit("ORCAMENTO", numero); }
}

register("historico", async (el, arg) => {
  let initialChip = 0, initialSearch = "";
  if (arg === "atrasados") initialChip = 3; else if (arg === "hoje") initialChip = 2; else if (arg && arg.startsWith("busca/")) initialSearch = decodeURIComponent(arg.slice(6));
  const sub = h("div", { class: "sub" });
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Histórico de orçamentos"), sub), h("button", { class: "btn primary", onclick: () => ctx.go("orcamentos") }, "+ Novo orçamento")));
  const q = h("input", { class: "input", placeholder: "Buscar e tecle Enter", value: initialSearch, enterkeyhint: "search", onkeydown: (e) => { if (e.key === "Enter") load(); } });
  const per = h("select", { class: "select", style: { width: "auto" }, onchange: () => render() }, ...["Todo o período", "Este mês", "Últimos 30 dias", "Últimos 90 dias"].map((t, i) => h("option", { value: i }, t)));
  const vend = h("select", { class: "select", style: { width: "auto" }, onchange: () => render() }, h("option", { value: "" }, "Vendedor"));
  el.append(h("div", { class: "toolbar" }, q), h("div", { class: "toolbar" }, per, vend));
  const chipNames = ["Todos", "Em aberto", "Retornar hoje", "Atrasados"]; if (ctx.unit.code === "DECOR") chipNames.push("Virou pedido Persol"); chipNames.push("Aprovados", "Perdidos");
  let chipSel = initialChip; const chips = h("div", { class: "chips" }); el.append(chips);
  const list = h("div", { class: "list" }); el.append(list);
  let rows = [];
  const match = (k, r) => {
    const n = chipNames[k], x = String(r.Status).trim().toUpperCase(), t = today();
    if (n === "Todos") return true; if (n === "Em aberto") return aberto(r);
    const ret = toDate(r.RetornarEm);
    if (n === "Retornar hoje") return aberto(r) && ret && +ret === +t;
    if (n === "Atrasados") return aberto(r) && ret && ret < t;
    if (n === "Virou pedido Persol") return persolTag(r) && aberto(r);
    if (n === "Aprovados") return x === "APROVADO" || x === "FATURADO";
    return x === "NEGADO" || x === "CANCELADO" || x === "EXPIRADO";
  };
  const extra = (r) => {
    if (vend.value && String(r.Vendedor).trim().toLowerCase() !== vend.value.toLowerCase()) return false;
    const p = +per.value; if (!p) return true; const d = toDate(r.DataHora); if (!d) return false; const t = today();
    if (p === 1) return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
    const lim = new Date(t); lim.setDate(lim.getDate() - (p === 2 ? 30 : 90)); return d >= lim;
  };
  function render() {
    const base = rows.filter(extra);
    chips.innerHTML = "";
    chipNames.forEach((n, i) => chips.append(h("button", { class: "chipf" + (i === chipSel ? " on" : ""), onclick: () => { chipSel = i; render(); } }, n, h("span", { class: "c" }, base.filter((r) => match(i, r)).length))));
    const shown = base.filter((r) => match(chipSel, r));
    const tot = shown.reduce((s, r) => s + r.Valor, 0);
    sub.textContent = shown.length + " orçamento(s) · " + money(tot) + (vend.value ? " · " + vend.value : "");
    list.innerHTML = "";
    if (!shown.length) return list.append(h("div", { class: "empty" }, "Nenhum orçamento neste filtro."));
    for (const r of shown.slice(0, 400)) {
      const ret = toDate(r.RetornarEm); const t = today();
      list.append(h("button", { class: "item" + (aberto(r) && ret && ret < t ? " late" : aberto(r) && ret && +ret === +t ? " soon" : ""), onclick: () => detail(r) },
        h("div", { class: "l1" }, h("span", {}, r.Cliente || "(sem cliente)"), persolTag(r) && aberto(r) ? tag("Virou pedido", [194, 65, 12]) : statusTag(r.Status)),
        h("div", { class: "l2" }, h("span", {}, r.Numero), h("span", {}, r.Tipo), h("span", {}, money(r.Valor)), h("span", {}, "Retorno: " + (ret ? (+ret === +t ? "hoje" : ret.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })) : "–")))));
    }
  }
  async function load() {
    list.innerHTML = ""; list.append(h("div", { class: "loading" }, "Carregando..."));
    try {
      rows = await api.fetchQuotes(q.value, "TODOS", ctx.unit);
      const vs = [...new Set(rows.map((r) => String(r.Vendedor || "").trim()).filter(Boolean))].sort();
      const cur = vend.value; vend.innerHTML = ""; vend.append(h("option", { value: "" }, "Vendedor"), ...vs.map((v) => h("option", { value: v, selected: v === cur }, v)));
      render();
      if (initialSearch && rows.length === 1) { const r = rows[0]; initialSearch = ""; detail(r); }
    } catch (e) { list.innerHTML = ""; list.append(h("div", { class: "note" }, friendly(e))); }
  }
  async function detail(r) {
    const act = await modal(r.Numero, ({ body, foot, close }) => {
      body.append(h("div", { style: { margin: "6px 0 10px" } }, persolTag(r) && aberto(r) ? tag("Virou pedido", [194, 65, 12]) : statusTag(r.Status)));
      body.append(h("dl", { class: "kv" }, ...[["Cliente", r.Cliente], ["Tipo", r.Tipo], ["Vendedor", r.Vendedor], ["Data", fmtDate(r.DataHora)], ["Retornar em", fmtDate(r.RetornarEm) || "–"], ["Validade", fmtDate(r.ValidadeAte) || "–"], ["Valor", money(r.Valor)], ["Alterado por", r.AlteradoPorNome]].filter(([, v]) => v).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
      if (r.Resumo) body.append(h("div", { class: "lbl" }, "Resumo"), h("div", { class: "resumo" }, r.Resumo.replace(/<SJ_[A-Z_]+>[\s\S]*?<\/SJ_[A-Z_]+>/g, "").replace(/<SJ_[A-Z_]+>/g, "").trim()));
      foot.style.flexWrap = "wrap";
      foot.append(h("button", { class: "btn dark", onclick: () => close("editar") }, "EDITAR ORÇAMENTO"), h("button", { class: "btn", onclick: () => close("status") }, "Alterar status"), h("button", { class: "btn", onclick: () => close("retorno") }, "Alterar retorno"),
        h("button", { class: "btn dark", onclick: () => close("print") }, "Visualizar / imprimir"));
    });
    try {
      if (act === "editar") { if (await editQuote(r)) load(); }
      else if (act === "status") {
        const v = await formModal("Alterar status do orçamento", [{ name: "s", label: "Novo status (escolha ou digite manualmente)", type: "combo", options: STATUS, value: r.Status || "ORÇAMENTO" }, { type: "note", text: "Você também pode escrever um status personalizado." }], { okText: "CONFIRMAR" });
        if (v) { await changeStatus(r, v.s); toast("Status alterado."); load(); }
      } else if (act === "retorno") {
        const cur = toDate(r.RetornarEm) || today();
        const v = await formModal("Próximo retorno", [{ name: "d", label: "Data do próximo contato", type: "date", value: isoDay(cur) }], { okText: "CONFIRMAR" });
        if (v && v.d) { await changeReturn(r, parseBrDate(v.d)); toast("Retorno alterado."); load(); }
      } else if (act === "print") {
        const { printQuote } = await import("./impressao.js"); printQuote(r);
      }
    } catch (e) { alertBox(friendly(e), "Orçamento"); }
  }
  load();
});
