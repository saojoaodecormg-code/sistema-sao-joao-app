// Camada de dados: cópia fiel do SupabaseService.cs do Sistema São João (V24.38.1).
// Mesmas tabelas, mesmos filtros por unidade, mesma trava de edição e mesma auditoria.
import { CENTRAL_URL as URL_, CENTRAL_KEY as KEY, PONTE_URL } from "./config.js";

export class ConexaoIndisponivel extends Error {}

const cache = new Map(); // mesmo cache rápido de 45 s do PC
const CACHE_S = 45;
function cacheGet(k) { const c = cache.get(k); return c && (Date.now() - c.at) / 1000 < CACHE_S ? structuredClone(c.v) : null; }
function cachePut(k, v) { cache.set(k, { at: Date.now(), v: structuredClone(v) }); }
export function clearCachePrefix(p) { for (const k of [...cache.keys()]) if (k.startsWith(p)) cache.delete(k); }
export function clearOperationalCache() { ["customers:", "quotes:", "orders:"].forEach(clearCachePrefix); }

export const sessao = {
  get: () => { try { return JSON.parse(localStorage.getItem("sj_sessao") || "null"); } catch { return null; } },
  set: (s) => { try { localStorage.setItem("sj_sessao", JSON.stringify(s)); } catch {} },
  clear: () => { try { localStorage.removeItem("sj_sessao"); } catch {} },
};

