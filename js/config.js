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
  url: "https://oahywgiwvrjpnqwuffem.supabase.co", // URL oficial do projeto Supabase
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9haHl3Z2l3dnJqcG5xd3VmZmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNTA0ODUsImV4cCI6MjEwOTgyNjQ4NX0.nHp40bBDAaPlmWWfq49F-HN8BUBtO5zAMBihVuDCWNU"  // Chave anon public
};
