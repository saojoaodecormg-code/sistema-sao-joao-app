// Valores / Produtos (MainForm.Values / ValuesPersonalizados) e Histórico de Preços (HistoricoPrecos.cs,
// PriceSync.cs, PersonalizadosPrecos.cs). Mesma gravação segura do PC: envia só o que mudou, recusa quando
// outro computador alterou a mesma linha depois que a tela abriu, audita e registra o histórico de cada valor.
import { h, alertBox, confirmBox, friendly, toDate } from "../ui.js";
import { ctx, register, route } from "../app.js";
import * as api from "../api.js";
import { operacaoLoja } from "../mym.js";
import { num, precos, DEFAULTS, G } from "../precos.js";

const Acao = "ALTERAR_PRECO", Entidade = "VALORES_PRODUTOS", UnidadeTabelaPers = "PERS_TABELA", SepCelula = " » ", Sep = " | ";
const Arquivos = ["Personalizados_Servicos.csv", "Personalizados_Impressao_Materiais.csv", "Personalizados_Impressao_Produtos.csv", "Personalizados_Laser_Materiais.csv", "Personalizados_Laser_Produtos.csv", "Configuracao_Precos_Personalizados.csv"];
const Nomes = ["Laser Gravação / Bordado", "Impressão - Materiais", "Impressão - Produtos", "Laser CO² - Materiais", "Laser CO² - Produtos", "Outros Personalizados"];
const ArquivoNuvem = "Configuracao_Precos_Personalizados.csv";
const NomeTabela = (a) => { const i = Arquivos.indexOf(a); return i >= 0 ? Nomes[i] : a; };

const p2 = (n) => String(n).padStart(2, "0");
const dt = (d) => (!d || isNaN(d) ? "" : p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()));
const admin = () => String(ctx.session.perfil || "").toLowerCase() === "administrador";
const restrito = (el) => el.append(h("div", { class: "card", style: { color: "darkred" } }, "Acesso restrito ao Administrador."));
const cab = (el, t, s) => el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, t), s ? h("div", { class: "sub" }, s) : null)));