async function raw(path, { method = "GET", body, token, prefer, headers = {}, timeout = 15000 } = {}) {
  const h = { apikey: KEY, Accept: "application/json", ...headers };
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) h["Content-Type"] = "application/json";
  if (token) h.Authorization = "Bearer " + token;
  if (prefer) h.Prefer = prefer;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  let resp; globalThis.__sjRede = (globalThis.__sjRede || 0) + 1; let contado = true;
  const solta = () => { if (contado) { contado = false; globalThis.__sjRede = Math.max(0, globalThis.__sjRede - 1); } };
  try {
    resp = await fetch(URL_ + path, { method, headers: h, signal: ctl.signal,
      body: body === undefined ? undefined : (body instanceof Blob || body instanceof ArrayBuffer ? body : JSON.stringify(body)) });
  } catch (e) {
    solta(); throw new ConexaoIndisponivel("Supabase indisponível: sem conexão com a internet.");
  } finally { clearTimeout(t); }
  let text; try { text = await resp.text(); } finally { solta(); }
  if (!resp.ok) {
    let msg = text;
    try { const j = JSON.parse(text); msg = j.msg || j.message || j.error_description || j.error || text; } catch {}
    const err = new Error(traduzErro(msg, resp.status)); err.status = resp.status; err.raw = text; throw err;
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function traduzErro(msg, status) {
  const m = String(msg || "");
  if (/invalid login credentials/i.test(m)) return "Usuário ou senha inválidos.";
  if (/JWT expired/i.test(m)) return "Sessão expirada. Entre novamente.";
  if (status === 401 || status === 403) return "Acesso negado pela nuvem. " + m;
  return "Falha de comunicação com o Supabase: " + m;
}

// Renova o token como o CloudRead() do PC: tenta a chamada, e se o JWT venceu renova e repete.
async function authed(path, opts = {}) {
  const s = sessao.get();
  if (!s || !s.accessToken) { const e = new Error("Sessão Supabase ausente. Entre novamente pelo Supabase."); e.semSessao = true; throw e; }
  try { return await raw(path, { ...opts, token: s.accessToken }); }
  catch (e) {
    if (e.status === 401 || /JWT|expired/i.test(e.raw || "")) {
      const r = await refreshSession(s.refreshToken);
      s.accessToken = r.accessToken; if (r.refreshToken) s.refreshToken = r.refreshToken; sessao.set(s);
      return await raw(path, { ...opts, token: s.accessToken });
    }
    throw e;
  }
}
async function getPaged(path, max) {
  const all = []; const page = 1000;
  for (let off = 0; off < max; off += page) {
    const lim = Math.min(page, max - off);
    const arr = await authed(path + "&limit=" + lim + "&offset=" + off);
    if (!Array.isArray(arr)) break; all.push(...arr); if (arr.length < lim) break;
  }
  return all;
}
const enc = encodeURIComponent;
const like = (v) => enc("*" + String(v || "").trim() + "*");

// ---------- Unidade (BusinessUnit.cs) ----------
export const UNIDADES = {
  DECOR: { code: "DECOR", name: "São João Decor", short: "Decor", prefix: "", accent: "#e72a30", hover: "#c81e25" },
  PERSONALIZADOS: { code: "PERSONALIZADOS", name: "São João Personalizados", short: "Personalizados", prefix: "PER-", accent: "#009b52", hover: "#00803f" },
  FA_COLCHOES: { code: "FA_COLCHOES", name: "FA Colchões", short: "FA Colchões", prefix: "FA-", accent: "#18181b", hover: "#2e2e34" },
};
const OWN_PREFIXES = ["PER-", "FA-"];
export function restScope(unit, column, kind) {
  if (unit.code !== "DECOR") return column + "=like." + unit.prefix + kind + "-*";
  return OWN_PREFIXES.map((p) => column + "=not.like." + p + kind + "-*").join("&");
}

// ---------- Login ----------
export async function testar() { await raw("/rest/v1/usuarios?select=id&limit=1"); return true; }

export async function resolveLoginEmail(login) {
  if (!login) return "";
  if (login.indexOf("@") > 0) return login.trim();
  const arr = await raw("/rest/v1/rpc/resolve_login_email", { method: "POST", body: { p_login: login.trim() } });
  if (!Array.isArray(arr) || !arr.length || !arr[0].email) return "";
  return String(arr[0].email).trim();
}

export async function signIn(email, password) {
  if (!email || email.indexOf("@") < 1) throw new Error("Para entrar pela nuvem, informe o e-mail cadastrado no Supabase.");
  if (!password) throw new Error("Informe a senha.");
  const root = await raw("/auth/v1/token?grant_type=password", { method: "POST", body: { email: email.trim(), password } });
  if (!root || !root.access_token) throw new Error("O Supabase não retornou uma sessão válida.");
  const userId = root.user && root.user.id;
  if (!userId) throw new Error("Não foi possível identificar o usuário autenticado no Supabase.");
  const arr = await raw("/rest/v1/usuarios?select=id,nome,email,login,perfil,ativo,legacy_id&id=eq." + enc(userId) + "&limit=1", { token: root.access_token });
  if (!Array.isArray(arr) || !arr.length) throw new Error("Perfil do usuário não encontrado na tabela usuarios do Supabase.");
  const p = arr[0];
  if (!p.ativo) throw new Error("Usuário desativado no Supabase.");
  if (!p.login) throw new Error("O perfil do Supabase não possui login vinculado ao sistema Windows.");
  return { userId, accessToken: root.access_token, refreshToken: root.refresh_token || "", nome: p.nome || "", email: p.email || "",
    login: p.login, perfil: p.perfil || "", legacyId: p.legacy_id == null ? 0 : Number(p.legacy_id) };
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) throw new Error("Sessão não possui token de renovação.");
  const root = await raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refreshToken } });
  if (!root || !root.access_token) throw new Error("Não foi possível renovar a sessão do Supabase.");
  return { accessToken: root.access_token, refreshToken: root.refresh_token || refreshToken };
}

export async function requestPasswordRecovery(identity) {
  identity = (identity || "").trim();
  if (!identity) throw new Error("Informe o usuário ou e-mail.");
  const d = await raw("/functions/v1/saojoao-auth-recovery", { method: "POST", body: { action: "request", login: identity } });
  if (d && typeof d === "object") { if (d.ok && d.message) return d.message; if (!d.ok && d.error) throw new Error(d.error); }
  return "Se o usuário estiver habilitado para acesso online, o e-mail de recuperação foi enviado.";
}

