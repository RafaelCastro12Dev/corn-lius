/**
 * Cornélius - Feriados Nacionais do Brasil
 * Cálculo automático de feriados móveis e fixos
 */

(function () {
  "use strict";

  // Calcula Páscoa (Meeus/Jones/Butcher) - ano gregoriano
  function easterUTC(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    // Retornar em formato YYYY-MM-DD
    const pad = (n) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // Adicionar/subtrair dias de uma data
  function addDays(dateStr, days) {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Calcular feriados de um ano
  function getHolidays(year) {
    const easter = easterUTC(year);

    const holidays = [
      // Feriados fixos
      { date: `${year}-01-01`, name: "Ano Novo" },
      { date: `${year}-04-21`, name: "Tiradentes" },
      { date: `${year}-05-01`, name: "Dia do Trabalho" },
      { date: `${year}-09-07`, name: "Independência do Brasil" },
      { date: `${year}-10-12`, name: "Nossa Senhora Aparecida" },
      { date: `${year}-11-02`, name: "Finados" },
      { date: `${year}-11-15`, name: "Proclamação da República" },
      { date: `${year}-11-20`, name: "Dia da Consciência Negra" },
      { date: `${year}-12-25`, name: "Natal" },

      // Feriados móveis (baseados na Páscoa)
      { date: addDays(easter, -47), name: "Carnaval" },
      { date: addDays(easter, -46), name: "Carnaval" },
      { date: addDays(easter, -2), name: "Sexta-feira Santa" },
      { date: easter, name: "Páscoa" },
      { date: addDays(easter, 60), name: "Corpus Christi" }
    ];

    return holidays;
  }

  // Verificar se uma data é feriado
  function isHoliday(dateStr) {
    const year = parseInt(dateStr.substring(0, 4));
    const holidays = getHolidays(year);
    return holidays.some((h) => h.date === dateStr);
  }

  // Exportar para uso global
  window.CorneliusFeriados = {
    getHolidays,
    isHoliday,
    easterUTC
  };

  console.log("✅ Módulo de feriados carregado!");
})();
