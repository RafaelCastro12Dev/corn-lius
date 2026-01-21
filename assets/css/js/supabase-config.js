/**
 * Cornélius - Configuração do Supabase
 * 
 * Este arquivo configura a conexão com o banco de dados Supabase.
 * Inicializa o cliente e exporta para uso global.
 */

(function () {
  "use strict";

  // Credenciais do projeto Supabase
  const SUPABASE_URL = "https://mdsjlkvptpynjjhioidp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc2psa3ZwdHB5bmpqaGlvaWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NzA5NjYsImV4cCI6MjA4NDA0Njk2Nn0.WkY-gIe4ksS7mmKgNEhGfC_pKYdEjCHjaMXCjnEaOxc";

  // Verificar se o Supabase JS Client está carregado
  if (typeof supabase === "undefined") {
    console.error("❌ Supabase JS Client não encontrado!");
    console.error("📦 Adicione antes de supabase-config.js:");
    console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    throw new Error("Supabase JS Client não carregado");
  }

  // Criar cliente Supabase
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Exportar para uso global
 // Exportar para uso global (compatível)
window.supabaseClient = supabaseClient;   // padrão (recomendado)
window.SupabaseClient = supabaseClient;   // mantém compatibilidade com seu código antigo


  console.log("✅ Supabase configurado com sucesso!");
  console.log("🔗 Project URL:", SUPABASE_URL);

})();
