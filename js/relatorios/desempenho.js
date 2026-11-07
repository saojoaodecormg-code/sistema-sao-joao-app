// Desempenho dos vendedores: MyManagerDesempenho.cs + SjDesempenhoForm.cs.
import { h, alertBox, friendly } from "../ui.js";
import { ctx, register } from "../app.js";
import { consultaCom, parseList, I, M, R2 } from "../mym.js";
import { SQL, SqlDatas, parse, calcular as calcCom, Liquido } from "./comissoes.js";
import { page, cards, table, printTable, acesso, C2, busy } from "./base.js";

const TipoDevolucao = 6;
export const SqlItens = (a, b) => "SELECT V.COD_VEN SJI_VEN, COALESCE(O.COD_VEND,V.COD_VEND) SJI_VEND, V.COD_TPV SJI_TPV, SUM(I.QUANT) SJI_QTD FROM VENDAS V LEFT JOIN VENDAS O ON O.COD_VEN=V.COD_VEN_DEV AND V.COD_TPV=" + TipoDevolucao + " JOIN ITENS_VENDA I ON I.COD_VEN=V.COD_VEN WHERE V.FLAGFATURADO='S' AND V.CANCELADA_VEN=0 AND COALESCE(I.CANCELADO,0)=0 AND V.DATA_VEN>='" + SqlDatas(a) + "' AND V.DATA_VEN<'" + SqlDatas(b) + "' GROUP BY 1,2,3;";
export const Itens = (o) => parseList(o, "SJI_VEN").map((r) => ({ Ven: I(r, "SJI_VEN"), Vend: I(r, "SJI_VEND"), Tpv: I(r, "SJI_TPV"), Qtd: M(r, "SJI_QTD") }));
export const Ticket = (l) => (l.QtdVendas === 0 ? 0 : R2(l.Liquido / l.QtdVendas));
export const PA = (l) => (l.QtdVendas === 0 ? 0 : R2(l.Itens / l.QtdVendas));
export function Calcular(vendas, itens, nomes) {
  const r = calcCom(vendas, [], [], [], nomes, 0, 0);
  const map = new Map(); for (const i of itens) map.set(i.Vend, (map.get(i.Vend) || 0) + (i.Tpv === TipoDevolucao ? -Math.abs(i.Qtd) : i.Qtd));
  const lista = [], total = { CodVend: -1, Nome: "TOTAL GERAL", QtdVendas: 0, Liquido: 0, Itens: 0 };
  for (const c of r.Linhas) {
    const liq = Liquido(c); if (c.QtdVendas === 0 && liq === 0) continue;
    const l = { CodVend: c.CodVend, Nome: c.Nome, QtdVendas: c.QtdVendas, Liquido: liq, Itens: map.get(c.CodVend) || 0 }; lista.push(l);
    total.QtdVendas += l.QtdVendas; total.Liquido += l.Liquido; total.Itens += l.Itens;
  }
  return { lista, total };
}
export async function Ler(consulta, de, ate) {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate()), b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate() + 1);
  const vendas = parse.vendas(await consulta(SQL.vendas(a, b))), itens = Itens(await consulta(SqlItens(a, b))), nomes = parse.nomes(await consulta(SQL.vendedores));
  return Calcular(vendas, itens, nomes);
}
const Q = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const F2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const br = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
const fromIso = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };

