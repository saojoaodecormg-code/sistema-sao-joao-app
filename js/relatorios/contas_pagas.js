// Contas pagas por mês: ContasPagas.cs + SjContasPagasForm.cs + SjResumoColunaForm.cs (somente gerência).
import { h, alertBox, friendly, modal } from "../ui.js";
import { ctx, register } from "../app.js";
import { consultaCom, parseList, I, M, S, R2 } from "../mym.js";
import { SQL, parse, calcular as calcCom, Liquido, Recebido } from "./comissoes.js";
import { page, table, acesso, C2, busy } from "./base.js";
import { precos } from "../precos.js";

const grp = (nome, cod) => ({ Nome: nome, Codigos: cod.split(/[ /]+/).filter(Boolean) });
export const Grupos = [
  grp("Fornecedores", "3.03.001 3.06.001 3.06.002"),
  grp("Funcionários", "3.02.001 3.02.003 3.02.004 3.02.005 3.02.006 3.02.007 3.02.008 3.02.009 3.02.010 3.02.012 3.02.013 3.02.014 3.02.015 3.02.016 3.02.017 3.02.018 3.02.019 3.05.016 3.05.023"),
  grp("Despesas Gerais", "3.03.002 3.03.003 3.03.004 3.05.002 3.05.003 3.05.005 3.05.006 3.05.007 3.05.008 3.05.009 3.05.010 3.05.011 3.05.012 3.05.013 3.05.014 3.05.015 3.05.017 3.05.018 3.05.019 3.05.020 3.05.021 3.05.022 6.01.001 6.01.002 6.01.003"),
  grp("Impostos e Taxas", "3.01.001 3.01.002 3.01.003 3.01.004 3.01.005 3.01.006 3.01.007 3.01.008 3.01.009 3.01.010 3.04.001 3.04.002 3.04.003 3.04.004 3.04.005"),
  grp("Empréstimos", "8.01.001 8.01.002 8.01.003 8.01.004 8.01.005 3.02.011"),
  grp("Marketing", "3.05.001"),
  grp("Pró-labore", "3.02.002"),
  grp("Terceirizados", "3.05.004"),
];
export const SemCentro = "(sem centro de custo)", ContaOutras = "3.05.023", Sep = " · ", ColunaSep = " — ", TipoEncargo = "GPS / FGTS", GrupoConfig = "CONTAS PAGAS FORNECEDOR", SemSubconta = " (lançado sem subconta)";
const NomesMes = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const NomeMes = (am) => NomesMes[am % 100] + "/" + Math.floor(am / 100);
export const Norm = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/\p{Mn}/gu, "").normalize("NFC");
export function Codigo(conta) {
  const c = String(conta ?? "").trim(); if (!c.length) return SemCentro;
  if (c.includes(".") || c.length < 2) return c;
  if (c.length <= 3) return c[0] + "." + c.slice(1);
  return c[0] + "." + c.slice(1, 3) + "." + c.slice(3);
}
const ContaMae = new Map([["3.01", 3], ["3.02", 1], ["3.03", 2], ["3.04", 3], ["3.05", 2], ["3.06", 0], ["6.01", 2], ["6", 2], ["8.01", 4], ["8", 4], ["3", 2], ["2.01.002", 0]]);
const Pai = (c) => { const i = c.lastIndexOf("."); return i < 0 ? "" : c.slice(0, i); };
export function Separar(chave) { const s = chave ?? ""; const i = s.indexOf(Sep); return i < 0 ? { ok: false, conta: chave, tipo: "" } : { ok: true, conta: s.slice(0, i), tipo: s.slice(i + Sep.length) }; }
function GrupoDeConta(codigo) {
  for (let i = 0; i < Grupos.length; i++) if (Grupos[i].Codigos.includes(codigo)) return i;
  for (let c = codigo ?? ""; c.length > 0; c = Pai(c)) if (ContaMae.has(c)) return ContaMae.get(c);
  return -1;
}
export function GrupoDe(codigo) { const s = Separar(codigo); return s.ok ? GrupoDoTipo(s.tipo) : GrupoDeConta(codigo); }
export const EhEncargo = (f) => { f = Norm(f); return f.startsWith("GPS") || f.startsWith("FGTS"); };
const OrgaoDeImposto = (f) => { f = Norm(f); return f.startsWith("SIMPLES NACIONAL") || f.includes("SECRETARIA DE ESTADO DE FAZENDA") || f.includes("RECEITA FEDERAL") || f.includes("RECEITA ESTADUAL") || f.startsWith("PREFEITURA") || f.startsWith("IMPOSTO RENDA") || f === "ICMS" || f === "IPVA" || f.startsWith("PODER JUDICIARIO"); };
const ClasseImposto = (k) => k.startsWith("IMPOSTO") || k.includes("IPTU") || k.includes("IPVA");
const FornecedoresPadrao = [
  ["Pró-labore", "CARLOS ANTONIO DE MOURA NUNES", "TIM CARLOS MOURA", "NET CORO - INTERNET CARLOS MOURA", "CEMIG CARLOS MOURA", "COPASA-RUA CLARINDO GOULART", "TIM SANDRA MOURA", "CEMIG JOAO MOURA", "ALUGUEL IMOVEL (JOAO MOURA JUNIOR)", "ADRIA MOURA", "UNIMED PATROCINIO", "UNIMED ALTO PARANAIBA"],
  ["Terceirizados", "JULIANA RAFAELLA", "CAMILA VILELA", "HONORARIOS CONTADOR", "PLANEJAR CONTABILIDADE", "S.O.S CONSULTORIA", "MERCIA FABIANA", "ZOOM INNOVATION", "VITOR HUGO"],
  ["Marketing", "ECC-EMPRESA COROMANDELENSE", "REDE GERAIS DE COMUNICACAO", "REDE TVN", "TRAFEGO PAGO", "EZEN ASSESSORIA", "FACEBOOK", "MARCELIO LIMA", "MARCAS DE CREDIBILIDADE", "NUMMUS", "CHARMINHO", "MERCADO PAGO"],
  ["Empréstimos", "BDMG", "FINEP", "JURO ZERO"],
  ["Funcionários", "ALESSANDRA LEMES", "ALIRIO EUSTAQUIO", "ANA CLARA", "ANA JULIA", "ANDRESSA", "CASTELIANA", "CLAUDIO HENRIQUE", "CRISTIANE FERNANDES", "DANIELLA ADRIADNA", "ELAINE CRISTINA", "EMANUELLY", "EVERTON CARVALHO", "GEILSA", "HELENA SILVA", "JOAO CARLOS RESENDE", "LETICIA MARIA", "LORENA MARIA", "LUANA SEABRA", "LUIZ GUSTAVO", "MAICON RILLANY", "MARIA EDUARDA", "NAYANE NUNES FERREIRA", "NELSON NEY RIBEIRO", "PAULO CESAR", "RAMON JOSE", "ROSIENE", "RYAN LUCAS", "SAMANTHA", "SELENITA", "SOLANGE", "THIAGO INACIO", "VALDENIR", "VANIA APARECIDA", "VINICIUS MONTEIRO", "VITORIA CAROLINE", "YAN GUSTAVO", "YURI DELCARLOS", "UNIODONTO", "VR BENEF", "R&P CLINICA", "META BATIDA", "GPS", "FGTS"],
  ["Fornecedores", "ACONCHEGO", "CARTAO CREDITO", "MG DECORACAO", "GVR LOG", "MARILDA APARECIDA", "RICARDO DIAS NEGRI", "FA MARINGA", "INDUSTRIA E COMERCIO JOLITEX", "BUDDEMEYER", "ALTENBURG", "CRUZEIRO IND", "KARSTEN", "BELLA $", "CLASSE TEXTIL", "BELLA ARTE DECOR", "VANIA CONFECCOES", "BRANYL", "DOHLER", "D. R. LING", "PERSIANAS KAZZA", "PERSOL", "NAYANE INDUSTRIA", "CORTTEX", "SMOAK", "MALHAS KEEPER", "KAPAZI", "EVIDENCIA", "BESS TECIDOS", "WILER", "JANOME", "EXPRESSO DALVA", "RODONAVES", "UNIAO TRANSPORTES"],
  ["Despesas Gerais", "MASTER LASER", "ASSOCIACAO COMERCIAL", "NET CORO", "ALUGUEL", "JOAO DA MOTTA", "COPASA", "CEMIG", "TIM LOJA", "TIM PERSONALIZADOS", "TIM YURI", "VIVO", "TX CARTAO", "CAMARA DE DIRIGENTE", "PADARIA", "AUTO POSTO", "LIVRARIA", "HOSPITAL", "RPM AUTO", "GRAFICA", "METAL FORTE", "DOACAO", "PEDREIRO", "FERRAGISTA", "RD DISTRIBUIDORA", "ROBINSON SOUSA"],
];
export const IndiceGrupo = (nome) => { const n = Norm(nome); return Grupos.findIndex((g) => Norm(g.Nome) === n); };
let fornecedores = null;
export function CarregarFornecedores(config) {
  const r = [];
  for (const x of config || []) { const g = IndiceGrupo(x.info), n = Norm(x.i); if (g >= 0 && n.length) r.push([n, g]); }
  for (const l of FornecedoresPadrao) { const g = IndiceGrupo(l[0]); for (let i = 1; i < l.length; i++) r.push([Norm(l[i]), g]); }
  fornecedores = r;
}
export function GrupoDoFornecedor(f) { if (!fornecedores) CarregarFornecedores(null); f = Norm(f); if (!f.length) return -1; for (const [k, g] of fornecedores) if (f.startsWith(k)) return g; return -1; }
function GrupoDaClasse(k) {
  if (k.includes("EMPRESTIMO")) return 4;
  if (ClasseImposto(k)) return 3;
  if (k.includes("PROPAGANDA") || k.includes("MARKETING") || k.includes("MARQUETING")) return 5;
  if (k.includes("COMPRA DE PRODUTO") || k.includes("FRETE")) return 0;
  if (k.includes("FUNCIONARIO") || k.includes("UNIMED") || k.includes("SEGURANCA TRABALHO") || k.includes("TREINAMENTO") || k.includes("CONSULTORIA")) return 1;
  return -1;
}
export function Classificar(conta, classificacao, fornecedor, anoMes = 0) {
  const c = Codigo(conta), k = Norm(classificacao), f = Norm(fornecedor);
  if (f.startsWith("PAULO CESAR")) return anoMes >= 202410 && !k.includes("FUNCIONARIO") ? 7 : 1;
  if (f.includes("COSTUREIR")) return 7;
  if (f.startsWith("MARINA SANTOS MOURA GARCIA")) return k.includes("EMPRESTIMO") ? 4 : 1;
  if (f.includes("SECRETARIA DE ESTADO DE FAZENDA") && k === "GERAL") return 4;
  let g = GrupoDoFornecedor(fornecedor); if (g >= 0) return g;
  if (!c.startsWith("3.02") && !c.startsWith("8") && (ClasseImposto(k) || OrgaoDeImposto(fornecedor))) return 3;
  g = GrupoDaClasse(k); if (g >= 0 && !(g === 3 && (c.startsWith("3.02") || c.startsWith("8")))) return g;
  if (c === ContaOutras) return 2;
  return GrupoDeConta(c);
}
export function Chave(conta, classificacao, fornecedor, anoMes = 0) {
  const c = Codigo(conta), g = Classificar(conta, classificacao, fornecedor, anoMes);
  if (g < 0 || (g === GrupoDeConta(c) && c !== ContaOutras)) return c;
  const k = Norm(classificacao), tipo = EhEncargo(fornecedor) ? TipoEncargo : k.length ? k : "SEM CLASSIFICAÇÃO";
  return c + Sep + tipo + ColunaSep + Grupos[g].Nome;
}
export function GrupoDoTipo(tipo) {
  tipo = tipo ?? ""; const cs = tipo.lastIndexOf(ColunaSep);
  if (cs >= 0) { const gc = IndiceGrupo(tipo.slice(cs + ColunaSep.length)); if (gc >= 0) return gc; }
  if (tipo === TipoEncargo) return 1;
  const g = GrupoDaClasse(Norm(tipo)); return g >= 0 ? g : 2;
}
export function NomeConta(chave, plano) {
  let { conta, tipo } = Separar(chave); const n = (plano && plano.get(conta ?? "")) ?? "";
  const cs = tipo.lastIndexOf(ColunaSep); if (cs >= 0) tipo = tipo.slice(0, cs);
  return tipo.length ? (n.length ? n + " — " : "") + tipo : n;
}
const ordinal = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const ContasExtras = (l, g) => [...l.PorConta].filter(([k, v]) => v !== 0 && GrupoDe(k) === g && !Grupos[g].Codigos.includes(k)).map(([k]) => k).sort(ordinal);
export function Meses(de, ate) { const r = []; let y = de.getFullYear(), m = de.getMonth(); const fy = ate.getFullYear(), fm = ate.getMonth(); while (y < fy || (y === fy && m <= fm)) { r.push(y * 100 + m + 1); if (++m > 11) { m = 0; y++; } } return r; }
const D = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const Dia = (c) => "EXTRACT(YEAR FROM " + c + ")*10000+EXTRACT(MONTH FROM " + c + ")*100+EXTRACT(DAY FROM " + c + ")";
const AnoMesSql = (c) => "EXTRACT(YEAR FROM " + c + ")*100+EXTRACT(MONTH FROM " + c + ")";
const ClassSql = "TRIM(COALESCE(KX.DESCRICAO,''))", FornSql = "TRIM(COALESCE(FX.RAZAO_FOR,''))", JoinClass = " LEFT JOIN FORNECEDOR FX ON FX.COD_FOR=C.COD_FOR LEFT JOIN CLASSIFICACAO_CONTAS_PAGAR KX ON KX.CODIGO=C.COD_CLASSIFICACAO";
export const SqlPagos = (a, b) => "SELECT " + AnoMesSql("C.DTPAGTO_CTP") + " SJP_AM, C.COD_EMP SJP_EMP, TRIM(CC.CONTA) SJP_CONTA, " + ClassSql + " SJP_CLASS, " + FornSql + " SJP_FORN, SUM(C.VALOR_PAGO_CTP) SJP_VALOR FROM CONTAS_PAGAR C LEFT JOIN CENTRO_CUSTO CC ON CC.CODIGO=C.CODIGO_CENTRO_CUSTO" + JoinClass + " WHERE C.DTPAGTO_CTP>='" + D(a) + "' AND C.DTPAGTO_CTP<'" + D(b) + "' AND COALESCE(C.VALOR_PAGO_CTP,0)<>0 GROUP BY 1,2,3,4,5;";
export const SqlNomes = "SELECT TRIM(RDB$RELATION_NAME) SJX_T, TRIM(RDB$FIELD_NAME) SJX_C FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME IN ('FORNECEDOR','FORNECEDORES','FUNCIONARIO','FUNCIONARIOS');";
function Escolher(cols, exatos, contem) { for (const e of exatos) if (cols.includes(e)) return e; for (const c of contem) for (const x of cols) if (x.includes(c)) return x; return null; }
export function LerNomes(saida) {
  const t = new Map();
  for (const d of parseList(saida, "SJX_T")) { const a = d.SJX_T, b = d.SJX_C; if (a != null && b != null) { if (!t.has(a)) t.set(a, []); t.get(a).push(b.toUpperCase()); } }
  const n = {};
  for (const tab of ["FORNECEDOR", "FORNECEDORES"]) if (t.has(tab)) { const c = t.get(tab), k = Escolher(c, ["COD_FOR", "CODIGO_FOR", "CODIGO"], []), nm = Escolher(c, ["NOME_FOR", "RAZAO_FOR", "FANTASIA_FOR", "RAZAO_SOCIAL_FOR", "NOME"], ["NOME", "RAZAO", "FANTASIA"]); if (k && nm) { n.ForTabela = tab; n.ForChave = k; n.ForNome = nm; break; } }
  for (const tab of ["FUNCIONARIO", "FUNCIONARIOS"]) if (t.has(tab)) { const c = t.get(tab), k = Escolher(c, ["COD_FUNCIONARIO", "COD_FUN", "CODIGO_FUN", "CODIGO"], []), nm = Escolher(c, ["NOME_FUNCIONARIO", "NOME_FUN", "NOME"], ["NOME"]); if (k && nm) { n.FunTabela = tab; n.FunChave = k; n.FunNome = nm; break; } }
  return n;
}
export function SqlTitulos(a, b, n) {
  const obs = "REPLACE(REPLACE(SUBSTRING(C.OBS_CTP FROM 1 FOR 80),ASCII_CHAR(13),' '),ASCII_CHAR(10),' ')";
  let sql = "SELECT C.COD_CTP SJD_CTP, C.COD_EMP SJD_EMP, " + Dia("C.DTPAGTO_CTP") + " SJD_PAGTO, " + Dia("C.DTVENCTO_CTP") + " SJD_VENC, C.VALOR_PAGO_CTP SJD_VALOR, TRIM(CC.CONTA) SJD_CONTA, TRIM(C.NUM_DOC_CTP) SJD_DOC, " + obs + " SJD_OBS, C.COD_FOR SJD_FOR, C.COD_FUNCIONARIO SJD_FUNC, " + ClassSql + " SJD_CLASS, " + FornSql + " SJD_CFORN";
  let from = " FROM CONTAS_PAGAR C LEFT JOIN CENTRO_CUSTO CC ON CC.CODIGO=C.CODIGO_CENTRO_CUSTO" + JoinClass;
  if (n && n.ForTabela) { sql += ", TRIM(F." + n.ForNome + ") SJD_NFOR"; from += " LEFT JOIN " + n.ForTabela + " F ON F." + n.ForChave + "=C.COD_FOR"; }
  if (n && n.FunTabela) { sql += ", TRIM(U." + n.FunNome + ") SJD_NFUN"; from += " LEFT JOIN " + n.FunTabela + " U ON U." + n.FunChave + "=C.COD_FUNCIONARIO"; }
  return sql + from + " WHERE C.DTPAGTO_CTP>='" + D(a) + "' AND C.DTPAGTO_CTP<'" + D(b) + "' AND COALESCE(C.VALOR_PAGO_CTP,0)<>0 ORDER BY C.DTPAGTO_CTP, C.COD_CTP;";
}
export function Titulos(saida) {
  return parseList(saida, "SJD_CTP").map((d) => {
    const g = (k) => (d[k] != null ? String(d[k]).trim() : ""), i = (k) => (/^[-+]?\d+$/.test(g(k)) ? Number(g(k)) : 0);
    const dt = (k) => { const x = i(k); return x > 19000000 ? new Date(Math.floor(x / 10000), Math.floor(x / 100) % 100 - 1, x % 100) : null; };
    let nome = g("SJD_NFOR"); if (!nome.length) nome = g("SJD_NFUN");
    return { Emp: i("SJD_EMP"), CodFor: i("SJD_FOR"), CodFunc: i("SJD_FUNC"), Pagto: dt("SJD_PAGTO"), Venc: dt("SJD_VENC"), Valor: M(d, "SJD_VALOR"), Conta: Chave(g("SJD_CONTA"), g("SJD_CLASS"), g("SJD_CFORN"), Math.floor(i("SJD_PAGTO") / 100)), Doc: g("SJD_DOC"), Obs: g("SJD_OBS"), Nome: nome };
  });
}
export const DaColuna = (conta, col) => { const g = GrupoDe(conta); return col === -2 ? g >= 0 : col === -1 ? g < 0 : g === col; };
const porAno = (meses) => { const m = new Map(); for (const x of meses) { const a = Math.floor(x / 100); if (!m.has(a)) m.set(a, []); m.get(a).push(x); } return m; };
function faixa(lista, de, ate) {
  const p = Math.min(...lista), u = Math.max(...lista);
  let a = new Date(Math.floor(p / 100), p % 100 - 1, 1), b = new Date(Math.floor(u / 100), u % 100, 1);
  if (de && de > a) a = de; if (ate && ate < b) b = ate; return [a, b];
}
export async function LerTitulos(consulta, meses, emp, coluna, de, ate) {
  const n = LerNomes(await consulta(SqlNomes)), r = [];
  for (const [, lista] of porAno(meses)) {
    const [a, b] = faixa(lista, de, ate), set = new Set(lista);
    for (const t of Titulos(await consulta(SqlTitulos(a, b, n)))) if (t.Pagto && set.has(t.Pagto.getFullYear() * 100 + t.Pagto.getMonth() + 1) && (emp === 0 || t.Emp === emp) && DaColuna(t.Conta, coluna)) r.push(t);
  }
  return r;
}
export const SqlPlano = "SELECT TRIM(CONTA) SJC_CONTA, TRIM(DESCRICAO) SJC_DESC FROM CENTRO_CUSTO;";
export function ComMes(sql, campo, alias) { const i = sql.indexOf(" FROM "); if (i < 0) throw new Error("Consulta inesperada."); return sql.slice(0, i) + ", " + AnoMesSql(campo) + " " + alias + sql.slice(i); }
export const Pagos = (saida) => parseList(saida, "SJP_AM").map((d) => { const am = I(d, "SJP_AM"), co = d.SJP_CONTA ?? null, cl = d.SJP_CLASS, fo = d.SJP_FORN; return { AnoMes: am, Emp: I(d, "SJP_EMP"), Conta: Chave(co, cl, fo, am), Valor: M(d, "SJP_VALOR"), ContaMM: Codigo(co), Classe: String(cl ?? "").trim(), Fornecedor: String(fo ?? "").trim() }; });
export function Plano(saida) { const r = new Map(); for (const d of parseList(saida, "SJC_CONTA")) if (d.SJC_CONTA != null) r.set(Codigo(d.SJC_CONTA), d.SJC_DESC ?? ""); return r; }
const MesesDaSaida = (s, p, c) => parseList(s, p).map((d) => I(d, c));
export const novaLinha = (rot = "", am = 0) => ({ Rotulo: rot, AnoMes: am, Liquidas: 0, Recebidos: 0, Pagos: 0, Grupos: Grupos.map(() => 0), Partes: null, PorConta: new Map() });
export const TotalGrupos = (l) => l.Grupos.reduce((s, x) => s + x, 0);
export const Outros = (l) => l.Pagos - TotalGrupos(l);
function Somar(t, o) {
  t.Liquidas += o.Liquidas; t.Recebidos += o.Recebidos; t.Pagos += o.Pagos;
  if (o.Partes) { if (!t.Partes) t.Partes = o.Partes.map(() => 0); for (let i = 0; i < t.Partes.length; i++) t.Partes[i] += o.Partes[i]; }
  for (let i = 0; i < t.Grupos.length; i++) t.Grupos[i] += o.Grupos[i];
  for (const [k, v] of o.PorConta) t.PorConta.set(k, (t.PorConta.get(k) || 0) + v);
}
export function Montar(meses, vendas, pagos, emp) {
  const porMes = new Map();
  for (const am of meses) { const l = novaLinha(NomeMes(am), am); const v = vendas && vendas.get(am); if (v) { l.Liquidas = v.Liquidas; l.Recebidos = v.Recebidos; if (v.Partes) l.Partes = [...v.Partes]; } porMes.set(am, l); }
  for (const p of pagos) {
    const l = porMes.get(p.AnoMes); if (!l) continue; if (emp > 0 && p.Emp !== emp) continue;
    l.Pagos += p.Valor; l.PorConta.set(p.Conta, (l.PorConta.get(p.Conta) || 0) + p.Valor);
    const g = GrupoDe(p.Conta); if (g >= 0) l.Grupos[g] += p.Valor;
  }
  const r = [], total = novaLinha("TOTAL"), anos = [...new Set(meses.map((m) => Math.floor(m / 100)))];
  for (const ano of anos) { const sub = novaLinha("TOTAL " + ano); for (const am of meses.filter((m) => Math.floor(m / 100) === ano)) { r.push(porMes.get(am)); Somar(sub, porMes.get(am)); } if (anos.length > 1) r.push(sub); Somar(total, sub); }
  r.push(total); return r;
}
export async function VendasPorMes(consulta, a, b, emp) {
  const sv = await consulta(ComMes(SQL.vendas(a, b), "V.DATA_VEN", "SJV_AM")), sf = await consulta(ComMes(SQL.formas(a, b), "V.DATA_VEN", "SJF_AM"));
  const st = await consulta(ComMes(SQL.titulos(a, b), "R.DATA_RECTO", "SJT_AM")), so = await consulta(ComMes(SQL.avulsos(a, b), "C.DTPAGTO_CTR", "SJO_AM"));
  return VendasPorMesSaidas(sv, sf, st, so, emp);
}
export function VendasPorMesSaidas(sv, sf, st, so, emp) {
  const vendas = parse.vendas(sv), mv = MesesDaSaida(sv, "SJV_VEN", "SJV_AM"), formas = parse.formas(sf), mf = MesesDaSaida(sf, "SJF_VEN", "SJF_AM");
  const titulos = parse.titulos(st), mt = MesesDaSaida(st, "SJT_RECTO", "SJT_AM"), avulsos = parse.avulsos(so), mo = MesesDaSaida(so, "SJO_CTR", "SJO_AM");
  const todos = [...new Set([...mv, ...mf, ...mt, ...mo])].sort((x, y) => x - y), r = new Map();
  for (const am of todos) {
    const res = calcCom(vendas.filter((_, i) => mv[i] === am), formas.filter((_, i) => mf[i] === am), titulos.filter((_, i) => mt[i] === am), avulsos.filter((_, i) => mo[i] === am), null, 0, 0); const t = res.Total;
    if (emp > 0) r.set(am, { Liquidas: t.LiquidoEmp.get(emp) || 0, Recebidos: t.RecebidoEmp.get(emp) || 0 });
    else r.set(am, { Liquidas: Liquido(t), Recebidos: Recebido(t), Partes: [t.Bruto, t.Descontos - t.Acrescimos, t.Devolucoes, t.AVista, t.Entradas, t.Crediario] });
  }
  return r;
}
export async function Coletar(consulta, meses, emp, de, ate) {
  const plano = Plano(await consulta(SqlPlano)), pagos = [], vendas = new Map();
  for (const [, lista] of porAno(meses)) { const [a, b] = faixa(lista, de, ate); pagos.push(...Pagos(await consulta(SqlPagos(a, b)))); for (const [k, v] of await VendasPorMes(consulta, a, b, emp)) vendas.set(k, v); }
  return { pagos, plano, vendas };
}
export async function Ler(consulta, meses, emp, de, ate) { const c = await Coletar(consulta, meses, emp, de, ate); return { linhas: Montar(meses, c.vendas, c.pagos, emp), plano: c.plano }; }
export const Colunas = () => ["Mês", "Valor Total Líquidas", "Total Recebidos", "Total Pagos", ...Grupos.map((g) => g.Nome)];
export function DetalheLinhas(l, plano) {
  const r = [], nome = (c) => (plano && plano.get(c)) ?? "", val = (c) => l.PorConta.get(c) || 0;
  Grupos.forEach((g, gi) => {
    for (const c of g.Codigos) r.push([g.Nome, c, nome(c), C2(val(c))]);
    for (const c of ContasExtras(l, gi)) r.push([g.Nome, c, Separar(c).ok ? NomeConta(c, plano) : nome(c) + SemSubconta, C2(val(c))]);
    r.push(["TOTAL " + g.Nome.toUpperCase(), "", "", C2(l.Grupos[gi])]);
  });
  r.push(["TOTAL PAGO", "", "", C2(TotalGrupos(l))]); return r;
}
export const igual = (a, b) => Math.abs(a - b) < 0.005;

