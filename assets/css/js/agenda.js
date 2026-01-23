/**
 * Cornélius - Agenda (Calendário FullCalendar)
 * Versão Supabase (async/await)
 *
 * - Paciente por busca (input + sugestão)
 * - Sala aparece apenas 1 vez (eventContent, não no título)
 * - Passo 2.1: abrir modal automaticamente via querystring (?new=1&patient=...&patient_name=...)
 * - Agendamento múltiplo dentro do mesmo modal (sem quebrar o simples)
 */

(function () {
  "use strict";

  if (window.CorneliusAuth && !window.CorneliusAuth.requireAuth()) return;

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

  // ✅ Form do modal (para Enter salvar)
  const appointmentForm = document.getElementById("appointmentForm");

  const patientSearch = document.getElementById("patientSearch");
  const patientId = document.getElementById("patientId");
  const patientSuggest = document.getElementById("patientSuggest");

  const professionalSelect = document.getElementById("professionalSelect");
  const professionalFilter = document.getElementById("professionalFilter");

  const startAt = document.getElementById("startAt");
  const endAt = document.getElementById("endAt");
  const color = document.getElementById("color");
  const notes = document.getElementById("notes");
  const apptRoom = document.getElementById("apptRoom");

  // Multi (pode não existir ainda no HTML; não quebra)
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

  function setDefaultTimes() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);

    if (startAt) startAt.value = start.toISOString().slice(0, 16);
    if (endAt) endAt.value = end.toISOString().slice(0, 16);
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

  // -----------------------------
  // Multi Mode (UI + helpers)
  // -----------------------------
  function setMultiEnabled(enabled) {
    if (!multiBox) return;

    multiBox.style.display = enabled ? "block" : "none";

    if (!enabled && multiList) {
      multiList.innerHTML = "";
    }
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

    const count = Math.max(2, Math.min(30, n || 2)); // limite de segurança

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

    // Pré-preenche a primeira linha com startAt/endAt atuais
    const firstStart = multiList.querySelector("[data-mstart]");
    const firstEnd = multiList.querySelector("[data-mend]");
    if (firstStart && startAt?.value) firstStart.value = startAt.value;
    if (firstEnd && endAt?.value) firstEnd.value = endAt.value;
  }

  if (multiMode) {
    multiMode.addEventListener("change", () => {
      setMultiEnabled(!!multiMode.checked);
    });
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
    if (endAt) endAt.value = "";
    if (color) color.value = "#2A9D8F";
    if (notes) notes.value = "";
    if (apptRoom) apptRoom.value = "";

    if (btnDelete) btnDelete.style.display = "none";

    // Multi sempre começa desligado ao abrir novo
    resetMulti();

    // Exibe modal (robusto)
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

    // limpa as forçadas
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
  // Selects / fontes
  // -----------------------------
  async function buildPatientOptions() {
    // paciente é por digitação; aqui só limpamos UI
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

      // Restaurar filtro anterior
      if (professionalFilter && prevFilter && professionalFilter.querySelector(`option[value="${prevFilter}"]`)) {
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

    // qualquer digitação invalida seleção anterior
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

      // cor do paciente
      if (item.dataset.color && color) color.value = item.dataset.color;

      // autopreencher profissional do paciente (se existir)
      if (item.dataset.professionalId && professionalSelect) {
        professionalSelect.value = item.dataset.professionalId;
      }

      showPatientSuggest([]);
    });
  }

  // fechar sugestão ao clicar fora
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
      calendar.addEventSource({
        id: "holidays",
        events,
        color: "#ffebee",
      });
    }
  }

  // -----------------------------
  // Eventos do calendário
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

      const filterProfId = professionalFilter ? professionalFilter.value : "";

      const events = [];

      (appointments || []).forEach((a) => {
        if (filterProfId && a.professional_id !== filterProfId) return;

        const p = patientMap[a.patient_id];
        const pro = professionalMap[a.professional_id];

        // Título sem sala
        const title = `${p ? p.name : "Paciente"}${pro ? " — " + pro.name : ""}`;
        const eventColor = a.color || (p ? p.color : null) || "#2A9D8F";

        events.push({
          id: a.id,
          title,
          start: a.start_time,
          end: a.end_time,
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
      slotMinTime: "07:00:00",
      slotMaxTime: "21:00:00",
      height: "auto",
      selectable: true,
      editable: false,
      eventTimeFormat: { hour: "2-digit", minute: "2-digit", meridiem: false },
      events,

      // Sala só no eventContent
      eventContent: function (arg) {
        const props = arg.event.extendedProps || {};
        const patientName = props.patientName || "Paciente";
        const professionalName = props.professionalName || "";
        const room = props.room || "";

        const line1 = professionalName ? `${patientName} — ${professionalName}` : patientName;

        const html = `
          <div class="fc-event-main-frame">
            <div class="fc-event-time">${arg.timeText}</div>
            <div class="fc-event-title-container">
              <div class="fc-event-title fc-sticky" style="font-weight: 600;">
                ${C.escapeHtml(line1)}
              </div>
              ${
                room
                  ? `<div class="fc-event-subtitle" style="font-size: 0.85em; opacity: 0.9;">${C.escapeHtml(room)}</div>`
                  : ""
              }
            </div>
          </div>
        `;

        return { html };
      },

      select: function (info) {
        openModal();
        if (startAt) startAt.value = info.startStr.slice(0, 16);
        if (endAt) endAt.value = info.endStr.slice(0, 16);
      },

      eventClick: async function (info) {
        const event = info.event;
        editingId = event.id;

        const modalTitle = document.getElementById("modalTitle");
        if (modalTitle) modalTitle.textContent = "Editar Agendamento";

        // editar sempre simples (seguro)
        resetMulti();

        if (patientId) patientId.value = event.extendedProps.patientId || "";
        if (patientSearch) patientSearch.value = event.extendedProps.patientName || "";
        if (patientSuggest) {
          patientSuggest.style.display = "none";
          patientSuggest.innerHTML = "";
        }

        if (professionalSelect) professionalSelect.value = event.extendedProps.professionalId || "";
        if (startAt) startAt.value = event.start.toISOString().slice(0, 16);
        if (endAt) endAt.value = event.end ? event.end.toISOString().slice(0, 16) : "";
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

    // feriados iniciais
    const view = calendar.view;
    if (view && view.activeStart && view.activeEnd) {
      loadHolidaysForView(view.activeStart, view.activeEnd);
    }
  }

  // -----------------------------
  // Validação base (1 agendamento)
  // -----------------------------
  function validateForm() {
    const patientIdValue = patientId?.value || "";
    const professionalId = professionalSelect?.value || "";
    const start = startAt?.value || "";
    const end = endAt?.value || "";

    if (!patientIdValue) {
      toast("⚠️ Selecione um paciente");
      return null;
    }

    if (!professionalId) {
      toast("⚠️ Selecione um profissional");
      return null;
    }

    if (!start || !end) {
      toast("⚠️ Preencha início e fim");
      return null;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast("⚠️ Data/hora inválida");
      return null;
    }

    if (endDate <= startDate) {
      toast("⚠️ Fim deve ser após início");
      return null;
    }

    // feriado
    const dateYmd = ymdLocal(startDate);
    if (blockedHolidays.includes(dateYmd)) {
      toast("⚠️ Não é possível agendar em feriado nacional");
      return null;
    }

    return {
      patient_id: patientIdValue,
      professional_id: professionalId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      room: (apptRoom?.value || "").trim(),
      color: (color?.value || "") || "#2A9D8F",
      notes: (notes?.value || "").trim(),
    };
  }

  // -----------------------------
  // Salvar (simples)
  // -----------------------------
  async function saveSingle() {
    const data = validateForm();
    if (!data) return;

    if (editingId) {
      await C.updateAppointment(editingId, data);
    } else {
      await C.addAppointment(data);
    }

    closeModal();
    await refresh();
  }

  // -----------------------------
  // Salvar inteligente (simples ou múltiplo)
  // -----------------------------
  async function saveSmart() {
    try {
      // Se está editando, sempre simples
      if (editingId) {
        await saveSingle();
        return;
      }

      const isMulti = !!(multiMode && multiMode.checked);

      if (!isMulti) {
        await saveSingle();
        return;
      }

      // Modo múltiplo: exige linhas
      const starts = Array.from(multiList?.querySelectorAll("[data-mstart]") || []);
      const ends = Array.from(multiList?.querySelectorAll("[data-mend]") || []);

      if (!starts.length || !ends.length) {
        toast("⚠️ Clique em 'Gerar campos' e preencha os horários.");
        return;
      }

      // Base valida paciente/prof/cor/sala/obs (start/end base serão substituídos)
      const base = validateForm();
      if (!base) return;

      const payloads = [];

      for (let i = 0; i < starts.length; i++) {
        const s = (starts[i].value || "").trim();
        const e = (ends[i]?.value || "").trim();

        if (!s || !e) {
          toast("⚠️ Preencha início e fim de todos os agendamentos.");
          return;
        }

        const sDate = new Date(s);
        const eDate = new Date(e);

        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
          toast("⚠️ Datas inválidas no agendamento múltiplo.");
          return;
        }

        if (eDate <= sDate) {
          toast("⚠️ Em um dos itens, o fim é antes do início.");
          return;
        }

        // feriado
        const dateYmd = ymdLocal(sDate);
        if (blockedHolidays.includes(dateYmd)) {
          toast("⚠️ Um dos agendamentos cai em feriado nacional.");
          return;
        }

        payloads.push({
          ...base,
          start_time: sDate.toISOString(),
          end_time: eDate.toISOString(),
        });
      }

      // cria em sequência (mais confiável)
      for (const p of payloads) {
        await C.addAppointment(p);
      }

      closeModal();
      await refresh();
      toast(`✅ ${payloads.length} agendamentos criados.`);
    } catch (err) {
      console.error("❌ Erro ao salvar:", err);
      toast("❌ Erro ao salvar agendamento");
    }
  }

  // -----------------------------
  // Deletar
  // -----------------------------
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

  // -----------------------------
  // Refresh
  // -----------------------------
  async function refresh() {
    await buildPatientOptions();
    await buildProfessionalOptions();
    await renderCalendar();
  }

  // -----------------------------
  // Listeners
  // -----------------------------
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      openModal();
      setDefaultTimes();
    });
  } else {
    console.warn("⚠️ btnNew não encontrado no DOM");
  }

  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  // ✅ Enter no form => salvar (mesma função do botão)
  if (appointmentForm) {
    appointmentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveSmart();
    });
  }

  // mantém clique funcionando (sem alterar comportamento)
  if (btnSave) btnSave.addEventListener("click", saveSmart);
  if (btnDelete) btnDelete.addEventListener("click", deleteAppointment);

  if (professionalFilter) professionalFilter.addEventListener("change", refresh);

  // Fechar modal clicando fora
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  async function applyPatientDefaultsById(pId) {
    if (!pId) return;
    try {
      // Você provavelmente já tem isso no supabase-api.js
      if (!C || typeof C.getPatientById !== "function") return;

      const p = await C.getPatientById(pId);
      if (!p) return;

      // cor do paciente
      if (p.color && color) color.value = p.color;

      // profissional vinculado ao paciente
      const profId = p.assigned_professional_id || "";
      if (profId && professionalSelect) {
        // Espera o select ter as opções (porque ele carrega async no refresh)
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
  // Ex:
  // agenda.html?new=1&patient=UUID&patient_name=Rafael%20Araujo
  // -----------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;

    const prePatientId = params.get("patient") || "";
    const prePatientName = params.get("patient_name") || "";

    setTimeout(async () => {
      // 1) abre o modal
      openModal();
      setDefaultTimes();

      // 2) preenche paciente (id + nome)
      if (prePatientId && patientId) patientId.value = prePatientId;
      if (prePatientName && patientSearch) {
        patientSearch.value = decodeURIComponent(prePatientName);
      }

      // 3) aplica cor e profissional vindos do banco
      await applyPatientDefaultsById(prePatientId);

      // 4) esconde sugestão
      if (patientSuggest) patientSuggest.style.display = "none";

      // 5) limpa a URL
      history.replaceState(null, "", "agenda.html");
    }, 300);
  });


    // =============================================================================
  // REALTIME (Global)
  // =============================================================================
  const RT = window.CorneliusRealtime;
  if (RT && typeof refresh === "function") {
    RT.on("appointments:change", () => refresh());
    RT.on("patients:change", () => refresh());
    RT.on("professionals:change", () => refresh());
    RT.on("realtime:reconnected", () => refresh());
  }

  // -----------------------------
  // Boot
  // -----------------------------
  refresh();
})();
