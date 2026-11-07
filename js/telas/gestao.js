// Gestão: Painel Executivo 2026, Central Evolução 2026, Sistema e Sincronização, Status da Nuvem,
// Atualizações do Sistema, Velocidade do Sistema, Saúde / Diagnóstico e Lixeira / Exclusões.
import { h, alertBox, friendly, money, toDate, formModal } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { table } from "../relatorios/base.js";
import { APP_VERSION } from "../config.js";
import { Precos } from "../precos.js";
import { calculateCurtain } from "./orc_cortina.js";
import * as Vel from "../velocidade.js";

const p2 = (n) => String(n).padStart(2, "0");
const dt = (v) => { if (!v) return ""; const d = toDate(v); if (!d || isNaN(d)) return ""; return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()); };
const cab = (el, t, s) => el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, t), s ? h("div", { class: "sub" }, s) : null)));
const admin = () => String(ctx.session.perfil || "").toLowerCase() === "administrador";
const N1 = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const card = (t, v) => h("div", { class: "card", style: { padding: "10px 12px", margin: "0" } }, h("div", { style: { fontSize: "11px", fontWeight: "700", color: "dimgray" } }, t.toUpperCase()), h("div", { style: { fontSize: "19px", fontWeight: "700", color: "#071f38", marginTop: "4px" } }, v));
const tile = (t, s, go) => h("button", { class: "card", style: { display: "block", width: "100%", textAlign: "left", border: "1px solid #d2dee8", cursor: "pointer" }, onclick: go }, h("div", { style: { fontWeight: "700", color: "#071f38" } }, t), h("div", { class: "sub" }, s));
const soNoComputador = (nome) => () => alertBox(nome + " mexe na configuração do próprio computador (SQL Server, rede e arquivos da estação). Use esta ferramenta no sistema do computador.\n\nNo celular não há nada local para configurar: ele trabalha direto na nuvem.", nome);

// ---------- Meta do mês (MonthlyGoals.cs) ----------
const GoalMonth = () => { const d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1); };
async function MonthlyGoal() { try { return await api.fetchMonthlyGoal(ctx.unit.code, GoalMonth()); } catch { return 0; } }
async function EditMonthlyGoal(depois) {
  if (!admin()) return alertBox("Somente o Administrador pode alterar a meta mensal.", "Meta do mês");
  const atual = await MonthlyGoal(), hoje = new Date(), mm = p2(hoje.getMonth() + 1) + "/" + hoje.getFullYear();
  const r = await formModal("Meta do mês — " + ctx.unit.name, [{ name: "meta", label: "Meta (R$)", value: atual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), inputmode: "decimal" }], { okText: "SALVAR META", intro: h("div", { class: "sub" }, "Defina a meta de faturamento para " + mm + ".") });
  if (!r) return;
  const t = String(r.meta || "").trim(); let n = Number(t.replace(/\./g, "").replace(",", ".")); if (!isFinite(n) || !t) { n = Number(t); if (!isFinite(n) || !t) return alertBox("Digite uma meta válida.", "Meta do mês"); }
  if (n < 0) n = 0; const u = ctx.unit.code, m = GoalMonth();
  try {
    await api.upsertPriceRows([{ unidade: u, grupo: "META MENSAL", item: m, valor1: n, valor2: 0, info: "Meta mensal independente da unidade " + u, origem_arquivo: "Metas_Mensais.csv", atualizado_em: new Date().toISOString() }]);
    await ctx.audit("ALTERAR_META", "META_MENSAL", u + "/" + m, "Meta definida: " + money(n));
    await alertBox("Meta de " + ctx.unit.name + " salva para " + mm + ": " + money(n), "Meta do mês"); if (depois) depois();
  } catch (e) { alertBox(friendly(e), "Erro ao salvar meta"); }
}

