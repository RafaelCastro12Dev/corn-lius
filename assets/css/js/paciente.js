(function () {
  "use strict";

  const C = window.Cornelius;
  C.setActiveNav();

  const title = document.getElementById("title");
  const subtitle = document.getElementById("subtitle");

  const colorDot = document.getElementById("colorDot");
  const patientFields = document.getElementById("patientFields");

  // Tabs
  const tabHistory = document.getElementById("tabHistory");
  const tabFinance = document.getElementById("tabFinance");
  const tabFinanceSettings = document.getElementById("tabFinanceSettings");

  const panelHistory = document.getElementById("panelHistory");
  const panelFinance = document.getElementById("panelFinance");
  const panelFinanceSettings = document.getElementById("panelFinanceSettings");

  // History (notes timeline)
  const notesList = document.getElementById("notesList");
  const notesEmpty = document.getElementById("notesEmpty");
  const btnAddNote = document.getElementById("btnAddNote");

  // Finance
  const sumConsultation = document.getElementById("sumConsultation");
  const sumPaid = document.getElementById("sumPaid");
  const sumPending = document.getElementById("sumPending");
  const btnAddPayment = document.getElementById("btnAddPayment");
  const paymentsList = document.getElementById("paymentsList");
  const paymentsEmpty = document.getElementById("paymentsEmpty");

  // Finance settings
  const cfgConsultationValue = document.getElementById("cfgConsultationValue");
  const cfgFinancialNote = document.getElementById("cfgFinancialNote");
  const btnSaveFinanceSettings = document.getElementById("btnSaveFinanceSettings");

  // Patient actions
  const btnSchedule = document.getElementById("btnSchedule");
  const btnEdit = document.getElementById("btnEdit");

  // Note modal
  const noteBackdrop = document.getElementById("noteBackdrop");
  const btnCloseNote = document.getElementById("btnCloseNote");
  const btnCancelNote = document.getElementById("btnCancelNote");
  const btnSaveNote = document.getElementById("btnSaveNote");
  const btnDeleteNote = document.getElementById("btnDeleteNote");
  const noteProfessional = document.getElementById("noteProfessional");
  const noteLinkAppt = document.getElementById("noteLinkAppt");
  const noteWhen = document.getElementById("noteWhen");
  const noteText = document.getElementById("noteText");

  // Payment modal
  const payBackdrop = document.getElementById("payBackdrop");
  const btnClosePay = document.getElementById("btnClosePay");
  const btnCancelPay = document.getElementById("btnCancelPay");
  const btnSavePay = document.getElementById("btnSavePay");
  const btnDeletePay = document.getElementById("btnDeletePay");
  const payProfessional = document.getElementById("payProfessional");
  const payLinkAppt = document.getElementById("payLinkAppt");
  const payAmount = document.getElementById("payAmount");
  const payDate = document.getElementById("payDate");
  const payStatus = document.getElementById("payStatus");
  const payMethod = document.getElementById("payMethod");
  const payNote = document.getElementById("payNote");

  // NOVO: Card fields
  const cardBox = document.getElementById("cardBox");
  const cardType = document.getElementById("cardType");
  const cardBrand = document.getElementById("cardBrand");
  const cardInstallments = document.getElementById("cardInstallments");
  const cardInstallmentValue = document.getElementById("cardInstallmentValue");
  const cardAuthorization = document.getElementById("cardAuthorization");
  const cardFee = document.getElementById("cardFee");
  const cardNetInfo = document.getElementById("cardNetInfo");

  // Edit patient modal
  const editBackdrop = document.getElementById("editBackdrop");
  const btnCloseEdit = document.getElementById("btnCloseEdit");
  const btnCancelEdit = document.getElementById("btnCancelEdit");
  const btnSaveEdit = document.getElementById("btnSaveEdit");
  const eName = document.getElementById("eName");
  const eCpf = document.getElementById("eCpf");
  const eColor = document.getElementById("eColor");
  const eEmail = document.getElementById("eEmail");
  const ePhone = document.getElementById("ePhone");
  const eAddress = document.getElementById("eAddress");

  let patientId = null;
  let editingNoteId = null;
  let editingPayId = null;

  function qs(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function open(el) { el.style.display = "flex"; }
  function close(el) { el.style.display = "none"; }

  function setTab(which) {
    panelHistory.style.display = "none";
    panelFinance.style.display = "none";
    panelFinanceSettings.style.display = "none";

    tabHistory.classList.remove("primary");
    tabFinance.classList.remove("primary");
    tabFinanceSettings.classList.remove("primary");

    if (which === "history") {
      panelHistory.style.display = "block";
      tabHistory.classList.add("primary");
    } else if (which === "finance") {
      panelFinance.style.display = "block";
      tabFinance.classList.add("primary");
    } else {
      panelFinanceSettings.style.display = "block";
      tabFinanceSettings.classList.add("primary");
    }
  }

  function renderPatientCard(data, p) {
    title.textContent = p.name;
    subtitle.textContent = `CPF: ${p.cpf}`;
    colorDot.style.background = p.color || "#7FDCAC";

    patientFields.innerHTML = "";

    const fields = [
      ["E-mail", p.email || "-"],
      ["Telefone", p.phone || "-"],
      ["Endereço", p.address || "-"]
    ];

    fields.forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="meta">
          <strong>${C.escapeHtml(k)}</strong>
          <span>${C.escapeHtml(v)}</span>
        </div>
      `;
      patientFields.appendChild(row);
    });
  }

  function fillProfessionalsSelect(selectEl, data) {
    const pros = (data.professionals || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    selectEl.innerHTML = "";
    pros.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      selectEl.appendChild(opt);
    });
    if (!pros.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Cadastre profissionais";
      selectEl.appendChild(opt);
    }
  }

  function fillAppointmentLinks(selectEl, data, appts) {
    selectEl.innerHTML = "";
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Sem vínculo (geral)";
    selectEl.appendChild(optNone);

    appts.forEach((a) => {
      const pro = C.getProfessionalById(data, a.professionalId);
      const label = `${C.humanDateTime(a.start)}${pro ? " — " + pro.name : ""}`;
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = label;
      selectEl.appendChild(opt);
    });
  }

  // ---------- HISTÓRICO (atendimentos + anotações) ----------
  function timelineItem(titleText, subtitleText, rightPillHtml, bodyHtml) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="meta" style="min-width:0;">
        <strong>${C.escapeHtml(titleText)}</strong>
        <span>${C.escapeHtml(subtitleText)}</span>
        ${bodyHtml ? `<div style="margin-top:8px; color: var(--text); font-size: 13px; line-height: 1.35;">${bodyHtml}</div>` : ""}
      </div>
      ${rightPillHtml || ""}
    `;
    return div;
  }

  function renderHistory(data) {
    const appts = C.getAppointmentsByPatient(data, patientId);
    const notes = C.getNotesByPatient(data, patientId);

    if (!appts.length && !notes.length) {
      notesList.innerHTML = "";
      notesEmpty.style.display = "block";
      return;
    }
    notesEmpty.style.display = "none";
    notesList.innerHTML = "";

    const events = [];
    appts.forEach(a => events.push({ kind: "appt", when: a.start, data: a }));
    notes.forEach(n => events.push({ kind: "note", when: n.createdAt, data: n }));
    events.sort((x, y) => new Date(y.when) - new Date(x.when));

    events.forEach((ev) => {
      if (ev.kind === "appt") {
        const a = ev.data;
        const pro = C.getProfessionalById(data, a.professionalId);
        const right = pro
          ? `<span class="pill"><span class="dot" style="background:${pro.color || "#7FDCAC"}"></span>${C.escapeHtml(pro.name)}</span>`
          : `<span class="pill"><span class="dot"></span>Sem profissional</span>`;

        notesList.appendChild(
          timelineItem(
            "Atendimento agendado",
            C.humanDateTime(a.start),
            right,
            a.notes ? C.escapeHtml(a.notes) : ""
          )
        );
      } else {
        const n = ev.data;
        const pro = C.getProfessionalById(data, n.professionalId);
        const right = pro
          ? `<span class="pill"><span class="dot" style="background:${pro.color || "#7FDCAC"}"></span>${C.escapeHtml(pro.name)}</span>`
          : `<span class="pill"><span class="dot"></span>Anotação</span>`;

        const vinculo = n.appointmentId ? "Vinculada a um atendimento" : "Geral";
        const sub = `${C.humanDateTime(n.createdAt)} • ${vinculo}`;

        const item = timelineItem("Anotação", sub, right, C.escapeHtml(n.text || ""));
        item.style.cursor = "pointer";
        item.title = "Clique para editar";
        item.addEventListener("click", () => openNoteModalForEdit(data, n));
        notesList.appendChild(item);
      }
    });
  }

  function openNoteModalForNew(data) {
    editingNoteId = null;
    btnDeleteNote.style.display = "none";

    const appts = C.getAppointmentsByPatient(data, patientId);
    fillProfessionalsSelect(noteProfessional, data);
    fillAppointmentLinks(noteLinkAppt, data, appts);

    noteWhen.value = C.toLocalInputValue(new Date().toISOString()).slice(0, 16);
    noteText.value = "";
    noteLinkAppt.value = "";
    noteProfessional.value = (data.professionals?.[0]?.id || "");

    open(noteBackdrop);
  }

  function openNoteModalForEdit(data, note) {
    editingNoteId = note.id;
    btnDeleteNote.style.display = "inline-flex";

    const appts = C.getAppointmentsByPatient(data, patientId);
    fillProfessionalsSelect(noteProfessional, data);
    fillAppointmentLinks(noteLinkAppt, data, appts);

    noteWhen.value = C.toLocalInputValue(note.createdAt).slice(0, 16);
    noteText.value = note.text || "";
    noteProfessional.value = note.professionalId || (data.professionals?.[0]?.id || "");
    noteLinkAppt.value = note.appointmentId || "";

    open(noteBackdrop);
  }

  function closeNoteModal() {
    close(noteBackdrop);
    editingNoteId = null;
    btnDeleteNote.style.display = "none";
  }

  // ---------- FINANCEIRO ----------
  function statusLabel(s) {
    const map = { PAID:"Pago", PENDING:"Pendente", PARTIAL:"Parcial", FREE:"Isento" };
    return map[s] || s;
  }

  function methodLabel(m) {
    const map = { PIX:"Pix", CARD:"Cartão", CASH:"Dinheiro", TRANSFER:"Transferência", OTHER:"Outros" };
    return map[m] || m;
  }

  function cardTypeLabel(t) {
    return t === "DEBIT" ? "Débito" : "Crédito";
  }

  function cardBrandLabel(b) {
    const map = { VISA:"Visa", MASTERCARD:"Mastercard", ELO:"Elo", AMEX:"Amex", HIPERCARD:"Hipercard", OTHER:"Outros" };
    return map[b] || b;
  }

  function renderFinance(data, patient) {
    const summary = C.calcFinancialSummary(data, patient);
    sumConsultation.textContent = C.moneyBR(summary.consultationValue);
    sumPaid.textContent = C.moneyBR(summary.totalPaid);
    sumPending.textContent = `${summary.pendingCount} pendente(s)`;

    const payments = C.getPaymentsByPatient(data, patientId);
    paymentsList.innerHTML = "";
    paymentsEmpty.style.display = payments.length ? "none" : "block";

    payments.forEach((p) => {
      const pro = C.getProfessionalById(data, p.professionalId);
      const right = pro
        ? `<span class="pill"><span class="dot" style="background:${pro.color || "#7FDCAC"}"></span>${C.escapeHtml(pro.name)}</span>`
        : `<span class="pill"><span class="dot"></span>Pagamento</span>`;

      const titleText = `${C.moneyBR(p.amount)} • ${statusLabel(p.status)} • ${methodLabel(p.method)}`;
      const subtitleText = `${C.humanDateTime(p.paidAt)}${p.appointmentId ? " • Vinculado a atendimento" : ""}`;

      let extra = "";
      if (p.method === "CARD" && p.card) {
        const inst = Number(p.card.installments || 1);
        const per = inst > 0 ? (Number(p.amount || 0) / inst) : Number(p.amount || 0);
        const fee = Number(p.card.feePercent || 0);
        const net = Number(p.amount || 0) * (1 - fee / 100);

        extra += `<div style="margin-top:8px; font-size:13px; line-height:1.35;">` +
          `${C.escapeHtml(cardTypeLabel(p.card.type))} • ${C.escapeHtml(cardBrandLabel(p.card.brand))} • ` +
          `${C.escapeHtml(String(inst))}x de ${C.escapeHtml(C.moneyBR(per))}` +
          `</div>`;

        const parts = [];
        if (fee > 0) parts.push(`Taxa ${fee.toFixed(2)}%`);
        if (fee > 0) parts.push(`Líquido ${C.moneyBR(net)}`);
        if (p.card.authorization) parts.push(`NSU ${p.card.authorization}`);

        if (parts.length) {
          extra += `<div style="margin-top:6px; font-size:12.5px; opacity:.9;">${C.escapeHtml(parts.join(" • "))}</div>`;
        }
      }

      if (p.note) {
        extra += `<div style="margin-top:8px; font-size:13px; line-height:1.35;">${C.escapeHtml(p.note)}</div>`;
      }

      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="meta" style="min-width:0;">
          <strong>${C.escapeHtml(titleText)}</strong>
          <span>${C.escapeHtml(subtitleText)}</span>
          ${extra}
        </div>
        ${right}
      `;

      item.style.cursor = "pointer";
      item.title = "Clique para editar";
      item.addEventListener("click", () => openPayModalForEdit(C.load(), p, C.getPatientById(C.load(), patientId)));

      paymentsList.appendChild(item);
    });
  }

  // ---------- UI Cartão ----------
  function fillInstallmentsOptions() {
    cardInstallments.innerHTML = "";
    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i}x`;
      cardInstallments.appendChild(opt);
    }
  }

  function recalcCard() {
    const amount = Number(payAmount.value || 0);
    let inst = Number(cardInstallments.value || 1);
    if (!isFinite(inst) || inst < 1) inst = 1;
    if (inst > 12) inst = 12;

    const isDebit = cardType.value === "DEBIT";
    if (isDebit) inst = 1;

    cardInstallments.value = String(inst);
    cardInstallments.disabled = isDebit;

    const per = inst > 0 ? amount / inst : amount;
    cardInstallmentValue.value = C.moneyBR(per);

    let fee = Number(cardFee.value || 0);
    if (!isFinite(fee) || fee < 0) fee = 0;
    if (fee > 100) fee = 100;

    const net = amount * (1 - fee / 100);

    const parts = [];
    parts.push(`${cardTypeLabel(cardType.value)} • ${cardBrandLabel(cardBrand.value)} • ${inst}x de ${C.moneyBR(per)}`);
    if (fee > 0) parts.push(`Taxa ${fee.toFixed(2)}% • Líquido ${C.moneyBR(net)}`);
    if ((cardAuthorization.value || "").trim()) parts.push(`NSU ${String(cardAuthorization.value).trim()}`);

    cardNetInfo.textContent = parts.join(" • ");
  }

  function syncCardUI() {
    const isCard = payMethod.value === "CARD";
    cardBox.style.display = isCard ? "block" : "none";
    if (!isCard) return;
    recalcCard();
  }

  // ---------- Modal Pagamento ----------
  function openPayModalForNew(data, patient) {
    editingPayId = null;
    btnDeletePay.style.display = "none";

    const appts = C.getAppointmentsByPatient(data, patientId);
    fillProfessionalsSelect(payProfessional, data);
    fillAppointmentLinks(payLinkAppt, data, appts);

    payAmount.value = Number(patient.consultationValue || 0).toFixed(2);
    payDate.value = C.toLocalInputValue(new Date().toISOString()).slice(0, 16);
    payStatus.value = "PAID";
    payMethod.value = "PIX";
    payNote.value = "";

    payProfessional.value = (data.professionals?.[0]?.id || "");
    payLinkAppt.value = "";

    // defaults cartão
    fillInstallmentsOptions();
    cardType.value = "CREDIT";
    cardBrand.value = "VISA";
    cardInstallments.value = "1";
    cardAuthorization.value = "";
    cardFee.value = "";

    syncCardUI();

    open(payBackdrop);
  }

  function openPayModalForEdit(data, pay, patient) {
    editingPayId = pay.id;
    btnDeletePay.style.display = "inline-flex";

    const appts = C.getAppointmentsByPatient(data, patientId);
    fillProfessionalsSelect(payProfessional, data);
    fillAppointmentLinks(payLinkAppt, data, appts);

    payAmount.value = Number(pay.amount || 0).toFixed(2);
    payDate.value = C.toLocalInputValue(pay.paidAt).slice(0, 16);
    payStatus.value = pay.status || "PAID";
    payMethod.value = pay.method || "PIX";
    payNote.value = pay.note || "";
    payProfessional.value = pay.professionalId || (data.professionals?.[0]?.id || "");
    payLinkAppt.value = pay.appointmentId || "";

    fillInstallmentsOptions();

    const card = pay.card || null;
    if (payMethod.value === "CARD") {
      cardType.value = (card && card.type) ? card.type : "CREDIT";
      cardBrand.value = (card && card.brand) ? card.brand : "VISA";
      cardInstallments.value = String((card && card.installments) ? card.installments : 1);
      cardAuthorization.value = (card && card.authorization) ? card.authorization : "";
      cardFee.value = (card && typeof card.feePercent === "number" && card.feePercent > 0) ? String(card.feePercent) : "";
    } else {
      cardType.value = "CREDIT";
      cardBrand.value = "VISA";
      cardInstallments.value = "1";
      cardAuthorization.value = "";
      cardFee.value = "";
    }

    syncCardUI();
    open(payBackdrop);
  }

  function closePayModal() {
    close(payBackdrop);
    editingPayId = null;
    btnDeletePay.style.display = "none";
  }

  // ---------- CONFIG FINANCEIRA ----------
  function renderFinanceSettings(patient) {
    cfgConsultationValue.value = Number(patient.consultationValue || 0).toFixed(2);
    cfgFinancialNote.value = patient.financialNote || "";
  }

  // ---------- NOTA modal ----------
  function openNoteModalForEdit(data, note) {
    editingNoteId = note.id;
    btnDeleteNote.style.display = "inline-flex";

    const appts = C.getAppointmentsByPatient(data, patientId);
    fillProfessionalsSelect(noteProfessional, data);
    fillAppointmentLinks(noteLinkAppt, data, appts);

    noteWhen.value = C.toLocalInputValue(note.createdAt).slice(0, 16);
    noteText.value = note.text || "";
    noteProfessional.value = note.professionalId || (data.professionals?.[0]?.id || "");
    noteLinkAppt.value = note.appointmentId || "";

    open(noteBackdrop);
  }

  function closeNoteModal() {
    close(noteBackdrop);
    editingNoteId = null;
    btnDeleteNote.style.display = "none";
  }

  // ---------- EDIT PATIENT ----------
  function openEditModal(p) {
    eName.value = p.name || "";
    eCpf.value = p.cpf || "";
    eColor.value = p.color || "#7FDCAC";
    eEmail.value = p.email || "";
    ePhone.value = p.phone || "";
    eAddress.value = p.address || "";
    open(editBackdrop);
  }
  function closeEditModal() { close(editBackdrop); }

  // ---------- INIT ----------
  function init() {
    patientId = qs("id");
    if (!patientId) {
      C.toast("Paciente inválido", "Faltou o parâmetro ?id=");
      return;
    }

    const data = C.load();
    const patient = C.getPatientById(data, patientId);
    if (!patient) {
      C.toast("Paciente não encontrado");
      return;
    }

    // Default tab
    setTab("history");

    // Render base
    renderPatientCard(data, patient);
    renderHistory(data);
    renderFinance(data, patient);
    renderFinanceSettings(patient);

    // Tab handlers
    tabHistory.addEventListener("click", () => setTab("history"));
    tabFinance.addEventListener("click", () => setTab("finance"));
    tabFinanceSettings.addEventListener("click", () => setTab("settings"));

    // Patient actions
    btnSchedule.addEventListener("click", () => {
      window.location.href = `agenda.html?patient=${encodeURIComponent(patientId)}`;
    });
    btnEdit.addEventListener("click", () => openEditModal(patient));

    // Notes
    btnAddNote.addEventListener("click", () => {
      const fresh = C.load();
      editingNoteId = null;
      btnDeleteNote.style.display = "none";

      const appts = C.getAppointmentsByPatient(fresh, patientId);
      fillProfessionalsSelect(noteProfessional, fresh);
      fillAppointmentLinks(noteLinkAppt, fresh, appts);

      noteWhen.value = C.toLocalInputValue(new Date().toISOString()).slice(0, 16);
      noteText.value = "";
      noteLinkAppt.value = "";
      noteProfessional.value = (fresh.professionals?.[0]?.id || "");
      open(noteBackdrop);
    });

    btnCloseNote.addEventListener("click", closeNoteModal);
    btnCancelNote.addEventListener("click", closeNoteModal);
    noteBackdrop.addEventListener("click", (e) => { if (e.target === noteBackdrop) closeNoteModal(); });

    btnSaveNote.addEventListener("click", () => {
      try {
        const fresh = C.load();
        const createdAt = C.fromLocalInputValue(noteWhen.value);
        const text = (noteText.value || "").trim();
        if (!text) throw new Error("A anotação não pode ficar vazia.");

        const payload = {
          patientId,
          appointmentId: noteLinkAppt.value || null,
          professionalId: noteProfessional.value || null,
          createdAt,
          text
        };

        if (editingNoteId) {
          C.updateNote(fresh, editingNoteId, payload);
          C.toast("Anotação atualizada");
        } else {
          C.addNote(fresh, payload);
          C.toast("Anotação criada");
        }

        C.save(fresh);
        closeNoteModal();
        renderHistory(C.load());
      } catch (err) {
        C.toast("Erro", err.message || String(err));
      }
    });

    btnDeleteNote.addEventListener("click", () => {
      if (!editingNoteId) return;
      if (!confirm("Excluir esta anotação?")) return;

      const fresh = C.load();
      C.deleteNote(fresh, editingNoteId);
      C.save(fresh);

      C.toast("Anotação excluída");
      closeNoteModal();
      renderHistory(C.load());
    });

    // Payments
    btnAddPayment.addEventListener("click", () => openPayModalForNew(C.load(), C.getPatientById(C.load(), patientId)));
    btnClosePay.addEventListener("click", closePayModal);
    btnCancelPay.addEventListener("click", closePayModal);
    payBackdrop.addEventListener("click", (e) => { if (e.target === payBackdrop) closePayModal(); });

    // NOVO: listeners cartão
    payMethod.addEventListener("change", () => {
      // se trocar de cartão pra outro método, limpa card
      if (payMethod.value !== "CARD") {
        cardAuthorization.value = "";
        cardFee.value = "";
        cardInstallments.value = "1";
      }
      syncCardUI();
    });
    payAmount.addEventListener("input", () => syncCardUI());
    cardType.addEventListener("change", () => syncCardUI());
    cardBrand.addEventListener("change", () => syncCardUI());
    cardInstallments.addEventListener("change", () => syncCardUI());
    cardFee.addEventListener("input", () => syncCardUI());
    cardAuthorization.addEventListener("input", () => syncCardUI());

    btnSavePay.addEventListener("click", () => {
      try {
        const fresh = C.load();
        const patientNow = C.getPatientById(fresh, patientId);

        const amount = Number(payAmount.value);
        if (!isFinite(amount) || amount < 0) throw new Error("Valor inválido.");
        const paidAt = C.fromLocalInputValue(payDate.value);

        const method = payMethod.value;

        const payload = {
          patientId,
          appointmentId: payLinkAppt.value || null,
          professionalId: payProfessional.value || null,
          amount,
          status: payStatus.value,
          method,
          paidAt,
          note: payNote.value,
          card: null
        };

        if (method === "CARD") {
          let inst = Number(cardInstallments.value || 1);
          if (!isFinite(inst) || inst < 1) inst = 1;
          if (inst > 12) inst = 12;

          const isDebit = cardType.value === "DEBIT";
          if (isDebit) inst = 1;

          let fee = Number(cardFee.value || 0);
          if (!isFinite(fee) || fee < 0) fee = 0;
          if (fee > 100) fee = 100;

          payload.card = {
            type: cardType.value,
            brand: cardBrand.value,
            installments: inst,
            authorization: String(cardAuthorization.value || "").trim(),
            feePercent: fee
          };
        }

        if (editingPayId) {
          C.updatePayment(fresh, editingPayId, payload);
          C.toast("Pagamento atualizado");
        } else {
          C.addPayment(fresh, payload);
          C.toast("Pagamento registrado");
        }

        C.save(fresh);
        closePayModal();

        const after = C.load();
        const patientAfter = C.getPatientById(after, patientId);
        renderFinance(after, patientAfter);
      } catch (err) {
        C.toast("Erro", err.message || String(err));
      }
    });

    btnDeletePay.addEventListener("click", () => {
      if (!editingPayId) return;
      if (!confirm("Excluir este pagamento?")) return;

      const fresh = C.load();
      C.deletePayment(fresh, editingPayId);
      C.save(fresh);

      C.toast("Pagamento excluído");
      closePayModal();

      const after = C.load();
      const patientAfter = C.getPatientById(after, patientId);
      renderFinance(after, patientAfter);
    });

    // Finance settings save
    btnSaveFinanceSettings.addEventListener("click", () => {
      try {
        const fresh = C.load();
        const v = Number(cfgConsultationValue.value || 0);
        if (!isFinite(v) || v < 0) throw new Error("Valor da consulta inválido.");

        C.updatePatient(fresh, patientId, {
          consultationValue: v,
          financialNote: cfgFinancialNote.value
        });
        C.save(fresh);

        C.toast("Configuração financeira salva");

        const after = C.load();
        const patientNow = C.getPatientById(after, patientId);

        renderFinance(after, patientNow);
        renderFinanceSettings(patientNow);
      } catch (err) {
        C.toast("Erro", err.message || String(err));
      }
    });

    // Edit patient modal
    btnCloseEdit.addEventListener("click", closeEditModal);
    btnCancelEdit.addEventListener("click", closeEditModal);
    editBackdrop.addEventListener("click", (e) => { if (e.target === editBackdrop) closeEditModal(); });

    btnSaveEdit.addEventListener("click", () => {
      try {
        const fresh = C.load();
        C.updatePatient(fresh, patientId, {
          name: eName.value,
          cpf: eCpf.value,
          color: eColor.value,
          email: eEmail.value,
          phone: ePhone.value,
          address: eAddress.value
        });
        C.save(fresh);

        C.toast("Paciente atualizado");
        closeEditModal();

        const after = C.load();
        const patientNow = C.getPatientById(after, patientId);
        renderPatientCard(after, patientNow);
        renderFinance(after, patientNow);
        renderFinanceSettings(patientNow);
      } catch (err) {
        C.toast("Erro ao salvar", err.message || String(err));
      }
    });
  }

  init();
})();
