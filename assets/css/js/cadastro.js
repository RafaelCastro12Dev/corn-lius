(function () {
  "use strict";

  const C = window.Cornelius;
  C.setActiveNav();

  const form = document.getElementById("form");
  const name = document.getElementById("name");
  const cpf = document.getElementById("cpf");
  const email = document.getElementById("email");
  const phone = document.getElementById("phone");
  const address = document.getElementById("address");
  const color = document.getElementById("color");
  const btnRandom = document.getElementById("btnRandom");

  btnRandom.addEventListener("click", () => {
    color.value = C.pickColor();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const data = C.load();

      const patient = C.addPatient(data, {
        name: name.value,
        cpf: cpf.value,
        email: email.value,
        phone: phone.value,
        address: address.value,
        color: color.value
      });

      C.save(data);
      C.toast("Paciente cadastrado", patient.name);

      // redirecionar para ficha do paciente
      window.location.href = `paciente.html?id=${encodeURIComponent(patient.id)}`;
    } catch (err) {
      C.toast("Não foi possível salvar", err.message || String(err));
    }
  });
})();
