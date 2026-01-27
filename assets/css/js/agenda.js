/**
 * Cornélius - Agenda (Calendário FullCalendar)
 * Versão Supabase (async/await)
 *
 * - Profissional vê SOMENTE a própria agenda (email Auth -> professionals.email)
 * - Filtro de profissional oculto para professional
 * - Realtime ignora eventos de outros profissionais
 * - FIX: hora não “anda” ao editar (datetime-local em hora local, não UTC)
 * - VISUAL: cards mais premium + sala pequena ao lado do horário + grid mais consistente
 */

(function () {
  "use strict";

  if (window.CorneliusAuth && !window.CorneliusAuth.requireAnyRole(["admin", "professional"])) return;

  const C = window.Cornelius;
  if (C && typeof C.setActiveNav === "function") C.setActiveNav();

  // -----------------------------
  // DOM
  // -----------------------------
  const calendarEl = document.getElementById("calendar");
  const calMissing = document.getElementById("calMissing");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const btnNew = document.getElementById("btnNew");
  const btnClose = document.getElementById("btnClose");
  const btnCancel = document.getElementById("btnCancel");
  const btnSave = document.getElementById("btnSave");
  const btnDelete = document.getElementById("btnDelete");

  const appointmentForm = document.getElementById("appointmentForm");

  const patientSearch = document.getElementById("patientSearch");
  const patientId = document.getElementById("patientId");
  const patientSuggest = document.getElementById("patientSuggest");

  const professionalSelect = document.getElementById("professionalSelect");
  const professionalFilter = document.getElementById("professionalFilter");

  const startAt = document.getElementById("startAt");
  const color = document.getElementById("color");
  const notes = document.getElementById("notes");
  const apptRoom = document.getElementById("apptRoom");

  // Multi (pode não existir no HTML)
  const multiMode = document.getElementById("multiMode");
  const multiBox = document.getElementById("multiBox");
  const multiCount = document.getElementById("multiCount");
  const btnBuildMulti = document.getElementById("btnBuildMulti");
  const multiList = document.getElementById("multiList");

  // -----------------------------
  // Estado
  // -----------------------------
  let calendar = null;
  let editingId = null;
  let blockedHolidays = [];

  // -----------------------------
  // Acesso (admin x professional)
  // -----------------------------
  const role = (window.CorneliusRole || localStorage.getItem("cornelius_role") || "").toLowerCase().trim();
  const isProfessional = role === "professional";
  const isReadOnly = isProfessional;

  // Lock 2.4
  let lockedProfessionalId = null;
  let lockedProfessionalName = null;
  let lockedProfessionalEmail = null;

  // -----------------------------
  // Helpers
  // -----------------------------
  function toast(msg) {
    if (C && typeof C.toast === "function") return C.toast(msg);
    alert(msg);
  }

  function ymdLocal(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d - offset);
    return local.toISOString().slice(0, 10);
  }

  // ✅ FIX: valor correto para <input type="datetime-local"> (hora local)
  function toDatetimeLocalValue(date) {
    if (!date) return "";
    const d = (date instanceof Date) ? date : new Date(date);
    const off = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - off);
    return local.toISOString().slice(0, 16);
  }

  function setDefaultTimes() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);

    if (startAt) startAt.value = toDatetimeLocalValue(start);
  }

  function debounce(fn, delay = 250) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function cleanCPF(v) {
    return (v || "").replace(/\D/g, "");
  }

  function formatCpf(cpf) {
    const c = cleanCPF(cpf);
    if (c.length !== 11) return cpf || "";
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  }

  function normalizeEmail(v) {
    return (v || "").toString().trim().toLowerCase();
  }

  function hideElement(el) {
    if (!el) return;
    const container =
      el.closest?.(".field") ||
      el.closest?.(".form-group") ||
      el.closest?.(".input-group") ||
      el.parentElement;
    if (container) container.style.display = "none";
    else el.style.display = "none";
  }

  // -----------------------------
  // 2.4 — Resolver lock do professional via email do Auth
  // -----------------------------
  async function resolveProfessionalLock() {
    if (!isProfessional) return;

    try {
      if (!window.supabaseClient) {
        console.warn("⚠️ supabaseClient não encontrado. Lock não aplicado.");
        hideElement(professionalFilter);
        return;
      }
      if (!C || typeof C.getAllProfessionals !== "function") {
        console.warn("⚠️ getAllProfessionals não disponível. Lock não aplicado.");
        hideElement(professionalFilter);
        return;
      }

      const { data: { user }, error } = await window.supabaseClient.auth.getUser();
      if (error) throw error;

      const email = normalizeEmail(user?.email);
      if (!email) throw new Error("Usuário logado sem email.");

      lockedProfessionalEmail = email;

      const professionals = await C.getAllProfessionals();
      const me = (professionals || []).find(p => normalizeEmail(p.email) === email);

      if (!me?.id) {
        console.warn("⚠️ Nenhum professional encontrado com este email:", email);
        hideElement(professionalFilter);
        return;
      }

      lockedProfessionalId = me.id;
      lockedProfessionalName = me.name || "Profissional";

      hideElement(professionalFilter);

      const title = document.getElementById("agendaTitle");
      if (title) title.textContent = `Agenda de ${lockedProfessionalName}`;

      console.log("🔒 Agenda travada para professional_id:", lockedProfessionalId, "| email:", lockedProfessionalEmail);
    } catch (e) {
      console.warn("⚠️ Erro ao aplicar lock do profissional:", e);
      hideElement(professionalFilter);
    }
  }

  // -----------------------------
  // Multi Mode
  // -----------------------------
  function setMultiEnabled(enabled) {
    if (!multiBox) return;
    multiBox.style.display = enabled ? "block" : "none";
    if (!enabled && multiList) multiList.innerHTML = "";
  }

  function resetMulti() {
    if (multiMode) multiMode.checked = false;
    setMultiEnabled(false);
    if (multiCount) multiCount.value = "2";
    if (multiList) multiList.innerHTML = "";
  }

  function buildMultiRows(n) {
    if (!multiList) return;
    multiList.innerHTML = "";

    const count = Math.max(2, Math.min(30, n || 2));

    for (let i = 0; i < count; i++) {
      const row = document.createElement("div");
      row.className = "row";
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr 1fr";
      row.style.gap = "12px";

      row.innerHTML = `
        <div>
          <label class="label">Início #${i + 1}</label>
          <input class="input" type="datetime-local" data-mstart>
        </div>
        <div>
          <label class="label">Fim #${i + 1}</label>
          <input class="input" type="datetime-local" data-mend>
        </div>
      `;
      multiList.appendChild(row);
    }

    const firstStart = multiList.querySelector("[data-mstart]");
    const firstEnd = multiList.querySelector("[data-mend]");
    if (firstStart && startAt?.value) firstStart.value = startAt.value;
  }

  if (multiMode) {
    multiMode.addEventListener("change", () => setMultiEnabled(!!multiMode.checked));
  }

  if (btnBuildMulti) {
    btnBuildMulti.addEventListener("click", () => {
      const n = parseInt(multiCount?.value || "2", 10);
      buildMultiRows(isNaN(n) ? 2 : n);
    });
  }

  // -----------------------------
  // Modal
  // -----------------------------
  function openModal() {
    editingId = null;

    const modalTitle = document.getElementById("modalTitle");
    if (modalTitle) modalTitle.textContent = "Novo Agendamento";

    if (patientSearch) patientSearch.value = "";
    if (patientId) patientId.value = "";

    if (patientSuggest) {
      patientSuggest.style.display = "none";
      patientSuggest.innerHTML = "";
    }

    if (professionalSelect) professionalSelect.value = "";
    if (startAt) startAt.value = "";
    if (color) color.value = "#2A9D8F";
    if (notes) notes.value = "";
    if (apptRoom) apptRoom.value = "";

    if (btnDelete) btnDelete.style.display = "none";

    resetMulti();

    if (modalBackdrop) {
      modalBackdrop.classList.add("show");
      modalBackdrop.style.display = "flex";
      modalBackdrop.style.opacity = "1";
      modalBackdrop.style.visibility = "visible";
      modalBackdrop.style.pointerEvents = "auto";
      modalBackdrop.style.position = "fixed";
      modalBackdrop.style.inset = "0";
      modalBackdrop.style.zIndex = "9999";
    }
  }

  function closeModal() {
    if (!modalBackdrop) return;

    modalBackdrop.classList.remove("show");

    modalBackdrop.style.display = "";
    modalBackdrop.style.opacity = "";
    modalBackdrop.style.visibility = "";
    modalBackdrop.style.pointerEvents = "";
    modalBackdrop.style.position = "";
    modalBackdrop.style.inset = "";
    modalBackdrop.style.zIndex = "";

    editingId = null;
    resetMulti();
  }

  // -----------------------------
  // Selects
  // -----------------------------
  async function buildPatientOptions() {
    if (patientSuggest) {
      patientSuggest.style.display = "none";
      patientSuggest.innerHTML = "";
    }
  }

  async function buildProfessionalOptions() {
    try {
      if (!C || typeof C.getAllProfessionals !== "function") return;

      const professionals = await C.getAllProfessionals();
      const prevFilter = professionalFilter ? professionalFilter.value : "";

      if (professionalSelect) professionalSelect.innerHTML = '<option value="">Selecione o profissional</option>';
      if (professionalFilter) professionalFilter.innerHTML = '<option value="">Todos os profissionais</option>';

      (professionals || []).forEach((p) => {
        if (professionalSelect) {
          const opt1 = document.createElement("option");
          opt1.value = p.id;
          opt1.textContent = p.name;
          professionalSelect.appendChild(opt1);
        }
        if (professionalFilter) {
          const opt2 = document.createElement("option");
          opt2.value = p.id;
          opt2.textContent = p.name;
          professionalFilter.appendChild(opt2);
        }
      });

      if (isProfessional && lockedProfessionalId && professionalFilter) {
        professionalFilter.value = lockedProfessionalId;
      } else if (professionalFilter && prevFilter && professionalFilter.querySelector(`option[value="${prevFilter}"]`)) {
        professionalFilter.value = prevFilter;
      }
    } catch (err) {
      console.error("❌ Erro ao carregar profissionais:", err);
    }
  }

  // -----------------------------
  // Busca de paciente (suggest)
  // -----------------------------
  function showPatientSuggest(items) {
    if (!patientSuggest) return;

    if (!items || items.length === 0) {
      patientSuggest.style.display = "none";
      patientSuggest.innerHTML = "";
      return;
    }

    patientSuggest.innerHTML = (items || [])
      .map(
        (p) => `
      <div class="item"
        data-id="${p.id}"
        data-name="${C.escapeHtml(p.name || "")}"
        data-cpf="${C.escapeHtml(p.cpf || "")}"
        data-color="${p.color || ""}"
        data-professional-id="${p.assigned_professional_id || ""}">
        <div>${C.escapeHtml(p.name || "-")}</div>
        <div class="muted">CPF: ${C.escapeHtml(formatCpf(p.cpf))}</div>
      </div>
    `
      )
      .join("");

    patientSuggest.style.display = "block";
  }

  const runPatientSearch = debounce(async () => {
    if (!patientSearch || !patientId) return;
    if (!C || typeof C.searchPatients !== "function") return;

    const term = (patientSearch.value || "").trim();
    patientId.value = "";

    if (term.length < 2) {
      showPatientSuggest([]);
      return;
    }

    try {
      const list = await C.searchPatients(term);
      showPatientSuggest((list || []).slice(0, 15));
    } catch (err) {
      console.error("❌ Erro ao buscar pacientes:", err);
      showPatientSuggest([]);
    }
  }, 250);

  if (patientSearch) patientSearch.addEventListener("input", runPatientSearch);

  if (patientSuggest) {
    patientSuggest.addEventListener("click", (ev) => {
      const item = ev.target.closest(".item");
      if (!item) return;

      if (patientId) patientId.value = item.dataset.id || "";
      if (patientSearch) patientSearch.value = item.dataset.name || "";

      if (item.dataset.color && color) color.value = item.dataset.color;

      if (item.dataset.professionalId && professionalSelect) {
        professionalSelect.value = item.dataset.professionalId;
      }

      showPatientSuggest([]);
    });
  }

  document.addEventListener("click", (ev) => {
    if (!patientSuggest || !patientSearch) return;
    if (!patientSuggest.contains(ev.target) && ev.target !== patientSearch) {
      showPatientSuggest([]);
    }
  });

  // -----------------------------
  // Feriados
  // -----------------------------
  function removeHolidaySourceIfExists() {
    if (!calendar) return;
    const src = calendar.getEventSourceById("holidays");
    if (src) src.remove();
  }

  function loadHolidaysForView(start, end) {
    if (!window.CorneliusFeriados) return;

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const years = [startYear];
    if (endYear !== startYear) years.push(endYear);

    blockedHolidays = [];
    years.forEach((year) => {
      const holidays = window.CorneliusFeriados.getHolidays(year);
      (holidays || []).forEach((h) => blockedHolidays.push(h.date));
    });

    removeHolidaySourceIfExists();

    const events = [];
    years.forEach((year) => {
      const holidays = window.CorneliusFeriados.getHolidays(year);
      (holidays || []).forEach((h) => {
        events.push({
          title: h.name,
          start: h.date,
          allDay: true,
          display: "background",
          color: "#ffebee",
          editable: false,
          className: "holiday-event",
        });
      });
    });

    if (events.length > 0 && calendar) {
      calendar.addEventSource({ id: "holidays", events, color: "#ffebee" });
    }
  }

  // -----------------------------
  // Build events
  // -----------------------------
  async function buildCalendarEvents() {
    try {
      if (!C) return [];

      const [appointments, patients, professionals] = await Promise.all([
        C.getAllAppointments?.() ?? [],
        C.getAllPatients?.() ?? [],
        C.getAllProfessionals?.() ?? [],
      ]);

      const patientMap = {};
      (patients || []).forEach((p) => (patientMap[p.id] = p));

      const professionalMap = {};
      (professionals || []).forEach((p) => (professionalMap[p.id] = p));

      const filterProfId = isProfessional
        ? (lockedProfessionalId || "")
        : (professionalFilter ? professionalFilter.value : "");

      const events = [];

      (appointments || []).forEach((a) => {
        if (filterProfId && a.professional_id !== filterProfId) return;

        const p = patientMap[a.patient_id];
        const pro = professionalMap[a.professional_id];

        // título base (sem sala)
        const title = `${p ? p.name : "Paciente"}${pro ? " — " + pro.name : ""}`;
        const eventColor = a.color || (p ? p.color : null) || "#2A9D8F";

        events.push({
          id: a.id,
          title,
          start: a.start_time,
          color: eventColor,
          extendedProps: {
            patientId: a.patient_id,
            professionalId: a.professional_id,
            notes: a.notes,
            room: a.room,
            patientName: p ? p.name : "Paciente",
            professionalName: pro ? pro.name : "",
          },
        });
      });

      return events;
    } catch (err) {
      console.error("❌ Erro ao construir eventos:", err);
      return [];
    }
  }

  // -----------------------------
  // Render Calendar
  // -----------------------------
  async function renderCalendar() {
    if (!calendarEl) {
      if (calMissing) calMissing.style.display = "block";
      return;
    }

    if (calendar) calendar.destroy();

    const events = await buildCalendarEvents();

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "timeGridWeek",
      locale: "pt-br",

      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      buttonText: { today: "Hoje", month: "Mês", week: "Semana", day: "Dia" },

      // Grid mais consistente
      slotDuration: "00:30:00",
      slotLabelInterval: "01:00",
      slotMinTime: "07:00:00",
      slotMaxTime: "21:00:00",

      // Melhor leitura
      height: "auto",
      expandRows: true,
      stickyHeaderDates: true,
      nowIndicator: false,
      dayHeaderFormat: { weekday: "short", day: "2-digit", month: "2-digit" },

      selectable: !isReadOnly,
      editable: false,

      // Evita sobreposição
      slotEventOverlap: false,
      eventOverlap: false,
      eventDisplay: "block",
      dayMaxEvents: true,

      // “toque” de card
      eventMinHeight: 32,
      eventShortHeight: 32,
      eventMaxStack: 4,

      slotLabelFormat: { hour: "2-digit", minute: "2-digit", meridiem: false },
      eventTimeFormat: { hour: "2-digit", minute: "2-digit", meridiem: false },

      events,

      // Conteúdo premium: hora + sala pequena + título com quebra
     eventContent: function (arg) {
  const props = arg.event.extendedProps || {};
  const patientName = props.patientName || "Paciente";
  const professionalName = props.professionalName || "";
  const room = props.room || "";

  const line1 = professionalName ? `${patientName} — ${professionalName}` : patientName;
  const roomNum = String(room).replace(/[^0-9]/g, "") || room;

  return {
    html: `
      <div>
        <div class="ce-top">
          <span class="ce-time">${arg.timeText}</span>
          ${room ? `<span class="ce-room">S${C.escapeHtml(roomNum)}</span>` : ""}
        </div>
        <div class="ce-title">${C.escapeHtml(line1)}</div>
      </div>
    `
  };
},


      // Estilo premium e hover suave
      eventDidMount: function (info) {
        const el = info.el;

        el.style.borderRadius = "14px";
        el.style.border = "1px solid rgba(0,0,0,0.10)";
        el.style.overflow = "hidden";
        el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.10)";

        el.style.transition = "transform .12s ease, box-shadow .12s ease";

        const main = el.querySelector(".fc-event-main");
        if (main) main.style.padding = "8px 10px";

        // Hover “levanta”
        el.addEventListener("mouseenter", () => {
          el.style.transform = "translateY(-1px)";
          el.style.boxShadow = "0 10px 22px rgba(0,0,0,0.14)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.10)";
        });
      },

      select: function (info) {
        if (isReadOnly) return;
        openModal();
        if (startAt) startAt.value = toDatetimeLocalValue(info.start);
      },

      eventClick: async function (info) {
        if (isReadOnly) return;

        const event = info.event;
        editingId = event.id;

        const modalTitle = document.getElementById("modalTitle");
        if (modalTitle) modalTitle.textContent = "Editar Agendamento";

        resetMulti();

        if (patientId) patientId.value = event.extendedProps.patientId || "";
        if (patientSearch) patientSearch.value = event.extendedProps.patientName || "";
        if (patientSuggest) {
          patientSuggest.style.display = "none";
          patientSuggest.innerHTML = "";
        }

        if (professionalSelect) professionalSelect.value = event.extendedProps.professionalId || "";
        if (startAt) startAt.value = toDatetimeLocalValue(event.start);
        if (color) color.value = event.backgroundColor || "#2A9D8F";
        if (notes) notes.value = event.extendedProps.notes || "";
        if (apptRoom) apptRoom.value = event.extendedProps.room || "";

        if (btnDelete) btnDelete.style.display = "inline-flex";

        if (modalBackdrop) {
          modalBackdrop.classList.add("show");
          modalBackdrop.style.display = "flex";
          modalBackdrop.style.opacity = "1";
          modalBackdrop.style.visibility = "visible";
          modalBackdrop.style.pointerEvents = "auto";
          modalBackdrop.style.position = "fixed";
          modalBackdrop.style.inset = "0";
          modalBackdrop.style.zIndex = "9999";
        }
      },

      datesSet: function (info) {
        loadHolidaysForView(info.start, info.end);
      },
    });

    calendar.render();

    const view = calendar.view;
    if (view && view.activeStart && view.activeEnd) {
      loadHolidaysForView(view.activeStart, view.activeEnd);
    }
  }

  // -----------------------------
  // Validação
  // -----------------------------
 function validateForm() {
  const patientIdValue = patientId?.value || "";
  const professionalId = professionalSelect?.value || "";
  const start = startAt?.value || "";

  if (!patientIdValue) return toast("⚠️ Selecione um paciente"), null;
  if (!professionalId) return toast("⚠️ Selecione um profissional"), null;
  if (!start) return toast("⚠️ Preencha a data/hora de início"), null;

  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return toast("⚠️ Data/hora inválida"), null;

  const dateYmd = ymdLocal(startDate);
  if (blockedHolidays.includes(dateYmd))
    return toast("⚠️ Não é possível agendar em feriado nacional"), null;

  return {
    patient_id: patientIdValue,
    professional_id: professionalId,
    start_time: startDate.toISOString(),
    room: (apptRoom?.value || "").trim(),
    color: (color?.value || "") || "#2A9D8F",
    notes: (notes?.value || "").trim(),
  };
}


  async function saveSingle() {
    const data = validateForm();
    if (!data) return;

    if (editingId) await C.updateAppointment(editingId, data);
    else await C.addAppointment(data);

  }

  async function saveSmart() {
    try {
      if (editingId) return await saveSingle();

      const isMulti = !!(multiMode && multiMode.checked);
      if (!isMulti) return await saveSingle();

      const starts = Array.from(multiList?.querySelectorAll("[data-mstart]") || []);
      const ends = Array.from(multiList?.querySelectorAll("[data-mend]") || []);
      if (!starts.length || !ends.length) return toast("⚠️ Clique em 'Gerar campos' e preencha os horários.");

      const base = validateForm();
      if (!base) return;

      const payloads = [];

      for (let i = 0; i < starts.length; i++) {
        const s = (starts[i].value || "").trim();
        const e = (ends[i]?.value || "").trim();
        if (!s || !e) return toast("⚠️ Preencha início e fim de todos os agendamentos.");

        const sDate = new Date(s);
        const eDate = new Date(e);

        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return toast("⚠️ Datas inválidas no agendamento múltiplo.");
        if (eDate <= sDate) return toast("⚠️ Em um dos itens, o fim é antes do início.");

        const dateYmd = ymdLocal(sDate);
        if (blockedHolidays.includes(dateYmd)) return toast("⚠️ Um dos agendamentos cai em feriado nacional.");

      }

      for (const p of payloads) await C.addAppointment(p);

      closeModal();
      await refresh();
      toast(`✅ ${payloads.length} agendamentos criados.`);
    } catch (err) {
  if (err?.code === "23505") {
    toast("⚠️ Já existe um agendamento nesse horário para este paciente.");
    closeModal();
    return;
  }

  console.error(err);
  toast("Erro ao salvar agendamento");
}

  }

  async function deleteAppointment() {
    if (!editingId) return;

    const ok = confirm("⚠️ Tem certeza que deseja remover este agendamento?");
    if (!ok) return;

    try {
      await C.deleteAppointment(editingId);
      closeModal();
      await refresh();
    } catch (err) {
      console.error("❌ Erro ao deletar:", err);
      toast("❌ Erro ao remover agendamento");
    }
  }

  async function refresh() {
    await buildPatientOptions();
    await buildProfessionalOptions();
    await renderCalendar();
  }

  // -----------------------------
  // Listeners
  // -----------------------------
  if (btnNew) {
    if (isReadOnly) {
      btnNew.style.display = "none";
    } else {
      btnNew.addEventListener("click", () => {
        openModal();
        setDefaultTimes();
      });
    }
  }

  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (appointmentForm) {
    appointmentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveSmart();
    });
  }

  appointmentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await saveSmart();
});

  if (btnDelete) btnDelete.addEventListener("click", deleteAppointment);

  if (professionalFilter && !isProfessional) {
    professionalFilter.addEventListener("change", refresh);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  async function applyPatientDefaultsById(pId) {
    if (!pId) return;
    try {
      if (!C || typeof C.getPatientById !== "function") return;

      const p = await C.getPatientById(pId);
      if (!p) return;

      if (p.color && color) color.value = p.color;

      const profId = p.assigned_professional_id || "";
      if (profId && professionalSelect) {
        await waitForProfessionalOption(profId, 2000);
        professionalSelect.value = profId;
      }
    } catch (e) {
      console.warn("Não foi possível aplicar defaults do paciente:", e);
    }
  }

  function waitForProfessionalOption(profId, timeoutMs = 2000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const opt = professionalSelect?.querySelector?.(`option[value="${profId}"]`);
        if (opt || Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  // -----------------------------
  // Passo 2.1: abrir modal automático + pré-preencher paciente via URL
  // -----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;

    const prePatientId = params.get("patient") || "";
    const prePatientName = params.get("patient_name") || "";

    setTimeout(async () => {
      openModal();
      setDefaultTimes();

      if (prePatientId && patientId) patientId.value = prePatientId;
      if (prePatientName && patientSearch) patientSearch.value = decodeURIComponent(prePatientName);

      await applyPatientDefaultsById(prePatientId);

      if (patientSuggest) patientSuggest.style.display = "none";

      history.replaceState(null, "", "agenda.html");
    }, 300);
  });

  // =============================================================================
  // REALTIME
  // =============================================================================
  const RT = window.CorneliusRealtime;
  if (RT) {
    if (isProfessional) {
      RT.on("appointments:change", (payload) => {
        const pid = payload?.new?.professional_id || payload?.old?.professional_id || null;
        if (lockedProfessionalId && pid && pid !== lockedProfessionalId) return;
        refresh();
      });
    } else {
      RT.on("appointments:change", async () => {
  if (calendar) {
    calendar.destroy();
    calendar = null;
  }
  await renderCalendar();
});

      RT.on("patients:change", () => refresh());
      RT.on("professionals:change", () => refresh());
      RT.on("realtime:reconnected", () => refresh());
    }
  }

  // -----------------------------
  // Boot
  // -----------------------------
  (async () => {
    await resolveProfessionalLock();
    await refresh();
  })();
})();