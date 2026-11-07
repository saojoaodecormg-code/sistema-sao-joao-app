// Motor de planilha: executa as fórmulas transpiladas com a mesma semântica do Excel
// (célula vazia = 0 ou "", texto > número nas comparações, SUM/MAX ignoram texto, erros se propagam).
export class XErr { constructor(code) { this.code = code; } toString() { return this.code; } }
const err = (c) => { throw new XErr(c); };
const isRange = (x) => x && x.__range;
function N(x) {
  if (x == null) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "boolean") return x ? 1 : 0;
  if (isRange(x)) { if (x.v.length === 1) return N(x.v[0]); err("#VALUE!"); }
  const t = String(x).trim(); if (t !== "" && isFinite(Number(t))) return Number(t);
  err("#VALUE!");
}
function B(x) {
  if (x == null) return false;
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  if (isRange(x)) return B(x.v[0]);
  const t = String(x).toUpperCase(); if (t === "TRUE") return true; if (t === "FALSE") return false; err("#VALUE!");
}
const rank = (x) => (typeof x === "number" ? 0 : typeof x === "string" ? 1 : 2);
function C(a, b, op) {
  if (isRange(a)) a = a.v[0]; if (isRange(b)) b = b.v[0];
  if (a == null && b == null) { a = 0; b = 0; }
  if (a == null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b == null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  let c;
  if (rank(a) !== rank(b)) c = rank(a) - rank(b);
  else if (typeof a === "string") { const x = a.toUpperCase(), y = b.toUpperCase(); c = x < y ? -1 : x > y ? 1 : 0; }
  else { const x = Number(a), y = Number(b); c = Math.abs(x - y) <= 1e-15 * Math.max(Math.abs(x), Math.abs(y)) ? 0 : x < y ? -1 : 1; }
  return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
}
const txt = (x) => (x == null ? "" : typeof x === "boolean" ? (x ? "TRUE" : "FALSE") : typeof x === "number" ? String(Number(x.toPrecision(15))) : isRange(x) ? txt(x.v[0]) : String(x));
const S = (a, b) => txt(a) + txt(b);
const DV = (a, b) => { const d = N(b); if (d === 0) err("#DIV/0!"); return N(a) / d; };
function nums(args, strictDirect) {
  const out = [];
  for (const a of args) {
    if (isRange(a)) { for (const v of a.v) if (typeof v === "number") out.push(v); }
    else if (a != null) out.push(N(a));
  }
  return out;
}
const F = {
  SUM: (...a) => nums(a).reduce((s, v) => s + v, 0),
  MAX: (...a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  MIN: (...a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
  COUNT: (...a) => { let c = 0; for (const x of a) { if (isRange(x)) { for (const v of x.v) if (typeof v === "number") c++; } else if (typeof x === "number") c++; } return c; },
  ABS: (x) => Math.abs(N(x)),
  ROUND: (x, d) => { const p = Math.pow(10, N(d)), v = N(x); return (Math.sign(v) * Math.round(Math.abs(v) * p + 1e-9)) / p; },
  ROUNDUP: (x, d) => { const p = Math.pow(10, N(d)), v = N(x); return (Math.sign(v) * Math.ceil(Math.round(Math.abs(v) * p * 1e9) / 1e9)) / p; },
  ROUNDDOWN: (x, d) => { const p = Math.pow(10, N(d)), v = N(x); return (Math.sign(v) * Math.floor(Math.round(Math.abs(v) * p * 1e9) / 1e9)) / p; },
};
// mod = { CONST, MERGED, FORMULAS }; sets = { "Folha!A1": valor } (null limpa a célula)
export function planilha(mod, sets) {
  const own = new Map(), memo = new Map(), busy = new Set();
  for (const [k, v] of Object.entries(sets || {})) own.set(mod.MERGED[k] || k, v);
  function V(k) {
    if (own.has(k)) return own.get(k);
    if (memo.has(k)) { const m = memo.get(k); if (m instanceof XErr) throw m; return m; }
    const f = mod.FORMULAS[k];
    if (!f) return mod.CONST[k] ?? null;
    if (busy.has(k)) err("#CIRC!");
    busy.add(k);
    try { let v = f(V, R, N, B, C, S, DV, F); if (isRange(v)) v = v.v[0]; if (v === undefined || v === null) v = 0; memo.set(k, v); return v; }
    catch (e) { if (e instanceof XErr) { memo.set(k, e); throw e; } throw e; }
    finally { busy.delete(k); }
  }
  const R = (cells) => ({ __range: true, v: cells.map(V) });
  return { get: (k) => { try { return V(k); } catch (e) { if (e instanceof XErr) return e; throw e; } } };
}
