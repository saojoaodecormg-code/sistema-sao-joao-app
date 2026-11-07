// Orçamentos: estrutura comum (MainForm Calc/SaveBtn/Result/TotalCard + Operations.SavePending/SaveBudgetCloud)
// e as calculadoras Tela mosquiteira, Tapete, Persianas e Toldo retrátil.
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, modal, formModal, alertBox, toast, friendly, money, isoDay, today } from "../ui.js";
import { precos, G, num, pctText, MOSQ_W, MOSQ_H, mosquitoKey, awningSizeKey } from "../precos.js";
import { operacaoLoja, PonteIndisponivel } from "../mym.js";

const N = (s) => num(s);
const M = money;
const br2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- Tela padrão de orçamento ----------
// fields: [{name,label,value,type,options,width}] ; calc(values,cfg) => {text,total,tipo,draft?}
export function quoteScreen(el, { title, sub, fields, calc, tipo, after, calcLabel }) {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, title), sub ? h("div", { class: "sub" }, sub) : null)));
  const inputs = {}; const form = h("div", { class: "card" });
  const cli = h("input", { class: "input", placeholder: "Nome do cliente" }); form.append(h("label", { class: "lbl" }, "Cliente"), cli);
  let grid = null;
  for (const f of fields) {
    if (f.type === "section") { form.append(h("div", { class: "lbl", style: { marginTop: "16px", fontSize: "14px", color: "#111827" } }, f.label)); continue; }
    let inp;
    if (f.type === "select") inp = h("select", { class: "select" }, ...(typeof f.options === "function" ? f.options() : f.options).map((o) => h("option", { value: o, selected: o === f.value }, o)));
    else if (f.type === "textarea") inp = h("textarea", { class: "input", rows: 3 }, f.value || "");
    else inp = h("input", { class: "input", value: f.value ?? "", inputmode: f.text ? "text" : "decimal" });
    inputs[f.name] = inp;
    const cell = h("div", {}, h("label", { class: "lbl" }, f.label), inp);
    if (f.half) { if (!grid) { grid = h("div", { class: "row2" }); form.append(grid); } grid.append(cell); } else { grid = null; form.append(cell); }
  }
  const result = h("div", { class: "resumo", style: { minHeight: "60px" } }, "Preencha os dados e toque em CALCULAR.");
  const totalV = h("div", { class: "v" }, "—"), totalS = h("div", { class: "s" }, "");
  const save = h("button", { class: "btn green", disabled: true, onclick: () => savePending(pending, result, save) }, "SALVAR ORÇAMENTO");
  const btnCalc = h("button", { class: "btn dark", onclick: run }, calcLabel || "CALCULAR");
  el.append(form, h("div", { class: "btns grid2", style: { margin: "12px 0" } }, btnCalc, save),
    h("div", { class: "kpi", style: { marginBottom: "10px" } }, h("div", { class: "t" }, "Valor total"), totalV, totalS), result);
  let pending = null;
  async function run() {
    btnCalc.disabled = true;
    try {
      const cfg = await precos(ctx.unit).ensureFresh();
      const v = { __cliente: cli.value }; for (const [k, i] of Object.entries(inputs)) v[k] = i.value;
      const r = await calc(v, cfg);
      if (r.blocked) { result.textContent = r.blocked; clear(); return; }
      result.textContent = r.text; totalV.textContent = M(r.card ?? r.total); totalS.textContent = r.totalNote || "Valor total com adicional de negociação";
      pending = { Cliente: cli.value.trim() || "SEM CLIENTE", Tipo: r.tipo || tipo, Vendedor: ctx.session.nome, Resumo: r.resumo ?? r.text, Valor: r.total, Extra: r.extra || "", Tech: r.tech || "" };
      save.disabled = false;
    } catch (e) { result.textContent = "Erro: " + friendly(e); clear(); }
    finally { btnCalc.disabled = false; }
  }
  function clear() { pending = null; save.disabled = true; totalV.textContent = "—"; totalS.textContent = ""; }
  for (const i of Object.values(inputs)) { i.addEventListener("input", () => { if (pending) clear(); }); i.addEventListener("change", () => { if (pending) clear(); }); }
  if (after) after(inputs, form, cli);
  return { inputs, cli, setOptions: (name, opts) => { const s = inputs[name]; s.innerHTML = ""; for (const o of opts) s.append(h("option", { value: o }, o)); } };
}

