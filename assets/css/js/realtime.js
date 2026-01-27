/**
 * CorneliusRealtime - Estável (sem flood / sem retry agressivo)
 *
 * Objetivo:
 * - Um canal por tabela (rt:<table>)
 * - Sem “rebuild loop” em CLOSED/CHANNEL_ERROR (Supabase já reconecta)
 * - Logs controlados (1x por tabela em caso de falha persistente)
 * - Event bus: RT.on("appointments:change", fn)
 * - Exporta _debug() para inspeção
 */

(function () {
  "use strict";

  // =========================================================
  // Singleton guard (evita init duplo se script for carregado 2x)
  // =========================================================
  if (window.CorneliusRealtime && window.CorneliusRealtime.__singleton === true) {
    return;
  }

  const sb = window.supabaseClient;
  if (!sb) {
    console.warn("⚠️ CorneliusRealtime: supabaseClient não encontrado.");
    window.CorneliusRealtime = {
      __singleton: true,
      on() {},
      off() {},
      start() {},
      stop() {},
      isRunning() { return false; },
      _debug() { return { running: false, reason: "no_supabaseClient" }; }
    };
    return;
  }

  // =========================================================
  // Tabelas por role (mantenha o mínimo necessário)
  // =========================================================
  const TABLES_BY_ROLE = {
    admin: [
      "patients",
      "professionals",
      "appointments",
      "clinical_notes",
      "payments",
      "attestations",
    ],
    professional: [
      "appointments"
    ]
  };

  // =========================================================
  // Event bus
  // =========================================================
  const listeners = new Map(); // event -> Set(fn)

  function on(evt, fn) {
    if (!evt || typeof fn !== "function") return;
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
  }

  function off(evt, fn) {
    const set = listeners.get(evt);
    if (!set) return;
    set.delete(fn);
  }

  function emit(evt, payload) {
    const set = listeners.get(evt);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.warn("⚠️ RT listener error:", e); }
    }
  }

  // Debounce por evento (evita “chuva” de refresh)
  const debounceTimers = new Map();
  function emitDebounced(evt, payload, delay = 200) {
    clearTimeout(debounceTimers.get(evt));
    const t = setTimeout(() => emit(evt, payload), delay);
    debounceTimers.set(evt, t);
  }

  // =========================================================
  // Estado
  // =========================================================
  let running = false;
  let starting = false;
  let currentRole = null;
  let currentTables = [];

  // table -> channel
  const channels = new Map();

  // table -> status ("SUBSCRIBED", "CLOSED", "CHANNEL_ERROR", ...)
  const tableStatus = new Map();

  // rate-limit logs de erro por tabela
  const lastErrorLogAt = new Map();
  const ERROR_LOG_COOLDOWN_MS = 60_000; // 1 min

  function getRole() {
    const r = (localStorage.getItem("cornelius_role") || "").trim().toLowerCase();
    return r === "professional" ? "professional" : "admin";
  }

  async function hasSession() {
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) return false;
      return !!data?.session;
    } catch {
      return false;
    }
  }

  function isRunning() {
    return running;
  }

  function safeLogErrorOncePerMinute(table, status) {
    const now = Date.now();
    const last = lastErrorLogAt.get(table) || 0;
    if (now - last < ERROR_LOG_COOLDOWN_MS) return;
    lastErrorLogAt.set(table, now);
    console.warn(`⚠️ Realtime: status ${status} (${table}). O Supabase irá reconectar automaticamente.`);
  }

  // =========================================================
  // Canal por tabela (sem rebuild loop)
  // =========================================================
  function subscribeTable(table) {
    if (!running) return;
    if (!table) return;

    // já existe canal? não recria
    if (channels.has(table)) return;

    const ch = sb
      .channel(`rt:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          emitDebounced(`${table}:change`, payload);
          emitDebounced("db:change", { table, payload });
        }
      )
      .subscribe((status) => {
        tableStatus.set(table, status);

        if (!running) return;

        if (status === "SUBSCRIBED") {
          console.log(`✅ Realtime conectado: ${table}`);
          emit("realtime:ready", { table });
          return;
        }

        // Não fazemos “rebuild” em loop aqui.
        // Apenas avisamos (com rate-limit) e deixamos o client reconectar.
        if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
          safeLogErrorOncePerMinute(table, status);
          emit("realtime:status", { table, status });
        }
      });

    channels.set(table, ch);
  }

  async function removeTable(table) {
    const ch = channels.get(table);
    if (!ch) return;
    channels.delete(table);
    tableStatus.delete(table);
    try { await sb.removeChannel(ch); } catch (_) {}
  }

  async function applyRoleTables(role) {
    const tables = TABLES_BY_ROLE[role] || TABLES_BY_ROLE.admin;

    // Remove canais de tabelas que não devem mais existir
    for (const [table] of channels) {
      if (!tables.includes(table)) {
        await removeTable(table);
      }
    }

    // Assina tabelas necessárias
    for (const table of tables) {
      subscribeTable(table);
    }

    currentRole = role;
    currentTables = [...tables];
  }

  // =========================================================
  // Start/Stop
  // =========================================================
  async function start() {
    if (running || starting) return;
    starting = true;

    const ok = await hasSession();
    if (!ok) {
      starting = false;
      running = false;
      console.warn("⚠️ CorneliusRealtime: sem sessão. (Logue para ativar realtime)");
      return;
    }

    running = true;
    starting = false;

    const role = getRole();
    console.log(`🛰️ CorneliusRealtime iniciando (role=${role})...`);
    await applyRoleTables(role);

    // Se o role mudar em runtime, reaplica tabelas
    // (ex.: admin -> professional após relogin)
    const roleWatch = setInterval(() => {
      if (!running) { clearInterval(roleWatch); return; }
      const r = getRole();
      if (r !== currentRole) {
        applyRoleTables(r);
      }
    }, 2000);
  }

  async function stop() {
    running = false;
    starting = false;

    for (const [table] of channels) {
      await removeTable(table);
    }

    emit("realtime:stopped", {});
  }

  // =========================================================
  // _debug() para você inspecionar pelo console
  // =========================================================
  function _debug() {
    const ch = {};
    for (const [table] of channels) {
      ch[table] = {
        status: tableStatus.get(table) || "UNKNOWN"
      };
    }
    return {
      running,
      starting,
      role: currentRole,
      tables: currentTables,
      channels: ch
    };
  }

  // =========================================================
  // Export global
  // =========================================================
  window.CorneliusRealtime = {
    __singleton: true,
    on,
    off,
    start,
    stop,
    isRunning,
    _debug
  };

  // Auto-start (como você já usa)
  start();

})();
