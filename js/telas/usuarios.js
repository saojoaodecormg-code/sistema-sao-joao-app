// Usuários / Permissões (MainForm.Users, modo nuvem) + CloudUserEditForm + PasswordResetForm + UserPermissionsForm.
import { h, alertBox, confirmBox, friendly, modal } from "../ui.js";
import { ctx, register } from "../app.js";
import * as api from "../api.js";
import { table } from "../relatorios/base.js";

const Modules = ["CLIENTES", "CRM", "ORCAMENTOS", "PEDIDOS", "ACOMPANHAMENTOS", "FINANCEIRO", "RELATORIOS", "VALORES_PRODUTOS", "USUARIOS", "AUDITORIA", "CONFIGURACOES"];
const Restritos = ["FINANCEIRO", "RELATORIOS", "VALORES_PRODUTOS", "USUARIOS", "AUDITORIA", "CONFIGURACOES"];

function editarUsuario(u) {
  const isNew = !u;
  return modal(isNew ? "Novo usuário na nuvem" : "Editar usuário da nuvem", ({ body, foot, close }) => {
    const nome = h("input", { class: "input", value: u?.Nome || "" }), email = h("input", { class: "input", type: "email", value: u?.Email || "" }), login = h("input", { class: "input", value: u?.Login || "" });
    const perfil = h("select", { class: "select" }, ...["Administrador", "Vendedor"].map((p) => h("option", { value: p, selected: (u ? (u.Perfil === "Administrador" ? "Administrador" : "Vendedor") : "Vendedor") === p }, p)));
    const senha = h("input", { class: "input", type: "password", disabled: !isNew }), ativo = h("input", { type: "checkbox", checked: u ? u.Ativo : true });
    body.append(h("label", { class: "lbl" }, "Nome"), nome, h("label", { class: "lbl" }, "E-mail de acesso"), email, h("div", { class: "row2" }, h("div", {}, h("label", { class: "lbl" }, "Login / identificação"), login), h("div", {}, h("label", { class: "lbl" }, "Perfil"), perfil)),
      h("label", { class: "lbl" }, isNew ? "Senha inicial" : "Senha"), senha, isNew ? null : h("div", { class: "sub" }, "Para alterar a senha use Redefinir Senha."),
      h("label", { class: "lbl", style: { display: "flex", gap: "8px", alignItems: "center", marginTop: "10px" } }, ativo, "Usuário ativo"), h("div", { class: "sub", style: { marginTop: "6px" } }, "Administrador: acesso às áreas administrativas. Vendedor: operação comercial normal."));
    const ok = h("button", { class: "btn green" }, "SALVAR"); foot.append(h("button", { class: "btn", onclick: () => close(null) }, "CANCELAR"), ok);
    ok.onclick = () => {
      const v = { nome: nome.value.trim(), email: email.value.trim(), login: login.value.trim(), perfil: perfil.value, ativo: ativo.checked, senha: senha.value };
      if (v.nome.length < 2) return alertBox("Informe o nome do usuário.");
      if (v.email.length < 5 || v.email.indexOf("@") < 1) return alertBox("Informe um e-mail válido para acesso pela nuvem.");
      if (v.login.length < 2) return alertBox("Informe o login/identificação.");
      if (isNew && v.senha.length < 6) return alertBox("A senha inicial deve ter pelo menos 6 caracteres.");
      close(v);
    };
  });
}
function novaSenha() {
  return modal("Redefinir senha", ({ body, foot, close }) => {
    const p1 = h("input", { class: "input", type: "password" }), p2 = h("input", { class: "input", type: "password" });
    body.append(h("label", { class: "lbl" }, "Senha"), p1, h("label", { class: "lbl" }, "Confirmar senha"), p2);
    const ok = h("button", { class: "btn green" }, "SALVAR"); foot.append(h("button", { class: "btn", onclick: () => close(null) }, "CANCELAR"), ok);
    ok.onclick = () => { if (p1.value.length < 6) return alertBox("A senha deve ter pelo menos 6 caracteres."); if (p1.value !== p2.value) return alertBox("As senhas não conferem."); close(p1.value); };
  });
}
async function permissoes(id, nome) {
  let cloud = null; try { cloud = await api.fetchUserPermissions(id); } catch {}
  const dt = Modules.map((m) => { let v = true, c = true, e = true, x = false; if (Restritos.includes(m)) v = c = e = x = false; const r = cloud && cloud.find((r) => String(r.Modulo).toUpperCase() === m); if (r) { v = r.Visualizar; c = r.Cadastrar; e = r.Editar; x = r.Excluir; } return { Modulo: m, Visualizar: v, Cadastrar: c, Editar: e, Excluir: x }; });
  await modal("Permissões — " + nome, ({ body, foot, close }) => {
    body.append(h("div", { class: "sub", style: { marginBottom: "8px" } }, "Marque exatamente o que este usuário pode fazer. As permissões ficam salvas na nuvem e valem em todos os computadores."));
    const cab = ["Visualizar", "Cadastrar", "Editar", "Excluir"];
    body.append(h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Modulo"), ...cab.map((c) => h("th", { style: { textAlign: "center" } }, c)))),
      h("tbody", {}, ...dt.map((r) => h("tr", {}, h("td", {}, r.Modulo), ...cab.map((c) => { const cb = h("input", { type: "checkbox", checked: r[c] }); cb.onchange = () => (r[c] = cb.checked); return h("td", { style: { textAlign: "center" } }, cb); })))))));
    const ok = h("button", { class: "btn dark" }, "SALVAR PERMISSÕES"); foot.append(h("button", { class: "btn", onclick: () => close() }, "FECHAR"), ok);
    ok.onclick = async () => { ok.disabled = true; try { await api.saveUserPermissions(id, dt); await alertBox("Permissões salvas na nuvem. Elas serão aplicadas no próximo login do usuário.", "Permissões"); close(); } catch (e) { alertBox(friendly(e), "Salvar permissões"); ok.disabled = false; } };
  }, { wide: true });
}

