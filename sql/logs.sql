-- ==============================================================================
-- LOGS DE E-MAIL E WHATSAPP — MERLY BEAUTY STUDIO
-- Rode este arquivo inteiro no SQL Editor do Supabase. Pode rodar de novo.
--
-- Depois de rodar, a aba "Testes" do painel admin mostra:
--   • Log de e-mails: toda tentativa feita pelo robô (Edge Function),
--     com sucesso/erro e o motivo exato da falha (ex.: EmailJS recusou).
--   • Log do WhatsApp: tudo que o robô do GitHub Actions enviou
--     (sucesso/falha), mais os testes feitos pela aba Testes.
--   • Fila de e-mails (email_outbox): o que está aguardando envio.
-- ==============================================================================

-- 1) LOG DE E-MAILS (escrito pela Edge Function send-reminders) ---------------
CREATE TABLE IF NOT EXISTS public.email_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind        TEXT NOT NULL,         -- client_email_booked | client_email_day | client_email_hour
                                       -- studio_email_*     | outbox | teste
    to_email    TEXT,
    booking_id  TEXT,
    status      TEXT NOT NULL,         -- 'ok' | 'erro'
    detail      TEXT,                  -- "EmailJS 200" ou o motivo exato do erro
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura do log de e-mails" ON email_log;
CREATE POLICY "Leitura do log de e-mails" ON email_log
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Edge Function registra log de e-mails" ON email_log;
CREATE POLICY "Edge Function registra log de e-mails" ON email_log
    FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON email_log(created_at DESC);

-- 2) LOG DO WHATSAPP (escrito pelo robô do GitHub Actions e pelos testes) -----
CREATE TABLE IF NOT EXISTS public.whatsapp_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind        TEXT NOT NULL,         -- 'dia' | 'hora' | 'teste' | 'manual'
    phone       TEXT,                  -- para onde foi (só dígitos)
    status      TEXT NOT NULL,         -- 'ok' | 'erro' | 'teste-cego'
    detail      TEXT,                  -- idMessage devolvido pela GREEN-API, ou o erro
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura do log de WhatsApp" ON whatsapp_log;
CREATE POLICY "Leitura do log de WhatsApp" ON whatsapp_log
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Robô registra log de WhatsApp" ON whatsapp_log;
CREATE POLICY "Robô registra log de WhatsApp" ON whatsapp_log
    FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_created_at ON whatsapp_log(created_at DESC);

-- 3) FILA DE E-MAILS: a aba Testes precisa LER o que está na fila --------------
DROP POLICY IF EXISTS "Leitura da fila de e-mails" ON email_outbox;
CREATE POLICY "Leitura da fila de e-mails" ON email_outbox
    FOR SELECT USING (true);
