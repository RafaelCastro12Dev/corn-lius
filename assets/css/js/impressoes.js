(function () {
  "use strict";

  // Proteção de acesso
  if (window.CorneliusAuth && !window.CorneliusAuth.requireRole("admin")) return;


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

  // Novos controles (tipo de documento)
  const docType = document.getElementById("docType");
  const docTitle = document.getElementById("docTitle");
  const docSubtitle = document.getElementById("docSubtitle");
  const bodyLabel = document.getElementById("bodyLabel");

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
    console.error("❌ IDs ausentes no impressoes.html:", missing);
    alert("❌ Erro: IDs ausentes no impressoes.html:\n" + missing.join(", "));
    return;
  }

  // ============================================================================
  // ESTADO
  // ============================================================================
  let patientsCache = [];
  let professionalsCache = [];
  let lastSavedId = null;

  const selectedPatient = {
    id: "",
    name: "",
    cpf: "",
    assigned_professional_id: "",
  };

  // ============================================================================
  // HELPERS
  // ============================================================================
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // fallback RFC4122 v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function formatCPF(cpf) {
    cpf = String(cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11) return "";
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }

  function brDateFromYmd(ymd) {
    const s = String(ymd || "").trim();
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const [y, m, d] = s.split("-");
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
      patientCpfInfo.style.display = "block";
      patientCpfInfo.textContent = `CPF: ${cpf}`;
    } else {
      patientCpfInfo.style.display = "none";
      patientCpfInfo.textContent = "";
    }
  }

  function updateProfessionalCrpUI() {
    if (!professionalCrpInfo) return;
    const profId = professionalSelect.value;
    const p = professionalsCache.find((x) => x.id === profId);
    const crp = (p?.crp ? String(p.crp).trim() : "");
    if (crp) {
      professionalCrpInfo.style.display = "block";
      professionalCrpInfo.textContent = `CRP: ${crp}`;
    } else {
      professionalCrpInfo.style.display = "none";
      professionalCrpInfo.textContent = "";
    }
  }

  function getSelectedProfessionalLabel() {
    return professionalSelect.options[
      professionalSelect.selectedIndex]?.text || "";
  }

  function getDocMeta() {
    const t = (docType?.value || "atestado").toString();
    if (t === "relatorio") return { key: "relatorio", title: "Relatório" };
    if (t === "declaracao") return { key: "declaracao", title: "Declaração" };
    return { key: "atestado", title: "Atestado" };
  }

  function buildDefaultDeclaracaoText() {
    const pName = (selectedPatient.name || patientSearch.value || "").trim();
    const dateBR = brDateFromYmd(docDate.value);
    const profLabel = getSelectedProfessionalLabel();

    return `DECLARAÇÃO

Declaro para os devidos fins que ${pName || "[PACIENTE]"} compareceu nesta clínica na data de ${dateBR || "[DATA]"}.

${profLabel ? `Profissional: ${profLabel}` : ""}

____________________________________
Assinatura e carimbo`;
  }

  function buildDefaultRelatorioText() {
    const pName = (selectedPatient.name || patientSearch.value || "").trim();
    const dateBR = brDateFromYmd(docDate.value);
    const profLabel = getSelectedProfessionalLabel();

    return `RELATÓRIO

Paciente: ${pName || "[PACIENTE]"}
Data: ${dateBR || "[DATA]"}

1) Queixa principal / Demanda:
- 

2) Procedimentos / Intervenções realizadas:
- 

3) Evolução / Observações:
- 

4) Recomendações:
- 

${profLabel ? `Profissional: ${profLabel}` : ""}

____________________________________
Assinatura e carimbo`;
  }

  function buildDefaultBodyText() {
    const meta = getDocMeta();
    if (meta.key === "relatorio") return buildDefaultRelatorioText();
    if (meta.key === "declaracao") return buildDefaultDeclaracaoText();
    return buildDefaultAttestationText();
  }

  function applyDocUi() {
    if (!docType) return;
    const meta = getDocMeta();

    if (docTitle) docTitle.textContent = meta.title;
    if (docSubtitle) docSubtitle.textContent = "Digite o texto, salve e gere o PDF para imprimir/salvar.";

    if (bodyLabel) {
      bodyLabel.textContent =
        meta.key === "relatorio"
          ? "Texto do relatório (a profissional escreve aqui)"
          : meta.key === "declaracao"
            ? "Texto da declaração (a profissional escreve aqui)"
            : "Texto do atestado (a profissional escreve aqui)";
    }
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
    bodyText.value = buildDefaultBodyText();
  }

  function forceModel() {
    bodyText.value = buildDefaultBodyText();
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
    patientSuggest.style.display = "block";
    patientSuggest.innerHTML = items
      .slice(0, 12)
      .map((p) => {
        const cpf = formatCPF(p.cpf);
        const extra = cpf ? ` <span class="muted">(${cpf})</span>` : "";
        return `<div class="suggest-item" data-id="${p.id}">
          <strong>${escapeHtml(p.name || "")}</strong>${extra}
        </div>`;
      })
      .join("");

    patientSuggest.querySelectorAll(".suggest-item").forEach((el) => {
      el.onclick = () => {
        const pid = el.dataset.id;
        const p = patientsCache.find((x) => x.id === pid);
        if (!p) return;

        selectedPatient.id = p.id;
        selectedPatient.name = p.name || "";
        selectedPatient.cpf = p.cpf || "";
        selectedPatient.assigned_professional_id = p.assigned_professional_id || "";

        patientSearch.value = selectedPatient.name;
        patientId.value = selectedPatient.id;
        showPatientSuggest([]);

        showPatientCpfUI();

        // Sugestão automática do profissional atribuído
        const assignedProf = selectedPatient.assigned_professional_id;
        if (assignedProf) {
          professionalSelect.value = assignedProf;
          updateProfessionalCrpUI();
        }

        ensureDefaultTextIfEmpty();
        loadHistoryForPatient(pid);
      };
    });
  }

  async function loadPatientsCache() {
    patientsCache = await C.getAllPatients();
  }

  const onPatientInput = debounce(async () => {
    const q = String(patientSearch.value || "").trim().toLowerCase();
    selectedPatient.id = "";
    selectedPatient.name = patientSearch.value || "";
    selectedPatient.cpf = "";
    selectedPatient.assigned_professional_id = "";
    patientId.value = "";

    showPatientCpfUI();
    lastSavedId = null;

    if (!q) return showPatientSuggest([]);

    const items = patientsCache.filter((p) => {
      const name = String(p.name || "").toLowerCase();
      const cpf = String(p.cpf || "").replace(/\D/g, "");
      const qcpf = q.replace(/\D/g, "");
      return name.includes(q) || (qcpf && cpf.includes(qcpf));
    });

    showPatientSuggest(items);
  }, 200);

  patientSearch.addEventListener("input", onPatientInput);

  patientSearch.addEventListener("focus", () => {
    const q = String(patientSearch.value || "").trim().toLowerCase();
    if (!q) return;
    const items = patientsCache.filter((p) =>
      String(p.name || "").toLowerCase().includes(q)
    );
    showPatientSuggest(items);
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

  // Tipo do documento: atualiza UI e modelo
  if (docType) {
    docType.addEventListener("change", () => {
      applyDocUi();
      // Insere modelo apenas se estiver vazio (não sobrescreve texto já digitado)
      const current = String(bodyText.value || "").trim();
      if (!current) bodyText.value = buildDefaultBodyText();

      // Recarrega histórico do tipo atual (se já houver paciente selecionado)
      if (patientId.value) loadHistoryForPatient(patientId.value);
    });
  }

  // ============================================================================
  // SALVAR ATESTADO
  // ============================================================================
  async function saveAttestation() {
    msg.textContent = "Salvando...";
    const meta = getDocMeta();

    if (!patientId.value || !professionalSelect.value || !docDate.value) {
      msg.textContent = "❌ Preencha paciente, profissional e data.";
      return;
    }
    if (!String(bodyText.value || "").trim()) {
      msg.textContent = "❌ Digite o texto do documento.";
      return;
    }

    const payload = {
      patient_id: patientId.value,
      professional_id: professionalSelect.value,
      doc_date: docDate.value,
      title: meta.title,
      doc_type: meta.key,
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
      msg.textContent = `✅ ${meta.title} salvo com sucesso.`;
      loadHistoryForPatient(patientId.value);
    } catch (e) {
      console.error("❌ Erro ao salvar documento:", e);
      msg.textContent = "❌ Erro ao salvar documento.";
    }
  }

  // ============================================================================
  // HISTÓRICO
  // ============================================================================
  async function loadHistoryForPatient(pid) {
    historyEl.innerHTML = "";
    if (!pid) return;

    try {
      const meta = getDocMeta();
      const allRows = await C.getAttestationsByPatient(pid);
      const rows = (allRows || []).filter(r => (r.doc_type || "atestado") === meta.key);
      if (!rows.length) {
        historyEl.innerHTML = `<p class="muted">Nenhum ${meta.title.toLowerCase()} emitido.</p>`;
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
          if (docType) { docType.value = (r.doc_type || "atestado"); applyDocUi(); }
          msg.textContent = "✅ Documento carregado.";
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
          updateProfessionalCrpUI(
          );
          if (docType) { docType.value = (r.doc_type || "atestado"); applyDocUi(); }

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

      
      function splitIntoLines(text, f, size, maxW) {
        const words = String(text || "").split(/\s+/);
        const lines = [];
        let line = "";
        for (const w of words) {
          const test = line ? (line + " " + w) : w;
          const width = f.widthOfTextAtSize(test, size);
          if (width <= maxW) line = test;
          else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines;
      }

      function newPage() {
        page = pdf.addPage(pageSize);
        y = topY;
      }

      function drawTextLine(text, size = fontSize, bold = false) {
        const f = bold ? fontBold : font;
        const parts = String(text || "").split("\n");
        for (const part of parts) {
          const lines = splitIntoLines(part, f, size, maxWidth);
          for (const line of lines) {
            if (y <= bottomY) newPage();
            page.drawText(line, { x: marginX, y, size, font: f });
            y -= lineHeight;
          }
          y -= 4;
        }
      }

      // --------------------
      // Cabeçalho fixo do PDF
      // --------------------
      const meta = getDocMeta();
      drawTextLine(meta.title.toUpperCase(), 16, true);
      y -= 6;

      const pName = (selectedPatient.name || patientSearch.value || "").trim();
      const pCpf = formatCPF(selectedPatient.cpf || "");
      const prof = professionalsCache.find((p) => p.id === professionalSelect.value);
      const profName = (prof?.name || getSelectedProfessionalLabel() || "").trim();
      const profCrp = (prof?.crp ? String(prof.crp).trim() : "");
      const dateBR = brDateFromYmd(docDate.value);

      drawTextLine(`Paciente: ${pName || ""}`, 12, false);
      if (pCpf) drawTextLine(`CPF: ${pCpf}`, 12, false);
      drawTextLine(`Profissional: ${profName || ""}${profCrp ? ` (CRP ${profCrp})` : ""}`, 12, false);
      drawTextLine(`Data: ${dateBR || ""}`, 12, false);
      y -= 6;

      // Corpo
      drawTextLine(String(bodyText.value || "").trim(), 12, false);

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const safeName = (pName || "paciente")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w\-]/g, "");

      const a = document.createElement("a");
      a.href = url;
      const meta2 = getDocMeta();
      a.download = `${meta2.key}_${safeName}_${docDate.value || ""}.pdf`;
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
  btnModel.addEventListener("click", () => {
    forceModel();
    msg.textContent = "Modelo inserido.";
  });

  btnPDF.addEventListener("click", async () => {
    if (!patientId.value || !professionalSelect.value || !docDate.value) {
      msg.textContent = "❌ Preencha paciente, profissional e data.";
      return;
    }
    if (!String(bodyText.value || "").trim()) {
      msg.textContent = "❌ Digite o texto do documento.";
      return;
    }
    await generatePdf();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveAttestation();
  });

  // ============================================================================
  // BOOT
  // ============================================================================
  (async function boot() {
    try {
      docDate.value = new Date().toISOString().slice(0, 10);
      await loadPatientsCache();
      await loadProfessionals();
      updateProfessionalCrpUI();
      applyDocUi();
      ensureDefaultTextIfEmpty();
      msg.textContent = "Pronto.";
    } catch (e) {
      console.error("❌ Boot impressoes falhou:", e);
      msg.textContent = "❌ Erro ao iniciar Impressões. Veja o console.";
    }
  })();
})();
