// Vendas pendentes: VendasPendentes.cs + VendasPendentesMain.cs + SjVendasPendentesForm.cs.
// Vendas faturadas do MyManager (somente leitura) + etapa e o que falta gravados na auditoria (ação VENDA_PENDENTE),
// o mesmo registro que o computador lê e grava.
import { h, alertBox, confirmBox, friendly, modal, toast } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { consultaCom } from "../mym.js";
import { page, acesso, normalizar, C2 } from "./base.js";
import { precos } from "../precos.js";

export const Acao = "VENDA_PENDENTE", Entidade = "VENDA_PENDENTE", Titulo = "Vendas pendentes";
export const PrefixoMyManager = "MYM:", PrefixoManual = "VP:", PrefixoLista = "VP:LISTA-", PrefixoListaAntiga = "VP:INICIAL-", OrigemLista = "LISTA";
export const Inicio = new Date(2026, 10, 6);
export const EtapaNova = "NOVA - A DEFINIR";
export const Etapas = [EtapaNova, "AGUARDANDO MATERIAL", "AGUARDANDO ORDEM DE COSTURA", "EM CONFECÇÃO", "AJUSTE / CONSERTO", "AGUARDANDO CLIENTE", "PRONTO PARA INSTALAR", "INSTALAÇÃO AGENDADA"];
export const Sugestoes = ["Falta chegar produto", "Falta chegar lona", "Falta chegar tecido", "Falta ordem de costura", "Ordem de costura OK - em confecção", "Falta confirmar sanca", "Falta consertar costura", "Falta pintura", "Falta agendar instalação"];
const TipoDevolucao = 6;
const up = (s) => String(s ?? "").toUpperCase();
const eqIC = (a, b) => up(a) === up(b);
const startsIC = (s, p) => up(s).startsWith(up(p));
export function EtapaAtual(e) {
  const s = up(String(e ?? "").trim());
  switch (s) { case "": case "ATIVO": return EtapaNova; case "AGUARDANDO PRODUÇÃO": return "AGUARDANDO ORDEM DE COSTURA"; case "EM PRODUÇÃO": return "EM CONFECÇÃO"; case "PRONTO": return "PRONTO PARA INSTALAR"; case "AGENDADO": case "EM INSTALAÇÃO": return "INSTALAÇÃO AGENDADA"; case "PAUSADO": return "AGUARDANDO CLIENTE"; }
  return s;
}
const Corta = (s, n) => { s = String(s ?? "").trim(); return s.length > n ? s.slice(0, n) : s; };
const isoD = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const inv2 = (v) => String(Math.round(Number(v) * 100) / 100);
export function Detalhes(r) {
  const d = { u: Corta(r.Unidade, 20), ped: Corta(r.Pedido, 40), cli: Corta(r.Cliente, 160), prod: Corta(r.Produto, 200), vend: Corta(r.Vendedor, 80), dv: r.DataVenda ? isoD(r.DataVenda) : "", val: inv2(r.Valor || 0), et: Corta(r.Etapa, 40), fal: Corta(r.Falta, 600), fin: r.Finalizada ? 1 : 0 };
  if (r.Origem) d.orig = Corta(r.Origem, 10);
  return JSON.stringify(d);
}
const novoReg = (o = {}) => ({ Chave: "", Unidade: "", Pedido: "", Cliente: "", Produto: "", Vendedor: "", Etapa: "", Falta: "", Origem: "", Usuario: "", Computador: "", DataVenda: null, Valor: 0, Finalizada: false, Quando: new Date(), ...o });
export function Ler(chave, detalhes) {
  if (!String(chave ?? "").trim() || !String(detalhes ?? "").trim()) return null;
  let d; try { d = JSON.parse(detalhes); } catch { return null; } if (!d || typeof d !== "object") return null;
  const v = (k) => (d[k] != null ? String(d[k]).trim() : "");
  const r = novoReg({ Chave: chave.trim(), Unidade: v("u"), Pedido: v("ped"), Cliente: v("cli"), Produto: v("prod"), Vendedor: v("vend"), Etapa: v("et"), Falta: v("fal"), Origem: v("orig"), Finalizada: v("fin") === "1" || v("fin").toLowerCase() === "true" });
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v("dv")); if (m) r.DataVenda = new Date(+m[1], +m[2] - 1, +m[3]);
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(v("val"))) r.Valor = Number(v("val"));
  return r;
}
function Ordenados(regs, unidade) {
  return (regs || []).map((x, i) => [x, i]).filter(([x]) => x && x.Chave.length > 0 && (!String(unidade ?? "").trim() || eqIC(x.Unidade, unidade))).sort((a, b) => a[0].Quando - b[0].Quando || a[1] - b[1]).map(([x]) => x);
}
export function Ultimos(regs, unidade) { const r = new Map(); for (const x of Ordenados(regs, unidade)) r.set(up(x.Chave), x); return r; }
export const Historico = (regs, unidade, chave) => Ordenados(regs, unidade).filter((x) => eqIC(x.Chave, chave)).reverse();
const intOk = (s) => /^\s*[-+]?\d+\s*$/.test(String(s ?? "")) ? Number(s) : null;
export function PdvsReferenciados(regs, unidade) {
  const s = new Set();
  for (const r of Ultimos(regs, unidade).values()) { if (r.Finalizada) continue; let n; if (startsIC(r.Chave, PrefixoMyManager) && (n = intOk(r.Chave.slice(PrefixoMyManager.length))) != null) s.add(n); else if ((n = intOk(r.Pedido)) != null) s.add(n); }
  return [...s].sort((a, b) => a - b);
}
const novaVP = (o = {}) => ({ Chave: "", Pedido: "", Cliente: "", Produto: "", Vendedor: "", Etapa: "", Falta: "", AtualizadoPor: "", DataVenda: null, AtualizadoEm: null, Valor: 0, Manual: false, DoMyManager: false, Itens: [], ...o });
export const Dias = (v, hoje) => { if (!v.DataVenda) return -1; const a = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), b = new Date(v.DataVenda.getFullYear(), v.DataVenda.getMonth(), v.DataVenda.getDate()); return Math.max(0, Math.round((a - b) / 86400000)); };
function Linha(chave, r, s) {
  const v = novaVP({ Chave: chave, Etapa: EtapaAtual(r ? r.Etapa : ""), Falta: r ? r.Falta : "", AtualizadoPor: r ? r.Usuario : "", AtualizadoEm: r ? r.Quando : null });
  if (r) Object.assign(v, { Cliente: r.Cliente, Produto: r.Produto, Vendedor: r.Vendedor, DataVenda: r.DataVenda, Valor: r.Valor });
  if (s) { v.DoMyManager = true; v.Vendedor = s.Vendedor; v.DataVenda = s.Data; v.Valor = s.Total; v.Itens = [...s.Itens]; if (!v.Cliente.length) v.Cliente = s.Cliente; if (!v.Produto.length) v.Produto = s.Itens.join(", "); }
  return v;
}
export function Montar(vendas, regs, unidade, inicio) {
  const ult = Ultimos(regs, unidade), mym = new Map(); for (const v of vendas || []) if (v && v.Cod > 0) mym.set(v.Cod, v);
  const lista = [], ligados = new Set();
  for (const r of [...ult.values()].filter((x) => startsIC(x.Chave, PrefixoManual))) {
    if (startsIC(r.Chave, PrefixoListaAntiga)) continue;
    let s = null; const pdv = intOk(r.Pedido); if (pdv != null) { ligados.add(pdv); s = mym.get(pdv) || null; }
    if (r.Finalizada) continue;
    const v = Linha(r.Chave, r, s); v.Manual = true; v.Pedido = r.Pedido; lista.push(v);
  }
  const chaves = new Map(); for (const k of mym.keys()) chaves.set(up(PrefixoMyManager + k), PrefixoMyManager + k);
  for (const r of [...ult.values()].filter((x) => startsIC(x.Chave, PrefixoMyManager))) if (!chaves.has(up(r.Chave))) chaves.set(up(r.Chave), r.Chave);
  const ini = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  for (const k of chaves.values()) {
    const cod = intOk(k.slice(PrefixoMyManager.length)); if (cod == null || ligados.has(cod)) continue;
    const s = mym.get(cod) || null, r = ult.get(up(k)) || null; if (r && r.Finalizada) continue;
    const nova = s && s.DaUnidade && s.Data && s.Data >= ini; if (!nova && !r) continue;
    const v = Linha(k, r, s); v.Pedido = String(cod); if (!v.Cliente.length) v.Cliente = "PDV " + v.Pedido; lista.push(v);
  }
  return lista.sort((a, b) => (a.DataVenda ? 0 : 1) - (b.DataVenda ? 0 : 1) || (a.DataVenda && b.DataVenda ? a.DataVenda - b.DataVenda : 0) || (up(a.Chave) < up(b.Chave) ? -1 : up(a.Chave) > up(b.Chave) ? 1 : 0));
}
export function DoUsuario(v, acc) {
  if (!acc || acc.todos) return true;
  const u = normalizar(acc.usuario), vv = normalizar(v.Vendedor); if (!u.length || !vv.length) return false;
  return u === vv || u.split(" ")[0] === vv.split(" ")[0];
}
export function Resumo(lista) {
  if (!lista || !lista.length) return "Nenhuma venda pendente.";
  const g = new Map(); for (const x of lista) { const k = !String(x.Etapa ?? "").trim() ? EtapaNova : up(x.Etapa); g.set(k, (g.get(k) || 0) + 1); }
  const partes = [...g].sort((a, b) => b[1] - a[1]).map(([k, n]) => n + " " + k.toLowerCase());
  return lista.length + (lista.length === 1 ? " venda pendente" : " vendas pendentes") + ": " + partes.join(", ") + ".";
}
export function SqlVendas(desde, pdvs, busca, buscaDesde) {
  const cond = ["V.DATA_VEN>='" + isoD(desde) + "'"], p = [...new Set((pdvs || []).filter((x) => x > 0))];
  for (let i = 0; i < p.length; i += 500) cond.push("V.COD_VEN IN (" + p.slice(i, i + 500).join(",") + ")");
  const b = [...new Set((busca || []).filter((x) => String(x ?? "").trim()))];
  if (b.length) cond.push("(V.DATA_VEN>='" + isoD(buscaDesde) + "' AND (" + b.map((x) => "C.NOME_CLI CONTAINING '" + x.replace(/'/g, "''") + "'").join(" OR ") + "))");
  return "SELECT V.COD_VEN SJP_VEN, V.COD_EMP SJP_EMP, V.COD_VEND SJP_VEND, V.DATA_VEN SJP_DATA, TRIM(VD.NOME_VEND) SJP_VNOME, TRIM(C.NOME_CLI) SJP_CLI, V.TOTAL_VEN SJP_TOTAL, TRIM(P.NOME_PRO) SJP_PROD, I.QUANT SJP_QTD" +
    " FROM VENDAS V LEFT JOIN VENDEDOR VD ON VD.COD_VEND=V.COD_VEND LEFT JOIN CLIENTE C ON C.COD_CLI=V.COD_CLI" +
    " LEFT JOIN ITENS_VENDA I ON I.COD_VEN=V.COD_VEN AND COALESCE(I.CANCELADO,0)=0 LEFT JOIN PRODUTO P ON P.COD_PRO=I.COD_PRO" +
    " WHERE V.FLAGFATURADO='S' AND V.CANCELADA_VEN=0 AND V.COD_TPV<>" + TipoDevolucao + " AND (" + cond.join(" OR ") + ") ORDER BY V.COD_VEN;";
}
const MESES_ISQL = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function dataIsql(v) {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(v); if (m && MESES_ISQL[m[2].toUpperCase()] != null) return new Date(+m[3], MESES_ISQL[m[2].toUpperCase()], +m[1]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v); if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  return null;
}
export function LerVendas(saida, daUnidade) {
  const map = new Map(), ordem = []; let cur = null;
  for (const raw of String(saida ?? "").replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); if (!l) continue; let i = 0; while (i < l.length && !/\s/.test(l[i])) i++;
    const k = l.slice(0, i).toUpperCase(); let v = l.slice(i).trim(); if (v === "<null>") v = ""; if (!k.startsWith("SJP_")) continue;
    if (k === "SJP_VEN") { const c = intOk(v); if (c == null) { cur = null; continue; } cur = map.get(c); if (!cur) { cur = { Cod: c, Emp: 0, CodVend: 0, Data: null, Vendedor: "", Cliente: "", Total: 0, DaUnidade: false, Itens: [] }; map.set(c, cur); ordem.push(cur); } continue; }
    if (!cur) continue;
    switch (k) {
      case "SJP_EMP": cur.Emp = intOk(v) ?? 0; break;
      case "SJP_VEND": cur.CodVend = intOk(v) ?? 0; break;
      case "SJP_DATA": { const d = dataIsql(v); if (d) cur.Data = d; break; }
      case "SJP_VNOME": cur.Vendedor = v; break;
      case "SJP_CLI": cur.Cliente = v; break;
      case "SJP_TOTAL": if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(v.replace(/,/g, ""))) cur.Total = Number(v.replace(/,/g, "")); break;
      case "SJP_PROD": if (v.length && !cur.Itens.includes(v)) cur.Itens.push(v); break;
    }
  }
  for (const x of ordem) x.DaUnidade = !daUnidade || daUnidade(x.Emp, x.CodVend);
  return ordem;
}
const ListaInicial = [
  ["LORENA MARQUES PENA", "Confecção cortina", "EM CONFECÇÃO", "Ordem de costura OK - em confecção", ["CORTINA", "TECIDO", "COSTURA"]],
  ["MARLENA ALVIM SANTOS", "Toldos", "AGUARDANDO MATERIAL", "Falta chegar lona", ["TOLDO", "LONA"]],
  ["VANIA MARRA FARIA DIAS", "Confecção cortina", "AJUSTE / CONSERTO", "Falta consertar costura", ["CORTINA", "TECIDO", "COSTURA"]],
  ["VANIA MARRA FARIA DIAS", "Toldos", "AGUARDANDO MATERIAL", "Falta chegar lona", ["TOLDO", "LONA"]],
  ["MARIA MALFA MACHADO", "Confecção cortina", "AGUARDANDO ORDEM DE COSTURA", "Falta confirmar sanca para a ordem de costura", ["CORTINA", "TECIDO", "COSTURA"]],
  ["LABORATORIO EFICACIA LTDA ME", "Cortina rolo", "AGUARDANDO MATERIAL", "Falta chegar produto", ["ROLO"]],
  ["HOTEL DONA ADELIA", "Persiana vertical", "AGUARDANDO MATERIAL", "Falta chegar produto", ["VERTICAL", "PERSIANA"]],
  ["CARLA APARECIDA CORREA DIAS", "Confecção cortina", "AGUARDANDO MATERIAL", "Falta chegar produto", ["CORTINA", "TECIDO", "COSTURA"]],
  ["TONY FRANCO PEREIRA GONÇALVES", "Troca de lona do toldo retrátil", "AGUARDANDO MATERIAL", "Falta chegar lona - pintura", ["TOLDO", "LONA"]],
  ["TIAGO MARQUES ARAUJO", "Confecção cortina", "AGUARDANDO ORDEM DE COSTURA", "Falta ordem de costura", ["CORTINA", "TECIDO", "COSTURA"]],
].map(([Cliente, Produto, Etapa, Falta, Palavras]) => ({ Cliente, Produto, Etapa, Falta, Palavras }));
export function PrecisaCargaInicial(regs, unidade) {
  if (!eqIC(unidade, "DECOR")) return false;
  return !regs || !regs.some((r) => r && (startsIC(r.Chave, PrefixoLista) || eqIC(r.Origem, OrigemLista)));
}
export function PalavrasBuscaInicial() {
  const r = [];
  for (const i of ListaInicial) for (const w of i.Cliente.split(" ").filter((x) => x.length >= 5 && /^[A-Z]+$/.test(x)).map((x, idx) => [x, idx]).sort((a, b) => b[0].length - a[0].length || a[1] - b[1]).slice(0, 2).map(([x]) => x)) if (!r.includes(w)) r.push(w);
  return r;
}
const MesmoCliente = (a, b) => { a = normalizar(a); b = normalizar(b); if (!a.length || !b.length) return false; return a === b || a.startsWith(b + " ") || b.startsWith(a + " "); };
export function CargaInicial(vendas, usuario) {
  const todas = (vendas || []).filter((v) => v && v.Cod > 0), r = []; let n = 0;
  for (const i of ListaInicial) {
    n++; let c = todas.filter((v) => MesmoCliente(v.Cliente, i.Cliente));
    if (c.some((v) => v.DaUnidade)) c = c.filter((v) => v.DaUnidade);
    const pp = c.filter((v) => i.Palavras.some((w) => normalizar(v.Itens.join(", ")).includes(w))); if (pp.length) c = pp;
    const s = [...c].sort((a, b) => (b.Data ? b.Data.getTime() : -8.64e15) - (a.Data ? a.Data.getTime() : -8.64e15) || b.Cod - a.Cod)[0] || null;
    r.push(novoReg({ Chave: PrefixoLista + String(n).padStart(2, "0"), Unidade: "DECOR", Origem: OrigemLista, Pedido: s ? String(s.Cod) : "", Cliente: i.Cliente, Produto: i.Produto, Vendedor: s ? s.Vendedor : "", DataVenda: s ? s.Data : null, Valor: s ? s.Total : 0, Etapa: i.Etapa, Falta: i.Falta, Usuario: usuario || "", Quando: new Date() }));
  }
  return r;
}
const p2 = (n) => String(n).padStart(2, "0");
export const NovaChave = () => { const d = new Date(); return PrefixoManual + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + "-" + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(16).slice(2) + "000000").slice(0, 6).toUpperCase(); };
export const Registro = (v, unidade) => novoReg({ Chave: v.Chave, Unidade: unidade, Pedido: v.Manual ? v.Pedido : "", Cliente: v.Cliente, Produto: v.Produto, Vendedor: v.Vendedor, Etapa: v.Etapa, Falta: v.Falta, DataVenda: v.DataVenda, Valor: v.Valor, Origem: startsIC(v.Chave, PrefixoLista) ? OrigemLista : "", Quando: new Date() });

