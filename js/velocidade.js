// Velocidade.cs: mede quanto tempo cada tela leva para abrir neste aparelho (do toque até a tela pronta).
// As medições ficam no celular e, a cada 2 horas de uso, um resumo vai para a nuvem (auditoria VELOCIDADE).
export const RapidaMs = 1000, LentaMs = 3000, AcaoNuvem = "VELOCIDADE";
const CH = "sj_velocidade", CH_ENV = "sj_velocidade_envio";
const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export function Registrar(tela, ms) {
  const l = ler(CH, []); l.push({ q: Date.now(), t: tela, ms: Math.round(ms) });
  const corte = Date.now() - 31 * 86400000; gravar(CH, l.filter((m) => m.q >= corte).slice(-5000));
  const p = ler(CH_ENV, { ultimo: Date.now(), nao: [] }); p.nao.push({ q: Date.now(), t: tela, ms: Math.round(ms) }); if (p.nao.length > 5000) p.nao.splice(0, 1000); gravar(CH_ENV, p);
}
export function Ler(dias) { const desde = Date.now() - dias * 86400000; return ler(CH, []).filter((m) => m.q >= desde).map((m) => ({ Quando: new Date(m.q), Tela: m.t, Ms: m.ms })); }
export const Situacao = (media) => (media < RapidaMs ? "RÁPIDA" : media < LentaMs ? "OK" : "LENTA");
export const Segundos = (ms) => (ms / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " s";
export function Resumo(med) {
  const g = new Map(); for (const m of med) { const k = String(m.Tela).toLowerCase(); if (!g.has(k)) g.set(k, { Tela: m.Tela, l: [] }); g.get(k).l.push(m.Ms); }
  return [...g.values()].map((x) => { const media = Math.trunc(x.l.reduce((a, b) => a + b, 0) / x.l.length), max = Math.max(...x.l); return { Tela: x.Tela, Vezes: x.l.length, "Tempo médio": Segundos(media), "Mais lenta": Segundos(max), "Situação": Situacao(media), MediaMs: media }; }).sort((a, b) => b.MediaMs - a.MediaMs);
}
export function TextoNuvem(med) {
  if (!med.length) return ""; const media = Math.trunc(med.reduce((a, m) => a + m.Ms, 0) / med.length), lentas = med.filter((m) => m.Ms >= LentaMs).length;
  let s = "Geral: " + Situacao(media) + " | média " + Segundos(media) + " | " + med.length + " aberturas | " + lentas + " lenta(s)";
  for (const r of Resumo(med)) { const parte = " || " + r.Tela + ": " + r["Tempo médio"] + " (máx " + r["Mais lenta"] + ", " + r.Vezes + "x)"; if (s.length + parte.length > 1700) break; s += parte; }
  return s;
}
export function RetirarParaEnvio(intervaloMs, minimo, forcar) {
  const p = ler(CH_ENV, { ultimo: Date.now(), nao: [] });
  if (!p.nao.length || (!forcar && (p.nao.length < minimo || Date.now() - p.ultimo < intervaloMs))) return null;
  const t = TextoNuvem(p.nao.map((m) => ({ Tela: m.t, Ms: m.ms }))); gravar(CH_ENV, { ultimo: Date.now(), nao: [] }); return t;
}
export const Roteiro = "ROTEIRO RÁPIDO PARA CONFERIR A VELOCIDADE (faça em cada computador)\n\n1. Abra o sistema e entre com seu usuário.\n2. Abra o Início e espere os números aparecerem.\n3. Abra Clientes, Orçamentos, Pedidos, Agenda e Financeiro, uma de cada vez.\n4. Abra Relatórios e gere o relatório de comissões do mês.\n5. Volte ao Início e repita os passos 3 e 4 mais uma vez.\n6. Abra Administração > Velocidade do Sistema e veja a coluna Situação.\n\nRÁPIDA = menos de 1 segundo.  OK = de 1 a 3 segundos.  LENTA = 3 segundos ou mais.\nSe alguma tela ficar LENTA, clique em \"Enviar medição agora\" e avise o suporte.";

// Chamado pelo roteador: mede do toque até a tela terminar de montar (e a rede ficar livre).
export function medirTela(content, promessa) {
  const t0 = performance.now();
  Promise.resolve(promessa).finally(() => {
    const fim = () => { const nome = content.querySelector("h1")?.textContent?.trim() || "Tela sem título"; Registrar(nome, performance.now() - t0); };
    // Espera os dados da tela chegarem (nenhuma consulta em andamento por 2 verificações seguidas), até 20 s.
    let livres = 0; const espera = () => { if (performance.now() - t0 > 20000 || (!(globalThis.__sjRede > 0) && ++livres >= 2)) { if ("requestIdleCallback" in window) requestIdleCallback(fim, { timeout: 4000 }); else setTimeout(fim, 0); } else { if (globalThis.__sjRede > 0) livres = 0; setTimeout(espera, 60); } };
    espera();
  });
}
