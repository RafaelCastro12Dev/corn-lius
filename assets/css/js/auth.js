// assets/js/auth.js
(function () {
  "use strict";

  // =========================
  // Helpers: sessão Supabase (síncrono via localStorage)
  // =========================
  function getSupabaseRef() {
    try {
      const url = new URL(window.supabaseClient?.supabaseUrl || "");
      return url.hostname.split(".")[0];
    } catch {
      return null;
    }
  }

  function getAuthStorageKey() {
    const ref = getSupabaseRef();
    if (!ref) return null;
    return `sb-${ref}-auth-token`;
  }

  function getStoredSession() {
    try {
      const key = getAuthStorageKey();
      if (!key) return null;

      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed?.session || parsed;
      return session || null;
    } catch {
      return null;
    }
  }

  function hasValidSession() {
    const s = getStoredSession();
    if (!s) return false;

    const expiresAt = s.expires_at || s.expiresAt || null;
    if (!expiresAt) return true;

    const nowSec = Math.floor(Date.now() / 1000);
    return expiresAt > nowSec + 10;
  }

  function getUserIdFromStoredSession() {
    const s = getStoredSession();
    return s?.user?.id || null;
  }

  function getEmailFromStoredSession() {
    const s = getStoredSession();
    return (s?.user?.email || "").toString().trim().toLowerCase() || null;
  }

  // =========================
  // Role handling
  // =========================
  const ROLE_KEY = "cornelius_role";

  function getRole() {
    const w = (window.CorneliusRole || "").toString().trim().toLowerCase();
    if (w === "admin" || w === "professional") return w;

    const ls = (localStorage.getItem(ROLE_KEY) || "").toString().trim().toLowerCase();
    if (ls === "admin" || ls === "professional") return ls;

    return null;
  }

  function setRole(role) {
    const r = (role || "").toString().trim().toLowerCase();
    if (r !== "admin" && r !== "professional") return;

    window.CorneliusRole = r;
    localStorage.setItem(ROLE_KEY, r);
  }

  // ✅ Fallback por email (whitelist) — mantém seu cenário atual
  function roleFromEmail(email) {
    const e = (email || "").toString().trim().toLowerCase();
    const admins = new Set([
      "clinicacornelius@gmail.com",
      "ana_paulac.97@outlook.com",
    ]);
    return admins.has(e) ? "admin" : "professional";
  }

  /**
   * Carrega role com prioridade:
   * 1) user_roles (se existir e tiver registro)
   * 2) fallback email whitelist
   *
   * @param {Object} opts
   * @param {boolean} opts.force - se true, ignora cache e recalcula (IMPORTANTE no login)
   */
  async function fetchAndSetRole(opts) {
    const force = !!opts?.force;

    if (!window.supabaseClient) throw new Error("Supabase não carregou");

    const userId = getUserIdFromStoredSession();
    if (!userId) throw new Error("Sessão sem user_id");

    const sessionEmail = getEmailFromStoredSession();

    // ✅ Se não for forçado, pode usar cache (rápido)
    if (!force) {
      const cached = getRole();
      if (cached) return cached;
    }

    // 1) tenta tabela user_roles (se existir)
    try {
      const { data, error } = await window.supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      // Se der erro de permissão / tabela não existir, cai no fallback
      if (error) {
        console.warn("⚠️ user_roles falhou, usando fallback por email:", error);
        const fallbackRole = roleFromEmail(sessionEmail);
        setRole(fallbackRole);
        return fallbackRole;
      }

      // Se existe role na tabela, respeita
      if (data?.role) {
        const r = data.role.toString().trim().toLowerCase();
        const finalRole = (r === "admin" || r === "professional") ? r : "professional";
        setRole(finalRole);
        return finalRole;
      }

      // Sem registro -> fallback por email
      const fallbackRole = roleFromEmail(sessionEmail);
      setRole(fallbackRole);
      return fallbackRole;
    } catch (e) {
      console.warn("⚠️ Erro inesperado em user_roles, usando fallback por email:", e);
      const fallbackRole = roleFromEmail(sessionEmail);
      setRole(fallbackRole);
      return fallbackRole;
    }
  }

  // =========================
  // Redirect helpers
  // =========================
  function redirectToLogin() {
    const next = encodeURIComponent(
      location.pathname.split("/").pop() + location.search
    );
    location.href = `login.html?next=${next}`;
  }

  function redirectToAgenda() {
    location.href = "agenda.html";
  }

  // =========================
  // UI: esconder itens admin-only
  // =========================
  function applyRoleUI() {
    const role = getRole();
    if (role !== "professional") return;

    document.querySelectorAll("[data-admin-only]").forEach(el => {
      el.style.display = "none";
    });
  }

  // =========================
  // Auth API
  // =========================
  async function login(email, password) {
    if (!window.supabaseClient) throw new Error("Supabase não carregou");

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // ✅ IMPORTANTE: após login, FORÇA recalcular role (ignora cache velho)
    await fetchAndSetRole({ force: true });

    return !!data?.session;
  }

  function requireAuth() {
    // Síncrono para manter o padrão do projeto
    if (hasValidSession()) return true;
    redirectToLogin();
    return false;
  }

  async function ensureRoleLoaded() {
    if (!hasValidSession()) return null;

    const cached = getRole();
    if (cached) return cached;

    try {
      return await fetchAndSetRole({ force: false });
    } catch (e) {
      console.warn("⚠️ Não foi possível carregar role:", e);
      return null;
    }
  }

  function requireRole(required) {
    if (!requireAuth()) return false;

    const role = getRole();
    if (!role) {
      // Se role não carregou, comportamento seguro: manda para agenda
      redirectToAgenda();
      return false;
    }

    if (role !== required) {
      redirectToAgenda();
      return false;
    }

    return true;
  }

  function requireAnyRole(roles) {
    if (!requireAuth()) return false;

    const role = getRole();
    if (!role) {
      redirectToAgenda();
      return false;
    }

    if (!roles.includes(role)) {
      redirectToAgenda();
      return false;
    }

    return true;
  }

  async function logout() {
    try {
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (e) {
      console.warn("⚠️ signOut falhou:", e);
    } finally {
      localStorage.removeItem(ROLE_KEY);
      window.CorneliusRole = null;
      location.href = "login.html";
    }
  }

  function isAuthed() {
    return hasValidSession();
  }

  // =========================
  // Boot: tenta carregar role e aplicar UI
  // =========================
  document.addEventListener("DOMContentLoaded", function () {
    // 0) Conecta o botão global "Sair" (se existir na página)
    // Obs: manter pelo ID #btnLogout para funcionar em todas as telas sem duplicar JS.
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", function (e) {
        e.preventDefault();
        // Usa o logout oficial (limpa role + redireciona)
        logout();
      });
    }

    // 1) Aplica UI com o que já existir no cache (rápido)
    applyRoleUI();

    // 2) Garante que role será carregado (se houver sessão)
    ensureRoleLoaded().then(() => {
      // Reaplica UI depois do carregamento do role (caso ainda não estivesse)
      applyRoleUI();
    });
  });

  window.CorneliusAuth = {
    login,
    logout,
    isAuthed,
    requireAuth,
    requireRole,
    requireAnyRole,
    ensureRoleLoaded
  };
})();
