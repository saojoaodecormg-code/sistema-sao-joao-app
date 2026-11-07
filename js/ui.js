// Utilidades de tela: equivalem ao MessageBox, às janelas de diálogo e aos formatos pt-BR do PC.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (v) => BRL.format(Number(v || 0));
export const num2 = (v) => NUM.format(Number(v || 0));
export function parseMoney(s) {
  s = String(s ?? "").trim().replace(/R\$\s?/i, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s); if (Number.isNaN(n)) throw new Error("Valor numérico inválido: " + s); return n;
}
// Datas: "aaaa-mm-dd" é dia (sem fuso), o resto é instante.
export function toDate(v) {
  if (!v) return null; if (v instanceof Date) return v;
  const s = String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  const d = new Date(s); return isNaN(d) ? null : d;
}
export const dayOnly = (d) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null);
export const today = () => dayOnly(new Date());
export const fmtDate = (v) => { const d = toDate(v); return d ? d.toLocaleDateString("pt-BR") : ""; };
export const fmtDateTime = (v) => { const d = toDate(v); return d ? d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""; };
export const isoDay = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export function parseBrDate(s) {
  s = String(s || "").trim(); if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (m) { let y = +m[3]; if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1]); if (!isNaN(d)) return d; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  throw new Error("Data inválida: " + s);
}

export function toast(msg, ms = 2600) {
  const t = h("div", { class: "toast" }, msg); document.body.append(t); setTimeout(() => t.remove(), ms);
}

// Janela de diálogo. Devolve Promise com o valor passado em close().
export function modal(title, build, { wide } = {}) {
  return new Promise((resolve) => {
    const bg = h("div", { class: "modal-bg" });
    const body = h("div", { class: "modal-b" });
    const foot = h("div", { class: "modal-f" });
    const close = (v) => { bg.remove(); document.body.style.overflow = ""; resolve(v); };
    const box = h("div", { class: "modal", style: wide ? { maxWidth: "900px" } : null },
      h("div", { class: "modal-h" }, h("h2", {}, title), h("button", { class: "x", "aria-label": "Fechar", onclick: () => close(undefined) }, "×")), body, foot);
    bg.append(box); bg.addEventListener("click", (e) => { if (e.target === bg) close(undefined); });
    document.body.append(bg); document.body.style.overflow = "hidden";
    build({ body, foot, close });
    if (!foot.childNodes.length) foot.remove();
  });
}
export function alertBox(msg, title = "Sistema São João") {
  return modal(title, ({ body, foot, close }) => { body.append(h("p", { style: { whiteSpace: "pre-line" } }, msg)); foot.append(h("button", { class: "btn dark", onclick: () => close(true) }, "OK")); });
}
export function confirmBox(msg, title = "Confirmar", yes = "Sim", no = "Não") {
  return modal(title, ({ body, foot, close }) => { body.append(h("p", { style: { whiteSpace: "pre-line" } }, msg)); foot.append(h("button", { class: "btn", onclick: () => close(false) }, no), h("button", { class: "btn dark", onclick: () => close(true) }, yes)); }).then((v) => !!v);
}
export function formModal(title, fields, { okText = "SALVAR", cancelText = "CANCELAR", validate, intro } = {}) {
  return modal(title, ({ body, foot, close }) => {
    if (intro) body.append(intro);
    const inputs = {};
    for (const f of fields) {
      if (f.type === "note") { body.append(h("p", { style: { color: "#6b7280", fontSize: "13px" } }, f.text)); continue; }
      const id = "f_" + f.name;
      let inp;
      if (f.type === "select") { inp = h("select", { class: "select", id }, ...(f.options || []).map((o) => h("option", { value: o, selected: String(o) === String(f.value ?? "") }, o))); }
      else if (f.type === "combo") { const dl = "dl_" + f.name; inp = h("input", { class: "input", id, list: dl, value: f.value ?? "", autocomplete: "off" }); body.append(h("datalist", { id: dl }, ...(f.options || []).map((o) => h("option", { value: o })))); }
      else if (f.type === "textarea") inp = h("textarea", { class: "input", id, rows: f.rows || 3 }, f.value ?? "");
      else if (f.type === "checkbox") { inp = h("input", { type: "checkbox", id, checked: !!f.value }); body.append(h("label", { class: "lbl", style: { display: "flex", gap: "8px", alignItems: "center" } }, inp, f.label)); inputs[f.name] = inp; continue; }
      else inp = h("input", { class: "input", id, type: f.type || "text", value: f.value ?? "", inputmode: f.inputmode, placeholder: f.placeholder || "", autocomplete: "off" });
      inputs[f.name] = inp;
      body.append(h("label", { class: "lbl", for: id }, f.label), inp);
    }
    const err = h("div", { class: "login-err" }); body.append(err);
    const read = () => { const o = {}; for (const [k, i] of Object.entries(inputs)) o[k] = i.type === "checkbox" ? i.checked : i.value; return o; };
    foot.append(h("button", { class: "btn", onclick: () => close(null) }, cancelText),
      h("button", { class: "btn primary", onclick: async (e) => { const v = read(); try { e.target.disabled = true; if (validate) await validate(v, inputs); close(v); } catch (ex) { err.textContent = ex.message; e.target.disabled = false; } } }, okText));
    const first = Object.values(inputs)[0]; if (first && !matchMedia("(pointer:coarse)").matches) setTimeout(() => first.focus(), 50);
  });
}

