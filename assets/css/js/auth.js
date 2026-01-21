// assets/css/js/auth.js
(function () {
  "use strict";

  const SESSION_KEY = "cornelius_auth";
  const SESSION_TTL = 60 * 60 * 1000; // 1 hora

  function now() {
    return Date.now();
  }

  function setAuthed() {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ at: now() }));
  }

  function clearAuth() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isAuthed() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      return s && s.at && now() - s.at < SESSION_TTL;
    } catch {
      return false;
    }
  }

  async function login(username, password) {
    if (!window.supabaseClient) {
      throw new Error("Supabase não carregou");
    }

    const { data, error } = await window.supabaseClient.rpc(
      "check_app_login",
      {
        p_username: username,
        p_password: password
      }
    );

    if (error) throw error;

    if (data === true) {
      setAuthed();
      return true;
    }

    return false;
  }

  function requireAuth() {
    if (isAuthed()) return true;

    const next = encodeURIComponent(
      location.pathname.split("/").pop() + location.search
    );

    location.href = `login.html?next=${next}`;
    return false;
  }

  function logout() {
    clearAuth();
    location.href = "login.html";
  }

  window.CorneliusAuth = {
    login,
    logout,
    isAuthed,
    requireAuth,
    setAuthed,
    clearAuth
  };
})();
