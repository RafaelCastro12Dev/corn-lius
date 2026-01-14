(function () {
  "use strict";

  const C = window.Cornelius;
  C.setActiveNav();

  const list = document.getElementById("list");
  const empty = document.getElementById("empty");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const btnAdd = document.getElementById("btnAdd");
  const btnClose = document.getElementById("btnClose");
  const btnCancel = document.getElementById("btnCancel");
  const btnSave = document.getElementById("btnSave");
  const btnDelete = document.getElementById("btnDelete");

  const proName = document.getElementById("proName");
  const proColor = document.getElementById("proColor");

  let editingId = null;

  function openModal() {
    modalBackdrop.style.display = "flex";
    proName.focus();
  }

  function closeModal() {
    modalBackdrop.style.display = "none";
    editingId = null;
    btnDelete.style.display = "none";
  }

  function render() {
    const data = C.load();
    const pros = (data.professionals || []).slice().sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = "";
    empty.style.display = pros.length ? "none" : "block";

    pros.forEach((p) => {
      const row = document.createElement("div");
      row.className = "item";

      row.innerHTML = `
        <div class="meta">
          <strong>${C.escapeHtml(p.name)}</strong>
          <span>ID: ${C.escapeHtml(p.id)}</span>
        </div>
        <span class="pill">
          <span class="dot" style="background:${p.color || "#7FDCAC"}"></span>
          ${C.escapeHtml(p.color || "")}
        </span>
      `;

      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        editingId = p.id;
        proName.value = p.name;
        proColor.value = p.color || "#7FDCAC";
        btnDelete.style.display = "inline-flex";
        openModal();
      });

      list.appendChild(row);
    });
  }

  btnAdd.addEventListener("click", () => {
    editingId = null;
    proName.value = "";
    proColor.value = "#7FDCAC";
    btnDelete.style.display = "none";
    openModal();
  });

  btnClose.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  btnSave.addEventListener("click", () => {
    try {
      const data = C.load();
      const name = String(proName.value || "").trim();

      if (!name) throw new Error("Informe o nome do profissional.");

      if (editingId) {
        C.updateProfessional(data, editingId, { name, color: proColor.value });
        C.toast("Profissional atualizado");
      } else {
        C.addProfessional(data, { name, color: proColor.value });
        C.toast("Profissional criado");
      }

      C.save(data);
      closeModal();
      render();
    } catch (err) {
      C.toast("Erro", err.message || String(err));
    }
  });

  btnDelete.addEventListener("click", () => {
    if (!editingId) return;
    const ok = confirm("Excluir este profissional?");
    if (!ok) return;

    try {
      const data = C.load();
      C.deleteProfessional(data, editingId);
      C.save(data);
      C.toast("Profissional excluído");
      closeModal();
      render();
    } catch (err) {
      C.toast("Não foi possível excluir", err.message || String(err));
    }
  });

  render();
})();