// ---------- Permissões ----------
export async function fetchUserPermissions(userId) {
  const arr = await authed("/rest/v1/usuario_permissoes?select=modulo,visualizar,cadastrar,editar,excluir&usuario_id=eq." + enc(userId || "") + "&order=modulo");
  return (arr || []).map((d) => ({ Modulo: d.modulo, Visualizar: !!d.visualizar, Cadastrar: !!d.cadastrar, Editar: !!d.editar, Excluir: !!d.excluir }));
}
export async function saveUserPermissions(userId, rows) {
  const body = rows.map((r) => ({ usuario_id: userId, modulo: r.Modulo, visualizar: !!r.Visualizar, cadastrar: !!r.Cadastrar, editar: !!r.Editar, excluir: !!r.Excluir, updated_at: new Date().toISOString() }));
  await authed("/rest/v1/usuario_permissoes?on_conflict=usuario_id,modulo", { method: "POST", body, prefer: "resolution=merge-duplicates,return=minimal" });
}

// ---------- Clientes ----------
export async function fetchCustomers(search, unit) {
  const ck = "customers:" + unit.code + ":" + (search || ""); const c = cacheGet(ck); if (c) return c;
  const q = (search || "").trim();
  const sf = q ? "&or=(codigo.ilike." + like(q) + ",nome.ilike." + like(q) + ",telefone.ilike." + like(q) + ",whatsapp.ilike." + like(q) + ",cpf_cnpj.ilike." + like(q) + ")" : "";
  const arr = await getPaged("/rest/v1/clientes?select=codigo,nome,telefone,whatsapp,cpf_cnpj,endereco,bairro,cidade,cep,observacoes,sync_revisao,sync_atualizado_em,alterado_por_nome&" + restScope(unit, "codigo", "CLI") + sf + "&order=nome.asc,codigo.asc", 20000);
  const dt = arr.map((d) => ({ Codigo: d.codigo || "", Nome: d.nome || "", Telefone: d.telefone || "", WhatsApp: d.whatsapp || "", CPF_CNPJ: d.cpf_cnpj || "", Endereco: d.endereco || "", Bairro: d.bairro || "", Cidade: d.cidade || "", CEP: d.cep || "", Observacoes: d.observacoes || "", AlteradoPorNome: d.alterado_por_nome || "", SyncRevisao: Number(d.sync_revisao || 0), SyncAtualizadoEm: d.sync_atualizado_em || null }));
  cachePut(ck, dt); return dt;
}
export async function upsertCustomer(row) {
  const now = new Date().toISOString(); const n = (v) => (v && String(v).trim() ? String(v).trim() : null);
  const body = [{ codigo: row.Codigo, nome: row.Nome, telefone: n(row.Telefone), whatsapp: n(row.WhatsApp), cpf_cnpj: n(row.CPF_CNPJ), endereco: n(row.Endereco), bairro: n(row.Bairro), cidade: n(row.Cidade), cep: n(row.CEP), observacoes: n(row.Observacoes), criado_por_legacy_id: row.CriadoPorUserId || null, alterado_por_legacy_id: row.AlteradoPorUserId || null, criado_em: now, alterado_em: now }];
  await authed("/rest/v1/clientes?on_conflict=codigo", { method: "POST", body, prefer: "resolution=merge-duplicates,return=minimal" });
  clearCachePrefix("customers:");
}
async function patchRow(table, key, value, fields, expectedRevision) {
  let path = "/rest/v1/" + table + "?" + key + "=eq." + enc(value);
  if (expectedRevision != null) path += "&sync_revisao=eq." + expectedRevision;
  const r = await authed(path, { method: "PATCH", body: fields, prefer: expectedRevision != null ? "return=representation" : "return=minimal" });
  if (expectedRevision != null && Array.isArray(r) && r.length === 0) throw new Error("Este registro foi alterado por outra estação. Atualize a tela antes de salvar novamente.");
}
export async function patchCustomer(codigo, fields, rev) { await patchRow("clientes", "codigo", codigo, fields, rev); clearCachePrefix("customers:"); }

