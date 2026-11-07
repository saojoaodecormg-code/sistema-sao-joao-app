// Consulta ao myManager pelo computador da loja, igual ao MymReadOnlyQuery do sistema (dentro e fora da loja).
import * as api from "./api.js";
import { ctx } from "./app.js";

export class PonteIndisponivel extends Error {}
const code = (unit) => (unit && unit.code === "PERSONALIZADOS" ? "PERSONALIZADOS" : "DECOR");

// Executa um SELECT somente leitura e devolve a saída do isql (SET LIST ON), como no computador.
export async function consulta(select, timeoutMs = 20000) {
  if (!String(select).trimStart().toUpperCase().startsWith("SELECT")) throw new Error("Somente consultas são permitidas.");
  return await executar(select, timeoutMs);
}
// Operação fixa no banco SQL do computador da loja (ex.: Compras V24.9.2). A ponte só aceita as operações que conhece,
// com os mesmos comandos do sistema; devolve JSON.
export async function operacaoLoja(op, dados = {}, timeoutMs = 20000) {
  const out = await executar("SJ_OP " + JSON.stringify({ op, ...dados, usuario: ctx.session?.nome || "", usuarioId: ctx.session?.legacyId || 0 }), timeoutMs);
  try { return JSON.parse(out || "null"); } catch { throw new Error("Resposta inesperada do computador da loja."); }
}
async function executar(select, timeoutMs) {
  const id = await api.mymRequest(code(ctx.unit), select, ctx.station);
  const limite = Date.now() + timeoutMs + 25000; let espera = 400, vista = false;
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, espera)); espera = Math.min(1500, espera + 200);
    const r = await api.mymPoll(id);
    if (!r) continue;
    if (r.status === "EXECUTANDO") vista = true;
    if (r.status === "OK") return r.saida || "";
    if (r.status === "ERRO") throw new Error(r.erro || "Falha na consulta ao MyManager.");
  }
  await api.mymCancel(id);
  if (vista) throw new Error("Tempo excedido ao consultar o MyManager.");
  throw new PonteIndisponivel("O computador da loja não respondeu à consulta do myManager.\n\nConfira se o computador da loja está ligado, com internet, e com a Ponte myManager aberta. Assim que ele responder, esta tela funciona aqui igual ao computador.");
}
// Várias consultas em sequência com o mesmo tempo limite de cada uma (Func<string,string> consulta do sistema).
export const consultaCom = (timeoutMs) => (sql) => consulta(sql, timeoutMs);

// MyManagerComissoes.ParseList: cada registro começa pelo campo informado; só campos SJ*.
export function parseList(output, primeiro) {
  const lista = []; let cur = null; const p = primeiro.toUpperCase();
  for (const raw of String(output ?? "").replace(/\r/g, "").split("\n")) {
    const l = raw.trim(); if (!l) continue; let i = 0; while (i < l.length && !/\s/.test(l[i])) i++;
    const k = l.slice(0, i).toUpperCase(); let v = l.slice(i).trim(); if (!k.startsWith("SJ")) continue; if (v === "<null>") v = null;
    if (k === p) { cur = {}; lista.push(cur); }
    if (cur) cur[k] = v;
  }
  return lista;
}
export const I = (r, k) => { const v = r[k.toUpperCase()]; if (v == null) return 0; const x = Number(v); return Number.isInteger(x) ? x : /^[-+]?\d+$/.test(v) ? Number(v) : 0; };
export const M = (r, k) => { const v = r[k.toUpperCase()]; if (v == null) return 0; const t = String(v).trim().replace(/,/g, ""); const x = Number(t); return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) && isFinite(x) ? x : 0; };
export const S = (r, k) => { const v = r[k.toUpperCase()]; return v == null ? "" : v; };
export const R2 = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9) / 100;
