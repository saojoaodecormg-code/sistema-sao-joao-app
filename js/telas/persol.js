// Integração Persol (PersolSync.cs > PersolCenter). A leitura do portal e a pré-venda rodam no computador da loja
// que tem a integração ligada; o celular mostra o mesmo quadro (copiado pela ponte) e abre o orçamento no Histórico.
import { h, alertBox, friendly, money } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";

const p2 = (n) => String(n).padStart(2, "0");
// JavaScriptSerializer grava datas como "\/Date(ms)\/"
const dataMs = (v) => { const m = /Date\((-?\d+)/.exec(String(v ?? "")); if (!m) return null; const d = new Date(Number(m[1])); return d.getFullYear() < 1900 ? null : d; };
const dd = (d) => (d ? p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() : "");
const dh = (d) => (d ? dd(d) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) : "");

register("persol", async (el) => {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Integração Persol"))));
  if (ctx.unit.code !== "DECOR") { el.append(h("div", { class: "card" }, "A integração Persol funciona na unidade São João Decor.")); return; }
  el.append(h("div", { class: "sub" }, "Orçamento novo no portal Persol entra no histórico como PERSOL-número."),
    h("div", { class: "sub", style: { marginBottom: "8px" } }, "O valor é calculado como na tela de Persianas. Quando vira pedido no portal, o Histórico avisa: confirme os valores, frete e deslocamento."));
  const status = h("div", { style: { fontWeight: "700", margin: "6px 0" } }), lista = h("div", {}), atualizar = h("button", { class: "btn dark" }, "ATUALIZAR");
  el.append(h("div", { class: "btns", style: { marginBottom: "6px" } }, atualizar), status, lista,
    h("div", { class: "sub", style: { marginTop: "10px" } }, "Usuário e senha do portal, SINCRONIZAR AGORA, ENVIAR PRÉ-VENDA e JÁ EXISTE NO MYMANAGER ficam no computador que roda a integração. Para confirmar um pedido, abra o orçamento PERSOL no Histórico."));
  const load = async () => {
    lista.innerHTML = ""; status.textContent = "Carregando...";
    let s = null, at = null;
    try { const d = await api.lerDocumento("DECOR", "persol_estado"); if (d && d.texto) s = JSON.parse(d.texto); at = d?.atualizado_em; } catch (e) { status.textContent = friendly(e); return; }
    if (!s) { status.textContent = "Ainda não houve leitura copiada do computador da loja."; status.style.color = ""; return; }
    const ul = dataMs(s.UltimaLeitura);
    status.textContent = ul ? "Última leitura: " + dh(ul) + " — " + (s.UltimoResultado || "") : "Ainda não houve leitura nesta estação.";
    status.style.color = String(s.UltimoResultado || "").startsWith("Falha") ? "firebrick" : "#082d4e";
    const itens = Object.values(s.Itens || {}).sort((a, b) => (String(b.Numero) < String(a.Numero) ? -1 : String(b.Numero) > String(a.Numero) ? 1 : 0));
    if (!itens.length) { lista.append(h("div", { class: "empty" }, "Nenhum orçamento da Persol.")); return; }
    for (const i of itens) {
      const pv = i.PreVenda > 0 ? String(i.PreVenda) : i.PreVendaStatus || "";
      const bg = pv.startsWith("PENDENTE") || pv.startsWith("A FINALIZAR") ? "#fff8e2" : pv.startsWith("VERIFICAR") ? "#fceeee" : "";
      const linhas = [["Sistema", i.Sistema], ["Situação", i.Situacao], ["Emissão", dd(dataMs(i.Emissao))], ["Valor Persol", money(i.Valor)], ["Frete", i.Sistema ? money(i.Frete) : ""], ["Valor final", i.ValorFinal > 0 ? money(i.ValorFinal) : ""], ["Status produção", i.StatusProducao], ["Previsão entrega", dd(dataMs(i.PrevisaoEntrega))], ["Pré-venda", pv], ["Aviso", i.Aviso]].filter(([, v]) => v);
      const c = h("div", { class: "card", style: { padding: "10px", marginBottom: "6px", background: bg, cursor: i.Sistema ? "pointer" : "" } },
        h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("b", {}, "Persol " + i.Numero), h("span", {}, i.Cliente || "")),
        h("dl", { class: "kv", style: { marginTop: "6px" } }, ...linhas.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])));
      if (i.Sistema) c.onclick = () => ctx.go("historico/busca/" + encodeURIComponent(i.Sistema));
      lista.append(c);
    }
    if (at) status.textContent += "  (copiado às " + dh(new Date(at)).slice(11) + ")";
  };
  atualizar.onclick = load; load();
});