// ---------- Fonte (VendasPendentesMain) ----------
export async function pertenceUnidade() {
  const code = ctx.unit.code;
  if (code === "PERSONALIZADOS") return (emp, vend) => vend === 38;
  if (code === "FA_COLCHOES") {
    let company = 0, sellers = new Set();
    try { const p = await precos(ctx.unit).ensureFresh(); for (const r of p.rowsOfGroup("FA COLCHÕES VENDAS")) if (eqIC(r.i, "Vendedores MyManager")) { company = Math.trunc(Number(String(r.raw1 ?? r.v1).replace(",", ".")) || 0); for (const t of String(r.info ?? "").split(/[;, ]/)) { const n = intOk(t.trim()); if (n > 0) sellers.add(n); } break; } } catch {}
    return (emp, vend) => sellers.size > 0 && !(company > 0 && emp !== company) && sellers.has(vend);
  }
  return (emp, vend) => emp === 1 && (vend === 2 || vend === 36);
}
export async function Registros() {
  const a = await api.fetchAuditByAction(Acao, 5000), lista = [];
  for (const r of a) { const x = Ler(r.EntidadeId, r.Detalhes); if (!x) continue; const d = new Date(r.DataHora); x.Quando = isNaN(d) ? new Date(-8.64e15) : d; x.Usuario = r.UsuarioNome || ""; x.Computador = r.Computador || ""; lista.push(x); }
  return lista.reverse();
}
export async function Gravar(r) {
  if (!String(r.Unidade ?? "").trim()) r.Unidade = ctx.unit.code;
  await api.insertAudit(ctx.session.legacyId, ctx.session.nome, Acao, Entidade, r.Chave, Detalhes(r), ctx.station);
}

