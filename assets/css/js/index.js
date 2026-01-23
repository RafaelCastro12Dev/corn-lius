/**
 * Cornélius - Página Inicial
 * Versão Supabase (async/await)
 */

(function () {
  "use strict";

if (window.CorneliusAuth && !window.CorneliusAuth.requireAuth()) return;


  const C = window.Cornelius;
  C.setActiveNav();

  const q = document.getElementById("q");
  const results = document.getElementById("results");
  const empty = document.getElementById("empty");
  const upcoming = document.getElementById("upcoming");
  const upcomingEmpty = document.getElementById("upcomingEmpty");
const btnGoAgendaTop = document.getElementById("btnGoAgendaTop");
const btnGoAgenda = document.getElementById("btnGoAgenda");

function goAgenda() {
  window.location.href = "agenda.html";
}

function goAgendaNew() {
  window.location.href = "agenda.html?new=1";
}

if (btnGoAgendaTop) btnGoAgendaTop.addEventListener("click", goAgenda);     // Abrir agenda
if (btnGoAgenda) btnGoAgenda.addEventListener("click", goAgendaNew);       // Criar agendamento

  // ============================================================================
  // BUSCAR PACIENTES
  // ============================================================================

  async function search() {
    const query = q.value.trim();

    if (!query) {
      results.innerHTML = "";
      results.style.display = "none";
      empty.style.display = "none";
      return;
    }

    try {
      const patients = await C.searchPatients(query);

      if (!patients || patients.length === 0) {
        results.style.display = "none";
        empty.style.display = "block";
        return;
      }

      results.style.display = "block";
      empty.style.display = "none";

      results.innerHTML = patients
        .map((p) => {
          const colorDot = `<span class="color-dot" style="background:${C.escapeHtml(p.color)}"></span>`;
          const cpfFormatted = p.cpf ? C.formatCPF(p.cpf) : "";
          const cpfInfo = cpfFormatted 
            ? `<div class="text-sm text-secondary">CPF: ${cpfFormatted}</div>` 
            : "";

          return `
            <a href="paciente.html?id=${encodeURIComponent(p.id)}" class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">
                  ${colorDot}
                  ${C.escapeHtml(p.name)}
                </div>
                ${cpfInfo}
              </div>
              <span class="text-secondary">→</span>
            </a>
          `;
        })
        .join("");
    } catch (err) {
      console.error("❌ Erro ao buscar pacientes:", err);
      C.toast("❌ Erro ao buscar pacientes");
    }
  }

  // ============================================================================
  // PRÓXIMOS ATENDIMENTOS
  // ============================================================================

  async function loadUpcoming() {
    try {
      const appointments = await C.getUpcomingAppointments(5);

      if (!appointments || appointments.length === 0) {
        upcoming.style.display = "none";
        upcomingEmpty.style.display = "block";
        return;
      }

      upcoming.style.display = "block";
      upcomingEmpty.style.display = "none";

      upcoming.innerHTML = appointments
        .map((a) => {
          const patient = a.patient || {};
          const professional = a.professional || {};

          const patientName = patient.name || "Paciente não encontrado";
          const profName = professional.name || "";
          const colorDot = patient.color 
            ? `<span class="color-dot" style="background:${C.escapeHtml(patient.color)}"></span>`
            : "";

          // Formatar data e hora
          const startDate = new Date(a.start_time);
          const dateStr = startDate.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          });
          const timeStr = startDate.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
          });

          const profInfo = profName 
            ? `<span class="text-secondary">com ${C.escapeHtml(profName)}</span>` 
            : "";

          const roomInfo = a.room 
            ? `<span class="badge">${C.escapeHtml(a.room)}</span>` 
            : "";

          return `
            <div class="list-item">
              <div class="list-item-content">
                <div class="list-item-title">
                  ${colorDot}
                  ${C.escapeHtml(patientName)}
                  ${profInfo}
                </div>
                <div class="text-sm text-secondary">
                  📅 ${dateStr} às ${timeStr}
                  ${roomInfo}
                </div>
              </div>
              <a href="paciente.html?id=${encodeURIComponent(patient.id || '')}" 
                 class="btn-link" 
                 title="Ver ficha">
                →
              </a>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      console.error("❌ Erro ao carregar próximos atendimentos:", err);
      C.toast("❌ Erro ao carregar atendimentos");
    }
  }

  // ============================================================================
  // RESET DEMO
  // ============================================================================

// Rodar busca se o campo já tiver valor ao abrir/voltar para a página
function runSearchIfNeeded() {
  if (!q) return;
  const v = (q.value || "").trim();
  if (v) search();
}

// ao carregar
runSearchIfNeeded();

// ao voltar pelo botão "Voltar" do navegador (bfcache)
window.addEventListener("pageshow", runSearchIfNeeded);


  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  if (q) {
    // Buscar ao digitar (debounce)
    let timeout = null;
    q.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(search, 300);
    });

    // Buscar ao pressionar Enter
    q.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        clearTimeout(timeout);
        search();
      }
    });
  }

    // =============================================================================
  // REALTIME (Global)
  // =============================================================================
  const RT = window.CorneliusRealtime;
  if (RT) {
    RT.on("appointments:change", () => loadUpcoming());
    RT.on("patients:change", () => runSearchIfNeeded());
    RT.on("realtime:reconnected", () => {
  loadUpcoming();
  runSearchIfNeeded();
});

  }

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================

  loadUpcoming();
})();
