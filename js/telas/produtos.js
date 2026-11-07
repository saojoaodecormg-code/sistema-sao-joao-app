// Orçamentos > Consultar Produtos (ConsultaProdutos.cs): todos os produtos do myManager, somente consulta.
import { h, alertBox, friendly, money } from "../ui.js";
import { register } from "../app.js";
import { ConsultarTodos, PickStock, mymProductColumns } from "../mym_produtos.js";

const Max = 500;
register("consulta-produtos", (el) => {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Consultar Produtos"), h("div", { class: "sub" }, "Todos os produtos da loja cadastrados no MyManager (todas as empresas). Somente consulta: nada é alterado."))));
  const busca = h("input", { class: "input", enterkeyhint: "search" }), buscar = h("button", { class: "btn dark" }, "CONSULTAR"), limpar = h("button", { class: "btn" }, "LIMPAR");
  const ord = h("select", { class: "select" }, ...["Nome", "Menor preço", "Maior preço"].map((t) => h("option", {}, t))), soEstoque = h("input", { type: "checkbox" });
  const info = h("div", { class: "sub", style: { margin: "8px 0" } }, "Digite parte do nome (ex.: colchao casal, cortina, caneca) e toque em CONSULTAR. Em branco, mostra os primeiros " + Max + " em ordem alfabética.");
  const lista = h("div", { class: "list" }), sel = h("div", { class: "card", style: { position: "sticky", bottom: "0", zIndex: "5" } });
  el.append(h("label", { class: "lbl" }, "Nome, código ou referência"), busca, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, buscar, limpar),
    h("div", { class: "row2", style: { marginTop: "8px", alignItems: "end" } }, h("div", {}, h("label", { class: "lbl" }, "Ordenar"), ord), h("label", { style: { display: "flex", gap: "8px", alignItems: "center", paddingBottom: "10px" } }, soEstoque, "Só com estoque")),
    info, lista, sel);
  let last = null, atual = null, consultando = false;
  const showSelected = () => {
    sel.innerHTML = "";
    if (!atual) { sel.append(h("div", { style: { fontWeight: "700", color: "#082d4e" } }, "Selecione um produto na lista.")); return; }
    const r = atual, copiar = h("button", { class: "btn dark" }, "COPIAR");
    copiar.onclick = async () => { const t = r.Produto.trim() + " (cód. " + r.Codigo.trim() + ") — " + money(r.Preco) + (r.Estoque.trim() ? " — estoque: " + r.Estoque.trim() : ""); try { await navigator.clipboard.writeText(t); info.textContent = "Copiado: " + r.Produto; } catch (e) { alertBox(t, "Consultar Produtos"); } };
    sel.append(h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" } },
      h("div", { style: { minWidth: "0" } }, h("div", { style: { fontWeight: "700", color: "#082d4e" } }, r.Produto), h("div", { class: "sub" }, "Código " + r.Codigo + (r.Ref ? " • Ref. " + r.Ref : "") + (r.Estoque ? " • Estoque: " + r.Estoque + (r.Unid ? " " + r.Unid : "") : "") + " • Preço de venda no MyManager")),
      h("div", { style: { textAlign: "right" } }, h("div", { style: { fontSize: "20px", fontWeight: "700", color: "#082d4e" } }, money(r.Preco)), copiar)));
  };
  const applyView = () => {
    if (!last) return; const v = last.slice();
    if (ord.selectedIndex === 1) v.sort((a, b) => a.Preco - b.Preco); else if (ord.selectedIndex === 2) v.sort((a, b) => b.Preco - a.Preco); else v.sort((a, b) => a.Produto.localeCompare(b.Produto, "pt-BR"));
    lista.innerHTML = "";
    for (const r of v) { const it = h("button", { class: "item", style: r === atual ? { background: "#dbeafe" } : null }, h("div", { class: "l1" }, h("span", {}, r.Produto), h("span", {}, money(r.Preco))), h("div", { class: "l2" }, h("span", {}, "Cód. " + r.Codigo + (r.Unid ? " · " + r.Unid : "")), r.Estoque ? h("span", {}, "Estoque: " + r.Estoque) : null));
      it.onclick = () => { atual = r; applyView(); }; it.ondblclick = () => { atual = r; showSelected(); sel.querySelector("button")?.click(); }; lista.append(it); }
    showSelected();
  };
  const consultar = async () => {
    if (consultando) return; consultando = true; buscar.disabled = true; info.textContent = "Consultando o MyManager...";
    try {
      const dt = await ConsultarTodos(busca.value, soEstoque.checked, Max); last = dt; atual = null; applyView();
      const temEstoque = PickStock(mymProductColumns) != null; soEstoque.disabled = !temEstoque;
      info.textContent = dt.length === 0 ? "Nenhum produto encontrado. Tente uma palavra só ou parte do nome." : dt.length + " produto(s)" + (dt.length >= Max ? " (mostrando os " + Max + " primeiros; digite mais palavras para refinar)" : "") + "." + (temEstoque ? "" : " Estoque não identificado no MyManager.");
    } catch (e) { info.textContent = ""; alertBox(friendly(e), "Consultar Produtos"); }
    finally { consultando = false; buscar.disabled = false; }
  };
  buscar.onclick = consultar; busca.onkeydown = (e) => { if (e.key === "Enter") consultar(); };
  limpar.onclick = () => { busca.value = ""; last = null; atual = null; lista.innerHTML = ""; info.textContent = ""; showSelected(); busca.focus(); };
  ord.onchange = applyView; soEstoque.onchange = () => { if (last) consultar(); };
  showSelected();
});