register("usuarios", (el) => {
  el.append(h("div", { class: "page-h" }, h("div", {}, h("h1", {}, "Usuários / Permissões"))));
  if (!ctx.isAdmin) { el.append(h("div", { class: "card", style: { color: "darkred" } }, "Acesso restrito ao Administrador.")); return; }
  el.append(h("div", { class: "sub", style: { marginBottom: "8px" } }, "Administração central de acessos pelo Supabase. As alterações valem para todos os computadores e notebooks."));
  const area = h("div", {}), sel = h("div", { class: "sub", style: { margin: "6px 0" } }, "Toque num usuário para selecionar.");
  const b = (t, cls) => h("button", { class: "btn " + (cls || "") }, t);
  const cn = b("NOVO USUÁRIO", "dark"), ce = b("EDITAR / PERFIL"), cp = b("REDEFINIR SENHA"), ca = b("ATIVAR / DESATIVAR"), perm = b("PERMISSÕES", "primary"), cr = b("ATUALIZAR");
  el.append(area, sel, h("div", { class: "btns grid2" }, cn, ce, cp, ca, perm, cr), h("div", { style: { color: "darkred", marginTop: "10px", fontSize: "13px" } }, "Segurança cloud: somente Administradores podem alterar acessos. O Administrador conectado e o último Administrador ativo são protegidos contra desativação/rebaixamento."));
  let atual = null;
  const cols = [{ k: "Nome", t: "Nome" }, { k: "Email", t: "Email" }, { k: "Login", t: "Login" }, { k: "Perfil", t: "Perfil" }, { k: "AtivoT", t: "Ativo" }, { k: "UltimoAcesso", t: "UltimoAcesso" }];
  const cload = async () => {
    try {
      const us = (await api.fetchUsers()).map((u) => ({ ...u, AtivoT: u.Ativo ? "Sim" : "Não" }));
      area.innerHTML = ""; area.append(table(cols, us, { onRow: (u, i) => { atual = u; sel.textContent = "Selecionado: " + u.Nome; area.querySelectorAll("tbody tr").forEach((tr, j) => (tr.style.background = j === i ? "#dbeafe" : "")); } }));
      if (atual) atual = us.find((x) => x.Id === atual.Id) || null; if (!atual) sel.textContent = "Toque num usuário para selecionar.";
    } catch (e) { alertBox(friendly(e), "Usuários Cloud"); }
  };
  const precisa = () => { if (!atual) { alertBox("Selecione um usuário."); return false; } return true; };
  cn.onclick = async () => { const f = await editarUsuario(null); if (!f) return; try { const msg = await api.createCloudUser(f.nome, f.email, f.login, f.perfil, f.ativo, f.senha); ctx.audit("CRIAR", "USUARIO_CLOUD", f.login, "Usuário criado na nuvem. Perfil: " + f.perfil); await alertBox(msg || "Usuário criado.", "Usuários Cloud"); cload(); } catch (e) { alertBox(friendly(e), "Criar usuário"); } };
  ce.onclick = async () => { if (!precisa()) return; const u = atual, f = await editarUsuario(u); if (!f) return; try { const msg = await api.updateCloudUser(u.Id, f.nome, f.email, f.login, f.perfil, f.ativo); ctx.audit("ALTERAR", "USUARIO_CLOUD", u.Id, "Cadastro cloud alterado: " + f.login + " / " + f.perfil + " / Ativo=" + (f.ativo ? "True" : "False")); await alertBox(msg || "Usuário alterado.", "Usuários Cloud"); cload(); } catch (e) { alertBox(friendly(e), "Editar usuário"); } };
  cp.onclick = async () => { if (!precisa()) return; const u = atual, s = await novaSenha(); if (!s) return; try { const msg = await api.resetCloudUserPassword(u.Id, s); ctx.audit("REDEFINIR_SENHA", "USUARIO_CLOUD", u.Id, "Senha redefinida pelo Administrador na nuvem."); alertBox(msg || "Senha redefinida.", "Usuários Cloud"); } catch (e) { alertBox(friendly(e), "Redefinir senha"); } };
  ca.onclick = async () => { if (!precisa()) return; const u = atual, novo = !u.Ativo; if (!(await confirmBox((novo ? "Ativar" : "Desativar") + " o usuário " + u.Nome + "?", "Confirmar"))) return; try { const msg = await api.setCloudUserActive(u.Id, novo); ctx.audit(novo ? "ATIVAR" : "DESATIVAR", "USUARIO_CLOUD", u.Id, "Status cloud alterado."); await alertBox(msg || "Status alterado.", "Usuários Cloud"); cload(); } catch (e) { alertBox(friendly(e), "Usuários Cloud"); } };
  perm.onclick = () => { if (!precisa()) return; if (String(atual.Perfil).toLowerCase() === "administrador") return alertBox("Administrador possui acesso total por definição.", "Permissões"); permissoes(atual.Id, atual.Nome); };
  cr.onclick = cload; cload();
});
