// Administração: Auditoria e Exclusões (AdminAuditCenter2026 + AuditView), Computadores e Versões (StationHealthCenter),
// Sobre / Versão (AboutVersion).
import { h, alertBox, friendly, toDate } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { table } from "../relatorios/base.js";
import { APP_VERSION } from "../config.js";

const p2 = (n) => String(n).padStart(2, "0");
const dt = (v) => { if (!v) return ""; const d = toDate(v); if (!d || isNaN(d)) return ""; return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()); };
const cab = (el, t, s) => el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, t), s ? h("div", { class: "sub" }, s) : null)));
const tile = (t, s, go) => h("button", { class: "card", style: { display: "block", width: "100%", textAlign: "left", border: "1px solid #d2dee8", cursor: "pointer" }, onclick: go }, h("div", { style: { fontWeight: "700", color: "#071f38" } }, t), h("div", { class: "sub" }, s));

register("auditoria", (el, arg) => {
  if (arg === "lista" || String(arg || "").startsWith("lista/")) return auditView(el);
  cab(el, "Auditoria e Exclusões", "Rastreabilidade reunida em um único ponto, sem poluir o menu principal.");
  el.append(tile("Auditoria", "Histórico de ações por usuário e registro.", () => ctx.go("auditoria/lista")),
    tile("Lixeira / Exclusões", "Consulte registros arquivados e exclusões rastreadas.", () => ctx.go("auditoria/lixeira")));
});
function auditView(el) {
  cab(el, "Auditoria");
  if (!ctx.isAdmin) { el.append(h("div", { class: "card", style: { color: "darkred" } }, "A auditoria é restrita ao perfil Administrador.")); return; }
  const ini = decodeURIComponent((location.hash.split("/")[3] || ""));
  const q = h("input", { class: "input", value: ini }), b = h("button", { class: "btn dark" }, "FILTRAR"), area = h("div", {});
  el.append(h("div", { class: "card" }, h("label", { class: "lbl" }, "Buscar usuário / ação / entidade"), q, h("div", { class: "btns", style: { marginTop: "8px" } }, b)), area);
  const cols = ["DataHora", "UsuarioNome", "Acao", "Entidade", "EntidadeId", "Detalhes", "Computador"].map((k) => ({ k, t: k }));
  const load = async () => { try { const rows = (await api.fetchAudit(q.value)).map((r) => ({ ...r, DataHora: dt(r.DataHora) })); area.innerHTML = ""; area.append(table(cols, rows)); } catch (e) { alertBox(friendly(e)); } };
  b.onclick = load; q.onkeydown = (e) => { if (e.key === "Enter") load(); }; load();
}

// VersoesComputadores
const EmDia = "EM DIA", Desatualizado = "DESATUALIZADO", SemUso = "SEM USO HÁ 30+ DIAS", SemVersao = "SEM VERSÃO";
function situacao(v, ultima, sinal) {
  if (sinal && (Date.now() - sinal) / 86400000 > 30) return SemUso;
  if (!String(v ?? "").trim()) return SemVersao;
  if (!String(ultima ?? "").trim()) return EmDia;
  return api.compareVersions(v, ultima) < 0 ? Desatualizado : EmDia;
}
register("estacoes", (el) => {
  cab(el, "Computadores e Versões", "Veja quais computadores estão ativos, a versão instalada em cada um, quem ficou para trás, usuário e pendências de sincronização.");
  const refresh = h("button", { class: "btn dark" }, "ATUALIZAR"), area = h("div", {}), note = h("div", { class: "sub", style: { marginTop: "8px", color: "#696969" } });
  el.append(h("div", { class: "btns", style: { marginBottom: "8px" } }, refresh), area, note);
  const cols = ["Estação", "Computador", "Usuário", "Perfil", "Unidade", "Versão", "Situação", "Status", "Pendências", "Último sinal"].map((k) => ({ k, t: k, right: k === "Pendências" }));
  const load = async () => {
    try {
      const rel = await api.fetchLatestRelease(); let ultima = rel ? String(rel.version ?? "").trim().replace(/^[vV]+/, "") : "";
      if (!ultima) ultima = APP_VERSION; if (api.compareVersions(APP_VERSION, ultima) > 0) ultima = APP_VERSION;
      const est = (await api.fetchStationHealth()).map((d) => { const s = d.ultimo_heartbeat ? toDate(d.ultimo_heartbeat) : null; return { "Estação": d.estacao || "", Computador: d.computador || "", "Usuário": d.usuario_nome || "", Perfil: d.perfil || "", Unidade: d.unidade || "", "Versão": d.versao || "", Status: d.status, "Pendências": Number(d.pendencias || 0), "Último sinal": dt(d.ultimo_heartbeat), "Situação": situacao(d.versao, ultima, s) }; });
      const ord = [...est.filter((r) => r["Situação"] === Desatualizado), ...est.filter((r) => r["Situação"] === EmDia), ...est.filter((r) => r["Situação"] !== Desatualizado && r["Situação"] !== EmDia)];
      area.innerHTML = ""; area.append(table(cols, ord));
      area.querySelectorAll("tbody tr").forEach((tr, i) => { const s = ord[i]["Situação"], td = tr.children[6]; td.style.fontWeight = "700"; td.style.color = s === Desatualizado ? "#c81e1e" : s === EmDia ? "#1e823c" : "dimgray"; if (s === Desatualizado) tr.style.background = "#fdecec"; });
      const atras = ord.filter((r) => r["Situação"] === Desatualizado).length;
      note.textContent = "Última versão publicada: V" + ultima + ". " + (atras === 0 ? "Todos os computadores em uso estão em dia." : atras + " computador(es) DESATUALIZADO(S): abra o sistema neles e aceite a atualização.") + " ONLINE = sinal recebido nos últimos 90 segundos. Computadores sem uso há mais de 30 dias não entram no aviso.";
    } catch (e) { note.textContent = "Não foi possível carregar a saúde das estações: " + friendly(e); }
  };
  refresh.onclick = load; load();
});

register("sobre", (el) => {
  cab(el, "Sobre / Versão");
  el.append(h("div", { class: "card" },
    h("div", { style: { fontSize: "18px", fontWeight: "700", color: "#082d4e" } }, "SISTEMA SÃO JOÃO — V" + APP_VERSION + " — " + String(ctx.unit.name).toUpperCase()),
    h("div", { style: { color: "#25844b", fontWeight: "700", margin: "8px 0" } }, "Status: Produção estável / operação normal"),
    h("div", { style: { whiteSpace: "pre-line", color: "#2d3741", lineHeight: "1.5" } }, "Usuário: " + ctx.session.nome + "  |  Perfil: " + ctx.session.perfil + "\n\nAplicativo do celular: mesma nuvem, mesmos logins e mesmas regras do sistema do computador.\nEstação: " + ctx.station + "\n\nAs atualizações chegam sozinhas: quando sai uma versão nova do sistema, o app se atualiza ao abrir."),
    h("div", { class: "btns", style: { marginTop: "12px" } }, h("button", { class: "btn dark", onclick: () => ctx.go("estacoes") }, "COMPUTADORES E VERSÕES"))));
});
