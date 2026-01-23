/**
 * Cornélius - API Supabase
 * 
 * Camada de abstração para operações com o banco de dados Supabase.
 * Mantém a mesma interface do window.Cornelius original para compatibilidade.
 * 
 * IMPORTANTE: Todas as funções retornam Promises (async/await).
 */

(function () {
  "use strict";

  const sb = window.SupabaseClient;

  // ============================================================================
  // UTILITÁRIOS (mantidos do app.js original)
  // ============================================================================

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

 function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();

  // fallback RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


  function cleanCPF(cpf) {
    if (!cpf) return "";
    return cpf.replace(/\D/g, "");
  }

  function formatCPF(cpf) {
    const c = cleanCPF(cpf);
    if (c.length !== 11) return c;
    return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  function normalize(str) {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function toast(message) {
    const container = document.getElementById("toast-container") || 
      (() => {
        const c = document.createElement("div");
        c.id = "toast-container";
        c.className = "toast-container";
        document.body.appendChild(c);
        return c;
      })();

    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    container.appendChild(t);

    requestAnimationFrame(() => t.classList.add("show"));

    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  function setActiveNav() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf("/") + 1) || "index.html";
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === filename) {
        link.classList.add("active");
      }
    });
  }

  function ys(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function ymdLocal(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d - offset);
    return local.toISOString().slice(0, 10);
  }

  function hmLocal(dt) {
    if (!dt) return "";
    const d = new Date(dt);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isoFromYmdHm(ymd, hm) {
    return `${ymd}T${hm}:00`;
  }

  function isoToYmd(iso) {
    if (!iso) return "";
    return iso.substring(0, 10);
  }

  function isoToHm(iso) {
    if (!iso) return "";
    return iso.substring(11, 16);
  }

  function pickColor() {
    const colors = [
      "#2A9D8F", "#E76F51", "#F4A261", "#E9C46A", "#264653",
      "#457B9D", "#1D3557", "#9B5DE5", "#F72585", "#06D6A0"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function moneyBR(val) {
    const num = typeof val === "number" ? val : parseFloat(val) || 0;
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  // Enums
  const PAYMENT_STATUS = {
    PAID: "PAID",
    PENDING: "PENDING",
    PARTIAL: "PARTIAL",
    FREE: "FREE"
  };

  const PAYMENT_METHOD = {
    PIX: "PIX",
    CARD: "CARD",
    CASH: "CASH",
    TRANSFER: "TRANSFER",
    OTHER: "OTHER"
  };

  const CARD_TYPE = {
    CREDIT: "CREDIT",
    DEBIT: "DEBIT"
  };

  const CARD_BRAND = {
    VISA: "VISA",
    MASTERCARD: "MASTERCARD",
    ELO: "ELO",
    AMEX: "AMEX",
    HIPERCARD: "HIPERCARD",
    OTHER: "OTHER"
  };

  function normalizeCard(card) {
    if (!card) return null;
    return {
      type: card.type || null,
      brand: card.brand || null,
      installments: parseInt(card.installments) || 1,
      authorization: card.authorization || null,
      fee: parseFloat(card.fee) || 0
    };
  }

  // ============================================================================
  // OPERAÇÕES COM PACIENTES
  // ============================================================================

  async function getAllPatients() {
    try {
      const { data, error } = await sb
        .from("patients")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar pacientes:", err);
      toast("Erro ao carregar pacientes");
      return [];
    }
  }

  async function getPatientById(id) {
    try {
      const { data, error } = await sb
        .from("patients")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("❌ Erro ao buscar paciente:", err);
      return null;
    }
  }

  async function addPatient(patient) {
    try {
      const newPatient = {
        id: uid(),
        name: patient.name || "",
        cpf: cleanCPF(patient.cpf) || "",
        email: patient.email || "",
        phone: patient.phone || "",
        address: patient.address || "",
        color: patient.color || pickColor(),
        consultation_value: parseFloat(patient.consultation_value) || 0,
        financial_note: patient.financial_note || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from("patients")
        .insert([newPatient])
        .select()
        .single();

      if (error) throw error;
      
      toast(`Paciente ${data.name} cadastrado com sucesso!`);
      return data;
    } catch (err) {
      console.error("❌ Erro ao adicionar paciente:", err);
      toast("Erro ao cadastrar paciente");
      throw err;
    }
  }

  async function updatePatient(id, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      if (updateData.cpf) {
        updateData.cpf = cleanCPF(updateData.cpf);
      }

      const { data, error } = await sb
        .from("patients")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      
      toast("Paciente atualizado com sucesso!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao atualizar paciente:", err);
      toast("Erro ao atualizar paciente");
      throw err;
    }
  }

  async function searchPatients(query) {
    try {
      const q = normalize(query);
      const cpfClean = cleanCPF(query);
      
      const { data, error } = await sb
        .from("patients")
        .select("*")
        .or(`name.ilike.%${query}%,cpf.eq.${cpfClean}`)
        .order("name", { ascending: true });

      if (error) throw error;
      
      // Filtro adicional no cliente para busca mais precisa
      return (data || []).filter(p => {
        const nameMatch = normalize(p.name).includes(q);
        const cpfMatch = cleanCPF(p.cpf) === cpfClean;
        return nameMatch || cpfMatch;
      });
    } catch (err) {
      console.error("❌ Erro ao buscar pacientes:", err);
      return [];
    }
  }

  // ============================================================================
  // OPERAÇÕES COM PROFISSIONAIS
  // ============================================================================

  async function getAllProfessionals() {
    try {
      const { data, error } = await sb
        .from("professionals")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar profissionais:", err);
      toast("Erro ao carregar profissionais");
      return [];
    }
  }

  async function getProfessionalById(id) {
    try {
      const { data, error } = await sb
        .from("professionals")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("❌ Erro ao buscar profissional:", err);
      return null;
    }
  }

  async function addProfessional(prof) {
    try {
      const newProf = {
        id: uid(),
        name: prof.name || "",
        email: prof.email || "",
        color: prof.color || pickColor(),
        notify_email: !!prof.notify_email,
        created_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from("professionals")
        .insert([newProf])
        .select()
        .single();

      if (error) throw error;
      
      toast(`Profissional ${data.name} cadastrado!`);
      return data;
    } catch (err) {
      console.error("❌ Erro ao adicionar profissional:", err);
      toast("Erro ao cadastrar profissional");
      throw err;
    }
  }

  async function updateProfessional(id, updates) {
    try {
      const { data, error } = await sb
        .from("professionals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      
      toast("Profissional atualizado!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao atualizar profissional:", err);
      toast("Erro ao atualizar profissional");
      throw err;
    }
  }

  async function deleteProfessional(id) {
    try {
      const { error } = await sb
        .from("professionals")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast("Profissional removido");
      return true;
    } catch (err) {
      console.error("❌ Erro ao deletar profissional:", err);
      toast("Erro ao remover profissional");
      throw err;
    }
  }

  // ============================================================================
  // OPERAÇÕES COM AGENDAMENTOS
  // ============================================================================

  async function getAllAppointments() {
    try {
      const { data, error } = await sb
        .from("appointments")
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar agendamentos:", err);
      return [];
    }
  }

  async function getAppointmentById(id) {
    try {
      const { data, error } = await sb
        .from("appointments")
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("❌ Erro ao buscar agendamento:", err);
      return null;
    }
  }

  async function addAppointment(appt) {
    try {
      const newAppt = {
        id: uid(),
        patient_id: appt.patient_id || appt.patientId,
        professional_id: appt.professional_id || appt.professionalId,
        start_time: appt.start_time || appt.start,
        end_time: appt.end_time || appt.end,
        room: appt.room || "",
        color: appt.color || "#2A9D8F",
        notes: appt.notes || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from("appointments")
        .insert([newAppt])
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .single();

      if (error) throw error;
      
      toast("Agendamento criado!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao criar agendamento:", err);
      toast("Erro ao criar agendamento");
      throw err;
    }
  }

  async function updateAppointment(id, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Normalizar nomes de campos
      if (updateData.patientId) {
        updateData.patient_id = updateData.patientId;
        delete updateData.patientId;
      }
      if (updateData.professionalId) {
        updateData.professional_id = updateData.professionalId;
        delete updateData.professionalId;
      }
      if (updateData.start) {
        updateData.start_time = updateData.start;
        delete updateData.start;
      }
      if (updateData.end) {
        updateData.end_time = updateData.end;
        delete updateData.end;
      }

      const { data, error } = await sb
        .from("appointments")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .single();

      if (error) throw error;
      
      toast("Agendamento atualizado!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao atualizar agendamento:", err);
      toast("Erro ao atualizar agendamento");
      throw err;
    }
  }

  async function deleteAppointment(id) {
    try {
      const { error } = await sb
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast("Agendamento removido");
      return true;
    } catch (err) {
      console.error("❌ Erro ao deletar agendamento:", err);
      toast("Erro ao remover agendamento");
      throw err;
    }
  }

  async function getAppointmentsByPatient(patientId) {
    try {
      const { data, error } = await sb
        .from("appointments")
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .eq("patient_id", patientId)
        .order("start_time", { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar agendamentos do paciente:", err);
      return [];
    }
  }

  async function getUpcomingAppointments(limit = 5) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await sb
        .from("appointments")
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar próximos agendamentos:", err);
      return [];
    }
  }

  // ============================================================================
  // OPERAÇÕES COM ANOTAÇÕES CLÍNICAS
  // ============================================================================

  async function getClinicalNotesByPatient(patientId) {
    try {
      const { data, error } = await sb
        .from("clinical_notes")
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*),
          appointment:appointments(*)
        `)
        .eq("patient_id", patientId)
        .order("note_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar anotações:", err);
      return [];
    }
  }

  async function addClinicalNote(note) {
    try {
      const newNote = {
        id: uid(),
        patient_id: note.patient_id || note.patientId,
        professional_id: note.professional_id || note.professionalId,
        appointment_id: note.appointment_id || note.appointmentId || null,
        note_date: note.note_date || note.date || new Date().toISOString(),
        content: note.content || "",
        created_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from("clinical_notes")
        .insert([newNote])
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .single();

      if (error) throw error;
      
      toast("Anotação salva!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao salvar anotação:", err);
      toast("Erro ao salvar anotação");
      throw err;
    }
  }

  async function updateClinicalNote(id, updates) {
    try {
      const { data, error } = await sb
        .from("clinical_notes")
        .update(updates)
        .eq("id", id)
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .single();

      if (error) throw error;
      
      toast("Anotação atualizada!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao atualizar anotação:", err);
      toast("Erro ao atualizar anotação");
      throw err;
    }
  }

  async function deleteClinicalNote(id) {
    try {
      const { error } = await sb
        .from("clinical_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast("Anotação removida");
      return true;
    } catch (err) {
      console.error("❌ Erro ao deletar anotação:", err);
      toast("Erro ao remover anotação");
      throw err;
    }
  }

// ============================
// Atestados (Impressões)
// ============================
async function addAttestation(payload) {
  const { data, error } = await sb
    .from("attestations")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function updateAttestation(id, payload) {
  const { data, error } = await sb
    .from("attestations")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function getAttestationById(id) {
  const { data, error } = await sb
    .from("attestations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function getAttestationsByPatient(patientId) {
  const { data, error } = await sb
    .from("attestations")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

  // ============================================================================
  // OPERAÇÕES COM PAGAMENTOS
  // ============================================================================

  async function getPaymentsByPatient(patientId) {
    try {
      const { data, error } = await sb
        .from("payments")
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*),
          appointment:appointments(*)
        `)
        .eq("patient_id", patientId)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("❌ Erro ao buscar pagamentos:", err);
      return [];
    }
  }

  async function addPayment(payment) {
    try {
      const newPayment = {
        id: uid(),
        patient_id: payment.patient_id || payment.patientId,
        professional_id: payment.professional_id || payment.professionalId || null,
        appointment_id: payment.appointment_id || payment.appointmentId || null,
        amount: parseFloat(payment.amount) || 0,
        payment_date: payment.payment_date || payment.date || new Date().toISOString(),
        status: payment.status || PAYMENT_STATUS.PENDING,
        method: payment.method || PAYMENT_METHOD.PIX,
        card_type: payment.card_type || payment.card?.type || null,
        card_brand: payment.card_brand || payment.card?.brand || null,
        card_installments: parseInt(payment.card_installments || payment.card?.installments) || 1,
        card_authorization: payment.card_authorization || payment.card?.authorization || null,
        card_fee: parseFloat(payment.card_fee || payment.card?.fee) || 0,
        note: payment.note || "",
        created_at: new Date().toISOString()
      };

      const { data, error } = await sb
        .from("payments")
        .insert([newPayment])
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .single();

      if (error) throw error;
      
      toast("Pagamento registrado!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao registrar pagamento:", err);
      toast("Erro ao registrar pagamento");
      throw err;
    }
  }

  async function updatePayment(id, updates) {
    try {
      const updateData = { ...updates };
      
      // Normalizar campos de cartão
      if (updateData.card) {
        updateData.card_type = updateData.card.type || null;
        updateData.card_brand = updateData.card.brand || null;
        updateData.card_installments = parseInt(updateData.card.installments) || 1;
        updateData.card_authorization = updateData.card.authorization || null;
        updateData.card_fee = parseFloat(updateData.card.fee) || 0;
        delete updateData.card;
      }

      const { data, error } = await sb
        .from("payments")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          patient:patients(*),
          professional:professionals(*)
        `)
        .single();

      if (error) throw error;
      
      toast("Pagamento atualizado!");
      return data;
    } catch (err) {
      console.error("❌ Erro ao atualizar pagamento:", err);
      toast("Erro ao atualizar pagamento");
      throw err;
    }
  }

  async function deletePayment(id) {
    try {
      const { error } = await sb
        .from("payments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast("Pagamento removido");
      return true;
    } catch (err) {
      console.error("❌ Erro ao deletar pagamento:", err);
      toast("Erro ao remover pagamento");
      throw err;
    }
  }

  async function calcFinancialSummary(patientId) {
    try {
      const payments = await getPaymentsByPatient(patientId);
      
      let total = 0;
      let paid = 0;
      let pending = 0;

      payments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        total += amount;
        
        if (p.status === PAYMENT_STATUS.PAID) {
          paid += amount;
        } else if (p.status === PAYMENT_STATUS.PENDING) {
          pending += amount;
        } else if (p.status === PAYMENT_STATUS.PARTIAL) {
          // Para PARTIAL, considera metade como pago
          paid += amount / 2;
          pending += amount / 2;
        }
      });

      return {
        total,
        paid,
        pending,
        balance: pending
      };
    } catch (err) {
      console.error("❌ Erro ao calcular resumo financeiro:", err);
      return { total: 0, paid: 0, pending: 0, balance: 0 };
    }
  }

  // ============================================================================
  // FUNÇÕES AUXILIARES
  // ============================================================================

  async function resetDemo() {
    try {
      // Limpar todas as tabelas
      await sb.from("payments").delete().neq("id", "");
      await sb.from("clinical_notes").delete().neq("id", "");
      await sb.from("appointments").delete().neq("id", "");
      await sb.from("patients").delete().neq("id", "");
      await sb.from("professionals").delete().neq("id", "");

      toast("Banco de dados limpo! Recarregue a página.");
      return true;
    } catch (err) {
      console.error("❌ Erro ao resetar dados:", err);
      toast("Erro ao limpar banco de dados");
      return false;
    }
  }

  // ============================================================================
  // EXPORTAR API
  // ============================================================================

  window.Cornelius = {
    // Utilitários
    pad,
    escapeHtml,
    uid,
    cleanCPF,
    formatCPF,
    normalize,
    toast,
    setActiveNav,
    ys,
    ymdLocal,
    hmLocal,
    isoFromYmdHm,
    isoToYmd,
    isoToHm,
    pickColor,
    moneyBR,
    normalizeCard,

    // Enums
    PAYMENT_STATUS,
    PAYMENT_METHOD,
    CARD_TYPE,
    CARD_BRAND,

    // Pacientes
    getAllPatients,
    getPatientById,
    addPatient,
    updatePatient,
    searchPatients,

    // Profissionais
    getAllProfessionals,
    getProfessionalById,
    addProfessional,
    updateProfessional,
    deleteProfessional,

    // Agendamentos
    getAllAppointments,
    getAppointmentById,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getAppointmentsByPatient,
    getUpcomingAppointments,

    // Anotações clínicas
    getClinicalNotesByPatient,
    addClinicalNote,
    updateClinicalNote,
    deleteClinicalNote,

    // Pagamentos
    getPaymentsByPatient,
    addPayment,
    updatePayment,
    deletePayment,
    calcFinancialSummary,

// Atestados (Impressões)
addAttestation,
updateAttestation,
getAttestationById,
getAttestationsByPatient,


    // Auxiliares
    resetDemo
  };

  console.log("✅ API Cornelius (Supabase) carregada!");
  console.log("💡 Use window.Cornelius para acessar todas as funções");
  console.log("⚠️ IMPORTANTE: Todas as funções retornam Promises (use async/await)");

})();
