// Espelho do myManager na nuvem. O computador da loja lê o myManager (Firebird, isql) e grava
// cada conjunto (faturamento, gavetas, contas, comissões...) na tabela sj_mymanager_espelho.
// O app só lê. Enquanto a ponte não estiver ligada, as telas avisam que aguardam o computador da loja.
import * as api from "../api.js";

const cache = new Map();
export async function lerEspelho(conjunto, unit) {
  const code = unit.code === "PERSONALIZADOS" ? "PERSONALIZADOS" : "DECOR"; // MyManagerCode do BusinessUnit.cs
  const k = conjunto + ":" + code; const c = cache.get(k);
  if (c && Date.now() - c.t < 60000) return c.v;
  try {
    const d = await api.lerDocumentoCompleto(code, conjunto); const arr = d ? [d] : [];
    const v = arr && arr[0] ? { rows: Array.isArray(arr[0].dados) ? arr[0].dados : arr[0].dados?.rows || [], meta: arr[0].dados, at: arr[0].atualizado_em } : null;
    cache.set(k, { t: Date.now(), v }); return v;
  } catch { cache.set(k, { t: Date.now(), v: null }); return null; }
}
