// Comissões e recebimentos por vendedor: MyManagerComissoes.cs + SjComissoesForm.cs.
import { h, alertBox, friendly } from "../ui.js";
import { ctx, register } from "../app.js";
import { consultaCom, parseList, I, M, S, R2 } from "../mym.js";
import { page, monthYear, cards, table, csv, printTable, acesso, C2, busy } from "./base.js";

const TipoDevolucao = 6, TipoAPrazo = 2, SemVendedor = 0;
export const FormaAPrazo = (t) => { t = String(t ?? "").trim().toUpperCase(); return t === "PR" || t === "CH" || t === "BO"; };
const D = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const SQL = {
  vendas: (a, b) => "SELECT V.COD_VEN SJV_VEN, COALESCE(O.COD_VEND,V.COD_VEND) SJV_VEND, V.COD_EMP SJV_EMP, V.COD_TPV SJV_TPV, V.TOTAL_VEN SJV_TOTAL, COALESCE(V.DESCONTO_VEN,0) SJV_DESC, COALESCE(V.ACRESCIMO_VEN,0) SJV_ACR FROM VENDAS V LEFT JOIN VENDAS O ON O.COD_VEN=V.COD_VEN_DEV AND V.COD_TPV=" + TipoDevolucao + " WHERE V.FLAGFATURADO='S' AND V.CANCELADA_VEN=0 AND V.DATA_VEN>='" + D(a) + "' AND V.DATA_VEN<'" + D(b) + "';",
  formas: (a, b) => "SELECT P.COD_VENDA SJF_VEN, V.COD_VEND SJF_VEND, V.COD_EMP SJF_EMP, V.COD_TPV SJF_TPV, P.COD_FORMA SJF_FORMA, TRIM(COALESCE(FP.TIPO,'')) SJF_TIPO, P.VALOR SJF_VALOR FROM VENDAS V JOIN VENDAS_FORMAS_PAGAMENTO P ON P.COD_VENDA=V.COD_VEN LEFT JOIN FORMAS_PAGAMENTO FP ON FP.CODIGO=P.COD_FORMA WHERE V.FLAGFATURADO='S' AND V.CANCELADA_VEN=0 AND V.COD_TPV<>" + TipoDevolucao + " AND COALESCE(P.CANCELADO,0)=0 AND V.DATA_VEN>='" + D(a) + "' AND V.DATA_VEN<'" + D(b) + "';",
  titulos: (a, b) => "SELECT R.SEQUENCIA_RECTO SJT_RECTO, R.TOTAL_RECTO SJT_TOTAL, C.COD_CTR SJT_CTR, C.SEQUENCIA_CTR SJT_SEQ, C.VALOR_CTR SJT_VALOR, COALESCE(C.VLRPAGO_CTR,0) SJT_PAGO, V.COD_VEND SJT_VEND, C.COD_EMP SJT_EMP, IIF(V.DATA_VEN>='" + D(a) + "' AND V.DATA_VEN<'" + D(b) + "',1,0) SJT_DOMES FROM RECEBIMENTOS R JOIN RECEBIMENTOS_TITULOS T ON T.SEQUENCIA_RECTO=R.SEQUENCIA_RECTO JOIN CONTAS_RECEBER C ON C.COD_CTR=T.COD_CTR AND C.SEQUENCIA_CTR=T.SEQUENCIA_CTR LEFT JOIN VENDAS V ON V.COD_VEN=C.COD_VENDA WHERE COALESCE(R.CANCELADO,'N')<>'S' AND R.DATA_RECTO>='" + D(a) + "' AND R.DATA_RECTO<'" + D(b) + "';",
  recebimentos: (a, b) => "SELECT R.SEQUENCIA_RECTO SJR_RECTO, R.TOTAL_RECTO SJR_TOTAL FROM RECEBIMENTOS R WHERE COALESCE(R.CANCELADO,'N')<>'S' AND R.DATA_RECTO>='" + D(a) + "' AND R.DATA_RECTO<'" + D(b) + "';",
  avulsos: (a, b) => "SELECT C.COD_CTR SJO_CTR, C.VLRPAGO_CTR SJO_PAGO, V.COD_VEND SJO_VEND, C.COD_EMP SJO_EMP, IIF(V.DATA_VEN>='" + D(a) + "' AND V.DATA_VEN<'" + D(b) + "',1,0) SJO_DOMES FROM CONTAS_RECEBER C LEFT JOIN VENDAS V ON V.COD_VEN=C.COD_VENDA WHERE C.DTPAGTO_CTR>='" + D(a) + "' AND C.DTPAGTO_CTR<'" + D(b) + "' AND C.VLRPAGO_CTR>0 AND NOT EXISTS (SELECT 1 FROM RECEBIMENTOS_TITULOS T WHERE T.COD_CTR=C.COD_CTR AND T.SEQUENCIA_CTR=C.SEQUENCIA_CTR);",
  vendedores: "SELECT COD_VEND SJN_COD, TRIM(NOME_VEND) SJN_NOME FROM VENDEDOR;",
};
export const SqlDatas = D;
export const parse = {
  vendas: (o) => parseList(o, "SJV_VEN").map((r) => ({ Ven: I(r, "SJV_VEN"), Vend: I(r, "SJV_VEND"), Emp: I(r, "SJV_EMP"), Tpv: I(r, "SJV_TPV"), Total: M(r, "SJV_TOTAL"), Desc: M(r, "SJV_DESC"), Acr: M(r, "SJV_ACR") })),
  formas: (o) => parseList(o, "SJF_VEN").map((r) => ({ Ven: I(r, "SJF_VEN"), Vend: I(r, "SJF_VEND"), Emp: I(r, "SJF_EMP"), Tpv: I(r, "SJF_TPV"), Forma: I(r, "SJF_FORMA"), Tipo: S(r, "SJF_TIPO"), Valor: M(r, "SJF_VALOR") })),
  titulos: (o) => parseList(o, "SJT_RECTO").map((r) => ({ Recto: I(r, "SJT_RECTO"), ValorRecto: M(r, "SJT_TOTAL"), Ctr: I(r, "SJT_CTR"), Seq: I(r, "SJT_SEQ"), ValorCtr: M(r, "SJT_VALOR"), Pago: M(r, "SJT_PAGO"), Vend: I(r, "SJT_VEND"), Emp: I(r, "SJT_EMP"), DoMes: I(r, "SJT_DOMES") === 1 })),
  avulsos: (o) => parseList(o, "SJO_CTR").map((r) => ({ Ctr: I(r, "SJO_CTR"), Pago: M(r, "SJO_PAGO"), Vend: I(r, "SJO_VEND"), Emp: I(r, "SJO_EMP"), DoMes: I(r, "SJO_DOMES") === 1 })),
  recebimentos: (o) => parseList(o, "SJR_RECTO").reduce((t, r) => t + M(r, "SJR_TOTAL"), 0),
  nomes: (o) => { const d = new Map(); for (const r of parseList(o, "SJN_COD")) d.set(I(r, "SJN_COD"), S(r, "SJN_NOME")); return d; },
};
const novaLinha = (cod, nome) => ({ CodVend: cod, Nome: nome, QtdVendas: 0, Bruto: 0, Descontos: 0, Acrescimos: 0, Devolucoes: 0, AVista: 0, Entradas: 0, Crediario: 0, CrediarioDoMes: 0, ComVendas: 0, ComReceb: 0, Dinheiro: 0, Pix: 0, Cartao: 0, Outros: 0, LiquidoEmp: new Map(), RecebidoEmp: new Map() });
export const Liquido = (l) => l.Bruto - l.Descontos + l.Acrescimos - l.Devolucoes;
export const Recebido = (l) => l.AVista + l.Entradas + l.Crediario - l.Devolucoes;
export const ordIC = (a, b) => { const x = String(a).toUpperCase(), y = String(b).toUpperCase(); return x < y ? -1 : x > y ? 1 : 0; };
const soma = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
const somaTipo = (l, t, v) => { t = String(t ?? "").trim().toUpperCase(); if (t === "DN") l.Dinheiro += v; else if (t === "BC") l.Pix += v; else if (t === "CA") l.Cartao += v; else l.Outros += v; };
export function ratear(titulos) {
  const res = [], grupos = new Map();
  for (const t of titulos) if (t.ValorCtr > 0) { if (!grupos.has(t.Recto)) grupos.set(t.Recto, []); grupos.get(t.Recto).push(t); }
  for (const g of grupos.values()) {
    const lst = g.slice().sort((a, b) => a.Ctr - b.Ctr || a.Seq - b.Seq); const peso = (t) => (t.Pago > 0 ? t.Pago : t.ValorCtr);
    const tot = lst.reduce((s, t) => s + peso(t), 0), valor = lst[0].ValorRecto; let usado = 0;
    lst.forEach((t, i) => { const parte = i === lst.length - 1 ? valor - usado : R2((valor * peso(t)) / tot); usado += parte; res.push([t, parte]); });
  }
  return res;
}
export function calcular(vendas, formas, titulos, avulsos, nomes, percentual, recebDoMes) {
  const map = new Map();
  const L = (cod) => { let l = map.get(cod); if (!l) { const n = nomes && nomes.get(cod); l = novaLinha(cod, cod === SemVendedor ? "SEM VENDEDOR (títulos avulsos)" : n && n.trim() ? n : "VENDEDOR #" + cod); map.set(cod, l); } return l; };
  for (const v of vendas) {
    const l = L(v.Vend);
    if (v.Tpv === TipoDevolucao) { const dev = v.Total - v.Desc + v.Acr; l.Devolucoes += dev; soma(l.LiquidoEmp, v.Emp, -dev); soma(l.RecebidoEmp, v.Emp, -dev); continue; }
    l.QtdVendas++; l.Bruto += v.Total; l.Descontos += v.Desc; l.Acrescimos += v.Acr; soma(l.LiquidoEmp, v.Emp, v.Total - v.Desc + v.Acr);
  }
  for (const f of formas) { if (FormaAPrazo(f.Tipo)) continue; const l = L(f.Vend); if (f.Tpv === TipoAPrazo) l.Entradas += f.Valor; else l.AVista += f.Valor; somaTipo(l, f.Tipo, f.Valor); soma(l.RecebidoEmp, f.Emp, f.Valor); }
  let rateado = 0;
  for (const [t, v] of ratear(titulos)) { const l = L(t.Vend); l.Crediario += v; if (t.DoMes) l.CrediarioDoMes += v; rateado += v; soma(l.RecebidoEmp, t.Emp, v); }
  for (const a of avulsos) { const l = L(a.Vend); l.Crediario += a.Pago; if (a.DoMes) l.CrediarioDoMes += a.Pago; soma(l.RecebidoEmp, a.Emp, a.Pago); }
  const res = { Linhas: [], Total: novaLinha(-1, "TOTAL GERAL"), RecebimentosDoMes: recebDoMes, RateadoNosTitulos: rateado };
  const ord = [...map.values()].sort((a, b) => (a.CodVend === SemVendedor ? 1 : 0) - (b.CodVend === SemVendedor ? 1 : 0) || ordIC(a.Nome, b.Nome));
  for (const l of ord) {
    if (l.QtdVendas === 0 && l.Bruto === 0 && l.Devolucoes === 0 && Recebido(l) === 0) continue;
    l.ComVendas = R2((Liquido(l) * percentual) / 100); l.ComReceb = R2((Recebido(l) * percentual) / 100); res.Linhas.push(l);
    const t = res.Total; for (const k of ["QtdVendas", "Bruto", "Descontos", "Acrescimos", "Devolucoes", "AVista", "Entradas", "Dinheiro", "Pix", "Cartao", "Outros", "Crediario", "CrediarioDoMes", "ComVendas", "ComReceb"]) t[k] += l[k];
    for (const [k, v] of l.LiquidoEmp) soma(t.LiquidoEmp, k, v); for (const [k, v] of l.RecebidoEmp) soma(t.RecebidoEmp, k, v);
  }
  return res;
}
export async function ler(consulta, ano, mes, percentual) {
  const a = new Date(ano, mes - 1, 1), b = new Date(ano, mes, 1);
  const vendas = parse.vendas(await consulta(SQL.vendas(a, b))), formas = parse.formas(await consulta(SQL.formas(a, b))), titulos = parse.titulos(await consulta(SQL.titulos(a, b))), avulsos = parse.avulsos(await consulta(SQL.avulsos(a, b)));
  const receb = parse.recebimentos(await consulta(SQL.recebimentos(a, b))), nomes = parse.nomes(await consulta(SQL.vendedores));
  return calcular(vendas, formas, titulos, avulsos, nomes, percentual, receb);
}
const EMPRESAS = ["", "SÃO JOÃO DECORAÇÕES", "LOJA SÃO JOÃO"];
const empresa = (c) => (c > 0 && c < EMPRESAS.length ? EMPRESAS[c] : "EMPRESA " + c);

