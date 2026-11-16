-- ==============================================================================
-- SCHEMA DO SUPABASE: MERLY BEAUTY STUDIO
-- Aplicativo de Agendamento: Manicure, Designer de Sobrancelha e Cílios
-- ==============================================================================
-- Instruções:
-- 1. Acesse o painel do Supabase: https://supabase.com/dashboard
-- 2. No menu lateral esquerdo, clique no ícone "SQL Editor" (ícone com terminal/código)
-- 3. Clique em "+ New Query" (Nova Consulta)
-- 4. Cole todo este código abaixo e clique no botão verde "RUN" (ou Ctrl+Enter)
-- ==============================================================================

-- 1. TABELA DE SERVIÇOS
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'geral', -- 'cilios', 'sobrancelhas', 'manicure', 'geral'
    preco NUMERIC(10, 2) NOT NULL,
    dur INTEGER NOT NULL,                   -- Duração em minutos (ex: 30, 45, 60, 90, 120)
    foto TEXT,                              -- URL ou Base64 da imagem
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABELA DE DISPONIBILIDADE (HORÁRIOS DA PROFISSIONAL)
-- status: 1 = livre (disponível para cliente agendar), 2 = ocupado/bloqueado
CREATE TABLE IF NOT EXISTS availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL,                     -- Formato YYYY-MM-DD
    minute INTEGER NOT NULL,                -- Minuto do dia (ex: 540 = 09:00, 1080 = 18:00)
    status INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_date_minute UNIQUE (date, minute)
);

-- 3. TABELA DE AGENDAMENTOS (BOOKINGS)
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    svc TEXT REFERENCES services(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,                     -- Nome do serviço no momento do agendamento
    preco NUMERIC(10, 2) NOT NULL,
    date TEXT NOT NULL,                     -- Formato YYYY-MM-DD
    start INTEGER NOT NULL,                 -- Minuto de início (ex: 540 = 09:00)
    dur INTEGER NOT NULL,                   -- Duração em minutos
    name TEXT NOT NULL,                     -- Nome da cliente
    phone TEXT NOT NULL,                    -- Telefone / WhatsApp da cliente
    email TEXT,                             -- E-mail do cliente (para lembretes)
    status TEXT NOT NULL DEFAULT 'confirmado', -- 'confirmado', 'cancelado', 'concluido'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_services_categoria ON services(categoria);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 5. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE ACESSO (RLS POLICIES)
-- Políticas para serviços: todos podem ler, app/admin pode gerenciar
DROP POLICY IF EXISTS "Servicos publicos para leitura" ON services;
CREATE POLICY "Servicos publicos para leitura" ON services
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciamento de servicos" ON services;
CREATE POLICY "Gerenciamento de servicos" ON services
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para disponibilidade: todos podem ler os horários disponíveis
DROP POLICY IF EXISTS "Disponibilidade publica para leitura" ON availability;
CREATE POLICY "Disponibilidade publica para leitura" ON availability
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gerenciamento de disponibilidade" ON availability;
CREATE POLICY "Gerenciamento de disponibilidade" ON availability
    FOR ALL USING (true) WITH CHECK (true);

-- Políticas para agendamentos: clientes podem criar, e app/admin pode ler e cancelar
DROP POLICY IF EXISTS "Agendamentos publicos para leitura" ON bookings;
CREATE POLICY "Agendamentos publicos para leitura" ON bookings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Clientes podem agendar" ON bookings;
CREATE POLICY "Clientes podem agendar" ON bookings
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Gerenciamento de agendamentos" ON bookings;
CREATE POLICY "Gerenciamento de agendamentos" ON bookings
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cancelamento de agendamentos" ON bookings;
CREATE POLICY "Cancelamento de agendamentos" ON bookings
    FOR DELETE USING (true);

-- 7. DADOS INICIAIS (SEED) - TABELA DE VALORES DO ESTÚDIO
INSERT INTO services (id, nome, categoria, preco, dur, foto, ativo, ordem) VALUES
    -- SOBRANCELHAS
    ('brow_design', 'Designer de Sobrancelhas', 'sobrancelhas', 35.00, 30, null, true, 1),
    ('brow_henna', 'Designer com Henna', 'sobrancelhas', 40.00, 60, null, true, 2),
    ('brow_tintura', 'Designer com Tintura', 'sobrancelhas', 40.00, 60, null, true, 3),

    -- CÍLIOS
    ('lash_classico', 'Extensão de Cílios', 'cilios', 150.00, 150, null, true, 4),
    ('lash_russo', 'Extensão de Cílios Volume', 'cilios', 200.00, 150, null, true, 5),
    ('lash_lifting', 'Lash Lifting', 'cilios', 90.00, 60, null, true, 6),

    -- OUTROS
    ('buco', 'Buço', 'geral', 5.00, 10, null, true, 7),

    -- MANICURE E PEDICURE
    ('mani_tradicional', 'Manicure Tradicional', 'manicure', 30.00, 60, null, true, 8),
    ('pedi_tradicional', 'Pedicure Tradicional', 'manicure', 40.00, 60, null, true, 9)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    categoria = EXCLUDED.categoria,
    preco = EXCLUDED.preco,
    dur = EXCLUDED.dur,
    ordem = EXCLUDED.ordem;

-- Habilita extensão de tempo real (opcional para notificações instantâneas)
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
