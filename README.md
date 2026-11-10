# Melry Beauty Studio · Aplicativo de Agendamentos 💅✨

Aplicativo moderno e responsivo de agendamento online para estúdios de beleza especializados em:
- **Manicure e Pedicure** (Tradicional, Esmaltação em Gel, Alongamento em Fibra de Vidro, Spa dos Pés)
- **Designer de Sobrancelhas** (Design personalizado, Henna, Brow Lamination)
- **Extensão de Cílios** (Fio a Fio Clássico, Volume Russo, Lash Lifting)

---

## 🏗️ Arquitetura do Projeto

- **Frontend:** HTML5, CSS3 moderno (variáveis, temas claro/escuro, mobile-first) e JavaScript Vanilla modular.
- **Backend & Banco de Dados:** [Supabase](https://supabase.com/) (PostgreSQL com Row Level Security - RLS).
- **Hospedagem:** [GitHub Pages](https://pages.github.com/) (100% gratuito e compatível com qualquer navegador, incluindo Google Chrome no PC e celular).
- **Resiliência:** Camada DAL inteligente com fallback automático para `localStorage` enquanto o Supabase não estiver conectado.

---

## 📁 Estrutura de Arquivos

```text
├── index.html              # Ponto de entrada principal para o GitHub Pages
├── .env                    # Chaves do Supabase locais
├── .env.example            # Exemplo de variáveis de ambiente
├── .gitignore              # Arquivos ignorados pelo Git
├── css/
│   └── style.css           # Estilização completa, temas claro/escuro e responsividade
├── js/
│   ├── config.js           # Onde colar a URL e a Anon Key do Supabase para o GitHub Pages
│   ├── supabaseClient.js   # Integração com Supabase SDK e fallback offline
│   └── app.js              # Lógica de interface, agendamento, slots e painel admin
└── sql/
    └── schema.sql          # Script SQL completo para rodar no Supabase SQL Editor
```

---

## 🚀 Guia Passo a Passo de Implantação

### 1. Criar o Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com/) e faça login (pode entrar com o próprio GitHub).
2. Clique em **"New Project"** (Novo Projeto).
3. Defina um nome (ex: `merly-agendas`), crie uma senha forte para o banco e selecione a região mais próxima (ex: `São Paulo - sa-east-1`).
4. Clique em **"Create new project"** e aguarde cerca de 1 a 2 minutos até o banco inicializar.

---

### 2. Onde Encontrar as Chaves no Supabase e Onde Colocá-las

#### Onde encontrar no Supabase:
1. No painel do seu projeto no Supabase, olhe o menu lateral esquerdo.
2. Clique no ícone de engrenagem **"Project Settings"** (Configurações do Projeto).
3. No submenu, clique em **"API"** (ou **"Data API"**).
4. Você verá duas informações essenciais:
   - **Project URL:** algo como `https://xyzcompany.supabase.co`
   - **Project API Keys:** copie o valor da chave chamada **`anon` `public`**  
     *(⚠️ NUNCA copie a chave `service_role`, pois ela tem poder total e não deve ir no frontend)*.

#### Onde colocar as chaves no projeto:
1. **Para referência local:** No arquivo [`.env`](.env):
   ```env
   SUPABASE_URL=https://SEU_PROJETO.supabase.co
   SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```
2. **Para o GitHub Pages funcionar no Chrome:** No arquivo [`js/config.js`](js/config.js):
   ```javascript
   window.SUPABASE_CONFIG = {
     url: "https://SEU_PROJETO.supabase.co",
     anonKey: "sua-chave-anon-aqui"
   };
   ```

---

### 3. Executar o Script no SQL Editor do Supabase
1. No menu lateral esquerdo do Supabase, clique no ícone **"SQL Editor"** (ícone de código `>_`).
2. Clique no botão **"+ New Query"** (Nova Consulta).
3. Abra o arquivo [`sql/schema.sql`](sql/schema.sql) deste projeto, copie todo o seu conteúdo e cole no SQL Editor do Supabase.
4. Clique no botão verde **"RUN"** (ou pressione `Ctrl + Enter`).
5. Pronto! Todas as tabelas (`services`, `availability`, `bookings`), políticas de segurança (RLS) e serviços pré-cadastrados serão criados instantaneamente.

---

### 4. Como Subir para o seu GitHub

Abra o terminal na pasta do projeto (`c:\projetos\Merly_agendas`) e execute:

```bash
# 1. Inicializar o repositório Git local
git init

# 2. Adicionar todos os arquivos
git add .

# 3. Fazer o primeiro commit
git commit -m "feat: app de agendamento Melry Beauty Studio com Supabase e GitHub Pages"

# 4. Criar a branch main
git branch -M main

# 5. Conectar com o seu repositório no GitHub (crie antes o repositório vazio em github.com/new)
git remote add origin https://github.com/Victorhugowille/merly-agendas.git

# 6. Enviar os arquivos para o GitHub
git push -u origin main
```

*(Se o repositório tiver outro nome no seu GitHub, basta trocar `merly-agendas.git` pelo nome escolhido).*

---

### 5. Como Ativar o GitHub Pages para Abrir no Chrome

1. Acesse o seu repositório no GitHub: `https://github.com/Victorhugowille/merly-agendas`.
2. Clique na aba superior **"Settings"** (Configurações).
3. No menu lateral esquerdo, clique em **"Pages"**.
4. Na seção **"Build and deployment"**:
   - Em **Source**, selecione: `Deploy from a branch`.
   - Em **Branch**, selecione `main` e a pasta `/(root)`.
   - Clique em **"Save"**.
5. Aguarde cerca de 1 a 2 minutos. O GitHub exibirá no topo da página:  
   👉 **"Your site is live at https://victorhugowille.github.io/merly-agendas/"**
6. Basta clicar no link e abrir no Google Chrome! 🚀

---

## 🔐 Acesso ao Painel da Profissional (Admin)

Na parte inferior da página inicial, clique em **"Área da Profissional"** para gerenciar serviços, horários, agendamentos e exportar o catálogo em PDF vertical.
*(As credenciais de acesso são configuradas diretamente pela profissional).*

### Funcionalidades do Painel:
- **Serviços:** Adicione, edite ou exclua serviços, categorize entre Manicure, Sobrancelhas ou Cílios, defina valores, tempos e envie fotos.
- **Horários:** Selecione o dia e clique nos slots de 30 minutos para liberar ou bloquear. Botão rápido **"Liberar 9h às 18h"**.
- **Agenda:** Visualize todos os agendamentos das clientes agrupados por dia, com botão direto para chamar a cliente no **WhatsApp** com 1 clique!