// ---------- Janela de negociação (SjValorNegociadoForm) ----------
export function negotiate(original) {
  return modal("Confirmar desconto e valor final", ({ body, foot, close }) => {
    const pct = h("input", { class: "input", value: "0,00", inputmode: "decimal" }), val = h("input", { class: "input", value: br2(original), inputmode: "decimal" });
    const res = h("div", { style: { margin: "10px 0", fontWeight: "600" } }, "Desconto: R$ 0,00"); let lock = false, final = original;
    pct.addEventListener("input", () => { if (lock) return; let p; try { p = N(pct.value); } catch { p = NaN; } if (!(p >= 0 && p < 100)) { res.textContent = "Informe desconto de 0% até menos de 100%."; return; } final = Math.round(original * (1 - p / 100) * 100) / 100; lock = true; val.value = br2(final); lock = false; res.textContent = "Desconto: " + M(original - final); });
    val.addEventListener("input", () => { if (lock) return; let f; try { f = N(val.value); } catch { f = NaN; } if (!(f > 0 && f <= original)) { res.textContent = "Informe valor final maior que zero e até o total."; return; } final = f; lock = true; pct.value = (Math.round(((original - f) / original) * 1000000) / 10000).toLocaleString("pt-BR"); lock = false; res.textContent = "Desconto: " + M(original - f); });
    body.append(h("p", {}, "Total calculado: " + M(original)), h("label", { class: "lbl" }, "Desconto na finalização (%):"), pct, h("label", { class: "lbl" }, "Valor final combinado com o cliente (R$):"), val, res);
    foot.append(h("button", { class: "btn", onclick: () => close(null) }, "CANCELAR"), h("button", { class: "btn primary", onclick: () => { if (!(final > 0 && final <= original)) return; close(final); } }, "CONFIRMAR"));
  });
}

// ---------- Cliente do myManager (SjMyManagerCustomerForm) ----------
// A busca vai à integração local do myManager (https://127.0.0.1:8181/clientes) pelo computador da loja.
export async function pickMyManagerCustomer(initial) {
  return modal("Selecionar cliente do myManager", ({ body, foot, close }) => {
    const q = h("input", { class: "input", value: initial && initial !== "SEM CLIENTE" ? initial : "", enterkeyhint: "search" });
    const pesquisar = h("button", { class: "btn dark" }, "PESQUISAR"), list = h("div", { class: "list", style: { marginTop: "10px" } });
    let sel = null;
    const Pesquisar = async () => {
      const t = q.value.trim(); if (t.length < 2) return alertBox("Digite pelo menos 2 caracteres para pesquisar.", "Cliente myManager");
      pesquisar.disabled = true; list.innerHTML = ""; list.append(h("div", { class: "loading" }, "Pesquisando no myManager da loja...")); sel = null;
      try {
        const root = await operacaoLoja("mym_clientes", { busca: t });
        if (!root || typeof root !== "object" || !("clientes" in root)) throw new Error("Resposta de clientes invalida.");
        const G = (d, k) => (d && d[k] != null ? String(d[k]) : "");
        const rows = [];
        for (const d of Array.isArray(root.clientes) ? root.clientes : []) { if (!d || typeof d !== "object") continue;
          if (G(d, "ATIVO_CLI").toUpperCase() !== "S") continue; if (G(d, "BLOQUEADO_CLI").toUpperCase() === "S") continue;
          let nome = G(d, "RAZAO_SOCIAL"); if (!nome.trim()) nome = G(d, "NOME_FANTASIA");
          rows.push({ ID: G(d, "ID"), Nome: nome, CPF: G(d, "CPF_CNPJ"), Telefone: G(d, "CELULAR").trim() ? G(d, "CELULAR") : G(d, "TELEFONE") }); }
        list.innerHTML = "";
        if (!rows.length) { alertBox("Nenhum cliente ativo encontrado no myManager.", "Cliente myManager"); return; }
        for (const r of rows) { const it = h("button", { class: "item" }, h("div", { class: "l1" }, h("span", {}, r.Nome), h("span", { class: "sub" }, r.ID)), h("div", { class: "l2" }, [r.CPF, r.Telefone].filter(Boolean).join(" · ")));
          it.onclick = () => { sel = r; list.querySelectorAll(".item").forEach((x) => (x.style.background = "")); it.style.background = "#dbeafe"; }; it.ondblclick = () => { sel = r; Selecionar(); }; list.append(it); }
      } catch (e) { list.innerHTML = ""; alertBox((e instanceof PonteIndisponivel ? "Nao foi possivel consultar os clientes do myManager.\n\nA integracao local nao esta disponivel.\n\n" : "Nao foi possivel pesquisar o cliente.\n\n") + friendly(e), "Cliente myManager"); }
      finally { pesquisar.disabled = false; }
    };
    const Selecionar = () => {
      if (!sel) return alertBox("Selecione um cliente.", "Cliente myManager");
      const id = parseInt(sel.ID, 10); if (!(id > 0)) return alertBox("Cliente selecionado possui codigo invalido.", "Cliente myManager");
      close({ Id: id, Nome: String(sel.Nome).trim(), CpfCnpj: String(sel.CPF).trim(), Telefone: String(sel.Telefone).trim() });
    };
    pesquisar.onclick = Pesquisar; q.addEventListener("keydown", (e) => { if (e.key === "Enter") Pesquisar(); });
    body.append(h("label", { class: "lbl" }, "Busque pelo nome, CPF ou CNPJ do cliente"), q, h("div", { class: "btns", style: { marginTop: "8px" } }, pesquisar), list);
    foot.append(h("button", { class: "btn", onclick: () => close(null) }, "CANCELAR"), h("button", { class: "btn green", onclick: Selecionar }, "SELECIONAR CLIENTE"));
    if (q.value.trim()) Pesquisar();
  });
}