// ---------- Orçamentos ----------
export async function fetchQuotes(search, status, unit) {
  const ck = "quotes:" + unit.code + ":" + (search || "") + ":" + (status || ""); const c = cacheGet(ck); if (c) return c;
  const q = (search || "").trim(), st = (status || "TODOS").trim();
  let extra = q ? "&or=(numero.ilike." + like(q) + ",cliente.ilike." + like(q) + ",tipo.ilike." + like(q) + ")" : "";
  if (st && st !== "TODOS") extra += "&status=eq." + enc(st);
  const arr = await getPaged("/rest/v1/orcamentos?select=numero,data_hora,cliente,tipo,vendedor,valor,status,retornar_em,validade_ate,resumo,sync_revisao,sync_atualizado_em,alterado_por_nome&" + restScope(unit, "numero", "ORC") + extra + "&order=data_hora.desc,numero.desc", 1500);
  const dt = arr.map((d) => ({ Numero: d.numero || "", DataHora: d.data_hora || null, Cliente: d.cliente || "", Tipo: d.tipo || "", Vendedor: d.vendedor || "", Valor: Number(d.valor || 0), Status: d.status || "", RetornarEm: d.retornar_em || null, ValidadeAte: d.validade_ate || null, Resumo: d.resumo || "", AlteradoPorNome: d.alterado_por_nome || "", SyncRevisao: Number(d.sync_revisao || 0), SyncAtualizadoEm: d.sync_atualizado_em || null }));
  cachePut(ck, dt); return dt;
}
export async function patchQuote(numero, fields, rev) { await patchRow("orcamentos", "numero", numero, fields, rev); clearCachePrefix("quotes:"); }
export async function upsertQuote(row) {
  await authed("/rest/v1/orcamentos?on_conflict=numero", { method: "POST", body: [row], prefer: "resolution=merge-duplicates,return=minimal" });
  clearCachePrefix("quotes:");
}
export async function nextCommercialNumber(unit, type, year) {
  const call = async (u) => { const r = await authed("/rest/v1/rpc/proximo_numero_comercial", { method: "POST", body: { p_unidade: u, p_tipo: type, p_ano: year } }); return String(r == null ? "" : r).trim().replace(/^"|"$/g, ""); };
  if (unit.code !== "FA_COLCHOES") return call(unit.code);
  const shared = await call("DECOR");
  if (!shared.toUpperCase().startsWith(type.toUpperCase() + "-")) throw new Error("A nuvem devolveu um número inesperado (" + shared + "). Nada foi gravado.");
  return unit.prefix + shared;
}

// ---------- Pedidos ----------
export async function fetchOrders(search, status, unit) {
  const ck = "orders:" + unit.code + ":" + (search || "") + ":" + (status || ""); const c = cacheGet(ck); if (c) return c;
  const q = (search || "").trim(), st = (status || "").trim();
  let extra = q ? "&or=(numero_pedido.ilike." + like(q) + ",cliente.ilike." + like(q) + ",produto.ilike." + like(q) + ",pdv.ilike." + like(q) + ")" : "";
  if (st) extra += "&status=eq." + enc(st);
  const arr = await getPaged("/rest/v1/pedidos?select=numero_pedido,numero_orcamento,data_aprovacao,cliente,produto,pdv,valor_pdv,custo_produto,valor_mo,previsao_entrega,data_entrega,valor_recebido,falta_receber,status,sync_revisao,sync_atualizado_em,alterado_por_nome&" + restScope(unit, "numero_pedido", "PED") + extra + "&order=data_aprovacao.desc,numero_pedido.desc", 1500);
  const dt = arr.map((d) => ({ NumeroPedido: d.numero_pedido || "", NumeroOrcamento: d.numero_orcamento || "", Cliente: d.cliente || "", Produto: d.produto || "", PDV: d.pdv || "", Status: d.status || "", AlteradoPorNome: d.alterado_por_nome || "", ValorPDV: Number(d.valor_pdv || 0), CustoProduto: Number(d.custo_produto || 0), ValorMO: Number(d.valor_mo || 0), ValorRecebido: Number(d.valor_recebido || 0), FaltaReceber: Number(d.falta_receber || 0), DataAprovacao: d.data_aprovacao || null, PrevisaoEntrega: d.previsao_entrega || null, DataEntrega: d.data_entrega || null, SyncAtualizadoEm: d.sync_atualizado_em || null, SyncRevisao: Number(d.sync_revisao || 0) }));
  cachePut(ck, dt); return dt;
}
export async function patchOrder(numero, fields, rev) { await patchRow("pedidos", "numero_pedido", numero, fields, rev); clearCachePrefix("orders:"); }
export async function upsertOrder(row) {
  await authed("/rest/v1/pedidos?on_conflict=numero_pedido", { method: "POST", body: [row], prefer: "resolution=merge-duplicates,return=minimal" });
  clearCachePrefix("orders:");
}
export async function deleteOrder(numero) {
  const rows = await authed("/rest/v1/pedidos?numero_pedido=eq." + enc(numero || ""), { method: "DELETE", prefer: "return=representation" });
  if (!Array.isArray(rows) || !rows.length) throw new Error("O pedido não foi excluído. A exclusão é permitida somente para Administrador autenticado e para um pedido existente.");
  clearCachePrefix("orders:");
}