// ---------- Painel Executivo 2026 (ExecutiveDashboard2026) ----------
async function painel(el) {
  cab(el, "Painel Executivo 2026", "Visão gerencial da unidade atual. Os números são calculados sobre a base ativa, sem alterar nenhum registro.");
  const area = h("div", {}, h("div", { class: "sub" }, "Carregando...")); el.append(area);
  try {
    const [q, o, goal] = await Promise.all([api.fetchQuotes("", "TODOS", ctx.unit), api.fetchOrders("", "", ctx.unit), MonthlyGoal()]);
    const hoje = new Date(), first = new Date(hoje.getFullYear(), hoje.getMonth(), 1), next = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1), d0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    let approved = 0, open = 0, received = 0, receivable = 0, totalQuotes = 0, approvedCount = 0, late = 0, active = 0; const sellers = new Map();
    for (const r of q) { const d = r.DataHora ? toDate(r.DataHora) : null, st = String(r.Status || "").toUpperCase(), v = Number(r.Valor || 0);
      if (d && d >= first && d < next) { totalQuotes++; if (st === "APROVADO") { approvedCount++; approved += v; let s = r.Vendedor; if (!String(s || "").trim()) s = "(sem vendedor)"; const k = s.toLowerCase(); const cur = sellers.get(k) || { s, v: 0 }; cur.v += v; sellers.set(k, cur); } }
      if (st === "ORÇAMENTO" || st === "ORCAMENTO" || st === "ACOMPANHAR") open += v; }
    for (const r of o) { const d = r.DataAprovacao ? toDate(r.DataAprovacao) : null;
      if (d && d >= first && d < next) { received += r.ValorRecebido; receivable += r.FaltaReceber; }
      if (!r.DataEntrega) { active++; const pv = r.PrevisaoEntrega ? toDate(r.PrevisaoEntrega) : null; if (pv && !isNaN(pv) && new Date(pv.getFullYear(), pv.getMonth(), pv.getDate()) < d0) late++; } }
    const ticket = approvedCount > 0 ? approved / approvedCount : 0, conv = totalQuotes > 0 ? approvedCount * 100 / totalQuotes : 0;
    area.innerHTML = "";
    const grid = (...c) => h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" } }, ...c);
    area.append(grid(card("Realizado no mês", money(approved)), card("Meta do mês", goal > 0 ? money(goal) : "NÃO DEFINIDA"), card("Taxa de aprovação", N1(conv) + "%"), card("Ticket médio", money(ticket))),
      grid(card("Carteira em aberto", money(open)), card("Pedidos ativos", String(active)), card("Pedidos atrasados", String(late)), card("Contas a receber", money(receivable))));
    area.append(table([{ k: "Vendedor", t: "Vendedor" }, { k: "Vendas aprovadas", t: "Vendas aprovadas", money: true }], [...sellers.values()].map((x) => ({ Vendedor: x.s, "Vendas aprovadas": x.v }))));
    area.append(h("div", { class: "card", style: { whiteSpace: "pre-line", marginTop: "8px" } }, "LEITURA EXECUTIVA\n\n" + (goal > 0 ? "Atingimento da meta: " + N1(approved / goal * 100) + "%\n" : "Meta mensal ainda não definida.\n") + "Carteira comercial em aberto: " + money(open) + "\nPedidos atrasados: " + late + "\nContas a receber: " + money(receivable) + "\n\nUse Meu Dia e CRM para agir sobre retornos e atrasos; use SJ Inteligência para aprofundar a análise."));
    area.append(h("div", { class: "btns grid2", style: { marginTop: "8px" } }, h("button", { class: "btn", onclick: () => ctx.go("historico") }, "ABRIR CRM"), h("button", { class: "btn", onclick: () => ctx.go("comercial") }, "MEU DIA"), h("button", { class: "btn", onclick: () => ctx.go("relatorios") }, "SJ INTELIGÊNCIA"), h("button", { class: "btn dark", onclick: () => EditMonthlyGoal(() => { el.innerHTML = ""; painel(el); }) }, goal > 0 ? "ALTERAR META" : "DEFINIR META")));
  } catch (e) { area.innerHTML = ""; alertBox("Não foi possível montar o painel executivo.\n\n" + friendly(e), "Painel Executivo"); }
}