// ---------- Salvar (SavePending + SaveBudgetCloud) ----------
export async function savePending(p, result, btn, { valorFechado, fechar } = {}) {
  if (!p) return alertBox("Primeiro calcule o orçamento.", "Salvar orçamento");
  const original = p.Valor; let final = original;
  if (valorFechado != null) final = valorFechado; else { const f = await negotiate(original); if (f == null) return; final = f; }
  if (!(final > 0 && final <= original)) return alertBox("O valor fechado deve ser maior que zero e menor ou igual ao total calculado.");
  const escolha = fechar ? "fechar" : await modal("Finalização - " + ctx.unit.name, ({ body, foot, close }) => {
    body.append(h("p", { style: { whiteSpace: "pre-line" } }, "Valor original: " + M(original) + "\nValor fechado: " + M(final) + "\nDesconto: " + M(original - final)));
    foot.style.flexDirection = "column";
    foot.append(h("button", { class: "btn primary block", onclick: () => close("fechar") }, "FECHAR PEDIDO (com aprovação e pagamento)"), h("button", { class: "btn dark block", onclick: () => close("salvar") }, "SALVAR SOMENTE ORÇAMENTO"), h("button", { class: "btn block", onclick: () => close(null) }, "VOLTAR SEM SALVAR"));
  });
  if (!escolha) return;
  const cli = p.MyManagerClienteId > 0 ? { Id: p.MyManagerClienteId, Nome: p.Cliente } : await pickMyManagerCustomer(p.Cliente); if (!cli) return;
  try {
    const resumo = (p.Resumo || "") + "\r\nVALOR ORIGINAL CALCULADO: " + M(original) + "\r\nDESCONTO NEGOCIADO: " + M(original - final) + "\r\nVALOR FINAL NEGOCIADO: " + M(final) + (p.Extra || "") + "\r\n<SJ_MYM_CLIENTE>" + cli.Id + "</SJ_MYM_CLIENTE>" + (p.Tech || "");
    const num = await saveBudgetCloud({ Cliente: cli.Nome, Tipo: p.Tipo, Vendedor: p.Vendedor, Resumo: resumo, Valor: final });
    try { await api.patchQuote(num, { mymanager_cliente_id: cli.Id, integracao_elegivel: true, integracao_status: "AGUARDANDO_APROVACAO", integracao_atualizada_em: new Date().toISOString() }); }
    catch (ie) { await alertBox("O orçamento foi salvo, mas o vínculo com o myManager não foi confirmado.\n\nNúmero: " + num + "\n\nEste orçamento NÃO será enviado ao myManager.\n\nDetalhe: " + friendly(ie), "Integração São João / myManager"); if (result) result.textContent += "\n\nORÇAMENTO SALVO: " + num + "\nINTEGRAÇÃO: NÃO CONFIRMADA"; if (btn) btn.disabled = true; return num; }
    if (result) result.textContent += "\n\nORÇAMENTO SALVO: " + num; if (btn) btn.disabled = true;
    if (escolha === "fechar") await alertBox("Orçamento salvo: " + num + ".\n\nA aprovação envia a pré-venda ao myManager da loja. Abra este número no Histórico pelo computador da loja para aprovar, sem salvar outro orçamento.", "Fechamento");
    else await alertBox("Orçamento salvo com sucesso.\n\nNúmero: " + num + "\nStatus: ORÇAMENTO", ctx.unit.name);
    return num;
  } catch (e) { alertBox("Não foi possível salvar o orçamento.\n\n" + friendly(e), "Salvar orçamento"); }
}