// ---------- Tela ----------
const iso = (d) => D(d), fromIso = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const br = (d) => (d ? String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear() : "");
const EMPRESAS = ["As duas empresas", "SÃO JOÃO DECORAÇÕES", "LOJA SÃO JOÃO"];
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
export function baixar(nome, txt) { const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" })), download: nome }); document.body.append(a); a.click(); setTimeout(() => a.remove(), 2000); ctx.audit("EXPORTAR", "RELATORIO", nome, "CSV exportado no celular"); }
export function imprimirHtml(titulo, corpo, landscape = true) {
  const w = window.open("", "_blank"); if (!w) return alertBox("O celular bloqueou a janela de impressão. Permita pop-ups para este app.");
  w.document.write("<!doctype html><meta charset=utf-8><title>" + esc(titulo) + "</title><style>@page{size:" + (landscape ? "landscape" : "portrait") + ";margin:10mm}body{font-family:Segoe UI,Arial,sans-serif;font-size:9.5px;color:#000}h1{font-size:14px}h2{font-size:12px;margin:14px 0 4px}table{border-collapse:collapse;width:100%}th,td{padding:2px 4px}th{border-bottom:1px solid #000;text-align:left}.r{text-align:right}tr.b td{font-weight:700;border-top:1px solid #888}footer{margin-top:12px;color:#555}</style><h1>" + esc(titulo) + "</h1>" + corpo + "<footer>Sistema São João — impresso em " + new Date().toLocaleString("pt-BR") + "</footer><script>setTimeout(()=>print(),300)<\/script>");
  w.document.close();
}
export function htmlTabela(cab, linhas, { dir = [], bold = () => false } = {}) {
  return "<table><tr>" + cab.map((c, i) => "<th class=" + (dir.includes(i) ? "r" : "") + ">" + esc(String(c).toUpperCase()) + "</th>").join("") + "</tr>" + linhas.map((l) => "<tr class=" + (bold(l) ? "b" : "") + ">" + l.map((v, i) => "<td class=" + (dir.includes(i) ? "r" : "") + ">" + esc(v) + "</td>").join("") + "</tr>").join("") + "</table>";
}
export function filtroPeriodo(card) {
  const hoje = new Date(), ano = hoje.getFullYear();
  const rA = h("input", { type: "radio", name: "modo", checked: true }), rP = h("input", { type: "radio", name: "modo" });
  const boxes = []; for (let a = ano; a >= 2018; a--) boxes.push(h("label", { class: "chip", style: { display: "inline-flex", gap: "4px", alignItems: "center", margin: "3px 6px 3px 0" } }, h("input", { type: "checkbox", value: a, checked: a === ano }), String(a)));
  const de = h("input", { class: "input", type: "date", value: iso(new Date(ano, 0, 1)) }), ate = h("input", { class: "input", type: "date", value: iso(hoje) });
  de.onchange = ate.onchange = () => (rP.checked = true);
  const emp = h("select", { class: "select" }, ...EMPRESAS.map((e, i) => h("option", { value: i }, e)));
  card.append(h("label", { class: "lbl", style: { display: "flex", gap: "6px", alignItems: "center" } }, rA, "Por ano (marque um ou mais)"), h("div", {}, ...boxes),
    h("label", { class: "lbl", style: { display: "flex", gap: "6px", alignItems: "center", marginTop: "8px" } }, rP, "Por período"), h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "De"), de), h("div", {}, h("label", { class: "lbl" }, "Até"), ate)),
    h("label", { class: "lbl" }, "Empresa"), emp);
  return {
    escolher() {
      if (rP.checked) { const a = fromIso(de.value), b = fromIso(ate.value); if (b < a) throw new Error("A data final é antes da inicial."); return { meses: Meses(a, b), texto: "de " + br(a) + " até " + br(b), de: a, ate: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1), periodo: true }; }
      const sel = boxes.map((b) => b.querySelector("input")).filter((i) => i.checked).map((i) => Number(i.value)).sort((x, y) => x - y);
      if (!sel.length) throw new Error("Marque pelo menos um ano.");
      const meses = []; for (const a of sel) for (let m = 1; m <= 12; m++) meses.push(a * 100 + m);
      return { meses, texto: sel.length === 1 ? "ano " + sel[0] : "anos " + sel.join(", "), periodo: false };
    },
    emp: () => Number(emp.value), nomeEmp: () => EMPRESAS[Number(emp.value)],
  };
}
export async function prepararFornecedores() { try { const p = await precos(ctx.unit).ensureFresh(); CarregarFornecedores(p.rowsOfGroup(GrupoConfig)); } catch { CarregarFornecedores(null); } }

