// Clientes (MainForm.Clients + CustomerForm + SaveCustomer) e Ficha Completa (CustomerHub) com anexos.
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, formModal, alertBox, confirmBox, toast, friendly, whatsappLink, fmtDate, fmtDateTime, money, statusTag, modal } from "../ui.js";

const FIELDS = (r = {}) => [
  { name: "Nome", label: "Nome *", value: r.Nome },
  { name: "Telefone", label: "Telefone", value: r.Telefone, type: "tel" },
  { name: "WhatsApp", label: "WhatsApp", value: r.WhatsApp, type: "tel" },
  { name: "CPF_CNPJ", label: "CPF / CNPJ", value: r.CPF_CNPJ, inputmode: "numeric" },
  { name: "Endereco", label: "Endereço", value: r.Endereco },
  { name: "Bairro", label: "Bairro", value: r.Bairro },
  { name: "Cidade", label: "Cidade", value: r.Cidade },
  { name: "CEP", label: "CEP", value: r.CEP, inputmode: "numeric" },
  { name: "Observacoes", label: "Observações", value: r.Observacoes, type: "textarea" },
];
const stamp = () => { const d = new Date(); const p = (n, l = 2) => String(n).padStart(l, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + p(d.getMilliseconds(), 3); };

export async function saveCustomer(f, codigo, rev) {
  if (!String(f.Nome || "").trim()) throw new Error("Informe o nome do cliente.");
  const novo = !codigo; if (novo) codigo = ctx.unit.prefix + "CLI-" + stamp();
  const t = (k) => String(f[k] || "").trim();
  if (!novo && rev != null) {
    await api.patchCustomer(codigo, { nome: t("Nome"), telefone: t("Telefone"), whatsapp: t("WhatsApp"), cpf_cnpj: t("CPF_CNPJ"), endereco: t("Endereco"), bairro: t("Bairro"), cidade: t("Cidade"), cep: t("CEP"), observacoes: t("Observacoes"), ...ctx.editFields() }, rev);
  } else {
    await api.upsertCustomer({ Codigo: codigo, Nome: t("Nome"), Telefone: t("Telefone"), WhatsApp: t("WhatsApp"), CPF_CNPJ: t("CPF_CNPJ"), Endereco: t("Endereco"), Bairro: t("Bairro"), Cidade: t("Cidade"), CEP: t("CEP"), Observacoes: t("Observacoes"), CriadoPorUserId: ctx.session.legacyId, AlteradoPorUserId: ctx.session.legacyId });
  }
  await ctx.audit(novo ? "CRIAR" : "ALTERAR", "CLIENTE", codigo, t("Nome"));
  return codigo;
}
export async function newCustomerDialog() {
  const v = await formModal("Novo cliente", FIELDS(), { validate: async (x) => { x.codigo = await saveCustomer(x, null, null); } });
  if (v) toast("Cliente salvo."); return v;
}
async function editCustomer(r) {
  if (!(await ctx.beginEdit("CLIENTE", r.Codigo))) return false;
  try { const v = await formModal("Editar cliente", FIELDS(r), { validate: (x) => saveCustomer(x, r.Codigo, r.SyncRevisao) }); if (v) toast("Cliente salvo."); return !!v; }
  finally { await ctx.endEdit("CLIENTE", r.Codigo); }
}
function openWhatsApp(r) {
  const l = whatsappLink(r.WhatsApp || r.Telefone, "Olá " + (r.Nome || "").split(" ")[0] + ", tudo bem? Aqui é da Loja São João.");
  if (!l) return alertBox("Este cliente não possui telefone ou WhatsApp cadastrado.", "WhatsApp");
  window.open(l, "_blank");
}

register("clientes", async (el, arg) => {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Clientes"), h("div", { class: "sub" }, "Cadastros, contatos e histórico comercial em uma única tela."))));
  const q = h("input", { class: "input", placeholder: "Buscar nome, telefone, CPF", enterkeyhint: "search", onkeydown: (e) => { if (e.key === "Enter") load(); } });
  el.append(h("div", { class: "toolbar" }, q, h("button", { class: "btn dark", onclick: () => load() }, "BUSCAR")));
  const list = h("div", { class: "list" }); el.append(list);
  el.append(h("button", { class: "fab", style: { background: "var(--green)" }, onclick: async () => { if (await newCustomerDialog()) load(); } }, "+ NOVO CLIENTE"));
  async function load() {
    list.innerHTML = ""; list.append(h("div", { class: "loading" }, "Carregando..."));
    try {
      const rows = await api.fetchCustomers(q.value, ctx.unit); list.innerHTML = "";
      if (!rows.length) return list.append(h("div", { class: "empty" }, "Nenhum cliente encontrado."));
      const shown = rows.slice(0, 300);
      for (const r of shown) list.append(h("button", { class: "item", onclick: () => detail(r) },
        h("div", { class: "l1" }, h("span", {}, r.Nome)), h("div", { class: "l2" }, r.WhatsApp || r.Telefone ? h("span", {}, "📞 " + (r.WhatsApp || r.Telefone)) : null, r.Cidade ? h("span", {}, r.Bairro ? r.Bairro + " · " + r.Cidade : r.Cidade) : null)));
      if (rows.length > shown.length) list.append(h("div", { class: "empty" }, rows.length + " clientes. Use a busca para encontrar os demais."));
    } catch (e) { list.innerHTML = ""; list.append(h("div", { class: "note" }, friendly(e))); }
  }
  async function detail(r) {
    const act = await modal(r.Nome, ({ body, foot, close }) => {
      body.append(h("dl", { class: "kv" }, ...[["Telefone", r.Telefone], ["WhatsApp", r.WhatsApp], ["CPF / CNPJ", r.CPF_CNPJ], ["Endereço", r.Endereco], ["Bairro", r.Bairro], ["Cidade", r.Cidade], ["CEP", r.CEP], ["Alterado por", r.AlteradoPorNome]].filter(([, v]) => v).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
      if (r.Observacoes) body.append(h("div", { class: "resumo", style: { marginTop: "10px" } }, r.Observacoes));
      foot.style.flexWrap = "wrap";
      foot.append(h("button", { class: "btn dark", onclick: () => close("editar") }, "EDITAR CLIENTE"), h("button", { class: "btn", onclick: () => close("ficha") }, "FICHA COMPLETA"),
        h("button", { class: "btn", onclick: () => close("hist") }, "HISTÓRICO COMPLETO"), h("button", { class: "btn green", onclick: () => close("whats") }, "WHATSAPP"));
    });
    if (act === "editar") { if (await editCustomer(r)) load(); }
    else if (act === "ficha" || act === "hist") ctx.go("ficha/" + encodeURIComponent(r.Codigo));
    else if (act === "whats") openWhatsApp(r);
  }
  if (arg === "novo") { if (await newCustomerDialog()) ctx.go("clientes"); }
  load();
});

// Ficha completa: dados, orçamentos, pedidos e anexos do cliente.
register("ficha", async (el, codigo) => {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Ficha Completa do Cliente"), h("div", { class: "sub" }, "Dados, histórico comercial e anexos"))));
  if (!codigo) {
    const q = h("input", { class: "input", placeholder: "Buscar cliente", enterkeyhint: "search", onkeydown: (e) => { if (e.key === "Enter") go(); } });
    const list = h("div", { class: "list" });
    el.append(h("div", { class: "toolbar" }, q, h("button", { class: "btn dark", onclick: () => go() }, "BUSCAR")), list);
    async function go() { list.innerHTML = ""; const rows = await api.fetchCustomers(q.value, ctx.unit); for (const r of rows.slice(0, 100)) list.append(h("button", { class: "item", onclick: () => ctx.go("ficha/" + encodeURIComponent(r.Codigo)) }, h("div", { class: "l1" }, h("span", {}, r.Nome)), h("div", { class: "l2" }, r.Telefone || r.WhatsApp || ""))); }
    return;
  }
  const all = await api.fetchCustomers("", ctx.unit); const r = all.find((x) => x.Codigo === codigo);
  if (!r) return el.append(h("div", { class: "note" }, "Cliente não encontrado nesta unidade."));
  el.querySelector("h1").textContent = r.Nome;
  el.append(h("div", { class: "card" }, h("dl", { class: "kv" }, ...[["Telefone", r.Telefone], ["WhatsApp", r.WhatsApp], ["CPF / CNPJ", r.CPF_CNPJ], ["Endereço", [r.Endereco, r.Bairro, r.Cidade, r.CEP].filter(Boolean).join(", ")]].filter(([, v]) => v).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
    r.Observacoes ? h("div", { class: "resumo", style: { marginTop: "10px" } }, r.Observacoes) : null,
    h("div", { class: "btns", style: { marginTop: "12px" } }, h("button", { class: "btn dark", onclick: async () => { if (await editCustomer(r)) ctx.go("ficha/" + encodeURIComponent(codigo)); } }, "Editar"), h("button", { class: "btn green", onclick: () => openWhatsApp(r) }, "WhatsApp"))));
  const orc = h("div", { class: "card" }, h("h3", {}, "Orçamentos"), h("div", { class: "loading" }, "Carregando..."));
  const ped = h("div", { class: "card" }, h("h3", {}, "Pedidos"), h("div", { class: "loading" }, "Carregando..."));
  const anex = h("div", { class: "card" }, h("h3", {}, "Anexos"), h("div", { class: "loading" }, "Carregando..."));
  el.append(orc, ped, anex);
  const nm = r.Nome.trim().toLowerCase();
  api.fetchQuotes(r.Nome, "TODOS", ctx.unit).then((qs) => { qs = qs.filter((x) => x.Cliente.trim().toLowerCase() === nm); orc.lastChild.remove(); orc.append(qs.length ? h("div", { class: "list" }, qs.map((x) => h("button", { class: "item", onclick: () => ctx.go("historico/busca/" + encodeURIComponent(x.Numero)) }, h("div", { class: "l1" }, h("span", {}, x.Numero + " · " + x.Tipo), statusTag(x.Status)), h("div", { class: "l2" }, h("span", {}, fmtDate(x.DataHora)), h("span", {}, money(x.Valor)))))) : h("div", { class: "empty" }, "Nenhum orçamento.")); }).catch((e) => (orc.lastChild.textContent = friendly(e)));
  api.fetchOrders(r.Nome, "", ctx.unit).then((os) => { os = os.filter((x) => x.Cliente.trim().toLowerCase() === nm); ped.lastChild.remove(); ped.append(os.length ? h("div", { class: "list" }, os.map((x) => h("button", { class: "item", onclick: () => ctx.go("pedidos/busca/" + encodeURIComponent(x.NumeroPedido)) }, h("div", { class: "l1" }, h("span", {}, x.NumeroPedido + " · " + x.Produto), statusTag(x.Status)), h("div", { class: "l2" }, h("span", {}, "Entrega: " + (fmtDate(x.PrevisaoEntrega) || "–")), h("span", {}, money(x.ValorPDV)))))) : h("div", { class: "empty" }, "Nenhum pedido.")); }).catch((e) => (ped.lastChild.textContent = friendly(e)));
  async function loadAnexos() {
    anex.querySelectorAll(".list,.empty,.loading,.note").forEach((n) => n.remove());
    try {
      const a = await api.fetchCustomerAttachments(codigo);
      anex.insertBefore(a.length ? h("div", { class: "list" }, a.map((x) => h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, x.NomeArquivo), h("span", { class: "tag", style: { background: "#f3f4f6" } }, x.Categoria)),
        h("div", { class: "l2" }, h("span", {}, x.TamanhoMB + " MB"), h("span", {}, x.IncluidoPor), h("span", {}, fmtDateTime(x.Data))),
        h("div", { class: "btns", style: { marginTop: "8px" } }, h("button", { class: "btn", onclick: async () => { try { const b = await api.downloadCustomerAttachment(x.StoragePath); const u = URL.createObjectURL(b); const a2 = h("a", { href: u, download: x.NomeArquivo, target: "_blank" }); document.body.append(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); } catch (e) { alertBox(friendly(e)); } } }, "Abrir"),
          h("button", { class: "btn danger", onclick: async () => { if (!(await confirmBox("Excluir o anexo " + x.NomeArquivo + "?"))) return; try { await api.deleteCustomerAttachment(x.Id, x.StoragePath); await ctx.audit("EXCLUIR", "ANEXO_CLIENTE", codigo, x.NomeArquivo); loadAnexos(); } catch (e) { alertBox(friendly(e)); } } }, "Excluir"))))) : h("div", { class: "empty" }, "Nenhum anexo."), addBtn);
    } catch (e) { anex.insertBefore(h("div", { class: "note" }, friendly(e)), addBtn); }
  }
  const file = h("input", { type: "file", class: "hidden", accept: "image/*,application/pdf,*/*" });
  const addBtn = h("div", { class: "btns", style: { marginTop: "10px" } }, h("button", { class: "btn dark", onclick: () => file.click() }, "+ Incluir anexo / foto"), file);
  anex.append(addBtn);
  file.addEventListener("change", async () => {
    const f = file.files[0]; file.value = ""; if (!f) return;
    const v = await formModal("Incluir anexo", [{ name: "cat", label: "Categoria", type: "select", options: ["Medição", "Foto do ambiente", "Projeto", "Contrato", "Comprovante", "Documento", "Outro"] }], { okText: "ENVIAR" });
    if (!v) return; toast("Enviando " + f.name + "...");
    try { await api.uploadCustomerAttachment(codigo, r.Nome, v.cat, f, ctx.session.userId, ctx.session.nome); await ctx.audit("CRIAR", "ANEXO_CLIENTE", codigo, f.name); toast("Anexo enviado."); loadAnexos(); }
    catch (e) { alertBox(friendly(e), "Anexos"); }
  });
  loadAnexos();
});

// Busca geral (barra do topo).
register("busca", async (el, term) => {
  term = decodeURIComponent(term || "");
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Busca Geral"), h("div", { class: "sub" }, "“" + term + "” em clientes, orçamentos e pedidos"))));
  const [c, q, o] = await Promise.all([api.fetchCustomers(term, ctx.unit).catch(() => []), api.fetchQuotes(term, "TODOS", ctx.unit).catch(() => []), api.fetchOrders(term, "", ctx.unit).catch(() => [])]);
  const sec = (t, arr, fn) => h("div", { class: "card" }, h("h3", {}, t + " (" + arr.length + ")"), arr.length ? h("div", { class: "list" }, arr.slice(0, 30).map(fn)) : h("div", { class: "empty" }, "Nada encontrado."));
  el.append(
    sec("Clientes", c, (r) => h("button", { class: "item", onclick: () => ctx.go("ficha/" + encodeURIComponent(r.Codigo)) }, h("div", { class: "l1" }, h("span", {}, r.Nome)), h("div", { class: "l2" }, r.WhatsApp || r.Telefone || ""))),
    sec("Orçamentos", q, (r) => h("button", { class: "item", onclick: () => ctx.go("historico/busca/" + encodeURIComponent(r.Numero)) }, h("div", { class: "l1" }, h("span", {}, r.Numero + " · " + r.Cliente), statusTag(r.Status)), h("div", { class: "l2" }, r.Tipo + " · " + money(r.Valor)))),
    sec("Pedidos", o, (r) => h("button", { class: "item", onclick: () => ctx.go("pedidos/busca/" + encodeURIComponent(r.NumeroPedido)) }, h("div", { class: "l1" }, h("span", {}, r.NumeroPedido + " · " + r.Cliente), statusTag(r.Status)), h("div", { class: "l2" }, r.Produto + " · " + money(r.ValorPDV)))));
});