// ---------- PriceSync ----------
const T = (v) => String(v ?? "").trim();
const Key = (r) => T(r.g) + "|" + T(r.i);
const K = (k) => k.toLowerCase();
const Dec = (v) => { const t = T(v); return t.length === 0 ? 0 : Math.round(num(t) * 1e10) / 1e10; };
// decimal.ToString("0.################", pt-BR)
const fmtV = (n) => { const x = Number(n || 0); if (!isFinite(x) || x === 0) return "0"; let s = String(x); if (/e/i.test(s)) s = x.toFixed(16).replace(/0+$/, "").replace(/\.$/, ""); return s.replace(".", ","); };
const f4 = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false });
function Snapshot(rows) { const d = new Map(); for (const r of rows) if (!r.del) d.set(K(Key(r)), [r.v1, r.v2]); return d; }
function Changes(rows, snap, cloudNow, summary) {
  const changed = [], keys = new Set();
  for (const r of rows) { if (r.del) continue; const k = Key(r); if (k === "|") continue; const old = snap.get(K(k));
    if (!old) { changed.push(r); keys.add(K(k)); summary.push("NOVO " + k.replace("|", " / ") + " = " + r.v1 + " / " + r.v2); }
    else if (Dec(old[0]) !== Dec(r.v1) || Dec(old[1]) !== Dec(r.v2)) { changed.push(r); keys.add(K(k)); summary.push(k.replace("|", " / ") + ": " + old[0] + " / " + old[1] + " -> " + r.v1 + " / " + r.v2); } }
  if (cloudNow) for (const r of rows) { if (r.del) continue; const k = Key(r); if (k !== "|" && !cloudNow.has(K(k)) && !keys.has(K(k))) { keys.add(K(k)); changed.push(r); } }
  return changed;
}
function Conflicts(changed, snap, cloudNow) {
  const list = []; if (!cloudNow) return list;
  for (const r of changed) { const k = Key(r), old = snap.get(K(k)), now = cloudNow.get(K(k)); if (!old || !now) continue;
    const c1 = Math.round(now[0] * 1e10) / 1e10, c2 = Math.round(now[1] * 1e10) / 1e10;
    const moved = c1 !== Dec(old[0]) || c2 !== Dec(old[1]), mine = c1 === Dec(r.v1) && c2 === Dec(r.v2);
    if (moved && !mine) list.push(k.replace("|", " / ") + ": nuvem agora " + f4(now[0]) + " / " + f4(now[1]) + " (tela abriu com " + old[0] + " / " + old[1] + ")"); }
  return list;
}
// CurtainConfig.ValidateTable
function ValidateTable(rows) {
  const seen = new Set(); let n = 0;
  for (const r of rows) { if (r.del) continue; n++; const g = T(r.g), i = T(r.i);
    if (!g && !i && !T(r.v1)) continue;
    if (!g || !i) throw new Error("Linha " + n + ": informe Grupo e Item.");
    if (seen.has(K(g + "|" + i))) throw new Error("Linha " + n + ": item repetido (" + g + " / " + i + ")."); seen.add(K(g + "|" + i));
    for (const s0 of [r.v1, r.v2]) { const s = T(s0); if (!s) continue; let v; try { v = num(s); } catch { throw new Error("Linha " + n + " (" + g + " / " + i + "): valor inválido \"" + s + "\"."); } if (v < 0) throw new Error("Linha " + n + " (" + g + " / " + i + "): valor negativo não é permitido."); } }
}
function Diferencas(rows, snap, unidade) {
  const lista = [];
  for (const r of rows) { if (r.del) continue; const k = Key(r); if (k === "|") continue; const g = T(r.g), i = T(r.i), v1 = T(r.v1), v2 = T(r.v2), old = snap.get(K(k));
    if (!old) lista.push({ Unidade: unidade, Grupo: g, Item: i, Novo: true, Antes1: "", Antes2: "", Depois1: v1, Depois2: v2 });
    else if (Dec(old[0]) !== Dec(v1) || Dec(old[1]) !== Dec(v2)) lista.push({ Unidade: unidade, Grupo: g, Item: i, Antes1: T(old[0]), Antes2: T(old[1]), Depois1: v1, Depois2: v2 }); }
  return lista;
}
const Antes = (m) => (m.Novo ? "(item novo)" : m.Antes2 === "-" ? m.Antes1 : m.Antes1 + " / " + m.Antes2);
const Depois = (m) => (m.Depois2 === "-" ? m.Depois1 : m.Depois1 + " / " + m.Depois2);
const Empresa = (m) => (String(m.Unidade).toUpperCase() === "DECOR" ? "Decor" : "Personalizados");
const Chave = (m) => (m.Unidade || "") + Sep + (m.Grupo || "") + Sep + (m.Item || "");
const Detalhes = (m) => (m.Novo ? "Antes: (item novo)" : "Antes: " + m.Antes1 + " / " + m.Antes2) + "  Depois: " + m.Depois1 + " / " + m.Depois2;
const padrao = /^Antes:\s*(?:(\(item novo\))|(.*?)\s\/\s(.*?))\s+Depois:\s*(.*?)\s\/\s(.*?)\s*$/;
function LerMudanca(chave, detalhes) {
  const c = String(chave || "").split(Sep); if (c.length < 3) return null;
  const m = padrao.exec(detalhes || ""); if (!m) return null;
  return { Unidade: c[0], Grupo: c[1], Item: c.slice(2).join(Sep), Novo: !!m[1], Antes1: m[2] || "", Antes2: m[3] || "", Depois1: m[4], Depois2: m[5] };
}
async function RegistrarHistoricoPrecos(lista) {
  if (!lista || !lista.length) return;
  const enviar = async () => { for (const m of lista) await ctx.audit(Acao, Entidade, Chave(m), Detalhes(m)); };
  if (lista.length <= 20) await enviar(); else enviar();
}

