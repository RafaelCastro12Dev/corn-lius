// assets/js/login.js
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const form = $("loginForm");
  const userEl = $("loginUser");
  const passEl = $("loginPass");
  const btnClear = $("btnClear");
  const errBox = $("loginError");
  const eyeBtn = $("togglePass");

  const sb = window.supabaseClient;

  // Se você quiser manter "cornelius" como atalho para o admin,
  // coloque aqui o email do admin:
  const LEGACY_USERNAME = "cornelius";
  const ADMIN_EMAIL = "rafael.araujo12@icloud.com"; // ajuste se mudar

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

  function normalizeLogin(uRaw) {
    const u = (uRaw || "").trim();

    // Atalho opcional: "cornelius" vira o email do admin
    if (u.toLowerCase() === LEGACY_USERNAME) return ADMIN_EMAIL;

    return u;
  }

  async function getRoleForUser(user) {
    // 1) tenta ler role do banco (user_roles)
    try {
      const { data, error } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!error && data?.role) return data.role;
    } catch (_) {
      // ignora, cai no fallback
    }

    // 2) fallback seguro (caso role não exista por algum motivo):
    // se for o email do admin, assume admin; senão professional
    if ((user.email || "").toLowerCase() === (ADMIN_EMAIL || "").toLowerCase()) return "admin";
    return "professional";
  }

  function persistAuthContext(user, role) {
    // o front pode usar isso para esconder menus/páginas
    localStorage.setItem("cornelius_role", role);
    localStorage.setItem("cornelius_email", user.email || "");
    localStorage.setItem("cornelius_uid", user.id || "");
  }

  function redirectByRole(role) {
    if (role === "professional") {
      // médica: só agenda (visual)
      location.href = "agenda.html";
      return;
    }
    // admin: segue fluxo normal
    location.href = getNext();
  }

  async function ensureClient() {
    if (!sb) {
      showError("Erro: Supabase não carregou. Verifique a ordem dos scripts.");
      return false;
    }
    return true;
  }

  async function doLogin() {
    clearError();

    if (!(await ensureClient())) return;

    const rawUser = (userEl.value || "").trim();
    const email = normalizeLogin(rawUser);
    const password = (passEl.value || "").trim();

    if (!email || !password) {
      showError("Preencha usuário (email) e senha.");
      return;
    }

    // valida formato mínimo (evita erros bobos)
    if (!email.includes("@")) {
      showError("Digite um email válido (ex: dra1@teste.com).");
      return;
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        // 400 invalid login credentials cai aqui
        showError("Usuário ou senha inválidos.");
        return;
      }

      const user = data?.user;
      if (!user) {
        showError("Falha ao obter usuário logado.");
        return;
      }

      const role = await getRoleForUser(user);
      persistAuthContext(user, role);
      redirectByRole(role);
    } catch (e) {
      console.error(e);
      showError("Erro ao entrar. Tente novamente.");
    }
  }

  // Submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin();
  });

  // Limpar
  btnClear.addEventListener("click", () => {
    userEl.value = "";
    passEl.value = "";
    clearError();
    userEl.focus();
  });

  // Olhinho
  if (eyeBtn) {
    eyeBtn.addEventListener("click", () => {
      passEl.type = passEl.type === "password" ? "text" : "password";
    });
  }

  // Se já estiver logado, pula (mas respeita role)
  (async () => {
    if (!(await ensureClient())) return;

    const { data } = await sb.auth.getSession();
    const session = data?.session;

    if (!session?.user) {
      userEl.focus();
      return;
    }

    const role = await getRoleForUser(session.user);
    persistAuthContext(session.user, role);
    redirectByRole(role);
  })();
})();
