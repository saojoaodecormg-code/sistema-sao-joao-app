// Visualizar / imprimir orçamento. Abre uma página pronta para imprimir ou salvar em PDF pelo celular.
import { ctx } from "../app.js";
import { money, fmtDate } from "../ui.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function printQuote(r) {
  const logo = { DECOR: "img/logo_decor.png", PERSONALIZADOS: "img/logo_personalizados.png", FA_COLCHOES: "img/logo_fa.png" }[ctx.unit.code];
  const resumo = String(r.Resumo || "").replace(/<SJ_[A-Z_]+>[\s\S]*?<\/SJ_[A-Z_]+>/g, "").replace(/<SJ_[A-Z_]+>/g, "").trim();
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.Numero)}</title>
<style>body{font-family:"Segoe UI",system-ui,Arial,sans-serif;color:#111827;margin:0;padding:24px;background:#fff}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${ctx.unit.accent};padding-bottom:12px}
header img{height:70px}h1{font-size:20px;margin:0}.muted{color:#6b7280}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}td{padding:6px 0;border-bottom:1px solid #e5e7eb}td:last-child{text-align:right;font-weight:600}
pre{white-space:pre-wrap;font-family:inherit;background:#f9fafb;padding:12px;border-radius:8px;font-size:14px}.total{font-size:22px;font-weight:800;text-align:right;margin-top:14px}
.bar{position:sticky;top:0;background:#fff;padding:8px 0;display:flex;gap:8px}.bar button{height:40px;padding:0 16px;border-radius:8px;border:0;background:#05385b;color:#fff;font-weight:700}@media print{.bar{display:none}body{padding:0}}</style></head>
<body><div class="bar"><button onclick="print()">Imprimir / Salvar PDF</button><button onclick="close()" style="background:#e5e7eb;color:#111">Fechar</button></div>
<header><img src="${logo}" alt=""><div style="text-align:right"><h1>Orçamento ${esc(r.Numero)}</h1><div class="muted">${esc(fmtDate(r.DataHora))}</div></div></header>
<table><tr><td>Cliente</td><td>${esc(r.Cliente)}</td></tr><tr><td>Produto</td><td>${esc(r.Tipo)}</td></tr><tr><td>Vendedor</td><td>${esc(r.Vendedor)}</td></tr><tr><td>Validade</td><td>${esc(fmtDate(r.ValidadeAte) || "–")}</td></tr></table>
${resumo ? `<h3>Descrição</h3><pre>${esc(resumo)}</pre>` : ""}<div class="total">Total: ${esc(money(r.Valor))}</div>
<p class="muted" style="margin-top:30px;font-size:12px">${esc(ctx.unit.name)} · Loja São João · Desde 1950</p></body></html>`;
  const w = window.open("", "_blank"); if (!w) return;
  w.document.open(); w.document.write(html.replace(/src="img\//g, 'src="' + location.href.split("#")[0].replace(/[^/]*$/, "") + "img/")); w.document.close();
}