// ---------- Tabela Decor (CurtainConfig.GetEditableTable) ----------
async function tabelaNuvem(unidade) {
  const arr = await api.fetchPriceRows(unidade);
  return (arr || []).map((r) => ({ g: T(r.grupo), i: T(r.item), v1: fmtV(r.valor1), v2: fmtV(r.valor2), info: r.info || "", orig: true }));
}
async function editavelDecor() {
  const rows = await tabelaNuvem("DECOR"); const present = new Set(rows.map((r) => K(Key(r))));
  const pc = precos({ code: "DECOR" }); await pc.reload(); const fabrics = pc.fabrics;
  for (const d of DEFAULTS) { const k = K(T(d.g) + "|" + T(d.i)); if (present.has(k)) continue; if (d.g.toLowerCase() === G.Fabric.toLowerCase() && fabrics.size > 0 && !fabrics.has(d.i)) continue; rows.push({ g: d.g, i: d.i, v1: fmtV(d.v1), v2: fmtV(d.v2), info: d.info || "", orig: true }); present.add(k); }
  for (const [nome, f] of fabrics) { const k = K("TECIDO TECNICO|" + nome); if (present.has(k)) continue; rows.push({ g: "TECIDO TECNICO", i: nome, v1: Number(f.width).toFixed(2).replace(".", ","), v2: "0", info: "Normal=SIM;Invertido=SIM;Sentido=NAO;Estampa=NAO;Casamento=NAO;RapportV=0;RapportH=0", orig: true }); present.add(k); }
  return rows;
}
async function cloudValues(unidade) { const m = new Map(); for (const r of (await api.fetchPriceRows(unidade)) || []) m.set(K(T(r.grupo) + "|" + T(r.item)), [Number(r.valor1 || 0), Number(r.valor2 || 0)]); return m; }
const parseBr = (s) => { try { return num(s); } catch { return 0; } };
function payload(changed, unidade) {
  const origem = unidade === "PERSONALIZADOS" ? "Configuracao_Precos_Personalizados.csv" : "Configuracao_Precos.csv", agora = new Date().toISOString();
  return changed.map((r) => ({ unidade, grupo: T(r.g), item: T(r.i), valor1: parseBr(r.v1), valor2: parseBr(r.v2), info: T(r.info) ? String(r.info) : null, origem_arquivo: origem, atualizado_em: agora }));
}

// GravarValores
async function GravarValores(unidade, rows, snap, confirmar) {
  try {
    ValidateTable(rows);
    let cloudNow; try { cloudNow = await cloudValues(unidade); } catch (e) { await alertBox("Sem conexão com a nuvem. Nada foi gravado para não deixar os computadores com preços diferentes.\n\n" + friendly(e), "Valores / Produtos"); return false; }
    const resumo = [], changed = Changes(rows, snap, cloudNow, resumo), conflitos = Conflicts(changed, snap, cloudNow);
    if (conflitos.length) { await alertBox("Outro computador alterou estes valores depois que a tela foi aberta. Nada foi gravado.\n\n" + conflitos.join("\n") + "\n\nClique em DESCARTAR / RECARREGAR, confira e salve novamente.", "Conflito de valores"); return false; }
    if (!changed.length) { await alertBox("Nenhuma alteração para salvar.", "Valores / Produtos"); return false; }
    if (confirmar && !(await confirmBox("Confirmar a gravação de " + changed.length + " linha(s)?\n\n" + resumo.slice(0, 15).join("\n") + (resumo.length > 15 ? "\n..." : "") + "\n\nOs próximos orçamentos usarão estes valores. Orçamentos já salvos não são recalculados.", "Confirmar valores"))) return false;
    ValidateTable(rows);
    const mudancas = Diferencas(rows, snap, unidade);
    for (let i = 0; i < changed.length; i += 100) await api.upsertPriceRows(payload(changed.slice(i, i + 100), unidade));
    try { await precos({ code: unidade }).reload(); } catch {}
    let det = "Configuração de preços atualizada (" + changed.length + " linha(s)): " + resumo.join(" | "); if (det.length > 1800) det = det.slice(0, 1800) + "...";
    await ctx.audit("ALTERAR", "VALORES_PRODUTOS", unidade === "DECOR" ? "GERAL" : unidade, det);
    await RegistrarHistoricoPrecos(mudancas);
    await alertBox("Valores salvos e sincronizados com a nuvem.\nTodos os computadores passam a usar a mesma tabela.", "Valores / Produtos");
    return true;
  } catch (e) { await alertBox(friendly(e), "Erro ao salvar valores"); return false; }
}

