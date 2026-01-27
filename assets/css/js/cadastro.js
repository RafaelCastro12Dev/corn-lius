/**
 * Cornélius - Cadastro de Pacientes
 * Versão Supabase (async/await) - COM TRATAMENTO DE ERROS
 */

(function () {
  "use strict";

if (window.CorneliusAuth && !window.CorneliusAuth.requireRole("admin")) return;



  const C = window.Cornelius;
  C.setActiveNav();

  const btnRandom = document.getElementById("btnRandom");
  const form = document.getElementById("formPatient");

  // Gerar cor aleatória
  if (btnRandom) {
    btnRandom.addEventListener("click", () => {
      document.getElementById("color").value = C.pickColor();
    });
  }

  // Submeter formulário
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const patient = {
          name: document.getElementById("name").value.trim(),
          cpf: document.getElementById("cpf").value.trim(),
          email: document.getElementById("email").value.trim(),
          phone: document.getElementById("phone").value.trim(),
          address: document.getElementById("address").value.trim(),
          color: document.getElementById("color").value || C.pickColor()
        };

        // Validação básica
        if (!patient.name) {
          C.toast("⚠️ Nome é obrigatório");
          return;
        }

        console.log("📝 Tentando cadastrar paciente:", patient);

        // Adicionar paciente no Supabase
        const newPatient = await C.addPatient(patient);

        console.log("✅ Paciente cadastrado:", newPatient);

        if (newPatient && newPatient.id) {
          C.toast(`✅ Paciente ${newPatient.name} cadastrado!`);
          
          // Redirecionar para a ficha do paciente
          setTimeout(() => {
            window.location.href = `paciente.html?id=${encodeURIComponent(newPatient.id)}`;
          }, 1000);
        } else {
          throw new Error("ID do paciente não retornado");
        }
      } catch (err) {
        console.error("❌ Erro detalhado ao cadastrar:", err);
        
        // Mostrar mensagem de erro detalhada
        let errorMessage = "Erro ao salvar paciente";
        
        if (err.message) {
          errorMessage += ": " + err.message;
        }
        
        if (err.hint) {
          errorMessage += " (Dica: " + err.hint + ")";
        }
        
        C.toast("❌ " + errorMessage);
        
        // Log completo do erro
        console.error("Erro completo:", {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
          stack: err.stack
        });
      }
    });
  }
})();
