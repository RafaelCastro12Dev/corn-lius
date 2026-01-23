// assets/js/login.js
(function () {
  "use strict";

  const FIXED_USER = "cornelius";

  const $ = (id) => document.getElementById(id);

  const form = $("loginForm");
  const userEl = $("loginUser");
  const passEl = $("loginPass");
  const btnClear = $("btnClear");
  const errBox = $("loginError");
  const eyeBtn = $("togglePass");

  function showError(msg) {
    errBox.textContent = msg;
    errBox.style.display = "block";
  }

  function clearError() {
    errBox.textContent = "";
    errBox.style.display = "none";
  }

  function getNext() {
    return new URLSearchParams(location.search).get("next") || "index.html";
  }

  async function doLogin() {
    clearError();

    const u = (userEl.value || "").trim();
    const p = (passEl.value || "").trim();

    if (!u || !p) {
      showError("Preencha usuário e senha.");
      return;
    }

    // Mantém UX atual: usuário fixo
    if (u !== FIXED_USER) {
      showError("Usuário inválido.");
      return;
    }

    try {
      const ok = await window.CorneliusAuth.login(u, p);
      if (!ok) {
        showError("Senha incorreta.");
        return;
      }

      location.href = getNext();
    } catch (e) {
      console.error(e);
      showError("Erro ao entrar. Verifique a senha.");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin();
  });

  btnClear.addEventListener("click", () => {
    userEl.value = FIXED_USER;
    passEl.value = "";
    clearError();
    passEl.focus();
  });

  if (eyeBtn) {
    eyeBtn.addEventListener("click", () => {
      passEl.type = passEl.type === "password" ? "text" : "password";
    });
  }

  // Se já estiver logado, pula
  if (window.CorneliusAuth.isAuthed()) {
    location.href = getNext();
    return;
  }

  userEl.value = FIXED_USER;
  passEl.focus();
})();
