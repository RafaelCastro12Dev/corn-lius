(function () {
  "use strict";

  // Proteção de acesso
  if (window.CorneliusAuth && !window.CorneliusAuth.requireAuth()) return;

  const C = window.Cornelius;
  if (!C) {
    console.error("❌ Cornelius API não carregada");
    alert("❌ Erro: API do sistema não carregou.");
    return;
  }

  if (typeof C.setActiveNav === "function") C.setActiveNav();

  // ============================================================================
  // DOM
  // ============================================================================
  const patientSearch = document.getElementById("patientSearch");
  const patientId = document.getElementById("patientId");
  const patientSuggest = document.getElementById("patientSuggest");
  const patientCpfInfo = document.getElementById("patientCpfInfo");

  const professionalSelect = document.getElementById("professionalSelect");
  const professionalCrpInfo = document.getElementById("professionalCrpInfo");

  const docDate = document.getElementById("docDate");
  const daysOff = document.getElementById("daysOff");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");

  const bodyText = document.getElementById("bodyText");

  const btnModel = document.getElementById("btnModel");
  const btnPDF = document.getElementById("btnPDF");
  const form = document.getElementById("attForm");

  const historyEl = document.getElementById("history");
  const msg = document.getElementById("msg");

  // Segurança mínima (evita erro se algum ID estiver faltando)
  const required = [
    ["patientSearch", patientSearch],
    ["patientId", patientId],
    ["patientSuggest", patientSuggest],
    ["professionalSelect", professionalSelect],
    ["docDate", docDate],
    ["daysOff", daysOff],
    ["bodyText", bodyText],
    ["btnModel", btnModel],
    ["btnPDF", btnPDF],
    ["attForm", form],
    ["history", historyEl],
    ["msg", msg],
  ];
  const missing = required.filter(([, el]) => !el).map(([id]) => id);
  if (missing.length) {
    console.error("❌ IDs faltando no impressoes.html:", missing);
    alert("❌ Erro: IDs faltando no impressoes.html: " + missing.join(", "));
    return;
  }

  // ============================================================================
  // STATE
  // ============================================================================
  let lastSavedId = null;

  let professionalsCache = [];
  let selectedPatient = {
    id: "",
    name: "",
    cpf: "",
    assigned_professional_id: "",
  };

  // ============================================================================
  // HELPERS
  // ============================================================================
  function cleanCPF(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function formatCPF(v) {
    const c = cleanCPF(v);
    if (c.length !== 11) return v ? String(v) : "";
    return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  function brDateFromYmd(ymd) {
    if (!ymd) return "";
    const [y, m, d] = String(ymd).split("-");
    if (!y || !m || !d) return "";
    return `${d}/${m}/${y}`;
  }

  function debounce(fn, delay = 250) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function showPatientCpfUI() {
    if (!patientCpfInfo) return;
    const cpf = formatCPF(selectedPatient.cpf);
    if (cpf) {
      patientCpfInfo.textContent = `CPF: ${cpf}`;
      patientCpfInfo.style.display = "block";
    } else {
      patientCpfInfo.textContent = "";
      patientCpfInfo.style.display = "none";
    }
  }

  function updateProfessionalCrpUI() {
    if (!professionalCrpInfo) return;

    const id = professionalSelect.value;
    const prof = professionalsCache.find((p) => p.id === id);
    const crp = prof?.crp ? String(prof.crp).trim() : "";

    if (crp) {
      professionalCrpInfo.textContent = `CRP: ${crp}`;
      professionalCrpInfo.style.display = "block";
    } else {
      professionalCrpInfo.textContent = "";
      professionalCrpInfo.style.display = "none";
    }
  }

  function getSelectedProfessionalLabel() {
    return professionalSelect.options[professionalSelect.selectedIndex]?.text || "";
  }

  function buildDefaultAttestationText() {
    const pName = (selectedPatient.name || patientSearch.value || "").trim();
    const dateBR = brDateFromYmd(docDate.value);
    const profLabel = getSelectedProfessionalLabel();

    const d = String(daysOff.value || "").trim();
    const s = startDate ? String(startDate.value || "").trim() : "";
    const e = endDate ? String(endDate.value || "").trim() : "";

    let extra = "";
    if (s && e) extra = `, no período de ${brDateFromYmd(s)} até ${brDateFromYmd(e)}`;
    else if (d) extra = `, por ${d} dia(s)`;

    return `ATESTADO

Atesto para os devidos fins que ${pName || "[PACIENTE]"} esteve em atendimento nesta clínica na data de ${dateBR || "[DATA]"}${extra}.

${profLabel ? `Profissional: ${profLabel}` : ""}

____________________________________
Assinatura e carimbo`;
  }

  function ensureDefaultTextIfEmpty() {
    const current = String(bodyText.value || "").trim();
    if (current) return;
    bodyText.value = buildDefaultAttestationText();
  }

  function forceModel() {
    bodyText.value = buildDefaultAttestationText();
  }

  // ============================================================================
  // PACIENTE: SUGESTÕES (nome/CPF)
  // ============================================================================
  function showPatientSuggest(items) {
    if (!items || !items.length) {
      patientSuggest.style.display = "none";
      patientSuggest.innerHTML = "";
      return;
    }

    patientSuggest.innerHTML = items
      .map((p) => {
        const cpf = formatCPF(p.cpf || "");
        return `
          <div class="item"
            data-id="${p.id}"
            data-name="${C.escapeHtml(p.name || "")}"
            data-cpf="${C.escapeHtml(p.cpf || "")}"
            data-professional-id="${p.assigned_professional_id || ""}">
            <strong>${C.escapeHtml(p.name || "")}</strong>
            <small>${C.escapeHtml(cpf)}</small>
          </div>
        `;
      })
      .join("");

    patientSuggest.style.display = "block";
  }

  const runPatientSearch = debounce(async () => {
    const term = patientSearch.value.trim();

    // reset seleção
    patientId.value = "";
    lastSavedId = null;
    selectedPatient = { id: "", name: "", cpf: "", assigned_professional_id: "" };
    showPatientCpfUI();

    if (term.length < 2) {
      showPatientSuggest([]);
      return;
    }

    try {
      const list = await C.searchPatients(term);
      showPatientSuggest((list || []).slice(0, 15));
    } catch (e) {
      console.error("❌ Erro na busca de pacientes:", e);
      showPatientSuggest([]);
    }
  }, 250);

  patientSearch.addEventListener("input", runPatientSearch);

  patientSuggest.addEventListener("click", (ev) => {
    const item = ev.target.closest(".item");
    if (!item) return;

    const pid = item.dataset.id || "";
    const pname = item.dataset.name || "";
    const pcpf = item.dataset.cpf || "";
    const assignedProf = item.dataset.professionalId || "";

    patientId.value = pid;
    patientSearch.value = pname;
    showPatientSuggest([]);

    selectedPatient.id = pid;
    selectedPatient.name = pname;
    selectedPatient.cpf = pcpf;
    selectedPatient.assigned_professional_id = assignedProf;

    showPatientCpfUI();

    // auto-preencher profissional do paciente (se existir)
    if (assignedProf) {
      professionalSelect.value = assignedProf;
      updateProfessionalCrpUI();
    }

    ensureDefaultTextIfEmpty();
    loadHistoryForPatient(pid);
  });

  document.addEventListener("click", (e) => {
    if (!patientSuggest.contains(e.target) && e.target !== patientSearch) {
      showPatientSuggest([]);
    }
  });

  // ============================================================================
  // PROFISSIONAIS
  // ============================================================================
  async function loadProfessionals() {
    professionalsCache = await C.getAllProfessionals();

    professionalSelect.innerHTML = `<option value="">Selecione...</option>`;
    professionalsCache.forEach((p) => {
      const label = p.crp ? `${p.name} (CRP ${p.crp})` : p.name;
      professionalSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${p.id}">${C.escapeHtml(label)}</option>`
      );
    });

    updateProfessionalCrpUI();
  }

  professionalSelect.addEventListener("change", () => {
    updateProfessionalCrpUI();
    ensureDefaultTextIfEmpty();
  });

  // ============================================================================
  // SALVAR ATESTADO
  // ============================================================================
  async function saveAttestation() {
    msg.textContent = "Salvando...";

    if (!patientId.value || !professionalSelect.value || !docDate.value) {
      msg.textContent = "❌ Preencha paciente, profissional e data.";
      return;
    }
    if (!String(bodyText.value || "").trim()) {
      msg.textContent = "❌ Digite o texto do atestado.";
      return;
    }

    const payload = {
      patient_id: patientId.value,
      professional_id: professionalSelect.value,
      doc_date: docDate.value,
      title: "Atestado",
      body_text: String(bodyText.value || "").trim(),
      days_off: daysOff.value ? Number(daysOff.value) : null,
      start_date: startDate ? (startDate.value || null) : null,
      end_date: endDate ? (endDate.value || null) : null,
    };

    try {
      const saved = lastSavedId
        ? await C.updateAttestation(lastSavedId, payload)
        : await C.addAttestation(payload);

      lastSavedId = saved.id;
      msg.textContent = "✅ Atestado salvo com sucesso.";
      loadHistoryForPatient(patientId.value);
    } catch (e) {
      console.error("❌ Erro ao salvar atestado:", e);
      msg.textContent = "❌ Erro ao salvar atestado.";
    }
  }

  // ============================================================================
  // HISTÓRICO
  // ============================================================================
  async function loadHistoryForPatient(pid) {
    historyEl.innerHTML = "";
    if (!pid) return;

    try {
      const rows = await C.getAttestationsByPatient(pid);
      if (!rows.length) {
        historyEl.innerHTML = `<p class="muted">Nenhum atestado emitido.</p>`;
        return;
      }

      historyEl.innerHTML = rows
        .map((r) => {
          const dt = r.doc_date ? brDateFromYmd(r.doc_date) : "";
          return `
            <div class="row" style="padding:10px 0; border-bottom:1px solid #eee;">
              <strong>${C.escapeHtml(dt)}</strong>
              <div style="margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" data-id="${r.id}" class="btnLoad">Abrir</button>
                <button type="button" data-id="${r.id}" class="btnPdf">PDF</button>
              </div>
            </div>
          `;
        })
        .join("");

      historyEl.querySelectorAll(".btnLoad").forEach((btn) => {
        btn.onclick = async () => {
          const r = await C.getAttestationById(btn.dataset.id);
          lastSavedId = r.id;

          // Preencher campos
          patientId.value = r.patient_id || "";
          professionalSelect.value = r.professional_id || "";
          docDate.value = r.doc_date || "";
          daysOff.value = r.days_off || "";
          if (startDate) startDate.value = r.start_date || "";
          if (endDate) endDate.value = r.end_date || "";
          bodyText.value = r.body_text || "";

          // Buscar meta do paciente (nome/cpf) para PDF e UI
          await hydratePatientMeta(r.patient_id);

          updateProfessionalCrpUI();
          msg.textContent = "✅ Atestado carregado.";
        };
      });

      historyEl.querySelectorAll(".btnPdf").forEach((btn) => {
        btn.onclick = async () => {
          const r = await C.getAttestationById(btn.dataset.id);

          // Ajusta tela para o PDF (usa dados do registro)
          patientId.value = r.patient_id || "";
          professionalSelect.value = r.professional_id || "";
          docDate.value = r.doc_date || "";
          daysOff.value = r.days_off || "";
          if (startDate) startDate.value = r.start_date || "";
          if (endDate) endDate.value = r.end_date || "";
          bodyText.value = r.body_text || "";

          await hydratePatientMeta(r.patient_id);
          updateProfessionalCrpUI();

          await generatePdf();
        };
      });
    } catch (e) {
      console.error("❌ Erro ao carregar histórico:", e);
      historyEl.innerHTML = `<p class="muted">❌ Erro ao carregar histórico. Veja o console.</p>`;
    }
  }

  async function hydratePatientMeta(pid) {
    try {
      if (!pid) return;
      const p = await C.getPatientById(pid);
      if (!p) return;

      selectedPatient.id = p.id;
      selectedPatient.name = p.name || "";
      selectedPatient.cpf = p.cpf || "";
      selectedPatient.assigned_professional_id = p.assigned_professional_id || "";

      patientSearch.value = selectedPatient.name || patientSearch.value;
      showPatientCpfUI();
    } catch (e) {
      console.warn("⚠️ Não foi possível buscar paciente para meta (nome/cpf):", e);
    }
  }

  // ============================================================================
  // PDF (com wrap + quebra de página)
  // ============================================================================
  async function generatePdf() {
    try {
      if (!window.PDFLib) {
        msg.textContent = "❌ PDFLib não carregou. Confira o script no impressoes.html.";
        return;
      }

     const { PDFDocument, StandardFonts, rgb } = window.PDFLib;


      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

      const pageSize = [595, 842]; // A4
      const marginX = 50;
      const topY = 790;
      const bottomY = 70;
      const maxWidth = pageSize[0] - marginX * 2;

      let page = pdf.addPage(pageSize);
      let y = topY;

// ===== LOGO (foto) no topo direito =====
try {
  const logoUrl = "assets/img/logo.cornelio.jpg";
  const logoBytes = await fetch(logoUrl).then(r => r.arrayBuffer());
  const logo = await pdf.embedJpg(logoBytes);

  // tamanho da logo no PDF (simples)
  const logoW = 70; // menor e discreto (ajuste: 60 a 110)
  const logoH = (logo.height / logo.width) * logoW;

  // posição: topo direito
  const x = pageSize[0] - marginX - logoW;
  const yLogo = pageSize[1] - 40 - logoH;

  page.drawImage(logo, { x, y: yLogo, width: logoW, height: logoH });
} catch (e) {
  console.warn("⚠️ Não consegui carregar a logo:", e);
}


      const fontSize = 12;
      const lineHeight = 16;

      function newPage() {
        page = pdf.addPage(pageSize);
        y = topY;
      }

      function drawTextLine(text, size = fontSize, bold = false) {
        if (y < bottomY) newPage();
        page.drawText(text, { x: marginX, y, size, font: bold ? fontBold : font });
        y -= lineHeight;
      }

      function wrapLine(line, size = fontSize) {
        const words = line.split(/\s+/).filter(Boolean);
        if (!words.length) return [""];

        const lines = [];
        let current = "";

        for (const w of words) {
          const test = current ? `${current} ${w}` : w;
          const width = (boldFont(false).widthOfTextAtSize(test, size));
          if (width <= maxWidth) {
            current = test;
          } else {
            if (current) lines.push(current);
            current = w;
          }
        }
        if (current) lines.push(current);
        return lines;
      }

      function boldFont(isBold) {
        return isBold ? fontBold : font;
      }

      function drawWrappedParagraph(text, size = fontSize, isBold = false) {
        const f = boldFont(isBold);
        const words = String(text || "").split(/\s+/).filter(Boolean);
        if (!words.length) {
          y -= lineHeight;
          return;
        }

        let line = "";
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          const width = f.widthOfTextAtSize(test, size);

          if (width <= maxWidth) {
            line = test;
          } else {
            if (y < bottomY) newPage();
            page.drawText(line, { x: marginX, y, size, font: f });
            y -= lineHeight;
            line = w;
          }
        }

        if (line) {
          if (y < bottomY) newPage();
          page.drawText(line, { x: marginX, y, size, font: f });
          y -= lineHeight;
        }
      }

      // Linha decorativa sutil (cor da logo)

      // --------------------
      // Cabeçalho fixo do PDF
      // --------------------
      drawTextLine("ATESTADO", 16, true);
      y -= 6;

      const pName = (selectedPatient.name || patientSearch.value || "").trim();
      const pCpf = formatCPF(selectedPatient.cpf || "");
      const prof = professionalsCache.find((p) => p.id === professionalSelect.value);
      const profName = (prof?.name || getSelectedProfessionalLabel() || "").trim();
      const profCrp = (prof?.crp ? String(prof.crp).trim() : "");
      const dateBR = brDateFromYmd(docDate.value);
      const dOff = String(daysOff.value || "").trim();

      drawWrappedParagraph(`Paciente: ${pName || "-"}`, 12, true);
      drawWrappedParagraph(`CPF: ${pCpf || "-"}`, 12, false);
      drawWrappedParagraph(`Profissional: ${profName || "-"}`, 12, true);
      drawWrappedParagraph(`CRP: ${profCrp || "-"}`, 12, false);
      drawWrappedParagraph(`Data: ${dateBR || "-"}`, 12, false);
      drawWrappedParagraph(`Dias: ${dOff || "-"}`, 12, false);

      y -= 10;
      // linha separadora
      if (y < bottomY) newPage();
      page.drawLine({
        start: { x: marginX, y },
        end: { x: pageSize[0] - marginX, y },
        thickness: 1,
      });
      y -= 18;

      // --------------------
      // Corpo: texto livre (wrap + parágrafos)
      // --------------------
      const text = String(bodyText.value || "").replace(/\r/g, "");
      const paragraphs = text.split("\n");

      for (const p of paragraphs) {
        const trimmed = p.trim();

        if (!trimmed) {
          y -= lineHeight;
          continue;
        }

        // desenha com wrap e quebra de página
        drawWrappedParagraph(trimmed, fontSize, false);
      }

      // --------------------
      // Download
      // --------------------
      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const safeName = (pName || "paciente").trim().replace(/\s+/g, "_");
      const a = document.createElement("a");
      a.href = url;
      a.download = `atestado_${safeName}_${docDate.value || ""}.pdf`;
      a.click();

      URL.revokeObjectURL(url);
      msg.textContent = "✅ PDF gerado.";
    } catch (e) {
      console.error("❌ Erro ao gerar PDF:", e);
      msg.textContent = "❌ Erro ao gerar PDF. Veja o console.";
    }
  }

  // ============================================================================
  // EVENTOS
  // ============================================================================
  btnModel.addEventListener("click", forceModel);
  btnPDF.addEventListener("click", generatePdf);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveAttestation();
  });

  docDate.addEventListener("change", ensureDefaultTextIfEmpty);
  daysOff.addEventListener("input", ensureDefaultTextIfEmpty);
  if (startDate) startDate.addEventListener("change", ensureDefaultTextIfEmpty);
  if (endDate) endDate.addEventListener("change", ensureDefaultTextIfEmpty);

  const RT = window.CorneliusRealtime;
if (RT) {
  RT.on("attestations:change", () => {
    const pid = (patientId && patientId.value) ? patientId.value : "";
    if (pid) loadHistoryForPatient(pid);
  });
}

  // ============================================================================
  // BOOT
  // ============================================================================
  (async function boot() {
    try {
      docDate.value = new Date().toISOString().slice(0, 10);
      await loadProfessionals();
      updateProfessionalCrpUI();
      ensureDefaultTextIfEmpty();
      msg.textContent = "Pronto.";
    } catch (e) {
      console.error("❌ Boot impressoes falhou:", e);
      msg.textContent = "❌ Erro ao iniciar Impressões. Veja o console.";
    }
  })();
})();