// ---------- Trava de edição entre estações (EditConcurrency.cs) ----------
export async function acquireRecordLock(entity, key, station, minutes = 15) {
  const arr = await authed("/rest/v1/rpc/sj_adquirir_bloqueio", { method: "POST", body: { p_entidade: entity, p_chave: key, p_estacao: station, p_minutos: Math.max(2, Math.min(30, minutes)) } });
  const d = Array.isArray(arr) && arr[0] ? arr[0] : {};
  return { acquired: !!d.adquirido, userName: d.usuario_nome || "", station: d.estacao || "", expiresAt: d.expira_em || null };
}
export async function releaseRecordLock(entity, key, station) {
  await authed("/rest/v1/rpc/sj_liberar_bloqueio", { method: "POST", body: { p_entidade: entity, p_chave: key, p_estacao: station } });
}

// ---------- Auditoria ----------
export async function insertAudit(legacyUserId, userName, action, entity, entityId, details, computador) {
  await authed("/rest/v1/auditoria", { method: "POST", prefer: "return=minimal", body: {
    usuario_id: null, usuario_legacy_id: legacyUserId > 0 ? legacyUserId : null, usuario_nome: userName || null, acao: action || "", entidade: entity || "",
    entidade_id: entityId || null, detalhes: details || null, computador, data_hora: new Date().toISOString() } });
}
export async function fetchAudit(search) {
  const arr = await authed("/rest/v1/auditoria?select=data_hora,usuario_nome,acao,entidade,entidade_id,detalhes,computador&order=data_hora.desc&limit=2000");
  const q = (search || "").trim().toLowerCase();
  return (arr || []).filter((d) => !q || [d.usuario_nome, d.acao, d.entidade, d.entidade_id, d.detalhes].join(" ").toLowerCase().includes(q))
    .map((d) => ({ DataHora: d.data_hora, UsuarioNome: d.usuario_nome || "", Acao: d.acao || "", Entidade: d.entidade || "", EntidadeId: d.entidade_id || "", Detalhes: d.detalhes || "", Computador: d.computador || "" }));
}
export async function fetchAuditByAction(action, limit) {
  const arr = await authed("/rest/v1/auditoria?select=data_hora,usuario_nome,acao,entidade,entidade_id,detalhes,computador&acao=eq." + enc(action || "") + "&order=data_hora.desc&limit=" + Math.max(1, Math.min(5000, limit)));
  return (arr || []).map((d) => ({ DataHora: d.data_hora, UsuarioNome: d.usuario_nome || "", Acao: d.acao || "", Entidade: d.entidade || "", EntidadeId: d.entidade_id || "", Detalhes: d.detalhes || "", Computador: d.computador || "" }));
}