// ---------- Tela ----------
export const CorEtapa = (e) => ({ "AGUARDANDO MATERIAL": "#d97706", "AGUARDANDO ORDEM DE COSTURA": "#7c3aed", "EM CONFECÇÃO": "#2563eb", "AJUSTE / CONSERTO": "#dc2626", "AGUARDANDO CLIENTE": "#475569", "PRONTO PARA INSTALAR": "#16a34a", "INSTALAÇÃO AGENDADA": "#0d9488" })[up(e)] || "#6b7280";
const brD = (d) => (d ? p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() : "—");
const NomeVendedor = (v) => (!String(v ?? "").trim() ? "(sem vendedor)" : up(String(v).trim()));
const Primeiro = (n) => { n = String(n ?? "").trim(); const p = n.indexOf(" "); return p > 0 ? n.slice(0, p) : n; };
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

register("rel/vendas-pendentes", (el) => {
  const unidade = ctx.unit.code, nomeUnidade = ctx.unit.short || ctx.unit.name, acc = acesso(ctx.session.nome);
  page(el, Titulo + " — " + nomeUnidade, "Vendas faturadas no MyManager que ainda não foram entregues. O pedido é o número do PDV.");
  const busca = h("input", { class: "input", placeholder: "Buscar cliente, PDV, produto..." }), vendedor = h("select", { class: "select", disabled: !acc.todos }, h("option", { value: "" }, "Todos os vendedores"));
  const adicionar = h("button", { class: "btn primary" }, "+ ADICIONAR VENDA"), atualizar = h("button", { class: "btn" }, "ATUALIZAR"), imprimir = h("button", { class: "btn" }, "IMPRIMIR"), exportar = h("button", { class: "btn" }, "EXPORTAR CSV");
  el.append(h("div", { class: "card" }, busca, h("div", { style: { marginTop: "8px" } }, vendedor), h("div", { class: "btns grid2", style: { marginTop: "8px" } }, adicionar, atualizar, imprimir, exportar)));
  const etapasBar = h("div", { style: { display: "flex", gap: "8px", overflowX: "auto", padding: "8px 0" } }), resumo = h("div", { style: { fontWeight: "700", color: "#082d4e", margin: "4px 0 8px" } }, "Carregando...");
  const lista = h("div", {}), aviso = h("div", { class: "sub", style: { color: "#5a5e64", margin: "10px 0", lineHeight: "1.45" } }, "Entram sozinhas as vendas faturadas a partir de " + brD(Inicio) + ". Saem ao clicar em FINALIZAR. Vendedor, data, valor e itens vêm do MyManager (só leitura).");
  el.append(etapasBar, resumo, lista, aviso);
  let todas = [], vistas = [], registros = [], etapaSel = "", carregando = false;
  const ocupado = (s) => { carregando = s; for (const b of [atualizar, adicionar, imprimir, exportar]) b.disabled = s; };
  async function carregar(escolher) {
    if (carregando) return; ocupado(true); resumo.textContent = "Carregando as vendas pendentes e consultando o MyManager...";
    let erroMym = null, carga = 0, cargaSemPdv = 0;
    try {
      const regs = await Registros(); const precisa = regs.length < 4500 && PrecisaCargaInicial(regs, unidade); let vendas = [];
      try { const dono = await pertenceUnidade(); const b = new Date(Inicio); b.setMonth(b.getMonth() - 12); vendas = LerVendas(await consultaCom(120000)(SqlVendas(Inicio, PdvsReferenciados(regs, unidade), precisa ? PalavrasBuscaInicial() : null, b)), dono); }
      catch (e) { erroMym = e; }
      if (precisa && !erroMym) for (const r of CargaInicial(vendas, ctx.session.nome)) { await Gravar(r); regs.push(r); carga++; if (!r.Pedido.length) cargaSemPdv++; }
      const l = Montar(vendas, regs, unidade, Inicio);
      registros = regs; todas = l.filter((v) => DoUsuario(v, acc));
      const sel = vendedor.value; vendedor.innerHTML = ""; vendedor.append(h("option", { value: "" }, "Todos os vendedores"));
      const nomes = [...new Map(todas.map((v) => [up(NomeVendedor(v.Vendedor)), NomeVendedor(v.Vendedor)])).values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      for (const n of nomes) vendedor.append(h("option", { value: n, selected: n === sel }, n));
      filtrar(escolher);
      if (erroMym) { aviso.style.color = "#b91c1c"; aviso.textContent = "MyManager não respondeu (" + friendly(erroMym).replace(/[\r\n]/g, " ") + "). Mostrando o que está gravado; vendas novas aparecem quando ele voltar."; }
      else aviso.style.color = "#5a5e64";
      if (carga > 0) alertBox("A sua lista inicial de " + carga + " vendas pendentes foi cadastrada" + (cargaSemPdv > 0 ? ".\n\n" + cargaSemPdv + " cliente(s) não foram achados no MyManager: escolha a venda e escreva o número do PDV." : ", cada uma ligada ao PDV do MyManager."), Titulo);
    } catch (e) { resumo.textContent = "Não foi possível carregar as vendas pendentes."; alertBox(friendly(e), Titulo); }
    finally { ocupado(false); }
  }
  function montarEtapas(base) {
    etapasBar.innerHTML = "";
    const chip = (chave, titulo, n, cor) => { const ativo = etapaSel === chave; etapasBar.append(h("button", { style: { flex: "0 0 auto", border: (ativo ? 2 : 1) + "px solid " + cor, background: ativo ? cor : cor + "1f", color: ativo ? "#fff" : cor, borderRadius: "10px", padding: "6px 12px", fontWeight: "700", fontSize: "11px", lineHeight: "1.3" }, onclick: () => { etapaSel = etapaSel === chave ? "" : chave; filtrar(); } }, String(n), h("br"), titulo)); };
    chip("", "TODAS", base.length, "#082d4e");
    for (const e of Etapas) { const n = base.filter((v) => eqIC(v.Etapa, e)).length; if (n > 0 || etapaSel === e) chip(e, e, n, CorEtapa(e)); }
  }
  function filtrar(escolher) {
    const q = normalizar(busca.value), vs = vendedor.value;
    const base = todas.filter((v) => (!vs || eqIC(NomeVendedor(v.Vendedor), vs)) && (!q.length || normalizar(v.Cliente + " " + v.Produto + " " + v.Falta + " " + v.Pedido + " " + v.Vendedor + " " + v.Itens.join(" ")).includes(q)));
    montarEtapas(base); vistas = base.filter((v) => !etapaSel.length || eqIC(v.Etapa, etapaSel));
    resumo.textContent = Resumo(vistas) + (vistas.length !== todas.length ? "  (de " + todas.length + " no total)" : "");
    lista.innerHTML = ""; const hoje = new Date();
    for (const v of vistas) {
      const d = Dias(v, hoje), cor = CorEtapa(v.Etapa);
      const it = h("div", { class: "card", style: { borderLeft: "5px solid " + cor, cursor: "pointer" }, onclick: () => abrir(v) },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px" } }, h("b", { style: { color: v.Pedido.length ? "#111827" : "#9ca3af" } }, "PDV " + (v.Pedido.length ? v.Pedido : "sem PDV")), h("span", { style: { color: d > 30 ? "#b91c1c" : "#4b5563", fontWeight: d > 30 ? "700" : "" } }, brD(v.DataVenda) + (d >= 0 ? " · " + d + " dias" : ""))),
        h("div", { style: { fontWeight: "700", color: "#082d4e", marginTop: "4px" } }, v.Cliente), h("div", { class: "sub" }, v.Produto),
        h("div", { class: "sub" }, "Vendedor: " + (String(v.Vendedor ?? "").trim() ? v.Vendedor : "—")),
        h("div", { style: { marginTop: "6px" } }, h("span", { style: { background: cor + "26", color: cor, fontWeight: "700", fontSize: "11px", padding: "3px 8px", borderRadius: "8px" } }, v.Etapa), v.Falta ? h("span", { class: "sub", style: { marginLeft: "6px" } }, v.Falta) : null));
      lista.append(it);
      if (escolher && v.Chave === escolher) setTimeout(() => it.scrollIntoView({ block: "center" }), 50);
    }
  }
  busca.oninput = () => filtrar(); vendedor.onchange = () => filtrar();
  const copia = (v) => ({ ...v, Itens: v.Itens });
  async function salvar(v, ok) {
    try { await Gravar(Registro(v, unidade)); } catch (e) { alertBox("Nada foi gravado.\n\n" + friendly(e), Titulo); return false; }
    aviso.style.color = "#16803d"; aviso.textContent = ok + " (" + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ")"; carregar(v.Chave); return true;
  }
  function abrir(v) {
    modal(v.Cliente, ({ body, foot, close }) => {
      const hoje = new Date(), d = Dias(v, hoje), ro = (t, val) => h("div", {}, h("div", { class: "lbl", style: { textTransform: "uppercase", fontSize: "10px" } }, t), h("div", { style: { fontWeight: "700" } }, val));
      const et = h("select", { class: "select" }, ...[...new Set([...Etapas, ...(String(v.Etapa ?? "").trim() && !Etapas.includes(v.Etapa) ? [v.Etapa] : [])])].map((e) => h("option", { value: e, selected: e === (String(v.Etapa ?? "").trim() ? v.Etapa : EtapaNova) }, e)));
      const dl = "sug" + Math.random().toString(36).slice(2), fal = h("input", { class: "input", value: v.Falta, list: dl }), datalist = h("datalist", { id: dl }, ...Sugestoes.map((s) => h("option", { value: s })));
      const pdv = h("input", { class: "input", value: v.Pedido, inputmode: "numeric" });
      const hist = Historico(registros, unidade, v.Chave).map((r) => r.Quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + r.Quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "  " + Primeiro(r.Usuario) + ": " + (r.Finalizada ? "FINALIZADA" : EtapaAtual(r.Etapa)) + (String(r.Falta ?? "").trim() ? " — " + r.Falta : "")).join("\n");
      body.append(h("div", { class: "sub", style: { marginBottom: "8px" } }, v.Produto),
        h("div", { class: "row2" }, ro("Pedido (PDV)", v.Pedido.length ? v.Pedido : "sem PDV"), ro("Faturada em", v.DataVenda ? brD(v.DataVenda) + (d >= 0 ? "  (" + d + " dias)" : "") : "—")),
        h("div", { class: "row2", style: { marginTop: "8px" } }, ro("Vendedor", String(v.Vendedor ?? "").trim() ? v.Vendedor : "—"), ro("Valor", v.Valor > 0 ? C2(v.Valor) : "—")),
        h("label", { class: "lbl" }, "Itens no MyManager"), h("div", { class: "resumo", style: { whiteSpace: "pre-line" } }, v.Itens.length ? v.Itens.join("\n") : v.Pedido.length && !v.DoMyManager ? "(MyManager não respondeu)" : "(sem PDV ligado)"),
        h("label", { class: "lbl" }, "Etapa (em que processo está)"), et, h("label", { class: "lbl" }, "O que falta (escolha ou escreva)"), fal, datalist,
        v.Manual ? h("div", {}, h("label", { class: "lbl" }, "PDV no MyManager (venda lançada à mão)"), pdv) : null,
        h("label", { class: "lbl" }, "Histórico"), h("div", { class: "resumo", style: { whiteSpace: "pre-line", fontSize: "12px" } }, hist || "Entrou sozinha do MyManager. Ainda sem anotações."));
      const bS = h("button", { class: "btn dark" }, "SALVAR"), bF = h("button", { class: "btn green" }, "✓ FINALIZAR / ENTREGUE");
      foot.append(h("button", { class: "btn", onclick: () => close() }, "FECHAR"), bS, bF);
      bS.onclick = async () => {
        const c = copia(v); c.Etapa = et.value; c.Falta = fal.value.trim();
        if (v.Manual) { const p = pdv.value.trim(); if (p.length && intOk(p) == null) return alertBox("O número do PDV deve ter só números.", Titulo); c.Pedido = p; }
        bS.disabled = true; if (await salvar(c, "Venda de " + v.Cliente + " atualizada.")) close(); else bS.disabled = false;
      };
      bF.onclick = async () => {
        if (!(await confirmBox("Finalizar a venda de " + v.Cliente + (v.Pedido.length ? " (PDV " + v.Pedido + ")" : "") + "?\n\nEla sai deste relatório. O MyManager não é alterado.", Titulo))) return;
        const r = Registro(v, unidade); r.Finalizada = true;
        try { await Gravar(r); } catch (e) { return alertBox("Nada foi gravado.\n\n" + friendly(e), Titulo); }
        close(); aviso.style.color = "#16803d"; aviso.textContent = "Venda de " + v.Cliente + " finalizada às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "."; carregar();
      };
    }, { wide: true });
  }
  adicionar.onclick = () => modal("Adicionar venda pendente", ({ body, foot, close }) => {
    const pdv = h("input", { class: "input", inputmode: "numeric" }), cli = h("input", { class: "input", style: { textTransform: "uppercase" } }), prod = h("input", { class: "input" });
    const et = h("select", { class: "select" }, ...Etapas.map((e) => h("option", { value: e, selected: e === "AGUARDANDO MATERIAL" }, e)));
    const dl = "sugA", fal = h("input", { class: "input", list: dl });
    body.append(h("label", { class: "lbl" }, "Número do PDV no MyManager (cliente, vendedor e data vêm de lá)"), pdv, h("div", { class: "sub", style: { fontStyle: "italic", marginTop: "8px" } }, "Sem PDV? Preencha o cliente e o produto:"),
      h("label", { class: "lbl" }, "Cliente"), cli, h("label", { class: "lbl" }, "Produto / serviço"), prod, h("label", { class: "lbl" }, "Etapa"), et, h("label", { class: "lbl" }, "O que falta"), fal, h("datalist", { id: dl }, ...Sugestoes.map((s) => h("option", { value: s }))));
    const ok = h("button", { class: "btn dark" }, "SALVAR"); foot.append(h("button", { class: "btn", onclick: () => close() }, "CANCELAR"), ok);
    ok.onclick = async () => {
      const p = pdv.value.trim();
      if (p.length && intOk(p) == null) return alertBox("O número do PDV deve ter só números.", "Adicionar venda pendente");
      if (!p.length && (!cli.value.trim() || !prod.value.trim())) return alertBox("Informe o número do PDV, ou o cliente e o produto.", "Adicionar venda pendente");
      const t = new Date(); let v;
      if (p.length) v = novaVP({ Chave: PrefixoMyManager + p, Pedido: p });
      else v = novaVP({ Chave: NovaChave(), Manual: true, DataVenda: new Date(t.getFullYear(), t.getMonth(), t.getDate()), Vendedor: acc.todos ? "" : up(String(acc.usuario ?? "").trim()) });
      v.Cliente = up(cli.value.trim()); v.Produto = prod.value.trim(); v.Etapa = et.value; v.Falta = fal.value.trim();
      ok.disabled = true; if (await salvar(v, "Venda adicionada.")) close(); else ok.disabled = false;
    };
  });
  atualizar.onclick = () => carregar();
  exportar.onclick = () => {
    const hoje = new Date(), c = (s) => String(s ?? "").replace(/;/g, ",").replace(/[\r\n]/g, " ");
    let s = Titulo + " em " + brD(hoje) + "\r\nPDV;Faturada em;Dias;Cliente;Produto / serviço;Vendedor;Valor;Etapa;O que falta\r\n";
    for (const v of vistas) { const d = Dias(v, hoje); s += [c(v.Pedido), v.DataVenda ? brD(v.DataVenda) : "", d < 0 ? "" : d, c(v.Cliente), c(v.Produto), c(v.Vendedor), Number(v.Valor).toFixed(2).replace(".", ","), c(v.Etapa), c(v.Falta)].join(";") + "\r\n"; }
    const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + s], { type: "text/csv;charset=utf-8" })), download: "Vendas_pendentes_" + isoD(hoje) + ".csv" }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 2000);
  };
  imprimir.onclick = () => {
    const l = [...vistas]; if (!l.length) return alertBox("Não há vendas na lista para imprimir.", Titulo);
    const filtro = (!vendedor.value ? "todos os vendedores" : "vendedor " + vendedor.value) + (etapaSel.length ? " · " + etapaSel : ""), hoje = new Date();
    const oe = (e) => { const i = Etapas.indexOf(up(e)); return i < 0 ? 99 : i; }, ge = (v) => (!String(v.Etapa ?? "").trim() ? EtapaNova : up(v.Etapa));
    const ordem = l.map((v, i) => [v, i]).sort((a, b) => oe(a[0].Etapa) - oe(b[0].Etapa) || (a[0].DataVenda ? 0 : 1) - (b[0].DataVenda ? 0 : 1) || (a[0].DataVenda && b[0].DataVenda ? a[0].DataVenda - b[0].DataVenda : 0) || a[1] - b[1]).map(([v]) => v);
    const dd = (d) => (d ? p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(2) : "—");
    let corpo = "<p style='color:#666'>" + esc(brD(hoje) + " · " + filtro + " · " + Resumo(l)) + "</p><table><tr><th>PDV</th><th>FATURADA</th><th>DIAS</th><th>CLIENTE</th><th>PRODUTO / SERVIÇO</th><th>VENDEDOR</th><th>O QUE FALTA</th></tr>", grupo = null;
    for (const v of ordem) { const g = ge(v); if (g !== grupo) { corpo += "<tr><td colspan=7 style='padding-top:8px;font-weight:700;color:" + CorEtapa(g) + "'>" + esc(g) + " (" + ordem.filter((o) => ge(o) === g).length + ")</td></tr>"; grupo = g; } const d = Dias(v, hoje); corpo += "<tr style='border-bottom:1px solid #ddd'><td>" + esc(v.Pedido.length ? v.Pedido : "—") + "</td><td>" + dd(v.DataVenda) + "</td><td>" + (d < 0 ? "" : d) + "</td><td>" + esc(v.Cliente) + "</td><td>" + esc(v.Produto) + "</td><td>" + esc(v.Vendedor) + "</td><td>" + esc(v.Falta) + "</td></tr>"; }
    corpo += "</table>";
    const w = window.open("", "_blank"); if (!w) return alertBox("O celular bloqueou a janela de impressão. Permita pop-ups para este app.");
    w.document.write("<!doctype html><meta charset=utf-8><title>" + Titulo + "</title><style>@page{size:landscape;margin:10mm}body{font-family:Segoe UI,Arial,sans-serif;font-size:10.5px}h1{font-size:15px}table{border-collapse:collapse;width:100%}th{text-align:left;border-bottom:1px solid #000;padding:3px}td{padding:3px;vertical-align:top}footer{margin-top:12px;color:#555}</style><h1>São João — " + Titulo + " — " + esc(nomeUnidade) + "</h1>" + corpo + "<footer>Sistema São João — impresso em " + new Date().toLocaleString("pt-BR") + "</footer><script>setTimeout(()=>print(),300)<\/script>"); w.document.close();
  };
  carregar();
});
