(function () {
  "use strict";

if (window.CorneliusAuth && !window.CorneliusAuth.requireAuth()) return;


  const STORAGE_KEY = "cornelius_clinica_v1";

  function pad(n) { return String(n).padStart(2, "0"); }
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function cleanCPF(cpf) { return (cpf || "").replace(/\D/g, ""); }
  function formatCPF(cpf) {
    const c = cleanCPF(cpf);
    if (c.length !== 11) return cpf || "";
    return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9,11)}`;
  }

  function normalize(str) {
    return (str || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function toast(title, detail) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.innerHTML = `${escapeHtml(title)}${detail ? `<small>${escapeHtml(detail)}</small>` : ""}`;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 2400);
  }

  function setActiveNav() {
    const page = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav a").forEach(a => {
      const href = a.getAttribute("href");
      a.classList.toggle("active", href === page);
    });
  }

  function toLocalInputValue(iso) {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromLocalInputValue(v) {
    const d = new Date(v);
    if (isNaN(d)) throw new Error("Data/hora inválida.");
    return d.toISOString();
  }

  function humanDateTime(iso) {
    const d = new Date(iso);
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  function pickColor() {
    const colors = ["#E76F51","#F4A261","#2A9D8F","#457B9D","#7FDCAC","#9B5DE5","#F15BB5","#00BBF9"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ---- Default data (seed) ----
  function defaultData() {
    const professionals = [
      { id: "pro1", name: "Paulinha", color: "#E76F51" },
      { id: "pro2", name: "Laís",     color: "#2A9D8F" },
      { id: "pro3", name: "Bruna",    color: "#457B9D" }
    ];

    const patients = [
      {
        id: "p1",
        name: "Rafael Lima",
        cpf: "002.952.616-76",
        email: "rafa@email.com",
        phone: "(11) 96666-4444",
        address: "Rua Verde, 10",
        color: "#7FDCAC",
        consultationValue: 180.00,
        financialNote: "Valor padrão"
      }
    ];

    const appointments = [
      {
        id: "a1",
        patientId: "p1",
        professionalId: "pro3",
        start: new Date().toISOString(),
        end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        color: "#7FDCAC",
        notes: "Sessão"
      }
    ];

    const notes = [
      {
        id: "n1",
        patientId: "p1",
        appointmentId: null,
        professionalId: "pro3",
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        text: "Anotação inicial do paciente."
      }
    ];

    const payments = [
      {
        id: "pay1",
        patientId: "p1",
        appointmentId: "a1",
        professionalId: "pro3",
        amount: 180.00,
        status: "PAID",
        method: "PIX",
        paidAt: new Date().toISOString(),
        note: "Pagamento realizado.",
        card: null
      }
    ];

    return { patients, appointments, notes, professionals, payments };
  }

  // ---- Enums Financeiro ----
  const PAYMENT_STATUS = {
    PAID: "PAID",
    PENDING: "PENDING",
    PARTIAL: "PARTIAL",
    FREE: "FREE"
  };

  const PAYMENT_METHOD = {
    PIX: "PIX",
    CARD: "CARD",
    CASH: "CASH",
    TRANSFER: "TRANSFER",
    OTHER: "OTHER"
  };

  const CARD_TYPE = {
    CREDIT: "CREDIT",
    DEBIT: "DEBIT"
  };

  const CARD_BRAND = {
    VISA: "VISA",
    MASTERCARD: "MASTERCARD",
    ELO: "ELO",
    AMEX: "AMEX",
    HIPERCARD: "HIPERCARD",
    OTHER: "OTHER"
  };

  function normalizeCard(card) {
    if (!card || typeof card !== "object") return null;

    const type = card.type === CARD_TYPE.DEBIT ? CARD_TYPE.DEBIT : CARD_TYPE.CREDIT;
    const brand = Object.values(CARD_BRAND).includes(card.brand) ? card.brand : CARD_BRAND.OTHER;

    let installments = Number(card.installments || 1);
    if (!isFinite(installments) || installments < 1) installments = 1;
    if (installments > 12) installments = 12;
    if (type === CARD_TYPE.DEBIT) installments = 1;

    let feePercent = Number(card.feePercent || 0);
    if (!isFinite(feePercent) || feePercent < 0) feePercent = 0;
    if (feePercent > 100) feePercent = 100;

    return {
      type,
      brand,
      installments,
      authorization: String(card.authorization || "").trim(),
      feePercent
    };
  }

  function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = defaultData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const data = JSON.parse(raw);

    // Migração / garantias
    if (!Array.isArray(data.professionals)) data.professionals = [];
    if (!Array.isArray(data.patients)) data.patients = [];
    if (!Array.isArray(data.appointments)) data.appointments = [];
    if (!Array.isArray(data.notes)) data.notes = [];
    if (!Array.isArray(data.payments)) data.payments = [];

    // NOVO: migração para profissionais (email + preferência)
    data.professionals.forEach(p => {
      if (p.email === undefined) p.email = "";
      if (p.notify_email_enabled === undefined) p.notify_email_enabled = true;
    });

    // Migração pacientes
    data.patients.forEach(p => {
      if (p.consultationValue === undefined || p.consultationValue === null) p.consultationValue = 0;
      if (p.financialNote === undefined) p.financialNote = "";
    });

    // Migração appointments
    data.appointments.forEach(a => {
      if (a.professionalId === undefined) a.professionalId = null;
      if (a.room === undefined) a.room = "";
    });

    // Migração notes
    data.notes.forEach(n => {
      if (n.createdAt === undefined) n.createdAt = new Date().toISOString();
      if (n.appointmentId === undefined) n.appointmentId = null;
      if (n.professionalId === undefined) n.professionalId = null;
    });

    // Migração payments
    data.payments.forEach(p => {
      if (p.appointmentId === undefined) p.appointmentId = null;
      if (p.professionalId === undefined) p.professionalId = null;
      if (typeof p.amount !== "number") p.amount = Number(p.amount || 0);
      if (!p.status) p.status = PAYMENT_STATUS.PAID;
      if (!p.method) p.method = PAYMENT_METHOD.PIX;
      if (!p.paidAt) p.paidAt = new Date().toISOString();
      if (p.note === undefined) p.note = "";

      if (p.card === undefined) p.card = null;
      p.card = normalizeCard(p.card);
      if (p.method !== PAYMENT_METHOD.CARD) p.card = null;
    });

    return data;
  } catch (e) {
    const seeded = defaultData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}


  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ---- Lookups ----
  function getPatientById(data, id) {
    return data.patients.find(p => p.id === id) || null;
  }
  function getProfessionalById(data, id) {
    return (data.professionals || []).find(p => p.id === id) || null;
  }

  // ---- Patients ----
  function addPatient(data, payload) {
    const cpfClean = cleanCPF(payload.cpf);
    if (cpfClean.length !== 11) throw new Error("CPF inválido (precisa ter 11 dígitos).");
    const exists = data.patients.some(p => cleanCPF(p.cpf) === cpfClean);
    if (exists) throw new Error("Já existe paciente com este CPF.");

    const patient = {
      id: uid("p"),
      name: String(payload.name || "").trim(),
      cpf: formatCPF(cpfClean),
      email: (payload.email || "").trim(),
      phone: (payload.phone || "").trim(),
      address: (payload.address || "").trim(),
      color: payload.color || "#7FDCAC",
      consultationValue: Number(payload.consultationValue || 0),
      financialNote: String(payload.financialNote || "").trim()
    };
    if (!patient.name) throw new Error("Nome é obrigatório.");
    data.patients.unshift(patient);
    return patient;
  }

  function updatePatient(data, patientId, patch) {
    const idx = data.patients.findIndex(p => p.id === patientId);
    if (idx < 0) throw new Error("Paciente não encontrado.");

    if (patch.cpf != null) {
      const cpfClean = cleanCPF(patch.cpf);
      if (cpfClean.length !== 11) throw new Error("CPF inválido (precisa ter 11 dígitos).");
      const exists = data.patients.some(p => p.id !== patientId && cleanCPF(p.cpf) === cpfClean);
      if (exists) throw new Error("Já existe outro paciente com este CPF.");
      data.patients[idx].cpf = formatCPF(cpfClean);
    }

    ["name","email","phone","address","color"].forEach(k => {
      if (patch[k] != null) data.patients[idx][k] = (typeof patch[k] === "string" ? patch[k].trim() : patch[k]);
    });

    if (patch.consultationValue != null) {
      const v = Number(patch.consultationValue);
      if (!isFinite(v) || v < 0) throw new Error("Valor da consulta inválido.");
      data.patients[idx].consultationValue = v;
    }
    if (patch.financialNote != null) {
      data.patients[idx].financialNote = String(patch.financialNote || "").trim();
    }

    return data.patients[idx];
  }

  function searchPatients(data, query) {
    const q = normalize(query);
    const cpfQ = cleanCPF(query);

    return data.patients.filter(p => {
      if (!q && !cpfQ) return true;
      const name = normalize(p.name);
      const cpf = cleanCPF(p.cpf);
      return (q && name.includes(q)) || (cpfQ && cpf.includes(cpfQ));
    });
  }

  // ---- Professionals ----
  function addProfessional(data, payload) {
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("Nome do profissional é obrigatório.");

  const email = String(payload.email || "").trim().toLowerCase();
  const notifyEnabled = (payload.notify_email_enabled !== false); // default true

  // Se notificações estiverem ligadas, exige email válido
  if (notifyEnabled) {
    if (!email) throw new Error("Informe o email do profissional (ou desative notificações).");
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!okEmail) throw new Error("Email inválido.");
  }

  const pro = {
    id: uid("pro"),
    name,
    color: payload.color || "#7FDCAC",
    email,
    notify_email_enabled: notifyEnabled
  };

  data.professionals.push(pro);
  return pro;
}

  function updateProfessional(data, proId, patch) {
  const idx = data.professionals.findIndex(p => p.id === proId);
  if (idx < 0) throw new Error("Profissional não encontrado.");

  if (patch.name != null) data.professionals[idx].name = String(patch.name).trim();
  if (patch.color != null) data.professionals[idx].color = patch.color;

  if (patch.email !== undefined) {
    data.professionals[idx].email = String(patch.email || "").trim().toLowerCase();
  }
  if (patch.notify_email_enabled !== undefined) {
    data.professionals[idx].notify_email_enabled = !!patch.notify_email_enabled;
  }

  // validação final
  const pro = data.professionals[idx];
  if (pro.notify_email_enabled !== false) {
    if (!pro.email) throw new Error("Informe o email do profissional (ou desative notificações).");
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pro.email);
    if (!okEmail) throw new Error("Email inválido.");
  }

  return pro;
}

  function deleteProfessional(data, proId) {
    const inUse =
      data.appointments.some(a => a.professionalId === proId) ||
      (data.notes || []).some(n => n.professionalId === proId) ||
      (data.payments || []).some(p => p.professionalId === proId);

    if (inUse) throw new Error("Profissional em uso (agenda/notas/financeiro). Troque antes de excluir.");
    const idx = data.professionals.findIndex(p => p.id === proId);
    if (idx >= 0) data.professionals.splice(idx, 1);
  }

  // ---- Appointments ----
 function addAppointment(data, payload) {
  const appt = {
    id: uid("a"),
    patientId: payload.patientId,
    professionalId: payload.professionalId || null,
    start: payload.start,
    end: payload.end,
    color: payload.color,
    notes: (payload.notes || "").trim(),
    room: String(payload.room || "").trim()   // <-- ADD
  };
  data.appointments.push(appt);
  return appt;
}

  function updateAppointment(data, apptId, patch) {
    const idx = data.appointments.findIndex(a => a.id === apptId);
    if (idx < 0) throw new Error("Agendamento não encontrado.");
    ["patientId","professionalId","start","end","color","notes","room"].forEach(k => {
      if (patch[k] != null) data.appointments[idx][k] = patch[k];
    });
    return data.appointments[idx];
  }
  function deleteAppointment(data, apptId) {
    data.notes = (data.notes || []).filter(n => n.appointmentId !== apptId);
    data.payments = (data.payments || []).filter(p => p.appointmentId !== apptId);
    const idx = data.appointments.findIndex(a => a.id === apptId);
    if (idx >= 0) data.appointments.splice(idx, 1);
  }

  // ---- Notes ----
  function addNote(data, payload) {
    const note = {
      id: uid("n"),
      patientId: payload.patientId,
      appointmentId: payload.appointmentId || null,
      professionalId: payload.professionalId || null,
      createdAt: payload.createdAt || new Date().toISOString(),
      text: (payload.text || "").trim()
    };
    data.notes.unshift(note);
    return note;
  }
  function updateNote(data, noteId, patch) {
    const idx = data.notes.findIndex(n => n.id === noteId);
    if (idx < 0) throw new Error("Nota não encontrada.");
    if (patch.createdAt != null) data.notes[idx].createdAt = patch.createdAt;
    if (patch.text != null) data.notes[idx].text = (patch.text || "").trim();
    if (patch.professionalId != null) data.notes[idx].professionalId = patch.professionalId;
    if (patch.appointmentId !== undefined) data.notes[idx].appointmentId = patch.appointmentId || null;
    return data.notes[idx];
  }
  function deleteNote(data, noteId) {
    const idx = data.notes.findIndex(n => n.id === noteId);
    if (idx >= 0) data.notes.splice(idx, 1);
  }
  function getNotesByPatient(data, patientId) {
    return (data.notes || [])
      .filter(n => n.patientId === patientId)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ---- Payments ----
  function addPayment(data, payload) {
    const amount = Number(payload.amount || 0);
    if (!isFinite(amount) || amount < 0) throw new Error("Valor inválido.");

    const method = payload.method || PAYMENT_METHOD.PIX;
    const card = method === PAYMENT_METHOD.CARD ? normalizeCard(payload.card) : null;

    const p = {
      id: uid("pay"),
      patientId: payload.patientId,
      appointmentId: payload.appointmentId || null,
      professionalId: payload.professionalId || null,
      amount,
      status: payload.status || PAYMENT_STATUS.PAID,
      method,
      paidAt: payload.paidAt || new Date().toISOString(),
      note: (payload.note || "").trim(),
      card
    };
    data.payments.unshift(p);
    return p;
  }

  function updatePayment(data, paymentId, patch) {
    const idx = data.payments.findIndex(p => p.id === paymentId);
    if (idx < 0) throw new Error("Pagamento não encontrado.");

    if (patch.amount != null) {
      const amount = Number(patch.amount);
      if (!isFinite(amount) || amount < 0) throw new Error("Valor inválido.");
      data.payments[idx].amount = amount;
    }
    if (patch.status != null) data.payments[idx].status = patch.status;
    if (patch.method != null) data.payments[idx].method = patch.method;
    if (patch.paidAt != null) data.payments[idx].paidAt = patch.paidAt;
    if (patch.note != null) data.payments[idx].note = String(patch.note || "").trim();
    if (patch.professionalId !== undefined) data.payments[idx].professionalId = patch.professionalId || null;
    if (patch.appointmentId !== undefined) data.payments[idx].appointmentId = patch.appointmentId || null;

    // NOVO: card (normaliza e respeita método)
    if (patch.card !== undefined) {
      data.payments[idx].card = normalizeCard(patch.card);
    }
    if (data.payments[idx].method !== PAYMENT_METHOD.CARD) {
      data.payments[idx].card = null;
    } else {
      data.payments[idx].card = normalizeCard(data.payments[idx].card);
    }

    return data.payments[idx];
  }

  function deletePayment(data, paymentId) {
    const idx = data.payments.findIndex(p => p.id === paymentId);
    if (idx >= 0) data.payments.splice(idx, 1);
  }

  function getPaymentsByPatient(data, patientId) {
    return (data.payments || [])
      .filter(p => p.patientId === patientId)
      .slice()
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
  }

  function calcFinancialSummary(data, patient) {
    const payments = getPaymentsByPatient(data, patient.id);

    const totalPaid = payments
      .filter(p => p.status === PAYMENT_STATUS.PAID || p.status === PAYMENT_STATUS.PARTIAL)
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const pendingCount = payments.filter(p => p.status === PAYMENT_STATUS.PENDING).length;
    const last = payments[0] || null;

    return {
      consultationValue: Number(patient.consultationValue || 0),
      totalPaid,
      pendingCount,
      lastPaymentAt: last ? last.paidAt : null
    };
  }

  function moneyBR(value) {
    const n = Number(value || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // ---- Appointments queries ----
  function getAppointmentsByPatient(data, patientId) {
    return (data.appointments || [])
      .filter(a => a.patientId === patientId)
      .slice()
      .sort((a, b) => new Date(b.start) - new Date(a.start));
  }

  // Próximos atendimentos (para a Home)
  function getUpcomingAppointments(data, limit = 6) {
    const now = Date.now();

    return (data.appointments || [])
      .filter(a => {
        const start = new Date(a.start).getTime();
        return Number.isFinite(start) && start >= now;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, limit);
  }

  function resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.Cornelius = {
    load, save, uid, normalize, cleanCPF, formatCPF,
    toast, setActiveNav, escapeHtml,

    toLocalInputValue, fromLocalInputValue, humanDateTime,
    pickColor, resetDemo,

    getPatientById,
    addPatient, updatePatient, searchPatients,

    getProfessionalById,
    addProfessional, updateProfessional, deleteProfessional,

    addAppointment, updateAppointment, deleteAppointment,
    getAppointmentsByPatient,
    getUpcomingAppointments,

    addNote, updateNote, deleteNote, getNotesByPatient,

    // Financeiro
    PAYMENT_STATUS,
    PAYMENT_METHOD,

    CARD_TYPE,
    CARD_BRAND,

    addPayment, updatePayment, deletePayment,
    getPaymentsByPatient,
    calcFinancialSummary,
    moneyBR
  };
})();