// ---------- Agenda ----------
export async function fetchAgenda(unidade) {
  const u = (unidade || "DECOR").toUpperCase();
  const arr = await getPaged("/rest/v1/agenda_eventos?select=id,unidade,tipo,titulo,cliente,data_hora,fim_em,status,responsavel,telefone,endereco,observacoes,orcamento_numero,pedido_numero&unidade=eq." + enc(u) + "&order=data_hora.asc,id.asc", 20000);
  return arr.map((d) => ({ Id: String(d.id), Tipo: d.tipo || "", Titulo: d.titulo || "", Cliente: d.cliente || "", Status: d.status || "", Responsavel: d.responsavel || "", Telefone: d.telefone || "", Endereco: d.endereco || "", Observacoes: d.observacoes || "", Orcamento: d.orcamento_numero || "", Pedido: d.pedido_numero || "", DataHora: d.data_hora || null, FimEm: d.fim_em || null }));
}
export async function createAgendaEvent(unidade, ev, userName) {
  const n = (v) => (v && String(v).trim() ? String(v).trim() : null);
  await authed("/rest/v1/agenda_eventos", { method: "POST", prefer: "return=minimal", body: {
    unidade: (unidade || "DECOR").toUpperCase(), tipo: ev.Tipo, titulo: ev.Titulo, cliente: n(ev.Cliente), data_hora: ev.DataHora.toISOString(), status: "AGENDADO",
    responsavel: n(ev.Responsavel), telefone: n(ev.Telefone), endereco: n(ev.Endereco), observacoes: n(ev.Observacoes), orcamento_numero: n(ev.Orcamento), pedido_numero: n(ev.Pedido), criado_por_nome: userName } });
}
export async function patchAgendaStatus(id, status) {
  await authed("/rest/v1/agenda_eventos?id=eq." + enc(id), { method: "PATCH", prefer: "return=minimal", body: { status, alterado_em: new Date().toISOString() } });
}

