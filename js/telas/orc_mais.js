// Cobertura policarbonato (MainForm.Poly + planilha Policarbonato.xlsx), Papel de Parede (MainForm.Wallpaper)
// e Orçamento por ambientes (MainForm.Ambientes + Operations.EnvironmentSummary).
import { ctx, register } from "../app.js";
import { h, modal, alertBox, confirmBox, friendly, money } from "../ui.js";
import { precos, G, pctText } from "../precos.js";
import { quoteScreen, savePending, saveBudgetCloud, negotiate } from "./orcamentos.js";
import { calculatePoly } from "../planilhas/policarbonato.js";

const M = money;
const br2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N = (s) => { const t = String(s ?? "").replace(/R\$/g, "").trim().replace(/\s/g, ""); if (!t) return 0; const v = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return isFinite(v) ? v : 0; };
const r2 = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9) / 100;
const fail = (m) => { throw new Error(m); };

// ---------- Cobertura em policarbonato ----------
register("orc/policarbonato", (el) => quoteScreen(el, { title: "Cobertura em Policarbonato", sub: "Cálculo completo da planilha", tipo: "Cobertura policarbonato",
  fields: [
    { name: "qe", label: "Qtd. estruturas", value: "1" },
    { name: "fu", label: "Largura fundo (m)", value: "", half: true }, { name: "fr", label: "Largura frente (m)", value: "", half: true },
    { name: "le", label: "Lateral esquerda (m)", value: "", half: true }, { name: "ld", label: "Lateral direita (m)", value: "", half: true },
    { name: "tq", label: "Treliça — qtd", value: "0", half: true }, { name: "tt", label: "Treliça — tamanho (m)", value: "0", half: true },
    { name: "pq", label: "Poste — qtd", value: "0", half: true }, { name: "pt", label: "Poste — tamanho (m)", value: "0", half: true },
    { name: "es", label: "Estrutura", type: "select", options: ["Reta", "Curva", "Pergolado"], half: true }, { name: "inc", label: "Inclinação", type: "select", options: ["Padrão", "Média", "Muita"], half: true },
    { name: "ru", label: "Rufo", type: "select", options: ["Não", "LD", "LE", "Fundo"], half: true }, { name: "cal", label: "Calha", type: "select", options: ["Não", "LD", "LE", "Frente"], half: true },
    { name: "cp", label: "Cor policarbonato", type: "select", options: ["Cinza", "Branca", "Outra"], half: true }, { name: "cpo", label: "Se Outra", value: "", text: true, half: true },
    { name: "ce", label: "Cor estrutura", type: "select", options: ["Cinza", "Branca", "Outra"], half: true }, { name: "ceo", label: "Se Outra", value: "", text: true, half: true },
    { name: "obs", label: "Observações", type: "textarea", value: "" },
  ],
  calc: (v, cfg) => {
    const fundo = N(v.fu), frente = N(v.fr), latE = N(v.le), latD = N(v.ld);
    if (fundo <= 0 || frente <= 0 || latE <= 0 || latD <= 0) fail("Informe as quatro medidas da cobertura com valores maiores que zero.");
    const qtdEstr = Math.max(1, Math.trunc(N(v.qe))), treQtd = Math.max(0, Math.trunc(N(v.tq))), posQtd = Math.max(0, Math.trunc(N(v.pq))), treTam = N(v.tt), posTam = N(v.pt);
    if (treQtd > 0 && treTam <= 0) fail("Informe o tamanho da treliça.");
    if (posQtd > 0 && posTam <= 0) fail("Informe o tamanho do poste.");
    let corP = v.cp, corE = v.ce;
    if (corP === "Outra") { corP = v.cpo.trim(); if (!corP) fail("Informe a outra cor do policarbonato."); }
    if (corE === "Outra") { corE = v.ceo.trim(); if (!corE) fail("Informe a outra cor da estrutura."); }
        const x = calculatePoly([...cfg.polyInternal.values()], { cliente: v.__cliente, vendedor: ctx.session.nome, obs: v.obs, qtdEstrut: qtdEstr, fundo, frente, le: latE, ld: latD, trelicaQtd: treQtd, trelicaTam: treTam, posteQtd: posQtd, posteTam: posTam, estrutura: v.es, inclinacao: v.inc, rufo: v.ru, calha: v.cal, corP, corE });
    let text = "MEDIDAS: Fundo " + br2(fundo) + " m | Frente " + br2(frente) + " m | LE " + br2(latE) + " m | LD " + br2(latD) + " m\r\n" +
      "Estruturas: " + qtdEstr + " | Estrutura: " + v.es + " | Inclinação: " + v.inc + "\r\n" +
      "Treliça: " + treQtd + " x " + br2(treTam) + " m | Poste: " + posQtd + " x " + br2(posTam) + " m\r\n" +
      "Rufo: " + v.ru + " | Calha: " + v.cal + " | Cor polic.: " + corP + " | Cor estrutura: " + corE + "\r\n\r\n" +
      "Área calculada: " + br2(x.Area) + " m²\r\nPeso total: " + br2(x.Peso) + " kg\r\nMateriais: " + M(x.Materiais) + "\r\nEstrutura: " + M(x.Estrutura) + "\r\nCalha/Rufo: " + M(x.CalhaRufo) + "\r\nAdministração: " + M(x.Adm);
    const negPct = cfg.negotiationPct("Cobertura policarbonato"), base = x.Final, neg = (base * negPct) / 100, total = base + neg;
    text += "\r\nAdicional de Negociação (" + pctText(negPct) + "): " + M(neg) + "\r\nTOTAL FINAL: " + M(total);
    return { total, text, resumo: text + (v.obs.trim() ? "\r\nObservações: " + v.obs : "") };
  } }));

