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
│   ├── economia.js         # Aba de faturamento, pizza e rankings
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
3. Defina um nome (ex: `merly-beauty-studio`), crie uma senha forte para o banco e selecione a região mais próxima (ex: `São Paulo - sa-east-1`).
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

### 3. Executar os Scripts no SQL Editor do Supabase
1. No menu lateral esquerdo do Supabase, clique no ícone **"SQL Editor"** (ícone de código `>_`).
2. Clique no botão **"+ New Query"** (Nova Consulta).
3. Abra o arquivo [`sql/schema.sql`](sql/schema.sql) deste projeto, copie todo o seu conteúdo e cole no SQL Editor do Supabase.
4. Clique no botão verde **"RUN"** (ou pressione `Ctrl + Enter`).
5. Depois, repita o processo com o arquivo [`sql/carousel_bio.sql`](sql/carousel_bio.sql) para criar as tabelas do **carrossel de fotos** (`studio_gallery`) e da **biografia** (`studio_bio`).
6. Ainda no SQL Editor, rode o arquivo [`sql/lgpd.sql`](sql/lgpd.sql) para criar a coluna `consent_at` (data/hora do aceite da Política de Privacidade) e as consultas rápidas para pedidos de titulares (art. 18 da LGPD).
7. Pronto! Todas as tabelas, políticas de segurança (RLS), serviços pré-cadastrados e a coluna de consentimento LGPD serão criados.

> Se `create extension pg_cron` der erro de permissão, o envio de lembretes por e-mail pode ser agendado pelo **cron-job.org** (URL `https://SEU_PROJETO.supabase.co/functions/v1/send-reminders`, método GET, a cada 5 minutos).

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
git remote add origin https://github.com/Victorhugowille/melry-beauty-studio.git

# 6. Enviar os arquivos para o GitHub
git push -u origin main
```

*(Se o repositório tiver outro nome no seu GitHub, basta trocar `merly-agendas.git` pelo nome escolhido).*

---

### 5. Configurar Domínio Personalizado (merlystudio.com.br)

O domínio personalizado precisa ser criado manualmente no **registro.br** (NS `a.auto.dns.br`, `b.auto.dns.br`) e no painel do **GitHub Pages**:

1. **CNAME no repo:** O arquivo `CNAME` já está criado com `merlystudio.com.br`. Suba para o branch `main` e configure no GitHub:
   - **Repo → Settings → Pages → Custom domain**: digite `merlystudio.com.br` e aponte para o CNAME.
2. **DNS no registro.br:** Você precisa configurar os registros (A/AAAA/CNAME) no painel do registro.br — este ambiente não tem acesso. Use o DNS auto (`a.auto.dns.br`, `b.auto.dns.br`).
3. **Enforce HTTPS:** Após propagar, em **Settings → Pages → Build and deployment → Enforce HTTPS**, marque **On**.
4. **Canonical:** Adicione `<link rel="canonical" href="https://merlystudio.com.br/">` no `<head>` do `index.html` (opcional).

---

### 6. Verificar e Publicar

```bash
git add .
git commit -m "chore: configure domínio merlystudio.com.br e enforce HTTPS"
git push origin main
```

Depois, vá no GitHub → **Settings → Pages** → **Custom domain** → **Save**. O site vai aparecer em `https://merlystudio.com.br/`.

> ⚠️ A configuração de DNS (registro.br) e do custom domain no GitHub Pages exige ação manual do usuário — este ambiente não tem acesso ao registro.br nem `gh`. Siga as instruções acima ou faça isso no painel do registro.br.

---

## 🔐 Acesso ao Painel da Profissional (Admin)

Na parte inferior da página inicial, clique em **"Área da Profissional"** e digite apenas a senha para gerenciar o estúdio.
*(A senha de acesso é configurada diretamente pela profissional no arquivo `js/core.js`, constante `PASS`).*

### Agendamento da cliente:
- A cliente escolhe o serviço, navega pelo **calendário mensal**, seleciona um dia com horários disponíveis, escolhe o horário e confirma com nome e WhatsApp. Dias sem vaga aparecem desabilitados.

### Funcionalidades do Painel:
O painel abre com um **menu lateral (drawer)** com todas as abas.
- **Faturamento:** resumo do que já entrou por período (mês, 30/90 dias, ano, tudo ou **um intervalo de dias escolhido por você**), com atendimentos, ticket médio, clientes, **gráfico de pizza** por serviço, ranking dos serviços mais feitos e das clientes que mais gastaram.
- **Serviços:** Adicione, edite ou exclua serviços, categorize entre Manicure, Sobrancelhas ou Cílios, defina valores, tempos e envie fotos.
- **Galeria:** Escolha até 8 fotos para o carrossel exibido logo abaixo da logo na página principal, com legenda opcional.
- **Horários:** Grade padrão já pronta — segunda a sexta das 7h às 11h30 e das 19h às 20h, sábado das 13h às 19h, domingo fechado. Clique nos slots de 30 minutos para personalizar, use **"Aplicar horário padrão"** para restaurar o dia ou **"Fechar o dia"** para bloquear tudo.
- **Agenda:** Visualize todos os agendamentos das clientes agrupados por dia, com botão direto para chamar a cliente no **WhatsApp** com 1 clique!
- **Biografia:** Atualize nome, especialidades, texto de apresentação e foto de perfil — dados salvos no Supabase.
- **Exportar PDF:** gere a página principal em PDF **igual à tela** (fundo texturizado, cartões e botões), sem o carrossel de fotos.

