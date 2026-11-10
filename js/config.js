/**
 * CONFIGURAÇÃO DO SUPABASE
 * 
 * Como o aplicativo é publicado de forma 100% estática no GitHub Pages,
 * o navegador lê as credenciais diretamente deste arquivo (ou do localStorage se configurado no painel).
 * 
 * ONDE ENCONTRAR NO SUPABASE:
 * 1. Acesse: https://supabase.com/dashboard
 * 2. Abra o seu projeto.
 * 3. Vá no menu lateral esquerdo em "Project Settings" (ícone de engrenagem) > "API".
 * 4. Copie "Project URL" e cole em `url`.
 * 5. Copie a chave "anon public" e cole em `anonKey`.
 * (Atenção: NUNCA coloque a chave "service_role" aqui, use apenas a chave "anon"!)
 */

window.SUPABASE_CONFIG = {
  url: "https://SEU_PROJETO.supabase.co", // Substitua pela URL do seu projeto
  anonKey: "sua-chave-anon-publica-aqui"  // Substitua pela sua chave anon public
};
