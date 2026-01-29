/* global CorneliusAuth */
(function () {
  'use strict';

  const TEMPLATES = {
    atestado:   { path: 'assets/pdfs/atestado.pdf',   filename: 'atestado.pdf' },
    declaracao: { path: 'assets/pdfs/declaracao.pdf', filename: 'declaracao.pdf' },
    relatorio:  { path: 'assets/pdfs/relatorio.pdf',  filename: 'relatorio.pdf' },
  };

  const msgEl = document.getElementById('msg');

  function showMsg(text, kind) {
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

  async function downloadTemplate(docKey) {
    clearMsg();

    const tpl = TEMPLATES[docKey];
    if (!tpl) {
      showMsg('Tipo de documento inválido.', 'error');
      return;
    }

    setButtonsEnabled(false);
    try {
      const resp = await fetch(tpl.path, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Falha ao carregar template (${resp.status})`);
      const bytes = await resp.arrayBuffer();

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
      showMsg(
        'Não consegui baixar o PDF modelo. Verifique se os arquivos estão em assets/pdfs/ e se o site está rodando via http(s), não via file://.',
        'error'
      );
    } finally {
      setButtonsEnabled(true);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // 1) precisa estar logado
    if (!window.CorneliusAuth?.requireAuth?.()) return;

    // 2) evita redirect por role null (auth.js manda para agenda quando role não carregou)
    await window.CorneliusAuth.ensureRoleLoaded?.();

    // 3) permite admin e professional
    if (!window.CorneliusAuth.requireAnyRole(['admin', 'professional'])) return;

    // 4) eventos
    document.querySelectorAll('button[data-doc]').forEach(btn => {
      btn.addEventListener('click', () => downloadTemplate(btn.getAttribute('data-doc')));
    });
  });
})();