// ---------- Anexos do cliente ----------
export async function fetchCustomerAttachments(codigo) {
  const arr = await authed("/rest/v1/cliente_anexos?select=id,categoria,nome_arquivo,tamanho_bytes,criado_por_nome,criado_em,storage_path&cliente_codigo=eq." + enc(codigo || "") + "&order=criado_em.desc");
  return (arr || []).map((d) => ({ Id: Number(d.id), Categoria: d.categoria || "", NomeArquivo: d.nome_arquivo || "", TamanhoMB: Math.round((Number(d.tamanho_bytes || 0) / 1048576) * 100) / 100, IncluidoPor: d.criado_por_nome || "", Data: d.criado_em, StoragePath: d.storage_path || "" }));
}
const storagePath = (p) => String(p || "").replace(/\\/g, "/").split("/").filter(Boolean).map(enc).join("/");
export async function uploadCustomerAttachment(codigo, nome, categoria, file, userId, userName) {
  const s = sessao.get(); const clean = (file.name || "arquivo").split(/[\\/]/).pop();
  const rnd = Math.random().toString(16).slice(2, 10);
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
  const path = "clientes/" + String(codigo || "sem-codigo").replace(/\//g, "_") + "/" + ts + "_" + rnd + "_" + clean;
  await raw("/storage/v1/object/cliente-anexos/" + storagePath(path), { method: "POST", body: file, token: s.accessToken, headers: { "Content-Type": "application/octet-stream", "x-upsert": "false" }, timeout: 60000 });
  try {
    const ext = clean.includes(".") ? clean.slice(clean.lastIndexOf(".")) : "";
    const arr = await authed("/rest/v1/cliente_anexos", { method: "POST", prefer: "return=representation", body: { cliente_codigo: codigo, cliente_nome: nome, categoria, nome_arquivo: clean, extensao: ext, tamanho_bytes: file.size, storage_path: path, criado_por_user_id: userId || null, criado_por_nome: userName } });
    return Array.isArray(arr) && arr[0] ? Number(arr[0].id) : 0;
  } catch (e) { try { await authed("/storage/v1/object/cliente-anexos/" + storagePath(path), { method: "DELETE" }); } catch {} throw e; }
}
export async function downloadCustomerAttachment(p) {
  const s = sessao.get();
  const r = await fetch(URL_ + "/storage/v1/object/authenticated/cliente-anexos/" + storagePath(p), { headers: { apikey: KEY, Authorization: "Bearer " + s.accessToken } });
  if (!r.ok) throw new Error("Falha ao baixar anexo do Supabase: " + (await r.text()));
  return await r.blob();
}
export async function deleteCustomerAttachment(id, p) {
  if (p) await authed("/storage/v1/object/cliente-anexos/" + storagePath(p), { method: "DELETE" });
  await authed("/rest/v1/cliente_anexos?id=eq." + id, { method: "DELETE" });
}

// ---------- Valores / produtos, metas ----------
export async function fetchPriceValues(unidade) {
  const arr = await authed("/rest/v1/valores_produtos?select=grupo,item,valor1,valor2,info&unidade=eq." + enc((unidade || "DECOR").toUpperCase()) + "&limit=10000");
  const m = new Map(); for (const d of arr || []) m.set((d.grupo || "").trim() + "|" + (d.item || "").trim(), { v1: Number(d.valor1 || 0), v2: Number(d.valor2 || 0), info: d.info || "" });
  return m;
}
export async function fetchPriceRows(unidade) {
  return await authed("/rest/v1/valores_produtos?select=unidade,grupo,item,valor1,valor2,info,origem_arquivo,atualizado_em&unidade=eq." + enc((unidade || "DECOR").toUpperCase()) + "&order=grupo.asc,item.asc&limit=10000");
}
export async function upsertPriceRows(rows) {
  await authed("/rest/v1/valores_produtos?on_conflict=unidade,grupo,item", { method: "POST", body: rows, prefer: "resolution=merge-duplicates,return=minimal" });
}
export async function fetchMonthlyGoal(unidade, ym) {
  const arr = await authed("/rest/v1/valores_produtos?select=valor1&unidade=eq." + enc((unidade || "DECOR").toUpperCase()) + "&grupo=eq." + enc("META MENSAL") + "&item=eq." + enc(ym) + "&limit=1");
  return Array.isArray(arr) && arr[0] ? Number(arr[0].valor1 || 0) : 0;
}

// ---------- Usuários (função admin-users, igual ao PC) ----------
async function adminUsers(payload) {
  const d = await authed("/functions/v1/admin-users", { method: "POST", body: payload });
  if (!d || typeof d !== "object") throw new Error("Resposta inválida da administração de usuários.");
  if (!d.ok) throw new Error(d.error || d.message || "Não foi possível concluir a operação de usuário.");
  return d;
}
export async function fetchUsers() {
  const d = await adminUsers({ action: "list" });
  return (d.users || []).map((u) => ({ Id: u.id, Nome: u.nome || "", Email: u.email || "", Login: u.login || "", Perfil: u.perfil || "", Ativo: !!u.ativo, LegacyId: u.legacy_id || "", UltimoAcesso: u.ultimo_acesso_em || "" }));
}
export const createCloudUser = (nome, email, login, perfil, ativo, password) => adminUsers({ action: "create", nome, email, login, perfil, ativo, password }).then((d) => d.message || "");
export const updateCloudUser = (id, nome, email, login, perfil, ativo) => adminUsers({ action: "update", id, nome, email, login, perfil, ativo }).then((d) => d.message || "");
export const setCloudUserActive = (id, ativo) => adminUsers({ action: "set_active", id, ativo }).then((d) => d.message || "");
export const resetCloudUserPassword = (id, password) => adminUsers({ action: "reset_password", id, password }).then((d) => d.message || "");

// ---------- Estações e versões ----------
export async function upsertStationHeartbeat(station, machine, userName, profile, unit, version) {
  await authed("/rest/v1/sj_estacoes?on_conflict=estacao", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { estacao: station, computador: machine, usuario_nome: userName, perfil: profile, unidade: unit, versao: version, pendencias: 0, ultimo_heartbeat: new Date().toISOString() } });
}
export async function fetchStationHealth() {
  const arr = await authed("/rest/v1/sj_estacoes?select=estacao,computador,usuario_nome,perfil,unidade,versao,pendencias,ultimo_heartbeat&order=ultimo_heartbeat.desc");
  return (arr || []).map((d) => ({ ...d, status: d.ultimo_heartbeat && (Date.now() - new Date(d.ultimo_heartbeat)) / 1000 <= 90 ? "ONLINE" : "SEM SINAL" }));
}
export function compareVersions(a, b) {
  const aa = String(a ?? "").trim().replace(/^[vV]+/, "").split("."), bb = String(b ?? "").trim().replace(/^[vV]+/, "").split("."), n = Math.max(aa.length, bb.length);
  const d = (s) => Number(String(s ?? "").replace(/\D/g, "") || "0");
  for (let i = 0; i < n; i++) { const x = d(aa[i]), y = d(bb[i]); if (x !== y) return x < y ? -1 : 1; } return 0;
}
// AutoUpdateService.GetLatest: a maior versão ativa publicada.
export async function fetchLatestRelease() {
  try {
    const arr = await authed("/rest/v1/app_releases?select=version,download_url,sha256,mandatory,notes,published_at&active=eq.true&order=published_at.desc&limit=30");
    let best = null; for (const x of arr || []) if (!best || compareVersions(x.version, best.version) > 0) best = x; return best;
  } catch { return null; }
}