// ---------- Tela de edição (uma linha por cartão; Grupo, Item e Info travados nas linhas existentes) ----------
function editorNuvem(area, rows) {
  const grupos = [...new Set(rows.map((r) => r.g))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const fg = h("select", { class: "select" }, h("option", { value: "" }, "Todos os grupos"), ...grupos.map((g) => h("option", { value: g }, g)));
  const q = h("input", { class: "input", placeholder: "Buscar item" }), lista = h("div", {}), cont = h("div", { class: "sub", style: { margin: "6px 0" } });
  const novo = h("button", { class: "btn" }, "+ INCLUIR ITEM");
  area.append(h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Grupo"), fg), h("div", {}, h("label", { class: "lbl" }, "Buscar"), q)), h("div", { class: "btns", style: { margin: "8px 0" } }, novo), cont, lista);
  const inp = (r, campo, travado) => { const x = h("input", { class: "input", value: r[campo], disabled: travado, inputmode: campo.startsWith("v") ? "decimal" : null, style: campo.startsWith("v") ? { background: "#fff8d6" } : {} }); x.oninput = () => (r[campo] = x.value); return x; };
  const card = (r) => h("div", { class: "card", style: { padding: "10px", marginBottom: "6px", overflowWrap: "anywhere", minWidth: "0" } },
    r.orig ? h("div", {}, h("div", { class: "sub" }, r.g), h("div", { style: { fontWeight: "700", color: "#071f38" } }, r.i), r.info ? h("div", { class: "sub", style: { fontSize: "12px", overflowWrap: "anywhere" } }, r.info) : null)
      : h("div", {}, h("label", { class: "lbl" }, "Grupo"), inp(r, "g"), h("label", { class: "lbl" }, "Item"), inp(r, "i"), h("label", { class: "lbl" }, "Info"), inp(r, "info")),
    h("div", { class: "row2", style: { marginTop: "6px" } }, h("div", {}, h("label", { class: "lbl" }, "Valor1"), inp(r, "v1")), h("div", {}, h("label", { class: "lbl" }, "Valor2"), inp(r, "v2"))));
  const draw = () => {
    const g = fg.value, t = q.value.trim().toLowerCase();
    const vis = rows.filter((r) => !r.orig || ((!g || r.g === g) && (!t || (r.g + " " + r.i + " " + r.info).toLowerCase().includes(t))));
    cont.textContent = vis.length + " linha(s)" + (vis.length > 300 ? " — mostrando as 300 primeiras; use o filtro" : "");
    lista.innerHTML = ""; lista.append(...vis.slice(0, 300).map(card));
  };
  fg.onchange = draw; q.oninput = draw;
  novo.onclick = () => { rows.push({ g: fg.value || "", i: "", v1: "", v2: "", info: "", orig: false }); draw(); lista.lastChild?.scrollIntoView({ behavior: "smooth" }); };
  draw();
}

async function telaDecor(el) {
  cab(el, "Valores / Produtos");
  if (!admin()) return restrito(el);
  const info = h("div", { class: "sub", style: { marginBottom: "8px" } }), area = h("div", {});
  const salvar = h("button", { class: "btn green" }, "SALVAR ALTERAÇÕES"), recarregar = h("button", { class: "btn" }, "DESCARTAR / RECARREGAR"), historico = h("button", { class: "btn" }, "HISTÓRICO DE PREÇOS");
  el.append(info, h("div", { class: "btns grid2", style: { marginBottom: "8px" } }, salvar, recarregar, historico), area,
    h("div", { style: { color: "darkred", marginTop: "10px", fontSize: "13px" } }, "Segurança: em linhas existentes edite somente Valor1/Valor2. Para incluir um item (ex.: tecido: Grupo TECIDO, Valor1 = largura útil, Valor2 = preço/m) use INCLUIR ITEM. Somente as linhas alteradas são enviadas à nuvem, com verificação de conflito entre computadores."));
  recarregar.onclick = () => route(); historico.onclick = () => ctx.go("historico-precos");
  let rows, snap;
  try { rows = await editavelDecor(); snap = Snapshot(rows); info.textContent = "Fonte única de preços e parâmetros de todos os orçamentos Decor. Novos orçamentos usam estes valores; orçamentos já salvos mantêm o valor original. Tabela atualizada a partir da nuvem às " + p2(new Date().getHours()) + ":" + p2(new Date().getMinutes()) + "."; }
  catch (e) { info.textContent = "ATENÇÃO: não foi possível atualizar da nuvem (" + friendly(e) + "). Salvar ficará bloqueado até a conexão voltar."; salvar.disabled = true; return; }
  editorNuvem(area, rows);
  salvar.onclick = async () => { salvar.disabled = true; try { if (await GravarValores("DECOR", rows, snap, true)) route(); } finally { salvar.disabled = false; } };
}

// ---------- Personalizados (tabelas próprias ficam no computador da loja: lidas e gravadas pela ponte) ----------
const Numero = (s) => { if (!T(s)) return false; try { num(s); return true; } catch { return false; } };
const ValorCel = (o) => T(o).replace(/ \/ /g, "/");
const Junto = (arr) => arr.map(ValorCel).filter((x) => x.length).join("; ");
const ChaveLinha = (arr, n) => { const k = arr.length ? T(arr[0]) : ""; return k.length ? k : "Linha " + n; };
function ColunasNumericas(t) { const l = []; for (let c = 0; c < t.colunas.length; c++) { let n = 0, todos = true; for (const r of t.linhas) { if (!r.orig) continue; const s = T(r.orig[c]); if (!s) continue; n++; if (!Numero(s)) { todos = false; break; } } if (todos && n > 0) l.push(c); } return l; }
function ValidarPers(t) { const nums = ColunasNumericas(t); let linha = 0; for (const r of t.linhas) { linha++; if (r.del) continue; for (const c of nums) { const s = T(r.cur[c]); if (s && !Numero(s)) throw new Error("Linha " + linha + " (" + ChaveLinha(r.cur, linha) + "), coluna " + t.colunas[c] + ": \"" + s + "\" não é um número. Use vírgula para centavos, ex.: 12,50."); } } }
function DiferencasPers(t, arquivo) {
  const lista = []; let linha = 0;
  for (const r of t.linhas) { linha++;
    if (!r.orig) { if (r.del || !r.cur.some((x) => ValorCel(x).length)) continue; lista.push({ Unidade: UnidadeTabelaPers, Grupo: arquivo, Item: ChaveLinha(r.cur, linha), Novo: true, Antes1: "", Antes2: "-", Depois1: "(linha nova) " + Junto(r.cur), Depois2: "-" }); }
    else if (r.del) lista.push({ Unidade: UnidadeTabelaPers, Grupo: arquivo, Item: ChaveLinha(r.orig, linha), Antes1: Junto(r.orig), Antes2: "-", Depois1: "(linha apagada)", Depois2: "-" });
    else t.colunas.forEach((col, c) => { const a = ValorCel(r.orig[c]), d = ValorCel(r.cur[c]); if (a === d) return; if (Numero(a) && Numero(d) && Dec(a) === Dec(d)) return;
      lista.push({ Unidade: UnidadeTabelaPers, Grupo: arquivo, Item: ChaveLinha(r.orig, linha) + SepCelula + col, Antes1: a || "(vazio)", Antes2: "-", Depois1: d || "(vazio)", Depois2: "-" }); }); }
  return lista;
}
async function AbrirTabelaPers(arquivo) {
  const r = await operacaoLoja("pers_tabela_ler", { arquivo });
  if (!r || !Array.isArray(r.colunas)) throw new Error("O computador da loja não devolveu a tabela " + NomeTabela(arquivo) + ".");
  return { colunas: r.colunas, carimbo: r.carimbo || "", linhas: (r.linhas || []).map((l) => ({ orig: r.colunas.map((_, i) => String(l[i] ?? "")), cur: r.colunas.map((_, i) => String(l[i] ?? "")), del: false })) };
}
async function GravarTabelaPers(arquivo, t, confirmar) {
  try {
    ValidarPers(t); const mud = DiferencasPers(t, arquivo);
    if (!mud.length) { await alertBox("Nenhuma alteração para salvar.", NomeTabela(arquivo)); return false; }
    const linhaRes = (m) => m.Item + ": " + Antes(m) + " -> " + Depois(m);
    if (confirmar && !(await confirmBox("Confirmar " + mud.length + " alteração(ões) em " + NomeTabela(arquivo) + "?\n\n" + mud.slice(0, 15).map(linhaRes).join("\n") + (mud.length > 15 ? "\n..." : "") + "\n\nOs próximos orçamentos usarão estes valores. Orçamentos já salvos não são recalculados.", "Confirmar valores"))) return false;
    const r = await operacaoLoja("pers_tabela_gravar", { arquivo, carimbo: t.carimbo, colunas: t.colunas, linhas: t.linhas.filter((l) => !l.del && (l.orig || l.cur.some((x) => T(x)))).map((l) => l.cur.map((x) => String(x).replace(/[\r\n]/g, " "))) });
    if (r && r.conflito) { await alertBox("Esta tabela foi alterada por outra pessoa depois que a tela foi aberta. Nada foi gravado.\n\nFeche e abra a tela de novo, confira e salve.", "Conflito de valores"); return false; }
    if (!r || !r.ok) throw new Error((r && r.erro) || "O computador da loja não confirmou a gravação.");
    t.carimbo = r.carimbo || t.carimbo; t.linhas = t.linhas.filter((l) => !l.del).map((l) => ({ orig: [...l.cur], cur: l.cur, del: false }));
    let det = NomeTabela(arquivo) + " (" + mud.length + " alteração(ões)): " + mud.map(linhaRes).join(" | "); if (det.length > 1800) det = det.slice(0, 1800) + "...";
    await ctx.audit("ALTERAR", "VALORES_PERSONALIZADOS", arquivo, det);
    await RegistrarHistoricoPrecos(mud);
    return true;
  } catch (e) { await alertBox(friendly(e), "Erro ao salvar valores"); return false; }
}
function editorLocal(area, t) {
  const q = h("input", { class: "input", placeholder: "Buscar" }), lista = h("div", {}), novo = h("button", { class: "btn" }, "+ NOVA LINHA");
  area.append(q, h("div", { class: "btns", style: { margin: "8px 0" } }, novo), lista);
  const draw = () => {
    const s = q.value.trim().toLowerCase(); lista.innerHTML = "";
    t.linhas.forEach((l, n) => { if (l.del) return; if (s && l.orig && !l.cur.join(" ").toLowerCase().includes(s)) return;
      const del = h("button", { class: "btn", style: { color: "#b42318", padding: "4px 10px" } }, "APAGAR LINHA");
      del.onclick = async () => { if (await confirmBox("Apagar a linha " + ChaveLinha(l.cur, n + 1) + "?", "Valores / Produtos")) { l.del = true; draw(); } };
      lista.append(h("div", { class: "card", style: { padding: "10px", marginBottom: "6px" } }, ...t.colunas.map((c, i) => { const x = h("input", { class: "input", value: l.cur[i] }); x.oninput = () => (l.cur[i] = x.value); return h("div", {}, h("label", { class: "lbl" }, c), x); }), h("div", { class: "btns", style: { marginTop: "6px" } }, del))); });
  };
  q.oninput = draw; novo.onclick = () => { t.linhas.push({ orig: null, cur: t.colunas.map(() => ""), del: false }); q.value = ""; draw(); lista.lastChild?.scrollIntoView({ behavior: "smooth" }); };
  draw();
}
async function telaPersonalizados(el) {
  cab(el, "Cadastro de Produtos e Preços — São João Personalizados");
  if (!admin()) return restrito(el);
  let aba = Arquivos.length - 1;
  const abas = h("div", { class: "chips", style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" } }), area = h("div", {});
  const save = h("button", { class: "btn green" }, "SALVAR TABELA ATUAL"), historico = h("button", { class: "btn" }, "HISTÓRICO DE PREÇOS");
  el.append(abas, h("div", { class: "btns grid2", style: { marginBottom: "8px" } }, save, historico), area,
    h("div", { class: "sub", style: { marginTop: "10px" } }, "Cada aba é independente. Antes de gravar o sistema faz cópia de segurança, confere se outra pessoa alterou a tabela e registra cada valor no Histórico de Preços. A aba Outros Personalizados também vai para a nuvem."));
  historico.onclick = () => ctx.go("historico-precos");
  const estado = new Map();
  const abrir = async (i) => {
    aba = i; abas.innerHTML = ""; Nomes.forEach((n, j) => abas.append(h("button", { class: "btn" + (j === i ? " dark" : ""), style: { padding: "6px 10px" }, onclick: () => abrir(j) }, n)));
    area.innerHTML = ""; area.append(h("div", { class: "sub" }, "Carregando..."));
    try {
      if (!estado.has(i)) { if (Arquivos[i] === ArquivoNuvem) { const rows = await tabelaNuvem("PERSONALIZADOS"); estado.set(i, { nuvem: true, rows, snap: Snapshot(rows) }); } else estado.set(i, { nuvem: false, t: await AbrirTabelaPers(Arquivos[i]) }); }
      const s = estado.get(i); area.innerHTML = ""; if (s.nuvem) editorNuvem(area, s.rows); else editorLocal(area, s.t);
    } catch (e) { area.innerHTML = ""; area.append(h("div", { class: "card", style: { color: "darkred" } }, "Não foi possível abrir " + Nomes[i] + ": " + friendly(e))); }
  };
  save.onclick = async () => {
    const s = estado.get(aba); if (!s) return; save.disabled = true;
    try {
      if (s.nuvem) { if (await GravarValores("PERSONALIZADOS", s.rows, s.snap, true)) { s.rows.forEach((r) => (r.orig = true)); s.snap = Snapshot(s.rows); await abrir(aba); } }
      else if (await GravarTabelaPers(Arquivos[aba], s.t, true)) { await alertBox("Tabela salva: " + Nomes[aba] + "\nNovos orçamentos usarão os novos valores. Orçamentos antigos permanecem com o valor já salvo.", Nomes[aba]); await abrir(aba); }
    } finally { save.disabled = false; }
  };
  abrir(aba);
}

register("valores", (el) => (ctx.unit.code === "PERSONALIZADOS" ? telaPersonalizados(el) : telaDecor(el)));

// ---------- Histórico de Preços ----------
const NomeGrupoHistorico = (m) => (String(m.Unidade).toUpperCase() === UnidadeTabelaPers ? NomeTabela(m.Grupo) : m.Grupo);
async function LerHistoricoPrecos() {
  const a = await api.fetchAuditByAction(Acao, 3000), lista = [];
  for (const r of a) { const m = LerMudanca(r.EntidadeId, r.Detalhes); if (!m) continue; const d = r.DataHora ? toDate(r.DataHora) : null; m.Quando = d && !isNaN(d) ? d : null; m.Usuario = r.UsuarioNome; m.Computador = r.Computador; lista.push(m); }
  return lista;
}
async function VoltarPrecoAnterior(m) {
  if (m.Novo) { await alertBox("Este item foi criado nesta alteração, então não existe valor anterior para voltar.", "Histórico de Preços"); return false; }
  const u = String(m.Unidade).toUpperCase();
  if (u === UnidadeTabelaPers) return VoltarCelulaPersonalizados(m);
  let rows; try { rows = u === "PERSONALIZADOS" ? await tabelaNuvem("PERSONALIZADOS") : await editavelDecor(); } catch (e) { await alertBox("Sem conexão com a nuvem. Nada foi alterado.\n\n" + friendly(e), "Histórico de Preços"); return false; }
  const snap = Snapshot(rows), linha = rows.find((r) => T(r.g).toLowerCase() === m.Grupo.toLowerCase() && T(r.i).toLowerCase() === m.Item.toLowerCase());
  if (!linha) { await alertBox("O item " + m.Grupo + " / " + m.Item + " não existe mais na tabela" + (u === "PERSONALIZADOS" ? "." : " de valores."), "Histórico de Preços"); return false; }
  const hoje1 = T(linha.v1), hoje2 = T(linha.v2);
  if (Dec(hoje1) === Dec(m.Antes1) && Dec(hoje2) === Dec(m.Antes2)) { await alertBox(m.Grupo + " / " + m.Item + " já está com o valor " + Antes(m) + ".", "Histórico de Preços"); return false; }
  let msg;
  if (u === "PERSONALIZADOS") msg = "Voltar " + m.Grupo + " / " + m.Item + " para " + Antes(m) + "?\n\nHoje: " + hoje1 + " / " + hoje2;
  else { const aviso = Dec(hoje1) !== Dec(m.Depois1) || Dec(hoje2) !== Dec(m.Depois2) ? "\n\nAtenção: depois desta alteração o valor mudou de novo. Hoje está " + hoje1 + " / " + hoje2 + "." : "";
    msg = "Voltar " + m.Grupo + " / " + m.Item + " para " + Antes(m) + "?\n\nHoje: " + hoje1 + " / " + hoje2 + "\nVai ficar: " + Antes(m) + aviso + "\n\nOs próximos orçamentos usarão este valor. Orçamentos já salvos não mudam."; }
  if (!(await confirmBox(msg, "Voltar ao valor anterior"))) return false;
  linha.v1 = m.Antes1; linha.v2 = m.Antes2;
  return GravarValores(u === "PERSONALIZADOS" ? "PERSONALIZADOS" : "DECOR", rows, snap, false);
}
async function VoltarCelulaPersonalizados(m) {
  const sep = m.Item.lastIndexOf(SepCelula);
  if (sep < 0 || m.Depois1.startsWith("(linha")) { await alertBox("Esta alteração foi de uma linha inteira (nova ou apagada). Para desfazer, edite a tabela em Valores / Produtos.", "Histórico de Preços"); return false; }
  const chave = m.Item.slice(0, sep), coluna = m.Item.slice(sep + SepCelula.length);
  let t; try { t = await AbrirTabelaPers(m.Grupo); } catch (e) { await alertBox(friendly(e), "Histórico de Preços"); return false; }
  const c = t.colunas.findIndex((x) => x.toLowerCase() === coluna.toLowerCase());
  if (c < 0) { await alertBox("A coluna " + coluna + " não existe mais em " + NomeTabela(m.Grupo) + ".", "Histórico de Preços"); return false; }
  const linha = t.linhas.find((l, n) => ChaveLinha(l.cur, n + 1).toLowerCase() === chave.toLowerCase());
  if (!linha) { await alertBox(chave + " não existe mais em " + NomeTabela(m.Grupo) + ".", "Histórico de Preços"); return false; }
  const antes = m.Antes1 === "(vazio)" ? "" : m.Antes1, depois = m.Depois1 === "(vazio)" ? "" : m.Depois1, hoje = T(linha.cur[c]);
  if (hoje === antes) { await alertBox(chave + " (" + coluna + ") já está com o valor " + m.Antes1 + ".", "Histórico de Preços"); return false; }
  const aviso = hoje !== depois ? "\n\nAtenção: depois desta alteração o valor mudou de novo. Hoje está " + (hoje || "(vazio)") + "." : "";
  if (!(await confirmBox("Voltar " + chave + " (" + coluna + ") em " + NomeTabela(m.Grupo) + " para " + m.Antes1 + "?\n\nHoje: " + (hoje || "(vazio)") + aviso, "Voltar ao valor anterior"))) return false;
  linha.cur[c] = antes;
  if (!(await GravarTabelaPers(m.Grupo, t, false))) return false;
  await alertBox("Valor anterior restaurado.", "Histórico de Preços"); return true;
}

register("historico-precos", (el) => {
  cab(el, "Histórico de Preços");
  if (!admin()) return restrito(el);
  const origem = h("div", { class: "sub", style: { color: "#696969", marginBottom: "6px" } });
  const busca = h("input", { class: "input", placeholder: "Buscar item, grupo ou usuário" });
  const voltar = h("button", { class: "btn dark" }, "VOLTAR AO VALOR ANTERIOR"), abrirValores = h("button", { class: "btn" }, "ABRIR VALORES / PRODUTOS");
  const sel = h("div", { class: "sub", style: { margin: "6px 0" } }, "Toque numa alteração para selecionar."), lista = h("div", {});
  el.append(origem, h("label", { class: "lbl" }, "Buscar item, grupo ou usuário"), busca, h("div", { class: "btns grid2", style: { margin: "8px 0" } }, voltar, abrirValores), sel, lista,
    h("div", { class: "sub", style: { marginTop: "8px" } }, "Selecione uma linha e toque em \"Voltar ao valor anterior\" para desfazer aquela alteração. A volta também fica registrada aqui. Orçamentos já salvos não mudam."));
  let todos = [], atual = null;
  const filtrar = () => {
    const q = busca.value.trim().toLowerCase(); lista.innerHTML = "";
    todos.forEach((m) => { const grupo = NomeGrupoHistorico(m); if (q && !(grupo + " " + m.Item + " " + m.Usuario + " " + Empresa(m)).toLowerCase().includes(q)) return;
      const c = h("div", { class: "card", style: { padding: "10px", marginBottom: "6px", cursor: "pointer", background: m === atual ? "#dbeafe" : "" } },
        h("div", { class: "sub" }, (m.Quando ? dt(m.Quando) : "") + " · " + m.Usuario + " · " + m.Computador + " · " + Empresa(m)),
        h("div", { style: { fontWeight: "700", color: "#071f38" } }, grupo + " / " + m.Item),
        h("div", {}, h("span", { style: { color: "#b42318" } }, "Antes: " + Antes(m)), "   ", h("span", { style: { color: "#1e823c", fontWeight: "700" } }, "Depois: " + Depois(m))));
      c.onclick = () => { atual = m; sel.textContent = "Selecionado: " + grupo + " / " + m.Item; filtrar(); };
      lista.append(c); });
  };
  const carregar = async () => {
    atual = null; sel.textContent = "Toque numa alteração para selecionar.";
    try { todos = await LerHistoricoPrecos(); origem.textContent = "Histórico de todos os computadores (nuvem)." + (todos.length === 0 ? " Ainda não há alterações registradas (o histórico começa a partir da V24.27)." : ""); }
    catch (e) { todos = []; origem.textContent = "Sem acesso à nuvem (" + friendly(e) + ")."; }
    filtrar();
  };
  busca.oninput = filtrar; abrirValores.onclick = () => ctx.go("valores");
  voltar.onclick = async () => { if (!atual) return alertBox("Selecione na lista a alteração que deseja desfazer.", "Histórico de Preços"); voltar.disabled = true; try { if (await VoltarPrecoAnterior(atual)) await carregar(); } finally { voltar.disabled = false; } };
  carregar();
});