register("rel/desempenho", (el) => {
  page(el, "Desempenho dos vendedores", "Vendas, itens, ticket médio e PA (MyManager)");
  const t = new Date(), ini = new Date(t.getFullYear(), t.getMonth() - 1, 1), fim = new Date(t.getFullYear(), t.getMonth(), 0);
  const card = h("div", { class: "card" }); el.append(card);
  const de = h("input", { class: "input", type: "date", value: iso(ini) }), ate = h("input", { class: "input", type: "date", value: iso(fim) });
  card.append(h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "De"), de), h("div", {}, h("label", { class: "lbl" }, "Até"), ate)));
  const gerar = h("button", { class: "btn primary block", style: { marginTop: "10px" } }, "GERAR RELATÓRIO"), imprimir = h("button", { class: "btn", disabled: true }, "IMPRIMIR"), exportar = h("button", { class: "btn", disabled: true }, "EXPORTAR CSV");
  card.append(gerar, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, imprimir, exportar));
  const k = cards(["VENDAS LÍQUIDAS", "QTD. DE VENDAS", "QTD. DE ITENS", "TICKET MÉDIO", "PA (PEÇAS POR ATENDIMENTO)"]); k.vals.forEach((v) => (v.textContent = "—"));
  const area = h("div", {}), aviso = h("div", { class: "sub", style: { color: "#5a5e64", margin: "10px 0", lineHeight: "1.45" } }, "Todos os vendedores, somando SÃO JOÃO DECORAÇÕES e LOJA SÃO JOÃO. Consulta somente leitura: nada é gravado no MyManager.");
  el.append(k.el, area, aviso);
  const acc = acesso(ctx.session.nome);
  const cols = [{ k: "Vendedor", t: "Vendedor" }, { k: "Liq", t: "Vendas líquidas (faturadas)", money: true }, { k: "Qtd", t: "Qtd. vendas", right: true }, { k: "Itens", t: "Qtd. itens", right: true, fmt: Q }, { k: "Ticket", t: "Ticket médio", money: true }, { k: "PA", t: "PA (peças por atendimento)", right: true, fmt: F2 }];
  let linhas = null, total = null, rows = [], periodo = "";
  gerar.onclick = async () => {
    const a = fromIso(de.value), b = fromIso(ate.value);
    if (b < a) return alertBox("A data final é anterior à inicial.", "Desempenho");
    busy(gerar, true, "GERAR RELATÓRIO"); imprimir.disabled = exportar.disabled = true; aviso.textContent = "Consultando o MyManager (vendas e itens)...";
    try {
      let { lista: r, total: tot } = await Ler(consultaCom(120000), a, b); let avA = "";
      if (!acc.todos) {
        const cod = acc.vendedor(r.map((x) => [x.CodVend, x.Nome])); const minha = r.find((x) => cod > 0 && x.CodVend === cod);
        r = minha ? [minha] : []; tot = minha ? { CodVend: -1, Nome: "TOTAL", QtdVendas: minha.QtdVendas, Liquido: minha.Liquido, Itens: minha.Itens } : { CodVend: -1, Nome: "TOTAL", QtdVendas: 0, Liquido: 0, Itens: 0 };
        avA = acc.aviso(minha ? cod : 0, minha ? minha.Nome : "") + " ";
      }
      linhas = r; total = tot; periodo = br(a) + " a " + br(b);
      rows = [...r, tot].map((l) => ({ Vendedor: l.CodVend > 0 ? l.Nome + " (#" + l.CodVend + ")" : l.Nome, Nome: l.Nome, Liq: l.Liquido, Qtd: l.QtdVendas, Itens: l.Itens, Ticket: Ticket(l), PA: PA(l) }));
      area.innerHTML = ""; area.append(table(cols, rows, { totalLast: true }));
      k.vals[0].textContent = C2(tot.Liquido); k.vals[1].textContent = tot.QtdVendas.toLocaleString("pt-BR"); k.vals[2].textContent = Q(tot.Itens); k.vals[3].textContent = C2(Ticket(tot)); k.vals[4].textContent = F2(PA(tot));
      aviso.textContent = avA + periodo + (acc.todos ? ": todos os vendedores," : ":") + " somando as duas empresas. Vendas líquidas = faturadas − descontos − devoluções (canceladas, pré-vendas e condicionais ficam de fora). Itens = quantidade vendida menos a devolvida. Ticket médio = vendas líquidas ÷ quantidade de vendas. PA = itens ÷ quantidade de vendas.";
      imprimir.disabled = exportar.disabled = false;
    } catch (e) { alertBox(friendly(e), "Desempenho"); aviso.textContent = "Não foi possível consultar. Nenhum dado foi alterado."; }
    finally { busy(gerar, false, "GERAR RELATÓRIO"); }
  };
  exportar.onclick = () => {
    if (!linhas) return;
    const txt = "﻿Vendedor;Vendas líquidas;Qtd. vendas;Qtd. itens;Ticket médio;PA\r\n" + rows.map((r) => r.Nome.replace(/;/g, ",") + ";" + r.Liq.toFixed(2).replace(".", ",") + ";" + r.Qtd + ";" + Number(r.Itens).toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }) + ";" + r.Ticket.toFixed(2).replace(".", ",") + ";" + r.PA.toFixed(2).replace(".", ",")).join("\r\n") + "\r\n";
    const a = h("a", { href: URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })), download: "Desempenho_" + de.value + "_" + ate.value + ".csv" }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 2000);
    ctx.audit("EXPORTAR", "RELATORIO", "Desempenho", "CSV exportado no celular");
  };
  imprimir.onclick = () => {
    if (!linhas) return alertBox("Gere um relatório antes de imprimir.");
    const pc = [{ k: "Nome", t: "VENDEDOR" }, { k: "Liq", t: "VENDAS LÍQUIDAS", money: true }, { k: "Qtd", t: "QTD. VENDAS", right: true }, { k: "Itens", t: "QTD. ITENS", right: true, fmt: Q }, { k: "Ticket", t: "TICKET MÉDIO", money: true }, { k: "PA", t: "PA", right: true, fmt: F2 }];
    printTable("DESEMPENHO DOS VENDEDORES", pc, rows, { totalLast: true, landscape: false, extra: "<p>Período: " + periodo + "  |  as duas empresas</p>" });
  };
});
