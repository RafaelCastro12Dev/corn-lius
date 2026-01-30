/* global CorneliusAuth */
(function () {
  'use strict';

  // ============================================================
  // SISTEMA DE IMPRESSÕES PDF (Cornélius)
  // - Mantém o Atestado (já funcional) intacto
  // - Agrega preenchimento completo da Declaração (com validação)
  // - Mantém modo calibração por coordenadas (PDF.js) com marcação visual
  // ============================================================

  // =========================
  // CONFIG
  // =========================
  const TEMPLATES = {
    atestado:   { path: 'assets/pdfs/atestado.pdf',   filename: 'atestado.pdf',   label: 'Atestado' },
    declaracao: { path: 'assets/pdfs/declaracao.pdf', filename: 'declaracao.pdf', label: 'Declaração' },
    relatorio:  { path: 'assets/pdfs/relatorio.pdf',  filename: 'relatorio.pdf',  label: 'Relatório' },
  };

  // =========================
  // POSIÇÕES
  // =========================
  // 📌 Regra: pdf-lib usa origem no canto inferior esquerdo.
  // Para facilitar, trabalhamos sempre com yFromTop e convertemos assim:
  // yReal = height - yFromTop

  // ✅ Coordenadas finais (ATESTADO) — NÃO MEXER (já está alinhado)
  const POS_ATESTADO = {
    paciente:     { x: 314, yFromTop: 289, maxWidth: 360 },
    rg:           { x: 194, yFromTop: 307, maxWidth: 220 },
    diagnostico:  { x: 396, yFromTop: 322, maxWidth: 260 },
    cid:          { x: 108, yFromTop: 339, maxWidth: 120 },

    rodape: {
      dia: { x: 309, yFromTop: 572 },
      mes: { x: 387, yFromTop: 572 },
      ano: { x: 514, yFromTop: 572 }
    }
  };

  // 🟡 Declaração — cole aqui as coordenadas medidas no Modo Calibração
  // IMPORTANTE:
  // - 1 campo = 1 clique
  // - Se algum campo ficar com x/y 0 ou null, o sistema vai avisar e não gera o PDF.
  //
  // Estrutura (alinhada com o resumo do projeto):
  //  - finalidade, paciente, rg, cpf
  //  - data: { dia, mes, ano }  (para "dd/mm/aaaa" em 3 partes OU use dataString se preferir um campo único)
  //  - horas: { ini, fim }
  //  - rodape: { dia, mes, ano } (normalmente "Pedreira, __ de ________ de 202_": escreve apenas o último dígito do ano)
const POS_DECLARACAO = {
  // desci um pouco (yFromTop +) pra não atravessar a linha
  finalidade: { x: 290, yFromTop: 290, maxWidth: 450 },
  paciente:   { x: 130, yFromTop: 305, maxWidth: 420 },

  // desci levemente e puxei um pouco pra direita
  rg:         { x: 90, yFromTop: 323, maxWidth: 220 },
  cpf:        { x: 230, yFromTop: 323, maxWidth: 220 },

  // data quase ok, só um micro ajuste pra “sentar” melhor na linha
  data: {
    dia: { x: 209, yFromTop: 340, maxWidth: 40 },
    mes: { x: 240, yFromTop: 340, maxWidth: 40 },
    ano: { x: 260, yFromTop: 340, maxWidth: 80 },
  },

  // aqui é o principal: empurrei bastante pra direita pra não bater no “às”
  horas: {
    ini: { x: 315, yFromTop: 340, maxWidth: 80 },
    fim: { x: 370, yFromTop: 340, maxWidth: 80 },
  },

  // rodapé: desci pra “sentar” na linha
  rodape: {
    dia: { x: 311, yFromTop: 461, maxWidth: 40 },
    mes: { x: 390, yFromTop: 461, maxWidth: 180 },
    ano: { x: 514, yFromTop: 461, maxWidth: 20 }
  }
};


  // 🟡 Relatório — em calibração (texto longo + data/rodapé)
  // Estrutura sugerida:
  //  - paciente (nome completo)
  //  - rg (opcional)
  //  - texto (corpo do relatório; depois faremos quebra automática e limites)
  //  - rodape: { dia, mes, ano } (se o PDF tiver '202_' use apenas último dígito)
  //  - profissional (assinatura/nome, se existir no PDF)
  const POS_RELATORIO = {
    // topo
    paciente: { x: 250, yFromTop: 320, maxWidth: 420 },

    nascimento: {
      dia: { x: 180, yFromTop: 338, maxWidth: 40 },
      mes: { x: 240, yFromTop: 338, maxWidth: 40 },
      ano: { x: 300, yFromTop: 338, maxWidth: 80 },
    },

    psicologo: { x: 260, yFromTop: 352, maxWidth: 420 },

    // linhas do corpo (um campo = um clique)
    corpo: {
      demanda:       { x: 230, yFromTop: 400, maxWidth: 480 },
      procedimentos: { x: 205, yFromTop: 417, maxWidth: 480 },
      historico:     { x: 172, yFromTop: 432, maxWidth: 480 },
      observacao:    { x: 173, yFromTop: 449, maxWidth: 480 },
      analise:       { x: 175, yFromTop: 465, maxWidth: 480 },

      // não houve clique específico no print: usamos um ajuste intermediário (pode refinar com 1 clique depois)
      conclusao:     { x: 125, yFromTop: 480, maxWidth: 480 },

      // clique capturado
      encaminhamento:{ x: 230, yFromTop: 497, maxWidth: 480 },
    },

    rodape: {
      dia: { x: 311, yFromTop: 585, maxWidth: 40 },
      mes: { x: 394, yFromTop: 585, maxWidth: 180 },
      ano: { x: 515, yFromTop: 585, maxWidth: 20 }
    }
  };


  // =========================
  // CALIBRAÇÃO (PDF.js)
  // =========================
  const CALIBRATE_ENABLED = true;
  const CALIBRATE_SCALE = 1.6;

  // =========================
  // DOM refs
  // =========================
  const msgEl = document.getElementById('msg');

  const backdrop = document.getElementById('docBackdrop');
  const btnClose = document.getElementById('docClose');
  const btnCancel = document.getElementById('docCancel');
  const form = document.getElementById('docForm');
  const titleEl = document.getElementById('docTitle');
  const docKeyEl = document.getElementById('docKey');

  const boxAtestado = document.getElementById('boxAtestado');
  const boxDeclaracao = document.getElementById('boxDeclaracao');
  const boxRelatorio = document.getElementById('boxRelatorio');

  // Campos comuns
  const inPaciente = document.getElementById('docPaciente');
  const inRG = document.getElementById('docRG');

  // Atestado
  const inSintomas = document.getElementById('docSintomas');
  const inCID = document.getElementById('docCID');
  const inCidadeData = document.getElementById('docCidadeData');

  // Declaração
  const inFinalidade = document.getElementById('docFinalidade');
  const inCPF = document.getElementById('docCPF');
  const inData = document.getElementById('docData');
  const inHoraIni = document.getElementById('docHoraIni');
  const inHoraFim = document.getElementById('docHoraFim');
  const inCidadeData2 = document.getElementById('docCidadeData2');

  // Relatório
  const inTexto = document.getElementById('docTexto');
  const inCidadeData3 = document.getElementById('docCidadeData3');

  // Calibração
  const calCanvas = document.getElementById('calCanvas');
  const calOut = document.getElementById('calOut');

  // =========================
  // UI helpers
  // =========================
  function showMsg(text, kind = 'ok') {
    if (!msgEl) return;
    msgEl.style.display = '';
    msgEl.textContent = text;
    msgEl.style.borderColor = kind === 'error' ? 'rgba(220,0,0,.35)' : 'rgba(0,0,0,.15)';
    msgEl.style.background = kind === 'error' ? 'rgba(220,0,0,.06)' : 'rgba(0,0,0,.03)';
  }

  function clearMsg() {
    if (!msgEl) return;
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }

  function setButtonsEnabled(enabled) {
    document.querySelectorAll('button[data-doc]').forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  function safeNameForFile(s) {
    return (s || 'documento')
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'documento';
  }

  function openModal(docKey) {
    clearMsg();

    const tpl = TEMPLATES[docKey];
    if (!tpl) {
      showMsg('Tipo de documento inválido.', 'error');
      return;
    }

    docKeyEl.value = docKey;
    titleEl.textContent = `Preencher: ${tpl.label}`;

    // mostra/esconde caixas
    boxAtestado?.classList.toggle('hidden', docKey !== 'atestado');
    boxDeclaracao?.classList.toggle('hidden', docKey !== 'declaracao');
    boxRelatorio?.classList.toggle('hidden', docKey !== 'relatorio');

    // valores padrão de data/hora
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');

    if (docKey === 'atestado') {
      if (inCidadeData && !inCidadeData.value) inCidadeData.value = `Pedreira, ${dd}/${mm}/${yyyy}`;
    }
    if (docKey === 'declaracao') {
      if (inData && !inData.value) inData.value = `${dd}/${mm}/${yyyy}`;
      if (inHoraIni && !inHoraIni.value) inHoraIni.value = `${hh}:${mi}`;
      if (inHoraFim && !inHoraFim.value) inHoraFim.value = `${hh}:${mi}`;
      if (inCidadeData2 && !inCidadeData2.value) inCidadeData2.value = `Pedreira, ${dd}/${mm}/${yyyy}`;
    }
    if (docKey === 'relatorio') {
      if (inCidadeData3 && !inCidadeData3.value) inCidadeData3.value = `Pedreira, ${dd}/${mm}/${yyyy}`;
    }

    // abre modal
    if (backdrop) backdrop.style.display = 'flex';

    // inicia calibração do doc atual (se habilitado)
    if (CALIBRATE_ENABLED) {
      startCalibration(docKey).catch(err => console.warn('Calibração:', err));
    }
  }

  function closeModal() {
    if (backdrop) backdrop.style.display = 'none';
  }

  // =========================
  // PDF template load / download
  // =========================
  async function fetchTemplateBytes(tpl) {
    const resp = await fetch(tpl.path, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Falha ao carregar template (${resp.status})`);
    return await resp.arrayBuffer();
  }

  async function downloadTemplate(docKey) {
    clearMsg();
    const tpl = TEMPLATES[docKey];
    if (!tpl) return showMsg('Tipo de documento inválido.', 'error');

    setButtonsEnabled(false);
    try {
      const bytes = await fetchTemplateBytes(tpl);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = tpl.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showMsg('Não consegui baixar o modelo. Verifique se os PDFs estão em assets/pdfs/.', 'error');
    } finally {
      setButtonsEnabled(true);
    }
  }

  // =========================
  // Date helpers / parsing
  // =========================
  const MESES_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  function parseDateFromText(s) {
    // aceita "Pedreira, 30/01/2026" ou "30/01/2026"
    const m = (s || '').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!m) return null;
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (!d || !mo || !y) return null;
    if (mo < 1 || mo > 12) return null;
    return { d, mo, y };
  }

  function parseTime(s) {
    // "HH:MM" (tolerante)
    const m = (s || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
    return { hh, mm, text: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
  }

  function posIsSet(pos) {
    return pos && typeof pos.x === 'number' && typeof pos.yFromTop === 'number' && pos.x > 0 && pos.yFromTop > 0;
  }

  function collectMissingPos(root, prefix = '') {
    // percorre objeto recursivamente e coleta itens com {x,yFromTop} inválidos
    const missing = [];
    if (!root || typeof root !== 'object') return missing;

    Object.keys(root).forEach((k) => {
      const v = root[k];
      const path = prefix ? `${prefix}.${k}` : k;

      if (v && typeof v === 'object' && typeof v.x === 'number' && typeof v.yFromTop === 'number') {
        if (!posIsSet(v)) missing.push(path);
        return;
      }

      // ignora campos não relacionados (ex: maxWidth isolado)
      if (v && typeof v === 'object') {
        missing.push(...collectMissingPos(v, path));
      }
    });

    return missing;
  }

  function normalizeDocId(s) {
    // remove caracteres inúteis mantendo números/letras e separadores básicos
    return (s || '').trim().replace(/\s+/g, ' ');
  }

  // =========================
  // PDF draw helpers
  // =========================
  function drawTextAt(page, height, text, pos, opts) {
    if (!text) return;
    if (!posIsSet(pos)) return;

    const yReal = height - pos.yFromTop;
    const size = opts.size ?? 12;

    page.drawText(String(text), {
      x: pos.x,
      y: yReal,
      size,
      font: opts.font,
      color: opts.color,
      maxWidth: pos.maxWidth ?? opts.maxWidth,
    });
  }

  // =========================
  // PDF fill
  // =========================
  async function generatePdfFromModal(docKey) {
    clearMsg();

    if (!window.PDFLib) {
      showMsg('pdf-lib não está carregado. Verifique assets/vendor/pdf-lib/pdf-lib.min.js', 'error');
      return;
    }

    const tpl = TEMPLATES[docKey];
    if (!tpl) return showMsg('Tipo de documento inválido.', 'error');

    setButtonsEnabled(false);

    try {
      const templateBytes = await fetchTemplateBytes(tpl);
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

      const pdfDoc = await PDFDocument.load(templateBytes);
      const page = pdfDoc.getPages()[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { height } = page.getSize();

      const base = {
        font,
        color: rgb(0, 0, 0),
        size: 12
      };

      // =======================
      // ATESTADO (mantido)
      // =======================
      if (docKey === 'atestado') {
        const paciente = (inPaciente?.value || '').trim();
        if (!paciente) {
          showMsg('Informe o nome do paciente.', 'error');
          return;
        }

        const rg = (inRG?.value || '').trim();
        const diagnostico = (inSintomas?.value || '').trim();
        const cid = (inCID?.value || '').trim();

        const cidadeData = (inCidadeData?.value || '').trim();
        const parsed = parseDateFromText(cidadeData) || (() => {
          const now = new Date();
          return { d: now.getDate(), mo: now.getMonth() + 1, y: now.getFullYear() };
        })();

        drawTextAt(page, height, paciente, POS_ATESTADO.paciente, base);
        drawTextAt(page, height, rg, POS_ATESTADO.rg, base);
        drawTextAt(page, height, diagnostico, POS_ATESTADO.diagnostico, base);
        drawTextAt(page, height, cid, POS_ATESTADO.cid, base);

        // rodapé (dia / mês / ano)
        const dia = String(parsed.d);
        const mes = MESES_PT[parsed.mo - 1] || '';
        const ano = String(parsed.y).slice(-1); // ✅ só 1 dígito (PDF já tem "202_")

        drawTextAt(page, height, dia, POS_ATESTADO.rodape.dia, base);
        drawTextAt(page, height, mes, POS_ATESTADO.rodape.mes, base);
        drawTextAt(page, height, ano, POS_ATESTADO.rodape.ano, base);

        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `preenchido-${safeNameForFile(paciente)}-${tpl.filename}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showMsg('Atestado gerado com sucesso.', 'ok');
        closeModal();
        return;
      }

      // =======================
      // DECLARAÇÃO (agregado)
      // =======================
      if (docKey === 'declaracao') {
        const paciente = (inPaciente?.value || '').trim();
        const rg = normalizeDocId(inRG?.value || '');
        const cpf = normalizeDocId(inCPF?.value || '');
        const finalidade = (inFinalidade?.value || '').trim();

        const dataStr = (inData?.value || '').trim();            // normalmente "dd/mm/aaaa"
        const horaIniStr = (inHoraIni?.value || '').trim();      // "HH:MM"
        const horaFimStr = (inHoraFim?.value || '').trim();      // "HH:MM"
        const cidadeData = (inCidadeData2?.value || '').trim();  // "Pedreira, dd/mm/aaaa"

        if (!paciente) {
          showMsg('Informe o nome do paciente (Declaração).', 'error');
          return;
        }

        // valida coordenadas obrigatórias
        // Observação: se você optar por dataString, comente a validação do bloco data.{dia,mes,ano} e adicione dataString.
        const missing = [
          ...collectMissingPos({
            finalidade: POS_DECLARACAO.finalidade,
            paciente: POS_DECLARACAO.paciente,
            rg: POS_DECLARACAO.rg,
            cpf: POS_DECLARACAO.cpf,
            horas: POS_DECLARACAO.horas,
            rodape: POS_DECLARACAO.rodape,
            data: POS_DECLARACAO.data,
            // dataString: POS_DECLARACAO.dataString,
          })
        ];

        // se quiser permitir RG/CPF opcionais no layout, remova do coletor acima
        if (missing.length) {
          showMsg(
            `Declaração: faltam coordenadas para: ${missing.join(', ')}. ` +
            `Use o canvas (Modo Calibração) e cole no POS_DECLARACAO.`,
            'error'
          );
          return;
        }

        // parsing de data/horas
        const parsedData = parseDateFromText(dataStr) || parseDateFromText(cidadeData) || (() => {
          const now = new Date();
          return { d: now.getDate(), mo: now.getMonth() + 1, y: now.getFullYear() };
        })();

        const tIni = parseTime(horaIniStr);
        const tFim = parseTime(horaFimStr);

        // desenha campos do corpo
        drawTextAt(page, height, finalidade, POS_DECLARACAO.finalidade, base);
        drawTextAt(page, height, paciente, POS_DECLARACAO.paciente, base);
        drawTextAt(page, height, rg, POS_DECLARACAO.rg, base);
        drawTextAt(page, height, cpf, POS_DECLARACAO.cpf, base);

        // data: partes (dia / mes / ano)
        drawTextAt(page, height, String(parsedData.d).padStart(2, '0'), POS_DECLARACAO.data.dia, base);
        drawTextAt(page, height, String(parsedData.mo).padStart(2, '0'), POS_DECLARACAO.data.mes, base);
        drawTextAt(page, height, String(parsedData.y), POS_DECLARACAO.data.ano, base);

        // horas
        if (tIni) drawTextAt(page, height, tIni.text, POS_DECLARACAO.horas.ini, base);
        if (tFim) drawTextAt(page, height, tFim.text, POS_DECLARACAO.horas.fim, base);

        // rodapé em partes (dia / mês / ano)
        const diaRod = String(parsedData.d);
        const mesRod = MESES_PT[parsedData.mo - 1] || '';
        const anoRod = String(parsedData.y).slice(-1); // PDF já tem "202_"

        drawTextAt(page, height, diaRod, POS_DECLARACAO.rodape.dia, base);
        drawTextAt(page, height, mesRod, POS_DECLARACAO.rodape.mes, base);
        drawTextAt(page, height, anoRod, POS_DECLARACAO.rodape.ano, base);

        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `preenchido-${safeNameForFile(paciente)}-${tpl.filename}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showMsg('Declaração gerada com sucesso.', 'ok');
        closeModal();
        return;
      }

      // =======================
      // RELATÓRIO (preenchimento por linhas + calibração)
      // =======================
      if (docKey === 'relatorio') {
        const paciente = (inPaciente?.value || '').trim();
        const nascimentoStr = (document.getElementById('docNasc')?.value || inRG?.value || '').trim();
        const textoRel = (inTexto?.value || '').trim();
        const cidadeData = (inCidadeData3?.value || '').trim();

        // Coordenadas mínimas exigidas
        const missing = [
          ...collectMissingPos({
            paciente: POS_RELATORIO.paciente,
            nascimento: POS_RELATORIO.nascimento,
            psicologo: POS_RELATORIO.psicologo,
            corpo: POS_RELATORIO.corpo,
            rodape: POS_RELATORIO.rodape
          })
        ];

        if (missing.length) {
          showMsg(
            `Relatório: faltam coordenadas para: ${missing.join(', ')}. ` +
            `Use o canvas (Modo Calibração) e cole no POS_RELATORIO.`,
            'error'
          );
          return;
        }

        if (!paciente) {
          showMsg('Informe o nome do paciente (Relatório).', 'error');
          return;
        }

        // psicólogo: tenta pegar do usuário logado; se não tiver, deixa em branco (você calibra/ajusta depois)
        const profName = (document.getElementById('docPsicologo')?.value || '').trim() ||
          (window.CorneliusAuth?.getCurrentUser?.()?.name) ||
          (window.CorneliusAuth?.user?.name) ||
          (window.CorneliusAuth?.currentUser?.name) ||
          '';

        // nascimento
        const nasc = parseDateFromText(nascimentoStr);
        // texto: cada linha vira um campo do corpo, na ordem:
        // 0 demanda, 1 procedimentos, 2 histórico, 3 observação clínica, 4 análise psicológica, 5 conclusão, 6 encaminhamento
        const l0 = (document.getElementById('docDemanda')?.value || '').trim();
        const l1 = (document.getElementById('docProcedimentos')?.value || '').trim();
        const l2 = (document.getElementById('docHistorico')?.value || '').trim();
        const l3 = (document.getElementById('docObservacao')?.value || '').trim();
        const l4 = (document.getElementById('docAnalise')?.value || '').trim();
        const l5 = (document.getElementById('docConclusao')?.value || '').trim();
        const l6 = (document.getElementById('docEncaminhamento')?.value || '').trim();

        const hasStructured = (l0 || l1 || l2 || l3 || l4 || l5 || l6);
        const linhas = hasStructured
          ? [l0, l1, l2, l3, l4, l5, l6]
          : (textoRel || '').split('\\n').map(s => s.trim());

        const getLine = (i) => (linhas[i] ? linhas[i] : '');

        // data do rodapé
        const parsedRodape = parseDateFromText(cidadeData) || (() => {
          const now = new Date();
          return { d: now.getDate(), mo: now.getMonth() + 1, y: now.getFullYear() };
        })();

        // topo
        drawTextAt(page, height, paciente, POS_RELATORIO.paciente, { ...base, size: 12 });

        if (nasc) {
          drawTextAt(page, height, String(nasc.d).padStart(2, '0'), POS_RELATORIO.nascimento.dia, base);
          drawTextAt(page, height, String(nasc.mo).padStart(2, '0'), POS_RELATORIO.nascimento.mes, base);
          drawTextAt(page, height, String(nasc.y), POS_RELATORIO.nascimento.ano, base);
        }

        if (profName) {
          drawTextAt(page, height, profName, POS_RELATORIO.psicologo, { ...base, size: 12 });
        }

        // corpo (um campo por linha)
        drawTextAt(page, height, getLine(0), POS_RELATORIO.corpo.demanda, { ...base, size: 12 });
        drawTextAt(page, height, getLine(1), POS_RELATORIO.corpo.procedimentos, { ...base, size: 12 });
        drawTextAt(page, height, getLine(2), POS_RELATORIO.corpo.historico, { ...base, size: 12 });
        drawTextAt(page, height, getLine(3), POS_RELATORIO.corpo.observacao, { ...base, size: 12 });
        drawTextAt(page, height, getLine(4), POS_RELATORIO.corpo.analise, { ...base, size: 12 });
        drawTextAt(page, height, getLine(5), POS_RELATORIO.corpo.conclusao, { ...base, size: 12 });
        drawTextAt(page, height, getLine(6), POS_RELATORIO.corpo.encaminhamento, { ...base, size: 12 });

        // rodapé
        const dia = String(parsedRodape.d);
        const mes = MESES_PT[parsedRodape.mo - 1] || '';
        const ano = String(parsedRodape.y).slice(-1);

        drawTextAt(page, height, dia, POS_RELATORIO.rodape.dia, base);
        drawTextAt(page, height, mes, POS_RELATORIO.rodape.mes, base);
        drawTextAt(page, height, ano, POS_RELATORIO.rodape.ano, base);

        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `preenchido-${safeNameForFile(paciente)}-${tpl.filename}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showMsg('Relatório gerado com sucesso.', 'ok');
        closeModal();
        return;
      }

    } catch (e) {
      console.error(e);
      showMsg('Falha ao gerar PDF. Veja o Console (F12).', 'error');
    } finally {
      setButtonsEnabled(true);
    }
  }

  // =========================
  // CALIBRAÇÃO (PDF.js)
  // =========================
  async function startCalibration(docKey) {
    if (!CALIBRATE_ENABLED) return;
    if (!calCanvas || !calOut) return;

    // precisa do PDF.js
    if (!window.pdfjsLib) {
      calOut.textContent =
        'PDF.js não carregou.\n' +
        'Inclua no HTML (antes do impressoes.js):\n' +
        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js';
      return;
    }

    const tpl = TEMPLATES[docKey];
    if (!tpl) return;

    // Worker
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument(tpl.path).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: CALIBRATE_SCALE });
    const ctx = calCanvas.getContext('2d');

    calCanvas.width = Math.floor(viewport.width);
    calCanvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    calOut.textContent =
`MODO CALIBRAÇÃO ATIVO
Documento: ${tpl.path}

Clique exatamente ONDE o texto deve começar (canto inferior esquerdo do texto).
Copie e cole no POS como:

{ x: <valor>, yFromTop: <valor> }

(Dica: 1 campo = 1 clique)
`;

    // marcação visual no canvas (último clique)
    function drawMarker(xCanvas, yCanvas) {
      // restaura o PDF renderizado por baixo: re-render seria caro, então desenhamos por cima.
      // Marcador simples (alvo)
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(xCanvas, yCanvas, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xCanvas - 10, yCanvas);
      ctx.lineTo(xCanvas + 10, yCanvas);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xCanvas, yCanvas - 10);
      ctx.lineTo(xCanvas, yCanvas + 10);
      ctx.stroke();
      ctx.restore();
    }

    calCanvas.onclick = (ev) => {
      const rect = calCanvas.getBoundingClientRect();
      const xCanvas = ev.clientX - rect.left;
      const yCanvas = ev.clientY - rect.top;

      const x = Math.round(xCanvas / CALIBRATE_SCALE);
      const yFromTop = Math.round(yCanvas / CALIBRATE_SCALE);

      drawMarker(xCanvas, yCanvas);
      calOut.textContent += `\nClique → x: ${x}, yFromTop: ${yFromTop}`;
    };
  }

  // =========================
  // INIT
  // =========================
  document.addEventListener('DOMContentLoaded', async () => {
    // auth
    if (!window.CorneliusAuth?.requireAuth?.()) return;
    await window.CorneliusAuth.ensureRoleLoaded?.();

    // admin e professional podem acessar
    if (!window.CorneliusAuth.requireAnyRole(['admin', 'professional'])) return;

    // binds do modal
    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = docKeyEl.value;
      await generatePdfFromModal(key);
    });

    // binds dos botões da grade
    document.querySelectorAll('button[data-doc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const doc = btn.getAttribute('data-doc');
        const action = btn.getAttribute('data-action') || 'download';

        if (action === 'download') return downloadTemplate(doc);
        if (action === 'fill') return openModal(doc);
      });
    });

    // opcional: render inicial no canvas (mantém comportamento anterior)
    if (CALIBRATE_ENABLED && calCanvas && calOut) {
      startCalibration('relatorio').catch(() => {});
    }
  });

})();
