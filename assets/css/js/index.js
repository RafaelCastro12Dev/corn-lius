(function () {
  "use strict";

  const C = window.Cornelius;
  C.setActiveNav();

  const q = document.getElementById("q");
  const results = document.getElementById("results");
  const empty = document.getElementById("empty");
  const upcoming = document.getElementById("upcoming");
  const upcomingEmpty = document.getElementById("upcomingEmpty");

  const btnReset = document.getElementById("btnReset");
  const btnGoAgenda = document.getElementById("btnGoAgenda");

  function renderPatients(list) {
    results.innerHTML = "";
    if (!list.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    list.forEach(p => {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="meta">
          <strong>${C.escapeHtml(p.name)}</strong>
          <span>CPF: ${C.escapeHtml(p.cpf)} · Tel: ${C.escapeHtml(p.phone || "-")}</span>
        </div>
        <div class="pill" title="Cor do paciente">
          <span class="dot" style="background:${C.escapeHtml(p.color || "#7FDCAC")}"></span>
          Ver ficha
        </div>
      `;
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        window.location.href = `paciente.html?id=${encodeURIComponent(p.id)}`;
      });
      results.appendChild(el);
    });
  }

  function renderUpcoming(data) {
    upcoming.innerHTML = "";
    const list = C.getUpcomingAppointments(data, 6);
    if (!list.length) {
      upcomingEmpty.style.display = "block";
      return;
    }
    upcomingEmpty.style.display = "none";

    list.forEach(a => {
      const patient = C.getPatientById(data, a.patientId);
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="meta">
          <strong>${C.escapeHtml(patient ? patient.name : "Paciente")}</strong>
          <span>${C.escapeHtml(C.humanDateTime(a.start))}</span>
          <span style="margin-top:4px; color: var(--muted); font-size:12px;">
            ${C.escapeHtml(a.notes || "")}
          </span>
        </div>
        <div class="pill">
          <span class="dot" style="background:${C.escapeHtml(a.color || (patient?.color || "#7FDCAC"))}"></span>
          Agenda
        </div>
      `;
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        window.location.href = `agenda.html?focus=${encodeURIComponent(a.id)}`;
      });
      upcoming.appendChild(el);
    });
  }

  function refresh() {
    const data = C.load();
    const list = C.searchPatients(data, q.value || "");
    renderPatients(list);
    renderUpcoming(data);
  }

  q.addEventListener("input", refresh);

  btnGoAgenda.addEventListener("click", () => {
    window.location.href = "agenda.html";
  });

  btnReset.addEventListener("click", () => {
    C.resetDemo();
    C.toast("Demo resetada", "Os dados voltaram ao padrão.");
    refresh();
  });

  refresh();
})();
