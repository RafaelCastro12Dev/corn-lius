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
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Abr
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  }

  function addDaysUTC(d, days) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + days);
    return x;
  }

  function ymdUTC(d) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Feriados nacionais (fixos + principais móveis)
  function feriadosNacionaisBR(year) {
    const easter = easterUTC(year);

    // móveis
    const carnavalTer = addDaysUTC(easter, -47);
    const sextaSanta = addDaysUTC(easter, -2);
    const corpusChristi = addDaysUTC(easter, 60);

    return [
      // fixos
      { date: `${year}-01-01`, name: "Confraternização Universal" },
      { date: `${year}-04-21`, name: "Tiradentes" },
      { date: `${year}-05-01`, name: "Dia do Trabalho" },
      { date: `${year}-09-07`, name: "Independência do Brasil" },
      { date: `${year}-10-12`, name: "Nossa Senhora Aparecida" },
      { date: `${year}-11-02`, name: "Finados" },
      { date: `${year}-11-15`, name: "Proclamação da República" },
      { date: `${year}-11-20`, name: "Consciência Negra" }, // amplamente adotado (nacional a partir de 2023)
      { date: `${year}-12-25`, name: "Natal" },

      // móveis (mais usados na prática)
      { date: ymdUTC(carnavalTer), name: "Carnaval" },
      { date: ymdUTC(sextaSanta), name: "Sexta-feira Santa" },
      { date: ymdUTC(corpusChristi), name: "Corpus Christi" }
    ];
  }

  window.CorneliusFeriados = {
    feriadosNacionaisBR
  };
})();
