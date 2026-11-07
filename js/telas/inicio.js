// Início (ModernDashboard2026.cs): banner da unidade, saudação, quatro números, "Precisa de atenção" e agenda de hoje.
import * as api from "../api.js";
import { ctx, register } from "../app.js";
import { h, money, toDate, today, tag, friendly } from "../ui.js";
import { lerFaturamento } from "../mym_fat.js";

const OPEN = (st) => { const s = String(st || "").trim().toUpperCase(); return s === "ORÇAMENTO" || s === "ORCAMENTO" || s === "ACOMPANHAR"; };

register("inicio", async (el) => {
  const u = ctx.unit;
  const banner = { DECOR: "img/banner_decor.jpg", PERSONALIZADOS: "img/banner_personalizados.jpg", FA_COLCHOES: "img/banner_fa.jpg" }[u.code];
  const hr = new Date().getHours(); const saud = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  let dia = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }); dia = dia[0].toUpperCase() + dia.slice(1);
  const nome = String(ctx.session.nome || "").trim().split(/\s+/)[0] || "";
  const nomeFmt = nome ? nome[0].toUpperCase() + nome.slice(1).toLowerCase() : "";
  el.append(
    h("div", { class: "banner" }, h("img", { src: banner, alt: u.name })),
    h("div", { class: "page-h" }, h("div", {}, h("h1", {}, saud + (nomeFmt ? ", " + nomeFmt : "")), h("div", { class: "sub" }, dia + "  ·  " + u.name)),
      h("div", { class: "btns" }, h("button", { class: "btn", onclick: () => ctx.go("clientes/novo") }, "Novo cliente"), h("button", { class: "btn primary", onclick: () => ctx.go("orcamentos") }, "+ Novo orçamento"))));
  const kpis = h("div", { class: "kpis" }); el.append(kpis);
  const att = h("div", { class: "card" }, h("div", { class: "l1", style: { display: "flex", justifyContent: "space-between" } }, h("h3", {}, "Precisa de atenção"), h("a", { href: "#/historico" }, "Ver tudo")), h("div", { class: "loading" }, "Carregando..."));
  const ag = h("div", { class: "card" }, h("div", { style: { display: "flex", justifyContent: "space-between" } }, h("h3", {}, "Instalações e entregas de hoje"), h("a", { href: "#/agenda" }, "Agenda")), h("div", { class: "loading" }, "Carregando..."));
  el.append(att, ag);

  const kpi = (t, v, s, color, go) => h("div", { class: "kpi", style: go ? { cursor: "pointer" } : null, onclick: go }, h("div", { class: "t" }, t), h("div", { class: "v" }, v), s ? h("div", { class: "s", style: color ? { color } : null }, s) : null);
  try {
    const [q, o, goal] = await Promise.all([
      api.fetchQuotes("", "TODOS", u), api.fetchOrders("", "", u),
      api.fetchMonthlyGoal(u.code, new Date().toISOString().slice(0, 7)).catch(() => 0),
    ]);
    const now = new Date(); let open = 0, openVal = 0, vencem = 0, monthQ = 0, monthAp = 0;
    const t0 = today(), wk = new Date(t0); wk.setDate(wk.getDate() + 7);
    for (const r of q) {
      if (OPEN(r.Status)) { open++; openVal += r.Valor; const v = toDate(r.ValidadeAte); if (v && v >= t0 && v <= wk) vencem++; }
      const d = toDate(r.DataHora); if (d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) { monthQ++; if (/APROVADO|FATURADO/i.test(r.Status)) monthAp++; }
    }
    const conv = monthQ > 0 ? Math.round((100 * monthAp) / monthQ) : -1;
    const mes = now.toLocaleDateString("pt-BR", { month: "long" });
    // Faturamento direto do myManager da loja (MyManagerFaturamento.Ler), sem segurar o resto da tela.
    const kFat = kpi("Faturado hoje", "…", "Consultando o myManager da loja");
    const kConv = kpi("Conversão do mês", conv >= 0 ? conv + "%" : "—", null);
    const kMeta = kpi("Meta de " + mes, "—", goal > 0 ? "Meta: " + money(goal) : "Meta do mês não definida", goal > 0 ? null : "#b45309");
    kpis.append(kFat,
      kpi("Orçamentos em aberto", String(open), vencem > 0 ? (vencem === 1 ? "1 vence esta semana" : vencem + " vencem esta semana") : money(openVal).replace(/,\d\d$/, "") + " em propostas", vencem > 0 ? "#b91c1c" : null, () => ctx.go("historico")),
      kConv, kMeta);
    lerFaturamento(u).then((fat) => {
      const troca = (el, n) => el.replaceWith(n);
      if (!fat.Ok) { troca(kFat, kpi("Faturado hoje", "—", "Aguardando o myManager da loja")); return; }
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      troca(kFat, kpi("Faturado hoje", money(fat.TotalHoje), "Atualiza pelo myManager da loja · " + hora));
      troca(kConv, kpi("Conversão do mês", conv >= 0 ? conv + "%" : "—", money(fat.TotalMes).replace(/,\d\d$/, "") + " faturados no mês", fat.TotalMes > 0 ? "#15803d" : null));
      const pct = goal > 0 ? Math.round((100 * fat.TotalMes) / goal) : null;
      troca(kMeta, kpi("Meta de " + mes, goal > 0 ? pct + "%" : "—", goal > 0 ? "Meta: " + money(goal) : "Meta do mês não definida", goal > 0 ? null : "#b45309"));
    });

    // Precisa de atenção (DashAttention)
    const items = [];
    const persol = q.filter((r) => r.Numero.toUpperCase().startsWith("PERSOL-") && OPEN(r.Status) && r.Resumo.includes("<SJ_PERSOL_PEDIDO>"));
    if (persol.length) items.push([persol.length === 1 ? persol[0].Numero + " virou pedido" : persol.length + " orçamentos Persol viraram pedido", "Confirmar valores e escolher o vendedor", "Persol", [194, 65, 12], "historico"]);
    let venc = 0, hoje = 0, venc3 = 0, pv = "", ph = "", p3 = ""; const t3 = new Date(t0); t3.setDate(t3.getDate() + 3);
    for (const r of q) {
      if (!OPEN(r.Status)) continue;
      const ret = toDate(r.RetornarEm); if (ret) { if (ret < t0) { venc++; pv ||= r.Cliente; } else if (+ret === +t0) { hoje++; ph ||= r.Cliente; } }
      const v = toDate(r.ValidadeAte); if (v && v >= t0 && v <= t3) { venc3++; p3 ||= r.Numero + " · " + r.Cliente; }
    }
    if (venc) items.push([venc === 1 ? "1 retorno vencido" : venc + " retornos vencidos", venc === 1 ? pv : pv + " e outros", "Retorno", [198, 40, 40], "historico/atrasados"]);
    if (hoje) items.push([hoje === 1 ? "1 retorno para hoje" : hoje + " retornos para hoje", hoje === 1 ? ph : ph + " e outros", "Hoje", [184, 107, 0], "historico/hoje"]);
    if (venc3) items.push([venc3 === 1 ? "1 orçamento vence em até 3 dias" : venc3 + " orçamentos vencem em até 3 dias", p3, "Validade", [21, 89, 166], "historico"]);
    let atr = 0, pa = "";
    for (const r of o) { const st = r.Status.toUpperCase(); if (["CANCELADO", "FINALIZADO", "ENTREGUE"].includes(st) || r.DataEntrega) continue; const p = toDate(r.PrevisaoEntrega); if (p && p < t0) { atr++; pa ||= r.Cliente; } }
    if (atr) items.push([atr === 1 ? "1 pedido com entrega atrasada" : atr + " pedidos com entrega atrasada", atr === 1 ? pa : pa + " e outros", "Atrasado", [198, 40, 40], "pedidos"]);
    att.lastChild.remove();
    if (!items.length) att.append(h("div", { class: "ok-line" }, "✓  Tudo em dia. Nada pendente agora."));
    else att.append(h("div", { class: "list" }, items.map(([t, d, tg, c, go]) => h("button", { class: "item", onclick: () => ctx.go(go) }, h("div", { class: "l1" }, h("span", {}, t), tag(tg, c)), h("div", { class: "l2" }, d)))));
  } catch (e) { kpis.append(h("div", { class: "note", style: { gridColumn: "1/-1" } }, friendly(e))); att.lastChild.textContent = ""; }

  try {
    const ev = await api.fetchAgenda(u.code); const t0 = today(); const list = [];
    for (const r of ev) { const d = toDate(r.DataHora); if (!d || +new Date(d.getFullYear(), d.getMonth(), d.getDate()) !== +t0) continue;
      const done = /CONCLU/i.test(r.Status); const text = (r.Tipo || r.Titulo) + (r.Cliente ? " · " + r.Cliente : r.Tipo && r.Titulo ? " · " + r.Titulo : "");
      list.push([d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), text, done ? "Concluído" : d < new Date() ? "Atrasado" : "Agendado", done ? [10, 122, 65] : d < new Date() ? [198, 40, 40] : [61, 82, 102]]); }
    ag.lastChild.remove();
    if (!list.length) ag.append(h("div", { class: "empty", style: { padding: "8px 0", textAlign: "left" } }, "Nenhum compromisso para hoje."));
    else ag.append(h("div", { class: "list" }, list.map(([t, x, s, c]) => h("div", { class: "item" }, h("div", { class: "l1" }, h("span", {}, t + "  " + x), tag(s, c))))));
  } catch (e) { ag.lastChild.textContent = friendly(e); }
});