// ---------- SaveBudgetCloud ----------
export async function saveBudgetCloud(p) {
  const num = await api.nextCommercialNumber(ctx.unit, "ORC", new Date().getFullYear());
  const now = new Date(), r3 = today(), v15 = today(); r3.setDate(r3.getDate() + 3); v15.setDate(v15.getDate() + 15);
  await api.upsertQuote({ numero: num, data_hora: now.toISOString(), cliente: p.Cliente, cliente_codigo: null, tipo: p.Tipo, vendedor: p.Vendedor || null, resumo: p.Resumo, valor: Math.round(p.Valor * 100) / 100, status: "ORÇAMENTO", retornar_em: isoDay(r3), validade_ate: isoDay(v15),
    criado_por_legacy_id: ctx.session.legacyId || null, criado_por_nome: ctx.session.nome, criado_em: now.toISOString(), alterado_por_legacy_id: ctx.session.legacyId || null, alterado_por_nome: ctx.session.nome, alterado_em: now.toISOString() });
  await ctx.audit("CRIAR", "ORCAMENTO", num, p.Tipo + " | " + p.Cliente + " | " + M(p.Valor));
  return num;
}

// ---------- Menu "Novo orçamento" ----------
register("orcamentos", (el) => {
  const u = ctx.unit;
  const items = u.code === "PERSONALIZADOS" ? [["Orçamento Impressão", "orc/impressao"], ["Orçamento Laser CO²", "orc/laser"], ["Orçamento Laser - Gravação", "orc/gravacao"], ["Orçamento Bordado", "orc/bordado"]]
    : u.code === "FA_COLCHOES" ? [["FA Colchões", "orc/fa"]]
    : [["Cortina sob medida", "orc/cortina"], ["Persianas", "orc/persiana"], ["Toldo retrátil", "orc/toldo"], ["Cobertura policarbonato", "orc/policarbonato"], ["Tela mosquiteira", "orc/mosquiteira"], ["Papel de Parede", "orc/papel"], ["Tapete personalizado", "orc/tapete"], ["Orçamento por ambientes", "orc/ambientes"]];
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Novo orçamento"), h("div", { class: "sub" }, u.name))), h("div", { class: "list" }, items.map(([t, r]) => h("button", { class: "item", onclick: () => ctx.go(r) }, h("div", { class: "l1" }, h("span", {}, t), h("span", {}, "›"))))));
});

// ---------- Tela mosquiteira ----------
register("orc/mosquiteira", (el) => quoteScreen(el, { title: "Tela mosquiteira", tipo: "Tela mosquiteira",
  fields: [{ name: "w", label: "Largura (m)", value: "1,05", half: true }, { name: "h", label: "Altura (m)", value: "1,35", half: true }, { name: "q", label: "Quantidade", value: "1" }],
  calc: (v, cfg) => {
    const w = N(v.w), hh = N(v.h), q = Math.max(1, Math.trunc(N(v.q)));
    if (w <= 0 || hh <= 0 || w > 2.20001 || hh > 1.50001) return { blocked: "Medida fora da tabela." };
    const ceil = (val, opts) => { const v100 = Math.round(val * 100); return opts.find((o) => v100 <= Math.round(o * 100)); };
    const uw = ceil(w, MOSQ_W), uh = ceil(hh, MOSQ_H); if (uw == null || uh == null) return { blocked: "Medida fora da tabela." };
    const unit = cfg.param(G.Mosquito, mosquitoKey(uw, uh));
    if (unit <= 0) return { blocked: "Preço da medida " + mosquitoKey(uw, uh) + " não cadastrado em Valores / Produtos (TELA MOSQUITEIRA)." };
    const negPct = cfg.negotiationPct("Tela mosquiteira"), base = unit * q, neg = (base * negPct) / 100, total = base + neg;
    return { total, text: "Medida digitada: " + br2(w) + " x " + br2(hh) + " m\r\nTabela: " + br2(uw) + " x " + br2(uh) + " m\r\nUnitário: " + M(unit) + "\r\nAdicional de Negociação (" + pctText(negPct) + "): " + M(neg) + "\r\nTOTAL FINAL: " + M(total) };
  } }));