// ---------- Central Evolução 2026 ----------
function evolucao(el) {
  cab(el, "Central Evolução 2026 — V24.2.2", "As atualizações V23.0 a V24.1 foram consolidadas em uma única versão, preservando os módulos comerciais existentes.");
  const c = (v, t, s, go) => h("div", { class: "card", style: { padding: "12px", marginBottom: "8px" } },
    h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } }, h("span", { style: { background: "#1469be", color: "#fff", fontWeight: "700", borderRadius: "6px", padding: "4px 8px", fontSize: "13px" } }, v), h("b", { style: { color: "#071f38" } }, t)),
    h("div", { class: "sub", style: { margin: "8px 0" } }, s),
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, h("span", { style: { color: "#1f8b54", fontWeight: "700", fontSize: "12px" } }, "ATIVO"), h("button", { class: "btn dark", style: { padding: "6px 14px" }, onclick: go }, "ABRIR")));
  el.append(
    c("V23.0", "Turbo Core", "Sincronização adaptativa, fila offline sem duplicações e ferramentas de diagnóstico de desempenho.", () => ctx.go("velocidade")),
    c("V23.1", "Offline First", "Cliente, orçamento e pedido continuam com contingência local e reenvio automático quando a nuvem retorna.", () => ctx.go("admin/status-nuvem")),
    c("V23.2", "Saúde e Sincronização", "Status de nuvem, pendências, estações e backup em um único fluxo operacional.", () => ctx.go("estacoes")),
    c("V23.3", "Interface 2026", "Menu preto moderno, contraste corrigido, cabeçalhos padronizados e navegação mais limpa.", () => ctx.go("inicio")),
    c("V23.4", "Busca Universal", "Busca por cliente, telefone, orçamento, pedido, PDV ou valor; Ctrl+K executa ações rápidas.", () => ctx.go("busca")),
    c("V23.5", "Meu Dia Inteligente", "Retornos, pedidos atrasados e pendências de sincronização priorizados em uma tela.", () => ctx.go("comercial")),
    c("V23.6", "CRM Automático", "Funil visual, acompanhamentos e alertas comerciais para reduzir orçamentos esquecidos.", () => ctx.go("historico")),
    c("V23.7", "SJ Inteligência 2.0", "Assistentes locais para prioridades, oportunidades, relatórios, WhatsApp e conferência.", () => ctx.go("relatorios")),
    c("V23.8", "Auditoria Profissional", "Histórico por usuário, ação, entidade e estação, com central de exclusões e rastreabilidade.", () => ctx.go("auditoria/lista")),
    c("V23.9", "Atualização Automática", "Central de versões, backup e recuperação protegida antes de mudanças do sistema.", () => ctx.go("atualizacoes")),
    c("V24.0", "Nova Geração", "Camadas operacionais separadas por responsabilidade e diagnóstico da arquitetura instalada.", () => ctx.go("diagnostico")),
    c("V24.1", "Painel Executivo", "Meta, realizado, carteira, conversão, ticket, atrasos, contas a receber e vendedores.", () => ctx.go("admin/painel")));
}

// ---------- Sistema e Sincronização (AdminSystemCenter2026) ----------
function sistema(el) {
  cab(el, "Sistema e Sincronização", "Ferramentas técnicas agrupadas. Use somente quando precisar diagnosticar rede ou sincronização.");
  el.append(tile("Central Multiusuário", "Visão geral das estações e compartilhamento.", () => ctx.go("estacoes")),
    tile("Sincronização Segura", "Fila offline, contingência e envio seguro.", () => ctx.go("admin/status-nuvem")),
    tile("Usuários Local ↔ Nuvem", "Conferência dos usuários entre bases.", () => ctx.go("usuarios")),
    tile("Saúde das Estações", "Diagnóstico de cada computador.", () => ctx.go("estacoes")),
    tile("Configurar Estação / Rede", "Parâmetros locais de conexão e estação.", soNoComputador("Configurar Estação / Rede")),
    tile("Status Nuvem", "Estado atual da nuvem e pendências.", () => ctx.go("admin/status-nuvem")));
}
async function ping() { const t0 = performance.now(); await api.fetchAuditByAction("PING_INEXISTENTE", 1); return Math.round(performance.now() - t0); }
function statusNuvem(el) {
  cab(el, "Status da Nuvem e Sincronização");
  const info = h("div", { class: "card", style: { whiteSpace: "pre-line", color: "#082d4e", lineHeight: "1.5" } }, "Verificando...");
  const b = h("button", { class: "btn dark" }, "ATUALIZAR STATUS");
  el.append(info, h("div", { class: "btns", style: { margin: "8px 0" } }, b), h("div", { class: "sub" }, "Fora da loja, a ponte do computador da loja pode aparecer sem sinal se o computador estiver desligado. Para trabalhar normalmente, o essencial é BASE PRINCIPAL — SUPABASE: ONLINE."));
  const refresh = async () => {
    info.textContent = "Verificando...";
    let cloud, ms = 0; try { ms = await ping(); cloud = "ONLINE (" + ms + " ms)"; } catch (e) { cloud = "OFFLINE / SEM SESSÃO — " + friendly(e); }
    let ponte = "SEM SINAL";
    try { const est = await api.fetchStationHealth(); const p = est.filter((x) => String(x.estacao || "").toUpperCase().startsWith("PONTE-MYMANAGER")).sort((a, b) => (toDate(b.ultimo_heartbeat) || 0) - (toDate(a.ultimo_heartbeat) || 0))[0];
      if (p) { const seg = (Date.now() - toDate(p.ultimo_heartbeat)) / 1000; ponte = (seg <= 180 ? "ONLINE" : "SEM SINAL HÁ " + (seg < 3600 ? Math.round(seg / 60) + " MIN" : Math.round(seg / 3600) + " H")) + " — " + p.computador + " (último sinal " + dt(p.ultimo_heartbeat) + ")"; } } catch {}
    info.textContent = "BASE PRINCIPAL — SUPABASE: " + cloud + "\n\nPONTE DA LOJA (MyManager / SQL Server): " + ponte + "\n\nPendências locais aguardando nuvem: 0 (o celular grava direto na nuvem)\nEstação: " + ctx.station + "   |   Usuário: " + ctx.session.nome + "   |   Unidade: " + ctx.unit.name;
  };
  b.onclick = refresh; refresh();
}