---

## 🤖 Robôs: keep-alive do Supabase, WhatsApp da profissional e e-mail do cliente

- **Supabase keep-alive** (`supabase-keepalive.yml`): ping diário no banco para o projeto gratuito não ser pausado por inatividade.
- **Avisos para a profissional** (`whatsapp-reminders.yml`, GitHub Actions): a cada 10 minutos, avisa a Maria no WhatsApp 24h antes e ~1h antes de cada atendimento confirmado.
- **E-mails para o cliente** (`supabase/functions/send-reminders`): confirmação na hora + lembretes de **1 dia antes** e **~1 hora antes**, por e-mail via **EmailJS** (grátis, 200 e-mails/mês), com **cópia para o estúdio** (STUDIO_EMAIL). Não depende de computador ligado: o próprio Supabase chama a função a cada 5 minutos (pg_cron).

> **Por que e-mail e não WhatsApp do cliente?** Não existe caminho gratuito, oficial e 100% automatizado para mandar WhatsApp a números de clientes sem servidor próprio. O e-mail resolve isso de graça e sem o seu PC ligado.

### Como ativar os lembretes no WhatsApp (profissional)

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

### Como ativar os e-mails para o cliente (EmailJS, grátis)

O Supabase não permite SMTP direto, então o envio é feito pela API do **EmailJS** (que conecta no seu Gmail e manda os e-mails). Conta grátis, **sem SMS**, 200 e-mails/mês.

1. No **SQL Editor** do Supabase, rode o `sql/notifications.sql` (cria a coluna `email`, ajusta os tipos de aviso e remove a tabela antiga de push; é seguro rodar de novo).
2. Crie a conta em **emailjs.com** (com e-mail ou com o Google).
3. Em **Email Services** > **Add New Service**, escolha **Gmail** e autorize com o seu Gmail. Copie o **Service ID**.
4. Em **Email Templates** > **Create New Template**, configure:
   - **To:** `{{to_email}}`
   - **Subject:** `🌸 Melry Beauty Studio · seu agendamento`
   - **Content** (HTML):
     ```html
     <p style="font-size:18px;color:#c95b79"><strong>🌸 Melry Beauty Studio</strong></p>
     <p style="font-size:18px"><strong>{{title}}</strong></p>
     <p>{{line1}}</p>
     <p>{{line2}}<br>{{line3}}<br>{{line4}}</p>
     <p style="color:#8a6b6b">Qualquer imprevisto, é só chamar no WhatsApp do estúdio. Te esperamos! ✨</p>
     ```
   - Copie o **Template ID**.
5. Em **Account** > **API Keys**, copie a **Public Key** e a **Private Key**.
6. No seu PC (uma vez só):
   ```bash
   npx supabase secrets set EMAILJS_SERVICE_ID=service_xxx EMAILJS_TEMPLATE_ID=template_xxx EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxxxxxxx EMAILJS_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxx --project-ref oahywgiwvrjpnqwuffem --yes
   ```
7. O **cron já é criado pelo próprio SQL** do item 1 (pg_cron chama a função a cada 5 minutos). Se o `create extension pg_cron` der erro de permissão, use o **cron-job.org** como plano B:
   - **URL:** `https://oahywgiwvrjpnqwuffem.supabase.co/functions/v1/send-reminders`
   - **Método:** GET · **A cada:** 5 minutos
8. Pronto. Quando um cliente agenda, ele digita o e-mail e recebe a confirmação em até ~5 minutos, depois os avisos de 1 dia e de 1 hora antes.

> Para trocar o remetente para o e-mail da Maria depois: adicione um novo serviço Gmail com a conta dela no EmailJS e atualize o EMAILJS_SERVICE_ID.

### Como testar

- **WhatsApp da profissional:** aba **Actions** > **Lembretes no WhatsApp** > **Run workflow** e marque "Enviar apenas uma mensagem de teste".
- **E-mail:** crie um agendamento de teste no site com o seu e-mail (o formulário agora pede e-mail) e confira a caixa de entrada em alguns minutos. Para forçar, chame a URL da função no navegador: `https://oahywgiwvrjpnqwuffem.supabase.co/functions/v1/send-reminders`.

---
