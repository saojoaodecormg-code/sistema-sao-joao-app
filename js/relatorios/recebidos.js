// Relatório de Recebidos: RecebidosPagamento.cs + SjRecebidosForm.cs (planilha de pagamento).
// Os arquivos do mês e a configuração (DataRoot/RelatorioRecebidos) ficam na nuvem com o mesmo conteúdo
// (texto separado por TAB, números invariantes); a ponte da loja mantém os arquivos do computador iguais.
import { h, alertBox, confirmBox, friendly, parseMoney } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { consultaCom, R2 } from "../mym.js";
import { ler as lerComissoes, Recebido as RecebidoCom } from "./comissoes.js";
import { page, monthYear, acesso, C2, busy } from "./base.js";

export const NomesRegra = ["Própria", "Equipe Decor", "Loja sem a Decor", "Total geral"];
const Propria = 0, EquipeDecor = 1, LojaSemDecor = 2, TotalGeral = 3;
const MESES = ["", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const nova = (o = {}) => ({ CodVend: 0, Nome: "", Recebido: 0, Percentual: 0, Salario: 0, Decor: false, Regra: Propria, Base: 0, Comissao: 0, ...o });
export const Chave = (l) => (l.CodVend > 0 ? "COD:" + l.CodVend : "NOME:" + String(l.Nome ?? "").trim().toUpperCase());
export const TemPagamento = (l) => l.Percentual !== 0 || l.Salario !== 0;
export const SalarioMaisComissao = (l) => l.Salario + l.Comissao;
export const Total = (ls) => ls.reduce((s, x) => s + x.Recebido, 0);
export function Calcular(linhas) {
  const total = Total(linhas), decor = linhas.filter((x) => x.Decor).reduce((s, x) => s + x.Recebido, 0);
  for (const l of linhas) { l.Base = l.Regra === EquipeDecor ? decor : l.Regra === LojaSemDecor ? total - decor : l.Regra === TotalGeral ? total : l.Recebido; l.Comissao = R2(l.Base * l.Percentual / 100); }
}
export const DoMyManager = (r) => r.Linhas.filter((c) => RecebidoCom(c) !== 0).map((c) => nova({ CodVend: c.CodVend, Nome: c.Nome, Recebido: RecebidoCom(c) }));
export function Padrao() {
  const d = new Map(); const a = (cod, nome, pct, regra, decor) => { const l = nova({ CodVend: cod, Nome: nome, Percentual: pct, Salario: 1621, Regra: regra, Decor: decor }); d.set(Chave(l), l); };
  a(2, "NELSON", 1, EquipeDecor, true); a(36, "YURI DECOR", 2, EquipeDecor, true); a(35, "YURI", 1.85, Propria, false); a(30, "DANIELLA", 1.85, Propria, false); a(4, "ELAINE C", 0.75, LojaSemDecor, false);
  return d;
}
export function AplicarConfig(linhas, cfg) {
  for (const l of linhas) { const c = cfg.get(Chave(l)); if (c) { l.Percentual = c.Percentual; l.Salario = c.Salario; l.Regra = c.Regra; l.Decor = c.Decor; } }
  for (const c of cfg.values()) if (TemPagamento(c) && !linhas.some((x) => Chave(x) === Chave(c))) linhas.push(nova({ CodVend: c.CodVend, Nome: c.Nome, Percentual: c.Percentual, Salario: c.Salario, Regra: c.Regra, Decor: c.Decor }));
}
const inv = (v) => { const s = String(Number(v)); return s.includes("e") ? Number(v).toFixed(10).replace(/0+$/, "").replace(/\.$/, "") : s; };
export const Serializar = (linhas) => [...linhas].map((l) => inv(l.CodVend) + "\t" + String(l.Nome ?? "").replace(/[\t\r\n]/g, " ").trim() + "\t" + inv(l.Recebido) + "\t" + inv(l.Percentual) + "\t" + inv(l.Salario) + "\t" + l.Regra + "\t" + (l.Decor ? "1" : "0") + "\r\n").join("");
export function Ler(texto) {
  const out = [], n = (s) => (/^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(s) ? Number(s) : NaN);
  for (const raw of String(texto ?? "").replace(/\r/g, "").split("\n")) {
    const p = raw.split("\t"); if (p.length < 7) continue;
    const cod = /^\s*[-+]?\d+\s*$/.test(p[0]) ? Number(p[0]) : NaN, rec = n(p[2]), pc = n(p[3]), sal = n(p[4]), rg = /^\s*[-+]?\d+\s*$/.test(p[5]) ? Number(p[5]) : NaN;
    if ([cod, rec, pc, sal, rg].some(Number.isNaN)) continue;
    out.push(nova({ CodVend: cod, Nome: p[1], Recebido: rec, Percentual: pc, Salario: sal, Regra: rg >= 0 && rg <= 3 ? rg : Propria, Decor: p[6] === "1" }));
  }
  return out;
}
const UN = "DECOR"; // DataRoot do computador da loja (o mesmo arquivo para qualquer usuário)
const arqMes = (a, m) => "rel_recebidos:" + String(a).padStart(4, "0") + "-" + String(m).padStart(2, "0") + ".txt";
const ARQ_CFG = "rel_recebidos:configuracao.txt";
export async function LerConfig() {
  try { const d = await api.lerDocumento(UN, ARQ_CFG); if (d && typeof d.texto === "string") { const m = new Map(); for (const l of Ler(d.texto)) m.set(Chave(l), l); return m; } } catch {}
  return Padrao();
}
export async function CarregarMes(a, m) { try { const d = await api.lerDocumento(UN, arqMes(a, m)); if (d && typeof d.texto === "string") return Ler(d.texto); } catch {} return null; }
export async function Salvar(a, m, linhas) {
  await api.gravarDocumento(UN, arqMes(a, m), { texto: Serializar(linhas) });
  const cfg = await LerConfig(); for (const l of linhas) { const c = nova({ CodVend: l.CodVend, Nome: l.Nome, Percentual: l.Percentual, Salario: l.Salario, Regra: l.Regra, Decor: l.Decor }); cfg.set(Chave(c), c); }
  await api.gravarDocumento(UN, ARQ_CFG, { texto: Serializar(cfg.values()) });
}
const fmtPct = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtN2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const D = (s) => { const t = String(s ?? "").trim(); if (!t) return 0; try { const v = parseMoney(t); return Number.isFinite(v) ? v : 0; } catch { return 0; } };

register("rel/recebidos", (el) => {
  page(el, "Relatório de Recebidos", "Pagamento: recebido, comissão e salário");
  const ant = new Date(); ant.setDate(1); ant.setMonth(ant.getMonth() - 1);
  const acc = acesso(ctx.session.nome); let codPermitido = 0, linhas = [];
  const permitido = (l) => acc.todos || (codPermitido > 0 && l.CodVend === codPermitido);
  const top = h("div", { class: "card" }); el.append(top);
  const my = monthYear(top, { mes: ant.getMonth() + 1, ano: ant.getFullYear() });
  const buscar = h("button", { class: "btn primary block", style: { marginTop: "10px" } }, "BUSCAR DO MYMANAGER");
  const adicionar = h("button", { class: "btn" }, "ADICIONAR LINHA"), salvar = h("button", { class: "btn green" }, "SALVAR"), imprimir = h("button", { class: "btn" }, "IMPRIMIR");
  top.append(buscar, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, adicionar, salvar), h("div", { class: "btns", style: { marginTop: "8px" } }, imprimir));
  if (!acc.todos) adicionar.style.display = salvar.style.display = "none";
  const lista = h("div", {}), total = h("div", { class: "kpi", style: { marginTop: "10px" } }, h("div", { class: "t" }, "TOTAL RECEBIDO"), h("div", { class: "v", style: { color: "#961a2a" } }, "R$ 0,00"));
  const aviso = h("div", { class: "sub", style: { color: "#5a5e64", margin: "10px 0", lineHeight: "1.45" } }, "Escolha o mês e clique em BUSCAR DO MYMANAGER, ou digite os valores. Tudo pode ser alterado; os campos em amarelo (porcentagem e salário) ficam guardados para os próximos meses.");
  el.append(total, lista, aviso);
  const avisar = (t) => { if (acc.todos) aviso.textContent = t; };
  const AM = "background:#fff4aa";
  function recalcular() {
    Calcular(linhas);
    linhas.forEach((l) => { if (l._v) { l._v.base.textContent = C2(l.Base); l._v.com.textContent = C2(l.Comissao); l._v.tot.textContent = C2(SalarioMaisComissao(l)); } });
    total.lastChild.textContent = C2(Total(linhas.filter(permitido)));
  }
  function mostrar(ls) {
    linhas = ls; Calcular(linhas); lista.innerHTML = "";
    if (!acc.todos) codPermitido = acc.vendedor(linhas.map((x) => [x.CodVend, x.Nome]));
    for (const l of linhas) {
      if (!permitido(l)) { l._v = null; continue; }
      const ro = !acc.todos;
      const inp = (v, st, on) => { const i = h("input", { class: "input", value: v, inputmode: "decimal", style: st || "", disabled: ro }); i.oninput = () => { on(i.value); recalcular(); }; return i; };
      const nome = h("input", { class: "input", value: l.Nome, disabled: ro, style: "font-weight:700" }); nome.oninput = () => { l.Nome = nome.value; };
      const dec = h("input", { type: "checkbox", checked: l.Decor, disabled: ro }); dec.onchange = () => { l.Decor = dec.checked; recalcular(); };
      const rg = h("select", { class: "select", disabled: ro }, ...NomesRegra.map((n, i) => h("option", { value: i, selected: i === l.Regra }, n))); rg.onchange = () => { l.Regra = Number(rg.value); recalcular(); };
      const v = { base: h("b", {}), com: h("b", { style: { color: "#961a2a" } }), tot: h("b", {}) }; l._v = v;
      const rem = h("button", { class: "btn small", style: { display: ro ? "none" : "" } }, "REMOVER LINHA");
      rem.onclick = async () => { if (!(await confirmBox("Remover " + l.Nome + " deste mês?", "Relatório de Recebidos"))) return; mostrar(linhas.filter((x) => x !== l)); };
      lista.append(h("div", { class: "card" },
        h("label", { class: "lbl" }, "Funcionário"), nome,
        h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Total recebido (comissões)"), inp(fmtN2(l.Recebido), "", (s) => (l.Recebido = D(s)))),
          h("div", {}, h("label", { class: "lbl" }, "Comissão sobre"), rg)),
        h("label", { class: "lbl", style: { display: "flex", gap: "8px", alignItems: "center" } }, dec, "Equipe Decor"),
        h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Porcentagem (%)"), inp(fmtPct(l.Percentual), AM, (s) => (l.Percentual = D(s)))),
          h("div", {}, h("label", { class: "lbl" }, "Salário"), inp(fmtN2(l.Salario), AM, (s) => (l.Salario = D(s))))),
        h("div", { class: "sub", style: { marginTop: "8px", lineHeight: "1.6" } }, "Valor da base: ", v.base, h("br"), "Valor comissão: ", v.com, h("br"), "Salário + comissão: ", v.tot),
        rem));
    }
    recalcular();
    if (!acc.todos) { const minha = linhas.find((x) => codPermitido > 0 && x.CodVend === codPermitido); aviso.textContent = acc.aviso(minha ? codPermitido : 0, minha ? minha.Nome : ""); }
  }
  async function carregarSalvo() {
    const a = my.ano(), m = my.mes(); const salvo = await CarregarMes(a, m);
    if (salvo) { mostrar(salvo); avisar("Mostrando o que foi salvo para " + MESES[m] + "/" + a + ". Para trazer de novo do MyManager, clique em BUSCAR DO MYMANAGER."); }
    else { const l = []; AplicarConfig(l, await LerConfig()); mostrar(l); avisar("Mês ainda não salvo. Clique em BUSCAR DO MYMANAGER ou digite os valores. Porcentagem e salário (amarelo) ficam guardados para os próximos meses."); }
  }
  my.m.onchange = carregarSalvo; my.a.onchange = carregarSalvo;
  adicionar.onclick = () => { mostrar([...linhas, nova({ Nome: "NOVO FUNCIONÁRIO" })]); const ins = lista.querySelectorAll(".card"); const n = ins[ins.length - 1]?.querySelector("input"); if (n) { n.focus(); n.select(); } };
  buscar.onclick = async () => {
    const a = my.ano(), m = my.mes(), manuais = linhas.filter((x) => x.CodVend === 0);
    busy(buscar, true, "BUSCAR DO MYMANAGER"); aviso.textContent = "Buscando no MyManager...";
    try {
      const r = await lerComissoes(consultaCom(120000), a, m, 0);
      const ls = DoMyManager(r); AplicarConfig(ls, await LerConfig());
      for (const x of manuais) if (!ls.some((y) => Chave(y) === Chave(x))) ls.push(x);
      mostrar(ls); avisar(MESES[m] + "/" + a + " buscado do MyManager: recebido = TOTAL RECEBIDO da tela de comissões (à vista + entrada + crediário − devoluções), as duas empresas somadas. Confira, ajuste o que precisar e clique em SALVAR.");
    } catch (e) { alertBox(friendly(e) + "\n\nVocê pode digitar os valores manualmente.", "Relatório de Recebidos"); aviso.textContent = "Não foi possível consultar o MyManager. Nada foi alterado."; }
    finally { busy(buscar, false, "BUSCAR DO MYMANAGER"); }
  };
  salvar.onclick = async () => {
    const ls = linhas.map((l) => ({ ...l, Nome: String(l.Nome).trim() })).filter((x) => x.Nome.length > 0);
    busy(salvar, true); try { await Salvar(my.ano(), my.mes(), ls); aviso.textContent = "Salvo: " + MESES[my.mes()] + "/" + my.ano() + ". Porcentagem, salário e regras ficaram guardados para os próximos meses."; }
    catch (e) { alertBox("Não foi possível salvar: " + friendly(e), "Relatório de Recebidos"); } finally { busy(salvar, false); }
  };
  imprimir.onclick = () => {
    const ls = linhas.filter((z) => String(z.Nome).trim().length > 0); Calcular(ls); const pr = ls.filter(permitido);
    if (!linhas.length) return alertBox("Não há linhas para imprimir.", "Relatório de Recebidos");
    const w = window.open("", "_blank"); if (!w) return alertBox("O celular bloqueou a janela de impressão. Permita pop-ups para este app.");
    const e = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const pag = pr.filter(TemPagamento), sum = (f) => pag.reduce((s, l) => s + f(l), 0);
    let html = "<!doctype html><meta charset=utf-8><title>Relatório de recebidos</title><style>@page{size:portrait;margin:14mm}body{font-family:Segoe UI,Arial,sans-serif;font-size:12px}h1{font-size:18px}h2{font-size:14px;margin:22px 0 6px}table{border-collapse:collapse}th{font-size:11px;text-align:right;border-bottom:1px solid #000;padding:3px 6px}td{padding:3px 6px;text-align:right}th:first-child,td:first-child{text-align:left}tr.t td{font-weight:700;border-top:1px solid #000}footer{margin-top:20px;color:#555;font-size:10px}</style>";
    html += "<h1>RELATÓRIO DE RECEBIDOS — " + MESES[my.mes()] + "/" + my.ano() + "</h1><h2>RECEBIDOS</h2><table style='width:55%'><tr><th>FUNCIONÁRIO</th><th>RECEBIDO</th></tr>" + pr.map((l) => "<tr><td>" + e(l.Nome) + "</td><td>" + C2(l.Recebido) + "</td></tr>").join("") + "<tr class=t><td>TOTAL RECEBIDO</td><td>" + C2(Total(pr)) + "</td></tr></table>";
    if (pag.length) html += "<h2>COMISSÃO</h2><table style='width:100%'><tr><th>NOME</th><th>VALOR</th><th>PORCENTAGEM</th><th>VALOR COMISSÃO</th><th>SALÁRIO</th><th>SALÁRIO + COMISSÃO</th></tr>" + pag.map((l) => "<tr><td>" + e(l.Nome) + "</td><td>" + C2(l.Base) + "</td><td>" + fmtPct(l.Percentual) + "%</td><td>" + C2(l.Comissao) + "</td><td>" + C2(l.Salario) + "</td><td><b>" + C2(SalarioMaisComissao(l)) + "</b></td></tr>").join("") + "<tr class=t><td>TOTAL</td><td></td><td></td><td>" + C2(sum((l) => l.Comissao)) + "</td><td>" + C2(sum((l) => l.Salario)) + "</td><td>" + C2(sum(SalarioMaisComissao)) + "</td></tr></table>";
    html += "<footer>Sistema São João — impresso em " + new Date().toLocaleString("pt-BR") + "</footer><script>setTimeout(()=>print(),300)<\/script>";
    w.document.write(html); w.document.close();
  };
  carregarSalvo();
});