// ---------- Atualizações do Sistema (UpdateCenter) ----------
function atualizacoes(el) {
  cab(el, "Atualizações do Sistema");
  const info = h("div", { class: "card", style: { whiteSpace: "pre-line" } }, "Consultando...");
  el.append(h("div", { style: { fontSize: "17px", fontWeight: "700", color: "#082d4e" } }, "VERSÃO INSTALADA: V" + APP_VERSION), h("div", { class: "sub", style: { margin: "6px 0 10px" } }, "Canal automático: Supabase"),
    h("div", { class: "btns grid2", style: { marginBottom: "8px" } }, h("button", { class: "btn dark", onclick: () => verify(true) }, "VERIFICAR ATUALIZAÇÕES"), h("button", { class: "btn", onclick: () => ctx.go("estacoes") }, "COMPUTADORES E VERSÕES")), info,
    h("div", { class: "sub", style: { marginTop: "10px" } }, "O app do celular acompanha o sistema do computador: quando uma versão nova é publicada, o app se atualiza sozinho ao abrir. A publicação do pacote ZIP para os computadores continua sendo feita no sistema do computador."));
  const verify = async (manual) => {
    info.textContent = "Consultando...";
    const r = await api.fetchLatestRelease(); if (!r) { info.textContent = "Não foi possível localizar versões publicadas."; return; }
    const v = String(r.version || "").replace(/^[vV]+/, "");
    info.textContent = "Última versão no canal: V" + v + "\nPacote publicado: " + (String(r.download_url || "").trim() ? "SIM" : "NÃO") + "\nObrigatória: " + (r.mandatory ? "SIM" : "NÃO") + "\n\n" + (r.notes || "");
    if (api.compareVersions(v, APP_VERSION) > 0) { info.textContent += "\n\nO app ainda está na V" + APP_VERSION + ". A versão do app correspondente é instalada automaticamente assim que for liberada; feche e abra o app para receber."; if (manual) { try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch {} } }
    else info.textContent += "\n\nO app está em dia com o sistema.";
  };
  verify(false);
}

