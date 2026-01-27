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

  async function fetchAndSetRole() {
    if (!window.supabaseClient) throw new Error("Supabase não carregou");

    const userId = getUserIdFromStoredSession();
    if (!userId) throw new Error("Sessão sem user_id");

    const cached = getRole();
    if (cached) return cached;

    const { data, error } = await window.supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    const role = (data?.role || "professional").toString().trim().toLowerCase(); // default seguro
    setRole(role);
    return role;
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

    // Após login, carregar role e salvar
    await fetchAndSetRole();

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
      return await fetchAndSetRole();
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
