/**
 * Cornélius - Gestão de Profissionais
 * Versão Supabase (async/await)
 * + Troca de senha do sistema (RPC set_system_password)
 */

(function () {
  "use strict";

  // Proteção de acesso (login)
  if (window.CorneliusAuth && !window.CorneliusAuth.requireAuth()) return;

  const C = window.Cornelius;

  // Evita quebrar a página se Cornelius não carregar por algum motivo
  if (!C) {
    console.error("❌ window.Cornelius não carregou. Verifique ordem dos scripts (supabase-api.js / app.js).");
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

  const professionalName = document.getElementById("proName");
  const professionalEmail = document.getElementById("proEmail");
  const professionalNotify = document.getElementById("proNotifyEmail");
  const professionalColor = document.getElementById("proColor");

  let editingId = null;

  // ----------------------------
  // Helpers
  // ----------------------------
  function pickColorSafe() {
    if (C && typeof C.pickColor === "function") return C.pickColor();
    return "#9B5DE5";
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

      list.innerHTML = professionals
        .map((p) => {
          const colorDot = `<span class="color-dot" style="background:${C.escapeHtml(
            p.color || "#9B5DE5"
          )}"></span>`;
          const emailInfo = p.email ? `<div class="text-sm text-secondary">${C.escapeHtml(p.email)}</div>` : "";
          const notifyBadge = p.notify_email ? `<span class="badge">📧 Notificações</span>` : "";

          return `
            <div class="list-item" data-id="${p.id}">
              <div class="list-item-content">
                <div class="list-item-title">
                  ${colorDot}
                  ${C.escapeHtml(p.name || "Profissional")}
                </div>
                ${emailInfo}
                ${notifyBadge}
              </div>
              <button class="btn-icon" data-action="edit" data-id="${p.id}" title="Editar">✏️</button>
            </div>
          `;
        })
        .join("");

      // listeners editar
      list.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          openEditModal(id);
        });
      });
    } catch (err) {
      console.error("❌ Erro ao renderizar profissionais:", err);
      if (C.toast) C.toast("❌ Erro ao carregar profissionais");
      else alert("❌ Erro ao carregar profissionais");
    }
  }

  // ============================================================================
  // MODAL
  // ============================================================================
  function openModal() {
    if (!modalBackdrop || !professionalName || !professionalEmail || !professionalNotify || !professionalColor) {
      console.error("❌ Elementos do modal não encontrados");
      if (C.toast) C.toast("❌ Erro ao abrir modal");
      else alert("❌ Erro ao abrir modal");
      return;
    }

    editingId = null;
    if (modalTitle) modalTitle.textContent = "Novo Profissional";

    professionalName.value = "";
    professionalEmail.value = "";
    professionalNotify.checked = false;
    professionalColor.value = pickColorSafe();

    if (btnDelete) btnDelete.style.display = "none";
    modalBackdrop.classList.add("show");
  }

  async function openEditModal(id) {
    try {
      if (!modalBackdrop || !professionalName || !professionalEmail || !professionalNotify || !professionalColor) {
        console.error("❌ Elementos do modal não encontrados");
        if (C.toast) C.toast("❌ Erro ao abrir modal de edição");
        else alert("❌ Erro ao abrir modal de edição");
        return;
      }

      const prof = await C.getProfessionalById(id);

      if (!prof) {
        if (C.toast) C.toast("❌ Profissional não encontrado");
        else alert("❌ Profissional não encontrado");
        return;
      }

      editingId = id;
      if (modalTitle) modalTitle.textContent = "Editar Profissional";

      professionalName.value = prof.name || "";
      professionalEmail.value = prof.email || "";
      professionalNotify.checked = !!prof.notify_email;
      professionalColor.value = prof.color || "#9B5DE5";

      if (btnDelete) btnDelete.style.display = "inline-flex";
      modalBackdrop.classList.add("show");
    } catch (err) {
      console.error("❌ Erro ao abrir edição:", err);
      if (C.toast) C.toast("❌ Erro ao carregar profissional");
      else alert("❌ Erro ao carregar profissional");
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
      if (!professionalName || !professionalEmail || !professionalNotify || !professionalColor) {
        console.error("❌ Elementos do formulário não encontrados");
        if (C.toast) C.toast("❌ Erro ao acessar formulário");
        else alert("❌ Erro ao acessar formulário");
        return;
      }

      const name = professionalName.value.trim();
      const email = professionalEmail.value.trim();
      const notify = professionalNotify.checked;
      const color = professionalColor.value || pickColorSafe();

      if (!name) {
        if (C.toast) C.toast("⚠️ Nome é obrigatório");
        else alert("⚠️ Nome é obrigatório");
        return;
      }

      if (editingId) {
        await C.updateProfessional(editingId, { name, email, notify_email: notify, color });
      } else {
        await C.addProfessional({ name, email, notify_email: notify, color });
      }

      closeModal();
      await render();
    } catch (err) {
      console.error("❌ Erro ao salvar:", err);
      if (C.toast) C.toast("❌ Erro ao salvar profissional");
      else alert("❌ Erro ao salvar profissional");
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
      if (C.toast) C.toast("❌ Erro ao remover profissional");
      else alert("❌ Erro ao remover profissional");
    }
  }

  // ============================================================================
  // TROCAR SENHA DO SISTEMA
  // ============================================================================
  const btnChangePass = document.getElementById("btnChangePass");
  const oldPass = document.getElementById("oldPass");
  const newPass = document.getElementById("newPass");
  const newPass2 = document.getElementById("newPass2");
  const passMsg = document.getElementById("passMsg");

  function showPassMsg(text, ok = false) {
    if (!passMsg) return;
    passMsg.textContent = text || "";
    passMsg.style.display = "block";
    passMsg.style.color = ok ? "var(--success)" : "var(--danger)";
  }

  if (btnChangePass) {
    btnChangePass.addEventListener("click", async () => {
      if (!oldPass || !newPass || !newPass2) {
        console.error("❌ Campos de senha não encontrados no HTML");
        return;
      }

      if (passMsg) passMsg.style.display = "none";

      const o = oldPass.value.trim();
      const n1 = newPass.value.trim();
      const n2 = newPass2.value.trim();

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
        // Assinatura correta no banco: set_system_password(p_old text, p_new text) returns boolean
        const { data, error } = await sb.rpc("set_system_password", {
          p_old: o,
          p_new: n1
        });

        if (error) throw error;

        if (data === true) {
          showPassMsg("Senha alterada com sucesso.", true);
          oldPass.value = "";
          newPass.value = "";
          newPass2.value = "";
        } else {
          showPassMsg("Senha atual incorreta ou alteração não permitida.");
        }
      } catch (e) {
        console.error("❌ Erro ao alterar senha:", e);
        const msg = (e && (e.message || e.details || e.hint)) ? (e.message || e.details || e.hint) : String(e);
        showPassMsg("Erro ao alterar senha: " + msg);
      } finally {
        btnChangePass.disabled = false;
      }
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

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  // ============================================================================
  // BOOT
  // ============================================================================
  render();
})();
