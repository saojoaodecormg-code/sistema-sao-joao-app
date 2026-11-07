// Telas que ainda estão sendo copiadas do sistema do PC. Mostram o nome real da tela e o que falta.
import { ctx, register } from "../app.js";
import { h } from "../ui.js";
import { APP_VERSION } from "../config.js";

const NOMES = {
  orcamentos: "Novo orçamento", comercial: "Comercial", compras: "Compras", financeiro: "Financeiro", relatorios: "Relatórios", usuarios: "Usuários e Permissões",
  diagnostico: "Diagnóstico", "consulta-produtos": "Consultar produtos", persol: "Integração Persol", auditoria: "Auditoria e Exclusões", valores: "Valores / Produtos",
  "historico-precos": "Histórico de Preços", atualizacoes: "Atualizações do Sistema", estacoes: "Computadores e Versões", velocidade: "Velocidade do Sistema", sobre: "Sobre / Versão",
  "orc/cortina": "Cortina sob medida", "orc/persiana": "Persianas", "orc/toldo": "Toldo retrátil", "orc/policarbonato": "Cobertura policarbonato", "orc/mosquiteira": "Tela mosquiteira",
  "orc/papel": "Papel de Parede", "orc/tapete": "Tapete personalizado", "orc/ambientes": "Orçamento por ambientes", "orc/impressao": "Orçamento Impressão", "orc/laser": "Orçamento Laser CO²",
  "orc/gravacao": "Orçamento Laser - Gravação", "orc/bordado": "Orçamento Bordado", "orc/fa": "FA Colchões", "fa/painel": "Painel FA", costura: "Ordem de Costura",
  "admin/painel": "Painel Executivo", "admin/evolucao": "Central Evolução 2026", "admin/sistema": "Sistema e Sincronização",
};
const MYM = ["financeiro", "comercial", "compras", "relatorios", "fa/painel"];

register("pendente", (el, arg, key) => {
  const raw = decodeURIComponent((location.hash || "").slice(2));
  const k = Object.keys(NOMES).find((n) => raw === n || raw.startsWith(n + "/")) || raw.split("/")[0];
  const nome = NOMES[k] || "Tela";
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, nome), h("div", { class: "sub" }, ctx.unit.name))),
    h("div", { class: "info" }, "Esta tela está sendo copiada do Sistema São João V" + APP_VERSION + " e chega numa das próximas atualizações do app, que acontecem sozinhas."),
    MYM.includes(k) ? h("p", { class: "note", style: { marginTop: "10px" } }, "Ela usa números do myManager, que vão aparecer aqui assim que o computador da loja começar a copiá-los para a nuvem.") : null,
    h("div", { class: "btns", style: { marginTop: "14px" } }, h("button", { class: "btn", onclick: () => history.back() }, "Voltar"), h("button", { class: "btn dark", onclick: () => ctx.go("inicio") }, "Ir para o Início")));
});
