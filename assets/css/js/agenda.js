(function () {
  "use strict";

  const C = window.Cornelius;
  C.setActiveNav();

  const elCalendar = document.getElementById("calendar");
  const calMissing = document.getElementById("calMissing");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const btnNew = document.getElementById("btnNew");
  const btnClose = document.getElementById("btnClose");
  const btnCancel = document.getElementById("btnCancel");
  const btnSave = document.getElementById("btnSave");
  const btnDelete = document.getElementById("btnDelete");

  const patientSelect = document.getElementById("patientSelect");
  const professionalSelect = document.getElementById("professionalSelect");
  const professionalFilter = document.getElementById("professionalFilter");

  const startAt = document.getElementById("startAt");
  const endAt = document.getElementById("endAt");
  const color = document.getElementById("color");
  const notes = document.getElementById("notes");

  let calendar = null;
  let editingId = null;

  // feriados nacionais (bloqueio + fundo)
  let blockedHolidayDates = new Set();

  function openModal() {
    modalBackdrop.style.display = "flex";
  }

  function closeModal() {
    modalBackdrop.style.display = "none";
    editingId = null;
    btnDelete.style.display = "none";
  }

  function qs(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function ymdLocal(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function buildPatientOptions(data) {
    patientSelect.innerHTML = "";
    data.patients
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.cpf})`;
        patientSelect.appendChild(opt);
      });
  }

  function buildProfessionalOptions(data) {
    const pros = (data.professionals || []).slice().sort((a, b) => a.name.localeCompare(b.name));

    professionalSelect.innerHTML = "";
    pros.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      professionalSelect.appendChild(opt);
    });

    professionalFilter.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Todos";
    professionalFilter.appendChild(all);

    pros.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      professionalFilter.appendChild(opt);
    });

    // mantém seleção anterior se existir
    const prev = localStorage.getItem("cornelius_filter_pro") || "";
    if ([...professionalFilter.options].some(o => o.value === prev)) {
      professionalFilter.value = prev;
    }
  }

  function setDefaultTimes(fromDate) {
    const start = fromDate ? new Date(fromDate) : new Date();
    start.setMinutes(0, 0, 0);
    if (!fromDate) start.setHours(Math.min(start.getHours() + 1, 19));

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    startAt.value = C.toLocalInputValue(start.toISOString()).slice(0, 16);
    endAt.value = C.toLocalInputValue(end.toISOString()).slice(0, 16);
  }

  function syncColorFromPatient(data) {
    const p = C.getPatientById(data, patientSelect.value);
    if (p && p.color) color.value = p.color;
  }

  function validateForm() {
    if (!patientSelect.value) throw new Error("Selecione um paciente.");
    if (!professionalSelect.value) throw new Error("Selecione um profissional.");
    if (!startAt.value || !endAt.value) throw new Error("Informe início e fim.");

    const startIso = C.fromLocalInputValue(startAt.value);
    const endIso = C.fromLocalInputValue(endAt.value);

    const s = new Date(startIso);
    const e = new Date(endIso);
    if (e <= s) throw new Error("O horário de fim deve ser maior que o início.");

    // Bloqueio por feriado nacional (data do início)
    const key = ymdLocal(s);
    if (blockedHolidayDates.has(key)) {
      throw new Error("Data bloqueada: feriado nacional.");
    }

    return { startIso, endIso };
  }

  function removeHolidaySourceIfExists() {
    if (!calendar || typeof calendar.getEventSourceById !== "function") return;
    const src = calendar.getEventSourceById("holidays");
    if (src) src.remove();
  }

  function loadHolidaysForView() {
    const api = window.CorneliusFeriados;
    if (!api || typeof api.feriadosNacionaisBR !== "function") {
      blockedHolidayDates = new Set();
      return;
    }

    removeHolidaySourceIfExists();
    blockedHolidayDates = new Set();

    const view = calendar.view;
    const y1 = view.activeStart.getFullYear();
    const y2 = view.activeEnd.getFullYear();
    const years = y1 === y2 ? [y1] : [y1, y2];

    const events = [];
    years.forEach((y) => {
      api.feriadosNacionaisBR(y).forEach((h) => {
        blockedHolidayDates.add(h.date);

        events.push({
          id: `h_${h.date}`,
          title: "",
          start: h.date,
          allDay: true,
          display: "background",
          backgroundColor: "rgba(46,125,105,0.18)",
          borderColor: "rgba(46,125,105,0.22)",
          extendedProps: { isHoliday: true, holidayName: h.name },
        });
      });
    });

    calendar.addEventSource({ id: "holidays", events });
  }

  function buildCalendarEvents(data) {
    const filterPro = professionalFilter.value || "";
    localStorage.setItem("cornelius_filter_pro", filterPro);

    const appts = (data.appointments || []).slice();
    const filtered = filterPro ? appts.filter(a => a.professionalId === filterPro) : appts;

    return filtered.map((a) => {
      const p = C.getPatientById(data, a.patientId);
      const pro = C.getProfessionalById(data, a.professionalId);

      return {
        id: a.id,
        title: `${p ? p.name : "Paciente"}${pro ? " — " + pro.name : ""}`,
        start: a.start,
        end: a.end,
        backgroundColor: a.color || (p?.color || "#7FDCAC"),
        borderColor: "rgba(16,42,38,0.18)",
        textColor: "#0B1F1B",
        extendedProps: {
          patientId: a.patientId,
          professionalId: a.professionalId || null,
          notes: a.notes || "",
        },
      };
    });
  }

  function renderCalendar(data) {
    if (!window.FullCalendar) {
      calMissing.style.display = "block";
      return;
    }
    calMissing.style.display = "none";

    const events = buildCalendarEvents(data);

    calendar = new FullCalendar.Calendar(elCalendar, {
      initialView: "timeGridWeek",
      locale: "pt-br",
      nowIndicator: true,
      height: "auto",
      selectable: true,
      selectMirror: true,
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      slotMinTime: "07:00:00",
      slotMaxTime: "21:00:00",

      datesSet: () => {
        loadHolidaysForView();
      },

      selectAllow: (selectInfo) => {
        const key = ymdLocal(selectInfo.start);
        if (blockedHolidayDates.has(key)) {
          C.toast("Data bloqueada", "Feriado nacional.");
          return false;
        }
        return true;
      },

      select: (info) => {
        const d = C.load();
        buildPatientOptions(d);
        buildProfessionalOptions(d);

        editingId = null;
        btnDelete.style.display = "none";

        const prePatient = qs("patient");
        if (prePatient) patientSelect.value = prePatient;

        const prePro = professionalFilter.value || (d.professionals?.[0]?.id || "");
        if (prePro) professionalSelect.value = prePro;

        startAt.value = C.toLocalInputValue(info.startStr).slice(0, 16);
        endAt.value = C.toLocalInputValue(info.endStr).slice(0, 16);

        syncColorFromPatient(d);
        notes.value = "";
        openModal();
      },

      eventClick: (info) => {
        const d = C.load();
        const appt = (d.appointments || []).find((x) => x.id === info.event.id);
        if (!appt) return;

        buildPatientOptions(d);
        buildProfessionalOptions(d);

        editingId = appt.id;
        btnDelete.style.display = "inline-flex";

        patientSelect.value = appt.patientId;
        professionalSelect.value = appt.professionalId || (d.professionals?.[0]?.id || "");

        startAt.value = C.toLocalInputValue(appt.start).slice(0, 16);
        endAt.value = C.toLocalInputValue(appt.end).slice(0, 16);

        color.value = appt.color || (C.getPatientById(d, appt.patientId)?.color || "#7FDCAC");
        notes.value = appt.notes || "";

        openModal();
      },

      events,
    });

    calendar.render();
    loadHolidaysForView();
  }

  function refresh() {
    const data = C.load();

    buildPatientOptions(data);
    buildProfessionalOptions(data);

    if (calendar) calendar.destroy();
    renderCalendar(data);
  }

  // Handlers
  btnNew.addEventListener("click", () => {
    const data = C.load();

    buildPatientOptions(data);
    buildProfessionalOptions(data);

    editingId = null;
    btnDelete.style.display = "none";

    const prePatient = qs("patient");
    if (prePatient) patientSelect.value = prePatient;

    // padrão: se filtro está setado, usa no modal
    const selectedPro = professionalFilter.value || (data.professionals?.[0]?.id || "");
    if (selectedPro) professionalSelect.value = selectedPro;

    setDefaultTimes();
    syncColorFromPatient(data);
    notes.value = "";
    openModal();
  });

  professionalFilter.addEventListener("change", () => refresh());

  patientSelect.addEventListener("change", () => {
    const data = C.load();
    syncColorFromPatient(data);
  });

  btnClose.addEventListener("click", closeModal);
  btnCancel.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  btnSave.addEventListener("click", () => {
    try {
      const data = C.load();
      const { startIso, endIso } = validateForm();

      const payload = {
        patientId: patientSelect.value,
        professionalId: professionalSelect.value,
        start: startIso,
        end: endIso,
        color: color.value,
        notes: notes.value,
      };

      if (editingId) {
        C.updateAppointment(data, editingId, payload);
        C.toast("Agendamento atualizado");
      } else {
        C.addAppointment(data, payload);
        C.toast("Agendamento criado");
      }

      C.save(data);
      closeModal();
      refresh();
    } catch (err) {
      C.toast("Não foi possível salvar", err.message || String(err));
    }
  });

  btnDelete.addEventListener("click", () => {
    if (!editingId) return;
    const ok = confirm("Excluir este agendamento?");
    if (!ok) return;

    const data = C.load();
    C.deleteAppointment(data, editingId);
    C.save(data);

    C.toast("Agendamento excluído");
    closeModal();
    refresh();
  });

  // init
  refresh();
})();