register("rel/comissoes", (el) => {
  page(el, "Comissões e recebimentos", "Por vendedor, direto do MyManager");
  const ant = new Date(); ant.setDate(1); ant.setMonth(ant.getMonth() - 1);
  const card = h("div", { class: "card" }); el.append(card);
  const my = monthYear(card, { mes: ant.getMonth() + 1, ano: ant.getFullYear() });
  const perc = h("input", { class: "input", value: "0", inputmode: "decimal" }); card.append(h("label", { class: "lbl" }, "Comissão (%)"), perc);
  const gerar = h("button", { class: "btn primary block", style: { marginTop: "10px" } }, "GERAR RELATÓRIO"), imprimir = h("button", { class: "btn", disabled: true }, "IMPRIMIR"), exportar = h("button", { class: "btn", disabled: true }, "EXPORTAR CSV");
  card.append(gerar, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, imprimir, exportar));
  const k = cards(["VENDAS LÍQUIDAS", "TOTAL RECEBIDO (JÁ SEM DEVOLUÇÕES)", "COMISSÃO SOBRE VENDAS", "COMISSÃO SOBRE RECEBIMENTOS"]);
  const area = h("div", {}), aviso = h("div", { class: "sub", style: { color: "#5a5e64", margin: "10px 0", lineHeight: "1.45" } }, "Todos os vendedores, somando SÃO JOÃO DECORAÇÕES e LOJA SÃO JOÃO. Consulta somente leitura: nada é gravado no MyManager.");
  el.append(k.el, area, aviso);
  const acc = acesso(ctx.session.nome);
  const cols = [{ k: "Vendedor", t: "Vendedor" }, { k: "Qtd", t: "Qtd. vendas", right: true }, { k: "Liq", t: "Vendas líquidas", money: true }, { k: "AV", t: "Vendas à vista", money: true }, { k: "Ent", t: "Entrada das vendas a prazo", money: true }, { k: "Cred", t: "Crediário recebido", money: true }, { k: "CredMes", t: "Crediário das vendas do mês (já incluso)", money: true }, { k: "Dev", t: "Devoluções (−)", money: true }, { k: "Rec", t: "TOTAL RECEBIDO", money: true, bold: true, color: "#082d4e" }, { k: "CV", t: "Comissão s/ vendas", money: true, bold: true, color: "#961a2a" }, { k: "CR", t: "Comissão s/ recebimentos", money: true, bold: true, color: "#961a2a" }];
  let ultimo = null, rows = [], ref = "";
  const linha = (l) => ({ Vendedor: l.CodVend < 0 ? l.Nome : l.Nome + (l.CodVend > 0 ? " (#" + l.CodVend + ")" : ""), Qtd: l.QtdVendas, Liq: Liquido(l), AV: l.AVista, Ent: l.Entradas, Cred: l.Crediario, CredMes: l.CrediarioDoMes, Dev: l.Devolucoes, Rec: Recebido(l), CV: l.ComVendas, CR: l.ComReceb, _l: l });
  function detalhe(r) {
    const l = r._l; const R = C2; let s = l.Nome + "\n\nVendas: " + l.QtdVendas + "  |  brutas " + R(l.Bruto) + "  −  descontos " + R(l.Descontos - l.Acrescimos) + "  −  devoluções " + R(l.Devolucoes) + "  =  líquidas " + R(Liquido(l)) + "\n\n";
    const emps = [...new Set([...l.LiquidoEmp.keys(), ...l.RecebidoEmp.keys()])].sort((a, b) => a - b);
    for (const e of emps) s += empresa(e) + ":  vendas líquidas " + R(l.LiquidoEmp.get(e) || 0) + "  |  recebido " + R(l.RecebidoEmp.get(e) || 0) + "\n";
    s += "\nTOTAL:  vendas líquidas " + R(Liquido(l)) + "  |  recebido " + R(Recebido(l)) + "\nComissão s/ vendas " + R(l.ComVendas) + "  |  comissão s/ recebimentos " + R(l.ComReceb) + "\n\nVendas à vista " + R(l.AVista) + "  +  entrada das vendas a prazo " + R(l.Entradas) + "  +  crediário " + R(l.Crediario) + " (das vendas do mês: " + R(l.CrediarioDoMes) + ")  −  devoluções " + R(l.Devolucoes) + "  =  " + R(Recebido(l)) +
      "\nPago na hora (à vista + entrada):  dinheiro " + R(l.Dinheiro) + "  |  PIX/banco " + R(l.Pix) + "  |  cartão " + R(l.Cartao) + (l.Outros !== 0 ? "  |  outras " + R(l.Outros) : "");
    alertBox(s, "Detalhe por empresa");
  }
  gerar.onclick = async () => {
    const a = my.ano(), m = my.mes(), p = Math.max(0, Math.min(100, Number(String(perc.value).replace(",", ".")) || 0));
    busy(gerar, true, "GERAR RELATÓRIO"); imprimir.disabled = exportar.disabled = true; aviso.textContent = "Consultando o MyManager (vendas, formas de pagamento e baixas do crediário)...";
    try {
      let r = await ler(consultaCom(120000), a, m, p); let avA = "";
      if (!acc.todos) {
        const cod = acc.vendedor(r.Linhas.map((x) => [x.CodVend, x.Nome])); const minha = r.Linhas.find((x) => cod > 0 && x.CodVend === cod);
        const so = { RecebimentosDoMes: r.RecebimentosDoMes, RateadoNosTitulos: r.RateadoNosTitulos, Linhas: [], Total: novaLinha(-1, "TOTAL") };
        if (minha) { so.Linhas.push(minha); so.Total = { ...minha, CodVend: -1, Nome: "TOTAL" }; }
        avA = acc.aviso(minha ? cod : 0, minha ? minha.Nome : ""); r = so;
      }
      ultimo = r; rows = [...r.Linhas.map(linha), linha(r.Total)]; ref = String(m).padStart(2, "0") + "/" + a;
      area.innerHTML = ""; area.append(table(cols, rows, { totalLast: true, onRow: detalhe }));
      k.vals[0].textContent = C2(Liquido(r.Total)); k.vals[1].textContent = C2(Recebido(r.Total)); k.vals[2].textContent = C2(r.Total.ComVendas); k.vals[3].textContent = C2(r.Total.ComReceb);
      const conf = r.RecebimentosDoMes === r.RateadoNosTitulos ? "todas as baixas do crediário do mês (" + C2(r.RecebimentosDoMes) + ") foram distribuídas aos vendedores" : "baixas do mês " + C2(r.RecebimentosDoMes) + ", distribuídas aos títulos " + C2(r.RateadoNosTitulos) + " (a diferença são baixas sem título de venda)";
      aviso.textContent = acc.todos ? ref + ": todos os vendedores, somando as duas empresas. Vendas líquidas = brutas − descontos − devoluções (canceladas, pré-vendas e condicionais ficam de fora). Vendas à vista = vendas do tipo à vista (igual ao Recebido do MyManager); entrada = dinheiro, PIX ou cartão pago na hora nas vendas a prazo; crediário = parcelas pagas no mês, para o vendedor da venda (de vendas de qualquer mês). Total recebido = à vista + entrada + crediário − devoluções. Conferência: " + conf + ". Toque num vendedor para ver por empresa."
        : avA + " " + ref + ": vendas líquidas = brutas − descontos − devoluções; total recebido = à vista + entrada + crediário − devoluções.";
      imprimir.disabled = exportar.disabled = false;
    } catch (e) { alertBox(friendly(e), "Comissões"); aviso.textContent = "Não foi possível consultar. Nenhum dado foi alterado."; }
    finally { busy(gerar, false, "GERAR RELATÓRIO"); }
  };
  exportar.onclick = () => csv("Comissoes_" + my.ano() + "-" + String(my.mes()).padStart(2, "0") + ".csv", cols, rows);
  imprimir.onclick = () => {
    const pc = ["Vendedor", "Liq", "AV", "Cred", "CredMes", "Dev", "Rec"], cab = ["NOME DO VENDEDOR", "VENDAS LÍQUIDAS", "VENDAS À VISTA", "CREDIÁRIO RECEBIDO", "CREDIÁRIO DAS VENDAS DO MÊS", "DEVOLUÇÃO", "TOTAL RECEBIDO"];
    printTable("São João — Comissões e recebimentos por vendedor | " + ref + " | " + Number(perc.value.replace(",", ".") || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "% | duas empresas", pc.map((c, i) => ({ ...cols.find((x) => x.k === c), t: cab[i] })), rows, { totalLast: true });
  };
});
