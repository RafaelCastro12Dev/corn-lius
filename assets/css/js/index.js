/**
 * Cornélius - Página Inicial
 * Versão Supabase (async/await)
 * + Toggle "Inativos" (somente pacientes is_active = false)
 */

(function () {
  "use strict";

  // Proteção: esta tela é admin-only (conforme seu projeto atual)
  if (window.CorneliusAuth && !window.CorneliusAuth.requireRole("admin")) return;

  const C = window.Cornelius;
  if (!C) {
    console.error("❌ window.Cornelius não carregou (supabase-api.js).");
    return;
  }

  if (typeof C.setActiveNav === "function") C.setActiveNav();

  const q = document.getElementById("q");
  const results = document.getElementById("results");
  const empty = document.getElementById("empty");
  const upcoming = document.getElementById("upcoming");
  const upcomingEmpty = document.getElementById("upcomingEmpty");

  const btnGoAgendaTop = document.getElementById("btnGoAgendaTop");
  const btnGoAgenda = document.getElementById("btnGoAgenda");

  // ✅ NOVO: botão "Inativos" (adicione no index.html)
  const btnToggleInactive = document.getElementById("btnToggleInactive");

  // ✅ NOVO: Lista alfabética de todos os pacientes (adicione no index.html)
  const patientsAll = document.getElementById("patientsAll");
  const btnMorePatients = document.getElementById("btnMorePatients");

  function goAgenda() {
    window.location.href = "agenda.html";
  }

  function goAgendaNew() {
    window.location.href = "agenda.html?new=1";
  }

  if (btnGoAgendaTop) btnGoAgendaTop.addEventListener("click", goAgenda); // Abrir agenda
  if (btnGoAgenda) btnGoAgenda.addEventListener("click", goAgendaNew); // Criar agendamento

  // =============================================================================
  // Toggle: mostrar SOMENTE inativos
  // =============================================================================
  let showInactiveOnly = localStorage.getItem("cornelius_show_inactive_only") === "1";

  function syncInactiveButtonUI() {
    if (!btnToggleInactive) return;
    btnToggleInactive.classList.toggle("primary", showInactiveOnly);
    btnToggleInactive.classList.toggle("is-on", showInactiveOnly);
    btnToggleInactive.textContent = showInactiveOnly ? "Inativos: ON" : "Inativos";
    btnToggleInactive.title = showInactiveOnly
      ? "Mostrando somente pacientes inativos"
      : "Mostrar somente pacientes inativos";
  }

  if (btnToggleInactive) {
    syncInactiveButtonUI();

    btnToggleInactive.addEventListener("click", () => {
      showInactiveOnly = !showInactiveOnly;
      localStorage.setItem("cornelius_show_inactive_only", showInactiveOnly ? "1" : "0");
      syncInactiveButtonUI();

      // Re-roda busca se houver texto
      const v = (q?.value || "").trim();
      if (v) search();
      else {
        // Se o campo estiver vazio, só limpa visual (mantém comportamento atual)
        if (results) {
          results.innerHTML = "";
          results.style.display = "none";
        }
        if (empty) empty.style.display = "none";
      }
    });
  }


      // ✅ Recarrega a lista alfabética
      loadAllPatients(true);

  // =============================================================================
  // BUSCAR PACIENTES
  // =============================================================================
  async function search() {
    const query = (q?.value || "").trim();

    if (!query) {
      if (results) {
        results.innerHTML = "";
        results.style.display = "none";
      }
      if (empty) empty.style.display = "none";
      return;
    }

    try {
      // Se estiver ON: traz também inativos e filtra só is_active=false
      const patientsRaw = showInactiveOnly
        ? await C.searchPatients(query, { includeInactive: true })
        : await C.searchPatients(query);

      const patients = showInactiveOnly
        ? (patientsRaw || []).filter((p) => p && p.is_active === false)
        : (patientsRaw || []);

      if (!patients || patients.length === 0) {
        if (results) results.style.display = "none";
        if (empty) empty.style.display = "block";
        return;
      }

      if (results) results.style.display = "block";
      if (empty) empty.style.display = "none";

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
              <span class="chevron">›</span>
            </a>
          `;
        })
        .join("");
    } catch (err) {
      console.error("❌ Erro ao buscar pacientes:", err);
      if (C && typeof C.toast === "function") C.toast("❌ Erro ao buscar pacientes");
    }
  }

  // =============================================================================
  // PRÓXIMOS ATENDIMENTOS
  // =============================================================================
  async function loadUpcoming() {
    try {
      const appointments = await C.getUpcomingAppointments(5);

      if (!appointments || appointments.length === 0) {
        if (upcoming) upcoming.style.display = "none";
        if (upcomingEmpty) upcomingEmpty.style.display = "block";
        return;
      }

      if (upcoming) upcoming.style.display = "block";
      if (upcomingEmpty) upcomingEmpty.style.display = "none";

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
              <a href="paciente.html?id=${encodeURIComponent(patient.id || "")}"
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
      if (C && typeof C.toast === "function") C.toast("❌ Erro ao carregar atendimentos");
    }
  }

  // =============================================================================
  // Rodar busca se o campo já tiver valor ao abrir/voltar para a página
  // =============================================================================
  function runSearchIfNeeded() {
    if (!q) return;
    const v = (q.value || "").trim();
    if (v) search();
  }

  // ao carregar
  runSearchIfNeeded();

  // ao voltar pelo botão "Voltar" do navegador (bfcache)
  window.addEventListener("pageshow", runSearchIfNeeded);


  // =============================================================================
  // LISTA ALFABÉTICA (TODOS OS PACIENTES) - NÃO INTERFERE NA BUSCA
  // =============================================================================
  // Sem TDZ: usar var aqui evita erro "before initialization" caso algum handler dispare cedo.
  var allPatientsOffset = 0;
  // Mostrar poucos por padrão (UX) e permitir expandir
  var ALL_PATIENTS_PAGE_SIZE = 5;
  var ALL_PATIENTS_EXPANDED = false;
  var ALL_PATIENTS_EXPANDED_PAGE_SIZE = 80;

  async function loadAllPatients(reset = false) {
    if (!patientsAll) return;

    if (reset) {
      allPatientsOffset = 0;
      patientsAll.innerHTML = "";
      if (btnMorePatients) {
        btnMorePatients.textContent = ALL_PATIENTS_EXPANDED ? "Carregar mais" : "Ver todos";
      }
    }

    try {
      // Precisa existir no supabase-api.js:
      // C.listPatientsAlphabetical({ includeInactive?: boolean, limit?: number, offset?: number })
      if (typeof C.listPatientsAlphabetical !== "function") {
        patientsAll.innerHTML =
          '<div class="text-sm text-secondary">⚠️ Lista alfabética não configurada. ' +
          'Implemente <code>C.listPatientsAlphabetical()</code> no <code>supabase-api.js</code>.</div>';
        if (btnMorePatients) btnMorePatients.style.display = "none";
        return;
      }

      // Se estiver ON, pedimos includeInactive:true e filtramos só os inativos (mesma regra da busca)
      const listRaw = showInactiveOnly
        ? await C.listPatientsAlphabetical({ includeInactive: true, limit: (ALL_PATIENTS_EXPANDED ? ALL_PATIENTS_EXPANDED_PAGE_SIZE : ALL_PATIENTS_PAGE_SIZE), offset: allPatientsOffset })
        : await C.listPatientsAlphabetical({ limit: (ALL_PATIENTS_EXPANDED ? ALL_PATIENTS_EXPANDED_PAGE_SIZE : ALL_PATIENTS_PAGE_SIZE), offset: allPatientsOffset });

      const list = showInactiveOnly
        ? (listRaw || []).filter((p) => p && p.is_active === false)
        : (listRaw || []);

      // Blindagem: mesmo que a API ignore limit/range, nunca renderize além do pageSize pedido
      const pageSize = (ALL_PATIENTS_EXPANDED ? ALL_PATIENTS_EXPANDED_PAGE_SIZE : ALL_PATIENTS_PAGE_SIZE);
      const safeList = (list || []).slice(0, pageSize);

      // Render incremental
      const html = (safeList || []).map((p) => {
        const colorDot = `<span class="color-dot" style="background:${C.escapeHtml(p.color)}"></span>`;
        const cpfFormatted = p.cpf ? C.formatCPF(p.cpf) : "";
        const cpfInfo = cpfFormatted ? `<div class="text-sm text-secondary">CPF: ${cpfFormatted}</div>` : "";

        return `
          <a href="paciente.html?id=${encodeURIComponent(p.id)}" class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">
                ${colorDot}
                ${C.escapeHtml(p.name)}
              </div>
              ${cpfInfo}
            </div>
            <span class="chevron">›</span>
          </a>
        `;
      }).join("");

      patientsAll.insertAdjacentHTML("beforeend", html);

      // Paginação simples
      if (btnMorePatients) {
        const gotFull = (safeList || []).length === (ALL_PATIENTS_EXPANDED ? ALL_PATIENTS_EXPANDED_PAGE_SIZE : ALL_PATIENTS_PAGE_SIZE);
        btnMorePatients.style.display = gotFull ? "inline-flex" : "none";
      }

      allPatientsOffset += (safeList || []).length;
    } catch (err) {
      console.error("❌ Erro ao carregar lista alfabética:", err);
      if (typeof C.toast === "function") C.toast("❌ Erro ao carregar lista de pacientes");
    }
  }

  if (btnMorePatients) {
    btnMorePatients.addEventListener("click", () => {
    if (!ALL_PATIENTS_EXPANDED) {
      ALL_PATIENTS_EXPANDED = true;
      btnMorePatients.textContent = "Carregar mais";
      loadAllPatients(true);
      return;
    }
    loadAllPatients(false);
  });
  }

  // =============================================================================
  // EVENT LISTENERS
  // =============================================================================
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
    RT.on("patients:change", () => { runSearchIfNeeded(); loadAllPatients(true); });
    RT.on("realtime:reconnected", () => {
      loadUpcoming();
      runSearchIfNeeded();
      loadAllPatients(true);
    });
  }

  // =============================================================================
  // INICIALIZAÇÃO
  // =============================================================================
  loadUpcoming();
  loadAllPatients(true);


// =============================================================================
// CARROSSEL (HOME) - "Todos os pacientes"
// =============================================================================
const patientsCarousel = document.getElementById("patientsCarousel");
const btnPrevCarousel = document.querySelector(".carousel-btn.prev");
const btnNextCarousel = document.querySelector(".carousel-btn.next");
const carouselDots = document.getElementById("carouselDots");

function ensureDots() {
  if (!carouselDots || !patientsAll || !patientsCarousel) return;
  // Recria dots conforme quantidade de cards
  const cards = patientsAll.querySelectorAll(".list-item");
  carouselDots.innerHTML = "";
  const maxDots = Math.min(cards.length, 30); // evita poluição em bases grandes
  for (let i = 0; i < maxDots; i++) {
    const d = document.createElement("span");
    d.className = "carousel-dot" + (i === 0 ? " is-active" : "");
    carouselDots.appendChild(d);
  }
}

function updateCarouselState() {
  if (!patientsCarousel || !patientsAll) return;

  const maxScroll = patientsCarousel.scrollWidth - patientsCarousel.clientWidth;
  const x = patientsCarousel.scrollLeft;

  if (btnPrevCarousel) btnPrevCarousel.disabled = x <= 2;
  if (btnNextCarousel) btnNextCarousel.disabled = x >= (maxScroll - 2);

  // Atualiza dot ativo com base no card mais próximo
  if (carouselDots) {
    const dots = Array.from(carouselDots.querySelectorAll(".carousel-dot"));
    if (dots.length) {
      const cards = Array.from(patientsAll.querySelectorAll(".list-item"));
      let active = 0;
      const left = patientsCarousel.scrollLeft;
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].offsetLeft >= left - 6) { active = i; break; }
      }
      active = Math.min(active, dots.length - 1);
      dots.forEach((d, i) => d.classList.toggle("is-active", i === active));
    }
  }
}

function scrollByOneCard(dir) {
  if (!patientsCarousel || !patientsAll) return;
  const cards = Array.from(patientsAll.querySelectorAll(".list-item"));
  if (!cards.length) return;

  const left = patientsCarousel.scrollLeft;
  let idx = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].offsetLeft >= left - 6) { idx = i; break; }
  }
  idx = Math.max(0, Math.min(cards.length - 1, idx + dir));
  patientsCarousel.scrollTo({ left: cards[idx].offsetLeft, behavior: "smooth" });
}

if (btnPrevCarousel) btnPrevCarousel.addEventListener("click", () => scrollByOneCard(-1));
if (btnNextCarousel) btnNextCarousel.addEventListener("click", () => scrollByOneCard(+1));

if (patientsCarousel) {
  // Drag-to-scroll desktop
  let isDown = false, startX = 0, startLeft = 0;

  patientsCarousel.addEventListener("mousedown", (e) => {
    isDown = true;
    patientsCarousel.classList.add("is-dragging");
    startX = e.pageX;
    startLeft = patientsCarousel.scrollLeft;
  });

  window.addEventListener("mouseup", () => {
    isDown = false;
    patientsCarousel.classList.remove("is-dragging");
  });

  patientsCarousel.addEventListener("mouseleave", () => {
    isDown = false;
    patientsCarousel.classList.remove("is-dragging");
  });

  patientsCarousel.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const dx = (e.pageX - startX) * 1.15;
    patientsCarousel.scrollLeft = startLeft - dx;
  });

  patientsCarousel.addEventListener("scroll", () => {
    // throttle simples
    window.requestAnimationFrame(updateCarouselState);
  });
}

// Observa mudanças na lista (quando carrega mais / toggla inativos) para refazer dots e estado
if (patientsAll && typeof MutationObserver !== "undefined") {
  const obs = new MutationObserver(() => {
    ensureDots();
    updateCarouselState();
  });
  obs.observe(patientsAll, { childList: true, subtree: false });
}

// Inicial
ensureDots();
updateCarouselState();

})();