register("rel/contas-pagas", (el) => {
  page(el, "Contas pagas", "Por mês e por grupo do plano de contas (MyManager)");
  if (!acesso(ctx.session.nome).todos) { el.append(h("div", { class: "card" }, "O relatório de contas pagas é liberado só para a gerência.")); return; }
  prepararFornecedores();
  const card = h("div", { class: "card" }); el.append(card);
  const f = filtroPeriodo(card);
  const gerar = h("button", { class: "btn primary block", style: { marginTop: "10px" } }, "CONSULTAR"), imprimir = h("button", { class: "btn", disabled: true }, "IMPRIMIR"), exportar = h("button", { class: "btn", disabled: true }, "EXPORTAR CSV");
  card.append(gerar, h("div", { class: "btns grid2", style: { marginTop: "8px" } }, imprimir, exportar));
  const area = h("div", {}), titDet = h("div", { style: { fontWeight: "700", color: "#082d4e", margin: "12px 0 6px" } }, "Escolha um mês na lista para ver a soma de cada conta."), colBtns = h("div", {}), det = h("div", {});
  const aviso = h("div", { class: "sub", style: { color: "#5a5e64", margin: "10px 0", lineHeight: "1.45" } }, "Consulta somente leitura: nada é gravado no MyManager. Escolha os anos ou o período e clique em CONSULTAR. Depois, toque num mês e escolha a coluna para abrir o resumo dela.");
  el.append(area, aviso, titDet, colBtns, det);
  let linhas = null, plano = new Map(), filtroTexto = "", ult = null, sel = null;
  const cols = Colunas().map((t, i) => ({ k: "c" + i, t, money: i > 0, bold: i === 3 }));
  function mostrarDetalhe(l) {
    sel = l; det.innerHTML = ""; colBtns.innerHTML = ""; if (!l) return;
    titDet.textContent = "Soma de cada conta — " + l.Rotulo + (l.AnoMes === 0 ? " (" + filtroTexto + ")" : "");
    colBtns.append(h("div", { class: "sub" }, "Resumo da coluna:"), h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", margin: "6px 0" } }, ...Colunas().slice(1).map((n, i) => h("button", { class: "btn small", onclick: () => abrirResumo(l, i + 1) }, n))));
    const dl = DetalheLinhas(l, plano);
    det.append(table([{ k: 0, t: "Grupo" }, { k: 1, t: "Código" }, { k: 2, t: "Conta do plano" }, { k: 3, t: "Valor pago", right: true }], dl.map((x) => ({ 0: x[0], 1: x[1], 2: x[2], 3: x[3], _b: x[0].startsWith("TOTAL") }))));
    det.querySelectorAll("tbody tr").forEach((tr, i) => { if (dl[i][0].startsWith("TOTAL")) { tr.style.fontWeight = "700"; tr.style.background = "#f0f2f5"; } });
  }
  function abrirResumo(l, col) {
    let coluna, nome;
    if (col === 1) { coluna = -3; nome = "Valor Total Líquidas"; } else if (col === 2) { coluna = -4; nome = "Total Recebidos"; } else if (col === 0 || col === 3) { coluna = -2; nome = "Total Pagos"; } else { coluna = col - 4; nome = Grupos[coluna].Nome; }
    let meses; if (l.AnoMes > 0) meses = [l.AnoMes]; else if (l.Rotulo.startsWith("TOTAL ")) { const a = Number(l.Rotulo.slice(6)) || 0; meses = ult.meses.filter((m) => Math.floor(m / 100) === a); } else meses = ult.meses;
    const { emp, de, ate } = ult;
    resumoColuna(l, coluna, nome, filtroTexto, plano, () => LerTitulos(consultaCom(180000), meses, emp, coluna, de, ate));
  }
  gerar.onclick = async () => {
    let e; try { e = f.escolher(); } catch (x) { return alertBox(friendly(x), "Contas pagas"); }
    const emp = f.emp(), texto = e.texto + " | " + f.nomeEmp(); ult = { meses: e.meses, emp, de: e.periodo ? e.de : null, ate: e.periodo ? e.ate : null };
    busy(gerar, true, "CONSULTAR"); imprimir.disabled = exportar.disabled = true; aviso.textContent = "Consultando o MyManager (contas pagas, vendas e recebimentos)... pode levar alguns segundos por ano.";
    try {
      await prepararFornecedores();
      const r = await Ler(consultaCom(180000), e.meses, emp, ult.de, ult.ate); linhas = r.linhas; plano = r.plano; filtroTexto = texto;
      const rows = linhas.map((l) => { const o = { c0: l.Rotulo, c1: l.Liquidas, c2: l.Recebidos, c3: TotalGrupos(l), _l: l }; l.Grupos.forEach((g, i) => (o["c" + (4 + i)] = g)); return o; });
      area.innerHTML = ""; area.append(table(cols, rows, { onRow: (r) => mostrarDetalhe(r._l) }));
      area.querySelectorAll("tbody tr").forEach((tr, i) => { if (linhas[i].AnoMes === 0) { tr.style.fontWeight = "700"; tr.style.background = "#f0f2f5"; } });
      const total = linhas[linhas.length - 1], fora = Outros(total);
      aviso.style.color = !igual(fora, 0) ? "#a81e2c" : "#5a5e64";
      aviso.textContent = texto + ". Total Pagos = soma dos " + Grupos.length + " grupos. Pago = valor pago do título na data do pagamento. Vendas líquidas e recebidos pela mesma regra do relatório de comissões. Toque num mês e escolha a coluna para abrir o resumo dela." + (!igual(fora, 0) ? " ATENÇÃO: " + C2(fora) + " foram pagos em contas fora destes " + Grupos.length + " grupos ou sem centro de custo e não entram no relatório." : "");
      imprimir.disabled = exportar.disabled = false; mostrarDetalhe(total);
    } catch (x) { alertBox(friendly(x), "Contas pagas"); aviso.textContent = "Não foi possível consultar. Nenhum dado foi alterado."; }
    finally { busy(gerar, false, "CONSULTAR"); }
  };
  const F = (v) => v.toFixed(2).replace(".", ",");
  exportar.onclick = () => {
    if (!linhas) return;
    let s = "Contas pagas - " + filtroTexto.replace(/;/g, ",") + "\r\n" + Colunas().join(";") + "\r\n";
    for (const l of linhas) s += [l.Rotulo, F(l.Liquidas), F(l.Recebidos), F(TotalGrupos(l)), ...l.Grupos.map(F)].join(";") + "\r\n";
    s += "\r\nDetalhe por conta;Mês;Grupo;Código;Conta;Valor pago\r\n";
    for (const l of linhas.filter((x) => x.AnoMes > 0)) for (const x of DetalheLinhas(l, plano)) if (x[1].length) s += ";" + l.Rotulo + ";" + x[0] + ";" + x[1] + ";" + x[2].replace(/;/g, ",") + ";" + x[3].replace("R$", "").trim() + "\r\n";
    baixar("Contas_Pagas_" + iso(new Date()) + ".csv", s);
  };
  imprimir.onclick = () => {
    if (!linhas) return alertBox("Faça a consulta antes de imprimir.");
    const N2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let corpo = htmlTabela(Colunas(), linhas.map((l) => [l.Rotulo, N2(l.Liquidas), N2(l.Recebidos), N2(TotalGrupos(l)), ...l.Grupos.map(N2)]), { dir: Colunas().map((_, i) => i).slice(1), bold: (x) => x[0].startsWith("TOTAL") });
    if (sel) { const d = DetalheLinhas(sel, plano).filter((x) => x[1].length === 0 || x[3] !== C2(0)); if (d.length) corpo += "<h2>Soma de cada conta — " + esc(sel.Rotulo) + " (contas com valor)</h2>" + htmlTabela(["", "", "", ""], d, { dir: [3], bold: (x) => x[0].startsWith("TOTAL") }); }
    imprimirHtml("São João — Contas pagas por mês | " + filtroTexto, corpo);
  };
});

// SjResumoColunaForm: em cima a soma de cada conta; embaixo cada título pago.
const EMP = ["", "SÃO JOÃO DECORAÇÕES", "LOJA SÃO JOÃO"];
export function resumoColuna(linha, coluna, nomeColuna, filtro, plano, carregar) {
  const titulo = nomeColuna + " — " + linha.Rotulo;
  modal("Resumo | " + titulo, ({ body, close }) => {
    const cab = h("div", { style: { fontWeight: "700", color: "#082d4e", fontSize: "16px", marginBottom: "8px" } }), contas = h("div", {}), tits = h("div", { style: { marginTop: "12px" } }), rod = h("div", { class: "sub", style: { margin: "10px 0", lineHeight: "1.45" } });
    const imp = h("button", { class: "btn", disabled: true }, "IMPRIMIR"), exp = h("button", { class: "btn", disabled: true }, "EXPORTAR CSV"), todos = h("button", { class: "btn", style: { display: "none" } }, "MOSTRAR TODAS AS CONTAS");
    body.append(cab, contas, tits, rod, h("div", { class: "btns", style: { flexWrap: "wrap", gap: "6px" } }, todos, imp, exp, h("button", { class: "btn", onclick: close }, "FECHAR")));
    let tA = null, tB = null, lista = null, filtroConta = null, valorColuna = 0;
    const tab = (t) => table(t.cab.map((c, i) => ({ k: i, t: c, right: t.money.includes(i) })), t.rows.map((r) => Object.fromEntries(r.map((v, i) => [i, t.money.includes(i) ? C2(v) : v]))), { onRow: t.onRow });
    if (coluna <= -3) {
      const valor = coluna === -3 ? linha.Liquidas : linha.Recebidos; cab.textContent = titulo + ":  " + C2(valor); const p = linha.Partes, rows = [];
      if (!p) rows.push(["Composição disponível só com \"As duas empresas\". Valor da empresa escolhida", valor]);
      else if (coluna === -3) rows.push(["Vendas brutas", p[0]], ["(−) Descontos", -p[1]], ["(−) Devoluções", -p[2]], ["= Vendas líquidas", linha.Liquidas]);
      else rows.push(["Vendas à vista", p[3]], ["(+) Entrada das vendas a prazo", p[4]], ["(+) Crediário recebido (parcelas pagas no mês)", p[5]], ["(−) Devoluções", -p[2]], ["= Total recebido", linha.Recebidos]);
      tA = { cab: ["Composição", "Valor"], rows, money: [1] }; contas.append(tab(tA));
      rod.textContent = filtro + ". Mesma regra do relatório de comissões (canceladas, pré-vendas e condicionais ficam de fora)."; imp.disabled = exp.disabled = false;
    } else {
      valorColuna = coluna === -2 ? TotalGrupos(linha) : coluna === -1 ? Outros(linha) : linha.Grupos[coluna];
      cab.textContent = titulo + ":  " + C2(valorColuna);
      const cods = coluna >= 0 ? [...Grupos[coluna].Codigos, ...ContasExtras(linha, coluna)] : [...linha.PorConta].filter(([k, v]) => v !== 0 && DaColuna(k, coluna)).map(([k]) => k).sort(ordinal);
      const rows = cods.map((c) => { const v = linha.PorConta.get(c) || 0; let n = NomeConta(c, plano); if (coluna >= 0 && !Grupos[coluna].Codigos.includes(c) && !Separar(c).ok) n += SemSubconta; const g = GrupoDe(c); return [c, n, g >= 0 ? Grupos[g].Nome : "Outros pagamentos", v, valorColuna !== 0 ? (v / valorColuna * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : ""]; });
      tA = { cab: ["Código", "Conta do plano", "Grupo", "Valor pago", "% da coluna"], rows, money: [3], onRow: (r) => { if (!lista) return; filtroConta = r[0]; mostrar(); } };
      contas.append(tab(tA)); rod.textContent = "Carregando os títulos pagos no MyManager...";
      carregar().then((r) => { lista = r; mostrar(); }).catch((e) => { rod.textContent = "Não foi possível carregar os títulos: " + friendly(e); });
    }
    function mostrar() {
      const v = filtroConta == null ? lista : lista.filter((x) => x.Conta === filtroConta);
      tB = { cab: ["Pagamento", "Vencimento", "Código", "Fornecedor / funcionário", "Documento", "Observação", "Empresa", "Valor pago"], money: [7], rows: v.map((x) => [br(x.Pagto), br(x.Venc), x.Conta, x.Nome.length ? x.Nome : x.CodFor > 0 ? "Fornecedor #" + x.CodFor : x.CodFunc > 0 ? "Funcionário #" + x.CodFunc : "", x.Doc, x.Obs, x.Emp > 0 && x.Emp < EMP.length ? EMP[x.Emp] : "", x.Valor]) };
      tits.innerHTML = ""; tits.append(tab(tB));
      const soma = v.reduce((s, x) => s + x.Valor, 0), somaTudo = lista.reduce((s, x) => s + x.Valor, 0), ok = igual(somaTudo, valorColuna);
      rod.style.color = ok ? "#5a5e64" : "#a81e2c";
      rod.textContent = (filtroConta == null ? "" : "Só a conta " + filtroConta + ": ") + v.length + " título(s) pago(s), total " + C2(soma) + ". Todos os títulos da coluna: " + lista.length + ", " + (ok ? "confere com a coluna" : "ATENÇÃO: a soma dos títulos (" + C2(somaTudo) + ") é diferente da coluna (" + C2(valorColuna) + ")") + ". Toque numa conta acima para ver só os títulos dela.";
      todos.style.display = filtroConta != null ? "" : "none"; imp.disabled = exp.disabled = false;
    }
    todos.onclick = () => { filtroConta = null; mostrar(); };
    const tabelas = () => [tA, tB].filter(Boolean);
    exp.onclick = () => { let s = cab.textContent.replace(/;/g, ",") + "\r\n"; for (const t of tabelas()) { s += "\r\n" + t.cab.join(";") + "\r\n"; for (const r of t.rows) s += r.map((v, i) => (t.money.includes(i) ? Number(v).toFixed(2).replace(".", ",") : String(v).replace(/;/g, ","))).join(";") + "\r\n"; } baixar("Resumo_" + titulo.replace(/[^\p{L}\p{N}]/gu, "_") + ".csv", s); };
    imp.onclick = () => { const N2 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); imprimirHtml("São João — " + cab.textContent, tabelas().map((t) => htmlTabela(t.cab, t.rows.map((r) => r.map((v, i) => (t.money.includes(i) ? N2(v) : String(v)))), { dir: t.money, bold: (x) => String(x[0]).startsWith("=") })).join("<br>") + "<p>" + esc(rod.textContent) + "</p>"); };
  }, { wide: true });
}