export function statusText(st) {
  const s = String(st || "").trim().toUpperCase();
  if (s === "ORÇAMENTO" || s === "ORCAMENTO") return "Em aberto"; if (s === "APROVADO") return "Aprovado"; if (s === "ACOMPANHAR") return "Retornar";
  if (s === "NEGADO" || s === "PERDIDO") return "Perdido"; if (s === "CANCELADO") return "Cancelado";
  return s ? s[0] + s.slice(1).toLowerCase() : "";
}
export function statusColor(st) {
  const s = String(st || "").trim().toUpperCase();
  if (["APROVADO", "ENTREGUE", "FINALIZADO"].includes(s)) return [10, 122, 65];
  if (s === "ACOMPANHAR") return [138, 82, 0];
  if (["NEGADO", "PERDIDO", "CANCELADO"].includes(s)) return [96, 110, 124];
  return [21, 89, 166];
}
export function tag(text, rgb) {
  const [r, g, b] = rgb; const bg = `rgb(${Math.min(255, r / 8 + 226)},${Math.min(255, g / 8 + 226)},${Math.min(255, b / 8 + 226)})`;
  return h("span", { class: "tag", style: { background: bg, color: `rgb(${r},${g},${b})` } }, text);
}
export const statusTag = (st) => tag(statusText(st), statusColor(st));

export function firstName(n) { const f = String(n || "").trim().split(/\s+/)[0] || ""; return f ? f[0].toUpperCase() + f.slice(1).toLowerCase() : ""; }
export function initials(n) { n = String(n || "").trim(); return (n.length >= 2 ? n.slice(0, 2) : n).toUpperCase(); }
export function onlyDigits(s) { return String(s || "").replace(/\D/g, ""); }
export function whatsappLink(phone, text) {
  let d = onlyDigits(phone); if (!d) return null; if (d.length <= 11) d = "55" + d;
  return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
}
export function friendly(e) {
  if (!e) return "Erro desconhecido."; const m = e.message || String(e);
  if (/Failed to fetch|NetworkError|sem conexão/i.test(m)) return "Sem conexão com a internet. Verifique o sinal e tente de novo.";
  return m;
}

// Ícones do menu (linhas simples, como os do MainForm.MenuIcon).
const P = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9c0-4 4-6 8-6s8 2 8 6",
  doc: "M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h4",
  box: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
  chart: "M3 20h18M5 16l5-5 4 4 6-7",
  production: "M4 4h4v16H4zM10 4h4v6h-4zM16 4h4v10h-4z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  cart: "M3 4h2l2 11h11l2-8H6M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01",
  money: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3 6c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2.2 0 3 6 1.6 6 4.6 0 1.4-1.4 2.2-3 2.2-1.5 0-2.6-.6-3.1-1.6M12 6v12",
  report: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  users: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6M2 20c0-3 3-5 6-5s6 2 6 5M16 15c3 0 6 2 6 5",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  health: "M3 12h4l2-5 4 10 2-5h6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16l-4-4",
  menu: "M4 6h16M4 12h16M4 18h16",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  person: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6",
};
export function icon(name, size = 20, stroke = "currentColor") {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("fill", "none"); s.setAttribute("stroke", stroke); s.setAttribute("stroke-width", "1.7"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", P[name] || P.doc); s.append(p); return s;
}