// ---------- Tapete personalizado ----------
register("orc/tapete", async (el) => {
  const cfg = await precos(ctx.unit).ensureFresh().catch(() => null);
  quoteScreen(el, { title: "Tapete Personalizado", tipo: "Tapete Personalizado",
    fields: [{ name: "w", label: "Largura (cm ou m)", value: "60", half: true }, { name: "l", label: "Comprimento", value: "200", half: true }, { name: "q", label: "Qtd", value: "1", half: true }, { name: "t", label: "Tipo", type: "select", options: ["Liso", "Fusão"], half: true }, { name: "f", label: "Frete", value: cfg ? br2(cfg.param(G.Rug, "Frete padrão (R$)")) : "110,00" }],
    calc: (v, cfg) => {
      const toCm = (x) => (x <= 0 ? 0 : x <= 10 ? x * 100 : x);
      const w = toCm(N(v.w)), l = toCm(N(v.l)), q = Math.max(1, Math.trunc(N(v.q))), fr = N(v.f);
      if (w <= 0 || l <= 0 || fr < 0) return { blocked: "Dados inválidos." };
      const w100 = Math.round(w * 100); const cls = w100 === 6000 || w100 === 12000 ? "PADRÃO" : "FORA DO PADRÃO";
      const ppm = cfg.param(G.Rug, (v.t === "Fusão" ? "Fusão" : "Liso") + (cls === "PADRÃO" ? " padrão (R$/m²)" : " fora do padrão (R$/m²)"));
      if (ppm <= 0) return { blocked: "Preço por m² do tapete não cadastrado em Valores / Produtos (TAPETE)." };
      const area = (w / 100) * (l / 100), unit = area * ppm, sub = unit * q, base = sub + fr, negPct = cfg.negotiationPct("Tapete personalizado"), neg = (base * negPct) / 100, total = base + neg;
      return { total, text: "Área: " + br2(area) + " m²\r\nClassificação: " + cls + "\r\nValor/m²: " + M(ppm) + "\r\nUnitário: " + M(unit) + "\r\nSubtotal: " + M(sub) + "\r\nFrete: " + M(fr) + "\r\nAdicional de Negociação (" + pctText(negPct) + "): " + M(neg) + "\r\nTOTAL FINAL: " + M(total) };
    } });
});

// ---------- Persianas ----------
register("orc/persiana", (el) => quoteScreen(el, { title: "Persianas", tipo: "Persianas",
  fields: [{ name: "p", label: "Produto", type: "select", options: ["Persiana Vertical", "Persiana Horizontal", "Rolô", "Romana", "Painel", "Double Vision"] }, { name: "q", label: "Qtd", value: "1", half: true }, { name: "pers", label: "Valor Total Persol", value: "", half: true }, { name: "fre", label: "Frete", value: "", half: true }, { name: "des", label: "Deslocamento", value: "0", half: true }],
  calc: (v, cfg) => {
    const qt = Math.max(1, Math.trunc(N(v.q))), fator = cfg.param(G.Blinds, "Fator administração Persol"), instUn = cfg.param(G.Blinds, "Instalação por unidade (R$)"), negPct = cfg.negotiationPct("Persianas");
    const pa = N(v.pers) * fator, inst = instUn * qt, base = pa + N(v.fre) + inst + N(v.des), neg = (base * negPct) / 100, total = base + neg;
    return { total, tipo: "Persianas - " + v.p, totalNote: "Total final com adicional de negociação", text: "Produto: " + v.p + "\r\nPersol administrado (x" + fator.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + "): " + M(pa) + "\r\nFrete: " + M(N(v.fre)) + "\r\nInstalação (" + qt + " x " + M(instUn) + "): " + M(inst) + "\r\nDeslocamento: " + M(N(v.des)) + "\r\nAdicional de Negociação (" + pctText(negPct) + "): " + M(neg) + "\r\nTOTAL FINAL: " + M(total) };
  } }));