// ---------- Papel de Parede ----------
register("orc/papel", async (el) => {
  const cfg = await precos(ctx.unit).ensureFresh();
  const pp = { SaleFactor: cfg.param(G.Wallpaper, "Fator venda sobre custo"), MountPerRoll: cfg.param(G.Wallpaper, "Montagem por bobina (R$)"), NegotiationPct: cfg.negotiationPct("Papel de parede") };
  const dec4 = (v) => (Math.round(v * 10000) / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  const tag = () => "<SJ_PP_PARAMS>fator=" + dec4(pp.SaleFactor) + ";montagem=" + br2(pp.MountPerRoll) + ";negociacao=" + dec4(pp.NegotiationPct) + "</SJ_PP_PARAMS>";
  const marginText = () => ((pp.SaleFactor - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  const inp = (v, mode) => h("input", { class: "input", value: v, inputmode: mode || "text" });
  const cli = inp(""), model = inp(""), refer = inp(""), q = inp("1", "numeric"), u = inp("", "decimal"), frete = inp("0", "decimal");
  const rows = []; let editIndex = -1, pending = null, original = 0, lock = false;
  const add = h("button", { class: "btn green" }, "ADICIONAR ITEM");
  const save = h("button", { class: "btn dark", disabled: true }, "SALVAR ORÇAMENTO");
  const list = h("div", { class: "list" });
  const resumoV = h("div", { class: "resumo" }, "RESUMO DO ORÇAMENTO\nAdicione um item para calcular.");
  const totalV = h("div", { class: "v" }, "—"), totalS = h("div", { class: "s" }, "");
  const desc = inp("0,00", "decimal"), fech = inp("", "decimal"), det = h("div", { class: "sub", style: { marginTop: "6px" } }, "Adicione os itens para informar o valor fechado.");
  const fecharBtn = h("button", { class: "btn primary block", style: { marginTop: "10px" } }, "FECHAR PEDIDO");
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Papel de Parede"))),
    h("div", { class: "card" }, h("label", { class: "lbl" }, "Cliente"), cli,
      h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Modelo"), model), h("div", {}, h("label", { class: "lbl" }, "Referência"), refer)),
      h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Qtd"), q), h("div", {}, h("label", { class: "lbl" }, "Custo unitário (R$)"), u)),
      h("label", { class: "lbl" }, "Frete (R$) - sem margem"), frete),
    h("div", { class: "btns grid2", style: { margin: "12px 0" } }, add, save), list,
    h("div", { class: "kpi", style: { margin: "10px 0" } }, h("div", { class: "t" }, "Valor total"), totalV, totalS), resumoV,
    h("div", { class: "card", style: { marginTop: "10px" } }, h("div", { class: "lbl", style: { fontWeight: "700" } }, "FECHAMENTO DO ORÇAMENTO"),
      h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Desconto (%)"), desc), h("div", {}, h("label", { class: "lbl" }, "Valor fechado (R$)"), fech)), det, fecharBtn));
  const clearAll = () => { pending = null; save.disabled = true; totalV.textContent = "—"; totalS.textContent = ""; };
  const setFech = (v) => { original = v; lock = true; desc.value = "0,00"; fech.value = v > 0 ? br2(v) : ""; lock = false; det.textContent = v > 0 ? "Original: " + M(v) + "  |  Desconto: " + M(0) + "  |  FECHADO: " + M(v) : "Adicione os itens para informar o valor fechado."; };
  desc.addEventListener("input", () => { if (lock || original <= 0) return; const p = N(desc.value); if (!(p >= 0 && p < 100) || !/\d/.test(desc.value)) { det.textContent = "Desconto inválido. Informe de 0% a menos de 100%."; return; } const val = r2(original * (1 - p / 100)); lock = true; fech.value = br2(val); lock = false; det.textContent = "Original: " + M(original) + "  |  Desconto: " + M(original - val) + "  |  FECHADO: " + M(val); });
  fech.addEventListener("input", () => { if (lock || original <= 0) return; const val = N(fech.value); if (!(val > 0 && val <= original)) { det.textContent = "Valor fechado inválido: deve ser maior que zero e até o total calculado."; return; } const p = r2((1 - val / original) * 100); lock = true; desc.value = br2(p); lock = false; det.textContent = "Original: " + M(original) + "  |  Desconto: " + M(original - val) + "  |  FECHADO: " + M(val); });
  function draw() {
    list.innerHTML = "";
    rows.forEach((r, i) => list.append(h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, (r.modelo || "(sem modelo)") + (r.ref ? " · Ref " + r.ref : "")), h("span", {}, M(r.total))),
      h("div", { class: "l2" }, "Qtd " + br2(r.qtd) + " × " + M(r.unit) + " (com margem)"),
      h("div", { class: "btns", style: { marginTop: "6px" } }, h("button", { class: "btn small", onclick: () => edit(i) }, "EDITAR ITEM"), h("button", { class: "btn small danger", onclick: () => remove(i) }, "EXCLUIR ITEM")))));
  }
  function atualizar() {
    const fre = N(frete.value); if (fre < 0) { clearAll(); return; }
    let sum = 0, bob = 0; for (const r of rows) { r.total = r2(r.qtd * r.unit); sum += r.total; bob += r.qtd; }
    const mont = r2(bob * pp.MountPerRoll), base = sum + fre + mont, neg = r2((base * pp.NegotiationPct) / 100), tot = r2(base + neg);
    const negTxt = pctText(pp.NegotiationPct), montTxt = "Montagem (" + Math.round(bob).toLocaleString("pt-BR") + " x " + M(pp.MountPerRoll) + "): " + M(mont);
    const summary = "Papel de Parede\r\n" + rows.map((r) => r.modelo + " | Ref: " + r.ref + " | Qtd: " + br2(r.qtd) + " | Total: " + M(r.total) + "\r\n").join("") + "TOTAL: " + M(sum);
    const resumo = summary + "\r\nMargem sobre produtos: " + marginText() + " (já incluída nos itens)\r\n" + montTxt + "\r\nFrete sem margem: " + M(fre) + "\r\nSubtotal com frete: " + M(base) + "\r\nAdicional de Negociação (" + negTxt + "): " + M(neg) + "\r\nTOTAL FINAL: " + M(tot) + "\r\n" + tag();
    resumoV.textContent = "RESUMO DO ORÇAMENTO\nProdutos (com margem): " + M(sum) + "\n" + montTxt + "\nFrete (sem margem): " + M(fre) + "\nSubtotal: " + M(base) + "\nAdicional de Negociação (" + negTxt + "): " + M(neg) + "\nTOTAL FINAL: " + M(tot);
    totalV.textContent = M(tot); totalS.textContent = "Produtos + montagem + frete + negociação"; setFech(tot);
    pending = { Cliente: cli.value.trim() || "SEM CLIENTE", Tipo: "Papel de Parede", Vendedor: ctx.session.nome, Resumo: resumo, Valor: tot }; save.disabled = false;
    draw();
  }
  add.onclick = () => {
    const qt = N(q.value), un = N(u.value);
    if (qt <= 0 || qt !== Math.floor(qt) || un <= 0) return alertBox("Informe quantidade inteira de bobinas e custo unitário maiores que zero.", "Papel de Parede");
    const unit = r2(un * pp.SaleFactor), item = { modelo: model.value, ref: refer.value, qtd: qt, unit, total: r2(qt * unit) };
    if (editIndex >= 0 && editIndex < rows.length) { rows[editIndex] = item; editIndex = -1; add.textContent = "ADICIONAR ITEM"; } else rows.push(item);
    atualizar();
  };
  function edit(i) { const r = rows[i]; editIndex = i; model.value = r.modelo; refer.value = r.ref; q.value = br2(r.qtd); u.value = br2(r.unit / pp.SaleFactor); add.textContent = "SALVAR ALTERAÇÃO"; window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function remove(i) {
    if (!(await confirmBox("Excluir o item selecionado?", "Confirmar exclusão"))) return;
    rows.splice(i, 1); editIndex = -1; add.textContent = "ADICIONAR ITEM";
    if (!rows.length) { clearAll(); draw(); resumoV.textContent = "RESUMO DO ORÇAMENTO\nAdicione um item para calcular."; setFech(0); } else atualizar();
  }
  frete.addEventListener("input", () => { if (rows.length) atualizar(); });
  cli.addEventListener("input", () => { if (rows.length) atualizar(); });
  const valorOk = () => { const f = N(fech.value); return f > 0 && f <= original ? f : null; };
  save.onclick = () => {
    if (N(frete.value) < 0) return alertBox("O frete não pode ser negativo.", "Papel de Parede");
    if (!pending || original <= 0) return alertBox("Adicione um item antes de salvar.", "Papel de Parede");
    const f = valorOk(); if (f == null) return alertBox("Informe um valor fechado válido entre R$ 0,01 e o valor calculado.", "Papel de Parede");
    savePending(pending, null, save, { valorFechado: f });
  };
  fecharBtn.onclick = async () => {
    if (N(frete.value) < 0 || !pending || original <= 0) return alertBox("Confira os itens e o frete antes de fechar.");
    const f = valorOk(); if (f == null) return alertBox("Informe um valor fechado válido.");
    if (!(await confirmBox("Fechar o pedido por " + M(f) + "?\n\nO orçamento será salvo e enviado à aprovação com pagamento.", "Confirmar fechamento"))) return;
    savePending(pending, null, save, { valorFechado: f, fechar: true });
  };
});

// ---------- Orçamento por ambientes ----------
register("orc/ambientes", (el) => {
  const cli = h("input", { class: "input" }), vend = h("input", { class: "input", value: ctx.session.nome, readOnly: true });
  const rows = []; const list = h("div", { class: "list" });
  const totalV = h("div", { class: "v" }, "—"), totalS = h("div", { class: "s" }, "");
  const save = h("button", { class: "btn green", disabled: true }, "SALVAR ORÇAMENTO");
  const F = [["Ambiente", "Ambiente"], ["Produto", "Produto"], ["Modelo", "Modelo / descrição"], ["Medidas", "Medidas"], ["Quantidade", "Qtd."], ["ValorUnitario", "Valor unitário"], ["Observacoes", "Observações"]];
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Orçamento por Ambientes"), h("div", { class: "sub" }, "Monte um orçamento único separando Sala, Quarto, Cozinha ou qualquer outro ambiente."))),
    h("div", { class: "card" }, h("label", { class: "lbl" }, "Cliente"), cli, h("label", { class: "lbl" }, "Vendedor"), vend), list,
    h("div", { class: "btns grid2", style: { margin: "12px 0" } }, h("button", { class: "btn", onclick: () => { rows.push({ Quantidade: "1" }); draw(); const ins = list.querySelectorAll("input"); ins[ins.length - 7]?.focus(); } }, "ADICIONAR LINHA"), h("button", { class: "btn dark", onclick: () => recalc() }, "CALCULAR TOTAL")),
    h("div", { class: "kpi", style: { marginBottom: "10px" } }, h("div", { class: "t" }, "Valor total"), totalV, totalS), save);
  function recalc() {
    let soma = 0;
    rows.forEach((r, i) => { let q = N(r.Quantidade); if (q <= 0) q = 1; const vt = q * N(r.ValorUnitario); r._t = vt; soma += vt; const t = list.querySelector('[data-t="' + i + '"]'); if (t) t.textContent = "Total: " + br2(vt); });
    totalV.textContent = M(soma); totalS.textContent = "Soma de todos os ambientes"; save.disabled = !(soma > 0);
  }
  function draw() {
    list.innerHTML = "";
    rows.forEach((r, i) => {
      const card = h("div", { class: "card", style: { marginTop: "10px" } });
      for (const [k, label] of F) { const inp = h("input", { class: "input", value: r[k] || "", inputmode: k === "Quantidade" || k === "ValorUnitario" ? "decimal" : "text" }); inp.addEventListener("change", () => { r[k] = inp.value; recalc(); }); inp.addEventListener("input", () => { r[k] = inp.value; }); card.append(h("label", { class: "lbl" }, label), inp); }
      card.append(h("div", { class: "l1", "data-t": i, style: { marginTop: "8px", fontWeight: "700" } }, ""), h("button", { class: "btn small danger", style: { marginTop: "8px" }, onclick: () => { rows.splice(i, 1); draw(); } }, "REMOVER LINHA"));
      list.append(card);
    });
    recalc();
  }
  function readItems() {
    const items = [];
    for (const r of rows) {
      const amb = String(r.Ambiente || "").trim(), prod = String(r.Produto || "").trim(), mod = String(r.Modelo || "").trim(), med = String(r.Medidas || "").trim(), obs = String(r.Observacoes || "").trim();
      if (!amb && !prod && !mod) continue;
      if (!amb) fail("Informe o ambiente em todas as linhas preenchidas.");
      if (!prod) fail("Informe o produto em todas as linhas preenchidas.");
      let q = N(r.Quantidade); if (q <= 0) q = 1; const vu = N(r.ValorUnitario); if (vu < 0) fail("Valor unitário inválido.");
      items.push({ Ambiente: amb, Produto: prod, Modelo: mod, Medidas: med, Observacoes: obs, Quantidade: q, ValorUnitario: vu, ValorTotal: q * vu });
    }
    return items;
  }
  function summary(items) {
    let s = "ORÇAMENTO POR AMBIENTES\r\n", last = "";
    for (const it of items) {
      if (last.toLowerCase() !== it.Ambiente.toLowerCase()) { if (last) s += "\r\n"; s += it.Ambiente.toUpperCase() + "\r\n"; last = it.Ambiente; }
      s += "• " + it.Produto + (it.Modelo ? " — " + it.Modelo : "") + (it.Medidas ? " | " + it.Medidas : "") + " | Qtd: " + br2(it.Quantidade) + " | " + M(it.ValorTotal) + (it.Observacoes ? " | " + it.Observacoes : "") + "\r\n";
    }
    return s + "\r\nVALOR TOTAL: " + M(items.reduce((a, i) => a + i.ValorTotal, 0));
  }
  save.onclick = async () => {
    try {
      recalc(); const items = readItems(); if (!items.length) return alertBox("Adicione pelo menos um item ao orçamento.");
      const original = items.reduce((a, i) => a + i.ValorTotal, 0);
      const fechado = await negotiate(original); if (fechado == null) return;
      const escolha = await modal("Fechamento do orçamento por ambientes", ({ body, foot, close }) => {
        body.append(h("p", { style: { whiteSpace: "pre-line" } }, "Original: " + M(original) + "\nFechado: " + M(fechado)));
        foot.style.flexDirection = "column";
        foot.append(h("button", { class: "btn primary block", onclick: () => close("fechar") }, "FECHAR PEDIDO"), h("button", { class: "btn dark block", onclick: () => close("salvar") }, "SALVAR ORÇAMENTO"), h("button", { class: "btn block", onclick: () => close(null) }, "VOLTAR"));
      });
      if (!escolha) return;
      if (!(fechado > 0 && fechado <= original)) fail("Valor fechado invalido.");
      const total = r2(fechado);
      const resumo = summary(items) + "\r\nVALOR ORIGINAL CALCULADO: " + M(original) + "\r\nDESCONTO NEGOCIADO: " + M(original - total) + "\r\nVALOR FINAL NEGOCIADO: " + M(total);
      const numero = await saveBudgetCloud({ Cliente: cli.value.trim() || "SEM CLIENTE", Vendedor: vend.value.trim() || ctx.session.nome, Tipo: "Orçamento por ambientes", Resumo: resumo, Valor: total });
      save.disabled = true;
      if (escolha === "fechar") await alertBox("Orcamento salvo: " + numero + ". A aprovação envia a pré-venda ao myManager da loja. Abra este número no Histórico pelo computador da loja para aprovar; nao salve novamente.", "Fechamento");
      else await alertBox("Orçamento por ambientes salvo. Número: " + numero, ctx.unit.name);
    } catch (e) { alertBox(friendly(e)); }
  };
  rows.push({ Quantidade: "1" }); draw();
});