// ---------- Velocidade do Sistema ----------
function velocidade(el) {
  cab(el, "Velocidade do Sistema");
  el.append(h("div", { class: "sub", style: { marginBottom: "8px" } }, "Tempo para abrir cada tela neste aparelho (" + ctx.station + "), do toque até a tela ficar pronta. RÁPIDA = menos de 1 s, OK = 1 a 3 s, LENTA = 3 s ou mais."));
  const periodo = h("select", { class: "select" }, ...["Hoje", "Últimos 7 dias", "Últimos 30 dias"].map((t, i) => h("option", { value: String(i), selected: i === 1 }, t)));
  const enviar = h("button", { class: "btn dark" }, "ENVIAR MEDIÇÃO AGORA"), roteiro = h("button", { class: "btn" }, "ROTEIRO DE TESTE");
  const geral = h("div", { style: { fontWeight: "700", margin: "8px 0" } }), a1 = h("div", {}), a2 = h("div", {}), nota = h("div", { class: "sub", style: { marginTop: "6px" } });
  el.append(periodo, h("div", { class: "btns grid2", style: { margin: "8px 0" } }, enviar, roteiro), geral, a1, h("h3", { style: { color: "#082d4e", margin: "14px 0 6px" } }, "Outros computadores (resumos enviados à nuvem)"), a2, nota);
  const carregar = async () => {
    const i = Number(periodo.value), dias = i === 0 ? 0 : i === 1 ? 7 : 30; let lista = Vel.Ler(dias === 0 ? 1 : dias);
    if (dias === 0) { const h0 = new Date(); h0.setHours(0, 0, 0, 0); lista = lista.filter((m) => m.Quando >= h0); }
    const rs = Vel.Resumo(lista); a1.innerHTML = ""; a1.append(table(["Tela", "Vezes", "Tempo médio", "Mais lenta", "Situação"].map((k) => ({ k, t: k, right: k === "Vezes" })), rs));
    a1.querySelectorAll("tbody tr").forEach((tr, j) => { const s = rs[j]["Situação"], td = tr.children[4]; td.style.fontWeight = "700"; td.style.color = s === "LENTA" ? "#c81e1e" : s === "OK" ? "#b46e00" : "#1e823c"; });
    if (!lista.length) { geral.textContent = "Ainda não há medições neste período."; geral.style.color = ""; }
    else { const media = Math.trunc(lista.reduce((a, m) => a + m.Ms, 0) / lista.length), lentas = lista.filter((m) => m.Ms >= Vel.LentaMs).length; geral.textContent = "Geral: " + Vel.Situacao(media) + "  •  média " + Vel.Segundos(media) + "  •  " + lista.length + " aberturas  •  " + lentas + " lenta(s)"; geral.style.color = media >= Vel.LentaMs ? "#c81e1e" : media >= Vel.RapidaMs ? "#b46e00" : "#1e823c"; }
    try {
      const a = await api.fetchAuditByAction(Vel.AcaoNuvem, 200), t = a.map((r) => ({ Quando: dt(r.DataHora), Computador: r.EntidadeId, "Usuário": r.UsuarioNome, Resumo: r.Detalhes }));
      a2.innerHTML = ""; a2.append(table(["Quando", "Computador", "Usuário", "Resumo"].map((k) => ({ k, t: k })), t));
      a2.querySelectorAll("tbody tr").forEach((tr, j) => { if (String(t[j].Resumo).startsWith("Geral: LENTA")) tr.style.color = "#c81e1e"; });
      nota.textContent = "Cada computador envia um resumo a cada 2 horas de uso (ou na hora, pelo botão).";
    } catch (e) { nota.textContent = "Não foi possível ler os resumos da nuvem: " + friendly(e); }
  };
  periodo.onchange = carregar; roteiro.onclick = () => alertBox(Vel.Roteiro, "Roteiro de teste de velocidade");
  enviar.onclick = async () => {
    let t = Vel.RetirarParaEnvio(0, 1, true); if (t == null) t = Vel.TextoNuvem(Vel.Ler(1));
    if (!String(t || "").trim()) return alertBox("Ainda não há medições para enviar. Use o sistema normalmente (ou siga o roteiro de teste) e tente de novo.", "Velocidade do Sistema");
    await ctx.audit(Vel.AcaoNuvem, "DESEMPENHO", ctx.station, t); await alertBox("Medição enviada. Ela aparece na lista de outros computadores.", "Velocidade do Sistema"); carregar();
  };
  carregar();
}

