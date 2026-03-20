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

  // ✅ NOVO: botão "Inativos"
  const btnToggleInactive = document.getElementById("btnToggleInactive");

  // ✅ NOVO: Lista alfabética de todos os pacientes
  const patientsAll = document.getElementById("patientsAll");
  const btnMorePatients = document.getElementById("btnMorePatients");

  function goAgenda() {
    window.location.href = "agenda.html";
  }

  function goAgendaNew() {
    window.location.href = "agenda.html?new=1";
  }

  if (btnGoAgendaTop) btnGoAgendaTop.addEventListener("click", goAgenda);
  if (btnGoAgenda) btnGoAgenda.addEventListener("click", goAgendaNew);

  // =============================================================================
  // Toggle: mostrar SOMENTE inativos
  // =============================================================================
  let showInactiveOnly = localStorage.getItem("cornelius_show_inactive_only") === "1";

  if (localStorage.getItem("cornelius_show_inactive_only") == null) {
    localStorage.setItem("cornelius_show_inactive_only", "0");
  }

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

      loadAllPatients(true);

      const v = (q?.value || "").trim();
      if (v) {
        search();
      } else {
        if (results) {
          results.innerHTML = "";
          results.style.display = "none";
        }
        if (empty) empty.style.display = "none";
      }
    });
  }

  // =============================================================================
  // DASHBOARD FINANCEIRO (HOME) - abaixo da busca por CPF
  // =============================================================================

  function buildFinanceDashboardUI() {
    if (!q) return;

    // Evita duplicar caso rode duas vezes
    if (document.getElementById("financeDashboard")) return;

    const wrap = document.createElement("div");
    wrap.id = "financeDashboard";
    wrap.className = "card soft";
    wrap.style.marginTop = "14px";

    // Mês atual default
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const monthDefault = `${yyyy}-${mm}`;

    wrap.innerHTML = `
      <div class="card-title">
        <h2>💰 Financeiro Geral</h2>
        <small>Caixa • Recebido • Pendências</small>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 14px;">
        <div class="field">
          <label>Mês (atalho)</label>
          <input id="finMonth" type="month" value="${monthDefault}">
        </div>

        <div class="field">
          <label>Profissional</label>
          <select id="finProfessional">
            <option value="ALL">Todos</option>
          </select>
        </div>

        <div class="field">
          <label>Status</label>
          <select id="finStatus">
            <option value="ALL">Todos</option>
            <option value="PAID">Pago</option>
            <option value="PENDING">Pendente</option>
            <option value="PARTIAL">Parcial</option>
            <option value="FREE">Isento</option>
          </select>
        </div>

        <div class="field">
          <label>Método</label>
          <select id="finMethod">
            <option value="ALL">Todos</option>
            <option value="PIX">Pix</option>
            <option value="CARD">Cartão</option>
            <option value="CASH">Dinheiro</option>
            <option value="TRANSFER">Transferência</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>
      </div>

      <div class="actions" style="justify-content:flex-start; margin-top: 8px; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" id="finApply">Aplicar</button>
        <button class="btn" id="finThisMonth">Este mês</button>
        <button class="btn" id="finClearFilters">Limpar filtros</button>
        <button class="btn" id="finExportCsv" type="button">Exportar CSV</button>
        <span class="text-sm text-secondary" id="finHint" style="margin-left: 6px;"></span>
      </div>

      <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px;">
        <div class="card" style="padding:14px; border-radius:16px;">
          <div class="text-sm text-secondary">Recebido (bruto)</div>
          <div style="font-size:22px; font-weight:900;" id="kpiPaidGross">—</div>
        </div>
        <div class="card" style="padding:14px; border-radius:16px;">
          <div class="text-sm text-secondary">Caixa (líquido estim.)</div>
          <div style="font-size:22px; font-weight:900;" id="kpiPaidNet">—</div>
        </div>
        <div class="card" style="padding:14px; border-radius:16px;">
          <div class="text-sm text-secondary">Pendente</div>
          <div style="font-size:22px; font-weight:900;" id="kpiPending">—</div>
        </div>
      </div>

      <div class="card" style="padding:14px; border-radius:16px; margin-top:14px;">
        <div class="card-title">
          <h2 style="font-size:16px; margin:0;">Detalhamento por paciente</h2>
          <small>Busca por nome ou CPF sem alterar os KPIs</small>
        </div>

        <div class="grid" style="grid-template-columns: 1fr auto; gap: 12px; align-items:end;">
          <div class="field">
            <label>Paciente</label>
            <input id="finPatient" type="text" placeholder="Ex.: Rafael Silva ou CPF">
          </div>

          <div class="field" style="display:flex; align-items:flex-end; padding-bottom:1px;">
            <button class="btn" id="finSearchPatient" type="button">Buscar paciente</button>
          </div>
        </div>

        <div id="finResults" style="margin-top:14px;"></div>
      </div>
    `;

    const mount = document.getElementById("financeMount");
    if (mount) {
      mount.replaceWith(wrap);
    } else {
      const patientsSection = document.getElementById("patientsSection");
      if (patientsSection && patientsSection.parentElement) {
        patientsSection.parentElement.insertBefore(wrap, patientsSection.nextSibling);
      } else if (q && q.parentElement) {
        q.parentElement.insertAdjacentElement("afterend", wrap);
      }
    }
  }

  function monthRangeISO(monthYYYYMM) {
    if (!monthYYYYMM || !/^\d{4}-\d{2}$/.test(monthYYYYMM)) {
      return { fromISO: null, toISO: null };
    }

    const [y, m] = monthYYYYMM.split("-").map(Number);
    const from = new Date(y, m - 1, 1, 0, 0, 0);
    const to = new Date(y, m, 0, 23, 59, 59);

    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }

  async function fillDashboardProfessionals() {
    const sel = document.getElementById("finProfessional");
    if (!sel || !window.Cornelius) return;

    const fn = ["getAllProfessionals", "getProfessionals", "listProfessionals"].find(
      (n) => typeof C[n] === "function"
    );
    if (!fn) return;

    try {
      const list = await C[fn]();
      const current = sel.value || "ALL";

      sel.innerHTML =
        `<option value="ALL">Todos</option>` +
        (list || [])
          .map(
            (p) =>
              `<option value="${C.escapeHtml(p.id)}">${C.escapeHtml(
                p.name || "Profissional"
              )}</option>`
          )
          .join("");

      sel.value = current;
    } catch (e) {
      console.warn("Não foi possível carregar profissionais no dashboard:", e);
    }
  }

  async function refreshFinanceDashboard() {
    if (typeof C.calcDashboardSummary !== "function") {
      console.warn("calcDashboardSummary não existe. Verifique supabase-api.js.");
      return;
    }

    const month = document.getElementById("finMonth")?.value || "";
    const status = document.getElementById("finStatus")?.value || "ALL";
    const method = document.getElementById("finMethod")?.value || "ALL";
    const professionalId = document.getElementById("finProfessional")?.value || "ALL";

    const { fromISO, toISO } = monthRangeISO(month);

    const hint = document.getElementById("finHint");
    if (hint) hint.textContent = month ? `Período: ${month}` : "";

    const kPaidGross = document.getElementById("kpiPaidGross");
    const kPaidNet = document.getElementById("kpiPaidNet");
    const kPending = document.getElementById("kpiPending");

    if (kPaidGross) kPaidGross.textContent = "…";
    if (kPaidNet) kPaidNet.textContent = "…";
    if (kPending) kPending.textContent = "…";

    const summary = await C.calcDashboardSummary({
      fromISO,
      toISO,
      status,
      method,
      professionalId,
      limit: 5000
    });

    if (kPaidGross) kPaidGross.textContent = C.moneyBR(summary.paid_gross);
    if (kPaidNet) kPaidNet.textContent = C.moneyBR(summary.paid_net_estimated);
    if (kPending) kPending.textContent = C.moneyBR(summary.pending);
  }

  function renderFinanceDetails(rows) {
    const el = document.getElementById("finResults");
    if (!el) return;

    if (!rows || !rows.length) {
      el.innerHTML = `
        <div class="empty" style="padding: 10px 0;">
          <p>Nenhum pagamento encontrado para os filtros informados.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = rows
      .map((p) => {
        const patientName = p?.patient?.name || "Paciente não encontrado";
        const patientCpf = p?.patient?.cpf ? C.formatCPF(p.patient.cpf) : "—";
        const profName = p?.professional?.name || "—";
        const paymentDate = p?.payment_date
          ? new Date(p.payment_date).toLocaleDateString("pt-BR")
          : "—";

        const methodMap = {
          PIX: "Pix",
          CARD: "Cartão",
          CASH: "Dinheiro",
          TRANSFER: "Transferência",
          OTHER: "Outro"
        };

        const statusMap = {
          PAID: "Pago",
          PENDING: "Pendente",
          PARTIAL: "Parcial",
          FREE: "Isento"
        };

        const methodLabel = methodMap[p?.method] || (p?.method || "—");
        const statusLabel = statusMap[p?.status] || (p?.status || "—");

        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">${C.escapeHtml(patientName)}</div>
              <div class="text-sm text-secondary">CPF: ${C.escapeHtml(patientCpf)}</div>
              <div class="text-sm text-secondary">
                Pago em: ${C.escapeHtml(paymentDate)} •
                Método: ${C.escapeHtml(methodLabel)} •
                Status: ${C.escapeHtml(statusLabel)} •
                Profissional: ${C.escapeHtml(profName)}
              </div>
            </div>
            <div style="font-weight:900; white-space:nowrap;">
              ${C.moneyBR(p?.amount || 0)}
            </div>
          </div>
        `;
      })
      .join("");
  }

  async function refreshFinanceDetails() {
    if (typeof C.listPaymentsDetailed !== "function") {
      console.warn("listPaymentsDetailed não existe. Verifique supabase-api.js.");
      return;
    }

    const month = document.getElementById("finMonth")?.value || "";
    const status = document.getElementById("finStatus")?.value || "ALL";
    const method = document.getElementById("finMethod")?.value || "ALL";
    const professionalId = document.getElementById("finProfessional")?.value || "ALL";
    const patientQuery = document.getElementById("finPatient")?.value?.trim() || "";

    const { fromISO, toISO } = monthRangeISO(month);

    const el = document.getElementById("finResults");
    if (el) {
      if (!patientQuery) {
        el.innerHTML = `
          <div class="empty" style="padding: 10px 0;">
            <p>Digite um nome ou CPF para visualizar o detalhamento.</p>
          </div>
        `;
        return;
      }

      el.innerHTML = `<div class="text-sm text-secondary">Carregando...</div>`;
    }

    const rows = await C.listPaymentsDetailed({
      fromISO,
      toISO,
      status,
      method,
      professionalId,
      patientQuery,
      limit: 5000
    });

    renderFinanceDetails(rows);
  }

  function escapeCsv(value) {
    if (value == null) return "";
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  }

  function formatDateBR(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  }

  async function exportFinanceCSV() {
    if (typeof C.listPaymentsDetailed !== "function") {
      console.warn("listPaymentsDetailed não existe. Verifique supabase-api.js.");
      return;
    }

    const month = document.getElementById("finMonth")?.value || "";
    const status = document.getElementById("finStatus")?.value || "ALL";
    const method = document.getElementById("finMethod")?.value || "ALL";
    const professionalId = document.getElementById("finProfessional")?.value || "ALL";
    const patientQuery = document.getElementById("finPatient")?.value?.trim() || "";

    const { fromISO, toISO } = monthRangeISO(month);

    const rows = await C.listPaymentsDetailed({
      fromISO,
      toISO,
      status,
      method,
      professionalId,
      patientQuery,
      limit: 5000
    });

    if (!rows || !rows.length) {
      C.toast("Nenhum pagamento encontrado para exportar");
      return;
    }

    const methodMap = {
      PIX: "Pix",
      CARD: "Cartão",
      CASH: "Dinheiro",
      TRANSFER: "Transferência",
      OTHER: "Outro"
    };

    const statusMap = {
      PAID: "Pago",
      PENDING: "Pendente",
      PARTIAL: "Parcial",
      FREE: "Isento"
    };

    const header = [
      "Data",
      "Paciente",
      "CPF",
      "Profissional",
      "Método",
      "Status",
      "Valor",
      "Observação"
    ];

    const lines = rows.map((p) => {
      const patientName = p?.patient?.name || "";
      const patientCpf = p?.patient?.cpf ? C.formatCPF(p.patient.cpf) : "";
      const profName = p?.professional?.name || "";
      const paymentDate = formatDateBR(p?.payment_date);
      const methodLabel = methodMap[p?.method] || p?.method || "";
      const statusLabel = statusMap[p?.status] || p?.status || "";
      const amount = (parseFloat(p?.amount) || 0).toFixed(2).replace(".", ",");
      const note = p?.note || "";

      return [
        escapeCsv(paymentDate),
        escapeCsv(patientName),
        escapeCsv(patientCpf),
        escapeCsv(profName),
        escapeCsv(methodLabel),
        escapeCsv(statusLabel),
        escapeCsv(amount),
        escapeCsv(note)
      ].join(";");
    });

    const csvContent = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `financeiro_${month || "geral"}.csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    C.toast("CSV exportado com sucesso");
  }

  function bindFinanceDashboardEvents() {
    const btnApply = document.getElementById("finApply");
    const btnThis = document.getElementById("finThisMonth");
    const btnClear = document.getElementById("finClearFilters");

    const finMonth = document.getElementById("finMonth");
    const finStatus = document.getElementById("finStatus");
    const finMethod = document.getElementById("finMethod");
    const finProfessional = document.getElementById("finProfessional");
    const finPatient = document.getElementById("finPatient");
    const btnSearchPatient = document.getElementById("finSearchPatient");
    const btnExportCsv = document.getElementById("finExportCsv");

    if (btnExportCsv) {
      btnExportCsv.addEventListener("click", exportFinanceCSV);
    }

    if (btnApply) {
      btnApply.addEventListener("click", async () => {
        await refreshFinanceDashboard();
        const hasPatient = (finPatient?.value || "").trim();
        if (hasPatient) await refreshFinanceDetails();
      });
    }

    if (btnThis) {
      btnThis.addEventListener("click", async () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        if (finMonth) finMonth.value = `${yyyy}-${mm}`;
        await refreshFinanceDashboard();
        const hasPatient = (finPatient?.value || "").trim();
        if (hasPatient) await refreshFinanceDetails();
      });
    }

    if (btnClear) {
      btnClear.addEventListener("click", async () => {
        if (finStatus) finStatus.value = "ALL";
        if (finMethod) finMethod.value = "ALL";
        if (finProfessional) finProfessional.value = "ALL";
        if (finPatient) finPatient.value = "";
        await refreshFinanceDashboard();
        await refreshFinanceDetails();
      });
    }

    if (btnSearchPatient) {
      btnSearchPatient.addEventListener("click", refreshFinanceDetails);
    }

    if (finPatient) {
      finPatient.addEventListener("keypress", (e) => {
        if (e.key === "Enter") refreshFinanceDetails();
      });
    }

    [finMonth, finStatus, finMethod, finProfessional].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", async () => {
        await refreshFinanceDashboard();

        const hasPatient = (document.getElementById("finPatient")?.value || "").trim();
        if (hasPatient) await refreshFinanceDetails();
      });
    });
  }

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

  runSearchIfNeeded();
  window.addEventListener("pageshow", runSearchIfNeeded);

  // =============================================================================
  // LISTA ALFABÉTICA (TODOS OS PACIENTES) - NÃO INTERFERE NA BUSCA
  // =============================================================================
  var allPatientsOffset = 0;
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
      if (typeof C.listPatientsAlphabetical !== "function") {
        patientsAll.innerHTML =
          '<div class="text-sm text-secondary">⚠️ Lista alfabética não configurada. ' +
          'Implemente <code>C.listPatientsAlphabetical()</code> no <code>supabase-api.js</code>.</div>';
        if (btnMorePatients) btnMorePatients.style.display = "none";
        return;
      }

      const listRaw = showInactiveOnly
        ? await C.listPatientsAlphabetical({
            includeInactive: true,
            limit: ALL_PATIENTS_EXPANDED
              ? ALL_PATIENTS_EXPANDED_PAGE_SIZE
              : ALL_PATIENTS_PAGE_SIZE,
            offset: allPatientsOffset
          })
        : await C.listPatientsAlphabetical({
            limit: ALL_PATIENTS_EXPANDED
              ? ALL_PATIENTS_EXPANDED_PAGE_SIZE
              : ALL_PATIENTS_PAGE_SIZE,
            offset: allPatientsOffset
          });

      const list = showInactiveOnly
        ? (listRaw || []).filter((p) => p && p.is_active === false)
        : (listRaw || []);

      const pageSize = ALL_PATIENTS_EXPANDED
        ? ALL_PATIENTS_EXPANDED_PAGE_SIZE
        : ALL_PATIENTS_PAGE_SIZE;

      const safeList = (list || []).slice(0, pageSize);

      const html = (safeList || [])
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

      patientsAll.insertAdjacentHTML("beforeend", html);

      if (btnMorePatients) {
        const gotFull =
          (safeList || []).length ===
          (ALL_PATIENTS_EXPANDED ? ALL_PATIENTS_EXPANDED_PAGE_SIZE : ALL_PATIENTS_PAGE_SIZE);
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
    let timeout = null;
    q.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(search, 300);
    });

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
    RT.on("patients:change", () => {
      runSearchIfNeeded();
      loadAllPatients(true);
    });
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

  buildFinanceDashboardUI();
  fillDashboardProfessionals().then(async () => {
    await refreshFinanceDashboard();
    await refreshFinanceDetails();
  });
  bindFinanceDashboardEvents();

  // =============================================================================
  // CARROSSEL (HOME) - "Todos os pacientes"
  // =============================================================================
  const patientsCarousel = document.getElementById("patientsCarousel");
  const btnPrevCarousel = document.querySelector(".carousel-btn.prev");
  const btnNextCarousel = document.querySelector(".carousel-btn.next");
  const carouselDots = document.getElementById("carouselDots");

  function ensureDots() {
    if (!carouselDots || !patientsAll || !patientsCarousel) return;
    const cards = patientsAll.querySelectorAll(".list-item");
    carouselDots.innerHTML = "";
    const maxDots = Math.min(cards.length, 30);
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
    if (btnNextCarousel) btnNextCarousel.disabled = x >= maxScroll - 2;

    if (carouselDots) {
      const dots = Array.from(carouselDots.querySelectorAll(".carousel-dot"));
      if (dots.length) {
        const cards = Array.from(patientsAll.querySelectorAll(".list-item"));
        let active = 0;
        const left = patientsCarousel.scrollLeft;
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].offsetLeft >= left - 6) {
            active = i;
            break;
          }
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
      if (cards[i].offsetLeft >= left - 6) {
        idx = i;
        break;
      }
    }
    idx = Math.max(0, Math.min(cards.length - 1, idx + dir));
    patientsCarousel.scrollTo({ left: cards[idx].offsetLeft, behavior: "smooth" });
  }

  if (btnPrevCarousel) btnPrevCarousel.addEventListener("click", () => scrollByOneCard(-1));
  if (btnNextCarousel) btnNextCarousel.addEventListener("click", () => scrollByOneCard(+1));

  if (patientsCarousel) {
    let isDown = false;
    let startX = 0;
    let startLeft = 0;

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
      window.requestAnimationFrame(updateCarouselState);
    });
  }

  if (patientsAll && typeof MutationObserver !== "undefined") {
    const obs = new MutationObserver(() => {
      ensureDots();
      updateCarouselState();
    });
    obs.observe(patientsAll, { childList: true, subtree: false });
  }

  ensureDots();
  updateCarouselState();
})();