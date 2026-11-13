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
│   ├── base.css                    # Tokens, reset, tipografia e utilitários
│   ├── cabecalho-carrossel.css     # Logo, tema e carrossel de fotos
│   ├── servicos.css                # Cartões de serviços da página inicial
│   ├── biografia-rodape.css        # Seção "Quem Sou Eu" e rodapé
│   ├── formularios-botoes.css      # Inputs, botões, foco e formulários
│   ├── cartoes-listas.css          # Cards, listas, miniaturas e prévias
│   ├── login-painel.css            # Login e estrutura do painel
│   ├── horarios.css                # Grade de horários do painel
│   ├── agendamento-calendario.css  # Calendário mensal e fluxo de agendamento
│   ├── carregamento.css            # Splash screen com vídeo
│   └── responsivo.css              # Responsividade, acessibilidade e impressão
├── js/
│   ├── config.js           # URL e Anon Key do Supabase
│   ├── supabaseClient.js   # Integração Supabase e fallback offline
│   ├── core.js             # Utilidades, estado global e grade padrão
│   ├── bio.js              # Biografia e apresentação da profissional
│   ├── gallery.js          # Carrossel público e galeria do painel
│   ├── services.js         # Catálogo e cadastro de serviços
│   ├── booking.js          # Calendário e agendamento da cliente
│   ├── schedule.js         # Grade de horários do painel
│   ├── agenda.js           # Agenda de clientes e cancelamentos
│   ├── pdf.js              # Exportação da página em PDF
│   └── app.js              # Inicialização, login, painel e tema
└── sql/
    ├── schema.sql          # Tabelas de serviços, horários e agendamentos
    └── carousel_bio.sql    # Tabelas do carrossel de fotos e da biografia
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
5. Depois, repita o processo com o arquivo [`sql/carousel_bio.sql`](sql/carousel_bio.sql) para criar as tabelas do **carrossel de fotos** (`studio_gallery`) e da **biografia** (`studio_bio`).
6. Pronto! Todas as tabelas, políticas de segurança (RLS) e serviços pré-cadastrados serão criados instantaneamente.

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

Na parte inferior da página inicial, clique em **"Área da Profissional"** e digite apenas a senha para gerenciar o estúdio.
*(A senha de acesso é configurada diretamente pela profissional no arquivo `js/core.js`, constante `PASS`).*

### Agendamento da cliente:
- A cliente escolhe o serviço, navega pelo **calendário mensal**, seleciona um dia com horários disponíveis, escolhe o horário e confirma com nome e WhatsApp. Dias sem vaga aparecem desabilitados.

### Funcionalidades do Painel:
- **Serviços:** Adicione, edite ou exclua serviços, categorize entre Manicure, Sobrancelhas ou Cílios, defina valores, tempos e envie fotos.
- **Galeria:** Escolha até 8 fotos para o carrossel exibido logo abaixo da logo na página principal, com legenda opcional.
- **Horários:** Grade padrão já pronta — segunda a sexta das 7h às 11h30 e das 19h às 20h, sábado das 13h às 19h, domingo fechado. Clique nos slots de 30 minutos para personalizar, use **"Aplicar horário padrão"** para restaurar o dia ou **"Fechar o dia"** para bloquear tudo.
- **Agenda:** Visualize todos os agendamentos das clientes agrupados por dia, com botão direto para chamar a cliente no **WhatsApp** com 1 clique!
- **Biografia:** Atualize nome, especialidades, texto de apresentação e foto de perfil — dados salvos no Supabase.
- **Exportar PDF:** Gere o catálogo vertical da página principal já com o carrossel e a biografia atualizados.

---

## 🤖 Robôs: keep-alive do Supabase, lembretes no WhatsApp e push para o cliente

Três robôs rodam no **GitHub Actions**:

- **Supabase keep-alive** (`supabase-keepalive.yml`): ping diário no banco para o projeto gratuito não ser pausado por inatividade.
- **Avisos para a profissional** (`whatsapp-reminders.yml`): a cada 10 minutos, avisa a Maria 24h antes e ~1h antes de cada atendimento confirmado.
- **Avisos para o cliente** (`send-client-push.mjs`, mesmo workflow): na tela de "Agendamento confirmado" o cliente pode tocar em **Ativar lembretes neste aparelho** (de graça, via Web Push). Depois disso, recebe automaticamente a confirmação e os avisos de **1 dia antes** e **~1 hora antes** — mesmo com o site fechado e sem custo.

> **Nota honesta sobre o WhatsApp do cliente:** não existe caminho gratuito, oficial e automatizado para enviar WhatsApp a qualquer número (o CallMeBot só envia para quem ativou; a Meta cobra pelos templates). Por isso o aviso ao cliente é via **push no aparelho** (sem cadastro, sem custo), o mesmo esquema — confirmação + 1 dia antes + 1 hora antes. No iPhone é preciso abrir o site pelo ícone da tela de início (Adicionar à Tela de Início).

### Como ativar os lembretes no WhatsApp

O robô usa o **CallMeBot** (grátis, uso pessoal). Quem precisa ativar é o dono do número que receberá as mensagens:

1. Salve o número **+34 644 26 33 77** nos contatos do seu celular.
2. Envie pelo WhatsApp a mensagem: `I allow callmebot to send me messages`.
3. Aguarde a resposta com a sua `apikey`.
4. No GitHub, abra o repositório > **Settings** > **Secrets and variables** > **Actions**.
5. Clique em **"New repository secret"**:
   - **Name:** `CALLMEBOT_APIKEY`
   - **Secret:** cole a chave recebida do CallMeBot
   - Clique em **"Add secret"**.
6. (Opcional) Outro secret `WHATSAPP_PHONE` define o número de destino. Padrão: **+55 45 9109-6203**.

### Como testar

Vá na aba **Actions** > **Lembretes no WhatsApp e no aparelho** > **Run workflow** > **Run workflow** e marque "Enviar apenas uma mensagem de teste". Você recebe a mensagem no número configurado e, se houver inscrições push de clientes, também um push de teste.

### Como ativar os avisos para o cliente (push gratuito)

1. No **SQL Editor** do Supabase, rode o `sql/notifications.sql` (ele agora também cria a tabela `push_subscriptions` e libera os novos tipos de aviso; é seguro rodar de novo).
2. No GitHub, em **Settings** > **Secrets and variables** > **Actions**, crie dois secrets:
   - **Name:** `VAPID_PRIVATE_KEY`  **Secret:** a chave privada gerada (a pública já está no `js/push-config.js`)
   - **Name:** `VAPID_SUBJECT` (opcional) **Secret:** `mailto:seuemail@dominio.com`
3. Pronto. Quando um cliente agendar, a tela de confirmação oferece o botão **Ativar lembretes neste aparelho**. O robô envia a confirmação na hora do agendamento, e os avisos de 1 dia e de 1 hora antes.

---