// ---------- Leitura genérica (para os espelhos do MyManager) ----------
export async function selectAll(table, query, max = 20000) { return await getPaged("/rest/v1/" + table + "?" + (query || "select=*"), max); }

// ---------- Ponte myManager: consulta somente leitura executada pelo computador da loja ----------
// O app grava o SELECT em sj_mymanager_consultas; o computador da loja (ponte) roda no isql com
// SET TRANSACTION READ ONLY, exatamente como MymReadOnlyQuery do sistema, e devolve a saída.
// As tabelas da ponte ficam no projeto da ponte; tudo passa pela função "ponte", que confere o login do sistema.
async function ponte(acao, dados = {}, timeout = 15000) {
  const chamar = async (token) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
    globalThis.__sjRede = (globalThis.__sjRede || 0) + 1;
    let resp;
    try { resp = await fetch(PONTE_URL + "/functions/v1/ponte", { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ acao, ...dados }) }); }
    catch { throw new ConexaoIndisponivel("Ponte do myManager indisponível: sem conexão com a internet."); }
    finally { clearTimeout(t); globalThis.__sjRede = Math.max(0, globalThis.__sjRede - 1); }
    const text = await resp.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
    if (!resp.ok) { const e = new Error(j?.erro || j?.message || ("Falha na ponte do myManager (" + resp.status + ").")); e.status = resp.status; throw e; }
    return j;
  };
  const s = sessao.get();
  if (!s || !s.accessToken) { const e = new Error("Sessão Supabase ausente. Entre novamente pelo Supabase."); e.semSessao = true; throw e; }
  try { return await chamar(s.accessToken); }
  catch (e) {
    if (e.status !== 401) throw e;
    const r = await refreshSession(s.refreshToken); s.accessToken = r.accessToken; if (r.refreshToken) s.refreshToken = r.refreshToken; sessao.set(s);
    return await chamar(s.accessToken);
  }
}
export async function mymRequest(unidade, sql, estacao) {
  const r = await ponte("consulta_criar", { unidade, sql, estacao, solicitado_por: sessao.get()?.nome || "" });
  if (!r || r.id == null) throw new Error("A nuvem não confirmou o pedido de consulta ao myManager.");
  return r.id;
}
export async function mymPoll(id) { return await ponte("consulta_ler", { id }); }
export async function mymCancel(id) { try { await ponte("consulta_cancelar", { id }); } catch {} }
export async function mymBridgeStatus() {
  const arr = await authed("/rest/v1/sj_estacoes?select=estacao,versao,ultimo_heartbeat&estacao=like." + enc("PONTE-MYMANAGER*") + "&order=ultimo_heartbeat.desc&limit=1");
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}
// Documentos do computador (arquivos de DataRoot, ex.: RelatorioRecebidos) guardados na nuvem; a ponte mantém os dois iguais.
export async function lerDocumento(unidade, conjunto) {
  const r = await ponte("doc_ler", { unidade, conjunto });
  return r ? r.dados : null;
}
export async function lerDocumentoCompleto(unidade, conjunto) { return await ponte("doc_ler", { unidade, conjunto }); }
export async function gravarDocumento(unidade, conjunto, dados) { await ponte("doc_gravar", { unidade, conjunto, dados }); }
