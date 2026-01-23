/**
 * Cornélius - Gestão de Profissionais
 * Versão Supabase (async/await)
 * + Enter funciona no modal (Salvar) e na troca de senha
 * + CRP (professionals.crp):
 *    - Campo editável no modal (input id="proCrp")
 *    - Exibe CRP como “badge” ao lado do nome na lista
 * + Troca de senha do sistema (Supabase Auth: updateUser)
 *
 * IMPORTANTE (HTML):
 * - Adicione um input no modal com id="proCrp"
 *   Ex.: <input id="proCrp" type="text" placeholder="Ex.: 06/12345" />
 * - Se não existir, o sistema continua funcionando, só não edita CRP.
 */
(function () {
  "use strict";

  // Proteção de acesso (login)
  if (window.CorneliusAuth && !window.CorneliusAuth.requireAuth()) return;

  const C = window.Cornelius;

  // Evita quebrar a página se Cornelius não carregar por algum motivo
  if (!C) {
    console.error("❌ window.Cornelius não carregou. Verifique ordem dos scripts (supabase-config.js / supabase-api.js).");
    alert("❌ Erro: API do sistema não carregou. Verifique os scripts.");
    return;
  }

  if (typeof C.setActiveNav === "function") C.setActiveNav();

  // ----------------------------
  // DOM - Profissionais
  // ----------------------------
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const btnAdd = document.getElementById("btnAdd");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalTitle = document.getElementById("modalTitle");
  const btnClose = document.getElementById("btnClose");
  const btnCancel = document.getElementById("btnCancel");
  const btnSave = document.getElementById("btnSave");
  const btnDelete = document.getElementById("btnDelete");

  // Form do modal (para Enter funcionar)
  const professionalForm = document.getElementById("professionalForm");

  const professionalName = document.getElementById("proName");
  const professionalEmail = document.getElementById("proEmail");
  const professionalColor = document.getElementById("proColor");

  // NOVO: CRP (precisa existir no HTML para editar)
  const professionalCrp = document.getElementById("proCrp");

  let editingId = null;

  // ----------------------------
  // Helpers
  // ----------------------------
  function toastSafe(msg) {
    if (C && typeof C.toast === "function") C.toast(msg);
    else alert(msg);
  }

  function pickColorSafe() {
    if (C && typeof C.pickColor === "function") return C.pickColor();
    return "#9B5DE5";
  }

  function formatCrpLabel(crp) {
    const v = String(crp || "").trim();
    return v ? `CRP ${v}` : "";
  }

  function ensureModalBasics() {
    if (!modalBackdrop || !professionalName || !professionalEmail || !professionalColor) {
      console.error("❌ Elementos do modal não encontrados (modalBackdrop/proName/proEmail/proColor).");
      toastSafe("❌ Erro ao abrir modal (IDs faltando no HTML).");
      return false;
    }
    return true;
  }

  // ============================================================================
  // RENDERIZAR LISTA
  // ============================================================================
  async function render() {
    try {
      const professionals = await C.getAllProfessionals();

      if (!professionals || professionals.length === 0) {
        if (list) list.style.display = "none";
        if (empty) empty.style.display = "block";
        return;
      }

      if (list) list.style.display = "block";
      if (empty) empty.style.display = "none";

      if (!list) return;

      list.innerHTML = professionals
        .map((p) => {
          const dotColor = p.color || "#9B5DE5";
          const colorDot = `<span class="color-dot" style="background:${C.escapeHtml(dotColor)}"></span>`;

          const emailInfo = p.email
            ? `<div class="text-sm text-secondary">${C.escapeHtml(p.email)}</div>`
            : "";

          const nameOnly = p && p.name ? String(p.name) : "Profissional";

          const crpBadge =
            p && p.crp
              ? `<span class="badge-crp">${C.escapeHtml(formatCrpLabel(p.crp))}</span>`
              : "";

          return `
            <div class="list-item" data-id="${p.id}">
              <div class="list-item-content">
                <div class="list-item-title">
                  ${colorDot}
                  <span class="pro-name">${C.escapeHtml(nameOnly)}</span>
                  ${crpBadge}
                </div>
                ${emailInfo}
              </div>
              <button class="btn-icon" data-action="edit" data-id="${p.id}" title="Editar">✏️</button>
            </div>
          `;
        })
        .join("");

      list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          openEditModal(id);
        });
      });
    } catch (err) {
      console.error("❌ Erro ao renderizar profissionais:", err);
      toastSafe("❌ Erro ao carregar profissionais");
    }
  }

  // ============================================================================
  // MODAL
  // ============================================================================
  function openModal() {
    if (!ensureModalBasics()) return;

    editingId = null;
    if (modalTitle) modalTitle.textContent = "Novo Profissional";

    professionalName.value = "";
    professionalEmail.value = "";
    if (professionalCrp) professionalCrp.value = "";
    professionalColor.value = pickColorSafe();

    if (btnDelete) btnDelete.style.display = "none";
    modalBackdrop.classList.add("show");
    professionalName.focus();
  }

  async function openEditModal(id) {
    try {
      if (!ensureModalBasics()) return;

      const prof = await C.getProfessionalById(id);

      if (!prof) {
        toastSafe("❌ Profissional não encontrado");
        return;
      }

      editingId = id;
      if (modalTitle) modalTitle.textContent = "Editar Profissional";

      professionalName.value = prof.name || "";
      professionalEmail.value = prof.email || "";
      if (professionalCrp) professionalCrp.value = prof.crp || "";
      professionalColor.value = prof.color || "#9B5DE5";

      if (btnDelete) btnDelete.style.display = "inline-flex";
      modalBackdrop.classList.add("show");
      professionalName.focus();
    } catch (err) {
      console.error("❌ Erro ao abrir edição:", err);
      toastSafe("❌ Erro ao carregar profissional");
    }
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.classList.remove("show");
    editingId = null;
  }

  // ============================================================================
  // SALVAR
  // ============================================================================
  async function save() {
    try {
      if (!professionalName || !professionalEmail || !professionalColor) {
        console.error("❌ Elementos do formulário não encontrados (proName/proEmail/proColor).");
        toastSafe("❌ Erro ao acessar formulário (IDs faltando no HTML).");
        return;
      }

      const name = professionalName.value.trim();
      const email = professionalEmail.value.trim();
      const crp = professionalCrp ? professionalCrp.value.trim() : "";
      const color = professionalColor.value || pickColorSafe();

      if (!name) {
        toastSafe("⚠️ Nome é obrigatório");
        professionalName.focus();
        return;
      }

      const payload = {
        name,
        email,
        color,
        crp: crp ? crp : null,
      };

      if (editingId) {
        await C.updateProfessional(editingId, payload);
      } else {
        await C.addProfessional(payload);
      }

      closeModal();
      await render();
    } catch (err) {
      console.error("❌ Erro ao salvar:", err);
      toastSafe("❌ Erro ao salvar profissional");
    }
  }

  // ============================================================================
  // DELETAR
  // ============================================================================
  async function deleteProfessional() {
    if (!editingId) return;

    const confirmDelete = confirm(
      "⚠️ Tem certeza que deseja remover este profissional?\n\nOs agendamentos vinculados NÃO serão removidos."
    );
    if (!confirmDelete) return;

    try {
      await C.deleteProfessional(editingId);
      closeModal();
      await render();
    } catch (err) {
      console.error("❌ Erro ao deletar:", err);
      toastSafe("❌ Erro ao remover profissional");
    }
  }

  // ============================================================================
  // TROCAR SENHA DO SISTEMA (Supabase Auth)
  // ============================================================================
  const btnChangePass = document.getElementById("btnChangePass");
  const oldPass = document.getElementById("oldPass");
  const newPass = document.getElementById("newPass");
  const newPass2 = document.getElementById("newPass2");
  const passMsg = document.getElementById("passMsg");
  const changePassForm = document.getElementById("changePassForm");

  function showPassMsg(text, ok = false) {
    if (!passMsg) return;
    passMsg.textContent = text || "";
    passMsg.style.display = "block";
    passMsg.style.color = ok ? "var(--success)" : "var(--danger)";
  }

  async function doChangePass() {
    if (!btnChangePass || !oldPass || !newPass || !newPass2) return;

    const o = String(oldPass.value || "").trim();
    const n1 = String(newPass.value || "").trim();
    const n2 = String(newPass2.value || "").trim();

    if (!o || !n1 || !n2) {
      showPassMsg("Preencha todos os campos.");
      return;
    }

    if (n1.length < 6) {
      showPassMsg("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }

    if (n1 !== n2) {
      showPassMsg("As novas senhas não coincidem.");
      return;
    }

    const sb = window.supabaseClient;
    if (!sb) {
      showPassMsg("Supabase não carregou (supabaseClient).");
      return;
    }

    btnChangePass.disabled = true;

    try {
      // 1) Descobre o email do usuário logado (conta única)
      const { data: userData, error: userErr } = await sb.auth.getUser();
      if (userErr) throw userErr;

      const email = userData?.user?.email;
      if (!email) {
        showPassMsg("Sessão inválida. Faça login novamente.");
        return;
      }

      // 2) Reautentica com a senha atual para validar
      const { error: reauthErr } = await sb.auth.signInWithPassword({
        email,
        password: o,
      });
      if (reauthErr) {
        showPassMsg("Senha atual incorreta.");
        return;
      }

      // 3) Troca a senha do Supabase Auth (senha REAL do sistema)
      const { error: updErr } = await sb.auth.updateUser({ password: n1 });
      if (updErr) throw updErr;

      // 4) Força logout para a clínica entrar com a nova senha imediatamente
      showPassMsg("Senha alterada com sucesso. Faça login novamente com a nova senha.", true);

      oldPass.value = "";
      newPass.value = "";
      newPass2.value = "";

      await sb.auth.signOut();
      location.href = "login.html";
    } catch (e) {
      console.error("❌ Erro ao alterar senha (Auth):", e);
      const msg =
        e && (e.message || e.details || e.hint)
          ? e.message || e.details || e.hint
          : String(e);
      showPassMsg("Erro ao alterar senha: " + msg);
    } finally {
      btnChangePass.disabled = false;
    }
  }

  // ============================================================================
  // ENTER (SUBMIT) - CONEXÕES DOS FORMS
  // ============================================================================
  if (professionalForm) {
    professionalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      save();
    });
  }

  if (changePassForm) {
    changePassForm.addEventListener("submit", (e) => {
      e.preventDefault();
      doChangePass();
    });
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================
  if (btnAdd) btnAdd.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);
  if (btnSave) btnSave.addEventListener("click", save);
  if (btnDelete) btnDelete.addEventListener("click", deleteProfessional);

  if (btnChangePass) btnChangePass.addEventListener("click", doChangePass);

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

    // =============================================================================
  // REALTIME (Global)
  // =============================================================================
  const RT = window.CorneliusRealtime;
  if (RT && typeof render === "function") {
    RT.on("professionals:change", () => render());
    RT.on("realtime:reconnected", () => render());
  }

  // ============================================================================
  // BOOT
  // ============================================================================
  render();
})();