// ---------- Toldo retrátil (ToldoQuoteEngine) ----------
register("orc/toldo", async (el) => {
  const cfg = await precos(ctx.unit).ensureFresh();
  const materials = cfg.rowsOfGroup(G.AwningMaterial).map((r) => r.i);
  quoteScreen(el, { title: "Toldo retrátil", tipo: "Toldo retrátil",
    fields: [{ name: "q", label: "Qtd", value: "1", half: true }, { name: "w", label: "Largura", value: "3,00", half: true }, { name: "h", label: "Altura/avanço", value: "3,30", half: true }, { name: "aj", label: "Ajuste R$", value: "0", half: true }, { name: "mat", label: "Material", type: "select", options: materials }, { name: "dr", label: "Desconto R$", value: "0", half: true }, { name: "dp", label: "Desconto %", value: "0", half: true }],
    calc: (v, cfg) => {
      const qtd = Math.max(1, Math.trunc(N(v.q))), larg = N(v.w), alt = N(v.h), ajuste = N(v.aj), dR = N(v.dr), dP = N(v.dp), mat = v.mat; const pend = [];
      if (qtd < 1 || larg <= 0 || alt <= 0) pend.push("PREENCHA QUANTIDADE, LARGURA E ALTURA"); else if (larg > 6) pend.push("LARGURA ACIMA DE 6,00 M — VERIFIQUE A FERRAGEM");
      const i = String(mat || "").lastIndexOf(" - "); let rolo = 0; if (i >= 0) { let w = mat.slice(i + 3).trim(); if (/m$/i.test(w)) w = w.slice(0, -1).trim(); try { rolo = num(w); } catch { rolo = 0; } }
      if (!(rolo > 0)) pend.push("SELECIONE MATERIAL E LARGURA DO MATERIAL");
      if (dR > 0 && dP > 0) pend.push("USE SOMENTE UM TIPO DE DESCONTO");
      if (pend.length) return { blocked: "ORÇAMENTO BLOQUEADO — " + pend.join(" | ") };
      const size = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6].find((s) => larg <= s + 1e-7) || 0, sk = awningSizeKey(size);
      const precoM = cfg.param2(G.AwningMaterial, mat); if (precoM <= 0) return { blocked: "ORÇAMENTO BLOQUEADO — PREÇO POR METRO DO MATERIAL NÃO CADASTRADO" };
      const area = larg * alt * qtd, faixas = Math.ceil(Math.round((larg / rolo) * 1e9) / 1e9), ml = alt * faixas * qtd;
      const ferrV = cfg.param(G.AwningHardware, sk) * qtd, ferrP = cfg.param2(G.AwningHardware, sk) * qtd;
      const freteF = size <= 3.5 ? cfg.param(G.Awning, "Frete ferragem até 3,50 m (R$)") : cfg.param(G.Awning, "Frete ferragem acima de 3,50 m (R$)");
      const material = ml * precoM, freteM = cfg.param(G.Awning, "Frete material (R$)") * qtd;
      const weld = size <= 1.5 ? "Até 1,50 m" : size <= 2.5 ? "Até 2,50 m" : size <= 3.5 ? "Até 3,50 m" : size <= 4.5 ? "Até 4,50 m" : size <= 5 ? "5,00 m" : "6,00 m";
      const solda = cfg.param(G.AwningWeld, weld) * qtd, mo = cfg.param(G.Awning, "Mão de obra por toldo (R$)") * qtd, mont = area * cfg.param(G.Awning, "Montagem por m² (R$)");
      const comum = freteF + material + freteM + solda + mo + mont + ajuste, subV = ferrV + comum, subP = ferrP + comum;
      const dv = dR > 0 ? dR : (subV * dP) / 100, dpp = dR > 0 ? dR : (subP * dP) / 100; const vista = Math.max(0, subV - dv), prazo = Math.max(0, subP - dpp);
      const negPct = cfg.negotiationPct("Toldo retrátil"), neg = (vista * negPct) / 100, total = vista + neg;
      return { total, text: "Status: ORÇAMENTO OK\r\nÁrea: " + br2(area) + " m² | Ferragem " + br2(size) + " m | " + faixas + " faixa(s) | " + br2(ml) + " m lineares x " + M(precoM) + "\r\nFerragem: " + M(ferrV) + "\r\nFrete ferragem: " + M(freteF) + "\r\nMaterial: " + M(material) + "\r\nFrete material: " + M(freteM) + "\r\nSolda: " + M(solda) + "\r\nMão de obra: " + M(mo) + "\r\nMontagem: " + M(mont) + (ajuste !== 0 ? "\r\nAjuste: " + M(ajuste) : "") + (dv > 0 ? "\r\nDesconto: " + M(dv) : "") + "\r\nTotal à vista (planilha): " + M(vista) + " | a prazo: " + M(prazo) + "\r\nAdicional de Negociação (" + pctText(negPct) + "): " + M(neg) + "\r\nTOTAL FINAL: " + M(total) };
    } });
});
