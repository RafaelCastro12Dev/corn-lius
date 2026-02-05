/**
 * Cornélius - Paciente (compatível com paciente.html atual)
 * Tabs: Histórico, Agendamentos, Financeiro, Config. Financeira
 * Modais: Anotação, Pagamento, Editar Paciente
 * - Enter para salvar via <form> nos modais
 * - Ctrl+Enter em campos de texto longo
 * - Corrige edição de anotação/pagamento aguardando selects preencherem
 * - NOVO: Filtra "Vincular a atendimento" pela profissional selecionada (somente no modal de anotação)
 */
(function () {
  "use strict";

  // Proteção de acesso (login)
  if (window.CorneliusAuth && !window.CorneliusAuth.requireRole("admin")) return;


  const C = window.Cornelius;

  // -----------------------------
  // Helpers
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  function qs(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  function safeOn(el, evt, fn) {
    if (!el) return;
    el.addEventListener(evt, fn);
  }

  function show(el) {
    if (el) el.classList.add("show");
  }

  function hide(el) {
    if (el) el.classList.remove("show");
  }

  function fmtDateTimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function parseDateTimeLocal(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function escapeHtml(s) {
    if (C && typeof C.escapeHtml === "function") return C.escapeHtml(String(s ?? ""));
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(msg) {
    if (C && typeof C.toast === "function") return C.toast(msg);
    alert(msg);
  }

  // -----------------------------
  // Inicialização / validação
  // -----------------------------
  if (C && typeof C.setActiveNav === "function") C.setActiveNav();

  const patientId = qs("id");
  if (!patientId) {
    toast("⚠️ Paciente não especificado");
    setTimeout(() => (window.location.href = "index.html"), 1200);
    return;
  }

  // -----------------------------
  // DOM (conforme paciente.html)
  // -----------------------------
  const elTitle = $("title");
  const elSubtitle = $("subtitle");
  const btnSchedule = $("btnSchedule");
  const btnEdit = $("btnEdit");

  const colorDot = $("colorDot");
  const patientFields = $("patientFields");

  const tabHistory = $("tabHistory");
  const tabAppointments = $("tabAppointments");
  const tabFinance = $("tabFinance");
  const tabFinanceSettings = $("tabFinanceSettings");

  const panelHistory = $("panelHistory");
  const panelAppointments = $("panelAppointments");
  const panelFinance = $("panelFinance");
  const panelFinanceSettings = $("panelFinanceSettings");

  const apptsUpcomingList = $("apptsUpcomingList");
  const apptsPastList = $("apptsPastList");
  const apptsUpcomingEmpty = $("apptsUpcomingEmpty");
  const apptsPastEmpty = $("apptsPastEmpty");

  const btnAddNote = $("btnAddNote");
  const notesList = $("notesList");
  const notesEmpty = $("notesEmpty");

  const sumConsultation = $("sumConsultation");
  const sumPaid = $("sumPaid");
  const sumPending = $("sumPending");
  const btnAddPayment = $("btnAddPayment");
  const paymentsList = $("paymentsList");
  const paymentsEmpty = $("paymentsEmpty");

  const cfgConsultationValue = $("cfgConsultationValue");
  const cfgFinancialNote = $("cfgFinancialNote");
  const btnSaveFinanceSettings = $("btnSaveFinanceSettings");

  // Modal: anotação
  const noteBackdrop = $("noteBackdrop");
  const btnCloseNote = $("btnCloseNote");
  const btnCancelNote = $("btnCancelNote");
  const btnSaveNote = $("btnSaveNote");
  const btnDeleteNote = $("btnDeleteNote");

  const noteProfessional = $("noteProfessional");
  const noteLinkAppt = $("noteLinkAppt");
  const noteWhen = $("noteWhen");
  const noteText = $("noteText");

  // Modal: pagamento
  const payBackdrop = $("payBackdrop");
  const btnClosePay = $("btnClosePay");
  const btnCancelPay = $("btnCancelPay");
  const btnSavePay = $("btnSavePay");
  const btnDeletePay = $("btnDeletePay");

  const payProfessional = $("payProfessional");
  const payLinkAppt = $("payLinkAppt");
  const payAmount = $("payAmount");
  const payDate = $("payDate");
  const payStatus = $("payStatus");
  const payMethod = $("payMethod");
  const payNote = $("payNote");

  // Cartão (UI extra)
  const cardBox = $("cardBox");
  const cardType = $("cardType");
  const cardBrand = $("cardBrand");
  const cardInstallments = $("cardInstallments");
  const cardInstallmentValue = $("cardInstallmentValue");
  const cardAuthorization = $("cardAuthorization");
  const cardFee = $("cardFee");
  const cardNetInfo = $("cardNetInfo");

  // Modal: editar paciente
  const editBackdrop = $("editBackdrop");
  const btnCloseEdit = $("btnCloseEdit");
  const btnCancelEdit = $("btnCancelEdit");
  const btnSaveEdit = $("btnSaveEdit");

  const eName = $("eName");
  const eCpf = $("eCpf");
  const eBirthDate = $("eBirthDate");
  const eEmail = $("eEmail");
  const ePhone = $("ePhone");
  const eAddress = $("eAddress");
  const eColor = $("eColor");

  // Forms (para Enter)
  const editForm = $("editForm");
  const noteForm = $("noteForm");
  const payForm = $("payForm");

  // -----------------------------
  // Estado
  // -----------------------------
  let currentPatient = null;
  let currentTab = "history";

  let editingNoteId = null;
  let editingPayId = null;

  // Cache de agendamentos do paciente (para filtrar vínculo no modal de anotação)
  let apptCacheForPatient = null;

  // -----------------------------
  // Tabs
  // -----------------------------
  function setTab(tab) {
    currentTab = tab;

    [tabHistory, tabAppointments, tabFinance, tabFinanceSettings].forEach((b) => b && b.classList.remove("primary"));
    if (tab === "history" && tabHistory) tabHistory.classList.add("primary");
    if (tab === "appointments" && tabAppointments) tabAppointments.classList.add("primary");
    if (tab === "finance" && tabFinance) tabFinance.classList.add("primary");
    if (tab === "financeSettings" && tabFinanceSettings) tabFinanceSettings.classList.add("primary");

    if (panelHistory) panelHistory.style.display = tab === "history" ? "block" : "none";
    if (panelAppointments) panelAppointments.style.display = tab === "appointments" ? "block" : "none";
    if (panelFinance) panelFinance.style.display = tab === "finance" ? "block" : "none";
    if (panelFinanceSettings) panelFinanceSettings.style.display = tab === "financeSettings" ? "block" : "none";

    if (tab === "history") loadNotes();
    if (tab === "appointments") loadPatientAppointments();
    if (tab === "finance") loadPaymentsAndSummary();
    if (tab === "financeSettings") loadFinanceSettings();
  }

  safeOn(tabHistory, "click", () => setTab("history"));
  safeOn(tabAppointments, "click", () => setTab("appointments"));
  safeOn(tabFinance, "click", () => setTab("finance"));
  safeOn(tabFinanceSettings, "click", () => setTab("financeSettings"));

  // -----------------------------
  // Paciente: carregar e render
  // -----------------------------
  async function loadPatient() {
    try {
      if (!C || typeof C.getPatientById !== "function") {
        console.error("Cornelius.getPatientById não existe. Verifique supabase-api.js.");
        toast("❌ API não carregada (getPatientById).");
        return;
      }

      currentPatient = await C.getPatientById(patientId);

      if (!currentPatient) {
        toast("❌ Paciente não encontrado");
        setTimeout(() => (window.location.href = "index.html"), 1200);
        return;
      }

      renderPatient();
    } catch (err) {
      console.error("Erro ao carregar paciente:", err);
      toast("❌ Erro ao carregar paciente");
    }
  }

  function renderPatient() {
    const name = currentPatient?.name || "Paciente";
    if (elTitle) elTitle.textContent = name;
    if (elSubtitle) elSubtitle.textContent = "Ficha completa do paciente.";

    if (colorDot) colorDot.style.background = currentPatient?.color || "#2A9D8F";

    if (patientFields) {
      const items = [
        { label: "Nome", value: currentPatient?.name || "—" },
        { label: "CPF", value: currentPatient?.cpf ? (C.formatCPF ? C.formatCPF(currentPatient.cpf) : currentPatient.cpf) : "—" },
        { label: "Nascimento", value: currentPatient?.birth_date ? new Date(currentPatient.birth_date).toLocaleDateString("pt-BR") : "—" },
        { label: "E-mail", value: currentPatient?.email || "—" },
        { label: "Telefone", value: currentPatient?.phone || "—" },
        { label: "Endereço", value: currentPatient?.address || "—" }
      ];

      patientFields.innerHTML = items
        .map(
          (i) => `
          <div class="item">
            <div class="meta">
              <strong>${escapeHtml(i.label)}</strong>
              <span>${escapeHtml(i.value)}</span>
            </div>
          </div>
        `
        )
        .join("");
    }
  }

  // -----------------------------
  // Ações topo
  // -----------------------------
  safeOn(btnSchedule, "click", () => {
    const pid = encodeURIComponent(patientId);
    const pname = encodeURIComponent(currentPatient?.name || "");
    window.location.href = `agenda.html?new=1&patient=${pid}&patient_name=${pname}`;
  });

  safeOn(btnEdit, "click", () => openEditPatientModal());

  // -----------------------------
  // Modal: Editar Paciente
  // -----------------------------
  function openEditPatientModal() {
    if (!currentPatient) return;

    if (eName) eName.value = currentPatient.name || "";
    if (eCpf) eCpf.value = currentPatient.cpf || "";
    if (eBirthDate) eBirthDate.value = currentPatient.birth_date || "";
    if (eEmail) eEmail.value = currentPatient.email || "";
    if (ePhone) ePhone.value = currentPatient.phone || "";
    if (eAddress) eAddress.value = currentPatient.address || "";
    if (eColor) eColor.value = currentPatient.color || "#2A9D8F";

    show(editBackdrop);
  }

  function closeEditPatientModal() {
    hide(editBackdrop);
  }

  async function saveEditPatientModal() {
    try {
      if (!C || typeof C.updatePatient !== "function") {
        console.error("Cornelius.updatePatient não existe. Verifique supabase-api.js.");
        toast("❌ API não carregada (updatePatient).");
        return;
      }

      const updates = {
        name: (eName?.value || "").trim(),
        cpf: (eCpf?.value || "").trim(),
        birth_date: eBirthDate?.value || null,
        email: (eEmail?.value || "").trim(),
        phone: (ePhone?.value || "").trim(),
        address: (eAddress?.value || "").trim(),
        color: eColor?.value || "#2A9D8F"
      };

      if (!updates.name) {
        toast("⚠️ Nome é obrigatório");
        return;
      }

      await C.updatePatient(patientId, updates);
      closeEditPatientModal();
      await loadPatient();
    } catch (err) {
      console.error("Erro ao salvar paciente:", err);
      toast("❌ Erro ao salvar alterações");
    }
  }

  safeOn(btnCloseEdit, "click", closeEditPatientModal);
  safeOn(btnCancelEdit, "click", closeEditPatientModal);
  safeOn(btnSaveEdit, "click", saveEditPatientModal);

  // -----------------------------
  // Profissionais e atendimentos (modais)
  // -----------------------------
  async function fillProfessionals(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">—</option>`;

    const candidates = ["getProfessionals", "listProfessionals", "getAllProfessionals"];
    const fnName = candidates.find((n) => C && typeof C[n] === "function");
    if (!fnName) return;

    try {
      const list = await C[fnName]();
      if (!Array.isArray(list)) return;

      selectEl.innerHTML =
        `<option value="">—</option>` +
        list.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || "Profissional")}</option>`).join("");
    } catch (e) {
      console.warn("Não foi possível carregar profissionais:", e);
    }
  }

  async function getAppointmentsCache() {
    if (Array.isArray(apptCacheForPatient)) return apptCacheForPatient;

    const candidates = ["getAppointmentsByPatient", "listAppointmentsByPatient", "getAppointmentsForPatient"];
    const fnName = candidates.find((n) => C && typeof C[n] === "function");
    if (!fnName) {
      apptCacheForPatient = [];
      return apptCacheForPatient;
    }

    try {
      const list = await C[fnName](patientId);
      apptCacheForPatient = Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn("Não foi possível carregar atendimentos:", e);
      apptCacheForPatient = [];
    }
    return apptCacheForPatient;
  }

  async function fillAppointments(selectEl, professionalId = "") {
    if (!selectEl) return;

    // mantém sempre opção "Nenhum"
    selectEl.innerHTML = `<option value="">Nenhum</option>`;

    const list = await getAppointmentsCache();
    if (!Array.isArray(list) || !list.length) return;

    const pid = (professionalId || "").trim();

    const filtered = pid
      ? list.filter((a) => String(a.professional_id || "") === String(pid))
      : list;

    filtered.forEach((a) => {
      const when = a.start_time || a.date || a.when || a.created_at;
      const label = when ? new Date(when).toLocaleString("pt-BR") : "Atendimento";
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = label;
      selectEl.appendChild(opt);
    });
  }

  // -----------------------------
  // AGENDAMENTOS (na ficha do paciente)
  // -----------------------------
  async function loadPatientAppointments() {
    try {
      const candidates = ["getAppointmentsByPatient", "listAppointmentsByPatient", "getAppointmentsForPatient"];
      const fnName = candidates.find((n) => C && typeof C[n] === "function");

      if (!fnName) {
        console.error("Nenhuma função de agendamentos disponível no supabase-api.js");
        renderApptList(apptsUpcomingList, apptsUpcomingEmpty, [], true);
        renderApptList(apptsPastList, apptsPastEmpty, [], false);
        return;
      }

      const list = await C[fnName](patientId);
      const now = Date.now();

      const upcoming = [];
      const past = [];

      (list || []).forEach((a) => {
        const start = new Date(a.start_time).getTime();
        if (!isNaN(start) && start >= now) upcoming.push(a);
        else past.push(a);
      });

      upcoming.sort((x, y) => new Date(x.start_time) - new Date(y.start_time));
      past.sort((x, y) => new Date(y.start_time) - new Date(x.start_time));

      renderApptList(apptsUpcomingList, apptsUpcomingEmpty, upcoming, true);
      renderApptList(apptsPastList, apptsPastEmpty, past, false);
    } catch (err) {
      console.error("Erro ao carregar agendamentos do paciente:", err);
      toast("❌ Erro ao carregar agendamentos");
    }
  }

  function renderApptList(listEl, emptyEl, items, isUpcoming) {
    if (!listEl || !emptyEl) return;

    if (!items || !items.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }

    emptyEl.style.display = "none";

    listEl.innerHTML = items
      .map((a) => {
        const start = new Date(a.start_time);
        const end = new Date(a.end_time);

        const when = start.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        const to = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        const profName = a.professional?.name || a.professional_name || "—";
        const room = a.room ? `Sala: ${escapeHtml(a.room)}` : "";
        const notes = a.notes ? escapeHtml(a.notes) : "";
        const color = a.color || "#2A9D8F";

        return `
        <div class="item" style="align-items:flex-start;">
          <div class="meta">
            <strong>${escapeHtml(when)} – ${escapeHtml(to)}</strong>
            <span class="muted">${escapeHtml(profName)}${room ? " • " + room : ""}</span>
            ${notes ? `<div class="text-sm" style="margin-top:6px; white-space:pre-wrap;">${notes}</div>` : ""}
          </div>

          <div style="min-width:120px; text-align:right;">
            <span class="pill" style="display:inline-flex; gap:8px; align-items:center;">
              <span class="dot" style="width:10px;height:10px;border-radius:999px;background:${escapeHtml(color)};"></span>
              ${isUpcoming ? "Futuro" : "Passado"}
            </span>
          </div>
        </div>
      `;
      })
      .join("");
  }

  // -----------------------------
  // HISTÓRICO (Anotações)
  // -----------------------------
  async function loadNotes() {
    try {
      if (!C || typeof C.getClinicalNotesByPatient !== "function") {
        console.error("Cornelius.getClinicalNotesByPatient não existe.");
        if (notesList) notesList.innerHTML = "";
        if (notesEmpty) notesEmpty.style.display = "block";
        return;
      }

      const notes = await C.getClinicalNotesByPatient(patientId);

      if (!notes || !notes.length) {
        if (notesList) notesList.innerHTML = "";
        if (notesList) notesList.style.display = "none";
        if (notesEmpty) notesEmpty.style.display = "block";
        return;
      }

      if (notesEmpty) notesEmpty.style.display = "none";
      if (notesList) notesList.style.display = "block";

      notesList.innerHTML = notes
        .map((n) => {
          const d = n.note_date ? new Date(n.note_date) : null;
          const dateStr = d ? d.toLocaleDateString("pt-BR") : "—";
          const timeStr = d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
          const profName = n.professional?.name || n.professional_name || "Profissional";
          const text = n.content || "";
          const preview = text.length > 160 ? text.slice(0, 160) + "..." : text;

          return `
            <div class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">📝 ${escapeHtml(profName)}</div>
                <div class="text-sm text-secondary">${escapeHtml(dateStr)} ${timeStr ? "às " + escapeHtml(timeStr) : ""}</div>
                <div class="text-sm" style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(preview)}</div>
              </div>
              <button class="btn-icon" data-action="edit-note" data-id="${escapeHtml(n.id)}" title="Editar">✏️</button>
            </div>
          `;
        })
        .join("");

      notesList.querySelectorAll('[data-action="edit-note"]').forEach((btn) => {
        safeOn(btn, "click", () => openEditNote(btn.dataset.id));
      });
    } catch (err) {
      console.error("Erro ao carregar anotações:", err);
      toast("❌ Erro ao carregar histórico");
    }
  }

  async function openNewNote() {
    editingNoteId = null;

    const nt = noteBackdrop ? noteBackdrop.querySelector("h3") : null;
    if (nt) nt.textContent = "Nova anotação";

    if (noteText) noteText.value = "";
    if (noteWhen) noteWhen.value = fmtDateTimeLocal(new Date().toISOString());

    if (btnDeleteNote) btnDeleteNote.style.display = "none";

    await fillProfessionals(noteProfessional);
    await getAppointmentsCache();
    await fillAppointments(noteLinkAppt, noteProfessional?.value || "");

    show(noteBackdrop);
  }

  async function openEditNote(noteId) {
    try {
      if (!C || typeof C.getClinicalNotesByPatient !== "function") return;

      const notes = await C.getClinicalNotesByPatient(patientId);
      const note = notes?.find((n) => String(n.id) === String(noteId));

      if (!note) {
        toast("❌ Anotação não encontrada");
        return;
      }

      editingNoteId = noteId;

      const nt = noteBackdrop ? noteBackdrop.querySelector("h3") : null;
      if (nt) nt.textContent = "Editar anotação";

      // IMPORTANTÍSSIMO: aguarda os selects preencherem antes de setar value
      await fillProfessionals(noteProfessional);
      await getAppointmentsCache();

      // 1) seta o profissional primeiro (se existir)
      if (noteProfessional) noteProfessional.value = note.professional_id || "";

      // 2) preenche atendimentos filtrando pela profissional selecionada
      await fillAppointments(noteLinkAppt, noteProfessional?.value || "");

      // 3) tenta selecionar o atendimento vinculado (se existir dentro do filtro)
      if (noteLinkAppt) {
        noteLinkAppt.value = note.appointment_id || "";
        if (note.appointment_id && noteLinkAppt.value !== String(note.appointment_id)) noteLinkAppt.value = "";
      }

      if (noteWhen) noteWhen.value = fmtDateTimeLocal(note.note_date);
      if (noteText) noteText.value = note.content || "";

      if (btnDeleteNote) btnDeleteNote.style.display = "inline-flex";

      show(noteBackdrop);
    } catch (err) {
      console.error("Erro ao abrir anotação:", err);
      toast("❌ Erro ao abrir anotação");
    }
  }

  function closeNote() {
    hide(noteBackdrop);
    editingNoteId = null;
  }

  async function saveNote() {
    try {
      const content = (noteText?.value || "").trim();
      if (!content) {
        toast("⚠️ Preencha a anotação");
        return;
      }

      const payload = {
        patient_id: patientId,
        professional_id: noteProfessional?.value || null,
        appointment_id: noteLinkAppt?.value || null,
        note_date: parseDateTimeLocal(noteWhen?.value) || new Date().toISOString(),
        content
      };

      if (editingNoteId) {
        if (!C || typeof C.updateClinicalNote !== "function") {
          console.error("Cornelius.updateClinicalNote não existe.");
          toast("❌ API não carregada (updateClinicalNote).");
          return;
        }
        await C.updateClinicalNote(editingNoteId, payload);
      } else {
        if (!C || typeof C.addClinicalNote !== "function") {
          console.error("Cornelius.addClinicalNote não existe.");
          toast("❌ API não carregada (addClinicalNote).");
          return;
        }
        await C.addClinicalNote(payload);
      }

      closeNote();
      await loadNotes();
    } catch (err) {
      console.error("Erro ao salvar anotação:", err);
      toast("❌ Erro ao salvar anotação");
    }
  }

  async function deleteNote() {
    try {
      if (!editingNoteId) return;
      if (!confirm("⚠️ Tem certeza que deseja excluir esta anotação?")) return;

      if (!C || typeof C.deleteClinicalNote !== "function") {
        console.error("Cornelius.deleteClinicalNote não existe.");
        toast("❌ API não carregada (deleteClinicalNote).");
        return;
      }

      await C.deleteClinicalNote(editingNoteId);
      closeNote();
      await loadNotes();
    } catch (err) {
      console.error("Erro ao excluir anotação:", err);
      toast("❌ Erro ao excluir anotação");
    }
  }

  safeOn(btnAddNote, "click", openNewNote);
  safeOn(btnCloseNote, "click", closeNote);
  safeOn(btnCancelNote, "click", closeNote);
  safeOn(btnSaveNote, "click", saveNote);
  safeOn(btnDeleteNote, "click", deleteNote);

  // Filtra "Vincular a atendimento" pela profissional selecionada (apenas no modal de anotação)
  safeOn(noteProfessional, "change", async () => {
    const current = noteLinkAppt?.value || "";
    await fillAppointments(noteLinkAppt, noteProfessional?.value || "");

    // tenta manter a seleção anterior; se não existir no filtro, volta para "Nenhum"
    if (noteLinkAppt && current) {
      noteLinkAppt.value = current;
      if (noteLinkAppt.value !== current) noteLinkAppt.value = "";
    }
  });

  // -----------------------------
  // FINANCEIRO (Pagamentos + resumo)
  // -----------------------------
  function ensureCardInstallmentsOptions() {
    if (!cardInstallments) return;
    if (cardInstallments.options.length) return;

    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i}x`;
      cardInstallments.appendChild(opt);
    }
    cardInstallments.value = "1";
  }

  function updateCardDerivedUI() {
    if (!cardBox) return;

    const method = payMethod?.value || "";
    cardBox.style.display = method === "CARD" ? "block" : "none";
    if (method !== "CARD") return;

    ensureCardInstallmentsOptions();

    const amount = parseFloat(payAmount?.value || "0") || 0;
    const inst = parseInt(cardInstallments?.value || "1", 10) || 1;
    const fee = parseFloat(cardFee?.value || "0") || 0;

    const per = inst > 0 ? amount / inst : amount;
    if (cardInstallmentValue) cardInstallmentValue.value = isFinite(per) ? per.toFixed(2) : "";

    const net = amount > 0 ? amount * (1 - fee / 100) : 0;
    if (cardNetInfo) {
      cardNetInfo.innerHTML =
        amount > 0
          ? `💡 <strong>Estimativa líquido:</strong> R$ ${net.toFixed(2)} (taxa ${fee.toFixed(2)}%)`
          : `💡 Informe o valor para ver a estimativa líquido.`;
    }
  }

  async function loadPaymentsAndSummary() {
    try {
      if (C && typeof C.calcFinancialSummary === "function") {
        const summary = await C.calcFinancialSummary(patientId);

        if (sumPaid) sumPaid.textContent = summary?.paid != null && C.moneyBR ? C.moneyBR(summary.paid) : (summary?.paid ?? "-");
        if (sumPending) sumPending.textContent = summary?.pending != null && C.moneyBR ? C.moneyBR(summary.pending) : (summary?.pending ?? "-");

        const consult = summary?.consultation_value ?? currentPatient?.consultation_value ?? currentPatient?.consultationValue ?? null;
        if (sumConsultation) sumConsultation.textContent = consult != null && C.moneyBR ? C.moneyBR(consult) : (consult ?? "-");
      } else {
        if (sumConsultation) sumConsultation.textContent = "-";
        if (sumPaid) sumPaid.textContent = "-";
        if (sumPending) sumPending.textContent = "-";
      }

      if (!C || typeof C.getPaymentsByPatient !== "function") {
        console.error("Cornelius.getPaymentsByPatient não existe.");
        if (paymentsList) paymentsList.innerHTML = "";
        if (paymentsEmpty) paymentsEmpty.style.display = "block";
        return;
      }

      const payments = await C.getPaymentsByPatient(patientId);

      if (!payments || !payments.length) {
        if (paymentsList) paymentsList.innerHTML = "";
        if (paymentsList) paymentsList.style.display = "none";
        if (paymentsEmpty) paymentsEmpty.style.display = "block";
        return;
      }

      if (paymentsEmpty) paymentsEmpty.style.display = "none";
      if (paymentsList) paymentsList.style.display = "block";

      const statusMap = {
        PAID: { label: "Pago", color: "#06D6A0" },
        PENDING: { label: "Pendente", color: "#F4A261" },
        PARTIAL: { label: "Parcial", color: "#457B9D" },
        FREE: { label: "Isento", color: "#6C757D" }
      };

      const methodMap = {
        PIX: "Pix",
        CARD: "Cartão",
        CASH: "Dinheiro",
        TRANSFER: "Transferência",
        OTHER: "Outro"
      };

      paymentsList.innerHTML = payments
        .map((p) => {
          const d = p.payment_date ? new Date(p.payment_date) : null;
          const dateStr = d ? d.toLocaleDateString("pt-BR") : "—";

          const st = statusMap[p.status] || statusMap.PENDING;
          const method = methodMap[p.method] || "—";

          const amountText = C.moneyBR ? C.moneyBR(p.amount || 0) : String(p.amount || 0);

          return `
            <div class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">
                  ${escapeHtml(amountText)}
                  <span class="badge" style="background:${st.color}; color:#fff; margin-left:8px;">${escapeHtml(st.label)}</span>
                </div>
                <div class="text-sm text-secondary">📅 ${escapeHtml(dateStr)} • ${escapeHtml(method)}</div>
                ${p.note ? `<div class="text-sm" style="margin-top:4px;">${escapeHtml(p.note)}</div>` : ""}
              </div>
              <button class="btn-icon" data-action="edit-pay" data-id="${escapeHtml(p.id)}" title="Editar">✏️</button>
            </div>
          `;
        })
        .join("");

      paymentsList.querySelectorAll('[data-action="edit-pay"]').forEach((btn) => {
        safeOn(btn, "click", () => openEditPayment(btn.dataset.id));
      });
    } catch (err) {
      console.error("Erro ao carregar financeiro:", err);
      toast("❌ Erro ao carregar financeiro");
    }
  }

  function openNewPayment() {
    editingPayId = null;

    fillProfessionals(payProfessional);
    fillAppointments(payLinkAppt);

    if (payAmount) {
      const consult = currentPatient?.consultation_value ?? currentPatient?.consultationValue ?? null;
      payAmount.value = consult != null ? String(consult) : "";
    }

    if (payDate) payDate.value = fmtDateTimeLocal(new Date().toISOString());
    if (payStatus) payStatus.value = "PENDING";
    if (payMethod) payMethod.value = "PIX";
    if (payNote) payNote.value = "";

    if (btnDeletePay) btnDeletePay.style.display = "none";

    if (cardType) cardType.value = "CREDIT";
    if (cardBrand) cardBrand.value = "VISA";
    if (cardAuthorization) cardAuthorization.value = "";
    if (cardFee) cardFee.value = "";

    ensureCardInstallmentsOptions();
    if (cardInstallments) cardInstallments.value = "1";

    updateCardDerivedUI();
    show(payBackdrop);
  }

  async function openEditPayment(paymentId) {
    try {
      if (!C || typeof C.getPaymentsByPatient !== "function") return;

      const payments = await C.getPaymentsByPatient(patientId);
      const p = payments?.find((x) => String(x.id) === String(paymentId));

      if (!p) {
        toast("❌ Pagamento não encontrado");
        return;
      }

      editingPayId = paymentId;

      const pt = payBackdrop ? payBackdrop.querySelector("h3") : null;
      if (pt) pt.textContent = "Editar pagamento";

      await fillProfessionals(payProfessional);
      await fillAppointments(payLinkAppt);

      if (payProfessional) payProfessional.value = p.professional_id || "";
      if (payLinkAppt) payLinkAppt.value = p.appointment_id || "";

      if (payAmount) payAmount.value = p.amount != null ? String(p.amount) : "";
      if (payDate) payDate.value = fmtDateTimeLocal(p.payment_date);
      if (payStatus) payStatus.value = p.status || "PENDING";
      if (payMethod) payMethod.value = p.method || "PIX";
      if (payNote) payNote.value = p.note || "";

      if (btnDeletePay) btnDeletePay.style.display = "inline-flex";

      updateCardDerivedUI();
      show(payBackdrop);
    } catch (err) {
      console.error("Erro ao abrir pagamento:", err);
      toast("❌ Erro ao abrir pagamento");
    }
  }

  function closePayment() {
    hide(payBackdrop);
    editingPayId = null;
  }

  async function savePayment() {
    try {
      const amount = parseFloat(payAmount?.value || "0");
      if (!amount || amount <= 0) {
        toast("⚠️ Informe um valor válido");
        return;
      }

      const isoDate = parseDateTimeLocal(payDate?.value);
      if (!isoDate) {
        toast("⚠️ Informe a data/hora");
        return;
      }

      const status = payStatus?.value || "PENDING";
      const method = payMethod?.value || "PIX";
      let note = (payNote?.value || "").trim();

      if (method === "CARD") {
        const inst = cardInstallments?.value || "1";
        const fee = cardFee?.value || "";
        const auth = cardAuthorization?.value || "";
        const extra = `Cartão: ${cardBrand?.value || ""} ${cardType?.value || ""} • ${inst}x • taxa ${fee || "0"}% • NSU ${auth || "—"}`;
        note = note ? `${note}\n${extra}` : extra;
      }

      const payload = {
        patient_id: patientId,
        professional_id: payProfessional?.value || null,
        appointment_id: payLinkAppt?.value || null,
        amount,
        payment_date: isoDate,
        status,
        method,
        note
      };

      if (editingPayId) {
        if (!C || typeof C.updatePayment !== "function") {
          console.error("Cornelius.updatePayment não existe.");
          toast("❌ API não carregada (updatePayment).");
          return;
        }
        await C.updatePayment(editingPayId, payload);
      } else {
        if (!C || typeof C.addPayment !== "function") {
          console.error("Cornelius.addPayment não existe.");
          toast("❌ API não carregada (addPayment).");
          return;
        }
        await C.addPayment(payload);
      }

      closePayment();
      await loadPaymentsAndSummary();
    } catch (err) {
      console.error("Erro ao salvar pagamento:", err);
      toast("❌ Erro ao salvar pagamento");
    }
  }

  async function deletePayment() {
    try {
      if (!editingPayId) return;
      if (!confirm("⚠️ Tem certeza que deseja excluir este pagamento?")) return;

      if (!C || typeof C.deletePayment !== "function") {
        console.error("Cornelius.deletePayment não existe.");
        toast("❌ API não carregada (deletePayment).");
        return;
      }

      await C.deletePayment(editingPayId);
      closePayment();
      await loadPaymentsAndSummary();
    } catch (err) {
      console.error("Erro ao excluir pagamento:", err);
      toast("❌ Erro ao excluir pagamento");
    }
  }

  safeOn(btnAddPayment, "click", openNewPayment);
  safeOn(btnClosePay, "click", closePayment);
  safeOn(btnCancelPay, "click", closePayment);
  safeOn(btnDeletePay, "click", deletePayment);

  safeOn(payMethod, "change", updateCardDerivedUI);
  safeOn(payAmount, "input", updateCardDerivedUI);
  safeOn(cardInstallments, "change", updateCardDerivedUI);
  safeOn(cardFee, "input", updateCardDerivedUI);

  // -----------------------------
  // Configurações financeiras
  // -----------------------------
  function patientConsultationValueFromModel() {
    return currentPatient?.consultation_value ?? currentPatient?.consultationValue ?? null;
  }
  function patientFinancialNoteFromModel() {
    return currentPatient?.financial_note ?? currentPatient?.financialNote ?? null;
  }

  async function loadFinanceSettings() {
    const v = patientConsultationValueFromModel();
    const n = patientFinancialNoteFromModel();

    if (cfgConsultationValue) cfgConsultationValue.value = v != null ? String(v) : "";
    if (cfgFinancialNote) cfgFinancialNote.value = n != null ? String(n) : "";
  }

  async function saveFinanceSettings() {
    try {
      if (!C || typeof C.updatePatient !== "function") {
        console.error("Cornelius.updatePatient não existe.");
        toast("❌ API não carregada (updatePatient).");
        return;
      }

      const val = cfgConsultationValue?.value ? parseFloat(cfgConsultationValue.value) : null;
      const note = (cfgFinancialNote?.value || "").trim();

      const updates = {
        consultation_value: val,
        financial_note: note
      };

      await C.updatePatient(patientId, updates);
      await loadPatient();
      toast("✅ Configurações financeiras salvas");
    } catch (err) {
      console.error("Erro ao salvar config financeira:", err);
      toast("❌ Erro ao salvar configurações financeiras");
    }
  }

  safeOn(btnSaveFinanceSettings, "click", saveFinanceSettings);

  // -----------------------------
  // Enter para salvar via <form>
  // -----------------------------
  safeOn(editForm, "submit", (e) => {
    e.preventDefault();
    saveEditPatientModal();
  });

  safeOn(noteForm, "submit", (e) => {
    e.preventDefault();
    saveNote();
  });

  safeOn(payForm, "submit", (e) => {
    e.preventDefault();
    savePayment();
  });

  // Ctrl+Enter em textarea (anotação/pagamento)
  safeOn(noteText, "keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveNote();
  });
  safeOn(payNote, "keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") savePayment();
  });

    // =============================================================================
  // REALTIME (Global)
  // =============================================================================
  const RT = window.CorneliusRealtime;
  if (RT) {
    RT.on("patients:change", () => loadPatient());

    RT.on("appointments:change", () => {
      if (currentTab === "appointments") loadPatientAppointments();
    });

    RT.on("clinical_notes:change", () => {
      if (currentTab === "history") loadNotes();
    });

    RT.on("payments:change", () => {
      if (currentTab === "finance") loadPaymentsAndSummary();
    });
  }

  // ===============================
