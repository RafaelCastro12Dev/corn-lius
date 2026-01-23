/**
 * CornéliusRealtime — FINAL (simples, estável e pronto para produção)
 *
 * Objetivos:
 * - Manter a simplicidade (1 canal por tabela, sem retry manual agressivo)
 * - Evitar spam de console
 * - Emitir eventos internos por tabela: "<table>:change"
 * - Emitir evento de consistência quando reconectar: "realtime:reconnected"
 * - Reagir a TOKEN_REFRESHED / SIGNED_IN / SIGNED_OUT
 *
 * API compatível (não quebra o que vocês já têm):
 *   window.CorneliusRealtime = { on, off, start, stop, isRunning }
 */

(function () {
  "use strict";

  // Evita double-init
  if (window.CorneliusRealtime?.isRunning?.()) {
    return;
  }

  const sb = window.supabaseClient;
  if (!sb) {
    console.error("❌ CorneliusRealtime: supabaseClient não encontrado.");
    window.CorneliusRealtime = {
      on() {},
      off() {},
      start() {},
      stop() {},
      isRunning() { return false; },
    };
    return;
  }

  const TABLES = [
    "patients",
    "professionals",
    "appointments",
    "clinical_notes",
    "payments",
    "attestations",
  ];

  const DEFAULT_DEBOUNCE_MS = 650;

  // =========================
  // Event bus interno
  // =========================
  const handlers = new Map(); // eventName -> Set(fn)
  const debounceTimers = new Map(); // eventName -> timeoutId

  function on(eventName, fn) {
    if (!eventName || typeof fn !== "function") return;
    if (!handlers.has(eventName)) handlers.set(eventName, new Set());
    handlers.get(eventName).add(fn);
  }

  function off(eventName, fn) {
    if (!eventName || typeof fn !== "function") return;
    handlers.get(eventName)?.delete(fn);
  }

  function emit(eventName, payload) {
    const set = handlers.get(eventName);
    if (!set || set.size === 0) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`❌ CorneliusRealtime handler error (${eventName}):`, e);
      }
    }
  }

  function emitDebounced(eventName, payload, ms = DEFAULT_DEBOUNCE_MS) {
    if (debounceTimers.has(eventName)) clearTimeout(debounceTimers.get(eventName));
    const t = setTimeout(() => {
      debounceTimers.delete(eventName);
      emit(eventName, payload);
    }, ms);
    debounceTimers.set(eventName, t);
  }

  // =========================
  // Realtime core
  // =========================
  let running = false;

  const channelsByTable = new Map(); // table -> channel
  const subscribedOnce = new Set();  // tabelas que já deram SUBSCRIBED ao menos 1 vez

  // Logs: somente o essencial (1 vez por tabela e avisos raros)
  const warnThrottle = new Map(); // key -> lastTs
  function warnOncePer1s(key, msg) {
    const now = Date.now();
    const last = warnThrottle.get(key) || 0;
    if (now - last < 1000) return;
    warnThrottle.set(key, now);
    console.warn(msg);
  }

  async function removeChannel(table) {
    const ch = channelsByTable.get(table);
    if (!ch) return;
    channelsByTable.delete(table);
    try {
      await sb.removeChannel(ch);
    } catch (_) {}
  }

  function createChannel(table) {
    // Se já existe, não recria
    if (channelsByTable.has(table)) return;

    const ch = sb
      .channel(`rt:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        // evento específico da tabela
        emitDebounced(`${table}:change`, payload);
        // evento genérico (se você quiser usar em algum lugar)
        emitDebounced("db:change", { table, payload }, 250);
      })
      .subscribe((status, err) => {
        if (!running) return;

        if (err) {
          warnOncePer1s(`err:${table}`, `⚠️ Realtime erro (${table}): ${err?.message || err}`);
          return;
        }

        if (status === "SUBSCRIBED") {
          // Primeira vez: loga apenas uma vez
          if (!subscribedOnce.has(table)) {
            subscribedOnce.add(table);
            console.log(`✅ Realtime conectado: ${table}`);
          } else {
            // Já estava conectado antes => isso é reconexão => força consistência
            emitDebounced("realtime:reconnected", { table, status }, 200);
          }
          return;
        }

        // Esses estados são normais em WebSocket (não é “quebra”), mas avisamos de forma contida
        if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
          warnOncePer1s(`st:${table}:${status}`, `⚠️ Realtime (${table}): ${status}`);
          // Quando reconectar, o SUBSCRIBED acima dispara "realtime:reconnected"
        }
      });

    channelsByTable.set(table, ch);
  }

  function start() {
    if (running) return;

    running = true;

    // Cria 1 canal por tabela
    for (const table of TABLES) {
      createChannel(table);
    }
  }

  async function stop() {
    if (!running) return;
    running = false;

    // Debounce timers
    for (const t of debounceTimers.values()) clearTimeout(t);
    debounceTimers.clear();

    // Remove canais
    const tables = Array.from(channelsByTable.keys());
    for (const table of tables) {
      await removeChannel(table);
    }
    channelsByTable.clear();
  }

  function isRunning() {
    return running;
  }

  // =========================
  // Auth / Consistência
  // =========================
  try {
    sb.auth.onAuthStateChange(async (event) => {
      // SIGNED_IN: garante start
      if (event === "SIGNED_IN") {
        if (!running) start();
        // após login, força refresh de consistência (uma vez)
        emitDebounced("realtime:reconnected", { all: true, reason: "SIGNED_IN" }, 300);
        return;
      }

      // TOKEN_REFRESHED: força consistência (o Supabase geralmente reconecta sozinho)
      if (event === "TOKEN_REFRESHED") {
        emitDebounced("realtime:reconnected", { all: true, reason: "TOKEN_REFRESHED" }, 300);
        return;
      }

      // SIGNED_OUT: para tudo (limpo)
      if (event === "SIGNED_OUT") {
        await stop();
      }
    });
  } catch (e) {
    // não quebra app
    console.warn("⚠️ CorneliusRealtime: falha ao registrar onAuthStateChange:", e);
  }

  // Ao voltar online / voltar para a aba: dispara consistência
  window.addEventListener("online", () => {
    if (!running) return;
    emitDebounced("realtime:reconnected", { all: true, reason: "ONLINE" }, 500);
  });

  document.addEventListener("visibilitychange", () => {
    if (!running) return;
    if (document.visibilityState === "visible") {
      emitDebounced("realtime:reconnected", { all: true, reason: "VISIBLE" }, 500);
    }
  });

  // =========================
  // Export global
  // =========================
  window.CorneliusRealtime = { on, off, start, stop, isRunning };

  // Auto-start (seguro: só escuta e emite eventos)
  start();

})();