// ---------- Saúde do sistema e autotestes (Health) ----------
function diagnostico(el) {
  cab(el, "Saúde do sistema e autotestes");
  const run = h("button", { class: "btn dark" }, "EXECUTAR DIAGNÓSTICO"), r = h("pre", { class: "card", style: { whiteSpace: "pre-wrap", fontSize: "13px", fontFamily: "ui-monospace,Consolas,monospace" } });
  el.append(h("div", { class: "btns", style: { marginBottom: "8px" } }, run), r);
  const test = async () => {
    r.textContent = "Executando..."; let sb = "DIAGNÓSTICO SISTEMA SÃO JOÃO " + APP_VERSION + " (celular)\n" + "=".repeat(54) + "\n", falhas = 0;
    try { const ms = await ping(); sb += "Supabase (base principal): OK — resposta em " + ms + " ms\n"; } catch (e) { sb += "Supabase (base principal): FALHA — " + friendly(e) + "\n"; falhas++; }
    try { const est = await api.fetchStationHealth(); const p = est.find((x) => String(x.estacao || "").toUpperCase().startsWith("PONTE-MYMANAGER")); const ok = p && (Date.now() - toDate(p.ultimo_heartbeat)) / 1000 <= 180; sb += "Ponte da loja (MyManager / SQL Server): " + (ok ? "OK — " + p.computador : "SEM SINAL — consultas do MyManager e Compras ficam indisponíveis até o computador da loja ligar") + "\n"; } catch { sb += "Ponte da loja: não foi possível verificar\n"; }
    try { const rows = await api.fetchPriceRows(ctx.unit.code === "PERSONALIZADOS" ? "PERSONALIZADOS" : "DECOR"); sb += "Configuração de preços (Valores / Produtos na nuvem): " + (rows && rows.length ? "OK — " + rows.length + " linha(s)" : "ATENÇÃO — tabela vazia") + "\n"; if (!rows || !rows.length) falhas++; } catch (e) { sb += "Configuração de preços: FALHA — " + friendly(e) + "\n"; falhas++; }
    sb += "Cortina e Toldo: cálculo nativo V" + APP_VERSION + " (não dependem do Excel).\n";
    try {
      const ref = new Precos("DECOR"); ref.project();
      const rc = calculateCurtain(ref, { Tecido1: "Linhão Corttex", Tecido2: "Corta Luz Bella/Corttex - Branco", Costura: "Juntos", Largura: 6, AltE: 2.86, AltD: 2.86, Barra: "Dupla", Fixacao: "Teto", Partes: "2", Modelo: "Padrão", Ferragem: "Trilho Suíço Duplo", Cut1: "Invertido", Bar1: "Normal", Cut2: "Invertido", Bar2: "Normal" });
      const f = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const rok = !rc.Pendencias.length && Math.abs(rc.Subtotal - 3535.76) < 0.005 && Math.abs(rc.Aprazo - 3930) < 0.005 && Math.abs(rc.Avista - 3733.5) < 0.005;
      sb += "Cortina — caso de referência da planilha (3.535,76 / 3.930,00 / 3.733,50): " + (rok ? "OK" : "FALHA — " + f(rc.Subtotal) + " / " + f(rc.Aprazo) + " / " + f(rc.Avista)) + "\n"; if (!rok) falhas++;
    } catch (e) { sb += "Motores nativos: FALHA — " + e.message + "\n"; falhas++; }
    sb += "Armazenamento do aparelho: " + (navigator.storage?.estimate ? await navigator.storage.estimate().then((x) => Math.round((x.usage || 0) / 1048576) + " MB usados").catch(() => "?") : "?") + "\n";
    sb += "Atualização automática do app: " + ("serviceWorker" in navigator && navigator.serviceWorker.controller ? "ATIVA" : "será ativada ao reabrir o app") + "\n";
    sb += "\nRESULTADO: " + (falhas === 0 ? "SISTEMA PRONTO — nenhum problema detectado." : falhas + " ponto(s) precisam de atenção.") + "\nEste diagnóstico não altera orçamentos, pedidos ou preços.";
    r.textContent = sb; ctx.audit("DIAGNOSTICO", "Sistema", "", falhas === 0 ? "OK" : "Falhas: " + falhas);
  };
  run.onclick = test; test();
}

// ---------- Lixeira e Exclusões (RecycleBinCenter) ----------
async function lixeira(el) {
  cab(el, "Lixeira e Exclusões", "Rastreabilidade de exclusões. Registros comerciais principais permanecem protegidos por auditoria e não são apagados silenciosamente.");
  const area = h("div", {}); el.append(area, h("div", { style: { color: "darkred", marginTop: "10px", fontSize: "13px" } }, "Proteção V21: exclusões ficam registradas com usuário, data, estação e referência. Para clientes, orçamentos e pedidos, a política recomendada é CANCELAR/ARQUIVAR em vez de apagar fisicamente."));
  try { const a = (await api.fetchAudit("EXCLUIR")).map((r) => ({ ...r, DataHora: dt(r.DataHora) })); area.append(table(["DataHora", "UsuarioNome", "Acao", "Entidade", "EntidadeId", "Detalhes", "Computador"].map((k) => ({ k, t: k })), a)); }
  catch (e) { alertBox(friendly(e), "Lixeira"); }
}

register("admin", (el, arg) => {
  if (!ctx.isAdmin) { el.append(h("div", { class: "card", style: { color: "darkred" } }, "Acesso restrito ao Administrador.")); return; }
  const a = String(arg || "");
  if (a === "painel") return painel(el); if (a === "evolucao") return evolucao(el); if (a === "sistema") return sistema(el); if (a === "status-nuvem") return statusNuvem(el);
  return sistema(el);
});
register("atualizacoes", atualizacoes);
register("velocidade", velocidade);
register("diagnostico", diagnostico);
register("auditoria/lixeira", lixeira);
export { EditMonthlyGoal };