// Gerenciar paciente (Admin only)
// ===============================
(function initPatientManage() {
  const role = (localStorage.getItem("cornelius_role") || "").toLowerCase().trim();
  const isAdmin = role === "admin";

  const panel = document.getElementById("patientAdminPanel");
  const btn = document.getElementById("btnManagePatient");
  const menu = document.getElementById("patientManageMenu");

  const btnArchive = document.getElementById("btnArchivePatient");
  const btnRestore = document.getElementById("btnRestorePatient");
  const btnDelete = document.getElementById("btnDeletePatient");

  if (!panel || !btn || !menu) return;

  if (!isAdmin) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";

function getPatientIdSafe() {
  return patientId;
}


  function closeMenu() { menu.style.display = "none"; }
  function toggleMenu() { menu.style.display = (menu.style.display === "none" ? "block" : "none"); }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btn) closeMenu();
  });

  // Ajusta quais itens aparecem baseado no status do paciente (is_active)
  async function syncPatientStatusUI() {
    try {
      const id = getPatientIdSafe();
      if (!id) return;

      // Tenta buscar o paciente (se você já tem ele em memória, pode setar direto)
      const { data, error } = await window.supabaseClient
        .from("patients")
        .select("id, is_active")
        .eq("id", id)
        .single();

      if (error) throw error;

      const active = data?.is_active !== false;

      if (btnArchive) btnArchive.style.display = active ? "block" : "none";
      if (btnRestore) btnRestore.style.display = active ? "block" : "none";
    } catch (err) {
      console.warn("⚠️ Não foi possível sincronizar status do paciente:", err);
    }
  }

  if (btnArchive) {
    btnArchive.addEventListener("click", async () => {
      closeMenu();
      const id = getPatientIdSafe();
      if (!id) return alert("Paciente inválido.");

      const ok = confirm("Inativar este paciente?\n\nEle será ocultado das listas e não poderá receber novos agendamentos.");
      if (!ok) return;

      try {
        await window.Cornelius.archivePatient(id);
        await syncPatientStatusUI();
        alert("✅ Paciente inativado.");
      } catch (e) {
        console.error(e);
        alert("❌ Não foi possível inativar.");
      }
    });
  }

  if (btnRestore) {
    btnRestore.addEventListener("click", async () => {
      closeMenu();
      const id = getPatientIdSafe();
      if (!id) return alert("Paciente inválido.");

      const ok = confirm("Reativar este paciente?\n\nEle voltará a aparecer nas listas.");
      if (!ok) return;

      try {
        await window.Cornelius.restorePatient(id);
        await syncPatientStatusUI();
        alert("✅ Paciente reativado.");
      } catch (e) {
        console.error(e);
        alert("❌ Não foi possível reativar.");
      }
    });
  }

if (btnDelete) {
  btnDelete.addEventListener("click", async () => {
    closeMenu();
    const id = getPatientIdSafe();
    if (!id) return alert("Paciente inválido.");

    const ok = confirm(
      "ATENÇÃO!\n\nIsso irá excluir o paciente e TODOS os dados relacionados (agendamentos, histórico, financeiro).\n\nDeseja continuar?"
    );
    if (!ok) return;

    const typed = prompt('Para excluir permanentemente, digite EXCLUIR:');
    if (typed !== "EXCLUIR") {
      alert("Exclusão cancelada.");
      return;
    }

    try {
      await window.Cornelius.deletePatientPermanent(id);
      alert("✅ Paciente excluído permanentemente.");
      window.location.href = "index.html";
    } catch (e) {
      console.error(e);
      alert("❌ Erro ao excluir paciente.");
    }
  });
}


  // Inicial
  syncPatientStatusUI();
})();

  // -----------------------------
  // Boot
  // -----------------------------
  (async function boot() {
    await loadPatient();
    setTab("history");
  })();
})();
