// assets/js/auth.js
(function () {
  "use strict";

  // =========================
  // CONFIG: Conta única (Opção A)
  // =========================
  const CLINIC_EMAIL = "rafael.araujo12@icloud.com"; // <-- TROQUE para o email do Auth que você criou

  // =========================
  // Helpers: detectar sessão Supabase (síncrono)
  // =========================
  function getSupabaseRef() {
    try {
      const url = new URL(window.supabaseClient?.supabaseUrl || "");
      // https://<ref>.supabase.co
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
      // parsed pode ser { currentSession: {...} } dependendo da versão
      const session = parsed?.currentSession || parsed?.session || parsed;
      return session || null;
    } catch {
      return null;
    }
  }

  function hasValidSession() {
    const s = getStoredSession();
    if (!s) return false;

    // Checa expiração quando existir
    // exp pode vir em segundos (jwt exp) ou expires_at (segundos)
    const expiresAt = s.expires_at || s.expiresAt || null;
    if (!expiresAt) return true; // se não vier, consideramos válido e o Supabase corrige internamente

    const nowSec = Math.floor(Date.now() / 1000);
    return expiresAt > nowSec + 10; // margem de 10s
  }

  // =========================
  // Auth API
  // =========================
  async function login(_usernameIgnored, password) {
    if (!window.supabaseClient) throw new Error("Supabase não carregou");

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: CLINIC_EMAIL,
      password: password
    });

    if (error) throw error;
    return !!data?.session;
  }

  function requireAuth() {
    // Síncrono para não quebrar seu padrão atual
    if (hasValidSession()) return true;

    const next = encodeURIComponent(
      location.pathname.split("/").pop() + location.search
    );

    location.href = `login.html?next=${next}`;
    return false;
  }

  async function logout() {
    try {
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
    } catch (e) {
      console.warn("⚠️ signOut falhou:", e);
    } finally {
      location.href = "login.html";
    }
  }

  function isAuthed() {
    return hasValidSession();
  }

  window.CorneliusAuth = {
    login,
    logout,
    isAuthed,
    requireAuth
  };
})();
