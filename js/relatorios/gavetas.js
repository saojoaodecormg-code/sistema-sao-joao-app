// Custos por gaveta: Gavetas.cs + SjGavetasForm.cs (somente gerência). Usa os mesmos pagamentos do Contas Pagas.
import { h, alertBox, friendly } from "../ui.js";
import { ctx, register } from "../app.js";
import { consultaCom, R2 } from "../mym.js";
import { page, table, acesso, C2, busy } from "./base.js";
import { GrupoDe, Norm, NomeMes, Coletar, filtroPeriodo, prepararFornecedores, baixar, imprimirHtml, htmlTabela } from "./contas_pagas.js";

export const Titulo = "Custos por gaveta";
export const Fornecedor = 0, Fixo = 1, Variavel = 2, Investimento = 3, Emprestimo = 4;
export const Nomes = ["Fornecedor", "Custo fixo", "Custo variável", "Investimentos", "Empréstimos"];
export const Colunas = () => ["Mês", "Recebido", "Pago", ...Nomes, "Lucro / prejuízo"];
export const SalarioMinimo = (ano) => (ano >= 2026 ? 1621 : ano === 2025 ? 1518 : ano === 2024 ? 1412 : 1320);
const Comeca = (f, ...p) => p.some((x) => f.startsWith(x));
export function SalariosGarantidos(fornecedor, anoMes) {
  const f = Norm(fornecedor);
  if (f.startsWith("ELAINE CRISTINA")) return anoMes >= 202601 ? 2.7 : 2;
  if (Comeca(f, "NELSON NEY", "YURI DELCARLOS", "ANDRESSA APARECIDA", "JOAO CARLOS RESENDE")) return 2;
  if (f.startsWith("ANA CLARA")) return 1.5;
  if (Comeca(f, "LORENA MARIA", "DANIELLA ADRIADNA", "VANIA APARECIDA", "EMANUELLY", "NAYANE NUNES")) return 1;
  return 0;
}
export function GavetaDe(p) {
  const g = GrupoDe(p.Conta), f = Norm(p.Fornecedor), k = Norm(p.Classe), c = p.ContaMM ?? "";
  switch (g) {
    case 0: return Fornecedor;
    case 4: return Emprestimo;
    case 5: return Variavel;
    case 3: return Comeca(f, "SIMPLES NACIONAL", "ICMS", "RECEITA ESTADUAL") || f.includes("SECRETARIA DE ESTADO DE FAZENDA") || k.includes("ESTADUAL") ? Variavel : Fixo;
    case 7: if (Comeca(f, "PAULO CESAR", "JULIANA RAFAELLA")) return Variavel; if (Comeca(f, "VITOR HUGO")) return Investimento; return Fixo;
    case 2:
      if (c.startsWith("6.01") || k.includes("BEM MOVEL") || k.includes("REFORMA") || Comeca(f, "ROBINSON SOUSA", "CONSTRULAR", "T&T ILUMINACAO", "MASTER LASER", "LEONARDO ANTONIO", "SAVEMAC")) return Investimento;
      if (Comeca(f, "RD DISTRIBUIDORA", "ETIQUETAS", "TX CARTAO", "ASAAS", "MERCADO LIVRE") || k === "CARTAO") return Variavel;
      return Fixo;
    case 1: case 6: return Fixo;
    default: return -1;
  }
}
const nova = (rot = "", am = 0) => ({ Rotulo: rot, AnoMes: am, Recebidos: 0, V: Nomes.map(() => 0), Itens: [] });
export const Pago = (l) => l.V.reduce((s, x) => s + x, 0);
export const Lucro = (l) => l.Recebidos - Pago(l);
const Somar = (t, o) => { t.Recebidos += o.Recebidos; for (let i = 0; i < t.V.length; i++) t.V[i] += o.V[i]; };
// Math.Round(decimal,2) do C# arredonda o meio para o par.
const RoundEven2 = (v) => { const x = v * 100, f = Math.floor(x), d = x - f; const r = Math.abs(d - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(x); return r / 100; };
const N2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function Montar(meses, vendas, pagos, emp) {
  const porMes = new Map();
  for (const am of meses) { const l = nova(NomeMes(am), am); const v = vendas && vendas.get(am); if (v) l.Recebidos = v.Recebidos; porMes.set(am, l); }
  const pessoa = new Map();
  for (const p of pagos) {
    const l = porMes.get(p.AnoMes); if (!l || (emp > 0 && p.Emp !== emp)) continue;
    const gv = GavetaDe(p); if (gv < 0) continue;
    l.V[gv] += p.Valor;
    const nome = !String(p.Fornecedor ?? "").trim() ? p.ContaMM : p.Fornecedor;
    l.Itens.push([gv, nome, p.Valor]);
    if (gv === Fixo && SalariosGarantidos(p.Fornecedor, p.AnoMes) > 0) { const ch = p.AnoMes + "|" + Norm(p.Fornecedor); pessoa.set(ch, (pessoa.get(ch) || 0) + p.Valor); }
  }
  for (const [k, v] of pessoa) {
    const am = Number(k.slice(0, 6)), nome = k.slice(7);
    const fixo = RoundEven2(SalariosGarantidos(nome, am) * SalarioMinimo(Math.floor(am / 100))), com = v - fixo;
    if (com <= 0) continue;
    const l = porMes.get(am); l.V[Fixo] -= com; l.V[Variavel] += com;
    l.Itens.push([Fixo, nome + " — comissão (sai do fixo)", -com]);
    l.Itens.push([Variavel, nome + " — comissão (acima de " + N2(fixo) + ")", com]);
  }
  const r = [], total = nova("TOTAL"), anos = [...new Set(meses.map((m) => Math.floor(m / 100)))];
  for (const ano of anos) { const sub = nova("TOTAL " + ano); for (const am of meses.filter((m) => Math.floor(m / 100) === ano)) { r.push(porMes.get(am)); Somar(sub, porMes.get(am)); } if (anos.length > 1) r.push(sub); Somar(total, sub); }
  r.push(total); return r;
}
export function Detalhe(l) {
  const r = [];
  Nomes.forEach((n, g) => {
    const grupos = new Map(); for (const [gv, nome, v] of l.Itens) if (gv === g) grupos.set(nome, (grupos.get(nome) || 0) + v);
    for (const [nome, v] of [...grupos].sort((a, b) => b[1] - a[1])) if (Math.abs(v) >= 0.005) r.push([n, nome, C2(v)]);
    r.push(["TOTAL " + n.toUpperCase(), "", C2(l.V[g])]);
  });
  r.push(["TOTAL PAGO", "", C2(Pago(l))], ["RECEBIDO", "", C2(l.Recebidos)], ["LUCRO / PREJUÍZO", "", C2(Lucro(l))]);
  return r;
}

register("rel/gavetas", (el) => {
  page(el, Titulo, "Recebido, pago, as 5 gavetas e o lucro (MyManager)");
  if (!acesso(ctx.session.nome).todos) { el.append(h("div", { class: "card" }, "O relatório de custos é liberado só para a gerência.")); return; }
  prepararFornecedores();
  const card = h("div", { class: "card" }); el.append(card);
  const f = filtroPeriodo(card);
  const gerar = h("button", { class: "btn primary block", style: { marginTop: "10px", background: "#1565c0" } }, "CONSULTAR"), imprimir = h("button", { class: "btn", disabled: true }, "IMPRIMIR"), exportar = h("button", { class: "btn", disabled: true }, "EXPORTAR CSV");
  card.append(gerar, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, imprimir, exportar));
  const area = h("div", {}), titDet = h("div", { style: { fontWeight: "700", color: "#082d4e", margin: "12px 0 6px" } }, "Escolha um mês na lista para ver cada pagamento dentro da sua gaveta."), det = h("div", {});
  const aviso = h("div", { class: "sub", style: { color: "#5a5e64", margin: "10px 0", lineHeight: "1.45" } }, "Consulta somente leitura: nada é gravado no MyManager. Escolha os anos ou o período e clique em CONSULTAR.");
  el.append(area, aviso, titDet, det);
  let linhas = null, filtroTexto = "", sel = null;
  const cols = Colunas().map((t, i) => ({ k: "c" + i, t, money: i > 0, bold: i === Colunas().length - 1 }));
  function mostrarDetalhe(l) {
    sel = l; det.innerHTML = ""; if (!l) return;
    if (l.AnoMes === 0) { titDet.textContent = "Escolha um mês para ver cada pagamento (os totais do ano estão na linha " + l.Rotulo + ")."; return; }
    titDet.textContent = "Pagamentos de " + l.Rotulo + " em cada gaveta";
    const d = Detalhe(l);
    det.append(table([{ k: 0, t: "Gaveta" }, { k: 1, t: "Quem recebeu" }, { k: 2, t: "Valor pago", right: true }], d.map((x) => ({ 0: x[0], 1: x[1], 2: x[2] }))));
    det.querySelectorAll("tbody tr").forEach((tr, i) => { const a = d[i][0]; if (a.startsWith("TOTAL") || a === "RECEBIDO" || a.startsWith("LUCRO")) { tr.style.fontWeight = "700"; tr.style.background = "#f0f2f5"; } });
  }
  gerar.onclick = async () => {
    let e; try { e = f.escolher(); } catch (x) { return alertBox(friendly(x), Titulo); }
    const emp = f.emp(), texto = e.texto + " | " + f.nomeEmp();
    busy(gerar, true, "CONSULTAR"); imprimir.disabled = exportar.disabled = true; aviso.textContent = "Consultando o MyManager (contas pagas e recebimentos)... pode levar alguns segundos por ano.";
    try {
      await prepararFornecedores();
      const c = await Coletar(consultaCom(180000), e.meses, emp, e.periodo ? e.de : null, e.periodo ? e.ate : null);
      linhas = Montar(e.meses, c.vendas, c.pagos, emp); filtroTexto = texto;
      const last = Colunas().length - 1;
      const rows = linhas.map((l) => { const o = { c0: l.Rotulo, c1: l.Recebidos, c2: Pago(l), _l: l }; l.V.forEach((v, i) => (o["c" + (3 + i)] = v)); o["c" + last] = Lucro(l); return o; });
      area.innerHTML = ""; area.append(table(cols, rows, { onRow: (r) => mostrarDetalhe(r._l) }));
      area.querySelectorAll("tbody tr").forEach((tr, i) => { tr.lastChild.style.color = Lucro(linhas[i]) < 0 ? "#a81e2c" : "#25844b"; if (linhas[i].AnoMes === 0) { tr.style.fontWeight = "700"; tr.style.background = "#f0f2f5"; } });
      aviso.textContent = texto + ". Pago = soma das 5 gavetas (os mesmos pagamentos do Contas Pagas). Lucro = recebido - pago. Comissão = o que o vendedor recebeu acima dos salários garantidos; vai para o custo variável.";
      imprimir.disabled = exportar.disabled = false; mostrarDetalhe(linhas[linhas.length - 1]);
    } catch (x) { alertBox(friendly(x), Titulo); aviso.textContent = "Não foi possível consultar. Nenhum dado foi alterado."; }
    finally { busy(gerar, false, "CONSULTAR"); }
  };
  const F = (v) => v.toFixed(2).replace(".", ",");
  exportar.onclick = () => {
    if (!linhas) return;
    let s = Titulo + " - " + filtroTexto.replace(/;/g, ",") + "\r\n" + Colunas().join(";") + "\r\n";
    for (const l of linhas) s += [l.Rotulo, F(l.Recebidos), F(Pago(l)), ...l.V.map(F), F(Lucro(l))].join(";") + "\r\n";
    s += "\r\nDetalhe;Mês;Gaveta;Quem recebeu;Valor pago\r\n";
    for (const l of linhas.filter((x) => x.AnoMes > 0)) for (const x of Detalhe(l)) if (x[1].length) s += ";" + l.Rotulo + ";" + x[0] + ";" + x[1].replace(/;/g, ",") + ";" + x[2].replace("R$", "").trim() + "\r\n";
    const d = new Date(); baixar("Custos_por_gaveta_" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".csv", s);
  };
  imprimir.onclick = () => {
    if (!linhas) return alertBox("Faça a consulta antes de imprimir.");
    let corpo = htmlTabela(Colunas(), linhas.map((l) => [l.Rotulo, N2(l.Recebidos), N2(Pago(l)), ...l.V.map(N2), N2(Lucro(l))]), { dir: Colunas().map((_, i) => i).slice(1), bold: (x) => x[0].startsWith("TOTAL") });
    if (sel && sel.AnoMes > 0) corpo += "<h2>Pagamentos de " + sel.Rotulo + " em cada gaveta</h2>" + htmlTabela(["", "", ""], Detalhe(sel), { dir: [2], bold: (x) => x[1].length === 0 });
    imprimirHtml("São João — " + Titulo + " | " + filtroTexto, corpo);
  };
});
